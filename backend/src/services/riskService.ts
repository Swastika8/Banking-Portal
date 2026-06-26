import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class RiskService {
  /**
   * Helper to retrieve a numeric system setting with a fallback default.
   */
  private static async getNumericSetting(key: string, fallback: number): Promise<number> {
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key },
      });
      if (!setting) return fallback;
      const val = parseFloat(setting.value);
      return isNaN(val) ? fallback : val;
    } catch {
      return fallback;
    }
  }

  /**
   * Recalculates and caches a customer's risk profile score and level.
   */
  public static async calculate(customerId: number): Promise<{ riskScore: number; riskLevel: string }> {
    // 1. Fetch Point Weights and Thresholds from DB settings
    const wtBalHigh = await this.getNumericSetting('risk_weight_outstanding_balance_high', 30);
    const wtBalMed = await this.getNumericSetting('risk_weight_outstanding_balance_med', 15);
    const wtMissed = await this.getNumericSetting('risk_weight_missed_payment', 20);
    const wtActive = await this.getNumericSetting('risk_weight_active_loans_high', 15);
    const wtSettledDisc = await this.getNumericSetting('risk_weight_settled_loan_discount', 10);
    
    const threshHigh = await this.getNumericSetting('risk_threshold_high', 50);
    const threshMed = await this.getNumericSetting('risk_threshold_medium', 20);

    // 2. Fetch Customer's current loan accounts and schedules
    const customer = await prisma.customer.findUnique({
      where: { id: customerId, is_deleted: false },
      include: {
        loans: {
          where: { is_deleted: false },
          include: {
            status: true,
            emiSchedule: {
              where: { is_deleted: false },
            },
          },
        },
      },
    });

    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found.`);
    }

    // 3. Extract metrics
    const activeLoans = customer.loans.filter(
      (l) => l.status.code === 'APPROVED' || l.status.code === 'OVERDUE'
    );
    const settledLoans = customer.loans.filter(
      (l) => l.status.code === 'CLOSED' || l.status.code === 'FORECLOSED'
    );

    const outstandingBalance = activeLoans.reduce((sum, l) => sum + l.outstandingPrincipal, 0);

    // Calculate missed installments (past due and unpaid)
    let missedPaymentsCount = 0;
    const now = new Date();
    activeLoans.forEach((loan) => {
      const pastUnpaid = loan.emiSchedule.filter(
        (inst) => new Date(inst.dueDate) < now && inst.status !== 'PAID'
      );
      missedPaymentsCount += pastUnpaid.length;
    });

    // 4. Calculate Risk Points
    let score = 0;

    // Balance Points
    if (outstandingBalance > 50000) {
      score += wtBalHigh;
    } else if (outstandingBalance > 10000) {
      score += wtBalMed;
    }

    // Missed Payment Points
    score += missedPaymentsCount * wtMissed;

    // Active Loans Points
    if (activeLoans.length > 3) {
      score += wtActive;
    }

    // Settled Loan Discount
    score -= settledLoans.length * wtSettledDisc;

    // Bound score to 0
    score = Math.max(0, Math.round(score));

    // 5. Determine classification level
    let level = 'LOW';
    if (score >= threshHigh) {
      level = 'HIGH';
    } else if (score >= threshMed) {
      level = 'MEDIUM';
    }

    // 6. Update cache in customer table
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        riskScore: score,
        riskLevel: level,
      },
    });

    return { riskScore: score, riskLevel: level };
  }
}
