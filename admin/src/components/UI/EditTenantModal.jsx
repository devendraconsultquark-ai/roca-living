import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from './ToastContext';
import { Input } from './Input';
import { Dropdown } from './Dropdown';
import { Button } from './Button';
import { DatePicker } from './DatePicker';
import { RentDuePreview } from './RentDuePreview';
import api from '../../utilities/api';

const ordinal = (d) => `${d}${[11, 12, 13].includes(d % 100) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[d % 10] || 'th')}`;
const uk = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '—');
const Hint = ({ children }) => <p className="text-xs text-status-muted -mt-2">{children}</p>;

// Edit a tenant and their tenancy — the same popup from the Tenants list and
// the tenant page. Start date, rent and due day can be corrected until a
// statement exists (the rent months are rebuilt); after that rent changes go
// through Rent review and the start date is fixed.
export const EditTenantModal = ({ tenantId, onClose, onSaved }) => {
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get(`/tenancies/tenants/${tenantId}`)
      .then((res) => {
        if (cancelled) return;
        const d = res.data.data;
        const t = d.tenancy;
        setData(d);
        setForm({
          name: d.name || '',
          email: d.email || '',
          phone: d.phone || '',
          right_to_rent_status: d.right_to_rent_status || 'pending',
          right_to_rent_expiry: d.right_to_rent_expiry || '',
          start_date: t?.start_date || '',
          rent_pcm: t ? String(parseFloat(t.rent_pcm)) : '',
          rent_due_day: t ? String(t.rent_due_day) : '',
          end_date: t?.end_date || '',
          last_statement_seq: t?.last_statement_seq ?? '',
        });
      })
      .catch((err) => {
        if (cancelled) return;
        addToast(err.response?.data?.message || 'Failed to load the tenant', 'error');
        onClose();
      });
    return () => { cancelled = true; };
    // Load once per tenant; onClose is a new function on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  const t = data?.tenancy;
  const canFixSetup = t && !t.has_statement;

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Full name is required';
    const seqText = String(form.last_statement_seq ?? '').trim();
    if (t) {
      if (canFixSetup) {
        if (!form.start_date) errs.start_date = 'Enter the start date';
        if (!(parseFloat(form.rent_pcm) > 0)) errs.rent_pcm = 'Enter the monthly rent';
        const day = Number(form.rent_due_day);
        if (!(Number.isInteger(day) && day >= 1 && day <= 28)) errs.rent_due_day = 'A day from 1 to 28';
      }
      const start = canFixSetup ? form.start_date : t.start_date;
      if (form.end_date && start && form.end_date < start) errs.end_date = 'End date must be after the start date';
      if (seqText !== '' && !/^\d{1,4}$/.test(seqText)) errs.last_statement_seq = 'Enter a whole number, e.g. 3';
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setErrors({});
    setSaving(true);
    try {
      const { name, email, phone, right_to_rent_status, right_to_rent_expiry } = form;
      await api.patch(`/tenancies/tenants/${tenantId}`, { name, email, phone, right_to_rent_status, right_to_rent_expiry });
      let message = 'Tenant details updated successfully!';
      if (t) {
        if (canFixSetup && (form.start_date !== t.start_date || parseFloat(form.rent_pcm) !== parseFloat(t.rent_pcm) || Number(form.rent_due_day) !== Number(t.rent_due_day))) {
          const res = await api.patch(`/tenancies/${t.id}/setup`, {
            start_date: form.start_date, rent_pcm: form.rent_pcm, rent_due_day: Number(form.rent_due_day),
          });
          message = res.data.message || message;
        }
        if ((form.end_date || '') !== (t.end_date || '')) {
          await api.patch(`/tenancies/${t.id}`, { end_date: form.end_date || null });
        }
        if (seqText !== String(t.last_statement_seq ?? '')) {
          await api.patch(`/tenancies/${t.id}/opening`, { last_statement_seq: seqText === '' ? null : Number(seqText) });
        }
      }
      addToast(message, 'success');
      onSaved();
      onClose();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update tenant details', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-xl border border-card-border my-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-brand-primary">Edit Tenant Details</h3>
          <button onClick={onClose} disabled={saving} className="text-gray-400 hover:text-brand-primary cursor-pointer" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {!form ? (
          <p className="text-sm text-status-muted py-8 text-center">Loading…</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <h4 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider">Tenant</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Full Name" id="edit-t-name" required value={form.name} onChange={(e) => set('name')(e.target.value)} error={errors.name} />
              <Input label="Email Address" id="edit-t-email" type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} />
              <Input label="Phone Number" id="edit-t-phone" value={form.phone} onChange={(e) => set('phone')(e.target.value)} />
              <Dropdown
                label="Right to Rent Status"
                id="edit-t-rtr-status"
                placeholder="Select status"
                value={form.right_to_rent_status}
                onChange={set('right_to_rent_status')}
                options={[
                  { value: 'pending', label: 'Pending (not checked yet)' },
                  { value: 'verified', label: 'Approved (checked)' },
                  { value: 'failed', label: 'Rejected (failed)' },
                ]}
              />
              <div className="flex flex-col gap-3">
                <DatePicker label="Right to Rent Expiry" id="edit-t-rtr-expiry" value={form.right_to_rent_expiry} onChange={set('right_to_rent_expiry')} />
                <Hint>Only for tenants with time-limited permission (a visa) — re-check before this date. Blank for British/Irish tenants.</Hint>
              </div>
            </div>

            {t && (
              <div className="border-t border-card-border pt-4 flex flex-col gap-4">
                <h4 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider">Tenancy</h4>
                {canFixSetup ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <DatePicker label="Start Date" id="edit-t-start" required value={form.start_date} onChange={set('start_date')} error={errors.start_date} />
                      <Input label="Rent (£ per month)" id="edit-t-rent" type="number" min="0" step="0.01" required value={form.rent_pcm} onChange={(e) => set('rent_pcm')(e.target.value)} error={errors.rent_pcm} />
                      <Input label="Rent due day" id="edit-t-due-day" type="number" min="1" max="28" required value={form.rent_due_day} onChange={(e) => set('rent_due_day')(e.target.value)} error={errors.rent_due_day} />
                    </div>
                    <RentDuePreview startDate={form.start_date} rent={form.rent_pcm} rentDueDay={form.rent_due_day} />
                    <Hint>No statement has been made for this tenancy yet, so these can still be corrected — the rent months are rebuilt and payments already recorded are kept.</Hint>
                  </>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface-light border border-card-border rounded-xl px-4 py-3">
                    <div>
                      <span className="block text-xs font-semibold text-status-muted">Start date</span>
                      <span className="text-sm font-bold text-brand-primary">{uk(t.start_date)}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-status-muted">Rent</span>
                      <span className="text-sm font-bold text-brand-primary">£{parseFloat(t.rent_pcm).toLocaleString('en-GB', { minimumFractionDigits: 2 })} pcm</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-status-muted">Rent due</span>
                      <span className="text-sm font-bold text-brand-primary">{ordinal(t.rent_due_day)} of each month</span>
                    </div>
                    <p className="md:col-span-3 text-xs text-status-muted">
                      A statement has been made for this tenancy, so these are locked (issued statements never change).
                      Change the rent with <b>Rent review</b> on the Tenancies page; the start date is fixed.
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-3">
                    <DatePicker label="End Date" id="edit-t-end-date" value={form.end_date} onChange={set('end_date')} error={errors.end_date} />
                    <Hint>When the tenancy agreement ends. Leave blank if it rolls on month to month (periodic).</Hint>
                  </div>
                  <div className="flex flex-col gap-3">
                    <Input
                      label="Last statement number issued"
                      id="edit-t-last-seq"
                      inputMode="numeric"
                      placeholder="e.g. 3 for PH_33_0003"
                      value={form.last_statement_seq}
                      onChange={(e) => set('last_statement_seq')(e.target.value)}
                      error={errors.last_statement_seq}
                    />
                    <Hint>Only if this flat had statements made by hand before this system — numbering here continues after it. Otherwise leave blank.</Hint>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end mt-1">
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
