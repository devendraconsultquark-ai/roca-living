import { useState, useEffect } from 'react';
import api from '../utilities/api';

export const useTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        // TODO: backend needs to support /transactions/my endpoint
        const res = await api.get('/transactions/my', { skipInterceptorError: true });
        setTransactions(res.data?.data || []);
        setError(null);
      } catch (err) {
        console.warn('Transactions API not available yet on the backend:', err.message);
        setError(err.response?.data?.message || 'Transactions endpoint not available');
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  return {
    transactions,
    loading,
    error
  };
};
