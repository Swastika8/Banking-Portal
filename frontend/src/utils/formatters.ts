export const formatCurrency = (amount: number): string => {
    if (amount === undefined || amount === null || isNaN(amount)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

export const formatDate = (date: string | Date): string => {
    if (!date) return '—';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(d);
};

export const formatDateShort = (date: string | Date): string => {
    if (!date) return '—';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(d);
};

export const formatNumber = (num: number): string => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return new Intl.NumberFormat('en-IN').format(num);
};

export const formatPercentage = (num: number): string => {
    if (num === undefined || num === null || isNaN(num)) return '0%';
    return `${num.toFixed(2)}%`;
};

export const formatTransactionType = (type: string): string => {
    const typeMap: Record<string, string> = {
        INTEREST_ACCRUAL: 'Interest Accrual',
        EMI_PAYMENT: 'EMI Payment',
        PRINCIPAL_PAYMENT: 'Principal Payment',
        INTEREST_PAYMENT: 'Interest Payment',
        FORECLOSURE: 'Foreclosure',
        PENALTY: 'Penalty',
        ADJUSTMENT: 'Adjustment',
        REVERSAL: 'Reversal',
        DISBURSEMENT: 'Disbursement',
        PROCESSING_FEE: 'Processing Fee',
        LATE_FEE: 'Late Fee',
    };
    return typeMap[type] || type;
};
