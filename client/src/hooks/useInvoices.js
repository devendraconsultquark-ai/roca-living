import { useState, useEffect } from 'react';
import { useToast } from '../components/UI/ToastContext';
import { downloadBlob } from '../utilities/download';
import api from '../utilities/api';

/**
 * useInvoices — fetches the landlord's own invoices (the API scopes
 * GET /invoices to the calling landlord) and exposes a PDF download handler.
 */
export const useInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchInvoices = async () => {
      setLoading(true);
      try {
        const res = await api.get('/invoices');
        setInvoices(res.data.data || []);
        setError(null);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || 'Error loading invoices');
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  const handleDownloadPDF = async (invoice) => {
    try {
      const res = await api.get(`/invoices/${invoice.id}/pdf`, { responseType: 'blob' });
      downloadBlob(res.data, `${invoice.invoice_number || `invoice-${invoice.id}`}.pdf`);
      addToast('Invoice PDF downloaded', 'success');
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.message || 'Failed to download invoice PDF', 'error');
    }
  };

  return { invoices, loading, error, handleDownloadPDF };
};
