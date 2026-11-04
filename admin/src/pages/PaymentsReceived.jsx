import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PoundSterling, CalendarDays, CalendarClock, Link2, ListChecks, ArrowDownLeft, RefreshCw, Landmark } from 'lucide-react';
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

// Design p22 (Payments Received), real data only: the rent Roca Living has
// recorded, and the rent from before Roca Living (history import). Roca Living
// records no service charge, fee or other income, so those parts of the design
// are left out rather than shown with sample numbers.
const STAGE_TONE = {
  'Landlord Paid': 'green', Approved: 'blue', 'To Approve': 'orange', 'Before Roca Living': 'grey',
};
const ymNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const ymPrev = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const PALETTE = [C.green, C.indigo, C.blue, C.amber, C.teal, C.red, C.purple, C.pink];
const sum = (list) => list.reduce((s, r) => s + r.amount, 0);

export const PaymentsReceived = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    api.get('/accounting/payments-received', { skipInterceptorError: true })
      .then((res) => { if (alive) setRows(res.data.data || []); })
      .catch((err) => { if (alive) addToast(err.response?.data?.message || 'Failed to load payments', 'error'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [addToast, reloadKey]);

  const year = String(new Date().getFullYear());
  const ytd = useMemo(() => rows.filter((r) => String(r.date).startsWith(year)), [rows, year]);
  const thisMonth = rows.filter((r) => String(r.date).startsWith(ymNow()));
  const lastMonth = rows.filter((r) => String(r.date).startsWith(ymPrev()));
  const rl = rows.filter((r) => r.source === 'roca_living');
  const matched = rl.filter((r) => r.matched);

  const TAB_FILTERS = {
    all: () => true,
    roca_living: (r) => r.source === 'roca_living',
    before_roca_living: (r) => r.source === 'before_roca_living',
  };
  const tabs = [
    { id: 'all', label: 'All Payments' },
    { id: 'roca_living', label: 'In Roca Living' },
    { id: 'before_roca_living', label: 'Before Roca Living' },
  ].map((t) => ({ ...t, count: rows.filter(TAB_FILTERS[t.id]).length }));
  const q = search.trim().toLowerCase();
  const visible = rows.filter(TAB_FILTERS[tab])
    .filter((r) => !q || [r.tenant, r.flat, r.landlord, r.reference].some((v) => String(v || '').toLowerCase().includes(q)));

  // Received this year, by flat.
  const byFlat = useMemo(() => {
    const m = new Map();
    ytd.forEach((r) => m.set(r.flat, (m.get(r.flat) || 0) + r.amount));
    const total = sum(ytd);
    return [...m.entries()].sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length], display: `${gbp(value)} (${pct(value, total)})` }));
  }, [ytd]);

  const byMethod = useMemo(() => {
    const m = new Map();
    ytd.forEach((r) => m.set(r.method, (m.get(r.method) || 0) + r.amount));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [ytd]);

  const exportCsv = () => downloadCsv('payments-received.csv', visible, [
    { key: (r) => shortDate(r.date), label: 'Date' },
    { key: 'tenant', label: 'Tenant' },
    { key: 'flat', label: 'Flat' },
    { key: 'landlord', label: 'Landlord' },
    { key: 'method', label: 'Received By' },
    { key: 'reference', label: 'Reference' },
    { key: (r) => r.amount.toFixed(2), label: 'Amount (£)' },
    { key: 'stage', label: 'Stage' },
  ]);

  const columns = [
    { header: 'Date', accessor: 'date', sortable: true, renderCell: (r) => shortDate(r.date) },
    { header: 'Tenant', accessor: 'tenant', sortable: true, renderCell: (r) => <PersonCell name={r.tenant} /> },
    { header: 'Flat', accessor: 'flat', sortable: true, sortValue: (r) => String(r.flat).padStart(8, '0'), renderCell: (r) => <Two top={r.flat} bottom={r.landlord} /> },
    { header: 'Received By', accessor: 'method', sortable: true, renderCell: (r) => <span className="flex items-center gap-1.5"><Landmark size={13} className="text-gray-400" />{r.method}</span> },
    { header: 'Reference', accessor: 'reference', sortable: true },
    { header: 'Amount', accessor: 'amount', align: 'right', sortable: true, renderCell: (r) => <span className="text-status-success font-bold">{gbp(r.amount)}</span> },
    { header: 'Stage', accessor: 'stage', sortable: true, renderCell: (r) => <Pill tone={STAGE_TONE[r.stage] || 'grey'}>{r.stage}</Pill> },
  ];

  const recent = rows.slice(0, 5);

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      <PageActions>
        <ExportButton onClick={exportCsv} disabled={loading || !visible.length} />
      </PageActions>

      <KpiRow>
        <KpiCard icon={PoundSterling} tone="green" label={`Rent Received (${year})`} value={gbp(sum(ytd))} sub={`${ytd.length} payment${ytd.length === 1 ? '' : 's'}`} loading={loading} />
        <KpiCard icon={CalendarDays} tone="indigo" label="This Month" value={gbp(sum(thisMonth))} sub={`${thisMonth.length} payment${thisMonth.length === 1 ? '' : 's'}`} loading={loading} />
        <KpiCard icon={CalendarClock} tone="blue" label="Last Month" value={gbp(sum(lastMonth))} sub={`${lastMonth.length} payment${lastMonth.length === 1 ? '' : 's'}`} loading={loading} />
        <KpiCard icon={Link2} tone="green" label="Matched In Xero" value={rl.length ? pct(matched.length, rl.length) : '—'} sub={`${matched.length} of ${rl.length} in Roca Living`} loading={loading} />
        <KpiCard icon={ListChecks} tone="orange" label="To Approve" value={rl.filter((r) => r.stage === 'To Approve').length} sub="In the Rent Cycle" link="Open Rent Cycle" to="/rent-cycle" loading={loading} />
      </KpiRow>

      <WithRail
        rail={(
          <>
            <SectionCard title={`Received By Flat (${year})`}>
              {byFlat.length ? <Donut data={byFlat} centre={gbp(sum(ytd)).replace('.00', '')} sub="Total" /> : <p className="text-xs text-gray-400 font-semibold py-6 text-center">No rent received this year.</p>}
            </SectionCard>
            <SectionCard title={`How It Was Received (${year})`}>
              <div className="flex flex-col">
                {byMethod.length ? byMethod.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 py-2 border-b border-card-border/60 last:border-0">
                    <span className="flex items-center gap-2.5 text-xs font-semibold text-brand-primary"><Landmark size={14} className="text-gray-400" />{label}</span>
                    <span className="text-xs font-bold text-brand-primary tabular-nums">{gbp(value)} ({pct(value, sum(ytd))})</span>
                  </div>
                )) : <p className="text-xs text-gray-400 font-semibold py-4 text-center">Nothing yet.</p>}
              </div>
            </SectionCard>
            <SectionCard title="Latest Payments">
              <UpcomingList
                empty="No payments yet."
                items={recent.map((r) => ({ key: r.key, title: `${r.tenant} · ${r.flat}`, sub: r.stage, date: shortDate(r.date), badge: gbp(r.amount), badgeTone: 'green' }))}
              />
            </SectionCard>
            <QuickActions items={[
              { icon: RefreshCw, label: 'Rent Cycle', sub: 'Approve rent, pay landlords', to: '/rent-cycle' },
              { icon: ArrowDownLeft, label: 'Arrears', sub: 'Rent not received yet', to: '/arrears' },
            ]} />
          </>
        )}
      >
        <SectionCard>
          <div className="flex items-end justify-between gap-3 flex-wrap border-b border-card-border">
            <ListTabs tabs={tabs} value={tab} onChange={setTab} />
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search tenant, flat, landlord, reference…" className="w-full md:w-96" />
          {loading ? (
            <Skeleton radius="card" className="h-48 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-10 text-center">No rent received yet.</p>
          ) : (
            <DataTable columns={columns} data={visible} onRowClick={(r) => r.tenant_id && navigate(`/tenants/${r.tenant_id}`)} />
          )}
        </SectionCard>
      </WithRail>

      <InfoFooter text="Rent received in Roca Living comes from Xero (matched bank lines) or is typed in on the tenant page; 'Before Roca Living' is the old bank history." onRefresh={() => setReloadKey((k) => k + 1)} />
    </div>
  );
};
