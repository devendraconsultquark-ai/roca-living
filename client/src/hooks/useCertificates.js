import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { usePropertyContext } from '../context/PropertyContext';
import { filterByProperty } from '../utilities/propertyFilter';
import api from '../utilities/api';

const PAGE_SIZE = 10;

const ALL_PROPERTIES = 'All Properties';
const ALL_TYPES = 'All Types';
const ALL_STATUSES = 'All Statuses';

const CERT_LABELS = {
  GAS: 'Gas Safety Certificate',
  EICR: 'Electrical Installation Condition Report',
  EPC: 'Energy Performance Certificate',
  SMOKE_CO: 'Smoke & CO Alarm Certificate',
  HMO: 'HMO Licence',
  PAT: 'Portable Appliance Test',
};

const STATUS_LABELS = {
  compliant: 'Valid',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
  not_uploaded: 'Not Uploaded',
};

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');

const buildCountdown = (cert) => {
  if (cert.status === 'expired') return { text: 'Expired', color: 'text-status-danger font-bold' };
  if (!cert.expires_at) return { text: '—', color: 'text-status-muted' };
  const days = Math.ceil((new Date(cert.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: 'Expired', color: 'text-status-danger font-bold' };
  return {
    text: `${days} day${days === 1 ? '' : 's'} left`,
    color: days <= 90 ? 'text-status-warning font-bold' : 'text-status-muted',
  };
};

// Rows come from property_certificates via /properties/my/certificates — real
// statuses and expiry dates, not the placeholder document list this page used
// to be derived from.
const buildCertificates = (certs) =>
  (certs || []).map((cert) => {
    const countdown = buildCountdown(cert);
    const status = STATUS_LABELS[cert.status] || cert.status || '—';
    return {
      property_id: cert.property_id,
      item: CERT_LABELS[cert.cert_type] || cert.cert_type,
      ref: `Ref: ${cert.property_reference || cert.id}`,
      type: cert.cert_type,
      property: cert.property_name || cert.address_line1 || '—',
      issued: formatDate(cert.issued_at),
      expires: formatDate(cert.expires_at),
      countdown: countdown.text,
      countdownColor: countdown.color,
      status,
      action: 'View Certificate',
      icon: ShieldCheck,
      color:
        status === 'Expired'
          ? 'bg-red-50 text-red-500'
          : status === 'Expiring Soon'
            ? 'bg-status-warning/10 text-status-warning'
            : status === 'Valid'
              ? 'bg-status-success-bg text-status-success'
              : 'bg-gray-100 text-gray-400',
    };
  });

// Build a select option list from the distinct values actually present in the
// data, prefixed with an "All …" option. Keeps filter dropdowns honest — every
// option maps to at least one row.
const buildOptions = (rows, key, allLabel) => {
  const distinct = [...new Set(rows.map((r) => r[key]).filter((v) => v && v !== '—'))].sort();
  return [{ value: allLabel, label: allLabel }, ...distinct.map((v) => ({ value: v, label: v }))];
};

/**
 * useCertificates — derives the certificate rows from document records, owns the
 * filter state (property / type / status, with options built from the real
 * data) and the pagination. Filtering happens before pagination so page counts
 * stay correct. Stats are derived from the full set so the metric cards always
 * show totals. The page is presentation only.
 */
export const useCertificates = () => {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToast } = useToast();
  const { selectedProperty } = usePropertyContext();

  useEffect(() => {
    const fetchCertificates = async () => {
      setLoading(true);
      try {
        const res = await api.get('/properties/my/certificates');
        setCertificates(res.data.data || []);
        setError(null);
      } catch (err) {
        const errMsg = err.response?.data?.message || 'Error loading certificates';
        setError(errMsg);
        addToast(errMsg, 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchCertificates();
  }, []);

  // Scope to the globally-selected property (no-op when "All Properties").
  const scopedCertificates = useMemo(
    () => filterByProperty(certificates, selectedProperty),
    [certificates, selectedProperty],
  );

  const certificatesData = useMemo(
    () => buildCertificates(scopedCertificates),
    [scopedCertificates],
  );

  // Filter state + options derived from the loaded data
  const [filterProperty, setFilterProperty] = useState(ALL_PROPERTIES);
  const [filterType, setFilterType] = useState(ALL_TYPES);
  const [filterStatus, setFilterStatus] = useState(ALL_STATUSES);

  const propertyOptions = useMemo(
    () => buildOptions(certificatesData, 'property', ALL_PROPERTIES),
    [certificatesData],
  );
  const typeOptions = useMemo(
    () => buildOptions(certificatesData, 'type', ALL_TYPES),
    [certificatesData],
  );
  const statusOptions = useMemo(
    () => buildOptions(certificatesData, 'status', ALL_STATUSES),
    [certificatesData],
  );

  const filteredCertificates = useMemo(
    () =>
      certificatesData.filter((c) => {
        if (filterProperty !== ALL_PROPERTIES && c.property !== filterProperty) return false;
        if (filterType !== ALL_TYPES && c.type !== filterType) return false;
        if (filterStatus !== ALL_STATUSES && c.status !== filterStatus) return false;
        return true;
      }),
    [certificatesData, filterProperty, filterType, filterStatus],
  );

  const [currentPage, setCurrentPage] = useState(1);

  // Reset to the first page when the filters or the underlying data change —
  // done during render (React's recommended alternative to setState-in-effect).
  const [prevReset, setPrevReset] = useState({
    certificatesData,
    filterProperty,
    filterType,
    filterStatus,
  });
  if (
    prevReset.certificatesData !== certificatesData ||
    prevReset.filterProperty !== filterProperty ||
    prevReset.filterType !== filterType ||
    prevReset.filterStatus !== filterStatus
  ) {
    setPrevReset({ certificatesData, filterProperty, filterType, filterStatus });
    setCurrentPage(1);
  }

  const totalItems = filteredCertificates.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const paginatedCertificates = useMemo(
    () => filteredCertificates.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredCertificates, currentPage],
  );

  // Stats reflect the whole data set (metric cards are totals, not filtered).
  const compliantCount = certificatesData.filter((c) => c.status === 'Valid').length;
  const expiredCount = certificatesData.filter((c) => c.status === 'Expired').length;
  const expiringSoonCount = certificatesData.filter((c) => c.status === 'Expiring Soon').length;

  // Metric-card shortcut: reset every filter to its "All …" value.
  const clearFilters = () => {
    setFilterProperty(ALL_PROPERTIES);
    setFilterType(ALL_TYPES);
    setFilterStatus(ALL_STATUSES);
  };

  return {
    loading,
    error,
    certificatesData,
    filteredCertificates,
    paginatedCertificates,
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    pageSize: PAGE_SIZE,
    totalCount: certificatesData.length,
    compliantCount,
    expiredCount,
    expiringSoonCount,
    // Filters
    filterProperty,
    setFilterProperty,
    filterType,
    setFilterType,
    filterStatus,
    setFilterStatus,
    propertyOptions,
    typeOptions,
    statusOptions,
    clearFilters,
  };
};
