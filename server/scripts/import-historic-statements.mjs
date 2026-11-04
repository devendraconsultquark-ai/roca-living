// Historic statements: the ROCA statements made outside Roca Living before it
// took over, re-made in Roca Living's statement design with the figures as the
// bank shows them (user, 4 Nov 2026: the bank / Xero is the source of truth).
// Input: Downloads\Roca_Historic_Statements.json (read from the client's
// Dropbox PDFs, checked against the bank lines). Read-only in the app: admin
// Statements → Historic, and the landlord's portal. Never part of Generate
// Statement or its numbering — except that Generate Statement's next number
// moves past a historic one (last_statement_seq), so a number is never used twice.
//
//   node scripts/import-historic-statements.mjs                       → DRY RUN
//   node scripts/import-historic-statements.mjs --apply --rl-db=<db>
// (data: scripts/data/historic-statements.json; another file with --file=<json>)
// Options:
//   --replace-rl=PH_8_0001   a statement marked "replaces_rl_statement" replaces
//                            Roca Living's own statement with that number (only on
//                            an ended tenancy, and only if no money is linked to it).
// Re-run safe: imported statements show "already imported". Back the database up first.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const argValue = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || null;
const REPLACE = (argValue('replace-rl') || '').split(',').map((s) => s.trim()).filter(Boolean);
const mod = (rel) => import(pathToFileURL(path.join(HERE, '..', rel)).href);
const { emDb, default: db } = await mod('src/config/db.js');
const { historicLandlordDetails, historicDocData } = await mod('src/utils/historicStatements.js');
const { toYmd } = await mod('src/utils/dateHelpers.js');
const done = async (code = 0) => { await db.destroy(); await emDb.destroy(); process.exit(code); };

const file = argValue('file') || path.join(HERE, 'data', 'historic-statements.json');
if (!fs.existsSync(file)) { console.log(`REFUSED: data file not found: ${file}`); await done(1); }
const [[{ d: rlName }]] = await db.raw('SELECT DATABASE() AS d');
if (APPLY && argValue('rl-db') !== rlName) { console.log(`REFUSED: connected to ${rlName}. To apply, pass exactly --rl-db=${rlName}`); await done(1); }
if (!(await db.schema.hasTable('historic_statements'))) { console.log('REFUSED: table historic_statements is missing — start the server once (phase41 migration)'); await done(1); }
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} on ${rlName} (Roca Living)\n`);

const money = (v) => `£${Number(v).toFixed(2)}`;
const uk = (ymd) => ymd.split('-').reverse().join('/');
const seqOf = (no) => parseInt(String(no).split('_').pop(), 10) || 0;
const list = JSON.parse(fs.readFileSync(file, 'utf8'));
const plans = [];
let refused = 0;

for (const s of list) {
  const label = `${s.statement_number} (${uk(s.period_start)} – ${uk(s.period_end)}, paid ${money(s.payment_amount)})`;
  const property = await db('properties').where({ block_name: 'PH', apartment_number: String(s.flat) }).first();
  if (!property) { console.log(`REFUSED  ${label}: no Roca Living flat PH-${s.flat}`); refused++; continue; }
  if (await db('historic_statements').where('statement_number', s.statement_number).first('id')) { console.log(`         ${label}: already imported`); continue; }
  const rl = await db('landlord_statements').where('statement_number', s.statement_number).first();
  let replace = null;
  if (rl) {
    if (!s.replaces_rl_statement) { console.log(`SKIP     ${label}: Roca Living already has ${s.statement_number} — it stays`); continue; }
    const t = rl.tenancy_id ? await db('tenancies').where('id', rl.tenancy_id).first('status') : null;
    const links = [];
    for (const tb of ['transactions', 'rent_payment_allocations', 'property_expenses']) {
      const n = Number((await db(tb).where('statement_id', rl.id).count('* as c').first()).c);
      if (n) links.push(`${n} ${tb}`);
    }
    if (links.length || (t && t.status !== 'ended')) {
      console.log(`REFUSED  ${label}: Roca Living's own ${s.statement_number} has ${links.join(', ') || 'a current tenancy'} — sort it by hand`); refused++; continue;
    }
    if (!REPLACE.includes(s.statement_number)) {
      console.log(`WAITING  ${label}: replaces Roca Living's own ${s.statement_number} (${uk(toYmd(rl.period_start))} – ${uk(toYmd(rl.period_end))}, ${rl.status}) — add --replace-rl=${s.statement_number}`);
      continue;
    }
    replace = rl;
  }
  const tenancies = await db('tenancies as t').leftJoin('tenants as lead', function () {
    this.on('lead.tenancy_id', '=', 't.id').andOn('lead.is_lead_tenant', '=', db.raw('1'));
  }).where('t.property_id', property.id).select('t.id', 'lead.name');
  const norm = (v) => String(v || '').toLowerCase().replace(/^(mr|mrs|ms|miss|dr)\s+/, '').trim();
  const tenancy = tenancies.find((t) => t.name && norm(t.name) === norm(s.tenant_name)) || null;
  const original = await db('documents').where({ doc_type: 'statement_before_rl', original_name: path.win32.basename(s.source_file) }).first('id');
  console.log(`${replace ? 'REPLACE ' : 'IMPORT  '} ${label}${tenancy ? '' : ' · no tenancy in Roca Living (tenant before)'}${original ? '' : ' · original PDF not found'}${replace ? ` · removes Roca Living's own ${s.statement_number} (${uk(toYmd(replace.period_start))} – ${uk(toYmd(replace.period_end))})` : ''}`);
  plans.push({ s, property, tenancy, original, replace });
}

// Generate Statement continues after the highest number it knows; make it skip historic numbers.
const seqPlans = [];
const flats = [...new Set(list.map((s) => String(s.flat)))];
for (const flat of flats) {
  const property = await db('properties').where({ block_name: 'PH', apartment_number: flat }).first();
  if (!property) continue;
  const t = await db('tenancies').where('property_id', property.id).whereIn('status', ['active', 'notice', 'pending']).orderBy('start_date', 'desc').first();
  if (!t) continue;
  const prefix = `PH_${flat}_`;
  const used = (await db('landlord_statements').where('statement_number', 'like', `${prefix}%`).pluck('statement_number'))
    .filter((n) => !plans.some((p) => p.replace && p.replace.statement_number === n));
  const next = Math.max(0, ...used.map(seqOf), t.last_statement_seq || 0) + 1;
  const historicMax = Math.max(0, ...plans.filter((p) => String(p.s.flat) === flat).map((p) => seqOf(p.s.statement_number)),
    ...(await db('historic_statements').where('flat', `PH-${flat}`).pluck('statement_number')).map(seqOf));
  if (historicMax >= next) {
    console.log(`NUMBERS  PH-${flat}: Generate Statement's next number ${prefix}${String(next).padStart(4, '0')} → ${prefix}${String(historicMax + 1).padStart(4, '0')} (${prefix}${String(historicMax).padStart(4, '0')} is historic)`);
    seqPlans.push({ t, seq: historicMax });
  }
}

if (!plans.length && !seqPlans.length) { console.log(`\nNothing to import.${refused ? ` ${refused} refused.` : ''}`); await done(refused ? 1 : 0); }
if (!APPLY) { console.log(`\nDRY RUN — nothing changed. ${plans.length} to import. To do it: add --apply --rl-db=${rlName}`); await done(0); }

const { generatePortraitPDFWithPuppeteer } = await mod('src/utils/puppeteerGenerator.js');
const { rocaLivingStatementPdfHtml } = await mod('src/templates/rocaLivingStatementTemplate.js');
const admin = await db('users').where('role', 'ADMIN').orderBy('id').first('id');
let folder = await db('folders').where('name', 'Landlord Statements').first();
if (!folder) { const [id] = await db('folders').insert({ name: 'Landlord Statements', owner_type: 'global' }); folder = { id }; }

for (const { s, property, tenancy, original, replace } of plans) {
  const landlord = property.landlord_id ? await db('users').where('id', property.landlord_id).first('name') : null;
  const details = await historicLandlordDetails(property, landlord?.name);
  const row = {
    property_id: property.id, tenancy_id: tenancy?.id || null, landlord_id: property.landlord_id || null,
    flat: `PH-${s.flat}`, statement_number: s.statement_number, invoice_number: s.invoice_number,
    landlord_name: details.landlord_name, tenant_name: s.tenant_name,
    period_start: s.period_start, period_end: s.period_end, issued_on: s.issued_on, tenancy_start: s.tenancy_start || null,
    income_lines: JSON.stringify(s.income_lines), expenditure_lines: JSON.stringify(s.expenditure_lines),
    invoice_lines: JSON.stringify(s.invoice_lines), invoice_notes: s.invoice_notes || null,
    total_income: s.total_income, total_expenditure: s.total_expenditure, net_paid: s.payment_amount,
    paid_on: s.paid_on || null, source_file: s.source_file, original_document_id: original?.id || null,
  };
  const { statementData, invoiceData } = historicDocData(row, property, details, s.tenancy_start);
  const pdf = await generatePortraitPDFWithPuppeteer(rocaLivingStatementPdfHtml(statementData, invoiceData), { fullBleed: true });
  const filename = `RL_${s.statement_number}_${s.invoice_number}.pdf`;
  const relativePath = `uploads/statements/${Date.now()}_historic_${filename}`;
  fs.mkdirSync(path.join(process.cwd(), 'uploads/statements'), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), relativePath), pdf);
  await db.transaction(async (trx) => {
    if (replace) {
      if (replace.invoice_id) {
        await trx('invoice_items').where('invoice_id', replace.invoice_id).delete();
        await trx('landlord_statements').where('id', replace.id).update({ invoice_id: null });
        await trx('invoices').where('id', replace.invoice_id).delete();
      }
      await trx('landlord_statements').where('id', replace.id).delete();
      if (replace.document_id) await trx('documents').where('id', replace.document_id).delete();
      await trx('audit_log').insert({ actor_id: admin.id, actor_role: 'ADMIN', action: 'STATEMENT_REPLACED_BY_HISTORIC', entity_type: 'statement', entity_id: replace.id,
        meta: JSON.stringify({ number: replace.statement_number, period: [toYmd(replace.period_start), toYmd(replace.period_end)], by: 'import-historic-statements.mjs', reason: "client's version kept (user, 4 Nov 2026)" }), ip_address: null });
    }
    const [docId] = await trx('documents').insert({
      folder_id: folder.id, owner_type: property.landlord_id ? 'landlord' : 'global', owner_id: property.landlord_id || 0,
      doc_type: 'landlord_statement', filename, original_name: `Historic statement ${s.statement_number}`, mime_type: 'application/pdf',
      file_path: relativePath, file_size_bytes: pdf.length, uploaded_by: admin.id, doc_reference: `TEMP-DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    });
    await trx('documents').where('id', docId).update({ doc_reference: `REM-DOC-${String(docId).padStart(5, '0')}` });
    const [id] = await trx('historic_statements').insert({ ...row, document_id: docId });
    await trx('audit_log').insert({ actor_id: admin.id, actor_role: 'ADMIN', action: 'HISTORIC_STATEMENT_IMPORTED', entity_type: 'historic_statement', entity_id: id,
      meta: JSON.stringify({ number: s.statement_number, net_paid: s.payment_amount, source: s.source_file, by: 'import-historic-statements.mjs' }), ip_address: null });
  });
  console.log(`imported: ${s.statement_number}${replace ? ' (replaced Roca Living\'s own)' : ''}`);
}
for (const { t, seq } of seqPlans) {
  await db('tenancies').where('id', t.id).update({ last_statement_seq: seq });
  await db('audit_log').insert({ actor_id: admin.id, actor_role: 'ADMIN', action: 'TENANCY_STATEMENT_SEQ_SET', entity_type: 'tenancy', entity_id: t.id,
    meta: JSON.stringify({ last_statement_seq: seq, reason: 'historic statements imported', by: 'import-historic-statements.mjs' }), ip_address: null });
  console.log(`numbers: tenancy #${t.id} last statement no. → ${seq}`);
}
console.log('\nDone. Run it again (without --apply): everything should show "already imported".');
await done(0);
