import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ROCA Living's own statement + fee invoice design, ported from the client's
// statement tool (v9) so the PDFs match the ones he sends today (e.g.
// RL_PH_13_0004_INV_PH_13_0004.pdf): Hanken Grotesk, navy #1F4E79, A4 sheets.

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
      latinExt: asset('hanken-grotesk-latin-ext.woff2', 'font/woff2'),
      logo: asset('roca-living-logo.png', 'image/png')
    };
  }
  return cachedAssets;
};

const NAVY = '#1f4e79';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 'YYYY-MM-DD' (or Date) → parts, without timezone shifts.
const ymdParts = (v) => {
  if (!v) return null;
  if (v instanceof Date) return { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate() };
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
};
const pad2 = (n) => String(n).padStart(2, '0');
const ukDate = (v) => { const p = ymdParts(v); return p ? `${pad2(p.d)}/${pad2(p.m)}/${p.y}` : '—'; };
const longDate = (v) => { const p = ymdParts(v); return p ? `${p.d} ${MONTHS[p.m - 1]} ${p.y}` : ''; };
const num = (n) => (Number(n) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Cell amounts have no £ (the £ is a column of its own); negatives shown with −.
const cell = (n) => ((Number(n) || 0) < 0 ? `-${num(Math.abs(n))}` : num(n));
const money = (n) => ((Number(n) || 0) < 0 ? `-£${num(Math.abs(n))}` : `£${num(n)}`);
const lines = (text) => String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

// Property address in three lines as on ROCA's statements:
// "Apartment 13, Parsons House" / "Washington, Sunderland" / "NE37 1EZ".
const propertyLines = (address) => {
  if (/\r?\n/.test(address || '')) return lines(address);
  const parts = String(address || '').split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 2) return [parts.join(', ')].filter(Boolean);
  const postcode = parts[parts.length - 1];
  const rest = parts.slice(0, -1);
  return [rest.slice(0, 2).join(', '), rest.slice(2).join(', '), postcode].filter(Boolean);
};

const styles = () => {
  const a = assets();
  return `
  @font-face { font-family: 'Hanken Grotesk'; font-style: normal; font-weight: 100 900; src: url(${a.latinExt}) format('woff2');
    unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
  @font-face { font-family: 'Hanken Grotesk'; font-style: normal; font-weight: 100 900; src: url(${a.latin}) format('woff2');
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { background: #fff; font-family: 'Hanken Grotesk', 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1b2733;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .num { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1; }
  @page { size: A4; margin: 0; }
  .sheet { width: 210mm; height: 297mm; background: #fff; display: flex; flex-direction: column; overflow: hidden; break-after: page; break-inside: avoid; }
  .sheet:last-child { break-after: auto; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: right; font-weight: 500; vertical-align: bottom; border-bottom: 1px solid #e1e8ef; color: ${NAVY}; background: #e4edf6; padding-top: 7px; }
  th:first-child { text-align: left; }
  table th:first-child, table td:first-child { padding-left: 18px !important; }
  table th:last-child, table td:last-child { padding-right: 18px !important; }
  tr.drow td { border-bottom: 1px solid #eef2f6; }
  tr.trow-total td { border-top: 1.5px solid #d4dfea; background: #e4edf6; }
  `;
};

const header = (title, issueDate) => `
    <header style="display:flex; justify-content:space-between; align-items:flex-start; padding:40px 56px 22px;">
      <div>${assets().logo ? `<img src="${assets().logo}" alt="ROCA Living" style="height:64px; width:auto; display:block;">` : '<div style="font-size:26px;">ROCA Living</div>'}</div>
    </header>
    <div style="margin:0 56px; padding:18px 0 22px; border-top:2px solid ${NAVY}; display:flex; justify-content:space-between; align-items:baseline; height:70px;">
      <h1 style="margin:0; font-size:27px; font-weight:400; letter-spacing:-0.01em; color:#16202b;">${title}</h1>
      <div style="font-size:12.5px; color:#1F4E79;">${esc(longDate(issueDate))}</div>
    </div>`;

const recipient = (name, address) => `
        <div style="font-size:14px; font-weight:400; color:#16202b; line-height:1.7;">${[name, ...lines(address)].map(esc).join('<br>')}</div>`;

const metaBox = (rows, padding) => `
        <div style="border:1px solid #e1e8ef; border-radius:8px; overflow:hidden; align-self:start;">
          <div style="display:grid; grid-template-columns:auto 1fr; gap:4px 14px; padding:${padding}; font-size:12px; background-color:#f5f8fb;">
            ${rows.map(([k, v]) => `<div style="color:#204e79;">${k}</div><div class="num" style="text-align:right; color:#34424f;">${esc(v)}</div>`).join('\n            ')}
          </div>
        </div>`;

const detailCards = (d, padding) => `
        <div style="background:#f5f8fb; border:1px solid #e7eef4; border-radius:8px; padding:${padding};">
          <div style="font-size:13px; font-weight:500; letter-spacing:0.01em; color:${NAVY}; margin-bottom:9px;">Property Details</div>
          <div style="border-top:1px solid ${NAVY}; margin-bottom:10px;"></div>
          <div style="font-size:13px; font-weight:400; color:#34424f; line-height:1.7;">${propertyLines(d.property_address).map(esc).join('<br>') || '—'}</div>
        </div>
        <div style="background:#f5f8fb; border:1px solid #e7eef4; border-radius:8px; padding:${padding};">
          <div style="font-size:13px; font-weight:500; letter-spacing:0.01em; color:${NAVY}; margin-bottom:9px;">Tenant Details</div>
          <div style="border-top:1px solid ${NAVY}; margin-bottom:10px;"></div>
          <div style="display:grid; grid-template-columns:auto 1fr; gap:5px 12px; font-size:13px;">
            <div style="color:${NAVY};">Name</div><div style="text-align:right; color:#34424F;">${esc(d.tenant_name || '—')}</div>
            <div style="color:${NAVY};">Tenancy Type</div><div style="text-align:right; color:#34424F;">${esc(d.tenancy_type || 'Assured Periodic (APT)')}</div>
            <div style="color:${NAVY};">Tenancy Start Date</div><div class="num" style="text-align:right; color:#34424F;">${esc(ukDate(d.tenancy_start_date))}</div>
          </div>
        </div>`;

const footer = () => `
    <footer style="margin-top:auto; padding:16px 56px 22px; border-top:1px solid #eef2f6; display:flex; justify-content:space-between; align-items:center;">
      <div style="display:flex; align-items:center; gap:28px;">
        <div style="font-size:10.5px; color:${NAVY}; line-height:1.5;">Roca Property Group Limited trading as ROCA Living.<br>Registered in England &amp; Wales<br>Company No. 04914778</div>
        <div style="display:flex; flex-direction:row; gap:22px; font-size:11px; color:#5e7080; white-space:nowrap;">
          <span style="display:flex; align-items:center; gap:7px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${NAVY}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>0207 101 9551</span>
          <span style="display:flex; align-items:center; gap:7px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${NAVY}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>admin@rocaliving.co.uk</span>
          <span style="display:flex; align-items:center; gap:7px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${NAVY}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20"></path><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>www.rocaliving.co.uk</span>
        </div>
      </div>
    </footer>`;

// Income / Expenditure table. Expenditure amounts are costs (shown as they
// are, e.g. 68.00); a negative line is a credit to the landlord (-816.00).
const moneyTable = (title, rows, totalLabel, total) => `
      <div style="margin-bottom:${title === 'Income' ? 14 : 16}px;">
        <div style="font-size:13px; font-weight:700; letter-spacing:0.01em; color:#16202b; margin-bottom:7px;">${title}</div>
        <table style="font-size:12.5px;">
          <thead>
            <tr style="font-size:11.5px; letter-spacing:0.01em;">
              <th style="padding:0 0 7px;">Description</th>
              <th style="padding:0 0 7px 8px; width:16px;">£</th>
              <th style="padding:0 0 7px 14px; width:90px;">Amount</th>
              <th style="padding:0 0 7px 14px; width:70px;">VAT</th>
              <th style="padding:0 0 7px 14px; width:90px;">Gross</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r) => `<tr class="drow">
              <td style="padding:11px 0; color:#34424f;">${esc(r.description)}</td>
              <td></td>
              <td class="num" style="text-align:right; padding:11px 0 11px 14px; color:#34424f;">${cell(r.amount)}</td>
              <td class="num" style="text-align:right; padding:11px 0 11px 14px; color:#9aa7b3;">0.00</td>
              <td class="num" style="text-align:right; padding:11px 0 11px 14px; color:#1b2733; font-weight:600;">${cell(r.amount)}</td>
            </tr>`).join('\n            ')}
            <tr class="trow-total" style="color:#16202b;">
              <td style="padding:11px 0; font-weight:500; color:#1B2733;">${totalLabel}</td>
              <td></td>
              <td class="num" style="text-align:right; padding:11px 0 11px 14px; color:#1b2733; font-weight:500;">${cell(total)}</td>
              <td class="num" style="text-align:right; padding:11px 0 11px 14px; color:#9aa7b3; font-weight:700;">0.00</td>
              <td class="num" style="text-align:right; padding:11px 0 11px 14px; color:#1b2733; font-weight:600;">${cell(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>`;

/**
 * Statement sheet. data: issue_date, landlord_name, landlord_address,
 * statement_number, nrl_number, period_start, period_end, landlord_reference,
 * property_reference, property_address, tenant_name, tenancy_type,
 * tenancy_start_date, income_lines[], expenditure_lines[], previous_balance,
 * total_income, total_expenditure, payment_amount, payment_confirmed
 * ("Transferred" only once the landlord payout is confirmed — RL-P03 check 7).
 */
const statementSheet = (d) => {
  const income = Number(d.total_income) || 0;
  const expenditure = Number(d.total_expenditure) || 0;
  const previous = Number(d.previous_balance) || 0;
  const net = previous + income - expenditure;
  return `
  <section class="sheet">
    ${header('Statement of Account', d.issue_date)}
    <div style="padding:6px 56px 0; display:flex; flex-direction:column;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-bottom:12px;">
        <div>${recipient(d.landlord_name, d.landlord_address)}</div>
        ${metaBox([
    ['Statement No.', d.statement_number],
    ['NRL Number', d.nrl_number || '—'],
    ['Period', `${ukDate(d.period_start)} – ${ukDate(d.period_end)}`],
    ['Landlord Ref.', d.landlord_reference || '—'],
    ['Property Ref.', d.property_reference || '—']
  ], '14px 16px')}
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-bottom:12px;">
        ${detailCards(d, '16px 18px')}
      </div>
      ${moneyTable('Income', d.income_lines || [], 'Total Income', income)}
      ${moneyTable('Expenditure', d.expenditure_lines || [], 'Total Expenditure', expenditure)}
      <div style="display:grid; grid-template-columns:1fr 332px; gap:18px;">
        <div style="align-self:start;">
          <div style="font-size:13px; font-weight:700; letter-spacing:0.01em; color:#16202b; margin-bottom:10px;">Summary</div>
          <div style="display:flex; flex-direction:column; gap:9px; font-size:12.5px; width:332px; max-width:100%;">
            <div style="display:flex; justify-content:space-between; color:#34424f;"><span>Balance from previous statement</span><span class="num" style="display:inline-flex; gap:0;"><span>£</span><span style="width:84px; text-align:right;">${cell(previous)}</span></span></div>
            <div style="display:flex; justify-content:space-between; color:#34424f;"><span>Total Income for the period</span><span class="num">${money(income)}</span></div>
            <div style="display:flex; justify-content:space-between; color:#34424f;"><span>Less expenditure</span><span class="num">${money(expenditure)}</span></div>
            <div style="display:flex; justify-content:space-between; color:#16202b; font-weight:700; padding-top:9px; border-top:1px solid #e1e8ef;"><span>Net balance</span><span class="num">${money(net)}</span></div>
          </div>
        </div>
        <div style="align-self:stretch; border-radius:10px; padding:16px 22px; color:#fff; display:flex; flex-direction:column; justify-content:center; background-color:${NAVY};">
          <div style="font-size:13px; font-weight:700; letter-spacing:0.01em; color:#a9c6e3;">Payment this period</div>
          <div class="num" style="font-size:34px; font-weight:800; letter-spacing:-0.02em; margin:5px 0 7px;">${money(d.payment_amount)}</div>
          <div style="font-size:11px; color:#ffffff; line-height:1.5;">${d.payment_confirmed ? 'Transferred to your designated bank account.' : 'To be transferred to your designated bank account.'}</div>
        </div>
      </div>
    </div>
    ${footer()}
  </section>`;
};

/**
 * Fee invoice sheet. data: issue_date, landlord_name, landlord_address,
 * invoice_number, period_start, period_end, service_level, property_address,
 * tenant_name, tenancy_type, tenancy_start_date, line_items[{description, cost,
 * discount}], total_gross, total_vat, total_discount, total_net, notes.
 */
const invoiceSheet = (d) => {
  const items = d.line_items || [];
  const discount = Number(d.total_discount) || 0;
  const hasDiscount = discount > 0;
  const noteLines = lines(d.notes);
  return `
  <section class="sheet">
    ${header('Invoice', d.issue_date)}
    <div style="padding:6px 56px 0; display:flex; flex-direction:column; gap:18px;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:18px;">
        <div>${recipient(d.landlord_name, d.landlord_address)}</div>
        ${metaBox([
    ['Invoice No.', d.invoice_number],
    ['Period', `${ukDate(d.period_start)} – ${ukDate(d.period_end)}`],
    ['Service Level', d.service_level || 'Fully Managed']
  ], '12px 16px')}
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:18px;">
        ${detailCards(d, '11px 16px')}
      </div>
      <div>
        <div style="font-size:13px; font-weight:700; letter-spacing:0.01em; color:#16202b; margin-bottom:7px;">Property Services</div>
        <table style="font-size:12px;">
          <thead>
            <tr style="font-size:12px; letter-spacing:0.01em;">
              <th style="padding:0 0 7px;">Description</th>
              <th style="padding:0 0 7px 10px; width:14px;">£</th>
              <th style="padding:0 0 7px 10px; width:62px;">Net</th>
              <th style="padding:0 0 7px 10px; width:70px;">VAT (20%)</th>
              ${hasDiscount ? '<th style="padding:0 0 7px 10px; width:70px;">Discount</th>' : ''}
              <th style="padding:0 0 7px 10px; width:69px; white-space:nowrap;">Gross</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((i) => {
    const cost = Number(i.cost) || 0;
    const disc = Number(i.discount) || 0;
    return `<tr class="drow">
              <td style="padding:6px 0; color:#34424f;">${esc(i.description)}</td>
              <td></td>
              <td class="num" style="text-align:right; padding:6px 0 6px 10px; color:#34424f;">${cell(cost)}</td>
              <td class="num" style="text-align:right; padding:6px 0 6px 10px; color:#9aa7b3;">0.00</td>
              ${hasDiscount ? `<td class="num" style="text-align:right; padding:6px 0 6px 10px; color:#34424f;">${disc ? `-${num(disc)}` : '0.00'}</td>` : ''}
              <td class="num" style="text-align:right; padding:6px 0 6px 10px; color:#1b2733; font-weight:600;">${cell(cost - disc)}</td>
            </tr>`;
  }).join('\n            ')}
            <tr class="trow-total" style="color:#16202b;">
              <td style="padding:11px 0; font-weight:500; color:#1B2733;">Total Fees</td>
              <td></td>
              <td class="num" style="text-align:right; padding:11px 0 11px 10px; font-weight:500; color:#1B2733;">${cell(d.total_gross)}</td>
              <td class="num" style="text-align:right; padding:11px 0 11px 10px; color:#9aa7b3; font-weight:500;">0.00</td>
              ${hasDiscount ? `<td class="num" style="text-align:right; padding:11px 0 11px 10px; font-weight:500; color:#1B2733;">-${num(discount)}</td>` : ''}
              <td class="num" style="text-align:right; padding:11px 0 11px 10px; font-weight:600; color:#1B2733;">${cell(d.total_net)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style="display:grid; grid-template-columns:1fr 300px; gap:18px;">
        <div>
          <div style="font-size:13px; font-weight:700; letter-spacing:0.01em; color:#16202b; margin-bottom:9px;">Payment Terms</div>
          <ul style="margin:0; padding-left:16px; font-size:11.5px; color:#5e7080; line-height:1.65;">
            <li>Fees are deducted from rent received unless otherwise agreed.</li>
            <li>All amounts are exclusive of VAT. ROCA Living is not VAT registered.</li>
          </ul>
          ${noteLines.length ? `<div style="font-size:13px; font-weight:700; letter-spacing:0.01em; color:#16202b; margin:16px 0 9px;">Notes</div>
          <ul style="margin:0; padding-left:16px; font-size:11.5px; color:#5e7080; line-height:1.65;">
            ${noteLines.map((n) => `<li>${esc(n)}</li>`).join('')}
          </ul>` : ''}
        </div>
        <div style="border:1px solid #e1e8ef; border-radius:10px; overflow:hidden; align-self:start;">
          <div style="padding:14px 18px; display:flex; flex-direction:column; gap:9px; font-size:12.5px;">
            <div style="display:flex; justify-content:space-between; color:#34424f;"><span>Total Fees</span><span class="num">${money(d.total_gross)}</span></div>
            <div style="display:flex; justify-content:space-between; color:#34424f;"><span>VAT</span><span class="num">${money(d.total_vat)}</span></div>
            ${hasDiscount ? `<div style="display:flex; justify-content:space-between; color:#34424f;"><span>Discount</span><span class="num">−${money(discount)}</span></div>` : ''}
          </div>
          <div style="background:${NAVY}; color:#fff; padding:15px 18px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:13px; font-weight:700; letter-spacing:0.01em; color:#a9c6e3;">Net Fees Due</span>
            <span class="num" style="font-size:22px; font-weight:800;">${money(d.total_net)}</span>
          </div>
        </div>
      </div>
    </div>
    ${footer()}
  </section>`;
};

const page = (title, sheets) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${styles()}</style></head>
<body>${sheets}</body></html>`;

// Statement + fee invoice in one PDF (the file ROCA sends to the landlord).
export const rocaLivingStatementPdfHtml = (statement, invoice) =>
  page(statement.statement_number, statementSheet(statement) + (invoice ? invoiceSheet(invoice) : ''));

export const rocaLivingInvoicePdfHtml = (invoice) => page(invoice.invoice_number, invoiceSheet(invoice));

// File name as ROCA names them: "RL_PH_19_0002_INV_PH_19_0002.pdf" (statement
// and invoice always share the sequence: invoice number = INV_ + statement number).
export const rocaLivingPdfFileName = (statementNumber, invoiceNumber) =>
  `RL_${statementNumber}${invoiceNumber ? `_${invoiceNumber}` : ''}.pdf`.replace(/[^A-Za-z0-9_. -]/g, '_');
