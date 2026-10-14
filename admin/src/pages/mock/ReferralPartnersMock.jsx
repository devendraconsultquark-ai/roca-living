import { Handshake, UserPlus, Home, PoundSterling, PlusCircle, ClipboardList, Wallet, FileBarChart } from 'lucide-react';
import { MockActions, MockKpi, MockCard, MockFilters, MockTable, MockPagination, MockDonut, MockQuickActions, MockActivity, Pill, Two } from './MockKit';
import { C } from './mockUtils';

// Not drawn in the design: design-style page with sample data
const PARTNERS = [
  ['Washington Estate Agents', 'Estate Agent', 'Laura Mitchell', 7, 5, '18 May 2024', '£250 per landlord', 'Active'],
  ['North East Mortgages', 'Mortgage Broker', 'Mark Davies', 5, 4, '12 May 2024', '£200 per landlord', 'Active'],
  ['Sunderland Solicitors LLP', 'Solicitor', 'Helen Brooks', 4, 3, '02 May 2024', '£150 per landlord', 'Active'],
  ['Tyne Accountancy', 'Accountant', 'Ravi Shah', 3, 2, '22 Apr 2024', '5% of first-year fee', 'Active'],
  ['Gateshead Property Club', 'Investor Network', 'Chris Hall', 2, 1, '10 Apr 2024', '£200 per landlord', 'Active'],
  ['Durham Lettings Network', 'Network', 'Paula Green', 2, 2, '28 Mar 2024', '£250 per landlord', 'Paused'],
];

export const ReferralPartnersMock = () => (
  <>
    <MockActions primary="Add Partner" />
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <MockKpi icon={Handshake} tone="indigo" label="Active Partners" value="9" sub="2 added this year" subTone="green" link="View partners" />
      <MockKpi icon={UserPlus} tone="green" label="Landlords Referred (YTD)" value="23" sub="17 converted (73.9%)" link="View referrals" />
      <MockKpi icon={Home} tone="orange" label="Properties Onboarded" value="41" sub="From referrals" link="View properties" />
      <MockKpi icon={PoundSterling} tone="blue" label="Referral Fees Paid (YTD)" value="£6,150.00" sub="2 fees pending" link="View fees" />
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <MockCard title="Referral Partners" action={null} className="xl:col-span-2">
        <MockFilters search="Search partners…" filters={['All Types', 'All Statuses']} />
        <MockTable
          minWidth={820}
          columns={['Partner', 'Contact', { label: 'Referrals (YTD)', right: true }, { label: 'Converted', right: true }, 'Last Referral', 'Fee Basis', 'Status']}
          rows={PARTNERS.map((p) => [
            <Two key="p" top={p[0]} bottom={p[1]} link />, p[2], p[3], p[4], p[5], p[6],
            <Pill key="s" tone={p[7] === 'Active' ? 'green' : 'orange'}>{p[7]}</Pill>,
          ])}
        />
        <MockPagination text="Showing 1 to 6 of 9 partners" pages={2} />
      </MockCard>
      <div className="flex flex-col gap-6 min-w-0">
        <MockCard title="Referrals by Source (YTD)" action="View report">
          <MockDonut centre="23" sub="Referrals" data={[
            { label: 'Estate Agents', value: 7, color: C.green, display: '7 (30.4%)' },
            { label: 'Mortgage Brokers', value: 5, color: C.indigo, display: '5 (21.7%)' },
            { label: 'Solicitors', value: 4, color: C.amber, display: '4 (17.4%)' },
            { label: 'Accountants', value: 3, color: C.blue, display: '3 (13.0%)' },
            { label: 'Other', value: 4, color: C.purple, display: '4 (17.4%)' },
          ]} />
        </MockCard>
        <MockActivity title="Recent Referrals" items={[
          { icon: UserPlus, tone: 'green', title: 'Olivia Green referred', sub: 'Washington Estate Agents', date: '18 May 2024' },
          { icon: UserPlus, tone: 'green', title: 'Liam Wilson referred', sub: 'North East Mortgages', date: '12 May 2024' },
          { icon: Wallet, tone: 'indigo', title: 'Referral fee paid', sub: 'Sunderland Solicitors LLP', right: '£150.00', date: '06 May 2024' },
        ]} />
        <MockQuickActions items={[
          { icon: PlusCircle, label: 'Add Partner', sub: 'Register a new referral partner' },
          { icon: ClipboardList, label: 'Record Referral', sub: 'Log a landlord introduction' },
          { icon: Wallet, label: 'Pay Referral Fee', sub: 'Mark a referral fee as paid' },
          { icon: FileBarChart, label: 'Partner Report', sub: 'Referrals and conversion by partner' },
        ]} />
      </div>
    </div>
  </>
);
