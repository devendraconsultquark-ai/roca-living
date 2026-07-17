import { useMemo, useState } from 'react';
import { useProperties } from './useProperties';
import { useStatements } from './useStatements';
import { useRentSchedule } from './useRentSchedule';

// Adds the display image while forwarding the joined database attributes.
const enrichProperty = (p) => ({
  ...p,
  image: `${import.meta.env.BASE_URL}images/img1.jpg`,
});

const matchesFilter = (p, activeFilter, arrearsPropertyIds) => {
  switch (activeFilter) {
    case 'Occupied':
      return p.status === 'let';
    case 'Vacant':
      return p.status === 'vacant' || p.status === 'onboarding';
    case 'Compliance Issues':
      return (
        p.compliance_pct < 100 ||
        p.gasCompliance === 'expired' ||
        p.epcCompliance === 'expired' ||
        p.eicrCompliance === 'expired'
      );
    case 'Maintenance Issues':
      return p.maintenance_issues > 0;
    case 'Rent Arrears':
      return arrearsPropertyIds.has(p.id);
    case 'Expiring Compliance':
      return (
        p.gasCompliance === 'expiring_soon' ||
        p.epcCompliance === 'expiring_soon' ||
        p.eicrCompliance === 'expiring_soon'
      );
    default:
      return true;
  }
};

/**
 * Page controller for the Properties list — composes the shared useProperties
 * data hook, owns the filter/search state, and returns the filtered list plus
 * portfolio metrics. (viewMode stays in the component: it's a pure display
 * toggle that doesn't affect the data.)
 */
export const usePropertiesPage = () => {
  const { properties, loading, error, monthlyGrossYield, complianceWarnings } = useProperties();
  const { statements } = useStatements();
  const { schedules } = useRentSchedule();

  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const enrichedProperties = useMemo(() => properties.map(enrichProperty), [properties]);

  // Properties with at least one overdue rent schedule (server marks overdue).
  const arrearsPropertyIds = useMemo(
    () =>
      new Set(
        schedules.filter((s) => s.status === 'overdue').map((s) => s.property_id),
      ),
    [schedules],
  );

  const filteredProperties = useMemo(
    () =>
      enrichedProperties.filter((p) => {
        const matchesSearch = p.address.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;
        return matchesFilter(p, activeFilter, arrearsPropertyIds);
      }),
    [enrichedProperties, searchQuery, activeFilter, arrearsPropertyIds],
  );

  const metrics = useMemo(() => {
    const totalCount = enrichedProperties.length;
    const occupiedCount = enrichedProperties.filter((p) => p.status === 'let').length;
    const vacantCount = totalCount - occupiedCount;
    return {
      totalCount,
      occupiedCount,
      vacantCount,
      occupiedPct: totalCount > 0 ? ((occupiedCount / totalCount) * 100).toFixed(1) : '0',
      vacantPct: totalCount > 0 ? ((vacantCount / totalCount) * 100).toFixed(1) : '0',
      compliancePct:
        totalCount > 0
          ? Math.round(((totalCount - complianceWarnings) / totalCount) * 100)
          : 100,
    };
  }, [enrichedProperties, complianceWarnings]);

  // Portfolio totals from each property's most recent statement.
  const financialSummary = useMemo(() => {
    const latestByProperty = {};
    statements.forEach((s) => {
      if (!s.property_id) return;
      const current = latestByProperty[s.property_id];
      if (
        !current ||
        new Date(s.rawGeneratedAt || 0) > new Date(current.rawGeneratedAt || 0)
      ) {
        latestByProperty[s.property_id] = s;
      }
    });
    const latest = Object.values(latestByProperty);
    return {
      grossInvoiced: latest.reduce((sum, s) => sum + (s.invoiced || 0), 0),
      deductions: latest.reduce((sum, s) => sum + (s.fees || 0), 0),
      netIncome: latest.reduce((sum, s) => sum + (s.payout || 0), 0),
    };
  }, [statements]);

  const complianceSummary = useMemo(() => {
    const compliantCount = enrichedProperties.filter((p) => p.compliance_pct === 100).length;
    const certStatuses = (p) => [p.gasCompliance, p.epcCompliance, p.eicrCompliance];
    return {
      compliantCount,
      compliantPct:
        enrichedProperties.length > 0
          ? Math.round((compliantCount / enrichedProperties.length) * 100)
          : 100,
      expiringCerts: enrichedProperties.reduce(
        (sum, p) => sum + certStatuses(p).filter((s) => s === 'expiring_soon').length,
        0,
      ),
      expiredCerts: enrichedProperties.reduce(
        (sum, p) => sum + certStatuses(p).filter((s) => s === 'expired').length,
        0,
      ),
    };
  }, [enrichedProperties]);

  // Mean elapsed length of the current active tenancies, in months.
  const avgTenancyMonths = useMemo(() => {
    const starts = enrichedProperties
      .map((p) => p.tenancy_start_raw)
      .filter(Boolean);
    if (starts.length === 0) return null;
    const now = new Date();
    const totalMonths = starts.reduce(
      (sum, d) => sum + Math.max(0, (now - new Date(d)) / (1000 * 60 * 60 * 24 * 30.44)),
      0,
    );
    return totalMonths / starts.length;
  }, [enrichedProperties]);

  return {
    loading,
    error,
    monthlyGrossYield,
    filteredProperties,
    activeFilter,
    setActiveFilter,
    searchQuery,
    setSearchQuery,
    financialSummary,
    complianceSummary,
    avgTenancyMonths,
    ...metrics,
  };
};
