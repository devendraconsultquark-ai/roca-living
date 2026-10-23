import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Property statement PDF (any From–To range): same look as ROCA Living's
// statements (Hanken Grotesk, navy #1F4E79, logo and footer), laid out like
// PayProp's property statement. The statement template itself is left alone.

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets', 'roca-living');
const asset = (name, mime) => {
  try {
    return `data:${mime};base64,${fs.readFileSync(path.join(ASSETS, name)).toString('base64')}`;
  } catch {
    return '';
  }
};
let cachedAssets = null;
const assets = () => {
  if (!cachedAssets) {
    cachedAssets = {
      latin: asset('hanken-grotesk-latin.woff2', 'font/woff2'),
      logo: asset('roca-living-logo.png', 'image/png'),
    };
  }
  return cachedAssets;
};

const NAVY = '#1f4e79';
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ukDate = (ymd) => { const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : '—'; };
const num = (n) => {
  const v = Number(n) || 0;
  const s = Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `-${s}` : s;
};

const table = (title, head, rows, total) => `
  <section style="margin-bottom:18px;">
    <div class="h">${title}</div>
    <table>
      <thead><tr>${head.map((h) => `<th style="${h.left ? 'text-align:left;' : ''}${h.w ? `width:${h.w}px;` : ''}">${h.t}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.length ? rows.map((r) => `<tr class="d">${r.map((c, i) => `<td class="${head[i].left ? '' : 'num r'}">${c}</td>`).join('')}</tr>`).join('') : `<tr class="d"><td colspan="${head.length}" style="color:#9aa7b3;">Nothing in this period</td></tr>`}
        ${total ? `<tr class="t">${total.map((c, i) => `<td class="${head[i].left ? '' : 'num r'}">${c}</td>`).join('')}</tr>` : ''}
      </tbody>
    </table>
  </section>`;

const balanceBox = (title, rows) => `
  <section style="flex:1; min-width:0;">
    <div class="h">${title}</div>
    <table>
      <thead><tr><th style="text-align:left;">Description</th><th style="width:90px;">Balance</th></tr></thead>
      <tbody>
        ${rows.map(([label, value, strong]) => `<tr class="${strong ? 't' : 'd'}"><td>${label}</td><td class="num r">${num(value)}</td></tr>`).join('')}
      </tbody>
    </table>
  </section>`;

/** data: the result of buildPropertyStatement(); detail: list every item instead of totals */
export const propertyStatementPdfHtml = (d, { detail = false } = {}) => {
  const a = assets();
  const ie = d.income_expenses;
  const ieRows = detail
    ? ie.detail.map((l) => [`${ukDate(l.date)} · ${esc(l.type)}`, esc(l.description), num(l.vat), num(l.income), num(l.expenditure ? -l.expenditure : 0), num(l.income - l.expenditure)])
    : ie.lines.map((l) => [esc(l.type), esc(l.description), num(l.vat), num(l.income), num(l.expenditure ? -l.expenditure : 0), num(l.income - l.expenditure)]);
  const ownerLines = [d.owner.name, ...String(d.owner.address || '').split(/\r?\n/)].map((x) => x.trim()).filter(Boolean);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Property statement</title><style>
  @font-face { font-family: 'Hanken Grotesk'; font-weight: 100 900; src: url(${a.latin}) format('woff2'); }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Hanken Grotesk', 'Helvetica Neue', Arial, sans-serif; color: #1b2733; font-size: 11.5px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { padding: 34px 44px 28px; }
  .num { font-variant-numeric: tabular-nums; }
  .r { text-align: right; }
  .h { font-size: 13px; font-weight: 700; color: #16202b; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: right; font-weight: 500; color: ${NAVY}; background: #e4edf6; padding: 6px 8px; font-size: 10.5px; }
  td { padding: 6px 8px; vertical-align: top; }
  tr.d td { border-bottom: 1px solid #eef2f6; }
  tr.t td { background: #e4edf6; font-weight: 600; border-top: 1.5px solid #d4dfea; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  </style></head><body><div class="page">
  <header style="display:flex; justify-content:space-between; align-items:flex-start;">
    <div>${a.logo ? `<img src="${a.logo}" alt="ROCA Living" style="height:52px;">` : '<div style="font-size:24px;">ROCA Living</div>'}</div>
    <div style="text-align:right; font-size:10.5px; color:${NAVY}; line-height:1.55;">
      Roca Property Group Limited trading as ROCA Living<br>Company No. 04914778<br>0207 101 9551 · admin@rocaliving.co.uk<br>www.rocaliving.co.uk
    </div>
  </header>
  <div style="display:flex; justify-content:space-between; align-items:flex-end; margin:20px 0 18px; padding-top:14px; border-top:2px solid ${NAVY};">
    <div>
      <div style="font-size:24px; color:#16202b;">Property statement</div>
      <div style="margin-top:6px; line-height:1.6;">
        <b>Property:</b> ${esc(d.property.name)}${d.property.unit ? ` (${esc(d.property.unit)})` : ''}<br>
        <b>Statement period:</b> ${ukDate(d.period.from)} to ${ukDate(d.period.to)}
      </div>
    </div>
    <div style="text-align:right; line-height:1.6;">${ownerLines.map(esc).join('<br>')}</div>
  </div>

  ${table('Income and expenses',
    [{ t: detail ? 'Date · Type' : 'Type', w: detail ? 150 : 110, left: true }, { t: 'Description', left: true }, { t: 'VAT', w: 60 }, { t: 'Income', w: 75 }, { t: 'Expenditure', w: 80 }, { t: 'Net return', w: 80 }],
    ieRows,
    ['Total', '', num(ie.total_vat), num(ie.total_income), num(-ie.total_expenditure), num(ie.net_return)])}

  <div style="display:flex; gap:18px; margin-bottom:18px;">
    ${balanceBox('Tenant account (debtor statement)', [
      ['Opening balance', d.debtor.opening, true],
      ['Rent due', d.debtor.rent_invoiced],
      ['Payments received', -d.debtor.payments_received],
      ['Closing balance (owed by tenant)', d.debtor.closing, true],
    ])}
    ${balanceBox('Fees and costs (creditor statement)', [
      ['Opening balance due', d.creditor.opening, true],
      ['ROCA Living fees', -d.creditor.fees_charged],
      ['Costs', -d.creditor.costs_charged],
      ['Paid from rent', d.creditor.payments_made],
      ['Closing balance due', d.creditor.closing, true],
    ])}
  </div>

  ${table('Owner summary',
    [{ t: 'Opening balance' }, { t: 'Return for period' }, { t: 'Paid to owner' }, { t: 'Closing balance (held for owner)' }],
    [[num(d.owner_summary.opening), num(d.owner_summary.return_for_period), num(-d.owner_summary.paid_to_owner), num(d.owner_summary.closing)]])}

  ${table('Cash flow statement',
    [{ t: 'Date', w: 72, left: true }, { t: 'Type', w: 110, left: true }, { t: 'Description', left: true }, { t: 'Received', w: 75 }, { t: 'Paid', w: 75 }, { t: 'Balance', w: 80 }],
    [[ukDate(d.period.from), '<b>Opening balance</b>', '', '', '', num(d.cash_flow.opening)],
      ...d.cash_flow.lines.map((f) => [ukDate(f.date), esc(f.type), esc(f.description), f.received ? num(f.received) : '', f.paid ? num(f.paid) : '', num(f.balance)])],
    [ukDate(d.period.to), '<b>Closing balance</b>', '', '', '', num(d.cash_flow.closing)])}

  <footer style="margin-top:14px; font-size:9.5px; color:#5e7080; line-height:1.5;">
    ${d.notes.map(esc).join('<br>')}<br>Generated on ${ukDate(d.generated_on)} · ROCA Living
  </footer>
  </div></body></html>`;
};
