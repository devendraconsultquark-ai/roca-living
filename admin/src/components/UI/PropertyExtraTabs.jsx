import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, CalendarClock, CheckCircle2, AlertTriangle, PoundSterling, Wrench, FileText, Home, Zap, Users, Pencil, Plus, Calendar } from 'lucide-react';
import { DataTable } from './DataTable';
import { Skeleton } from './Skeleton';
import { Dropdown } from './Dropdown';
import { KpiRow, KpiCard, SectionCard, Donut, Pill, Two, KeyValues, UpcomingList, InfoFooter } from './DesignKit';
import { C, gbp, shortDate, daysUntil, pct } from '../../utilities/designTokens';
import api from '../../utilities/api';

// Property tabs from the design (p11 Inspections, p12 Timeline, p13 Notes)
// plus Utilities, all from data Roca Living already records.

const pretty = (v) => (v ? String(v).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : '—');
const RATING = {
  excellent: { tone: 'green', color: C.green },
  good: { tone: 'green', color: C.teal },
  satisfactory: { tone: 'orange', color: C.amber },
  unsatisfactory: { tone: 'red', color: C.red },
};

const useList = (path, params) => {
  const [rows, setRows] = useState(null);
  const key = JSON.stringify(params);
  useEffect(() => {
    api.get(path, { params: JSON.parse(key), skipInterceptorError: true })
      .then((res) => setRows(res.data.data || []))
      .catch(() => setRows([]));
  }, [path, key]);
  return rows;
};

// ── Inspections (design p11) ────────────────────────────────────────────────
export const PropertyInspections = ({ propertyId }) => {
  const navigate = useNavigate();
  const rows = useList('/inspections', { property_id: propertyId });
  if (rows === null) return <Skeleton radius="card" className="h-64 w-full" />;

  const year = new Date().getFullYear();
  const thisYear = rows.filter((r) => r.inspected_at && new Date(r.inspected_at).getFullYear() === year);
  // Next due date set on the most recent inspection (list is newest first)
  const next = rows.find((r) => r.next_inspection_due)?.next_inspection_due || null;
  const nextDays = daysUntil(next);
  const ratings = Object.keys(RATING).map((k) => ({ label: pretty(k), value: rows.filter((r) => r.rating === k).length, color: RATING[k].color }));

  const columns = [
    { header: 'Date', accessor: 'inspected_at', sortable: true, renderCell: (r) => shortDate(r.inspected_at) },
    { header: 'Inspector', accessor: 'inspected_by', renderCell: (r) => r.inspected_by || 'ROCA Living' },
    { header: 'Overall Condition', accessor: 'rating', renderCell: (r) => (r.rating ? <Pill tone={RATING[r.rating]?.tone || 'grey'}>{pretty(r.rating)}</Pill> : '—') },
    { header: 'Next Due', accessor: 'next_inspection_due', renderCell: (r) => shortDate(r.next_inspection_due) },
    { header: 'Notes', accessor: 'notes', renderCell: (r) => <span className="block max-w-[320px] truncate" title={r.notes || ''}>{r.notes || '—'}</span> },
    { header: 'Report', accessor: 'document_name', renderCell: (r) => r.document_name || '—' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <KpiRow cols={4}>
        <KpiCard icon={ClipboardCheck} tone="indigo" label={`Inspections (${year})`} value={thisYear.length} sub={`${rows.length} in total`} />
        <KpiCard icon={CheckCircle2} tone="green" label="Completed" value={rows.length} sub="Recorded inspections" />
        <KpiCard icon={CalendarClock} tone="blue" label="Next Inspection" value={next ? shortDate(next) : '—'} sub={next ? (nextDays < 0 ? `${Math.abs(nextDays)} days overdue` : `In ${nextDays} days`) : 'Not scheduled'} subTone={nextDays < 0 ? 'red' : undefined} />
        <KpiCard icon={AlertTriangle} tone="red" label="Overdue" value={next && nextDays < 0 ? 1 : 0} sub="Inspections past due" />
      </KpiRow>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <SectionCard title="Inspection History" action="Schedule Inspection" onAction={() => navigate('/inspections')}>
          {rows.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-8 text-center">No inspections recorded for this property yet.</p>
          ) : (
            <DataTable columns={columns} data={rows} />
          )}
        </SectionCard>
        <SectionCard title="Overall Condition">
          <Donut data={ratings.map((d) => ({ ...d, display: `${d.value} (${pct(d.value, rows.length)})` }))} centre={rows.length} sub="Total" />
        </SectionCard>
      </div>
      <InfoFooter text="Inspections are recorded on the Inspections page; reports are stored with Documents." />
    </div>
  );
};

// ── Utilities ───────────────────────────────────────────────────────────────
export const PropertyUtilities = ({ propertyId }) => {
  const navigate = useNavigate();
  const rows = useList('/utilities', { property_id: propertyId });
  if (rows === null) return <Skeleton radius="card" className="h-64 w-full" />;
  const columns = [
    { header: 'Utility', accessor: 'utility_type', sortable: true, renderCell: (r) => <Two top={pretty(r.utility_type)} bottom={r.supplier} /> },
    { header: 'Account Ref', accessor: 'account_ref', renderCell: (r) => r.account_ref || '—' },
    { header: 'Direction', accessor: 'direction', renderCell: (r) => pretty(r.direction) },
    { header: 'Handover', accessor: 'handover_date', sortable: true, renderCell: (r) => shortDate(r.handover_date) },
    { header: 'Meter In / Out', accessor: 'meter_reading_in', renderCell: (r) => `${r.meter_reading_in || '—'} / ${r.meter_reading_out || '—'}` },
    { header: 'Status', accessor: 'status', renderCell: (r) => <Pill tone={r.status === 'completed' ? 'green' : r.status === 'disputed' ? 'red' : 'orange'}>{pretty(r.status)}</Pill> },
  ];
  return (
    <SectionCard title="Utilities & Access" action="Manage utilities" onAction={() => navigate('/utilities')}>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400 font-semibold py-8 text-center">No utility handovers recorded for this property.</p>
      ) : (
        <DataTable columns={columns} data={rows} />
      )}
    </SectionCard>
  );
};

// ── Timeline (design p12): read-only, built from what is recorded ──────────
const EVENT_TYPES = {
  tenancy: { label: 'Tenancy', icon: Users, tone: 'indigo' },
  payment: { label: 'Payment', icon: PoundSterling, tone: 'green' },
  maintenance: { label: 'Maintenance', icon: Wrench, tone: 'orange' },
  inspection: { label: 'Inspection', icon: ClipboardCheck, tone: 'blue' },
  document: { label: 'Document', icon: FileText, tone: 'blue' },
  utility: { label: 'Utility', icon: Zap, tone: 'green' },
};

export const PropertyTimeline = ({ data, documents }) => {
  const payments = useList('/transactions', { property_id: data.id });
  const inspections = useList('/inspections', { property_id: data.id });
  const utilities = useList('/utilities', { property_id: data.id });
  const [type, setType] = useState('');
  if (payments === null || inspections === null || utilities === null) return <Skeleton radius="card" className="h-64 w-full" />;

  const t = data.active_tenancy;
  const events = [
    t && { type: 'tenancy', date: t.start_date, title: 'Tenancy Started', sub: `${(t.tenants || []).map((x) => x.name).join(', ') || 'Tenant'} moved in. Rent ${gbp(t.rent_pcm)} pcm.` },
    t?.deposit?.registered_at && { type: 'tenancy', date: t.deposit.registered_at, title: 'Deposit Registered', sub: `Deposit of ${gbp(t.deposit.tenancy_deposit)} protected.` },
    ...payments.filter((p) => p.type === 'rent_in').map((p) => ({ type: 'payment', date: p.transaction_date, title: 'Rent Payment Received', sub: `${gbp(p.amount)}${p.description ? ` — ${p.description}` : ''}` })),
    ...(data.maintenance_tickets || []).map((m) => ({ type: 'maintenance', date: m.created_at, title: m.status === 'complete' ? 'Maintenance Completed' : 'Maintenance Reported', sub: m.title })),
    ...inspections.map((i) => ({ type: 'inspection', date: i.inspected_at, title: 'Inspection Completed', sub: i.rating ? `Overall condition: ${pretty(i.rating)}.` : 'Inspection recorded.' })),
    ...documents.map((d) => ({ type: 'document', date: d.uploadedAt || d.createdAt || null, dateText: d.date, title: 'Document Added', sub: d.name })),
    ...utilities.filter((u) => u.handover_date).map((u) => ({ type: 'utility', date: u.handover_date, title: `${pretty(u.utility_type)} handover`, sub: `${pretty(u.direction)}${u.supplier ? ` · ${u.supplier}` : ''}` })),
  ].filter(Boolean).filter((e) => e.date || e.dateText)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const shown = events.filter((e) => !type || e.type === type);
  const counts = Object.keys(EVENT_TYPES).map((k) => ({ k, n: events.filter((e) => e.type === k).length }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
      <SectionCard title="Property Timeline" sub="Key events recorded for this property">
        {shown.length === 0 ? (
          <p className="text-xs text-gray-400 font-semibold py-8 text-center">No events recorded yet.</p>
        ) : (
          <div className="flex flex-col">
            {shown.map((e, i) => {
              const meta = EVENT_TYPES[e.type];
              const Icon = meta.icon;
              return (
                <div key={i} className="grid grid-cols-[96px_32px_1fr] gap-3 items-start py-3 border-b border-card-border/60 last:border-0">
                  <span className="text-[11px] font-bold text-brand-primary pt-1.5">{e.date ? shortDate(e.date) : e.dateText}</span>
                  <span className="w-8 h-8 rounded-full bg-brand-accent/10 text-brand-accent flex items-center justify-center"><Icon size={14} /></span>
                  <span className="flex items-start justify-between gap-3 min-w-0">
                    <Two top={e.title} bottom={e.sub} />
                    <Pill tone={meta.tone}>{meta.label}</Pill>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
      <div className="flex flex-col gap-6">
        <SectionCard title="Timeline Filters">
          <Dropdown
            id="timeline-type"
            label="Event Type"
            options={[{ value: '', label: 'All Types' }, ...Object.entries(EVENT_TYPES).map(([value, m]) => ({ value, label: m.label }))]}
            value={type}
            onChange={(v) => setType(v || '')}
            placeholder="All Types"
          />
        </SectionCard>
        <SectionCard title="Timeline Summary">
          <KeyValues rows={[['All Events', String(events.length), null, true], ...counts.map(({ k, n }) => [EVENT_TYPES[k].label, String(n)])]} />
        </SectionCard>
      </div>
    </div>
  );
};

// ── Notes (design p13): one notes field today ───────────────────────────────
export const PropertyNotesTab = ({ data, onEdit }) => (
  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
    <SectionCard title="Notes" sub="Private to ROCA Living, not visible to tenants">
      {data.notes ? (
        <div className="flex items-start gap-3 border border-card-border rounded-card p-4">
          <span className="w-9 h-9 rounded-lg bg-status-warning/10 text-status-warning flex items-center justify-center shrink-0"><Home size={15} /></span>
          <p className="text-xs text-gray-600 font-semibold whitespace-pre-line flex-1">{data.notes}</p>
        </div>
      ) : (
        <p className="text-xs text-gray-400 font-semibold py-8 text-center">No notes yet.</p>
      )}
      <button type="button" onClick={onEdit} className="self-start flex items-center gap-1.5 text-xs font-bold text-brand-primary border border-card-border rounded-lg px-3 py-2 hover:bg-surface-hover cursor-pointer">
        {data.notes ? <Pencil size={13} /> : <Plus size={13} />} {data.notes ? 'Edit Note' : 'Add Note'}
      </button>
    </SectionCard>
    <SectionCard title="Notes Summary">
      <UpcomingList items={[{ key: 'n', title: 'Property note', sub: data.notes ? 'Saved' : 'Empty', badge: data.notes ? '1' : '0' }]} />
      <p className="text-[11px] text-gray-400 font-semibold flex items-center gap-1.5"><Calendar size={12} /> Several dated notes with categories (design p13) need agreement first.</p>
    </SectionCard>
  </div>
);
