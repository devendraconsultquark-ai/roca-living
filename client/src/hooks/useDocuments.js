import { useState, useEffect } from 'react';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

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

  return {
    documents,
    loading,
    error,
    fetchMyDocuments
  };
};
