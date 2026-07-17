import { useState, useEffect } from 'react';
import { ClipboardCheck, CalendarClock, X } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { StatCard } from '../components/UI/StatCard';
import { Input } from '../components/UI/Input';
import { Dropdown } from '../components/UI/Dropdown';
import { useToast } from '../components/UI/ToastContext';
import { Skeleton } from '../components/UI/Skeleton';
import api from '../utilities/api';

const RATING_OPTIONS = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'satisfactory', label: 'Satisfactory' },
  { value: 'unsatisfactory', label: 'Unsatisfactory' },
];

const ratingStyle = {
  Excellent: 'bg-status-success-bg text-status-success border-status-success/15',
  Good: 'bg-status-success-bg text-status-success border-status-success/15',
  Satisfactory: 'bg-status-warning/10 text-status-warning border-status-warning/15',
  Unsatisfactory: 'bg-status-danger-bg text-status-danger border-status-danger/15',
};

const mapInspection = (i) => ({
  id: i.id,
  property: i.address_line1 ? `${i.address_line1}, ${i.city || ''}`.trim().replace(/,$/, '') : `Property #${i.property_id}`,
  inspector: i.inspected_by || '—',
  date: i.inspected_at ? new Date(i.inspected_at).toLocaleDateString('en-GB') : '—',
  nextDue: i.next_inspection_due ? new Date(i.next_inspection_due).toLocaleDateString('en-GB') : '—',
  nextDueRaw: i.next_inspection_due || null,
  rating: i.rating ? i.rating.charAt(0).toUpperCase() + i.rating.slice(1) : '—',
  notes: i.notes || '—',
});

export const Inspections = () => {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [tenancies, setTenancies] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const emptyForm = {
    property_id: '',
    tenancy_id: '',
    inspected_by: '',
    inspected_at: '',
    next_inspection_due: '',
    rating: '',
    notes: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  // Bump to re-fetch after logging an inspection.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const fetchInspections = async () => {
      try {
        const res = await api.get('/inspections');
        setInspections((res.data.data || []).map(mapInspection));
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load inspections', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchInspections();
  }, [addToast, reloadKey]);

  useEffect(() => {
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
    fetchProperties();
  }, []);

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

  const handlePropertyChange = (val) => {
    setForm(f => ({ ...f, property_id: val, tenancy_id: '' }));
    fetchTenanciesForProperty(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.property_id) errs.property_id = 'Select a property';
    if (!form.inspected_at) errs.inspected_at = 'Inspection date is required';
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }

    setFormErrors({});
    setSubmitting(true);
    try {
      await api.post('/inspections', {
        property_id: form.property_id,
        tenancy_id: form.tenancy_id || undefined,
        inspected_by: form.inspected_by || undefined,
        inspected_at: form.inspected_at,
        next_inspection_due: form.next_inspection_due || undefined,
        rating: form.rating || undefined,
        notes: form.notes || undefined,
      });
      addToast('Inspection logged', 'success');
      setIsModalOpen(false);
      setForm(emptyForm);
      setReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to log inspection', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const dueSoonCount = inspections.filter(i => i.nextDueRaw && new Date(i.nextDueRaw) <= in30Days).length;

  const columns = [
    { header: 'ID', accessor: 'id', sortable: true },
    { header: 'Property', accessor: 'property', sortable: true },
    { header: 'Inspector', accessor: 'inspector', sortable: true },
    { header: 'Inspected', accessor: 'date', sortable: true },
    { header: 'Next Due', accessor: 'nextDue', sortable: true },
    {
      header: 'Rating',
      accessor: 'rating',
      renderCell: (row) => (
        <span className={`px-2 py-0.5 text-2xs font-bold rounded-sm border ${
          ratingStyle[row.rating] || 'bg-surface-hover text-gray-400 border-card-border'
        }`}>
          {row.rating}
        </span>
      )
    },
    { header: 'Notes', accessor: 'notes' },
  ];

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      {/* Page actions (title lives in the layout header) */}
      <div className="flex justify-end">
        <Button variant="primary" icon={ClipboardCheck} onClick={() => setIsModalOpen(true)}>
          Log Inspection
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <StatCard
          label="Inspections Logged"
          value={`${inspections.length} Visit${inspections.length !== 1 ? 's' : ''}`}
          icon={ClipboardCheck}
          iconColor="text-status-success bg-status-success/10"
          valueColor="text-status-success"
        />
        <StatCard
          label="Due Within 30 Days"
          value={`${dueSoonCount} Inspection${dueSoonCount !== 1 ? 's' : ''}`}
          icon={CalendarClock}
          iconColor="text-status-warning bg-status-warning/10"
          valueColor="text-status-warning"
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
          <DataTable columns={columns} data={inspections} />
        )}
      </div>

      {/* Log Inspection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-card-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-primary">Log Property Inspection</h3>
              <button onClick={() => { setIsModalOpen(false); setFormErrors({}); }} className="text-gray-400 hover:text-brand-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-status-muted uppercase tracking-wide">Property <span className="text-status-danger">*</span></label>
                <Dropdown
                  id="i-property"
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
                  id="i-tenancy"
                  placeholder="Select tenancy..."
                  options={tenancies}
                  value={form.tenancy_id}
                  onChange={(val) => setForm(f => ({ ...f, tenancy_id: val }))}
                  disabled={!form.property_id}
                />
              </div>

              <Input
                label="Inspector"
                id="i-inspector"
                placeholder="e.g. Jane Doe (Roca Living)"
                value={form.inspected_by}
                onChange={(e) => setForm(f => ({ ...f, inspected_by: e.target.value }))}
              />

              <Input
                label="Inspection Date"
                id="i-date"
                type="date"
                required
                value={form.inspected_at}
                onChange={(e) => setForm(f => ({ ...f, inspected_at: e.target.value }))}
                error={formErrors.inspected_at}
              />

              <Input
                label="Next Inspection Due"
                id="i-next-due"
                type="date"
                value={form.next_inspection_due}
                onChange={(e) => setForm(f => ({ ...f, next_inspection_due: e.target.value }))}
              />

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-status-muted uppercase tracking-wide">Rating</label>
                <Dropdown
                  id="i-rating"
                  placeholder="Select rating..."
                  options={RATING_OPTIONS}
                  value={form.rating}
                  onChange={(val) => setForm(f => ({ ...f, rating: val }))}
                  clearable
                />
              </div>

              <Input
                label="Notes"
                id="i-notes"
                placeholder="Condition summary, issues found..."
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              />

              <div className="flex gap-3 justify-end mt-1">
                <Button type="button" variant="ghost" onClick={() => { setIsModalOpen(false); setFormErrors({}); }}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Log Inspection'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
