import { useState, useEffect } from 'react';
import { useToast } from '../components/UI/ToastContext';
import { downloadBlob } from '../utilities/download';
import api from '../utilities/api';

export const useStatements = () => {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToast } = useToast();

  const fetchStatements = async () => {
    setLoading(true);
    try {
      const response = await api.get('/statements/my');
      const formatted = (response.data.data || []).map((s) => {
        const totalFees = parseFloat(s.mgmt_fee || 0) + 
                          parseFloat(s.mgmt_fee_vat || 0) + 
                          parseFloat(s.roca_letting_fee || 0) + 
                          parseFloat(s.agent_letting_fee || 0);

        const periodStartStr = s.period_start ? new Date(s.period_start).toLocaleDateString('en-GB') : '';
        const periodEndStr = s.period_end ? new Date(s.period_end).toLocaleDateString('en-GB') : '';

        return {
          id: s.id,
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
      setStatements(formatted);
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
      const response = await api.get(`/statements/${id}/pdf`, { responseType: 'blob' });
      const filename = `ROCA_Statement_${period.replace(/\s+/g, '_')}.pdf`;
      downloadBlob(response.data, filename);
      addToast(`Statement PDF downloaded for ${period}`, 'success');
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.message || `Failed to download statement PDF for ${period}`, 'error');
    }
  };

  return {
    statements,
    loading,
    error,
    fetchStatements,
    handleDownloadPDF
  };
};
