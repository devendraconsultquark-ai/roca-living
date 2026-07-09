import { useMemo, useState } from 'react';
import { useProperties } from './useProperties';

// Adds the display image while forwarding the joined database attributes.
const enrichProperty = (p) => ({
  ...p,
  image: `${import.meta.env.BASE_URL}images/img1.jpg`,
});

const matchesFilter = (p, activeFilter) => {
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
      return p.status === 'let' && p.id === 999; // Mock: no arrears in active database
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

  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const enrichedProperties = useMemo(() => properties.map(enrichProperty), [properties]);

  const filteredProperties = useMemo(
    () =>
      enrichedProperties.filter((p) => {
        const matchesSearch = p.address.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;
        return matchesFilter(p, activeFilter);
      }),
    [enrichedProperties, searchQuery, activeFilter],
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

  return {
    loading,
    error,
    monthlyGrossYield,
    filteredProperties,
    activeFilter,
    setActiveFilter,
    searchQuery,
    setSearchQuery,
    ...metrics,
  };
};
