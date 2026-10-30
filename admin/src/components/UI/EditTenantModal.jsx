import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from './ToastContext';
import { Input } from './Input';
import { Dropdown } from './Dropdown';
import { Button } from './Button';
import { DatePicker } from './DatePicker';
import { todayYmd } from '../../utilities/designTokens';
import { RentDuePreview } from './RentDuePreview';
import api from '../../utilities/api';
import { DEPOSIT_SCHEME_OPTIONS } from '../../utilities/depositSchemes';
import { InfoTip } from './InfoTip';

const ordinal = (d) => `${d}${[11, 12, 13].includes(d % 100) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[d % 10] || 'th')}`;
const uk = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '—');
// Section heading with an optional ⓘ explanation.
const Section = ({ title, info }) => (
  <h4 className="text-sm-portal font-bold text-brand-primary flex items-center gap-1.5">{title}{info && <InfoTip text={info} />}</h4>
);

// Edit a tenant and their tenancy — the same popup from the Tenants list and
// the tenant page. Start date, rent and due day can be corrected until a
// statement exists (the rent months are rebuilt); after that rent changes go
// through Rent review and the start date is fixed. The deposit is added or
// corrected here too (amount, scheme, dates).
// onChangeDueDay: open the page's Change Due Day popup (offered once a statement exists).
export const EditTenantModal = ({ tenantId, onClose, onSaved, onChangeDueDay = null }) => {
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
          statements_from: t?.statements_from || '',
          deposit_amount: d.deposit ? String(parseFloat(d.deposit.tenancy_deposit)) : '',
          deposit_scheme: d.deposit?.scheme || 'TDS',
          deposit_received_at: d.deposit?.received_at || '',
          deposit_registered_at: d.deposit?.registered_at || '',
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
      if (form.statements_from && start && form.statements_from < start) errs.statements_from = 'Must be on or after the start date';
      const today = new Date().toLocaleDateString('en-CA');
      const wantsDeposit = !!data.deposit || String(form.deposit_amount).trim() !== '';
      if (wantsDeposit) {
        if (!(parseFloat(form.deposit_amount) > 0)) errs.deposit_amount = 'Enter the deposit amount';
        if (!form.deposit_received_at) errs.deposit_received_at = 'Enter the date it was received';
        else if (form.deposit_received_at > today) errs.deposit_received_at = 'Can\'t be in the future';
        if (form.deposit_registered_at && form.deposit_registered_at > today) errs.deposit_registered_at = 'Can\'t be in the future';
      }
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
        const opening = {};
        if (seqText !== String(t.last_statement_seq ?? '')) opening.last_statement_seq = seqText === '' ? null : Number(seqText);
        if ((form.statements_from || '') !== (t.statements_from || '')) opening.statements_from = form.statements_from || null;
        if (Object.keys(opening).length) {
          const res = await api.patch(`/tenancies/${t.id}/opening`, opening);
          if ('statements_from' in opening) message = res.data.message || message;
        }
        // Deposit: add one, or correct the one on record (only what changed).
        const dep = data.deposit;
        if (!dep && String(form.deposit_amount).trim() !== '') {
          const res = await api.post(`/tenancies/${t.id}/deposit`, {
            amount: parseFloat(form.deposit_amount), received_at: form.deposit_received_at, scheme: form.deposit_scheme,
          });
          if (form.deposit_registered_at) await api.patch(`/deposits/${res.data.data.id}`, { registered_at: form.deposit_registered_at });
        } else if (dep) {
          const change = {};
          if (parseFloat(form.deposit_amount) !== parseFloat(dep.tenancy_deposit)) change.tenancy_deposit = parseFloat(form.deposit_amount);
          if (form.deposit_scheme !== dep.scheme) change.scheme = form.deposit_scheme;
          if (form.deposit_received_at !== (dep.received_at || '')) change.received_at = form.deposit_received_at;
          if (form.deposit_registered_at !== (dep.registered_at || '')) change.registered_at = form.deposit_registered_at || null;
          if (Object.keys(change).length) await api.patch(`/deposits/${dep.id}`, change);
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
    <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl border border-card-border max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center px-6 pt-6 pb-4 border-b border-card-border shrink-0">
          <h3 className="text-lg font-bold text-brand-primary">Edit Tenant</h3>
          <button onClick={onClose} disabled={saving} className="text-gray-400 hover:text-brand-primary cursor-pointer" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {!form ? (
          <p className="text-sm text-status-muted py-8 text-center">Loading…</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col min-h-0">
            <div className="flex flex-col gap-4 px-6 py-5 overflow-y-auto min-h-0">
            <Section title="Tenant" />
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
              <DatePicker label="Right to Rent Expiry" id="edit-t-rtr-expiry" value={form.right_to_rent_expiry} onChange={set('right_to_rent_expiry')}
                hint="Only for a time-limited visa: re-check before this date. Blank for British/Irish tenants." />
            </div>
            {data.co_tenants?.length > 0 && (
              <p className="text-xs text-status-muted -mt-1">
                Joint {data.co_tenants.length === 1 ? 'tenant' : 'tenants'}: <b className="text-brand-primary">{data.co_tenants.map((c) => c.name).join(', ')}</b>. Open their page to edit their details.
              </p>
            )}

            {t && (
              <div className="border-t border-card-border pt-4 flex flex-col gap-4">
                <Section
                  title="Tenancy"
                  info={canFixSetup
                    ? 'No statement yet, so start date, rent and due day can be corrected. Recorded payments are kept.'
                    : 'A statement exists, so start date and rent are locked (change rent with Rent Review). The due day can still change.'}
                />
                {canFixSetup ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <DatePicker label="Start Date" id="edit-t-start" required value={form.start_date} onChange={set('start_date')} error={errors.start_date} />
                      <Input label="Rent (£ per month)" id="edit-t-rent" type="number" min="0" step="0.01" required value={form.rent_pcm} onChange={(e) => set('rent_pcm')(e.target.value)} error={errors.rent_pcm} />
                      <Input label="Rent due day" id="edit-t-due-day" type="number" min="1" max="28" required value={form.rent_due_day} onChange={(e) => set('rent_due_day')(e.target.value)} error={errors.rent_due_day} />
                    </div>
                    <RentDuePreview startDate={form.start_date} rent={form.rent_pcm} rentDueDay={form.rent_due_day} />
                  </>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface-light border border-card-border rounded-xl px-4 py-3">
                    <div>
                      <span className="block text-xs font-semibold text-status-muted">Start Date</span>
                      <span className="text-sm font-bold text-brand-primary">{uk(t.start_date)}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-status-muted">Rent</span>
                      <span className="text-sm font-bold text-brand-primary">£{parseFloat(t.rent_pcm).toLocaleString('en-GB', { minimumFractionDigits: 2 })} pcm</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-status-muted">Rent Due</span>
                      <span className="text-sm font-bold text-brand-primary">{ordinal(t.rent_due_day)} of each month</span>
                      {onChangeDueDay && (
                        <button type="button" onClick={() => { onClose(); onChangeDueDay(); }} className="ml-2 text-xs font-bold text-brand-accent hover:underline cursor-pointer">
                          Change
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DatePicker label="End Date" id="edit-t-end-date" min={form.start_date || null} value={form.end_date} onChange={set('end_date')} error={errors.end_date}
                    hint="Blank if it rolls on month to month (periodic)." />
                </div>
              </div>
            )}

            {t && (
              <div className="border-t border-card-border pt-4 flex flex-col gap-4">
                <Section title="Already Managed Before? (Optional)" info="For tenancies statemented by hand: earlier rent isn't counted as owed, and numbering continues after your last statement." />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DatePicker label="Rent Handled in Roca Living From" id="edit-t-statements-from" min={form.start_date || null} value={form.statements_from} onChange={set('statements_from')} error={errors.statements_from}
                    hint="For tenancies running before Roca Living. Unpaid rent months before this date are removed. Blank = from the start date." />
                  <Input
                    label="Last Statement Number Issued"
                    id="edit-t-last-seq"
                    inputMode="numeric"
                    placeholder="e.g. 3 for PH_33_0003"
                    value={form.last_statement_seq}
                    onChange={(e) => set('last_statement_seq')(e.target.value)}
                    error={errors.last_statement_seq}
                    hint="Only if statements were made by hand before Roca Living. Numbering continues after it."
                  />
                </div>
              </div>
            )}

            {t && (
              <div className="border-t border-card-border pt-4 flex flex-col gap-4" id="edit-t-deposit">
                <Section
                  title="Deposit"
                  info={data.deposit
                    ? `Must be registered within 30 days of receipt${data.deposit.registered_at ? '' : ` (by ${uk(data.deposit.register_due)})`}.`
                    : 'Optional. Enter the amount and date received to add one. Register it within 30 days.'}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Deposit amount (£)" id="edit-t-dep-amount" type="number" min="0" step="0.01" placeholder={data.deposit ? '' : 'Leave blank if none'} value={form.deposit_amount} onChange={(e) => set('deposit_amount')(e.target.value)} error={errors.deposit_amount} />
                  <Dropdown label="Scheme" id="edit-t-dep-scheme" options={DEPOSIT_SCHEME_OPTIONS} value={form.deposit_scheme} onChange={set('deposit_scheme')} />
                  <DatePicker label="Date received" id="edit-t-dep-received" max={todayYmd()} value={form.deposit_received_at} onChange={set('deposit_received_at')} error={errors.deposit_received_at} />
                  <DatePicker label="Registered with the scheme on" id="edit-t-dep-registered" min={form.deposit_received_at || null} max={todayYmd()} value={form.deposit_registered_at} onChange={set('deposit_registered_at')} error={errors.deposit_registered_at} />
                </div>
              </div>
            )}

            </div>
            <div className="flex gap-3 justify-end px-6 py-4 border-t border-card-border shrink-0">
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
