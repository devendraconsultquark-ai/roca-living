import { Link } from 'react-router-dom';
import { Users, CheckCircle2, Clock, AlertTriangle, CalendarCheck, FileText, ShieldCheck, Wallet, ClipboardList, UserCheck, Home, PlusCircle, Upload, FileBarChart, CalendarDays, Settings, ArrowRight } from 'lucide-react';
import { MockActions, MockKpi, MockCard, MockFilters, MockTable, MockPagination, MockDonut, MockQuickActions, Pill, Two } from './MockKit';
import { C } from './mockUtils';

// Design p28 — Compliance › Tenant Compliance (sample data from the design)
const TYPE_TONE = { Legal: 'indigo', Document: 'blue', Financial: 'green', Safety: 'orange' };
const STATUS_TONE = { 'Due Soon': 'orange', Overdue: 'red', Compliant: 'green' };

const ITEMS = [
  ['Right to Rent Check', 'RR-2024-0156', 'Sophie Lee', 'AST: 01/05/2024 – Periodic', 'Derwent House', 'Apt 7', 'Legal', 'As Required', '15 Jun 2025', '21 days', 'Due Soon', '15 Jun 2024'],
  ['Tenancy Agreement', 'TA-2024-0156', 'Sophie Lee', 'AST: 01/05/2024 – Periodic', 'Derwent House', 'Apt 7', 'Document', 'At Start + Renewal', '01 May 2025', '-15 days', 'Overdue', '01 May 2024'],
  ['Deposit Protection', 'DP-2024-0156', 'Sophie Lee', 'AST: 01/05/2024 – Periodic', 'Derwent House', 'Apt 7', 'Financial', 'At Start', '01 May 2025', '-15 days', 'Overdue', '01 May 2024'],
  ['Inventory Check-in', 'IC-2024-0156', 'Sophie Lee', 'AST: 01/05/2024 – Periodic', 'Derwent House', 'Apt 7', 'Document', 'At Start', '01 May 2024', '', 'Compliant', '01 May 2024'],
  ['Inventory Check-out', 'CO-2024-0156', 'James Anderson', 'AST: 10/07/2023 – Periodic', 'Parsons House', 'Apt 12', 'Document', 'At End of Tenancy', '10 Jul 2025', '46 days', 'Due Soon', '—'],
  ['Gas Safety Awareness', 'GSA-2024-0156', 'Michael Roberts', 'AST: 15/08/2024 – Periodic', 'Riverside Apartments', 'Apt 3', 'Safety', 'Annual', '15 Aug 2025', '82 days', 'Compliant', '15 Aug 2024'],
  ['House Rules Acknowledgement', 'HR-2024-0156', 'Olivia Cooper', 'AST: 20/04/2024 – Periodic', 'City Lofts', 'Apt 2', 'Document', 'At Start', '20 Apr 2024', '', 'Compliant', '20 Apr 2024'],
  ['Guarantor Agreement', 'GA-2024-0156', 'Daniel Carter', 'AST: 01/03/2024 – Periodic', 'Derwent House', 'Apt 5', 'Document', 'At Start', '01 Mar 2024', '', 'Compliant', '01 Mar 2024'],
];

const SUMMARY = [
  [CheckCircle2, 'green', 'Right to Rent Checks', '68', '100% Complete'],
  [FileText, 'indigo', 'Tenancy Agreements', '65', '95.6% Complete'],
  [Wallet, 'indigo', 'Deposit Protections', '68', '100% Complete'],
  [ClipboardList, 'orange', 'Inventories', '52', '76.5% Complete'],
  [UserCheck, 'green', 'Guarantor Agreements', '18', '26.5% Complete'],
  [Home, 'indigo', 'House Rules Acknowledged', '68', '100% Complete'],
];

const EXPIRIES = [
  ['Right to Rent Check', 'Sophie Lee – Derwent House Apt 7', '15 Jun 2025', '21 days'],
  ['Gas Safety Awareness', 'Michael Roberts – Riverside Apt 3', '15 Aug 2025', '82 days'],
  ['Deposit Protection', 'James Anderson – Parsons House Apt 12', '10 Jul 2025', '46 days'],
  ['Inventory Check-out', 'Daniel Carter – Derwent House Apt 5', '01 Sep 2025', '99 days'],
  ['Right to Rent Check', 'Keira Patel – City Lofts Apt 6', '05 Sep 2025', '103 days'],
];

export const TenantComplianceMock = () => (
  <>
    <MockActions primary="Add Compliance Item" />

    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      <MockKpi icon={Users} tone="indigo" label="Total Tenants" value="68" sub="Across all properties" link="View tenants" />
      <MockKpi icon={CheckCircle2} tone="green" label="Compliant" value="49" sub="72.1% of total" link="View compliant" />
      <MockKpi icon={Clock} tone="orange" label="Due Soon (30 Days)" value="11" sub="16.2% of total" link="View due soon" />
      <MockKpi icon={AlertTriangle} tone="red" label="Overdue" value="8" sub="11.8% of total" link="View overdue" />
      <MockKpi icon={CalendarCheck} tone="indigo" label="Completed This Month" value="15" link="View history" />
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 flex flex-col gap-6 min-w-0">
        <MockCard title="Tenant Compliance Items" action={null}>
          <MockFilters search="Search items…" filters={['All Properties', 'All Tenants', 'All Compliance Types', 'All Statuses']} />
          <MockTable
            minWidth={900}
            columns={['Compliance Item', 'Tenant / Tenancy', 'Property / Unit', 'Compliance Type', 'Frequency', 'Due Date', 'Status', 'Last Completed']}
            rows={ITEMS.map((r) => [
              <Two key="i" top={r[0]} bottom={`Ref: ${r[1]}`} link />,
              <Two key="t" top={r[2]} bottom={r[3]} />,
              <Two key="p" top={r[4]} bottom={r[5]} />,
              <Pill key="ty" tone={TYPE_TONE[r[6]]}>{r[6]}</Pill>,
              r[7],
              <span key="d" className="block">
                <span className="block text-xs font-semibold text-brand-primary">{r[8]}</span>
                {r[9] && <span className={`block text-[11px] font-bold ${r[9].startsWith('-') ? 'text-status-danger' : 'text-status-warning'}`}>{r[9]}</span>}
              </span>,
              <Pill key="s" tone={STATUS_TONE[r[10]]}>{r[10]}</Pill>,
              r[11],
            ])}
          />
          <MockPagination text="Showing 1 to 8 of 68 items" pages={5} />
        </MockCard>

        <MockCard title="Tenant Compliance Summary" action={null}>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {SUMMARY.map(([Icon, tone, label, value, sub]) => (
              <div key={label} className="border border-card-border rounded-lg p-3 flex flex-col gap-1">
                <Icon size={16} className={tone === 'green' ? 'text-status-success' : tone === 'orange' ? 'text-status-warning' : 'text-brand-accent'} />
                <span className="text-[11px] text-gray-400 font-semibold leading-snug">{label}</span>
                <span className="text-base font-bold text-brand-primary">{value}</span>
                <span className="text-[11px] text-gray-400 font-semibold">{sub}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] text-gray-500 font-semibold">
              <span className="font-bold text-brand-primary">Note:</span> Tenant compliance items are tenancy specific and relate to legal, financial and safety obligations.
            </p>
            <Link to="/tenants" className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-card-border text-xs font-bold text-brand-primary">
              Go to Tenants <ArrowRight size={13} />
            </Link>
          </div>
        </MockCard>
      </div>

      <div className="flex flex-col gap-6 min-w-0">
        <MockCard title="Compliance Overview" action="View full report">
          <MockDonut
            centre="68"
            sub="Total Tenants"
            data={[
              { label: 'Compliant', value: 49, color: C.green, display: '49 (72.1%)' },
              { label: 'Due Soon', value: 11, color: C.orange, display: '11 (16.2%)' },
              { label: 'Overdue', value: 8, color: C.red, display: '8 (11.8%)' },
            ]}
          />
        </MockCard>

        <MockCard title="Upcoming Expiries" action="View calendar">
          <div className="flex flex-col">
            {EXPIRIES.map(([t, who, date, days]) => (
              <div key={t + who} className="flex items-start gap-3 py-2 border-b border-card-border/60 last:border-0">
                <ShieldCheck size={16} className="text-status-success shrink-0 mt-0.5" />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-bold text-brand-accent">{t}</span>
                  <span className="block text-[11px] text-gray-400 font-semibold">{who}</span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-xs font-semibold text-brand-primary">{date}</span>
                  <span className="block text-[11px] font-bold text-status-warning">{days}</span>
                </span>
              </div>
            ))}
          </div>
        </MockCard>

        <MockQuickActions items={[
          { icon: PlusCircle, label: 'Add Compliance Item', sub: 'Create a new compliance record' },
          { icon: Upload, label: 'Upload Compliance Document', sub: 'Attach certificates or documentation' },
          { icon: FileBarChart, label: 'Generate Compliance Report', sub: 'Download tenant compliance summary' },
          { icon: CalendarDays, label: 'Compliance Calendar', sub: 'View upcoming and due items' },
          { icon: Settings, label: 'Compliance Settings', sub: 'Manage compliance types and rules' },
        ]} />
      </div>
    </div>
  </>
);
