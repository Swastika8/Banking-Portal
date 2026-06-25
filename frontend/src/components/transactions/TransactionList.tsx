import React, { useState, useEffect } from 'react';
import { Transaction, TransactionSummary } from '../../types/transaction';
import { transactionService } from '../../services/transactionService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
    Download,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface TransactionListProps {
    loanId: number;
}

const TransactionList: React.FC<TransactionListProps> = ({ loanId }) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [summary, setSummary] = useState<TransactionSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({
        type: 'ALL',
        dateRange: 'ALL',
        category: 'ALL'
    });
    const [expandedTransaction, setExpandedTransaction] = useState<number | null>(null);

    useEffect(() => {
        fetchData();
    }, [loanId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [transactionsData, summaryData] = await Promise.all([
                transactionService.getLoanTransactions(loanId, {
                    type: filter.type,
                    category: filter.category,
                }),
                transactionService.getTransactionSummary(loanId)
            ]);
            setTransactions(transactionsData);
            setSummary(summaryData);
        } catch (error) {
            console.error('Error fetching transactions:', error);
            toast.error('Failed to load transactions');
        } finally {
            setLoading(false);
        }
    };

    const getTransactionIcon = (type: string) => {
        switch (type) {
            case 'INTEREST_ACCRUAL':
                return <AlertCircle className="w-4 h-4 text-yellow-500" />;
            case 'EMI_PAYMENT':
            case 'PRINCIPAL_PAYMENT':
            case 'INTEREST_PAYMENT':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'PENALTY':
            case 'LATE_FEE':
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            default:
                return <div className="w-4 h-4 rounded-full bg-gray-500" />;
        }
    };

    const getTransactionTypeColor = (category: string) => {
        switch (category) {
            case 'CREDIT':
                return 'text-yellow-500 bg-yellow-500/10';
            case 'DEBIT':
                return 'text-green-500 bg-green-500/10';
            default:
                return 'text-gray-500 bg-gray-500/10';
        }
    };

    const getAmountColor = (amount: number) => {
        if (amount > 0) return 'text-green-500';
        if (amount < 0) return 'text-red-500';
        return 'text-gray-500';
    };

    const handleExport = async (format: 'PDF' | 'CSV') => {
        try {
            const blob = await transactionService.exportTransactions(loanId, format);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `loan_${loanId}_transactions.${format.toLowerCase()}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success(`${format} exported`);
        } catch (error) {
            console.error('Export failed:', error);
            toast.error(`Failed to export ${format}`);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
                        <p className="text-sm text-gray-400">Total Debits</p>
                        <p className="text-xl font-bold text-green-500">{formatCurrency(summary.totalDebits)}</p>
                    </div>
                    <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
                        <p className="text-sm text-gray-400">Total Credits</p>
                        <p className="text-xl font-bold text-yellow-500">{formatCurrency(summary.totalCredits)}</p>
                    </div>
                    <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
                        <p className="text-sm text-gray-400">Principal Paid</p>
                        <p className="text-xl font-bold text-blue-400">{formatCurrency(summary.totalPrincipalPaid)}</p>
                    </div>
                    <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
                        <p className="text-sm text-gray-400">Interest Paid</p>
                        <p className="text-xl font-bold text-purple-400">{formatCurrency(summary.totalInterestPaid)}</p>
                    </div>
                    <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
                        <p className="text-sm text-gray-400">Penalties</p>
                        <p className="text-xl font-bold text-red-400">{formatCurrency(summary.totalPenalties)}</p>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 bg-[#1a1a1a] p-4 rounded-lg border border-gray-800">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                    value={filter.type}
                    onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                    className="bg-[#0d0d0d] text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
                >
                    <option value="ALL">All Types</option>
                    <option value="INTEREST_ACCRUAL">Interest Accrual</option>
                    <option value="EMI_PAYMENT">EMI Payment</option>
                    <option value="PRINCIPAL_PAYMENT">Principal Payment</option>
                    <option value="INTEREST_PAYMENT">Interest Payment</option>
                    <option value="FORECLOSURE">Foreclosure</option>
                    <option value="PENALTY">Penalty</option>
                    <option value="ADJUSTMENT">Adjustment</option>
                </select>

                <select
                    value={filter.category}
                    onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                    className="bg-[#0d0d0d] text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
                >
                    <option value="ALL">All Categories</option>
                    <option value="DEBIT">Debits</option>
                    <option value="CREDIT">Credits</option>
                </select>

                <button
                    onClick={() => fetchData()}
                    className="ml-auto flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>

                <button
                    onClick={() => handleExport('CSV')}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-700 hover:border-yellow-500 text-gray-300 hover:text-white rounded-lg transition-colors"
                >
                    <Download className="w-4 h-4" />
                    CSV
                </button>

                <button
                    onClick={() => handleExport('PDF')}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-700 hover:border-yellow-500 text-gray-300 hover:text-white rounded-lg transition-colors"
                >
                    <Download className="w-4 h-4" />
                    PDF
                </button>
            </div>

            {/* Transaction List */}
            <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-[#0d0d0d] border-b border-gray-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Description</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Principal</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Interest</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                                        No transactions found
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((transaction) => (
                                    <React.Fragment key={transaction.id}>
                                        <tr
                                            className="hover:bg-[#222] cursor-pointer transition-colors"
                                            onClick={() => setExpandedTransaction(
                                                expandedTransaction === transaction.id ? null : transaction.id
                                            )}
                                        >
                                            <td className="px-4 py-3 text-sm text-gray-300">
                                                {formatDate(transaction.transactionDate)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${getTransactionTypeColor(transaction.transactionType?.category || '')}`}>
                                                    {getTransactionIcon(transaction.transactionType?.code || '')}
                                                    {transaction.transactionType?.name || 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-400">
                                                {transaction.description || '—'}
                                            </td>
                                            <td className={`px-4 py-3 text-sm text-right font-medium ${getAmountColor(transaction.amount)}`}>
                                                {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-blue-400">
                                                {formatCurrency(transaction.principalImpact)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-purple-400">
                                                {formatCurrency(transaction.interestImpact)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-white font-medium">
                                                {formatCurrency(transaction.runningTotal)}
                                            </td>
                                        </tr>
                                        {expandedTransaction === transaction.id && (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-4 bg-[#0d0d0d] border-t border-gray-800">
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <div>
                                                            <p className="text-xs text-gray-500">Transaction ID</p>
                                                            <p className="text-sm text-gray-300">#{transaction.id}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500">Reference</p>
                                                            <p className="text-sm text-gray-300">
                                                                {transaction.referenceType && transaction.referenceId
                                                                    ? `${transaction.referenceType} #${transaction.referenceId}`
                                                                    : '—'}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500">Created By</p>
                                                            <p className="text-sm text-gray-300">{transaction.createdBy}</p>
                                                        </div>
                                                        {transaction.penaltyImpact !== 0 && (
                                                            <div>
                                                                <p className="text-xs text-gray-500">Penalty Impact</p>
                                                                <p className="text-sm text-red-400">{formatCurrency(transaction.penaltyImpact)}</p>
                                                            </div>
                                                        )}
                                                        {transaction.feeImpact !== 0 && (
                                                            <div>
                                                                <p className="text-xs text-gray-500">Fee Impact</p>
                                                                <p className="text-sm text-orange-400">{formatCurrency(transaction.feeImpact)}</p>
                                                            </div>
                                                        )}
                                                        {transaction.id > 0 && (
                                                        <div className="col-span-3">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (confirm('Are you sure you want to reverse this transaction?')) {
                                                                        transactionService.reverseTransaction(transaction.id, 'Manual reversal')
                                                                            .then(() => {
                                                                                toast.success('Transaction reversed');
                                                                                fetchData();
                                                                            })
                                                                            .catch((error) => {
                                                                                toast.error('Failed to reverse transaction');
                                                                                console.error(error);
                                                                            });
                                                                    }
                                                                }}
                                                                className="text-sm text-red-400 hover:text-red-300 transition-colors"
                                                            >
                                                                Reverse Transaction
                                                            </button>
                                                        </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination (if needed) */}
            <div className="flex items-center justify-between text-sm text-gray-400">
                <p>Showing {transactions.length} transactions</p>
                <div className="flex gap-2">
                    <button className="px-3 py-1 border border-gray-700 rounded hover:border-yellow-500 transition-colors">
                        Previous
                    </button>
                    <button className="px-3 py-1 border border-gray-700 rounded hover:border-yellow-500 transition-colors">
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TransactionList;
