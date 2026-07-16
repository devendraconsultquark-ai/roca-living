import { useState, useEffect, useMemo } from 'react';
import { Calendar, Wallet, Clock, Wrench, AlertCircle } from 'lucide-react';
import api from '../utilities/api';
import { useProperties } from './useProperties';
import { useInspections } from './useInspections';
import { useMaintenance } from './useMaintenance';
import { useDocuments } from './useDocuments';
import { useUtilities } from './useUtilities';
import { useRentSchedule } from './useRentSchedule';
import { usePropertyContext } from '../context/PropertyContext';
import { filterByProperty, filterByRelated, statementPropertyId } from '../utilities/propertyFilter';

// ── Pure derivation helpers (unit-testable without React) ───────────────────

const computeCompliance = (properties) => {
  let expiredCertifications = 0;
  let totalCertificationsTracked = 0;
  properties.forEach((p) => {
    ['gasCompliance', 'eicrCompliance', 'epcCompliance'].forEach((key) => {
      if (p[key]) {
        totalCertificationsTracked++;
        if (p[key] === 'expired') expiredCertifications++;
      }
    });
  });
  const overallCompliancePct = totalCertificationsTracked
    ? Math.round(
        ((totalCertificationsTracked - expiredCertifications) /
          totalCertificationsTracked) *
          100,
      )
    : 100;
  return { expiredCertifications, totalCertificationsTracked, overallCompliancePct };
};

const gb = (d) => new Date(d).toLocaleDateString('en-GB');

const buildKeyDates = (activeTenancy, inspections) => {
  const keyDates = [];
  if (activeTenancy?.start_date) {
    keyDates.push({
      title: 'Tenancy Start',
      subTitle: gb(activeTenancy.start_date),
      rightText: 'Active',
      icon: Calendar,
      variant: 'info',
    });
  }
  if (activeTenancy?.end_date) {
    keyDates.push({
      title: 'Tenancy Expiry',
      subTitle: gb(activeTenancy.end_date),
      rightText: 'Expires soon',
      icon: Calendar,
      variant: 'neutral',
    });
  }
  inspections
    .filter((i) => !i.date || i.date === '—')
    .forEach((i) => {
      if (i.next_inspection_due) {
        keyDates.push({
          title: 'Next Inspection',
          subTitle: gb(i.next_inspection_due),
          rightText: 'Scheduled',
          icon: Calendar,
          variant: 'neutral',
        });
      }
    });
  return keyDates;
};

const buildActivities = (latestStatement, inspections, documents, utilities) => {
  const activities = [];
  if (latestStatement) {
    activities.push({
      title: 'Payout Disbursed',
      subTitle: `£${parseFloat(latestStatement.net_paid).toLocaleString(undefined, { minimumFractionDigits: 2 })} payout processed`,
      date: latestStatement.period_start ? gb(latestStatement.period_start) : '—',
      icon: Wallet,
      variant: 'success',
    });
  }
  inspections
    .filter((i) => i.date && i.date !== '—')
    .slice(0, 2)
    .forEach((i) => {
      activities.push({
        title: 'Inspection Completed',
        subTitle: `Routine inspection completed by ${i.inspector}`,
        date: i.date,
        icon: Calendar,
        variant: 'neutral',
      });
    });
  if (documents) {
    documents.slice(0, 2).forEach((d) => {
      activities.push({
        title: 'Document Uploaded',
        subTitle: d.item,
        date: d.uploaded,
        icon: Clock,
        variant: 'info',
      });
    });
  }
  if (utilities) {
    utilities.slice(0, 2).forEach((u) => {
      activities.push({
        title: 'Utility Logged',
        subTitle: `${u.utility_type?.replace('_', ' ') || 'Utility'} record created for ${u.property_name || 'property'}`,
        date: u.created_at ? gb(u.created_at) : '—',
        icon: Wrench,
        variant: 'neutral',
      });
    });
  }
  return activities;
};

// Alerts carry a `route` string (not an onClick) so this stays router-free and
// testable; the page wires route -> navigate().
const buildAlerts = ({ expiredCertifications, inspections, quotes, activeTenancy }) => {
  const alerts = [];

  // 1. Safety certificate expired (only when there are expiries)
  if (expiredCertifications > 0) {
    alerts.push({
      title: 'Safety Certificate Expired',
      detail: `${expiredCertifications} action required safety documents expired`,
      subText: 'Compliance warning',
      variant: 'danger',
      icon: AlertCircle,
      route: '/compliance/overview',
      subTextColor: 'text-status-danger',
    });
  }

  // 2. Inspection due / overdue (always visible)
  const overdueInspections = inspections.filter((i) => {
    const hasBeenCompleted = i.date && i.date !== '—';
    if (hasBeenCompleted) return false;
    if (!i.next_inspection_due) return false;
    return new Date(i.next_inspection_due) < new Date();
  });
  const upcomingInspections = inspections.filter((i) => {
    const hasBeenCompleted = i.date && i.date !== '—';
    return !hasBeenCompleted && i.next_inspection_due;
  });

  if (overdueInspections.length > 0) {
    alerts.push({
      title: 'Inspection Overdue',
      detail: `${overdueInspections.length} inspection(s) past due date`,
      subText: overdueInspections[0].next_inspection_due
        ? gb(overdueInspections[0].next_inspection_due)
        : '—',
      variant: 'danger',
      icon: Calendar,
      route: '/compliance/inspections',
      subTextColor: 'text-status-danger',
    });
  } else if (upcomingInspections.length > 0) {
    alerts.push({
      title: 'Inspection Due',
      detail: 'Routine inspection is due',
      subText: upcomingInspections[0].next_inspection_due
        ? gb(upcomingInspections[0].next_inspection_due)
        : '—',
      variant: 'warning',
      icon: Calendar,
      route: '/compliance/inspections',
      subTextColor: 'text-status-info',
    });
  } else {
    alerts.push({
      title: 'Inspection Due',
      detail: 'No inspections scheduled',
      subText: '—',
      variant: 'neutral',
      icon: Calendar,
      route: '/compliance/inspections',
      subTextColor: 'text-gray-400',
    });
  }

  // 3. Maintenance approval required (always visible)
  if (quotes && quotes.length > 0) {
    alerts.push({
      title: 'Maintenance Approval Required',
      detail: quotes[0].description || 'Pending maintenance quote',
      subText: `£${quotes[0].cost.toFixed(2)}`,
      variant: 'warning',
      icon: Wrench,
      route: '/maintenance',
      hasAction: true,
      actionText: 'Review',
      subTextColor: 'text-brand-primary font-bold',
    });
  } else {
    alerts.push({
      title: 'Maintenance Approval Required',
      detail: 'No maintenance quotes awaiting approval',
      subText: '£0.00',
      variant: 'neutral',
      icon: Wrench,
      route: '/maintenance',
      hasAction: false,
      subTextColor: 'text-gray-400',
    });
  }

  // 4. Rent review due (always visible)
  if (activeTenancy && activeTenancy.start_date) {
    const startDate = new Date(activeTenancy.start_date);
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    const nextReviewDate = new Date(startDate);
    nextReviewDate.setFullYear(nextReviewDate.getFullYear() + 1);

    if (startDate < oneYearAgo) {
      alerts.push({
        title: 'Rent Review Due',
        detail: 'Tenancy active over a year. Rent review recommended.',
        subText: gb(nextReviewDate),
        variant: 'warning',
        icon: Clock,
        route: '/properties',
        subTextColor: 'text-status-info',
      });
    } else {
      alerts.push({
        title: 'Rent Review Due',
        detail: 'Rent review is due in 6 months',
        subText: gb(nextReviewDate),
        variant: 'neutral',
        icon: Clock,
        route: '/properties',
        subTextColor: 'text-status-info',
      });
    }
  } else {
    alerts.push({
      title: 'Rent Review Due',
      detail: 'Rent review up to date',
      subText: '—',
      variant: 'neutral',
      icon: Clock,
      route: '/properties',
      subTextColor: 'text-gray-400',
    });
  }

  return alerts;
};

// ── Hook ────────────────────────────────────────────────────────────────────

export const useDashboard = () => {
  const { selectedProperty } = usePropertyContext();
  const [statementsList, setStatementsList] = useState([]);
  const [tenanciesList, setTenanciesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const stmtRes = await api.get('/statements/my');
        setStatementsList(stmtRes.data.data || []);

        const tenancyRes = await api.get('/tenancies/my');
        setTenanciesList(tenancyRes.data.data || []);

        setError(null);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Supporting datasets for the page (previously fetched in the component).
  const { properties, loading: propertiesLoading } = useProperties();
  const { inspections, loading: inspectionsLoading } = useInspections();
  const { quotes } = useMaintenance();
  const { documents } = useDocuments();
  const { utilities } = useUtilities();
  const { schedules } = useRentSchedule();

  // Scope every dataset to the globally-selected property (no-op for "All").
  const scopedStatements = useMemo(
    () => filterByProperty(statementsList, selectedProperty, statementPropertyId),
    [statementsList, selectedProperty],
  );
  const scopedTenancies = useMemo(
    () => filterByProperty(tenanciesList, selectedProperty),
    [tenanciesList, selectedProperty],
  );
  const scopedProperties = useMemo(
    () => filterByProperty(properties, selectedProperty, (p) => p.id),
    [properties, selectedProperty],
  );
  const scopedInspections = useMemo(
    () => filterByProperty(inspections, selectedProperty),
    [inspections, selectedProperty],
  );
  const scopedDocuments = useMemo(
    () => filterByRelated(documents || [], selectedProperty),
    [documents, selectedProperty],
  );
  const scopedUtilities = useMemo(
    () => filterByProperty(utilities || [], selectedProperty),
    [utilities, selectedProperty],
  );
  const scopedQuotes = useMemo(
    () => filterByProperty(quotes || [], selectedProperty),
    [quotes, selectedProperty],
  );
  const scopedSchedules = useMemo(
    () => filterByProperty(schedules || [], selectedProperty),
    [schedules, selectedProperty],
  );

  const latestStatement = scopedStatements[0] || null;
  const activeTenancy = scopedTenancies[0] || null;

  // Financial figures derived from the latest statement & tenancy.
  const rentReceived = latestStatement ? parseFloat(latestStatement.gross_rent || 0) : 0.0;
  const netIncome = latestStatement ? parseFloat(latestStatement.net_paid || 0) : 0.0;
  const totalFees = latestStatement
    ? parseFloat(latestStatement.mgmt_fee || 0) +
      parseFloat(latestStatement.mgmt_fee_vat || 0) +
      parseFloat(latestStatement.roca_letting_fee || 0) +
      parseFloat(latestStatement.agent_letting_fee || 0)
    : 0.0;
  const deductions = latestStatement ? parseFloat(latestStatement.deductions || 0) + parseFloat(latestStatement.nrl_withheld || 0) : 0.0;
  const expenditure = totalFees + deductions;

  const hasActiveTenancy = !!activeTenancy;
  const occupancyPct = hasActiveTenancy ? '100%' : '0%';
  const occupancyLabel = hasActiveTenancy ? 'Occupied' : 'Vacant';

  const outerValue = rentReceived > 0 ? rentReceived : 0.01;
  const innerValue = hasActiveTenancy ? 100 : 0.01;
  const outerData = [{ name: 'Rent Received', value: outerValue, color: '#3A7D44' }];
  const innerData = [{ name: 'Occupied', value: innerValue, color: '#E8A020' }];

  const rentPcm = activeTenancy ? parseFloat(activeTenancy.rent_pcm || 0) : 0.0;

  // Real arrears from the rent schedule (overdue rows), not inferred from the
  // latest statement — and days in arrears counted from the oldest overdue
  // due date instead of a placeholder.
  const overdueSchedules = useMemo(
    () => scopedSchedules.filter((s) => s.status === 'overdue'),
    [scopedSchedules],
  );
  const rentArrears = overdueSchedules.reduce(
    (sum, s) => sum + parseFloat(s.amount || 0),
    0,
  );
  const daysInArrears = overdueSchedules.length
    ? Math.max(
        0,
        Math.ceil(
          (new Date() - new Date(overdueSchedules[0].due_date)) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : 0;
  const arrearsStatus = rentArrears > 0 ? 'arrears' : 'compliant';
  const customArrearsLabel = rentArrears > 0 ? 'Payment Overdue' : 'Up to Date';

  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  // Heavier list/aggregate derivations — memoised so they don't re-run on every
  // render (e.g. when the period dropdown changes).
  const { expiredCertifications, overallCompliancePct } = useMemo(
    () => computeCompliance(scopedProperties),
    [scopedProperties],
  );

  const keyDates = useMemo(
    () => buildKeyDates(activeTenancy, scopedInspections),
    [activeTenancy, scopedInspections],
  );

  const activities = useMemo(
    () =>
      buildActivities(
        latestStatement,
        scopedInspections,
        scopedDocuments,
        scopedUtilities,
      ),
    [latestStatement, scopedInspections, scopedDocuments, scopedUtilities],
  );

  const alertsList = useMemo(
    () =>
      buildAlerts({
        expiredCertifications,
        inspections: scopedInspections,
        quotes: scopedQuotes,
        activeTenancy,
      }),
    [expiredCertifications, scopedInspections, scopedQuotes, activeTenancy],
  );

  const activeAlertsCount = useMemo(
    () => alertsList.filter((a) => a.variant !== 'neutral').length,
    [alertsList],
  );

  return {
    // raw data
    latestStatement,
    activeTenancy,
    properties: scopedProperties,
    error,
    loading: loading || propertiesLoading || inspectionsLoading,
    // financial figures
    rentReceived,
    netIncome,
    totalFees,
    deductions,
    expenditure,
    // occupancy / gauge (retained for existing consumers)
    hasActiveTenancy,
    occupancyPct,
    occupancyLabel,
    outerData,
    innerData,
    rentPcm,
    rentArrears,
    daysInArrears,
    arrearsStatus,
    customArrearsLabel,
    prefersReducedMotion,
    // compliance + view-model lists
    expiredCertifications,
    overallCompliancePct,
    keyDates,
    activities,
    alertsList,
    activeAlertsCount,
  };
};
