import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PaymentEngineService } from '../services/paymentEngine';
import { PdfGenerator } from '../utils/pdfGenerator';
import { AuditService } from '../services/auditService';
import { RiskService } from '../services/riskService';

const prisma = new PrismaClient();

export class PaymentController {
  public static async process(req: Request, res: Response) {
    try {
      const { loanId, paymentTypeCode, amount, referenceNumber, notes, principalReductionOption } = req.body;

      if (!loanId || !paymentTypeCode || amount === undefined) {
        return res.status(400).json({ message: 'Missing required payment parameters.' });
      }

      if (amount <= 0) {
        return res.status(400).json({ message: 'Payment amount must be greater than zero.' });
      }

      const userEmail = req.user?.email || 'SYSTEM';

      const payment = await PaymentEngineService.processPayment({
        loanId,
        paymentTypeCode,
        amount: parseFloat(amount),
        referenceNumber,
        notes,
        principalReductionOption,
        createdBy: userEmail,
      });

      // Recalculate customer risk after payment
      const loan = await prisma.loan.findFirst({
        where: { id: loanId, is_deleted: false },
        select: { customerId: true },
      });

      if (loan) {
        await RiskService.calculate(loan.customerId);
      }

      // Audit Log
      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'CREATE',
        module: 'PAYMENT',
        newValue: { paymentId: payment.id, loanId, amount, paymentTypeCode },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.status(201).json({
        message: 'Payment processed successfully.',
        payment,
      });
    } catch (error: any) {
      console.error('Process Payment Error:', error);
      return res.status(400).json({ message: error.message || 'Error processing payment.' });
    }
  }

  public static async getBalances(req: Request, res: Response) {
    try {
      const loanId = parseInt(req.params.loanId);
      if (isNaN(loanId)) return res.status(400).json({ message: 'Invalid Loan ID.' });

      const balances = await PaymentEngineService.deriveBalances(loanId);
      return res.json(balances);
    } catch (error: any) {
      console.error('Get Balances Error:', error);
      return res.status(400).json({ message: error.message || 'Error fetching balances.' });
    }
  }

  public static async getLedger(req: Request, res: Response) {
    try {
      const loanId = parseInt(req.params.loanId);
      if (isNaN(loanId)) return res.status(400).json({ message: 'Invalid Loan ID.' });

      const ledger = await prisma.payment.findMany({
        where: { loanId, is_deleted: false, loan: { is_deleted: false } },
        include: { paymentType: true },
        orderBy: { paymentDate: 'desc' },
      });

      return res.json(ledger);
    } catch (error) {
      console.error('Get Ledger Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async downloadReceipt(req: Request, res: Response) {
    try {
      const paymentId = parseInt(req.params.paymentId);
      if (isNaN(paymentId)) return res.status(400).json({ message: 'Invalid Payment ID.' });

      const payment = await prisma.payment.findFirst({
        where: { id: paymentId, is_deleted: false, loan: { is_deleted: false } },
        include: {
          paymentType: true,
          loan: {
            include: {
              customer: true,
              loanType: true,
            },
          },
        },
      });

      if (!payment) {
        return res.status(404).json({ message: 'Payment record not found.' });
      }

      // Generate Receipt PDF Buffer
      const pdfBuffer = await PdfGenerator.generatePaymentReceipt({
        receiptNumber: `REC-${payment.id.toString().padStart(6, '0')}`,
        customerName: payment.loan.customer.name,
        customerMobile: payment.loan.customer.mobile,
        loanId: payment.loanId,
        loanTypeName: payment.loan.loanType.name,
        paymentTypeName: payment.paymentType.name,
        amount: payment.amount,
        principalPortion: payment.principalPortion,
        interestPortion: payment.interestPortion,
        penaltyPortion: payment.penaltyPortion,
        remainingBalance: payment.remainingBalance,
        paymentDate: payment.paymentDate,
        referenceNumber: payment.referenceNumber || undefined,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=receipt_${paymentId}.pdf`);
      return res.send(pdfBuffer);
    } catch (error) {
      console.error('Download Receipt Error:', error);
      return res.status(500).json({ message: 'Error generating PDF receipt.' });
    }
  }
}
