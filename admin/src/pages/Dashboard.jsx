import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Home, UserCheck, Wallet, Banknote, PiggyBank,
  Wrench, Upload, BarChart3,
  AlertTriangle, Download, Inbox, ClipboardList, CheckCircle2,
  CalendarDays, ChevronDown
} from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';
import { Button } from '../components/UI/Button';
import { StatCard } from '../components/UI/StatCard';
import { Skeleton } from '../components/UI/Skeleton';
import api from '../utilities/api';

const money = (v) => `£${Number(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const NEW_BADGE_DAYS = 14;

// Month-picker helpers: keys are YYYY-MM, labels render "01 May – 31 May 2024"
const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthDateOf = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
};
const monthRangeLabel = (key) => {
  const d = monthDateOf(key);
  const mon = d.toLocaleDateString('en-GB', { month: 'short' });
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `01 ${mon} – ${lastDay} ${mon} ${d.getFullYear()}`;
};

// Derived pill for the Rent Reviews card: a scheduled/in-progress review whose
// date has passed is "Review Due".
const reviewPill = (row) => {
  const overdue = new Date(row.review_date) <= new Date();
  if (row.status === 'in_progress') return { label: 'In Progress', cls: 'bg-status-info-bg text-status-info' };
  if (overdue) return { label: 'Review Due', cls: 'bg-status-warning/10 text-status-warning' };
  return { label: 'Scheduled', cls: 'bg-brand-accent/10 text-brand-accent' };
};

// Donut segment colors mirror the chart tokens in index.css
// (--color-chart-green / --color-chart-orange / --primitive-orange / --primitive-red).
const COMPLIANCE_SEGMENTS = [
  { key: 'compliant', label: 'Compliant', color: '#3A7D44' },
  { key: 'due_30', label: 'Due (30 days)', color: '#F16900' },
  { key: 'due_60', label: 'Due (60 days)', color: '#E8A020' },
  { key: 'overdue', label: 'Overdue', color: '#C62828' },
  { key: 'not_uploaded', label: 'Not Uploaded', color: '#9CA3AF' },
];

const QUICK_ACTIONS = [
  { label: 'Add Tenant', to: '/tenants', icon: UserCheck },
  { label: 'Record Rent Payment', to: '/accounting', icon: Wallet },
  { label: 'Raise Maintenance', to: '/maintenance', icon: Wrench },
  { label: 'Upload Document', to: '/documents', icon: Upload },
  { label: 'Run Compliance Report', to: '/reports', icon: BarChart3 },
];

// Recent Alerts & Tasks pill styling (types/statuses come from the alerts feed)
const ALERT_TYPES = {
  compliance: { label: 'Compliance', cls: 'bg-status-danger-bg text-status-danger' },
  deposit: { label: 'Deposit', cls: 'bg-brand-accent/10 text-brand-accent' },
  maintenance: { label: 'Maintenance', cls: 'bg-status-warning/10 text-status-warning' },
  landlord_payment: { label: 'Landlord Payment', cls: 'bg-status-success-bg text-status-success' },
};
const ALERT_STATUSES = {
  open: { label: 'Open', cls: 'bg-status-danger-bg text-status-danger' },
  sent: { label: 'Sent', cls: 'bg-status-info-bg text-status-info' },
  new: { label: 'New', cls: 'bg-status-info-bg text-status-info' },
  triaged: { label: 'Triaged', cls: 'bg-brand-accent/10 text-brand-accent' },
  awaiting_approval: { label: 'Awaiting Approval', cls: 'bg-status-warning/10 text-status-warning' },
  in_progress: { label: 'In Progress', cls: 'bg-status-info-bg text-status-info' },
};
const PRIORITY_STYLES = {
  high: 'bg-status-danger-bg text-status-danger',
  medium: 'bg-status-warning/10 text-status-warning',
};

const CardTitle = ({ children, linkTo, linkLabel }) => (
  <div className="flex items-center justify-between pb-3 border-b border-card-border select-none">
    <h3 className="text-sm-portal font-bold text-brand-primary">{children}</h3>
    {linkTo && (
      <Link to={linkTo} className="text-2xs font-bold text-brand-accent hover:text-brand-accent-hover transition-colors shrink-0">
        {linkLabel}
      </Link>
    )}
  </div>
);

const MetricRow = ({ label, value, valueClass = 'text-brand-primary', icon: Icon, iconClass = 'text-brand-accent' }) => (
  <div className="flex items-center justify-between gap-4 py-2 border-b border-card-border/60 last:border-0">
    <span className="flex items-center gap-2.5 text-xs font-semibold text-gray-400 min-w-0">
      {Icon && <Icon size={15} className={`shrink-0 ${iconClass}`} />}
      <span className="truncate">{label}</span>
    </span>
    <span className={`text-xs font-bold tabular-nums shrink-0 ${valueClass}`}>{value}</span>
  </div>
);

const AttentionStrip = ({ text, linkTo, linkLabel }) => (
  <div className="mt-auto flex items-center justify-between gap-3 bg-status-warning/10 rounded-lg px-3 py-2.5">
    <span className="flex items-center gap-2 text-2xs font-bold text-status-warning min-w-0">
      <AlertTriangle size={14} className="shrink-0" />
      <span className="truncate">{text}</span>
    </span>
    <Link to={linkTo} className="text-2xs font-bold text-brand-accent hover:text-brand-accent-hover shrink-0">
      {linkLabel}
    </Link>
  </div>
);

export const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Reporting period (calendar month) — drives the month-scoped figures
  const currentMonthKey = monthKeyOf(new Date());
  const [month, setMonth] = useState(currentMonthKey);
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const monthMenuRef = useRef(null);
  const isCurrentMonth = month === currentMonthKey;
  const periodLabel = isCurrentMonth
    ? 'This Month'
    : monthDateOf(month).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const now = new Date();
    return monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1));
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get('/reports/dashboard', { params: { month } });
        setSummary(res.data.data);
      } catch (err) {
        console.error('Failed to fetch dashboard summary', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [month]);

  useEffect(() => {
    if (!monthMenuOpen) return;
    const handler = (e) => {
      if (monthMenuRef.current && !monthMenuRef.current.contains(e.target)) setMonthMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [monthMenuOpen]);

  const kpis = summary?.kpis;
  const financial = summary?.financial;
  const compliance = summary?.compliance;
  const maintenance = summary?.maintenance;
  const topArrears = summary?.top_arrears || [];
  const rentReviews = summary?.rent_reviews || [];
  const news = summary?.news || [];
  const alerts = summary?.alerts?.items || [];
  const alertsTotal = summary?.alerts?.total || 0;

  const complianceAttention = compliance
    ? compliance.due_30 + compliance.overdue + compliance.not_uploaded
    : 0;

  const donutData = compliance
    ? COMPLIANCE_SEGMENTS
        .map((s) => ({ ...s, value: compliance[s.key] || 0 }))
        .filter((s) => s.value > 0)
    : [];

  const handleExport = () => {
    if (!summary) return;
    const rows = [
      ['Metric', 'Value'],
      ['Period', monthRangeLabel(month)],
      ['Active Landlords', kpis.landlords.total],
      [`New Landlords (${periodLabel})`, kpis.landlords.new_this_month],
      ['Managed Properties', kpis.properties.total],
      [`New Properties (${periodLabel})`, kpis.properties.new_this_month],
      ['Active Tenancies', kpis.tenancies.active],
      ['Occupancy %', kpis.tenancies.occupancy_pct],
      [`Rent Due (${periodLabel})`, financial.rent_due_month],
      [`Rent Collected (${periodLabel})`, financial.rent_collected_month],
      ['Arrears Total', financial.arrears_total],
      ['Landlord Payments Pending', financial.landlord_payments_pending],
      ['Unreconciled Receipts', financial.unreconciled_receipts],
      [`Management Fees (${periodLabel})`, financial.mgmt_fees_month],
      [`Contractor Costs (${periodLabel})`, financial.contractor_costs_month],
      ['Certificates Compliant', compliance.compliant],
      ['Certificates Due (30 days)', compliance.due_30],
      ['Certificates Due (60 days)', compliance.due_60],
      ['Certificates Overdue', compliance.overdue],
      ['Maintenance New', maintenance.new],
      ['Maintenance Triaged', maintenance.triaged],
      ['Maintenance Awaiting Approval', maintenance.awaiting_approval],
      ['Maintenance In Progress', maintenance.in_progress],
      ['Maintenance Completed (Awaiting Invoice)', maintenance.complete_awaiting_invoice],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-summary-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = kpis ? [
    {
      name: 'Active Landlords',
      value: String(kpis.landlords.total),
      icon: Users,
      color: 'text-brand-accent bg-brand-accent/10',
      sub: (
        <span className={kpis.landlords.new_this_month > 0 ? 'text-status-success' : 'text-gray-400'}>
          +{kpis.landlords.new_this_month} {isCurrentMonth ? 'this month' : `in ${periodLabel}`}
        </span>
      ),
    },
    {
      name: 'Managed Properties',
      value: String(kpis.properties.total),
      icon: Home,
      color: 'text-brand-accent bg-brand-accent/10',
      sub: (
        <span className={kpis.properties.new_this_month > 0 ? 'text-status-success' : 'text-gray-400'}>
          +{kpis.properties.new_this_month} {isCurrentMonth ? 'this month' : `in ${periodLabel}`}
        </span>
      ),
    },
    {
      name: 'Active Tenancies',
      value: String(kpis.tenancies.active),
      icon: UserCheck,
      color: 'text-brand-accent bg-brand-accent/10',
      sub: <span className="text-status-info">{kpis.tenancies.occupancy_pct}% occupancy</span>,
    },
    {
      name: `Rent Due (${periodLabel})`,
      value: money(kpis.rent_due_month),
      icon: Wallet,
      color: 'text-status-success bg-status-success-bg',
      sub: <Link to="/accounting" className="text-brand-accent hover:text-brand-accent-hover">View rent roll</Link>,
    },
    {
      name: 'Rent Collected',
      value: money(kpis.rent_collected_month),
      icon: Banknote,
      color: 'text-status-info bg-status-info-bg',
      sub: kpis.rent_collected_pct !== null
        ? <span className="text-status-info">{kpis.rent_collected_pct}% collected</span>
        : <span className="text-gray-400">No rent due this period</span>,
    },
    {
      name: 'Landlord Payments',
      value: money(kpis.landlord_payments_month),
      icon: PiggyBank,
      color: 'text-status-warning bg-status-warning/10',
      sub: (
        <Link to="/statements" className={kpis.statements_pending > 0 ? 'text-status-warning' : 'text-gray-400'}>
          {kpis.statements_pending} pending
        </Link>
      ),
    },
  ] : [];

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      {/* Page actions (title lives in the layout header) */}
      <div className="flex justify-end gap-3">
        <div className="relative" ref={monthMenuRef}>
          <button
            onClick={() => setMonthMenuOpen((o) => !o)}
            className="flex items-center gap-2 bg-white border border-card-border rounded-card px-3.5 py-2 text-xs-portal font-semibold text-brand-primary hover:bg-surface-light transition-colors cursor-pointer"
          >
            <CalendarDays size={14} className="text-gray-400" />
            {monthRangeLabel(month)}
            <ChevronDown size={14} className={`text-gray-400 transition-transform duration-150 ${monthMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {monthMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 card-bg border border-card-border rounded-card shadow-premium z-50 py-1.5 max-h-80 overflow-y-auto">
              {monthOptions.map((key) => (
                <button
                  key={key}
                  onClick={() => { setMonth(key); setMonthMenuOpen(false); }}
                  className={`w-full text-left px-3.5 py-2 text-xs font-semibold hover:bg-surface-light transition-colors cursor-pointer ${
                    key === month ? 'text-brand-accent' : 'text-brand-primary'
                  }`}
                >
                  {monthRangeLabel(key)}{key === currentMonthKey ? ' · current' : ''}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button variant="secondary" icon={Download} onClick={handleExport} disabled={!summary}>
          Export
        </Button>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} radius="card" className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {stats.map((stat) => (
            <StatCard
              key={stat.name}
              label={stat.name}
              value={stat.value}
              icon={stat.icon}
              iconColor={stat.color}
              sub={stat.sub}
            />
          ))}
        </div>
      )}

      {/* Overview row: Financial / Compliance / Maintenance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Overview */}
        <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-3">
          <CardTitle linkTo="/reports" linkLabel="View full report">Financial Overview</CardTitle>
          {loading || !financial ? (
            <Skeleton radius="card" className="h-56 w-full" />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col">
                <MetricRow label={`Rent Due (${periodLabel})`} value={money(financial.rent_due_month)} />
                <MetricRow label={`Rent Collected (${periodLabel})`} value={money(financial.rent_collected_month)} />
                <MetricRow
                  label={`Arrears (${financial.arrears_count} overdue)`}
                  value={money(financial.arrears_total)}
                  valueClass={Number(financial.arrears_total) > 0 ? 'text-status-danger' : 'text-brand-primary'}
                />
                <MetricRow label="Landlord Payments Pending" value={money(financial.landlord_payments_pending)} />
              </div>
              <div className="flex flex-col">
                <MetricRow label="Unreconciled Receipts" value={money(financial.unreconciled_receipts)} />
                <MetricRow label={`Management Fees (${periodLabel})`} value={money(financial.mgmt_fees_month)} />
                <MetricRow label={`Contractor Costs (${periodLabel})`} value={money(financial.contractor_costs_month)} />
              </div>
            </div>
          )}
        </div>

        {/* Compliance Overview */}
        <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-4">
          <CardTitle linkTo="/reports" linkLabel="View compliance">Compliance Overview</CardTitle>
          {loading || !compliance ? (
            <Skeleton radius="card" className="h-56 w-full" />
          ) : compliance.total === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-8 text-center">No certificates recorded yet.</p>
          ) : (
            <>
              <div className="flex items-center gap-5">
                <div className="relative shrink-0 w-[140px] h-[140px]">
                  <PieChart width={140} height={140}>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      innerRadius={50}
                      outerRadius={66}
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
                    <span className="text-lg font-bold text-brand-primary leading-none">
                      {compliance.pct !== null ? `${compliance.pct}%` : '—'}
                    </span>
                    <span className="text-2xs text-gray-400 font-semibold mt-1 text-center leading-tight">
                      Overall<br />Compliance
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                  {COMPLIANCE_SEGMENTS.filter((s) => s.key !== 'not_uploaded' || compliance.not_uploaded > 0).map((s) => (
                    <div key={s.key} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-2xs font-semibold text-gray-400 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="truncate">{s.label}</span>
                      </span>
                      <span className="text-2xs font-bold text-brand-primary tabular-nums shrink-0">
                        {compliance[s.key]} ({Math.round(((compliance[s.key] || 0) / compliance.total) * 100)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {complianceAttention > 0 && (
                <AttentionStrip
                  text={`${complianceAttention} compliance item${complianceAttention === 1 ? '' : 's'} require attention`}
                  linkTo="/reports"
                  linkLabel="View outstanding"
                />
              )}
            </>
          )}
        </div>

        {/* Maintenance Overview */}
        <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-3">
          <CardTitle linkTo="/maintenance" linkLabel="View maintenance">Maintenance Overview</CardTitle>
          {loading || !maintenance ? (
            <Skeleton radius="card" className="h-56 w-full" />
          ) : (
            <>
              <div className="flex flex-col">
                <MetricRow icon={Inbox} iconClass="text-status-info" label="New Requests" value={maintenance.new} />
                <MetricRow icon={ClipboardList} iconClass="text-brand-accent" label="Triaged" value={maintenance.triaged} />
                <MetricRow icon={UserCheck} iconClass="text-status-warning" label="Awaiting Approval" value={maintenance.awaiting_approval} />
                <MetricRow icon={Wrench} iconClass="text-status-info" label="In Progress" value={maintenance.in_progress} />
                <MetricRow icon={CheckCircle2} iconClass="text-status-success" label="Completed (Awaiting Invoice)" value={maintenance.complete_awaiting_invoice} />
              </div>
              {maintenance.urgent_open > 0 && (
                <AttentionStrip
                  text={`${maintenance.urgent_open} urgent / high priority issue${maintenance.urgent_open === 1 ? '' : 's'}`}
                  linkTo="/maintenance"
                  linkLabel="View all"
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* News / Rent Reviews / Top Arrears */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Legislation & News */}
        <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-3">
          <CardTitle linkTo="/settings" linkLabel="Manage news">Legislation &amp; News</CardTitle>
          {loading ? (
            <Skeleton radius="card" className="h-40 w-full" />
          ) : news.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-8 text-center">
              No news items yet — add them under Settings.
            </p>
          ) : (
            <div className="flex flex-col">
              {news.map((item) => {
                const isNew = (new Date() - new Date(item.published_on)) / 86400000 <= NEW_BADGE_DAYS;
                return (
                  <div key={item.id} className="flex items-start justify-between gap-3 py-2.5 border-b border-card-border/60 last:border-0">
                    <span className="flex items-start gap-2.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-accent mt-1.5 shrink-0" />
                      <span className="min-w-0 text-xs font-semibold text-brand-primary leading-snug">
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noreferrer" className="hover:text-brand-accent transition-colors">
                            {item.title}
                          </a>
                        ) : (
                          item.title
                        )}
                        {isNew && (
                          <span className="ml-2 px-1.5 py-0.5 rounded-sm bg-brand-accent/10 text-brand-accent text-2xs font-bold align-middle">
                            New
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="text-2xs font-semibold text-gray-400 shrink-0">{fmtDate(item.published_on)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rent Reviews Due */}
        <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-3">
          <CardTitle linkTo="/tenancies" linkLabel="View all">Rent Reviews Due</CardTitle>
          {loading ? (
            <Skeleton radius="card" className="h-40 w-full" />
          ) : rentReviews.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-8 text-center">
              No rent reviews scheduled — set them from the Tenancies page.
            </p>
          ) : (
            <div className="flex flex-col">
              {rentReviews.map((row) => {
                const pill = reviewPill(row);
                return (
                  <div key={row.tenancy_id} className="flex flex-col gap-1.5 py-2.5 border-b border-card-border/60 last:border-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold text-brand-primary truncate">{row.property_address}</span>
                      <span className={`px-2 py-0.5 rounded-sm text-2xs font-bold shrink-0 ${pill.cls}`}>{pill.label}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-2xs font-semibold text-gray-400">
                      <span>{fmtDate(row.review_date)}</span>
                      <span className="tabular-nums">
                        {money(row.current_rent)}
                        {row.proposed_rent && <> → <span className="text-brand-primary font-bold">{money(row.proposed_rent)}</span></>}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Arrears */}
        <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-3">
          <CardTitle linkTo="/reports" linkLabel="View all">Top Arrears</CardTitle>
          {loading ? (
            <Skeleton radius="card" className="h-40 w-full" />
          ) : topArrears.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-8 text-center">No arrears — all rent is up to date.</p>
          ) : (
            <div className="flex flex-col">
              {topArrears.map((row) => (
                <div key={row.tenancy_id} className="flex items-center justify-between gap-3 py-2.5 border-b border-card-border/60 last:border-0">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-brand-primary truncate">{row.tenant_name}</p>
                    <p className="text-2xs font-semibold text-gray-400 truncate mt-0.5">{row.property_address}</p>
                  </div>
                  <span className="text-xs font-bold text-status-danger tabular-nums shrink-0">{money(row.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Alerts & Tasks + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-3 lg:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-card-border select-none">
            <h3 className="flex items-center gap-2 text-sm-portal font-bold text-brand-primary">
              Recent Alerts &amp; Tasks
              {alertsTotal > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-status-danger text-white text-2xs font-bold flex items-center justify-center">
                  {alertsTotal}
                </span>
              )}
            </h3>
            <Link to="/reports" className="text-2xs font-bold text-brand-accent hover:text-brand-accent-hover transition-colors shrink-0">
              View all tasks &amp; alerts
            </Link>
          </div>
          {loading ? (
            <Skeleton radius="card" className="h-48 w-full" />
          ) : alerts.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-8 text-center">
              Nothing needs attention — no expiring certificates, unregistered deposits, urgent maintenance or pending payments.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="text-left">
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Type</th>
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Description</th>
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Related To</th>
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Due</th>
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Priority</th>
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a, i) => {
                    const type = ALERT_TYPES[a.type] || { label: a.type, cls: 'bg-surface-hover text-gray-400' };
                    const status = ALERT_STATUSES[a.status] || { label: a.status, cls: 'bg-surface-hover text-gray-400' };
                    return (
                      <tr key={i} className="border-t border-card-border/60">
                        <td className="py-2.5 pr-3">
                          <span className={`px-2 py-0.5 rounded-sm text-2xs font-bold whitespace-nowrap ${type.cls}`}>{type.label}</span>
                        </td>
                        <td className="py-2.5 pr-3 text-xs font-semibold text-brand-primary">{a.description}</td>
                        <td className="py-2.5 pr-3 text-xs font-semibold text-gray-400 whitespace-nowrap">{a.related_to}</td>
                        <td className={`py-2.5 pr-3 text-xs font-bold whitespace-nowrap ${
                          a.due === 'Overdue' ? 'text-status-danger' : a.due === 'Today' ? 'text-status-warning' : 'text-gray-400'
                        }`}>
                          {a.due || '—'}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className={`px-2 py-0.5 rounded-sm text-2xs font-bold ${PRIORITY_STYLES[a.priority] || ''}`}>
                            {a.priority === 'high' ? 'High' : 'Medium'}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-sm text-2xs font-bold whitespace-nowrap ${status.cls}`}>{status.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-3">
          <CardTitle>Quick Actions</CardTitle>
          <div className="flex flex-col">
            {QUICK_ACTIONS.map(({ label, to, icon: Icon }) => (
              <Link
                key={label}
                to={to}
                className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-hover transition-colors"
              >
                <span className="w-7 h-7 rounded-lg bg-brand-accent/10 text-brand-accent flex items-center justify-center shrink-0">
                  <Icon size={14} />
                </span>
                <span className="text-xs font-bold text-brand-primary truncate">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
