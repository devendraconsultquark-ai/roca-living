import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ShieldCheck, Zap, Flame, Bell, Plug, Home, Phone, Mail, Eye, Wrench, Upload, Download, Plus, PoundSterling, Pencil, ClipboardList } from 'lucide-react';
import { SectionCard, Pill, Avatar, NotTracked, KeyValues } from './DesignKit';
import { PropertyThumb } from './PropertyImage';
import { gbp, shortDate, daysUntil } from '../../utilities/designTokens';
import api from '../../utilities/api';

// Design p5 (property Overview): Property Summary, Compliance Overview, Tenant
// Information, Financial Snapshot, Maintenance Overview, Important Documents
// and Property Notes. Real data only; what we don't record says so.

const CERTS = {
  EPC: { label: 'Energy Performance (EPC)', icon: FileText },
  EICR: { label: 'Electrical Installation (EICR)', icon: Zap },
  GAS: { label: 'Gas Safety Certificate', icon: Flame },
  SMOKE_CO: { label: 'Smoke & CO Alarms', icon: Bell },
  HMO: { label: 'HMO Licence', icon: Home },
  PAT: { label: 'PAT Testing', icon: Plug },
};

const certState = (c) => {
  if (!c.expires_at) return { label: 'Not uploaded', tone: 'grey' };
  const d = daysUntil(c.expires_at);
  if (d < 0) return { label: 'Expired', tone: 'red' };
  if (d <= 30) return { label: 'Due soon', tone: 'orange' };
  return { label: 'Compliant', tone: 'green' };
};

const OPEN = ['new', 'triaged', 'awaiting_approval'];
const TICKET = {
  new: { label: 'Open', tone: 'orange' },
  triaged: { label: 'Triaged', tone: 'orange' },
  awaiting_approval: { label: 'Awaiting Approval', tone: 'orange' },
  in_progress: { label: 'In Progress', tone: 'blue' },
  complete: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'grey' },
};

const pretty = (v) => (v ? String(v).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : null);

// The next date a monthly rent falls on (rent due day, else the start date's day).
const nextRentDue = (tenancy) => {
  if (!tenancy) return null;
  const day = tenancy.rent_due_day || (tenancy.start_date ? Number(tenancy.start_date.slice(8, 10)) : null);
  if (!day) return null;
  const today = new Date();
  const at = (y, m) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()), 12);
  let d = at(today.getFullYear(), today.getMonth());
  if (d < new Date(today.getFullYear(), today.getMonth(), today.getDate())) d = at(today.getFullYear(), today.getMonth() + 1);
  return d;
};

export const PropertyOverview = ({ data, documents, onTab, onDownloadDoc, onUploadDoc, onEditNotes }) => {
  const navigate = useNavigate();
  const [estate, setEstate] = useState(null);
  const [transactions, setTransactions] = useState(null);

  useEffect(() => {
    if (!data.rocaem_property_id) return;
    api.get(`/estates/properties/${data.rocaem_property_id}`, { skipInterceptorError: true })
      .then((res) => setEstate(res.data.data))
      .catch(() => setEstate(null));
  }, [data.rocaem_property_id]);

  useEffect(() => {
    api.get('/transactions', { params: { property_id: data.id }, skipInterceptorError: true })
      .then((res) => setTransactions(res.data.data || []))
      .catch(() => setTransactions([]));
  }, [data.id]);

  const t = data.active_tenancy;
  const lead = t?.tenants?.find((x) => x.is_lead_tenant) || t?.tenants?.[0] || null;
  const dep = t?.deposit;
  const floorPlan = (data.images || []).find((i) => i.image_type === 'floor_plan');

  // Financial snapshot (this year, from the transactions ledger)
  const year = new Date().getFullYear();
  const ytd = (transactions || []).filter((x) => x.transaction_date && new Date(x.transaction_date).getFullYear() === year);
  const sum = (list, types) => list.filter((x) => types.includes(x.type)).reduce((s, x) => s + parseFloat(x.amount || 0), 0);
  const rentYtd = sum(ytd, ['rent_in']);
  const costsYtd = sum(ytd, ['mgmt_fee', 'vat', 'agent_letting_fee', 'roca_letting_fee', 'contractor_cost', 'deduction', 'nrl_withholding', 'other']);
  const lastRent = (transactions || []).filter((x) => x.type === 'rent_in').sort((a, b) => String(b.transaction_date).localeCompare(String(a.transaction_date)))[0];
  const nextDue = nextRentDue(t);

  const tickets = data.maintenance_tickets || [];
  const openCount = tickets.filter((x) => OPEN.includes(x.status)).length;
  const progressCount = tickets.filter((x) => x.status === 'in_progress').length;
  const doneRecent = tickets.filter((x) => x.status === 'complete' && x.updated_at && -daysUntil(x.updated_at) <= 90).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Property Summary */}
        <SectionCard title="Property Summary">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
            <KeyValues rows={[
              ['Property Type', pretty(estate?.unit_type) || data.property_type || '—'],
              ['Bedrooms', data.bedrooms != null ? String(data.bedrooms) : '—'],
              ['Bathrooms', <NotTracked key="b" what="Bathrooms" />],
              ['Furnished', <NotTracked key="f" what="Furnished" />],
              ['Floor', estate?.floor_number || '—'],
              ['Size', estate?.internal_area ? `${estate.internal_area} sq ft` : '—'],
              ['Parking', estate ? (estate.has_parking ? (estate.parking_space || 'Yes') : 'No') : '—'],
              ['Council Tax Band', <NotTracked key="c" what="Council tax band" />],
              ['EPC Rating', estate?.epc_rating || '—'],
              ['Property Reference', data.property_reference || '—'],
            ]} />
            <div className="flex flex-col gap-2 items-stretch sm:w-36">
              {floorPlan?.is_pdf ? (
                <button type="button" onClick={() => onTab('photos')} className="w-full h-36 rounded-card border border-card-border flex flex-col items-center justify-center gap-1 text-brand-primary hover:bg-surface-hover cursor-pointer">
                  <FileText size={26} className="text-status-danger" />
                  <span className="text-[11px] font-bold">Floor plan (PDF)</span>
                </button>
              ) : floorPlan ? (
                <PropertyThumb imageId={floorPlan.id} alt="Floor plan" className="w-full h-36 rounded-card border border-card-border" iconSize={22} />
              ) : (
                <div className="w-full h-36 rounded-card border border-dashed border-card-border flex items-center justify-center text-center text-[11px] text-gray-400 font-semibold p-2">
                  No floor plan uploaded
                </div>
              )}
              <button type="button" onClick={() => onTab('photos')} className="flex items-center justify-center gap-1.5 text-2xs font-bold text-brand-accent border border-card-border rounded-lg py-2 hover:bg-surface-hover cursor-pointer">
                <Eye size={13} /> View Floor Plan
              </button>
            </div>
          </div>
        </SectionCard>

        {/* Compliance Overview */}
        <SectionCard title="Compliance Overview" action="View all" onAction={() => onTab('safety')}>
          {(data.property_certificates || []).length === 0 ? (
            <p className="text-[11px] text-gray-400 font-semibold">No certificates recorded.</p>
          ) : (
            <div className="flex flex-col">
              {(data.property_certificates || []).map((c) => {
                const meta = CERTS[c.cert_type] || { label: c.cert_type, icon: ShieldCheck };
                const Icon = meta.icon;
                const st = certState(c);
                return (
                  <div key={c.id} className="flex items-center gap-3 py-2 border-b border-card-border/60 last:border-0">
                    <span className="w-8 h-8 rounded-lg bg-status-success/10 text-status-success flex items-center justify-center shrink-0"><Icon size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-brand-primary truncate">{meta.label}</span>
                      <span className="block text-[11px] text-gray-400 font-semibold">{c.expires_at ? `Valid until ${shortDate(c.expires_at)}` : 'No certificate on file'}</span>
                    </span>
                    <Pill tone={st.tone}>{st.label}</Pill>
                  </div>
                );
              })}
            </div>
          )}
          <button type="button" onClick={() => onTab('safety')} className="mt-auto flex items-center justify-center gap-2 text-xs font-bold text-brand-accent border border-card-border rounded-lg py-2.5 hover:bg-surface-hover cursor-pointer">
            <ShieldCheck size={14} /> View Compliance Dashboard
          </button>
        </SectionCard>

        {/* Tenant Information */}
        <SectionCard title="Tenant Information" action={t ? 'View tenancy' : null} onAction={() => onTab('tenancy')}>
          {t && lead ? (
            <>
              <div className="flex items-center gap-3">
                <Avatar name={lead.name} />
                <span className="text-sm font-bold text-brand-primary">{lead.name}</span>
                <Pill tone={t.status === 'notice' ? 'orange' : 'green'}>{t.status === 'notice' ? 'Notice given' : 'Active'}</Pill>
              </div>
              <div className="flex flex-col gap-1.5 text-xs font-semibold text-gray-500">
                {lead.phone && <span className="flex items-center gap-2"><Phone size={13} className="text-brand-accent" /> {lead.phone}</span>}
                {lead.email && <span className="flex items-center gap-2"><Mail size={13} className="text-brand-accent" /> {lead.email}</span>}
              </div>
              <KeyValues rows={[
                ['Tenancy Start', shortDate(t.start_date)],
                ['Tenancy End', t.end_date ? shortDate(t.end_date) : 'Periodic'],
                ['Rent', t.rent_pcm ? `${gbp(t.rent_pcm)} pcm` : '—'],
                ['Deposit', dep?.tenancy_deposit ? (
                  <span key="d" className="flex items-center gap-2 justify-end">{gbp(dep.tenancy_deposit)} <Pill tone={dep.registered_at ? 'green' : 'orange'}>{dep.registered_at ? 'Protected' : 'Not protected'}</Pill></span>
                ) : '—'],
              ]} />
              <button type="button" onClick={() => navigate(`/tenants/${lead.id}`)} className="mt-auto flex items-center justify-center gap-2 text-xs font-bold text-brand-accent border border-card-border rounded-lg py-2.5 hover:bg-surface-hover cursor-pointer">
                <Eye size={14} /> View Tenant Details
              </button>
            </>
          ) : (
            <p className="text-[11px] text-gray-400 font-semibold">No current tenancy — the apartment is {data.status === 'onboarding' ? 'onboarding' : 'vacant'}.</p>
          )}
        </SectionCard>

        {/* Financial Snapshot */}
        <SectionCard title="Financial Snapshot" action="View financials" onAction={() => onTab('financials')}>
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-center">
            <div className="bg-brand-accent/5 rounded-card p-4 flex flex-col items-center gap-1 text-center sm:w-36">
              <span className="w-10 h-10 rounded-full bg-brand-accent/10 text-brand-accent flex items-center justify-center"><PoundSterling size={18} /></span>
              <span className="text-[11px] text-gray-400 font-semibold mt-1">Current Balance</span>
              <NotTracked what="A per-property client balance" />
            </div>
            <KeyValues rows={[
              [`Rent Received (${year})`, transactions ? gbp(rentYtd) : '…'],
              [`Expenditure (${year})`, transactions ? `-${gbp(costsYtd)}` : '…', 'red'],
              [`Net Income (${year})`, transactions ? gbp(rentYtd - costsYtd) : '…', rentYtd - costsYtd >= 0 ? 'green' : 'red'],
              ['Last Rent Received', lastRent ? shortDate(lastRent.transaction_date) : '—'],
              ['Next Rent Due', nextDue ? shortDate(nextDue) : '—'],
            ]} />
          </div>
        </SectionCard>

        {/* Maintenance Overview */}
        <SectionCard title="Maintenance Overview" action="View all requests" onAction={() => onTab('maintenance')}>
          <div className="grid grid-cols-3 gap-2">
            {[['Open Requests', openCount, 'bg-status-warning/10 text-status-warning'], ['In Progress', progressCount, 'bg-status-info-bg text-status-info'], ['Completed (90 days)', doneRecent, 'bg-status-success-bg text-status-success']].map(([label, n, cls]) => (
              <div key={label} className={`rounded-card p-3 ${cls}`}>
                <span className="block text-[11px] font-semibold leading-tight">{label}</span>
                <span className="block text-lg font-bold mt-1">{n}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] font-bold text-brand-primary">Latest Requests</p>
          {tickets.length === 0 ? (
            <p className="text-[11px] text-gray-400 font-semibold">No maintenance requests.</p>
          ) : (
            <div className="flex flex-col">
              {tickets.slice(0, 3).map((x) => {
                const st = TICKET[x.status] || { label: pretty(x.status), tone: 'grey' };
                return (
                  <div key={x.id} className="flex items-center gap-3 py-2 border-b border-card-border/60 last:border-0">
                    <Wrench size={14} className="text-status-warning shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-brand-primary truncate">{x.title || x.description || `Ticket #${x.id}`}</span>
                      <span className="block text-[11px] text-gray-400 font-semibold">#{x.id}</span>
                    </span>
                    <Pill tone={st.tone}>{st.label}</Pill>
                    <span className="text-[11px] text-gray-400 font-semibold whitespace-nowrap">{shortDate(x.created_at)}</span>
                  </div>
                );
              })}
            </div>
          )}
          <button type="button" onClick={() => onTab('maintenance')} className="mt-auto flex items-center justify-center gap-2 text-xs font-bold text-brand-accent border border-card-border rounded-lg py-2.5 hover:bg-surface-hover cursor-pointer">
            <Plus size={14} /> Add Maintenance Request
          </button>
        </SectionCard>

        {/* Important Documents */}
        <SectionCard title="Important Documents" action="View all documents" onAction={() => onTab('documents')}>
          {documents.length === 0 ? (
            <p className="text-[11px] text-gray-400 font-semibold">No documents uploaded.</p>
          ) : (
            <div className="flex flex-col">
              {documents.slice(0, 5).map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 py-2 border-b border-card-border/60 last:border-0">
                  <span className="w-8 h-8 rounded-lg bg-status-danger/10 text-status-danger flex items-center justify-center shrink-0"><ClipboardList size={14} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-brand-primary truncate">{doc.name}</span>
                    <span className="block text-[11px] text-gray-400 font-semibold">Added {doc.date}</span>
                  </span>
                  <button type="button" onClick={() => onDownloadDoc(doc)} className="p-1.5 text-gray-400 hover:text-brand-accent cursor-pointer" title="Download document">
                    <Download size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={onUploadDoc} className="mt-auto flex items-center justify-center gap-2 text-xs font-bold text-brand-accent border border-card-border rounded-lg py-2.5 hover:bg-surface-hover cursor-pointer">
            <Upload size={14} /> Upload Document
          </button>
        </SectionCard>
      </div>

      {/* Property Notes */}
      <SectionCard title="Property Notes">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <p className="text-xs text-gray-500 font-semibold whitespace-pre-line flex-1 min-w-[240px]">{data.notes || 'No notes yet.'}</p>
          <button type="button" onClick={onEditNotes} className="flex items-center gap-1.5 text-xs font-bold text-brand-primary border border-card-border rounded-lg px-3 py-2 hover:bg-surface-hover cursor-pointer">
            <Pencil size={13} /> {data.notes ? 'Edit Note' : 'Add Note'}
          </button>
        </div>
      </SectionCard>
    </div>
  );
};
