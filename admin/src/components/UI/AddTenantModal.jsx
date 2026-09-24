import { useState, useEffect } from 'react';
import { UserPlus, Plus, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { DatePicker } from './DatePicker';
import { Dropdown } from './Dropdown';
import { useToast } from './ToastContext';
import api from '../../utilities/api';

const emptyTenant = () => ({ name: '', email: '', phone: '' });

// Add a tenant (tenancy) to an existing property: property, tenant(s), rent,
// start date (sets the rent due day) and an optional deposit. The full
// new-let wizard remains under Landlords → Onboarding for new landlords.
export const AddTenantModal = ({ onClose, onCreated }) => {
  const { addToast } = useToast();
  const [properties, setProperties] = useState([]);
  const [loadingProps, setLoadingProps] = useState(true);
  const [propertyId, setPropertyId] = useState('');
  const [tenants, setTenants] = useState([emptyTenant()]);
  const [rent, setRent] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositReceived, setDepositReceived] = useState('');
  // Opening position: tenancy already running and statemented by hand before this system.
  const [statementsFrom, setStatementsFrom] = useState('');
  const [lastSeq, setLastSeq] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/properties');
        setProperties(res.data.data || []);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load properties', 'error');
      } finally {
        setLoadingProps(false);
      }
    };
    load();
  }, [addToast]);

  const selectProperty = (id) => {
    setPropertyId(id);
    const p = properties.find((x) => String(x.id) === String(id));
    if (p?.rent_pcm && !rent) setRent(String(parseFloat(p.rent_pcm)));
  };

  const setTenant = (i, key, value) => setTenants((list) => list.map((t, idx) => (idx === i ? { ...t, [key]: value } : t)));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!propertyId) errs.property = 'Select a property';
    if (!tenants[0].name.trim()) errs.tenant = 'Lead tenant name is required';
    if (!(parseFloat(rent) > 0)) errs.rent = 'Enter the monthly rent';
    if (!startDate) errs.start = 'Start date is required';
    if (endDate && startDate && endDate < startDate) errs.end = 'End date must be after the start date';
    if (depositAmount && !depositReceived) errs.deposit = 'Enter the date the deposit was received';
    if (statementsFrom && startDate && statementsFrom < startDate) errs.statementsFrom = 'Must be on or after the start date';
    if (statementsFrom && startDate && statementsFrom.slice(8, 10) !== startDate.slice(8, 10)) errs.statementsFrom = 'Must be on the rent due day (same day of the month as the start date)';
    if (lastSeq !== '' && !(Number.isInteger(Number(lastSeq)) && Number(lastSeq) >= 0)) errs.lastSeq = 'Enter a whole number, e.g. 3';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setErrors({});
    setSaving(true);
    try {
      await api.post('/tenancies', {
        property_id: Number(propertyId),
        rent_pcm: parseFloat(rent),
        start_date: startDate,
        end_date: endDate || null,
        tenants: tenants
          .filter((t) => t.name.trim())
          .map((t, i) => ({ name: t.name.trim(), email: t.email.trim(), phone: t.phone.trim(), is_lead_tenant: i === 0 })),
        deposit: depositAmount ? { amount: parseFloat(depositAmount), received_at: depositReceived } : null,
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-card-border overflow-hidden my-8">
        <div className="bg-brand-primary text-white p-5 font-bold flex items-center gap-2 select-none">
          <UserPlus size={18} />
          <span>Add Tenant</span>
        </div>

        <form onSubmit={submit} className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
          <Dropdown
            label="Property"
            id="property"
            options={properties.map((p) => ({
              value: String(p.id),
              label: `${p.address_line1}${p.city ? ', ' + p.city : ''} · ${p.landlord_name || 'No landlord'}${p.status === 'let' ? ' · currently let' : ''}`,
            }))}
            value={propertyId}
            onChange={selectProperty}
            placeholder={loadingProps ? 'Loading properties...' : 'Search and select a property...'}
            searchable
            disabled={loadingProps}
            error={errors.property}
          />

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider">Tenant(s)</h3>
              <Button type="button" variant="ghost" size="sm" icon={Plus} onClick={() => setTenants((l) => [...l, emptyTenant()])}>
                Add joint tenant
              </Button>
            </div>
            {tenants.map((t, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                <Input
                  id={`tenant-name-${i}`}
                  label={i === 0 ? 'Lead Tenant Name' : 'Joint Tenant Name'}
                  required={i === 0}
                  value={t.name}
                  onChange={(e) => setTenant(i, 'name', e.target.value)}
                  placeholder="e.g. Mr Joshua Harrison North"
                  error={i === 0 ? errors.tenant : null}
                />
                <Input id={`tenant-email-${i}`} label="Email" type="email" value={t.email} onChange={(e) => setTenant(i, 'email', e.target.value)} />
                <Input id={`tenant-phone-${i}`} label="Phone" value={t.phone} onChange={(e) => setTenant(i, 'phone', e.target.value)} />
                {i > 0 ? (
                  <button
                    type="button"
                    onClick={() => setTenants((l) => l.filter((_, idx) => idx !== i))}
                    className="p-2.5 text-gray-400 hover:text-status-danger cursor-pointer"
                    aria-label="Remove tenant"
                  >
                    <Trash2 size={15} />
                  </button>
                ) : <span className="w-9" />}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <DatePicker label="Start Date" id="startDate" required value={startDate} onChange={setStartDate} error={errors.start} />
            <DatePicker label="End Date (optional)" id="endDate" value={endDate} onChange={setEndDate} error={errors.end} />
          </div>
          <p className="text-xs-portal text-status-muted -mt-2">
            Rent falls due on the start day each month — this also sets the statement period (e.g. 25th → 24th).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-card-border pt-4">
            <Input
              id="depositAmount"
              label="Deposit (£, optional)"
              type="number"
              step="0.01"
              min="0"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
            <DatePicker label="Deposit Received" id="depositReceived" value={depositReceived} onChange={setDepositReceived} error={errors.deposit} />
          </div>

          <div className="flex flex-col gap-2 border-t border-card-border pt-4">
            <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider">Already managed before? (optional)</h3>
            <p className="text-xs-portal text-status-muted">
              For a tenancy you have been statementing by hand: rent before the first period here is not counted as owed, and statement numbers continue after the last one you issued.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DatePicker label="First period in this system" id="statementsFrom" value={statementsFrom} onChange={setStatementsFrom} error={errors.statementsFrom} />
              <Input
                id="lastSeq"
                label="Last statement number issued"
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 3 for PH_33_0003"
                value={lastSeq}
                onChange={(e) => setLastSeq(e.target.value)}
                error={errors.lastSeq}
              />
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
