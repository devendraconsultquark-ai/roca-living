import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell } from 'recharts';
import { FlaskConical, ChevronRight, ChevronLeft, ArrowRight, Download, Plus, Search, Filter } from 'lucide-react';
import { Button } from '../../components/UI/Button';
import { useDummyToast, TONES } from './mockUtils';

// Building blocks for the dummy-data pages. Every card carries a "Dummy data"
// tag and every button only shows the "under development" toast.


export const DummyTag = () => (
  <span className="px-1.5 py-0.5 rounded-sm bg-status-warning/10 text-status-warning text-[10px] font-bold whitespace-nowrap select-none">
    Dummy data
  </span>
);

export const DummyBanner = ({ related = [] }) => (
  <div className="border border-status-warning/40 bg-status-warning/10 rounded-card px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
    <p className="flex items-start gap-2.5 text-xs font-bold text-status-warning">
      <FlaskConical size={16} className="shrink-0 mt-px" />
      <span>
        Dummy data — sample from the approved design, not real. This page is under development.
      </span>
    </p>
    {related.length > 0 && (
      <div className="flex items-center gap-3 flex-wrap text-xs font-bold">
        <span className="text-gray-500">Use this now:</span>
        {related.map((r) => (
          <Link key={r.path + r.label} to={r.path} title={r.note} className="flex items-center gap-1 text-brand-accent hover:underline">
            {r.label} <ArrowRight size={12} />
          </Link>
        ))}
      </div>
    )}
  </div>
);

// Page-level action row (design: Export + primary button, top right)
export const MockActions = ({ primary, primaryIcon = Plus, extra = [] }) => {
  const dummy = useDummyToast();
  return (
    <div className="flex items-center justify-end gap-2 flex-wrap">
      {extra.map((label) => (
        <Button key={label} variant="secondary" size="sm" onClick={dummy}>{label}</Button>
      ))}
      <Button variant="secondary" size="sm" icon={Download} onClick={dummy}>Export</Button>
      {primary && <Button variant="accent" size="sm" icon={primaryIcon} onClick={dummy}>{primary}</Button>}
    </div>
  );
};

export const MockCard = ({ title, sub, action = 'View all', className = '', children }) => {
  const dummy = useDummyToast();
  return (
    <div className={`card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-3 min-w-0 ${className}`}>
      {title && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 flex-wrap text-sm-portal font-bold text-brand-primary">
              {title} <DummyTag />
            </h3>
            {sub && <p className="text-[11px] leading-snug text-gray-400 font-semibold mt-0.5">{sub}</p>}
          </div>
          {action && (
            <button type="button" onClick={dummy} className="text-2xs font-bold text-brand-accent hover:underline cursor-pointer shrink-0">
              {action}
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

export const MockKpi = ({ icon: Icon, tone = 'indigo', label, value, sub, subTone, link }) => {
  const dummy = useDummyToast();
  return (
    <div className="card-bg border border-card-border rounded-card shadow-premium p-4 flex gap-3 min-w-0">
      {Icon && (
        <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${TONES[tone].icon}`}>
          <Icon size={19} />
        </span>
      )}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[11px] text-gray-400 font-semibold leading-snug">{label}</span>
        <span className="text-lg font-bold text-brand-primary mt-1 leading-tight">{value}</span>
        {sub && <span className={`text-[11px] font-semibold mt-1 ${subTone ? TONES[subTone].text : 'text-gray-400'}`}>{sub}</span>}
        <div className="flex items-end justify-between gap-2 mt-2 flex-wrap">
          {link ? (
            <button type="button" onClick={dummy} className="text-left text-2xs font-bold text-brand-accent hover:underline cursor-pointer">
              {link}
            </button>
          ) : <span />}
          <DummyTag />
        </div>
      </div>
    </div>
  );
};

export const Pill = ({ tone = 'grey', children }) => (
  <span className={`inline-block px-2 py-0.5 rounded-sm text-2xs font-bold whitespace-nowrap ${TONES[tone].pill}`}>{children}</span>
);

export const Amount = ({ value, tone }) => (
  <span className={`text-xs font-bold tabular-nums whitespace-nowrap ${tone ? TONES[tone].text : 'text-brand-primary'}`}>{value}</span>
);

// Two-line cell: bold line over a grey line
export const Two = ({ top, bottom, link }) => (
  <span className="block min-w-0">
    <span className={`block text-xs font-bold ${link ? 'text-brand-accent' : 'text-brand-primary'}`}>{top}</span>
    {bottom && <span className="block text-[11px] text-gray-400 font-semibold mt-0.5">{bottom}</span>}
  </span>
);

export const Avatar = ({ name }) => (
  <span className="w-8 h-8 rounded-full bg-brand-accent/10 text-brand-accent text-2xs font-bold flex items-center justify-center shrink-0 uppercase">
    {name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
  </span>
);

export const MockTabs = ({ tabs, value, onChange }) => (
  <div className="flex items-center gap-5 border-b border-card-border overflow-x-auto no-scrollbar">
    {tabs.map((t) => {
      const id = t.id ?? t;
      const label = t.label ?? t;
      return (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`pb-2.5 -mb-px border-b-2 text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
            value === id ? 'border-brand-accent text-brand-accent' : 'border-transparent text-gray-400 hover:text-brand-primary'
          }`}
        >
          {label}{t.count !== undefined ? ` (${t.count})` : ''}
        </button>
      );
    })}
  </div>
);

// Search box + filter buttons above a table (inert)
export const MockFilters = ({ search = 'Search…', filters = [] }) => {
  const dummy = useDummyToast();
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button type="button" onClick={dummy} className="flex items-center gap-2 h-9 px-3 min-w-[200px] rounded-lg border border-card-border text-xs text-gray-400 font-semibold cursor-text">
        <Search size={14} /> {search}
      </button>
      {filters.map((f) => (
        <button key={f} type="button" onClick={dummy} className="flex items-center gap-2 h-9 px-3 rounded-lg border border-card-border text-xs text-brand-primary font-semibold cursor-pointer hover:bg-surface-hover">
          {f}
        </button>
      ))}
      <button type="button" onClick={dummy} className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-card-border text-xs text-brand-primary font-bold cursor-pointer hover:bg-surface-hover">
        <Filter size={13} /> Filter
      </button>
    </div>
  );
};

export const MockTable = ({ columns, rows, minWidth = 720 }) => (
  <div className="overflow-x-auto">
    <table className="w-full" style={{ minWidth }}>
      <thead>
        <tr className="text-left">
          {columns.map((c) => (
            <th key={c.label ?? c} className={`text-2xs font-bold text-gray-400 capitalize pb-2 pr-3 whitespace-nowrap ${c.right ? 'text-right' : ''}`}>
              {c.label ?? c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-card-border/60 align-middle">
            {r.map((cell, j) => (
              <td key={j} className={`py-2.5 pr-3 text-xs font-semibold text-gray-500 whitespace-nowrap ${columns[j]?.right ? 'text-right' : ''}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const MockPagination = ({ text, pages = 3 }) => {
  const dummy = useDummyToast();
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
      <span className="text-[11px] text-gray-400 font-semibold">{text}</span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={dummy} className="w-7 h-7 rounded-md border border-card-border flex items-center justify-center text-gray-400 cursor-pointer"><ChevronLeft size={13} /></button>
        {Array.from({ length: pages }, (_, i) => (
          <button key={i} type="button" onClick={dummy} className={`w-7 h-7 rounded-md text-2xs font-bold cursor-pointer ${i === 0 ? 'bg-brand-accent text-white' : 'border border-card-border text-brand-primary'}`}>
            {i + 1}
          </button>
        ))}
        <button type="button" onClick={dummy} className="w-7 h-7 rounded-md border border-card-border flex items-center justify-center text-gray-400 cursor-pointer"><ChevronRight size={13} /></button>
      </div>
    </div>
  );
};

// Donut with a centre figure and a legend: data = [{ label, value, color, display }]
export const MockDonut = ({ data, centre, sub, size = 130 }) => (
  <div className="flex items-center gap-5 flex-wrap">
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Pie data={data} dataKey="value" innerRadius={size * 0.36} outerRadius={size * 0.48} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
          {data.map((d) => <Cell key={d.label} fill={d.color} />)}
        </Pie>
      </PieChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
        <span className="text-base font-bold text-brand-primary leading-none">{centre}</span>
        {sub && <span className="text-[11px] text-gray-400 font-semibold mt-1">{sub}</span>}
      </div>
    </div>
    <div className="flex flex-col gap-2 flex-1 min-w-[210px]">
      {data.map((d) => (
        <div key={d.label} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[11px] font-semibold text-gray-500 whitespace-nowrap">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            {d.label}
          </span>
          <span className="text-[11px] font-bold text-brand-primary tabular-nums whitespace-nowrap">{d.display ?? d.value}</span>
        </div>
      ))}
    </div>
  </div>
);

// Label / value rows (summaries)
export const MockRows = ({ rows }) => (
  <div className="flex flex-col">
    {rows.map(([label, value, tone, bold], i) => (
      <div key={`${label}-${i}`} className="flex items-center justify-between gap-3 py-1.5">
        <span className={`text-xs ${bold ? 'font-bold text-brand-primary' : 'font-semibold text-gray-500'}`}>{label}</span>
        <span className={`text-xs font-bold tabular-nums ${tone ? TONES[tone].text : 'text-brand-primary'}`}>{value}</span>
      </div>
    ))}
  </div>
);

export const MockQuickActions = ({ items }) => {
  const dummy = useDummyToast();
  return (
    <MockCard title="Quick Actions" action={null}>
      <div className="flex flex-col">
        {items.map(({ icon: Icon, label, sub }) => (
          <button key={label} type="button" onClick={dummy} className="flex items-center gap-3 px-1 py-2 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer text-left">
            <span className="w-8 h-8 rounded-lg bg-brand-accent/10 text-brand-accent flex items-center justify-center shrink-0">
              <Icon size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-brand-accent">{label}</span>
              {sub && <span className="block text-[11px] text-gray-400 font-semibold">{sub}</span>}
            </span>
            <ChevronRight size={14} className="text-gray-400 shrink-0" />
          </button>
        ))}
      </div>
    </MockCard>
  );
};

// Activity list: [{ icon, tone, title, sub, right, date }]
export const MockActivity = ({ title = 'Recent Activity', items }) => (
  <MockCard title={title}>
    <div className="flex flex-col">
      {items.map(({ icon: Icon, tone = 'indigo', title: t, sub, right, date }, i) => (
        <div key={i} className="flex items-start gap-3 py-2 border-b border-card-border/60 last:border-0">
          <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${TONES[tone].icon}`}>
            <Icon size={14} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-brand-primary">{t}</span>
            {sub && <span className="block text-[11px] text-gray-400 font-semibold mt-0.5">{sub}</span>}
          </span>
          <span className="text-right shrink-0">
            {right && <span className="block text-xs font-bold text-brand-primary tabular-nums">{right}</span>}
            {date && <span className="block text-[11px] text-gray-400 font-semibold">{date}</span>}
          </span>
        </div>
      ))}
    </div>
  </MockCard>
);

// Small stat strip (Today / This week / …): [{ label, value, sub }]
export const MockStrip = ({ items }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-surface-light/60 rounded-lg p-3">
    {items.map((s) => (
      <div key={s.label} className="flex flex-col">
        <span className="text-[11px] text-gray-400 font-semibold">{s.label}</span>
        <span className="text-sm font-bold text-brand-primary mt-0.5">{s.value}</span>
        {s.sub && <span className="text-[11px] text-gray-400 font-semibold">{s.sub}</span>}
      </div>
    ))}
  </div>
);

