import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuditService } from '../services/auditService';

const prisma = new PrismaClient();

export class SettingController {
  // --- Settings ---
  
  public static async getSettings(req: Request, res: Response) {
    try {
      const settings = await prisma.systemSetting.findMany({
        where: { is_deleted: false },
      });
      return res.json(settings);
    } catch (error) {
      console.error('Get Settings Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async updateSettings(req: Request, res: Response) {
    try {
      const { settings } = req.body; // Array of { id, value }
      if (!settings || !Array.isArray(settings)) {
        return res.status(400).json({ message: 'Settings array is required.' });
      }

      const updated = [];
      const userEmail = req.user?.email || 'SYSTEM';

      for (const item of settings) {
        const original = await prisma.systemSetting.findUnique({
          where: { id: item.id },
        });

        if (original) {
          const u = await prisma.systemSetting.update({
            where: { id: item.id },
            data: {
              value: String(item.value),
              updated_by: userEmail,
            },
          });

          await AuditService.logAction({
            userId: req.user?.id || null,
            action: 'UPDATE',
            module: 'SETTINGS',
            oldValue: original,
            newValue: u,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          });

          updated.push(u);
        }
      }

      return res.json({ message: 'Settings updated successfully.', settings: updated });
    } catch (error) {
      console.error('Update Settings Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  // --- Masters Lookup ---

  public static async getMasters(req: Request, res: Response) {
    try {
      const loanTypes = await prisma.loanTypeMaster.findMany({ where: { is_deleted: false } });
      const interestTypes = await prisma.interestTypeMaster.findMany({ where: { is_deleted: false } });
      const paymentTypes = await prisma.paymentTypeMaster.findMany({ where: { is_deleted: false } });
      const statuses = await prisma.loanStatusMaster.findMany({ where: { is_deleted: false } });
      
      const roles = await prisma.role.findMany({
        where: { is_deleted: false },
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      });

      const permissions = await prisma.permission.findMany({ where: { is_deleted: false } });

      return res.json({
        loanTypes,
        interestTypes,
        paymentTypes,
        statuses,
        roles,
        permissions,
      });
    } catch (error) {
      console.error('Get Masters Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  // --- Manage Custom Loan Types (Dynamic Masters) ---

  public static async createLoanType(req: Request, res: Response) {
    try {
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ message: 'Loan type name is required.' });

      const existing = await prisma.loanTypeMaster.findFirst({
        where: { name, is_deleted: false },
      });

      if (existing) {
        return res.status(400).json({ message: 'A loan type with this name already exists.' });
      }

      const userEmail = req.user?.email || 'SYSTEM';

      const type = await prisma.loanTypeMaster.create({
        data: {
          name,
          description,
          created_by: userEmail,
        },
      });

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'CREATE',
        module: 'MASTER',
        newValue: type,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.status(201).json(type);
    } catch (error) {
      console.error('Create Loan Type Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async updateLoanType(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { name, description } = req.body;

      if (isNaN(id) || !name) {
        return res.status(400).json({ message: 'Invalid ID or missing loan type name.' });
      }

      const original = await prisma.loanTypeMaster.findFirst({
        where: { id, is_deleted: false },
      });

      if (!original) {
        return res.status(404).json({ message: 'Loan type not found.' });
      }

      const userEmail = req.user?.email || 'SYSTEM';

      const updated = await prisma.loanTypeMaster.update({
        where: { id },
        data: {
          name,
          description,
          updated_by: userEmail,
        },
      });

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'UPDATE',
        module: 'MASTER',
        oldValue: original,
        newValue: updated,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json(updated);
    } catch (error) {
      console.error('Update Loan Type Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async deleteLoanType(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID.' });

      const original = await prisma.loanTypeMaster.findFirst({
        where: { id, is_deleted: false },
      });

      if (!original) {
        return res.status(404).json({ message: 'Loan type not found.' });
      }

      const userEmail = req.user?.email || 'SYSTEM';

      const deleted = await prisma.loanTypeMaster.update({
        where: { id },
        data: {
          is_deleted: true,
          deleted_at: new Date(),
          deleted_by: userEmail,
        },
      });

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'DELETE',
        module: 'MASTER',
        oldValue: original,
        newValue: { id, is_deleted: true, deleted_by: userEmail },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({ message: 'Loan type soft-deleted successfully.' });
    } catch (error) {
      console.error('Delete Loan Type Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  // --- Manage Role Permissions (RBAC Config) ---

  public static async updateRolePermissions(req: Request, res: Response) {
    try {
      const { roleId, permissionIds } = req.body; // roleId: number, permissionIds: number[]

      if (!roleId || !Array.isArray(permissionIds)) {
        return res.status(400).json({ message: 'Role ID and permission IDs array are required.' });
      }

      const role = await prisma.role.findFirst({
        where: { id: roleId, is_deleted: false },
      });

      if (!role) return res.status(404).json({ message: 'Role not found.' });

      await prisma.$transaction(async (tx) => {
        // Delete all current role permission mappings
        await tx.rolePermission.deleteMany({
          where: { roleId },
        });

        // Insert new mappings
        const mappings = permissionIds.map((permId) => ({
          roleId,
          permissionId: permId,
        }));

        await tx.rolePermission.createMany({
          data: mappings,
        });
      });

      // Audit Log
      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'UPDATE',
        module: 'SETTINGS',
        newValue: { roleId, permissionIds },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({ message: 'Role permissions updated successfully.' });
    } catch (error) {
      console.error('Update Role Permissions Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  // --- Audit Logs ---

  public static async getAuditLogs(req: Request, res: Response) {
    try {
      const logs = await prisma.auditLog.findMany({
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100, // Limit to recent 100 logs
      });
      return res.json(logs);
    } catch (error) {
      console.error('Get Audit Logs Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async getDeletedRecords(req: Request, res: Response) {
    try {
      const [customers, loans, loanTypes, formulas] = await Promise.all([
        prisma.customer.findMany({
          where: { is_deleted: true },
          select: { id: true, name: true, mobile: true, deleted_at: true, deleted_by: true },
          orderBy: { deleted_at: 'desc' },
        }),
        prisma.loan.findMany({
          where: { is_deleted: true },
          include: {
            customer: { select: { name: true, mobile: true } },
            loanType: { select: { name: true } },
            status: { select: { name: true } },
          },
          orderBy: { deleted_at: 'desc' },
        }),
        prisma.loanTypeMaster.findMany({
          where: { is_deleted: true },
          select: { id: true, name: true, description: true, deleted_at: true, deleted_by: true },
          orderBy: { deleted_at: 'desc' },
        }),
        prisma.formulaMaster.findMany({
          where: { is_deleted: true },
          select: { id: true, name: true, category: true, deleted_at: true, deleted_by: true },
          orderBy: { deleted_at: 'desc' },
        }),
      ]);

      const records = [
        ...customers.map((customer) => ({
          entityType: 'CUSTOMER',
          id: customer.id,
          title: customer.name,
          subtitle: customer.mobile,
          deletedAt: customer.deleted_at,
          deletedBy: customer.deleted_by,
        })),
        ...loans.map((loan) => ({
          entityType: 'LOAN',
          id: loan.id,
          title: `Loan #${loan.id} - ${loan.loanType.name}`,
          subtitle: `${loan.customer.name} (${loan.status.name})`,
          deletedAt: loan.deleted_at,
          deletedBy: loan.deleted_by,
        })),
        ...loanTypes.map((loanType) => ({
          entityType: 'LOAN_TYPE',
          id: loanType.id,
          title: loanType.name,
          subtitle: loanType.description || 'Loan category',
          deletedAt: loanType.deleted_at,
          deletedBy: loanType.deleted_by,
        })),
        ...formulas.map((formula) => ({
          entityType: 'FORMULA',
          id: formula.id,
          title: formula.name,
          subtitle: formula.category,
          deletedAt: formula.deleted_at,
          deletedBy: formula.deleted_by,
        })),
      ].sort((a, b) => new Date(b.deletedAt || 0).getTime() - new Date(a.deletedAt || 0).getTime());

      return res.json(records);
    } catch (error) {
      console.error('Get Deleted Records Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  public static async restoreDeletedRecord(req: Request, res: Response) {
    try {
      const { entityType, id } = req.body;
      const recordId = parseInt(id);
      if (!entityType || isNaN(recordId)) {
        return res.status(400).json({ message: 'Entity type and ID are required.' });
      }

      const userEmail = req.user?.email || 'SYSTEM';
      const restoreData = {
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        updated_by: userEmail,
      };

      let restored: any;
      let module = String(entityType);

      if (entityType === 'CUSTOMER') {
        const customer = await prisma.customer.findUnique({ where: { id: recordId } });
        if (!customer) {
          return res.status(404).json({ message: 'Customer not found.' });
        }

        const duplicateMobile = await prisma.customer.findFirst({
          where: {
            mobile: customer.mobile,
            is_deleted: false,
            id: { not: recordId },
          },
        });

        if (duplicateMobile) {
          return res.status(409).json({
            message: 'This customer cannot be restored because an active customer already uses the same mobile number.',
          });
        }

        restored = await prisma.customer.update({ where: { id: recordId }, data: restoreData });
      } else if (entityType === 'LOAN') {
        restored = await prisma.$transaction(async (tx) => {
          const loan = await tx.loan.update({ where: { id: recordId }, data: restoreData });
          await tx.loanTimeline.create({
            data: {
              loanId: recordId,
              action: 'RESTORED',
              description: `Loan restored from deleted state by ${userEmail}.`,
              createdBy: userEmail,
            },
          });
          return loan;
        });
      } else if (entityType === 'LOAN_TYPE') {
        restored = await prisma.loanTypeMaster.update({ where: { id: recordId }, data: restoreData });
      } else if (entityType === 'FORMULA') {
        restored = await prisma.formulaMaster.update({ where: { id: recordId }, data: restoreData });
      } else {
        return res.status(400).json({ message: 'Unsupported restore entity type.' });
      }

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'RESTORE',
        module,
        oldValue: { id: recordId, is_deleted: true },
        newValue: { id: recordId, is_deleted: false, restored_by: userEmail },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({ message: 'Record restored successfully.', record: restored });
    } catch (error: any) {
      console.error('Restore Deleted Record Error:', error);
      return res.status(500).json({ message: error.message || 'Internal server error.' });
    }
  }

  public static async permanentDeleteRecord(req: Request, res: Response) {
    try {
      const { entityType, id } = req.body;
      const recordId = parseInt(id);
      if (!entityType || isNaN(recordId)) {
        return res.status(400).json({ message: 'Entity type and ID are required.' });
      }

      const userEmail = req.user?.email || 'SYSTEM';
      let deleted: any;
      let module = String(entityType);

      if (entityType === 'CUSTOMER') {
        deleted = await prisma.$transaction(async (tx) => {
          const customer = await tx.customer.findFirst({ where: { id: recordId, is_deleted: true } });
          if (!customer) {
            throw new Error('Deleted customer not found.');
          }

          const loans = await tx.loan.findMany({ where: { customerId: recordId }, select: { id: true } });
          for (const loan of loans) {
            await tx.loan.delete({ where: { id: loan.id } });
          }
          await tx.document.deleteMany({ where: { customerId: recordId } });
          await tx.note.deleteMany({ where: { customerId: recordId } });
          return tx.customer.delete({ where: { id: recordId } });
        });
      } else if (entityType === 'LOAN') {
        const loan = await prisma.loan.findFirst({ where: { id: recordId, is_deleted: true } });
        if (!loan) {
          return res.status(404).json({ message: 'Deleted loan not found.' });
        }
        deleted = await prisma.loan.delete({ where: { id: recordId } });
      } else if (entityType === 'LOAN_TYPE') {
        const activeLoans = await prisma.loan.count({ where: { loanTypeId: recordId } });
        if (activeLoans > 0) {
          return res.status(409).json({ message: 'Cannot permanently delete this loan category while loans still reference it.' });
        }
        deleted = await prisma.loanTypeMaster.delete({ where: { id: recordId } });
      } else if (entityType === 'FORMULA') {
        deleted = await prisma.formulaMaster.delete({ where: { id: recordId } });
      } else {
        return res.status(400).json({ message: 'Unsupported entity type for permanent deletion.' });
      }

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'PERMANENT_DELETE',
        module,
        oldValue: { id: recordId, entityType },
        newValue: { id: recordId, permanentlyDeletedBy: userEmail },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({ message: 'Record permanently deleted.', record: deleted });
    } catch (error: any) {
      console.error('Permanent Delete Record Error:', error);
      return res.status(500).json({ message: error.message || 'Internal server error.' });
    }
  }
}
