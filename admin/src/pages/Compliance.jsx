import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Clock, AlertTriangle, FileWarning, ClipboardList } from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';
import { StatCard } from '../components/UI/StatCard';
import { Skeleton } from '../components/UI/Skeleton';
import { Dropdown } from '../components/UI/Dropdown';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const CERT_LABELS = {
  EPC: 'Energy Performance (EPC)',
  EICR: 'Electrical Installation (EICR)',
  GAS: 'Gas Safety',
  SMOKE_CO: 'Smoke & CO Alarms',
  HMO: 'HMO Licence',
  PAT: 'PAT Testing',
};

// Same buckets and colors as the dashboard donut (chart tokens in index.css)
const BUCKETS = {
  compliant: { label: 'Compliant', color: '#3A7D44', pill: 'bg-status-success-bg text-status-success' },
  due_30: { label: 'Due (30 days)', color: '#F16900', pill: 'bg-status-warning/10 text-status-warning' },
  due_60: { label: 'Due (60 days)', color: '#E8A020', pill: 'bg-status-warning/10 text-status-warning' },
  overdue: { label: 'Overdue', color: '#C62828', pill: 'bg-status-danger-bg text-status-danger' },
  not_uploaded: { label: 'Not Uploaded', color: '#9CA3AF', pill: 'bg-surface-hover text-gray-400' },
};

const bucketOf = (item) => {
  if (item.days_left === null) return 'not_uploaded';
  if (item.days_left < 0) return 'overdue';
  if (item.days_left <= 30) return 'due_30';
  if (item.days_left <= 60) return 'due_60';
  return 'compliant';
};

export const Compliance = () => {
  const { addToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/reports/compliance-items');
        setItems(res.data.data || []);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load compliance items', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [addToast]);

  const withBucket = items.map((i) => ({ ...i, bucket: bucketOf(i) }));
  const counts = Object.keys(BUCKETS).reduce(
    (acc, key) => ({ ...acc, [key]: withBucket.filter((i) => i.bucket === key).length }),
    {}
  );
  const total = withBucket.length;
  const pct = total > 0 ? Math.round((counts.compliant / total) * 100) : null;
  const attention = counts.due_30 + counts.overdue + counts.not_uploaded;

  const donutData = Object.entries(BUCKETS)
    .map(([key, b]) => ({ key, ...b, value: counts[key] }))
    .filter((s) => s.value > 0);

  const visible = withBucket.filter(
    (i) => (!typeFilter || i.cert_type === typeFilter) && (!statusFilter || i.bucket === statusFilter)
  );

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard label="Total Compliance Items" value={loading ? '…' : String(total)} icon={ClipboardList} iconColor="text-brand-accent bg-brand-accent/10" />
        <StatCard
          label="Compliant"
          value={loading ? '…' : String(counts.compliant || 0)}
          icon={ShieldCheck}
          iconColor="text-status-success bg-status-success/10"
          sub={pct !== null ? <span className="text-status-success">{pct}% of total</span> : undefined}
        />
        <StatCard label="Due Soon (30 Days)" value={loading ? '…' : String(counts.due_30 || 0)} icon={Clock} iconColor="text-status-warning bg-status-warning/10" />
        <StatCard
          label="Overdue"
          value={loading ? '…' : String(counts.overdue || 0)}
          icon={AlertTriangle}
          iconColor="text-status-danger bg-status-danger/10"
          valueColor={(counts.overdue || 0) > 0 ? 'text-status-danger' : 'text-brand-primary'}
        />
        <StatCard label="Not Uploaded" value={loading ? '…' : String(counts.not_uploaded || 0)} icon={FileWarning} iconColor="text-status-muted bg-surface-hover" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items table */}
        <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-card-border pb-3">
            <h3 className="text-sm-portal font-bold text-brand-primary">Certificate Register</h3>
            <div className="flex items-center gap-2">
              <Dropdown
                id="compliance-type"
                placeholder="All Types"
                clearable
                options={Object.entries(CERT_LABELS).map(([value, label]) => ({ value, label }))}
                value={typeFilter}
                onChange={(v) => setTypeFilter(v || '')}
                className="w-52"
              />
              <Dropdown
                id="compliance-status"
                placeholder="All Statuses"
                clearable
                options={Object.entries(BUCKETS).map(([value, b]) => ({ value, label: b.label }))}
                value={statusFilter}
                onChange={(v) => setStatusFilter(v || '')}
                className="w-44"
              />
            </div>
          </div>

          {loading ? (
            <Skeleton radius="card" className="h-48 w-full" />
          ) : visible.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-10 text-center">
              {items.length === 0
                ? 'No certificates recorded yet — add them from a property’s Safety & Compliance tab.'
                : 'No certificates match the current filters.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="text-left">
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Certificate</th>
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Property</th>
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Landlord</th>
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Expires</th>
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => {
                    const bucket = BUCKETS[item.bucket];
                    return (
                      <tr key={item.id} className="border-t border-card-border/60">
                        <td className="py-2.5 pr-3 text-xs font-bold text-brand-primary whitespace-nowrap">
                          {CERT_LABELS[item.cert_type] || item.cert_type}
                        </td>
                        <td className="py-2.5 pr-3 text-xs font-semibold text-gray-400">
                          <Link to={`/properties/${item.property_id}`} className="hover:text-brand-accent transition-colors">
                            {item.property_address}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-3 text-xs font-semibold text-gray-400 whitespace-nowrap">
                          <Link to={`/landlords/${item.landlord_id}`} className="hover:text-brand-accent transition-colors">
                            {item.landlord_name}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-3 text-xs font-semibold whitespace-nowrap">
                          {fmtDate(item.expires_at)}
                          {item.days_left !== null && (
                            <span className={`block text-2xs font-bold ${item.days_left < 0 ? 'text-status-danger' : item.days_left <= 30 ? 'text-status-warning' : 'text-gray-400'}`}>
                              {item.days_left < 0 ? `${Math.abs(item.days_left)} days ago` : `${item.days_left} days`}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-sm text-2xs font-bold whitespace-nowrap ${bucket.pill}`}>{bucket.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Overview donut */}
        <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-4">
          <h3 className="text-sm-portal font-bold text-brand-primary border-b border-card-border pb-3">Compliance Overview</h3>
          {loading ? (
            <Skeleton radius="card" className="h-48 w-full" />
          ) : total === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-10 text-center">No certificates recorded yet.</p>
          ) : (
            <>
              <div className="relative w-[160px] h-[160px] mx-auto">
                <PieChart width={160} height={160}>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    innerRadius={56}
                    outerRadius={74}
                    startAngle={90}
                    endAngle={-270}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {donutData.map((s) => (
                      <Cell key={s.key} fill={s.color} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                  <span className="text-lg font-bold text-brand-primary leading-none">{pct !== null ? `${pct}%` : '—'}</span>
                  <span className="text-2xs text-gray-400 font-semibold mt-1 text-center leading-tight">Overall<br />Compliance</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {Object.entries(BUCKETS).map(([key, b]) => (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-2xs font-semibold text-gray-400">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                      {b.label}
                    </span>
                    <span className="text-2xs font-bold text-brand-primary tabular-nums">
                      {counts[key] || 0}{total > 0 ? ` (${Math.round(((counts[key] || 0) / total) * 100)}%)` : ''}
                    </span>
                  </div>
                ))}
              </div>
              {attention > 0 && (
                <p className="flex items-center gap-2 bg-status-warning/10 text-status-warning rounded-lg px-3 py-2.5 text-2xs font-bold">
                  <AlertTriangle size={14} className="shrink-0" />
                  {attention} item{attention === 1 ? '' : 's'} require attention
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
