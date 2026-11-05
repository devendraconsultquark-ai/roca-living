import fs from 'fs';
import path from 'path';
import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { listStatements, statementTotals, STATEMENT_TYPES } from '../utils/statementsIndex.js';
import { downloadStatement } from './statementController.js';
import { downloadHistoricStatement } from './historicStatementController.js';

// Every statement in one list (Generate Statement, Rent Cycle, Historic) and
// the money totals worked out from it — the same figures on every page.

const numberOr = (v) => (v === undefined || v === '' ? null : Number(v));
const parseTypes = (v) => String(v || '').split(',').map((s) => s.trim()).filter((s) => STATEMENT_TYPES.includes(s));
const thisYear = () => new Date().getFullYear();

// Period filter on the statement period start: ?month=YYYY-MM or ?from=YYYY-MM-DD&to=YYYY-MM-DD.
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const periodFilter = (q) => {
  if (/^\d{4}-\d{2}$/.test(String(q.month || ''))) return (r) => String(r.period_start || '').startsWith(q.month);
  if (YMD.test(String(q.from || '')) && YMD.test(String(q.to || ''))) return (r) => r.period_start >= q.from && r.period_start <= q.to;
  return () => true;
};

// GET /all-statements?landlord_id=&property_id=&tenancy_id=&types=roca_living,historic&month=|from=&to=&year=2026
export const listAllStatements = catchAsync(async (req, res) => {
  const rows = (await listStatements({
    landlordId: numberOr(req.query.landlord_id),
    propertyId: numberOr(req.query.property_id),
    tenancyId: numberOr(req.query.tenancy_id),
    types: parseTypes(req.query.types)
  })).filter(periodFilter(req.query));
  const year = Number(req.query.year) || thisYear();
  res.json({ success: true, data: { rows, totals: statementTotals(rows), year, totals_year: statementTotals(rows, { year }) } });
});

// GET /all-statements/my — the logged-in landlord's statements (no Rent Cycle drafts).
export const listMyAllStatements = catchAsync(async (req, res) => {
  const rows = await listStatements({ landlordId: req.user.id, landlordView: true });
  const year = Number(req.query.year) || thisYear();
  res.json({ success: true, data: { rows, totals: statementTotals(rows), year, totals_year: statementTotals(rows, { year }) } });
});

// GET /all-statements/:key/pdf — rl-12 | ar-3 | h-5 (admin, or the landlord it belongs to).
export const downloadAnyStatement = catchAsync(async (req, res, next) => {
  const m = String(req.params.key || '').match(/^(rl|ar|h)-(\d+)$/);
  if (!m) throw new ApiError(400, 'Unknown statement');
  const [, kind, id] = m;
  if (kind === 'rl') { req.params.id = id; return downloadStatement(req, res, next); }
  if (kind === 'h') { req.params.id = id; return downloadHistoricStatement(req, res, next); }
  const a = await db('approved_rent_statements').where('id', id).first();
  if (!a) throw new ApiError(404, 'Statement not found');
  if (req.user.role !== 'ADMIN' && (a.landlord_id !== req.user.id || a.status === 'draft')) throw new ApiError(404, 'Statement not found');
  const doc = a.document_id ? await db('documents').where('id', a.document_id).first() : null;
  const abs = doc ? (path.isAbsolute(doc.file_path) ? doc.file_path : path.join(process.cwd(), doc.file_path)) : null;
  if (!abs || !fs.existsSync(abs)) throw new ApiError(404, 'Statement PDF not found');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.inline === '1' ? 'inline' : 'attachment'}; filename="${doc.filename}"`);
  fs.createReadStream(abs).pipe(res);
});
