// Correct the Parsons House flats Roca Living manages (PH-8, 13, 19, 31, 33, 36)
// to the signed documents in the client's Dropbox (checked 27 Oct 2026):
// tenancy start, rent, due day, "Rent handled in Roca Living from" (the day
// after the client's last hand-made statement) and the last hand-made number,
// deposits, and the owners' NRL numbers in ROCA Estates. Run from the server
// folder, so it uses this server's .env:
//
//   node scripts/fix-parsons-data.mjs
//       → DRY RUN (default): shows every change, including what the next Xero
//         push would void or create, and writes nothing
//   node scripts/fix-parsons-data.mjs --apply --rl-db=<roca living db>
//       → does it. The name must match the database this .env connects to.
//
// Options:
//   --remove-early-payments   rent recorded before a flat's "from" date is
//                             removed: the client's hand-made statements already
//                             reported it. Typed-in payments go; a Xero bank line
//                             it was matched to becomes Ignored; a payment on Roca
//                             Living's Xero rent invoice goes and that invoice is
//                             no longer tracked here (it stays paid in Xero).
//                             Without it such a flat is refused.
//   --delete-sent=PH_36_0001  also delete these SENT statements (test data only)
//
// A flat is refused (left as it is) if it has a sent statement, or rent before
// its "from" date that a landlord bill, an approved-rent statement or Rent Cycle
// deductions were made from, or a part-paid Xero rent invoice for a month that
// would go. Safe to run again: matching flats show "nothing to change".
// Back the database up first (mysqldump).
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const REMOVE_EARLY = process.argv.includes('--remove-early-payments');
const argValue = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || null;
const DELETE_SENT = (argValue('delete-sent') || '').split(',').map((s) => s.trim()).filter(Boolean);

const mod = (rel) => import(pathToFileURL(path.join(HERE, '..', rel)).href);
const { emDb, default: db } = await mod('src/config/db.js');
const { generateSchedules, proRataRent, nextDueOnOrAfter, dueDayOf } = await mod('src/utils/rentSchedules.js');
const { allocateTenancyPayments } = await mod('src/utils/rentAllocation.js');
const { estatesApi, estatesApiReady } = await mod('src/utils/estatesApi.js');
const { toYmd, todayYmd, addDays } = await mod('src/utils/dateHelpers.js');
const done = async (code = 0) => { await db.destroy(); await emDb.destroy(); process.exit(code); };

const [[{ d: rlName }]] = await db.raw('SELECT DATABASE() AS d');
if (APPLY && argValue('rl-db') !== rlName) {
  console.log(`REFUSED: connected to ${rlName}. To apply, pass exactly --rl-db=${rlName}`);
  await done(1);
}
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} on ${rlName} (Roca Living)\n`);

// ── What the documents say ───────────────────────────────────────────────────
// from = day after the client's last hand-made statement; lastSeq = its number.
const FLATS = [
  { apt: '8', start: '2026-08-22', rent: 595, dueDay: 2, from: '2026-11-02', lastSeq: 2, source: 'PH_8_0002 to 01/11/2026; agreement £595' },
  { apt: '13', start: '2026-06-23', rent: 850, dueDay: 23, from: '2026-11-23', lastSeq: 5, source: 'tenancy agreement 23/06/2026; PH_13_0005 to 22/11/2026',
    deposit: { amount: 980.77, scheme: 'TDS', received: '2026-06-23', registered: null, note: 'TDS (no certificate in the client\'s Dropbox — check the registration)' } },
  { apt: '19', start: '2026-08-28', rent: 795, dueDay: 28, from: '2026-11-01', lastSeq: 5, source: 'tenancy agreement 28/08/2026; PH_19_0005 to 31/10/2026',
    deposit: { amount: 917.31, scheme: 'TDS', received: '2026-08-28', registered: '2026-09-07', note: 'TDS ref EW48897287' } },
  { apt: '31', start: '2026-08-28', rent: 970, dueDay: 28, from: '2026-10-28', lastSeq: 2, source: 'tenancy agreement 28/08/2026; PH_31_0002 to 27/10/2026',
    deposit: { amount: 1096.15, scheme: 'TDS', received: '2026-08-28', registered: '2026-09-07', note: 'TDS ref EW48897233' } },
  { apt: '33', start: '2026-05-25', rent: 965, dueDay: 25, from: '2026-11-25', lastSeq: 6, source: 'tenancy agreement 25/05/2026; PH_33_0006 to 24/11/2026',
    deposit: { amount: 1096.15, scheme: 'TDS', received: '2026-05-25', registered: '2026-06-03', note: 'TDS ref EW46832166' } },
  { apt: '36', start: '2026-06-17', rent: 985, dueDay: 17, from: '2026-11-17', lastSeq: 5, source: 'tenancy agreement 17/06/2026; PH_36_0005 to 16/11/2026',
    deposit: { amount: 975, scheme: 'TDS', received: '2026-06-17', registered: '2026-06-26', note: 'TDS ref EW47220044' } },
];
// Owners' NRL numbers (HMRC letters / statements). `name` must match ROCA
// Estates' main owner, so a number never lands on the wrong person.
const NRL = [
  { apt: '5', name: 'Dennis Kroon', nrl: '922/NL946117', initials: 'DK', second: 'Jitske Pottjegort', nrl2: '922/NL946120', initials2: 'JP' },
  { apt: '8', name: 'Narek Darbinian', nrl: '922/NL952924', initials: 'ND', second: 'Nelli Badaljan', nrl2: '922/NL952923', initials2: 'NB' },
  { apt: '13', name: 'Marcia Esseline Wilhelmina Huizing', nrl: 'NL943696', initials: 'MEWH', second: 'Paul Belema', nrl2: 'NL943229', initials2: 'PB' },
  { apt: '19', name: 'Rob Belema', nrl: 'NL945003', initials: 'RB', second: 'Geertje Adriaantje Hogenes', nrl2: 'NL945014', initials2: 'GAH' },
];
const NRL_PLACEHOLDER = 'NRL_56789'; // typed on PH-36's landlord (a UK company: no NRL)
const BANK_NOTE = "Before Roca Living handled this flat's rent (on the client's hand-made statement)";
const XERO_NOTE = "Paid in Xero for a period on the client's hand-made statement — not tracked in Roca Living";

// ── Helpers ──────────────────────────────────────────────────────────────────
const money = (n) => `£${Number(n).toFixed(2)}`;
const uk = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '—');
const dayBefore = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return toYmd(new Date(y, m - 1, d - 1)); };
const or0 = (a) => (a.length ? a : [0]);
const removeFile = (rel) => {
  if (!rel) return;
  const abs = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
  try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch (e) { console.log(`  could not delete file ${abs}: ${e.message}`); }
};
const setting = async (key) => (await db('settings').where('key', key).first('value'))?.value || null;

const today = todayYmd();
const xeroFrom = (await setting('xeroInvoicesFrom')) || `${today.slice(0, 8)}01`;
const xeroUntil = addDays(today, 14);
const xeroOn = !!(await setting('xeroRentIncomeAccountCode'));

// The rent months a flat should have: monthly on the due day from `from`; if
// `from` isn't a due day (PH-19: due 28th, hand-made statements to 31 Oct), a
// short pro-rata month first, from `from` to the day before the next due day.
const targetMonths = (f, endDate) => {
  const stored = f.dueDay === dueDayOf(f.start, null) ? null : f.dueDay;
  const firstDue = nextDueOnOrAfter(f.from, f.dueDay);
  const months = generateSchedules(f.start, endDate, f.rent, f.from, stored).map((m) => ({ due: String(m.due_date).slice(0, 10), amount: Number(m.amount) }));
  let dueDayFrom = null;
  if (firstDue !== f.from) {
    const pr = proRataRent(f.from, dayBefore(firstDue), f.rent);
    months.unshift({ due: f.from, amount: pr.total, note: `pro-rata ${uk(f.from)} – ${uk(dayBefore(firstDue))}` });
    dueDayFrom = f.from;
  }
  return { stored, dueDayFrom, months };
};

// ── Plan ─────────────────────────────────────────────────────────────────────
const plans = [];
const refused = [];
for (const f of FLATS) {
  const label = `PH-${f.apt}`;
  const p = await db('properties').where({ block_name: 'PH', apartment_number: f.apt }).first();
  if (!p) { refused.push(`${label}: no Roca Living property PH / ${f.apt}`); continue; }
  const t = await db('tenancies').where('property_id', p.id).whereIn('status', ['active', 'notice', 'pending']).orderBy('start_date', 'desc').first();
  if (!t) { refused.push(`${label}: no current tenancy`); continue; }
  const tenant = (await db('tenants').where('tenancy_id', t.id).orderBy('is_lead_tenant', 'desc').first('name'))?.name || '—';
  const target = targetMonths(f, t.end_date ? toYmd(t.end_date) : null);
  const lines = [];
  const why = [];

  const cur = {
    start: toYmd(t.start_date), rent: Number(t.rent_pcm), stored: t.rent_due_day ?? null, dueDayFrom: t.rent_due_day_from ? toYmd(t.rent_due_day_from) : null,
    from: t.statements_from ? toYmd(t.statements_from) : null, lastSeq: t.last_statement_seq ?? null,
  };
  const want = { start: f.start, rent: f.rent, stored: target.stored, dueDayFrom: target.dueDayFrom, from: f.from, lastSeq: f.lastSeq };
  const fieldNames = { start: 'start date', rent: 'rent', stored: 'rent due day (empty = start day)', dueDayFrom: 'short period from', from: 'rent handled in Roca Living from', lastSeq: 'last hand-made statement no.' };
  const show = (k, v) => (v === null ? 'empty' : ['start', 'dueDayFrom', 'from'].includes(k) ? uk(v) : k === 'rent' ? money(v) : String(v));
  const fieldChanges = Object.keys(want).filter((k) => String(cur[k]) !== String(want[k]));
  for (const k of fieldChanges) lines.push(`  ${fieldNames[k]}: ${show(k, cur[k])} → ${show(k, want[k])}`);

  // Statements Roca Living made for this tenancy (all predate the hand-made ones).
  const statements = await db('landlord_statements').where('tenancy_id', t.id).select('id', 'statement_number', 'status', 'sent_at', 'invoice_id', 'document_id', 'period_start', 'period_end');
  for (const s of statements) {
    const sent = s.status !== 'draft' || s.sent_at;
    if (sent && !DELETE_SENT.includes(s.statement_number)) why.push(`statement ${s.statement_number} (${uk(toYmd(s.period_start))} – ${uk(toYmd(s.period_end))}) was issued (${s.sent_at ? 'sent' : s.status}) — it can't be deleted`);
    else lines.push(`  delete statement ${s.statement_number} (${s.sent_at && s.status === 'draft' ? 'emailed' : s.status}, ${uk(toYmd(s.period_start))} – ${uk(toYmd(s.period_end))}) — the client's own numbers continue`);
  }

  // Payments before "from" belong to periods on the client's hand-made statements.
  const payments = await db('rent_payments').where('tenancy_id', t.id).orderBy('received_at')
    .select('id', 'amount', 'received_at', 'xero_payment_id', 'xero_invoice_number', 'xero_linked_existing', 'xero_bill_status', 'xero_bill_number', 'approved_statement_id');
  const early = payments.filter((x) => toYmd(x.received_at) < f.from);
  const earlyRemove = [];
  for (const x of early) {
    const desc = `payment ${money(x.amount)} on ${uk(toYmd(x.received_at))}`;
    const bank = await db('xero_bank_transactions').where('rent_payment_id', x.id).first('id', 'ledger_transaction_id');
    const deductions = Number((await db('rent_payment_deductions').where('rent_payment_id', x.id).count('* as n').first()).n);
    const stop = ['posted', 'paid'].includes(x.xero_bill_status)
      ? `landlord bill ${x.xero_bill_number} is ${x.xero_bill_status} in Xero — the landlord may have been paid twice; check it (an unpaid bill can be undone in Rent Cycle) and run again`
      : x.approved_statement_id ? 'it is on an approved-rent statement'
        : deductions ? 'it has Rent Cycle deductions' : null;
    if (stop) { why.push(`${desc} is before ${uk(f.from)}: ${stop}`); continue; }
    const kind = bank ? 'matched to a Xero bank line' : x.xero_payment_id ? `paid in Xero on ${x.xero_invoice_number}` : 'typed in';
    if (!REMOVE_EARLY) { why.push(`${desc} (${kind}) is before ${uk(f.from)} — the client's hand-made statements already reported it; run with --remove-early-payments to remove it`); continue; }
    earlyRemove.push({ ...x, bank });
    lines.push(`  remove ${desc} (${kind}) — before ${uk(f.from)}, on the client's hand-made statements`
      + `${bank ? '; the bank line becomes Ignored' : ''}${x.xero_payment_id ? `; ${x.xero_invoice_number} is no longer tracked here (stays paid in Xero)` : ''}`);
  }
  const untracked = new Set(earlyRemove.filter((x) => x.xero_payment_id).map((x) => x.xero_invoice_number));
  const kept = payments.filter((x) => toYmd(x.received_at) >= f.from);
  if (kept.length) lines.push(`  keep ${kept.length} payment(s) from ${uk(f.from)} on (applied to the new months again)`);

  // Rent months.
  const months = (await db('rent_schedules').where('tenancy_id', t.id).orderBy('due_date').select('due_date', 'amount')).map((m) => ({ due: toYmd(m.due_date), amount: Number(m.amount) }));
  const lastTarget = target.months.at(-1)?.due;
  const curKey = months.filter((m) => m.due <= lastTarget).map((m) => `${m.due}:${m.amount.toFixed(2)}`).join(' ');
  const wantKey = target.months.map((m) => `${m.due}:${m.amount.toFixed(2)}`).join(' ');
  const monthsChange = curKey !== wantKey;
  if (monthsChange) {
    lines.push(`  rent months: ${months.length ? `${months.length}, ${uk(months[0].due)} ${money(months[0].amount)} … ${uk(months.at(-1).due)}` : 'none'}`);
    lines.push(`            → ${target.months.length}, ${target.months.slice(0, 3).map((m) => `${uk(m.due)} ${money(m.amount)}${m.note ? ` (${m.note})` : ''}`).join(', ')} …`);
  }

  // Xero: what the next rent invoice push does with this tenancy's invoices.
  const wantByDue = new Map(target.months.map((m) => [m.due, m.amount]));
  const xero = await db('xero_rent_invoices').where('tenancy_id', t.id).orderBy('due_date');
  for (const x of xero) {
    const due = toYmd(x.due_date);
    const still = wantByDue.has(due) && wantByDue.get(due) === Number(x.amount);
    const tag = `${x.invoice_number} (${uk(due)}, ${money(x.amount)}, ${x.status})`;
    if (still || ['voided'].includes(x.status) || (untracked.has(x.invoice_number) && x.status === 'paid')) continue;
    if (['paid', 'part'].includes(x.status) || Number(x.amount_paid) > 0) why.push(`Xero invoice ${tag} is paid but its month would go — sort it in Xero first`);
    else if (x.status === 'created') lines.push(`  Xero: ${tag} will be VOIDED in Xero at the next push`);
    else if (x.status === 'failed') lines.push(`  Xero: ${tag} — failed record, cleared at the next push`);
    else if (x.status === 'attention') why.push(`Xero invoice ${tag} needs attention — sort it in Xero first`);
  }
  if (xeroOn && p.managed_by_rl) {
    const has = new Set(xero.filter((x) => ['created', 'part', 'paid', 'attention'].includes(x.status)).map((x) => toYmd(x.due_date)));
    for (const m of target.months) {
      if (m.due >= xeroFrom && m.due <= xeroUntil && !has.has(m.due)) lines.push(`  Xero: next push will CREATE a rent invoice for ${uk(m.due)} ${money(m.amount)} (unless it's paid by then)`);
    }
  }

  // Deposit.
  let depositChange = null;
  if (f.deposit) {
    const d = await db('deposits').where('tenancy_id', t.id).first();
    const w = f.deposit;
    const row = {
      tenancy_deposit: w.amount.toFixed(2), scheme: w.scheme, received_at: w.received, register_due: addDays(w.received, 30),
      registered_at: w.registered, status: w.registered ? 'registered' : 'pending_registration',
    };
    if (!d) depositChange = { insert: { ...row, notes: w.note } };
    else {
      const diff = {};
      if (Number(d.tenancy_deposit) !== w.amount) diff.tenancy_deposit = row.tenancy_deposit;
      if (d.scheme !== w.scheme) diff.scheme = w.scheme;
      if (toYmd(d.received_at) !== w.received) { diff.received_at = w.received; diff.register_due = row.register_due; }
      if ((d.registered_at ? toYmd(d.registered_at) : null) !== w.registered) { diff.registered_at = w.registered; diff.status = row.status; }
      if (!String(d.notes || '').includes(w.note)) diff.notes = [d.notes, w.note].filter(Boolean).join('\n');
      if (Object.keys(diff).length) depositChange = { id: d.id, update: diff };
    }
    if (depositChange) lines.push(`  deposit: ${depositChange.insert ? 'add' : 'correct'} ${money(w.amount)} ${w.scheme}, received ${uk(w.received)}, registered ${uk(w.registered)} — ${w.note}`);
  }

  const changes = fieldChanges.length || monthsChange || statements.length || earlyRemove.length || depositChange;
  plans.push({ f, label, p, t, tenant, cur, want, target, statements, earlyRemove, depositChange, lines, why, changes, fieldChanges });
}

// NRL numbers (ROCA Estates owners) and the PH-36 placeholder (Roca Living).
const nrlPlans = [];
for (const n of NRL) {
  const unit = await emDb('properties as p').leftJoin('buildings as b', 'p.building_id', 'b.id')
    .where('b.name', 'like', 'Parsons House%').where((w) => w.where('p.unit_number', n.apt).orWhere('p.unit_number', n.apt.padStart(2, '0')))
    .first('p.id', 'p.landlord_id');
  const u = unit?.landlord_id ? await emDb('users').where('id', unit.landlord_id).first('id', 'name', 'secondary_owner_name', 'is_joint_ownership', 'nrl_number', 'secondary_nrl_number', 'statement_initials', 'secondary_statement_initials') : null;
  if (!u) { refused.push(`PH-${n.apt} NRL: no ROCA Estates owner found`); continue; }
  if (String(u.name).trim().toLowerCase() !== n.name.toLowerCase()) { refused.push(`PH-${n.apt} NRL: ROCA Estates' main owner is "${u.name}", expected "${n.name}" — not changed`); continue; }
  const body = {};
  if (u.nrl_number !== n.nrl) body.nrl_number = n.nrl;
  if (u.statement_initials !== n.initials) body.statement_initials = n.initials;
  if (u.secondary_nrl_number !== n.nrl2) body.secondary_nrl_number = n.nrl2;
  if (u.secondary_statement_initials !== n.initials2) body.secondary_statement_initials = n.initials2;
  if (Object.keys(body).length) nrlPlans.push({ n, u, body });
}
const placeholder = await db('landlord_profiles').where('nrl_hmrc_ref', NRL_PLACEHOLDER).select('id', 'user_id');

// ── Report ───────────────────────────────────────────────────────────────────
console.log(`Xero: ${xeroOn ? `connected; the next push invoices months due ${uk(xeroFrom)} – ${uk(xeroUntil)}` : 'rent invoices not set up — no Xero effect'}\n`);
for (const pl of plans) {
  console.log(`${pl.label} · ${pl.tenant} · tenancy #${pl.t.id} (${pl.f.source})`);
  if (pl.why.length) { for (const w of pl.why) console.log(`  REFUSED: ${w}`); }
  else if (!pl.changes) console.log('  nothing to change');
  else console.log(pl.lines.join('\n'));
  console.log('');
}
console.log('NRL numbers (ROCA Estates):');
if (!nrlPlans.length) console.log('  nothing to change');
for (const { n, u, body } of nrlPlans) {
  console.log(`  PH-${n.apt} ${u.name}${u.secondary_owner_name ? ` & ${u.secondary_owner_name}` : ''}: ${Object.entries(body).map(([k, v]) => `${k} ${u[k] || 'empty'} → ${v}`).join(', ')}`);
}
if (nrlPlans.length && !estatesApiReady()) console.log('  (ROCAEM_API_URL / ROCAEM_API_KEY are not set — these will be skipped)');
for (const lp of placeholder) console.log(`  Roca Living landlord #${lp.user_id}: clear NRL "${NRL_PLACEHOLDER}" (a UK company — no NRL)`);
if (refused.length) { console.log('\nREFUSED (left as they are):'); for (const r of refused) console.log('  ' + r); }

const todo = plans.filter((pl) => !pl.why.length && pl.changes);
if (!todo.length && !nrlPlans.length && !placeholder.length) { console.log('\nNothing to change.'); await done(0); }
if (!APPLY) {
  console.log(`\nDRY RUN — nothing changed. To do it: add --apply --rl-db=${rlName}`);
  await done(0);
}

// ── Apply ────────────────────────────────────────────────────────────────────
const admin = await db('users').where('role', 'ADMIN').orderBy('id').first('id', 'email');
const audit = (trx, action, entityType, entityId, meta) => trx('audit_log').insert({
  actor_id: admin?.id || null, actor_role: 'ADMIN', action, entity_type: entityType, entity_id: entityId, meta: JSON.stringify({ ...meta, source: 'fix-parsons-data script' }),
});

for (const pl of todo) {
  const { f, t, target } = pl;
  const files = [];
  await db.transaction(async (trx) => {
    // 1. Roca Living's statements for this tenancy (see report).
    for (const s of pl.statements) {
      const invoice = s.invoice_id ? await trx('invoices').where('id', s.invoice_id).first() : null;
      const docs = await trx('documents').whereIn('id', [s.document_id, invoice?.document_id].filter(Boolean)).select('id', 'file_path');
      await trx('rent_payment_allocations').where('statement_id', s.id).update({ statement_id: null });
      await trx('property_expenses').where('statement_id', s.id).update({ statement_id: null });
      await trx('transactions').where('statement_id', s.id).delete();
      await trx('landlord_statements').where('id', s.id).delete();
      if (invoice) {
        await trx('invoice_items').where('invoice_id', invoice.id).delete();
        await trx('invoices').where('id', invoice.id).delete();
      }
      if (docs.length) await trx('documents').whereIn('id', docs.map((d) => d.id)).delete();
      files.push(...docs.map((d) => d.file_path));
      await audit(trx, 'STATEMENT_DRAFT_DELETED', 'landlord_statement', s.id, { statement_number: s.statement_number, status: s.status, invoice_number: invoice?.invoice_number || null });
    }
    // 2. Rent the client's hand-made statements already reported, with its ledger
    // line; links to Xero are closed so the next sync doesn't bring it back.
    for (const x of pl.earlyRemove) {
      if (x.bank) {
        // As "Undo" on the Bank Transactions tab, but the line is Ignored, not re-matchable.
        if (x.bank.ledger_transaction_id) await trx('transactions').where('id', x.bank.ledger_transaction_id).delete();
        await trx('xero_bank_transactions').where('id', x.bank.id).update({
          status: 'ignored', reconciled_as: null, tenancy_id: null, landlord_id: null, property_id: null,
          rent_payment_id: null, ledger_transaction_id: null, link_meta: null, auto_matched: false,
          note: BANK_NOTE, reconciled_by: admin?.id || null, reconciled_at: trx.fn.now(),
        });
      }
      if (x.xero_payment_id && !x.xero_linked_existing) {
        await trx('transactions').where('tenancy_id', t.id).where('description', 'like', `%(payment ${x.xero_payment_id})%`).delete();
      } else if (!x.bank) {
        const ledger = await trx('transactions').where({ type: 'rent_in', tenancy_id: t.id, amount: x.amount }).where('transaction_date', toYmd(x.received_at))
          .whereNotIn('id', trx('xero_bank_transactions').whereNotNull('ledger_transaction_id').select('ledger_transaction_id')).orderBy('id', 'desc').first('id');
        if (ledger) await trx('transactions').where('id', ledger.id).delete();
      }
      if (x.xero_payment_id) {
        // The payment sync only reads created/part/paid/attention invoices.
        await trx('xero_rent_invoices').where('invoice_number', x.xero_invoice_number).whereIn('status', ['created', 'paid'])
          .update({ status: 'voided', error: XERO_NOTE, updated_at: trx.fn.now() });
      }
      await trx('rent_payment_allocations').where('payment_id', x.id).delete();
      await trx('rent_payments').where('id', x.id).delete();
      await audit(trx, 'RENT_PAYMENT_DELETED', 'rent_payment', x.id, {
        tenancy_id: t.id, amount: Number(x.amount).toFixed(2), received_at: toYmd(x.received_at), reason: 'before the first period handled in Roca Living',
        bank_line: x.bank?.id || null, xero_invoice: x.xero_invoice_number || null,
      });
    }
    // 3. Rent months from the documents, then payments applied again.
    const schedIds = await trx('rent_schedules').where('tenancy_id', t.id).pluck('id');
    await trx('rent_payment_allocations').whereIn('schedule_id', or0(schedIds)).whereNull('statement_id').delete();
    await trx('rent_payments').where('tenancy_id', t.id).update({ schedule_id: null });
    await trx('rent_schedules').where('tenancy_id', t.id).delete();
    await trx('rent_schedules').insert(target.months.map((m) => ({ tenancy_id: t.id, due_date: m.due, amount: m.amount.toFixed(2), status: 'due' })));
    await trx('tenancies').where('id', t.id).update({
      start_date: f.start, rent_pcm: f.rent.toFixed(2), rent_due_day: target.stored, rent_due_day_from: target.dueDayFrom,
      statements_from: f.from, last_statement_seq: f.lastSeq,
    });
    await trx('properties').where('id', t.property_id).update({ rent_pcm: f.rent.toFixed(2) });
    await allocateTenancyPayments(trx, t.id);
    // 4. Deposit.
    if (pl.depositChange?.insert) await trx('deposits').insert({ tenancy_id: t.id, ...pl.depositChange.insert });
    else if (pl.depositChange?.update) await trx('deposits').where('id', pl.depositChange.id).update(pl.depositChange.update);
    await audit(trx, 'PARSONS_DATA_CORRECTED', 'tenancy', t.id, { flat: pl.label, before: pl.cur, after: pl.want, documents: f.source, deposit: pl.depositChange || null });
  });
  for (const fp of files) removeFile(fp);
  console.log(`${pl.label}: corrected`);
}

if (placeholder.length) {
  await db.transaction(async (trx) => {
    await trx('landlord_profiles').whereIn('id', placeholder.map((x) => x.id)).update({ nrl_hmrc_ref: null });
    for (const lp of placeholder) await audit(trx, 'LANDLORD_NRL_CLEARED', 'user', lp.user_id, { was: NRL_PLACEHOLDER });
  });
  console.log(`Cleared the "${NRL_PLACEHOLDER}" NRL placeholder`);
}

if (nrlPlans.length && !estatesApiReady()) console.log('NRL numbers skipped: ROCAEM_API_URL / ROCAEM_API_KEY are not set');
else {
  for (const { n, u, body } of nrlPlans) {
    try {
      await estatesApi('PATCH', `/users/${u.id}`, { body, actingFor: admin?.email || 'fix-parsons-data' });
      console.log(`PH-${n.apt}: NRL numbers saved in ROCA Estates`);
    } catch (e) {
      console.log(`PH-${n.apt}: NRL numbers NOT saved — ${e.message}`);
    }
  }
}
console.log('\nDone. Run it again (without --apply): every flat should show "nothing to change".');
await done(0);
