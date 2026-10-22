import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Clock, AlertTriangle, ClipboardList, CalendarCheck, FileText, Zap, Flame, Bell, Plug, Home, Calendar, BarChart3, Building2 } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Skeleton } from '../components/UI/Skeleton';
import { Dropdown } from '../components/UI/Dropdown';
import { useToast } from '../components/UI/ToastContext';
import { ListTabs, ExportButton } from '../components/UI/ListToolbar';
import {
  PageActions, KpiRow, KpiCard, WithRail, SectionCard, Donut, QuickActions, UpcomingList,
  InfoFooter, Pill, Two, SearchInput,
} from '../components/UI/DesignKit';
import { C, shortDate, pct } from '../utilities/designTokens';
import { DummyBanner } from './mock/MockKit';
import { TenantComplianceMock } from './mock/TenantComplianceMock';
import { TENANT_COMPLIANCE } from '../utilities/plannedPages';
import api from '../utilities/api';
import { downloadCsv } from '../utilities/csv';

// Design p27 (Compliance › Landlord Compliance): certificates of the flats ROCA
// Living manages. The Tenant Compliance tab is still dummy data (p28).
const CERTS = {
  EPC: { label: 'Energy Performance Certificate (EPC)', icon: FileText, frequency: 'Every 10 years' },
  EICR: { label: 'Electrical Installation Condition Report (EICR)', icon: Zap, frequency: 'Every 5 years' },
  GAS: { label: 'Gas Safety Certificate', icon: Flame, frequency: 'Annual' },
  SMOKE_CO: { label: 'Smoke & CO Alarms', icon: Bell, frequency: 'Each tenancy' },
  HMO: { label: 'HMO Licence', icon: Home, frequency: 'Every 5 years' },
  PAT: { label: 'PAT Testing', icon: Plug, frequency: 'Annual' },
};
const certOf = (type) => CERTS[type] || { label: type, icon: ClipboardList, frequency: '—' };

const BUCKETS = {
  compliant: { label: 'Compliant', color: C.green, tone: 'green' },
  due_30: { label: 'Due Soon', color: C.orange, tone: 'orange' },
  due_60: { label: 'Due (60 days)', color: C.amber, tone: 'orange' },
  overdue: { label: 'Overdue', color: C.red, tone: 'red' },
  not_uploaded: { label: 'Not Uploaded', color: C.grey, tone: 'grey' },
};

const bucketOf = (item) => {
  if (item.days_left === null) return 'not_uploaded';
  if (item.days_left < 0) return 'overdue';
  if (item.days_left <= 30) return 'due_30';
  if (item.days_left <= 60) return 'due_60';
  return 'compliant';
};

export const Compliance = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  // Landlord Compliance (certificates) | Tenant Compliance (design p27/p28)
  const [tab, setTab] = useState('landlord');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/reports/compliance-items');
        setItems(res.data.data || []);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load compliance items', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [addToast, reloadKey]);

  const withBucket = items.map((i) => ({ ...i, bucket: bucketOf(i) }));
  const counts = Object.keys(BUCKETS).reduce((acc, key) => ({ ...acc, [key]: withBucket.filter((i) => i.bucket === key).length }), {});
  const total = withBucket.length;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const completedThisMonth = withBucket.filter((i) => i.issued_at && i.issued_at.startsWith(thisMonth)).length;
  const attention = counts.due_30 + counts.overdue + counts.not_uploaded;

  const q = search.trim().toLowerCase();
  const visible = withBucket.filter((i) => (!typeFilter || i.cert_type === typeFilter)
    && (!statusFilter || i.bucket === statusFilter)
    && (!q || [certOf(i.cert_type).label, i.property_name, i.property_address, i.landlord_name].some((v) => String(v || '').toLowerCase().includes(q))));

  const upcoming = withBucket
    .filter((i) => i.days_left !== null && i.days_left <= 90)
    .sort((a, b) => a.days_left - b.days_left)
    .slice(0, 5);

  const exportCsv = () => downloadCsv('compliance.csv', visible, [
    { key: (r) => certOf(r.cert_type).label, label: 'Certificate' },
    { key: (r) => r.property_name || r.property_address, label: 'Property' },
    { key: 'landlord_name', label: 'Landlord' },
    { key: (r) => certOf(r.cert_type).frequency, label: 'Frequency' },
    { key: (r) => shortDate(r.expires_at), label: 'Due Date' },
    { key: (r) => shortDate(r.issued_at), label: 'Last Completed' },
    { key: (r) => BUCKETS[r.bucket]?.label || r.bucket, label: 'Status' },
  ]);

  const columns = [
    {
      header: 'Compliance Item',
      accessor: 'cert_type',
      sortable: true,
      renderCell: (r) => {
        const c = certOf(r.cert_type);
        const Icon = c.icon;
        return (
          <span className="flex items-center gap-3 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-status-success/10 text-status-success flex items-center justify-center shrink-0"><Icon size={15} /></span>
            <Two top={c.label} width="max-w-[210px]" />
          </span>
        );
      },
    },
    {
      header: 'Related To',
      accessor: 'property_name',
      sortable: true,
      renderCell: (r) => <Two top={r.property_name || r.property_address} bottom={r.landlord_name} width="max-w-[190px]" />,
    },
    // Every item is statutory, so no "Compliance Type" column (it said the same on every row)
    { header: 'Frequency', accessor: 'cert_type', renderCell: (r) => <span className="whitespace-nowrap">{certOf(r.cert_type).frequency}</span> },
    {
      header: 'Due Date',
      accessor: 'expires_at',
      sortable: true,
      renderCell: (r) => (r.expires_at ? (
        <Two
          top={shortDate(r.expires_at)}
          bottom={<span className={r.days_left < 0 ? 'text-status-danger' : r.days_left <= 30 ? 'text-status-warning' : ''}>{r.days_left < 0 ? `${r.days_left} days` : `${r.days_left} days`}</span>}
        />
      ) : <span className="text-gray-400">—</span>),
    },
    { header: 'Status', accessor: 'bucket', sortable: true, renderCell: (r) => <Pill tone={BUCKETS[r.bucket].tone}>{BUCKETS[r.bucket].label}</Pill> },
    { header: 'Last Completed', accessor: 'issued_at', sortable: true, renderCell: (r) => shortDate(r.issued_at) },
  ];

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-card-border">
        <ListTabs
          tabs={[
            { id: 'landlord', label: 'Landlord Compliance' },
            { id: 'tenant', label: 'Tenant Compliance' },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'landlord' && (
          <div className="pb-2">
            <PageActions>
              <ExportButton onClick={exportCsv} disabled={loading || !visible.length} />
            </PageActions>
          </div>
        )}
      </div>

      {tab === 'tenant' ? (
        <>
          <DummyBanner related={TENANT_COMPLIANCE.related} />
          <TenantComplianceMock />
        </>
      ) : (
        <>
          <KpiRow>
            <KpiCard icon={ClipboardList} tone="indigo" label="Total Compliance Items" value={total} sub="Across managed properties" link="View all" onClick={() => setStatusFilter('')} loading={loading} />
            <KpiCard icon={ShieldCheck} tone="green" label="Compliant" value={counts.compliant || 0} sub={`${pct(counts.compliant || 0, total)} of total`} link="View compliant" onClick={() => setStatusFilter('compliant')} loading={loading} />
            <KpiCard icon={Clock} tone="orange" label="Due Soon (30 Days)" value={counts.due_30 || 0} sub={`${pct(counts.due_30 || 0, total)} of total`} link="View due soon" onClick={() => setStatusFilter('due_30')} loading={loading} />
            <KpiCard icon={AlertTriangle} tone="red" label="Overdue" value={counts.overdue || 0} sub={`${pct(counts.overdue || 0, total)} of total`} subTone={counts.overdue ? 'red' : undefined} link="View overdue" onClick={() => setStatusFilter('overdue')} loading={loading} />
            <KpiCard icon={CalendarCheck} tone="blue" label="Completed This Month" value={completedThisMonth} sub={counts.not_uploaded ? `${counts.not_uploaded} not uploaded yet` : 'Certificates issued this month'} link={counts.not_uploaded ? 'View not uploaded' : undefined} onClick={() => setStatusFilter('not_uploaded')} loading={loading} />
          </KpiRow>

          <WithRail
            rail={(
              <>
                <SectionCard title="Compliance Overview" action="View full report" to="/reports">
                  <Donut
                    data={Object.entries(BUCKETS).map(([key, b]) => ({ label: b.label, value: counts[key] || 0, color: b.color, display: `${counts[key] || 0} (${pct(counts[key] || 0, total)})` }))}
                    centre={total}
                    sub="Total Items"
                  />
                  {attention > 0 && (
                    <p className="flex items-center gap-2 bg-status-warning/10 text-status-warning rounded-lg px-3 py-2.5 text-[11px] font-bold">
                      <AlertTriangle size={14} className="shrink-0" />
                      {attention} item{attention === 1 ? '' : 's'} require attention
                    </p>
                  )}
                </SectionCard>
                <SectionCard title="Upcoming Compliance" action="View calendar" to="/calendar">
                  <UpcomingList
                    empty="Nothing due in the next 90 days."
                    items={upcoming.map((i) => ({
                      key: i.id,
                      title: certOf(i.cert_type).label,
                      sub: i.property_name || i.property_address,
                      date: shortDate(i.expires_at),
                      badge: i.days_left < 0 ? `${i.days_left} days` : `${i.days_left} days`,
                      badgeTone: i.days_left < 0 ? 'red' : i.days_left <= 30 ? 'orange' : 'grey',
                      to: `/properties/${i.property_id}`,
                    }))}
                  />
                </SectionCard>
                <QuickActions items={[
                  { icon: Building2, label: 'Add Compliance Item', sub: "From a property's Safety & Compliance tab", to: '/properties' },
                  { icon: Calendar, label: 'Compliance Calendar', sub: 'View upcoming and due items', to: '/calendar' },
                  { icon: BarChart3, label: 'Generate Compliance Report', sub: 'Download compliance summary', to: '/reports' },
                ]} />
              </>
            )}
          >
            <SectionCard title="Landlord Compliance Items">
              <div className="flex flex-col md:flex-row md:items-end gap-3 flex-wrap">
                <SearchInput value={search} onChange={setSearch} placeholder="Search item, property or landlord…" className="w-full md:w-72" />
                <div className="w-full md:w-60">
                  <Dropdown
                    id="compliance-type"
                    placeholder="All Compliance Types"
                    clearable
                    options={Object.entries(CERTS).map(([value, c]) => ({ value, label: c.label }))}
                    value={typeFilter}
                    onChange={(v) => setTypeFilter(v || '')}
                  />
                </div>
                <div className="w-full md:w-48">
                  <Dropdown
                    id="compliance-status"
                    placeholder="All Statuses"
                    clearable
                    options={Object.entries(BUCKETS).map(([value, b]) => ({ value, label: b.label }))}
                    value={statusFilter}
                    onChange={(v) => setStatusFilter(v || '')}
                  />
                </div>
              </div>
              {loading ? (
                <Skeleton radius="card" className="h-48 w-full" />
              ) : items.length === 0 ? (
                <p className="text-xs text-gray-400 font-semibold py-10 text-center">
                  No certificates recorded yet — add them from a property’s Safety &amp; Compliance tab.
                </p>
              ) : (
                <DataTable columns={columns} data={visible} onRowClick={(r) => navigate(`/properties/${r.property_id}`)} />
              )}
            </SectionCard>
          </WithRail>

          <InfoFooter text="Certificates for the flats ROCA Living manages. Tenant compliance items are on the Tenant Compliance tab." onRefresh={() => setReloadKey((k) => k + 1)} />
        </>
      )}
    </div>
  );
};
