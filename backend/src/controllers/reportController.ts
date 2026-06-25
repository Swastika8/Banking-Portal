import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';

const prisma = new PrismaClient();

export class ReportController {
  /**
   * Helper to build filters from query parameters.
   */
  private static buildFilters(query: any) {
    const { loanTypeId, statusId, customerId, startDateFrom, startDateTo, minOutstanding, maxOutstanding } = query;
    const filters: any = {
      is_deleted: false,
      customer: { is_deleted: false },
    };

    if (loanTypeId) {
      filters.loanTypeId = parseInt(loanTypeId);
    }
    if (statusId) {
      filters.statusId = parseInt(statusId);
    }
    if (customerId) {
      filters.customerId = parseInt(customerId);
      filters.customer = { id: parseInt(customerId), is_deleted: false };
    }
    
    // Date Range
    if (startDateFrom || startDateTo) {
      filters.startDate = {};
      if (startDateFrom) {
        filters.startDate.gte = new Date(startDateFrom);
      }
      if (startDateTo) {
        filters.startDate.lte = new Date(startDateTo);
      }
    }

    // Outstanding Amount range
    if (minOutstanding || maxOutstanding) {
      filters.outstandingPrincipal = {};
      if (minOutstanding) {
        filters.outstandingPrincipal.gte = parseFloat(minOutstanding);
      }
      if (maxOutstanding) {
        filters.outstandingPrincipal.lte = parseFloat(maxOutstanding);
      }
    }

    return filters;
  }

  /**
   * Evaluates advanced report data based on parameters.
   */
  public static async getAdvancedReport(req: Request, res: Response) {
    try {
      const { reportType } = req.query;
      const filters = ReportController.buildFilters(req.query);

      if (reportType === 'INTEREST') {
        // Interest Collection Report
        const loans = await prisma.loan.findMany({
          where: filters,
          include: {
            customer: true,
            loanType: true,
            status: true,
            emiSchedule: { where: { is_deleted: false } },
            payments: { where: { is_deleted: false } },
          },
          orderBy: { startDate: 'desc' },
        });

        const records = loans.map((l) => {
          const now = new Date();
          const expectedInterest = l.emiSchedule
            .filter((inst) => new Date(inst.dueDate) <= now)
            .reduce((sum, inst) => sum + inst.interestAmount, 0);

          const paidInterest = l.payments.reduce((sum, p) => sum + p.interestPortion, 0);
          const outstandingInterest = Math.max(0, expectedInterest - paidInterest);

          return {
            loanId: l.id,
            customerName: l.customer.name,
            customerMobile: l.customer.mobile,
            loanTypeName: l.loanType.name,
            amount: l.amount,
            expectedInterest: Math.round(expectedInterest * 100) / 100,
            paidInterest: Math.round(paidInterest * 100) / 100,
            outstandingInterest: Math.round(outstandingInterest * 100) / 100,
            status: l.status.name,
          };
        });

        const totalExpected = records.reduce((sum, r) => sum + r.expectedInterest, 0);
        const totalCollected = records.reduce((sum, r) => sum + r.paidInterest, 0);

        return res.json({
          stats: {
            totalExpectedInterest: Math.round(totalExpected * 100) / 100,
            totalCollectedInterest: Math.round(totalCollected * 100) / 100,
            outstandingInterestTotal: Math.round((totalExpected - totalCollected) * 100) / 100,
            collectionRatio: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 10000) / 100 : 100,
          },
          records,
        });

      } else if (reportType === 'STATEMENT') {
        // Customer Statement Report
        const custId = parseInt(req.query.customerId as string);
        if (isNaN(custId)) {
          return res.status(400).json({ message: 'Customer ID is required for Customer Statement reports.' });
        }

        const customer = await prisma.customer.findUnique({
          where: { id: custId, is_deleted: false },
          include: {
            loans: {
              where: { is_deleted: false },
              include: {
                loanType: true,
                status: true,
                payments: { where: { is_deleted: false }, orderBy: { paymentDate: 'desc' } },
                emiSchedule: { where: { is_deleted: false }, orderBy: { installmentNumber: 'asc' } },
              },
            },
            notes: { where: { is_deleted: false }, orderBy: { created_at: 'desc' } },
          },
        });

        if (!customer) return res.status(404).json({ message: 'Customer profile not found.' });

        return res.json({
          personalDetails: customer,
          loansCount: customer.loans.length,
          activeLoans: customer.loans.filter((l) => l.status.code === 'APPROVED'),
          notes: customer.notes,
        });

      } else if (reportType === 'COLLATERAL') {
        // Collateral Valuation Report
        const collaterals = await prisma.collateral.findMany({
          where: {
            is_deleted: false,
            loan: filters,
          },
          include: {
            loan: {
              include: {
                customer: true,
                loanType: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
        });

        // Load latest market rates to calculate live valuations
        const marketRates = await prisma.marketRate.findMany({ where: { is_deleted: false } });
        const ratesMap = new Map(marketRates.map((mr) => [mr.asset, mr.rate]));

        const records = collaterals.map((c) => {
          const liveRate = ratesMap.get(c.type.toUpperCase()) || 0;
          const liveValue = (c.weight || 0) * liveRate * (c.purityRatioAtLoanCreation || 0);

          return {
            loanId: c.loanId,
            customerName: c.loan.customer.name,
            collateralType: c.type,
            weight: c.weight,
            purity: c.purity,
            purityUnit: c.purityUnit,
            marketRateAtCreation: c.marketRateAtLoanCreation,
            currentMarketRate: liveRate,
            appraisedValueAtCreation: c.appraisedValueAtLoanCreation,
            currentLiveValue: Math.round(liveValue * 100) / 100,
            valueDifference: Math.round((liveValue - c.appraisedValueAtLoanCreation) * 100) / 100,
          };
        });

        const totalOriginalValuation = records.reduce((sum, r) => sum + r.appraisedValueAtCreation, 0);
        const totalLiveValuation = records.reduce((sum, r) => sum + r.currentLiveValue, 0);

        return res.json({
          stats: {
            totalOriginalValuation: Math.round(totalOriginalValuation * 100) / 100,
            totalLiveValuation: Math.round(totalLiveValuation * 100) / 100,
            valuationDelta: Math.round((totalLiveValuation - totalOriginalValuation) * 100) / 100,
          },
          records,
        });

      } else if (reportType === 'AUDIT') {
        // System Audit Activity Report
        const auditFilters: any = {};
        if (req.query.startDateFrom || req.query.startDateTo) {
          auditFilters.createdAt = {};
          if (req.query.startDateFrom) auditFilters.createdAt.gte = new Date(req.query.startDateFrom as string);
          if (req.query.startDateTo) auditFilters.createdAt.lte = new Date(req.query.startDateTo as string);
        }

        const logs = await prisma.auditLog.findMany({
          where: auditFilters,
          include: {
            user: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        });

        return res.json({
          stats: {
            totalActions: logs.length,
          },
          records: logs.map((l) => ({
            id: l.id,
            timestamp: l.createdAt,
            userEmail: l.user?.email || 'SYSTEM',
            userName: l.user?.name || 'SYSTEM',
            action: l.action,
            module: l.module,
            oldValue: l.oldValue,
            newValue: l.newValue,
          })),
        });

      } else {
        // Default: Loan Performance Report
        const loans = await prisma.loan.findMany({
          where: filters,
          include: {
            customer: true,
            loanType: true,
            status: true,
          },
          orderBy: { startDate: 'desc' },
        });

        const records = loans.map((l) => ({
          loanId: l.id,
          customerName: l.customer.name,
          loanTypeName: l.loanType.name,
          amount: l.amount,
          outstandingPrincipal: l.outstandingPrincipal,
          outstandingInterest: l.outstandingInterest,
          startDate: l.startDate,
          statusName: l.status.name,
        }));

        const totalDisbursed = loans.reduce((sum, l) => sum + l.amount, 0);
        const totalOutstanding = loans.reduce((sum, l) => sum + l.outstandingPrincipal + l.outstandingInterest, 0);

        return res.json({
          stats: {
            totalDisbursed: Math.round(totalDisbursed * 100) / 100,
            totalOutstanding: Math.round(totalOutstanding * 100) / 100,
            activeCount: loans.filter((l) => l.status.code === 'APPROVED').length,
            closedCount: loans.filter((l) => l.status.code === 'CLOSED').length,
            overdueCount: loans.filter((l) => l.status.code === 'OVERDUE').length,
          },
          records,
        });
      }
    } catch (error) {
      console.error('Get Advanced Report Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  /**
   * Exports advanced report as CSV or PDF.
   */
  public static async exportAdvanced(req: Request, res: Response) {
    try {
      const { reportType, format } = req.query;
      const filters = ReportController.buildFilters(req.query);

      // We fetch report records using our helper logic
      let headers: string[] = [];
      let csvRows: any[][] = [];
      let docTitle = 'ADVANCED REPORT';

      if (reportType === 'INTEREST') {
        docTitle = 'INTEREST COLLECTION PERFORMANCE REPORT';
        headers = ['Loan ID', 'Customer', 'Category', 'Principal (INR)', 'Expected Int (INR)', 'Collected Int (INR)', 'Outstanding Int (INR)', 'Status'];
        
        const loans = await prisma.loan.findMany({
          where: filters,
          include: {
            customer: true,
            loanType: true,
            status: true,
            emiSchedule: { where: { is_deleted: false } },
            payments: { where: { is_deleted: false } },
          },
        });

        csvRows = loans.map((l) => {
          const now = new Date();
          const expectedInterest = l.emiSchedule
            .filter((inst) => new Date(inst.dueDate) <= now)
            .reduce((sum, inst) => sum + inst.interestAmount, 0);
          const paidInterest = l.payments.reduce((sum, p) => sum + p.interestPortion, 0);
          const outstandingInterest = Math.max(0, expectedInterest - paidInterest);

          return [
            l.id,
            l.customer.name,
            l.loanType.name,
            l.amount.toFixed(2),
            expectedInterest.toFixed(2),
            paidInterest.toFixed(2),
            outstandingInterest.toFixed(2),
            l.status.name,
          ];
        });

      } else if (reportType === 'COLLATERAL') {
        docTitle = 'COLLATERAL VALUATION AUDIT REPORT';
        headers = ['Loan ID', 'Customer', 'Asset', 'Weight (g)', 'Purity', 'Rate Creation (INR)', 'Current Rate (INR)', 'Value Creation (INR)', 'Current Value (INR)', 'Delta (INR)'];

        const collaterals = await prisma.collateral.findMany({
          where: { is_deleted: false, loan: filters },
          include: { loan: { include: { customer: true } } },
        });

        const marketRates = await prisma.marketRate.findMany({ where: { is_deleted: false } });
        const ratesMap = new Map(marketRates.map((mr) => [mr.asset, mr.rate]));

        csvRows = collaterals.map((c) => {
          const liveRate = ratesMap.get(c.type.toUpperCase()) || 0;
          const liveValue = (c.weight || 0) * liveRate * (c.purityRatioAtLoanCreation || 0);
          const delta = liveValue - c.appraisedValueAtLoanCreation;

          return [
            c.loanId,
            c.loan.customer.name,
            c.type,
            c.weight || 0,
            `${c.purity} (${c.purityUnit})`,
            c.marketRateAtLoanCreation.toFixed(2),
            liveRate.toFixed(2),
            c.appraisedValueAtLoanCreation.toFixed(2),
            liveValue.toFixed(2),
            delta.toFixed(2),
          ];
        });

      } else if (reportType === 'AUDIT') {
        docTitle = 'SYSTEM AUDIT ACTIVITY LOGS REPORT';
        headers = ['Timestamp', 'Auditor User', 'Action', 'Module', 'Old Values', 'New Values'];

        const auditFilters: any = {};
        if (req.query.startDateFrom || req.query.startDateTo) {
          auditFilters.createdAt = {};
          if (req.query.startDateFrom) auditFilters.createdAt.gte = new Date(req.query.startDateFrom as string);
          if (req.query.startDateTo) auditFilters.createdAt.lte = new Date(req.query.startDateTo as string);
        }

        const logs = await prisma.auditLog.findMany({
          where: auditFilters,
          include: { user: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        });

        csvRows = logs.map((l) => [
          new Date(l.createdAt).toLocaleString(),
          l.user?.email || 'SYSTEM',
          l.action,
          l.module,
          l.oldValue || '',
          l.newValue || '',
        ]);

      } else {
        // Defaults to PERFORMANCE
        docTitle = 'LOAN PERFORMANCE REPORT';
        headers = ['Loan ID', 'Customer', 'Category', 'Principal (INR)', 'Principal Balance (INR)', 'Interest Balance (INR)', 'StartDate', 'Status'];

        const loans = await prisma.loan.findMany({
          where: filters,
          include: { customer: true, loanType: true, status: true },
        });

        csvRows = loans.map((l) => [
          l.id,
          l.customer.name,
          l.loanType.name,
          l.amount.toFixed(2),
          l.outstandingPrincipal.toFixed(2),
          l.outstandingInterest.toFixed(2),
          new Date(l.startDate).toLocaleDateString(),
          l.status.name,
        ]);
      }

      if (format === 'CSV') {
        // Generate CSV file stream
        const csvContent = '\uFEFF' + [headers.join(','), ...csvRows.map((row) => row.map((val) => `"${val}"`).join(','))].join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=report_${reportType}.csv`);
        return res.send(csvContent);
      } else {
        // PDF Export
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename=report_${reportType}.pdf`);
          return res.send(pdfBuffer);
        });

        // Draw header Navy box
        doc.rect(0, 0, doc.page.width, 70).fill('#0B1B3D');
        doc.rect(0, 70, doc.page.width, 4).fill('#C5A880');

        doc.fillColor('#FFFFFF')
           .font('Helvetica-Bold')
           .fontSize(16)
           .text(docTitle, 30, 22);

        doc.fontSize(8).fillColor('#A3B8CC').text(`Generated: ${new Date().toLocaleString()}`, 30, 42);

        // Draw tables
        let currentY = 100;
        const colWidth = Math.floor((doc.page.width - 60) / headers.length);

        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0B1B3D');
        headers.forEach((h, index) => {
          doc.text(h, 30 + index * colWidth, currentY, { width: colWidth - 5, align: 'left' });
        });

        doc.moveTo(30, currentY + 12).lineTo(doc.page.width - 30, currentY + 12).strokeColor('#0B1B3D').lineWidth(1.5).stroke();
        currentY += 20;

        doc.font('Helvetica').fontSize(8).fillColor('#333333');
        csvRows.forEach((row) => {
          if (currentY > doc.page.height - 50) {
            doc.addPage({ size: 'A4', layout: 'landscape' });
            currentY = 40;
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#0B1B3D');
            headers.forEach((h, index) => {
              doc.text(h, 30 + index * colWidth, currentY, { width: colWidth - 5 });
            });
            doc.moveTo(30, currentY + 12).lineTo(doc.page.width - 30, currentY + 12).strokeColor('#0B1B3D').lineWidth(1.5).stroke();
            currentY += 20;
            doc.font('Helvetica').fontSize(8).fillColor('#333333');
          }

          row.forEach((val, idx) => {
            const displayVal = String(val).substring(0, 40); // safety crop for JSON fields
            doc.text(displayVal, 30 + idx * colWidth, currentY, { width: colWidth - 5, height: 10, ellipsis: true });
          });

          doc.moveTo(30, currentY + 12).lineTo(doc.page.width - 30, currentY + 12).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
          currentY += 16;
        });

        doc.end();
      }

    } catch (error) {
      console.error('Export Advanced Report Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  // --- Keep legacy reports for backward compatibility ---
  public static async getReportDataLegacy(req: Request, res: Response) {
    return ReportController.getReportData(req, res);
  }

  public static async getReportData(req: Request, res: Response) {
    try {
      const filters = ReportController.buildFilters(req.query);
      const dashboardSummary = String(req.query.scope || '').toLowerCase() === 'dashboard';

      const summaryFilters = dashboardSummary
        ? {
            ...filters,
            customer: { is_deleted: false },
            status: { code: 'APPROVED' },
          }
        : filters;

      const loans = await prisma.loan.findMany({
        where: filters,
        include: {
          customer: true,
          loanType: true,
          status: true,
          interestType: true,
        },
        orderBy: { startDate: 'desc' },
      });

      const summaryLoans = dashboardSummary
        ? await prisma.loan.findMany({
            where: summaryFilters,
            include: {
              customer: true,
              loanType: true,
              status: true,
              interestType: true,
            },
            orderBy: { startDate: 'desc' },
          })
        : loans;

      const records = loans.map((l) => ({
        id: l.id,
        customerName: l.customer.name,
        customerMobile: l.customer.mobile,
        loanType: l.loanType.name,
        amount: l.amount,
        interestRate: l.interestRate,
        interestType: l.interestType.code,
        tenureMonths: l.tenureMonths,
        outstandingPrincipal: l.outstandingPrincipal,
        outstandingInterest: l.outstandingInterest,
        startDate: l.startDate,
        status: l.status.name,
        statusCode: l.status.code,
      }));

      const totalDisbursed = summaryLoans.reduce((sum, l) => sum + l.amount, 0);
      const totalOutstandingPrincipal = summaryLoans.reduce((sum, l) => sum + l.outstandingPrincipal, 0);
      const totalOutstandingInterest = summaryLoans.reduce((sum, l) => sum + l.outstandingInterest, 0);
      const totalOutstanding = totalOutstandingPrincipal + totalOutstandingInterest;

      const activeCount = summaryLoans.filter((l) => l.status.code === 'APPROVED').length;
      const pendingCount = dashboardSummary ? 0 : loans.filter((l) => l.status.code === 'PENDING').length;
      const overdueCount = summaryLoans.filter((l) => l.status.code === 'OVERDUE').length;

      // New: dashboard stats
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const upcomingEmiCount = await prisma.emiSchedule.count({
        where: {
          is_deleted: false,
          status: { in: ['UNPAID', 'PARTIAL'] },
          dueDate: {
            gte: new Date(),
            lte: sevenDaysFromNow,
          },
          loan: dashboardSummary
            ? {
                is_deleted: false,
                customer: { is_deleted: false },
                status: { code: 'APPROVED' },
              }
            : { is_deleted: false },
        },
      });

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      const todayCollections = await prisma.payment.aggregate({
        where: {
          is_deleted: false,
          paymentDate: {
            gte: startOfToday,
            lte: endOfToday,
          },
          loan: dashboardSummary
            ? {
                is_deleted: false,
                customer: { is_deleted: false },
                status: { code: 'APPROVED' },
              }
            : { is_deleted: false },
        },
        _sum: {
          amount: true,
        },
      });
      const todayCollectionsAmount = todayCollections._sum.amount || 0;

      return res.json({
        stats: {
          totalDisbursed: Math.round(totalDisbursed * 100) / 100,
          totalOutstandingPrincipal: Math.round(totalOutstandingPrincipal * 100) / 100,
          totalOutstandingInterest: Math.round(totalOutstandingInterest * 100) / 100,
          totalOutstanding: Math.round(totalOutstanding * 100) / 100,
          activeCount,
          pendingCount,
          overdueCount,
          totalCount: loans.length,
          upcomingEmiCount,
          todayCollectionsAmount: Math.round(todayCollectionsAmount * 100) / 100,
        },
        records,
      });
    } catch (error) {
      console.error('Get Report Data Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async exportPdf(req: Request, res: Response) {
    try {
      const filters = ReportController.buildFilters(req.query);

      const loans = await prisma.loan.findMany({
        where: filters,
        include: {
          customer: true,
          loanType: true,
          status: true,
          interestType: true,
        },
        orderBy: { startDate: 'desc' },
      });

      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=loans_report.pdf`);
        return res.send(pdfBuffer);
      });

      // Draw header Navy box
      doc.rect(0, 0, doc.page.width, 70).fill('#0B1B3D');
      doc.rect(0, 70, doc.page.width, 4).fill('#C5A880');

      doc.fillColor('#FFFFFF')
         .font('Helvetica-Bold')
         .fontSize(16)
         .text('LOANS PERFORMANCE REPORT', 30, 22);

      doc.fontSize(8).fillColor('#A3B8CC').text(`Generated: ${new Date().toLocaleString()}`, 30, 42);

      let currentY = 100;
      const headers = ['Loan ID', 'Customer', 'Category', 'Principal (INR)', 'Interest Rate (%)', 'Principal Bal (INR)', 'Interest Bal (INR)', 'Start Date', 'Status'];
      const colWidth = Math.floor((doc.page.width - 60) / headers.length);

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#0B1B3D');
      headers.forEach((h, index) => {
        doc.text(h, 30 + index * colWidth, currentY, { width: colWidth - 5, align: 'left' });
      });

      doc.moveTo(30, currentY + 12).lineTo(doc.page.width - 30, currentY + 12).strokeColor('#0B1B3D').lineWidth(1.5).stroke();
      currentY += 20;

      doc.font('Helvetica').fontSize(8).fillColor('#333333');
      loans.forEach((l) => {
        if (currentY > doc.page.height - 50) {
          doc.addPage({ size: 'A4', layout: 'landscape' });
          currentY = 40;
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#0B1B3D');
          headers.forEach((h, index) => {
            doc.text(h, 30 + index * colWidth, currentY, { width: colWidth - 5 });
          });
          doc.moveTo(30, currentY + 12).lineTo(doc.page.width - 30, currentY + 12).strokeColor('#0B1B3D').lineWidth(1.5).stroke();
          currentY += 20;
          doc.font('Helvetica').fontSize(8).fillColor('#333333');
        }

        const row = [
          `#${l.id}`,
          l.customer.name,
          l.loanType.name,
          l.amount.toFixed(2),
          `${l.interestRate}% (${l.interestType.code})`,
          l.outstandingPrincipal.toFixed(2),
          l.outstandingInterest.toFixed(2),
          new Date(l.startDate).toLocaleDateString(),
          l.status.name,
        ];

        row.forEach((val, idx) => {
          doc.text(String(val), 30 + idx * colWidth, currentY, { width: colWidth - 5, height: 10, ellipsis: true });
        });

        doc.moveTo(30, currentY + 12).lineTo(doc.page.width - 30, currentY + 12).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
        currentY += 16;
      });

      doc.end();
    } catch (error) {
      console.error('Export Loans PDF Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }
}
export default ReportController;
