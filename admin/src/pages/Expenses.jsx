import { useState, useEffect, useMemo } from 'react';
import { Receipt, CalendarDays, CalendarClock, Wrench, Building2, RefreshCw, Hammer } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Skeleton } from '../components/UI/Skeleton';
import { useToast } from '../components/UI/ToastContext';
import { ListTabs, ExportButton } from '../components/UI/ListToolbar';
import {
  PageActions, KpiRow, KpiCard, WithRail, SectionCard, Donut, QuickActions,
  InfoFooter, Pill, Two, SearchInput,
} from '../components/UI/DesignKit';
import { C, gbp, shortDate, pct } from '../utilities/designTokens';
import api from '../utilities/api';
import { downloadCsv } from '../utilities/csv';

// Design p23 (Expenses), real data only: apartment expenses, repairs taken off
// landlords' payouts in the Rent Cycle, completed repairs not taken off yet,
// and repairs from before Roca Living.
const SOURCE = {
  apartment_expense: { label: 'Apartment Expense', tone: 'indigo' },
  rent_cycle: { label: 'Repair (Rent Cycle)', tone: 'blue' },
  maintenance: { label: 'Repair (Not Taken Off)', tone: 'orange' },
  before_roca_living: { label: 'Before Roca Living', tone: 'grey' },
};
const ymNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const ymPrev = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const PALETTE = [C.indigo, C.green, C.blue, C.amber, C.teal, C.red, C.purple, C.pink];
const sum = (list) => list.reduce((s, r) => s + r.amount, 0);

export const Expenses = () => {
  const { addToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    api.get('/accounting/expenses', { skipInterceptorError: true })
      .then((res) => { if (alive) setRows(res.data.data || []); })
      .catch((err) => { if (alive) addToast(err.response?.data?.message || 'Failed to load expenses', 'error'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [addToast, reloadKey]);

  const year = String(new Date().getFullYear());
  const ytd = useMemo(() => rows.filter((r) => String(r.date).startsWith(year)), [rows, year]);
  const thisMonth = rows.filter((r) => String(r.date).startsWith(ymNow()));
  const lastMonth = rows.filter((r) => String(r.date).startsWith(ymPrev()));
  const waiting = rows.filter((r) => r.source === 'maintenance' || r.status === 'Not on a Statement Yet');

  const tabs = [
    { id: 'all', label: 'All Expenses' },
    ...Object.entries(SOURCE).map(([id, s]) => ({ id, label: s.label })),
  ].map((t) => ({ ...t, count: rows.filter((r) => t.id === 'all' || r.source === t.id).length }));
  const q = search.trim().toLowerCase();
  const visible = rows.filter((r) => tab === 'all' || r.source === tab)
    .filter((r) => !q || [r.flat, r.supplier, r.description].some((v) => String(v || '').toLowerCase().includes(q)));

  const byFlat = useMemo(() => {
    const m = new Map();
    ytd.forEach((r) => m.set(r.flat, (m.get(r.flat) || 0) + r.amount));
    const total = sum(ytd);
    return [...m.entries()].sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length], display: `${gbp(value)} (${pct(value, total)})` }));
  }, [ytd]);
  const bySupplier = useMemo(() => {
    const m = new Map();
    ytd.forEach((r) => m.set(r.supplier, (m.get(r.supplier) || 0) + r.amount));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [ytd]);

  const exportCsv = () => downloadCsv('expenses.csv', visible, [
    { key: (r) => shortDate(r.date), label: 'Date' },
    { key: 'flat', label: 'Flat' },
    { key: 'supplier', label: 'Supplier' },
    { key: 'description', label: 'Description' },
    { key: (r) => SOURCE[r.source]?.label || r.source, label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: (r) => r.amount.toFixed(2), label: 'Amount (£)' },
  ]);

  const columns = [
    { header: 'Date', accessor: 'date', sortable: true, renderCell: (r) => shortDate(r.date) },
    { header: 'Flat', accessor: 'flat', sortable: true },
    { header: 'Supplier', accessor: 'supplier', sortable: true },
    { header: 'Description', accessor: 'description', sortable: true, renderCell: (r) => <Two top={r.description} bottom={r.status} /> },
    { header: 'Type', accessor: 'source', sortable: true, renderCell: (r) => <Pill tone={SOURCE[r.source]?.tone || 'grey'}>{SOURCE[r.source]?.label || r.source}</Pill> },
    { header: 'Amount', accessor: 'amount', align: 'right', sortable: true, renderCell: (r) => <span className="text-status-danger font-bold">{gbp(r.amount)}</span> },
  ];

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      <PageActions>
        <ExportButton onClick={exportCsv} disabled={loading || !visible.length} />
      </PageActions>

      <KpiRow>
        <KpiCard icon={Receipt} tone="indigo" label={`Expenses (${year})`} value={gbp(sum(ytd))} sub={`${ytd.length} item${ytd.length === 1 ? '' : 's'}`} loading={loading} />
        <KpiCard icon={CalendarDays} tone="blue" label="This Month" value={gbp(sum(thisMonth))} sub={`${thisMonth.length} item${thisMonth.length === 1 ? '' : 's'}`} loading={loading} />
        <KpiCard icon={CalendarClock} tone="green" label="Last Month" value={gbp(sum(lastMonth))} sub={`${lastMonth.length} item${lastMonth.length === 1 ? '' : 's'}`} loading={loading} />
        <KpiCard icon={Wrench} tone="blue" label="Repairs (Rent Cycle)" value={gbp(sum(rows.filter((r) => r.source === 'rent_cycle')))} sub="Taken off landlord payouts" loading={loading} />
        <KpiCard icon={Hammer} tone="orange" label="Not Charged Yet" value={gbp(sum(waiting))} sub={`${waiting.length} item${waiting.length === 1 ? '' : 's'}`} subTone={waiting.length ? 'red' : undefined} loading={loading} />
      </KpiRow>

      <WithRail
        rail={(
          <>
            <SectionCard title={`Expenses By Flat (${year})`}>
              {byFlat.length ? <Donut data={byFlat} centre={gbp(sum(ytd)).replace('.00', '')} sub="Total" /> : <p className="text-xs text-gray-400 font-semibold py-6 text-center">No expenses this year.</p>}
            </SectionCard>
            <SectionCard title={`Top Suppliers (${year})`}>
              <div className="flex flex-col">
                {bySupplier.length ? bySupplier.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 py-2 border-b border-card-border/60 last:border-0">
                    <span className="text-xs font-semibold text-brand-primary truncate">{label}</span>
                    <span className="text-xs font-bold text-brand-primary tabular-nums">{gbp(value)}</span>
                  </div>
                )) : <p className="text-xs text-gray-400 font-semibold py-4 text-center">Nothing yet.</p>}
              </div>
            </SectionCard>
            <QuickActions items={[
              { icon: Building2, label: 'Apartment Expenses', sub: "Add on a flat's Expenses tab", to: '/properties' },
              { icon: Wrench, label: 'Maintenance', sub: 'Tickets and final costs', to: '/maintenance' },
              { icon: RefreshCw, label: 'Rent Cycle', sub: 'Repairs off landlord payouts', to: '/rent-cycle' },
            ]} />
          </>
        )}
      >
        <SectionCard>
          <div className="flex items-end justify-between gap-3 flex-wrap border-b border-card-border">
            <ListTabs tabs={tabs} value={tab} onChange={setTab} />
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search flat, supplier, description…" className="w-full md:w-96" />
          {loading ? (
            <Skeleton radius="card" className="h-48 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-10 text-center">No expenses recorded yet.</p>
          ) : (
            <DataTable columns={columns} data={visible} />
          )}
        </SectionCard>
      </WithRail>

      <InfoFooter text="Apartment expenses are added on each flat's Expenses tab; repairs come from completed maintenance tickets (Final Cost)." onRefresh={() => setReloadKey((k) => k + 1)} />
    </div>
  );
};
