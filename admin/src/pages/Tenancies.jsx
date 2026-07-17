import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, AlertCircle, X } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { StatCard } from '../components/UI/StatCard';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';
import { Skeleton } from '../components/UI/Skeleton';
import api from '../utilities/api';

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_STYLES = {
  active: 'bg-status-success-bg text-status-success border-status-success/15',
  pending: 'bg-status-warning/10 text-status-warning border-status-warning/15',
  notice: 'bg-status-info-bg text-status-info border-status-info/15',
  ended: 'bg-surface-hover text-gray-400 border-card-border',
};

const STATUS_LABELS = {
  active: 'Active',
  pending: 'Pending',
  notice: 'Notice Served',
  ended: 'Ended',
};

export const Tenancies = () => {
  const [tenancies, setTenancies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const { addToast } = useToast();
  const confirm = useConfirm();

  // End-tenancy modal state
  const [endTarget, setEndTarget] = useState(null);
  const [endDate, setEndDate] = useState('');
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    const fetchTenancies = async () => {
      setLoading(true);
      try {
        const res = await api.get('/tenancies');
        const formatted = (res.data.data || []).map((t) => ({
          rawId: t.id,
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
  }, [reloadKey]);

  const patchTenancy = async (row, payload, successMsg) => {
    try {
      await api.patch(`/tenancies/${row.rawId}`, payload);
      addToast(successMsg, 'success');
      setReloadKey((k) => k + 1);
      return true;
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update tenancy', 'error');
      return false;
    }
  };

  const handleActivate = async (row) => {
    await patchTenancy(row, { status: 'active' }, `${row.id} activated`);
  };

  const handleServeNotice = async (row) => {
    const ok = await confirm({
      title: 'Serve Notice',
      message: `Mark ${row.id} (${row.tenant}) as under notice? The tenancy stays live until it is ended.`,
      confirmText: 'Serve Notice',
    });
    if (ok) await patchTenancy(row, { status: 'notice' }, `Notice recorded for ${row.id}`);
  };

  const handleRescindNotice = async (row) => {
    await patchTenancy(row, { status: 'active' }, `Notice rescinded for ${row.id}`);
  };

  const openEndModal = (row) => {
    setEndTarget(row);
    setEndDate(new Date().toISOString().split('T')[0]);
  };

  const handleEndSubmit = async (e) => {
    e.preventDefault();
    if (!endDate) {
      addToast('End date is required', 'warning');
      return;
    }
    setEnding(true);
    const ok = await patchTenancy(
      endTarget,
      { status: 'ended', end_date: endDate },
      `${endTarget.id} ended — future unpaid rent schedules removed`
    );
    setEnding(false);
    if (ok) setEndTarget(null);
  };

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
        const label = isExpiring ? 'Expiring Soon' : (STATUS_LABELS[row.rawStatus] || 'Ended');
        const style = isExpiring
          ? 'bg-status-danger-bg text-status-danger border-status-danger/15'
          : STATUS_STYLES[row.rawStatus] || STATUS_STYLES.ended;
        return (
          <span className={`px-2 py-0.5 text-2xs font-bold rounded-sm border ${style}`}>
            {label}
          </span>
        );
      }
    },
    {
      header: 'Actions',
      accessor: 'rawId',
      renderCell: (row) => (
        <div className="flex items-center gap-1">
          {row.rawStatus === 'pending' && (
            <Button variant="ghost" size="sm" onClick={() => handleActivate(row)}>
              Activate
            </Button>
          )}
          {row.rawStatus === 'active' && (
            <Button variant="ghost" size="sm" onClick={() => handleServeNotice(row)}>
              Serve Notice
            </Button>
          )}
          {row.rawStatus === 'notice' && (
            <Button variant="ghost" size="sm" onClick={() => handleRescindNotice(row)}>
              Rescind Notice
            </Button>
          )}
          {(row.rawStatus === 'active' || row.rawStatus === 'notice') && (
            <Button variant="ghost" size="sm" className="text-status-danger" onClick={() => openEndModal(row)}>
              End Tenancy
            </Button>
          )}
        </div>
      )
    },
  ];

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
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
      <div className="card-bg border border-card-border rounded-card shadow-premium p-4">
        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton radius="bar" className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <DataTable columns={columns} data={tenancies} />
        )}
      </div>

      {/* End Tenancy Modal */}
      {endTarget && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-card-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-primary">End Tenancy</h3>
              <button onClick={() => setEndTarget(null)} className="text-gray-400 hover:text-brand-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-status-muted mb-4 leading-snug">
              End {endTarget.id} ({endTarget.tenant} at {endTarget.property})? Unpaid rent schedules
              after the end date will be removed and the property will be marked vacant if no other
              live tenancy remains. This cannot be undone.
            </p>

            <form onSubmit={handleEndSubmit} className="flex flex-col gap-4">
              <Input
                label="Tenancy End Date"
                id="tnc-end-date"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />

              <div className="flex gap-3 justify-end mt-1">
                <Button type="button" variant="ghost" onClick={() => setEndTarget(null)} disabled={ending}>
                  Cancel
                </Button>
                <Button type="submit" variant="danger" disabled={ending}>
                  {ending ? 'Ending…' : 'End Tenancy'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
