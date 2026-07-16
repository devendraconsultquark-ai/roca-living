import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { StatCard } from '../components/UI/StatCard';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_STYLES = {
  active: 'bg-status-success/10 text-status-success border-status-success/20',
  pending: 'bg-status-warning/10 text-status-warning border-status-warning/20',
  ended: 'bg-gray-100 text-gray-500 border-gray-200',
};

export const Tenancies = () => {
  const [tenancies, setTenancies] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchTenancies = async () => {
      setLoading(true);
      try {
        const res = await api.get('/tenancies');
        const formatted = (res.data.data || []).map((t) => ({
          id: `TNC-${String(t.id).padStart(4, '0')}`,
          tenant: t.lead_tenant_name || '—',
          landlord: t.landlord_name || '—',
          property: `${t.address_line1 || ''}, ${t.city || ''} ${t.postcode || ''}`.trim(),
          start: t.start_date || '—',
          end: t.end_date || '—',
          rent: parseFloat(t.rent_pcm || 0),
          rawStatus: t.status,
          rawEndDate: t.end_date,
        }));
        setTenancies(formatted);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load tenancies', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchTenancies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const expiringSoon = (t) => {
    if (!t.rawEndDate || t.rawStatus !== 'active') return false;
    const diff = new Date(t.rawEndDate) - new Date();
    return diff > 0 && diff <= 60 * DAY_MS;
  };

  const activeCount = tenancies.filter((t) => t.rawStatus === 'active').length;
  const expiringCount = tenancies.filter(expiringSoon).length;
  const pendingCount = tenancies.filter((t) => t.rawStatus === 'pending').length;

  const columns = [
    { header: 'Tenancy ID', accessor: 'id', sortable: true },
    { header: 'Lead Tenant', accessor: 'tenant', sortable: true },
    { header: 'Landlord', accessor: 'landlord', sortable: true },
    { header: 'Property Address', accessor: 'property', sortable: true },
    { header: 'Start Date', accessor: 'start', sortable: true },
    { header: 'End Date', accessor: 'end', sortable: true },
    {
      header: 'Monthly Rent',
      accessor: 'rent',
      align: 'right',
      sortable: true,
      renderCell: (row) => `£${row.rent.toFixed(2)}`
    },
    {
      header: 'Status',
      accessor: 'rawStatus',
      renderCell: (row) => {
        const isExpiring = expiringSoon(row);
        const label = isExpiring
          ? 'Expiring Soon'
          : row.rawStatus === 'active'
            ? 'Active'
            : row.rawStatus === 'pending'
              ? 'Pending'
              : 'Ended';
        const style = isExpiring
          ? 'bg-status-danger/10 text-status-danger border-status-danger/20'
          : STATUS_STYLES[row.rawStatus] || STATUS_STYLES.ended;
        return (
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${style}`}>
            {label}
          </span>
        );
      }
    },
  ];

  return (
    <div className="py-6 max-w-7xl mx-auto px-4 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Tenancy Agreements</h2>
          <p className="text-sm text-gray-500 mt-1">Review active leases, rental terms, and upcoming expiries. New tenancies are created via the onboarding wizard.</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          label="Active Tenancies"
          value={loading ? '…' : `${activeCount} Contracts`}
          icon={CheckCircle2}
          iconColor="text-status-success bg-status-success/10"
        />
        <StatCard
          label="Expiring In 60 Days"
          value={loading ? '…' : `${expiringCount} Agreements`}
          icon={AlertCircle}
          iconColor="text-status-danger bg-status-danger/10"
          valueColor="text-status-danger"
        />
        <StatCard
          label="Pending"
          value={loading ? '…' : `${pendingCount} Contracts`}
          icon={Clock}
          iconColor="text-status-warning bg-status-warning/10"
          valueColor="text-status-warning"
        />
      </div>

      {/* Grid container */}
      <div className="bg-white rounded-2xl border border-border-color/60 p-4 shadow-sm">
        {loading ? (
          <div className="space-y-4 py-4">
            <div className="h-10 bg-gray-100/80 rounded-lg animate-pulse w-full" />
            <div className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" />
            <div className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" />
            <div className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" />
          </div>
        ) : (
          <DataTable columns={columns} data={tenancies} />
        )}
      </div>
    </div>
  );
};
