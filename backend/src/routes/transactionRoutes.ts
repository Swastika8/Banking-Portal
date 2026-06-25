import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import PDFDocument from 'pdfkit';
import { formatCurrency } from '../utils/currency';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

const getLoanLedgerRows = async (loanId: number) => {
    const transactions = await prisma.loanTransaction.findMany({
        where: {
            loanId,
            is_deleted: false,
        },
        include: {
            transactionType: true,
        },
        orderBy: { transactionDate: 'desc' },
    });

    if (transactions.length > 0) return transactions;

    const payments = await prisma.payment.findMany({
        where: {
            loanId,
            is_deleted: false,
        },
        include: {
            paymentType: true,
        },
        orderBy: { paymentDate: 'desc' },
    });

    const emiPaymentType =
        await prisma.transactionTypeMaster.findFirst({ where: { code: 'EMI_PAYMENT', is_deleted: false } }) ||
        await prisma.transactionTypeMaster.findFirst({ where: { category: 'DEBIT', is_deleted: false } });

    return payments.map((payment) => ({
        id: -payment.id,
        loanId: payment.loanId,
        transactionTypeId: emiPaymentType?.id || 0,
        transactionDate: payment.paymentDate,
        amount: payment.amount,
        principalImpact: payment.principalPortion,
        interestImpact: payment.interestPortion,
        penaltyImpact: payment.penaltyPortion,
        feeImpact: 0,
        runningPrincipal: payment.remainingBalance,
        runningInterest: 0,
        runningTotal: payment.remainingBalance,
        referenceId: payment.id,
        referenceType: 'PAYMENT',
        description: payment.notes || `${payment.paymentType.name} payment received`,
        createdBy: payment.created_by,
        created_at: payment.created_at,
        updated_at: payment.updated_at,
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        transactionType: emiPaymentType || {
            id: 0,
            name: payment.paymentType.name,
            code: 'EMI_PAYMENT',
            category: 'DEBIT',
            description: 'Payment-derived ledger entry',
            is_deleted: false,
            created_at: payment.created_at,
            created_by: 'SYSTEM',
            updated_at: payment.updated_at,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
        },
    }));
};

const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

// Get all transaction types
router.get('/types', async (req, res) => {
    try {
        const types = await prisma.transactionTypeMaster.findMany({
            where: { is_deleted: false },
            orderBy: { name: 'asc' }
        });
        res.json(types);
    } catch (error) {
        console.error('Error fetching transaction types:', error);
        res.status(500).json({ error: 'Failed to fetch transaction types' });
    }
});

// Get loan transactions
router.get('/loans/:loanId', async (req, res) => {
    try {
        const { loanId } = req.params;
        const { type, category, startDate, endDate } = req.query;

        const where: any = {
            loanId: parseInt(loanId),
            is_deleted: false,
        };

        if (type && type !== 'ALL') {
            where.transactionType = { code: type as string };
        }

        if (category && category !== 'ALL') {
            where.transactionType = { category: category as string };
        }

        if (startDate) {
            where.transactionDate = { gte: new Date(startDate as string) };
        }

        if (endDate) {
            where.transactionDate = { ...where.transactionDate, lte: new Date(endDate as string) };
        }

        let transactions = await getLoanLedgerRows(parseInt(loanId));

        if (type && type !== 'ALL') {
            transactions = transactions.filter((transaction) => transaction.transactionType.code === type);
        }

        if (category && category !== 'ALL') {
            transactions = transactions.filter((transaction) => transaction.transactionType.category === category);
        }

        if (startDate) {
            const from = new Date(startDate as string);
            transactions = transactions.filter((transaction) => new Date(transaction.transactionDate) >= from);
        }

        if (endDate) {
            const to = new Date(endDate as string);
            transactions = transactions.filter((transaction) => new Date(transaction.transactionDate) <= to);
        }

        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// Get transaction summary
router.get('/loans/:loanId/summary', async (req, res) => {
    try {
        const { loanId } = req.params;

        const transactions = await getLoanLedgerRows(parseInt(loanId));

        const summary = {
            totalDebits: transactions
                .filter(t => t.transactionType.category === 'DEBIT')
                .reduce((sum, t) => sum + t.amount, 0),
            totalCredits: transactions
                .filter(t => t.transactionType.category === 'CREDIT')
                .reduce((sum, t) => sum + t.amount, 0),
            netChange: transactions.reduce((sum, t) => sum + t.amount, 0),
            totalPrincipalPaid: transactions
                .reduce((sum, t) => sum + Math.abs(t.principalImpact), 0),
            totalInterestPaid: transactions
                .reduce((sum, t) => sum + Math.abs(t.interestImpact), 0),
            totalPenalties: transactions
                .reduce((sum, t) => sum + Math.abs(t.penaltyImpact), 0),
            totalFees: transactions
                .reduce((sum, t) => sum + Math.abs(t.feeImpact), 0),
        };

        res.json(summary);
    } catch (error) {
        console.error('Error fetching transaction summary:', error);
        res.status(500).json({ error: 'Failed to fetch transaction summary' });
    }
});

// Reverse a transaction
router.post('/:id/reverse', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        // Get original transaction
        const original = await prisma.loanTransaction.findUnique({
            where: { id: parseInt(id) },
            include: { transactionType: true },
        });

        if (!original) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        if (original.transactionType.code === 'REVERSAL') {
            return res.status(400).json({ error: 'Cannot reverse a reversal transaction' });
        }

        // Find reversal type
        const reversalType = await prisma.transactionTypeMaster.findUnique({
            where: { code: 'REVERSAL' }
        });

        if (!reversalType) {
            return res.status(500).json({ error: 'Reversal transaction type not found' });
        }

        // Get user from request (using auth middleware)
        const user = (req as any).user;
        const createdBy = user?.name || user?.email || 'SYSTEM';

        // Create reversal transaction
        const reversal = await prisma.loanTransaction.create({
            data: {
                loanId: original.loanId,
                transactionTypeId: reversalType.id,
                amount: -original.amount,
                principalImpact: -original.principalImpact,
                interestImpact: -original.interestImpact,
                penaltyImpact: -original.penaltyImpact,
                feeImpact: -original.feeImpact,
                runningPrincipal: original.runningPrincipal - original.principalImpact,
                runningInterest: original.runningInterest - original.interestImpact,
                runningTotal: original.runningTotal - original.amount,
                referenceId: original.id,
                referenceType: 'TRANSACTION',
                description: `Reversal of transaction #${original.id}: ${reason || 'Manual reversal'}`,
                createdBy: createdBy,
                transactionDate: new Date(),
            },
            include: {
                transactionType: true,
            },
        });

        // Update loan balances
        await prisma.loan.update({
            where: { id: original.loanId },
            data: {
                outstandingPrincipal: {
                    increment: -original.principalImpact
                },
                outstandingInterest: {
                    increment: -original.interestImpact
                }
            }
        });

        res.json(reversal);
    } catch (error) {
        console.error('Error reversing transaction:', error);
        res.status(500).json({ error: 'Failed to reverse transaction' });
    }
});

// Export transactions
router.get('/loans/:loanId/export', async (req, res) => {
    try {
        const { loanId } = req.params;
        const { format } = req.query;

        const transactions = await getLoanLedgerRows(parseInt(loanId));
        const loan = await prisma.loan.findFirst({
            where: { id: parseInt(loanId), is_deleted: false },
            include: { customer: true, loanType: true },
        });

        const headers = ['Date', 'Type', 'Category', 'Description', 'Amount', 'Principal', 'Interest', 'Penalty', 'Balance'];
        const rows = transactions.map((transaction) => [
            new Date(transaction.transactionDate).toLocaleString('en-IN'),
            transaction.transactionType.name,
            transaction.transactionType.category,
            transaction.description || '',
            transaction.amount.toFixed(2),
            transaction.principalImpact.toFixed(2),
            transaction.interestImpact.toFixed(2),
            transaction.penaltyImpact.toFixed(2),
            transaction.runningTotal.toFixed(2),
        ]);

        if (format === 'CSV' || format === 'EXCEL') {
            const csvContent = [headers.map(escapeCsv).join(','), ...rows.map((row) => row.map(escapeCsv).join(','))].join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=loan_${loanId}_transactions.csv`);
            return res.send(csvContent);
        }

        const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(buffers);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=loan_${loanId}_transactions.pdf`);
            return res.send(pdfBuffer);
        });

        doc.rect(0, 0, doc.page.width, 78).fill('#0B1B3D');
        doc.rect(0, 78, doc.page.width, 4).fill('#C5A880');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text('LOAN TRANSACTION LEDGER', 36, 24);
        doc.fillColor('#A3B8CC').font('Helvetica').fontSize(9)
            .text(`Generated: ${new Date().toLocaleString('en-IN')}`, 36, 49);
        doc.fillColor('#C5A880').fontSize(10)
            .text(`${loan?.customer.name || 'Customer'} | Loan #${loanId} | ${loan?.loanType.name || 'Loan'}`, 430, 28, {
                width: doc.page.width - 466,
                align: 'right',
            });

        let currentY = 105;
        const columnWidths = [76, 112, 70, 185, 84, 84, 84, 72, 84];
        const startX = 36;

        const drawHeader = () => {
            let x = startX;
            doc.rect(startX, currentY - 7, doc.page.width - 72, 24).fill('#F4F6F8');
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#0B1B3D');
            headers.forEach((header, index) => {
                doc.text(header, x + 4, currentY, { width: columnWidths[index] - 8, align: index >= 4 ? 'right' : 'left' });
                x += columnWidths[index];
            });
            currentY += 24;
        };

        drawHeader();
        doc.font('Helvetica').fontSize(8).fillColor('#333333');

        rows.forEach((row, rowIndex) => {
            if (currentY > doc.page.height - 45) {
                doc.addPage({ size: 'A4', layout: 'landscape' });
                currentY = 42;
                drawHeader();
                doc.font('Helvetica').fontSize(8).fillColor('#333333');
            }

            if (rowIndex % 2 === 0) {
                doc.rect(startX, currentY - 6, doc.page.width - 72, 22).fill('#FBFCFD');
                doc.fillColor('#333333');
            }

            let x = startX;
            row.forEach((value, index) => {
                const displayValue = index >= 4 ? formatCurrency(Number(value)) : String(value);
                doc.text(displayValue, x + 4, currentY, {
                    width: columnWidths[index] - 8,
                    height: 12,
                    ellipsis: true,
                    align: index >= 4 ? 'right' : 'left',
                });
                x += columnWidths[index];
            });
            currentY += 22;
        });

        if (rows.length === 0) {
            doc.font('Helvetica').fontSize(10).fillColor('#777777').text('No transaction records found for this loan.', startX, currentY + 12);
        }

        doc.end();
    } catch (error) {
        console.error('Error exporting transactions:', error);
        res.status(500).json({ error: 'Failed to export transactions' });
    }
});

export default router;
