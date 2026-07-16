import { useMemo } from 'react';
import { useTenancy } from './useTenancy';
import { usePropertyContext } from '../context/PropertyContext';
import { filterByProperty } from '../utilities/propertyFilter';

const DAY_MS = 24 * 60 * 60 * 1000;

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

    const moveOutsCount = scoped.filter(
      (t) => t.status === 'ended' || t.status === 'closed',
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
      };
    });

    // Deposit protection: registration status per tenancy, from the deposit
    // fields now returned by /tenancies/my.
    const deposits = scoped
      .filter((t) => t.deposit_amount != null)
      .map((t) => {
        const isRegistered = !!t.deposit_registered_at || t.deposit_status === 'registered';
        const isOverdue =
          !isRegistered &&
          t.deposit_register_due &&
          new Date(t.deposit_register_due) < new Date();
        return {
          property: t.address_line1 ? `${t.address_line1}, ${t.city}` : `Property #${t.property_id}`,
          tenant: t.lead_tenant_name || '—',
          amount: parseFloat(t.deposit_amount || 0),
          scheme: t.deposit_scheme || '—',
          statusLabel: isRegistered
            ? 'Registered'
            : isOverdue
              ? 'Registration Overdue'
              : 'Pending Registration',
          statusDate: isRegistered
            ? t.deposit_registered_at
              ? new Date(t.deposit_registered_at).toLocaleDateString('en-GB')
              : '—'
            : t.deposit_register_due
              ? `Due ${new Date(t.deposit_register_due).toLocaleDateString('en-GB')}`
              : '—',
          statusColor: isRegistered
            ? 'text-status-success bg-status-success-bg border-status-success/15'
            : isOverdue
              ? 'text-status-danger bg-status-danger/10 border-status-danger/15'
              : 'text-status-warning bg-status-warning/10 border-status-warning/15',
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
    };
  }, [scoped]);

  return { loading, error, ...data };
};
