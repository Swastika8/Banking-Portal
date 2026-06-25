import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuditService } from '../services/auditService';
import { RiskService } from '../services/riskService';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export class CustomerController {
  public static async search(req: Request, res: Response) {
    try {
      const { query } = req.query;
      
      const filter: any = { is_deleted: false };

      if (query) {
        const queryStr = String(query).trim();
        const queryInt = parseInt(queryStr);

        filter.OR = [
          { name: { contains: queryStr, mode: 'insensitive' } },
          { mobile: { contains: queryStr } },
          { email: { contains: queryStr, mode: 'insensitive' } },
        ];

        if (!isNaN(queryInt)) {
          filter.OR.push({ id: queryInt });
        }
      }

      const customers = await prisma.customer.findMany({
        where: filter,
        orderBy: { id: 'desc' },
      });

      return res.json(customers);
    } catch (error) {
      console.error('Customer Search Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async getWorkspace(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid customer ID.' });
      }

      // Fetch Customer details
      const customer = await prisma.customer.findFirst({
        where: { id, is_deleted: false },
        include: {
          notes: {
            where: { is_deleted: false },
            orderBy: { created_at: 'desc' },
          },
          documents: {
            where: { isDeleted: false },
            orderBy: { uploadedAt: 'desc' },
          },
          loans: {
            where: { is_deleted: false },
            include: {
              status: true,
              loanType: true,
              interestType: true,
              payments: {
                where: { is_deleted: false },
                orderBy: { paymentDate: 'desc' },
              },
            },
            orderBy: { created_at: 'desc' },
          },
        },
      });

      if (!customer) {
        return res.status(404).json({ message: 'Customer not found.' });
      }

      // Separate current active loans and past closed loans
      const activeLoans = customer.loans.filter(
        (l) => l.status.code !== 'CLOSED' && l.status.code !== 'REJECTED'
      );
      const pastLoans = customer.loans.filter(
        (l) => l.status.code === 'CLOSED' || l.status.code === 'REJECTED'
      );
      const payableLoans = activeLoans.filter(
        (l) => l.status.code === 'APPROVED' || l.status.code === 'OVERDUE'
      );

      // Derive customer totals from repayable loans only.
      const outstandingAmount = payableLoans.reduce((sum, l) => sum + l.outstandingPrincipal, 0);
      const interestDue = payableLoans.reduce((sum, l) => sum + l.outstandingInterest, 0);

      // Aggregate payment transactions from active loans
      const paymentHistory = customer.loans
        .flatMap((l) => l.payments.map((p) => ({ ...p, loanType: l.loanType.name })))
        .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

      return res.json({
        personalDetails: {
          id: customer.id,
          name: customer.name,
          mobile: customer.mobile,
          email: customer.email,
          address: customer.address,
          dob: customer.dob,
          occupation: customer.occupation,
          profilePhoto: customer.profilePhoto,
          kycNumber: customer.kycNumber,
          kycInfo: customer.kycInfo ? JSON.parse(customer.kycInfo) : null,
          riskScore: customer.riskScore,
          riskLevel: customer.riskLevel,
        },
        activeLoans,
        pastLoans,
        outstandingAmount,
        interestDue,
        notes: customer.notes,
        documents: customer.documents,
        paymentHistory,
      });
    } catch (error) {
      console.error('Customer Workspace Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async create(req: Request, res: Response) {
    try {
      const { name, mobile, email, address, dob, occupation, kycNumber, kycInfo } = req.body;

      if (!name || !mobile) {
        return res.status(400).json({ message: 'Name and mobile number are required.' });
      }

      const existing = await prisma.customer.findFirst({
        where: { mobile, is_deleted: false },
      });

      if (existing) {
        return res.status(400).json({ message: 'A customer with this mobile number already exists.' });
      }

      const customer = await prisma.customer.create({
        data: {
          name,
          mobile,
          email,
          address,
          dob: dob ? new Date(dob) : null,
          occupation,
          kycNumber,
          kycInfo: kycInfo ? JSON.stringify(kycInfo) : null,
          created_by: req.user?.email || 'SYSTEM',
        },
      });

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'CREATE',
        module: 'CUSTOMER',
        newValue: customer,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.status(201).json(customer);
    } catch (error) {
      console.error('Create Customer Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID.' });
      }

      const { name, mobile, email, address, dob, occupation, kycNumber, kycInfo } = req.body;

      const customer = await prisma.customer.findFirst({
        where: { id, is_deleted: false },
      });

      if (!customer) {
        return res.status(404).json({ message: 'Customer not found.' });
      }

      const updated = await prisma.customer.update({
        where: { id },
        data: {
          name,
          mobile,
          email,
          address,
          dob: dob ? new Date(dob) : null,
          occupation,
          kycNumber,
          kycInfo: kycInfo ? JSON.stringify(kycInfo) : null,
          updated_by: req.user?.email || 'SYSTEM',
        },
      });

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'UPDATE',
        module: 'CUSTOMER',
        oldValue: customer,
        newValue: updated,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json(updated);
    } catch (error) {
      console.error('Update Customer Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID.' });
      }
      const { transferToCustomerId, createTransferCustomer } = req.body || {};

      const customer = await prisma.customer.findFirst({
        where: { id, is_deleted: false },
      });

      if (!customer) {
        return res.status(404).json({ message: 'Customer not found.' });
      }

      const userEmail = req.user?.email || 'SYSTEM';

      const ongoingLoans = await prisma.loan.findMany({
        where: {
          customerId: id,
          is_deleted: false,
          status: {
            code: { in: ['PENDING', 'APPROVED', 'OVERDUE'] },
          },
        },
        include: {
          status: true,
          loanType: true,
        },
      });

      if (ongoingLoans.length > 0 && !transferToCustomerId && !createTransferCustomer) {
        return res.status(409).json({
          message: 'This customer has ongoing loans. Transfer them to another customer ID or create a new customer before deleting.',
          requiresTransfer: true,
          activeLoans: ongoingLoans.map((loan) => ({
            id: loan.id,
            loanType: loan.loanType.name,
            status: loan.status.name,
            outstandingPrincipal: loan.outstandingPrincipal,
            outstandingInterest: loan.outstandingInterest,
          })),
        });
      }

      const deleted = await prisma.$transaction(async (tx) => {
        let targetCustomerId: number | null = null;

        if (ongoingLoans.length > 0) {
          if (transferToCustomerId) {
            targetCustomerId = parseInt(String(transferToCustomerId));
            if (isNaN(targetCustomerId) || targetCustomerId === id) {
              throw new Error('A valid different transfer customer ID is required.');
            }

            const transferTarget = await tx.customer.findFirst({
              where: { id: targetCustomerId, is_deleted: false },
            });

            if (!transferTarget) {
              throw new Error('Transfer customer not found.');
            }
          } else if (createTransferCustomer) {
            const { name, mobile, email, address } = createTransferCustomer;
            if (!name || !mobile) {
              throw new Error('New transfer customer name and mobile are required.');
            }

            const existing = await tx.customer.findFirst({
              where: { mobile, is_deleted: false },
            });

            if (existing) {
              throw new Error('An active customer with the transfer mobile number already exists.');
            }

            const created = await tx.customer.create({
              data: {
                name,
                mobile,
                email: email || null,
                address: address || null,
                created_by: userEmail,
              },
            });
            targetCustomerId = created.id;
          }

          if (!targetCustomerId) {
            throw new Error('Transfer customer is required for ongoing loans.');
          }

          await tx.loan.updateMany({
            where: { id: { in: ongoingLoans.map((loan) => loan.id) } },
            data: {
              customerId: targetCustomerId,
              updated_by: userEmail,
            },
          });
        }

        return tx.customer.update({
          where: { id },
          data: {
            is_deleted: true,
            deleted_at: new Date(),
            deleted_by: userEmail,
          },
        });
      });

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'DELETE',
        module: 'CUSTOMER',
        oldValue: customer,
        newValue: {
          id,
          is_deleted: true,
          deleted_by: userEmail,
          transferredLoanIds: ongoingLoans.map((loan) => loan.id),
          transferToCustomerId: transferToCustomerId || null,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({ message: 'Customer soft-deleted successfully.' });
    } catch (error) {
      console.error('Delete Customer Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  // --- Note Management ---

  public static async addNote(req: Request, res: Response) {
    try {
      const customerId = parseInt(req.params.customerId);
      const { title, content } = req.body;

      if (isNaN(customerId) || !title || !content) {
        return res.status(400).json({ message: 'Customer ID, title, and content are required.' });
      }

      const note = await prisma.note.create({
        data: {
          customerId,
          title,
          content,
          created_by: req.user?.email || 'SYSTEM',
        },
      });

      return res.status(201).json(note);
    } catch (error) {
      console.error('Add Note Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async deleteNote(req: Request, res: Response) {
    try {
      const noteId = parseInt(req.params.noteId);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID.' });
      }

      const note = await prisma.note.findFirst({
        where: { id: noteId, is_deleted: false },
      });

      if (!note) {
        return res.status(404).json({ message: 'Note not found.' });
      }

      await prisma.note.update({
        where: { id: noteId },
        data: {
          is_deleted: true,
          deleted_at: new Date(),
          deleted_by: req.user?.email || 'SYSTEM',
        },
      });

      return res.json({ message: 'Note deleted successfully.' });
    } catch (error) {
      console.error('Delete Note Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  // --- Document Management ---

  public static async uploadDocument(req: Request, res: Response) {
    try {
      const customerId = parseInt(req.params.customerId);
      const { name, documentType, fileData, fileType } = req.body; // base64 string

      if (isNaN(customerId) || !name || !documentType || !fileData) {
        return res.status(400).json({ message: 'Customer ID, name, document type, and file data (base64) are required.' });
      }

      // Convert base64 to binary buffer
      const buffer = Buffer.from(fileData, 'base64');
      const ext = path.extname(name) || '.dat';
      const serverFileName = `${customerId}_${Date.now()}${ext}`;
      const filePath = path.join(UPLOADS_DIR, serverFileName);

      // Write to filesystem
      fs.writeFileSync(filePath, buffer);

      const dbDoc = await prisma.document.create({
        data: {
          customerId,
          name,
          documentType,
          filePath: `uploads/${serverFileName}`,
          fileSize: buffer.length,
          fileType: fileType || 'application/octet-stream',
          uploadedBy: req.user?.email || 'SYSTEM',
        },
      });

      return res.status(201).json(dbDoc);
    } catch (error) {
      console.error('Upload Document Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async deleteDocument(req: Request, res: Response) {
    try {
      const docId = parseInt(req.params.docId);
      if (isNaN(docId)) {
        return res.status(400).json({ message: 'Invalid document ID.' });
      }

      const doc = await prisma.document.findFirst({
        where: { id: docId, isDeleted: false },
      });

      if (!doc) {
        return res.status(404).json({ message: 'Document not found.' });
      }

      await prisma.document.update({
        where: { id: docId },
        data: {
          isDeleted: true,
        },
      });

      // Note: we soft delete database record, keep local file to satisfy "never physically delete"

      return res.json({ message: 'Document soft-deleted successfully.' });
    } catch (error) {
      console.error('Delete Document Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async recalculateRisk(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid customer ID.' });
      }

      const customer = await prisma.customer.findFirst({
        where: { id, is_deleted: false }
      });
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found.' });
      }

      const result = await RiskService.calculate(id);

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'UPDATE',
        module: 'CUSTOMER',
        newValue: { customerId: id, riskScore: result.riskScore, riskLevel: result.riskLevel },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({
        message: 'Risk profile score recalculated and cached successfully.',
        riskScore: result.riskScore,
        riskLevel: result.riskLevel
      });
    } catch (error: any) {
      console.error('Recalculate Risk Error:', error);
      return res.status(500).json({ message: error.message || 'Internal server error.' });
    }
  }
}
