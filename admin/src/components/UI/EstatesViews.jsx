import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Home, Users, X, Search, Lock, LayoutGrid, List, ChevronLeft, ChevronRight, Plus, Pencil, Wrench, PoundSterling, ShieldCheck } from 'lucide-react';
import { DataTable } from './DataTable';
import { Dropdown } from './Dropdown';
import { StatusPill } from './StatusPill';
import { Skeleton } from './Skeleton';
import { Button } from './Button';
import { LandlordChooser } from './LandlordChooser';
import { useToast } from './ToastContext';
import { useConfirm } from './ConfirmContext';
import { ExportButton } from './ListToolbar';
import { PropertyThumb } from './PropertyImage';
import api from '../../utilities/api';
import { downloadCsv } from '../../utilities/csv';
import { emptyNewLandlord, landlordChoiceError, landlordChoicePayload } from '../../utilities/landlordChoice';
import { useEstatesEditable } from '../../utilities/useEstatesEditable';
import { KpiRow, KpiCard, PageActions, InfoFooter } from './DesignKit';
import { EstatesLandlordForm } from './EstatesLandlordForm';
import { EstatesApartmentForm } from './EstatesApartmentForm';

// ROCA Estates (rocaem) blocks, apartments and landlords, shown read-only.
// They are managed in ROCA Estates; Roca Living only adds lettings (tenants,
// rent, statements) to the apartments it manages. Which apartments those are
// is the "Managed by ROCA Living" switch (RL-003), stored in Roca Living only.

const dash = (v) => (v === null || v === undefined || v === '' ? '—' : v);
const money = (v) => (v === null || v === undefined || v === '' ? '—' : `£${parseFloat(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const ukDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB');
};
const yesNo = (v) => (v === null || v === undefined ? '—' : (v ? 'Yes' : 'No'));
// Subletting / pets are text in ROCA Estates: YES, NO or RESTRICTED.
const allowed = (v) => (typeof v === 'string' ? pretty(v) : yesNo(v));
const pretty = (v) => (v ? String(v).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : '—');

export const EstateStatus = ({ status }) => {
  const s = String(status || '').toLowerCase();
  if (!s) return <span className="text-gray-400">—</span>;
  if (s === 'vacant') return <StatusPill status="vacant" size="sm" />;
  return <StatusPill status="let" customLabel={pretty(status)} size="sm" />;
};

const noteText = (editable) => (editable
  ? 'Kept in ROCA Estates. Changes saved here or in ROCA Estates show in both.'
  : 'Read-only — managed in ROCA Estates. Changes are made there and show here automatically.');

// `editable`: Roca Living can change this record too (saved in ROCA Estates).
export const ReadOnlyNote = ({ extra, editable }) => (
  <p className="flex items-center gap-2 text-xs-portal text-status-muted">
    <Lock size={13} />
    {noteText(editable)}
    {extra ? ` ${extra}` : ''}
  </p>
);

const LoadState = ({ loading, error, children }) => {
  if (loading) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton radius="bar" className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="border border-status-danger/15 bg-status-danger-bg rounded-card p-6 text-center text-status-danger font-semibold">
        {error}
      </div>
    );
  }
  return children;
};

const SearchBox = ({ value, onChange, placeholder }) => (
  <div className="relative w-full md:w-72">
    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-accent bg-white"
    />
  </div>
);

const Section = ({ title, rows }) => (
  <div>
    <h3 className="text-sm-portal font-bold text-brand-primary capitalize mb-2">{title}</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 border border-card-border rounded-card p-4">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3 text-sm border-b border-card-border/60 pb-1.5 last:border-b-0">
          <span className="text-status-muted">{label}</span>
          <span className="font-semibold text-right text-brand-primary break-words">{value}</span>
        </div>
      ))}
    </div>
  </div>
);

const LettingsBadge = ({ link }) => {
  if (!link?.managed) return null;
  return <span className={`text-xs font-semibold ${link.has_tenant ? 'text-status-success' : 'text-gray-400'}`}>{link.has_tenant ? 'Let' : 'Vacant'}</span>;
};

// "Managed by ROCA Living" on/off (RL-003). Its own click never opens the row.
const ManagedSwitch = ({ unit, busy, onToggle }) => {
  const on = !!unit.roca_living?.managed;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`Managed by ROCA Living: ${unit.unit_ref}`}
      title={on ? 'Managed by ROCA Living (click to stop)' : 'Not managed (click to manage)'}
      disabled={busy}
      onClick={(e) => { e.stopPropagation(); onToggle(unit); }}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${on ? 'bg-status-success' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
};

// Switching on an apartment ROCA Estates has no owner for: choose its landlord.
const ManageWithLandlordModal = ({ unit, onClose, onSave }) => {
  const { addToast } = useToast();
  const [landlords, setLandlords] = useState([]);
  const [choice, setChoice] = useState('');
  const [newLandlord, setNewLandlord] = useState(emptyNewLandlord());
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/landlords');
        setLandlords(res.data.data || []);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load landlords', 'error');
      }
    };
    load();
  }, [addToast]);

  const submit = async () => {
    const err = landlordChoiceError(choice, newLandlord);
    if (err) { setError(err); return; }
    setError(null);
    setSaving(true);
    const ok = await onSave(unit, true, landlordChoicePayload(choice, newLandlord));
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl border border-card-border overflow-hidden my-8">
        <div className="bg-brand-primary text-white p-5 flex items-center gap-3 select-none">
          <div className="flex flex-col">
            <span className="font-bold">Manage {unit.unit_ref} with ROCA Living</span>
            <span className="text-xs text-white/70">{unit.name}</span>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="ml-auto p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-50" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 flex flex-col gap-5">
          <LandlordChooser landlords={landlords} choice={choice} onChoice={setChoice} newLandlord={newLandlord} onNewLandlord={setNewLandlord} error={error} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="button" variant="primary" onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Manage this apartment'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// "Manage with ROCA Living" on a not-managed apartment's page (RL-003). An
// apartment ROCA Estates has no owner for asks for its landlord first.
// onManaged gets the new lettings record's id.
export const ManageApartmentButton = ({ unit, onManaged }) => {
  const { addToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);

  const save = async (u, managed, extra = {}) => {
    setBusy(true);
    try {
      const res = await api.patch(`/estates/properties/${u.id}/managed`, { managed, ...extra });
      addToast(`${u.unit_ref}: ${res.data.message}`, 'success');
      onManaged(res.data.data.property_id);
      return true;
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not change "Managed by ROCA Living"', 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="primary"
        icon={Home}
        disabled={busy}
        onClick={() => (!unit.landlord_name && !unit.roca_living ? setChoosing(true) : save(unit, true))}
      >
        {busy ? 'Saving…' : 'Manage with ROCA Living'}
      </Button>
      {choosing && <ManageWithLandlordModal unit={unit} onClose={() => setChoosing(false)} onSave={save} />}
    </>
  );
};

// ── Apartments ───────────────────────────────────────────────────────────────

// The ROCA Estates apartment, section by section.
export const ApartmentSections = ({ unit }) => (
  <>
    <Section title="Apartment" rows={[
      ['Block', dash(unit.building_name)],
      ['Unit', dash(unit.unit_ref)],
      ['Unit code', dash(unit.unit_code)],
      ['Reference', dash(unit.property_reference)],
      ['Type', pretty(unit.unit_type)],
      ['Floor', dash(unit.floor_number)],
      ['Internal area', unit.internal_area ? `${unit.internal_area} sq ft` : '—'],
      ['Heating', dash(unit.heating_type)],
      ['Parking', unit.has_parking ? dash(unit.parking_space) || 'Yes' : 'No'],
      ['Status', <EstateStatus key="s" status={unit.status} />],
      ['Address', [unit.address, unit.city, unit.postcode].filter(Boolean).join(', ') || [unit.building_address, unit.building_city, unit.building_postcode].filter(Boolean).join(', ') || '—']
    ]} />
    <Section title="Owner" rows={[
      ['Landlord', dash(unit.landlord_name)],
      ['Email', dash(unit.landlord_email)],
      ['Phone', dash(unit.landlord_phone)],
      ['Ownership', pretty(unit.ownership_structure)]
    ]} />
    {/* Service charge is ROCA Estates' business, not shown here (RL-033). */}
    <Section title="Lease" rows={[
      ['Tenure', pretty(unit.tenure_type)],
      ['Lease start', ukDate(unit.lease_start_date)],
      ['Lease end', ukDate(unit.lease_end_date)],
      ['Lease term', unit.lease_term_years ? `${unit.lease_term_years} years` : '—'],
      ['Ground rent', money(unit.ground_rent_amount)],
      ['Subletting allowed', allowed(unit.subletting_allowed)],
      ['Pets allowed', allowed(unit.pets_allowed)],
      ['Land Registry title', dash(unit.land_registry_title_no)]
    ]} />
    <Section title="Compliance" rows={[
      ['EPC rating', dash(unit.epc_rating)],
      ['EPC expiry', ukDate(unit.epc_expiry_date)],
      ['EICR status', pretty(unit.eicr_status)],
      ['EICR expiry', ukDate(unit.eicr_expiry_date)],
      ['Smoke detectors', ukDate(unit.smoke_detector_date)],
      ['Sprinklers', ukDate(unit.sprinkler_date)]
    ]} />
  </>
);

// Loads one ROCA Estates record for a block inside a Roca Living page. A
// ROCA Estates outage shows inside the block only, never as a page error.
const useEstatesRecord = (path) => {
  const [record, setRecord] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!path) return;
    const load = async () => {
      try {
        const res = await api.get(path, { skipInterceptorError: true });
        setRecord(res.data.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.message || 'ROCA Estates details could not be loaded.');
      }
    };
    load();
  }, [path]);
  return { record, error };
};

const NotLinked = ({ what }) => (
  <p className="text-sm text-status-muted">This {what} is not linked to a ROCA Estates record.</p>
);

// ROCA Estates apartment details, for the property page. With onEdit (Roca
// Living can edit ROCA Estates) it offers "Edit apartment details".
export const EstatesApartmentInfo = ({ rocaemId, onEdit }) => {
  const { record, error } = useEstatesRecord(rocaemId ? `/estates/properties/${rocaemId}` : null);
  if (!rocaemId) return <NotLinked what="property" />;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReadOnlyNote editable={!!onEdit} />
        {onEdit && <Button variant="secondary" size="sm" icon={Pencil} onClick={onEdit}>Edit apartment details</Button>}
      </div>
      <LoadState loading={!record && !error} error={error}>
        {record && <ApartmentSections unit={record} />}
      </LoadState>
    </div>
  );
};

// Properties card view (design p6): photo with status, name and block,
// tenant, rent, next inspection, compliance; the Managed switch stays on the card.
const ApartmentCard = ({ unit, busy, onToggle, onOpen, extra }) => {
  const link = unit.roca_living;
  const comp = extra?.compliance;
  return (
    <div className="border border-card-border rounded-card overflow-hidden bg-white flex flex-col">
      <div className="relative">
        <PropertyThumb imageId={link?.primary_image_id} alt={unit.unit_ref} className="w-full h-36" iconSize={28} />
        <span className="absolute top-2 left-2"><EstateStatus status={unit.status} /></span>
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div>
          <p className="font-bold text-brand-primary truncate">{unit.name || unit.unit_ref}</p>
          <p className="text-xs text-status-muted truncate">{[unit.unit_ref, unit.building_name].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="text-xs flex flex-col gap-1">
          <div className="flex justify-between gap-2"><span className="text-status-muted">Tenant</span><span className="font-semibold text-right truncate">{link?.has_tenant ? (link.tenant_name || 'Let') : '—'}</span></div>
          <div className="flex justify-between gap-2"><span className="text-status-muted">Rent (pcm)</span><span className="font-semibold">{link?.has_tenant && link.rent_pcm ? money(link.rent_pcm) : '—'}</span></div>
          <div className="flex justify-between gap-2"><span className="text-status-muted">Next Inspection</span><span className="font-semibold">{extra?.nextInspection ? ukDate(extra.nextInspection) : '—'}</span></div>
          <div className="flex justify-between gap-2">
            <span className="text-status-muted">Compliance</span>
            <span className={`font-semibold ${comp ? (comp.pct >= 100 ? 'text-status-success' : comp.pct >= 80 ? 'text-status-warning' : 'text-status-danger') : ''}`}>
              {comp ? `${comp.pct}%` : '—'}
            </span>
          </div>
          <div className="flex justify-between gap-2"><span className="text-status-muted">Landlord</span><span className="font-semibold text-right truncate">{unit.landlord_name || 'Not linked'}</span></div>
        </div>
        <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-card-border/60">
          <span className="flex items-center gap-2 text-2xs text-status-muted">
            <ManagedSwitch unit={unit} busy={busy} onToggle={onToggle} /> Managed
          </span>
          <Button variant="secondary" size="sm" onClick={() => onOpen(unit)}>View</Button>
        </div>
      </div>
    </div>
  );
};

const CARDS_PER_PAGE = 12;

export const EstatesApartments = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [buildings, setBuildings] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [block, setBlock] = useState('');
  const [managedFilter, setManagedFilter] = useState('managed');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [chooserFor, setChooserFor] = useState(null);
  const editable = useEstatesEditable();
  const [adding, setAdding] = useState(false);
  // Grid (cards) or list (table), remembered per browser
  const [view, setView] = useState(() => {
    try { return localStorage.getItem('propertiesView') === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
  });
  const [cardPage, setCardPage] = useState(0);
  const chooseView = (v) => {
    setView(v);
    try { localStorage.setItem('propertiesView', v); } catch { /* storage blocked */ }
  };

  // Returns true when saved. The list is updated in place (no reload flash).
  const saveManaged = async (unit, managed, extra = {}) => {
    setBusyId(unit.id);
    try {
      const res = await api.patch(`/estates/properties/${unit.id}/managed`, { managed, ...extra });
      const { property_id: propertyId } = res.data.data;
      setUnits((list) => list.map((u) => (u.id === unit.id
        ? { ...u, roca_living: propertyId ? { rent_pcm: null, has_tenant: false, ...u.roca_living, property_id: propertyId, managed } : u.roca_living }
        : u)));
      addToast(`${unit.unit_ref}: ${res.data.message}`, 'success');
      return true;
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not change "Managed by ROCA Living"', 'error');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const toggleManaged = async (unit) => {
    if (unit.roca_living?.managed) {
      const ok = await confirm({
        title: 'Stop managing this apartment?',
        message: `${unit.unit_ref} will no longer be offered in Add Tenant or agent instructions, and leaves the Compliance page. Nothing is deleted; you can switch it back on.`,
        variant: 'danger',
        confirmText: 'Stop managing',
      });
      if (ok) await saveManaged(unit, false);
    } else if (!unit.landlord_name && !unit.roca_living) {
      setChooserFor(unit); // ROCA Estates has no owner: choose the landlord first
    } else {
      await saveManaged(unit, true);
    }
  };

  // Per lettings record: compliance %, next inspection, open maintenance (for the KPIs and cards)
  const [extras, setExtras] = useState({});
  useEffect(() => {
    const opt = { skipInterceptorError: true };
    Promise.all([
      api.get('/reports/compliance-items', opt).catch(() => null),
      api.get('/inspections', opt).catch(() => null),
      api.get('/maintenance', opt).catch(() => null),
    ]).then(([c, i, m]) => {
      const out = {};
      const at = (id) => (out[id] ||= {});
      (c?.data?.data || []).forEach((x) => {
        const e = at(x.property_id);
        e.certs = (e.certs || 0) + 1;
        e.ok = (e.ok || 0) + (x.days_left !== null && x.days_left > 30 ? 1 : 0);
      });
      (i?.data?.data || []).forEach((x) => { const e = at(x.property_id); if (!e.nextInspection && x.next_inspection_due) e.nextInspection = x.next_inspection_due; });
      (m?.data?.data || []).forEach((x) => { if (!['complete', 'cancelled'].includes(x.status)) at(x.property_id).openTickets = (at(x.property_id).openTickets || 0) + 1; });
      Object.values(out).forEach((e) => { if (e.certs) e.compliance = { pct: Math.round((e.ok / e.certs) * 100) }; });
      setExtras(out);
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [b, p] = await Promise.all([api.get('/estates/buildings'), api.get('/estates/properties')]);
        setBuildings(b.data.data || []);
        setUnits(p.data.data || []);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load ROCA Estates apartments');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const q = search.trim().toLowerCase();
  const shown = units.filter((u) => (!block || String(u.building_id ?? 'none') === block)
    && (!managedFilter || (managedFilter === 'managed') === !!u.roca_living?.managed)
    && (!q || [u.unit_ref, u.name, u.unit_code, u.landlord_name].some((v) => String(v || '').toLowerCase().includes(q))));

  // An apartment with a lettings record opens that page; one without opens its
  // ROCA Estates page (details, and "Manage with ROCA Living").
  const openUnit = (u) => navigate(u.roca_living?.property_id ? `/properties/${u.roca_living.property_id}` : `/properties/estates/${u.id}`);

  // KPIs: the flats ROCA Living manages
  const managedUnits = units.filter((u) => u.roca_living?.managed);
  const letUnits = managedUnits.filter((u) => u.roca_living.has_tenant);
  const managedLandlords = new Set(managedUnits.map((u) => u.landlord_id).filter(Boolean)).size;
  const rentRoll = letUnits.reduce((sum, u) => sum + (parseFloat(u.roca_living.rent_pcm) || 0), 0);
  const maintenanceUnits = managedUnits.filter((u) => extras[u.roca_living.property_id]?.openTickets).length;
  const certTotals = managedUnits.reduce((acc, u) => {
    const e = extras[u.roca_living.property_id];
    return e?.certs ? { certs: acc.certs + e.certs, ok: acc.ok + e.ok } : acc;
  }, { certs: 0, ok: 0 });
  const compliancePct = certTotals.certs ? Math.round((certTotals.ok / certTotals.certs) * 100) : null;
  const kpiPct = (n, total) => (total ? `${Math.round((n / total) * 1000) / 10}%` : '0%');

  const pageCount = Math.max(1, Math.ceil(shown.length / CARDS_PER_PAGE));
  const page = Math.min(cardPage, pageCount - 1);
  const cards = shown.slice(page * CARDS_PER_PAGE, (page + 1) * CARDS_PER_PAGE);

  const exportCsv = () => downloadCsv('properties.csv', shown, [
    { key: 'unit_ref', label: 'Unit' },
    { key: 'name', label: 'Apartment' },
    { key: 'building_name', label: 'Block' },
    { key: 'landlord_name', label: 'Landlord' },
    { key: (r) => pretty(r.unit_type), label: 'Type' },
    { key: (r) => pretty(r.status), label: 'Status' },
    { key: (r) => (r.roca_living?.has_tenant ? r.roca_living.tenant_name || '' : ''), label: 'Tenant' },
    { key: (r) => (r.roca_living?.has_tenant && r.roca_living.rent_pcm ? parseFloat(r.roca_living.rent_pcm).toFixed(2) : ''), label: 'Rent pcm (£)' },
    { key: (r) => (r.roca_living?.managed ? 'Yes' : 'No'), label: 'Managed by ROCA Living' },
  ]);

  const columns = [
    { header: 'Unit', accessor: 'unit_ref', sortable: true, renderCell: (r) => <span className="font-bold">{r.unit_ref}</span> },
    { header: 'Apartment', accessor: 'name', sortable: true },
    { header: 'Block', accessor: 'building_name', sortable: true, renderCell: (r) => dash(r.building_name) },
    { header: 'Landlord', accessor: 'landlord_name', sortable: true, renderCell: (r) => r.landlord_name || <span className="text-gray-400">Not linked</span> },
    { header: 'Type', accessor: 'unit_type', renderCell: (r) => pretty(r.unit_type) },
    { header: 'Status', accessor: 'status', sortable: true, renderCell: (r) => <EstateStatus status={r.status} /> },
    // ROCA Living deals in rent, not service charge (RL-033): the current tenancy's rent.
    {
      header: 'Rent',
      accessor: 'roca_living',
      align: 'right',
      sortable: true,
      sortValue: (r) => (r.roca_living?.has_tenant ? parseFloat(r.roca_living.rent_pcm) || 0 : -1),
      renderCell: (r) => (r.roca_living?.has_tenant && r.roca_living.rent_pcm ? `${money(r.roca_living.rent_pcm)} pcm` : '—')
    },
    {
      header: 'Managed by ROCA Living',
      accessor: 'roca_living',
      sortable: true,
      sortValue: (r) => (r.roca_living?.managed ? 1 : 0),
      renderCell: (r) => (
        <span className="flex items-center gap-2">
          <ManagedSwitch unit={r} busy={busyId === r.id} onToggle={toggleManaged} />
          <LettingsBadge link={r.roca_living} />
        </span>
      )
    }
  ];

  const blockOptions = [
    { value: '', label: 'All blocks' },
    ...buildings.map((b) => ({ value: String(b.id), label: `${b.name}${b.short_code ? ` (${b.short_code})` : ''} · ${b.unit_count} units` })),
    ...(units.some((u) => !u.building_id) ? [{ value: 'none', label: 'Not in a block' }] : [])
  ];

  return (
    <div className="flex flex-col gap-6">
      {editable && (
        <PageActions>
          <Button variant="accent" icon={Plus} onClick={() => setAdding(true)}>Add New Property</Button>
        </PageActions>
      )}
      <KpiRow cols={6}>
        <KpiCard icon={Home} tone="indigo" label="Total Properties" value={managedUnits.length} sub={`Across ${managedLandlords} landlord${managedLandlords === 1 ? '' : 's'}`} link="View managed" onClick={() => { setManagedFilter('managed'); setCardPage(0); }} loading={loading} />
        <KpiCard icon={Building2} tone="green" label="Let Properties" value={letUnits.length} sub={kpiPct(letUnits.length, managedUnits.length)} loading={loading} />
        <KpiCard icon={Users} tone="orange" label="Vacant Properties" value={managedUnits.length - letUnits.length} sub={kpiPct(managedUnits.length - letUnits.length, managedUnits.length)} loading={loading} />
        <KpiCard icon={Wrench} tone="blue" label="Under Maintenance" value={maintenanceUnits} sub="Open maintenance requests" link="View maintenance" to="/maintenance" loading={loading} />
        <KpiCard icon={PoundSterling} tone="green" label="Monthly Rent Roll" value={money(rentRoll)} sub="Across let properties" loading={loading} />
        <KpiCard icon={ShieldCheck} tone="indigo" label="Compliant" value={compliancePct !== null ? `${compliancePct}%` : '—'} sub="Certificates in date" link="View compliance" to="/compliance" loading={loading} />
      </KpiRow>

      <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <SearchBox value={search} onChange={(v) => { setSearch(v); setCardPage(0); }} placeholder="Search unit, apartment or landlord…" />
          <div className="w-full lg:w-64">
            <Dropdown id="estateBlock" options={blockOptions} value={block} onChange={(v) => { setBlock(v); setCardPage(0); }} placeholder="All blocks" />
          </div>
          <div className="w-full lg:w-60">
            <Dropdown
              id="estateManaged"
              options={[
                { value: '', label: 'All apartments' },
                { value: 'managed', label: 'Managed by ROCA Living' },
                { value: 'not', label: 'Not managed' },
              ]}
              value={managedFilter}
              onChange={(v) => { setManagedFilter(v); setCardPage(0); }}
              placeholder="All apartments"
            />
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
            <div className="flex border border-card-border rounded-lg overflow-hidden">
              <button type="button" onClick={() => chooseView('grid')} aria-label="Grid view" title="Grid view"
                className={`p-2 cursor-pointer ${view === 'grid' ? 'bg-brand-accent text-white' : 'text-status-muted hover:bg-surface-hover'}`}>
                <LayoutGrid size={16} />
              </button>
              <button type="button" onClick={() => chooseView('list')} aria-label="List view" title="List view"
                className={`p-2 cursor-pointer ${view === 'list' ? 'bg-brand-accent text-white' : 'text-status-muted hover:bg-surface-hover'}`}>
                <List size={16} />
              </button>
            </div>
            <ExportButton onClick={exportCsv} disabled={loading || !shown.length} />
          </div>
        </div>
        <LoadState loading={loading} error={error}>
          {view === 'list' ? (
            <DataTable columns={columns} data={shown} initialPageSize={25} onRowClick={openUnit} />
          ) : !shown.length ? (
            <p className="text-sm text-status-muted py-10 text-center">No apartments match the filters.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {cards.map((u) => (
                  <ApartmentCard key={u.id} unit={u} busy={busyId === u.id} onToggle={toggleManaged} onOpen={openUnit} extra={u.roca_living ? extras[u.roca_living.property_id] : null} />
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-status-muted">
                <span>Showing {page * CARDS_PER_PAGE + 1} to {Math.min((page + 1) * CARDS_PER_PAGE, shown.length)} of {shown.length} apartments</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={() => setCardPage(page - 1)} disabled={page === 0} aria-label="Previous page" />
                  <span className="font-semibold">{page + 1} / {pageCount}</span>
                  <Button variant="ghost" size="sm" icon={ChevronRight} onClick={() => setCardPage(page + 1)} disabled={page >= pageCount - 1} aria-label="Next page" />
                </div>
              </div>
            </>
          )}
        </LoadState>
      </div>

      <InfoFooter text={`${noteText(editable)}${editable ? '' : ' Only the "Managed by ROCA Living" switch is set here, in Roca Living.'}`} />

      {chooserFor && <ManageWithLandlordModal unit={chooserFor} onClose={() => setChooserFor(null)} onSave={saveManaged} />}
      {adding && (
        <EstatesApartmentForm
          units={units}
          onClose={() => setAdding(false)}
          onSaved={({ id, propertyId }) => navigate(propertyId ? `/properties/${propertyId}` : `/properties/estates/${id}`)}
        />
      )}
    </div>
  );
};

// ── Landlords ────────────────────────────────────────────────────────────────

const ownershipLabel = (l) => [
  l.ownership_type === 'COMPANY' ? `Company${l.company_name ? ` · ${l.company_name}` : ''}` : 'Personal',
  l.is_joint_ownership ? `Joint${l.secondary_owner_name ? ` with ${l.secondary_owner_name}` : ''}` : null
].filter(Boolean).join(' · ');

const address = (a, c, p, country) => [a, c, p, country].filter(Boolean).join(', ') || '—';

// The ROCA Estates landlord, section by section.
export const LandlordSections = ({ ll }) => (
  <>
    <Section title="Landlord" rows={[
      ['Name', dash(ll.name)],
      ['Email', dash(ll.email)],
      ['Phone', dash(ll.phone)],
      ['Ownership', ownershipLabel(ll)],
      ['Address', address(ll.address, ll.city, ll.postcode, ll.country)],
      ['Residence', dash(ll.residence_country)],
      ['Nationality', dash(ll.nationality)],
      ['Tax residency', dash(ll.tax_residency)],
      ['Payment reference', dash(ll.payment_ref)],
      ['Status', pretty(ll.status)]
    ]} />
    {ll.ownership_type === 'COMPANY' && (
      <Section title="Company" rows={[
        ['Company', dash(ll.company_name)],
        ['Company number', dash(ll.company_number || ll.company_reg_no)],
        ['Contact person', dash(ll.contact_person)],
        ['Registered address', address(ll.company_address, ll.company_city, ll.company_postcode)]
      ]} />
    )}
    {!!ll.is_joint_ownership && (
      <Section title="Joint owner" rows={[
        ['Name', dash(ll.secondary_owner_name)],
        ['Email', dash(ll.secondary_owner_email)],
        ['Phone', dash(ll.secondary_owner_phone)],
        ['Address', address(ll.secondary_owner_address, ll.secondary_owner_city, ll.secondary_owner_postcode, ll.secondary_owner_country)]
      ]} />
    )}
    <Section title="Checks" rows={[
      ['HMRC verified', yesNo(ll.hmrc_verified)],
      ['AML risk rating', pretty(ll.aml_risk_rating)],
      ['AML last assessed', ukDate(ll.aml_last_assessed)],
      ['AML next review', ukDate(ll.aml_next_review)]
    ]} />
  </>
);

// ROCA Estates landlord details, for the landlord page. `editable` changes
// the note when Roca Living can edit them (Edit Details).
export const EstatesLandlordInfo = ({ rocaemId, editable }) => {
  const { record, error } = useEstatesRecord(rocaemId ? `/estates/landlords/${rocaemId}` : null);
  if (!rocaemId) return <NotLinked what="landlord" />;
  return (
    <div className="flex flex-col gap-5">
      <ReadOnlyNote editable={editable} />
      <LoadState loading={!record && !error} error={error}>
        {record && <LandlordSections ll={record} />}
      </LoadState>
    </div>
  );
};

export const EstatesLandlords = () => {
  const navigate = useNavigate();
  const [landlords, setLandlords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  // ROCA Estates holds every owner in the block (service charges); Roca Living
  // works with the owners of the flats it manages, so those show by default.
  const [scope, setScope] = useState('managed');
  const editable = useEstatesEditable();
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/estates/landlords');
        setLandlords(res.data.data || []);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load ROCA Estates landlords');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const q = search.trim().toLowerCase();
  const shown = landlords.filter((l) => (scope === 'all' || l.managed_units > 0)
    && (!q || [l.name, l.email, l.company_name, ...l.units].some((v) => String(v || '').toLowerCase().includes(q))));

  const columns = [
    { header: 'Landlord', accessor: 'name', sortable: true, renderCell: (r) => <span className="font-bold">{r.name}</span> },
    { header: 'Email', accessor: 'email', sortable: true, renderCell: (r) => dash(r.email) },
    { header: 'Phone', accessor: 'phone', renderCell: (r) => dash(r.phone) },
    { header: 'Ownership', accessor: 'ownership_type', renderCell: (r) => ownershipLabel(r) },
    { header: 'Apartments', accessor: 'units', renderCell: (r) => (r.units.length ? r.units.join(', ') : <span className="text-gray-400">None</span>) },
    { header: 'Roca Living', accessor: 'roca_living_landlord_id', renderCell: (r) => (r.roca_living_landlord_id ? <StatusPill status="active" customLabel="Has account" size="sm" /> : <span className="text-gray-400 text-xs">—</span>) }
  ];

  return (
    <div className="flex flex-col gap-6">
      {editable && (
        <PageActions>
          <Button variant="accent" icon={Plus} onClick={() => setAdding(true)}>Add New Landlord</Button>
        </PageActions>
      )}
      <KpiRow cols={3}>
        <KpiCard icon={Users} tone="indigo" label="Landlords of managed flats" value={landlords.filter((l) => l.managed_units > 0).length} sub="Owners of flats ROCA Living manages" loading={loading} />
        <KpiCard icon={Home} tone="blue" label="With apartments" value={landlords.filter((l) => l.units.length).length} sub="Own at least one apartment" loading={loading} />
        <KpiCard icon={Users} tone="green" label="With a Roca Living account" value={landlords.filter((l) => l.roca_living_landlord_id).length} sub="Can use the landlord portal" loading={loading} />
      </KpiRow>
      <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <SearchBox value={search} onChange={setSearch} placeholder="Search name, email, company or unit…" />
          <div className="w-full lg:w-72">
            <Dropdown
              id="landlordScope"
              options={[
                { value: 'managed', label: 'Landlords of managed flats' },
                { value: 'all', label: `All ROCA Estates landlords (${landlords.length})` },
              ]}
              value={scope}
              onChange={(v) => setScope(v || 'managed')}
              placeholder="Landlords of managed flats"
            />
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
            <ExportButton
              disabled={loading || !shown.length}
              onClick={() => downloadCsv('landlords.csv', shown, [
                { key: 'name', label: 'Landlord' },
                { key: 'email', label: 'Email' },
                { key: 'phone', label: 'Phone' },
                { key: (r) => ownershipLabel(r), label: 'Ownership' },
                { key: (r) => r.units.join(', '), label: 'Apartments' },
                { key: (r) => (r.roca_living_landlord_id ? 'Has account' : ''), label: 'Roca Living' },
              ])}
            />
          </div>
        </div>
        <LoadState loading={loading} error={error}>
          {/* A landlord with a Roca Living account opens that page; one without
              opens its ROCA Estates page. */}
          <DataTable
            columns={columns}
            data={shown}
            initialPageSize={25}
            onRowClick={(r) => navigate(r.roca_living_landlord_id ? `/landlords/${r.roca_living_landlord_id}` : `/landlords/estates/${r.id}`)}
          />
        </LoadState>
      </div>
      <InfoFooter text={noteText(editable)} />
      {adding && (
        <EstatesLandlordForm
          landlord={null}
          onClose={() => setAdding(false)}
          onSaved={(id) => navigate(`/landlords/estates/${id}`)}
        />
      )}
    </div>
  );
};

