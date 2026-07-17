import { useMemo } from 'react';
import { useTenancy } from './useTenancy';
import { usePropertyContext } from '../context/PropertyContext';
import { filterByProperty } from '../utilities/propertyFilter';

const DAY_MS = 24 * 60 * 60 * 1000;

// Display labels for the deposits.status DB enum (matches the admin portal).
const DEPOSIT_STATUS_LABELS = {
  pending_registration: 'Pending Registration',
  registered: 'Registered',
  returned: 'Returned to Tenant',
  disputed: 'In Dispute',
  deducted: 'Deductions Made',
};

const DEPOSIT_STATUS_COLORS = {
  pending_registration: 'text-status-warning bg-status-warning/10 border-status-warning/15',
  registered: 'text-status-success bg-status-success-bg border-status-success/15',
  returned: 'text-status-muted bg-surface-light border-card-border',
  disputed: 'text-status-danger bg-status-danger/10 border-status-danger/15',
  deducted: 'text-status-warning bg-status-warning/10 border-status-warning/15',
};

// The real deposit status, falling back to the registration timestamp for
// older rows that predate the status column.
const depositStatusOf = (t) =>
  t.deposit_status ||
  (t.deposit_registered_at ? 'registered' : 'pending_registration');

/**
 * useTenancyLifecycle — derives the lifecycle statistics (active / move-in /
 * renewal / move-out counts + percentages) and the upcoming-renewals table from
 * the tenancy list (scoped to the globally-selected property), so the page is
 * presentation only.
 */
export const useTenancyLifecycle = () => {
  const { tenancies, loading, error } = useTenancy();
  const { selectedProperty } = usePropertyContext();

  // Scope to the globally-selected property (no-op when "All Properties").
  const scoped = useMemo(
    () => filterByProperty(tenancies, selectedProperty),
    [tenancies, selectedProperty],
  );

  const data = useMemo(() => {
    const totalCount = scoped.length;
    const pct = (n) => (totalCount ? Math.round((n / totalCount) * 100) : 0);

    const activeCount = scoped.filter((t) => t.status === 'active').length;

    // Pending move-ins: status pending, or a start date in the future.
    const pendingMoveInCount = scoped.filter(
      (t) => t.status === 'pending' || (t.start_date && new Date(t.start_date) > new Date()),
    ).length;

    // Upcoming renewals: end date within the next 90 days.
    const renewals = scoped.filter((t) => {
      if (!t.end_date) return false;
      const diff = new Date(t.end_date) - new Date();
      return diff > 0 && diff <= 90 * DAY_MS;
    });
    const renewalsCount = renewals.length;

    // Move-out stage covers tenancies under notice as well as ended ones.
    const moveOutsCount = scoped.filter(
      (t) => t.status === 'ended' || t.status === 'notice',
    ).length;

    const formattedRenewals = renewals.map((t) => {
      const diff = new Date(t.end_date) - new Date();
      const diffDays = Math.ceil(diff / DAY_MS);
      return {
        tenancy: `TEN-${String(t.id).padStart(5, '0')}`,
        property: t.address_line1 ? `${t.address_line1}, ${t.city}` : `Property #${t.property_id}`,
        tenant: t.lead_tenant_name || '—',
        date: t.end_date ? new Date(t.end_date).toLocaleDateString('en-GB') : '—',
        countdown: `In ${diffDays} Days`,
        statusColor: 'text-status-warning bg-status-warning/10 border-status-warning/15',
        rent: t.rent_pcm != null ? parseFloat(t.rent_pcm) : null,
        startDate: t.start_date ? new Date(t.start_date).toLocaleDateString('en-GB') : '—',
        depositStatus: t.deposit_amount != null
          ? DEPOSIT_STATUS_LABELS[depositStatusOf(t)] || depositStatusOf(t)
          : '—',
      };
    });

    // Full tenancy list for the lifecycle table; each row carries its stage
    // flags so the metric cards can filter it.
    const formattedTenancies = scoped.map((t) => {
      const isMoveIn =
        t.status === 'pending' || (t.start_date && new Date(t.start_date) > new Date());
      const endDiff = t.end_date ? new Date(t.end_date) - new Date() : null;
      const isRenewal = endDiff !== null && endDiff > 0 && endDiff <= 90 * DAY_MS;
      const isMoveOut = t.status === 'ended' || t.status === 'notice';
      return {
        ref: `TEN-${String(t.id).padStart(5, '0')}`,
        property: t.address_line1 ? `${t.address_line1}, ${t.city}` : `Property #${t.property_id}`,
        tenant: t.lead_tenant_name || '—',
        start: t.start_date ? new Date(t.start_date).toLocaleDateString('en-GB') : '—',
        end: t.end_date ? new Date(t.end_date).toLocaleDateString('en-GB') : '—',
        status: t.status,
        isActive: t.status === 'active',
        isMoveIn,
        isRenewal,
        isMoveOut,
      };
    });

    // Deposit protection: registration status per tenancy, from the deposit
    // fields now returned by /tenancies/my.
    const deposits = scoped
      .filter((t) => t.deposit_amount != null)
      .map((t) => {
        const depositStatus = depositStatusOf(t);
        const isOverdue =
          depositStatus === 'pending_registration' &&
          t.deposit_register_due &&
          new Date(t.deposit_register_due) < new Date();
        return {
          property: t.address_line1 ? `${t.address_line1}, ${t.city}` : `Property #${t.property_id}`,
          tenant: t.lead_tenant_name || '—',
          amount: parseFloat(t.deposit_amount || 0),
          scheme: t.deposit_scheme || '—',
          statusLabel: isOverdue
            ? 'Registration Overdue'
            : DEPOSIT_STATUS_LABELS[depositStatus] || depositStatus,
          statusDate: depositStatus === 'pending_registration'
            ? t.deposit_register_due
              ? `Due ${new Date(t.deposit_register_due).toLocaleDateString('en-GB')}`
              : '—'
            : t.deposit_registered_at
              ? new Date(t.deposit_registered_at).toLocaleDateString('en-GB')
              : '—',
          statusColor: isOverdue
            ? 'text-status-danger bg-status-danger/10 border-status-danger/15'
            : DEPOSIT_STATUS_COLORS[depositStatus] ||
              DEPOSIT_STATUS_COLORS.pending_registration,
        };
      });

    return {
      deposits,
      totalCount,
      activeCount,
      activePct: pct(activeCount),
      pendingMoveInCount,
      pendingMoveInPct: pct(pendingMoveInCount),
      renewalsCount,
      renewalsPct: pct(renewalsCount),
      moveOutsCount,
      moveOutsPct: pct(moveOutsCount),
      formattedRenewals,
      formattedTenancies,
    };
  }, [scoped]);

  return { loading, error, ...data };
};
