import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { ArrowDownLeft, FileText, Clock, CalendarX, Receipt, Upload, Repeat, CheckCheck, PlusCircle } from 'lucide-react';
import { MockActions, MockKpi, MockCard, MockTabs, MockFilters, MockStrip, MockTable, MockPagination, MockDonut, MockActivity, MockQuickActions, Pill, Amount } from './MockKit';
import { C } from './mockUtils';

// Design p23 — Accounting › Expenses (sample data from the design)
const CAT_TONE = { Maintenance: 'indigo', Repairs: 'orange', Utilities: 'blue', Cleaning: 'green', 'Grounds Maintenance': 'green', Compliance: 'red', 'Waste Removal': 'indigo', Security: 'indigo', Supplies: 'blue' };

const EXPENSES = [
  ['15 May 2024', 'Northeast Electrical Ltd', 'Maintenance', 'Parsons House', 'INV-2587', '30 May 2024', '£850.00', 'Paid'],
  ['14 May 2024', 'Sunderland Plumbing', 'Repairs', 'Derwent House', 'INV-2586', '28 May 2024', '£420.00', 'Paid'],
  ['13 May 2024', 'British Gas Business', 'Utilities', 'Parsons House', 'GBG-456789', '27 May 2024', '£1,125.00', 'Paid'],
  ['10 May 2024', 'City Clean Ltd', 'Cleaning', 'Riverside Apartments', 'INV-2585', '24 May 2024', '£320.00', 'Paid'],
  ['09 May 2024', 'Elevate Lift Services', 'Maintenance', 'Parsons House', 'INV-2584', '23 May 2024', '£610.00', 'Paid'],
  ['08 May 2024', 'ROCA Contractors Ltd', 'Grounds Maintenance', 'Washington Lofts', 'INV-2583', '22 May 2024', '£275.00', 'Paid'],
  ['07 May 2024', 'Axiom Fire Safety', 'Compliance', 'Derwent House', 'INV-2582', '21 May 2024', '£950.00', 'Unpaid'],
  ['06 May 2024', 'Total Waste Management', 'Waste Removal', 'Parsons House', 'INV-2581', '20 May 2024', '£185.00', 'Paid'],
  ['03 May 2024', 'Secure Alarm Systems', 'Security', 'Riverside Apartments', 'INV-2580', '17 May 2024', '£430.00', 'Unpaid'],
  ['02 May 2024', 'Generic Supplies Co', 'Supplies', 'Multiple', 'INV-2579', '16 May 2024', '£96.00', 'Paid'],
];

const MONTHLY = [
  ['Jan', 3500, 2600], ['Feb', 3800, 4900], ['Mar', 3900, 5600], ['Apr', 6000, 5000], ['May', 5400, 7800], ['Jun', 3600, 2600],
  ['Jul', 3900, 2700], ['Aug', 3300, 2500], ['Sep', 3600, 2200], ['Oct', 3500, 2100], ['Nov', 3400, 1900], ['Dec', 3200, 1700],
].map(([m, a, b]) => ({ month: m, '2024': a, '2023': b }));

const BY_PROPERTY = [['Parsons House', 16840], ['Derwent House', 6125], ['Riverside Apartments', 3450], ['Washington Lofts', 2860], ['Other Properties', 1700]];

const TABS = ['All Expenses', 'Unpaid', 'Paid', 'Overdue', 'Recurring', 'By Category', 'By Property', 'By Supplier'];

export const ExpensesMock = () => {
  const [tab, setTab] = useState('All Expenses');
  const rows = EXPENSES.filter((e) => (tab === 'Unpaid' ? e[7] === 'Unpaid' : tab === 'Paid' ? e[7] === 'Paid' : true));
  const maxProp = BY_PROPERTY[0][1];

  return (
    <>
      <MockActions primary="Record Expense" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <MockKpi icon={ArrowDownLeft} tone="green" label="Total Expenses (YTD)" value="£28,975.00" sub="vs last year ↑ 4.2%" subTone="red" link="View report" />
        <MockKpi icon={FileText} tone="indigo" label="Total Paid (YTD)" value="£25,450.00" sub="vs last year ↑ 3.6%" subTone="red" link="View paid expenses" />
        <MockKpi icon={Clock} tone="orange" label="Outstanding (YTD)" value="£3,525.00" sub="vs last year ↑ 9.1%" subTone="red" link="View outstanding" />
        <MockKpi icon={CalendarX} tone="red" label="Overdue (YTD)" value="£1,275.00" sub="vs last year ↑ 12.3%" subTone="red" link="View overdue" />
        <MockKpi icon={Receipt} tone="indigo" label="This Month" value="£4,125.00" sub="vs last month ↑ 8.7%" subTone="green" link="View this month" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 flex flex-col gap-6 min-w-0">
          <MockCard title="Expenses" action={null}>
            <MockTabs tabs={TABS} value={tab} onChange={setTab} />
            <MockFilters search="Search expenses…" filters={['More Filters']} />
            <MockStrip items={[
              { label: 'This Week', value: '£1,250.00', sub: '6 expenses' },
              { label: 'This Month', value: '£4,125.00', sub: '18 expenses' },
              { label: 'This Quarter', value: '£12,840.00', sub: '56 expenses' },
              { label: 'This Year (YTD)', value: '£28,975.00', sub: '124 expenses' },
            ]} />
            <MockTable
              minWidth={840}
              columns={['Date', 'Supplier', 'Category', 'Property / Unit', 'Reference', 'Due Date', { label: 'Amount', right: true }, 'Status']}
              rows={rows.map((e) => [
                e[0],
                <span key="s" className="font-bold text-brand-primary">{e[1]}</span>,
                <Pill key="c" tone={CAT_TONE[e[2]]}>{e[2]}</Pill>,
                e[3], e[4], e[5],
                <Amount key="a" value={e[6]} tone="green" />,
                <Pill key="st" tone={e[7] === 'Paid' ? 'green' : 'orange'}>{e[7]}</Pill>,
              ])}
            />
            {rows.length === 0 && <p className="text-xs text-gray-400 font-semibold py-6 text-center">No expenses of this kind in the sample.</p>}
            <MockPagination text="Showing 1 to 10 of 124 expenses" pages={5} />
          </MockCard>

          <MockCard title="Expense Breakdown (YTD)" action="View report">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gray-400 mb-2">By Month (2024 vs 2023)</p>
                <BarChart width={400} height={200} data={MONTHLY} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${v / 1000}k`} width={34} />
                  <Tooltip formatter={(v) => `£${v.toLocaleString('en-GB')}`} />
                  <Bar dataKey="2024" fill={C.indigo} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="2023" fill="#C7C9F0" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-[11px] font-bold text-gray-400">By Property</p>
                {BY_PROPERTY.map(([name, v]) => (
                  <div key={name} className="grid grid-cols-[120px_1fr_80px] items-center gap-3">
                    <span className="text-xs font-semibold text-brand-primary truncate">{name}</span>
                    <span className="h-1.5 rounded-full bg-surface-hover overflow-hidden">
                      <span className="block h-full bg-brand-accent rounded-full" style={{ width: `${(v / maxProp) * 100}%` }} />
                    </span>
                    <span className="text-xs font-bold text-brand-primary text-right tabular-nums">£{v.toLocaleString('en-GB')}.00</span>
                  </div>
                ))}
              </div>
            </div>
          </MockCard>
        </div>

        <div className="flex flex-col gap-6 min-w-0">
          <MockCard title="Expenses by Category (YTD)" action="View report">
            <MockDonut
              centre="£28,975"
              sub="Total"
              data={[
                { label: 'Maintenance', value: 11450, color: C.green, display: '£11,450 (39.5%)' },
                { label: 'Utilities', value: 5250, color: C.indigo, display: '£5,250 (18.1%)' },
                { label: 'Repairs', value: 4210, color: C.amber, display: '£4,210 (14.5%)' },
                { label: 'Cleaning', value: 2840, color: C.teal, display: '£2,840 (9.8%)' },
                { label: 'Compliance', value: 2125, color: C.pink, display: '£2,125 (7.3%)' },
                { label: 'Other', value: 3100, color: C.purple, display: '£3,100 (10.8%)' },
              ]}
            />
          </MockCard>

          <MockCard title="Top 5 Suppliers (YTD)" action="View report">
            <div className="flex flex-col">
              {[['Northeast Electrical Ltd', '£3,250.00'], ['British Gas Business', '£2,875.00'], ['Elevate Lift Services', '£2,300.00'], ['Axiom Fire Safety', '£1,950.00'], ['City Clean Ltd', '£1,420.00']].map(([n, v]) => (
                <div key={n} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-xs font-bold text-brand-accent">{n}</span>
                  <span className="text-xs font-bold text-brand-primary tabular-nums">{v}</span>
                </div>
              ))}
            </div>
          </MockCard>

          <MockQuickActions items={[
            { icon: PlusCircle, label: 'Record New Expense', sub: 'Add and track a new expense' },
            { icon: Upload, label: 'Upload Expense Receipt', sub: 'Attach and store expense receipt files' },
            { icon: Repeat, label: 'Create Recurring Expense', sub: 'Set up a recurring payment' },
            { icon: CheckCheck, label: 'Approve Expenses', sub: 'Review and approve pending expenses' },
          ]} />

          <MockActivity items={[
            { icon: ArrowDownLeft, tone: 'green', title: 'Payment made to Northeast Electrical Ltd', right: '£850.00', date: '15 May 2024' },
            { icon: Clock, tone: 'orange', title: 'Expense due: Axiom Fire Safety', right: '£950.00', date: 'Due 21 May 2024' },
            { icon: FileText, tone: 'indigo', title: 'New expense recorded', sub: 'City Clean Ltd', right: '£320.00', date: '10 May 2024' },
          ]} />
        </div>
      </div>
    </>
  );
};
