import { useState, useEffect } from 'react';
import api from '../utilities/api';

/**
 * useRentSchedule — fetches the landlord's rent schedules across all their
 * tenancies plus the server-computed arrears summary (overdue total/count,
 * oldest overdue date, days in arrears, next due).
 */
export const useRentSchedule = () => {
  const [schedules, setSchedules] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSchedule = async () => {
      setLoading(true);
      try {
        const res = await api.get('/tenancies/my/rent-schedule');
        setSchedules(res.data.data?.schedules || []);
        setSummary(res.data.data?.summary || null);
        setError(null);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || 'Error loading rent schedule');
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, []);

  return { schedules, summary, loading, error };
};
