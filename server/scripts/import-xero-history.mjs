// Put rent months from before Roca Living into Xero (paid rent invoice, paid
// landlord bill, fee / repair transfers) so the client's old bank lines can be
// matched, and keep them as read-only history in Roca Living (rent_history).
//
//   node scripts/import-xero-history.mjs                                             dry run (changes nothing)
//   node scripts/import-xero-history.mjs --apply --org="<Xero organisation name>"
// (months: scripts/data/history-months.json; another file with --file="<months.json>")
//
// The months file comes from the reconcile worksheet: only months where
// rent − fee − repairs = the landlord payout. Run again to carry on after a
// failure; months already done are skipped.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const argValue = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || null;
const FILE = argValue('file') || path.join(HERE, 'data', 'history-months.json');
const mod = (rel) => import(pathToFileURL(path.join(HERE, '..', rel)).href);
const { emDb, default: db } = await mod('src/config/db.js');
const { getStoredConnection } = await mod('src/utils/xero.js');
const { xeroThrottled: xero } = await mod('src/utils/xeroRentInvoices.js');
const { importHistory } = await mod('src/utils/xeroHistory.js');
const done = async (code = 0) => { await db.destroy(); await emDb.destroy(); process.exit(code); };

if (!FILE || !fs.existsSync(FILE)) {
  console.log(`Months file not found: ${FILE}`);
  await done(1);
}
const months = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const connection = await getStoredConnection();
if (!connection || connection.status !== 'active') {
  console.log('Xero is not connected (Settings → Xero).');
  await done(1);
}
const org = await xero('GET', '/Organisation');
const orgName = org.body?.Organisations?.[0]?.Name;
if (!orgName) {
  console.log('Could not read the Xero organisation.');
  await done(1);
}
if (APPLY && argValue('org') !== orgName) {
  console.log(`REFUSED: connected to Xero "${orgName}". To apply, pass exactly --org="${orgName}"`);
  await done(1);
}
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} on Xero "${orgName}" — ${months.length} month(s) from ${path.basename(FILE)}\n`);
try {
  const out = await importHistory({ months, apply: APPLY });
  console.log(`\n${APPLY ? `Done ${out.done}, already done ${out.skipped}, failed ${out.failed}` : `Would create ${out.would}, already done ${out.skipped}`}${out.refused ? `, refused ${out.refused}` : ''}.`);
  if (!APPLY) console.log(`Nothing was changed. To apply: add --apply --org="${orgName}"`);
  await done(out.failed || out.refused ? 1 : 0);
} catch (err) {
  console.log(`STOPPED: ${err.message}`);
  await done(1);
}
