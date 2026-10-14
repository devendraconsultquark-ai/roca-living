import { useState, useEffect } from 'react';
import { BellRing, AlertTriangle, ListTodo } from 'lucide-react';
import { StatCard } from '../components/UI/StatCard';
import { Skeleton } from '../components/UI/Skeleton';
import { AlertsTable } from '../components/UI/AlertsTable';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

// Everything that needs attention (same feed as the header bell and the
// Dashboard card). Tasks are not tracked in the system yet.
export const TasksAlerts = () => {
  const { addToast } = useToast();
  const [alerts, setAlerts] = useState(null);

  useEffect(() => {
    api.get('/reports/alerts', { params: { all: 1 } })
      .then((res) => setAlerts(res.data.data))
      .catch((err) => {
        addToast(err.response?.data?.message || 'Failed to load alerts', 'error');
        setAlerts({ total: 0, items: [] });
      });
  }, [addToast]);

  const loading = alerts === null;
  const items = alerts?.items || [];
  const high = items.filter((a) => a.priority === 'high').length;

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Alerts" value={loading ? '…' : String(alerts.total)} icon={BellRing} iconColor="text-brand-accent bg-brand-accent/10" />
        <StatCard
          label="High Priority"
          value={loading ? '…' : String(high)}
          icon={AlertTriangle}
          iconColor="text-status-danger bg-status-danger/10"
          valueColor={high > 0 ? 'text-status-danger' : 'text-brand-primary'}
        />
        <StatCard label="Open Tasks" value="Not tracked yet" icon={ListTodo} iconColor="text-status-muted bg-surface-hover" valueColor="text-gray-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-3 lg:col-span-2">
          <h3 className="text-sm-portal font-bold text-brand-primary pb-3 border-b border-card-border">Alerts</h3>
          {loading ? (
            <Skeleton radius="card" className="h-48 w-full" />
          ) : items.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-8 text-center">
              Nothing needs attention — no expiring certificates, unregistered deposits, urgent maintenance or pending payments.
            </p>
          ) : (
            <AlertsTable alerts={items} />
          )}
        </div>

        <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-3">
          <h3 className="text-sm-portal font-bold text-brand-primary pb-3 border-b border-card-border">Tasks</h3>
          <div className="flex flex-col items-center text-center gap-2 py-8">
            <span className="w-11 h-11 rounded-xl bg-surface-hover text-status-muted flex items-center justify-center">
              <ListTodo size={20} />
            </span>
            <span className="text-xs font-bold text-brand-primary">Not tracked yet</span>
            <p className="text-[11px] leading-snug text-gray-400 font-semibold max-w-xs">
              Assigning tasks to staff is part of the approved design and is being built.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
