import { useState, useEffect } from 'react';
import { useToast } from '../components/UI/ToastContext';
import { downloadBlob } from '../utilities/download';
import { statementPropertyId } from '../utilities/propertyFilter';
import api from '../utilities/api';

// Historic statements carry an "h" id (h12 → /historic-statements/12/pdf).
const pdfUrl = (id) => (String(id).startsWith('h') ? `/historic-statements/${String(id).slice(1)}/pdf` : `/statements/${id}/pdf`);

export const useStatements = () => {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToast } = useToast();

  const fetchStatements = async () => {
    setLoading(true);
    try {
      const [response, historicRes] = await Promise.all([
        api.get('/statements/my'),
        // Statements from before Roca Living took over (read-only, same design).
        api.get('/historic-statements/my').catch(() => ({ data: { data: [] } }))
      ]);
      const ukDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '');
      const historic = (historicRes.data?.data || []).map((h) => ({
        id: `h${h.id}`,
        historic: true,
        statementNumber: h.statement_number,
        property_id: h.property_id,
        period: `${ukDate(h.period_start)} - ${ukDate(h.period_end)}`,
        date: ukDate(h.issued_on) || '-',
        invoiced: Number(h.total_income || 0),
        fees: Number(h.total_expenditure || 0),
        payout: Number(h.net_paid || 0),
        status: h.paid_on ? 'Paid' : 'Sent',
        rawStartDate: h.period_start,
        rawEndDate: h.period_end,
        rawGeneratedAt: h.issued_on
      }));
      const formatted = (response.data.data || []).map((s) => {
        // Real money out of the statement: expense deductions + NRL withholding.
        // (The mgmt_fee/letting-fee columns are always 0 in this statement format.)
        const totalFees = parseFloat(s.deductions || 0) + parseFloat(s.nrl_withheld || 0);

        const periodStartStr = s.period_start ? new Date(s.period_start).toLocaleDateString('en-GB') : '';
        const periodEndStr = s.period_end ? new Date(s.period_end).toLocaleDateString('en-GB') : '';

        return {
          id: s.id,
          // Resolve the local property id from the statement's cross-source
          // reference (local-source only); enables per-property scoping.
          property_id: statementPropertyId(s),
          period: `${periodStartStr} - ${periodEndStr}`,
          date: s.generated_at ? new Date(s.generated_at).toLocaleDateString('en-GB') : '-',
          invoiced: parseFloat(s.gross_rent || 0),
          fees: totalFees,
          payout: parseFloat(s.net_paid || 0),
          status: s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : 'Draft',
          rawStartDate: s.period_start,
          rawEndDate: s.period_end,
          rawGeneratedAt: s.generated_at
        };
      });
      // Newest period first; historic ones sit with the rest by their period.
      setStatements([...formatted, ...historic].sort((a, b) => String(b.rawStartDate || '').localeCompare(String(a.rawStartDate || ''))));
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
