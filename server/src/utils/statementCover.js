import db from '../config/db.js';
import { toYmd, addDays } from './dateHelpers.js';

// A statement that already covers a rent month, so Rent Cycle doesn't make a
// second one for the same rent: one made on the Statements page (Generate
// Statement; issued only — a draft never sent doesn't count) or a historic one
// (made before Roca Living took over, F62). A month counts as covered when the
// statement's period holds the middle of the rent period, so a calendar-month
// statement and a 28th–27th rent month still pair up with the right month.
// Returns { statement_number, period_start, period_end, historic } or null.
export const issuedStatementCovering = async (tenancyId, fromYmd, toYmdDate) => {
  if (!tenancyId || !fromYmd) return null;
  const days = toYmdDate && toYmdDate > fromYmd
    ? Math.round((Date.parse(`${toYmdDate}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / 86400000)
    : 0;
  const mid = addDays(fromYmd, Math.floor(days / 2));
  const holds = (s) => s.period_start && s.period_end && toYmd(s.period_start) <= mid && mid <= toYmd(s.period_end);
  const issued = await db('landlord_statements')
    .where('tenancy_id', tenancyId)
    .where((w) => w.whereNot('status', 'draft').orWhereNotNull('sent_at'))
    .orderBy('period_start')
    .select('statement_number', 'period_start', 'period_end');
  let hit = issued.find(holds);
  let historic = false;
  if (!hit && (await db.schema.hasTable('historic_statements'))) {
    const t = await db('tenancies').where('id', tenancyId).first('property_id');
    if (t) {
      const old = await db('historic_statements').where('property_id', t.property_id).orderBy('period_start')
        .select('statement_number', 'period_start', 'period_end');
      hit = old.find(holds);
      historic = !!hit;
    }
  }
  return hit ? { statement_number: hit.statement_number, period_start: toYmd(hit.period_start), period_end: toYmd(hit.period_end), historic } : null;
};
