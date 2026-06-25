export interface Transaction {
    id: number;
    loanId: number;
    transactionTypeId: number;
    transactionDate: string;
    amount: number;
    principalImpact: number;
    interestImpact: number;
    penaltyImpact: number;
    feeImpact: number;
    runningPrincipal: number;
    runningInterest: number;
    runningTotal: number;
    referenceId?: number;
    referenceType?: string;
    description?: string;
    createdBy: string;
    created_at: string;
    transactionType?: TransactionType;
}

export interface TransactionType {
    id: number;
    name: string;
    code: string;
    category: 'DEBIT' | 'CREDIT' | 'BOTH';
    description?: string;
}

export interface TransactionSummary {
    totalDebits: number;
    totalCredits: number;
    netChange: number;
    totalPrincipalPaid: number;
    totalInterestPaid: number;
    totalPenalties: number;
    totalFees: number;
}