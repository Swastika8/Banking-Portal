import { useState } from 'react';
import TransactionList from '../components/transactions/TransactionList';
// ... other imports

const LoanWorkspace = () => {
    const [activeTab, setActiveTab] = useState('details');
    const loanId = 1; // Get from route or context

    // ... existing code

    return (
        <div className="p-6">
            {/* Loan Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white">Loan #{loanId}</h2>
                {/* ... */}
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-800 mb-6">
                <nav className="flex gap-6">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`pb-2 px-1 text-sm font-medium transition-colors ${activeTab === 'details'
                                ? 'text-yellow-500 border-b-2 border-yellow-500'
                                : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        Details
                    </button>
                    <button
                        onClick={() => setActiveTab('payments')}
                        className={`pb-2 px-1 text-sm font-medium transition-colors ${activeTab === 'payments'
                                ? 'text-yellow-500 border-b-2 border-yellow-500'
                                : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        Payments
                    </button>
                    <button
                        onClick={() => setActiveTab('transactions')}
                        className={`pb-2 px-1 text-sm font-medium transition-colors ${activeTab === 'transactions'
                                ? 'text-yellow-500 border-b-2 border-yellow-500'
                                : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        Transactions
                    </button>
                    <button
                        onClick={() => setActiveTab('timeline')}
                        className={`pb-2 px-1 text-sm font-medium transition-colors ${activeTab === 'timeline'
                                ? 'text-yellow-500 border-b-2 border-yellow-500'
                                : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        Timeline
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
                {activeTab === 'details' && (
                    <div> {/* Loan Details */} </div>
                )}
                {activeTab === 'payments' && (
                    <div> {/* Payment List */} </div>
                )}
                {activeTab === 'transactions' && (
                    <TransactionList loanId={loanId} />
                )}
                {activeTab === 'timeline' && (
                    <div> {/* Timeline */} </div>
                )}
            </div>
        </div>
    );
};

export default LoanWorkspace;