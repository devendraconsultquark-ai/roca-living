import { useState, useEffect } from 'react';
import { X, Home, ShieldCheck, FileText } from 'lucide-react';
import { Input } from './Input';
import { Dropdown } from './Dropdown';
import { DatePicker } from './DatePicker';
import { Button } from './Button';
import { useToast } from './ToastContext';
import { useConfirm } from './ConfirmContext';
import api from '../../utilities/api';

// Add or edit a ROCA Estates apartment from Roca Living (client decision 21 Oct).
// Saved through ROCA Estates' own API, which makes its unit code (PH_08) and
// reference (REM-APR-…). Same tabs as ROCA Estates' apartment form. Service
// charge, purchase price and block accounting stay in ROCA Estates (RL-033).
// Block and unit number are set once, when adding: statement numbers are built
// from them. An edit sends only the fields that changed.

const TABS = [
  ['unit', 'Apartment Profile', Home],
  ['compliance', 'Compliance Hub', ShieldCheck],
  ['lease', 'Lease & Financials', FileText],
];
// The tab a field with a mistake is on, so the form can open it.
const FIELD_TAB = { lease_term_years: 'lease', ground_rent_amount: 'lease' };

const blank = (v) => (v === null || v === undefined ? '' : String(v));
const opts = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const STATUS = opts([['LET', 'Let'], ['STL', 'STL'], ['VACANT', 'Vacant']]);
const OWNERSHIP = opts([['PERSONAL', 'Personal Name'], ['COMPANY', 'Company Structure']]);
const UNIT_TYPES = opts([['STUDIO', 'Studio'], ['1_BED', '1 Bed'], ['2_BED', '2 Bed'], ['3_BED', '3 Bed'], ['3_BED_DUPLEX', '3 Bed Duplex']]);
const HEATING = opts([['ELECTRIC', 'Electric'], ['GAS', 'Gas']]);
const TENURE = opts([['LEASEHOLD', 'Leasehold'], ['FREEHOLD', 'Freehold']]);
const YES_NO = opts([['yes', 'Yes'], ['no', 'No']]);
const ALLOWED = opts([['YES', 'Yes'], ['NO', 'No'], ['RESTRICTED', 'Restricted']]);
const EPC = opts(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((r) => [r, r]));
const EICR = opts([['PASS', 'Pass'], ['FAIL', 'Fail']]);

const toForm = (u) => ({
  building_id: blank(u?.building_id),
  unit_number: blank(u?.unit_number),
  name: blank(u?.name),
  floor_number: blank(u?.floor_number),
  status: blank(u?.status) || 'VACANT',
  ownership_structure: blank(u?.ownership_structure) || 'PERSONAL',
  landlord_id: blank(u?.landlord_id),
  address: blank(u?.address),
  city: blank(u?.city),
  postcode: blank(u?.postcode),
  unit_type: blank(u?.unit_type),
  internal_area: blank(u?.internal_area),
  heating_type: blank(u?.heating_type),
  tenure_type: blank(u?.tenure_type),
  has_parking: u?.has_parking ? 'yes' : 'no',
  parking_space: blank(u?.parking_space),
  epc_rating: blank(u?.epc_rating),
  epc_start_date: blank(u?.epc_start_date),
  epc_expiry_date: blank(u?.epc_expiry_date),
  eicr_status: blank(u?.eicr_status),
  eicr_start_date: blank(u?.eicr_start_date),
  eicr_expiry_date: blank(u?.eicr_expiry_date),
  smoke_detector_date: blank(u?.smoke_detector_date),
  sprinkler_date: blank(u?.sprinkler_date),
  lease_start_date: blank(u?.lease_start_date),
  lease_end_date: blank(u?.lease_end_date),
  lease_term_years: blank(u?.lease_term_years),
  land_registry_title_no: blank(u?.land_registry_title_no),
  ground_rent_amount: blank(u?.ground_rent_amount),
  subletting_allowed: blank(u?.subletting_allowed) || 'YES',
  pets_allowed: blank(u?.pets_allowed) || 'YES',
});

const toPayload = (f) => ({ ...f, has_parking: f.has_parking === 'yes' });

const validate = (f, isEdit) => {
  const e = {};
  if (!isEdit && !f.building_id) e.building_id = 'Choose the block';
  if (!isEdit && !f.unit_number.trim()) e.unit_number = 'Unit number is required';
  if (!f.name.trim()) e.name = 'Apartment name is required';
  if (f.internal_area && Number.isNaN(Number(f.internal_area))) e.internal_area = 'Enter a number';
  if (f.lease_term_years && !/^\d+$/.test(f.lease_term_years)) e.lease_term_years = 'Whole years';
  if (f.ground_rent_amount && Number.isNaN(Number(f.ground_rent_amount))) e.ground_rent_amount = 'Enter an amount';
  return e;
};

const GroupTitle = ({ children }) => (
  <h4 className="text-[11px] font-bold text-status-muted uppercase tracking-wider">{children}</h4>
);

// The next free unit number in a block (as ROCA Estates' own form suggests).
const nextUnitNumber = (units, buildingId) => {
  const max = units
    .filter((u) => String(u.building_id) === String(buildingId))
    .reduce((m, u) => Math.max(m, parseInt(u.unit_number, 10) || 0), 0);
  return String(max + 1);
};

// The form itself, once the apartment (when editing) and the lists are loaded.
const ApartmentFormBody = ({ apartment, buildings, landlords, units, onClose, onSaved }) => {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const isEdit = !!apartment;
  const [initial] = useState(() => toPayload(toForm(apartment)));
  const [form, setForm] = useState(() => toForm(apartment));
  const [manage, setManage] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('unit');

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e?.target ? e.target.value : e }));
  const field = (name, label, props = {}) => (
    <Input id={`apt_${name}`} label={label} value={form[name]} onChange={set(name)} error={errors[name]} {...props} />
  );
  const select = (name, label, options, props = {}) => (
    <Dropdown id={`apt_${name}`} label={label} options={options} value={form[name]} onChange={set(name)} error={errors[name]} {...props} />
  );
  const date = (name, label) => <DatePicker id={`apt_${name}`} label={label} value={form[name]} onChange={set(name)} />;

  // Choosing the block suggests the next unit number, the name and the block's address.
  const chooseBlock = (id) => {
    const b = buildings.find((x) => String(x.id) === String(id));
    setForm((f) => {
      const unit = nextUnitNumber(units, id);
      const autoName = (n) => (b ? `${b.name} - Unit ${n}` : '');
      return {
        ...f,
        building_id: id,
        unit_number: unit,
        name: !f.name || f.name === autoName(f.unit_number) ? autoName(unit) : f.name,
        address: f.address || b?.address || '',
        city: f.city || b?.city || '',
        postcode: f.postcode || b?.postcode || '',
      };
    });
  };
  const changeUnitNumber = (e) => {
    const n = e.target.value;
    const b = buildings.find((x) => String(x.id) === String(form.building_id));
    setForm((f) => ({ ...f, unit_number: n, name: b && f.name === `${b.name} - Unit ${f.unit_number}` ? `${b.name} - Unit ${n}` : f.name }));
  };

  const send = async (body, extra = {}) => (isEdit
    ? api.patch(`/estates/properties/${apartment.id}`, { ...body, ...extra })
    : api.post('/estates/properties', body));

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(form, isEdit);
    setErrors(found);
    const firstError = Object.keys(found)[0];
    if (firstError) {
      setTab(FIELD_TAB[firstError] || 'unit');
      return;
    }

    const payload = toPayload(form);
    let body;
    if (isEdit) {
      body = Object.fromEntries(Object.entries(payload).filter(([k, v]) => v !== initial[k] && k !== 'building_id' && k !== 'unit_number'));
      if (!Object.keys(body).length) {
        addToast('Nothing changed', 'info');
        onClose();
        return;
      }
    } else {
      body = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== '' && v !== false));
    }

    setSaving(true);
    try {
      let res;
      try {
        res = await send(body);
      } catch (err) {
        // A managed apartment with a tenant: confirm the change of owner first.
        if (err.response?.status !== 409 || !isEdit) throw err;
        const ok = await confirm({
          title: 'Change the owner of a let apartment?',
          message: err.response.data.message,
          confirmText: 'Change owner',
          variant: 'danger',
        });
        if (!ok) return;
        res = await send(body, { confirm_owner_change: true });
      }
      const id = res.data.data?.id || apartment?.id;
      addToast(res.data.message, 'success');
      // The apartment exists now: a failed "manage" is reported, not retried.
      let propertyId = null;
      if (!isEdit && manage) {
        try {
          const managed = await api.patch(`/estates/properties/${id}/managed`, { managed: true });
          propertyId = managed.data.data.property_id;
        } catch (err) {
          addToast(`Added, but not managed yet: ${err.response?.data?.message || 'try "Manage with ROCA Living" on its page'}`, 'error');
        }
      }
      onSaved({ id, propertyId });
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not save the apartment in ROCA Estates', 'error');
    } finally {
      setSaving(false);
    }
  };

  const block = buildings.find((b) => String(b.id) === String(form.building_id));
  const landlordOptions = [
    { value: '', label: 'Unassigned' },
    ...landlords
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map((l) => ({ value: String(l.id), label: l.email ? `${l.name} · ${l.email}` : l.name })),
  ];

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl border border-card-border max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-start gap-3 px-6 pt-6 pb-4 border-b border-card-border">
          <div>
            <h3 className="text-lg font-bold text-brand-primary">{isEdit ? 'Edit Apartment Details' : 'Add New Property'}</h3>
            <p className="text-[11px] text-status-muted mt-1">
              Saved in ROCA Estates, so both apps show the same apartment. ROCA Estates gives it its unit code and reference.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="text-gray-400 hover:text-brand-primary cursor-pointer disabled:opacity-50" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col min-h-0">
          <div className="px-6 pt-4 flex gap-6 border-b border-card-border overflow-x-auto" role="tablist">
            {TABS.map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 pb-3 -mb-px border-b-2 text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  tab === key ? 'border-brand-primary text-brand-primary' : 'border-transparent text-status-muted hover:text-brand-primary'
                }`}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>

          <div className="px-6 py-5 overflow-y-auto min-h-[420px]">
            {tab === 'unit' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex flex-col gap-4">
                  <GroupTitle>Identity</GroupTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {isEdit ? (
                      <>
                        <Input id="apt_block" label="Parent Block" value={apartment.building_name || '—'} disabled />
                        <Input id="apt_unit" label="Unit" value={apartment.unit_ref || blank(apartment.unit_number)} disabled />
                      </>
                    ) : (
                      <>
                        <Dropdown
                          id="apt_building_id"
                          label="Parent Block"
                          options={buildings.map((b) => ({ value: String(b.id), label: b.name }))}
                          value={form.building_id}
                          onChange={chooseBlock}
                          error={errors.building_id}
                          placeholder="Choose the block…"
                        />
                        <Input id="apt_unit_number" label="Unit Number" value={form.unit_number} onChange={changeUnitNumber} error={errors.unit_number} required />
                      </>
                    )}
                  </div>
                  {field('name', 'Apartment Name', { required: true })}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {field('floor_number', 'Floor', { placeholder: 'e.g. 1' })}
                    {select('status', 'Current Status', STATUS)}
                    {select('ownership_structure', 'Ownership', OWNERSHIP)}
                    {select('landlord_id', 'Link Landlord', landlordOptions, { searchable: true })}
                  </div>
                  {!isEdit && block && (
                    <p className="text-[11px] text-status-muted">
                      Unit code will be {block.short_code || 'BLD'}_{String(form.unit_number || '').padStart(2, '0')}; the reference (REM-APR-…) is added by ROCA Estates.
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-4 border border-card-border rounded-card p-5">
                    <GroupTitle>Location Details</GroupTitle>
                    {field('address', 'Address')}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {field('city', 'City')}
                      {field('postcode', 'Postcode')}
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <GroupTitle>Specifications</GroupTitle>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {select('unit_type', 'Type', UNIT_TYPES)}
                      {field('internal_area', 'Area (sqft)')}
                      {select('heating_type', 'Heating', HEATING)}
                      {select('tenure_type', 'Tenure', TENURE)}
                      {select('has_parking', 'Parking', YES_NO)}
                      {form.has_parking === 'yes' && field('parking_space', 'Parking Space')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'compliance' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex flex-col gap-4 border border-card-border rounded-card p-5">
                  <GroupTitle>Energy Performance (EPC)</GroupTitle>
                  {select('epc_rating', 'Rating', EPC)}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {date('epc_start_date', 'Valid From')}
                    {date('epc_expiry_date', 'Expiry Date')}
                  </div>
                </div>
                <div className="flex flex-col gap-4 border border-card-border rounded-card p-5">
                  <GroupTitle>Electrical (EICR)</GroupTitle>
                  {select('eicr_status', 'Outcome', EICR)}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {date('eicr_start_date', 'Test Date')}
                    {date('eicr_expiry_date', 'Expiry Date')}
                  </div>
                </div>
                <div className="flex flex-col gap-4 border border-card-border rounded-card p-5">
                  <GroupTitle>Smoke Detectors</GroupTitle>
                  {date('smoke_detector_date', 'Last Tested')}
                </div>
                <div className="flex flex-col gap-4 border border-card-border rounded-card p-5">
                  <GroupTitle>Sprinklers</GroupTitle>
                  {date('sprinkler_date', 'Last Serviced')}
                </div>
                <p className="lg:col-span-2 text-[11px] text-status-muted">
                  Certificate files for let apartments are kept in Roca Living, on the property&apos;s Safety &amp; Compliance tab.
                </p>
              </div>
            )}

            {tab === 'lease' && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4">
                  <GroupTitle>Lease</GroupTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {date('lease_start_date', 'Lease Start Date')}
                    {date('lease_end_date', 'Lease End Date')}
                    {field('lease_term_years', 'Lease Term (Years)')}
                    {field('land_registry_title_no', 'Land Registry Title No', { placeholder: 'e.g. TGL12345' })}
                    {field('ground_rent_amount', 'Ground Rent Amount (£)')}
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <GroupTitle>Rules</GroupTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {select('subletting_allowed', 'Subletting Allowed', ALLOWED)}
                    {select('pets_allowed', 'Pets Allowed', ALLOWED)}
                  </div>
                </div>
                <p className="text-[11px] text-status-muted">
                  Service charge, purchase price and block accounting are kept in ROCA Estates.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 justify-end p-6 pt-4 border-t border-card-border">
            {!isEdit && (
              <label className="mr-auto flex items-center gap-2 text-sm text-brand-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={manage}
                  onChange={(e) => setManage(e.target.checked)}
                  disabled={!form.landlord_id}
                  className="w-4 h-4 accent-brand-accent cursor-pointer disabled:cursor-not-allowed"
                />
                <span className={form.landlord_id ? '' : 'text-status-muted'}>
                  Manage with ROCA Living now{form.landlord_id ? '' : ' (link a landlord first)'}
                </span>
              </label>
            )}
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Property'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// rocaemId: the ROCA Estates apartment to edit, or nothing to add one.
// units: the apartment list (for the next free unit number when adding).
// onSaved({ id, propertyId }): propertyId when "Manage with ROCA Living" was ticked.
export const EstatesApartmentForm = ({ rocaemId, units = [], onClose, onSaved }) => {
  const [lists, setLists] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [b, l, a] = await Promise.all([
          api.get('/estates/buildings'),
          api.get('/estates/landlords'),
          rocaemId ? api.get(`/estates/properties/${rocaemId}`) : Promise.resolve(null),
        ]);
        setLists({ buildings: b.data.data || [], landlords: l.data.data || [], apartment: a ? a.data.data : null });
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load ROCA Estates');
      }
    };
    load();
  }, [rocaemId]);

  if (!lists) {
    return (
      <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-card-border px-8 py-6 flex flex-col items-center gap-4">
          <p className={`text-sm ${error ? 'text-status-danger font-semibold' : 'text-status-muted'}`}>{error || 'Loading ROCA Estates…'}</p>
          {error && <Button type="button" variant="secondary" size="sm" onClick={onClose}>Close</Button>}
        </div>
      </div>
    );
  }
  return <ApartmentFormBody {...lists} units={units} onClose={onClose} onSaved={onSaved} />;
};
