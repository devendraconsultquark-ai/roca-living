import db, { emDb } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { generatePortraitPDFWithPuppeteer } from '../utils/puppeteerGenerator.js';
import { generateStandaloneStatementHTML } from '../templates/statementInvoiceTemplate.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

const formatStatement = (s) => {
  if (!s) return null;
  return {
    ...s,
    gross_rent: s.gross_rent !== null && s.gross_rent !== undefined ? parseFloat(s.gross_rent).toFixed(2) : null,
    mgmt_fee: s.mgmt_fee !== null && s.mgmt_fee !== undefined ? parseFloat(s.mgmt_fee).toFixed(2) : null,
    mgmt_fee_vat: s.mgmt_fee_vat !== null && s.mgmt_fee_vat !== undefined ? parseFloat(s.mgmt_fee_vat).toFixed(2) : null,
    roca_letting_fee: s.roca_letting_fee !== null && s.roca_letting_fee !== undefined ? parseFloat(s.roca_letting_fee).toFixed(2) : null,
    agent_letting_fee: s.agent_letting_fee !== null && s.agent_letting_fee !== undefined ? parseFloat(s.agent_letting_fee).toFixed(2) : null,
    deductions: s.deductions !== null && s.deductions !== undefined ? parseFloat(s.deductions).toFixed(2) : null,
    nrl_withheld: s.nrl_withheld !== null && s.nrl_withheld !== undefined ? parseFloat(s.nrl_withheld).toFixed(2) : null,
    net_paid: s.net_paid !== null && s.net_paid !== undefined ? parseFloat(s.net_paid).toFixed(2) : null,
    period_start: s.period_start ? new Date(s.period_start).toISOString().split('T')[0] : null,
    period_end: s.period_end ? new Date(s.period_end).toISOString().split('T')[0] : null,
    generated_at: s.generated_at ? new Date(s.generated_at).toISOString() : null,
    paid_at: s.paid_at ? new Date(s.paid_at).toISOString() : null,
    created_at: s.created_at ? new Date(s.created_at).toISOString() : null
  };
};

export const generateStatements = catchAsync(async (req, res, next) => {
  const { statement_number } = req.body;

  const {
    // Source tracking — tells us which DB this property came from
    source = 'local',           // 'local' | 'em'
    source_property_id = null,  // original property id in the source DB
    landlord_id,                // explicit local landlord user id (from autofill)
    landlord_name,
    landlord_address,
    nrl_number,
    landlord_reference,
    property_reference,
    property_address,
    tenant_name,
    tenancy_type,
    tenancy_start_date,
    period_start,
    period_end,
    rent_received,
    void_period_credit,
    exp_invoice_no,
    exp_amount,
    setup_rebate,
    previous_balance,
    net_paid
  } = req.body;

  if (!statement_number) {
    throw new ApiError(400, 'Statement number is required');
  }
  if (!period_start || !period_end) {
    throw new ApiError(400, 'Period start and end dates are required');
  }
  if (!landlord_name) {
    throw new ApiError(400, 'Landlord name is required for statement generation');
  }

  // Check if statement number already exists
  const existing = await db('landlord_statements').where({ statement_number }).first();
  if (existing) {
    throw new ApiError(409, `Statement ${statement_number} already exists`);
  }

  // ── No cross-DB resolution. All data comes directly from the form. ──
  // Attribution requires an EXPLICIT landlord_id (the autofill metadata supplies it).
  // Never guess from the name: a fuzzy match can attach the statement to the wrong
  // landlord, who could then view it via the portal. Unmatched statements stay
  // unattributed (landlord_id NULL) and are visible to admin only.
  let landlordId = null;
  if (landlord_id !== undefined && landlord_id !== null && landlord_id !== '') {
    const localUser = await db('users').where({ id: landlord_id, role: 'LANDLORD' }).first();
    if (!localUser) {
      throw new ApiError(400, `No landlord found with id ${landlord_id}`);
    }
    landlordId = localUser.id;
  }

  // For local-source statements, resolve the local property id from its
  // reference when the caller didn't pass one explicitly. This attributes the
  // statement to a property so the landlord portal can scope financials per
  // unit. Best-effort — leaves it null if the property can't be resolved.
  let resolvedSourcePropertyId = source_property_id;
  if (source === 'local' && !resolvedSourcePropertyId && property_reference) {
    const localProp = await db('properties')
      .where({ property_reference })
      .first();
    if (localProp) resolvedSourcePropertyId = localProp.id;
  }
  // Verify a caller-supplied local property id actually exists — it is written
  // to FK columns (transactions.property_id) further down.
  if (source === 'local' && resolvedSourcePropertyId) {
    const exists = await db('properties').where('id', resolvedSourcePropertyId).first();
    if (!exists) resolvedSourcePropertyId = null;
  }

  // Build PDF template input entirely from form data
  const statementInput = {
    landlord_name,
    landlord_address,
    statement_number,
    nrl_number,
    landlord_reference,
    property_reference,
    property_address,
    tenant_name,
    tenancy_type,
    tenancy_start_date,
    period_start,
    period_end,
    rent_received,
    void_period_credit,
    exp_invoice_no,
    exp_amount,
    setup_rebate,
    previous_balance
  };

  // Generate PDF
  const htmlContent = generateStandaloneStatementHTML(statementInput);
  const pdfBuffer = await generatePortraitPDFWithPuppeteer(htmlContent);

  // Save PDF to disk — use statement_number (no landlord_id dependency)
  const filename = `RL_STMT_${statement_number}_${Date.now()}.pdf`;
  const relativePath = `uploads/statements/${filename}`;
  const absolutePath = path.join(process.cwd(), relativePath);

  const dir = path.dirname(absolutePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Write the PDF only after the DB transaction commits (below), so a rollback leaves no orphaned file.

  let statementId;
  await db.transaction(async (trx) => {
    // 1. Insert document record
    const tempDocRef = `TEMP-DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const [docId] = await trx('documents').insert({
      folder_id: null,
      // Unattributed statements (EM-sourced / no landlord match) are 'global'
      // documents — never owned by the generating admin's user id.
      owner_type: landlordId ? 'landlord' : 'global',
      owner_id: landlordId || 0,
      doc_type: 'landlord_statement',
      filename,
      original_name: `Landlord Statement (${statement_number})`,
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

    // 2. Insert statement record
    const tempStmtRef = `TEMP-STM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    [statementId] = await trx('landlord_statements').insert({
      landlord_id: landlordId || null,
      landlord_name,              // text snapshot (critical for EM-sourced records)
      landlord_address: landlord_address || null,
      source,
      source_property_id: resolvedSourcePropertyId ? String(resolvedSourcePropertyId) : null,
      period_start,
      period_end,
      gross_rent: parseFloat(rent_received || 0).toFixed(2),
      mgmt_fee: 0.00,
      mgmt_fee_vat: 0.00,
      roca_letting_fee: 0.00,
      agent_letting_fee: 0.00,
      deductions: parseFloat(exp_amount || 0).toFixed(2),
      nrl_withheld: 0.00,
      net_paid: parseFloat(net_paid || 0).toFixed(2),
      document_id: docId,
      status: 'draft',
      generated_at: trx.fn.now(),
      generated_by: req.user.id,
      statement_number,
      statement_reference: tempStmtRef,
      tenant_name: tenant_name || null,
      tenancy_type: tenancy_type || null,
      tenancy_start_date: tenancy_start_date || null,
      void_period_credit: parseFloat(void_period_credit || 0).toFixed(2),
      exp_invoice_no: exp_invoice_no || null,
      exp_amount: parseFloat(exp_amount || 0).toFixed(2),
      setup_rebate: parseFloat(setup_rebate || 0).toFixed(2),
      previous_balance: parseFloat(previous_balance || 0).toFixed(2)
    });

    const statement_reference = `REM-STM-${String(statementId).padStart(5, '0')}`;
    await trx('landlord_statements')
      .where({ id: statementId })
      .update({ statement_reference });

    // 3. Transaction ledgers (landlord_id may be null for EM sources)
    const ledgerRows = [
      { type: 'rent_in', amount: rent_received, desc: `Rent received for Statement ${statement_number}` },
      { type: 'landlord_payout', amount: net_paid, desc: `Net payout for Statement ${statement_number}` }
    ];
    if (parseFloat(void_period_credit) > 0) {
      ledgerRows.push({ type: 'other', amount: void_period_credit, desc: `Void period credit — ${statement_number}` });
    }
    if (parseFloat(exp_amount) > 0) {
      ledgerRows.push({ type: 'deduction', amount: exp_amount, desc: `Invoice ${exp_invoice_no || ''} deductions` });
    }

    // Stamp rows with the statement period (not the generation time) and the
    // resolved local property, so per-month and per-property views line up.
    const localPropertyId = source === 'local' && resolvedSourcePropertyId ? resolvedSourcePropertyId : null;
    const txRows = ledgerRows.map(row => ({
      type: row.type,
      landlord_id: landlordId || null,
      property_id: localPropertyId,
      statement_id: statementId,
      amount: parseFloat(row.amount || 0).toFixed(2),
      vat_amount: 0.00,
      description: row.desc,
      transaction_date: period_end,
      reconciled: 1,
      created_by: req.user.id
    }));
    await trx('transactions').insert(txRows);

    // 4. Audit log
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'STATEMENT_GENERATED',
      entity_type: 'landlord_statement',
      entity_id: statementId,
      meta: JSON.stringify({ landlord_id: landlordId, landlord_name, source, net_paid: parseFloat(net_paid || 0).toFixed(2), period_start, period_end, statement_number }),
      ip_address: req.ip || null
    });
  });

  // Transaction committed — now persist the PDF to disk.
  fs.writeFileSync(absolutePath, pdfBuffer);

  return res.status(201).json({
    success: true,
    data: [{
      statement_id: statementId,
      landlord_id: landlordId,
      landlord_name,
      source,
      period_start,
      period_end,
      gross_rent: parseFloat(rent_received || 0).toFixed(2),
      net_paid: parseFloat(net_paid || 0).toFixed(2),
      status: 'generated'
    }]
  });

});

export const getStatements = catchAsync(async (req, res, next) => {
  const statements = await db('landlord_statements')
    // landlord_id is nullable (standalone / EM-sourced statements); leftJoin keeps those
    // rows and we fall back to the text snapshot stored on the statement.
    .leftJoin('users', 'landlord_statements.landlord_id', 'users.id')
    .select(
      'landlord_statements.*',
      db.raw('COALESCE(users.name, landlord_statements.landlord_name) as landlord_name')
    )
    .orderBy('landlord_statements.created_at', 'desc');

  res.json({
    success: true,
    data: statements.map(formatStatement)
  });
});

export const getStatementById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const statement = await db('landlord_statements')
    .leftJoin('users', 'landlord_statements.landlord_id', 'users.id')
    .select(
      'landlord_statements.*',
      db.raw('COALESCE(users.name, landlord_statements.landlord_name) as landlord_name'),
      'users.email as landlord_email'
    )
    .where('landlord_statements.id', id)
    .first();

  if (!statement) {
    throw new ApiError(404, 'Statement not found');
  }

  // Authorization check: admin can see all; landlord can only see their own
  if (req.user.role === 'LANDLORD' && statement.landlord_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to view this statement');
  }

  const transactions = await db('transactions')
    .where('statement_id', id);

  res.json({
    success: true,
    data: {
      ...formatStatement(statement),
      transactions: transactions.map(t => ({
        ...t,
        amount: parseFloat(t.amount).toFixed(2),
        vat_amount: parseFloat(t.vat_amount || 0).toFixed(2)
      }))
    }
  });
});

export const getLandlordStatements = catchAsync(async (req, res, next) => {
  const statements = await db('landlord_statements')
    .where('landlord_id', req.user.id)
    .orderBy('created_at', 'desc');

  res.json({
    success: true,
    data: statements.map(formatStatement)
  });
});

// Forward-only lifecycle; 'paid' is terminal and stamps paid_at.
const STATEMENT_TRANSITIONS = {
  draft: ['sent', 'paid'],
  sent: ['paid'],
  paid: []
};

export const updateStatementStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !Object.prototype.hasOwnProperty.call(STATEMENT_TRANSITIONS, status)) {
    throw new ApiError(400, "status must be one of: draft, sent, paid");
  }

  const statement = await db('landlord_statements').where('id', id).first();
  if (!statement) {
    throw new ApiError(404, 'Statement not found');
  }

  if (status === statement.status) {
    throw new ApiError(400, `Statement is already '${status}'`);
  }
  const allowed = STATEMENT_TRANSITIONS[statement.status] || [];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `Invalid status transition from '${statement.status}' to '${status}'`);
  }

  await db.transaction(async (trx) => {
    await trx('landlord_statements')
      .where('id', id)
      .update({
        status,
        paid_at: status === 'paid' ? trx.fn.now() : statement.paid_at
      });

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'STATEMENT_STATUS_UPDATED',
      entity_type: 'landlord_statement',
      entity_id: id,
      meta: JSON.stringify({ from: statement.status, to: status }),
      ip_address: req.ip || null
    });
  });

  const updated = await db('landlord_statements').where('id', id).first();

  res.json({
    success: true,
    data: formatStatement(updated)
  });
});

export const downloadStatement = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const statement = await db('landlord_statements').where('id', id).first();
  if (!statement) {
    throw new ApiError(404, 'Statement not found');
  }

  if (req.user.role === 'LANDLORD' && statement.landlord_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to perform this action');
  }

  const docRecord = await db('documents').where('id', statement.document_id).first();
  if (!docRecord) {
    throw new ApiError(404, 'Associated statement document record not found');
  }

  // Resolve absolute path — file_path stored as relative 'uploads/statements/...'
  const absolutePath = path.isAbsolute(docRecord.file_path)
    ? docRecord.file_path
    : path.join(process.cwd(), docRecord.file_path);

  if (!fs.existsSync(absolutePath)) {
    logger.warn(`Statement PDF missing on disk: ${absolutePath}`);
    throw new ApiError(404, 'Statement PDF file not found');
  }

  const filename = docRecord.filename || path.basename(absolutePath);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.sendFile(absolutePath);
});

export const getAutofillMetadata = catchAsync(async (req, res, next) => {
  // 1. Fetch local properties
  const localProps = await db('properties')
    .leftJoin('users as landlords', 'properties.landlord_id', 'landlords.id')
    .leftJoin('landlord_profiles as profiles', 'landlords.id', 'profiles.user_id')
    .leftJoin('tenancies', function () {
      this.on('properties.id', '=', 'tenancies.property_id')
        .andOn('tenancies.status', '=', db.raw("'active'"));
    })
    .leftJoin('tenants', function () {
      this.on('tenancies.id', '=', 'tenants.tenancy_id')
        .andOn('tenants.is_lead_tenant', '=', db.raw("1"));
    })
    .select(
      'properties.id as property_id',
      'properties.address_line1',
      'properties.address_line2',
      'properties.city',
      'properties.postcode',
      'properties.block_name',
      'properties.apartment_number',
      'properties.rent_pcm as property_rent_pcm',
      'landlords.id as landlord_id',
      'landlords.name as landlord_name',
      'landlords.address as landlord_address',
      'profiles.initials as landlord_initials',
      'profiles.nrl_hmrc_ref as landlord_nrl_number',
      'tenancies.id as tenancy_id',
      'tenancies.start_date as tenancy_start_date',
      'tenancies.rent_pcm as tenancy_rent_pcm',
      'tenants.name as tenant_name'
    );

  // 2. Fetch remote (EM) properties
  let emProps = [];
  try {
    emProps = await emDb('properties')
      .leftJoin('users as landlords', 'properties.landlord_id', 'landlords.id')
      .leftJoin('tenant_leases as leases', function () {
        this.on('properties.id', '=', 'leases.property_id')
          .andOn('leases.status', '=', emDb.raw("'active'"));
      })
      .leftJoin('tenant_users as tenants', 'leases.tenant_id', '=', 'tenants.id')
      .select(
        'properties.id as property_id',
        'properties.name as property_name',
        'properties.unit_code',
        'properties.address as property_address',
        'properties.city as property_city',
        'properties.postcode as property_postcode',
        'properties.service_charge_pcm',
        'landlords.id as landlord_id',
        'landlords.name as landlord_name',
        'landlords.email as landlord_email',
        'landlords.address as landlord_address',
        'landlords.company_address as landlord_company_address',
        'leases.id as lease_id',
        'leases.lease_start as tenancy_start_date',
        'leases.monthly_rent as tenancy_rent_pcm',
        'tenants.full_name as tenant_name'
      );
  } catch (err) {
    logger.error(`[AutofillMetadata] Failed to fetch EM properties: ${err.message}`);
  }

  // 3. Resolve and format each property
  const allProperties = [];

  const parseBlockName = (name, blockDb) => {
    if (blockDb) return blockDb;
    if (!name) return 'SA';
    const upper = name.toUpperCase();
    if (upper.includes('PARSONS HOUSE') || upper.includes('PH')) return 'PH';
    if (upper.includes('DARWENT HOUSE') || upper.includes('DH')) return 'DH';
    const words = name.split(' ').filter(w => w.length > 0);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const parseApartmentNumber = (name, aptDb, unitCode) => {
    if (aptDb) return aptDb;
    if (unitCode) {
      const m = unitCode.match(/\d+/);
      if (m) return m[0];
    }
    if (!name) return '';
    const match = name.match(/(?:Unit|Apartment|Flat|Apt)\s*(\d+)/i) || name.match(/\b(\d+)\b/);
    return match ? match[1] : '';
  };

  const parseInitials = (name, initialsDb) => {
    if (initialsDb) return initialsDb;
    if (!name) return 'RL';
    const clean = name.replace(/(Mr|Mrs|Ms|Dr|Prof|Messrs)\.?\s+/gi, '');
    const parts = clean.split(/\s+&\s+|\s+and\s+/i);
    const initialsList = parts.map(part => {
      const words = part.split(/\s+/).filter(w => w.length > 0);
      if (words.length >= 2) {
        return (words[0][0] + words[words.length - 1][0]).toUpperCase();
      } else if (words.length === 1) {
        return words[0].substring(0, 2).toUpperCase();
      }
      return '';
    }).filter(Boolean);
    return initialsList.join('/');
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  };

  // Process Local Properties
  for (const p of localProps) {
    const blockName = parseBlockName(p.address_line1, p.block_name);
    const aptNumber = parseApartmentNumber(p.address_line1, p.apartment_number, null);
    const initials = parseInitials(p.landlord_name, p.landlord_initials);
    const rentVal = p.tenancy_rent_pcm || p.property_rent_pcm || 0;

    // Format NRL as "{Initials}:{NRL}" per Excel spec (e.g. "RB:NL945005")
    const rawNrl = p.landlord_nrl_number || '';
    const nrlFormatted = rawNrl && initials
      ? initials.split('/').map(ini => `${ini}:${rawNrl}`).join(' / ')
      : rawNrl;

    allProperties.push({
      source: 'local',
      property_id: p.property_id,
      landlord_id: p.landlord_id || null,
      display_name: `[Local] ${p.address_line1}${p.city ? ', ' + p.city : ''}`,
      property_address: [p.address_line1, p.address_line2, p.city, p.postcode].filter(Boolean).join(', '),
      block_name: blockName,
      apartment_number: aptNumber,
      landlord_name: p.landlord_name || '',
      landlord_address: p.landlord_address || '',
      landlord_initials: initials,
      nrl_number: nrlFormatted,
      landlord_reference: `RL_LR_${blockName}_${aptNumber}`,
      property_reference: `${blockName}-${aptNumber}`,
      tenant_name: p.tenant_name || '',
      tenancy_type: 'Assured Periodic Tenancy (APT)',
      tenancy_start_date: formatDate(p.tenancy_start_date),
      rent_received: parseFloat(rentVal).toFixed(2),
    });
  }

  // Process EM Properties
  const emEmails = [...new Set(emProps.map(p => p.landlord_email).filter(Boolean))];
  const localProfileMap = {};

  if (emEmails.length > 0) {
    const profiles = await db('users')
      .leftJoin('landlord_profiles', 'users.id', 'landlord_profiles.user_id')
      .whereIn('users.email', emEmails)
      .where('users.role', 'LANDLORD')
      .select('users.id as user_id', 'users.email', 'landlord_profiles.initials', 'landlord_profiles.nrl_hmrc_ref');

    for (const prof of profiles) {
      if (prof.email) {
        localProfileMap[prof.email.toLowerCase()] = prof;
      }
    }
  }

  for (const p of emProps) {
    const localProfile = p.landlord_email ? localProfileMap[p.landlord_email.toLowerCase()] : null;

    const propName = p.property_name || p.property_address || '';
    const blockName = parseBlockName(propName, null);
    const aptNumber = parseApartmentNumber(propName, null, p.unit_code);
    const initials = parseInitials(p.landlord_name, localProfile?.initials);
    const rentVal = p.tenancy_rent_pcm || p.service_charge_pcm || 0;

    const addr = p.property_address || propName;
    const fullPropAddr = [addr, p.property_city, p.property_postcode].filter(Boolean).join(', ');

    // Format NRL as "{Initials}:{NRL}" per Excel spec
    const rawNrl = localProfile?.nrl_hmrc_ref || '';
    const nrlFormatted = rawNrl && initials
      ? initials.split('/').map(ini => `${ini}:${rawNrl}`).join(' / ')
      : rawNrl;

    allProperties.push({
      source: 'em',
      property_id: p.property_id,
      // EM landlords attribute to a local account only via an exact email match
      landlord_id: localProfile?.user_id || null,
      display_name: `[EM] ${propName}`,
      property_address: fullPropAddr,
      block_name: blockName,
      apartment_number: aptNumber,
      landlord_name: p.landlord_name || '',
      landlord_address: p.landlord_address || p.landlord_company_address || '',
      landlord_initials: initials,
      nrl_number: nrlFormatted,
      landlord_reference: `RL_LR_${blockName}_${aptNumber}`,
      property_reference: `${blockName}-${aptNumber}`,
      tenant_name: p.tenant_name || '',
      tenancy_type: 'Assured Periodic Tenancy (APT)',
      tenancy_start_date: formatDate(p.tenancy_start_date),
      rent_received: parseFloat(rentVal).toFixed(2),
    });
  }

  // 4. Calculate next sequence number for statements and invoices
  const statements = await db('landlord_statements').select('statement_number');
  const invoices = await db('invoices').select('invoice_number');

  const getNextSeq = (prefix, existingList, field) => {
    let nextVal = 1;
    const matches = existingList.filter(item => item[field] && item[field].startsWith(prefix));
    if (matches.length > 0) {
      const nums = matches.map(item => {
        const parts = item[field].split('_');
        const lastPart = parts[parts.length - 1];
        const val = parseInt(lastPart, 10);
        return isNaN(val) ? 0 : val;
      });
      nextVal = Math.max(...nums) + 1;
    }
    return String(nextVal).padStart(4, '0');
  };

  const formattedProperties = allProperties.map(p => {
    const stmtPrefix = `${p.block_name}_${p.apartment_number}_`;
    const invPrefix = `INV_${p.block_name}_${p.apartment_number}_`;

    const stmtSeq = getNextSeq(stmtPrefix, statements, 'statement_number');
    const invSeq = getNextSeq(invPrefix, invoices, 'invoice_number');

    return {
      ...p,
      statement_number: `${p.block_name}_${p.apartment_number}_${stmtSeq}`,
      invoice_number: `INV_${p.block_name}_${p.apartment_number}_${invSeq}`,
    };
  });

  res.json({
    success: true,
    data: formattedProperties
  });
});
