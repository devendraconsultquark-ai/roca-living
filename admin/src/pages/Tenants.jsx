import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle2, AlertTriangle, Edit, X, Trash2, Eye } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { StatCard } from '../components/UI/StatCard';
import { Input } from '../components/UI/Input';
import { Dropdown } from '../components/UI/Dropdown';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';
import api from '../utilities/api';

export const Tenants = () => {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTenantId, setEditingTenantId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    right_to_rent_status: 'pending',
    right_to_rent_expiry: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();
  const confirm = useConfirm();

  const handleEditClick = (row) => {
    setEditingTenantId(row.rawId);
    setEditForm({
      name: row.name || '',
      email: row.email === '-' ? '' : row.email || '',
      phone: row.phone === '-' ? '' : row.phone || '',
      right_to_rent_status: row.right_to_rent_status || 'pending',
      right_to_rent_expiry: row.right_to_rent_expiry || ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!editForm.name.trim()) errs.name = 'Full name is required';
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }

    setFormErrors({});
    setSubmitting(true);
    try {
      await api.patch(`/tenancies/tenants/${editingTenantId}`, editForm);
      addToast('Tenant details updated successfully!', 'success');
      setIsEditModalOpen(false);
      fetchTenants();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update tenant details', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = async (row) => {
    const ok = await confirm({
      title: 'Delete Tenant',
      message: `Are you sure you want to delete tenant "${row.name}"? This action cannot be undone.`,
      variant: 'danger',
      confirmText: 'Delete Tenant',
    });
    if (ok) {
      try {
        await api.delete(`/tenancies/tenants/${row.rawId}`);
        addToast('Tenant deleted successfully', 'success');
        fetchTenants();
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to delete tenant', 'error');
      }
    }
  };


  const fetchTenants = async () => {
    setLoading(true);
    try {
      const response = await api.get('/tenancies/tenants/all');
      const data = response.data.data || [];
      // Ensure balance is parsed to a float/number
      const formatted = data.map(t => ({
        ...t,
        balance: parseFloat(t.balance || 0)
      }));
      setTenants(formatted);
      setError(null);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Error loading tenants';
      setError(errMsg);
      addToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const totalTenants = tenants.length;
  const paymentsUpToDate = tenants.filter(t => t.balance >= 0).length;
  const tenantsInArrears = tenants.filter(t => t.balance < 0).length;

  const columns = [
    { header: 'Tenant ID', accessor: 'id', sortable: true },
    { header: 'Full Name', accessor: 'name', sortable: true },
    { header: 'Email Address', accessor: 'email', sortable: true },
    { header: 'Phone Number', accessor: 'phone' },
    { header: 'Property Address', accessor: 'property', sortable: true },
    { 
      header: 'Account Balance', 
      accessor: 'balance', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => (
        <span className={row.balance < 0 ? 'text-status-danger font-bold' : 'text-status-success font-semibold'}>
          {row.balance < 0 ? `-£${Math.abs(row.balance).toFixed(2)}` : `£${row.balance.toFixed(2)}`}
        </span>
      )
    },
    { 
      header: 'Account Status', 
      accessor: 'status',
      renderCell: (row) => (
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
          row.status === 'Active' 
            ? 'bg-status-success/10 text-status-success border-status-success/20' 
            : 'bg-status-danger/10 text-status-danger border-status-danger/20 animate-pulse'
        }`}>
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
            onClick={(e) => { e.stopPropagation(); navigate(`/tenants/${row.rawId}`); }}
            className="p-1.5 text-gray-500 hover:text-brand-accent hover:bg-brand-accent/5 rounded-lg transition-colors cursor-pointer"
            title="View details"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleEditClick(row); }}
            className="p-1.5 text-gray-500 hover:text-brand-accent hover:bg-brand-accent/5 rounded-lg transition-colors cursor-pointer"
            title="Edit tenant details"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteClick(row); }}
            className="p-1.5 text-gray-500 hover:text-status-danger hover:bg-status-danger/5 rounded-lg transition-colors cursor-pointer"
            title="Delete tenant"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="py-6 max-w-7xl mx-auto px-4 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Tenants CRM</h2>
          <p className="text-sm text-gray-500 mt-1">Manage tenant communications, contact directory, and ledger account balances.</p>
        </div>
        <Button variant="primary" icon={Users} className="shadow-sm">
          Add New Tenant
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          label="Total Tenants"
          value={loading ? '...' : `${totalTenants} Residents`}
          icon={Users}
          iconColor="text-brand-primary bg-brand-primary/10"
        />
        <StatCard
          label="Payments Up to Date"
          value={loading ? '...' : `${paymentsUpToDate} Accounts`}
          icon={CheckCircle2}
          iconColor="text-status-success bg-status-success/10"
          valueColor="text-status-success"
        />
        <StatCard
          label="Tenants in Arrears"
          value={loading ? '...' : `${tenantsInArrears} Accounts`}
          icon={AlertTriangle}
          iconColor="text-status-danger bg-status-danger/10"
          valueColor="text-status-danger"
        />
      </div>

      {/* Grid container */}
      <div className="bg-white rounded-2xl border border-border-color/60 p-4 shadow-sm">
        {loading ? (
          <div className="space-y-4 py-4">
            <div className="h-10 bg-gray-100/80 rounded-lg animate-pulse w-full" />
            <div className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" />
            <div className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" />
            <div className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" />
          </div>
        ) : error ? (
          <div className="border border-status-danger bg-status-danger/5 rounded-xl p-6 text-center text-status-danger font-semibold">
            {error}
          </div>
        ) : (
          <DataTable 
            columns={columns} 
            data={tenants} 
            onRowClick={(row) => navigate(`/tenants/${row.rawId}`)} 
          />
        )}
      </div>

      {/* Edit Tenant Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-brand-primary/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-border-color">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[#1A1A1A]">Edit Tenant Details</h3>
              <button onClick={() => { setIsEditModalOpen(false); setFormErrors({}); }} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <Input
                label="Full Name"
                id="edit-t-name"
                required
                value={editForm.name}
                onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                error={formErrors.name}
              />
              <Input
                label="Email Address"
                id="edit-t-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
              />
              <Input
                label="Phone Number"
                id="edit-t-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
              />
              <Dropdown
                label="Right to Rent Status"
                id="edit-t-rtr-status"
                placeholder="Select status"
                value={editForm.right_to_rent_status}
                onChange={(val) => setEditForm(f => ({ ...f, right_to_rent_status: val }))}
                options={[
                  { value: 'pending', label: 'Pending' },
                  { value: 'verified', label: 'Approved (Verified)' },
                  { value: 'failed', label: 'Rejected (Failed)' }
                ]}
              />
              <Input
                label="Right to Rent Expiry"
                id="edit-t-rtr-expiry"
                type="date"
                value={editForm.right_to_rent_expiry}
                onChange={(e) => setEditForm(f => ({ ...f, right_to_rent_expiry: e.target.value }))}
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
