import { useState } from 'react';
import { GitBranch, LogIn, LogOut, Wallet, PlayCircle, FileX, ClipboardCheck, Undo2 } from 'lucide-react';
import { MockActions, MockKpi, MockCard, MockTabs, MockFilters, MockTable, MockPagination, MockDonut, MockQuickActions, Pill, Two, Avatar } from './MockKit';
import { C } from './mockUtils';

// Not drawn in the design: design-style page with sample data
const STAGES = [
  ['Referencing', 4, C.purple, 'indigo'], ['Move-in', 3, C.blue, 'blue'], ['Active', 38, C.green, 'green'], ['Renewal', 7, C.amber, 'orange'],
  ['Notice', 2, C.orange, 'orange'], ['Move-out', 2, C.red, 'red'], ['Deposit Return', 3, C.teal, 'blue'],
];
const STAGE_TONE = Object.fromEntries(STAGES.map(([s, , , t]) => [s, t]));

const TENANCIES = [
  ['Liam Wilson', 'Apt 32, Derwent House', 'Referencing', 'Move-in 01 Jun 2024', 'Awaiting reference report', 'James Carter', 40],
  ['Sophia Morris', 'Apt 9, Derwent House', 'Move-in', 'Move-in 20 May 2024', 'Check-in inventory', 'Emma Wilson', 80],
  ['Olivia Green', 'Apt 21, Derwent House', 'Move-in', 'Move-in 25 May 2024', 'Register deposit', 'James Carter', 60],
  ['James Anderson', 'Apt 7, Parsons House', 'Active', 'Review 12 Jun 2024', 'Routine inspection', 'James Carter', 100],
  ['Michael Roberts', 'Apt 12, Parsons House', 'Renewal', 'Ends 14 Nov 2024', 'Send renewal offer', 'Emma Wilson', 20],
  ['Daniel White', 'Apt 9, Parsons House', 'Notice', 'Ends 31 Aug 2024', 'Book check-out', 'James Carter', 50],
  ['Thomas Brown', 'Apt 11, Parsons House', 'Move-out', 'Move-out 30 Jun 2024', 'Check-out inspection', 'Emma Wilson', 70],
  ['Amelia Clarke', 'Apt 2, Parsons House', 'Deposit Return', 'Ended 04 Oct 2024', 'Agree deductions', 'James Carter', 90],
];

export const TenancyLifecycleMock = () => {
  const [stage, setStage] = useState('All');
  const rows = TENANCIES.filter((t) => stage === 'All' || t[2] === stage);
  return (
    <>
      <MockActions primary="Start Move-in" primaryIcon={PlayCircle} />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MockKpi icon={GitBranch} tone="indigo" label="Tenancies in Lifecycle" value="59" sub="Across all stages" link="View all" />
        <MockKpi icon={LogIn} tone="green" label="Moving In This Month" value="3" sub="2 check-ins booked" link="View move-ins" />
        <MockKpi icon={LogOut} tone="orange" label="Moving Out This Month" value="2" sub="1 check-out booked" link="View move-outs" />
        <MockKpi icon={Wallet} tone="blue" label="Deposits to Return" value="3" sub="£4,350.00 held" link="View deposits" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <MockCard title="Tenancies by Stage" action={null} className="xl:col-span-2">
          <MockTabs
            tabs={[{ id: 'All', label: 'All', count: 59 }, ...STAGES.map(([s, n]) => ({ id: s, label: s, count: n }))]}
            value={stage}
            onChange={setStage}
          />
          <MockFilters search="Search tenants or properties…" filters={['All Properties', 'All Owners']} />
          <MockTable
            minWidth={860}
            columns={['Tenant', 'Property', 'Stage', 'Key Date', 'Next Task', 'Owner', 'Progress']}
            rows={rows.map((t) => [
              <span key="t" className="flex items-center gap-2.5"><Avatar name={t[0]} /><span className="font-bold text-brand-primary">{t[0]}</span></span>,
              t[1], <Pill key="s" tone={STAGE_TONE[t[2]]}>{t[2]}</Pill>, t[3],
              <span key="n" className="text-brand-primary font-semibold">{t[4]}</span>, t[5],
              <span key="p" className="flex items-center gap-2 w-24">
                <span className="flex-1 h-1.5 rounded-full bg-surface-hover overflow-hidden"><span className="block h-full bg-brand-accent rounded-full" style={{ width: `${t[6]}%` }} /></span>
                <span className="text-[11px] font-bold text-gray-500">{t[6]}%</span>
              </span>,
            ])}
          />
          {rows.length === 0 && <p className="text-xs text-gray-400 font-semibold py-6 text-center">No tenancies at this stage in the sample.</p>}
          <MockPagination text="Showing 1 to 8 of 59 tenancies" pages={5} />
        </MockCard>
        <div className="flex flex-col gap-6 min-w-0">
          <MockCard title="Lifecycle Pipeline" action="View report">
            <MockDonut centre="59" sub="Tenancies" data={STAGES.map(([s, n, color]) => ({ label: s, value: n, color, display: `${n} (${((n / 59) * 100).toFixed(1)}%)` }))} />
          </MockCard>
          <MockCard title="Upcoming Moves" action="View calendar">
            {[['Sophia Morris', 'Move-in · Apt 9, Derwent House', '20 May 2024', 'green'], ['Olivia Green', 'Move-in · Apt 21, Derwent House', '25 May 2024', 'green'], ['Liam Wilson', 'Move-in · Apt 32, Derwent House', '01 Jun 2024', 'green'], ['Thomas Brown', 'Move-out · Apt 11, Parsons House', '30 Jun 2024', 'orange']].map(([n, sub, d, tone]) => (
              <div key={n} className="flex items-center justify-between gap-3 py-2 border-b border-card-border/60 last:border-0">
                <Two top={n} bottom={sub} />
                <Pill tone={tone}>{d}</Pill>
              </div>
            ))}
          </MockCard>
          <MockQuickActions items={[
            { icon: PlayCircle, label: 'Start Move-in', sub: 'Begin referencing and move-in' },
            { icon: FileX, label: 'Serve Notice', sub: 'Start the end-of-tenancy process' },
            { icon: ClipboardCheck, label: 'Book Check-out', sub: 'Schedule the check-out inspection' },
            { icon: Undo2, label: 'Return Deposit', sub: 'Agree deductions and release the deposit' },
          ]} />
        </div>
      </div>
    </>
  );
};
