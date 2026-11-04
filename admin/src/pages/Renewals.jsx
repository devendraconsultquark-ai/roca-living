import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, AlertTriangle, Repeat, TrendingUp, FileText, RefreshCw } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
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

// Design (Renewals), real data only, from the current tenancies. Periodic
// tenancies (no end date) roll on and need no renewal; fixed-term ones show
// when they end. Rent review dates come from the Rent Review action.
const flatOf = (t) => (t.block_name && t.apartment_number ? `${String(t.block_name).toUpperCase()}-${t.apartment_number}` : t.property_name || '—');
const kindOf = (r) => {
  if (!r.endDate) return 'periodic';
  if (r.daysLeft < 0) return 'ended';
  if (r.daysLeft <= 90) return 'ending_soon';
  return 'fixed';
};
const KIND = {
  periodic: { label: 'Periodic (Rolls On)', tone: 'green' },
  ending_soon: { label: 'Ending ≤ 90 Days', tone: 'orange' },
  ended: { label: 'End Date Passed', tone: 'red' },
  fixed: { label: 'Fixed Term', tone: 'indigo' },
};

export const Renewals = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    api.get('/tenancies', { skipInterceptorError: true })
      .then((res) => {
        if (!alive) return;
        setRows((res.data.data || [])
          .filter((t) => ['active', 'notice', 'pending'].includes(t.status))
          .map((t) => ({
            id: t.id,
            tenant: t.lead_tenant_name || '—',
            tenantEmail: t.lead_tenant_email || null,
            tenantId: t.lead_tenant_id || null,
            flat: flatOf(t),
            landlord: t.landlord_name || '—',
            start: t.start_date,
            endDate: t.end_date,
            daysLeft: t.end_date ? daysUntil(t.end_date) : null,
            rent: parseFloat(t.rent_pcm || 0),
            reviewDate: t.rent_review_date,
            reviewDays: t.rent_review_date ? daysUntil(t.rent_review_date) : null,
            status: t.status,
          }))
          .sort((a, b) => String(a.flat).localeCompare(String(b.flat), 'en', { numeric: true })));
      })
      .catch((err) => { if (alive) addToast(err.response?.data?.message || 'Failed to load tenancies', 'error'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [addToast, reloadKey]);

  const counts = { periodic: 0, ending_soon: 0, ended: 0, fixed: 0 };
  rows.forEach((r) => { counts[kindOf(r)] += 1; });
  const reviewsSoon = rows.filter((r) => r.reviewDays !== null && r.reviewDays <= 90);

  const tabs = [
    { id: 'all', label: 'All Current Tenancies' },
    { id: 'ending_soon', label: 'Ending Soon' },
    { id: 'ended', label: 'End Date Passed' },
    { id: 'periodic', label: 'Periodic' },
  ].map((t) => ({ ...t, count: t.id === 'all' ? rows.length : counts[t.id] }));
  const q = search.trim().toLowerCase();
  const visible = rows.filter((r) => tab === 'all' || kindOf(r) === tab)
    .filter((r) => !q || [r.tenant, r.flat, r.landlord].some((v) => String(v || '').toLowerCase().includes(q)));

  const donut = Object.entries(KIND).map(([k, v], i) => ({
    label: v.label, value: counts[k], color: [C.green, C.amber, C.red, C.indigo][i], display: `${counts[k]} (${pct(counts[k], rows.length)})`,
  }));

  const exportCsv = () => downloadCsv('renewals.csv', visible, [
    { key: 'tenant', label: 'Tenant' },
    { key: 'flat', label: 'Flat' },
    { key: 'landlord', label: 'Landlord' },
    { key: (r) => shortDate(r.start), label: 'Start' },
    { key: (r) => (r.endDate ? shortDate(r.endDate) : 'Periodic'), label: 'End' },
    { key: (r) => (r.reviewDate ? shortDate(r.reviewDate) : ''), label: 'Rent Review' },
    { key: (r) => r.rent.toFixed(2), label: 'Rent (£ pcm)' },
  ]);

  const columns = [
    { header: 'Tenant', accessor: 'tenant', sortable: true, renderCell: (r) => <PersonCell name={r.tenant} sub={r.tenantEmail} /> },
    { header: 'Flat', accessor: 'flat', sortable: true, renderCell: (r) => <Two top={r.flat} bottom={r.landlord} /> },
    { header: 'Start', accessor: 'start', sortable: true, renderCell: (r) => shortDate(r.start) },
    {
      header: 'End',
      accessor: 'endDate',
      sortable: true,
      renderCell: (r) => (r.endDate
        ? <Two top={shortDate(r.endDate)} bottom={r.daysLeft < 0 ? <span className="text-status-danger">{Math.abs(r.daysLeft)} days ago</span> : `in ${r.daysLeft} days`} />
        : <span className="text-gray-400">No end date</span>),
    },
    { header: 'Rent (PCM)', accessor: 'rent', align: 'right', sortable: true, renderCell: (r) => gbp(r.rent) },
    { header: 'Rent Review', accessor: 'reviewDate', sortable: true, renderCell: (r) => (r.reviewDate ? shortDate(r.reviewDate) : <span className="text-gray-400">Not set</span>) },
    { header: 'Renewal', accessor: 'endDate', sortValue: (r) => kindOf(r), sortable: true, renderCell: (r) => { const k = KIND[kindOf(r)]; return <Pill tone={k.tone}>{k.label}</Pill>; } },
  ];

  const upcoming = rows.filter((r) => r.endDate && r.daysLeft !== null).sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 4);

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      <PageActions>
        <ExportButton onClick={exportCsv} disabled={loading || !visible.length} />
      </PageActions>

      <KpiRow cols={4}>
        <KpiCard icon={CalendarClock} tone="orange" label="Ending In 90 Days" value={counts.ending_soon} sub="Fixed-term tenancies" link="View" onClick={() => setTab('ending_soon')} loading={loading} />
        <KpiCard icon={AlertTriangle} tone="red" label="End Date Passed" value={counts.ended} sub="Still marked current" subTone={counts.ended ? 'red' : undefined} link="View" onClick={() => setTab('ended')} loading={loading} />
        <KpiCard icon={Repeat} tone="green" label="Periodic (Rolls On)" value={counts.periodic} sub="No renewal needed" link="View" onClick={() => setTab('periodic')} loading={loading} />
        <KpiCard icon={TrendingUp} tone="indigo" label="Rent Reviews In 90 Days" value={reviewsSoon.length} sub="From the Rent Review action" link="Rent Reviews" to="/rent-reviews" loading={loading} />
      </KpiRow>

      <WithRail
        rail={(
          <>
            <SectionCard title="Current Tenancies">
              <Donut data={donut} centre={rows.length} sub="Total" />
            </SectionCard>
            <SectionCard title="Next End Dates">
              <UpcomingList
                empty="No fixed-term tenancies: every current tenancy is periodic."
                items={upcoming.map((r) => ({
                  key: r.id, title: r.tenant, sub: r.flat, date: shortDate(r.endDate),
                  badge: r.daysLeft < 0 ? `${Math.abs(r.daysLeft)} days ago` : `${r.daysLeft} days`,
                  badgeTone: r.daysLeft < 0 ? 'red' : r.daysLeft <= 30 ? 'orange' : 'grey',
                }))}
              />
            </SectionCard>
            <QuickActions items={[
              { icon: FileText, label: 'Tenancies', sub: 'Edit end dates, end a tenancy', to: '/tenancies' },
              { icon: RefreshCw, label: 'Rent Reviews', sub: 'Schedule and complete reviews', to: '/rent-reviews' },
            ]} />
          </>
        )}
      >
        <SectionCard>
          <div className="flex items-end justify-between gap-3 flex-wrap border-b border-card-border">
            <ListTabs tabs={tabs} value={tab} onChange={setTab} />
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search tenant, flat, landlord…" className="w-full md:w-96" />
          {loading ? (
            <Skeleton radius="card" className="h-48 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-10 text-center">No current tenancies.</p>
          ) : (
            <DataTable columns={columns} data={visible} onRowClick={(r) => r.tenantId && navigate(`/tenants/${r.tenantId}`)} />
          )}
        </SectionCard>
      </WithRail>

      <InfoFooter text="Periodic tenancies (Assured Periodic) have no end date and roll on monthly; fixed-term end dates are set on Tenancies." onRefresh={() => setReloadKey((k) => k + 1)} />
    </div>
  );
};
