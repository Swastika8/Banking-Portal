import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { Search, Phone, Mail, MapPin, Briefcase, ChevronRight, Users, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

export const Customers: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCustomers('');
  }, []);

  const fetchCustomers = async (query: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/customers/search?query=${encodeURIComponent(query)}`);
      setCustomersList(res.data);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    fetchCustomers(val);
  };

  const getRiskBadge = (level: string) => {
    if (level === 'HIGH') return 'bg-red-500/10 text-red-500 ring-1 ring-red-500/30';
    if (level === 'MEDIUM') return 'bg-yellow-500/10 text-yellow-500 ring-1 ring-yellow-500/30';
    return 'bg-green-500/10 text-green-500 ring-1 ring-green-500/30';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-brand-navy dark:text-white flex items-center gap-2">
            <Users size={22} className="text-brand-gold" />
            Customer Directory
          </h1>
          <p className="text-xs text-gray-400 dark:text-brand-matte-text mt-0.5">
            {loading ? 'Loading...' : `${customersList.length} customer${customersList.length !== 1 ? 's' : ''} registered`}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative w-full max-w-lg">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
          <Search size={16} />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search by ID, Name, Mobile, or Email..."
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border text-sm text-brand-navy dark:text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-gold shadow-sm transition-all"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-gray-400 dark:text-brand-matte-text text-sm">
            Loading customers...
          </div>
        ) : customersList.length === 0 ? (
          <div className="p-16 text-center text-gray-400 dark:text-brand-matte-text text-sm">
            No customers found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-black/20 border-b border-gray-200 dark:border-brand-matte-border text-[10px] uppercase font-bold text-gray-500 dark:text-brand-matte-text tracking-wider">
                  <th className="px-5 py-3">ID</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3">Occupation</th>
                  <th className="px-5 py-3">Risk</th>
                  <th className="px-5 py-3 text-center">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-brand-matte-border">
                {customersList.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 dark:hover:bg-black/30 transition-all cursor-pointer"
                    onClick={() => navigate('/', { state: { customerId: c.id } })}
                  >
                    <td className="px-5 py-3.5 font-mono font-bold text-brand-gold text-[11px]">
                      #{c.id}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-navy dark:bg-black text-brand-gold border border-brand-gold/20 flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-semibold text-brand-navy dark:text-white block">{c.name}</span>
                          {c.kycNumber && (
                            <span className="text-[10px] text-gray-400 block">
                              {c.kycInfo?.type || 'KYC'}: {c.kycNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                          <Phone size={10} className="text-brand-gold flex-shrink-0" />
                          <span>{c.mobile}</span>
                        </div>
                        {c.email && (
                          <div className="flex items-center gap-1 text-gray-400">
                            <Mail size={10} className="flex-shrink-0" />
                            <span className="truncate max-w-[140px]">{c.email}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">
                      {c.address ? (
                        <div className="flex items-center gap-1">
                          <MapPin size={10} className="text-brand-gold flex-shrink-0" />
                          <span className="truncate max-w-[120px]">{c.address}</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">
                      {c.occupation ? (
                        <div className="flex items-center gap-1">
                          <Briefcase size={10} className="text-brand-gold flex-shrink-0" />
                          <span>{c.occupation}</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {c.riskLevel ? (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${getRiskBadge(c.riskLevel)}`}>
                          {c.riskLevel}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600 text-[10px]">Unscored</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate('/', { state: { customerId: c.id } }); }}
                        className="p-1.5 text-brand-gold hover:bg-brand-gold/10 rounded-lg transition-all"
                        title="Open in Dashboard"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};