import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useTranslation } from '../context/I18nContext';
import {
  FileDown,
  Search,
  Filter,
  IndianRupee,
  TrendingUp,
  AlertCircle,
  TrendingDown,
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export const Reports: React.FC = () => {
  const { t } = useTranslation();
  // Filters
  const [loanTypes, setLoanTypes] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  const [filterForm, setFilterForm] = useState({
    loanTypeId: '',
    statusId: '',
    customerId: '',
    startDateFrom: '',
    startDateTo: '',
    minOutstanding: '',
    maxOutstanding: '',
  });

  const [reportData, setReportData] = useState<any>({
    stats: {
      totalDisbursed: 0,
      totalOutstandingPrincipal: 0,
      totalOutstandingInterest: 0,
      totalOutstanding: 0,
      activeCount: 0,
      pendingCount: 0,
      overdueCount: 0,
      totalCount: 0,
    },
    records: [],
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFilterOptions();
    fetchReport();
  }, []);

  const fetchFilterOptions = async () => {
    try {
      const res = await api.get('/settings/masters');
      setLoanTypes(res.data.loanTypes);
      setStatuses(res.data.statuses);
      
      const custRes = await api.get('/customers/search');
      setCustomers(custRes.data);
    } catch (err) {
      console.error('Error fetching filter dropdown details:', err);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filterForm).forEach(([key, val]) => {
        if (val) params.append(key, val);
      });

      const res = await api.get(`/reports/loans?${params.toString()}`);
      setReportData(res.data);
    } catch (err) {
      console.error('Error fetching reports data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReport();
  };

  const handleReset = () => {
    setFilterForm({
      loanTypeId: '',
      statusId: '',
      customerId: '',
      startDateFrom: '',
      startDateTo: '',
      minOutstanding: '',
      maxOutstanding: '',
    });
    // fetch default next tick
    setTimeout(() => fetchReport(), 50);
  };

  const handleExportCSV = () => {
    if (reportData.records.length === 0) return;

    // Build CSV content
    const headers = [
      'Loan ID',
      'Customer',
      'Contact',
      'Loan Type',
      'Amount Disbursed',
      'Interest Rate (%)',
      'Interest Type',
      'Tenure (Months)',
      'Outstanding Principal',
      'Outstanding Interest',
      'Disbursal Date',
      'Status',
    ];

    const rows = reportData.records.map((r: any) => [
      r.id,
      `"${r.customerName}"`,
      r.customerMobile,
      r.loanType,
      r.amount,
      r.interestRate,
      r.interestType,
      r.tenureMonths,
      r.outstandingPrincipal,
      r.outstandingInterest,
      new Date(r.startDate).toLocaleDateString(),
      r.status,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const encodedUri = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `LMS_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(encodedUri);
  };

  const getPdfUrl = () => {
    const params = new URLSearchParams();
    Object.entries(filterForm).forEach(([key, val]) => {
      if (val) params.append(key, val);
    });
    return `/api/reports/export-pdf?${params.toString()}`;
  };

  // Note: getPdfUrl returns a direct URL for download link href — keep /api prefix for browser navigation

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold font-display text-brand-navy dark:text-white">{t('reportsTitle')}</h2>
        <p className="text-xs text-gray-500 dark:text-brand-matte-text mt-0.5">{t('reportsSubtitle')}</p>
      </div>

      {/* Stats Summary Panel */}
      <div id="tour-reports-stats" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-brand-gold/10 text-brand-gold rounded-xl"><IndianRupee size={20} /></div>
          <div>
            <span className="text-[10px] text-gray-400 dark:text-brand-matte-text block font-bold uppercase tracking-wider">Total Disbursed Capital</span>
            <span className="text-lg font-bold text-brand-navy dark:text-white">{formatCurrency(reportData.stats.totalDisbursed)}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-brand-gold/10 text-brand-gold rounded-xl"><TrendingUp size={20} /></div>
          <div>
            <span className="text-[10px] text-gray-400 dark:text-brand-matte-text block font-bold uppercase tracking-wider">Total Principal Outstanding</span>
            <span className="text-lg font-bold text-brand-navy dark:text-white">{formatCurrency(reportData.stats.totalOutstandingPrincipal)}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-brand-gold/10 text-brand-gold rounded-xl"><TrendingDown size={20} /></div>
          <div>
            <span className="text-[10px] text-gray-400 dark:text-brand-matte-text block font-bold uppercase tracking-wider">Total Interest Outstanding</span>
            <span className="text-lg font-bold text-brand-navy dark:text-white">{formatCurrency(reportData.stats.totalOutstandingInterest)}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-red-500/10 text-red-500 rounded-xl"><AlertCircle size={20} /></div>
          <div>
            <span className="text-[10px] text-gray-400 dark:text-brand-matte-text block font-bold uppercase tracking-wider">Delinquent / Overdue Accounts</span>
            <span className="text-lg font-bold text-brand-navy dark:text-white">{reportData.stats.overdueCount}</span>
          </div>
        </div>
      </div>

      {/* Filter Form Card */}
      <div id="tour-reports-filters" className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-brand-matte-border pb-3">
          <Filter size={16} className="text-brand-gold" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-navy dark:text-white">Filter Parameters</h3>
        </div>

        <form onSubmit={handleFilterSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="report-loan-type" className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Loan Category</label>
              <select
                id="report-loan-type"
                title="Loan Category"
                value={filterForm.loanTypeId}
                onChange={(e) => setFilterForm((prev) => ({ ...prev, loanTypeId: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white outline-none"
              >
                <option value="">All Categories</option>
                {loanTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="report-status" className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Account Status</label>
              <select
                id="report-status"
                title="Account Status"
                value={filterForm.statusId}
                onChange={(e) => setFilterForm((prev) => ({ ...prev, statusId: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white outline-none"
              >
                <option value="">All Statuses</option>
                {statuses.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="report-customer" className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Customer Profile</label>
              <select
                id="report-customer"
                title="Customer Profile"
                value={filterForm.customerId}
                onChange={(e) => setFilterForm((prev) => ({ ...prev, customerId: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white outline-none"
              >
                <option value="">All Customers</option>
                {customers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="report-min-outstanding" className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Min Outstanding (₹)</label>
              <input
                id="report-min-outstanding"
                title="Min Outstanding"
                type="number"
                value={filterForm.minOutstanding}
                onChange={(e) => setFilterForm((prev) => ({ ...prev, minOutstanding: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="report-start-from" className="block text-[10px] uppercase font-bold text-gray-500 mb-1">StartDate From</label>
              <input
                id="report-start-from"
                title="StartDate From"
                type="date"
                value={filterForm.startDateFrom}
                onChange={(e) => setFilterForm((prev) => ({ ...prev, startDateFrom: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white outline-none"
              />
            </div>

            <div>
              <label htmlFor="report-start-to" className="block text-[10px] uppercase font-bold text-gray-500 mb-1">StartDate To</label>
              <input
                id="report-start-to"
                title="StartDate To"
                type="date"
                value={filterForm.startDateTo}
                onChange={(e) => setFilterForm((prev) => ({ ...prev, startDateTo: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white outline-none"
              />
            </div>

            <div className="lg:col-span-2 flex items-end gap-3 justify-end">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-brand-matte-card dark:hover:bg-black border border-gray-200 dark:border-brand-matte-border text-xs font-semibold rounded-lg text-gray-500 transition-all"
              >
                Reset
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-brand-gold hover:bg-brand-gold-light text-brand-navy font-bold text-xs rounded-lg shadow-md transition-all flex items-center gap-1.5"
              >
                <Search size={14} /> {t('searchBtn')}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Reports Table Display */}
      <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-brand-matte-border flex items-center justify-between flex-wrap gap-4 bg-gray-50 dark:bg-black/10">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-navy dark:text-white">Active Credit Records</h3>
            <p className="text-[10px] text-gray-400 dark:text-brand-matte-text mt-0.5">Found: {reportData.stats.totalCount} active loans matching selection.</p>
          </div>

          {reportData.records.length > 0 && (
            <div id="tour-reports-export" className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-brand-navy rounded-lg dark:bg-black dark:border-brand-matte-border dark:text-brand-gold dark:hover:bg-brand-matte-card transition-all"
              >
                <FileDown size={14} /> Export CSV
              </button>
              <a
                href={getPdfUrl()}
                download
                className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 bg-brand-gold hover:bg-brand-gold-light text-brand-navy rounded-lg transition-all"
              >
                <FileDown size={14} /> {t('exportPdf')}
              </a>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100 dark:bg-brand-matte-card text-brand-navy dark:text-brand-matte-text border-b border-gray-200 dark:border-brand-matte-border uppercase font-semibold">
                <th className="p-3">Loan ID</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Type</th>
                <th className="p-3 text-right">Principal Amount</th>
                <th className="p-3 text-right">Rate</th>
                <th className="p-3 text-right">Outstanding Principal</th>
                <th className="p-3 text-right">Outstanding Interest</th>
                <th className="p-3">Start Date</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-brand-matte-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-gray-500 dark:text-brand-matte-text animate-pulse">
                    Compiling filters and loading records...
                  </td>
                </tr>
              ) : reportData.records.length > 0 ? (
                reportData.records.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-black/30">
                    <td className="p-3 font-semibold">#{r.id}</td>
                    <td className="p-3 font-medium text-brand-navy dark:text-white">
                      <span>{r.customerName}</span>
                      <span className="block text-[10px] text-gray-500 dark:text-brand-matte-text font-normal">{r.customerMobile}</span>
                    </td>
                    <td className="p-3">{r.loanType}</td>
                    <td className="p-3 text-right font-mono font-semibold">{formatCurrency(r.amount)}</td>
                    <td className="p-3 text-right font-mono">{r.interestRate}% ({r.interestType})</td>
                    <td className="p-3 text-right font-mono font-bold text-brand-navy dark:text-white">{formatCurrency(r.outstandingPrincipal)}</td>
                    <td className="p-3 text-right font-mono text-brand-gold">{formatCurrency(r.outstandingInterest)}</td>
                    <td className="p-3">{new Date(r.startDate).toLocaleDateString()}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        r.statusCode === 'APPROVED' ? 'bg-green-500/10 text-green-500' :
                        r.statusCode === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-gray-400 dark:text-brand-matte-text">
                    No active loan records match filter variables.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
