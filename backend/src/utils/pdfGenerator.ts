import PDFDocument from 'pdfkit';
import { formatCurrency } from '../utils/currency';

export class PdfGenerator {
  /**
   * Generates a narrow receipt PDF suitable for 2-3 inch receipt printers.
   */
  public static generatePaymentReceipt(data: {
    receiptNumber: string;
    customerName: string;
    customerMobile: string;
    loanId: number;
    loanTypeName: string;
    paymentTypeName: string;
    amount: number;
    principalPortion: number;
    interestPortion: number;
    penaltyPortion: number;
    remainingBalance: number;
    paymentDate: Date;
    referenceNumber?: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const pageWidth = 216; // 3 inches at 72 PDF points per inch.
        const margin = 14;
        const doc = new PDFDocument({ margin, size: [pageWidth, 560] });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const contentWidth = doc.page.width - margin * 2;
        const amountX = doc.page.width - 100;
        const amountWidth = 86;

        doc.rect(0, 0, doc.page.width, 72).fill('#0B1B3D');
        doc.rect(0, 72, doc.page.width, 4).fill('#C5A880');

        doc.fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(11)
          .text('LOAN PAYMENT RECEIPT', margin, 18, { width: contentWidth, align: 'center' });

        doc.fillColor('#C5A880')
          .font('Helvetica')
          .fontSize(8)
          .text(`Receipt No: ${data.receiptNumber}`, margin, 38, { width: contentWidth, align: 'center' });

        doc.fillColor('#A3B8CC')
          .fontSize(7)
          .text(`Date: ${new Date(data.paymentDate).toLocaleString()}`, margin, 54, { width: contentWidth, align: 'center' });

        doc.y = 92;
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#0B1B3D').text('CUSTOMER DETAILS', margin, doc.y);
        doc.moveDown(0.3);
        doc.font('Helvetica').fontSize(8).fillColor('#444444');
        doc.text(`Name: ${data.customerName}`, { width: contentWidth });
        doc.text(`Mobile: ${data.customerMobile}`, { width: contentWidth });

        doc.moveDown(0.7);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#0B1B3D').text('LOAN DETAILS', { width: contentWidth });
        doc.moveDown(0.3);
        doc.font('Helvetica').fontSize(8).fillColor('#444444');
        doc.text(`Loan ID: #${data.loanId}`, { width: contentWidth });
        doc.text(`Loan Type: ${data.loanTypeName}`, { width: contentWidth });

        doc.moveDown(0.8);
        doc.moveTo(margin, doc.y).lineTo(doc.page.width - margin, doc.y).strokeColor('#E0E0E0').lineWidth(1).stroke();

        doc.y += 12;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0B1B3D');
        doc.text('Item', margin, doc.y, { width: 90 });
        doc.text('Amount (INR)', amountX, doc.y, { align: 'right', width: amountWidth });
        doc.moveTo(margin, doc.y + 12).lineTo(doc.page.width - margin, doc.y + 12).strokeColor('#0B1B3D').lineWidth(1.2).stroke();

        const items = [
          { name: 'Principal Portion', val: data.principalPortion },
          { name: 'Interest Portion', val: data.interestPortion },
          { name: 'Penalty Portion', val: data.penaltyPortion },
        ];

        let currentY = doc.y + 22;
        doc.font('Helvetica').fontSize(8).fillColor('#555555');
        items.forEach((item) => {
          doc.text(item.name, margin, currentY, { width: 94 });
          doc.text(formatCurrency(item.val), amountX, currentY, { align: 'right', width: amountWidth });
          currentY += 18;
        });

        doc.moveTo(margin, currentY).lineTo(doc.page.width - margin, currentY).strokeColor('#E0E0E0').lineWidth(1).stroke();
        currentY += 10;

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#0B1B3D');
        doc.text('Total Payment', margin, currentY, { width: 94 });
        doc.text(formatCurrency(data.amount), amountX, currentY, { align: 'right', width: amountWidth });

        currentY += 20;
        doc.moveTo(margin, currentY).lineTo(doc.page.width - margin, currentY).strokeColor('#E0E0E0').lineWidth(1).stroke();
        currentY += 10;

        doc.font('Helvetica').fontSize(8).fillColor('#666666');
        doc.text(`Payment Mode: ${data.paymentTypeName}`, margin, currentY, { width: contentWidth });
        currentY += 12;
        if (data.referenceNumber) {
          doc.text(`Reference No: ${data.referenceNumber}`, margin, currentY, { width: contentWidth });
          currentY += 12;
        }
        doc.text(`Outstanding Principal: ${formatCurrency(data.remainingBalance)}`, margin, currentY, { width: contentWidth });

        doc.rect(0, doc.page.height - 38, doc.page.width, 38).fill('#0B1B3D');
        doc.fillColor('#C5A880')
          .font('Helvetica')
          .fontSize(7)
          .text('Thank you for your business', margin, doc.page.height - 24, {
            align: 'center',
            width: contentWidth,
          });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
