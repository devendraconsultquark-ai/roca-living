import { useState, useEffect, useRef } from 'react';
import { X, Home, ShieldCheck, FileText, Upload, Eye, Trash2, Paperclip } from 'lucide-react';
import { Input } from './Input';
import { Dropdown } from './Dropdown';
import { DatePicker } from './DatePicker';
import { Button } from './Button';
import { useToast } from './ToastContext';
import { useConfirm } from './ConfirmContext';
import api from '../../utilities/api';

// Add or edit a ROCA Estates apartment from Roca Living (client decision 21 Oct).
// Saved through ROCA Estates' own API, which makes its unit code (PH_08) and
// reference (REM-APR-…). Same tabs and fields as ROCA Estates' apartment form,
// certificates and files included — except service charge, which Roca Living
// does not deal in (RL-033). Block and unit number are set once, when adding:
// statement numbers are built from them. An edit sends only the fields that
// changed; a file is saved in ROCA Estates as soon as it is chosen.

const TABS = [
  ['unit', 'Apartment Profile', Home],
  ['compliance', 'Compliance Hub', ShieldCheck],
  ['lease', 'Lease & Financials', FileText],
];
// The tab a field with a mistake is on, so the form can open it.
const FIELD_TAB = { lease_term_years: 'lease', ground_rent_amount: 'lease', purchase_price: 'lease' };

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
  smoke_detector_expiry_date: blank(u?.smoke_detector_expiry_date),
  sprinkler_date: blank(u?.sprinkler_date),
  sprinkler_expiry_date: blank(u?.sprinkler_expiry_date),
  gas_safety_date: blank(u?.gas_safety_date),
  gas_safety_expiry_date: blank(u?.gas_safety_expiry_date),
  hmo_licence_date: blank(u?.hmo_licence_date),
  hmo_licence_expiry_date: blank(u?.hmo_licence_expiry_date),
  pat_date: blank(u?.pat_date),
  pat_expiry_date: blank(u?.pat_expiry_date),
  lease_start_date: blank(u?.lease_start_date),
  lease_end_date: blank(u?.lease_end_date),
  lease_term_years: blank(u?.lease_term_years),
  land_registry_title_no: blank(u?.land_registry_title_no),
  ground_rent_amount: blank(u?.ground_rent_amount),
  ground_rent_review_terms: blank(u?.ground_rent_review_terms),
  purchase_price: blank(u?.purchase_price),
  purchase_date: blank(u?.purchase_date),
  repair_obligations: blank(u?.repair_obligations),
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
  if (f.purchase_price && Number.isNaN(Number(f.purchase_price))) e.purchase_price = 'Enter an amount';
  return e;
};

const GroupTitle = ({ children }) => (
  <h4 className="text-[11px] font-bold text-status-muted uppercase tracking-wider">{children}</h4>
);

// One file on the ROCA Estates apartment (floor plan, a certificate, the lease…):
// view, upload/replace or remove it. Saved in ROCA Estates straight away.
const ApartmentFile = ({ rocaemId, field, label, value, onChange }) => {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const url = `/estates/properties/${rocaemId}/files/${field}`;

  const view = async () => {
    try {
      const res = await api.get(url, { responseType: 'blob' });
      window.open(URL.createObjectURL(res.data), '_blank', 'noopener');
    } catch {
      addToast(`Could not open the ${label.toLowerCase()}`, 'error');
    }
  };
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    setBusy(true);
    try {
      const res = await api.put(url, form, { headers: { 'Content-Type': 'multipart/form-data' }, skipInterceptorError: true });
      onChange(res.data.data?.[field] || file.name);
      addToast(`${label} saved in ROCA Estates`, 'success');
    } catch (err) {
      addToast(err.response?.status === 413 ? `${file.name} is too big for the server's upload limit` : err.response?.data?.message || `Could not upload the ${label.toLowerCase()}`, 'error');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };
  const remove = async () => {
    const ok = await confirm({ title: `Remove ${label}?`, message: 'It is removed in ROCA Estates too.', confirmText: 'Remove', variant: 'danger' });
    if (!ok) return;
    setBusy(true);
    try {
      await api.delete(url);
      onChange(null);
      addToast(`${label} removed`, 'success');
    } catch (err) {
      addToast(err.response?.data?.message || `Could not remove the ${label.toLowerCase()}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const btn = 'inline-flex items-center gap-1 text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-status-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-3 min-h-[38px] px-3 py-2 rounded-lg border border-card-border bg-surface-light">
        <Paperclip size={14} className="text-gray-400 shrink-0" />
        <span className="text-sm text-brand-primary truncate flex-1 min-w-0">{value ? String(value).split('/').pop().replace(/^\d+-[a-z0-9]+-/i, '') : <span className="text-gray-400">No file</span>}</span>
        {value && <button type="button" onClick={view} disabled={busy} className={`${btn} text-brand-accent hover:underline`}><Eye size={13} /> View</button>}
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className={`${btn} text-brand-primary hover:underline`}>
          <Upload size={13} /> {busy ? 'Saving…' : value ? 'Replace' : 'Upload'}
        </button>
        {value && <button type="button" onClick={remove} disabled={busy} className={`${btn} text-status-danger hover:underline`}><Trash2 size={13} /> Remove</button>}
        <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="hidden" onChange={upload} />
      </div>
    </div>
  );
};

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
  const [files, setFiles] = useState(() => apartment || {});

  // A file control when editing; when adding, files come after the first save.
  const file = (name, label) => (isEdit
    ? <ApartmentFile rocaemId={apartment.id} field={name} label={label} value={files[name]} onChange={(v) => setFiles((f) => ({ ...f, [name]: v }))} />
    : null);
  const certificate = (title, prefix, fromLabel, fileName, extra = null) => (
    <div className="flex flex-col gap-4 border border-card-border rounded-card p-5">
      <GroupTitle>{title}</GroupTitle>
      {extra}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {date(prefix.date, fromLabel)}
        {date(prefix.expiry, 'Expiry Date')}
      </div>
      {file(fileName, 'Certificate')}
    </div>
  );

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
                    {file('floor_plan', 'Floor Plan')}
                  </div>
                </div>
              </div>
            )}

            {tab === 'compliance' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {certificate('Energy Performance (EPC)', { date: 'epc_start_date', expiry: 'epc_expiry_date' }, 'Valid From', 'epc_file', select('epc_rating', 'Rating', EPC))}
                {certificate('Electrical (EICR)', { date: 'eicr_start_date', expiry: 'eicr_expiry_date' }, 'Test Date', 'eicr_file', select('eicr_status', 'Outcome', EICR))}
                {certificate('Gas Safety', { date: 'gas_safety_date', expiry: 'gas_safety_expiry_date' }, 'Issued', 'gas_safety_file')}
                {certificate('Smoke & CO Detectors', { date: 'smoke_detector_date', expiry: 'smoke_detector_expiry_date' }, 'Last Tested', 'smoke_detector_file')}
                {certificate('Sprinklers', { date: 'sprinkler_date', expiry: 'sprinkler_expiry_date' }, 'Last Serviced', 'sprinkler_file')}
                {certificate('HMO Licence', { date: 'hmo_licence_date', expiry: 'hmo_licence_expiry_date' }, 'Issued', 'hmo_licence_file')}
                {certificate('PAT Testing', { date: 'pat_date', expiry: 'pat_expiry_date' }, 'Tested', 'pat_file')}
                <p className="lg:col-span-2 text-[11px] text-status-muted">
                  The same certificates show on the property&apos;s Safety &amp; Compliance tab and in ROCA Estates.
                  {!isEdit && ' Add the certificate files after the apartment is saved.'}
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
                    {field('purchase_price', 'Purchase Price (£)')}
                    {date('purchase_date', 'Purchase Date')}
                  </div>
                  {field('ground_rent_review_terms', 'Ground Rent Review Terms')}
                  {field('repair_obligations', 'Repair Obligations')}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {file('lease_file', 'Lease')}
                    {file('title_register_file', 'Title Register')}
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
                  Service charge and block accounting are kept in ROCA Estates only.
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
