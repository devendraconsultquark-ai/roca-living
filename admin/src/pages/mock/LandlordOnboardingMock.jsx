import { User, ShieldCheck, Globe, Home, FileText, PenLine, CheckCircle2, ChevronRight, FileUp, PlayCircle, Mail, Plus } from 'lucide-react';
import { MockActions, MockCard, MockActivity, Pill, DummyTag } from './MockKit';
import { useDummyToast } from './mockUtils';

// Design p3 — Landlords › Onboarding (sample data from the design)
const STEPS = [
  [User, 'Landlord Details', 'In Progress', 'indigo'],
  [ShieldCheck, 'AML Check', 'Pending', 'grey'],
  [Globe, 'NRL Details', 'Not applicable', 'grey'],
  [Home, 'Property Onboarding', 'Not started', 'grey'],
  [FileText, 'Proof of Ownership', 'Not started', 'grey'],
  [PenLine, 'Management Agreement', 'Not started', 'grey'],
  [CheckCircle2, 'Onboarding Complete', 'Not started', 'green'],
];

const CHECKLIST = [
  [User, 'Collect Landlord Details', 'Collect all landlord personal and contact information.', 'In Progress', 'Continue'],
  [ShieldCheck, 'AML Check Sent / Verified', 'Send AML check and verify identity.', 'Pending', 'Start'],
  [Globe, 'Overseas Landlord – NRL Details', 'Provide NRL details (if overseas landlord).', 'Not applicable', null],
  [Home, 'Onboard Property & Compliance', 'Add property details and upload compliance documents, warranties, manuals, floor plans etc.', 'Not started', 'Start'],
  [FileText, 'Proof of Ownership Documents', 'Upload proof of ownership for the property.', 'Not started', 'Start'],
  [PenLine, 'Management Agreement', 'Send management agreement and obtain signature.', 'Not started', 'Start'],
  [CheckCircle2, 'Onboarding Complete', 'All checks completed and landlord is live.', 'Not started', 'Start'],
];

const Section = ({ title, rows }) => (
  <div className="flex flex-col gap-1.5">
    <p className="text-xs font-bold text-brand-primary">{title}</p>
    {rows.map(([l, v]) => (
      <div key={l} className="grid grid-cols-[150px_1fr] gap-2">
        <span className="text-[11px] text-gray-400 font-semibold">{l}</span>
        <span className="text-[11px] text-brand-primary font-semibold">{v}</span>
      </div>
    ))}
  </div>
);

export const LandlordOnboardingMock = () => {
  const dummy = useDummyToast();
  return (
    <>
      <MockActions primary="Add New Landlord" extra={['View Reports']} />

      {/* Stepper */}
      <div className="card-bg border border-card-border rounded-card shadow-premium p-5 overflow-x-auto flex flex-col gap-3">
        <span className="self-end"><DummyTag /></span>
        <div className="grid grid-cols-7 gap-3 min-w-[900px]">
          {STEPS.map(([Icon, label, status, tone], i) => (
            <div key={label} className="flex flex-col items-center gap-2 text-center">
              <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${i === 0 ? 'bg-brand-accent' : tone === 'green' ? 'bg-status-success' : 'bg-gray-400'}`}>
                {i + 1}
              </span>
              <span className="flex items-center gap-1.5">
                <Icon size={15} className={i === 0 ? 'text-brand-accent' : 'text-gray-400'} />
                <span className={`text-xs font-bold ${i === 0 ? 'text-brand-accent' : 'text-brand-primary'}`}>{label}</span>
              </span>
              <span className={`text-[11px] font-semibold ${i === 0 ? 'text-brand-accent' : 'text-gray-400'}`}>{status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Landlord header */}
      <div className="relative card-bg border border-card-border rounded-card shadow-premium p-5 pt-8 grid grid-cols-1 xl:grid-cols-[1fr_220px_300px] gap-6 items-center">
        <span className="absolute top-2 right-3"><DummyTag /></span>
        <div className="flex items-center gap-5 flex-wrap">
          <span className="w-16 h-16 rounded-full bg-brand-accent/10 text-brand-accent text-xl font-bold flex items-center justify-center">DT</span>
          <div className="flex flex-col gap-3">
            <span className="flex items-center gap-2"><span className="text-lg font-bold text-brand-primary">David &amp; Sarah Thompson</span><Pill tone="indigo">Individual</Pill></span>
            <div className="flex gap-6 flex-wrap">
              {[['Email', 'david.thompson@email.com'], ['Phone', '07500 123456'], ['Type', 'Overseas Landlord'], ['Onboarding Started', '21 May 2024'], ['Account Manager', 'James Carter']].map(([l, v]) => (
                <span key={l}>
                  <span className="block text-[11px] text-gray-400 font-semibold">{l}</span>
                  <span className={`block text-xs font-bold ${l === 'Type' ? 'text-brand-accent' : 'text-brand-primary'}`}>{v}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[11px] text-gray-400 font-semibold">Overall Progress</span>
          <span className="text-2xl font-bold text-brand-primary">14%</span>
          <span className="h-2 rounded-full bg-surface-hover overflow-hidden"><span className="block h-full w-[14%] bg-brand-accent rounded-full" /></span>
          <span className="text-[11px] text-gray-400 font-semibold">Last Updated: 21 May 2024, 10:30</span>
        </div>
        <div className="bg-brand-accent/5 rounded-lg p-4 flex flex-col gap-2">
          <span className="text-xs font-bold text-brand-primary">Next Step</span>
          <span className="text-[11px] text-gray-500 font-semibold">Request additional ID documents for AML verification.</span>
          <button type="button" onClick={dummy} className="self-start px-3 py-2 rounded-lg bg-brand-accent text-white text-xs font-bold cursor-pointer">Continue AML Step</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr_1fr] gap-6">
        <MockCard title="Onboarding Checklist" sub="Complete all steps to onboard landlord and properties." action="View full checklist">
          <div className="flex flex-col gap-2">
            {CHECKLIST.map(([Icon, title, sub, status, btn], i) => (
              <div key={title} className={`flex items-center gap-3 p-3 rounded-lg border ${i === 0 ? 'border-brand-accent/30 bg-brand-accent/5' : 'border-transparent'}`}>
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-brand-accent text-white' : 'bg-surface-hover text-gray-500'}`}>{i + 1}</span>
                <Icon size={18} className="text-gray-400 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className={`block text-xs font-bold ${i === 0 ? 'text-brand-accent' : 'text-brand-primary'}`}>{title}</span>
                  <span className="block text-[11px] text-gray-400 font-semibold">{sub}</span>
                </span>
                <span className="flex flex-col items-end gap-0.5 shrink-0">
                  <Pill tone={i === 0 ? 'green' : 'grey'}>{status}</Pill>
                  {i === 0 && <span className="text-[10px] text-gray-400 font-semibold">Started 21 May 2024</span>}
                </span>
                {btn ? (
                  <button type="button" onClick={dummy} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-card-border text-xs font-bold text-brand-primary cursor-pointer shrink-0">
                    {btn} <ChevronRight size={13} />
                  </button>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg border border-card-border text-[11px] font-semibold text-gray-400 shrink-0">Not applicable</span>
                )}
              </div>
            ))}
          </div>
        </MockCard>

        <MockCard title="Landlord Summary" action="Edit">
          <div className="flex flex-col gap-5">
            <Section title="Personal Details" rows={[
              ['Full Name', 'David & Sarah Thompson'], ['Landlord Type', 'Individual'], ['Date of Birth', '12 Apr 1980'],
              ['Nationality', 'United Kingdom'], ['Country of Residence', 'Spain'], ['Email', 'david.thompson@email.com'],
              ['Phone', '07500 123456'], ['Address', 'Calle de Serrano 45, 28001 Madrid, Spain'],
            ]} />
            <Section title="Portfolio (Planned)" rows={[['Properties', '4'], ['Estimated Rent Roll', '£4,250.00 pcm'], ['Estimated Property Value', '£1,820,000']]} />
            <Section title="Onboarding Information" rows={[['Referred By', 'Agent Introduction'], ['Source', 'Website Enquiry'], ['Onboarding Started', '21 May 2024'], ['Target Go-Live Date', '—']]} />
          </div>
        </MockCard>

        <div className="flex flex-col gap-6 min-w-0">
          <MockActivity items={[
            { icon: User, tone: 'green', title: 'Landlord details saved', sub: 'Personal information and contact details added · by James Carter', date: '21 May 2024, 10:30' },
            { icon: FileUp, tone: 'indigo', title: 'ID documents uploaded', sub: 'Passport and proof of address received · by David Thompson', date: '21 May 2024, 09:45' },
            { icon: PlayCircle, tone: 'indigo', title: 'Onboarding started', sub: 'Landlord onboarding workflow initiated · by James Carter', date: '21 May 2024, 09:30' },
            { icon: Mail, tone: 'orange', title: 'Enquiry received', sub: 'New landlord enquiry via website · by System', date: '20 May 2024, 16:20' },
          ]} />
          <MockCard title="Notes" sub="Add internal notes about this landlord onboarding." action={null}>
            <button type="button" onClick={dummy} className="self-start flex items-center gap-1.5 px-3 py-2 rounded-lg border border-card-border text-xs font-bold text-brand-primary cursor-pointer">
              <Plus size={13} /> Add Note
            </button>
          </MockCard>
        </div>
      </div>
    </>
  );
};
