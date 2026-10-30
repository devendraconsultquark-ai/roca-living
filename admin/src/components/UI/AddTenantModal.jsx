import { useState, useEffect } from 'react';
import { UserPlus, Plus, Trash2, X } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { DatePicker } from './DatePicker';
import { todayYmd } from '../../utilities/designTokens';
import { Dropdown } from './Dropdown';
import { useToast } from './ToastContext';
import api from '../../utilities/api';
import { DEPOSIT_SCHEME_OPTIONS } from '../../utilities/depositSchemes';
import { RentDuePreview } from './RentDuePreview';
import { InfoTip } from './InfoTip';

const emptyTenant = () => ({ name: '', email: '', phone: '', right_to_rent_status: 'pending', right_to_rent_expiry: '' });
// Same choices as Edit Tenant.
const RTR_OPTIONS = [
  { value: 'pending', label: 'Pending (not checked yet)' },
  { value: 'verified', label: 'Approved (checked)' },
  { value: 'failed', label: 'Rejected (failed)' },
];
// Section heading with an optional ⓘ explanation (as in Edit Tenant).
const Section = ({ title, info, children }) => (
  <div className="flex items-center justify-between gap-3">
    <h4 className="text-sm-portal font-bold text-brand-primary flex items-center gap-1.5">{title}{info && <InfoTip text={info} />}</h4>
    {children}
  </div>
);

// Add a tenant (tenancy) to an existing property: property, tenant(s), rent,
// start date (sets the rent due day) and an optional deposit. Apartments come
// from ROCA Estates; only the ones switched to "Managed by ROCA Living" on the
// Properties page are offered (their landlord is settled there).
export const AddTenantModal = ({ onClose, onCreated }) => {
  const { addToast } = useToast();
  const [properties, setProperties] = useState([]);
  const [loadingProps, setLoadingProps] = useState(true);
  const [propertyId, setPropertyId] = useState('');
  const [tenants, setTenants] = useState([emptyTenant()]);
  const [rent, setRent] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // Optional: rent due on a different day than the start day (pro-rata first payment).
  const [rentDueDay, setRentDueDay] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositReceived, setDepositReceived] = useState('');
  const [depositScheme, setDepositScheme] = useState('TDS');
  const [depositRegistered, setDepositRegistered] = useState('');
  // Opening position: tenancy already running and statemented by hand before this system.
  const [statementsFrom, setStatementsFrom] = useState('');
  const [lastSeq, setLastSeq] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/estates/properties');
        setProperties((res.data.data || []).filter((p) => p.roca_living?.managed));
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load apartments from ROCA Estates', 'error');
      } finally {
        setLoadingProps(false);
      }
    };
    load();
  }, [addToast]);

  const selectProperty = (id) => {
    setPropertyId(id);
    const p = properties.find((x) => String(x.id) === String(id));
    if (p?.roca_living?.rent_pcm && !rent) setRent(String(parseFloat(p.roca_living.rent_pcm)));
  };

  const setTenant = (i, key, value) => setTenants((list) => list.map((t, idx) => (idx === i ? { ...t, [key]: value } : t)));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!propertyId) errs.property = 'Select an apartment';
    if (!tenants[0].name.trim()) errs.tenant = 'Lead tenant name is required';
    if (!(parseFloat(rent) > 0)) errs.rent = 'Enter the monthly rent';
    if (!startDate) errs.start = 'Start date is required';
    if (endDate && startDate && endDate < startDate) errs.end = 'End date must be after the start date';
    if (rentDueDay !== '' && !(Number.isInteger(Number(rentDueDay)) && Number(rentDueDay) >= 1 && Number(rentDueDay) <= 28)) errs.rentDueDay = 'A day from 1 to 28';
    if (depositAmount && !depositReceived) errs.deposit = 'Enter the date the deposit was received';
    if (depositRegistered && depositReceived && depositRegistered < depositReceived) errs.depositRegistered = 'Can\'t be before the date received';
    const dueDay = rentDueDay !== '' ? Number(rentDueDay) : Number(startDate.slice(8, 10));
    if (statementsFrom && startDate && statementsFrom < startDate) errs.statementsFrom = 'Must be on or after the start date';
    else if (statementsFrom && startDate && Number(statementsFrom.slice(8, 10)) !== dueDay) errs.statementsFrom = `Must be on the rent due day (the ${dueDay}${[11, 12, 13].includes(dueDay) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[dueDay % 10] || 'th')})`;
    if (lastSeq !== '' && !(Number.isInteger(Number(lastSeq)) && Number(lastSeq) >= 0)) errs.lastSeq = 'Enter a whole number, e.g. 3';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setErrors({});
    setSaving(true);
    try {
      await api.post('/tenancies', {
        rocaem_property_id: Number(propertyId),
        rent_pcm: parseFloat(rent),
        start_date: startDate,
        end_date: endDate || null,
        rent_due_day: rentDueDay === '' ? null : Number(rentDueDay),
        tenants: tenants
          .filter((t) => t.name.trim())
          .map((t, i) => ({
            name: t.name.trim(), email: t.email.trim(), phone: t.phone.trim(), is_lead_tenant: i === 0,
            right_to_rent_status: t.right_to_rent_status, right_to_rent_expiry: t.right_to_rent_expiry || null,
          })),
        deposit: depositAmount
          ? { amount: parseFloat(depositAmount), received_at: depositReceived, scheme: depositScheme, registered_at: depositRegistered || null }
          : null,
        statements_from: statementsFrom || null,
        last_statement_seq: lastSeq === '' ? null : Number(lastSeq),
      });
      addToast('Tenant added and rent schedule created', 'success');
      onCreated();
      onClose();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to add tenant', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl border border-card-border overflow-hidden my-8">
        <div className="bg-brand-primary text-white p-5 font-bold flex items-center gap-2 select-none">
          <UserPlus size={18} />
          <span>Add Tenant</span>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="ml-auto p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-50"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
          <Dropdown
            label="Apartment (ROCA Estates)"
            id="property"
            options={properties.map((p) => ({
              value: String(p.id),
              // "PH-33 · Parsons House - Unit 33 · Landlord: …"
              label: [
                p.unit_ref,
                p.name,
                p.landlord_name ? `Landlord: ${p.landlord_name}` : null,
                p.roca_living?.has_tenant ? 'already has a tenant' : null,
              ].filter(Boolean).join(' · '),
            }))}
            value={propertyId}
            onChange={selectProperty}
            placeholder={loadingProps ? 'Loading apartments...' : (properties.length ? 'Search and select an apartment...' : 'No managed apartments yet')}
            searchable
            disabled={loadingProps}
            error={errors.property}
          />

          <p className="text-xs-portal text-status-muted -mt-3">
            Apartment not listed? Switch on <span className="font-semibold">Managed by ROCA Living</span> for it on the Properties page first.
          </p>

          {/* Same sections, order and labels as Edit Tenant. */}
          <div className="flex flex-col gap-4">
            <Section title="Tenant">
              <Button type="button" variant="ghost" size="sm" icon={Plus} onClick={() => setTenants((l) => [...l, emptyTenant()])}>
                Add Joint Tenant
              </Button>
            </Section>
            {tenants.map((t, i) => (
              <div key={i} className={`flex flex-col gap-3 ${i > 0 ? 'border-t border-dashed border-card-border pt-3' : ''}`}>
                {i > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-status-muted">Joint Tenant {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => setTenants((l) => l.filter((_, idx) => idx !== i))}
                      className="p-1.5 text-gray-400 hover:text-status-danger cursor-pointer"
                      aria-label="Remove tenant"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    id={`tenant-name-${i}`}
                    label="Full Name"
                    required={i === 0}
                    value={t.name}
                    onChange={(e) => setTenant(i, 'name', e.target.value)}
                    placeholder="e.g. Mr Joshua Harrison North"
                    error={i === 0 ? errors.tenant : null}
                  />
                  <Input id={`tenant-email-${i}`} label="Email Address" type="email" value={t.email} onChange={(e) => setTenant(i, 'email', e.target.value)} />
                  <Input id={`tenant-phone-${i}`} label="Phone Number" value={t.phone} onChange={(e) => setTenant(i, 'phone', e.target.value)} />
                  <Dropdown
                    label="Right to Rent Status"
                    id={`tenant-rtr-${i}`}
                    options={RTR_OPTIONS}
                    value={t.right_to_rent_status}
                    onChange={(v) => setTenant(i, 'right_to_rent_status', v)}
                  />
                  <DatePicker label="Right to Rent Expiry" id={`tenant-rtr-expiry-${i}`} value={t.right_to_rent_expiry} onChange={(v) => setTenant(i, 'right_to_rent_expiry', v)}
                    hint="Only for a time-limited visa: re-check before this date. Blank for British/Irish tenants." />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4 border-t border-card-border pt-4">
            <Section title="Tenancy" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DatePicker label="Start Date" id="startDate" required value={startDate} onChange={setStartDate} error={errors.start} />
              <Input
                id="rent"
                label="Rent (£ per month)"
                type="number"
                step="0.01"
                min="0"
                required
                value={rent}
                onChange={(e) => setRent(e.target.value)}
                error={errors.rent}
              />
              <Input
                id="rentDueDay"
                label="Rent due day"
                type="number"
                min="1"
                max="28"
                step="1"
                placeholder="Start day"
                value={rentDueDay}
                onChange={(e) => setRentDueDay(e.target.value)}
                error={errors.rentDueDay}
                hint="Blank = the same day as the start date. Another day gives a pro-rata first payment."
              />
            </div>
            <RentDuePreview startDate={startDate} rent={rent} rentDueDay={rentDueDay} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DatePicker label="End Date" id="endDate" min={startDate || null} value={endDate} onChange={setEndDate} error={errors.end}
                hint="Blank if it rolls on month to month (periodic)." />
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-card-border pt-4">
            <Section title="Already Managed Before? (Optional)" info="For tenancies statemented by hand: earlier rent isn't counted as owed, and numbering continues after your last statement." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DatePicker label="Rent Handled in Roca Living From" id="statementsFrom" min={startDate || null} value={statementsFrom} onChange={setStatementsFrom} error={errors.statementsFrom}
                hint="For tenancies running before Roca Living. Unpaid rent months before this date are removed. Blank = from the start date." />
              <Input
                id="lastSeq"
                label="Last Statement Number Issued"
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 3 for PH_33_0003"
                value={lastSeq}
                onChange={(e) => setLastSeq(e.target.value)}
                error={errors.lastSeq}
                hint="Only if statements were made by hand before Roca Living. Numbering continues after it."
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-card-border pt-4">
            <Section title="Deposit" info="Optional. Enter the amount and date received to add one. Register it within 30 days." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                id="depositAmount"
                label="Deposit amount (£)"
                type="number"
                step="0.01"
                min="0"
                placeholder="Leave blank if none"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              <Dropdown label="Scheme" id="depositScheme" options={DEPOSIT_SCHEME_OPTIONS} value={depositScheme} onChange={setDepositScheme} />
              <DatePicker label="Date received" id="depositReceived" max={todayYmd()} value={depositReceived} onChange={setDepositReceived} error={errors.deposit} />
              <DatePicker label="Registered with the scheme on" id="depositRegistered" min={depositReceived || null} max={todayYmd()} value={depositRegistered} onChange={setDepositRegistered} error={errors.depositRegistered} />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving...' : 'Add Tenant'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
