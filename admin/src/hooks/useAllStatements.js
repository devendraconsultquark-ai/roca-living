import { useCallback, useEffect, useState } from 'react';
import api from '../utilities/api';

// Every statement (Roca Living, Rent Cycle, Historic) + money totals worked out
// from them, from GET /all-statements. params: { landlord_id, property_id,
// tenancy_id, types } (omit for all). rows = null while loading.
export const useAllStatements = (params = {}, { enabled = true } = {}) => {
  const [rows, setRows] = useState(null);
  const [totals, setTotals] = useState(null);
  const [totalsYear, setTotalsYear] = useState(null);
  const [error, setError] = useState(null);
  const key = JSON.stringify(params);

  const reload = useCallback(async () => {
    try {
      const res = await api.get('/all-statements', { params: JSON.parse(key), skipInterceptorError: true });
      const d = res.data?.data || {};
      setRows(d.rows || []);
      setTotals(d.totals || null);
      setTotalsYear(d.totals_year || null);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.message || 'Error loading statements');
      setRows([]);
    }
  }, [key]);

  useEffect(() => {
    if (enabled) Promise.resolve().then(reload);
  }, [enabled, reload]);

  return { rows, totals, totalsYear, error, reload };
};
