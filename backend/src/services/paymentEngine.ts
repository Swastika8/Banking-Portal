import { PrismaClient } from '@prisma/client';
import { LoanEngineService } from './loanEngine';
import { RiskService } from './riskService';

const prisma = new PrismaClient();

export interface ProcessPaymentParams {
  loanId: number;
  paymentTypeCode: 'EMI' | 'INTEREST_ONLY' | 'PRINCIPAL_ONLY' | 'FORECLOSURE' | 'PENALTY';
  amount: number;
  referenceNumber?: string;
  notes?: string;
  principalReductionOption?: 'REDUCE_EMI' | 'REDUCE_TENURE'; // Required for PRINCIPAL_ONLY
  createdBy: string;
}

export class PaymentEngineService {
  /**
   * Derives current balances for a loan from its transaction/payment history.
   */
  public static async deriveBalances(loanId: number, asOfDate: Date = new Date()) {
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, is_deleted: false },
      include: {
        payments: {
          where: { is_deleted: false },
        },
        emiSchedule: {
          where: { is_deleted: false },
          orderBy: { installmentNumber: 'asc' },
        },
        interestType: true,
      },
    });

    if (!loan) {
      throw new Error(`Loan with ID ${loanId} not found.`);
    }

    const totalPrincipalPaid = loan.payments.reduce((sum, p) => sum + p.principalPortion, 0);
    const totalInterestPaid = loan.payments.reduce((sum, p) => sum + p.interestPortion, 0);
    const totalPenaltyPaid = loan.payments.reduce((sum, p) => sum + p.penaltyPortion, 0);

    const outstandingPrincipal = Math.max(0, Math.round((loan.amount - totalPrincipalPaid) * 100) / 100);

    const accruedInterestToDate = loan.emiSchedule
      .filter((inst) => new Date(inst.dueDate) <= asOfDate)
      .reduce((sum, inst) => sum + inst.interestAmount, 0);

    const outstandingInterest = Math.max(0, Math.round((accruedInterestToDate - totalInterestPaid) * 100) / 100);

    return {
      loanId,
      amount: loan.amount,
      interestRate: loan.interestRate,
      interestTypeCode: loan.interestType.code as 'SIMPLE' | 'COMPOUND',
      totalPrincipalPaid: Math.round(totalPrincipalPaid * 100) / 100,
      totalInterestPaid: Math.round(totalInterestPaid * 100) / 100,
      totalPenaltyPaid: Math.round(totalPenaltyPaid * 100) / 100,
      outstandingPrincipal,
      outstandingInterest,
      accruedInterestToDate: Math.round(accruedInterestToDate * 100) / 100,
    };
  }

  /**
   * Processes a payment transaction.
   * Steps:
   *  1. Allocate the payment to interest/principal/penalty.
   *  2. Update EMI schedule installment statuses.
   *  3. Create a Payment (ledger) record.
   *  4. Create a LoanTransaction record (for the Transactions tab).
   *  5. Update loan outstanding caches.
   *  6. Handle rescheduling for PRINCIPAL_ONLY payments.
   *  7. Write to Loan Timeline.
   */
  public static async processPayment(params: ProcessPaymentParams) {
    const { loanId, paymentTypeCode, amount, referenceNumber, notes, principalReductionOption, createdBy } = params;

    const paymentResult = await prisma.$transaction(async (tx) => {
      // ── 1. Fetch Loan ───────────────────────────────────────────────────────
      const loan = await tx.loan.findFirst({
        where: { id: loanId, is_deleted: false },
        include: {
          status: true,
          interestType: true,
          emiSchedule: {
            where: { is_deleted: false },
            orderBy: { installmentNumber: 'asc' },
          },
          payments: { where: { is_deleted: false } },
        },
      });

      if (!loan) throw new Error(`Loan with ID ${loanId} not found.`);
      if (loan.status.code === 'CLOSED') throw new Error('Cannot process payment on a closed loan.');

      const paymentType = await tx.paymentTypeMaster.findFirst({
        where: { code: paymentTypeCode, is_deleted: false },
      });
      if (!paymentType) throw new Error(`Payment type with code ${paymentTypeCode} not found.`);

      // Fetch the correct TransactionTypeMaster code for this payment type
      const txTypeCode = PaymentEngineService.mapPaymentCodeToTxCode(paymentTypeCode);
      const transactionTypeMaster = await tx.transactionTypeMaster.findFirst({
        where: { code: txTypeCode, is_deleted: false },
      });
      if (!transactionTypeMaster) {
        throw new Error(`TransactionTypeMaster with code "${txTypeCode}" not found in database. Please run the seed.`);
      }

      // ── 2. Current balances ─────────────────────────────────────────────────
      const totalPrincipalPaid = loan.payments.reduce((s, p) => s + p.principalPortion, 0);
      const currentOutstandingPrincipal = Math.max(
        0,
        Math.round((loan.amount - totalPrincipalPaid) * 100) / 100,
      );
      const totalInterestPaid = loan.payments.reduce((s, p) => s + p.interestPortion, 0);

      const now = new Date();

      let principalPortion = 0;
      let interestPortion = 0;
      let penaltyPortion = 0;

      // ── 3. Payment type allocation ──────────────────────────────────────────
      if (paymentTypeCode === 'PENALTY') {
        penaltyPortion = amount;

      } else if (paymentTypeCode === 'PRINCIPAL_ONLY') {
        principalPortion = Math.min(amount, currentOutstandingPrincipal);
        if (principalPortion <= 0) throw new Error('Outstanding principal is already zero.');
        if (!principalReductionOption) {
          throw new Error('Principal reduction option (REDUCE_EMI or REDUCE_TENURE) is required for principal only payments.');
        }

        // Mark all past-due UNPAID/PARTIAL installments whose totalAmount is covered by this principal payment
        // For PRINCIPAL_ONLY we mark past installments up to now as PAID proportionally.
        let remainingForSchedule = principalPortion;
        for (const inst of loan.emiSchedule) {
          if (remainingForSchedule <= 0) break;
          // if (new Date(inst.dueDate) > now) break; // only past / due installments
          const instDate = new Date(inst.dueDate);
          instDate.setHours(0, 0, 0, 0);
          const today = new Date(now);
          today.setHours(0, 0, 0, 0);
          if (instDate > today) break;

          const unpaid = Math.max(0, inst.totalAmount - inst.paidAmount);
          if (unpaid <= 0) continue;
          const alloc = Math.min(remainingForSchedule, unpaid);
          const newPaid = Math.round((inst.paidAmount + alloc) * 100) / 100;
          await tx.emiSchedule.update({
            where: { id: inst.id },
            data: {
              paidAmount: newPaid,
              status: newPaid >= inst.totalAmount ? 'PAID' : 'PARTIAL',
              updated_by: createdBy,
            },
          });
          remainingForSchedule -= alloc;
        }

      } else if (paymentTypeCode === 'INTEREST_ONLY') {
        const accruedInterest = loan.emiSchedule
          .filter((inst) => new Date(inst.dueDate) <= now)
          .reduce((s, inst) => s + inst.interestAmount, 0);
        const outstandingInterest = Math.max(0, accruedInterest - totalInterestPaid);
        interestPortion = Math.min(amount, outstandingInterest);

        // Update installment statuses for interest-only
        let remaining = interestPortion;
        for (const inst of loan.emiSchedule) {
          if (remaining <= 0) break;
          const unpaidInterest = Math.max(0, inst.interestAmount - Math.min(inst.paidAmount, inst.interestAmount));
          if (unpaidInterest <= 0) continue;
          const alloc = Math.min(remaining, unpaidInterest);
          const newPaid = Math.round((inst.paidAmount + alloc) * 100) / 100;
          await tx.emiSchedule.update({
            where: { id: inst.id },
            data: {
              paidAmount: newPaid,
              status: newPaid >= inst.totalAmount ? 'PAID' : 'PARTIAL',
              updated_by: createdBy,
            },
          });
          remaining -= alloc;
        }

      } else if (paymentTypeCode === 'FORECLOSURE') {
        const accruedInterest = loan.emiSchedule
          .filter((inst) => new Date(inst.dueDate) <= now)
          .reduce((s, inst) => s + inst.interestAmount, 0);
        const outstandingInterest = Math.max(0, accruedInterest - totalInterestPaid);
        principalPortion = currentOutstandingPrincipal;
        interestPortion = outstandingInterest;
        const totalRequired = Math.round((principalPortion + interestPortion) * 100) / 100;
        if (amount < totalRequired) {
          throw new Error(
            `Foreclosure requires a minimum payment of ${totalRequired} to clear outstanding principal (${principalPortion}) and interest (${interestPortion}).`,
          );
        }
        // Mark all remaining installments as PAID
        for (const inst of loan.emiSchedule) {
          if (inst.status === 'PAID') continue;
          await tx.emiSchedule.update({
            where: { id: inst.id },
            data: { paidAmount: inst.totalAmount, status: 'PAID', updated_by: createdBy },
          });
        }

      } else {
        // ── STANDARD EMI: allocate interest-first then principal ──────────────
        let remainingPayment = amount;

        for (const inst of loan.emiSchedule) {
          if (remainingPayment <= 0) break;

          const unpaidTotal = Math.max(0, inst.totalAmount - inst.paidAmount);
          if (unpaidTotal <= 0) continue;

          // How much of the installment's interest is still unpaid?
          const alreadyPaidForInterest = Math.min(inst.paidAmount, inst.interestAmount);
          const unpaidInterest = Math.max(0, inst.interestAmount - alreadyPaidForInterest);
          // How much of the installment's principal is still unpaid?
          const alreadyPaidForPrincipal = Math.max(0, inst.paidAmount - alreadyPaidForInterest);
          const unpaidPrincipal = Math.max(0, inst.principalAmount - alreadyPaidForPrincipal);

          let allocatedThisInst = 0;

          if (unpaidInterest > 0 && remainingPayment > 0) {
            const interestAlloc = Math.min(remainingPayment, unpaidInterest);
            interestPortion += interestAlloc;
            remainingPayment -= interestAlloc;
            allocatedThisInst += interestAlloc;
          }

          if (unpaidPrincipal > 0 && remainingPayment > 0) {
            const principalAlloc = Math.min(remainingPayment, unpaidPrincipal);
            principalPortion += principalAlloc;
            remainingPayment -= principalAlloc;
            allocatedThisInst += principalAlloc;
          }

          if (allocatedThisInst > 0) {
            const newPaid = Math.round((inst.paidAmount + allocatedThisInst) * 100) / 100;
            await tx.emiSchedule.update({
              where: { id: inst.id },
              data: {
                paidAmount: newPaid,
                status: newPaid >= inst.totalAmount ? 'PAID' : 'PARTIAL',
                updated_by: createdBy,
              },
            });
          }
        }

        // Surplus goes to principal
        if (remainingPayment > 0) {
          principalPortion += remainingPayment;
        }
      }

      const finalRemainingPrincipal = Math.max(
        0,
        Math.round((currentOutstandingPrincipal - principalPortion) * 100) / 100,
      );
      const finalRemainingInterest = Math.max(
        0,
        Math.round((loan.outstandingInterest - interestPortion) * 100) / 100,
      );

      // ── 4. Create Payment (Ledger) record ───────────────────────────────────
      const payment = await tx.payment.create({
        data: {
          loanId,
          paymentTypeId: paymentType.id,
          amount,
          principalPortion,
          interestPortion,
          penaltyPortion,
          remainingBalance: finalRemainingPrincipal,
          referenceNumber,
          notes,
          created_by: createdBy,
        },
      });

      // ── 5. Create LoanTransaction record (for Transactions tab) ─────────────
      // Amounts are negative = money flowing out of the outstanding balance (debit to loan)
      await tx.loanTransaction.create({
        data: {
          loanId,
          transactionTypeId: transactionTypeMaster.id,
          amount: -amount,                        // negative = debit (outflow from outstanding)
          principalImpact: -principalPortion,
          interestImpact: -interestPortion,
          penaltyImpact: -penaltyPortion,
          feeImpact: 0,
          runningPrincipal: finalRemainingPrincipal,
          runningInterest: finalRemainingInterest,
          runningTotal: finalRemainingPrincipal + finalRemainingInterest,
          referenceId: payment.id,
          referenceType: 'PAYMENT',
          description: notes
            || `${paymentType.name} — Principal: ₹${principalPortion.toFixed(2)}, Interest: ₹${interestPortion.toFixed(2)}${penaltyPortion > 0 ? `, Penalty: ₹${penaltyPortion.toFixed(2)}` : ''}`,
          createdBy,
        },
      });

      // ── 6. Loan Timeline ────────────────────────────────────────────────────
      await tx.loanTimeline.create({
        data: {
          loanId,
          action: 'PAYMENT_MADE',
          description: `Payment of ₹${amount} processed. Allocated → Principal: ₹${principalPortion}, Interest: ₹${interestPortion}, Penalty: ₹${penaltyPortion}. Outstanding Principal: ₹${finalRemainingPrincipal}.`,
          createdBy,
        },
      });

      // ── 7. Rescheduling for PRINCIPAL_ONLY ──────────────────────────────────
      if (paymentTypeCode === 'PRINCIPAL_ONLY' && principalPortion > 0) {
        const futureInstallments = loan.emiSchedule.filter((inst) => new Date(inst.dueDate) > now && inst.status !== 'PAID' && inst.status !== 'PARTIAL');

        if (futureInstallments.length > 0) {
          await tx.emiSchedule.updateMany({
            where: { id: { in: futureInstallments.map((fi) => fi.id) } },
            data: { is_deleted: true, deleted_at: now, deleted_by: createdBy },
          });
        }

        const remainingMonths = futureInstallments.length;
        if (remainingMonths > 0) {
          const originalEmi = loan.emiSchedule[0]?.totalAmount || (loan.amount / loan.tenureMonths);
          const { emi: newEmi, schedule: newSchedule } = LoanEngineService.recalculateRemainingSchedule(
            finalRemainingPrincipal,
            loan.interestRate,
            remainingMonths,
            loan.interestType.code as 'SIMPLE' | 'COMPOUND',
            originalEmi,
            principalReductionOption!,
            now,
          );

          await tx.emiSchedule.createMany({
            data: newSchedule.map((inst) => ({
              loanId,
              installmentNumber: inst.installmentNumber,
              dueDate: inst.dueDate,
              principalAmount: inst.principalAmount,
              interestAmount: inst.interestAmount,
              totalAmount: inst.totalAmount,
              status: 'UNPAID',
              created_by: createdBy,
            })),
          });

          await tx.loanTimeline.create({
            data: {
              loanId,
              action: 'PRINCIPAL_REDUCTION',
              description: `Principal reduced by ₹${principalPortion}. Rescheduled remaining schedule using ${principalReductionOption}. New count: ${newSchedule.length}, New EMI: ₹${newEmi}.`,
              createdBy,
            },
          });
        }
      }

      // ── 8. Update loan outstanding caches ───────────────────────────────────
      // Re-fetch the updated schedule rows to check if all are now paid
      const updatedSchedule = await tx.emiSchedule.findMany({
        where: { loanId, is_deleted: false },
      });
      const allInstallmentsPaid = updatedSchedule.length > 0 &&
        updatedSchedule.every((inst) => inst.paidAmount >= inst.totalAmount);

      // Loan closes if: foreclosure payment, OR all installments fully paid AND principal cleared
      const isForeclosure = paymentTypeCode === 'FORECLOSURE';
      const isFullyPaidViaEmi = finalRemainingPrincipal <= 0 && allInstallmentsPaid;
      const isClosed = isForeclosure || isFullyPaidViaEmi;

      const statusClosed = isClosed
        ? await tx.loanStatusMaster.findFirst({ where: { code: 'CLOSED' } })
        : null;

      await tx.loan.update({
        where: { id: loanId },
        data: {
          outstandingPrincipal: finalRemainingPrincipal,
          outstandingInterest: finalRemainingInterest,
          statusId: statusClosed ? statusClosed.id : loan.statusId,
          updated_by: createdBy,
        },
      });

      if (isClosed && isForeclosure) {
        await tx.loanTimeline.create({
          data: {
            loanId,
            action: 'LOAN_CLOSED',
            description: 'Loan foreclosure complete. All balances settled. Loan is officially closed.',
            createdBy,
          },
        });
      } else if (isClosed && isFullyPaidViaEmi) {
        await tx.loanTimeline.create({
          data: {
            loanId,
            action: 'LOAN_CLOSED',
            description: `All ${updatedSchedule.length} installments paid in full. Outstanding principal cleared. Loan automatically closed.`,
            createdBy,
          },
        });
      }

      return payment;
    });

    // Recalculate customer risk score
    const loanForRisk = await prisma.loan.findUnique({ where: { id: loanId } });
    if (loanForRisk) {
      await RiskService.calculate(loanForRisk.customerId);
    }

    return paymentResult;
  }

  /**
   * Maps a PaymentTypeMaster code to the corresponding TransactionTypeMaster code.
   */
  private static mapPaymentCodeToTxCode(paymentTypeCode: string): string {
    const map: Record<string, string> = {
      EMI: 'EMI_PAYMENT',
      INTEREST_ONLY: 'INTEREST_PAYMENT',
      PRINCIPAL_ONLY: 'PRINCIPAL_PAYMENT',
      FORECLOSURE: 'FORECLOSURE',
      PENALTY: 'PENALTY',
    };
    return map[paymentTypeCode] || 'EMI_PAYMENT';
  }
}
