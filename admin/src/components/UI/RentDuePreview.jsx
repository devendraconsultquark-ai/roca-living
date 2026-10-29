import { useEffect, useState } from 'react';
import api from '../../utilities/api';

const money = (n) => `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const uk = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '');
const ordinal = (d) => `${d}${[11, 12, 13].includes(d % 100) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[d % 10] || 'th')}`;

// What the first rent payment will be for a start date, rent and due day: a
// pro-rata first payment when rent is due on a different day than the start
// (worked out by the server, so the preview matches the rent months exactly).
// tenancyId: an existing tenancy — once it has a statement, the change starts
// at the next open period with a short pro-rata period (shown instead).
export const RentDuePreview = ({ startDate, rent, rentDueDay, tenancyId = null }) => {
  const [preview, setPreview] = useState(null);
  const ready = !!startDate && parseFloat(rent) > 0 && rentDueDay !== '' && Number(rentDueDay) >= 1 && Number(rentDueDay) <= 28;

  useEffect(() => {
    if (!ready) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/tenancies/rent-preview', {
          params: { start_date: startDate, rent_pcm: rent, rent_due_day: rentDueDay, ...(tenancyId ? { tenancy_id: tenancyId } : {}) },
          skipInterceptorError: true,
        });
        if (!cancelled) setPreview(res.data.data);
      } catch {
        if (!cancelled) setPreview(null);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [ready, startDate, rent, rentDueDay, tenancyId]);

  if (!ready || !preview) return null;
  if (preview.change) {
    const c = preview.change;
    return (
      <div className="text-xs-portal bg-status-info-bg border border-status-info/15 rounded-card px-3 py-2 text-brand-primary">
        <p className="font-semibold">{preview.message}</p>
        {c.pro_rata && (
          <p className="text-status-muted mt-0.5">
            {c.pro_rata.segments.map((seg) => `${uk(seg.from)}–${uk(seg.to)}: ${seg.days} day${seg.days === 1 ? '' : 's'} × ${money(preview.rent_pcm)}/${seg.days_in_month} = ${money(seg.amount)}`).join(' · ')}
          </p>
        )}
      </div>
    );
  }
  const first = preview.first_payment;
  if (!first) {
    return <p className="text-xs-portal text-status-muted">Same as the start day: £{parseFloat(rent).toFixed(2)} on the {ordinal(preview.rent_due_day)} of each month.</p>;
  }
  return (
    <div className="text-xs-portal bg-status-info-bg border border-status-info/15 rounded-card px-3 py-2 text-brand-primary">
      <p className="font-semibold">
        First payment {money(first.amount)} due {uk(first.due_date)} (covers {uk(first.due_date)} – {uk(first.covered_to)}), then {money(first.full_month.amount)} on the {ordinal(first.due_day)} of each month from {uk(first.next_due)}.
      </p>
      <p className="text-status-muted mt-0.5">
        {first.pro_rata.segments.map((seg) => `${uk(seg.from)}–${uk(seg.to)}: ${seg.days} day${seg.days === 1 ? '' : 's'} × ${money(first.full_month.amount)}/${seg.days_in_month} = ${money(seg.amount)}`).join(' · ')}
        {` · ${uk(first.full_month.from)}–${uk(first.full_month.to)}: ${money(first.full_month.amount)}`}
      </p>
    </div>
  );
};
