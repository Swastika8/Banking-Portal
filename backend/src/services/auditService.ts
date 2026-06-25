import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AuditService {
  /**
   * Logs a user action with details into the audit_logs table.
   */
  public static async logAction(params: {
    userId: number | null;
    action: string; // CREATE, UPDATE, DELETE, LOGIN, LOGOUT
    module: string; // AUTH, CUSTOMER, LOAN, PAYMENT, SETTINGS, MASTER
    oldValue?: any;
    newValue?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      const { userId, action, module, oldValue, newValue, ipAddress, userAgent } = params;

      await prisma.auditLog.create({
        data: {
          userId,
          action,
          module,
          oldValue: oldValue ? JSON.stringify(oldValue) : null,
          newValue: newValue ? JSON.stringify(newValue) : null,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });
    } catch (error) {
      // Avoid failing the parent transaction if audit logging fails
      console.error('Audit Log Insertion Failed:', error);
    }
  }
}
