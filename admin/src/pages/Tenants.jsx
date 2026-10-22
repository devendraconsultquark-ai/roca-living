import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, CalendarCheck, AlertTriangle, RefreshCcw, Clock, FileText, TrendingUp, MessageSquare } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { Skeleton } from '../components/UI/Skeleton';
import { Dropdown } from '../components/UI/Dropdown';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';
import { AddTenantModal } from '../components/UI/AddTenantModal';
import { EditTenantModal } from '../components/UI/EditTenantModal';
import { ListTabs, ExportButton } from '../components/UI/ListToolbar';
import {
  PageActions, KpiRow, KpiCard, WithRail, SectionCard, Donut, QuickActions, UpcomingList,
  InfoFooter, Pill, PersonCell, Two, SearchInput, RowMenu,
} from '../components/UI/DesignKit';
import { C, gbp, shortDate, daysUntil, pct } from '../utilities/designTokens';
import api from '../utilities/api';
import { downloadCsv } from '../utilities/csv';

const ukDate = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '—');

// Design p14 (Tenants): KPI row, tenant directory, status donut, quick actions.
// Status of a current tenant: arrears first, then notice, else active.
const statusOf = (t) => {
  if (t.tenancy_status === 'ended') return 'moved_out';
  if (t.balance < 0) return 'arrears';
  if (t.tenancy_status === 'notice') return 'notice';
  return 'active';
};
const STATUS = {
  active: { label: 'Active', tone: 'green' },
  arrears: { label: 'Arrears', tone: 'red' },
  notice: { label: 'Notice Given', tone: 'orange' },
  moved_out: { label: 'Moved Out', tone: 'grey' },
};

const monthsBetween = (from, to = new Date()) => {
  if (!from) return null;
  const a = new Date(`${from}T12:00:00`);
  return (to.getFullYear() - a.getFullYear()) * 12 + (to.getMonth() - a.getMonth()) + (to.getDate() - a.getDate()) / 30;
};

export const Tenants = () => {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingTenantId, setEditingTenantId] = useState(null);
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [showAddModal, setShowAddModal] = useState(false);
  const [tab, setTab] = useState('current');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const handleEditClick = (row) => setEditingTenantId(row.rawId);

  const handleDeleteClick = async (row) => {
    const ok = await confirm({
      title: 'Delete Tenant',
      message: `Are you sure you want to delete tenant "${row.name}"? This action cannot be undone.`,
      variant: 'danger',
      confirmText: 'Delete Tenant',
    });
    if (ok) {
      try {
        await api.delete(`/tenancies/tenants/${row.rawId}`);
        addToast('Tenant deleted successfully', 'success');
        fetchTenants();
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to delete tenant', 'error');
      }
    }
  };

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const response = await api.get('/tenancies/tenants/all');
      const data = response.data.data || [];
      setTenants(data.map((t) => ({ ...t, balance: parseFloat(t.balance || 0) })));
      setError(null);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Error loading tenants';
      setError(errMsg);
      addToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  // Current = tenancy active, under notice or pending; Former = tenancy ended
  const current = tenants.filter((t) => t.tenancy_status !== 'ended');
  const former = tenants.filter((t) => t.tenancy_status === 'ended');
  const q = search.trim().toLowerCase();
  const visible = (tab === 'former' ? former : current)
    .filter((t) => !statusFilter || statusOf(t) === statusFilter)
    .filter((t) => !q || [t.name, t.email, t.property, t.property_name, t.id].some((v) => String(v || '').toLowerCase().includes(q)));

  // KPIs (real data only)
  const properties = new Set(current.map((t) => t.property_id)).size;
  const tenancies = new Set(current.map((t) => t.tenancy_id));
  const inArrears = current.filter((t) => t.balance < 0);
  const overdue = inArrears.reduce((s, t) => s + Math.abs(t.balance), 0);
  const ending = current.filter((t) => { const d = daysUntil(t.end_date); return d !== null && d >= 0 && d <= 60; });
  const endingTenancies = new Set(ending.map((t) => t.tenancy_id)).size;
  const tenures = [...new Map(current.map((t) => [t.tenancy_id, t])).values()].map((t) => monthsBetween(t.start_date)).filter((m) => m !== null && m >= 0);
  const avgTenure = tenures.length ? (tenures.reduce((s, m) => s + m, 0) / tenures.length).toFixed(1) : null;

  const counts = { active: 0, notice: 0, arrears: 0 };
  current.forEach((t) => { counts[statusOf(t)] += 1; });
  const donut = [
    { label: 'Active', value: counts.active, color: C.green, display: `${counts.active} (${pct(counts.active, current.length)})` },
    { label: 'Notice Given', value: counts.notice, color: C.amber, display: `${counts.notice} (${pct(counts.notice, current.length)})` },
    { label: 'Arrears', value: counts.arrears, color: C.red, display: `${counts.arrears} (${pct(counts.arrears, current.length)})` },
  ];

  const recent = [...tenants]
    .filter((t) => t.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 3);

  const exportCsv = () => downloadCsv(tab === 'former' ? 'former-tenants.csv' : 'tenants.csv', visible, [
    { key: 'id', label: 'Tenant ID' },
    { key: 'name', label: 'Full Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'property', label: 'Property' },
    { key: (r) => ukDate(r.start_date), label: 'Tenancy Start' },
    { key: (r) => ukDate(r.end_date), label: 'Tenancy End' },
    { key: (r) => (r.rent_pcm != null ? r.rent_pcm.toFixed(2) : ''), label: 'Rent pcm (£)' },
    { key: (r) => r.balance.toFixed(2), label: 'Account Balance (£)' },
    { key: (r) => STATUS[statusOf(r)].label, label: 'Status' },
  ]);

  const columns = [
    {
      header: 'Tenant',
      accessor: 'name',
      sortable: true,
      renderCell: (row) => <PersonCell name={row.name} sub={[row.email, row.phone].find((v) => v && v !== '-')} />,
    },
    {
      header: 'Property',
      accessor: 'property',
      sortable: true,
      renderCell: (row) => <Two top={row.property_name || row.property} bottom={row.postcode} width="max-w-[190px]" />,
    },
    // Start over end in one column (as on Tenancies), so the table fits beside the side column
    { header: 'Tenancy Period', accessor: 'start_date', sortable: true, renderCell: (row) => <Two top={shortDate(row.start_date)} bottom={row.end_date ? `– ${shortDate(row.end_date)}` : '– Periodic'} width="max-w-[120px]" /> },
    { header: 'Rent (PCM)', accessor: 'rent_pcm', align: 'right', sortable: true, renderCell: (row) => (row.rent_pcm != null ? gbp(row.rent_pcm) : '—') },
    {
      header: 'Balance',
      accessor: 'balance',
      align: 'right',
      sortable: true,
      renderCell: (row) => (
        <span className={`whitespace-nowrap ${row.balance < 0 ? 'text-status-danger font-bold' : 'text-status-success font-semibold'}`}>
          {row.balance < 0 ? `-${gbp(Math.abs(row.balance))}` : gbp(row.balance)}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      sortValue: (row) => statusOf(row),
      sortable: true,
      renderCell: (row) => { const s = STATUS[statusOf(row)]; return <Pill tone={s.tone}>{s.label}</Pill>; },
    },
    {
      header: 'Actions',
      accessor: 'id',
      align: 'center',
      // One "…" menu (as on Tenancies) instead of three icons, so the table fits
      renderCell: (row) => (
        <RowMenu
          label={`Actions for ${row.name}`}
          items={[
            { label: 'View details', onClick: () => navigate(`/tenants/${row.rawId}`) },
            { label: 'Edit tenant details', onClick: () => handleEditClick(row) },
            { label: 'Delete tenant', danger: true, onClick: () => handleDeleteClick(row) },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      <PageActions>
        <ExportButton onClick={exportCsv} disabled={loading || !visible.length} />
        <Button variant="accent" icon={UserPlus} onClick={() => setShowAddModal(true)}>Add Tenant</Button>
      </PageActions>

      <KpiRow>
        <KpiCard icon={Users} tone="indigo" label="Total Tenants" value={current.length} sub={`Across ${properties} propert${properties === 1 ? 'y' : 'ies'}`} link="View all tenants" onClick={() => { setTab('current'); setStatusFilter(''); }} loading={loading} />
        <KpiCard icon={CalendarCheck} tone="green" label="Active Tenancies" value={tenancies.size} sub={`${pct(current.filter((t) => t.tenancy_status === 'active').length, current.length)} of tenants`} link="View tenancies" to="/tenancies" loading={loading} />
        <KpiCard icon={AlertTriangle} tone="orange" label="Tenants in Arrears" value={inArrears.length} sub={`Total overdue: ${gbp(overdue)}`} subTone={overdue > 0 ? 'red' : undefined} link="View arrears" to="/arrears" loading={loading} />
        <KpiCard icon={RefreshCcw} tone="blue" label="Renewals Due (60 days)" value={endingTenancies} sub="Upcoming renewals" link="View renewals" to="/renewals" loading={loading} />
        <KpiCard icon={Clock} tone="indigo" label="Average Tenure" value={avgTenure !== null ? `${avgTenure} months` : '—'} sub="Across current tenancies" loading={loading} />
      </KpiRow>

      <WithRail
        rail={(
          <>
            <SectionCard title="Tenancy Status Overview" action="View Report" to="/reports">
              <Donut data={donut} centre={current.length} sub="Total" />
            </SectionCard>
            <QuickActions items={[
              { icon: UserPlus, label: 'Add New Tenant', sub: 'Create a new tenant and tenancy', onClick: () => setShowAddModal(true) },
              { icon: FileText, label: 'Tenancies', sub: 'Dates, rent and deposits', to: '/tenancies' },
              { icon: TrendingUp, label: 'Record Rent Review', sub: 'Schedule or record rent review', to: '/rent-reviews' },
              { icon: MessageSquare, label: 'Tenant Communication', sub: 'Send message or notification', to: '/communications' },
            ]} />
            <SectionCard title="Recent Activity">
              <UpcomingList
                empty="No tenants added yet."
                items={recent.map((t) => ({
                  key: t.rawId,
                  title: `New tenant added: ${t.name}`,
                  sub: t.property_name || t.property,
                  date: shortDate(t.created_at),
                  to: `/tenants/${t.rawId}`,
                }))}
              />
            </SectionCard>
          </>
        )}
      >
        <SectionCard title="Tenant Directory">
          <div className="flex items-end justify-between gap-3 flex-wrap border-b border-card-border">
            <ListTabs
              tabs={[
                { id: 'current', label: 'All Tenants', count: current.length },
                { id: 'former', label: 'Former Tenants', count: former.length },
              ]}
              value={tab}
              onChange={(v) => { setTab(v); setStatusFilter(''); }}
            />
          </div>
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search tenants by name, email or property…" className="w-full md:w-96" />
            {tab === 'current' && (
              <div className="w-full md:w-56">
                <Dropdown
                  id="tenantStatus"
                  options={[
                    { value: '', label: 'All Statuses' },
                    { value: 'active', label: 'Active' },
                    { value: 'notice', label: 'Notice Given' },
                    { value: 'arrears', label: 'Arrears' },
                  ]}
                  value={statusFilter}
                  onChange={(v) => setStatusFilter(v || '')}
                  placeholder="All Statuses"
                />
              </div>
            )}
          </div>
          {loading ? (
            <div className="space-y-4 py-4">
              <Skeleton radius="bar" className="h-10 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : error ? (
            <div className="border border-status-danger bg-status-danger/5 rounded-card p-6 text-center text-status-danger font-semibold">{error}</div>
          ) : (
            <DataTable columns={columns} data={visible} onRowClick={(row) => navigate(`/tenants/${row.rawId}`)} />
          )}
        </SectionCard>
      </WithRail>

      <InfoFooter text="Keep tenant records up to date to ensure accurate reporting and compliance." onRefresh={fetchTenants} />

      {editingTenantId && (
        <EditTenantModal tenantId={editingTenantId} onClose={() => setEditingTenantId(null)} onSaved={fetchTenants} />
      )}
      {showAddModal && (
        <AddTenantModal onClose={() => setShowAddModal(false)} onCreated={fetchTenants} />
      )}
    </div>
  );
};
