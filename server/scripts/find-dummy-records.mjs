// Find dummy / test records the client sees in the admin (handover RL-056–058)
// and, after you have checked the list, delete the ones you name. Run from the
// server folder, so it uses this server's .env:
//
//   node scripts/find-dummy-records.mjs
//       → REPORT (default): every landlord (ROCA Estates + Roca Living), every
//         Roca Living flat and tenancy/tenant, with flags (test-like name or
//         email, not in ROCA Estates, no flats…) and what is linked to each.
//         Writes nothing.
//   node scripts/find-dummy-records.mjs --delete=rl-landlord:3,rl-property:193 \
//       [--apply --rl-db=<roca living db>]
//       → shows what those deletes would remove; with --apply does it.
//
// Kinds: rl-landlord:<id>  rl-property:<id>  rl-tenancy:<id>  rl-tenant:<id>
//        estates-landlord:<ROCA Estates user id>   (through the ROCA Estates API)
// A record is REFUSED if money is attached to it (rent payments, statements,
// approved-rent statements, invoices, transactions, Xero rent invoices, bank
// lines, rent history): those are never deleted by this script.
// Back the database up first (mysqldump).
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const argValue = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || null;
const DELETE = (argValue('delete') || '').split(',').map((s) => s.trim()).filter(Boolean);

const mod = (rel) => import(pathToFileURL(path.join(HERE, '..', rel)).href);
const { emDb, default: db } = await mod('src/config/db.js');
const { eraseLandlordData } = await mod('src/controllers/landlordController.js');
const { deletePropertyInternal } = await mod('src/controllers/propertyController.js');
const { estatesApi, estatesApiReady } = await mod('src/utils/estatesApi.js');
const { toYmd } = await mod('src/utils/dateHelpers.js');
const done = async (code = 0) => { await db.destroy(); await emDb.destroy(); process.exit(code); };

const [[{ d: rlName }]] = await db.raw('SELECT DATABASE() AS d');
if (APPLY && argValue('rl-db') !== rlName) {
  console.log(`REFUSED: connected to ${rlName}. To apply, pass exactly --rl-db=${rlName}`);
  await done(1);
}
if (APPLY && !DELETE.length) { console.log('Nothing to apply: name the records with --delete=…'); await done(1); }

// ── Helpers ──────────────────────────────────────────────────────────────────
const TEST_WORDS = /\b(test(ing)?|dummy|demo|sample|fake|example|asdf|qwerty|lorem|xxx+|zz+\w*|dev|temp|abc)\b/i;
const TEST_EMAIL = /(consultquark|mailinator|yopmail|example\.(com|org)|@test\.|test@|\+test|dummy|demo@|fake|tempmail|devendra|dev\d)/i;
const PLACEHOLDER_EMAIL = /\.invalid$/i;
const testLike = (...vals) => vals.some((v) => v && (TEST_WORDS.test(String(v)) || TEST_EMAIL.test(String(v))));
const n = async (q) => Number((await q.count('* as c').first())?.c || 0);
const has = async (table) => db.schema.hasTable(table);
const fmt = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(', ') || 'nothing';

// Money linked to tenancies / properties / a landlord. Never deleted here.
const moneyOf = async ({ tenancyIds = [], propertyIds = [], landlordId = null }) => {
  const m = {};
  const T = tenancyIds.length ? tenancyIds : [-1];
  const P = propertyIds.length ? propertyIds : [-1];
  m['rent payments'] = await n(db('rent_payments').whereIn('tenancy_id', T));
  m['statements'] = await n(db('landlord_statements').where((q) => { q.whereIn('tenancy_id', T); if (landlordId) q.orWhere('landlord_id', landlordId); }));
  m['approved-rent statements'] = await n(db('approved_rent_statements').whereIn('tenancy_id', T));
  m['invoices'] = await n(db('invoices').whereIn('property_id', P));
  m['transactions'] = await n(db('transactions').where((q) => { q.whereIn('tenancy_id', T).orWhereIn('property_id', P); if (landlordId) q.orWhere('landlord_id', landlordId); }));
  m['Xero rent invoices'] = await n(db('xero_rent_invoices').whereIn('tenancy_id', T));
  m['Xero bank lines'] = await n(db('xero_bank_transactions').where((q) => q.whereIn('tenancy_id', T).orWhereIn('property_id', P)));
  if (await has('rent_history')) m['rent history months'] = await n(db('rent_history').whereIn('property_id', P));
  return m;
};
// Other things that go with the record (deleted with it).
const otherOf = async ({ tenancyIds = [], propertyIds = [], landlordId = null }) => {
  const o = {};
  const T = tenancyIds.length ? tenancyIds : [-1];
  const P = propertyIds.length ? propertyIds : [-1];
  o['tenants'] = await n(db('tenants').whereIn('tenancy_id', T));
  o['deposits'] = await n(db('deposits').whereIn('tenancy_id', T));
  o['rent months (schedule)'] = await n(db('rent_schedules').whereIn('tenancy_id', T));
  o['maintenance tickets'] = await n(db('maintenance_tickets').whereIn('property_id', P));
  o['documents'] = await n(db('documents').where((q) => {
    q.where((x) => x.where('owner_type', 'property').whereIn('owner_id', P))
      .orWhere((x) => x.where('owner_type', 'tenancy').whereIn('owner_id', T));
    if (landlordId) q.orWhere((x) => x.where('owner_type', 'landlord').where('owner_id', landlordId));
  }));
  return o;
};
const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);

const flatName = (p) => p ? (p.block_name && p.apartment_number ? `${String(p.block_name).toUpperCase()}-${p.apartment_number}` : (p.name || `property #${p.id}`)) : '—';

// ── REPORT ───────────────────────────────────────────────────────────────────
const report = async () => {
  console.log(`REPORT on ${rlName} (Roca Living) — nothing is changed\n`);
  const suggest = [];

  // ROCA Estates landlords: what the admin's Landlords page lists.
  const eUsers = await emDb('users').where('role', 'LANDLORD').orderBy('id').select('id', 'name', 'email', 'status', 'created_at');
  const rlLinked = new Map((await db('users').where('role', 'LANDLORD').whereNotNull('rocaem_user_id').select('id', 'rocaem_user_id'))
    .map((u) => [Number(u.rocaem_user_id), u.id]));
  console.log(`ROCA Estates landlords (Landlords page): ${eUsers.length}`);
  for (const u of eUsers) {
    const units = await emDb('properties').where('landlord_id', u.id).select('name', 'unit_code', 'unit_number');
    const flags = [];
    if (testLike(u.name, u.email)) flags.push('TEST-LIKE NAME/EMAIL');
    if (!units.length) flags.push('NO APARTMENTS');
    if (PLACEHOLDER_EMAIL.test(u.email || '')) flags.push('no real email (placeholder)');
    const rlId = rlLinked.get(Number(u.id));
    const mark = flags.some((f) => f === f.toUpperCase()) ? '⚠' : ' ';
    console.log(`  ${mark} estates #${u.id} ${u.name} · ${u.email || '—'} · ${units.length} apt (${units.map((x) => x.unit_code || x.name).slice(0, 4).join(', ') || '—'})${rlId ? ` · Roca Living landlord #${rlId}` : ''}${flags.length ? ' · ' + flags.join(' · ') : ''}`);
    if (mark === '⚠') suggest.push(`estates-landlord:${u.id}`);
  }

  // Roca Living landlords.
  const rlUsers = await db('users').where('role', 'LANDLORD').orderBy('id').select('id', 'name', 'email', 'rocaem_user_id', 'created_at', 'last_login_at');
  const eIds = new Set(eUsers.map((u) => Number(u.id)));
  console.log(`\nRoca Living landlord accounts: ${rlUsers.length}`);
  for (const u of rlUsers) {
    const props = await db('properties').where('landlord_id', u.id).select('id', 'name', 'block_name', 'apartment_number', 'managed_by_rl');
    const P = props.map((p) => p.id);
    const T = P.length ? await db('tenancies').whereIn('property_id', P).pluck('id') : [];
    const money = await moneyOf({ tenancyIds: T, propertyIds: P, landlordId: u.id });
    const flags = [];
    if (testLike(u.name, u.email)) flags.push('TEST-LIKE NAME/EMAIL');
    if (!u.rocaem_user_id || !eIds.has(Number(u.rocaem_user_id))) flags.push('NOT IN ROCA ESTATES');
    if (!props.length) flags.push('no flats');
    const mark = flags.some((f) => f === f.toUpperCase()) ? '⚠' : ' ';
    console.log(`  ${mark} RL #${u.id} ${u.name} · ${u.email} · flats: ${props.map(flatName).join(', ') || '—'}${flags.length ? ' · ' + flags.join(' · ') : ''}`);
    if (mark === '⚠') {
      console.log(`      money: ${fmt(money)} · last login: ${u.last_login_at ? toYmd(u.last_login_at) : 'never'}`);
      if (!total(money)) suggest.push(`rl-landlord:${u.id}`);
    }
  }

  // Roca Living flats.
  const props = await db('properties').orderBy('id').select('id', 'name', 'block_name', 'apartment_number', 'managed_by_rl', 'rocaem_property_id', 'landlord_id', 'status');
  console.log(`\nRoca Living flats: ${props.length}`);
  for (const p of props) {
    const flags = [];
    if (!p.rocaem_property_id) flags.push('NOT IN ROCA ESTATES');
    if (!p.managed_by_rl) flags.push('not managed');
    if (testLike(p.name)) flags.push('TEST-LIKE NAME');
    const mark = flags.some((f) => f === f.toUpperCase()) ? '⚠' : ' ';
    console.log(`  ${mark} property #${p.id} ${flatName(p)} (${p.name}) · landlord RL #${p.landlord_id ?? '—'} · ${p.status || ''}${flags.length ? ' · ' + flags.join(' · ') : ''}`);
  }

  // Tenancies and tenants: what the admin's Tenants / Tenancies pages list.
  const ts = await db('tenancies as t').leftJoin('properties as p', 'p.id', 't.property_id').orderBy('p.id').orderBy('t.start_date')
    .select('t.id', 't.status', 't.start_date', 't.end_date', 't.rent_pcm', 'p.id as pid', 'p.name', 'p.block_name', 'p.apartment_number', 'p.managed_by_rl', 'p.rocaem_property_id');
  console.log(`\nRoca Living tenancies: ${ts.length}`);
  for (const t of ts) {
    const tenants = await db('tenants').where('tenancy_id', t.id).select('id', 'name', 'email');
    const money = await moneyOf({ tenancyIds: [t.id] });
    const flags = [];
    if (tenants.some((x) => testLike(x.name, x.email))) flags.push('TEST-LIKE TENANT');
    if (!t.pid) flags.push('NO FLAT');
    else if (!t.rocaem_property_id) flags.push('FLAT NOT IN ROCA ESTATES');
    if (!tenants.length) flags.push('no tenant');
    const mark = flags.some((f) => f === f.toUpperCase()) ? '⚠' : ' ';
    const d = (v) => (v ? toYmd(v) : '—');
    console.log(`  ${mark} tenancy #${t.id} ${flatName({ ...t, id: t.pid })} · ${t.status} · ${d(t.start_date)} → ${d(t.end_date)} · £${t.rent_pcm} · tenants: ${tenants.map((x) => `#${x.id} ${x.name}`).join(', ') || '—'} · money: ${fmt(money)}${flags.length ? ' · ' + flags.join(' · ') : ''}`);
    if (mark === '⚠' && !total(money)) suggest.push(`rl-tenancy:${t.id}`);
  }

  console.log('\nOther Roca Living accounts (admins / agents):');
  for (const u of await db('users').whereNot('role', 'LANDLORD').orderBy('id').select('id', 'role', 'name', 'email')) {
    console.log(`  ${testLike(u.name, u.email) ? '⚠' : ' '} #${u.id} ${u.role} ${u.name} · ${u.email}`);
  }

  console.log('\n⚠ = looks like dummy/test data, or is not linked to ROCA Estates. Check each one: a real landlord can still look odd.');
  console.log(suggest.length
    ? `Possible deletes (nothing financial attached):\n  --delete=${suggest.join(',')}\nRun again with that (and only the ones you are sure of) to see exactly what would go.`
    : 'No obvious candidates.');
};

// ── DELETE (preview / apply) ─────────────────────────────────────────────────
const plan = async (item) => {
  const [kind, raw] = item.split(':');
  const id = Number(raw);
  if (!id) return { item, why: ['bad id'] };
  if (kind === 'rl-landlord') {
    const u = await db('users').where({ id, role: 'LANDLORD' }).first();
    if (!u) return { item, why: ['no Roca Living landlord with this id'] };
    const P = await db('properties').where('landlord_id', id).pluck('id');
    const T = P.length ? await db('tenancies').whereIn('property_id', P).pluck('id') : [];
    const money = await moneyOf({ tenancyIds: T, propertyIds: P, landlordId: id });
    return { item, label: `Roca Living landlord #${id} ${u.name} (${u.email})${u.rocaem_user_id ? ` — stays in ROCA Estates as #${u.rocaem_user_id}` : ''}`,
      money, other: { flats: P.length, ...(await otherOf({ tenancyIds: T, propertyIds: P, landlordId: id })) },
      run: (trx, actor) => eraseLandlordData(trx, id, actor) };
  }
  if (kind === 'rl-property') {
    const p = await db('properties').where({ id }).first();
    if (!p) return { item, why: ['no Roca Living flat with this id'] };
    const T = await db('tenancies').where('property_id', id).pluck('id');
    const money = await moneyOf({ tenancyIds: T, propertyIds: [id] });
    return { item, label: `Roca Living flat #${id} ${flatName(p)} (${p.name})${p.rocaem_property_id ? ' — stays in ROCA Estates' : ''}`,
      money, other: { tenancies: T.length, ...(await otherOf({ tenancyIds: T, propertyIds: [id] })) },
      run: async (trx, actor) => { await deletePropertyInternal(trx, id); await auditRow(trx, actor, 'PROPERTY_DELETED', 'property', id); } };
  }
  if (kind === 'rl-tenancy') {
    const t = await db('tenancies').where({ id }).first();
    if (!t) return { item, why: ['no tenancy with this id'] };
    const p = await db('properties').where('id', t.property_id).first();
    const money = await moneyOf({ tenancyIds: [id] });
    return { item, label: `tenancy #${id} on ${flatName(p)} (${t.status})`, money, other: await otherOf({ tenancyIds: [id] }),
      run: async (trx, actor) => {
        await trx('documents').where({ owner_type: 'tenancy', owner_id: id }).delete();
        for (const tbl of ['tenants', 'deposits', 'rent_schedules', 'fire_safety_signoffs', 'utilities', 'inspections']) await trx(tbl).where('tenancy_id', id).delete();
        await trx('maintenance_tickets').where('tenancy_id', id).update({ tenancy_id: null });
        await trx('folders').where({ owner_type: 'tenancy', owner_id: id }).delete();
        await trx('tenancies').where({ id }).delete();
        await auditRow(trx, actor, 'TENANCY_DELETED', 'tenancy', id);
      } };
  }
  if (kind === 'rl-tenant') {
    const x = await db('tenants').where({ id }).first();
    if (!x) return { item, why: ['no tenant with this id'] };
    const t = await db('tenancies').where('id', x.tenancy_id).first();
    const others = await n(db('tenants').where('tenancy_id', x.tenancy_id).whereNot('id', id));
    const why = t && ['active', 'notice', 'pending'].includes(t.status) && !others ? ['only tenant on a current tenancy — delete the tenancy instead (rl-tenancy)'] : [];
    return { item, why, label: `tenant #${id} ${x.name} (tenancy #${x.tenancy_id})`, money: {}, other: {},
      run: async (trx, actor) => {
        await trx('tenants').where({ id }).delete();
        if (x.is_lead_tenant && others) {
          const next = await trx('tenants').where('tenancy_id', x.tenancy_id).orderBy('id').first();
          await trx('tenants').where('id', next.id).update({ is_lead_tenant: 1 });
        }
        await auditRow(trx, actor, 'TENANT_DELETED', 'tenant', id);
      } };
  }
  if (kind === 'estates-landlord') {
    const u = await emDb('users').where({ id, role: 'LANDLORD' }).first('id', 'name', 'email');
    if (!u) return { item, why: ['no ROCA Estates landlord with this id'] };
    const units = await n(emDb('properties').where('landlord_id', id));
    const linked = await db('users').where({ rocaem_user_id: id, role: 'LANDLORD' }).first();
    let money = {}, other = { 'ROCA Estates apartments (must be moved or deleted first)': units };
    const why = [];
    if (units) why.push(`owns ${units} apartment(s) in ROCA Estates — move or delete them first`);
    if (linked) {
      const P = await db('properties').where('landlord_id', linked.id).pluck('id');
      const T = P.length ? await db('tenancies').whereIn('property_id', P).pluck('id') : [];
      money = await moneyOf({ tenancyIds: T, propertyIds: P, landlordId: linked.id });
      other = { ...other, 'Roca Living flats': P.length };
    }
    if (!estatesApiReady()) why.push('ROCAEM_API_URL / ROCAEM_API_KEY are not set');
    return { item, why, label: `ROCA Estates landlord #${id} ${u.name} (${u.email})${linked ? ` + Roca Living landlord #${linked.id}` : ''}`, money, other,
      run: async (trx, actor) => {
        await estatesApi('DELETE', `/users/${id}`, { actingFor: actor.email });
        if (linked) await eraseLandlordData(trx, linked.id, actor);
        await auditRow(trx, actor, 'ESTATE_LANDLORD_DELETED', 'estates_landlord', id);
      } };
  }
  return { item, why: [`unknown kind "${kind}" (use rl-landlord, rl-property, rl-tenancy, rl-tenant, estates-landlord)`] };
};

const auditRow = (trx, actor, action, type, id) => trx('audit_log').insert({
  actor_id: actor.id, actor_role: actor.role, action, entity_type: type, entity_id: id,
  meta: JSON.stringify({ erased: true, by: 'find-dummy-records.mjs' }), ip_address: null,
});

const deletes = async () => {
  console.log(`${APPLY ? 'APPLY' : 'PREVIEW'} on ${rlName} (Roca Living)\n`);
  const plans = [];
  for (const item of DELETE) {
    const pl = await plan(item);
    pl.why = pl.why || [];
    if (pl.money && total(pl.money)) pl.why.push(`money attached: ${fmt(pl.money)} — never deleted by this script`);
    plans.push(pl);
    console.log(`${pl.why.length ? 'REFUSED' : 'DELETE '}  ${pl.label || item}`);
    if (pl.other) console.log(`         also removes: ${fmt(pl.other)}`);
    for (const w of pl.why) console.log(`         ${w}`);
  }
  const ok = plans.filter((p) => !p.why.length);
  if (!ok.length) { console.log('\nNothing to delete.'); return; }
  if (!APPLY) { console.log(`\nPREVIEW — nothing changed. To do it: add --apply --rl-db=${rlName}`); return; }
  const admin = await db('users').where('role', 'ADMIN').orderBy('id').first();
  const actor = { id: admin.id, role: 'ADMIN', email: admin.email, ip: null };
  for (const pl of ok) {
    try {
      await db.transaction((trx) => pl.run(trx, actor));
      console.log(`deleted: ${pl.label}`);
    } catch (err) {
      console.log(`FAILED: ${pl.label} — ${err.message} (nothing of this one was changed in Roca Living)`);
    }
  }
};

if (DELETE.length) await deletes(); else await report();
await done(0);
