import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, Edit, Trash2, Eye } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { StatCard } from '../components/UI/StatCard';
import { Input } from '../components/UI/Input';
import { Dropdown } from '../components/UI/Dropdown';
import { StatusPill } from '../components/UI/StatusPill';
import { Skeleton } from '../components/UI/Skeleton';
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
  const emptyLandlord = {
    name: '',
    email: '',
    phone: '',
    address: '',
    company_name: '',
    initials: '',
    is_overseas: 'no',
    nrl_hmrc_ref: '',
    nrl_hmrc_approved: 'no',
    nrl_withhold_pct: '',
    ownership_share: '',
    tob_status: 'not_sent'
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLandlord, setNewLandlord] = useState(emptyLandlord);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLandlordId, setEditingLandlordId] = useState(null);
  const [editingLandlord, setEditingLandlord] = useState(emptyLandlord);

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
      await api.post('/landlords', {
        name: newLandlord.name,
        email: newLandlord.email,
        phone: newLandlord.phone,
        address: newLandlord.address,
        company_name: newLandlord.company_name || undefined,
        initials: newLandlord.initials || undefined,
        is_overseas: newLandlord.is_overseas === 'yes',
        nrl_hmrc_ref: newLandlord.nrl_hmrc_ref || undefined,
        nrl_hmrc_approved: newLandlord.nrl_hmrc_approved === 'yes',
        nrl_withhold_pct: newLandlord.nrl_withhold_pct !== '' ? parseFloat(newLandlord.nrl_withhold_pct) : undefined,
        ownership_share: newLandlord.ownership_share !== '' ? parseFloat(newLandlord.ownership_share) : undefined,
        tob_status: newLandlord.tob_status
      });
      addToast('Landlord registered successfully!', 'success');
      setIsModalOpen(false);
      setNewLandlord(emptyLandlord);
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
        company_name: info.company_name || '',
        initials: info.initials || '',
        is_overseas: info.is_overseas ? 'yes' : 'no',
        nrl_hmrc_ref: info.nrl_hmrc_ref || '',
        nrl_hmrc_approved: info.nrl_hmrc_approved ? 'yes' : 'no',
        nrl_withhold_pct: info.nrl_withhold_pct != null ? String(info.nrl_withhold_pct) : '',
        ownership_share: info.ownership_share != null ? String(info.ownership_share) : '',
        tob_status: info.tob_status || 'not_sent'
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
      await api.patch(`/landlords/${editingLandlordId}`, {
        name: editingLandlord.name,
        email: editingLandlord.email,
        phone: editingLandlord.phone,
        address: editingLandlord.address,
        company_name: editingLandlord.company_name,
        initials: editingLandlord.initials,
        is_overseas: editingLandlord.is_overseas === 'yes',
        nrl_hmrc_ref: editingLandlord.nrl_hmrc_ref,
        nrl_hmrc_approved: editingLandlord.nrl_hmrc_approved === 'yes',
        nrl_withhold_pct: editingLandlord.nrl_withhold_pct,
        ownership_share: editingLandlord.ownership_share,
        tob_status: editingLandlord.tob_status
      });
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
        <span className="px-2 py-0.5 text-2xs font-bold rounded-sm border bg-surface-hover text-brand-primary border-card-border">
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
            className="p-1.5 text-status-muted hover:text-brand-accent hover:bg-brand-accent/5 rounded-lg transition-colors cursor-pointer"
            title="View details"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleEditClick(row); }}
            className="p-1.5 text-status-muted hover:text-brand-accent hover:bg-brand-accent/5 rounded-lg transition-colors cursor-pointer"
            title="Edit details"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteClick(row); }}
            className="p-1.5 text-status-muted hover:text-status-danger hover:bg-status-danger/5 rounded-lg transition-colors cursor-pointer"
            title="Delete landlord"
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
        <Button
          variant="primary"
          icon={UserPlus}
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
          iconColor="text-status-info bg-status-info-bg"
        />
        <StatCard
          label="Active Payouts"
          value={`${landlords.filter(l => l.kyc_status === 'passed').length} Passed`}
          icon={Users}
          iconColor="text-status-info bg-status-info-bg"
          valueColor="text-status-success"
        />
        <StatCard
          label="Awaiting Verification"
          value={`${landlords.filter(l => l.kyc_status === 'pending' || l.kyc_status === 'not_started').length} Pending`}
          icon={Users}
          iconColor="text-status-info bg-status-info-bg"
          valueColor="text-status-warning"
        />
      </div>

      {/* Grid container */}
      <div className="card-bg border border-card-border rounded-card shadow-premium p-4">
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
            <Skeleton radius="bar" className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <div className="border border-status-danger/15 bg-status-danger-bg rounded-card p-6 text-center text-status-danger font-semibold">
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
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl mx-4 border border-card-border max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-brand-primary mb-4">Register Landlord</h3>

            <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Input
                  label="Company Name (optional)"
                  id="company_name"
                  value={newLandlord.company_name}
                  onChange={(e) => setNewLandlord({ ...newLandlord, company_name: e.target.value })}
                  error={formErrors.company_name}
                />
                <Input
                  label="Initials (statements)"
                  id="initials"
                  placeholder="e.g. RB/GH"
                  value={newLandlord.initials}
                  onChange={(e) => setNewLandlord({ ...newLandlord, initials: e.target.value })}
                  error={formErrors.initials}
                />
                <Dropdown
                  label="Residency"
                  id="is_overseas"
                  options={[
                    { value: 'no', label: 'UK Resident' },
                    { value: 'yes', label: 'Overseas (NRL)' }
                  ]}
                  value={newLandlord.is_overseas}
                  onChange={(val) => setNewLandlord({ ...newLandlord, is_overseas: val })}
                />
                <Input
                  label="NRL Withholding (%)"
                  id="nrl_withhold_pct"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="20.00"
                  value={newLandlord.nrl_withhold_pct}
                  onChange={(e) => setNewLandlord({ ...newLandlord, nrl_withhold_pct: e.target.value })}
                  error={formErrors.nrl_withhold_pct}
                />
                <Input
                  label="NRL Number (HMRC)"
                  id="nrl_hmrc_ref"
                  placeholder="e.g. NL945005"
                  value={newLandlord.nrl_hmrc_ref}
                  onChange={(e) => setNewLandlord({ ...newLandlord, nrl_hmrc_ref: e.target.value })}
                  error={formErrors.nrl_hmrc_ref}
                />
                <Dropdown
                  label="NRL HMRC Approved"
                  id="nrl_hmrc_approved"
                  options={[
                    { value: 'no', label: 'No' },
                    { value: 'yes', label: 'Yes' }
                  ]}
                  value={newLandlord.nrl_hmrc_approved}
                  onChange={(val) => setNewLandlord({ ...newLandlord, nrl_hmrc_approved: val })}
                />
                <Input
                  label="Ownership Share (%)"
                  id="ownership_share"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="100.00"
                  value={newLandlord.ownership_share}
                  onChange={(e) => setNewLandlord({ ...newLandlord, ownership_share: e.target.value })}
                  error={formErrors.ownership_share}
                />
                <Dropdown
                  label="Terms of Business"
                  id="tob_status"
                  options={[
                    { value: 'not_sent', label: 'Not Sent' },
                    { value: 'sent', label: 'Sent' },
                    { value: 'signed', label: 'Signed' }
                  ]}
                  value={newLandlord.tob_status}
                  onChange={(val) => setNewLandlord({ ...newLandlord, tob_status: val })}
                />
              </div>

              <div className="flex gap-3 justify-end mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormErrors({});
                    setNewLandlord(emptyLandlord);
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
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl mx-4 border border-card-border max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-brand-primary mb-4">Edit Landlord Details</h3>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Input
                  label="Company Name (optional)"
                  id="edit_company_name"
                  value={editingLandlord.company_name}
                  onChange={(e) => setEditingLandlord({ ...editingLandlord, company_name: e.target.value })}
                  error={formErrors.company_name}
                />
                <Input
                  label="Initials (statements)"
                  id="edit_initials"
                  placeholder="e.g. RB/GH"
                  value={editingLandlord.initials}
                  onChange={(e) => setEditingLandlord({ ...editingLandlord, initials: e.target.value })}
                  error={formErrors.initials}
                />
                <Dropdown
                  label="Residency"
                  id="edit_is_overseas"
                  options={[
                    { value: 'no', label: 'UK Resident' },
                    { value: 'yes', label: 'Overseas (NRL)' }
                  ]}
                  value={editingLandlord.is_overseas}
                  onChange={(val) => setEditingLandlord({ ...editingLandlord, is_overseas: val })}
                />
                <Input
                  label="NRL Withholding (%)"
                  id="edit_nrl_withhold_pct"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="20.00"
                  value={editingLandlord.nrl_withhold_pct}
                  onChange={(e) => setEditingLandlord({ ...editingLandlord, nrl_withhold_pct: e.target.value })}
                  error={formErrors.nrl_withhold_pct}
                />
                <Input
                  label="NRL Number (HMRC)"
                  id="edit_nrl_hmrc_ref"
                  placeholder="e.g. NL945005"
                  value={editingLandlord.nrl_hmrc_ref}
                  onChange={(e) => setEditingLandlord({ ...editingLandlord, nrl_hmrc_ref: e.target.value })}
                  error={formErrors.nrl_hmrc_ref}
                />
                <Dropdown
                  label="NRL HMRC Approved"
                  id="edit_nrl_hmrc_approved"
                  options={[
                    { value: 'no', label: 'No' },
                    { value: 'yes', label: 'Yes' }
                  ]}
                  value={editingLandlord.nrl_hmrc_approved}
                  onChange={(val) => setEditingLandlord({ ...editingLandlord, nrl_hmrc_approved: val })}
                />
                <Input
                  label="Ownership Share (%)"
                  id="edit_ownership_share"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="100.00"
                  value={editingLandlord.ownership_share}
                  onChange={(e) => setEditingLandlord({ ...editingLandlord, ownership_share: e.target.value })}
                  error={formErrors.ownership_share}
                />
                <Dropdown
                  label="Terms of Business"
                  id="edit_tob_status"
                  options={[
                    { value: 'not_sent', label: 'Not Sent' },
                    { value: 'sent', label: 'Sent' },
                    { value: 'signed', label: 'Signed' }
                  ]}
                  value={editingLandlord.tob_status}
                  onChange={(val) => setEditingLandlord({ ...editingLandlord, tob_status: val })}
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
