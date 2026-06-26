import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Plus, Trash2, Edit3, Play, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { useTour } from '../context/TourContext';

export const Masters: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'settings' | 'loantypes' | 'rbac' | 'audits' | 'formulas' | 'restore'>('settings');

  const { runTour, stepIndex, steps } = useTour();

  // Sync activeTab with active tour step target selector
  useEffect(() => {
    if (runTour && steps[stepIndex]) {
      const target = steps[stepIndex].target;
      if (target === '#tour-settings-tab') {
        setActiveTab('settings');
      } else if (target === '#tour-loantypes-tab') {
        setActiveTab('loantypes');
      } else if (target === '#tour-rbac-tab') {
        setActiveTab('rbac');
      } else if (target === '#tour-audits-tab') {
        setActiveTab('audits');
      } else if (target === '#tour-formulas-tab') {
        setActiveTab('formulas');
      } else if (target === '#tour-restore-tab') {
        setActiveTab('restore');
      }
    }
  }, [runTour, stepIndex, steps]);

  // Master lookup options
  const [settings, setSettings] = useState<any[]>([]);
  const [loanTypes, setLoanTypes] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [deletedRecords, setDeletedRecords] = useState<any[]>([]);

  // RBAC selection
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [rolePermIds, setRolePermIds] = useState<number[]>([]);

  // Form states
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeForm, setNewTypeForm] = useState({ name: '', description: '' });
  const [editingType, setEditingType] = useState<any | null>(null);

  // Formulas state
  const [formulas, setFormulas] = useState<any[]>([]);
  const [showAddFormula, setShowAddFormula] = useState(false);
  const [editingFormula, setEditingFormula] = useState<any | null>(null);
  const [newFormulaForm, setNewFormulaForm] = useState({
    name: '',
    description: '',
    expression: '',
    category: 'GENERAL',
  });
  const [formulaVariablesText, setFormulaVariablesText] = useState('');

  // Sandbox variables and simulation
  const [sandboxFormula, setSandboxFormula] = useState<any | null>(null);
  const [sandboxInputs, setSandboxInputs] = useState<Record<string, string>>({});
  const [sandboxResult, setSandboxResult] = useState<any>(null);
  const [sandboxError, setSandboxError] = useState<string | null>(null);

  useEffect(() => {
    fetchMastersData();
  }, []);

  useEffect(() => {
    if (selectedRoleId) {
      const selectedRole = roles.find((r) => r.id === selectedRoleId);
      if (selectedRole) {
        setRolePermIds(selectedRole.permissions.map((p: any) => p.permissionId));
      }
    }
  }, [selectedRoleId, roles]);

  const fetchFormulas = async () => {
    try {
      const res = await api.get('/formulas');
      setFormulas(res.data);
    } catch (err) {
      console.error('Error fetching formulas:', err);
    }
  };

  const fetchMastersData = async () => {
    try {
      const settingsRes = await api.get('/settings/system');
      setSettings(settingsRes.data);

      const mastersRes = await api.get('/settings/masters');
      setLoanTypes(mastersRes.data.loanTypes);
      setRoles(mastersRes.data.roles);
      setPermissions(mastersRes.data.permissions);

      if (mastersRes.data.roles[0]) {
        setSelectedRoleId(mastersRes.data.roles[0].id);
      }

      const auditRes = await api.get('/settings/audit-logs');
      setAuditLogs(auditRes.data);

      const deletedRes = await api.get('/settings/deleted-records');
      setDeletedRecords(deletedRes.data);

      await fetchFormulas();
    } catch (err) {
      console.error('Error fetching admin masters:', err);
    }
  };

  // ── Formula Handlers ───────────────────────────────────────────

  const parseVariables = (str: string) => {
    if (!str.trim()) return [];
    return str.split(',').map(part => {
      const bits = part.split(':');
      return {
        name: bits[0]?.trim() || '',
        description: bits[1]?.trim() || bits[0]?.trim() || '',
        unit: bits[2]?.trim() || '',
      };
    }).filter(v => v.name);
  };

  const formatVariables = (vars: any[]) => {
    if (!vars || !Array.isArray(vars)) return '';
    return vars.map(v => `${v.name}:${v.description}:${v.unit}`).join(', ');
  };

  const handleCreateFormula = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedVars = parseVariables(formulaVariablesText);
    try {
      if (editingFormula) {
        await api.put(`/formulas/${editingFormula.id}`, {
          ...newFormulaForm,
          variables: parsedVars,
        });
      } else {
        await api.post('/formulas', {
          ...newFormulaForm,
          variables: parsedVars,
        });
      }
      setNewFormulaForm({ name: '', description: '', expression: '', category: 'GENERAL' });
      setFormulaVariablesText('');
      setEditingFormula(null);
      setShowAddFormula(false);
      fetchFormulas();
      fetchMastersData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error processing formula.');
    }
  };

  const handleDeleteFormula = async (id: number) => {
    if (!window.confirm('Soft-delete this formula rule?')) return;
    try {
      await api.delete(`/formulas/${id}`);
      fetchFormulas();
      fetchMastersData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error deleting formula.');
    }
  };

  const handleActivateFormula = async (id: number) => {
    try {
      await api.post(`/formulas/${id}/activate`);
      fetchFormulas();
      fetchMastersData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error activating formula.');
    }
  };

  const handleDeactivateFormula = async (id: number) => {
    try {
      await api.post(`/formulas/${id}/deactivate`);
      fetchFormulas();
      fetchMastersData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error deactivating formula.');
    }
  };

  const handleRunSandbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxFormula) return;
    setSandboxResult(null);
    setSandboxError(null);

    // Construct variables object: convert input strings to numbers
    const varsObj: Record<string, number> = {};
    for (const v of sandboxFormula.variables) {
      const valStr = sandboxInputs[v.name] || '0';
      varsObj[v.name] = parseFloat(valStr);
    }

    try {
      const res = await api.post('/formulas/test', {
        expression: sandboxFormula.expression,
        variables: varsObj,
      });
      setSandboxResult(res.data.result);
    } catch (err: any) {
      setSandboxError(err.response?.data?.message || 'Calculation failed.');
    }
  };

  const handleToggleSetting = async (id: number, currentValue: string) => {
    const newValue = currentValue === 'true' ? 'false' : 'true';
    try {
      await api.put('/settings/system', {
        settings: [{ id, value: newValue }],
      });
      fetchMastersData();
    } catch {
      alert('Error updating system setting.');
    }
  };

  const handleCreateLoanType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingType) {
        await api.put(`/settings/loan-type/${editingType.id}`, newTypeForm);
      } else {
        await api.post('/settings/loan-type', newTypeForm);
      }
      setNewTypeForm({ name: '', description: '' });
      setEditingType(null);
      setShowAddType(false);
      fetchMastersData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error processing loan type master.');
    }
  };

  const handleDeleteLoanType = async (id: number) => {
    if (!window.confirm('Soft-delete this loan category master?')) return;
    try {
      await api.delete(`/settings/loan-type/${id}`);
      fetchMastersData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error deleting loan type.');
    }
  };

  const handleRolePermCheckbox = (permId: number) => {
    if (rolePermIds.includes(permId)) {
      setRolePermIds(rolePermIds.filter((id) => id !== permId));
    } else {
      setRolePermIds([...rolePermIds, permId]);
    }
  };

  const handleSaveRBAC = async () => {
    if (!selectedRoleId) return;
    try {
      await api.put('/settings/role-permissions', {
        roleId: selectedRoleId,
        permissionIds: rolePermIds,
      });
      alert('RBAC permission maps updated successfully.');
      fetchMastersData();
    } catch {
      alert('Failed to update mappings.');
    }
  };

  const handleRestoreDeletedRecord = async (record: any) => {
    if (!window.confirm(`Restore ${record.title}?`)) return;
    try {
      await api.post('/settings/restore-deleted', {
        entityType: record.entityType,
        id: record.id,
      });
      fetchMastersData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error restoring record.');
    }
  };

  const handlePermanentDeleteRecord = async (record: any) => {
    if (!window.confirm(`Permanently delete ${record.title}? This cannot be undone.`)) return;
    try {
      await api.delete('/settings/deleted-records/permanent', {
        data: {
          entityType: record.entityType,
          id: record.id,
        },
      });
      fetchMastersData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error permanently deleting record.');
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold font-display text-brand-navy dark:text-white">Masters Data & Admin parameters</h2>
        <p className="text-xs text-gray-500 dark:text-brand-matte-text mt-0.5">Configure access maps, change global logic variables, customize loan models, and review system audit records.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-brand-matte-border gap-2">
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'settings'
              ? 'border-brand-gold text-brand-gold font-bold'
              : 'border-transparent text-gray-500 dark:text-brand-matte-text hover:text-brand-navy'
          }`}
        >
          System Settings
        </button>
        <button
          onClick={() => setActiveTab('loantypes')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'loantypes'
              ? 'border-brand-gold text-brand-gold font-bold'
              : 'border-transparent text-gray-500 dark:text-brand-matte-text hover:text-brand-navy'
          }`}
        >
          Loan Categories Customizer
        </button>
        <button
          onClick={() => setActiveTab('rbac')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'rbac'
              ? 'border-brand-gold text-brand-gold font-bold'
              : 'border-transparent text-gray-500 dark:text-brand-matte-text hover:text-brand-navy'
          }`}
        >
          Role Permissions (RBAC)
        </button>
        <button
          onClick={() => setActiveTab('audits')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'audits'
              ? 'border-brand-gold text-brand-gold font-bold'
              : 'border-transparent text-gray-500 dark:text-brand-matte-text hover:text-brand-navy'
          }`}
        >
          Audit Ledger History
        </button>
        <button
          onClick={() => setActiveTab('formulas')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'formulas'
              ? 'border-brand-gold text-brand-gold font-bold'
              : 'border-transparent text-gray-500 dark:text-brand-matte-text hover:text-brand-navy'
          }`}
        >
          Formula Rules Engine
        </button>
        <button
          onClick={() => setActiveTab('restore')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'restore'
              ? 'border-brand-gold text-brand-gold font-bold'
              : 'border-transparent text-gray-500 dark:text-brand-matte-text hover:text-brand-navy'
          }`}
        >
          Restore Deleted
        </button>
      </div>

      {/* Content Area */}
      <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-6 rounded-2xl shadow-sm">

        {/* Tab 1: System Settings */}
        {activeTab === 'settings' && (
          <div id="tour-settings-tab" className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-navy dark:text-white mb-4">System Settings Parameters</h3>
            <div className="divide-y divide-gray-100 dark:divide-brand-matte-border">
              {settings.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-4">
                  <div className="pr-4">
                    <span className="font-bold text-xs uppercase tracking-wider font-display text-brand-navy dark:text-brand-gold block">{item.key.replace(/_/g, ' ')}</span>
                    <span className="text-[11px] text-gray-500 dark:text-brand-matte-text block mt-0.5">{item.description}</span>
                  </div>

                  <button
                    onClick={() => handleToggleSetting(item.id, item.value)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                      item.value === 'true' ? 'bg-brand-gold' : 'bg-gray-200 dark:bg-black'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        item.value === 'true' ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Loan Types Customizer */}
        {activeTab === 'loantypes' && (
          <div id="tour-loantypes-tab" className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-brand-matte-border pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-navy dark:text-white">Custom Loan Categories</h3>
              {!showAddType && (
                <button
                  onClick={() => { setEditingType(null); setNewTypeForm({ name: '', description: '' }); setShowAddType(true); }}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 bg-brand-gold text-brand-navy font-bold rounded-lg hover:bg-brand-gold-light transition-all"
                >
                  <Plus size={14} /> Add Loan Type
                </button>
              )}
            </div>

            {showAddType && (
              <form onSubmit={handleCreateLoanType} className="bg-gray-50 dark:bg-black/30 p-4 border border-brand-gold/20 rounded-xl space-y-3">
                <span className="block text-xs font-bold text-brand-gold uppercase tracking-wider">
                  {editingType ? 'Modify Loan Category' : 'Register New Loan Category'}
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Category Name *</label>
                    <input
                      type="text"
                      required
                      value={newTypeForm.name}
                      onChange={(e) => setNewTypeForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white outline-none focus:ring-1 focus:ring-brand-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Description</label>
                    <input
                      type="text"
                      value={newTypeForm.description}
                      onChange={(e) => setNewTypeForm((prev) => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white outline-none focus:ring-1 focus:ring-brand-gold"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddType(false)}
                    className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-[11px] font-semibold text-gray-500 rounded-lg dark:bg-brand-matte-card"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-brand-gold text-brand-navy hover:bg-brand-gold-light text-[11px] font-bold rounded-lg"
                  >
                    {editingType ? 'Save Modifications' : 'Disburse Category'}
                  </button>
                </div>
              </form>
            )}

            <div className="divide-y divide-gray-100 dark:divide-brand-matte-border">
              {loanTypes.map((type) => (
                <div key={type.id} className="flex items-center justify-between py-3">
                  <div>
                    <span className="font-bold text-xs uppercase text-brand-navy dark:text-white block">{type.name}</span>
                    <span className="text-[11px] text-gray-400 dark:text-brand-matte-text block mt-0.5">{type.description || 'No description provided.'}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingType(type);
                        setNewTypeForm({ name: type.name, description: type.description || '' });
                        setShowAddType(true);
                      }}
                      className="p-1.5 text-brand-gold hover:bg-brand-gold/10 rounded-lg"
                      title="Edit Category Name"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteLoanType(type.id)}
                      className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg"
                      title="Soft Delete Category"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: RBAC Mapping */}
        {activeTab === 'rbac' && (
          <div id="tour-rbac-tab" className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-navy dark:text-white mb-4">RBAC Role Permissions Map</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Left sidebar select role */}
              <div className="border-r border-gray-200 dark:border-brand-matte-border space-y-1">
                <span className="block text-[10px] uppercase font-bold text-gray-400 mb-2">Select User Role</span>
                {roles.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRoleId(r.id)}
                    className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                      selectedRoleId === r.id
                        ? 'bg-brand-gold/10 text-brand-gold'
                        : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-black/40'
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>

              {/* Right list permissions checkboxes */}
              <div className="md:col-span-3 space-y-4 pl-0 md:pl-4">
                <span className="block text-[10px] uppercase font-bold text-gray-400">Map System Privileges</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-2">
                  {permissions.map((perm) => (
                    <label
                      key={perm.id}
                      className="flex items-center gap-2.5 p-2 bg-gray-50 dark:bg-black/30 border border-gray-100 dark:border-brand-matte-border rounded-lg text-xs cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-black/60"
                    >
                      <input
                        type="checkbox"
                        checked={rolePermIds.includes(perm.id)}
                        onChange={() => handleRolePermCheckbox(perm.id)}
                        className="rounded accent-brand-gold"
                      />
                      <div>
                        <span className="font-semibold block text-brand-navy dark:text-white">{perm.name}</span>
                        <span className="text-[10px] text-gray-400 block">{perm.description}</span>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-brand-matte-border flex justify-end">
                  <button
                    onClick={handleSaveRBAC}
                    className="px-5 py-2 bg-brand-gold text-brand-navy hover:bg-brand-gold-light font-bold text-xs rounded-lg shadow-md transition-all"
                  >
                    Save RBAC Mappings
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Audit Trails */}
        {activeTab === 'audits' && (
          <div id="tour-audits-tab" className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-navy dark:text-white mb-4">Enterprise System Auditing Records</h3>
            
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left border-collapse text-[10px]">
                <thead>
                  <tr className="bg-gray-100 dark:bg-brand-matte-card text-brand-navy dark:text-brand-matte-text border-b border-gray-200 dark:border-brand-matte-border uppercase font-semibold">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Auditor Account</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Module</th>
                    <th className="p-3">Original Values (Old)</th>
                    <th className="p-3">Disbursed Values (New)</th>
                    <th className="p-3">Metadata Info</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-brand-matte-border font-mono">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-black/30">
                      <td className="p-3 whitespace-nowrap text-gray-500">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="p-3 font-semibold text-brand-navy dark:text-white">{log.user?.name || 'SYSTEM'} ({log.user?.email || 'SYSTEM'})</td>
                      <td className="p-3 font-bold text-brand-gold uppercase">{log.action}</td>
                      <td className="p-3">{log.module}</td>
                      <td className="p-3 max-w-xs truncate text-gray-500" title={log.oldValue || ''}>{log.oldValue || 'N/A'}</td>
                      <td className="p-3 max-w-xs truncate text-brand-gold" title={log.newValue || ''}>{log.newValue || 'N/A'}</td>
                      <td className="p-3 whitespace-nowrap text-gray-500">IP: {log.ipAddress || 'Local'}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-gray-400 dark:text-brand-matte-text">
                        No audit records indexed.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Dynamic Formulas Engine */}
        {activeTab === 'formulas' && (
          <div id="tour-formulas-tab" className="space-y-6">
            {/* Header / Add button */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-brand-matte-border pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-navy dark:text-white">Dynamic Calculation Formulas</h3>
                <p className="text-[11px] text-gray-500 dark:text-brand-matte-text mt-0.5">Define business calculations for EMI, Interest, Collateral appraisals, Risk, or LTV caps.</p>
              </div>
              {!showAddFormula && (
                <button
                  onClick={() => {
                    setEditingFormula(null);
                    setNewFormulaForm({ name: '', description: '', expression: '', category: 'GENERAL' });
                    setFormulaVariablesText('');
                    setShowAddFormula(true);
                  }}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 bg-brand-gold text-brand-navy font-bold rounded-lg hover:bg-brand-gold-light transition-all"
                >
                  <Plus size={14} /> Add Formula
                </button>
              )}
            </div>

            {/* Add / Edit Formula Form */}
            {showAddFormula && (
              <form onSubmit={handleCreateFormula} className="bg-gray-50 dark:bg-black/30 p-5 border border-brand-gold/20 rounded-xl space-y-4">
                <span className="block text-xs font-bold text-brand-gold uppercase tracking-wider">
                  {editingFormula ? `Edit Formula (v${editingFormula.version})` : 'Register New Custom Formula'}
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Formula Name *</label>
                    <input
                      type="text"
                      required
                      value={newFormulaForm.name}
                      onChange={(e) => setNewFormulaForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white outline-none focus:ring-1 focus:ring-brand-gold"
                      placeholder="e.g. Gold Valuation Rule"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Category *</label>
                    <select
                      value={newFormulaForm.category}
                      onChange={(e) => setNewFormulaForm((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white outline-none focus:ring-1 focus:ring-brand-gold"
                    >
                      <option value="GENERAL">General</option>
                      <option value="COLLATERAL">Collateral Appraisal</option>
                      <option value="ELIGIBILITY">Loan Eligibility</option>
                      <option value="INTEREST">Interest Accrual</option>
                      <option value="EMI">EMI Repayments</option>
                      <option value="PENALTY">Late Fee / Penalty</option>
                      <option value="RISK">Risk Score Composite</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Math Expression *</label>
                    <input
                      type="text"
                      required
                      value={newFormulaForm.expression}
                      onChange={(e) => setNewFormulaForm((prev) => ({ ...prev, expression: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white outline-none focus:ring-1 focus:ring-brand-gold font-mono"
                      placeholder="e.g. weight * marketRate * purityRatio"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Description / Rationale</label>
                  <input
                    type="text"
                    value={newFormulaForm.description}
                    onChange={(e) => setNewFormulaForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white outline-none focus:ring-1 focus:ring-brand-gold"
                    placeholder="Enter business logic details or instructions"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                    Variables Definitions Metadata (name:description:unit, separated by commas)
                  </label>
                  <textarea
                    value={formulaVariablesText}
                    onChange={(e) => setFormulaVariablesText(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white outline-none focus:ring-1 focus:ring-brand-gold font-mono"
                    rows={2}
                    placeholder="e.g. weight:Weight of Gold:g, marketRate:Market Rate:₹/g, purityRatio:Purity Factor:ratio"
                  />
                  <span className="text-[9px] text-gray-400 block mt-1">
                    Specify variables as `name:description:unit` separated by commas. Example: `weight:Weight in grams:g, marketRate:Current Market Rate:₹/g`
                  </span>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddFormula(false)}
                    className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-[11px] font-semibold text-gray-500 rounded-lg dark:bg-brand-matte-card"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-brand-gold text-brand-navy hover:bg-brand-gold-light text-[11px] font-bold rounded-lg"
                  >
                    {editingFormula ? 'Save modifications' : 'Register Formula'}
                  </button>
                </div>
              </form>
            )}

            {/* Split Layout: Left is list, Right is Sandbox */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Formula List */}
              <div className="lg:col-span-2 space-y-4">
                <span className="block text-[10px] uppercase font-bold text-gray-400">Available Systems Rules Formulas</span>
                
                <div className="space-y-3">
                  {formulas.map((formula) => (
                    <div 
                      key={formula.id} 
                      className={`p-4 border rounded-xl bg-white dark:bg-black/20 hover:border-brand-gold/40 transition-all ${
                        sandboxFormula?.id === formula.id ? 'border-brand-gold shadow-md' : 'border-gray-200 dark:border-brand-matte-border'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs uppercase text-brand-navy dark:text-white">{formula.name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-brand-matte-card text-gray-500 font-semibold font-mono">
                              v{formula.version}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-gold/10 text-brand-gold font-semibold uppercase tracking-wider">
                              {formula.category}
                            </span>
                          </div>
                          <span className="text-[11px] text-gray-400 dark:text-brand-matte-text block mt-0.5">{formula.description || 'No description provided.'}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSandboxFormula(formula);
                              // Initialize sandbox inputs with empty strings
                              const inputs: Record<string, string> = {};
                              formula.variables?.forEach((v: any) => {
                                inputs[v.name] = '';
                              });
                              setSandboxInputs(inputs);
                              setSandboxResult(null);
                              setSandboxError(null);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 text-[10px] font-bold rounded transition-all"
                            title="Open in Sandbox"
                          >
                            <Play size={10} /> Test Rule
                          </button>

                          {formula.isActive ? (
                            <button
                              onClick={() => handleDeactivateFormula(formula.id)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-green-600/10 hover:bg-green-600/20 text-green-500 text-[10px] font-bold rounded transition-all"
                              title="Active. Click to Deactivate"
                            >
                              <CheckCircle2 size={10} /> Active
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActivateFormula(formula.id)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-brand-matte-card dark:hover:bg-black/60 text-gray-400 text-[10px] font-bold rounded transition-all"
                              title="Inactive. Click to Activate"
                            >
                              <XCircle size={10} /> Inactive
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setEditingFormula(formula);
                              setNewFormulaForm({
                                name: formula.name,
                                description: formula.description || '',
                                expression: formula.expression,
                                category: formula.category,
                              });
                              setFormulaVariablesText(formatVariables(formula.variables));
                              setShowAddFormula(true);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="p-1 text-brand-gold hover:bg-brand-gold/10 rounded"
                            title="Edit Formula"
                          >
                            <Edit3 size={12} />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteFormula(formula.id)}
                            className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                            title="Delete Formula"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 p-2 bg-gray-50 dark:bg-black/30 rounded border border-gray-100 dark:border-brand-matte-border flex items-center justify-between text-[11px] font-mono">
                        <span className="text-gray-400">Expression:</span>
                        <span className="text-brand-gold font-bold">{formula.expression}</span>
                      </div>

                      {formula.variables && formula.variables.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {formula.variables.map((v: any, idx: number) => (
                            <span 
                              key={idx} 
                              className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 dark:border-brand-matte-border text-gray-500 dark:text-brand-matte-text"
                              title={v.description}
                            >
                              {v.name} {v.unit ? `(${v.unit})` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {formulas.length === 0 && (
                    <div className="p-8 text-center border border-dashed border-gray-200 dark:border-brand-matte-border rounded-xl text-gray-400">
                      No formula rules registered. Add one to customize system logic.
                    </div>
                  )}
                </div>
              </div>

              {/* Sandbox Tester panel */}
              <div className="bg-gray-50 dark:bg-black/20 p-5 rounded-2xl border border-gray-200 dark:border-brand-matte-border h-fit space-y-4">
                <div className="border-b border-gray-200 dark:border-brand-matte-border pb-3">
                  <span className="block text-xs font-bold text-brand-navy dark:text-white uppercase tracking-wider">
                    Formula Sandbox Simulation
                  </span>
                  <span className="text-[10px] text-gray-400 block mt-0.5">
                    Select a formula and test variables calculations instantly.
                  </span>
                </div>

                {sandboxFormula ? (
                  <form onSubmit={handleRunSandbox} className="space-y-4 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Tested Rule</span>
                      <span className="font-semibold block text-brand-navy dark:text-white">{sandboxFormula.name}</span>
                      <span className="font-mono text-brand-gold text-[10px] block mt-0.5">{sandboxFormula.expression}</span>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-brand-matte-border">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Variables Inputs</span>
                      {sandboxFormula.variables?.map((v: any, idx: number) => (
                        <div key={idx} className="space-y-1">
                          <label className="flex items-center justify-between font-bold text-[10px] text-gray-500">
                            <span>{v.name} {v.unit ? `(${v.unit})` : ''}</span>
                            <span className="font-normal text-[9px] text-gray-400 italic">{v.description}</span>
                          </label>
                          <input
                            type="number"
                            step="any"
                            required
                            value={sandboxInputs[v.name] ?? ''}
                            onChange={(e) => setSandboxInputs(prev => ({ ...prev, [v.name]: e.target.value }))}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-black border border-gray-200 dark:border-brand-matte-border text-brand-navy dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-gold"
                            placeholder={`e.g. 0`}
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-brand-gold text-brand-navy hover:bg-brand-gold-light font-bold rounded-lg text-xs tracking-wider transition-all"
                    >
                      Run Simulation Compute
                    </button>

                    {sandboxResult !== null && (
                      <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg space-y-1 mt-2">
                        <span className="block text-[9px] uppercase font-bold text-green-500">Result Output</span>
                        <span className="text-xl font-bold font-mono text-green-600 block">{sandboxResult}</span>
                      </div>
                    )}

                    {sandboxError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg mt-2 text-[10px] text-red-500 font-mono">
                        Error: {sandboxError}
                      </div>
                    )}
                  </form>
                ) : (
                  <div className="p-8 text-center text-gray-400 text-xs">
                    No formula currently selected for sandbox testing. Click "Test Rule" on any formula to begin simulation.
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Tab 6: Restore Deleted Records */}
        {activeTab === 'restore' && (
          <div id="tour-restore-tab" className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-brand-matte-border pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-navy dark:text-white">Restore / Permanently Delete Records</h3>
                <p className="text-[11px] text-gray-500 dark:text-brand-matte-text mt-0.5">Recover soft-deleted records or remove them forever from dashboards and reports.</p>
              </div>
              <button
                type="button"
                onClick={fetchMastersData}
                className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-gray-500 dark:text-gray-300 font-bold rounded-lg hover:border-brand-gold transition-all"
              >
                <RotateCcw size={14} /> Refresh
              </button>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-brand-matte-border">
              {deletedRecords.map((record) => (
                <div key={`${record.entityType}-${record.id}`} className="flex items-center justify-between py-4 gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] px-2 py-0.5 rounded bg-red-500/10 text-red-500 font-bold uppercase tracking-wider">
                        {record.entityType.replace(/_/g, ' ')}
                      </span>
                      <span className="font-bold text-xs uppercase text-brand-navy dark:text-white">{record.title}</span>
                    </div>
                    <span className="text-[11px] text-gray-400 dark:text-brand-matte-text block mt-1">
                      {record.subtitle || 'No details'} | Deleted {record.deletedAt ? new Date(record.deletedAt).toLocaleString() : 'date unavailable'} by {record.deletedBy || 'SYSTEM'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRestoreDeletedRecord(record)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-gold text-brand-navy hover:bg-brand-gold-light text-[11px] font-bold rounded-lg"
                    >
                      <RotateCcw size={13} /> Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePermanentDeleteRecord(record)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-[11px] font-bold rounded-lg"
                    >
                      <Trash2 size={13} /> Permanent Delete
                    </button>
                  </div>
                </div>
              ))}

              {deletedRecords.length === 0 && (
                <div className="p-8 text-center border border-dashed border-gray-200 dark:border-brand-matte-border rounded-xl text-gray-400">
                  No soft-deleted records are waiting for restore.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
