import { useCallback, useEffect, useState } from 'react';
import api from '../utilities/api';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';

// Tasks from GET /tasks, plus the quick actions used by every task list.
// params: { status, assignee_type, assignee_id, property_id, landlord_id }.
// rows = null while loading.
export const useTasks = (params = {}) => {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const key = JSON.stringify(params);

  const reload = useCallback(async () => {
    try {
      const res = await api.get('/tasks', { params: JSON.parse(key), skipInterceptorError: true });
      setRows(res.data?.data || []);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.message || 'Error loading tasks');
      setRows([]);
    }
  }, [key]);

  useEffect(() => {
    Promise.resolve().then(reload);
  }, [reload]);

  const setStatus = useCallback(async (task, status) => {
    try {
      await api.patch(`/tasks/${task.id}`, { status });
      addToast(status === 'done' ? 'Task done' : 'Task reopened', 'success');
      reload();
    } catch (e) {
      addToast(e.response?.data?.message || 'Failed to update task', 'error');
    }
  }, [addToast, reload]);

  const remove = useCallback(async (task) => {
    const ok = await confirm({
      title: 'Delete Task',
      message: `Delete "${task.title}"? This cannot be undone.`,
      variant: 'danger',
      confirmText: 'Delete Task',
    });
    if (!ok) return;
    try {
      await api.delete(`/tasks/${task.id}`);
      addToast('Task deleted', 'success');
      reload();
    } catch (e) {
      addToast(e.response?.data?.message || 'Failed to delete task', 'error');
    }
  }, [addToast, confirm, reload]);

  return { rows, error, reload, setStatus, remove };
};
