import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Home, Users, X, ExternalLink, Search, Lock } from 'lucide-react';
import { DataTable } from './DataTable';
import { Dropdown } from './Dropdown';
import { StatCard } from './StatCard';
import { StatusPill } from './StatusPill';
import { Skeleton } from './Skeleton';
import { Button } from './Button';
import api from '../../utilities/api';

// ROCA Estates (rocaem) blocks, apartments and landlords, shown read-only.
// They are managed in ROCA Estates; Roca Living only adds lettings (tenants,
// rent, statements) to the apartments it manages.

const dash = (v) => (v === null || v === undefined || v === '' ? '—' : v);
const money = (v) => (v === null || v === undefined || v === '' ? '—' : `£${parseFloat(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const ukDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB');
};
const yesNo = (v) => (v === null || v === undefined ? '—' : (v ? 'Yes' : 'No'));
const unitCount = (n) => `${n} ${n === 1 ? 'unit' : 'units'}`;
const pretty = (v) => (v ? String(v).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : '—');

const EstateStatus = ({ status }) => {
  const s = String(status || '').toLowerCase();
  if (!s) return <span className="text-gray-400">—</span>;
  if (s === 'vacant') return <StatusPill status="vacant" size="sm" />;
  return <StatusPill status="let" customLabel={pretty(status)} size="sm" />;
};

const ReadOnlyNote = () => (
  <p className="flex items-center gap-2 text-xs-portal text-status-muted">
    <Lock size={13} /> Read-only — managed in ROCA Estates. Changes are made there and show here automatically.
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

const DetailModal = ({ title, subtitle, onClose, children, footer }) => (
  <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl border border-card-border overflow-hidden my-8">
      <div className="bg-brand-primary text-white p-5 flex items-center gap-3 select-none">
        <div className="flex flex-col">
          <span className="font-bold">{title}</span>
          {subtitle && <span className="text-xs text-white/70">{subtitle}</span>}
        </div>
        <button type="button" onClick={onClose} className="ml-auto p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer" aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <div className="p-6 flex flex-col gap-5 max-h-[75vh] overflow-y-auto">
        <ReadOnlyNote />
        {children}
      </div>
      {footer && <div className="px-6 pb-6 flex justify-end gap-3">{footer}</div>}
    </div>
  </div>
);

const Section = ({ title, rows }) => (
  <div>
    <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider mb-2">{title}</h3>
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
  if (!link) return <span className="text-gray-400 text-xs">—</span>;
  return <StatusPill status="active" customLabel={link.has_tenant ? 'Managed · Let' : 'Managed'} size="sm" />;
};

// ── Apartments ───────────────────────────────────────────────────────────────

const ApartmentDetail = ({ id, onClose }) => {
  const navigate = useNavigate();
  const [unit, setUnit] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/estates/properties/${id}`);
        setUnit(res.data.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load apartment');
      }
    };
    load();
  }, [id]);

  return (
    <DetailModal
      title={unit ? `${unit.unit_ref} · ${unit.name}` : 'Apartment'}
      subtitle="ROCA Estates apartment"
      onClose={onClose}
      footer={unit?.roca_living && (
        <Button variant="primary" icon={ExternalLink} onClick={() => navigate(`/properties/${unit.roca_living.property_id}`)}>
          Open lettings record
        </Button>
      )}
    >
      <LoadState loading={!unit && !error} error={error}>
        {unit && (
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
              ['Address', [unit.address, unit.city, unit.postcode].filter(Boolean).join(', ') || [unit.building_address, unit.building_city, unit.building_postcode].filter(Boolean).join(', ') || '—'],
              ['Roca Living', unit.roca_living ? `Managed${unit.roca_living.has_tenant ? ' · let' : ''} · rent ${money(unit.roca_living.rent_pcm)}` : 'Not managed by Roca Living']
            ]} />
            <Section title="Owner" rows={[
              ['Landlord', dash(unit.landlord_name)],
              ['Email', dash(unit.landlord_email)],
              ['Phone', dash(unit.landlord_phone)],
              ['Ownership', pretty(unit.ownership_structure)]
            ]} />
            <Section title="Lease & service charge" rows={[
              ['Tenure', pretty(unit.tenure_type)],
              ['Lease start', ukDate(unit.lease_start_date)],
              ['Lease end', ukDate(unit.lease_end_date)],
              ['Lease term', unit.lease_term_years ? `${unit.lease_term_years} years` : '—'],
              ['Ground rent', money(unit.ground_rent_amount)],
              ['Service charge (pa)', money(unit.service_charge_pa)],
              ['Service charge (pcm)', money(unit.service_charge_pcm)],
              ['Subletting allowed', yesNo(unit.subletting_allowed)],
              ['Pets allowed', yesNo(unit.pets_allowed)],
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
        )}
      </LoadState>
    </DetailModal>
  );
};

export const EstatesApartments = () => {
  const [buildings, setBuildings] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [block, setBlock] = useState('');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);

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
    && (!q || [u.unit_ref, u.name, u.unit_code, u.landlord_name].some((v) => String(v || '').toLowerCase().includes(q))));

  const columns = [
    { header: 'Unit', accessor: 'unit_ref', sortable: true, renderCell: (r) => <span className="font-bold">{r.unit_ref}</span> },
    { header: 'Apartment', accessor: 'name', sortable: true },
    { header: 'Block', accessor: 'building_name', sortable: true, renderCell: (r) => dash(r.building_name) },
    { header: 'Landlord', accessor: 'landlord_name', sortable: true, renderCell: (r) => r.landlord_name || <span className="text-gray-400">Not linked</span> },
    { header: 'Type', accessor: 'unit_type', renderCell: (r) => pretty(r.unit_type) },
    { header: 'Status', accessor: 'status', sortable: true, renderCell: (r) => <EstateStatus status={r.status} /> },
    { header: 'Service Charge', accessor: 'service_charge_pcm', align: 'right', renderCell: (r) => (r.service_charge_pcm ? `${money(r.service_charge_pcm)} pcm` : '—') },
    { header: 'Roca Living', accessor: 'roca_living', renderCell: (r) => <LettingsBadge link={r.roca_living} /> }
  ];

  const blockOptions = [
    { value: '', label: 'All blocks' },
    ...buildings.map((b) => ({ value: String(b.id), label: `${b.name}${b.short_code ? ` (${b.short_code})` : ''} · ${b.unit_count} units` })),
    ...(units.some((u) => !u.building_id) ? [{ value: 'none', label: 'Not in a block' }] : [])
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
        <StatCard label="Blocks" value={buildings.length} icon={Building2} iconColor="text-brand-primary bg-surface-hover" />
        <StatCard label="Apartments" value={unitCount(units.length)} icon={Home} iconColor="text-brand-primary bg-surface-hover" />
        <StatCard label="Managed by Roca Living" value={unitCount(units.filter((u) => u.roca_living).length)} icon={Home} iconColor="text-status-success bg-status-success-bg" valueColor="text-status-success" />
        <StatCard label="Vacant" value={unitCount(units.filter((u) => String(u.status).toLowerCase() === 'vacant').length)} icon={Home} iconColor="text-status-info bg-status-info-bg" valueColor="text-brand-accent" />
      </div>

      <div className="card-bg border border-card-border rounded-card shadow-premium p-4 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-end gap-3 justify-between">
          <div className="w-full md:w-72">
            <Dropdown id="estateBlock" label="Block" options={blockOptions} value={block} onChange={setBlock} placeholder="All blocks" />
          </div>
          <SearchBox value={search} onChange={setSearch} placeholder="Search unit, apartment or landlord…" />
        </div>
        <ReadOnlyNote />
        <LoadState loading={loading} error={error}>
          <DataTable columns={columns} data={shown} initialPageSize={25} onRowClick={(r) => setOpenId(r.id)} />
        </LoadState>
      </div>

      {openId && <ApartmentDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
};

// ── Landlords ────────────────────────────────────────────────────────────────

const ownershipLabel = (l) => [
  l.ownership_type === 'COMPANY' ? `Company${l.company_name ? ` · ${l.company_name}` : ''}` : 'Personal',
  l.is_joint_ownership ? `Joint${l.secondary_owner_name ? ` with ${l.secondary_owner_name}` : ''}` : null
].filter(Boolean).join(' · ');

const LandlordDetail = ({ id, onClose }) => {
  const navigate = useNavigate();
  const [ll, setLl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/estates/landlords/${id}`);
        setLl(res.data.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load landlord');
      }
    };
    load();
  }, [id]);

  const address = (a, c, p, country) => [a, c, p, country].filter(Boolean).join(', ') || '—';

  return (
    <DetailModal
      title={ll ? ll.name : 'Landlord'}
      subtitle="ROCA Estates landlord"
      onClose={onClose}
      footer={ll?.roca_living_landlord_id && (
        <Button variant="primary" icon={ExternalLink} onClick={() => navigate(`/landlords/${ll.roca_living_landlord_id}`)}>
          Open Roca Living landlord
        </Button>
      )}
    >
      <LoadState loading={!ll && !error} error={error}>
        {ll && (
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
            <div>
              <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider mb-2">Apartments ({ll.units.length})</h3>
              {ll.units.length === 0 ? (
                <p className="text-sm text-status-muted">No apartments linked to this landlord in ROCA Estates.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {ll.units.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-3 border border-card-border rounded-card px-4 py-2 text-sm">
                      <span><span className="font-bold">{u.unit_ref}</span> · {u.name}</span>
                      <span className="flex items-center gap-2"><EstateStatus status={u.status} /><LettingsBadge link={u.roca_living} /></span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </LoadState>
    </DetailModal>
  );
};

export const EstatesLandlords = () => {
  const [landlords, setLandlords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);

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
  const shown = landlords.filter((l) => !q || [l.name, l.email, l.company_name, ...l.units].some((v) => String(v || '').toLowerCase().includes(q)));

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard label="Landlords" value={landlords.length} icon={Users} iconColor="text-brand-primary bg-surface-hover" />
        <StatCard label="With apartments" value={landlords.filter((l) => l.units.length).length} icon={Home} iconColor="text-status-info bg-status-info-bg" />
        <StatCard label="With a Roca Living account" value={landlords.filter((l) => l.roca_living_landlord_id).length} icon={Users} iconColor="text-status-success bg-status-success-bg" valueColor="text-status-success" />
      </div>
      <div className="card-bg border border-card-border rounded-card shadow-premium p-4 flex flex-col gap-4">
        <div className="flex justify-end">
          <SearchBox value={search} onChange={setSearch} placeholder="Search name, email, company or unit…" />
        </div>
        <ReadOnlyNote />
        <LoadState loading={loading} error={error}>
          <DataTable columns={columns} data={shown} initialPageSize={25} onRowClick={(r) => setOpenId(r.id)} />
        </LoadState>
      </div>
      {openId && <LandlordDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
};

