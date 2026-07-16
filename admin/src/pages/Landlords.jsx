import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, Edit, Trash2, Eye } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { StatCard } from '../components/UI/StatCard';
import { Input } from '../components/UI/Input';
import { StatusPill } from '../components/UI/StatusPill';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';
import api from '../utilities/api';

export const Landlords = () => {
  const navigate = useNavigate();
  const [landlords, setLandlords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  
  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLandlord, setNewLandlord] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLandlordId, setEditingLandlordId] = useState(null);
  const [editingLandlord, setEditingLandlord] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  const [formErrors, setFormErrors] = useState({});
  const { addToast } = useToast();
  const confirm = useConfirm();

  const fetchLandlords = async (searchVal = '') => {
    setLoading(true);
    try {
      const response = await api.get(`/landlords${searchVal ? `?search=${encodeURIComponent(searchVal)}` : ''}`);
      setLandlords(response.data.data || []);
      setError(null);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Error loading landlords';
      setError(errMsg);
      addToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchLandlords(search);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    try {
      await api.post('/landlords', newLandlord);
      addToast('Landlord registered successfully!', 'success');
      setIsModalOpen(false);
      setNewLandlord({ name: '', email: '', phone: '', address: '' });
      fetchLandlords(search);
    } catch (err) {
      console.error(err);
      if (err.response?.data?.errors) {
        const errorsObj = {};
        err.response.data.errors.forEach((e) => {
          errorsObj[e.field] = e.message;
        });
        setFormErrors(errorsObj);
      } else {
        const msg = err.response?.data?.message || 'Failed to register landlord';
        addToast(msg, 'error');
      }
    }
  };

  const handleEditClick = async (row) => {
    try {
      const response = await api.get(`/landlords/${row.id}`);
      const info = response.data.data;
      setEditingLandlordId(row.id);
      setEditingLandlord({
        name: info.name || '',
        email: info.email || '',
        phone: info.phone || '',
        address: info.address || '',
        initials: info.initials || '',
        nrl_hmrc_ref: info.nrl_hmrc_ref || ''
      });
      setIsEditModalOpen(true);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to fetch landlord details', 'error');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    try {
      await api.patch(`/landlords/${editingLandlordId}`, editingLandlord);
      addToast('Landlord details updated successfully!', 'success');
      setIsEditModalOpen(false);
      fetchLandlords(search);
    } catch (err) {
      console.error(err);
      if (err.response?.data?.errors) {
        const errorsObj = {};
        err.response.data.errors.forEach((e) => {
          errorsObj[e.field] = e.message;
        });
        setFormErrors(errorsObj);
      } else {
        const msg = err.response?.data?.message || 'Failed to update landlord details';
        addToast(msg, 'error');
      }
    }
  };

  const handleDeleteClick = async (row) => {
    const ok = await confirm({
      title: 'Delete Landlord',
      message: `Are you sure you want to delete landlord "${row.name}"? This will permanently delete all associated properties, tenancies, compliance checklists, rent schedules, and statements.`,
      variant: 'danger',
      confirmText: 'Delete Landlord',
    });
    if (ok) {
      try {
        await api.delete(`/landlords/${row.id}`);
        addToast('Landlord deleted successfully', 'success');
        fetchLandlords(search);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to delete landlord', 'error');
      }
    }
  };

  const columns = [
    { header: 'Landlord ID', accessor: 'landlord_reference', sortable: true },
    { header: 'Full Name', accessor: 'name', sortable: true },
    { header: 'Email Address', accessor: 'email', sortable: true },
    { header: 'Contact Phone', accessor: 'phone' },
    { 
      header: 'Properties', 
      accessor: 'propertiesCount', 
      align: 'center', 
      sortable: true,
      renderCell: (row) => (
        <span className="font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-xs">
          {row.propertiesCount}
        </span>
      )
    },
    { 
      header: 'YTD Paid Out', 
      accessor: 'payouts', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => row.payouts !== null && row.payouts !== undefined 
        ? `£${row.payouts.toLocaleString(undefined, { minimumFractionDigits: 2 })}` 
        : '-'
    },
    { 
      header: 'Disbursement Status', 
      accessor: 'kyc_status',
      renderCell: (row) => {
        let pillStatus = 'draft';
        if (row.kyc_status === 'passed') pillStatus = 'active';
        else if (row.kyc_status === 'pending') pillStatus = 'pending';
        else if (row.kyc_status === 'failed') pillStatus = 'danger';
        return <StatusPill status={pillStatus} />;
      }
    },
    {
      header: 'Actions',
      accessor: 'id',
      align: 'center',
      renderCell: (row) => (
        <div className="flex justify-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/landlords/${row.id}`); }}
            className="p-1.5 text-gray-500 hover:text-brand-accent hover:bg-brand-accent/5 rounded-lg transition-colors cursor-pointer"
            title="View details"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleEditClick(row); }}
            className="p-1.5 text-gray-500 hover:text-brand-accent hover:bg-brand-accent/5 rounded-lg transition-colors cursor-pointer"
            title="Edit details"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteClick(row); }}
            className="p-1.5 text-gray-500 hover:text-status-danger hover:bg-status-danger/5 rounded-lg transition-colors cursor-pointer"
            title="Delete landlord"
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
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Landlords Directory</h2>
          <p className="text-sm text-gray-500 mt-1">Review contact records, active portfolios, and compliance details for registered landlords.</p>
        </div>
        <Button 
          variant="primary" 
          icon={UserPlus} 
          className="shadow-sm"
          onClick={() => setIsModalOpen(true)}
        >
          Register Landlord
        </Button>
      </div>

      {/* Quick stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          label="Total Landlords"
          value={`${landlords.length} Registered`}
          icon={Users}
          iconColor="text-brand-accent bg-brand-accent/10"
        />
        <StatCard
          label="Active Payouts"
          value={`${landlords.filter(l => l.kyc_status === 'passed').length} Passed`}
          icon={Users}
          iconColor="text-brand-accent bg-brand-accent/10"
          valueColor="text-status-success"
        />
        <StatCard
          label="Awaiting Verification"
          value={`${landlords.filter(l => l.kyc_status === 'pending' || l.kyc_status === 'not_started').length} Pending`}
          icon={Users}
          iconColor="text-brand-accent bg-brand-accent/10"
          valueColor="text-status-warning"
        />
      </div>

      {/* Grid container */}
      <div className="bg-white rounded-2xl border border-border-color/60 p-4 shadow-sm">
        <div className="mb-4 max-w-md">
          <Input
            id="search"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

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
            data={landlords} 
            onRowClick={(row) => navigate(`/landlords/${row.id}`)} 
          />
        )}
      </div>

      {/* Register Landlord Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-brand-primary/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-border-color">
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">Register Landlord</h3>
            
            <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4">
              <Input
                label="Full Name"
                id="name"
                required
                value={newLandlord.name}
                onChange={(e) => setNewLandlord({ ...newLandlord, name: e.target.value })}
                error={formErrors.name}
              />
              <Input
                label="Email Address"
                id="email"
                type="email"
                required
                value={newLandlord.email}
                onChange={(e) => setNewLandlord({ ...newLandlord, email: e.target.value })}
                error={formErrors.email}
              />
              <Input
                label="Contact Phone"
                id="phone"
                required
                value={newLandlord.phone}
                onChange={(e) => setNewLandlord({ ...newLandlord, phone: e.target.value })}
                error={formErrors.phone}
              />
              <Input
                label="Address"
                id="address"
                value={newLandlord.address}
                onChange={(e) => setNewLandlord({ ...newLandlord, address: e.target.value })}
                error={formErrors.address}
              />
              
              <div className="flex gap-3 justify-end mt-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormErrors({});
                    setNewLandlord({ name: '', email: '', phone: '', address: '' });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Register
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Landlord Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-brand-primary/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-border-color">
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">Edit Landlord Details</h3>
            
            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <Input
                label="Full Name"
                id="edit_name"
                required
                value={editingLandlord.name}
                onChange={(e) => setEditingLandlord({ ...editingLandlord, name: e.target.value })}
                error={formErrors.name}
              />
              <Input
                label="Email Address"
                id="edit_email"
                type="email"
                required
                value={editingLandlord.email}
                onChange={(e) => setEditingLandlord({ ...editingLandlord, email: e.target.value })}
                error={formErrors.email}
              />
              <Input
                label="Contact Phone"
                id="edit_phone"
                required
                value={editingLandlord.phone}
                onChange={(e) => setEditingLandlord({ ...editingLandlord, phone: e.target.value })}
                error={formErrors.phone}
              />
              <Input
                label="Address"
                id="edit_address"
                value={editingLandlord.address}
                onChange={(e) => setEditingLandlord({ ...editingLandlord, address: e.target.value })}
                error={formErrors.address}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Initials (statements)"
                  id="edit_initials"
                  placeholder="e.g. RB/GH"
                  value={editingLandlord.initials}
                  onChange={(e) => setEditingLandlord({ ...editingLandlord, initials: e.target.value })}
                  error={formErrors.initials}
                />
                <Input
                  label="NRL Number (HMRC)"
                  id="edit_nrl_hmrc_ref"
                  placeholder="e.g. NL945005"
                  value={editingLandlord.nrl_hmrc_ref}
                  onChange={(e) => setEditingLandlord({ ...editingLandlord, nrl_hmrc_ref: e.target.value })}
                  error={formErrors.nrl_hmrc_ref}
                />
              </div>

              <div className="flex gap-3 justify-end mt-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setFormErrors({});
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
