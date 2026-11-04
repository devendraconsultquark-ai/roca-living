import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Home, CheckCircle2, Hash, MailWarning, UserPlus, Settings2 } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Skeleton } from '../components/UI/Skeleton';
import { useToast } from '../components/UI/ToastContext';
import { ListTabs, ExportButton } from '../components/UI/ListToolbar';
import {
  PageActions, KpiRow, KpiCard, WithRail, SectionCard, Donut, QuickActions,
  InfoFooter, PersonCell, SearchInput,
} from '../components/UI/DesignKit';
import { C, pct } from '../utilities/designTokens';
import api from '../utilities/api';
import { downloadCsv } from '../utilities/csv';

// Design (Landlord Onboarding), real data only: for every landlord in ROCA
// Estates, the set-up steps recorded in ROCA Estates (contact email, NRL,
// statement email) and in Roca Living (Terms of Business, KYC, bank details).
const STEPS = [
  { key: 'contact_email', label: 'Contact Email' },
  { key: 'nrl', label: 'NRL Number' },
  { key: 'statement_email', label: 'Statement Email' },
  { key: 'terms_signed', label: 'Terms of Business' },
  { key: 'kyc', label: 'KYC Check' },
  { key: 'bank_details', label: 'Bank Details' },
];
const applicable = (r) => STEPS.filter((s) => r.steps[s.key] !== null);
const done = (r) => applicable(r).filter((s) => r.steps[s.key]).length;
const complete = (r) => done(r) === applicable(r).length;

const Mark = ({ value }) => (value === null
  ? <span className="text-gray-300 font-semibold" title="Not needed">N/A</span>
  : value
    ? <span className="text-status-success font-bold">✓</span>
    : <span className="text-status-warning font-bold">•</span>);

export const LandlordOnboarding = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('managed');
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    api.get('/estates/onboarding', { skipInterceptorError: true })
      .then((res) => { if (alive) setRows(res.data.data || []); })
      .catch((err) => { if (alive) addToast(err.response?.data?.message || 'Failed to load landlords', 'error'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [addToast, reloadKey]);

  const managed = rows.filter((r) => r.managed_units > 0);
  const TAB_FILTERS = {
    managed: (r) => r.managed_units > 0,
    incomplete: (r) => r.managed_units > 0 && !complete(r),
    not_managed: (r) => !r.managed_units,
    all: () => true,
  };
  const tabs = [
    { id: 'managed', label: 'Managed By Roca Living' },
    { id: 'incomplete', label: 'Steps Missing' },
    { id: 'not_managed', label: 'Not Managed' },
    { id: 'all', label: 'All Landlords' },
  ].map((t) => ({ ...t, count: rows.filter(TAB_FILTERS[t.id]).length }));
  const q = search.trim().toLowerCase();
  const visible = rows.filter(TAB_FILTERS[tab])
    .filter((r) => !q || [r.name, r.joint_name, r.email, ...(r.units || [])].some((v) => String(v || '').toLowerCase().includes(q)));

  const fullySetUp = managed.filter(complete);
  const missingNrl = rows.filter((r) => r.steps.nrl === false);
  const noEmail = rows.filter((r) => !r.steps.contact_email);

  const stepDonut = STEPS.map((s, i) => {
    const n = managed.filter((r) => r.steps[s.key] === true).length;
    const need = managed.filter((r) => r.steps[s.key] !== null).length;
    return { label: s.label, value: n, color: [C.green, C.indigo, C.blue, C.amber, C.teal, C.purple][i], display: `${n} of ${need}` };
  });

  const exportCsv = () => downloadCsv('landlord-onboarding.csv', visible, [
    { key: 'name', label: 'Landlord' },
    { key: (r) => r.joint_name || '', label: 'Joint Owner' },
    { key: (r) => (r.units || []).join(' '), label: 'Flats' },
    { key: (r) => (r.managed_units ? 'Yes' : 'No'), label: 'Managed' },
    ...STEPS.map((s) => ({ key: (r) => (r.steps[s.key] === null ? 'N/A' : r.steps[s.key] ? 'Done' : 'Missing'), label: s.label })),
  ]);

  const columns = [
    { header: 'Landlord', accessor: 'name', sortable: true, renderCell: (r) => <PersonCell name={r.name} sub={r.joint_name ? `& ${r.joint_name}` : r.email || 'No email'} /> },
    { header: 'Flats', accessor: 'units', sortValue: (r) => (r.units || []).join(','), sortable: true, renderCell: (r) => <span className="text-xs font-semibold">{(r.units || []).join(', ') || '—'}{r.managed_units ? <span className="block text-[11px] text-status-success">{r.managed_units} managed</span> : null}</span> },
    ...STEPS.map((s) => ({ header: s.label, accessor: s.key, align: 'center', sortValue: (r) => (r.steps[s.key] === null ? 2 : r.steps[s.key] ? 1 : 0), sortable: true, renderCell: (r) => <Mark value={r.steps[s.key]} /> })),
    { header: 'Done', accessor: 'id', align: 'right', sortValue: (r) => done(r) / (applicable(r).length || 1), sortable: true, renderCell: (r) => <span className={complete(r) ? 'text-status-success font-bold' : 'font-bold'}>{done(r)}/{applicable(r).length}</span> },
  ];

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      <PageActions>
        <ExportButton onClick={exportCsv} disabled={loading || !visible.length} />
      </PageActions>

      <KpiRow>
        <KpiCard icon={Users} tone="indigo" label="Landlords" value={rows.length} sub="In ROCA Estates" link="View all" onClick={() => setTab('all')} loading={loading} />
        <KpiCard icon={Home} tone="blue" label="Managed By Roca Living" value={managed.length} sub={`${pct(managed.length, rows.length)} of landlords`} link="View" onClick={() => setTab('managed')} loading={loading} />
        <KpiCard icon={CheckCircle2} tone="green" label="Fully Set Up" value={`${fullySetUp.length} / ${managed.length}`} sub="Managed landlords" link="Steps missing" onClick={() => setTab('incomplete')} loading={loading} />
        <KpiCard icon={Hash} tone="orange" label="NRL Number Missing" value={missingNrl.length} sub="Personal owners" subTone={missingNrl.length ? 'red' : undefined} loading={loading} />
        <KpiCard icon={MailWarning} tone="orange" label="No Email Address" value={noEmail.length} sub="Placeholder in ROCA Estates" subTone={noEmail.length ? 'red' : undefined} loading={loading} />
      </KpiRow>

      <WithRail
        rail={(
          <>
            <SectionCard title="Managed Landlords: Steps Done">
              <Donut data={stepDonut} centre={managed.length} sub="Managed" />
            </SectionCard>
            <QuickActions items={[
              { icon: UserPlus, label: 'All Landlords', sub: 'Add or edit a landlord', to: '/landlords' },
              { icon: Settings2, label: 'Landlord Settings', sub: "ToB, KYC and bank details on each landlord's page", to: '/landlords' },
            ]} />
          </>
        )}
      >
        <SectionCard>
          <div className="flex items-end justify-between gap-3 flex-wrap border-b border-card-border">
            <ListTabs tabs={tabs} value={tab} onChange={setTab} />
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search landlord, email, flat…" className="w-full md:w-96" />
          {loading ? (
            <Skeleton radius="card" className="h-48 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-10 text-center">No landlords in ROCA Estates.</p>
          ) : (
            <DataTable
              columns={columns}
              data={visible}
              onRowClick={(r) => navigate(r.roca_living_landlord_id ? `/landlords/${r.roca_living_landlord_id}` : `/landlords/estates/${r.id}`)}
            />
          )}
        </SectionCard>
      </WithRail>

      <InfoFooter text="Contact, NRL and statement email come from ROCA Estates; Terms of Business, KYC and bank details are on the landlord's page in Roca Living. ✓ done · • missing · N/A not needed (companies have no NRL)." onRefresh={() => setReloadKey((k) => k + 1)} />
    </div>
  );
};
