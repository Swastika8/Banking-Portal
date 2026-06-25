import React from 'react';
import { Transaction } from '../../types/transaction';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { X, FileText } from 'lucide-react';

interface TransactionDetailProps {
    transaction: Transaction;
    onClose: () => void;
}

const TransactionDetail: React.FC<TransactionDetailProps> = ({ transaction, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-[#1a1a1a] border-b border-gray-800 p-4 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">Transaction Details</h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-gray-500">Transaction ID</p>
                            <p className="text-white font-medium">#{transaction.id}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Date</p>
                            <p className="text-white">{formatDate(transaction.transactionDate)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Type</p>
                            <p className="text-white">{transaction.transactionType?.name}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Category</p>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${transaction.transactionType?.category === 'DEBIT'
                                    ? 'bg-green-500/10 text-green-500'
                                    : transaction.transactionType?.category === 'CREDIT'
                                        ? 'bg-yellow-500/10 text-yellow-500'
                                        : 'bg-gray-500/10 text-gray-400'
                                }`}>
                                {transaction.transactionType?.category}
                            </span>
                        </div>
                    </div>

                    <div className="border-t border-gray-800 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-500">Amount</p>
                                <p className={`text-xl font-bold ${transaction.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {formatCurrency(transaction.amount)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Running Balance</p>
                                <p className="text-xl font-bold text-white">{formatCurrency(transaction.runningTotal)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-800 pt-4">
                        <p className="text-sm text-gray-500 mb-2">Impact Breakdown</p>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-[#0d0d0d] p-3 rounded-lg">
                                <p className="text-xs text-gray-500">Principal</p>
                                <p className="text-blue-400 font-medium">{formatCurrency(transaction.principalImpact)}</p>
                            </div>
                            <div className="bg-[#0d0d0d] p-3 rounded-lg">
                                <p className="text-xs text-gray-500">Interest</p>
                                <p className="text-purple-400 font-medium">{formatCurrency(transaction.interestImpact)}</p>
                            </div>
                            <div className="bg-[#0d0d0d] p-3 rounded-lg">
                                <p className="text-xs text-gray-500">Penalty</p>
                                <p className="text-red-400 font-medium">{formatCurrency(transaction.penaltyImpact)}</p>
                            </div>
                        </div>
                    </div>

                    {transaction.description && (
                        <div className="border-t border-gray-800 pt-4">
                            <p className="text-sm text-gray-500">Description</p>
                            <p className="text-gray-300">{transaction.description}</p>
                        </div>
                    )}

                    <div className="border-t border-gray-800 pt-4">
                        <div className="flex items-center gap-4">
                            <FileText className="w-4 h-4 text-gray-500" />
                            <p className="text-sm text-gray-500">
                                Created by {transaction.createdBy} • {formatDate(transaction.created_at)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TransactionDetail;