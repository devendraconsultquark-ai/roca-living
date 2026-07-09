import { useState, useEffect } from 'react';
import api from '../utilities/api';

export const useUtilities = () => {
  const [utilities, setUtilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUtilities = async () => {
      setLoading(true);
      try {
        const res = await api.get('/utilities/my');
        setUtilities(res.data?.data || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching utilities:', err);
        setError(err.response?.data?.message || 'Failed to fetch utilities');
        setUtilities([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUtilities();
  }, []);

  return {
    utilities,
    loading,
    error,
  };
};
