import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PoundSterling, CalendarDays, Clock, AlertTriangle, BarChart3, Banknote, Users, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Cell, LabelList } from 'recharts';
import { DataTable } from '../components/UI/DataTable';
import { Skeleton } from '../components/UI/Skeleton';
import { useToast } from '../components/UI/ToastContext';
import { ListTabs, ExportButton } from '../components/UI/ListToolbar';
import {
  PageActions, KpiRow, KpiCard, WithRail, SectionCard, Donut, QuickActions, UpcomingList,
  InfoFooter, Pill, PersonCell, Two, SearchInput,
} from '../components/UI/DesignKit';
import { C, gbp, shortDate, pct } from '../utilities/designTokens';
import api from '../utilities/api';
import { downloadCsv } from '../utilities/csv';

// Design p18 (Arrears): KPI row by age, arrears per tenancy with last payment,
// summary donut, ageing bars, top 5 and quick actions.
const BUCKETS = [
  { key: '1-30', label: '1–30 days', min: 0, max: 30, color: C.amber, tone: 'orange' },
  { key: '31-60', label: '31–60 days', min: 31, max: 60, color: C.red, tone: 'red' },
  { key: '61-90', label: '61–90 days', min: 61, max: 90, color: C.indigo, tone: 'indigo' },
  { key: '90+', label: '90+ days', min: 91, max: Infinity, color: C.purple, tone: 'indigo' },
];
const overLabel = (days) => (days > 90 ? 'Over 90 days' : days > 60 ? 'Over 60 days' : days > 30 ? 'Over 30 days' : 'Under 30 days');

export const Arrears = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [schedules, setSchedules] = useState([]);
  const [lastPayments, setLastPayments] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/reports/arrears');
        setSchedules(res.data.data?.overdue_schedules || []);
        setLastPayments(res.data.data?.last_payments || {});
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load arrears', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [addToast, reloadKey]);

  // One row per tenancy with its total and oldest overdue month
  const byTenancy = Object.values(
    schedules.reduce((acc, s) => {
      const key = s.tenancy_id;
      if (!acc[key]) {
        acc[key] = {
          tenancy_id: s.tenancy_id,
          tenant_name: s.tenant_name || '—',
          tenant_email: s.tenant_email,
          tenant_id: s.tenant_id,
          landlord_name: s.landlord_name,
          property: s.property_name || s.property_address,
          property_address: s.property_address,
          postcode: s.postcode,
          total: 0,
          oldest_due: s.due_date,
          days_overdue: s.days_overdue,
        };
      }
      acc[key].total += parseFloat(s.amount);
      if (s.due_date < acc[key].oldest_due) acc[key].oldest_due = s.due_date;
      if (s.days_overdue > acc[key].days_overdue) acc[key].days_overdue = s.days_overdue;
      return acc;
    }, {})
  ).map((r) => ({ ...r, last: lastPayments[r.tenancy_id] || null })).sort((a, b) => b.total - a.total);

  const totalOutstanding = byTenancy.reduce((s, t) => s + t.total, 0);
  const bucketTotals = BUCKETS.map((b) => {
    const inBucket = schedules.filter((s) => s.days_overdue >= b.min && s.days_overdue <= b.max);
    return { ...b, total: inBucket.reduce((sum, s) => sum + parseFloat(s.amount), 0), tenancies: new Set(inBucket.map((s) => s.tenancy_id)).size };
  });
  const over = (days) => byTenancy.filter((t) => t.days_overdue > days);
  // Money more than N days late (by rent month, like the ageing chart)
  const sumOver = (days) => schedules.filter((s) => s.days_overdue > days).reduce((sum, s) => sum + parseFloat(s.amount), 0);

  const q = search.trim().toLowerCase();
  const visible = (tab === 'over30' ? over(30) : tab === 'over60' ? over(60) : tab === 'over90' ? over(90) : byTenancy)
    .filter((r) => !q || [r.tenant_name, r.tenant_email, r.property, r.landlord_name].some((v) => String(v || '').toLowerCase().includes(q)));

  const tabs = [
    { id: 'all', label: 'All Arrears', count: byTenancy.length },
    { id: 'over30', label: 'Over 30 days', count: over(30).length },
    { id: 'over60', label: 'Over 60 days', count: over(60).length },
    { id: 'over90', label: 'Over 90 days', count: over(90).length },
  ];

  const exportCsv = () => downloadCsv('arrears.csv', visible, [
    { key: 'tenant_name', label: 'Tenant' },
    { key: 'property_address', label: 'Property' },
    { key: 'landlord_name', label: 'Landlord' },
    { key: (r) => shortDate(r.oldest_due), label: 'Overdue Since' },
    { key: 'days_overdue', label: 'Days Overdue' },
    { key: (r) => (r.last ? shortDate(r.last.date) : ''), label: 'Last Payment Date' },
    { key: (r) => (r.last ? r.last.amount : ''), label: 'Last Payment (£)' },
    { key: (r) => r.total.toFixed(2), label: 'Total Arrears (£)' },
  ]);

  const columns = [
    { header: 'Tenant', accessor: 'tenant_name', sortable: true, renderCell: (r) => <PersonCell name={r.tenant_name} sub={r.tenant_email} /> },
    { header: 'Property', accessor: 'property', sortable: true, renderCell: (r) => <Two top={r.property} bottom={[r.postcode, r.landlord_name && `Landlord: ${r.landlord_name}`].filter(Boolean).join(' · ')} width="max-w-[200px]" /> },
    { header: 'Total Arrears', accessor: 'total', align: 'right', sortable: true, renderCell: (r) => <span className="text-status-danger font-bold whitespace-nowrap">{gbp(r.total)}</span> },
    { header: 'Overdue Since', accessor: 'oldest_due', sortable: true, renderCell: (r) => shortDate(r.oldest_due) },
    { header: 'Days Overdue', accessor: 'days_overdue', sortable: true, renderCell: (r) => <span className="font-semibold whitespace-nowrap">{r.days_overdue} days</span> },
    { header: 'Last Payment', accessor: 'last', sortValue: (r) => r.last?.date || '', sortable: true, renderCell: (r) => (r.last ? <Two top={shortDate(r.last.date)} bottom={gbp(r.last.amount)} /> : <span className="text-gray-400">None</span>) },
    { header: 'Status', accessor: 'days_overdue', renderCell: (r) => <Pill tone={r.days_overdue > 60 ? 'red' : 'orange'}>{overLabel(r.days_overdue)}</Pill> },
  ];

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      <PageActions>
        <ExportButton onClick={exportCsv} disabled={loading || !visible.length} />
      </PageActions>

      <KpiRow>
        <KpiCard icon={PoundSterling} tone="red" label="Total Outstanding" value={gbp(totalOutstanding)} sub={`Across ${byTenancy.length} tenanc${byTenancy.length === 1 ? 'y' : 'ies'}`} link="View all arrears" onClick={() => setTab('all')} loading={loading} />
        <KpiCard icon={CalendarDays} tone="orange" label="Tenancies in Arrears" value={byTenancy.length} sub="With rent overdue" link="View tenants" to="/tenants" loading={loading} />
        <KpiCard icon={Clock} tone="blue" label="Over 30 days" value={gbp(sumOver(30))} sub={`${over(30).length} tenanc${over(30).length === 1 ? 'y' : 'ies'}`} link="View over 30 days" onClick={() => setTab('over30')} loading={loading} />
        <KpiCard icon={AlertTriangle} tone="red" label="Over 60 days" value={gbp(sumOver(60))} sub={`${over(60).length} tenanc${over(60).length === 1 ? 'y' : 'ies'}`} link="View over 60 days" onClick={() => setTab('over60')} loading={loading} />
        <KpiCard icon={BarChart3} tone="indigo" label="Over 90 days" value={gbp(sumOver(90))} sub={`${over(90).length} tenanc${over(90).length === 1 ? 'y' : 'ies'}`} link="View over 90 days" onClick={() => setTab('over90')} loading={loading} />
      </KpiRow>

      <WithRail
        rail={(
          <>
            <SectionCard title="Arrears Summary" action="View Report" to="/reports">
              <Donut
                data={bucketTotals.map((b) => ({ label: b.label, value: b.total, color: b.color, display: `${gbp(b.total)} (${pct(b.total, totalOutstanding)})` }))}
                centre={gbp(totalOutstanding).replace(/\.\d\d$/, '')}
                sub="Total"
              />
            </SectionCard>
            <SectionCard title="Arrears Ageing">
              {totalOutstanding === 0 ? (
                <p className="text-[11px] text-gray-400 font-semibold py-2">Nothing outstanding.</p>
              ) : (
                <BarChart width={290} height={170} data={bucketTotals} margin={{ top: 18, right: 8, left: 8, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    <LabelList dataKey="total" position="top" formatter={(v) => (v ? gbp(v).replace(/\.\d\d$/, '') : '')} style={{ fontSize: 10, fontWeight: 700 }} />
                    {bucketTotals.map((b) => <Cell key={b.key} fill={b.color} />)}
                  </Bar>
                </BarChart>
              )}
            </SectionCard>
            <SectionCard title="Top 5 Arrears by Amount">
              <UpcomingList
                empty="No arrears."
                items={byTenancy.slice(0, 5).map((r) => ({
                  key: r.tenancy_id,
                  title: r.tenant_name,
                  sub: r.property,
                  date: gbp(r.total),
                  to: r.tenant_id ? `/tenants/${r.tenant_id}` : undefined,
                }))}
              />
            </SectionCard>
            <QuickActions items={[
              { icon: Banknote, label: 'Record Manual Payment', sub: 'Record a payment on the tenant page', to: '/tenants' },
              { icon: Users, label: 'Tenants', sub: 'Balances and contact details', to: '/tenants' },
              { icon: FileText, label: 'Generate Arrears Report', sub: 'Arrears by landlord and property', to: '/reports' },
            ]} />
          </>
        )}
      >
        <SectionCard>
          <div className="flex items-end justify-between gap-3 flex-wrap border-b border-card-border">
            <ListTabs tabs={tabs} value={tab} onChange={setTab} />
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search tenants, properties…" className="w-full md:w-96" />
          {loading ? (
            <Skeleton radius="card" className="h-48 w-full" />
          ) : byTenancy.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-10 text-center">No arrears — all rent is up to date.</p>
          ) : (
            <DataTable columns={columns} data={visible} onRowClick={(r) => r.tenant_id && navigate(`/tenants/${r.tenant_id}`)} />
          )}
        </SectionCard>
      </WithRail>

      <InfoFooter text="Arrears are rent months past their due date and not fully paid." onRefresh={() => setReloadKey((k) => k + 1)} />
    </div>
  );
};
