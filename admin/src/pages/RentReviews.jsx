import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, AlertTriangle, CheckCircle2, TrendingUp, PoundSterling, Plus, FileText, BarChart3 } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { Skeleton } from '../components/UI/Skeleton';
import { useToast } from '../components/UI/ToastContext';
import { ListTabs, ExportButton } from '../components/UI/ListToolbar';
import {
  PageActions, KpiRow, KpiCard, WithRail, SectionCard, Donut, QuickActions, UpcomingList,
  InfoFooter, Pill, PersonCell, Two, SearchInput,
} from '../components/UI/DesignKit';
import { C, gbp, shortDate, daysUntil, pct } from '../utilities/designTokens';
import api from '../utilities/api';
import { downloadCsv } from '../utilities/csv';

// Design p17 (Rent Reviews). Reviews are scheduled and completed with the
// "Rent Review" action on Tenancies; this page tracks them.
const statusOf = (row) => {
  if (row.reviewStatus === 'completed') return 'completed';
  if (row.reviewStatus === 'in_progress') return 'in_progress';
  if (row.daysUntil < 0) return 'overdue';
  if (row.daysUntil <= 90) return 'upcoming';
  return 'scheduled';
};
const STATUS = {
  completed: { label: 'Completed', tone: 'green' },
  in_progress: { label: 'In Progress', tone: 'blue' },
  overdue: { label: 'Overdue', tone: 'red' },
  upcoming: { label: 'Upcoming', tone: 'orange' },
  scheduled: { label: 'Scheduled', tone: 'indigo' },
};

export const RentReviews = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/tenancies');
        const reviews = (res.data.data || [])
          .filter((t) => t.rent_review_status && t.rent_review_status !== 'none' && t.rent_review_date)
          .map((t) => ({
            id: t.id,
            tenant: t.lead_tenant_name || '—',
            tenantEmail: t.lead_tenant_email || null,
            tenantId: t.lead_tenant_id || null,
            property: t.property_name || `${t.address_line1 || ''}, ${t.city || ''}`.replace(/^, /, ''),
            postcode: t.postcode || null,
            reviewDate: t.rent_review_date,
            daysUntil: daysUntil(t.rent_review_date),
            current: parseFloat(t.rent_pcm || 0),
            proposed: t.proposed_rent !== null && t.proposed_rent !== undefined ? parseFloat(t.proposed_rent) : null,
            reviewStatus: t.rent_review_status,
          }))
          .sort((a, b) => (a.reviewDate < b.reviewDate ? -1 : 1));
        setRows(reviews);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load rent reviews', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [addToast, reloadKey]);

  const open = rows.filter((r) => r.reviewStatus !== 'completed');
  const dueSoon = open.filter((r) => r.daysUntil >= 0 && r.daysUntil <= 90);
  const overdue = open.filter((r) => r.daysUntil < 0);
  const completed = rows.filter((r) => r.reviewStatus === 'completed');
  const thisYear = String(new Date().getFullYear());
  const completedYtd = completed.filter((r) => String(r.reviewDate).startsWith(thisYear));

  const increaseOf = (r) => (r.proposed !== null && r.current > 0 ? ((r.proposed - r.current) / r.current) * 100 : null);
  const ytdIncreases = completedYtd.map(increaseOf).filter((v) => v !== null);
  const avgIncrease = ytdIncreases.length ? ytdIncreases.reduce((s, v) => s + v, 0) / ytdIncreases.length : null;
  const ytdExtra = completedYtd.filter((r) => r.proposed !== null).reduce((s, r) => s + (r.proposed - r.current), 0);
  const projectedAnnual = open.filter((r) => r.proposed !== null).reduce((s, r) => s + (r.proposed - r.current) * 12, 0);
  const rentOf = (list) => list.reduce((s, r) => s + r.current, 0);

  const TAB_FILTERS = {
    all: () => true,
    upcoming: (r) => dueSoon.includes(r),
    overdue: (r) => overdue.includes(r),
    completed: (r) => r.reviewStatus === 'completed',
  };
  const tabs = [
    { id: 'all', label: 'All Reviews' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'completed', label: 'Completed' },
  ].map((t) => ({ ...t, count: rows.filter(TAB_FILTERS[t.id]).length }));
  const q = search.trim().toLowerCase();
  const visible = rows.filter(TAB_FILTERS[tab])
    .filter((r) => !q || [r.tenant, r.tenantEmail, r.property].some((v) => String(v || '').toLowerCase().includes(q)));

  const counts = { upcoming: 0, overdue: 0, scheduled: 0, completed: 0, in_progress: 0 };
  rows.forEach((r) => { counts[statusOf(r)] += 1; });
  const donut = [
    { label: 'Upcoming (≤ 90 days)', value: counts.upcoming + counts.in_progress, color: C.amber },
    { label: 'Overdue', value: counts.overdue, color: C.red },
    { label: 'Scheduled (> 90 days)', value: counts.scheduled, color: C.blue },
    { label: 'Completed', value: counts.completed, color: C.green },
  ].map((d) => ({ ...d, display: `${d.value} (${pct(d.value, rows.length)})` }));

  const exportCsv = () => downloadCsv('rent-reviews.csv', visible, [
    { key: 'tenant', label: 'Tenant' },
    { key: 'property', label: 'Property' },
    { key: (r) => shortDate(r.reviewDate), label: 'Review Date' },
    { key: (r) => r.current.toFixed(2), label: 'Current Rent (£)' },
    { key: (r) => (r.proposed !== null ? r.proposed.toFixed(2) : ''), label: 'Proposed Rent (£)' },
    { key: (r) => { const i = increaseOf(r); return i !== null ? i.toFixed(2) : ''; }, label: 'Increase (%)' },
    { key: (r) => STATUS[statusOf(r)].label, label: 'Status' },
  ]);

  const columns = [
    { header: 'Tenant', accessor: 'tenant', sortable: true, renderCell: (r) => <PersonCell name={r.tenant} sub={r.tenantEmail} /> },
    { header: 'Property', accessor: 'property', sortable: true, renderCell: (r) => <Two top={r.property} bottom={r.postcode} /> },
    {
      header: 'Review Date',
      accessor: 'reviewDate',
      sortable: true,
      renderCell: (r) => (
        <Two
          top={shortDate(r.reviewDate)}
          bottom={r.reviewStatus === 'completed' ? 'completed'
            : r.daysUntil < 0 ? <span className="text-status-danger">overdue by {Math.abs(r.daysUntil)} days</span>
              : r.daysUntil === 0 ? 'today' : `in ${r.daysUntil} days`}
        />
      ),
    },
    { header: 'Current Rent (PCM)', accessor: 'current', align: 'right', sortable: true, renderCell: (r) => gbp(r.current) },
    { header: 'Proposed Rent (PCM)', accessor: 'proposed', align: 'right', sortable: true, renderCell: (r) => (r.proposed !== null ? gbp(r.proposed) : '—') },
    {
      header: 'Increase',
      accessor: 'proposed',
      align: 'right',
      sortValue: (r) => increaseOf(r) ?? -999,
      sortable: true,
      renderCell: (r) => {
        const i = increaseOf(r);
        if (i === null) return '—';
        return (
          <span className={i >= 0 ? 'text-status-success' : 'text-status-danger'}>
            {i.toFixed(2)}%
            <span className="block text-[11px] text-gray-400 font-semibold">{i >= 0 ? '+' : '-'}{gbp(Math.abs(r.proposed - r.current))}</span>
          </span>
        );
      },
    },
    { header: 'Status', accessor: 'reviewStatus', sortValue: (r) => statusOf(r), sortable: true, renderCell: (r) => { const s = STATUS[statusOf(r)]; return <Pill tone={s.tone}>{s.label}</Pill>; } },
  ];

  const upcoming = open.filter((r) => r.daysUntil !== null).slice(0, 4);

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      <PageActions>
        <ExportButton onClick={exportCsv} disabled={loading || !visible.length} />
        <Button variant="accent" icon={Plus} onClick={() => navigate('/tenancies')}>New Rent Review</Button>
      </PageActions>

      <KpiRow>
        <KpiCard icon={CalendarClock} tone="indigo" label="Reviews Due (90 days)" value={dueSoon.length} sub={`Total rent: ${gbp(rentOf(dueSoon))}`} link="View upcoming" onClick={() => setTab('upcoming')} loading={loading} />
        <KpiCard icon={AlertTriangle} tone="orange" label="Overdue Reviews" value={overdue.length} sub={`Total rent: ${gbp(rentOf(overdue))}`} subTone={overdue.length ? 'red' : undefined} link="View overdue" onClick={() => setTab('overdue')} loading={loading} />
        <KpiCard icon={CheckCircle2} tone="green" label="Completed (YTD)" value={completedYtd.length} sub={`Increase: ${gbp(ytdExtra)} pcm`} link="View completed" onClick={() => setTab('completed')} loading={loading} />
        <KpiCard icon={TrendingUp} tone="blue" label="Average Increase (YTD)" value={avgIncrease !== null ? `${avgIncrease.toFixed(1)}%` : '—'} sub="Completed reviews this year" loading={loading} />
        <KpiCard icon={PoundSterling} tone="indigo" label="Projected Additional Rent (12m)" value={gbp(projectedAnnual)} sub="From open reviews with a proposal" loading={loading} />
      </KpiRow>

      <WithRail
        rail={(
          <>
            <SectionCard title="Rent Review Overview" action="View Report" to="/reports">
              <Donut data={donut} centre={rows.length} sub="Total" />
            </SectionCard>
            <SectionCard title="Upcoming Rent Reviews" action="View all" onAction={() => setTab('upcoming')}>
              <UpcomingList
                empty="No rent reviews coming up."
                items={upcoming.map((r) => ({
                  key: r.id,
                  title: r.tenant,
                  sub: r.property,
                  date: shortDate(r.reviewDate),
                  badge: r.daysUntil < 0 ? `${Math.abs(r.daysUntil)} days late` : `${r.daysUntil} days`,
                  badgeTone: r.daysUntil < 0 ? 'red' : r.daysUntil <= 30 ? 'orange' : 'grey',
                }))}
              />
            </SectionCard>
            <QuickActions items={[
              { icon: Plus, label: 'Create New Rent Review', sub: 'Set up a rent review for a tenancy', to: '/tenancies' },
              { icon: FileText, label: 'Tenancies', sub: 'Current rent and review dates', to: '/tenancies' },
              { icon: BarChart3, label: 'Reports', sub: 'Rent and portfolio reports', to: '/reports' },
            ]} />
          </>
        )}
      >
        <SectionCard>
          <div className="flex items-end justify-between gap-3 flex-wrap border-b border-card-border">
            <ListTabs tabs={tabs} value={tab} onChange={setTab} />
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search rent reviews…" className="w-full md:w-96" />
          {loading ? (
            <Skeleton radius="card" className="h-48 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-10 text-center">
              No rent reviews scheduled yet — use the &quot;Rent Review&quot; action on an active tenancy to schedule one.
            </p>
          ) : (
            <DataTable columns={columns} data={visible} onRowClick={(r) => r.tenantId && navigate(`/tenants/${r.tenantId}`)} />
          )}
        </SectionCard>
      </WithRail>

      <InfoFooter text="Rent reviews are scheduled and completed from Tenancies (the Rent Review action)." onRefresh={() => setReloadKey((k) => k + 1)} />
    </div>
  );
};
