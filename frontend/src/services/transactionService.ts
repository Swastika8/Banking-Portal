import api from '../utils/api';
import { Transaction, TransactionSummary, TransactionType } from '../types/transaction';

export const transactionService = {
    // Get all transactions for a loan
    getLoanTransactions: async (loanId: number, params?: any): Promise<Transaction[]> => {
        const response = await api.get(`/transactions/loans/${loanId}`, { params });
        return response.data;
    },

    // Get transaction summary for a loan
    getTransactionSummary: async (loanId: number): Promise<TransactionSummary> => {
        const response = await api.get(`/transactions/loans/${loanId}/summary`);
        return response.data;
    },

    // Get transaction types
    getTransactionTypes: async (): Promise<TransactionType[]> => {
        const response = await api.get('/transactions/types');
        return response.data;
    },

    // Reverse a transaction
    reverseTransaction: async (transactionId: number, reason: string): Promise<Transaction> => {
        const response = await api.post(`/transactions/${transactionId}/reverse`, { reason });
        return response.data;
    },

    // Export transactions
    exportTransactions: async (loanId: number, format: 'PDF' | 'EXCEL' | 'CSV'): Promise<Blob> => {
        const response = await api.get(`/transactions/loans/${loanId}/export`, {
            params: { format },
            responseType: 'blob',
        });
        return response.data;
    },
};