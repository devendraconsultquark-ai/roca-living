// Tenancy facts shown to landlords, from real data only (no fixed claims).
// `t` is a tenancy from GET /tenancies/my.

// Every Parsons tenancy agreement is an Assured Periodic Tenancy, and the
// statements say the same.
export const TENANCY_TYPE = 'Assured Periodic Tenancy (APT)';

const gb = (ymd) =>
  ymd ? new Date(`${String(ymd).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

export const ordinal = (n) => {
  const v = n % 100;
  const s = v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  return `${n}${s}`;
};

// Day of the month rent is due: the stored due day, else the tenancy start day.
export const dueDayOf = (t) => {
  if (!t) return null;
  if (t.rent_due_day) return Number(t.rent_due_day);
  return t.start_date ? Number(String(t.start_date).slice(8, 10)) : null;
};

export const dueLabel = (t) => {
  const d = dueDayOf(t);
  return d ? `Due ${ordinal(d)} Monthly` : '—';
};

// Deposit protection as recorded on the deposit.
export const depositLabel = (t) => {
  if (!t) return '-';
  if (t.deposit_status === 'registered') return `Protected${t.deposit_scheme && t.deposit_scheme !== '-' ? ` (${t.deposit_scheme})` : ''}`;
  if (t.deposit_status === 'pending_registration') return 'Not Yet Protected';
  if (t.deposit_status) return t.deposit_status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return 'No Deposit Recorded';
};

export const reviewLabel = (t) => (t && t.rent_review_date ? gb(t.rent_review_date) : '—');

// Tenant compliance: Right to Rent verified, and the deposit protected (when
// there is one). null = nothing to check.
export const tenantCompliancePct = (t) => {
  if (!t) return null;
  const checks = [t.lead_right_to_rent === 'verified'];
  if (t.deposit_status) checks.push(t.deposit_status === 'registered');
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};

// Paid to the landlord for one flat: payouts of statements marked paid.
export const netPaidOf = (statements, propertyId) =>
  (statements || [])
    .filter((s) => String(s.property_id) === String(propertyId) && String(s.status).toLowerCase() === 'paid')
    .reduce((sum, s) => sum + (Number(s.payout) || 0), 0);
