export interface InstallmentProjection {
  installmentNumber: number;
  dueDate: Date;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
}

export interface LoanCalculationResult {
  emi: number;
  totalInterest: number;
  totalPayable: number;
  schedule: InstallmentProjection[];
}

export class LoanEngineService {
  /**
   * Generates the initial EMI projection schedule for a loan.
   */
  public static calculateSchedule(
    amount: number,
    interestRate: number, // Annual rate (e.g. 12 for 12%)
    tenureMonths: number,
    interestTypeCode: 'SIMPLE' | 'COMPOUND',
    startDate: Date
  ): LoanCalculationResult {
    const schedule: InstallmentProjection[] = [];
    const annualRateFraction = interestRate / 100;
    const monthlyRateFraction = annualRateFraction / 12;

    let emi = 0;
    let totalInterest = 0;
    let totalPayable = 0;

    if (interestTypeCode === 'COMPOUND') {
      // Standard Reducing Balance EMI formula: EMI = [P * r * (1 + r)^n] / [(1 + r)^n - 1]
      if (monthlyRateFraction === 0) {
        emi = amount / tenureMonths;
      } else {
        emi =
          (amount * monthlyRateFraction * Math.pow(1 + monthlyRateFraction, tenureMonths)) /
          (Math.pow(1 + monthlyRateFraction, tenureMonths) - 1);
      }

      // Round EMI to 2 decimal places
      emi = Math.round(emi * 100) / 100;

      let remainingPrincipal = amount;
      for (let i = 1; i <= tenureMonths; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);

        const interestAmount = Math.round(remainingPrincipal * monthlyRateFraction * 100) / 100;
        let principalAmount = Math.round((emi - interestAmount) * 100) / 100;

        // For the last month, adjust principal to match exact remaining amount
        if (i === tenureMonths || principalAmount > remainingPrincipal) {
          principalAmount = remainingPrincipal;
        }

        const totalAmount = Math.round((principalAmount + interestAmount) * 100) / 100;
        remainingPrincipal = Math.max(0, Math.round((remainingPrincipal - principalAmount) * 100) / 100);
        totalInterest += interestAmount;

        schedule.push({
          installmentNumber: i,
          dueDate,
          principalAmount,
          interestAmount,
          totalAmount,
        });
      }

      totalInterest = Math.round(totalInterest * 100) / 100;
      totalPayable = Math.round((amount + totalInterest) * 100) / 100;
    } else {
      // SIMPLE INTEREST: Flat Simple Interest
      // Total Interest = P * R * T (T in years)
      const tenureYears = tenureMonths / 12;
      totalInterest = Math.round(amount * annualRateFraction * tenureYears * 100) / 100;
      totalPayable = Math.round((amount + totalInterest) * 100) / 100;
      emi = Math.round((totalPayable / tenureMonths) * 100) / 100;

      const monthlyPrincipal = Math.round((amount / tenureMonths) * 100) / 100;
      const monthlyInterest = Math.round((totalInterest / tenureMonths) * 100) / 100;

      let remainingPrincipal = amount;
      let remainingInterest = totalInterest;

      for (let i = 1; i <= tenureMonths; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);

        let principalAmount = monthlyPrincipal;
        let interestAmount = monthlyInterest;

        if (i === tenureMonths) {
          principalAmount = remainingPrincipal;
          interestAmount = remainingInterest;
        }

        const totalAmount = Math.round((principalAmount + interestAmount) * 100) / 100;
        remainingPrincipal = Math.max(0, Math.round((remainingPrincipal - principalAmount) * 100) / 100);
        remainingInterest = Math.max(0, Math.round((remainingInterest - interestAmount) * 100) / 100);

        schedule.push({
          installmentNumber: i,
          dueDate,
          principalAmount,
          interestAmount,
          totalAmount,
        });
      }
    }

    return {
      emi,
      totalInterest,
      totalPayable,
      schedule,
    };
  }

  /**
   * Recalculates remaining schedule after a principal reduction payment has been made.
   * Options:
   * - Option A: REDUCE_EMI (Tenure remains constant, EMI is lowered)
   * - Option B: REDUCE_TENURE (EMI remains constant, Tenure is shortened)
   */
  public static recalculateRemainingSchedule(
    remainingPrincipal: number,
    interestRate: number,
    remainingMonths: number,
    interestTypeCode: 'SIMPLE' | 'COMPOUND',
    currentEmi: number,
    option: 'REDUCE_EMI' | 'REDUCE_TENURE',
    lastPaymentDate: Date
  ): { emi: number; schedule: InstallmentProjection[] } {
    const schedule: InstallmentProjection[] = [];
    const annualRateFraction = interestRate / 100;
    const monthlyRateFraction = annualRateFraction / 12;

    if (remainingPrincipal <= 0) {
      return { emi: 0, schedule: [] };
    }

    if (option === 'REDUCE_EMI') {
      // Option A: Lower the EMI, keep same tenure
      const result = this.calculateSchedule(
        remainingPrincipal,
        interestRate,
        remainingMonths,
        interestTypeCode,
        lastPaymentDate
      );
      return { emi: result.emi, schedule: result.schedule };
    } else {
      // Option B: Keep original EMI, shorten the tenure
      let emi = currentEmi;
      let calculatedSchedule: InstallmentProjection[] = [];

      if (interestTypeCode === 'COMPOUND') {
        // We solve for tenure N: N = -log(1 - (P * r)/EMI) / log(1 + r)
        let projectedMonths = remainingMonths;
        if (monthlyRateFraction > 0) {
          const ratio = (remainingPrincipal * monthlyRateFraction) / emi;
          if (ratio < 1) {
            const n = -Math.log(1 - ratio) / Math.log(1 + monthlyRateFraction);
            projectedMonths = Math.max(1, Math.ceil(n));
          } else {
            // EMI is smaller than monthly interest accrued! Increase EMI to interest + 10%
            emi = Math.round((remainingPrincipal * monthlyRateFraction + 100) * 100) / 100;
            const ratioAdjusted = (remainingPrincipal * monthlyRateFraction) / emi;
            const n = -Math.log(1 - ratioAdjusted) / Math.log(1 + monthlyRateFraction);
            projectedMonths = Math.max(1, Math.ceil(n));
          }
        } else {
          projectedMonths = Math.ceil(remainingPrincipal / emi);
        }

        // Limit maximum projected months to avoid infinite loops if parameters are bad
        projectedMonths = Math.min(projectedMonths, 360);

        let tempPrincipal = remainingPrincipal;
        for (let i = 1; i <= projectedMonths; i++) {
          const dueDate = new Date(lastPaymentDate);
          dueDate.setMonth(dueDate.getMonth() + i);

          const interestAmount = Math.round(tempPrincipal * monthlyRateFraction * 100) / 100;
          let principalAmount = Math.round((emi - interestAmount) * 100) / 100;

          if (i === projectedMonths || tempPrincipal <= principalAmount) {
            principalAmount = tempPrincipal;
          }

          const totalAmount = Math.round((principalAmount + interestAmount) * 100) / 100;
          tempPrincipal = Math.max(0, Math.round((tempPrincipal - principalAmount) * 100) / 100);

          calculatedSchedule.push({
            installmentNumber: i,
            dueDate,
            principalAmount,
            interestAmount,
            totalAmount,
          });

          if (tempPrincipal <= 0) break;
        }
      } else {
        // Simple interest: flat interest rate per year
        // We know simple interest monthly is: P * R% / 12.
        // The principal component paid per month is EMI - Interest.
        // We calculate how many months it takes to clear.
        const monthlyInterestAmount = Math.round((remainingPrincipal * monthlyRateFraction) * 100) / 100;
        
        let principalPaidPerMonth = emi - monthlyInterestAmount;
        if (principalPaidPerMonth <= 0) {
          // If EMI is too low, we adjust it
          principalPaidPerMonth = Math.round((remainingPrincipal / remainingMonths) * 100) / 100;
          emi = Math.round((principalPaidPerMonth + monthlyInterestAmount) * 100) / 100;
        }

        const projectedMonths = Math.min(360, Math.ceil(remainingPrincipal / principalPaidPerMonth));
        let tempPrincipal = remainingPrincipal;

        for (let i = 1; i <= projectedMonths; i++) {
          const dueDate = new Date(lastPaymentDate);
          dueDate.setMonth(dueDate.getMonth() + i);

          const interestAmount = Math.round(tempPrincipal * monthlyRateFraction * 100) / 100;
          let principalAmount = Math.round((emi - interestAmount) * 100) / 100;

          if (i === projectedMonths || tempPrincipal <= principalAmount) {
            principalAmount = tempPrincipal;
          }

          const totalAmount = Math.round((principalAmount + interestAmount) * 100) / 100;
          tempPrincipal = Math.max(0, Math.round((tempPrincipal - principalAmount) * 100) / 100);

          calculatedSchedule.push({
            installmentNumber: i,
            dueDate,
            principalAmount,
            interestAmount,
            totalAmount,
          });

          if (tempPrincipal <= 0) break;
        }
      }
      return { emi, schedule: calculatedSchedule };
    }
  }
}
