import { useState, useEffect } from 'react';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

export const useTenancy = () => {
  const [tenancies, setTenancies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToast } = useToast();

  const fetchMyTenancies = async () => {
    setLoading(true);
    try {
      const res = await api.get('/tenancies/my');
      setTenancies(res.data.data || []);
      setError(null);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to load tenancies';
      setError(errMsg);
      addToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyTenancies();
  }, []);

  return {
    tenancies,
    loading,
    error,
    fetchMyTenancies
  };
};
