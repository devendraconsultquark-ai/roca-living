import fs from 'fs';
import path from 'path';
import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { refreshFromEstates } from '../utils/estatesLink.js';

// Expenses recorded against a managed apartment during the month (cleaning,
// small repairs…). They pre-fill the statement for that month as expenditure
// and are marked used once deducted, so they are never deducted twice. The
// supplier invoice can be attached (RL-P03 check 4).

const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
};

const format = (e) => ({
  id: e.id,
  property_id: e.property_id,
  expense_date: ymd(e.expense_date),
  description: e.description,
  supplier: e.supplier,
  amount: parseFloat(e.amount).toFixed(2),
  statement_id: e.statement_id,
  statement_number: e.statement_number || null,
  has_invoice: !!e.invoice_path,
  invoice_name: e.invoice_name || null
});

// Supplier invoice files live under uploads/expenses/.
const removeFile = (rel) => {
  if (!rel) return;
  try { fs.unlinkSync(path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel)); } catch { /* already gone */ }
};
const fileFields = (file) => (file
  ? { invoice_path: file.path.split(path.sep).join('/'), invoice_name: file.originalname.slice(0, 255) }
  : {});

const findProperty = async (id) => {
  const p = await db('properties').where('id', id).first('id');
  if (!p) throw new ApiError(404, 'Property not found');
  return p;
};

// GET /properties/:id/expenses
export const listPropertyExpenses = catchAsync(async (req, res) => {
  await findProperty(req.params.id);
  const rows = await db('property_expenses as e')
    .leftJoin('landlord_statements as s', 'e.statement_id', 's.id')
    .where('e.property_id', req.params.id)
    .orderBy([{ column: 'e.expense_date', order: 'desc' }, { column: 'e.id', order: 'desc' }])
    .select('e.*', 's.statement_number');
  res.json({ success: true, data: rows.map(format) });
});

// POST /properties/:id/expenses  { expense_date, description, amount, supplier? }
// (JSON or multipart; optional file field "invoice" = the supplier invoice)
export const addPropertyExpense = catchAsync(async (req, res) => {
  const { expense_date: date, description, amount, supplier } = req.body || {};
  const desc = String(description || '').trim();
  const value = parseFloat(amount);
  let problem = null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) problem = 'Enter the expense date';
  else if (!desc || desc.length > 255) problem = 'Enter a description (up to 255 characters)';
  else if (!Number.isFinite(value) || value <= 0 || value > 1000000) problem = 'Enter an amount greater than 0';
  const property = await db('properties').where('id', req.params.id).first('id');
  if (!property || problem) {
    removeFile(req.file?.path);
    throw new ApiError(property ? 400 : 404, property ? problem : 'Property not found');
  }

  const [id] = await db('property_expenses').insert({
    property_id: req.params.id,
    expense_date: date,
    description: desc,
    supplier: String(supplier || '').trim().slice(0, 255) || null,
    amount: value.toFixed(2),
    created_by: req.user.id,
    ...fileFields(req.file)
  });
  await db('audit_log').insert({
    actor_id: req.user.id,
    actor_role: req.user.role,
    action: 'PROPERTY_EXPENSE_ADDED',
    entity_type: 'property',
    entity_id: req.params.id,
    meta: JSON.stringify({ expense_id: id, amount: value.toFixed(2), description: desc, invoice: !!req.file }),
    ip_address: req.ip || null
  });
  res.status(201).json({ success: true, data: format(await db('property_expenses').where('id', id).first()) });
});

// DELETE /properties/:id/expenses/:expenseId — only while not on a statement.
export const deletePropertyExpense = catchAsync(async (req, res) => {
  const e = await db('property_expenses').where({ id: req.params.expenseId, property_id: req.params.id }).first();
  if (!e) throw new ApiError(404, 'Expense not found');
  if (e.statement_id) throw new ApiError(409, 'This expense is already deducted on a statement and cannot be deleted');
  await db('property_expenses').where('id', e.id).delete();
  removeFile(e.invoice_path);
  res.json({ success: true });
});

// POST /properties/:id/expenses/:expenseId/invoice — attach or replace the supplier invoice.
export const attachExpenseInvoice = catchAsync(async (req, res) => {
  const e = await db('property_expenses').where({ id: req.params.expenseId, property_id: req.params.id }).first();
  if (!e || !req.file) {
    removeFile(req.file?.path);
    throw new ApiError(e ? 400 : 404, e ? 'Choose the invoice file (PDF, JPG or PNG)' : 'Expense not found');
  }
  await db('property_expenses').where('id', e.id).update(fileFields(req.file));
  removeFile(e.invoice_path);
  res.json({ success: true, data: format(await db('property_expenses').where('id', e.id).first()) });
});

// GET /properties/:id/expenses/:expenseId/invoice — download the supplier invoice.
export const downloadExpenseInvoice = catchAsync(async (req, res) => {
  const e = await db('property_expenses').where({ id: req.params.expenseId, property_id: req.params.id }).first();
  if (!e?.invoice_path) throw new ApiError(404, 'No invoice attached to this expense');
  const abs = path.isAbsolute(e.invoice_path) ? e.invoice_path : path.join(process.cwd(), e.invoice_path);
  if (!fs.existsSync(abs)) throw new ApiError(404, 'Invoice file not found');
  res.download(abs, e.invoice_name || path.basename(abs));
});

// POST /properties/:id/refresh-from-estates — copy the apartment address and
// the owner's name/address from ROCA Estates (when it has them).
export const refreshPropertyFromEstates = catchAsync(async (req, res) => {
  const updated = await db.transaction((trx) => refreshFromEstates(trx, req.params.id));
  res.json({
    success: true,
    data: { updated },
    message: updated.length ? `Updated ${updated.join(' and ')} from ROCA Estates` : 'ROCA Estates has no address or owner for this apartment yet — nothing changed'
  });
});
