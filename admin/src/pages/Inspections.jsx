import { useState, useEffect } from 'react';
import { ClipboardCheck, CalendarClock, X } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { StatCard } from '../components/UI/StatCard';
import { Input } from '../components/UI/Input';
import { Dropdown } from '../components/UI/Dropdown';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

const RATING_OPTIONS = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'satisfactory', label: 'Satisfactory' },
  { value: 'unsatisfactory', label: 'Unsatisfactory' },
];

const ratingStyle = {
  Excellent: 'bg-status-success/10 text-status-success border-status-success/20',
  Good: 'bg-status-success/10 text-status-success border-status-success/20',
  Satisfactory: 'bg-status-warning/10 text-status-warning border-status-warning/20',
  Unsatisfactory: 'bg-status-danger/10 text-status-danger border-status-danger/20',
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const emptyForm = {
    property_id: '',
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
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
          ratingStyle[row.rating] || 'bg-gray-100 text-gray-500 border-gray-200'
        }`}>
          {row.rating}
        </span>
      )
    },
    { header: 'Notes', accessor: 'notes' },
  ];

  return (
    <div className="py-6 max-w-7xl mx-auto px-4 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Property Inspections</h2>
          <p className="text-sm text-gray-500 mt-1">Log routine inspections and track when the next visit is due. Inspections appear on the landlord portal.</p>
        </div>
        <Button variant="primary" icon={ClipboardCheck} className="shadow-sm" onClick={() => setIsModalOpen(true)}>
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
      <div className="bg-white rounded-2xl border border-border-color/60 p-4 shadow-sm">
        {loading ? (
          <div className="space-y-4 py-4">
            <div className="h-10 bg-gray-100/80 rounded-lg animate-pulse w-full" />
            <div className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" />
            <div className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" />
            <div className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" />
          </div>
        ) : (
          <DataTable columns={columns} data={inspections} />
        )}
      </div>

      {/* Log Inspection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-brand-primary/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-border-color">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[#1A1A1A]">Log Property Inspection</h3>
              <button onClick={() => { setIsModalOpen(false); setFormErrors({}); }} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Property <span className="text-status-danger">*</span></label>
                <Dropdown
                  id="i-property"
                  placeholder="Select property..."
                  options={properties}
                  value={form.property_id}
                  onChange={(val) => setForm(f => ({ ...f, property_id: val }))}
                  searchable
                />
                {formErrors.property_id && <span className="text-xs text-status-danger font-semibold">{formErrors.property_id}</span>}
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
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rating</label>
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
