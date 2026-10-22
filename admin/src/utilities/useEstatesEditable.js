import { useEffect, useState } from 'react';
import api from './api';

// Whether Roca Living can add, edit and delete ROCA Estates landlords and
// apartments: the server has ROCAEM_API_URL / ROCAEM_API_KEY set. Until it
// says so, the edit buttons stay hidden.
export const useEstatesEditable = () => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    api.get('/estates/edit-status', { skipInterceptorError: true })
      .then((res) => setEnabled(!!res.data.data?.enabled))
      .catch(() => setEnabled(false));
  }, []);
  return enabled;
};
