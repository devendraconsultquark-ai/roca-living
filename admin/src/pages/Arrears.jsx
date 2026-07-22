import { useState, useEffect } from 'react';
import { PoundSterling, Users, Clock, AlertTriangle, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Cell } from 'recharts';
import { StatCard } from '../components/UI/StatCard';
import { Skeleton } from '../components/UI/Skeleton';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

const money = (v) => `£${Number(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

// Ageing buckets mirror the design; colors mirror the chart tokens in index.css.
const BUCKETS = [
  { key: '1-30', label: '1–30 Days', min: 0, max: 30, color: '#E8A020' },
  { key: '31-60', label: '31–60 Days', min: 31, max: 60, color: '#F16900' },
  { key: '61-90', label: '61–90 Days', min: 61, max: 90, color: '#C62828' },
  { key: '90+', label: '90+ Days', min: 91, max: Infinity, color: '#7C3AED' },
];

const TABS = ['All Arrears', 'Over 30 Days', 'Over 60 Days', 'Over 90 Days'];

const bucketOf = (days) => BUCKETS.find((b) => days >= b.min && days <= b.max) || BUCKETS[0];

export const Arrears = () => {
  const { addToast } = useToast();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('All Arrears');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/reports/arrears');
        setSchedules(res.data.data?.overdue_schedules || []);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load arrears', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [addToast]);

  // Group overdue schedules per tenancy so one tenant appears once with a total
  const byTenancy = Object.values(
    schedules.reduce((acc, s) => {
      const key = s.tenancy_id;
      if (!acc[key]) {
        acc[key] = {
          tenancy_id: s.tenancy_id,
          tenant_name: s.tenant_name || '—',
          landlord_name: s.landlord_name,
          property_address: s.property_address,
          total: 0,
          oldest_due: s.due_date,
          days_overdue: s.days_overdue,
        };
      }
      acc[key].total += parseFloat(s.amount);
      if (s.due_date < acc[key].oldest_due) acc[key].oldest_due = s.due_date;
      if (s.days_overdue > acc[key].days_overdue) acc[key].days_overdue = s.days_overdue;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  const totalOutstanding = byTenancy.reduce((s, t) => s + t.total, 0);
  const bucketTotals = BUCKETS.map((b) => ({
    ...b,
    total: schedules
      .filter((s) => s.days_overdue >= b.min && s.days_overdue <= b.max)
      .reduce((sum, s) => sum + parseFloat(s.amount), 0),
  }));

  const over = (days) => byTenancy.filter((t) => t.days_overdue > days);
  const visible = tab === 'Over 30 Days' ? over(30) : tab === 'Over 60 Days' ? over(60) : tab === 'Over 90 Days' ? over(90) : byTenancy;

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          label="Total Outstanding"
          value={loading ? '…' : money(totalOutstanding)}
          icon={PoundSterling}
          iconColor="text-status-danger bg-status-danger/10"
          valueColor={totalOutstanding > 0 ? 'text-status-danger' : 'text-brand-primary'}
        />
        <StatCard
          label="Tenancies In Arrears"
          value={loading ? '…' : String(byTenancy.length)}
          icon={Users}
          iconColor="text-status-warning bg-status-warning/10"
        />
        <StatCard
          label="Over 30 Days"
          value={loading ? '…' : money(bucketTotals.slice(1).reduce((s, b) => s + b.total, 0))}
          icon={Clock}
          iconColor="text-status-warning bg-status-warning/10"
        />
        <StatCard
          label="Over 60 Days"
          value={loading ? '…' : money(bucketTotals.slice(2).reduce((s, b) => s + b.total, 0))}
          icon={AlertTriangle}
          iconColor="text-status-danger bg-status-danger/10"
        />
        <StatCard
          label="Over 90 Days"
          value={loading ? '…' : money(bucketTotals[3].total)}
          icon={BarChart3}
          iconColor="text-brand-accent bg-brand-accent/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Arrears table */}
        <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-4 lg:col-span-2">
          <div className="flex items-center gap-1 border-b border-card-border pb-3 flex-wrap">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  tab === t ? 'bg-brand-accent/10 text-brand-accent' : 'text-gray-400 hover:text-brand-primary hover:bg-surface-hover'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {loading ? (
            <Skeleton radius="card" className="h-48 w-full" />
          ) : visible.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-10 text-center">
              {byTenancy.length === 0 ? 'No arrears — all rent is up to date.' : 'No arrears in this view.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="text-left">
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Tenant</th>
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Property</th>
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Landlord</th>
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Overdue Since</th>
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Days</th>
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 text-right">Total Arrears</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const bucket = bucketOf(row.days_overdue);
                    return (
                      <tr key={row.tenancy_id} className="border-t border-card-border/60">
                        <td className="py-2.5 pr-3 text-xs font-bold text-brand-primary whitespace-nowrap">{row.tenant_name}</td>
                        <td className="py-2.5 pr-3 text-xs font-semibold text-gray-400">{row.property_address}</td>
                        <td className="py-2.5 pr-3 text-xs font-semibold text-gray-400 whitespace-nowrap">{row.landlord_name}</td>
                        <td className="py-2.5 pr-3 text-xs font-semibold whitespace-nowrap">{fmtDate(row.oldest_due)}</td>
                        <td className="py-2.5 pr-3">
                          <span
                            className="px-2 py-0.5 rounded-sm text-2xs font-bold whitespace-nowrap"
                            style={{ backgroundColor: `${bucket.color}1A`, color: bucket.color }}
                          >
                            {row.days_overdue} days
                          </span>
                        </td>
                        <td className="py-2.5 text-xs font-bold text-status-danger text-right tabular-nums">{money(row.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Ageing summary */}
        <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-4">
          <h3 className="text-sm-portal font-bold text-brand-primary border-b border-card-border pb-3">Arrears Ageing</h3>
          {loading ? (
            <Skeleton radius="card" className="h-48 w-full" />
          ) : totalOutstanding === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-10 text-center">Nothing outstanding.</p>
          ) : (
            <>
              <BarChart width={300} height={180} data={bucketTotals} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {bucketTotals.map((b) => (
                    <Cell key={b.key} fill={b.color} />
                  ))}
                </Bar>
              </BarChart>
              <div className="flex flex-col gap-2">
                {bucketTotals.map((b) => (
                  <div key={b.key} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-2xs font-semibold text-gray-400">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                      {b.label}
                    </span>
                    <span className="text-2xs font-bold text-brand-primary tabular-nums">
                      {money(b.total)}{totalOutstanding > 0 ? ` (${Math.round((b.total / totalOutstanding) * 100)}%)` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
