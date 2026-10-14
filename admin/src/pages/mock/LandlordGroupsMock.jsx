import { Users, UserPlus, Home, PoundSterling, PlusCircle, FileText, FileBarChart } from 'lucide-react';
import { MockActions, MockKpi, MockCard, MockFilters, MockTable, MockPagination, MockDonut, MockQuickActions, Pill, Avatar } from './MockKit';
import { C } from './mockUtils';

// Not drawn in the design: design-style page with sample data
const GROUPS = [
  ['Thompson Family', 'Family', 2, 4, '£4,250.00', 'James Carter', 'Active'],
  ['Riverside Holdings Ltd', 'Company', 3, 12, '£18,600.00', 'James Carter', 'Active'],
  ['Anderson & Partners', 'Partnership', 4, 9, '£13,950.00', 'Emma Wilson', 'Active'],
  ['Patel Investments', 'Company', 2, 7, '£10,850.00', 'Emma Wilson', 'Active'],
  ['Harris Family Trust', 'Trust', 3, 6, '£8,700.00', 'James Carter', 'Active'],
  ['Cooper Portfolio', 'Family', 2, 5, '£7,250.00', 'Emma Wilson', 'Under Review'],
  ['Northern Lets Group', 'Company', 5, 15, '£21,300.00', 'James Carter', 'Active'],
  ['Brown & Lee', 'Partnership', 2, 3, '£4,350.00', 'Emma Wilson', 'Inactive'],
];
const STATUS_TONE = { Active: 'green', 'Under Review': 'orange', Inactive: 'grey' };

export const LandlordGroupsMock = () => (
  <>
    <MockActions primary="Create Group" />
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <MockKpi icon={Users} tone="indigo" label="Landlord Groups" value="12" sub="3 new this year" subTone="green" link="View all groups" />
      <MockKpi icon={UserPlus} tone="green" label="Landlords in Groups" value="34" sub="of 124 landlords" link="View landlords" />
      <MockKpi icon={Home} tone="orange" label="Properties Covered" value="86" sub="Across all groups" link="View properties" />
      <MockKpi icon={PoundSterling} tone="blue" label="Group Rent Roll" value="£96,450.00" sub="per month" link="View rent roll" />
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <MockCard title="All Groups" action={null} className="xl:col-span-2">
        <MockFilters search="Search groups…" filters={['All Types', 'All Account Managers', 'All Statuses']} />
        <MockTable
          columns={['Group', 'Type', { label: 'Landlords', right: true }, { label: 'Properties', right: true }, { label: 'Rent Roll (pcm)', right: true }, 'Account Manager', 'Status']}
          rows={GROUPS.map((g) => [
            <span key="n" className="flex items-center gap-2.5"><Avatar name={g[0]} /><span className="font-bold text-brand-primary">{g[0]}</span></span>,
            g[1], g[2], g[3], <span key="r" className="font-bold text-brand-primary">{g[4]}</span>, g[5],
            <Pill key="s" tone={STATUS_TONE[g[6]]}>{g[6]}</Pill>,
          ])}
        />
        <MockPagination text="Showing 1 to 8 of 12 groups" pages={2} />
      </MockCard>
      <div className="flex flex-col gap-6 min-w-0">
        <MockCard title="Groups by Type" action="View report">
          <MockDonut centre="12" sub="Groups" data={[
            { label: 'Family', value: 4, color: C.green, display: '4 (33.3%)' },
            { label: 'Company', value: 4, color: C.indigo, display: '4 (33.3%)' },
            { label: 'Partnership', value: 2, color: C.amber, display: '2 (16.7%)' },
            { label: 'Trust', value: 2, color: C.blue, display: '2 (16.7%)' },
          ]} />
        </MockCard>
        <MockQuickActions items={[
          { icon: PlusCircle, label: 'Create Group', sub: 'Group landlords for a combined view' },
          { icon: UserPlus, label: 'Add Landlord to Group', sub: 'Link a landlord to an existing group' },
          { icon: FileText, label: 'Group Statement', sub: 'One statement for the whole group' },
          { icon: FileBarChart, label: 'Group Portfolio Report', sub: 'Rent roll and performance by group' },
        ]} />
      </div>
    </div>
  </>
);
