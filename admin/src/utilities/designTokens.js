// Shared colours for the design-style pages (RL_Admin_Portal Design.pdf):
// chart colours and Tailwind classes per tone. Real pages (DesignKit) and the
// dummy-data pages (pages/mock) use the same values.

// Chart colours (same palette as CashflowOverview / Compliance charts)
export const C = {
  green: '#3A7D44',
  indigo: '#4F46E5',
  amber: '#E8A020',
  orange: '#F16900',
  blue: '#0A58CA',
  red: '#C62828',
  purple: '#7C3AED',
  teal: '#0E9F9A',
  pink: '#DB2777',
  grey: '#9CA3AF',
};

// Tailwind classes per tone (icon circle, pill, text)
export const TONES = {
  green: { icon: 'text-status-success bg-status-success/10', pill: 'bg-status-success-bg text-status-success', text: 'text-status-success' },
  indigo: { icon: 'text-brand-accent bg-brand-accent/10', pill: 'bg-brand-accent/10 text-brand-accent', text: 'text-brand-accent' },
  orange: { icon: 'text-status-warning bg-status-warning/10', pill: 'bg-status-warning/10 text-status-warning', text: 'text-status-warning' },
  red: { icon: 'text-status-danger bg-status-danger/10', pill: 'bg-status-danger-bg text-status-danger', text: 'text-status-danger' },
  blue: { icon: 'text-status-info bg-status-info/10', pill: 'bg-status-info-bg text-status-info', text: 'text-status-info' },
  grey: { icon: 'text-status-muted bg-surface-hover', pill: 'bg-surface-hover text-gray-500', text: 'text-gray-400' },
};

// "£1,950.00" — money as the design shows it.
export const gbp = (v) => `£${Number(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// "12 Jun 2024" from YYYY-MM-DD or a date.
export const shortDate = (v) => {
  if (!v) return '—';
  const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v);
  // Non-breaking spaces: a date never wraps onto three lines in a narrow column
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, ' ');
};

// Whole days from today to a date (negative = past).
export const daysUntil = (v) => {
  if (!v) return null;
  const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((d - today) / 86400000);
};

// Share of a total as "90.5%".
export const pct = (part, total) => (total ? `${Math.round((part / total) * 1000) / 10}%` : '0%');
