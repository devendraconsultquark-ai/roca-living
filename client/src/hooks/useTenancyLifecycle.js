import { useMemo } from 'react';
import { useTenancy } from './useTenancy';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * useTenancyLifecycle — derives the lifecycle statistics (active / move-in /
 * renewal / move-out counts + percentages) and the upcoming-renewals table from
 * the tenancy list, so the page is presentation only.
 */
export const useTenancyLifecycle = () => {
  const { tenancies, loading, error } = useTenancy();

  const data = useMemo(() => {
    const totalCount = tenancies.length;
    const pct = (n) => (totalCount ? Math.round((n / totalCount) * 100) : 0);

    const activeCount = tenancies.filter((t) => t.status === 'active').length;

    // Pending move-ins: status pending, or a start date in the future.
    const pendingMoveInCount = tenancies.filter(
      (t) => t.status === 'pending' || (t.start_date && new Date(t.start_date) > new Date()),
    ).length;

    // Upcoming renewals: end date within the next 90 days.
    const renewals = tenancies.filter((t) => {
      if (!t.end_date) return false;
      const diff = new Date(t.end_date) - new Date();
      return diff > 0 && diff <= 90 * DAY_MS;
    });
    const renewalsCount = renewals.length;

    const moveOutsCount = tenancies.filter(
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

    return {
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
  }, [tenancies]);

  return { loading, error, ...data };
};
