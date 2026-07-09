import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useDocuments } from './useDocuments';

const PAGE_SIZE = 10;

const buildCertificates = (documents) => {
  const certificatesData = [];
  if (documents) {
    documents
      .filter((doc) => doc.category === 'Certificates' || doc.category === 'Compliance')
      .forEach((doc) => {
        const isExpired = doc.status === 'Expired';
        certificatesData.push({
          item: doc.item || 'Certificate',
          ref: `Ref: ${doc.id}`,
          type: doc.category || 'Safety',
          property: doc.related?.length > 0 ? doc.related[0] : '—',
          issued: doc.uploaded || '—',
          expires: '—', // Backend doesn't support document expiry yet
          countdown: isExpired ? 'Expired' : 'Active',
          countdownColor: isExpired ? 'text-status-danger font-bold' : 'text-status-muted',
          status: isExpired ? 'Expired' : 'Valid',
          action: 'View Certificate',
          icon: ShieldCheck,
          color: isExpired ? 'bg-red-50 text-red-500' : 'bg-status-success-bg text-status-success',
        });
      });
  }
  return certificatesData;
};

/**
 * useCertificates — derives the certificate rows from document records, and
 * owns the pagination. Stats (total / compliant / expired) are derived too so
 * the page is presentation only.
 */
export const useCertificates = () => {
  const { documents, loading, error } = useDocuments();

  const certificatesData = useMemo(() => buildCertificates(documents), [documents]);

  const [currentPage, setCurrentPage] = useState(1);

  // Reset to the first page when the underlying documents change — done during
  // render (React's recommended alternative to a setState-in-useEffect).
  const [prevDocuments, setPrevDocuments] = useState(documents);
  if (prevDocuments !== documents) {
    setPrevDocuments(documents);
    setCurrentPage(1);
  }

  const totalItems = certificatesData.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const paginatedCertificates = useMemo(
    () => certificatesData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [certificatesData, currentPage],
  );

  const compliantCount = certificatesData.filter((c) => c.status === 'Valid').length;
  const expiredCount = certificatesData.filter((c) => c.status === 'Expired').length;

  return {
    loading,
    error,
    certificatesData,
    paginatedCertificates,
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    pageSize: PAGE_SIZE,
    totalCount: totalItems,
    compliantCount,
    expiredCount,
    expiringSoonCount: 0, // Not tracked via static API dates
  };
};
