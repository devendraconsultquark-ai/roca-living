import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, CheckCircle2, AlertTriangle, HelpCircle, Edit, Trash2, Eye } from 'lucide-react';
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

export const Properties = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [landlordsList, setLandlordsList] = useState([]);
  
  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProperty, setNewProperty] = useState({
    landlord_id: '',
    address_line1: '',
    address_line2: '',
    city: '',
    postcode: '',
    property_type: 'flat',
    bedrooms: '',
    rent_pcm: '',
    mgmt_fee_pct: '12.00',
    block_name: '',
    apartment_number: '',
    key_ref: '',
    notes: '',
    name: ''
  });

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState(null);
  const [editingProperty, setEditingProperty] = useState({
    address_line1: '',
    address_line2: '',
    city: '',
    postcode: '',
    property_type: 'flat',
    bedrooms: '',
    rent_pcm: '',
    mgmt_fee_pct: '12.00',
    block_name: '',
    apartment_number: '',
    key_ref: '',
    notes: '',
    status: 'onboarding',
    name: ''
  });

  const [formErrors, setFormErrors] = useState({});
  const { addToast } = useToast();
  const confirm = useConfirm();

  const handleEditClick = async (row) => {
    try {
      const response = await api.get(`/properties/${row.id}`);
      const info = response.data.data;
      setEditingPropertyId(row.id);
      setEditingProperty({
        address_line1: info.address_line1 || '',
        address_line2: info.address_line2 || '',
        city: info.city || '',
        postcode: info.postcode || '',
        property_type: info.property_type || 'flat',
        bedrooms: info.bedrooms !== null ? String(info.bedrooms) : '',
        rent_pcm: info.rent_pcm !== null ? String(info.rent_pcm) : '',
        mgmt_fee_pct: info.mgmt_fee_pct !== null ? String(info.mgmt_fee_pct) : '12.00',
        block_name: info.block_name || '',
        apartment_number: info.apartment_number || '',
        key_ref: info.key_ref || '',
        notes: info.notes || '',
        status: info.status || 'onboarding',
        name: info.name || ''
      });
      setIsEditModalOpen(true);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to fetch property details', 'error');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    try {
      await api.patch(`/properties/${editingPropertyId}`, editingProperty);
      addToast('Property updated successfully!', 'success');
      setIsEditModalOpen(false);
      fetchProperties();
    } catch (err) {
      console.error(err);
      if (err.response?.data?.errors) {
        const errorsObj = {};
        err.response.data.errors.forEach((e) => {
          errorsObj[e.field] = e.message;
        });
        setFormErrors(errorsObj);
      } else {
        const msg = err.response?.data?.message || 'Failed to update property';
        addToast(msg, 'error');
      }
    }
  };

  const handleDeleteClick = async (row) => {
    const ok = await confirm({
      title: 'Delete Property',
      message: `Are you sure you want to delete property "${row.address}"? This will permanently delete all associated tenancies, compliance checklists, rent schedules, and maintenance records.`,
      variant: 'danger',
      confirmText: 'Delete Property',
    });
    if (ok) {
      try {
        await api.delete(`/properties/${row.id}`);
        addToast('Property deleted successfully', 'success');
        fetchProperties();
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to delete property', 'error');
      }
    }
  };


  const fetchProperties = async () => {
    setLoading(true);
    try {
      const response = await api.get('/properties');
      const formatted = (response.data.data || []).map((p) => ({
        ...p,
        address: `${p.address_line1}${p.address_line2 ? `, ${p.address_line2}` : ''}, ${p.city} ${p.postcode}`,
        landlord: p.landlord_name,
        rent: p.rent_pcm ? parseFloat(p.rent_pcm) : 0,
        status: p.status
      }));
      setProperties(formatted);
      setError(null);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Error loading properties';
      setError(errMsg);
      addToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchLandlordsList = async () => {
    try {
      const res = await api.get('/landlords');
      setLandlordsList(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch landlords list for dropdown:', err);
    }
  };

  useEffect(() => {
    fetchProperties();
    fetchLandlordsList();
    // Default management fee comes from the system settings (fallback 12.00).
    api.get('/settings').then((res) => {
      const fee = parseFloat(res.data?.data?.agencyFee);
      if (Number.isFinite(fee)) {
        setNewProperty((prev) =>
          prev.mgmt_fee_pct === '12.00' ? { ...prev, mgmt_fee_pct: fee.toFixed(2) } : prev
        );
      }
    }).catch(() => { /* prefill only */ });
  }, []);

  const handleAddPropertySubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    try {
      await api.post('/properties', newProperty);
      addToast('Property added successfully!', 'success');
      setIsModalOpen(false);
      setNewProperty({
        landlord_id: '',
        address_line1: '',
        address_line2: '',
        city: '',
        postcode: '',
        property_type: 'flat',
        bedrooms: '',
        rent_pcm: '',
        mgmt_fee_pct: '12.00',
        block_name: '',
        apartment_number: '',
        key_ref: '',
        notes: '',
        name: ''
      });
      fetchProperties();
    } catch (err) {
      console.error(err);
      if (err.response?.data?.errors) {
        const errorsObj = {};
        err.response.data.errors.forEach((e) => {
          errorsObj[e.field] = e.message;
        });
        setFormErrors(errorsObj);
      } else {
        const msg = err.response?.data?.message || 'Failed to add property';
        addToast(msg, 'error');
      }
    }
  };

  const renderCertStatus = (statusValue) => {
    if (!statusValue || statusValue === 'not_uploaded') return '-';
    const config = {
      compliant: { color: 'text-status-success', icon: CheckCircle2, text: 'Compliant' },
      expiring_soon: { color: 'text-status-warning', icon: AlertTriangle, text: 'Expiring Soon' },
      expired: { color: 'text-status-danger', icon: AlertTriangle, text: 'Expired' }
    };
    const item = config[statusValue] || { color: 'text-status-muted', icon: HelpCircle, text: statusValue };
    const Icon = item.icon;
    return (
      <span className={`inline-flex items-center gap-1 text-2xs font-semibold ${item.color}`}>
        <Icon size={13} />
        {item.text}
      </span>
    );
  };

  const columns = [
    { header: 'Property Reference', accessor: 'property_reference', sortable: true },
    { 
      header: 'Property', 
      accessor: 'name', 
      sortable: true,
      renderCell: (row) => (
        <div>
          <div className="font-semibold text-brand-primary">{row.name || row.address_line1}</div>
          <div className="text-xs text-status-muted">{row.address}</div>
        </div>
      )
    },
    { header: 'Associated Landlord', accessor: 'landlord', sortable: true },
    { 
      header: 'Monthly Rent', 
      accessor: 'rent', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => {
        const rentVal = typeof row.rent === 'number' ? row.rent : parseFloat(row.rent);
        return rentVal !== null && rentVal !== undefined && !isNaN(rentVal) && rentVal > 0
          ? `£${rentVal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : '-';
      }
    },
    { 
      header: 'Tenancy Status', 
      accessor: 'status',
      renderCell: (row) => <StatusPill status={row.status} />
    },
    {
      header: 'Gas Certificate',
      accessor: 'gasCompliance',
      renderCell: (row) => renderCertStatus(row.gasCompliance)
    },
    {
      header: 'EICR',
      accessor: 'eicrCompliance',
      renderCell: (row) => renderCertStatus(row.eicrCompliance)
    },
    {
      header: 'EPC rating',
      accessor: 'epcCompliance',
      renderCell: (row) => renderCertStatus(row.epcCompliance)
    },
    {
      header: 'Actions',
      accessor: 'id',
      align: 'center',
      renderCell: (row) => (
        <div className="flex justify-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/properties/${row.id}`); }}
            className="p-1.5 text-status-muted hover:text-brand-accent hover:bg-brand-accent/5 rounded-lg transition-colors cursor-pointer"
            title="View property details"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleEditClick(row); }}
            className="p-1.5 text-status-muted hover:text-brand-accent hover:bg-brand-accent/5 rounded-lg transition-colors cursor-pointer"
            title="Edit property details"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteClick(row); }}
            className="p-1.5 text-status-muted hover:text-status-danger hover:bg-status-danger/5 rounded-lg transition-colors cursor-pointer"
            title="Delete property"
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
          icon={Home}
          onClick={() => setIsModalOpen(true)}
        >
          Add New Property
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
        <StatCard
          label="Total Properties"
          value={`${properties.length} units`}
          icon={Home}
          iconColor="text-brand-primary bg-surface-hover"
        />
        <StatCard
          label="Occupied"
          value={`${properties.filter(p => p.status === 'let').length} units`}
          icon={CheckCircle2}
          iconColor="text-status-success bg-status-success-bg"
          valueColor="text-status-success"
        />
        <StatCard
          label="Vacant Units"
          value={`${properties.filter(p => p.status === 'vacant').length} units`}
          icon={HelpCircle}
          iconColor="text-status-info bg-status-info-bg"
          valueColor="text-brand-accent"
        />
        <StatCard
          label="Safety Warnings"
          value={`${properties.filter(p => ['gasCompliance', 'eicrCompliance', 'epcCompliance'].some(k => p[k] === 'expired' || p[k] === 'not_uploaded')).length} Warnings`}
          icon={AlertTriangle}
          iconColor="text-status-danger bg-status-danger-bg"
          valueColor="text-status-danger"
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
        ) : error ? (
          <div className="border border-status-danger/15 bg-status-danger-bg rounded-card p-6 text-center text-status-danger font-semibold">
            {error}
          </div>
        ) : (
          <DataTable 
            columns={columns} 
            data={properties} 
            onRowClick={(row) => navigate(`/properties/${row.id}`)} 
          />
        )}
      </div>

      {/* Add New Property Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-card-border max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-brand-primary mb-4">Add New Property</h3>
            
            <form onSubmit={handleAddPropertySubmit} className="flex flex-col gap-4">
              <Dropdown
                label="Associated Landlord"
                id="landlord_id"
                placeholder="Select landlord..."
                searchable
                value={newProperty.landlord_id}
                onChange={(val) => {
                  setNewProperty(prev => ({ ...prev, landlord_id: val }));
                  if (formErrors.landlord_id) setFormErrors(prev => ({ ...prev, landlord_id: '' }));
                }}
                error={formErrors.landlord_id}
                options={landlordsList.map((l) => ({ value: l.id, label: `${l.name} (${l.email})` }))}
              />
              <Input
                label="Property Name (Optional)"
                id="name"
                placeholder="e.g. Parsons House"
                value={newProperty.name}
                onChange={(e) => setNewProperty({ ...newProperty, name: e.target.value })}
                error={formErrors.name}
              />
              <Input
                label="Address Line 1"
                id="address_line1"
                required
                value={newProperty.address_line1}
                onChange={(e) => setNewProperty({ ...newProperty, address_line1: e.target.value })}
                error={formErrors.address_line1}
              />
              <Input
                label="Address Line 2"
                id="address_line2"
                value={newProperty.address_line2}
                onChange={(e) => setNewProperty({ ...newProperty, address_line2: e.target.value })}
                error={formErrors.address_line2}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="City"
                  id="city"
                  required
                  value={newProperty.city}
                  onChange={(e) => setNewProperty({ ...newProperty, city: e.target.value })}
                  error={formErrors.city}
                />
                <Input
                  label="Postcode"
                  id="postcode"
                  required
                  value={newProperty.postcode}
                  onChange={(e) => setNewProperty({ ...newProperty, postcode: e.target.value })}
                  error={formErrors.postcode}
                />
              </div>
              <Dropdown
                label="Property Type"
                id="property_type"
                placeholder="Select type..."
                value={newProperty.property_type}
                onChange={(val) => {
                  setNewProperty(prev => ({ ...prev, property_type: val }));
                  if (formErrors.property_type) setFormErrors(prev => ({ ...prev, property_type: '' }));
                }}
                error={formErrors.property_type}
                options={[
                  { value: 'flat', label: 'Flat' },
                  { value: 'house', label: 'House' },
                  { value: 'HMO', label: 'HMO' }
                ]}
              />
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Bedrooms"
                  id="bedrooms"
                  type="number"
                  value={newProperty.bedrooms}
                  onChange={(e) => setNewProperty({ ...newProperty, bedrooms: e.target.value })}
                  error={formErrors.bedrooms}
                />
                <Input
                  label="Monthly Rent"
                  id="rent_pcm"
                  type="number"
                  placeholder="£"
                  value={newProperty.rent_pcm}
                  onChange={(e) => setNewProperty({ ...newProperty, rent_pcm: e.target.value })}
                  error={formErrors.rent_pcm}
                />
                <Input
                  label="Mgmt Fee %"
                  id="mgmt_fee_pct"
                  type="number"
                  step="0.01"
                  placeholder="%"
                  value={newProperty.mgmt_fee_pct}
                  onChange={(e) => setNewProperty({ ...newProperty, mgmt_fee_pct: e.target.value })}
                  error={formErrors.mgmt_fee_pct}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Block Name (statements)"
                  id="block_name"
                  placeholder="e.g. PH"
                  value={newProperty.block_name}
                  onChange={(e) => setNewProperty({ ...newProperty, block_name: e.target.value })}
                  error={formErrors.block_name}
                />
                <Input
                  label="Apartment Number"
                  id="apartment_number"
                  placeholder="e.g. 12"
                  value={newProperty.apartment_number}
                  onChange={(e) => setNewProperty({ ...newProperty, apartment_number: e.target.value })}
                  error={formErrors.apartment_number}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Key Reference"
                  id="key_ref"
                  placeholder="e.g. KEY-PH-012"
                  value={newProperty.key_ref}
                  onChange={(e) => setNewProperty({ ...newProperty, key_ref: e.target.value })}
                  error={formErrors.key_ref}
                />
                <Input
                  label="Notes"
                  id="notes"
                  placeholder="Internal notes"
                  value={newProperty.notes}
                  onChange={(e) => setNewProperty({ ...newProperty, notes: e.target.value })}
                  error={formErrors.notes}
                />
              </div>

              <div className="flex gap-3 justify-end mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormErrors({});
                    setNewProperty({
                      landlord_id: '',
                      address_line1: '',
                      address_line2: '',
                      city: '',
                      postcode: '',
                      property_type: 'flat',
                      bedrooms: '',
                      rent_pcm: '',
                      mgmt_fee_pct: '12.00',
                      block_name: '',
                      apartment_number: '',
                      key_ref: '',
                      notes: '',
                      name: ''
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Add Property
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Property Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-card-border max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-brand-primary mb-4">Edit Property Details</h3>
            
            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <Input
                label="Property Name (Optional)"
                id="edit_name"
                placeholder="e.g. Parsons House"
                value={editingProperty.name}
                onChange={(e) => setEditingProperty({ ...editingProperty, name: e.target.value })}
                error={formErrors.name}
              />
              <Input
                label="Address Line 1"
                id="edit_address_line1"
                required
                value={editingProperty.address_line1}
                onChange={(e) => setEditingProperty({ ...editingProperty, address_line1: e.target.value })}
                error={formErrors.address_line1}
              />
              <Input
                label="Address Line 2"
                id="edit_address_line2"
                value={editingProperty.address_line2}
                onChange={(e) => setEditingProperty({ ...editingProperty, address_line2: e.target.value })}
                error={formErrors.address_line2}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="City"
                  id="edit_city"
                  required
                  value={editingProperty.city}
                  onChange={(e) => setEditingProperty({ ...editingProperty, city: e.target.value })}
                  error={formErrors.city}
                />
                <Input
                  label="Postcode"
                  id="edit_postcode"
                  required
                  value={editingProperty.postcode}
                  onChange={(e) => setEditingProperty({ ...editingProperty, postcode: e.target.value })}
                  error={formErrors.postcode}
                />
              </div>
              <Dropdown
                label="Property Type"
                id="edit_property_type"
                placeholder="Select type..."
                value={editingProperty.property_type}
                onChange={(val) => {
                  setEditingProperty(prev => ({ ...prev, property_type: val }));
                  if (formErrors.property_type) setFormErrors(prev => ({ ...prev, property_type: '' }));
                }}
                error={formErrors.property_type}
                options={[
                  { value: 'flat', label: 'Flat' },
                  { value: 'house', label: 'House' },
                  { value: 'HMO', label: 'HMO' }
                ]}
              />
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Bedrooms"
                  id="edit_bedrooms"
                  type="number"
                  value={editingProperty.bedrooms}
                  onChange={(e) => setEditingProperty({ ...editingProperty, bedrooms: e.target.value })}
                  error={formErrors.bedrooms}
                />
                <Input
                  label="Monthly Rent"
                  id="edit_rent_pcm"
                  type="number"
                  placeholder="£"
                  value={editingProperty.rent_pcm}
                  onChange={(e) => setEditingProperty({ ...editingProperty, rent_pcm: e.target.value })}
                  error={formErrors.rent_pcm}
                />
                <Input
                  label="Mgmt Fee %"
                  id="edit_mgmt_fee_pct"
                  type="number"
                  step="0.01"
                  placeholder="%"
                  value={editingProperty.mgmt_fee_pct}
                  onChange={(e) => setEditingProperty({ ...editingProperty, mgmt_fee_pct: e.target.value })}
                  error={formErrors.mgmt_fee_pct}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Block Name (statements)"
                  id="edit_block_name"
                  placeholder="e.g. PH"
                  value={editingProperty.block_name}
                  onChange={(e) => setEditingProperty({ ...editingProperty, block_name: e.target.value })}
                  error={formErrors.block_name}
                />
                <Input
                  label="Apartment Number"
                  id="edit_apartment_number"
                  placeholder="e.g. 12"
                  value={editingProperty.apartment_number}
                  onChange={(e) => setEditingProperty({ ...editingProperty, apartment_number: e.target.value })}
                  error={formErrors.apartment_number}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Key Reference"
                  id="edit_key_ref"
                  placeholder="e.g. KEY-PH-012"
                  value={editingProperty.key_ref}
                  onChange={(e) => setEditingProperty({ ...editingProperty, key_ref: e.target.value })}
                  error={formErrors.key_ref}
                />
                <Input
                  label="Notes"
                  id="edit_notes"
                  placeholder="Internal notes"
                  value={editingProperty.notes}
                  onChange={(e) => setEditingProperty({ ...editingProperty, notes: e.target.value })}
                  error={formErrors.notes}
                />
              </div>

              <Dropdown
                label="Property Status"
                id="edit_status"
                placeholder="Select status..."
                value={editingProperty.status}
                onChange={(val) => {
                  setEditingProperty(prev => ({ ...prev, status: val }));
                  if (formErrors.status) setFormErrors(prev => ({ ...prev, status: '' }));
                }}
                error={formErrors.status}
                options={[
                  { value: 'onboarding', label: 'Onboarding' },
                  { value: 'vacant', label: 'Vacant' },
                  { value: 'let', label: 'Let' }
                ]}
              />
              
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
