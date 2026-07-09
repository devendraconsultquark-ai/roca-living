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
        const res = await api.get('/transactions/my');
        setTransactions(res.data?.data || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching transactions:', err);
        setError(err.response?.data?.message || 'Error loading transactions');
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
