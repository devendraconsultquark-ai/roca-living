import { useState, useEffect } from 'react';
import { Droplet, CheckCircle2, Clock, X } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { StatCard } from '../components/UI/StatCard';
import { Input } from '../components/UI/Input';
import { Dropdown } from '../components/UI/Dropdown';
import { Skeleton } from '../components/UI/Skeleton';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

const UTILITY_TYPES = [
  { value: 'gas', label: 'Gas' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'water', label: 'Water' },
  { value: 'broadband', label: 'Broadband' },
  { value: 'council_tax', label: 'Council Tax' },
  { value: 'tv_licence', label: 'TV Licence' },
  { value: 'other', label: 'Other' },
];

const DIRECTION_OPTIONS = [
  { value: 'into_tenant', label: 'Into Tenant' },
  { value: 'out_of_tenant', label: 'Out of Tenant' },
  { value: 'to_landlord_void', label: 'To Landlord (Void)' },
];

const mapUtility = (u) => ({
  id: u.id,
  property: u.address_line1 ? `${u.address_line1}, ${u.city || ''}`.trim().replace(/,$/, '') : `Property #${u.property_id}`,
  provider: u.supplier || '—',
  account_ref: u.account_ref || '—',
  type: UTILITY_TYPES.find(t => t.value === u.utility_type)?.label || u.utility_type,
  date: u.handover_date ? new Date(u.handover_date).toLocaleDateString('en-GB') : '—',
  rawStatus: u.status,
  status: u.status === 'completed' ? 'Completed' : u.status === 'disputed' ? 'Disputed' : 'Pending Transfer',
});

export const Utilities = () => {
  const [utilities, setUtilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [tenancies, setTenancies] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    property_id: '',
    tenancy_id: '',
    utility_type: '',
    direction: '',
    supplier: '',
    account_ref: '',
    handover_date: '',
    meter_reading_in: '',
    meter_reading_out: '',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  const fetchUtilities = async () => {
    setLoading(true);
    try {
      const res = await api.get('/utilities');
      setUtilities((res.data.data || []).map(mapUtility));
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load utilities', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const res = await api.get('/properties');
      setProperties((res.data.data || []).map(p => ({
        value: p.id,
        label: `${p.address_line1}, ${p.city}`,
      })));
    } catch {
      // non-blocking
    }
  };

  const fetchTenanciesForProperty = async (propertyId) => {
    if (!propertyId) { setTenancies([]); return; }
    try {
      const res = await api.get(`/tenancies?property_id=${propertyId}`);
      setTenancies((res.data.data || []).map(t => ({
        value: t.id,
        label: `Tenancy #${t.id} — ${t.start_date ? new Date(t.start_date).toLocaleDateString('en-GB') : ''}`,
      })));
    } catch {
      setTenancies([]);
    }
  };

  useEffect(() => {
    fetchUtilities();
    fetchProperties();
  }, []);

  const handlePropertyChange = (val) => {
    setForm(f => ({ ...f, property_id: val, tenancy_id: '' }));
    fetchTenanciesForProperty(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.property_id) errs.property_id = 'Select a property';
    if (!form.utility_type) errs.utility_type = 'Select a utility type';
    if (!form.direction) errs.direction = 'Select a direction';
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }

    setFormErrors({});
    setSubmitting(true);
    try {
      await api.post('/utilities', {
        property_id: form.property_id,
        tenancy_id: form.tenancy_id || undefined,
        utility_type: form.utility_type,
        direction: form.direction,
        supplier: form.supplier || undefined,
        account_ref: form.account_ref || undefined,
        handover_date: form.handover_date || undefined,
        meter_reading_in: form.meter_reading_in || undefined,
        meter_reading_out: form.meter_reading_out || undefined,
        notes: form.notes || undefined,
      });
      addToast('Utility handover triggered!', 'success');
      setIsModalOpen(false);
      setForm({ property_id: '', tenancy_id: '', utility_type: '', direction: '', supplier: '', account_ref: '', handover_date: '', meter_reading_in: '', meter_reading_out: '', notes: '' });
      fetchUtilities();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to create utility handover', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (row, newStatus) => {
    try {
      await api.patch(`/utilities/${row.id}`, { status: newStatus });
      addToast(`Handover #${row.id} marked as ${newStatus}`, 'success');
      fetchUtilities();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update handover status', 'error');
    }
  };

  const completedCount = utilities.filter(u => u.status === 'Completed').length;
  const pendingCount = utilities.filter(u => u.status !== 'Completed').length;

  const columns = [
    { header: 'Handover ID', accessor: 'id', sortable: true },
    { header: 'Property Address', accessor: 'property', sortable: true },
    { header: 'Provider Name', accessor: 'provider', sortable: true },
    { header: 'Account Ref', accessor: 'account_ref' },
    { header: 'Utility Type', accessor: 'type', sortable: true },
    { header: 'Handover Date', accessor: 'date', sortable: true },
    {
      header: 'Transfer Status',
      accessor: 'status',
      renderCell: (row) => (
        <span className={`px-2 py-0.5 text-2xs font-bold rounded-sm border ${
          row.status === 'Completed'
            ? 'bg-status-success-bg text-status-success border-status-success/15'
            : row.status === 'Disputed'
              ? 'bg-status-danger-bg text-status-danger border-status-danger/15'
              : 'bg-status-warning/10 text-status-warning border-status-warning/15'
        }`}>
          {row.status}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: 'id',
      renderCell: (row) => (
        <div className="flex items-center gap-1">
          {row.rawStatus !== 'completed' && (
            <Button variant="ghost" size="sm" icon={CheckCircle2} onClick={() => handleStatusChange(row, 'completed')}>
              Complete
            </Button>
          )}
          {row.rawStatus === 'pending' && (
            <Button variant="ghost" size="sm" className="text-status-danger" onClick={() => handleStatusChange(row, 'disputed')}>
              Dispute
            </Button>
          )}
        </div>
      )
    },
  ];

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      {/* Page actions (title lives in the layout header) */}
      <div className="flex justify-end">
        <Button variant="primary" icon={Droplet} onClick={() => setIsModalOpen(true)}>
          Trigger Handover Transfer
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <StatCard
          label="Completed Transfers"
          value={`${completedCount} Account${completedCount !== 1 ? 's' : ''}`}
          icon={CheckCircle2}
          iconColor="text-status-success bg-status-success/10"
          valueColor="text-status-success"
        />
        <StatCard
          label="Pending Transfer Checks"
          value={`${pendingCount} Account${pendingCount !== 1 ? 's' : ''}`}
          icon={Clock}
          iconColor="text-status-warning bg-status-warning/10"
          valueColor="text-status-warning"
        />
      </div>

      {/* Grid container */}
      <div className="card-bg rounded-card border border-card-border p-4 shadow-premium">
        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton radius="bar" className="h-10 w-full" />
            <Skeleton radius="bar" className="h-16 w-full" />
            <Skeleton radius="bar" className="h-16 w-full" />
            <Skeleton radius="bar" className="h-16 w-full" />
          </div>
        ) : (
          <DataTable columns={columns} data={utilities} />
        )}
      </div>

      {/* Trigger Handover Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-card-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-primary">Trigger Utility Handover</h3>
              <button onClick={() => { setIsModalOpen(false); setFormErrors({}); }} className="text-gray-400 hover:text-brand-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-status-muted uppercase tracking-wide">Property <span className="text-status-danger">*</span></label>
                <Dropdown
                  id="u-property"
                  placeholder="Select property..."
                  options={properties}
                  value={form.property_id}
                  onChange={handlePropertyChange}
                  searchable
                />
                {formErrors.property_id && <span className="text-xs text-status-danger font-semibold">{formErrors.property_id}</span>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-status-muted uppercase tracking-wide">Tenancy (Optional)</label>
                <Dropdown
                  id="u-tenancy"
                  placeholder="Select tenancy..."
                  options={tenancies}
                  value={form.tenancy_id}
                  onChange={(val) => setForm(f => ({ ...f, tenancy_id: val }))}
                  disabled={!form.property_id}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-status-muted uppercase tracking-wide">Utility Type <span className="text-status-danger">*</span></label>
                <Dropdown
                  id="u-type"
                  placeholder="Select utility type..."
                  options={UTILITY_TYPES}
                  value={form.utility_type}
                  onChange={(val) => setForm(f => ({ ...f, utility_type: val }))}
                />
                {formErrors.utility_type && <span className="text-xs text-status-danger font-semibold">{formErrors.utility_type}</span>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-status-muted uppercase tracking-wide">Direction <span className="text-status-danger">*</span></label>
                <Dropdown
                  id="u-direction"
                  placeholder="Select direction..."
                  options={DIRECTION_OPTIONS}
                  value={form.direction}
                  onChange={(val) => setForm(f => ({ ...f, direction: val }))}
                />
                {formErrors.direction && <span className="text-xs text-status-danger font-semibold">{formErrors.direction}</span>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Supplier / Provider"
                  id="u-supplier"
                  placeholder="e.g. British Gas"
                  value={form.supplier}
                  onChange={(e) => setForm(f => ({ ...f, supplier: e.target.value }))}
                />
                <Input
                  label="Account Reference"
                  id="u-account-ref"
                  placeholder="e.g. BG-4471-9920"
                  value={form.account_ref}
                  onChange={(e) => setForm(f => ({ ...f, account_ref: e.target.value }))}
                />
              </div>

              <Input
                label="Handover Date"
                id="u-date"
                type="date"
                value={form.handover_date}
                onChange={(e) => setForm(f => ({ ...f, handover_date: e.target.value }))}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Meter Reading (In)"
                  id="u-meter-in"
                  placeholder="e.g. 04521.8"
                  value={form.meter_reading_in}
                  onChange={(e) => setForm(f => ({ ...f, meter_reading_in: e.target.value }))}
                />
                <Input
                  label="Meter Reading (Out)"
                  id="u-meter-out"
                  placeholder="e.g. 04619.2"
                  value={form.meter_reading_out}
                  onChange={(e) => setForm(f => ({ ...f, meter_reading_out: e.target.value }))}
                />
              </div>

              <Input
                label="Notes"
                id="u-notes"
                placeholder="Internal notes"
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              />

              <div className="flex gap-3 justify-end mt-1">
                <Button type="button" variant="ghost" onClick={() => { setIsModalOpen(false); setFormErrors({}); }}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Trigger Handover'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
