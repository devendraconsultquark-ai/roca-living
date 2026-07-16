import { useState, useEffect } from 'react';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';
import { downloadBlob } from '../utilities/download';

export const useDocuments = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToast } = useToast();

  const fetchMyDocuments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/documents/my');
      setDocuments(res.data.data || []);
      setError(null);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Error loading documents';
      setError(errMsg);
      addToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyDocuments();
  }, []);

  const handleDownload = async (doc) => {
    try {
      const res = await api.get(`/documents/${doc.id}/download`, {
        responseType: 'blob',
        skipInterceptorError: true
      });
      downloadBlob(res.data, doc.item || `document-${doc.id}`, res.headers?.['content-type']);
    } catch (err) {
      let msg = 'Failed to download document';
      if (err.response?.data instanceof Blob) {
        try { msg = JSON.parse(await err.response.data.text())?.message || msg; } catch { /* keep default */ }
      } else {
        msg = err.response?.data?.message || msg;
      }
      addToast(msg, 'error');
    }
  };

  return {
    documents,
    loading,
    error,
    fetchMyDocuments,
    handleDownload
  };
};
