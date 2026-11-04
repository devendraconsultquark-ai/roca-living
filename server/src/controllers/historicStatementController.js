import fs from 'fs';
import path from 'path';
import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { toYmd } from '../utils/dateHelpers.js';

// Historic statements (F62): ROCA statements from before Roca Living took over,
// re-made in Roca Living's design with the bank's figures. Read-only.

const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v) || [];
const shape = (h) => ({
  id: h.id,
  flat: h.flat,
  statement_number: h.statement_number,
  invoice_number: h.invoice_number,
  landlord_id: h.landlord_id,
  landlord_name: h.landlord_name,
  tenant_name: h.tenant_name,
  period_start: toYmd(h.period_start),
  period_end: toYmd(h.period_end),
  issued_on: h.issued_on ? toYmd(h.issued_on) : null,
  total_income: Number(h.total_income),
  total_expenditure: Number(h.total_expenditure),
  net_paid: Number(h.net_paid),
  paid_on: h.paid_on ? toYmd(h.paid_on) : null,
  income_lines: parse(h.income_lines),
  has_pdf: !!h.document_id,
  has_original: !!h.original_document_id,
  xero_invoice_number: h.xero_invoice_number || null,
  xero_bill_number: h.xero_bill_number || null
});

// GET /historic-statements (admin) — ?flat=PH-13&landlord_id=9
export const listHistoricStatements = catchAsync(async (req, res) => {
  const q = db('historic_statements').orderBy('period_start', 'desc').orderBy('flat');
  if (req.query.flat) q.where('flat', String(req.query.flat));
  if (req.query.landlord_id) q.where('landlord_id', Number(req.query.landlord_id));
  res.json({ success: true, data: (await q).map(shape) });
});

// GET /historic-statements/my (landlord) — only the logged-in landlord's own.
export const listMyHistoricStatements = catchAsync(async (req, res) => {
  const rows = await db('historic_statements as h')
    .join('properties as p', 'h.property_id', 'p.id')
    .where('p.landlord_id', req.user.id)
    .orderBy('h.period_start', 'desc')
    .select('h.*', 'p.id as property_id');
  res.json({ success: true, data: rows.map((h) => ({ ...shape(h), property_id: h.property_id })) });
});

// GET /historic-statements/:id/pdf — the re-made PDF (admin, or the landlord who owns the flat).
// ?original=1 — the client's original PDF (admin only).
export const downloadHistoricStatement = catchAsync(async (req, res) => {
  const h = await db('historic_statements as h').join('properties as p', 'h.property_id', 'p.id')
    .where('h.id', req.params.id).first('h.*', 'p.landlord_id as owner_id');
  if (!h) throw new ApiError(404, 'Statement not found');
  const isAdmin = req.user.role === 'ADMIN';
  if (!isAdmin && h.owner_id !== req.user.id) throw new ApiError(404, 'Statement not found');
  const original = req.query.original === '1';
  if (original && !isAdmin) throw new ApiError(403, 'Not allowed');
  const docId = original ? h.original_document_id : h.document_id;
  const doc = docId ? await db('documents').where('id', docId).first() : null;
  const abs = doc ? (path.isAbsolute(doc.file_path) ? doc.file_path : path.join(process.cwd(), doc.file_path)) : null;
  if (!abs || !fs.existsSync(abs)) throw new ApiError(404, original ? 'Original PDF not found' : 'Statement PDF not found');
  const name = original ? (doc.original_name || doc.filename) : `RL_${h.statement_number}${h.invoice_number ? `_${h.invoice_number}` : ''}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.inline === '1' ? 'inline' : 'attachment'}; filename="${name.replace(/"/g, '')}"`);
  fs.createReadStream(abs).pipe(res);
});
