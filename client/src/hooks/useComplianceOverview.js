import { useMemo } from 'react';
import { ShieldCheck, FileText, User, Wallet } from 'lucide-react';
import { useProperties } from './useProperties';
import { useTenancy } from './useTenancy';
import { useDocuments } from './useDocuments';

// ── Pure derivation helpers (unit-testable without React) ───────────────────

const gb = (d) => new Date(d).toLocaleDateString('en-GB');

const buildCertificates = (documents) => {
  let expiredCertifications = 0;
  let totalCertificationsTracked = 0;
  const essentialCertificates = [];
  const propertyManagement = [];

  if (documents) {
    documents
      .filter((doc) => doc.category === 'Compliance' || doc.category === 'Certificates')
      .forEach((doc) => {
        totalCertificationsTracked++;
        const isExpired = doc.status === 'Expired';
        if (isExpired) expiredCertifications++;

        const certData = {
          item: doc.item || 'Certificate',
          status: isExpired ? 'Expired' : 'Valid',
          nextDue: '—',
          subtext: isExpired ? 'Action required' : 'Active',
          subtextColor: isExpired ? 'text-status-danger' : 'text-gray-400',
          action: 'View Certificate',
          icon: doc.item?.includes('EPC') ? FileText : ShieldCheck,
          color: isExpired
            ? 'bg-red-50 text-red-500'
            : 'bg-status-success-bg text-status-success',
          property: doc.related?.length > 0 ? doc.related[0] : '—',
        };

        if (doc.item?.includes('EPC')) {
          propertyManagement.push(certData);
        } else {
          essentialCertificates.push(certData);
        }
      });
  }

  return { expiredCertifications, totalCertificationsTracked, essentialCertificates, propertyManagement };
};

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
  // derives compliance from documents + tenancies, not the property list).
  const { loading: propertiesLoading, error } = useProperties();
  const { tenancies, loading: tenancyLoading } = useTenancy();
  const { documents, loading: documentsLoading } = useDocuments();

  const loading = propertiesLoading || tenancyLoading || documentsLoading;

  const {
    expiredCertifications,
    totalCertificationsTracked,
    essentialCertificates,
    propertyManagement,
  } = useMemo(() => buildCertificates(documents), [documents]);

  const overallCompliancePct = totalCertificationsTracked
    ? Math.round(
        ((totalCertificationsTracked - expiredCertifications) /
          totalCertificationsTracked) *
          100,
      )
    : 100;

  const stats = {
    overall: overallCompliancePct,
    actionRequired: expiredCertifications,
    expiringSoon: 0,
    upToDate: totalCertificationsTracked - expiredCertifications,
    tenantCompliance: 100,
    landlordCompliance: overallCompliancePct,
  };

  const moveInCompliance = useMemo(() => buildMoveInCompliance(tenancies), [tenancies]);
  const ongoingTenantCompliance = useMemo(
    () => buildOngoingTenantCompliance(tenancies),
    [tenancies],
  );

  return {
    loading,
    error,
    stats,
    moveInCompliance,
    ongoingTenantCompliance,
    essentialCertificates,
    propertyManagement,
  };
};
