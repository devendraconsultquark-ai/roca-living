import { useEffect, useState } from 'react';
import api from '../utilities/api';

// Historic statements (F62): rows = null while loading.
export const useHistoricStatements = () => {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let alive = true;
    api.get('/historic-statements')
      .then((r) => { if (alive) setRows(r.data?.data || []); })
      .catch((e) => { if (alive) { setError(e.response?.data?.message || 'Error loading historic statements'); setRows([]); } });
    return () => { alive = false; };
  }, []);
  return { rows, error };
};
