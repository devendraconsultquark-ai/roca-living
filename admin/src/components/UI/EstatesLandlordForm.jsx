import { useState } from 'react';
import { X, User, Users, ShieldCheck, Briefcase } from 'lucide-react';
import { Input } from './Input';
import { Dropdown } from './Dropdown';
import { DatePicker } from './DatePicker';
import { Button } from './Button';
import { useToast } from './ToastContext';
import api from '../../utilities/api';

// Add or edit a ROCA Estates landlord from Roca Living (client decision 21 Oct).
// Saved through ROCA Estates' own API, so it stays the only copy. Names are
// edited in parts like ROCA Estates' own form, which rebuilds the full name as
// first + last on save; sending only the full name would be undone there.
// An edit sends only the fields that changed.

const blank = (v) => (v === null || v === undefined ? '' : String(v));

// "Matthijs van Leeuwen" → first "Matthijs", last "van Leeuwen" (ROCA Estates' own split).
const splitName = (full) => {
  const parts = blank(full).trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') };
};

// Stored name parts are used only when the first name is there; otherwise the
// full name is split (as ROCA Estates' own form does).
const toForm = (l) => {
  const main = l?.first_name
    ? { first: blank(l.first_name), middle: blank(l.middle_name), last: blank(l.last_name) }
    : { ...splitName(l?.name), middle: '' };
  const second = l?.secondary_first_name
    ? { first: blank(l.secondary_first_name), middle: blank(l.secondary_middle_name), last: blank(l.secondary_last_name) }
    : { ...splitName(l?.secondary_owner_name), middle: '' };
  return {
    first_name: main.first,
    middle_name: main.middle,
    last_name: main.last,
    email: blank(l?.email),
    phone: blank(l?.phone),
    address: blank(l?.address),
    city: blank(l?.city),
    postcode: blank(l?.postcode),
    country: blank(l?.country || (l ? '' : 'United Kingdom')),
    owner_dob: blank(l?.owner_dob),
    ownership_type: l?.ownership_type === 'COMPANY' ? 'COMPANY' : 'PERSONAL',
    company_name: blank(l?.company_name),
    company_number: blank(l?.company_number || l?.company_reg_no),
    contact_person: blank(l?.contact_person),
    company_address: blank(l?.company_address),
    company_city: blank(l?.company_city),
    company_postcode: blank(l?.company_postcode),
    is_joint_ownership: l?.is_joint_ownership ? 'yes' : 'no',
    secondary_first_name: second.first,
    secondary_middle_name: second.middle,
    secondary_last_name: second.last,
    secondary_owner_email: blank(l?.secondary_owner_email),
    secondary_owner_phone: blank(l?.secondary_owner_phone),
    secondary_owner_address: blank(l?.secondary_owner_address),
    secondary_owner_city: blank(l?.secondary_owner_city),
    secondary_owner_postcode: blank(l?.secondary_owner_postcode),
    secondary_owner_country: blank(l?.secondary_owner_country),
    secondary_owner_dob: blank(l?.secondary_owner_dob),
    nationality: blank(l?.nationality),
    residence_country: blank(l?.residence_country),
    tax_residency: blank(l?.tax_residency),
    nrl_number: blank(l?.nrl_number),
    statement_initials: blank(l?.statement_initials),
    preferred_statement_email: blank(l?.preferred_statement_email),
    notes: blank(l?.notes),
  };
};

// What ROCA Estates receives: the form's fields plus the full names it keeps.
const toPayload = (f) => ({
  ...f,
  is_joint_ownership: f.is_joint_ownership === 'yes',
  name: [f.first_name, f.last_name].map((s) => s.trim()).filter(Boolean).join(' '),
  secondary_owner_name: [f.secondary_first_name, f.secondary_middle_name, f.secondary_last_name].map((s) => s.trim()).filter(Boolean).join(' '),
  company_reg_no: f.company_number,
});

// A name is always sent whole: if any part changed, every part and the full
// name go together, so ROCA Estates never keeps a stale or missing part.
const NAME_GROUPS = [
  ['first_name', 'middle_name', 'last_name', 'name'],
  ['secondary_first_name', 'secondary_middle_name', 'secondary_last_name', 'secondary_owner_name'],
];

const changedFields = (payload, initial) => {
  const body = Object.fromEntries(Object.entries(payload).filter(([k, v]) => v !== initial[k]));
  for (const group of NAME_GROUPS) {
    if (group.some((k) => k in body)) group.forEach((k) => { body[k] = payload[k]; });
  }
  return body;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validate = (f) => {
  const e = {};
  if (!f.first_name.trim()) e.first_name = 'First name is required';
  if (!f.email.trim()) e.email = 'Email is required';
  else if (!EMAIL.test(f.email.trim())) e.email = 'Enter a valid email';
  if (f.phone.replace(/\D/g, '').length < 10) e.phone = 'Phone must have at least 10 digits';
  if (f.ownership_type === 'COMPANY' && !f.company_name.trim()) e.company_name = 'Company name is required';
  if (f.secondary_owner_email.trim() && !EMAIL.test(f.secondary_owner_email.trim())) e.secondary_owner_email = 'Enter a valid email';
  if (f.preferred_statement_email.trim() && !EMAIL.test(f.preferred_statement_email.trim())) e.preferred_statement_email = 'Enter a valid email';
  return e;
};

// Same tabs as ROCA Estates' own landlord form, so staff find each field in
// the same place in both apps.
const TABS = [
  ['identity', 'Primary Owner', User],
  ['joint', 'Joint Owner', Users],
  ['legal', 'Legal & Tax', ShieldCheck],
  ['company', 'Company Info', Briefcase],
];
// The tab a field with a mistake is on, so the form can open it.
const FIELD_TAB = { secondary_owner_email: 'joint', preferred_statement_email: 'legal', company_name: 'company' };

const GroupTitle = ({ children }) => (
  <h4 className="text-[11px] font-bold text-status-muted uppercase tracking-wider">{children}</h4>
);

export const EstatesLandlordForm = ({ landlord, onClose, onSaved }) => {
  const { addToast } = useToast();
  const isEdit = !!landlord;
  const [initial] = useState(() => toPayload(toForm(landlord)));
  const [form, setForm] = useState(() => toForm(landlord));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('identity');

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e?.target ? e.target.value : e }));
  const field = (name, label, props = {}) => (
    <Input id={`ll_${name}`} label={label} value={form[name]} onChange={set(name)} error={errors[name]} {...props} />
  );

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    const firstError = Object.keys(found)[0];
    if (firstError) {
      setTab(FIELD_TAB[firstError] || 'identity');
      return;
    }

    const payload = toPayload(form);
    const body = isEdit
      ? changedFields(payload, initial)
      : Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== '' && v !== false));
    if (isEdit && !Object.keys(body).length) {
      addToast('Nothing changed', 'info');
      onClose();
      return;
    }

    setSaving(true);
    try {
      const res = isEdit
        ? await api.patch(`/estates/landlords/${landlord.id}`, body)
        : await api.post('/estates/landlords', body);
      addToast(res.data.message, 'success');
      onSaved(res.data.data?.id || landlord?.id);
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not save the landlord in ROCA Estates', 'error');
    } finally {
      setSaving(false);
    }
  };

  const TabButton = ({ tab: [key, label, Icon] }) => (
    <button
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
  );

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl border border-card-border max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-start gap-3 px-6 pt-6 pb-4 border-b border-card-border">
          <div>
            <h3 className="text-lg font-bold text-brand-primary">{isEdit ? 'Edit Landlord Details' : 'Add New Landlord'}</h3>
            <p className="text-[11px] text-status-muted mt-1">
              Saved in ROCA Estates, so both apps show the same details. Statements use the name and address entered here.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="text-gray-400 hover:text-brand-primary cursor-pointer disabled:opacity-50" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col min-h-0">
          <div className="px-6 pt-4 flex gap-6 border-b border-card-border overflow-x-auto" role="tablist">
            {TABS.map((t) => <TabButton key={t[0]} tab={t} />)}
          </div>

          <div className="px-6 py-5 overflow-y-auto min-h-[420px]">
            {tab === 'identity' && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-4">
                    <GroupTitle>Basic Information</GroupTitle>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {field('first_name', 'First Name', { required: true })}
                      {field('middle_name', 'Middle Name', { placeholder: 'Optional' })}
                      {field('last_name', 'Surname')}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {field('email', 'Email', { type: 'email', required: true })}
                      {field('phone', 'Phone', { required: true })}
                    </div>
                    <DatePicker id="ll_owner_dob" label="Date Of Birth" value={form.owner_dob} onChange={set('owner_dob')} />
                  </div>
                  <div className="flex flex-col gap-4 border border-card-border rounded-card p-5">
                    <GroupTitle>Address Details</GroupTitle>
                    {field('country', 'Country')}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {field('city', 'City')}
                      {field('postcode', 'Postcode')}
                    </div>
                    {field('address', 'Primary Address')}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ll_notes" className="text-sm font-semibold text-brand-primary">Internal Notes</label>
                  <textarea
                    id="ll_notes"
                    rows={3}
                    value={form.notes}
                    onChange={set('notes')}
                    placeholder="Portfolio relationship context"
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-accent bg-white resize-y"
                  />
                </div>
              </div>
            )}

            {tab === 'joint' && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between gap-4 border border-card-border rounded-card p-4">
                  <div>
                    <p className="text-sm font-bold text-brand-primary">Joint Ownership</p>
                    <p className="text-[11px] text-status-muted">The apartments are owned with a second person, who is shown on statements with the landlord.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.is_joint_ownership === 'yes'}
                    aria-label="Joint ownership"
                    onClick={() => setForm((f) => ({ ...f, is_joint_ownership: f.is_joint_ownership === 'yes' ? 'no' : 'yes' }))}
                    className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors cursor-pointer ${form.is_joint_ownership === 'yes' ? 'bg-brand-primary' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${form.is_joint_ownership === 'yes' ? 'translate-x-8' : 'translate-x-1'}`} />
                  </button>
                </div>
                {form.is_joint_ownership === 'yes' ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-4">
                      <GroupTitle>Second Owner</GroupTitle>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {field('secondary_first_name', 'First Name')}
                        {field('secondary_middle_name', 'Middle Name', { placeholder: 'Optional' })}
                        {field('secondary_last_name', 'Surname')}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {field('secondary_owner_email', 'Email', { type: 'email' })}
                        {field('secondary_owner_phone', 'Phone')}
                      </div>
                      <DatePicker id="ll_secondary_owner_dob" label="Date Of Birth" value={form.secondary_owner_dob} onChange={set('secondary_owner_dob')} />
                    </div>
                    <div className="flex flex-col gap-4 border border-card-border rounded-card p-5">
                      <GroupTitle>Address Details</GroupTitle>
                      {field('secondary_owner_country', 'Country')}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {field('secondary_owner_city', 'City')}
                        {field('secondary_owner_postcode', 'Postcode')}
                      </div>
                      {field('secondary_owner_address', 'Address')}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-status-muted text-center py-8">Turn on joint ownership above to add the second owner&apos;s details.</p>
                )}
              </div>
            )}

            {tab === 'legal' && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4">
                  <GroupTitle>Residency &amp; Tax</GroupTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {field('nationality', 'Nationality')}
                    {field('residence_country', 'Primary Residence')}
                    {field('tax_residency', 'Tax Jurisdiction')}
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <GroupTitle>ROCA Living Statements</GroupTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {field('nrl_number', 'NRL Number (HMRC)', { placeholder: 'e.g. NL943229' })}
                    {field('statement_initials', 'Statement Initials', { placeholder: 'e.g. PB/MEWH' })}
                    {field('preferred_statement_email', 'Statement Email (if different)', { type: 'email' })}
                  </div>
                </div>
              </div>
            )}

            {tab === 'company' && (
              <div className="flex flex-col gap-5">
                <div className="sm:w-1/2">
                  <Dropdown
                    id="ll_ownership_type"
                    label="Owned As"
                    options={[{ value: 'PERSONAL', label: 'Personal' }, { value: 'COMPANY', label: 'Company' }]}
                    value={form.ownership_type}
                    onChange={set('ownership_type')}
                  />
                </div>
                {form.ownership_type === 'COMPANY' ? (
                  <div className="flex flex-col gap-4">
                    <GroupTitle>Company Details</GroupTitle>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {field('company_name', 'Company Name', { required: true })}
                      {field('company_number', 'Company Number')}
                      {field('contact_person', 'Contact Person')}
                      {field('company_address', 'Registered Address')}
                      {field('company_city', 'Registered City')}
                      {field('company_postcode', 'Registered Postcode')}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-status-muted text-center py-8">Choose Company above if a company owns the apartments.</p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end p-6 pt-4 border-t border-card-border">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Landlord'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
