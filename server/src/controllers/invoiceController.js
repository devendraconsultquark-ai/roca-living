import db, { emDb } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { generatePortraitPDFWithPuppeteer } from '../utils/puppeteerGenerator.js';
import { generateStandaloneInvoiceHTML } from '../templates/statementInvoiceTemplate.js';
import fs from 'fs';
import path from 'path';

// Helper to resolve landlord by name
const resolveLandlord = async (name) => {
  if (!name) {
    throw new ApiError(400, 'Landlord name is required for resolution');
  }

  // 1. Local check
  let landlord = await db('users').where({ role: 'LANDLORD' }).where('name', 'like', `%${name}%`).first();
  if (landlord) return landlord.id;

  // 2. Sibling DB check
  try {
    const emLandlord = await emDb('users').where({ role: 'LANDLORD' }).where('name', 'like', `%${name}%`).first();
    if (emLandlord) {
      // Find matching local landlord by email, or sync/fallback
      const localByEmail = await db('users').where({ email: emLandlord.email, role: 'LANDLORD' }).first();
      if (localByEmail) return localByEmail.id;
      throw new ApiError(404, `Landlord '${name}' found in emDb but has no synced local user account`);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(500, `Secondary database lookup failed for Landlord '${name}': ${err.message}`);
  }

  throw new ApiError(404, `Landlord '${name}' could not be resolved`);
};

// Helper to resolve property by address
const resolveProperty = async (address, landlordId) => {
  if (!address) {
    throw new ApiError(400, 'Property address is required for resolution');
  }

  // 1. Local check
  let property = await db('properties').where('address_line1', 'like', `%${address}%`).first();
  if (property) return property.id;

  // 2. Sibling DB check
  try {
    const emProp = await emDb('properties').where('name', 'like', `%${address}%`).first();
    if (emProp) {
      // fallback matching address
      const localByPostcode = await db('properties').where('postcode', emProp.postcode || '').first();
      if (localByPostcode) return localByPostcode.id;
      throw new ApiError(404, `Property '${address}' found in emDb but has no matching local property by postcode`);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(500, `Secondary database lookup failed for Property '${address}': ${err.message}`);
  }

  throw new ApiError(404, `Property '${address}' could not be resolved`);
};

export const generateInvoice = catchAsync(async (req, res, next) => {
  const {
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

  // Resolve landlord and property
  const landlordId = await resolveLandlord(landlord?.name);
  const propertyId = await resolveProperty(property?.address, landlordId);

  // Check if invoice already exists
  const existing = await db('invoices').where({ invoice_number }).first();
  if (existing) {
    throw new ApiError(400, `Invoice ${invoice_number} already exists`);
  }

  // Calculate totals
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

  // Prepare input for template (including address fallback)
  let resolvedAddress = property?.address;
  if (!resolvedAddress && propertyId) {
    const p = await db('properties').where({ id: propertyId }).first();
    resolvedAddress = p ? `${p.address_line1}, ${p.city}, ${p.postcode}` : '';
  }

  const templateInput = {
    landlord_name: landlord?.name || 'Landlord',
    landlord_address: landlord?.address || '',
    invoice_number,
    period_start,
    period_end,
    service_level: service_level || 'Fully Managed',
    property_address: resolvedAddress,
    tenant_name,
    tenancy_start_date,
    line_items: itemsList,
    total_gross: totalGross,
    total_vat: totalVat,
    total_discount: totalDiscount,
    total_net: totalNet,
    notes
  };

  // Compile PDF
  const htmlContent = generateStandaloneInvoiceHTML(templateInput);
  const pdfBuffer = await generatePortraitPDFWithPuppeteer(htmlContent);

  // Save PDF to disk
  const filename = `INV_${invoice_number}_${Date.now()}.pdf`;
  const relativePath = `uploads/invoices/${filename}`;
  const absolutePath = path.join(process.cwd(), relativePath);

  const dir = path.dirname(absolutePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(absolutePath, pdfBuffer);

  // Run in database transaction
  let invoiceId;
  await db.transaction(async (trx) => {
    // 1. Insert into documents table
    const [docId] = await trx('documents').insert({
      folder_id: null,
      owner_type: 'landlord',
      owner_id: landlordId,
      doc_type: 'landlord_invoice',
      filename,
      original_name: `Invoice ${invoice_number}`,
      mime_type: 'application/pdf',
      file_path: relativePath,
      file_size_bytes: pdfBuffer.length,
      uploaded_by: req.user.id
    });

    // 2. Insert into invoices table
    [invoiceId] = await trx('invoices').insert({
      landlord_id: landlordId,
      property_id: propertyId,
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

    // 3. Insert items
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

  const absolutePath = path.resolve(docRecord.file_path);
  if (!fs.existsSync(absolutePath)) {
    throw new ApiError(404, 'PDF file not found on disk');
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.sendFile(absolutePath);
});
