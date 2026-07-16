import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Briefcase, X, Edit, Trash2, Eye } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { StatCard } from '../components/UI/StatCard';
import { Input } from '../components/UI/Input';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';
import { Skeleton } from '../components/UI/Skeleton';
import api from '../utilities/api';

const formatAgent = (c) => ({
  id: `AGT-${c.id.toString().padStart(3, '0')}`,
  rawId: c.id,
  name: c.company_name,
  email: c.email || '—',
  role: c.contact_name || '—',
  branch: c.redress_scheme || '—',
  activeProperties: c.activeProperties || 0,
  raw: c
});

export const Agents = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    redress_scheme: '',
    cmp_provider: '',
  });

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState(null);
  const [editForm, setEditForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    redress_scheme: '',
    cmp_provider: '',
  });

  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();
  const confirm = useConfirm();

  const handleEditClick = (row) => {
    const raw = row.raw;
    setEditingAgentId(raw.id);
    setEditForm({
      company_name: raw.company_name || '',
      contact_name: raw.contact_name || '',
      email: raw.email || '',
      phone: raw.phone || '',
      redress_scheme: raw.redress_scheme || '',
      cmp_provider: raw.cmp_provider || '',
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!editForm.company_name.trim()) errs.company_name = 'Company name is required';
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    setFormErrors({});
    setSubmitting(true);
    try {
      await api.patch(`/agents/${editingAgentId}`, editForm);
      addToast('Letting agent details updated successfully!', 'success');
      setIsEditModalOpen(false);
      fetchAgents();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update letting agent details', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = async (row) => {
    const ok = await confirm({
      title: 'Delete Letting Agent',
      message: `Are you sure you want to delete letting agent "${row.name}"? This action cannot be undone.`,
      variant: 'danger',
      confirmText: 'Delete Agent',
    });
    if (ok) {
      try {
        await api.delete(`/agents/${row.raw.id}`);
        addToast('Letting agent deleted successfully', 'success');
        fetchAgents();
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to delete letting agent', 'error');
      }
    }
  };


  const fetchAgents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/agents');
      setAgents(res.data.data || []);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load agents', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.company_name.trim()) errs.company_name = 'Company name is required';
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    setFormErrors({});
    setSubmitting(true);
    try {
      await api.post('/agents', form);
      addToast('Letting agent registered successfully!', 'success');
      setIsModalOpen(false);
      setForm({
        company_name: '',
        contact_name: '',
        email: '',
        phone: '',
        redress_scheme: '',
        cmp_provider: '',
      });
      fetchAgents();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to register letting agent', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const formattedAgents = agents.map(formatAgent);

  const columns = [
    { header: 'Agent ID', accessor: 'id', sortable: true },
    { header: 'Agent Name', accessor: 'name', sortable: true },
    { header: 'Email Address', accessor: 'email', sortable: true },
    { header: 'Staff Role', accessor: 'role', sortable: true },
    { header: 'Assigned Branch', accessor: 'branch', sortable: true },
    { 
      header: 'Managed Units', 
      accessor: 'activeProperties', 
      align: 'center', 
      sortable: true,
      renderCell: (row) => (
        <span className="px-2.5 py-0.5 text-2xs font-bold rounded-sm border bg-surface-hover text-brand-primary border-card-border">
          {row.activeProperties}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: 'id',
      align: 'center',
      renderCell: (row) => (
        <div className="flex justify-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/agents/${row.rawId}`); }}
            className="p-1.5 text-status-muted hover:text-brand-accent hover:bg-brand-accent/5 rounded-lg transition-colors cursor-pointer"
            title="View details"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleEditClick(row); }}
            className="p-1.5 text-status-muted hover:text-brand-accent hover:bg-brand-accent/5 rounded-lg transition-colors cursor-pointer"
            title="Edit agent details"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteClick(row); }}
            className="p-1.5 text-status-muted hover:text-status-danger hover:bg-status-danger/5 rounded-lg transition-colors cursor-pointer"
            title="Delete letting agent"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];

  // Calculate stats
  const activeStaffCount = agents.length;
  const uniqueRedressCount = new Set(agents.map(a => a.redress_scheme).filter(Boolean)).size;

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      {/* Page actions (title lives in the layout header) */}
      <div className="flex justify-end">
        <Button variant="primary" icon={Briefcase} onClick={() => setIsModalOpen(true)}>
          Register Letting Agent
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <StatCard
          label="Active Letting Staff"
          value={`${activeStaffCount} Agents`}
          icon={Briefcase}
          iconColor="text-brand-primary bg-brand-primary/10"
        />
        <StatCard
          label="Redress Schemes"
          value={`${uniqueRedressCount} Schemes`}
          icon={ShieldAlert}
          iconColor="text-brand-accent bg-brand-accent/10"
          valueColor="text-brand-accent"
        />
      </div>

      {/* Grid container */}
      <div className="card-bg border border-card-border rounded-card shadow-premium p-4">
        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton radius="bar" className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <DataTable 
            columns={columns} 
            data={formattedAgents} 
            onRowClick={(row) => navigate(`/agents/${row.rawId}`)} 
          />
        )}
      </div>

      {/* Register Agent Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-sidebar-bg/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-card-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-primary">Register Letting Agent</h3>
              <button onClick={() => { setIsModalOpen(false); setFormErrors({}); }} className="text-gray-400 hover:text-brand-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Company Name"
                id="a-company"
                required
                value={form.company_name}
                onChange={(e) => setForm(f => ({ ...f, company_name: e.target.value }))}
                error={formErrors.company_name}
              />
              <Input
                label="Contact Name"
                id="a-contact"
                value={form.contact_name}
                onChange={(e) => setForm(f => ({ ...f, contact_name: e.target.value }))}
              />
              <Input
                label="Email Address"
                id="a-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              />
              <Input
                label="Phone Number"
                id="a-phone"
                value={form.phone}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
              />
              <Input
                label="Redress Scheme"
                id="a-redress"
                placeholder="e.g. The Property Ombudsman"
                value={form.redress_scheme}
                onChange={(e) => setForm(f => ({ ...f, redress_scheme: e.target.value }))}
              />
              <Input
                label="CMP Provider"
                id="a-cmp"
                placeholder="e.g. Client Money Protect"
                value={form.cmp_provider}
                onChange={(e) => setForm(f => ({ ...f, cmp_provider: e.target.value }))}
              />

              <div className="flex gap-3 justify-end mt-1">
                <Button type="button" variant="ghost" onClick={() => { setIsModalOpen(false); setFormErrors({}); }}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Registering...' : 'Register Agent'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Agent Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-sidebar-bg/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-card-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-primary">Edit Agent Details</h3>
              <button onClick={() => { setIsEditModalOpen(false); setFormErrors({}); }} className="text-gray-400 hover:text-brand-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <Input
                label="Company Name"
                id="edit-a-company"
                required
                value={editForm.company_name}
                onChange={(e) => setEditForm(f => ({ ...f, company_name: e.target.value }))}
                error={formErrors.company_name}
              />
              <Input
                label="Contact Name"
                id="edit-a-contact"
                value={editForm.contact_name}
                onChange={(e) => setEditForm(f => ({ ...f, contact_name: e.target.value }))}
              />
              <Input
                label="Email Address"
                id="edit-a-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
              />
              <Input
                label="Phone Number"
                id="edit-a-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
              />
              <Input
                label="Redress Scheme"
                id="edit-a-redress"
                placeholder="e.g. The Property Ombudsman"
                value={editForm.redress_scheme}
                onChange={(e) => setEditForm(f => ({ ...f, redress_scheme: e.target.value }))}
              />
              <Input
                label="CMP Provider"
                id="edit-a-cmp"
                placeholder="e.g. Client Money Protect"
                value={editForm.cmp_provider}
                onChange={(e) => setEditForm(f => ({ ...f, cmp_provider: e.target.value }))}
              />

              <div className="flex gap-3 justify-end mt-1">
                <Button type="button" variant="ghost" onClick={() => { setIsEditModalOpen(false); setFormErrors({}); }}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
