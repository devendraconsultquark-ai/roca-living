import { useState } from 'react';
import { FileText, User, ClipboardList, PieChart as PieIcon, FileCheck, Landmark, CreditCard, CircleDollarSign, ArrowDownLeft, CheckCircle2, XCircle, Loader, AlertOctagon } from 'lucide-react';
import { MockActions, MockKpi, MockCard, MockTabs, MockFilters, MockStrip, MockTable, MockPagination, MockDonut, MockActivity, Pill, Two, Amount } from './MockKit';
import { C } from './mockUtils';

// Design p22 — Accounting › Payments Received (sample data from the design)
const TYPE_TONE = { Rent: 'green', 'Service Charge': 'indigo', 'Management Fee': 'orange', 'Ancillary Income': 'blue' };

const PAYMENTS = [
  ['15 May 2024', '10:32', 'James Anderson', 'Tenant', 'Parsons House', 'Apt 7', 'Rent', 'INV-2457', 'BACS', '£1,950.00', 'May 2024'],
  ['15 May 2024', '09:15', 'Sophie Lee', 'Tenant', 'Parsons House', 'Apt 3', 'Rent', 'INV-2456', 'Bank Transfer', '£1,250.00', 'May 2024'],
  ['14 May 2024', '16:40', 'Parsons House RTM Co.', 'Block / Company', 'Parsons House', 'Block', 'Service Charge', 'SC-MAY-24', 'BACS', '£3,850.00', 'May 2024'],
  ['14 May 2024', '11:05', 'Daniel White', 'Tenant', 'Parsons House', 'Apt 9', 'Rent', 'INV-2452', 'Direct Debit', '£1,500.00', 'May 2024'],
  ['13 May 2024', '15:22', 'Roca Living Ltd', 'Landlord', 'Parsons House', 'Multiple', 'Management Fee', 'MF-APR-24', 'BACS', '£1,245.00', 'Apr 2024'],
  ['13 May 2024', '09:50', 'Emily Harris', 'Tenant', 'Parsons House', 'Apt 1', 'Rent', 'INV-2453', 'Bank Transfer', '£1,200.00', 'May 2024'],
  ['12 May 2024', '14:18', 'ROCA Stays Guest', 'Guest', 'Parsons House', 'Apt 5', 'Ancillary Income', 'STAY-5123', 'Card', '£150.00', 'Short Stay'],
  ['12 May 2024', '10:11', 'Sarah Johnson', 'Tenant', 'Parsons House', 'Apt 6', 'Rent', 'INV-2454', 'Direct Debit', '£1,300.00', 'May 2024'],
  ['11 May 2024', '17:33', 'Michael Roberts', 'Tenant', 'Parsons House', 'Apt 12', 'Rent', 'INV-2451', 'BACS', '£1,650.00', 'May 2024'],
  ['10 May 2024', '12:42', 'Parsons House RTM Co.', 'Block / Company', 'Parsons House', 'Block', 'Service Charge', 'SC-APR-24', 'BACS', '£2,125.00', 'Apr 2024'],
];

const TABS = ['All Payments', 'Rent', 'Service Charge', 'Management Fees', 'Ancillary Income', 'Refunds'];
const TAB_TYPE = { Rent: 'Rent', 'Service Charge': 'Service Charge', 'Management Fees': 'Management Fee', 'Ancillary Income': 'Ancillary Income', Refunds: 'Refund' };

export const PaymentsReceivedMock = () => {
  const [tab, setTab] = useState('All Payments');
  const rows = PAYMENTS.filter((p) => tab === 'All Payments' || p[6] === TAB_TYPE[tab]);

  return (
    <>
      <MockActions primary="Record Payment" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <MockKpi icon={FileText} tone="green" label="Total Received (YTD)" value="£126,450.00" sub="vs last year ↑ 8.7%" subTone="green" link="View report" />
        <MockKpi icon={User} tone="indigo" label="Rent Received (YTD)" value="£104,320.00" sub="vs last year ↑ 9.4%" subTone="green" link="View rent received" />
        <MockKpi icon={ClipboardList} tone="indigo" label="Service Charge Received (YTD)" value="£16,275.00" sub="vs last year ↑ 6.2%" subTone="green" link="View service charge" />
        <MockKpi icon={PieIcon} tone="orange" label="Management Fees Received (YTD)" value="£4,980.00" sub="vs last year ↑ 7.1%" subTone="green" link="View management fees" />
        <MockKpi icon={FileCheck} tone="blue" label="Ancillary Income (YTD)" value="£975.00" sub="vs last year ↑ 12.8%" subTone="green" link="View ancillary income" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 flex flex-col gap-6 min-w-0">
          <MockCard title="Payments" action={null}>
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <MockTabs tabs={TABS} value={tab} onChange={setTab} />
              <MockFilters search="Search payments…" filters={['More Filters']} />
            </div>
            <MockStrip items={[
              { label: 'Today', value: '£1,950.00', sub: '3 payments' },
              { label: 'This Week', value: '£7,850.00', sub: '12 payments' },
              { label: 'This Month', value: '£32,450.00', sub: '48 payments' },
              { label: 'Last Month', value: '£28,710.00', sub: '44 payments' },
            ]} />
            <MockTable
              minWidth={860}
              columns={['Date', 'Payer', 'Property / Unit', 'Type', 'Reference', 'Method', { label: 'Amount', right: true }, 'Allocated To']}
              rows={rows.map((p) => [
                <Two key="d" top={p[0]} bottom={p[1]} />,
                <Two key="p" top={p[2]} bottom={p[3]} link />,
                <Two key="u" top={p[4]} bottom={p[5]} />,
                <Pill key="t" tone={TYPE_TONE[p[6]]}>{p[6]}</Pill>,
                p[7],
                <span key="m" className="flex items-center gap-1.5"><Landmark size={13} className="text-gray-400" />{p[8]}</span>,
                <Amount key="a" value={p[9]} tone="green" />,
                p[10],
              ])}
            />
            {rows.length === 0 && <p className="text-xs text-gray-400 font-semibold py-6 text-center">No payments of this type in the sample.</p>}
            <MockPagination text="Showing 1 to 10 of 152 payments" pages={5} />
          </MockCard>

          <MockCard title="Reconciliation Overview" sub="All payments are automatically reconciled against bank transactions." action={null}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                [CheckCircle2, 'green', 'Matched', '£124,350.00', '98.3%'],
                [XCircle, 'red', 'Unmatched', '£2,100.00', '1.7%'],
                [Loader, 'indigo', 'In Progress', '£0.00', '0.0%'],
                [AlertOctagon, 'red', 'Errors', '£0.00', '0.0%'],
              ].map(([Icon, tone, label, value, pct]) => (
                <div key={label} className="border border-card-border rounded-lg p-3 flex items-center gap-3">
                  <Icon size={18} className={tone === 'green' ? 'text-status-success' : tone === 'red' ? 'text-status-danger' : 'text-brand-accent'} />
                  <div className="flex-1 min-w-0">
                    <span className="block text-[11px] text-gray-400 font-semibold">{label}</span>
                    <span className="block text-sm font-bold text-brand-primary">{value}</span>
                  </div>
                  <span className="text-[11px] font-bold text-gray-400">{pct}</span>
                </div>
              ))}
            </div>
          </MockCard>
        </div>

        <div className="flex flex-col gap-6 min-w-0">
          <MockCard title="Payments by Type (YTD)" action="View report">
            <MockDonut
              centre="£126,450"
              sub="Total"
              data={[
                { label: 'Rent', value: 104320, color: C.green, display: '£104,320.00 (82.5%)' },
                { label: 'Service Charge', value: 16275, color: C.indigo, display: '£16,275.00 (12.9%)' },
                { label: 'Management Fees', value: 4980, color: C.orange, display: '£4,980.00 (3.9%)' },
                { label: 'Ancillary Income', value: 975, color: C.teal, display: '£975.00 (0.8%)' },
              ]}
            />
          </MockCard>

          <MockCard title="Payment Methods (YTD)" action="View report">
            <div className="flex flex-col">
              {[
                [Landmark, 'BACS', '£92,150.00 (72.8%)'],
                [CircleDollarSign, 'Direct Debit', '£18,450.00 (14.6%)'],
                [Landmark, 'Bank Transfer', '£10,625.00 (8.4%)'],
                [CreditCard, 'Card', '£3,725.00 (2.9%)'],
                [CircleDollarSign, 'Other', '£1,500.00 (1.3%)'],
              ].map(([Icon, label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 py-2 border-b border-card-border/60 last:border-0">
                  <span className="flex items-center gap-2.5 text-xs font-semibold text-brand-primary"><Icon size={14} className="text-gray-400" />{label}</span>
                  <span className="text-xs font-bold text-brand-primary tabular-nums">{value}</span>
                </div>
              ))}
            </div>
          </MockCard>

          <MockActivity items={[
            { icon: ArrowDownLeft, tone: 'green', title: 'Rent payment received', sub: 'James Anderson (Apt 7)', right: '£1,950.00', date: '15 May 2024' },
            { icon: FileText, tone: 'indigo', title: 'Service charge payment received', sub: 'Parsons House RTM Co.', right: '£3,850.00', date: '14 May 2024' },
            { icon: FileText, tone: 'orange', title: 'Management fee payment received', sub: 'Roca Living Ltd', right: '£1,245.00', date: '13 May 2024' },
            { icon: ArrowDownLeft, tone: 'indigo', title: 'Rent payment received', sub: 'Emily Harris (Apt 1)', right: '£1,200.00', date: '13 May 2024' },
            { icon: FileCheck, tone: 'blue', title: 'Ancillary income received', sub: 'ROCA Stays Guest (Apt 5)', right: '£150.00', date: '12 May 2024' },
          ]} />
        </div>
      </div>
    </>
  );
};
