import { useState } from 'react';
import { Landmark, FileCheck, Scale, CalendarDays, FileText, ClipboardList, PlusCircle, Upload, FileBarChart } from 'lucide-react';
import { MockActions, MockKpi, MockCard, MockTabs, MockFilters, MockTable, MockDonut, MockQuickActions, MockRows, Pill, Two } from './MockKit';
import { C, TONES, useDummyToast } from './mockUtils';

// Design p26 — Accounting › VAT (sample data from the design)
const RETURNS = [
  ['Apr – Jun 2024', 'Q1 2024/25', '£21,450.00', '£18,575.00', '£2,875.00', 'Due to HMRC', 'red', 'Filed', '07 Jul 2024', '02 Jul 2024'],
  ['Jan – Mar 2024', 'Q4 2023/24', '£18,820.00', '£20,430.00', '£1,610.00', 'Reclaimable', 'green', 'Filed', '07 Apr 2024', '03 Apr 2024'],
  ['Oct – Dec 2023', 'Q3 2023/24', '£17,950.00', '£16,420.00', '£1,530.00', 'Due to HMRC', 'red', 'Filed', '07 Jan 2024', '04 Jan 2024'],
  ['Jul – Sep 2023', 'Q2 2023/24', '£16,275.00', '£15,245.00', '£1,030.00', 'Due to HMRC', 'red', 'Filed', '07 Oct 2023', '02 Oct 2023'],
  ['Apr – Jun 2023', 'Q1 2023/24', '£14,680.00', '£16,250.00', '£1,570.00', 'Reclaimable', 'green', 'Filed', '07 Jul 2023', '03 Jul 2023'],
  ['Jan – Mar 2025', 'Q4 2024/25', '£0.00', '£0.00', '£0.00', 'No VAT due', null, 'Draft', '07 Apr 2025', '–'],
];

const TIMELINE = [
  ['Q4 2024/25 (Jan – Mar 2025)', 'Due 07 Apr 2025', '£0.00', 'Draft', 'red'],
  ['Q1 2024/25 (Apr – Jun 2024)', 'Due 07 Jul 2024', '£2,875.00', 'Filed', 'orange'],
  ['Q4 2023/24 (Jan – Mar 2024)', 'Due 07 Apr 2024', '£1,610.00', 'Filed', 'green'],
  ['Q3 2023/24 (Oct – Dec 2023)', 'Due 07 Jan 2024', '£1,530.00', 'Filed', 'green'],
];

const TopList = ({ title, rows }) => (
  <div className="border border-card-border rounded-lg p-3 flex flex-col gap-1 min-w-0">
    <p className="text-xs font-bold text-brand-primary mb-1">{title}</p>
    {rows.map(([l, v]) => (
      <div key={l} className="flex items-center justify-between gap-3 py-1">
        <span className="text-xs font-semibold text-gray-500">{l}</span>
        <span className="text-xs font-bold text-brand-primary tabular-nums">{v}</span>
      </div>
    ))}
  </div>
);

export const VatMock = () => {
  const [tab, setTab] = useState('VAT Returns');
  const dummy = useDummyToast();

  return (
    <>
      <MockActions primary="Record VAT Transaction" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <MockKpi icon={Landmark} tone="indigo" label="VAT Due to HMRC" value="£4,250.00" sub="For period ending 31 May 2024" link="View liability" />
        <MockKpi icon={FileCheck} tone="green" label="VAT Reclaimable" value="£2,875.00" sub="For period ending 31 May 2024" link="View reclaimable" />
        <MockKpi icon={Scale} tone="orange" label="Net VAT Position" value="£1,375.00" sub="Payable to HMRC" subTone="red" link="View calculation" />
        <MockKpi icon={CalendarDays} tone="indigo" label="Next Return Due" value="07 Jun 2024" sub="Quarterly (Apr – Jun 2024)" link="View schedule" />
        <MockKpi icon={FileText} tone="indigo" label="VAT Registration Number" value="445 6789 12" sub="Registered 01 Apr 2023" link="View details" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 flex flex-col gap-6 min-w-0">
          <MockCard title="VAT Returns" action={null}>
            <MockTabs tabs={['VAT Returns', 'VAT Transactions', 'EC Sales List', 'VAT Contacts', 'Settings']} value={tab} onChange={setTab} />
            <MockFilters search="Search returns…" filters={['2024/25 (Apr 2024 – Mar 2025)', 'All Periods', 'All Statuses', '01/04/2024 – 31/03/2025']} />
            <MockTable
              minWidth={860}
              columns={['Period', 'Return Type', { label: 'Sales (Output VAT)', right: true }, { label: 'Purchases (Input VAT)', right: true }, { label: 'Net VAT Due / (Reclaim)', right: true }, 'Status', 'Due Date', 'Filed On', '']}
              rows={RETURNS.map((r) => [
                <Two key="p" top={r[0]} bottom={r[1]} />,
                'VAT Return', r[2], r[3],
                <span key="n" className="block text-right">
                  <span className={`block text-xs font-bold ${r[6] ? TONES[r[6]].text : 'text-brand-primary'}`}>{r[4]}</span>
                  <span className={`block text-[11px] font-semibold ${r[6] ? TONES[r[6]].text : 'text-gray-400'}`}>{r[5]}</span>
                </span>,
                <Pill key="s" tone={r[7] === 'Filed' ? 'green' : 'blue'}>{r[7]}</Pill>,
                r[8], r[9],
                r[7] === 'Draft'
                  ? <button key="o" type="button" onClick={dummy} className="px-3 py-1 rounded-md border border-card-border text-2xs font-bold text-brand-accent cursor-pointer">Open</button>
                  : '',
              ])}
            />
            <p className="text-[11px] text-gray-400 font-semibold">Showing 1 to 6 of 6 returns</p>
          </MockCard>

          <MockCard title="VAT Transactions Summary" action="View all transactions">
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_1fr] gap-4">
              <MockDonut
                centre="£25,160"
                sub="Total VAT"
                data={[
                  { label: 'Sales (Output VAT)', value: 4290, color: C.green, display: '£4,290 (17.1%)' },
                  { label: 'Purchases (Input VAT)', value: 3715, color: C.amber, display: '£3,715 (14.8%)' },
                  { label: 'Reverse Charge', value: 0.001, color: C.purple, display: '£0 (0.0%)' },
                  { label: 'Exempt / Zero Rated', value: 17155, color: '#C7C9D9', display: '£17,155 (68.1%)' },
                ]}
              />
              <TopList title="Top Output VAT (YTD)" rows={[['Parsons House Rent', '£2,850.00'], ['Derwent House Rent', '£1,120.00'], ['Car Park Income', '£320.00']]} />
              <TopList title="Top Input VAT (YTD)" rows={[['Maintenance & Repairs', '£1,450.00'], ['Utilities', '£920.00'], ['Cleaning Services', '£485.00']]} />
            </div>
          </MockCard>
        </div>

        <div className="flex flex-col gap-6 min-w-0">
          <MockCard title="VAT Position (Current Period)" action="View calculation">
            <MockRows rows={[
              ['Sales (Output VAT)', '£21,450.00', null, true],
              ['at 20%', '£4,290.00'],
              ['Purchases (Input VAT)', '£18,575.00', null, true],
              ['at 20%', '£3,715.00'],
              ['Net VAT', '£575.00', null, true],
              ['Rounded', '£575.00'],
            ]} />
            <div className="flex items-center justify-between bg-status-danger-bg rounded-lg px-3 py-2.5">
              <span className="text-xs font-bold text-status-danger">Net VAT Due to HMRC</span>
              <span className="text-xs font-bold text-status-danger">£575.00</span>
            </div>
          </MockCard>

          <MockCard title="VAT Liability Timeline" action="View schedule">
            <div className="flex flex-col">
              {TIMELINE.map(([q, due, amt, status, tone], i) => (
                <div key={q} className="flex items-start gap-3 relative pb-3">
                  <span className="flex flex-col items-center self-stretch">
                    <span className={`w-3 h-3 rounded-full border-2 ${tone === 'red' ? 'border-status-danger' : tone === 'orange' ? 'border-status-warning' : 'border-status-success'}`} />
                    {i < TIMELINE.length - 1 && <span className="flex-1 w-px bg-card-border mt-1" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-bold text-brand-primary">{q}</span>
                    <span className="block text-[11px] text-gray-400 font-semibold">{due}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-xs font-bold text-brand-primary">{amt}</span>
                    <Pill tone={status === 'Draft' ? 'grey' : 'green'}>{status}</Pill>
                  </span>
                </div>
              ))}
            </div>
          </MockCard>

          <MockQuickActions items={[
            { icon: ClipboardList, label: 'Prepare VAT Return', sub: 'Create a new VAT return' },
            { icon: PlusCircle, label: 'Record VAT Transaction', sub: 'Add a new VAT transaction' },
            { icon: Upload, label: 'Upload VAT Document', sub: 'Upload VAT returns or correspondence' },
            { icon: FileBarChart, label: 'View VAT Reports', sub: 'Run VAT summary and audit reports' },
          ]} />
        </div>
      </div>
    </>
  );
};
