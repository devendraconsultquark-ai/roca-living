import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, AlertTriangle, CheckCircle2, TrendingUp, PoundSterling } from 'lucide-react';
import { StatCard } from '../components/UI/StatCard';
import { Skeleton } from '../components/UI/Skeleton';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

const money = (v) => `£${Number(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const DAY_MS = 24 * 60 * 60 * 1000;

const TABS = ['All Reviews', 'Upcoming', 'Overdue', 'Completed'];

const pillFor = (row) => {
  if (row.reviewStatus === 'completed') return { label: 'Completed', cls: 'bg-status-success-bg text-status-success' };
  if (row.reviewStatus === 'in_progress') return { label: 'In Progress', cls: 'bg-status-info-bg text-status-info' };
  if (row.daysUntil < 0) return { label: 'Overdue', cls: 'bg-status-danger-bg text-status-danger' };
  return { label: 'Scheduled', cls: 'bg-brand-accent/10 text-brand-accent' };
};

export const RentReviews = () => {
  const { addToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('All Reviews');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/tenancies');
        const reviews = (res.data.data || [])
          .filter((t) => t.rent_review_status && t.rent_review_status !== 'none' && t.rent_review_date)
          .map((t) => {
            const daysUntil = Math.ceil((new Date(t.rent_review_date) - new Date()) / DAY_MS);
            return {
              id: t.id,
              tenant: t.lead_tenant_name || '—',
              property: `${t.address_line1 || ''}, ${t.city || ''}`.replace(/^, /, ''),
              reviewDate: t.rent_review_date,
              daysUntil,
              current: parseFloat(t.rent_pcm || 0),
              proposed: t.proposed_rent !== null && t.proposed_rent !== undefined ? parseFloat(t.proposed_rent) : null,
              reviewStatus: t.rent_review_status,
            };
          })
          .sort((a, b) => (a.reviewDate < b.reviewDate ? -1 : 1));
        setRows(reviews);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load rent reviews', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [addToast]);

  const open = rows.filter((r) => r.reviewStatus !== 'completed');
  const dueSoon = open.filter((r) => r.daysUntil >= 0 && r.daysUntil <= 90);
  const overdue = open.filter((r) => r.daysUntil < 0);
  const completed = rows.filter((r) => r.reviewStatus === 'completed');

  const withIncrease = rows.filter((r) => r.proposed !== null && r.current > 0);
  const avgIncrease = withIncrease.length
    ? withIncrease.reduce((s, r) => s + ((r.proposed - r.current) / r.current) * 100, 0) / withIncrease.length
    : null;
  const projectedAnnual = open
    .filter((r) => r.proposed !== null)
    .reduce((s, r) => s + (r.proposed - r.current) * 12, 0);

  const visible = tab === 'Upcoming' ? dueSoon
    : tab === 'Overdue' ? overdue
    : tab === 'Completed' ? completed
    : rows;

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          label="Reviews Due (90 Days)"
          value={loading ? '…' : String(dueSoon.length)}
          icon={CalendarClock}
          iconColor="text-brand-accent bg-brand-accent/10"
        />
        <StatCard
          label="Overdue Reviews"
          value={loading ? '…' : String(overdue.length)}
          icon={AlertTriangle}
          iconColor="text-status-danger bg-status-danger/10"
          valueColor={overdue.length > 0 ? 'text-status-danger' : 'text-brand-primary'}
        />
        <StatCard
          label="Completed"
          value={loading ? '…' : String(completed.length)}
          icon={CheckCircle2}
          iconColor="text-status-success bg-status-success/10"
        />
        <StatCard
          label="Average Proposed Increase"
          value={loading ? '…' : (avgIncrease !== null ? `${avgIncrease.toFixed(1)}%` : '—')}
          icon={TrendingUp}
          iconColor="text-status-info bg-status-info-bg"
        />
        <StatCard
          label="Projected Additional Rent (12m)"
          value={loading ? '…' : money(projectedAnnual)}
          icon={PoundSterling}
          iconColor="text-status-warning bg-status-warning/10"
          sub={<span className="text-gray-400">From open reviews with proposals</span>}
        />
      </div>

      {/* Review list */}
      <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-card-border pb-3">
          <div className="flex items-center gap-1">
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
          <Link to="/tenancies" className="text-2xs font-bold text-brand-accent hover:text-brand-accent-hover">
            Manage reviews on Tenancies
          </Link>
        </div>

        {loading ? (
          <Skeleton radius="card" className="h-48 w-full" />
        ) : visible.length === 0 ? (
          <p className="text-xs text-gray-400 font-semibold py-10 text-center">
            {rows.length === 0
              ? 'No rent reviews scheduled yet — use the "Rent Review" action on an active tenancy to schedule one.'
              : 'No reviews in this view.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="text-left">
                  <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Tenant</th>
                  <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Property</th>
                  <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Review Date</th>
                  <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3 text-right">Current Rent</th>
                  <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3 text-right">Proposed Rent</th>
                  <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3 text-right">Increase</th>
                  <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const pill = pillFor(row);
                  const increasePct = row.proposed !== null && row.current > 0
                    ? ((row.proposed - row.current) / row.current) * 100
                    : null;
                  return (
                    <tr key={row.id} className="border-t border-card-border/60">
                      <td className="py-2.5 pr-3 text-xs font-bold text-brand-primary whitespace-nowrap">{row.tenant}</td>
                      <td className="py-2.5 pr-3 text-xs font-semibold text-gray-400">{row.property}</td>
                      <td className="py-2.5 pr-3 text-xs font-semibold whitespace-nowrap">
                        {fmtDate(row.reviewDate)}
                        {row.reviewStatus !== 'completed' && (
                          <span className={`block text-2xs font-bold ${row.daysUntil < 0 ? 'text-status-danger' : 'text-gray-400'}`}>
                            {row.daysUntil < 0 ? `overdue by ${Math.abs(row.daysUntil)} days` : row.daysUntil === 0 ? 'today' : `in ${row.daysUntil} days`}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-xs font-bold text-right tabular-nums">{money(row.current)}</td>
                      <td className="py-2.5 pr-3 text-xs font-bold text-right tabular-nums">
                        {row.proposed !== null ? money(row.proposed) : '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-xs font-bold text-right tabular-nums">
                        {increasePct !== null ? (
                          <span className={increasePct >= 0 ? 'text-status-success' : 'text-status-danger'}>
                            {increasePct.toFixed(1)}%
                            <span className="block text-2xs text-gray-400 font-semibold">
                              {increasePct >= 0 ? '+' : ''}{money(row.proposed - row.current).replace('£-', '-£')}
                            </span>
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded-sm text-2xs font-bold whitespace-nowrap ${pill.cls}`}>{pill.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
