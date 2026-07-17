import { useState, useEffect } from 'react';
import { PiggyBank, ShieldCheck, X } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { StatCard } from '../components/UI/StatCard';
import { Input } from '../components/UI/Input';
import { Dropdown } from '../components/UI/Dropdown';
import { useToast } from '../components/UI/ToastContext';
import { Skeleton } from '../components/UI/Skeleton';
import api from '../utilities/api';

export const Deposits = () => {
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const { addToast } = useToast();

  // Register modal state
  const [registerTarget, setRegisterTarget] = useState(null);
  const [registeredAt, setRegisteredAt] = useState('');
  const [prescribedInfoAt, setPrescribedInfoAt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchDeposits = async () => {
      setLoading(true);
      try {
        const res = await api.get('/deposits');
        setDeposits(res.data.data || []);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load deposits', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchDeposits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const openRegisterModal = (row) => {
    setRegisterTarget(row);
    setRegisteredAt(new Date().toISOString().split('T')[0]);
    setPrescribedInfoAt('');
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!registeredAt) {
      addToast('Registration date is required', 'warning');
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch(`/deposits/${registerTarget.id}`, {
        registered_at: registeredAt,
        prescribed_info_served_at: prescribedInfoAt || undefined,
        status: 'registered'
      });
      if (res.data?.warning) {
        addToast(res.data.warning, 'warning');
      }
      addToast('Deposit marked as registered', 'success');
      setRegisterTarget(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update deposit', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (row, newStatus) => {
    try {
      await api.patch(`/deposits/${row.id}`, { status: newStatus });
      addToast(`Deposit ${row.depositRef} marked as ${newStatus}`, 'success');
      setReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update deposit status', 'error');
    }
  };

  const rows = deposits.map((d) => {
    const isRegistered = !!d.registered_at;
    const isOverdue = !isRegistered && d.register_due && new Date(d.register_due) < new Date();
    return {
      id: d.id,
      depositRef: `DEP-${String(d.id).padStart(4, '0')}`,
      tenancyRef: `TNC-${String(d.tenancy_id).padStart(4, '0')}`,
      tenant: d.lead_tenant_name || '—',
      landlord: d.landlord_name || '—',
      property: `${d.address_line1 || ''}, ${d.city || ''}`,
      amount: parseFloat(d.tenancy_deposit || 0),
      received: d.received_at || '—',
      registerDue: d.register_due || '—',
      registeredAt: d.registered_at,
      scheme: d.scheme || '—',
      rawStatus: d.status,
      isRegistered,
      isOverdue,
    };
  });

  const protectedTotal = rows.filter((r) => r.isRegistered).reduce((sum, r) => sum + r.amount, 0);
  const awaitingTotal = rows.filter((r) => !r.isRegistered).reduce((sum, r) => sum + r.amount, 0);

  const columns = [
    { header: 'Deposit ID', accessor: 'depositRef', sortable: true },
    { header: 'Tenancy Ref', accessor: 'tenancyRef', sortable: true },
    { header: 'Lead Tenant', accessor: 'tenant', sortable: true },
    { header: 'Property', accessor: 'property', sortable: true },
    {
      header: 'Amount Held',
      accessor: 'amount',
      align: 'right',
      sortable: true,
      renderCell: (row) => `£${row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    },
    { header: 'Date Received', accessor: 'received', sortable: true },
    { header: 'Scheme', accessor: 'scheme', sortable: true },
    {
      header: 'Protection Status',
      accessor: 'isRegistered',
      renderCell: (row) => {
        const endStates = {
          returned: { label: 'Returned to Tenant', style: 'bg-surface-hover text-gray-400 border-card-border' },
          disputed: { label: 'In Dispute', style: 'bg-status-danger-bg text-status-danger border-status-danger/15' },
          deducted: { label: 'Deductions Made', style: 'bg-status-warning/10 text-status-warning border-status-warning/15' },
        };
        const end = endStates[row.rawStatus];
        if (end) {
          return (
            <span className={`px-2 py-0.5 text-2xs font-bold rounded-sm border ${end.style}`}>
              {end.label}
            </span>
          );
        }
        return (
          <span className={`px-2 py-0.5 text-2xs font-bold rounded-sm border ${
            row.isRegistered
              ? 'bg-status-success-bg text-status-success border-status-success/15'
              : row.isOverdue
                ? 'bg-status-danger-bg text-status-danger border-status-danger/15'
                : 'bg-status-warning/10 text-status-warning border-status-warning/15'
          }`}>
            {row.isRegistered ? `Registered ${row.registeredAt}` : row.isOverdue ? `Overdue (due ${row.registerDue})` : `Due ${row.registerDue}`}
          </span>
        );
      }
    },
    {
      header: 'Action',
      accessor: 'id',
      align: 'center',
      renderCell: (row) => {
        if (!row.isRegistered && row.rawStatus === 'pending_registration') {
          return (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openRegisterModal(row)}
            >
              Mark Registered
            </Button>
          );
        }
        if (row.rawStatus === 'registered') {
          return (
            <Dropdown
              id={`dep-status-${row.id}`}
              size="sm"
              placeholder="Close out…"
              options={[
                { value: 'returned', label: 'Returned to Tenant' },
                { value: 'deducted', label: 'Deductions Made' },
                { value: 'disputed', label: 'In Dispute' },
              ]}
              value=""
              onChange={(val) => handleStatusChange(row, val)}
            />
          );
        }
        if (row.rawStatus === 'disputed') {
          return (
            <Dropdown
              id={`dep-status-${row.id}`}
              size="sm"
              placeholder="Resolve…"
              options={[
                { value: 'returned', label: 'Returned to Tenant' },
                { value: 'deducted', label: 'Deductions Made' },
              ]}
              value=""
              onChange={(val) => handleStatusChange(row, val)}
            />
          );
        }
        return <span className="text-2xs text-gray-400 font-semibold">—</span>;
      }
    },
  ];

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <StatCard
          label="Protected Deposits Held"
          value={loading ? '…' : `£${protectedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          icon={PiggyBank}
          iconColor="text-status-success bg-status-success/10"
          valueColor="text-status-success"
        />
        <StatCard
          label="Awaiting Scheme Protection"
          value={loading ? '…' : `£${awaitingTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          icon={ShieldCheck}
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
          <DataTable columns={columns} data={rows} />
        )}
      </div>

      {/* Mark Registered Modal */}
      {registerTarget && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-card-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-primary">Register Deposit</h3>
              <button onClick={() => setRegisterTarget(null)} className="text-gray-400 hover:text-brand-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-status-muted mb-4 leading-snug">
              Confirm the scheme registration for {registerTarget.depositRef} ({registerTarget.property}) —
              £{registerTarget.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} held under {registerTarget.scheme}.
            </p>

            <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4">
              <Input
                label="Registered On"
                id="dep-registered-at"
                type="date"
                required
                value={registeredAt}
                onChange={(e) => setRegisteredAt(e.target.value)}
              />
              <Input
                label="Prescribed Info Served On (optional)"
                id="dep-pi-at"
                type="date"
                value={prescribedInfoAt}
                onChange={(e) => setPrescribedInfoAt(e.target.value)}
              />

              <div className="flex gap-3 justify-end mt-1">
                <Button type="button" variant="ghost" onClick={() => setRegisterTarget(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Confirm Registration'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
