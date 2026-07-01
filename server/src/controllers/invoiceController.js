import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { generatePortraitPDFWithPuppeteer } from '../utils/puppeteerGenerator.js';
import { generateStandaloneInvoiceHTML } from '../templates/statementInvoiceTemplate.js';
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
    throw new ApiError(400, `Invoice ${invoice_number} already exists`);
  }

  // ── No cross-DB resolution. All data comes from the form. ──
  // For local-source only, try a best-effort landlord_id lookup (not required).
  let landlordId = null;
  if (source === 'local' && landlord?.name) {
    const localUser = await db('users')
      .where({ role: 'LANDLORD' })
      .where('name', 'like', `%${landlord.name}%`)
      .first();
    if (localUser) landlordId = localUser.id;
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
  fs.writeFileSync(absolutePath, pdfBuffer);

  let invoiceId;
  await db.transaction(async (trx) => {
    // 1. Insert document record
    const [docId] = await trx('documents').insert({
      folder_id: null,
      owner_type: 'landlord',
      owner_id: landlordId || null,
      doc_type: 'landlord_invoice',
      filename,
      original_name: `Invoice ${invoice_number}`,
      mime_type: 'application/pdf',
      file_path: relativePath,
      file_size_bytes: pdfBuffer.length,
      uploaded_by: req.user.id
    });

    // 2. Insert invoice record
    [invoiceId] = await trx('invoices').insert({
      landlord_id: landlordId || null,
      landlord_name: landlord?.name || null,
      landlord_address: landlord?.address || null,
      source,
      source_property_id: source_property_id ? String(source_property_id) : null,
      property_id: null,                         // no local property FK needed
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

    // 4. Create ledgers / transaction entry of type 'deduction'
    await trx('transactions').insert({
      type: 'deduction',
      property_id: propertyId,
      landlord_id: landlordId,
      amount: totalNet.toFixed(2),
      vat_amount: totalVat.toFixed(2),
      description: `Invoice ${invoice_number} - Service Fee Charges`,
      transaction_date: trx.fn.now(),
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
    .join('users', 'invoices.landlord_id', 'users.id')
    .leftJoin('properties', 'invoices.property_id', 'properties.id')
    .select(
      'invoices.*',
      'users.name as landlord_name',
      'properties.address_line1 as property_address'
    )
    .orderBy('invoices.created_at', 'desc');

  if (req.user.role === 'LANDLORD') {
    query = query.where('invoices.landlord_id', req.user.id);
  }

  const invoices = await query;

  res.json({
    success: true,
    data: invoices.map(inv => ({
      ...inv,
      gross: parseFloat(inv.total_gross),
      discounts: parseFloat(inv.total_discount),
      net: parseFloat(inv.total_net),
      created_at: inv.created_at
    }))
  });
});

export const getInvoiceById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const invoice = await db('invoices')
    .join('users', 'invoices.landlord_id', 'users.id')
    .leftJoin('properties', 'invoices.property_id', 'properties.id')
    .select(
      'invoices.*',
      'users.name as landlord_name',
      'users.email as landlord_email',
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

  res.json({
    success: true,
    data: {
      ...invoice,
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
    throw new ApiError(404, `PDF file not found on disk: ${absolutePath}`);
  }

  const filename = docRecord.filename || path.basename(absolutePath);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.sendFile(absolutePath);
});
