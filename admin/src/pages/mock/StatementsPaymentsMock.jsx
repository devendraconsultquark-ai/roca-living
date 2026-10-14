import { useState } from 'react';
import { FileText, Send, Wallet, Hourglass, FilePlus, Banknote, Mail, FileBarChart, CheckCircle2 } from 'lucide-react';
import { MockActions, MockKpi, MockCard, MockTabs, MockFilters, MockTable, MockPagination, MockDonut, MockQuickActions, MockActivity, Pill, Amount } from './MockKit';
import { C } from './mockUtils';

// Not drawn in the design: design-style page with sample data
const STATEMENTS = [
  ['PH_07_0012', 'James Anderson', 'Apt 7, Parsons House', 'May 2024', '£1,950.00', '£234.00', '£1,716.00', 'Paid', '03 Jun 2024'],
  ['PH_12_0009', 'David & Sarah Thompson', '4 properties', 'May 2024', '£4,250.00', '£595.00', '£3,655.00', 'Paid', '03 Jun 2024'],
  ['DH_03_0015', 'Michael Brown', 'Apt 3, Derwent House', 'May 2024', '£1,550.00', '£186.00', '£1,364.00', 'Sent', '—'],
  ['RA_08_0004', 'Riverside Holdings Ltd', '12 properties', 'May 2024', '£18,600.00', '£2,604.00', '£15,996.00', 'Sent', '—'],
  ['CL_02_0011', 'Olivia Cooper', 'Apt 2, City Lofts', 'May 2024', '£1,300.00', '£156.00', '£1,144.00', 'Draft', '—'],
  ['PH_05_0007', 'Emily Harris', '2 properties', 'May 2024', '£2,400.00', '£288.00', '£2,112.00', 'Draft', '—'],
];
const STATUS_TONE = { Paid: 'green', Sent: 'blue', Draft: 'grey' };

export const StatementsPaymentsMock = () => {
  const [tab, setTab] = useState('All');
  const rows = STATEMENTS.filter((s) => tab === 'All' || s[7] === tab);
  return (
    <>
      <MockActions primary="Run Landlord Payouts" primaryIcon={Banknote} />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MockKpi icon={FileText} tone="indigo" label="Statements This Month" value="24" sub="May 2024" link="View statements" />
        <MockKpi icon={Send} tone="blue" label="Sent to Landlords" value="18" sub="75% of this month" link="View sent" />
        <MockKpi icon={Wallet} tone="green" label="Paid Out This Month" value="£58,420.00" sub="12 landlords" subTone="green" link="View payouts" />
        <MockKpi icon={Hourglass} tone="orange" label="Awaiting Payout" value="£14,250.00" sub="6 statements" subTone="orange" link="View pending" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <MockCard title="Statements & Payouts" action={null} className="xl:col-span-2">
          <MockTabs tabs={['All', 'Draft', 'Sent', 'Paid']} value={tab} onChange={setTab} />
          <MockFilters search="Search statements…" filters={['May 2024', 'All Landlords']} />
          <MockTable
            minWidth={860}
            columns={['Statement', 'Landlord', 'Period', { label: 'Rent Received', right: true }, { label: 'Deductions', right: true }, { label: 'Payout', right: true }, 'Status', 'Paid On']}
            rows={rows.map((s) => [
              <span key="n" className="font-bold text-brand-accent">{s[0]}</span>,
              <span key="l" className="block"><span className="block text-xs font-bold text-brand-primary">{s[1]}</span><span className="block text-[11px] text-gray-400 font-semibold">{s[2]}</span></span>,
              s[3], s[4], <Amount key="d" value={`-${s[5]}`} tone="red" />, <Amount key="p" value={s[6]} tone="green" />,
              <Pill key="st" tone={STATUS_TONE[s[7]]}>{s[7]}</Pill>, s[8],
            ])}
          />
          {rows.length === 0 && <p className="text-xs text-gray-400 font-semibold py-6 text-center">No statements with this status in the sample.</p>}
          <MockPagination text="Showing 1 to 6 of 24 statements" pages={4} />
        </MockCard>
        <div className="flex flex-col gap-6 min-w-0">
          <MockCard title="Statement Status (May 2024)" action="View report">
            <MockDonut centre="24" sub="Statements" data={[
              { label: 'Paid', value: 12, color: C.green, display: '12 (50.0%)' },
              { label: 'Sent', value: 6, color: C.blue, display: '6 (25.0%)' },
              { label: 'Draft', value: 6, color: C.grey, display: '6 (25.0%)' },
            ]} />
          </MockCard>
          <MockActivity title="Payout Timeline" items={[
            { icon: CheckCircle2, tone: 'green', title: 'Payout run completed', sub: '12 landlords paid', right: '£58,420.00', date: '03 Jun 2024' },
            { icon: Send, tone: 'blue', title: 'Statements emailed', sub: '18 landlords', date: '01 Jun 2024' },
            { icon: Hourglass, tone: 'orange', title: 'Next payout run', sub: '6 statements waiting', right: '£14,250.00', date: '10 Jun 2024' },
          ]} />
          <MockQuickActions items={[
            { icon: FilePlus, label: 'Generate Statements', sub: 'Create this month’s statements' },
            { icon: Banknote, label: 'Run Landlord Payouts', sub: 'Pay landlords for sent statements' },
            { icon: Mail, label: 'Email Statements', sub: 'Send statements to landlords' },
            { icon: FileBarChart, label: 'Payout Report', sub: 'Payouts and deductions by month' },
          ]} />
        </div>
      </div>
    </>
  );
};
