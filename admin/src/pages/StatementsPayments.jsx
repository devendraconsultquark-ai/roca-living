import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Banknote, Hourglass, CalendarDays, Percent, RefreshCw, FileSpreadsheet, Wallet } from 'lucide-react';
import { Skeleton } from '../components/UI/Skeleton';
import { Button } from '../components/UI/Button';
import { Dropdown } from '../components/UI/Dropdown';
import { ExportButton } from '../components/UI/ListToolbar';
import { AllStatementsTable } from '../components/UI/AllStatementsTable';
import {
  PageActions, KpiRow, KpiCard, WithRail, SectionCard, Donut, QuickActions, UpcomingList, InfoFooter, SearchInput,
} from '../components/UI/DesignKit';
import { C, gbp, shortDate } from '../utilities/designTokens';
import { downloadCsv } from '../utilities/csv';
import { useAllStatements } from '../hooks/useAllStatements';
import { TYPE_LABEL } from '../utilities/statementTypes';

// Statements & Payments (design p21), real data only: every landlord statement
// (Roca Living, Rent Cycle, Historic) from the single statements list, seen
// from the payout side — what was paid to landlords and what is still waiting.
// Payouts themselves are made in the Rent Cycle.
const STATUS = { paid: { label: 'Paid', color: C.green }, sent: { label: 'Waiting For Payout', color: C.blue }, draft: { label: 'Draft', color: C.grey || '#9AA7B3' } };
const ym = (d) => String(d || '').slice(0, 7);
const ymNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const monthLabel = (m) => new Date(`${m}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const sumNet = (list) => list.reduce((s, r) => s + Number(r.net || 0), 0);

export const StatementsPayments = () => {
  const navigate = useNavigate();
  const { rows, totalsYear, reload } = useAllStatements();
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('');
  const [status, setStatus] = useState('');
  const loading = rows === null;
  const list = useMemo(() => rows || [], [rows]);
  const year = new Date().getFullYear();
  const now = ymNow();

  const thisMonth = list.filter((r) => ym(r.period_start) === now && r.status !== 'draft');
  const paidThisMonth = list.filter((r) => r.status === 'paid' && ym(r.paid_on) === now);
  const waiting = list.filter((r) => r.status === 'sent');
  const months = useMemo(() => [...new Set(list.map((r) => ym(r.period_start)).filter(Boolean))].sort().reverse(), [list]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((r) => (!month || ym(r.period_start) === month)
      && (!status || r.status === status)
      && (!q || [r.statement_number, r.landlord_name, r.flat, r.tenant_name].some((v) => String(v || '').toLowerCase().includes(q))));
  }, [list, search, month, status]);

  const donut = Object.entries(STATUS)
    .map(([k, s]) => ({ label: s.label, value: list.filter((r) => r.status === k).length, color: s.color }))
    .filter((d) => d.value > 0)
    .map((d) => ({ ...d, display: `${d.value} (${list.length ? Math.round((d.value / list.length) * 100) : 0}%)` }));
  const latestPaid = list.filter((r) => r.status === 'paid' && r.paid_on).sort((a, b) => String(b.paid_on).localeCompare(String(a.paid_on))).slice(0, 6);

  const exportCsv = () => downloadCsv('statements-and-payments.csv', visible, [
    { key: 'statement_number', label: 'Statement' },
    { key: (r) => TYPE_LABEL[r.type], label: 'Made In' },
    { key: 'flat', label: 'Flat' },
    { key: 'landlord_name', label: 'Landlord' },
    { key: (r) => `${shortDate(r.period_start)} – ${shortDate(r.period_end)}`, label: 'Period' },
    { key: (r) => Number(r.rent).toFixed(2), label: 'Rent (£)' },
    { key: (r) => Number(r.fees).toFixed(2), label: 'Fees & Costs (£)' },
    { key: (r) => Number(r.net).toFixed(2), label: 'Net Paid (£)' },
    { key: (r) => STATUS[r.status]?.label || r.status, label: 'Status' },
    { key: (r) => (r.paid_on ? shortDate(r.paid_on) : ''), label: 'Paid On' },
    { key: (r) => r.xero_bill_number || '', label: 'Xero Bill' },
  ]);

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      <PageActions>
        <ExportButton onClick={exportCsv} disabled={loading || !visible.length} />
        <Button variant="primary" size="sm" icon={Wallet} onClick={() => navigate('/rent-cycle')}>Pay Landlords</Button>
      </PageActions>

      <KpiRow>
        <KpiCard icon={FileText} tone="indigo" label="Statements This Month" value={thisMonth.length} sub={monthLabel(now)} link="View statements" to="/statements" loading={loading} />
        <KpiCard icon={Banknote} tone="green" label="Paid Out This Month" value={gbp(sumNet(paidThisMonth))} sub={`${new Set(paidThisMonth.map((r) => r.landlord_name)).size} landlord${paidThisMonth.length === 1 ? '' : 's'}`} loading={loading} />
        <KpiCard icon={Hourglass} tone="orange" label="Waiting For Payout" value={gbp(sumNet(waiting))} sub={`${waiting.length} statement${waiting.length === 1 ? '' : 's'}`} link="Open Rent Cycle" to="/rent-cycle" loading={loading} />
        <KpiCard icon={CalendarDays} tone="blue" label={`Paid Out (${year})`} value={gbp(totalsYear?.paid_out || 0)} sub={`${totalsYear?.count || 0} statements this year`} loading={loading} />
        <KpiCard icon={Percent} tone="indigo" label={`Fees & Costs (${year})`} value={gbp(totalsYear?.fees || 0)} sub="Taken off the rent" loading={loading} />
      </KpiRow>

      <WithRail
        rail={(
          <>
            <SectionCard title="Statement Status">
              {donut.length ? <Donut data={donut} centre={String(list.length)} sub="Statements" /> : <p className="text-xs text-gray-400 font-semibold py-6 text-center">No statements yet.</p>}
            </SectionCard>
            <SectionCard title="Latest Payouts">
              <UpcomingList
                empty="No payouts yet."
                items={latestPaid.map((r) => ({ key: r.key, title: `${r.landlord_name} · ${r.flat || ''}`, sub: r.statement_number, date: shortDate(r.paid_on), badge: gbp(r.net), badgeTone: 'green' }))}
              />
            </SectionCard>
            <SectionCard title="Waiting For Payout">
              <UpcomingList
                empty="Nothing waiting."
                items={waiting.slice(0, 6).map((r) => ({ key: r.key, title: `${r.landlord_name} · ${r.flat || ''}`, sub: r.statement_number, date: shortDate(r.period_start), badge: gbp(r.net), badgeTone: 'orange' }))}
              />
            </SectionCard>
            <QuickActions items={[
              { icon: RefreshCw, label: 'Rent Cycle', sub: 'Approve rent, pay landlords', to: '/rent-cycle' },
              { icon: FileSpreadsheet, label: 'Statements', sub: 'Generate, email, all statements', to: '/statements' },
            ]} />
          </>
        )}
      >
        <SectionCard title="Statements & Payouts">
          <div className="flex flex-col md:flex-row md:items-end gap-3 flex-wrap">
            <SearchInput value={search} onChange={setSearch} placeholder="Search statement no., landlord, flat…" className="w-full md:w-72" />
            <div className="w-full md:w-52">
              <Dropdown id="sp-month" placeholder="All Months" clearable options={months.map((m) => ({ value: m, label: monthLabel(m) }))} value={month} onChange={(v) => setMonth(v || '')} />
            </div>
            <div className="w-full md:w-52">
              <Dropdown id="sp-status" placeholder="All Statuses" clearable options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))} value={status} onChange={(v) => setStatus(v || '')} />
            </div>
            <span className="md:ml-auto text-xs text-status-muted md:pb-2.5">{loading ? '' : `${visible.length} of ${list.length} statements`}</span>
          </div>
          {loading ? (
            <Skeleton radius="card" className="h-48 w-full" />
          ) : (
            <AllStatementsTable rows={visible} onChanged={reload} emptyText={search || month || status ? 'No statements match these filters.' : 'No statements yet.'} />
          )}
        </SectionCard>
      </WithRail>

      <InfoFooter text="Every statement (Roca Living, Rent Cycle, Historic) from one list. Paid = the landlord payout is done (Rent Cycle: its landlord bill is paid in Xero). Payouts are made in the Rent Cycle." onRefresh={reload} />
    </div>
  );
};
