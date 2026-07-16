import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCog, CheckCircle2, AlertTriangle, X, Edit, Trash2, Eye } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Dropdown } from '../components/UI/Dropdown';
import { Skeleton } from '../components/UI/Skeleton';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';
import api from '../utilities/api';

const formatContractor = (c) => ({
  id: c.id,
  name: c.company_name,
  trade: c.trade,
  phone: c.phone || '—',
  email: c.email || '—',
  rating: c.rating ? `${c.rating} ★` : '—',
  insurance_expiry: c.insurance_expiry,
  status: c.status === 'active'
    ? `Active${c.insurance_expiry ? ` (Insured until ${new Date(c.insurance_expiry).toLocaleDateString('en-GB')})` : ' (Insured)'}`
    : 'Suspended (Insurance Expired)',
  raw: c
});

export const Contractors = () => {
  const navigate = useNavigate();
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ company_name: '', trade: '', email: '', phone: '', insurance_expiry: '' });
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingContractorId, setEditingContractorId] = useState(null);
  const [editForm, setEditForm] = useState({ company_name: '', trade: '', email: '', phone: '', insurance_expiry: '', status: 'active' });

  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();
  const confirm = useConfirm();

  const handleEditClick = (row) => {
    const raw = row.raw;
    setEditingContractorId(raw.id);
    setEditForm({
      company_name: raw.company_name || '',
      trade: raw.trade || '',
      email: raw.email || '',
      phone: raw.phone || '',
      insurance_expiry: raw.insurance_expiry ? raw.insurance_expiry.split('T')[0] : '',
      status: raw.status || 'active'
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!editForm.company_name.trim()) errs.company_name = 'Company name is required';
    if (!editForm.trade.trim()) errs.trade = 'Trade is required';
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }

    setFormErrors({});
    setSubmitting(true);
    try {
      await api.patch(`/maintenance/contractors/${editingContractorId}`, editForm);
      addToast('Contractor updated successfully!', 'success');
      setIsEditModalOpen(false);
      fetchContractors();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update contractor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = async (row) => {
    const ok = await confirm({
      title: 'Delete Contractor',
      message: `Are you sure you want to delete contractor "${row.name}"? This action cannot be undone.`,
      variant: 'danger',
      confirmText: 'Delete Contractor',
    });
    if (ok) {
      try {
        await api.delete(`/maintenance/contractors/${row.raw.id}`);
        addToast('Contractor deleted successfully', 'success');
        fetchContractors();
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to delete contractor', 'error');
      }
    }
  };


  const fetchContractors = async () => {
    setLoading(true);
    try {
      const res = await api.get('/maintenance/contractors');
      setContractors((res.data.data || []).map(formatContractor));
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load contractors', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContractors(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.company_name.trim()) errs.company_name = 'Company name is required';
    if (!form.trade.trim()) errs.trade = 'Trade is required';
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }

    setFormErrors({});
    setSubmitting(true);
    try {
      await api.post('/maintenance/contractors', form);
      addToast('Contractor added successfully!', 'success');
      setIsModalOpen(false);
      setForm({ company_name: '', trade: '', email: '', phone: '', insurance_expiry: '' });
      fetchContractors();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to add contractor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { header: 'Contractor ID', accessor: 'id', sortable: true },
    { header: 'Company / Name', accessor: 'name', sortable: true },
    { header: 'Trade Specialty', accessor: 'trade', sortable: true },
    { header: 'Phone Number', accessor: 'phone' },
    { header: 'Email Address', accessor: 'email', sortable: true },
    { header: 'Rating', accessor: 'rating', sortable: true },
    {
      header: 'Insurance Status',
      accessor: 'status',
      renderCell: (row) => (
        <span className={`inline-flex items-center gap-1 text-2xs font-semibold ${
          row.status.includes('Active') ? 'text-status-success' : 'text-status-danger'
        }`}>
          {row.status.includes('Active') ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
          {row.status}
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
            onClick={(e) => { e.stopPropagation(); navigate(`/contractors/${row.raw.id}`); }}
            className="p-1.5 text-status-muted hover:text-brand-accent hover:bg-brand-accent/5 rounded-lg transition-colors cursor-pointer"
            title="View details"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleEditClick(row); }}
            className="p-1.5 text-status-muted hover:text-brand-accent hover:bg-brand-accent/5 rounded-lg transition-colors cursor-pointer"
            title="Edit contractor details"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteClick(row); }}
            className="p-1.5 text-status-muted hover:text-status-danger hover:bg-status-danger/5 rounded-lg transition-colors cursor-pointer"
            title="Delete contractor"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      {/* Page actions (title lives in the layout header) */}
      <div className="flex justify-end">
        <Button variant="primary" icon={UserCog} onClick={() => setIsModalOpen(true)}>
          Add Contractor
        </Button>
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
            data={contractors} 
            onRowClick={(row) => navigate(`/contractors/${row.raw.id}`)} 
          />
        )}
      </div>

      {/* Add Contractor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-sidebar-bg/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-card-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-primary">Add Contractor</h3>
              <button onClick={() => { setIsModalOpen(false); setFormErrors({}); }} className="text-gray-400 hover:text-brand-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Company Name"
                id="c-company"
                required
                value={form.company_name}
                onChange={(e) => setForm(f => ({ ...f, company_name: e.target.value }))}
                error={formErrors.company_name}
              />
              <Input
                label="Trade Specialty"
                id="c-trade"
                required
                placeholder="e.g. Plumbing & Leaks"
                value={form.trade}
                onChange={(e) => setForm(f => ({ ...f, trade: e.target.value }))}
                error={formErrors.trade}
              />
              <Input
                label="Email Address"
                id="c-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              />
              <Input
                label="Phone Number"
                id="c-phone"
                value={form.phone}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
              />
              <Input
                label="Insurance Expiry Date"
                id="c-insurance"
                type="date"
                value={form.insurance_expiry}
                onChange={(e) => setForm(f => ({ ...f, insurance_expiry: e.target.value }))}
              />

              <div className="flex gap-3 justify-end mt-1">
                <Button type="button" variant="ghost" onClick={() => { setIsModalOpen(false); setFormErrors({}); }}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Add Contractor'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Contractor Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-sidebar-bg/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-card-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-primary">Edit Contractor Details</h3>
              <button onClick={() => { setIsEditModalOpen(false); setFormErrors({}); }} className="text-gray-400 hover:text-brand-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <Input
                label="Company Name"
                id="edit-c-company"
                required
                value={editForm.company_name}
                onChange={(e) => setEditForm(f => ({ ...f, company_name: e.target.value }))}
                error={formErrors.company_name}
              />
              <Input
                label="Trade Specialty"
                id="edit-c-trade"
                required
                placeholder="e.g. Plumbing & Leaks"
                value={editForm.trade}
                onChange={(e) => setEditForm(f => ({ ...f, trade: e.target.value }))}
                error={formErrors.trade}
              />
              <Input
                label="Email Address"
                id="edit-c-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
              />
              <Input
                label="Phone Number"
                id="edit-c-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
              />
              <Input
                label="Insurance Expiry Date"
                id="edit-c-insurance"
                type="date"
                value={editForm.insurance_expiry}
                onChange={(e) => setEditForm(f => ({ ...f, insurance_expiry: e.target.value }))}
              />
              <Dropdown
                label="Contractor Status"
                id="edit-c-status"
                placeholder="Select status"
                value={editForm.status}
                onChange={(val) => setEditForm(f => ({ ...f, status: val }))}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'suspended', label: 'Suspended / Inactive' }
                ]}
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
