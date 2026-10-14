import { useState } from 'react';
import { Landmark, Lock, Scale, ClipboardList, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Building2, Upload, Link2, FileBarChart, Settings, Check } from 'lucide-react';
import { MockActions, MockKpi, MockCard, MockTabs, MockFilters, MockTable, MockPagination, MockActivity, MockQuickActions, MockRows, Pill, Amount, DummyTag } from './MockKit';

// Design p25 — Accounting › Bank Reconciliation (sample data from the design)
const ACCOUNTS = [
  { name: 'Parsons House – Client Rent Account', sort: '20-45-88 | 50981234', balance: '£168,430.75' },
  { name: 'Derwent House – Client Rent Account', sort: '20-45-89 | 50981235', balance: '£214,325.40' },
  { name: 'Riverside Apartments – Client Rent Account', sort: '20-45-90 | 50981236', balance: '£130,084.10' },
];

const BANK_LINES = [
  ['15', 'May', 'Rent – Apt 7 – James Anderson', 'INV-2457', '£1,950.00', 'Rent – Apt 7 – James Anderson'],
  ['15', 'May', 'Rent – Apt 3 – Sophie Lee', 'INV-2456', '£1,250.00', 'Rent – Apt 3 – Sophie Lee'],
  ['14', 'May', 'Rent – Apt 12 – Michael Roberts', 'INV-2455', '£1,650.00', 'Rent – Apt 12 – Michael Roberts'],
  ['14', 'May', 'Bank Charges', 'CHG-150524', '-£12.50', 'Bank Charges'],
  ['13', 'May', 'Standing Order – Insurance', 'INS-130524', '-£320.00', 'Insurance Payment'],
];

const Lines = ({ title, system }) => (
  <div className="flex flex-col gap-2 min-w-0">
    <p className="text-xs font-bold text-brand-primary">{title}</p>
    <MockFilters search={system ? 'Search system transactions…' : 'Search bank transactions…'} />
    <div className="flex flex-col">
      {BANK_LINES.map(([d, m, desc, ref, amt, sysDesc]) => (
        <div key={ref} className="flex items-center gap-3 py-2 border-b border-card-border/60 last:border-0">
          <span className="w-8 text-center leading-tight shrink-0">
            <span className="block text-xs font-bold text-brand-primary">{d}</span>
            <span className="block text-[10px] text-gray-400 font-semibold">{m}</span>
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-xs font-bold text-brand-accent truncate">{system ? sysDesc : desc}</span>
            <span className="block text-[11px] text-gray-400 font-semibold">{system ? ref : `Reference: ${ref}`}</span>
          </span>
          <Amount value={amt} tone={amt.startsWith('-') ? 'red' : 'green'} />
          {!system && <Check size={14} className="text-status-success shrink-0" />}
        </div>
      ))}
    </div>
    <MockPagination text="Showing 1 to 5 of 15 items" />
  </div>
);

const AccountRow = ({ acc, open, onToggle, children, highlight }) => (
  <div className={`border border-card-border rounded-lg ${highlight ? 'bg-brand-accent/5' : ''}`}>
    <button type="button" onClick={onToggle} className="w-full flex items-center gap-4 p-3 text-left cursor-pointer flex-wrap">
      <span className="w-9 h-9 rounded-lg bg-brand-accent/10 text-brand-accent flex items-center justify-center shrink-0"><Landmark size={16} /></span>
      <span className="flex-1 min-w-[200px]">
        <span className="block text-xs font-bold text-brand-primary">{acc.name}</span>
        <span className="block text-[11px] text-gray-400 font-semibold">{acc.sort}</span>
      </span>
      {[['Statement Balance', acc.balance], ['System Balance', acc.balance], ['Difference', '£0.00']].map(([l, v]) => (
        <span key={l} className="w-28">
          <span className="block text-[11px] text-gray-400 font-semibold">{l}</span>
          <span className={`block text-xs font-bold ${l === 'Difference' ? 'text-status-success' : 'text-brand-primary'}`}>{v}</span>
        </span>
      ))}
      <Pill tone="green"><span className="inline-flex items-center gap-1"><CheckCircle2 size={11} /> In Balance</span></Pill>
      {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
    </button>
    {open && <div className="border-t border-card-border p-3">{children}</div>}
  </div>
);

const TABS = ['Client Account Reconciliation', 'Management Fee Reconciliation', { id: 'Unreconciled Items', label: 'Unreconciled Items', count: 3 }, 'Reconciliation History'];

export const BankReconciliationMock = () => {
  const [tab, setTab] = useState('Client Account Reconciliation');
  const [open, setOpen] = useState({ 0: true, mgmt: true });
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <>
      <MockActions primary="Complete All Reconciliations" primaryIcon={Check} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <MockKpi icon={Landmark} tone="indigo" label="Total Client Account Balance" value="£512,840.25" sub="Across 3 client accounts" link="View accounts" />
        <MockKpi icon={Lock} tone="indigo" label="Management Account Balance" value="£284,562.17" sub="As at 15 May 2024" link="View management account" />
        <MockKpi icon={Scale} tone="green" label="Total Management Fees Due" value="£18,975.00" sub="This month" link="View fee schedule" />
        <MockKpi icon={ClipboardList} tone="orange" label="Unreconciled Items" value="3" sub="2 client accounts" link="View items" />
        <MockKpi icon={CalendarDays} tone="indigo" label="Last Reconciled" value="14 May 2024" sub="by Admin User" link="View history" />
        <MockKpi icon={CheckCircle2} tone="green" label="Overall Status" value="In Balance" sub="Ready to complete" link="View summary" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 flex flex-col gap-6 min-w-0">
          <MockCard title="Reconciliation" action={null}>
            <MockFilters search="Search…" filters={['All Client Accounts', 'All Properties', 'All Accounts', 'Statement Date: 15/05/2024', 'Compare With: ROCAlytics Transactions']} />
            <MockTabs tabs={TABS} value={tab} onChange={setTab} />
            <div className="flex flex-col gap-3">
              {ACCOUNTS.map((acc, i) => (
                <AccountRow key={acc.name} acc={acc} open={!!open[i]} onToggle={() => toggle(i)}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Lines title="Bank Statement Transactions" />
                    <Lines title="ROCAlytics Transactions" system />
                  </div>
                </AccountRow>
              ))}
              <AccountRow
                acc={{ name: 'Management Account – Management Fees Account', sort: '20-45-01 | 50980001', balance: '£284,562.17' }}
                open={!!open.mgmt}
                onToggle={() => toggle('mgmt')}
                highlight
              >
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-brand-primary mb-2">Management Fees Received (from Client Accounts)</p>
                    <MockTable
                      minWidth={640}
                      columns={['Property', 'Client Account', 'Reference', 'Due Date', { label: 'Amount Due', right: true }, { label: 'Amount Received', right: true }, 'Date Received', 'Status']}
                      rows={[
                        ['Parsons House', '20-45-88', 'MF-PAR-0524', '07 May 2024', '£8,345.00', '£8,345.00', '07 May 2024'],
                        ['Derwent House', '20-45-89', 'MF-DER-0524', '07 May 2024', '£6,125.00', '£6,125.00', '07 May 2024'],
                        ['Riverside Apartments', '20-45-90', 'MF-RIV-0524', '07 May 2024', '£4,505.00', '£4,505.00', '07 May 2024'],
                      ].map((r) => [
                        <span key="p" className="flex items-center gap-1.5 font-bold text-brand-primary"><CheckCircle2 size={13} className="text-status-success" />{r[0]}</span>,
                        r[1], r[2], r[3], r[4], <Amount key="a" value={r[5]} tone="green" />, r[6], <Pill key="s" tone="green">Reconciled</Pill>,
                      ]).concat([[<span key="t" className="font-bold text-brand-primary">Total</span>, '', '', '', <span key="d" className="font-bold text-brand-primary">£18,975.00</span>, <Amount key="r" value="£18,975.00" tone="green" />, '', '']])}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="flex items-center gap-2 text-xs font-bold text-brand-primary">Fee Schedule <DummyTag /></p>
                    <p className="text-xs font-bold text-brand-primary mt-1">May 2024</p>
                    <p className="text-[11px] text-gray-400 font-semibold">Next fee due: 07 Jun 2024</p>
                    <MockRows rows={[['Total Fees Due', '£18,975.00'], ['Total Fees Paid', '£18,975.00'], ['Paid', '100%', 'green']]} />
                  </div>
                </div>
              </AccountRow>
            </div>
          </MockCard>
        </div>

        <div className="flex flex-col gap-6 min-w-0">
          <MockCard title="Reconciliation Summary" action="View full report">
            <MockRows rows={[
              ['Total Client Account Balance', '£512,840.25', null, true],
              ['Management Account Balance', '£284,562.17', null, true],
              ['Total Management Fees Due', '£18,975.00', null, true],
              ['Total Difference', '£0.00', 'green', true],
              ['Client Accounts in Balance', '3', 'green'],
              ['Client Accounts with Issues', '0', 'orange'],
              ['Unreconciled Items', '3'],
              ['Total Items', '245'],
            ]} />
          </MockCard>

          <MockCard title="Management Fee Reconciliation Summary" action="View details">
            <MockRows rows={[
              ['Fees Due This Month', '£18,975.00'],
              ['Fees Paid to Date', '£18,975.00'],
              ['Unreconciled Fees', '0'],
              ['All Management Fees Reconciled', 'Yes', 'green'],
            ]} />
          </MockCard>

          <MockQuickActions items={[
            { icon: Building2, label: 'Manage Client Bank Accounts', sub: 'View and manage client bank accounts' },
            { icon: Upload, label: 'Upload Bank Statement', sub: 'Import bank statement files' },
            { icon: Link2, label: 'Match Unmatched Items', sub: 'Manually match transactions' },
            { icon: FileBarChart, label: 'View Reconciliation Report', sub: 'Download detailed reconciliation report' },
            { icon: Settings, label: 'Reconciliation Settings', sub: 'Manage rules and preferences' },
          ]} />

          <MockActivity items={[
            { icon: CheckCircle2, tone: 'green', title: 'Parsons House account reconciled', sub: 'by Admin User', date: '14 May 2024 16:20' },
            { icon: CheckCircle2, tone: 'green', title: 'Derwent House account reconciled', sub: 'by Admin User', date: '14 May 2024 15:05' },
            { icon: Upload, tone: 'indigo', title: 'Bank statement uploaded', sub: 'Parsons House – May 2024', date: '14 May 2024 09:30' },
          ]} />
        </div>
      </div>
    </>
  );
};
