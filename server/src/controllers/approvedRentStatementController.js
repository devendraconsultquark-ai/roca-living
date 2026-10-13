import fs from 'fs';
import path from 'path';
import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { toYmd } from '../utils/dateHelpers.js';
import { estateDisplayFor } from '../utils/estatesLink.js';
import { formatNrl } from '../utils/statementNumbering.js';
import { generatePortraitPDFWithPuppeteer } from '../utils/puppeteerGenerator.js';
import { rocaLivingStatementPdfHtml, rocaLivingInvoicePdfHtml } from '../templates/rocaLivingStatementTemplate.js';

// "Statement from approved rent" — a SEPARATE flow next to the existing
// Generate Statement (which is not changed, by client request). A landlord
// statement built only from rent the admin approved in Accounting → Rent to
// Approve: rent received, ROCA's management fee and the landlord's net, with its
// own numbering (AR-PH_08_0001) so the two flows never collide. The PDF uses the
// same design as today's statements (template imported unchanged). No email.

const TENANCY_TYPE = 'Assured Periodic (APT)';
const pad = (n, w) => String(n).padStart(w, '0');
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const uk = (ymd) => ymd.split('-').reverse().join('/');
const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
const unitPrefix = (block, apt) => {
  const a = String(apt ?? '').trim();
  return `AR-${String(block || '').trim().toUpperCase()}_${/^\d$/.test(a) ? `0${a}` : a}_`;
};

const tenancyContext = (tenancyId) => db('tenancies as t')
  .join('properties as p', 't.property_id', 'p.id')
  .leftJoin('users as l', 'p.landlord_id', 'l.id')
  .leftJoin('tenants as lead', function () {
    this.on('lead.tenancy_id', '=', 't.id').andOn('lead.is_lead_tenant', '=', db.raw('1'));
  })
  .where('t.id', tenancyId)
  .first(
    't.id as tenancy_id', 't.start_date', 'p.id as property_id', 'p.block_name', 'p.apartment_number',
    'p.address_line1', 'p.address_line2', 'p.city', 'p.postcode', 'p.rocaem_property_id', 'p.landlord_id',
    'l.name as landlord_name', 'l.email as landlord_email', 'lead.name as tenant_name'
  );

// Approved rent of a tenancy in a period that is on no approved-rent statement yet.
const paymentsFor = (tenancyId, from, to) => db('rent_payments')
  .where({ tenancy_id: tenancyId, approval_status: 'approved' })
  .whereNull('approved_statement_id')
  .whereBetween('received_at', [from, to])
  .orderBy('received_at');

// Landlord details as on today's statements: live from ROCA Estates, else local.
const landlordDetails = async (t) => {
  const live = await estateDisplayFor(t.rocaem_property_id);
  const initials = live?.statement_initials || '';
  return {
    landlord_name: live?.landlord_name || t.landlord_name || '',
    landlord_address: live?.landlord_address || '',
    nrl_number: formatNrl(live?.nrl_number || '', initials),
    property_address: live?.property_address || [t.address_line1, t.address_line2, t.city, t.postcode].filter(Boolean).join(', ')
  };
};

// Statement + fee invoice data in the shape the existing PDF template expects.
const buildDocument = async (t, payments, from, to, statementNumber) => {
  const details = await landlordDetails(t);
  const flat = `${String(t.block_name || '').toUpperCase()}-${t.apartment_number}`;
  const totalRent = round2(payments.reduce((s, p) => s + Number(p.amount), 0));
  const totalFee = round2(payments.reduce((s, p) => s + Number(p.fee_amount || 0), 0));
  const net = round2(payments.reduce((s, p) => s + Number(p.net_amount ?? p.amount), 0));
  const invoiceNumber = totalFee > 0 ? `INV_${statementNumber}` : null;
  const common = {
    landlord_name: details.landlord_name,
    landlord_address: details.landlord_address,
    property_address: details.property_address,
    tenant_name: t.tenant_name || '',
    tenancy_start_date: toYmd(t.start_date),
    tenancy_type: TENANCY_TYPE,
    period_start: from,
    period_end: to,
    issue_date: toYmd(new Date())
  };
  const statementData = {
    ...common,
    statement_number: statementNumber,
    nrl_number: details.nrl_number,
    landlord_reference: `RL_LR_${String(t.block_name || '').toUpperCase()}_${t.apartment_number}`,
    property_reference: flat,
    previous_balance: 0,
    income_lines: payments.map((p) => ({
      description: `Rent received — ${t.tenant_name || 'Tenant'} (${uk(toYmd(p.received_at))})`,
      amount: round2(p.amount)
    })),
    expenditure_lines: invoiceNumber ? [{ description: `Invoice No. ${invoiceNumber} (see accompanying invoice)`, amount: totalFee }] : [],
    total_income: totalRent,
    total_expenditure: totalFee,
    payment_amount: net,
    payment_confirmed: false
  };
  const invoiceData = invoiceNumber ? {
    ...common,
    invoice_number: invoiceNumber,
    service_level: 'Fully Managed',
    notes: '',
    line_items: payments.filter((p) => Number(p.fee_amount) > 0).map((p) => ({
      description: `Management Fee ${Number(p.fee_pct)}% (rent received ${uk(toYmd(p.received_at))})`,
      cost: round2(p.fee_amount), vat_percent: 0, discount: 0
    })),
    total_gross: totalFee,
    total_vat: 0,
    total_discount: 0,
    total_net: totalFee
  } : null;
  return { statementData, invoiceData, totalRent, totalFee, net, invoiceNumber, landlordName: details.landlord_name };
};

const renderPdfs = async (statementData, invoiceData) => ({
  statementPdf: await generatePortraitPDFWithPuppeteer(rocaLivingStatementPdfHtml(statementData, invoiceData), { fullBleed: true }),
  invoicePdf: invoiceData ? await generatePortraitPDFWithPuppeteer(rocaLivingInvoicePdfHtml(invoiceData), { fullBleed: true }) : null
});

const readRequest = async (body) => {
  const tenancyId = Number(body?.tenancy_id);
  const from = String(body?.period_start || '');
  const to = String(body?.period_end || '');
  if (!Number.isInteger(tenancyId)) throw new ApiError(400, 'Choose the tenancy');
  if (!isYmd(from) || !isYmd(to) || from > to) throw new ApiError(400, 'Choose a valid period');
  const t = await tenancyContext(tenancyId);
  if (!t) throw new ApiError(404, 'Tenancy not found');
  // From the Rent Cycle page: exactly the payments of that rent month (the
  // period printed is the rent month, even if the money came in earlier).
  const ids = Array.isArray(body?.payment_ids) ? body.payment_ids.map(Number).filter(Number.isInteger) : null;
  const payments = ids?.length
    ? await db('rent_payments').whereIn('id', ids).where({ tenancy_id: tenancyId, approval_status: 'approved' }).whereNull('approved_statement_id').orderBy('received_at')
    : await paymentsFor(tenancyId, from, to);
  if (!payments.length) throw new ApiError(400, 'No approved rent in this period that is not already on an approved-rent statement');
  return { t, payments, from, to };
};

const nextNumber = async (t) => {
  const prefix = unitPrefix(t.block_name, t.apartment_number);
  const used = await db('approved_rent_statements').where('statement_number', 'like', `${prefix}%`).pluck('statement_number');
  const max = used.reduce((m, n) => Math.max(m, parseInt(n.slice(prefix.length), 10) || 0), 0);
  return `${prefix}${pad(max + 1, 4)}`;
};

// GET /approved-statements/candidates — tenancies with approved rent not on a statement yet.
export const listCandidates = catchAsync(async (req, res) => {
  const rows = await db('rent_payments as rp')
    .join('tenancies as t', 'rp.tenancy_id', 't.id')
    .join('properties as p', 't.property_id', 'p.id')
    .leftJoin('users as l', 'p.landlord_id', 'l.id')
    .leftJoin('tenants as lead', function () {
      this.on('lead.tenancy_id', '=', 't.id').andOn('lead.is_lead_tenant', '=', db.raw('1'));
    })
    .where('rp.approval_status', 'approved')
    .whereNull('rp.approved_statement_id')
    .groupBy('t.id', 'p.block_name', 'p.apartment_number', 'l.name', 'lead.name')
    .select('t.id as tenancy_id', 'p.block_name', 'p.apartment_number', 'l.name as landlord_name', 'lead.name as tenant_name')
    .count('rp.id as payments')
    .sum({ total_rent: 'rp.amount', total_fee: 'rp.fee_amount', net: 'rp.net_amount' })
    .min('rp.received_at as first_received')
    .max('rp.received_at as last_received');
  res.json({
    success: true,
    data: rows.map((r) => ({
      ...r,
      flat: `${String(r.block_name || '').toUpperCase()}-${r.apartment_number}`,
      payments: Number(r.payments),
      total_rent: round2(r.total_rent).toFixed(2),
      total_fee: round2(r.total_fee).toFixed(2),
      net: round2(r.net).toFixed(2),
      first_received: toYmd(r.first_received),
      last_received: toYmd(r.last_received)
    }))
  });
});

// POST /approved-statements/preview — the PDF, nothing saved.
export const previewApprovedStatement = catchAsync(async (req, res) => {
  const { t, payments, from, to } = await readRequest(req.body);
  const number = await nextNumber(t);
  const doc = await buildDocument(t, payments, from, to, number);
  const { statementPdf } = await renderPdfs(doc.statementData, doc.invoiceData);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="RL_${number}.pdf"`);
  res.send(statementPdf);
});

// POST /approved-statements — create it: PDF stored, payments marked.
export const createApprovedStatement = catchAsync(async (req, res) => {
  const { t, payments, from, to } = await readRequest(req.body);
  const number = await nextNumber(t);
  const doc = await buildDocument(t, payments, from, to, number);
  const { statementPdf } = await renderPdfs(doc.statementData, doc.invoiceData);

  const filename = `RL_${number}${doc.invoiceNumber ? `_${doc.invoiceNumber}` : ''}.pdf`;
  const relativePath = `uploads/statements/${Date.now()}_${filename}`;
  const abs = path.join(process.cwd(), relativePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });

  const id = await db.transaction(async (trx) => {
    let folder = await trx('folders').where('name', 'Landlord Statements').first();
    if (!folder) {
      const [folderId] = await trx('folders').insert({ name: 'Landlord Statements', owner_type: 'global' });
      folder = { id: folderId };
    }
    const [docId] = await trx('documents').insert({
      folder_id: folder.id,
      owner_type: t.landlord_id ? 'landlord' : 'global',
      owner_id: t.landlord_id || 0,
      doc_type: 'landlord_statement',
      filename,
      original_name: `Statement from approved rent (${number})`,
      mime_type: 'application/pdf',
      file_path: relativePath,
      file_size_bytes: statementPdf.length,
      uploaded_by: req.user.id,
      doc_reference: `TEMP-DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    });
    await trx('documents').where('id', docId).update({ doc_reference: `REM-DOC-${String(docId).padStart(5, '0')}` });
    const [statementId] = await trx('approved_rent_statements').insert({
      statement_number: number,
      invoice_number: doc.invoiceNumber,
      tenancy_id: t.tenancy_id,
      property_id: t.property_id,
      landlord_id: t.landlord_id || null,
      period_start: from,
      period_end: to,
      total_rent: doc.totalRent.toFixed(2),
      total_fee: doc.totalFee.toFixed(2),
      net_payout: doc.net.toFixed(2),
      landlord_name: doc.landlordName || null,
      document_id: docId,
      status: 'draft',
      created_by: req.user.id
    });
    await trx('rent_payments').whereIn('id', payments.map((p) => p.id)).update({ approved_statement_id: statementId });
    await trx('audit_log').insert({
      actor_id: req.user.id, actor_role: req.user.role, action: 'APPROVED_RENT_STATEMENT_CREATED',
      entity_type: 'approved_rent_statement', entity_id: statementId,
      meta: JSON.stringify({ number, payments: payments.map((p) => p.id), rent: doc.totalRent, fee: doc.totalFee, net: doc.net }),
      ip_address: req.ip || null
    });
    return statementId;
  });
  fs.writeFileSync(abs, statementPdf);
  res.status(201).json({ success: true, message: `Statement ${number} created`, data: { id, statement_number: number } });
});

// GET /approved-statements — the list (newest first).
export const listApprovedStatements = catchAsync(async (req, res) => {
  // ?month=YYYY-MM → statements whose period starts in that month (Rent Cycle page).
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? req.query.month : null;
  const rows = await db('approved_rent_statements as s')
    .modify((q) => { if (month) q.whereRaw("DATE_FORMAT(s.period_start, '%Y-%m') = ?", [month]); else q.limit(50); })
    .join('properties as p', 's.property_id', 'p.id')
    .leftJoin('tenants as lead', function () {
      this.on('lead.tenancy_id', '=', 's.tenancy_id').andOn('lead.is_lead_tenant', '=', db.raw('1'));
    })
    .orderBy('s.id', 'desc')
    .select('s.*', 'p.block_name', 'p.apartment_number', 'lead.name as tenant_name');
  res.json({
    success: true,
    data: rows.map((r) => ({
      ...r,
      flat: `${String(r.block_name || '').toUpperCase()}-${r.apartment_number}`,
      period_start: toYmd(r.period_start),
      period_end: toYmd(r.period_end),
      created_at: r.created_at ? new Date(r.created_at).toISOString() : null
    }))
  });
});

// GET /approved-statements/:id/pdf
export const downloadApprovedStatement = catchAsync(async (req, res) => {
  const s = await db('approved_rent_statements').where('id', req.params.id).first();
  if (!s) throw new ApiError(404, 'Statement not found');
  const doc = s.document_id ? await db('documents').where('id', s.document_id).first() : null;
  const abs = doc ? (path.isAbsolute(doc.file_path) ? doc.file_path : path.join(process.cwd(), doc.file_path)) : null;
  if (!abs || !fs.existsSync(abs)) throw new ApiError(404, 'Statement PDF not found');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
  fs.createReadStream(abs).pipe(res);
});

// DELETE /approved-statements/:id — a draft can be removed; its payments are freed.
export const deleteApprovedStatement = catchAsync(async (req, res) => {
  const s = await db('approved_rent_statements').where('id', req.params.id).first();
  if (!s) throw new ApiError(404, 'Statement not found');
  if (s.status !== 'draft') throw new ApiError(409, 'Only a draft statement can be deleted');
  const doc = s.document_id ? await db('documents').where('id', s.document_id).first() : null;
  await db.transaction(async (trx) => {
    await trx('rent_payments').where('approved_statement_id', s.id).update({ approved_statement_id: null });
    await trx('approved_rent_statements').where('id', s.id).delete();
    if (doc) await trx('documents').where('id', doc.id).delete();
    await trx('audit_log').insert({
      actor_id: req.user.id, actor_role: req.user.role, action: 'APPROVED_RENT_STATEMENT_DELETED',
      entity_type: 'approved_rent_statement', entity_id: s.id, meta: JSON.stringify({ number: s.statement_number }), ip_address: req.ip || null
    });
  });
  if (doc) {
    const abs = path.isAbsolute(doc.file_path) ? doc.file_path : path.join(process.cwd(), doc.file_path);
    fs.promises.unlink(abs).catch(() => {});
  }
  res.json({ success: true, message: `Statement ${s.statement_number} deleted` });
});
