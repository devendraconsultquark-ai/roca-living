import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, BadgeCheck, CalendarClock, ShieldCheck, FileCheck } from 'lucide-react';
import { DataTable } from './DataTable';
import { Skeleton } from './Skeleton';
import { useToast } from './ToastContext';
import { KpiRow, KpiCard, SectionCard, Pill, PersonCell, Two, SearchInput } from './DesignKit';
import { shortDate, daysUntil, pct } from '../../utilities/designTokens';
import api from '../../utilities/api';

// Compliance → Tenant Compliance, real data only: for each tenant on a current
// tenancy, Right to Rent (status + expiry on the tenant) and the deposit
// (protected, prescribed information served) from Deposits.
const RTR = {
  verified: { label: 'Verified', tone: 'green' },
  pending: { label: 'Not Checked', tone: 'orange' },
  failed: { label: 'Failed', tone: 'red' },
};

export const TenantComplianceTab = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get('/tenancies/tenants/all', { skipInterceptorError: true }),
      api.get('/deposits', { skipInterceptorError: true }).catch(() => ({ data: { data: [] } })),
    ])
      .then(([pRes, dRes]) => {
        if (!alive) return;
        const deposits = dRes.data.data || [];
        setRows((pRes.data.data || [])
          .filter((p) => ['active', 'notice', 'pending'].includes(p.tenancy_status))
          .map((p) => {
            const dep = deposits.find((d) => d.tenancy_id === p.tenancy_id) || null;
            return {
              id: p.rawId || p.id,
              tenant: p.name || '—',
              email: p.email || null,
              property: p.property_name || p.property || '—',
              rtr: RTR[p.right_to_rent_status] ? p.right_to_rent_status : 'pending',
              rtrExpiry: p.right_to_rent_expiry || null,
              rtrDays: p.right_to_rent_expiry ? daysUntil(p.right_to_rent_expiry) : null,
              deposit: dep,
            };
          }));
      })
      .catch((err) => { if (alive) addToast(err.response?.data?.message || 'Failed to load tenant compliance', 'error'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [addToast]);

  const verified = rows.filter((r) => r.rtr === 'verified');
  const expiring = rows.filter((r) => r.rtrDays !== null && r.rtrDays <= 60);
  const withDeposit = rows.filter((r) => r.deposit);
  const protectedDeps = withDeposit.filter((r) => r.deposit.status === 'registered');
  const piServed = withDeposit.filter((r) => r.deposit.prescribed_info_served_at);
  const q = search.trim().toLowerCase();
  const visible = rows.filter((r) => !q || [r.tenant, r.email, r.property].some((v) => String(v || '').toLowerCase().includes(q)));

  const columns = [
    { header: 'Tenant', accessor: 'tenant', sortable: true, renderCell: (r) => <PersonCell name={r.tenant} sub={r.email} /> },
    { header: 'Property', accessor: 'property', sortable: true },
    {
      header: 'Right to Rent',
      accessor: 'rtr',
      sortable: true,
      renderCell: (r) => (
        <div className="flex flex-col gap-1 items-start">
          <Pill tone={RTR[r.rtr].tone}>{RTR[r.rtr].label}</Pill>
          {r.rtrExpiry && <span className={`text-[11px] font-semibold ${r.rtrDays < 0 ? 'text-status-danger' : r.rtrDays <= 60 ? 'text-status-warning' : 'text-gray-400'}`}>Expires {shortDate(r.rtrExpiry)}</span>}
        </div>
      ),
    },
    {
      header: 'Deposit',
      accessor: 'deposit',
      sortValue: (r) => (r.deposit ? r.deposit.status : 'zz'),
      sortable: true,
      renderCell: (r) => (r.deposit
        ? <Two top={r.deposit.status === 'registered' ? `Protected${r.deposit.scheme ? ` (${r.deposit.scheme})` : ''}` : 'Not Protected Yet'} bottom={r.deposit.registered_at ? `Registered ${shortDate(r.deposit.registered_at)}` : r.deposit.register_due ? `Register by ${shortDate(r.deposit.register_due)}` : null} />
        : <span className="text-gray-400">None recorded</span>),
    },
    {
      header: 'Prescribed Info',
      accessor: 'deposit',
      sortValue: (r) => (r.deposit?.prescribed_info_served_at ? 1 : 0),
      sortable: true,
      renderCell: (r) => (!r.deposit ? '—' : r.deposit.prescribed_info_served_at
        ? <span className="text-status-success font-semibold">Served {shortDate(r.deposit.prescribed_info_served_at)}</span>
        : <span className="text-status-warning font-semibold">Not recorded</span>),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <KpiRow>
        <KpiCard icon={Users} tone="indigo" label="Current Tenants" value={rows.length} sub="On current tenancies" loading={loading} />
        <KpiCard icon={BadgeCheck} tone="green" label="Right to Rent Verified" value={verified.length} sub={`${pct(verified.length, rows.length)} of tenants`} loading={loading} />
        <KpiCard icon={CalendarClock} tone="orange" label="Right to Rent Expiring (60 Days)" value={expiring.length} sub="Recheck before expiry" subTone={expiring.length ? 'red' : undefined} loading={loading} />
        <KpiCard icon={ShieldCheck} tone="blue" label="Deposits Protected" value={`${protectedDeps.length} / ${withDeposit.length}`} sub="Of deposits recorded" loading={loading} />
        <KpiCard icon={FileCheck} tone="indigo" label="Prescribed Info Served" value={`${piServed.length} / ${withDeposit.length}`} sub="Of deposits recorded" loading={loading} />
      </KpiRow>
      <SectionCard>
        <SearchInput value={search} onChange={setSearch} placeholder="Search tenant, property…" className="w-full md:w-96" />
        {loading ? (
          <Skeleton radius="card" className="h-48 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-xs text-gray-400 font-semibold py-10 text-center">No tenants on current tenancies.</p>
        ) : (
          <DataTable columns={columns} data={visible} onRowClick={(r) => navigate(`/tenants/${r.id}`)} />
        )}
      </SectionCard>
    </div>
  );
};
