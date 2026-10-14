import { useState } from 'react';
import { Send, Mail, MessageSquare, FileText, MailPlus, Users, LayoutTemplate } from 'lucide-react';
import { MockActions, MockKpi, MockCard, MockTabs, MockFilters, MockTable, MockPagination, MockDonut, MockQuickActions, Pill, Two } from './MockKit';
import { C, useDummyToast } from './mockUtils';

// Not drawn in the design: design-style page with sample data
const MESSAGES = [
  ['15 May 2024', '10:24', 'James Anderson', 'Tenant', 'Rent Receipt', 'Rent received – May 2024', 'Email', 'Delivered'],
  ['14 May 2024', '16:02', 'David & Sarah Thompson', 'Landlord', 'Statement', 'Your May 2024 statement', 'Email', 'Opened'],
  ['14 May 2024', '11:30', 'Sophie Lee', 'Tenant', 'Arrears Reminder', 'Rent overdue – Apt 3', 'SMS', 'Delivered'],
  ['13 May 2024', '09:15', 'PlumbFix Ltd', 'Contractor', 'Work Order', 'WO-2024-0412 – Leaking tap', 'Email', 'Opened'],
  ['12 May 2024', '14:45', 'Michael Roberts', 'Tenant', 'Inspection Notice', 'Routine inspection 12 Jun 2024', 'Letter', 'Sent'],
  ['10 May 2024', '08:50', 'All Parsons House tenants', 'Tenant', 'Building Notice', 'Fire alarm test 17 May', 'Email', 'Delivered'],
  ['09 May 2024', '15:20', 'Riverside Holdings Ltd', 'Landlord', 'Maintenance Approval', 'Approve boiler repair – Apt 3', 'Email', 'Failed'],
];
const STATUS_TONE = { Delivered: 'green', Opened: 'indigo', Sent: 'blue', Failed: 'red' };
const CHANNEL_ICON = { Email: Mail, SMS: MessageSquare, Letter: FileText };
const TABS = ['All', 'Landlords', 'Tenants', 'Contractors'];
const TAB_ROLE = { Landlords: 'Landlord', Tenants: 'Tenant', Contractors: 'Contractor' };

export const CommunicationsMock = () => {
  const [tab, setTab] = useState('All');
  const dummy = useDummyToast();
  const rows = MESSAGES.filter((m) => tab === 'All' || m[3] === TAB_ROLE[tab]);
  return (
    <>
      <MockActions primary="New Message" primaryIcon={MailPlus} />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MockKpi icon={Send} tone="indigo" label="Sent This Month" value="186" sub="vs last month ↑ 6.3%" subTone="green" link="View all" />
        <MockKpi icon={Mail} tone="green" label="Emails" value="142" sub="76% opened" link="View emails" />
        <MockKpi icon={MessageSquare} tone="orange" label="SMS" value="31" sub="All delivered" link="View SMS" />
        <MockKpi icon={FileText} tone="blue" label="Letters" value="13" sub="2 awaiting post" link="View letters" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <MockCard title="Message Log" action={null} className="xl:col-span-2">
          <MockTabs tabs={TABS} value={tab} onChange={setTab} />
          <MockFilters search="Search messages…" filters={['All Channels', 'All Types']} />
          <MockTable
            minWidth={820}
            columns={['Date', 'Recipient', 'Type', 'Subject', 'Channel', 'Status']}
            rows={rows.map((m) => {
              const Icon = CHANNEL_ICON[m[6]];
              return [
                <Two key="d" top={m[0]} bottom={m[1]} />,
                <Two key="r" top={m[2]} bottom={m[3]} link />,
                m[4],
                <span key="s" className="text-brand-primary font-semibold">{m[5]}</span>,
                <span key="c" className="flex items-center gap-1.5"><Icon size={13} className="text-gray-400" />{m[6]}</span>,
                <Pill key="st" tone={STATUS_TONE[m[7]]}>{m[7]}</Pill>,
              ];
            })}
          />
          <MockPagination text="Showing 1 to 7 of 186 messages" pages={5} />
        </MockCard>
        <div className="flex flex-col gap-6 min-w-0">
          <MockCard title="Messages by Channel" action="View report">
            <MockDonut centre="186" sub="This month" data={[
              { label: 'Email', value: 142, color: C.indigo, display: '142 (76.3%)' },
              { label: 'SMS', value: 31, color: C.orange, display: '31 (16.7%)' },
              { label: 'Letter', value: 13, color: C.blue, display: '13 (7.0%)' },
            ]} />
          </MockCard>
          <MockCard title="Templates" action="Manage">
            {['Rent receipt', 'Arrears reminder (1st)', 'Arrears reminder (final)', 'Inspection notice', 'Renewal offer', 'Monthly statement email'].map((t) => (
              <button key={t} type="button" onClick={dummy} className="flex items-center gap-2.5 py-2 border-b border-card-border/60 last:border-0 text-left cursor-pointer">
                <LayoutTemplate size={14} className="text-brand-accent shrink-0" />
                <span className="text-xs font-semibold text-brand-primary">{t}</span>
              </button>
            ))}
          </MockCard>
          <MockQuickActions items={[
            { icon: MailPlus, label: 'New Message', sub: 'Email, SMS or letter' },
            { icon: Users, label: 'Bulk Message', sub: 'Message all tenants of a building' },
            { icon: LayoutTemplate, label: 'Manage Templates', sub: 'Edit message templates' },
          ]} />
        </div>
      </div>
    </>
  );
};
