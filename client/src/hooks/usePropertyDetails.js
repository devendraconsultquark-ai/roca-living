import { useState, useEffect, useMemo } from 'react';
import { Wallet, Calendar, Wrench, Clock } from 'lucide-react';
import api from '../utilities/api';
import { usePropertyContext } from '../context/PropertyContext';
import { useInspections } from './useInspections';
import { useStatements } from './useStatements';
import { useDocuments } from './useDocuments';
import { useUtilities } from './useUtilities';
import { useCertificates } from './useCertificates';

// ── Pure derivation helpers (unit-testable without React) ───────────────────

const gb = (d) => new Date(d).toLocaleDateString('en-GB');

const computeCompliancePct = (certsList) => {
  const tracked = certsList.filter((c) => ['GAS', 'EPC', 'EICR'].includes(c.cert_type));
  const compliant = tracked.filter((c) => c.status === 'compliant').length;
  return tracked.length > 0 ? Math.round((compliant / tracked.length) * 100) : 100;
};

const buildFinancialSummary = (propStatements) => {
  const latest = propStatements.length > 0 ? propStatements[0] : null;
  return {
    rentReceived: latest ? latest.invoiced : 0,
    managementFees: latest ? latest.fees : 0,
    netPaid: latest ? latest.payout : 0,
    paidDate: latest ? latest.date : '—',
    deductions: latest
      ? parseFloat(latest.invoiced) - parseFloat(latest.fees) - parseFloat(latest.payout)
      : 0,
  };
};

const filterPropInspections = (inspections, address, addressLine1) =>
  inspections.filter(
    (i) =>
      String(i.property) === String(address) ||
      String(i.property).includes(addressLine1),
  );

// NOTE: preserves the original behaviour exactly — if there are no statement/
// inspection/maintenance activities the feed is empty even when documents or
// utilities exist (those are only appended once the core list is non-empty).
const buildActivities = ({ propStatements, propInspections, propTickets, documents, utilities, address, property }) => {
  const activities = [];

  propStatements.slice(0, 2).forEach((s) => {
    activities.push({
      title: 'Payout Disbursed',
      subTitle: `£${s.payout.toLocaleString(undefined, { minimumFractionDigits: 2 })} payout processed`,
      date: s.date,
      icon: Wallet,
      color: 'bg-status-success-bg text-status-success',
    });
  });

  propInspections
    .filter((i) => i.status === 'Completed')
    .slice(0, 2)
    .forEach((i) => {
      activities.push({
        title: 'Inspection Completed',
        subTitle: `Routine review completed by ${i.inspector}`,
        date: i.date,
        icon: Calendar,
        color: 'bg-purple-50 text-purple-600',
      });
    });

  propTickets
    .filter((t) => t.status === 'complete')
    .slice(0, 2)
    .forEach((t) => {
      activities.push({
        title: 'Maintenance Completed',
        subTitle: t.title || 'Shower repair',
        date: t.updated_at ? gb(t.updated_at) : '—',
        icon: Wrench,
        color: 'bg-status-success-bg text-status-success',
      });
    });

  activities.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (activities.length === 0) return [];

  if (documents) {
    const propDocs = documents.filter(
      (d) => d.related?.includes(String(address)) || d.related?.includes(property.address_line1),
    );
    propDocs.slice(0, 2).forEach((d) => {
      activities.push({
        title: 'Document Uploaded',
        subTitle: d.item,
        date: d.uploaded,
        icon: Clock,
        color: 'bg-blue-50 text-blue-600',
      });
    });
  }

  if (utilities) {
    const propUtils = utilities.filter((u) => u.property_id === property.id);
    propUtils.slice(0, 2).forEach((u) => {
      activities.push({
        title: 'Utility Logged',
        subTitle: `${u.utility_type?.replace('_', ' ') || 'Utility'} logged`,
        date: u.created_at ? gb(u.created_at) : '—',
        icon: Wrench,
        color: 'bg-orange-50 text-orange-600',
      });
    });
  }

  return activities.slice(0, 4);
};

// ── Hook (page controller) ──────────────────────────────────────────────────

export const usePropertyDetails = (id) => {
  const { properties, setSelectedProperty } = usePropertyContext();

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [propertyError, setPropertyError] = useState(null);

  useEffect(() => {
    const fetchPropertyDetails = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [propRes, tenancyRes, maintenanceRes] = await Promise.all([
          api.get(`/properties/my/${id}`),
          api.get('/tenancies/my').catch(() => ({ data: { data: [] } })),
          api.get('/maintenance/my').catch(() => ({ data: { data: [] } })),
        ]);

        const pData = propRes.data.data;
        const tenanciesList = tenancyRes.data?.data || [];
        const maintenanceTickets = maintenanceRes.data?.data || [];

        const activeT = tenanciesList.find(
          (t) => String(t.property_id) === String(id) && t.status === 'active',
        );
        const propTickets = maintenanceTickets.filter((t) => String(t.property_id) === String(id));

        setProperty({ ...pData, active_tenancy: activeT || null, maintenance_tickets: propTickets });
        setPropertyError(null);
      } catch (err) {
        console.error('Error fetching property details:', err);
        setPropertyError(err.response?.data?.message || 'Failed to load property details');
      } finally {
        setLoading(false);
      }
    };

    fetchPropertyDetails();
  }, [id]);

  // Keep the global "selected property" in sync while this page is mounted,
  // and clear it on unmount. (Previously two effects in the component.)
  useEffect(() => {
    if (property) {
      const match = properties.find((item) => String(item.id) === String(id)) || property;
      setSelectedProperty(match);
    }
  }, [id, property, properties, setSelectedProperty]);

  useEffect(() => {
    return () => {
      setSelectedProperty('all');
    };
  }, [setSelectedProperty]);

  // Supporting datasets (previously fetched in the component).
  const {
    inspections,
    loading: inspectionsLoading,
    error: inspectionsError,
  } = useInspections();
  const {
    statements,
    loading: statementsLoading,
    error: statementsError,
    handleDownloadPDF: handleDownloadStatementPDF,
  } = useStatements();
  const { documents, handleDownload: handleDownloadDocument } = useDocuments();
  const { utilities } = useUtilities();
  const { certificatesData, handleViewCertificate } = useCertificates();

  const p = useMemo(() => property || {}, [property]);
  const activeT = useMemo(() => p.active_tenancy || null, [p]);
  const propTickets = useMemo(() => p.maintenance_tickets || [], [p]);

  const propStatements = useMemo(
    () => statements.filter((s) => String(s.property_id) === String(id)),
    [statements, id],
  );

  const compliancePct = useMemo(
    () => computeCompliancePct(p.property_certificates || []),
    [p.property_certificates],
  );

  const openIssuesCount = propTickets.filter(
    (t) => t.status !== 'complete' && t.status !== 'cancelled',
  ).length;

  const details = useMemo(
    () => ({
      address: p.address_line1 || 'Property Details',
      subAddress: `${p.city || ''}${p.postcode ? `, ${p.postcode}` : ''}`.trim().replace(/^,/, ''),
      image: `${import.meta.env.BASE_URL}images/img1.jpg`,
      status: p.status || 'vacant',
      propertyType: p.property_type || 'Apartment',
      rent: activeT?.rent_pcm
        ? parseFloat(activeT.rent_pcm)
        : p.rent_pcm
          ? parseFloat(p.rent_pcm)
          : 0,
      deposit: activeT?.deposit_amount ? parseFloat(activeT.deposit_amount) : 0,
      tenantName: activeT?.lead_tenant_name || '-',
      startDate: activeT?.start_date ? gb(activeT.start_date) : '—',
      nextReview: '—', // TODO: backend needs to return next rent review date
      netPaid: propStatements.length > 0 ? propStatements.reduce((sum, s) => sum + (s.payout || 0), 0) : 0,
      maintenanceIssues: openIssuesCount,
      compliancePct,
      tenancy_type: activeT ? 'Assured Shorthold Tenancy' : '—',
    }),
    [p, activeT, propStatements, openIssuesCount, compliancePct],
  );

  const propInspections = useMemo(
    () => filterPropInspections(inspections, details.address, p.address_line1),
    [inspections, details.address, p.address_line1],
  );

  const financialSummary = useMemo(() => buildFinancialSummary(propStatements), [propStatements]);

  const firstOpenTicket = useMemo(
    () => propTickets.find((t) => t.status !== 'complete' && t.status !== 'cancelled'),
    [propTickets],
  );

  const nextInspection = useMemo(
    () => propInspections.find((i) => i.status !== 'Completed'),
    [propInspections],
  );

  const activities = useMemo(
    () =>
      buildActivities({
        propStatements,
        propInspections,
        propTickets,
        documents,
        utilities,
        address: details.address,
        property: p,
      }),
    [propStatements, propInspections, propTickets, documents, utilities, details.address, p],
  );

  // ── Per-tab view models ────────────────────────────────────────────────────

  // Tenant & Tenancy tab — the active tenancy's full record, render-ready.
  const tenancy = useMemo(() => {
    if (!activeT) return null;
    const isRegistered =
      !!activeT.deposit_registered_at || activeT.deposit_status === 'registered';
    return {
      ref: `TEN-${String(activeT.id).padStart(5, '0')}`,
      tenant: activeT.lead_tenant_name || '—',
      start: activeT.start_date ? gb(activeT.start_date) : '—',
      end: activeT.end_date ? gb(activeT.end_date) : 'Periodic / rolling',
      rentPcm: activeT.rent_pcm != null ? parseFloat(activeT.rent_pcm) : null,
      rentFrequency: activeT.rent_frequency || 'monthly',
      deposit: activeT.deposit_amount != null ? parseFloat(activeT.deposit_amount) : null,
      depositScheme: activeT.deposit_scheme || '—',
      depositStatus: isRegistered
        ? 'Registered'
        : activeT.deposit_amount != null
          ? 'Pending Registration'
          : '—',
      depositRegisteredAt: activeT.deposit_registered_at
        ? gb(activeT.deposit_registered_at)
        : '—',
      status: activeT.status,
    };
  }, [activeT]);

  // Compliance tab — this property's certificates (from the shared hook, which
  // also owns the view/download handler).
  const propCertificates = useMemo(
    () => certificatesData.filter((c) => String(c.property_id) === String(id)),
    [certificatesData, id],
  );

  // Utilities & Access tab.
  const propUtilities = useMemo(
    () => (utilities || []).filter((u) => String(u.property_id) === String(id)),
    [utilities, id],
  );

  // Documents tab — documents reference properties via their `related` label
  // (a display string like "Apartment 9, Parsons House" or "Tenancy at …").
  const propDocuments = useMemo(() => {
    const keys = [p.property_reference, p.name, p.address_line1].filter(Boolean);
    return (documents || []).filter((d) => {
      const rel = d.related || '';
      return keys.some((k) => rel.includes(k));
    });
  }, [documents, p]);

  return {
    loading: loading || inspectionsLoading || statementsLoading,
    error: propertyError || inspectionsError || statementsError,
    details,
    hasActiveTenancy: !!activeT,
    financialSummary,
    firstOpenTicket,
    nextInspection,
    activities,
    // tab content + handlers
    tenancy,
    propStatements,
    propTickets,
    propInspections,
    propCertificates,
    propUtilities,
    propDocuments,
    handleDownloadStatementPDF,
    handleDownloadDocument,
    handleViewCertificate,
  };
};
