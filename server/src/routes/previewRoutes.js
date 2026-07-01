/**
 * DEV-ONLY: PDF Template Live Preview Routes
 *
 * These routes render the exact same HTML that Puppeteer uses to generate PDFs.
 * Open in a browser and refresh to see template changes instantly.
 *
 * Routes:
 *   GET /preview              — Index with links to all previews
 *   GET /preview/statement    — Statement of Account
 *   GET /preview/invoice      — Service Fee Invoice
 *   GET /preview/combined     — Both pages (statement + invoice) together
 *
 * Uses realistic dummy data so the layout renders fully.
 * Never mount this router in production.
 */

import express from 'express';
import {
  generateStandaloneStatementHTML,
  generateStandaloneInvoiceHTML,
  generateCombinedHTML,
} from '../templates/statementInvoiceTemplate.js';

const router = express.Router();

// ─── Realistic dummy data ──────────────────────────────────────────────────

const DUMMY_STATEMENT = {
  landlord_name: 'Mr Rob Belema & Geertje Adrianntje Hogenes',
  landlord_address: 'Apartment 3, Parsons House, Washington, Sunderland, NE37 1EZ',
  landlord_reference: 'LR-2024-047',
  nrl_number: 'NRL123456',
  statement_number: 'RL-STMT-2026-047',
  property_reference: 'PH-33',
  property_address: 'Apartment 33, Parsons House, Washington, Sunderland, NE37 1EZ',
  tenant_name: 'Mr James Wilson',
  tenancy_type: 'Assured Periodic Tenancy (APT)',
  tenancy_start_date: '2023-09-01',
  period_start: '2026-06-01',
  period_end: '2026-06-30',
  rent_received: '795.00',
  void_period_credit: '0.00',
  exp_amount: '250.00',
  exp_invoice_no: 'INV-2026-018',
  setup_rebate: '0.00',
  previous_balance: '0.00',
};

const DUMMY_INVOICE = {
  landlord_name: 'Mr Rob Belema & Geertje Adrianntje Hogenes',
  landlord_address: 'Apartment 3, Parsons House, Washington, Sunderland, NE37 1EZ',
  invoice_number: 'INV-2026-018',
  property_reference: 'PH-33',
  property_address: 'Apartment 33, Parsons House, Washington, Sunderland, NE37 1EZ',
  tenant_name: 'Mr James Wilson',
  tenancy_start_date: '2023-09-01',
  service_level: 'Fully Managed',
  period_start: '2026-06-01',
  period_end: '2026-06-30',
  line_items: [
    {
      description: 'Management Fee (10% of £795.00 monthly rent)',
      cost: '79.50',
      vat_percent: '0',
      discount: '0',
    },
    {
      description: 'Tenancy Set Up Fee',
      cost: '150.00',
      vat_percent: '0',
      discount: '50.00',
    },
    {
      description: 'Maintenance Coordination Fee',
      cost: '20.50',
      vat_percent: '0',
      discount: '0',
    },
  ],
  notes: null,
};

// ─── Routes ───────────────────────────────────────────────────────────────

/**
 * GET /preview
 * Index page with links to all previews.
 */
router.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PDF Template Preview — Dev</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #f1f5f9; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #1e293b; border-radius: 16px; padding: 40px 48px; max-width: 480px; width: 100%; box-shadow: 0 25px 50px rgba(0,0,0,0.5); }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .badge { display: inline-block; background: #ff9f43; color: #1a1a1a; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 100px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 24px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 28px; }
    .links { display: flex; flex-direction: column; gap: 10px; }
    a { display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: #0f172a; border-radius: 10px; text-decoration: none; color: #f1f5f9; font-size: 14px; font-weight: 500; border: 1px solid #334155; transition: border-color 0.2s, background 0.2s; }
    a:hover { background: #1e3a5f; border-color: #ff9f43; }
    .icon { font-size: 20px; }
    .hint { margin-top: 24px; font-size: 12px; color: #475569; text-align: center; }
    kbd { background: #334155; border-radius: 4px; padding: 1px 6px; font-family: monospace; color: #cbd5e1; }
  </style>
</head>
<body>
  <div class="card">
    <h1>📄 PDF Template Previewer</h1>
    <div class="badge">Dev Only</div>
    <p>Open a template in the browser and press <kbd>F5</kbd> or <kbd>Ctrl+R</kbd> to see your latest changes instantly — no PDF download needed.</p>
    <div class="links">
      <a href="/preview/statement" target="_blank">
        <span class="icon">🧾</span>
        <span>Statement of Account</span>
      </a>
      <a href="/preview/invoice" target="_blank">
        <span class="icon">🧮</span>
        <span>Service Fee Invoice</span>
      </a>
      <a href="/preview/combined" target="_blank">
        <span class="icon">📋</span>
        <span>Combined (Statement + Invoice)</span>
      </a>
    </div>
    <p class="hint">Edits to <kbd>statementInvoiceTemplate.js</kbd> reflect on next refresh.</p>
  </div>
</body>
</html>`);
});

/**
 * GET /preview/statement
 * Live HTML preview of the Statement of Account page.
 */
router.get('/statement', (req, res) => {
  const html = generateStandaloneStatementHTML(DUMMY_STATEMENT);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(wrapWithDevBanner(html, 'Statement of Account'));
});

/**
 * GET /preview/invoice
 * Live HTML preview of the Service Fee Invoice page.
 */
router.get('/invoice', (req, res) => {
  const html = generateStandaloneInvoiceHTML(DUMMY_INVOICE);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(wrapWithDevBanner(html, 'Service Fee Invoice'));
});

/**
 * GET /preview/combined
 * Live HTML preview of both pages together (statement + invoice).
 * This is exactly what Puppeteer renders to produce the combined PDF.
 */
router.get('/combined', (req, res) => {
  const html = generateCombinedHTML(DUMMY_STATEMENT, DUMMY_INVOICE);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(wrapWithDevBanner(html, 'Combined: Statement + Invoice'));
});

// ─── Helper: inject a sticky dev banner into the rendered HTML ─────────────

function wrapWithDevBanner(fullHtml, title) {
  const banner = `
    <div style="
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: #1a1a1a; color: #fff;
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 20px; font-family: system-ui, sans-serif; font-size: 13px;
      border-bottom: 2px solid #ff9f43; box-shadow: 0 2px 12px rgba(0,0,0,0.4);
    ">
      <span>
        <span style="background:#ff9f43;color:#1a1a1a;font-weight:700;font-size:10px;padding:2px 8px;border-radius:100px;text-transform:uppercase;margin-right:10px;">Dev Preview</span>
        <strong>${title}</strong>
      </span>
      <span style="color:#9ca3af;font-size:12px;">
        Press <kbd style="background:#374151;border-radius:4px;padding:1px 6px;font-family:monospace;color:#e5e7eb;">F5</kbd> to reload after code changes &nbsp;|&nbsp;
        <a href="/preview" style="color:#ff9f43;text-decoration:none;">← All Previews</a>
      </span>
    </div>
    <div style="height: 60px;"></div>
  `;

  // PDF-viewer centering styles injected into the page's own <head>
  const viewerStyles = `
    <style>
      /* Dev preview: grey viewer background, centred A4 page */
      body {
        background: #525659 !important;
        padding: 24px 0 40px !important;
        display: block !important;
      }
      .page {
        margin: 0 auto 32px auto !important;
        box-shadow: 0 4px 24px rgba(0,0,0,0.45) !important;
      }
    </style>
  `;

  // Inject viewer styles into <head> and banner right after <body>
  return fullHtml
    .replace('</head>', `${viewerStyles}</head>`)
    .replace('<body>', `<body>${banner}`);
}

export default router;
