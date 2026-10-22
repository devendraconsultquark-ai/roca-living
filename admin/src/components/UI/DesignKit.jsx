import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell } from 'recharts';
import { ChevronRight, Info, RefreshCw, Search, MoreHorizontal } from 'lucide-react';
import { TONES } from '../../utilities/designTokens';

// Building blocks of the approved admin design (RL_Admin_Portal Design.pdf):
// every list page is an action row, a row of KPI cards with "View …" links, a
// main card and a right-hand column (donut, "Upcoming" list, Quick Actions),
// with an info bar at the foot. Real data only; a figure we don't hold shows
// <NotTracked />. Links take `to` (a route) or `onClick`.

const LinkOrButton = ({ to, onClick, className, children }) => (to
  ? <Link to={to} className={className}>{children}</Link>
  : <button type="button" onClick={onClick} className={`${className} text-left cursor-pointer`}>{children}</button>);

// Right-aligned page buttons (Export, + New …): the title is in the layout header.
export const PageActions = ({ children }) => (
  <div className="flex items-center justify-end gap-2 flex-wrap">{children}</div>
);

// The row of KPI cards (5 across on wide screens, as in the design).
export const KpiRow = ({ children, cols = 5 }) => (
  <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${cols === 6 ? 'xl:grid-cols-6' : cols === 4 ? 'xl:grid-cols-4' : cols === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-5'}`}>
    {children}
  </div>
);

// Icon circle, label, big value, grey line, "View …" link.
// Icon and label on one line, the value under them at full card width, so
// six cards fit across without cutting money values short.
export const KpiCard = ({ icon: Icon, tone = 'indigo', label, value, sub, subTone, link, to, onClick, loading }) => (
  <div className="card-bg border border-card-border rounded-card shadow-premium p-4 flex flex-col min-w-0 h-full">
    <div className="flex items-center gap-2.5 min-w-0">
      {Icon && (
        <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${TONES[tone].icon}`}>
          <Icon size={17} />
        </span>
      )}
      <span className="text-xs text-gray-500 font-semibold leading-snug min-w-0">{label}</span>
    </div>
    <span className="text-[22px] font-bold text-brand-primary mt-3 leading-tight truncate tabular-nums" title={typeof value === 'string' ? value : undefined}>{loading ? '…' : value}</span>
    {sub && <span className={`text-[11px] font-semibold mt-1 leading-snug ${subTone ? TONES[subTone].text : 'text-gray-400'}`}>{sub}</span>}
    {link && (to || onClick) && (
      <LinkOrButton to={to} onClick={onClick} className="mt-auto pt-3 text-xs font-bold text-brand-accent hover:underline w-fit whitespace-nowrap">
        {link}
      </LinkOrButton>
    )}
  </div>
);

// Main area + right-hand column.
export const WithRail = ({ children, rail }) => (
  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
    <div className="flex flex-col gap-6 min-w-0">{children}</div>
    <aside className="flex flex-col gap-6 min-w-0">{rail}</aside>
  </div>
);

// A card with a title, an optional grey line and an optional "View all" link.
export const SectionCard = ({ title, sub, action, to, onAction, className = '', children }) => (
  <div className={`card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-3 min-w-0 ${className}`}>
    {(title || action) && (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {title && <h3 className="text-[15px] font-bold text-brand-primary tracking-tight">{title}</h3>}
          {sub && <p className="text-[11px] leading-snug text-gray-400 font-semibold mt-0.5">{sub}</p>}
        </div>
        {action && (to || onAction) && (
          <LinkOrButton to={to} onClick={onAction} className="text-xs font-bold text-brand-accent hover:underline shrink-0">
            {action}
          </LinkOrButton>
        )}
      </div>
    )}
    {children}
  </div>
);

// Donut with a centre figure and a legend: data = [{ label, value, color, display }].
export const Donut = ({ data, centre, sub, size = 130 }) => {
  const shown = data.filter((d) => d.value > 0);
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <PieChart width={size} height={size}>
          <Pie
            data={shown.length ? shown : [{ label: 'none', value: 1, color: '#E5E7EB' }]}
            dataKey="value"
            innerRadius={size * 0.36}
            outerRadius={size * 0.48}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
          >
            {(shown.length ? shown : [{ label: 'none', color: '#E5E7EB' }]).map((d) => <Cell key={d.label} fill={d.color} />)}
          </Pie>
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
          <span className="text-base font-bold text-brand-primary leading-none">{centre}</span>
          {sub && <span className="text-[11px] text-gray-400 font-semibold mt-1">{sub}</span>}
        </div>
      </div>
      <div className="flex flex-col gap-2 flex-1 min-w-[180px]">
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
};

// "Upcoming …" list: [{ key, title, sub, date, badge, badgeTone, to, onClick }].
export const UpcomingList = ({ items, empty = 'Nothing coming up.' }) => {
  if (!items.length) return <p className="text-[11px] text-gray-400 font-semibold py-2">{empty}</p>;
  return (
    <div className="flex flex-col">
      {items.map((it) => {
        const body = (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-brand-primary truncate">{it.title}</span>
              {it.sub && <span className="block text-[11px] text-gray-400 font-semibold truncate">{it.sub}</span>}
            </span>
            <span className="flex flex-col items-end gap-1 shrink-0">
              {it.date && <span className="text-[11px] font-semibold text-gray-500 whitespace-nowrap">{it.date}</span>}
              {it.badge && <Pill tone={it.badgeTone || 'grey'}>{it.badge}</Pill>}
            </span>
          </>
        );
        const cls = 'flex items-center gap-3 py-2 border-b border-card-border/60 last:border-0';
        return it.to || it.onClick ? (
          <LinkOrButton key={it.key ?? it.title} to={it.to} onClick={it.onClick} className={`${cls} hover:bg-surface-light/60 rounded-md px-1 -mx-1`}>{body}</LinkOrButton>
        ) : (
          <div key={it.key ?? it.title} className={cls}>{body}</div>
        );
      })}
    </div>
  );
};

// Quick Actions card: [{ icon, label, sub, to, onClick }].
export const QuickActions = ({ items, title = 'Quick Actions' }) => (
  <SectionCard title={title}>
    <div className="flex flex-col">
      {items.map(({ icon: Icon, label, sub, to, onClick }) => (
        <LinkOrButton key={label} to={to} onClick={onClick} className="flex items-center gap-3 px-1 py-2 rounded-lg hover:bg-surface-hover transition-colors">
          <span className="w-8 h-8 rounded-lg bg-brand-accent/10 text-brand-accent flex items-center justify-center shrink-0">
            <Icon size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-brand-accent">{label}</span>
            {sub && <span className="block text-[11px] text-gray-400 font-semibold">{sub}</span>}
          </span>
          <ChevronRight size={14} className="text-gray-400 shrink-0" />
        </LinkOrButton>
      ))}
    </div>
  </SectionCard>
);

// Info bar at the foot of a page (design: "ⓘ … · Last updated …").
export const InfoFooter = ({ text, onRefresh }) => (
  <div className="flex items-center justify-between gap-3 flex-wrap bg-surface-light/60 border border-card-border rounded-card px-4 py-2.5">
    <span className="flex items-center gap-2 text-[11px] font-semibold text-gray-500">
      <Info size={13} className="shrink-0" /> {text}
    </span>
    <span className="flex items-center gap-2 text-[11px] font-semibold text-gray-400">
      Last updated {new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
      {onRefresh && (
        <button type="button" onClick={onRefresh} className="text-gray-400 hover:text-brand-primary cursor-pointer" aria-label="Refresh">
          <RefreshCw size={13} />
        </button>
      )}
    </span>
  </div>
);

export const Pill = ({ tone = 'grey', children }) => (
  <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap ${TONES[tone].pill}`}>{children}</span>
);

// Initials circle ("JA").
export const Avatar = ({ name }) => (
  <span className="w-8 h-8 rounded-full bg-brand-accent/10 text-brand-accent text-[11px] font-bold flex items-center justify-center shrink-0 uppercase">
    {String(name || '?').trim().split(/\s+/).map((n) => n[0]).join('').slice(0, 2) || '?'}
  </span>
);

// Two-line cell: bold line over a grey line, one line each (long text is cut
// with "…" and shown in full on hover), so table rows stay one height.
export const Two = ({ top, bottom, accent, width = 'max-w-[260px]' }) => (
  <span className={`block min-w-0 ${width}`}>
    <span className={`block text-xs font-bold truncate ${accent ? 'text-brand-accent' : 'text-brand-primary'}`} title={typeof top === 'string' ? top : undefined}>{top}</span>
    {bottom && <span className="block text-[11px] text-gray-400 font-semibold mt-0.5 truncate" title={typeof bottom === 'string' ? bottom : undefined}>{bottom}</span>}
  </span>
);

// Avatar + two lines (tenant / landlord cells).
export const PersonCell = ({ name, sub }) => (
  <span className="flex items-center gap-3 min-w-0">
    <Avatar name={name} />
    <Two top={name} bottom={sub} width="max-w-[220px]" />
  </span>
);

// A figure or widget we don't hold data for (agreed 14 Oct): never a made-up number.
export const NotTracked = ({ what }) => (
  <span className="text-[11px] font-semibold text-gray-400 italic" title={what ? `${what} is not tracked in Roca Living yet` : undefined}>
    Not tracked yet
  </span>
);

// Label / value rows inside a card: [[label, value, tone, bold]].
export const KeyValues = ({ rows }) => (
  <div className="flex flex-col">
    {rows.map(([label, value, tone, bold], i) => (
      <div key={`${label}-${i}`} className="flex items-center justify-between gap-3 py-1.5 border-b border-card-border/40 last:border-0">
        <span className={`text-xs ${bold ? 'font-bold text-brand-primary' : 'font-semibold text-gray-500'}`}>{label}</span>
        <span className={`text-xs font-bold tabular-nums text-right ${tone ? TONES[tone].text : 'text-brand-primary'}`}>{value}</span>
      </div>
    ))}
  </div>
);

// Search box above a table.
export const SearchInput = ({ value, onChange, placeholder = 'Search…', className = 'w-full md:w-72' }) => (
  <div className={`relative ${className}`}>
    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full pl-9 pr-3 py-2.5 border border-card-border rounded-lg text-sm focus:outline-none focus:border-brand-accent bg-white"
    />
  </div>
);

// The "…" menu at the end of a table row: [{ label, onClick, danger }].
// Its clicks never open the row.
export const RowMenu = ({ items, label = 'Actions' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const shown = items.filter(Boolean);
  if (!shown.length) return null;
  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded-lg text-status-muted hover:text-brand-primary hover:bg-surface-hover cursor-pointer"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1 z-30 min-w-[180px] bg-white border border-card-border rounded-card shadow-xl py-1">
          {shown.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); it.onClick(); }}
              className={`w-full text-left px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-surface-hover ${it.danger ? 'text-status-danger' : 'text-brand-primary'}`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
