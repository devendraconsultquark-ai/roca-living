import { Package, Users, Percent, PoundSterling, Check } from 'lucide-react';
import { MockActions, MockKpi, MockCard, MockFilters, MockTable, MockPagination, MockDonut, Pill, DummyTag } from './MockKit';
import { C, useDummyToast } from './mockUtils';

// Not drawn in the design: design-style page with sample data
const PACKAGES = [
  ['Let Only', '8% + VAT', 'of the first year\'s rent', 14, ['Tenant find and viewings', 'Referencing and Right to Rent', 'Tenancy agreement', 'Deposit registration']],
  ['Rent Collection', '10% + VAT', 'of monthly rent', 38, ['Everything in Let Only', 'Rent collection', 'Arrears chasing', 'Monthly landlord statements']],
  ['Fully Managed', '14% + VAT', 'of monthly rent', 72, ['Everything in Rent Collection', 'Maintenance and contractors', 'Inspections', 'Compliance management', '24/7 tenant support']],
];

const LANDLORDS = [
  ['David & Sarah Thompson', 'Fully Managed', 4, '14% + VAT', '£595.00', '12 Feb 2022'],
  ['Riverside Holdings Ltd', 'Fully Managed', 12, '14% + VAT', '£2,604.00', '15 Jan 2021'],
  ['James Anderson', 'Rent Collection', 1, '10% + VAT', '£195.00', '03 Mar 2023'],
  ['Patel Investments', 'Fully Managed', 7, '14% + VAT', '£1,519.00', '20 Sep 2022'],
  ['Emily Harris', 'Rent Collection', 2, '10% + VAT', '£240.00', '11 Nov 2023'],
  ['Sophie Lee', 'Let Only', 1, '8% + VAT', 'One-off £1,200.00', '01 May 2024'],
];
const PKG_TONE = { 'Fully Managed': 'indigo', 'Rent Collection': 'green', 'Let Only': 'orange' };

export const ManagementPackagesMock = () => {
  const dummy = useDummyToast();
  return (
    <>
      <MockActions primary="New Package" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MockKpi icon={Package} tone="indigo" label="Packages" value="3" sub="Let Only, Rent Collection, Fully Managed" link="View packages" />
        <MockKpi icon={Users} tone="green" label="Landlords on a Package" value="124" sub="All active landlords" link="View landlords" />
        <MockKpi icon={Percent} tone="orange" label="Average Fee" value="12.1%" sub="+ VAT" link="View fee breakdown" />
        <MockKpi icon={PoundSterling} tone="blue" label="Monthly Fee Income" value="£14,680.00" sub="vs last month ↑ 3.2%" subTone="green" link="View fee income" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {PACKAGES.map(([name, fee, basis, count, items], i) => (
          <div key={name} className={`relative card-bg border rounded-card shadow-premium p-5 flex flex-col gap-3 ${i === 2 ? 'border-brand-accent' : 'border-card-border'}`}>
            <span className="absolute top-3 right-3"><DummyTag /></span>
            <span className="text-sm-portal font-bold text-brand-primary">{name}</span>
            <span><span className="text-2xl font-bold text-brand-accent">{fee}</span><span className="block text-[11px] text-gray-400 font-semibold">{basis}</span></span>
            <ul className="flex flex-col gap-1.5">
              {items.map((it) => (
                <li key={it} className="flex items-center gap-2 text-xs font-semibold text-gray-500"><Check size={13} className="text-status-success shrink-0" />{it}</li>
              ))}
            </ul>
            <div className="flex items-center justify-between mt-auto pt-3 border-t border-card-border">
              <span className="text-xs font-bold text-brand-primary">{count} landlords</span>
              <button type="button" onClick={dummy} className="text-2xs font-bold text-brand-accent hover:underline cursor-pointer">Edit package</button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <MockCard title="Landlords by Package" action={null} className="xl:col-span-2">
          <MockFilters search="Search landlords…" filters={['All Packages']} />
          <MockTable
            columns={['Landlord', 'Package', { label: 'Properties', right: true }, 'Fee', { label: 'Monthly Fee', right: true }, 'Since']}
            rows={LANDLORDS.map((l) => [
              <span key="n" className="font-bold text-brand-accent">{l[0]}</span>,
              <Pill key="p" tone={PKG_TONE[l[1]]}>{l[1]}</Pill>, l[2], l[3],
              <span key="f" className="font-bold text-brand-primary">{l[4]}</span>, l[5],
            ])}
          />
          <MockPagination text="Showing 1 to 6 of 124 landlords" pages={5} />
        </MockCard>
        <MockCard title="Landlords by Package" action="View report">
          <MockDonut centre="124" sub="Landlords" data={[
            { label: 'Fully Managed', value: 72, color: C.indigo, display: '72 (58.1%)' },
            { label: 'Rent Collection', value: 38, color: C.green, display: '38 (30.6%)' },
            { label: 'Let Only', value: 14, color: C.orange, display: '14 (11.3%)' },
          ]} />
        </MockCard>
      </div>
    </>
  );
};
