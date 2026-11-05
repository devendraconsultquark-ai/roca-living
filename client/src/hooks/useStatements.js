import { useState, useEffect } from 'react';
import { useToast } from '../components/UI/ToastContext';
import { downloadBlob } from '../utilities/download';
import { fetchMyStatements, statementPdfUrl } from '../utilities/myStatements';
import api from '../utilities/api';

// Statement ids are keys (rl-12 / ar-3 / h-5); one PDF route for every kind.
const pdfUrl = (id) => statementPdfUrl(id);

export const useStatements = () => {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToast } = useToast();

  const fetchStatements = async () => {
    setLoading(true);
    try {
      // Every statement (Roca Living, Rent Cycle, Historic) from one list.
      const ukDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '');
      const rows = await fetchMyStatements();
      setStatements(rows.map((r) => ({
        id: r.key,
        historic: r.type === 'historic',
        type: r.type,
        statementNumber: r.statement_number,
        property_id: r.property_id,
        period: `${ukDate(r.period_start)} - ${ukDate(r.period_end)}`,
        date: ukDate(r.issued_on) || '-',
        invoiced: Number(r.rent || 0),
        fees: Number(r.fees || 0),
        payout: Number(r.net || 0),
        status: r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : 'Draft',
        rawStartDate: r.period_start,
        rawEndDate: r.period_end,
        rawGeneratedAt: r.issued_on
      })));
      setError(null);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Error loading statements';
      setError(errMsg);
      addToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatements();
  }, []);

  const handleDownloadPDF = async (id, period) => {
    addToast(`Requesting statement PDF for ${period}...`, 'info');
    try {
      const response = await api.get(pdfUrl(id), { responseType: 'blob' });
      const filename = `ROCA_Statement_${period.replace(/\s+/g, '_')}.pdf`;
      downloadBlob(response.data, filename);
      addToast(`Statement PDF downloaded for ${period}`, 'success');
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.message || `Failed to download statement PDF for ${period}`, 'error');
    }
  };

  // Download every statement in `list` (defaults to all loaded statements) as
  // individual PDFs, with a single start/finish toast instead of one per file.
  const handleDownloadAll = async (list) => {
    const items = list ?? statements;
    if (items.length === 0) {
      addToast('No statements available to download.', 'info');
      return;
    }
    addToast(`Downloading ${items.length} statement PDF${items.length > 1 ? 's' : ''}...`, 'info');
    let downloaded = 0;
    let failed = 0;
    for (const s of items) {
      try {
        const response = await api.get(pdfUrl(s.id), { responseType: 'blob' });
        downloadBlob(response.data, `ROCA_Statement_${String(s.period).replace(/\s+/g, '_')}.pdf`);
        downloaded++;
      } catch (err) {
        console.error(err);
        failed++;
      }
    }
    if (failed === 0) {
      addToast(`Downloaded ${downloaded} statement PDF${downloaded > 1 ? 's' : ''}.`, 'success');
    } else {
      addToast(`Downloaded ${downloaded}; ${failed} failed.`, 'error');
    }
  };

  return {
    statements,
    loading,
    error,
    fetchStatements,
    handleDownloadPDF,
    handleDownloadAll
  };
};
