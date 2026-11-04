import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hourglass, Home, LogOut, Archive, ListChecks, FileText, ShieldCheck, Users } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Skeleton } from '../components/UI/Skeleton';
import { useToast } from '../components/UI/ToastContext';
import { ListTabs, ExportButton } from '../components/UI/ListToolbar';
import {
  PageActions, KpiRow, KpiCard, WithRail, SectionCard, Donut, QuickActions,
  InfoFooter, Pill, PersonCell, Two, SearchInput,
} from '../components/UI/DesignKit';
import { C, shortDate, pct } from '../utilities/designTokens';
import api from '../utilities/api';
import { downloadCsv } from '../utilities/csv';

// Design (Tenancy Lifecycle), real data only: every tenancy by stage, with the
// set-up steps Roca Living records (tenant, Right to Rent, deposit protected,
// rent handled in Roca Living).
const STAGES = {
  pending: { label: 'Pending', tone: 'indigo', color: C.indigo, icon: Hourglass },
  active: { label: 'Active', tone: 'green', color: C.green, icon: Home },
  notice: { label: 'Notice Given', tone: 'orange', color: C.amber, icon: LogOut },
  ended: { label: 'Ended', tone: 'grey', color: C.grey, icon: Archive },
};
const flatOf = (t) => (t.block_name && t.apartment_number ? `${String(t.block_name).toUpperCase()}-${t.apartment_number}` : t.property_name || '—');
const Step = ({ ok, label }) => (
  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${ok ? 'text-status-success' : 'text-status-warning'}`}>
    {ok ? '✓' : '•'} {label}
  </span>
);

export const TenancyLifecycle = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get('/tenancies', { skipInterceptorError: true }),
      api.get('/deposits', { skipInterceptorError: true }).catch(() => ({ data: { data: [] } })),
      api.get('/tenancies/tenants/all', { skipInterceptorError: true }).catch(() => ({ data: { data: [] } })),
    ])
      .then(([tRes, dRes, pRes]) => {
        if (!alive) return;
        const deposits = dRes.data.data || [];
        const people = pRes.data.data || [];
        setRows((tRes.data.data || []).map((t) => {
          const dep = deposits.find((d) => d.tenancy_id === t.id) || null;
          const tenants = people.filter((p) => p.tenancy_id === t.id);
          return {
            id: t.id,
            stage: STAGES[t.status] ? t.status : 'ended',
            tenant: t.lead_tenant_name || '—',
            tenantEmail: t.lead_tenant_email || null,
            tenantId: t.lead_tenant_id || null,
            flat: flatOf(t),
            landlord: t.landlord_name || '—',
            start: t.start_date,
            end: t.end_date,
            rlFrom: t.statements_from,
            hasTenant: tenants.length > 0,
            rtrOk: tenants.length > 0 && tenants.every((p) => p.right_to_rent_status === 'verified'),
            deposit: dep ? (dep.status === 'registered' ? 'protected' : 'not_protected') : 'none',
          };
        }).sort((a, b) => String(a.flat).localeCompare(String(b.flat), 'en', { numeric: true })));
      })
      .catch((err) => { if (alive) addToast(err.response?.data?.message || 'Failed to load tenancies', 'error'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [addToast, reloadKey]);

  const counts = { pending: 0, active: 0, notice: 0, ended: 0 };
  rows.forEach((r) => { counts[r.stage] += 1; });
  const stepsDone = (r) => [r.hasTenant, r.rtrOk, r.deposit === 'protected', !!r.rlFrom].filter(Boolean).length;
  const open = rows.filter((r) => r.stage !== 'ended' && stepsDone(r) < 4);

  const tabs = [{ id: 'all', label: 'All Tenancies' }, ...Object.entries(STAGES).map(([id, s]) => ({ id, label: s.label }))]
    .map((t) => ({ ...t, count: t.id === 'all' ? rows.length : counts[t.id] }));
  const q = search.trim().toLowerCase();
  const visible = rows.filter((r) => tab === 'all' || r.stage === tab)
    .filter((r) => !q || [r.tenant, r.flat, r.landlord].some((v) => String(v || '').toLowerCase().includes(q)));

  const donut = Object.entries(STAGES).map(([k, s]) => ({ label: s.label, value: counts[k], color: s.color, display: `${counts[k]} (${pct(counts[k], rows.length)})` }));

  const exportCsv = () => downloadCsv('tenancy-lifecycle.csv', visible, [
    { key: 'flat', label: 'Flat' },
    { key: 'tenant', label: 'Tenant' },
    { key: (r) => STAGES[r.stage].label, label: 'Stage' },
    { key: (r) => shortDate(r.start), label: 'Start' },
    { key: (r) => (r.end ? shortDate(r.end) : ''), label: 'End' },
    { key: (r) => (r.rtrOk ? 'Verified' : 'Not verified'), label: 'Right to Rent' },
    { key: (r) => ({ protected: 'Protected', not_protected: 'Not protected', none: 'None recorded' }[r.deposit]), label: 'Deposit' },
    { key: (r) => (r.rlFrom ? shortDate(r.rlFrom) : ''), label: 'Rent in Roca Living From' },
  ]);

  const columns = [
    { header: 'Flat', accessor: 'flat', sortable: true, sortValue: (r) => String(r.flat).padStart(8, '0'), renderCell: (r) => <Two top={r.flat} bottom={r.landlord} /> },
    { header: 'Tenant', accessor: 'tenant', sortable: true, renderCell: (r) => <PersonCell name={r.tenant} sub={r.tenantEmail} /> },
    { header: 'Stage', accessor: 'stage', sortable: true, renderCell: (r) => <Pill tone={STAGES[r.stage].tone}>{STAGES[r.stage].label}</Pill> },
    { header: 'Dates', accessor: 'start', sortable: true, renderCell: (r) => <Two top={`From ${shortDate(r.start)}`} bottom={r.end ? `To ${shortDate(r.end)}` : 'No end date'} /> },
    {
      header: 'Set-Up Steps',
      accessor: 'id',
      sortValue: (r) => stepsDone(r),
      sortable: true,
      renderCell: (r) => (
        <div className="flex flex-col gap-0.5">
          <Step ok={r.rtrOk} label="Right to Rent verified" />
          <Step ok={r.deposit === 'protected'} label={r.deposit === 'none' ? 'No deposit recorded' : 'Deposit protected'} />
          <Step ok={!!r.rlFrom} label={r.rlFrom ? `Rent in Roca Living from ${shortDate(r.rlFrom)}` : 'Rent handled from: not set'} />
        </div>
      ),
    },
  ];

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      <PageActions>
        <ExportButton onClick={exportCsv} disabled={loading || !visible.length} />
      </PageActions>

      <KpiRow>
        {Object.entries(STAGES).map(([k, s]) => (
          <KpiCard key={k} icon={s.icon} tone={s.tone === 'grey' ? 'indigo' : s.tone} label={s.label} value={counts[k]} sub={`${pct(counts[k], rows.length)} of tenancies`} link="View" onClick={() => setTab(k)} loading={loading} />
        ))}
        <KpiCard icon={ListChecks} tone="orange" label="Steps Missing" value={open.length} sub="Current tenancies not fully set up" subTone={open.length ? 'red' : undefined} loading={loading} />
      </KpiRow>

      <WithRail
        rail={(
          <>
            <SectionCard title="Tenancies By Stage">
              <Donut data={donut} centre={rows.length} sub="Total" />
            </SectionCard>
            <QuickActions items={[
              { icon: FileText, label: 'Tenancies', sub: 'Add, edit or end a tenancy', to: '/tenancies' },
              { icon: Users, label: 'Tenants', sub: 'Right to Rent on each tenant', to: '/tenants' },
              { icon: ShieldCheck, label: 'Deposits', sub: 'Register and protect deposits', to: '/deposits' },
            ]} />
          </>
        )}
      >
        <SectionCard>
          <div className="flex items-end justify-between gap-3 flex-wrap border-b border-card-border">
            <ListTabs tabs={tabs} value={tab} onChange={setTab} />
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search flat, tenant, landlord…" className="w-full md:w-96" />
          {loading ? (
            <Skeleton radius="card" className="h-48 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-10 text-center">No tenancies yet.</p>
          ) : (
            <DataTable columns={columns} data={visible} onRowClick={(r) => r.tenantId && navigate(`/tenants/${r.tenantId}`)} />
          )}
        </SectionCard>
      </WithRail>

      <InfoFooter text="Stages come from each tenancy's status; Right to Rent is set on the tenant, the deposit on Deposits." onRefresh={() => setReloadKey((k) => k + 1)} />
    </div>
  );
};
