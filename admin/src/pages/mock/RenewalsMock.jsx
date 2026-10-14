import { useState } from 'react';
import { CalendarClock, CalendarDays, CalendarRange, RefreshCcw, TrendingUp, Send, FileSignature, FileX, FileBarChart } from 'lucide-react';
import { MockActions, MockKpi, MockCard, MockTabs, MockFilters, MockTable, MockPagination, MockDonut, MockQuickActions, Pill, Two, Avatar } from './MockKit';
import { C } from './mockUtils';

// Not drawn in the design: design-style page with sample data
const RENEWALS = [
  ['Daniel White', 'daniel.white@email.com', 'Apt 9, Parsons House', '31 Aug 2024', '28 days', '£1,500.00', '£1,575.00', '5.0%', 'Offer Sent'],
  ['Amelia Clarke', 'amelia.clarke@email.com', 'Apt 2, Parsons House', '04 Oct 2024', '62 days', '£1,200.00', '£1,248.00', '4.0%', 'Due Soon'],
  ['Michael Roberts', 'michael.roberts@email.com', 'Apt 12, Parsons House', '14 Nov 2024', '103 days', '£1,650.00', '£1,720.00', '4.2%', 'Agreed'],
  ['Olivia Cooper', 'olivia.cooper@email.com', 'Apt 5, Parsons House', '09 Jan 2025', '159 days', '£1,300.00', '—', '—', 'Not Renewing'],
  ['Sophie Lee', 'sophie.lee@email.com', 'Apt 3, Parsons House', '28 Feb 2025', '209 days', '£1,250.00', '—', '—', 'Due Soon'],
  ['Emily Harris', 'emily.harris@email.com', 'Apt 1, Parsons House', '19 Apr 2025', '259 days', '£1,200.00', '£1,260.00', '5.0%', 'Offer Sent'],
];
const STATUS_TONE = { 'Offer Sent': 'blue', 'Due Soon': 'orange', Agreed: 'green', 'Not Renewing': 'red' };
const TABS = ['All', 'Due Soon', 'Offer Sent', 'Agreed', 'Not Renewing'];

export const RenewalsMock = () => {
  const [tab, setTab] = useState('All');
  const rows = RENEWALS.filter((r) => tab === 'All' || r[8] === tab);
  return (
    <>
      <MockActions primary="Send Renewal Offer" primaryIcon={Send} />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <MockKpi icon={CalendarClock} tone="red" label="Ending in 30 Days" value="3" sub="Action needed" subTone="red" link="View" />
        <MockKpi icon={CalendarDays} tone="orange" label="Ending in 60 Days" value="5" sub="Offers to send" link="View" />
        <MockKpi icon={CalendarRange} tone="indigo" label="Ending in 90 Days" value="7" sub="Plan ahead" link="View" />
        <MockKpi icon={RefreshCcw} tone="green" label="Renewed (YTD)" value="21" sub="84% renewal rate" subTone="green" link="View renewed" />
        <MockKpi icon={TrendingUp} tone="blue" label="Average Rent Increase" value="4.6%" sub="On renewed tenancies" link="View analytics" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <MockCard title="Renewals" action={null} className="xl:col-span-2">
          <MockTabs tabs={TABS} value={tab} onChange={setTab} />
          <MockFilters search="Search tenants or properties…" filters={['All Properties']} />
          <MockTable
            minWidth={820}
            columns={['Tenant', 'Property', 'Tenancy End', { label: 'Current Rent', right: true }, { label: 'Proposed Rent', right: true }, { label: 'Increase', right: true }, 'Status']}
            rows={rows.map((r) => [
              <span key="t" className="flex items-center gap-2.5"><Avatar name={r[0]} /><Two top={r[0]} bottom={r[1]} /></span>,
              <span key="p" className="text-brand-accent font-bold">{r[2]}</span>,
              <Two key="e" top={r[3]} bottom={`in ${r[4]}`} />,
              r[5], <span key="pr" className="font-bold text-brand-primary">{r[6]}</span>, r[7],
              <Pill key="s" tone={STATUS_TONE[r[8]]}>{r[8]}</Pill>,
            ])}
          />
          {rows.length === 0 && <p className="text-xs text-gray-400 font-semibold py-6 text-center">No renewals with this status in the sample.</p>}
          <MockPagination text="Showing 1 to 6 of 15 renewals" pages={2} />
        </MockCard>
        <div className="flex flex-col gap-6 min-w-0">
          <MockCard title="Renewal Status" action="View report">
            <MockDonut centre="15" sub="Next 90 days" data={[
              { label: 'Due Soon', value: 6, color: C.orange, display: '6 (40.0%)' },
              { label: 'Offer Sent', value: 4, color: C.blue, display: '4 (26.7%)' },
              { label: 'Agreed', value: 3, color: C.green, display: '3 (20.0%)' },
              { label: 'Not Renewing', value: 2, color: C.red, display: '2 (13.3%)' },
            ]} />
          </MockCard>
          <MockCard title="Upcoming End Dates" action="View all">
            {[['Daniel White', 'Apt 9, Parsons House', '31 Aug 2024', '28 days', 'red'], ['Amelia Clarke', 'Apt 2, Parsons House', '04 Oct 2024', '62 days', 'orange'], ['James Anderson', 'Apt 7, Parsons House', '11 Jun 2025', '328 days', 'grey']].map(([n, p, d, days, tone]) => (
              <div key={n} className="flex items-center justify-between gap-3 py-2 border-b border-card-border/60 last:border-0">
                <Two top={n} bottom={p} />
                <span className="text-right shrink-0"><span className="block text-xs font-semibold text-brand-primary">{d}</span><Pill tone={tone}>{days}</Pill></span>
              </div>
            ))}
          </MockCard>
          <MockQuickActions items={[
            { icon: Send, label: 'Send Renewal Offer', sub: 'Offer new terms to a tenant' },
            { icon: FileSignature, label: 'Create Renewal Agreement', sub: 'Generate the renewal agreement' },
            { icon: FileX, label: 'Serve Notice', sub: 'Start the end-of-tenancy process' },
            { icon: FileBarChart, label: 'Renewals Report', sub: 'Renewal rate and rent changes' },
          ]} />
        </div>
      </div>
    </>
  );
};
