import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { generatePortraitPDFWithPuppeteer } from '../utils/puppeteerGenerator.js';
import { generateStandaloneInvoiceHTML } from '../templates/statementInvoiceTemplate.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

export const generateInvoice = catchAsync(async (req, res, next) => {
  const {
    // Source tracking — tells us which DB this property came from
    source = 'local',           // 'local' | 'em'
    source_property_id = null,  // original property id in the source DB

    landlord,
    invoice_number,
    period_start,
    period_end,
    service_level,
    property,
    tenant_name,
    tenancy_start_date,
    line_items,
    total_amount,
    notes
  } = req.body;

  if (!invoice_number) {
    throw new ApiError(400, 'Invoice number is required');
  }
  if (!landlord?.name) {
    throw new ApiError(400, 'Landlord name is required');
  }

  // Check if invoice already exists
  const existing = await db('invoices').where({ invoice_number }).first();
  if (existing) {
    throw new ApiError(409, `Invoice ${invoice_number} already exists`);
  }

  // ── No cross-DB resolution. All data comes from the form. ──
  // Attribution requires an EXPLICIT landlord id (autofill metadata supplies it).
  // Never guess from the name — a fuzzy match can attach the invoice to the wrong
  // landlord, who could then view it via the portal. Unmatched invoices stay
  // unattributed (landlord_id NULL) and are visible to admin only.
  let landlordId = null;
  const explicitLandlordId = landlord?.id ?? req.body.landlord_id;
  if (explicitLandlordId !== undefined && explicitLandlordId !== null && explicitLandlordId !== '') {
    const localUser = await db('users').where({ id: explicitLandlordId, role: 'LANDLORD' }).first();
    if (!localUser) {
      throw new ApiError(400, `No landlord found with id ${explicitLandlordId}`);
    }
    landlordId = localUser.id;
  }

  // Calculate totals from line items
  let totalGross = 0;
  let totalVat = 0;
  let totalDiscount = 0;

  const itemsList = line_items || [];
  itemsList.forEach(item => {
    const cost = parseFloat(item.cost) || 0;
    const vatPct = parseFloat(item.vat_percent) || 0;
    const disc = parseFloat(item.discount) || 0;
    totalGross += cost;
    totalVat += (cost * vatPct) / 100;
    totalDiscount += disc;
  });

  const totalNet = Math.max(0, totalGross + totalVat - totalDiscount);

  // Build template input entirely from form data
  const templateInput = {
    landlord_name: landlord?.name || '',
    landlord_address: landlord?.address || '',
    invoice_number,
    period_start,
    period_end,
    service_level: service_level || 'Fully Managed',
    property_address: property?.address || '',
    tenant_name,
    tenancy_start_date,
    line_items: itemsList,
    total_gross: totalGross,
    total_vat: totalVat,
    total_discount: totalDiscount,
    total_net: totalNet,
    notes
  };

  // Generate PDF
  const htmlContent = generateStandaloneInvoiceHTML(templateInput);
  const pdfBuffer = await generatePortraitPDFWithPuppeteer(htmlContent);

  // Save PDF to disk
  const filename = `INV_${invoice_number}_${Date.now()}.pdf`;
  const relativePath = `uploads/invoices/${filename}`;
  const absolutePath = path.join(process.cwd(), relativePath);

  const dir = path.dirname(absolutePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Write the PDF only after the DB transaction commits (below), so a rollback leaves no orphaned file.

  let invoiceId;
  await db.transaction(async (trx) => {
    // 1. Insert document record
    const tempDocRef = `TEMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const [docId] = await trx('documents').insert({
      folder_id: null,
      // Unattributed invoices are 'global' documents — never owned by the
      // generating admin's user id (owner_id is NOT NULL, so 0 = none).
      owner_type: landlordId ? 'landlord' : 'global',
      owner_id: landlordId || 0,
      doc_type: 'landlord_invoice',
      filename,
      original_name: `Invoice ${invoice_number}`,
      mime_type: 'application/pdf',
      file_path: relativePath,
      file_size_bytes: pdfBuffer.length,
      uploaded_by: req.user.id,
      doc_reference: tempDocRef
    });

    const doc_reference = `REM-DOC-${String(docId).padStart(5, '0')}`;
    await trx('documents')
      .where({ id: docId })
      .update({ doc_reference });

    // For local-source invoices the source_property_id IS the local property id.
    // Verified against the DB because it feeds FK columns below.
    let localPropertyId = null;
    if (source === 'local' && source_property_id) {
      const localProp = await trx('properties').where('id', source_property_id).first();
      if (localProp) localPropertyId = localProp.id;
    }

    // 2. Insert invoice record
    [invoiceId] = await trx('invoices').insert({
      landlord_id: landlordId || null,
      landlord_name: landlord?.name || null,
      landlord_address: landlord?.address || null,
      source,
      source_property_id: source_property_id ? String(source_property_id) : null,
      property_id: localPropertyId,
      invoice_number,
      period_start: period_start || null,
      period_end: period_end || null,
      service_level: service_level || 'Fully Managed',
      tenant_name: tenant_name || null,
      tenancy_start_date: tenancy_start_date || null,
      total_gross: totalGross.toFixed(2),
      total_vat: totalVat.toFixed(2),
      total_discount: totalDiscount.toFixed(2),
      total_net: totalNet.toFixed(2),
      notes: notes || null,
      status: 'draft',
      document_id: docId,
      created_at: trx.fn.now()
    });

    // 3. Insert line items
    for (const item of itemsList) {
      const cost = parseFloat(item.cost) || 0;
      const vatPct = parseFloat(item.vat_percent) || 0;
      const disc = parseFloat(item.discount) || 0;
      const net = Math.max(0, cost + (cost * vatPct) / 100 - disc);

      await trx('invoice_items').insert({
        invoice_id: invoiceId,
        description: item.description || '',
        cost: cost.toFixed(2),
        vat_percent: vatPct.toFixed(2),
        discount: disc.toFixed(2),
        net: net.toFixed(2)
      });
    }

    // 4. Create ledgers / transaction entry of type 'deduction' — stamped with
    //    the invoice period and resolved property so ledger views line up.
    await trx('transactions').insert({
      type: 'deduction',
      property_id: localPropertyId,
      landlord_id: landlordId,
      amount: totalNet.toFixed(2),
      vat_amount: totalVat.toFixed(2),
      description: `Invoice ${invoice_number} - Service Fee Charges`,
      transaction_date: period_end || trx.fn.now(),
      reconciled: 1,
      created_by: req.user.id
    });

    // 5. Write Audit Log
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'INVOICE_GENERATED',
      entity_type: 'invoice',
      entity_id: invoiceId,
      meta: JSON.stringify({ landlord_id: landlordId, total_net: totalNet.toFixed(2), invoice_number }),
      ip_address: req.ip || null
    });
  });

  // Transaction committed — now persist the PDF to disk.
  fs.writeFileSync(absolutePath, pdfBuffer);

  res.status(201).json({
    success: true,
    data: {
      id: invoiceId,
      invoice_number,
      total_net: totalNet.toFixed(2),
      status: 'draft'
    }
  });
});

export const getInvoices = catchAsync(async (req, res, next) => {
  let query = db('invoices')
    .leftJoin('users', 'invoices.landlord_id', 'users.id')
    .leftJoin('properties', 'invoices.property_id', 'properties.id')
    .select(
      'invoices.*',
      // landlord_id is nullable (standalone / EM-sourced invoices); leftJoin keeps
      // those rows and we fall back to the denormalised name stored on the invoice.
      db.raw('COALESCE(users.name, invoices.landlord_name) as landlord_name'),
      'properties.address_line1 as property_address'
    )
    .orderBy('invoices.created_at', 'desc');

  if (req.user.role === 'LANDLORD') {
    query = query.where('invoices.landlord_id', req.user.id);
  }

  const invoices = await query;

  const isLandlordCaller = req.user.role === 'LANDLORD';

  res.json({
    success: true,
    data: invoices.map(inv => {
      // created_by is the internal admin user id — not for landlord consumption.
      const { created_by, ...rest } = inv;
      return {
        ...(isLandlordCaller ? rest : inv),
        gross: parseFloat(inv.total_gross),
        discounts: parseFloat(inv.total_discount),
        net: parseFloat(inv.total_net),
        created_at: inv.created_at
      };
    })
  });
});

export const getInvoiceById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const invoice = await db('invoices')
    .leftJoin('users', 'invoices.landlord_id', 'users.id')
    .leftJoin('properties', 'invoices.property_id', 'properties.id')
    .select(
      'invoices.*',
      // leftJoin + fallback so standalone / EM-sourced invoices (null landlord_id) resolve.
      db.raw('COALESCE(users.name, invoices.landlord_name) as landlord_name'),
      'users.email as landlord_email',   // null for standalone invoices (no linked user) — correct
      'properties.address_line1 as property_address'
    )
    .where('invoices.id', id)
    .first();

  if (!invoice) {
    throw new ApiError(404, 'Invoice not found');
  }

  if (req.user.role === 'LANDLORD' && invoice.landlord_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to view this invoice');
  }

  const items = await db('invoice_items').where('invoice_id', id);

  // created_by is the internal admin user id — not for landlord consumption.
  const { created_by, ...invoiceForLandlord } = invoice;

  res.json({
    success: true,
    data: {
      ...(req.user.role === 'LANDLORD' ? invoiceForLandlord : invoice),
      gross: parseFloat(invoice.total_gross),
      discounts: parseFloat(invoice.total_discount),
      net: parseFloat(invoice.total_net),
      items: items.map(item => ({
        ...item,
        cost: parseFloat(item.cost),
        vat_percent: parseFloat(item.vat_percent),
        discount: parseFloat(item.discount),
        net: parseFloat(item.net)
      }))
    }
  });
});

// Forward-only lifecycle; 'paid' and 'voided' are terminal.
const INVOICE_TRANSITIONS = {
  draft: ['sent', 'paid', 'voided'],
  sent: ['paid', 'voided'],
  paid: [],
  voided: []
};

export const updateInvoiceStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !Object.prototype.hasOwnProperty.call(INVOICE_TRANSITIONS, status)) {
    throw new ApiError(400, 'status must be one of: draft, sent, paid, voided');
  }

  const invoice = await db('invoices').where('id', id).first();
  if (!invoice) {
    throw new ApiError(404, 'Invoice not found');
  }

  if (status === invoice.status) {
    throw new ApiError(400, `Invoice is already '${status}'`);
  }
  const allowed = INVOICE_TRANSITIONS[invoice.status] || [];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `Invalid status transition from '${invoice.status}' to '${status}'`);
  }

  await db.transaction(async (trx) => {
    await trx('invoices').where('id', id).update({ status });

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'INVOICE_STATUS_UPDATED',
      entity_type: 'invoice',
      entity_id: id,
      meta: JSON.stringify({ from: invoice.status, to: status }),
      ip_address: req.ip || null
    });
  });

  const updated = await db('invoices').where('id', id).first();

  res.json({
    success: true,
    data: {
      ...updated,
      gross: parseFloat(updated.total_gross),
      discounts: parseFloat(updated.total_discount),
      net: parseFloat(updated.total_net)
    }
  });
});

export const downloadInvoicePdf = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const invoice = await db('invoices').where('id', id).first();
  if (!invoice) {
    throw new ApiError(404, 'Invoice not found');
  }

  if (req.user.role === 'LANDLORD' && invoice.landlord_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to perform this action');
  }

  const docRecord = await db('documents').where('id', invoice.document_id).first();
  if (!docRecord) {
    throw new ApiError(404, 'Associated invoice document record not found');
  }

  // Resolve absolute path — file_path stored as relative 'uploads/invoices/...'
  const absolutePath = path.isAbsolute(docRecord.file_path)
    ? docRecord.file_path
    : path.join(process.cwd(), docRecord.file_path);

  if (!fs.existsSync(absolutePath)) {
    logger.warn(`Invoice PDF missing on disk: ${absolutePath}`);
    throw new ApiError(404, 'Invoice PDF file not found');
  }

  const filename = docRecord.filename || path.basename(absolutePath);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.sendFile(absolutePath);
});
