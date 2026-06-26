import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { LoanEngineService } from '../services/loanEngine';
import { AuditService } from '../services/auditService';
import { RiskService } from '../services/riskService';

const prisma = new PrismaClient();

export class LoanController {
  public static async create(req: Request, res: Response) {
    try {
      const {
        customerId,
        loanTypeId,
        amount,
        interestTypeId,
        interestRate,
        tenureMonths,
        startDate,
        collateralType,
        collateralWeight,
        collateralPurity,
        purityUnit, // KARAT, PERCENTAGE
        collateralValue,
        collateralDescription,
        collateralImages,
      } = req.body;

      if (!customerId || !loanTypeId || !amount || !interestTypeId || !interestRate || !tenureMonths || !startDate) {
        return res.status(400).json({ message: 'Missing required loan parameters.' });
      }

      // Check Customer
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, is_deleted: false },
      });
      if (!customer) return res.status(404).json({ message: 'Customer not found.' });

      // Check Loan Type Master
      const loanType = await prisma.loanTypeMaster.findFirst({
        where: { id: loanTypeId, is_deleted: false },
      });
      if (!loanType) return res.status(404).json({ message: 'Loan type not found.' });

      // Check Interest Type Master
      const interestType = await prisma.interestTypeMaster.findFirst({
        where: { id: interestTypeId, is_deleted: false },
      });
      if (!interestType) return res.status(404).json({ message: 'Interest type not found.' });

      // Get Default Pending Status
      const pendingStatus = await prisma.loanStatusMaster.findFirst({
        where: { code: 'PENDING', is_deleted: false },
      });
      if (!pendingStatus) return res.status(500).json({ message: 'Loan status configuration error.' });

      // Calculate collateral valuation dynamically
      const purityUnitParam = purityUnit || 'PERCENTAGE';
      let marketRateValue = 0;
      let calculatedPurityRatio = 0;
      let calculatedAppraisedValue = 0;
      const manualCollateralValue = collateralValue !== null && collateralValue !== undefined && collateralValue !== ''
        ? parseFloat(collateralValue)
        : null;

      if (collateralType && collateralWeight && collateralPurity) {
        const rateRecord = await prisma.marketRate.findUnique({
          where: { asset: collateralType.toUpperCase() },
        });
        marketRateValue = rateRecord ? rateRecord.rate : 0;

        const purityVal = parseFloat(collateralPurity);
        calculatedPurityRatio = purityUnitParam === 'KARAT' ? purityVal / 24 : purityVal / 100;
        calculatedAppraisedValue = parseFloat(collateralWeight) * marketRateValue * calculatedPurityRatio;

        // Round to 2 decimal places
        calculatedAppraisedValue = Math.round(calculatedAppraisedValue * 100) / 100;
      }

      const appraisedValueAtLoanCreation =
        manualCollateralValue !== null && !Number.isNaN(manualCollateralValue)
          ? manualCollateralValue
          : calculatedAppraisedValue;

      // Calculate schedule using engine
      const calculation = LoanEngineService.calculateSchedule(
        amount,
        interestRate,
        tenureMonths,
        interestType.code as 'SIMPLE' | 'COMPOUND',
        new Date(startDate)
      );

      const userEmail = req.user?.email || 'SYSTEM';

      // Start database transaction
      const loan = await prisma.$transaction(async (tx) => {
        // Create the Loan
        const newLoan = await tx.loan.create({
          data: {
            customerId,
            loanTypeId,
            amount,
            interestTypeId,
            interestRate,
            tenureMonths,
            startDate: new Date(startDate),
            statusId: pendingStatus.id,
            outstandingPrincipal: amount,
            outstandingInterest: calculation.totalInterest,
            created_by: userEmail,
          },
        });

        // Create Collateral
        if (collateralType && collateralWeight) {
          await tx.collateral.create({
            data: {
              loanId: newLoan.id,
              type: collateralType,
              weight: parseFloat(collateralWeight),
              purity: collateralPurity ? parseFloat(collateralPurity) : null,
              purityUnit: purityUnitParam,
              value: appraisedValueAtLoanCreation,
              marketRateAtLoanCreation: marketRateValue,
              purityRatioAtLoanCreation: calculatedPurityRatio,
              appraisedValueAtLoanCreation,
              description: collateralDescription || null,
              images: collateralImages || null,
              created_by: userEmail,
            },
          });
        }

        // Create EMI Schedule
        const scheduleData = calculation.schedule.map((inst) => ({
          loanId: newLoan.id,
          installmentNumber: inst.installmentNumber,
          dueDate: inst.dueDate,
          principalAmount: inst.principalAmount,
          interestAmount: inst.interestAmount,
          totalAmount: inst.totalAmount,
          status: 'UNPAID',
          created_by: userEmail,
        }));

        await tx.emiSchedule.createMany({
          data: scheduleData,
        });

        // Log to timeline
        await tx.loanTimeline.create({
          data: {
            loanId: newLoan.id,
            action: 'CREATED',
            description: `Loan of ₹${amount} created under ${loanType.name} with ${interestType.name} calculations. Initial status is Pending Approval.`,
            createdBy: userEmail,
          },
        });

        return newLoan;
      });

      // Recalculate customer risk
      await RiskService.calculate(customerId);

      // Audit Log
      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'CREATE',
        module: 'LOAN',
        newValue: { loanId: loan.id, amount, customerId },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // ── STEP 6: Re-fetch loan with collateral so frontend gets collateral.id ──
      const loanWithCollateral = await prisma.loan.findUnique({
        where: { id: loan.id },
        include: { collateral: true },
      });

      return res.status(201).json({
        loan: loanWithCollateral,
        emi: calculation.emi,
        totalInterest: calculation.totalInterest,
        totalPayable: calculation.totalPayable,
      });
    } catch (error) {
      console.error('Create Loan Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async import(req: Request, res: Response) {
    try {
      const {
        customerId,
        loanNumber,
        loanTypeId,
        amount,
        interestTypeId,
        interestRate,
        tenureMonths,
        startDate,
        endDate,
        collateralType,
        collateralWeight,
        collateralPurity,
        purityUnit,
        collateralValue,
        collateralDescription,
        status,
        paymentHistoryType,
        paymentHistoryValue,
      } = req.body;

      if (!customerId || !loanTypeId || !amount || !interestTypeId || !interestRate || !tenureMonths || !startDate || !status) {
        return res.status(400).json({ message: 'Missing required loan parameters.' });
      }

      const customer = await prisma.customer.findFirst({
        where: { id: customerId, is_deleted: false },
      });
      if (!customer) return res.status(404).json({ message: 'Customer not found.' });

      const loanType = await prisma.loanTypeMaster.findFirst({
        where: { id: loanTypeId, is_deleted: false },
      });
      if (!loanType) return res.status(404).json({ message: 'Loan type not found.' });

      const interestType = await prisma.interestTypeMaster.findFirst({
        where: { id: interestTypeId, is_deleted: false },
      });
      if (!interestType) return res.status(404).json({ message: 'Interest type not found.' });

      let targetStatusCode = 'APPROVED';
      if (status === 'Completed' || status === 'Closed') {
        targetStatusCode = 'CLOSED';
      } else if (status === 'Defaulted') {
        targetStatusCode = 'OVERDUE';
      }

      const targetStatus = await prisma.loanStatusMaster.findFirst({
        where: { code: targetStatusCode, is_deleted: false },
      });
      if (!targetStatus) return res.status(500).json({ message: `Status code ${targetStatusCode} not found in config.` });

      const startD = new Date(startDate);
      const calculation = LoanEngineService.calculateSchedule(
        amount,
        interestRate,
        tenureMonths,
        interestType.code as 'SIMPLE' | 'COMPOUND',
        startD
      );

      const totalInstallments = calculation.schedule.length;
      let paidInstallmentsCount = 0;

      if (targetStatusCode === 'CLOSED') {
        paidInstallmentsCount = totalInstallments;
      } else {
        const val = parseFloat(paymentHistoryValue || '0');
        if (paymentHistoryType === 'installments_paid') {
          paidInstallmentsCount = Math.min(totalInstallments, Math.max(0, Math.floor(val)));
        } else if (paymentHistoryType === 'principal_paid') {
          let remainingP = val;
          for (let i = 0; i < totalInstallments; i++) {
            const instPrincipal = calculation.schedule[i].principalAmount;
            if (remainingP >= instPrincipal) {
              paidInstallmentsCount = i + 1;
              remainingP -= instPrincipal;
            } else {
              break;
            }
          }
        } else if (paymentHistoryType === 'interest_paid') {
          let remainingI = val;
          for (let i = 0; i < totalInstallments; i++) {
            const instInterest = calculation.schedule[i].interestAmount;
            if (remainingI >= instInterest) {
              paidInstallmentsCount = i + 1;
              remainingI -= instInterest;
            } else {
              break;
            }
          }
        } else if (paymentHistoryType === 'remaining_balance') {
          let remainingP = Math.max(0, amount - val);
          for (let i = 0; i < totalInstallments; i++) {
            const instPrincipal = calculation.schedule[i].principalAmount;
            if (remainingP >= instPrincipal) {
              paidInstallmentsCount = i + 1;
              remainingP -= instPrincipal;
            } else {
              break;
            }
          }
        }
      }

      let totalPaidPrincipal = 0;
      let totalPaidInterest = 0;
      for (let i = 0; i < paidInstallmentsCount; i++) {
        totalPaidPrincipal += calculation.schedule[i].principalAmount;
        totalPaidInterest += calculation.schedule[i].interestAmount;
      }

      const finalOutstandingPrincipal = Math.max(0, Math.round((amount - totalPaidPrincipal) * 100) / 100);
      const finalOutstandingInterest = Math.max(0, Math.round((calculation.totalInterest - totalPaidInterest) * 100) / 100);

      const purityUnitParam = purityUnit || 'PERCENTAGE';
      let marketRateValue = 0;
      let calculatedPurityRatio = 0;
      let calculatedAppraisedValue = 0;
      const manualCollateralValue = collateralValue !== null && collateralValue !== undefined && collateralValue !== ''
        ? parseFloat(collateralValue)
        : null;

      if (collateralType && collateralWeight && collateralPurity) {
        const rateRecord = await prisma.marketRate.findUnique({
          where: { asset: collateralType.toUpperCase() },
        });
        marketRateValue = rateRecord ? rateRecord.rate : 0;

        const purityVal = parseFloat(collateralPurity);
        calculatedPurityRatio = purityUnitParam === 'KARAT' ? purityVal / 24 : purityVal / 100;
        calculatedAppraisedValue = parseFloat(collateralWeight) * marketRateValue * calculatedPurityRatio;
        calculatedAppraisedValue = Math.round(calculatedAppraisedValue * 100) / 100;
      }

      const appraisedValueAtLoanCreation =
        manualCollateralValue !== null && !Number.isNaN(manualCollateralValue)
          ? manualCollateralValue
          : calculatedAppraisedValue;

      const userEmail = req.user?.email || 'SYSTEM';

      const emiPaymentType = await prisma.paymentTypeMaster.findFirst({
        where: { code: 'EMI', is_deleted: false },
      });
      const emiTxType = await prisma.transactionTypeMaster.findFirst({
        where: { code: 'EMI_PAYMENT', is_deleted: false },
      });

      if (!emiPaymentType || !emiTxType) {
        return res.status(500).json({ message: 'EMI payment type or transaction type configuration is missing.' });
      }

      const loan = await prisma.$transaction(async (tx) => {
        const newLoan = await tx.loan.create({
          data: {
            customerId,
            loanTypeId,
            amount,
            interestTypeId,
            interestRate,
            tenureMonths,
            startDate: startD,
            statusId: targetStatus.id,
            outstandingPrincipal: finalOutstandingPrincipal,
            outstandingInterest: finalOutstandingInterest,
            created_by: userEmail,
          },
        });

        if (collateralType && collateralWeight) {
          await tx.collateral.create({
            data: {
              loanId: newLoan.id,
              type: collateralType,
              weight: parseFloat(collateralWeight),
              purity: collateralPurity ? parseFloat(collateralPurity) : null,
              purityUnit: purityUnitParam,
              value: appraisedValueAtLoanCreation,
              marketRateAtLoanCreation: marketRateValue,
              purityRatioAtLoanCreation: calculatedPurityRatio,
              appraisedValueAtLoanCreation,
              description: collateralDescription || (loanNumber ? `Imported loan #${loanNumber}` : null),
              created_by: userEmail,
            },
          });
        }

        const scheduleData = calculation.schedule.map((inst, index) => {
          const isPaid = index < paidInstallmentsCount;
          return {
            loanId: newLoan.id,
            installmentNumber: inst.installmentNumber,
            dueDate: inst.dueDate,
            principalAmount: inst.principalAmount,
            interestAmount: inst.interestAmount,
            totalAmount: inst.totalAmount,
            paidAmount: isPaid ? inst.totalAmount : 0,
            status: isPaid ? 'PAID' : 'UNPAID',
            created_by: userEmail,
          };
        });

        await tx.emiSchedule.createMany({
          data: scheduleData,
        });

        let accumulatedPaidPrincipal = 0;
        let accumulatedPaidInterest = 0;

        for (let i = 0; i < paidInstallmentsCount; i++) {
          const inst = calculation.schedule[i];
          accumulatedPaidPrincipal += inst.principalAmount;
          accumulatedPaidInterest += inst.interestAmount;

          const pRecord = await tx.payment.create({
            data: {
              loanId: newLoan.id,
              paymentTypeId: emiPaymentType.id,
              amount: inst.totalAmount,
              principalPortion: inst.principalAmount,
              interestPortion: inst.interestAmount,
              penaltyPortion: 0,
              remainingBalance: Math.max(0, amount - accumulatedPaidPrincipal),
              referenceNumber: loanNumber ? `IMP-${loanNumber}-${i+1}` : `IMP-HIST-${newLoan.id}-${i+1}`,
              notes: `Imported historical payment for installment #${i+1}`,
              paymentDate: inst.dueDate,
              created_by: userEmail,
            },
          });

          await tx.loanTransaction.create({
            data: {
              loanId: newLoan.id,
              transactionTypeId: emiTxType.id,
              amount: -inst.totalAmount,
              principalImpact: -inst.principalAmount,
              interestImpact: -inst.interestAmount,
              penaltyImpact: 0,
              feeImpact: 0,
              runningPrincipal: Math.max(0, amount - accumulatedPaidPrincipal),
              runningInterest: Math.max(0, calculation.totalInterest - accumulatedPaidInterest),
              runningTotal: Math.max(0, amount - accumulatedPaidPrincipal) + Math.max(0, calculation.totalInterest - accumulatedPaidInterest),
              referenceId: pRecord.id,
              referenceType: 'PAYMENT',
              description: `Imported historical payment #${i+1} — Principal: ₹${inst.principalAmount.toFixed(2)}, Interest: ₹${inst.interestAmount.toFixed(2)}`,
              createdBy: userEmail,
            },
          });
        }

        await tx.loanTimeline.create({
          data: {
            loanId: newLoan.id,
            action: 'CREATED',
            description: `Historical Loan of ₹${amount} imported into status ${status}. ${paidInstallmentsCount} of ${totalInstallments} installments pre-marked as Paid.`,
            createdBy: userEmail,
          },
        });

        if (targetStatusCode === 'CLOSED') {
          await tx.loanTimeline.create({
            data: {
              loanId: newLoan.id,
              action: 'LOAN_CLOSED',
              description: `All ${totalInstallments} installments marked as paid in full. Historical loan closed.`,
              createdBy: userEmail,
            },
          });
        }

        return newLoan;
      });

      await RiskService.calculate(customerId);

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'CREATE',
        module: 'LOAN',
        newValue: { loanId: loan.id, amount, customerId, status: 'IMPORTED' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const loanWithDetails = await prisma.loan.findUnique({
        where: { id: loan.id },
        include: { collateral: true },
      });

      return res.status(201).json({
        loan: loanWithDetails,
        emi: calculation.emi,
        totalInterest: calculation.totalInterest,
        totalPayable: calculation.totalPayable,
      });

    } catch (error) {
      console.error('Import Loan Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async update(req: Request, res: Response) {
    try {
      const loanId = parseInt(req.params.id);
      if (isNaN(loanId)) return res.status(400).json({ message: 'Invalid Loan ID.' });

      const loan = await prisma.loan.findFirst({
        where: { id: loanId, is_deleted: false },
        include: { status: true, interestType: true },
      });

      if (!loan) return res.status(404).json({ message: 'Loan not found.' });

      // Only allow modification on PENDING or DRAFT loans (not active/closed)
      const modifiableStatuses = ['PENDING', 'DRAFT'];
      if (!modifiableStatuses.includes(loan.status.code)) {
        return res.status(400).json({
          message: `Cannot modify loan in status "${loan.status.name}". Only PENDING or DRAFT loans can be modified.`,
        });
      }

      const {
        loanTypeId,
        amount,
        interestTypeId,
        interestRate,
        tenureMonths,
        startDate,
      } = req.body;

      const userEmail = req.user?.email || 'SYSTEM';

      // Resolve updated interest type for schedule recalculation
      const newInterestTypeId = interestTypeId || loan.interestTypeId;
      const interestType = await prisma.interestTypeMaster.findFirst({
        where: { id: newInterestTypeId, is_deleted: false },
      });
      if (!interestType) return res.status(404).json({ message: 'Interest type not found.' });

      const newAmount = amount !== undefined ? parseFloat(amount) : loan.amount;
      const newRate = interestRate !== undefined ? parseFloat(interestRate) : loan.interestRate;
      const newTenure = tenureMonths !== undefined ? parseInt(tenureMonths) : loan.tenureMonths;
      const newStartDate = startDate ? new Date(startDate) : loan.startDate;

      // Recalculate schedule with updated parameters
      const calculation = LoanEngineService.calculateSchedule(
        newAmount,
        newRate,
        newTenure,
        interestType.code as 'SIMPLE' | 'COMPOUND',
        newStartDate
      );

      const updated = await prisma.$transaction(async (tx) => {
        // Soft-delete all existing schedule rows
        await tx.emiSchedule.updateMany({
          where: { loanId, is_deleted: false },
          data: { is_deleted: true, deleted_at: new Date(), deleted_by: userEmail },
        });

        // Create new schedule
        await tx.emiSchedule.createMany({
          data: calculation.schedule.map((inst) => ({
            loanId,
            installmentNumber: inst.installmentNumber,
            dueDate: inst.dueDate,
            principalAmount: inst.principalAmount,
            interestAmount: inst.interestAmount,
            totalAmount: inst.totalAmount,
            status: 'UNPAID',
            created_by: userEmail,
          })),
        });

        // Update loan record
        const u = await tx.loan.update({
          where: { id: loanId },
          data: {
            loanTypeId: loanTypeId || loan.loanTypeId,
            amount: newAmount,
            interestTypeId: newInterestTypeId,
            interestRate: newRate,
            tenureMonths: newTenure,
            startDate: newStartDate,
            outstandingPrincipal: newAmount,
            outstandingInterest: calculation.totalInterest,
            updated_by: userEmail,
          },
        });

        await tx.loanTimeline.create({
          data: {
            loanId,
            action: 'MODIFIED',
            description: `Loan modified by ${userEmail}. New amount: ₹${newAmount}, Rate: ${newRate}%, Tenure: ${newTenure}mo. Schedule regenerated.`,
            createdBy: userEmail,
          },
        });

        return u;
      });

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'UPDATE',
        module: 'LOAN',
        oldValue: { loanId, amount: loan.amount, interestRate: loan.interestRate, tenureMonths: loan.tenureMonths },
        newValue: { loanId, amount: newAmount, interestRate: newRate, tenureMonths: newTenure },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({
        message: 'Loan updated successfully.',
        loan: updated,
        emi: calculation.emi,
        totalInterest: calculation.totalInterest,
        totalPayable: calculation.totalPayable,
      });
    } catch (error) {
      console.error('Update Loan Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async softDelete(req: Request, res: Response) {
    try {
      const loanId = parseInt(req.params.id);
      if (isNaN(loanId)) return res.status(400).json({ message: 'Invalid Loan ID.' });

      const loan = await prisma.loan.findFirst({
        where: { id: loanId, is_deleted: false },
        include: { status: true },
      });

      if (!loan) return res.status(404).json({ message: 'Loan not found.' });

      const userEmail = req.user?.email || 'SYSTEM';
      const now = new Date();

      await prisma.$transaction(async (tx) => {
        await tx.loan.update({
          where: { id: loanId },
          data: {
            is_deleted: true,
            deleted_at: now,
            deleted_by: userEmail,
            updated_by: userEmail,
          },
        });

        await tx.loanTimeline.create({
          data: {
            loanId,
            action: 'DELETED',
            description: `Loan soft-deleted by ${userEmail}. Loan hidden from standard views. Admin can restore.`,
            createdBy: userEmail,
          },
        });
      });

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'DELETE',
        module: 'LOAN',
        oldValue: { loanId, status: loan.status.code },
        newValue: { loanId, is_deleted: true, deleted_by: userEmail },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({ message: 'Loan soft-deleted successfully.' });
    } catch (error) {
      console.error('Soft Delete Loan Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async restore(req: Request, res: Response) {
    try {
      const loanId = parseInt(req.params.id);
      if (isNaN(loanId)) return res.status(400).json({ message: 'Invalid Loan ID.' });

      const loan = await prisma.loan.findFirst({
        where: { id: loanId, is_deleted: true },
      });

      if (!loan) return res.status(404).json({ message: 'Deleted loan not found.' });

      const userEmail = req.user?.email || 'SYSTEM';

      await prisma.$transaction(async (tx) => {
        await tx.loan.update({
          where: { id: loanId },
          data: {
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            updated_by: userEmail,
          },
        });

        await tx.loanTimeline.create({
          data: {
            loanId,
            action: 'RESTORED',
            description: `Loan restored from deleted state by ${userEmail}. Loan is now visible in standard views.`,
            createdBy: userEmail,
          },
        });
      });

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'UPDATE',
        module: 'LOAN',
        oldValue: { loanId, is_deleted: true },
        newValue: { loanId, is_deleted: false, restored_by: userEmail },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({ message: 'Loan restored successfully.' });
    } catch (error) {
      console.error('Restore Loan Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async listDeleted(req: Request, res: Response) {
    try {
      const deletedLoans = await prisma.loan.findMany({
        where: { is_deleted: true },
        include: {
          customer: { select: { name: true, mobile: true } },
          status: true,
          loanType: true,
        },
        orderBy: { deleted_at: 'desc' },
      });
      return res.json(deletedLoans);
    } catch (error) {
      console.error('List Deleted Loans Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async approve(req: Request, res: Response) {
    try {
      const loanId = parseInt(req.params.id);
      if (isNaN(loanId)) return res.status(400).json({ message: 'Invalid Loan ID.' });

      const loan = await prisma.loan.findFirst({
        where: { id: loanId, is_deleted: false },
        include: { status: true },
      });

      if (!loan) return res.status(404).json({ message: 'Loan not found.' });

      if (loan.status.code !== 'PENDING') {
        return res.status(400).json({ message: `Loan cannot be approved from current state: "${loan.status.name}".` });
      }

      const approvedStatus = await prisma.loanStatusMaster.findFirst({
        where: { code: 'APPROVED', is_deleted: false },
      });

      if (!approvedStatus) return res.status(500).json({ message: 'Status config error.' });

      const userEmail = req.user?.email || 'SYSTEM';

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.loan.update({
          where: { id: loanId },
          data: {
            statusId: approvedStatus.id,
            updated_by: userEmail,
          },
        });

        await tx.loanTimeline.create({
          data: {
            loanId,
            action: 'APPROVED',
            description: `Loan approved and activated by ${userEmail}. Repayments are now active.`,
            createdBy: userEmail,
          },
        });

        return u;
      });

      // Recalculate customer risk
      await RiskService.calculate(loan.customerId);

      // Audit Log
      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'UPDATE',
        module: 'LOAN',
        oldValue: { loanId, status: 'PENDING' },
        newValue: { loanId, status: 'APPROVED' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({ message: 'Loan approved successfully.', loan: updated });
    } catch (error) {
      console.error('Approve Loan Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async reject(req: Request, res: Response) {
    try {
      const loanId = parseInt(req.params.id);
      if (isNaN(loanId)) return res.status(400).json({ message: 'Invalid Loan ID.' });

      const loan = await prisma.loan.findFirst({
        where: { id: loanId, is_deleted: false },
        include: { status: true },
      });

      if (!loan) return res.status(404).json({ message: 'Loan not found.' });

      if (loan.status.code !== 'PENDING') {
        return res.status(400).json({ message: 'Only pending loans can be rejected.' });
      }

      const rejectedStatus = await prisma.loanStatusMaster.findFirst({
        where: { code: 'REJECTED', is_deleted: false },
      });

      if (!rejectedStatus) return res.status(500).json({ message: 'Status config error.' });

      const userEmail = req.user?.email || 'SYSTEM';

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.loan.update({
          where: { id: loanId },
          data: {
            statusId: rejectedStatus.id,
            updated_by: userEmail,
          },
        });

        await tx.loanTimeline.create({
          data: {
            loanId,
            action: 'REJECTED',
            description: `Loan request was rejected by ${userEmail}.`,
            createdBy: userEmail,
          },
        });

        return u;
      });

      // Recalculate customer risk
      await RiskService.calculate(loan.customerId);

      // Audit Log
      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'UPDATE',
        module: 'LOAN',
        oldValue: { loanId, status: 'PENDING' },
        newValue: { loanId, status: 'REJECTED' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({ message: 'Loan request rejected.', loan: updated });
    } catch (error) {
      console.error('Reject Loan Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async getSchedule(req: Request, res: Response) {
    try {
      const loanId = parseInt(req.params.id);
      if (isNaN(loanId)) return res.status(400).json({ message: 'Invalid Loan ID.' });

      const schedule = await prisma.emiSchedule.findMany({
        where: { loanId, is_deleted: false },
        orderBy: { installmentNumber: 'asc' },
      });

      return res.json(schedule);
    } catch (error) {
      console.error('Get Schedule Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async getTimeline(req: Request, res: Response) {
    try {
      const loanId = parseInt(req.params.id);
      if (isNaN(loanId)) return res.status(400).json({ message: 'Invalid Loan ID.' });

      const timeline = await prisma.loanTimeline.findMany({
        where: { loanId },
        orderBy: { createdAt: 'desc' },
      });

      return res.json(timeline);
    } catch (error) {
      console.error('Get Timeline Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }
}
