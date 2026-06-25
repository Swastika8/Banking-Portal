import { PrismaClient } from '@prisma/client';
import { RiskService } from '../services/riskService';

const prisma = new PrismaClient();

/**
 * Scans for loans with missed installments (due date past and not paid)
 * and triggers risk recalculation for the associated customers.
 * Intended to be run as a daily background job.
 */
export async function runMissedInstallmentRiskJob(): Promise<{ processedCustomers: number }> {
  const now = new Date();
  // Find loans that have at least one unpaid EMI past due date
  const loansWithMissed = await prisma.loan.findMany({
    where: {
      is_deleted: false,
      status: {
        code: { in: ['APPROVED', 'OVERDUE'] },
      },
      emiSchedule: {
        some: {
          is_deleted: false,
          dueDate: { lt: now },
          status: { not: 'PAID' },
        },
      },
    },
    select: { customerId: true },
  });

  const uniqueCustomerIds = Array.from(new Set(loansWithMissed.map(l => l.customerId)));

  for (const custId of uniqueCustomerIds) {
    await RiskService.calculate(custId);
  }

  return { processedCustomers: uniqueCustomerIds.length };
}
