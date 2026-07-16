import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, FileText, User, Wallet, UserCheck } from 'lucide-react';
import { useProperties } from './useProperties';
import { useTenancy } from './useTenancy';
import { useCertificates } from './useCertificates';
import { usePropertyContext } from '../context/PropertyContext';
import { filterByProperty } from '../utilities/propertyFilter';
import api from '../utilities/api';

// ── Pure derivation helpers (unit-testable without React) ───────────────────

const gb = (d) => new Date(d).toLocaleDateString('en-GB');

// Rows come from useCertificates (real property_certificates statuses/expiry),
// mapped into this page's table shape. EPC sits under "Property & Management".
const splitCertificates = (certificatesData) => {
  const essentialCertificates = [];
  const propertyManagement = [];

  certificatesData.forEach((cert) => {
    const isExpired = cert.status === 'Expired';
    const certData = {
      item: cert.item,
      status: cert.status,
      nextDue: cert.expires,
      subtext: cert.countdown,
      subtextColor: cert.countdownColor,
      action: 'View Certificate',
      icon: cert.type === 'EPC' ? FileText : ShieldCheck,
      color: isExpired ? 'bg-red-50 text-red-500' : cert.color,
      property: cert.property,
      property_id: cert.property_id,
      type: cert.type,
      hasDocument: cert.hasDocument,
    };
    if (cert.type === 'EPC') {
      propertyManagement.push(certData);
    } else {
      essentialCertificates.push(certData);
    }
  });

  return { essentialCertificates, propertyManagement };
};

const CHECKLIST_STATUS_LABELS = {
  complete: 'Complete',
  pending: 'Pending',
  not_applicable: 'N/A',
};

const buildLandlordChecklist = (items) =>
  (items || []).map((item) => ({
    item: item.item_label,
    detail: 'Account requirement',
    status: CHECKLIST_STATUS_LABELS[item.status] || item.status,
    completed: item.verified_at ? gb(item.verified_at) : '—',
    action: 'View Details',
    icon: UserCheck,
    color:
      item.status === 'complete'
        ? 'bg-status-success-bg text-status-success'
        : 'bg-status-warning/10 text-status-warning',
    rawStatus: item.status,
    applicable: item.applicable !== 0,
  }));

const buildMoveInCompliance = (tenancies) =>
  tenancies.map((t) => ({
    item: `Right to Rent: ${t.lead_tenant_name}`,
    detail: t.address_line1 ? `${t.address_line1}, ${t.city}` : '—',
    status: t.status === 'active' ? 'Compliant' : 'Pending',
    completed: t.start_date ? gb(t.start_date) : '—',
    action: 'View Details',
    icon: User,
    color: 'bg-status-info-bg text-status-info',
  }));

const buildOngoingTenantCompliance = (tenancies) =>
  tenancies.map((t) => ({
    item: `Rent Schedule: ${t.lead_tenant_name}`,
    detail: `Monthly rent: £${parseFloat(t.rent_pcm).toLocaleString()}`,
    status: t.status === 'active' ? 'Compliant' : 'Overdue',
    nextDue: t.end_date ? gb(t.end_date) : '—',
    action: 'View Tenancy',
    icon: Wallet,
    color: 'bg-status-success-bg text-status-success',
  }));

// ── Hook ────────────────────────────────────────────────────────────────────

export const useComplianceOverview = () => {
  // properties is fetched only to gate loading / surface its error (the page
  // derives compliance from certificates + tenancies + the landlord checklist).
  const { loading: propertiesLoading, error } = useProperties();
  const { tenancies, loading: tenancyLoading } = useTenancy();
  const { certificatesData, loading: certificatesLoading, handleViewCertificate } = useCertificates();
  const { selectedProperty } = usePropertyContext();

  // Landlord-scope compliance checklist (KYC / ToB / ownership / bank details).
  const [checklistItems, setChecklistItems] = useState([]);
  const [checklistLoading, setChecklistLoading] = useState(true);

  useEffect(() => {
    const fetchChecklist = async () => {
      setChecklistLoading(true);
      try {
        const res = await api.get('/landlords/my/checklist');
        setChecklistItems(res.data.data?.landlord || []);
      } catch (err) {
        console.error(err);
        setChecklistItems([]);
      } finally {
        setChecklistLoading(false);
      }
    };
    fetchChecklist();
  }, []);

  const loading =
    propertiesLoading || tenancyLoading || certificatesLoading || checklistLoading;

  // Scope tenancies to the globally-selected property (certificates arrive
  // already scoped by useCertificates).
  const scopedTenancies = useMemo(
    () => filterByProperty(tenancies, selectedProperty),
    [tenancies, selectedProperty],
  );

  const { essentialCertificates, propertyManagement } = useMemo(
    () => splitCertificates(certificatesData),
    [certificatesData],
  );

  const landlordChecklist = useMemo(
    () => buildLandlordChecklist(checklistItems),
    [checklistItems],
  );

  const moveInCompliance = useMemo(
    () => buildMoveInCompliance(scopedTenancies),
    [scopedTenancies],
  );
  const ongoingTenantCompliance = useMemo(
    () => buildOngoingTenantCompliance(scopedTenancies),
    [scopedTenancies],
  );

  // Certificates that exist (uploaded) are "tracked"; the compliance figure is
  // the share of tracked certificates that are not expired.
  const trackedCerts = certificatesData.filter((c) => c.status !== 'Not Uploaded');
  const expiredCertifications = certificatesData.filter((c) => c.status === 'Expired').length;
  const expiringSoonCount = certificatesData.filter((c) => c.status === 'Expiring Soon').length;

  const certCompliancePct = trackedCerts.length
    ? Math.round(((trackedCerts.length - expiredCertifications) / trackedCerts.length) * 100)
    : 100;

  // Tenant compliance: share of tenant rows currently marked Compliant.
  const tenantRows = [...moveInCompliance, ...ongoingTenantCompliance];
  const tenantCompliancePct = tenantRows.length
    ? Math.round(
        (tenantRows.filter((r) => r.status === 'Compliant').length / tenantRows.length) * 100,
      )
    : 100;

  // Landlord compliance: applicable checklist items completed + tracked
  // certificates not expired, as one combined percentage.
  const applicableChecklist = landlordChecklist.filter(
    (i) => i.applicable && i.rawStatus !== 'not_applicable',
  );
  const checklistComplete = applicableChecklist.filter((i) => i.rawStatus === 'complete').length;
  const landlordDenominator = applicableChecklist.length + trackedCerts.length;
  const landlordCompliancePct = landlordDenominator
    ? Math.round(
        ((checklistComplete + (trackedCerts.length - expiredCertifications)) /
          landlordDenominator) *
          100,
      )
    : 100;

  const pendingChecklistCount = applicableChecklist.length - checklistComplete;

  const stats = {
    overall: certCompliancePct,
    actionRequired: expiredCertifications + pendingChecklistCount,
    expiringSoon: expiringSoonCount,
    upToDate: certificatesData.filter((c) => c.status === 'Valid').length,
    tenantCompliance: tenantCompliancePct,
    landlordCompliance: landlordCompliancePct,
  };

  return {
    loading,
    error,
    stats,
    landlordChecklist,
    moveInCompliance,
    ongoingTenantCompliance,
    essentialCertificates,
    propertyManagement,
    handleViewCertificate,
  };
};
