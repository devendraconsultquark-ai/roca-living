import db, { emDb } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { generatePortraitPDFWithPuppeteer } from '../utils/puppeteerGenerator.js';
import { generateStandaloneStatementHTML, generateStandaloneInvoiceHTML, generateCombinedHTML } from '../templates/statementInvoiceTemplate.js';
import { deriveInitials } from '../utils/initials.js';
import { parseBlockName, parseApartmentNumber, getNextSeq, formatNrl } from '../utils/statementNumbering.js';
import { estateDisplayFor } from '../utils/estatesLink.js';
import { getNumericSetting } from '../utils/settings.js';
import { tenancyCredit } from '../utils/rentAllocation.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

// DATE columns arrive as local-midnight Date objects; toISOString() would
// shift them to the previous day in any UTC+ timezone (India, UK summer time).
const localDate = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

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
    period_start: s.period_start ? localDate(s.period_start) : null,
    period_end: s.period_end ? localDate(s.period_end) : null,
    generated_at: s.generated_at ? new Date(s.generated_at).toISOString() : null,
    paid_at: s.paid_at ? new Date(s.paid_at).toISOString() : null,
    created_at: s.created_at ? new Date(s.created_at).toISOString() : null
  };
};

export const generateStatements = catchAsync(async (req, res, next) => {
  // Tenant-based form (Statements → select tenant → autofill): line items.
  if (Array.isArray(req.body.income_lines)) {
    return generateTenancyStatement(req, res);
  }

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
    // 1. Insert document record — filed under a global 'Statements' folder so
    // generated statements show up in the admin document views (which only
    // render folder children). Find-or-create, same idiom as documentController.
    let statementsFolder = await trx('folders').where('name', 'Statements').first();
    if (!statementsFolder) {
      const [folderId] = await trx('folders').insert({ name: 'Statements', owner_type: 'global' });
      statementsFolder = { id: folderId, name: 'Statements' };
    }

    const tempDocRef = `TEMP-DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const [docId] = await trx('documents').insert({
      folder_id: statementsFolder.id,
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
      // Matches what was actually stored — 'generated' is not a valid status.
      status: 'draft'
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

  // Initials are stored on the profile at creation now; deriving from the name
  // remains as a fallback for legacy rows and external (rocaem) properties.
  const parseInitials = (name, initialsDb) => {
    if (initialsDb) return initialsDb;
    return deriveInitials(name) || 'RL';
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

// ─────────────────────────────────────────────────────────────────────────────
// Tenant-based statements: Statements page → select tenant → autofill → admin
// checks/edits → generate. A statement covers one tenancy for one rent period:
// from the rent due day to the day before the next due day (e.g. 25th → 24th).
// ─────────────────────────────────────────────────────────────────────────────

const TENANCY_TYPE = 'Assured Periodic (APT)';
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const parseYmd = (s) => {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseYmd(s).getTime());
const ukDate = (ymd) => {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
};
// dd/mm/yy, as on ROCA's own statements: "Rent received — Mr X (25/08/26 - 24/09/26)".
const shortDate = (ymd) => ukDate(ymd).replace(/\/\d{2}(\d{2})$/, '/$1');

// Period starting on `startYmd` for a tenancy whose rent falls due on day
// `anchorDay`: ends the day before the next due date (day clamped to month length).
const rentPeriod = (startYmd, anchorDay) => {
  const start = parseYmd(startYmd);
  const y = start.getFullYear();
  const m = start.getMonth() + 1;
  const nextDue = new Date(y, m, Math.min(anchorDay, new Date(y, m + 1, 0).getDate()));
  nextDue.setDate(nextDue.getDate() - 1);
  return { start: startYmd, end: localDate(nextDue) };
};

// Statement numbers (PH_33_0001) need a short block code and apartment number
// on the property; free text such as "Parsons House" would break them.
const UNIT_CODE = /^[A-Za-z0-9]{1,10}$/;
const validUnitCodes = (block, apt) => UNIT_CODE.test(String(block ?? '').trim()) && UNIT_CODE.test(String(apt ?? '').trim());

const tenantNamesFor = async (tenancyId) => {
  const rows = await db('tenants')
    .where('tenancy_id', tenancyId)
    .orderBy([{ column: 'is_lead_tenant', order: 'desc' }, { column: 'id' }])
    .select('name');
  return rows.map((r) => r.name).join(' & ');
};

const loadTenancyContext = (tenancyId) => db('tenancies')
  .join('properties', 'tenancies.property_id', 'properties.id')
  .leftJoin('users as landlords', 'properties.landlord_id', 'landlords.id')
  .leftJoin('landlord_profiles as profiles', 'landlords.id', 'profiles.user_id')
  .where('tenancies.id', tenancyId)
  .select(
    'tenancies.id as tenancy_id',
    'tenancies.start_date',
    'tenancies.rent_pcm',
    'tenancies.status as tenancy_status',
    'tenancies.statements_from',
    'tenancies.last_statement_seq',
    'properties.id as property_id',
    'properties.address_line1',
    'properties.address_line2',
    'properties.city',
    'properties.postcode',
    'properties.block_name',
    'properties.apartment_number',
    'properties.mgmt_fee_pct',
    'properties.rocaem_property_id',
    'landlords.id as landlord_id',
    'landlords.name as landlord_name',
    'landlords.address as landlord_address',
    'profiles.initials as landlord_initials',
    'profiles.nrl_hmrc_ref'
  )
  .first();

// GET /statements/tenancy-options — tenants for the "Select tenant" dropdown.
export const getTenancyStatementOptions = catchAsync(async (req, res) => {
  const rows = await db('tenancies')
    .join('properties', 'tenancies.property_id', 'properties.id')
    .leftJoin('users as landlords', 'properties.landlord_id', 'landlords.id')
    .leftJoin('tenants', function () {
      this.on('tenants.tenancy_id', '=', 'tenancies.id').andOn('tenants.is_lead_tenant', '=', db.raw('1'));
    })
    .whereIn('tenancies.status', ['active', 'notice'])
    .select(
      'tenancies.id as tenancy_id',
      'properties.address_line1',
      'properties.block_name',
      'properties.apartment_number',
      'landlords.name as landlord_name',
      'tenants.name as tenant_name'
    )
    .orderBy('properties.address_line1');

  res.json({
    success: true,
    data: rows.map((r) => {
      const block = parseBlockName(r.address_line1, r.block_name);
      const apt = parseApartmentNumber(r.address_line1, r.apartment_number, null);
      return {
        tenancy_id: r.tenancy_id,
        label: `${block}-${apt} · ${r.tenant_name || 'No tenant name'} · ${r.landlord_name || 'No landlord'}`
      };
    })
  });
});

// GET /statements/tenancy-autofill/:tenancyId[?period_start=YYYY-MM-DD]
// Everything the statement form needs for the next period (or the given one).
export const getTenancyAutofill = catchAsync(async (req, res) => {
  const t = await loadTenancyContext(req.params.tenancyId);
  if (!t) throw new ApiError(404, 'Tenancy not found');

  const tenancyStart = localDate(t.start_date);
  const anchorDay = parseYmd(tenancyStart).getDate();

  const last = await db('landlord_statements')
    .where('tenancy_id', t.tenancy_id)
    .orderBy('period_end', 'desc')
    .first();

  let periodStart;
  if (req.query.period_start !== undefined) {
    if (!isYmd(req.query.period_start)) throw new ApiError(400, 'period_start must be YYYY-MM-DD');
    periodStart = req.query.period_start;
  } else if (last) {
    const next = parseYmd(localDate(last.period_end));
    next.setDate(next.getDate() + 1);
    periodStart = localDate(next);
  } else {
    // Tenancies already statemented by hand start at their first period in this system.
    periodStart = t.statements_from ? localDate(t.statements_from) : tenancyStart;
  }
  const period = rentPeriod(periodStart, anchorDay);

  const tenantName = await tenantNamesFor(t.tenancy_id);
  // Landlord and apartment details come live from ROCA Estates when it has
  // them; the local lettings record is only the fallback.
  const estate = await estateDisplayFor(t.rocaem_property_id);
  const block = parseBlockName(t.address_line1, t.block_name);
  const apt = parseApartmentNumber(t.address_line1, t.apartment_number, null);
  const initials = t.landlord_initials || deriveInitials(t.landlord_name) || 'RL';

  // Numbering per Statement Logic: PH_33_0001, invoice = INV_ + statement number.
  const prefix = `${block}_${apt}_`;
  const used = await db('landlord_statements').where('statement_number', 'like', `${prefix}%`).select('statement_number');
  // Continue after the last number issued by hand (e.g. PH_33_0003 → 0004).
  const seq = Math.max(parseInt(getNextSeq(prefix, used, 'statement_number'), 10), (t.last_statement_seq || 0) + 1);
  const statementNumber = `${prefix}${String(seq).padStart(4, '0')}`;

  // Rent for this statement = tenant money applied (oldest month first) to
  // rent months due up to the end of this period and not yet on a statement:
  // this period's month plus any earlier arrears paid since. Money applied to
  // later months is credit and reaches the landlord on those months' statements.
  const allocations = await db('rent_payment_allocations as a')
    .join('rent_schedules as s', 'a.schedule_id', 's.id')
    .where('s.tenancy_id', t.tenancy_id)
    .whereNull('a.statement_id')
    .where('s.due_date', '<=', period.end)
    .select('a.amount', 's.due_date');
  const rentReceived = round2(allocations.reduce((sum, a) => sum + parseFloat(a.amount), 0));
  const arrearsReceived = round2(allocations
    .filter((a) => localDate(a.due_date) < period.start)
    .reduce((sum, a) => sum + parseFloat(a.amount), 0));

  const periodMonths = await db('rent_schedules')
    .where('tenancy_id', t.tenancy_id)
    .whereBetween('due_date', [period.start, period.end])
    .select('amount', 'paid_amount');
  const rentDue = round2(periodMonths.reduce((sum, m) => sum + parseFloat(m.amount), 0) || parseFloat(t.rent_pcm) || 0);
  const stillOwed = round2(periodMonths.reduce((sum, m) => sum + parseFloat(m.amount) - parseFloat(m.paid_amount || 0), 0));
  const rentRecorded = allocations.length > 0;
  const rent = rentRecorded ? rentReceived : rentDue;
  const tenantCredit = await tenancyCredit(db, t.tenancy_id);

  const feePct = Number.isFinite(parseFloat(t.mgmt_fee_pct))
    ? parseFloat(t.mgmt_fee_pct)
    : await getNumericSetting('agencyFee', 8);

  const repairs = await db('maintenance_tickets')
    .where('property_id', t.property_id)
    .where('status', 'complete')
    .whereBetween('completed_at', [`${period.start} 00:00:00`, `${period.end} 23:59:59`])
    .whereRaw('COALESCE(invoice_amount, quote_amount) > 0')
    .select('id', 'title', db.raw('COALESCE(invoice_amount, quote_amount) as cost'));

  // Property expenses reconciled from Xero (money out) dated in the period.
  const xeroExpenses = await db('xero_bank_transactions')
    .where({ status: 'reconciled', reconciled_as: 'property_expense', property_id: t.property_id })
    .whereBetween('date', [period.start, period.end])
    .select('date', 'amount', 'reference', 'contact_name', 'note');

  const existing = await db('landlord_statements')
    .where({ tenancy_id: t.tenancy_id, period_start: period.start })
    .first();

  // Balance carried from this tenancy's previous statement (non-zero only when
  // costs exceeded income last time).
  const previousBalance = last && last.closing_balance !== null
    ? round2(parseFloat(last.closing_balance) - parseFloat(last.net_paid || 0))
    : 0;

  // Wording as on ROCA's own statements (v9 tool).
  const periodLabel = `${shortDate(period.start)} - ${shortDate(period.end)}`;

  res.json({
    success: true,
    data: {
      tenancy_id: t.tenancy_id,
      landlord_id: t.landlord_id,
      landlord_name: estate?.landlord_name || t.landlord_name || '',
      landlord_address: estate?.landlord_address || t.landlord_address || '',
      nrl_number: formatNrl(t.nrl_hmrc_ref, initials),
      landlord_reference: `RL_LR_${block}_${apt}`,
      property_reference: `${block}-${apt}`,
      property_address: estate?.property_address || [t.address_line1, t.address_line2, t.city, t.postcode].filter(Boolean).join(', '),
      tenant_name: tenantName,
      tenancy_type: TENANCY_TYPE,
      tenancy_start_date: tenancyStart,
      period_start: period.start,
      period_end: period.end,
      statement_number: statementNumber,
      invoice_number: `INV_${statementNumber}`,
      previous_balance: previousBalance,
      mgmt_fee_pct: feePct,
      rent_due: rentDue,
      rent_recorded: rentRecorded,
      rent_still_owed: rentRecorded ? stillOwed : null,
      tenant_credit: tenantCredit,
      existing_statement_number: existing ? existing.statement_number : null,
      missing_unit_codes: !validUnitCodes(t.block_name, t.apartment_number),
      income_lines: [{
        description: `Rent received — ${tenantName || 'Tenant'} (${periodLabel})`
          + (arrearsReceived > 0 ? ` (incl. £${arrearsReceived.toFixed(2)} arrears for earlier months)` : '')
          + (rentRecorded && stillOwed > 0 ? ` (part payment – £${stillOwed.toFixed(2)} still owed)` : ''),
        amount: rent
      }],
      fee_lines: [{
        description: `Management Fee ${feePct}% (${periodLabel})`,
        amount: round2(rent * feePct / 100),
        discount: 0
      }],
      expenditure_lines: [
        ...repairs.map((r) => ({
          description: `Repair – ${r.title} (ticket #${r.id})`,
          amount: round2(parseFloat(r.cost))
        })),
        ...xeroExpenses.map((x) => ({
          description: `${x.note || x.reference || x.contact_name || 'Expense'} (${ukDate(localDate(x.date))})`,
          amount: round2(parseFloat(x.amount))
        }))
      ]
    }
  });
});

const MAX_LINES = 50;
const MAX_AMOUNT = 10000000;

const cleanLines = (lines, label, { fee = false } = {}) => {
  if (!Array.isArray(lines)) throw new ApiError(400, `${label} must be a list`);
  if (lines.length > MAX_LINES) throw new ApiError(400, `Too many ${label}s`);
  return lines.map((l, i) => {
    const description = typeof l?.description === 'string' ? l.description.trim() : '';
    if (!description) throw new ApiError(400, `${label} ${i + 1}: description is required`);
    if (description.length > 500) throw new ApiError(400, `${label} ${i + 1}: description is too long`);
    const amount = parseFloat(l.amount);
    if (!Number.isFinite(amount) || Math.abs(amount) > MAX_AMOUNT) throw new ApiError(400, `${label} ${i + 1}: invalid amount`);
    const line = { description, amount: round2(amount) };
    if (fee) {
      const discount = l.discount === undefined || l.discount === '' ? 0 : parseFloat(l.discount);
      if (amount < 0 || !Number.isFinite(discount) || discount < 0 || discount > amount) {
        throw new ApiError(400, `${label} ${i + 1}: fee must be positive with a discount between 0 and the fee`);
      }
      line.discount = round2(discount);
    }
    return line;
  });
};

const saveStatementPdf = async (trx, { folderName, landlordId, docType, filename, originalName, relativePath, size, userId }) => {
  let folder = await trx('folders').where('name', folderName).first();
  if (!folder) {
    const [folderId] = await trx('folders').insert({ name: folderName, owner_type: 'global' });
    folder = { id: folderId };
  }
  const [docId] = await trx('documents').insert({
    folder_id: folder.id,
    owner_type: 'landlord',
    owner_id: landlordId,
    doc_type: docType,
    filename,
    original_name: originalName,
    mime_type: 'application/pdf',
    file_path: relativePath,
    file_size_bytes: size,
    uploaded_by: userId,
    doc_reference: `TEMP-DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  });
  await trx('documents').where('id', docId).update({ doc_reference: `REM-DOC-${String(docId).padStart(5, '0')}` });
  return docId;
};

// POST /statements/generate with income_lines / fee_lines / expenditure_lines.
const generateTenancyStatement = async (req, res) => {
  const b = req.body;

  const t = await loadTenancyContext(b.tenancy_id);
  if (!t) throw new ApiError(400, 'Select a tenant');
  if (!t.landlord_id) throw new ApiError(400, 'This property has no landlord linked — add the landlord first');
  if (!validUnitCodes(t.block_name, t.apartment_number)) {
    throw new ApiError(400, 'Set the Block code (e.g. PH) and Apartment number (e.g. 33) on the property first');
  }
  const unitPrefix = `${String(t.block_name).trim()}_${String(t.apartment_number).trim()}_`;
  if (typeof b.statement_number !== 'string' || !b.statement_number.startsWith(unitPrefix) || !/^\d{4}$/.test(b.statement_number.slice(unitPrefix.length))) {
    throw new ApiError(400, `Statement number must look like ${unitPrefix}0001`);
  }
  if (b.invoice_number && b.invoice_number !== `INV_${b.statement_number}`) {
    throw new ApiError(400, `Invoice number must be INV_${b.statement_number}`);
  }
  if (!isYmd(b.period_start) || !isYmd(b.period_end) || b.period_start > b.period_end) {
    throw new ApiError(400, 'A valid statement period is required');
  }
  if (!b.landlord_name) throw new ApiError(400, 'Landlord name is required');

  const incomeLines = cleanLines(b.income_lines, 'Income line');
  const feeLines = cleanLines(b.fee_lines || [], 'Fee line', { fee: true });
  const expenditureLines = cleanLines(b.expenditure_lines || [], 'Expenditure line');
  const invoiceNumber = feeLines.length ? (b.invoice_number || `INV_${b.statement_number}`) : null;

  if (await db('landlord_statements').where({ statement_number: b.statement_number }).first()) {
    throw new ApiError(409, `Statement ${b.statement_number} already exists`);
  }
  if (invoiceNumber && await db('invoices').where({ invoice_number: invoiceNumber }).first()) {
    throw new ApiError(409, `Invoice ${invoiceNumber} already exists`);
  }
  const duplicate = await db('landlord_statements').where({ tenancy_id: t.tenancy_id, period_start: b.period_start }).first();
  if (duplicate) {
    throw new ApiError(409, `Statement ${duplicate.statement_number} already covers this tenant for this period`);
  }

  // Totals are always computed here, never taken from the client.
  const sum = (list, fn) => round2(list.reduce((s, l) => s + fn(l), 0));
  const totalIncome = sum(incomeLines, (l) => l.amount);
  const feesGross = sum(feeLines, (l) => l.amount);
  const feesDiscount = sum(feeLines, (l) => l.discount);
  const feesNet = round2(feesGross - feesDiscount);
  const totalExpenditure = round2(feesNet + sum(expenditureLines, (l) => l.amount));
  const previousBalance = round2(parseFloat(b.previous_balance) || 0);
  const closingBalance = round2(previousBalance + totalIncome - totalExpenditure);
  const payout = Math.max(0, closingBalance);

  const common = {
    landlord_name: b.landlord_name,
    landlord_address: b.landlord_address || '',
    property_address: b.property_address || '',
    tenant_name: b.tenant_name || '',
    tenancy_start_date: b.tenancy_start_date || null,
    tenancy_type: b.tenancy_type || TENANCY_TYPE,
    period_start: b.period_start,
    period_end: b.period_end,
    issue_date: localDate(new Date())
  };
  const invoiceNotes = typeof b.invoice_notes === 'string' ? b.invoice_notes.trim().slice(0, 1000) : '';
  const statementData = {
    ...common,
    statement_number: b.statement_number,
    nrl_number: b.nrl_number || '',
    landlord_reference: b.landlord_reference || '',
    property_reference: b.property_reference || '',
    tenancy_type: b.tenancy_type || TENANCY_TYPE,
    previous_balance: previousBalance,
    income_lines: incomeLines,
    expenditure_lines: [
      ...(invoiceNumber ? [{ description: `Invoice No. ${invoiceNumber} (see accompanying invoice)`, amount: feesNet }] : []),
      ...expenditureLines
    ],
    total_income: totalIncome,
    total_expenditure: totalExpenditure,
    payment_amount: payout
  };
  const invoiceData = invoiceNumber ? {
    ...common,
    invoice_number: invoiceNumber,
    service_level: 'Fully Managed',
    notes: invoiceNotes,
    line_items: feeLines.map((l) => ({ description: l.description, cost: l.amount, vat_percent: 0, discount: l.discount })),
    total_gross: feesGross,
    total_vat: 0,
    total_discount: feesDiscount,
    total_net: feesNet
  } : null;

  // Render first (Puppeteer is slow); files are written only after the DB commit.
  const statementPdf = await generatePortraitPDFWithPuppeteer(
    invoiceData ? generateCombinedHTML(statementData, invoiceData) : generateStandaloneStatementHTML(statementData)
  );
  const invoicePdf = invoiceData ? await generatePortraitPDFWithPuppeteer(generateStandaloneInvoiceHTML(invoiceData)) : null;
  const stamp = Date.now();
  const statementFile = `RL_STMT_${b.statement_number}_${stamp}.pdf`;
  const statementPath = `uploads/statements/${statementFile}`;
  const invoiceFile = invoiceNumber ? `${invoiceNumber}_${stamp}.pdf` : null;
  const invoicePath = invoiceFile ? `uploads/invoices/${invoiceFile}` : null;

  let statementId;
  let invoiceId = null;
  await db.transaction(async (trx) => {
    if (invoiceNumber) {
      const invoiceDocId = await saveStatementPdf(trx, {
        folderName: 'Invoices', landlordId: t.landlord_id, docType: 'landlord_invoice',
        filename: invoiceFile, originalName: `Invoice ${invoiceNumber}`, relativePath: invoicePath,
        size: invoicePdf.length, userId: req.user.id
      });
      [invoiceId] = await trx('invoices').insert({
        landlord_id: t.landlord_id,
        landlord_name: b.landlord_name,
        landlord_address: b.landlord_address || null,
        source: 'local',
        source_property_id: String(t.property_id),
        property_id: t.property_id,
        invoice_number: invoiceNumber,
        period_start: b.period_start,
        period_end: b.period_end,
        service_level: 'Fully Managed',
        tenant_name: b.tenant_name || null,
        tenancy_start_date: b.tenancy_start_date || null,
        total_gross: feesGross.toFixed(2),
        total_vat: '0.00',
        total_discount: feesDiscount.toFixed(2),
        total_net: feesNet.toFixed(2),
        status: 'draft',
        document_id: invoiceDocId,
        created_at: trx.fn.now()
      });
      await trx('invoice_items').insert(feeLines.map((l) => ({
        invoice_id: invoiceId,
        description: l.description,
        cost: l.amount.toFixed(2),
        vat_percent: '0.00',
        discount: l.discount.toFixed(2),
        net: Math.max(0, round2(l.amount - l.discount)).toFixed(2)
      })));
    }

    const statementDocId = await saveStatementPdf(trx, {
      folderName: 'Statements', landlordId: t.landlord_id, docType: 'landlord_statement',
      filename: statementFile, originalName: `Landlord Statement (${b.statement_number})`, relativePath: statementPath,
      size: statementPdf.length, userId: req.user.id
    });

    [statementId] = await trx('landlord_statements').insert({
      landlord_id: t.landlord_id,
      landlord_name: b.landlord_name,
      landlord_address: b.landlord_address || null,
      source: 'local',
      source_property_id: String(t.property_id),
      tenancy_id: t.tenancy_id,
      invoice_id: invoiceId,
      period_start: b.period_start,
      period_end: b.period_end,
      gross_rent: totalIncome.toFixed(2),
      mgmt_fee: feesNet.toFixed(2),
      mgmt_fee_vat: 0,
      deductions: totalExpenditure.toFixed(2),
      net_paid: payout.toFixed(2),
      total_income: totalIncome.toFixed(2),
      total_expenditure: totalExpenditure.toFixed(2),
      previous_balance: previousBalance.toFixed(2),
      closing_balance: closingBalance.toFixed(2),
      exp_invoice_no: invoiceNumber,
      exp_amount: feesNet.toFixed(2),
      document_id: statementDocId,
      status: 'draft',
      generated_at: trx.fn.now(),
      generated_by: req.user.id,
      statement_number: b.statement_number,
      statement_reference: `TEMP-STM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tenant_name: b.tenant_name || null,
      tenancy_type: b.tenancy_type || TENANCY_TYPE,
      tenancy_start_date: b.tenancy_start_date || null
    });
    await trx('landlord_statements').where('id', statementId)
      .update({ statement_reference: `REM-STM-${String(statementId).padStart(5, '0')}` });

    // Freeze the rent money this statement pays out: allocations to rent months
    // due by the period end that were not on an earlier statement.
    const claimable = trx('rent_schedules').select('id')
      .where('tenancy_id', t.tenancy_id)
      .where('due_date', '<=', b.period_end);
    await trx('rent_payment_allocations')
      .whereNull('statement_id')
      .whereIn('schedule_id', claimable)
      .update({ statement_id: statementId });

    // Ledger: ROCA's fee and the landlord payout. Rent is already on the ledger
    // from the recorded payment, repairs from the maintenance ticket.
    const ledger = [
      { type: 'mgmt_fee', amount: feesNet, description: `Management fee — Statement ${b.statement_number}` },
      { type: 'landlord_payout', amount: payout, description: `Net payout for Statement ${b.statement_number}` }
    ].filter((r) => r.amount > 0);
    if (ledger.length) {
      await trx('transactions').insert(ledger.map((r) => ({
        type: r.type,
        amount: r.amount.toFixed(2),
        description: r.description,
        landlord_id: t.landlord_id,
        property_id: t.property_id,
        statement_id: statementId,
        vat_amount: '0.00',
        transaction_date: b.period_end,
        reconciled: 1,
        created_by: req.user.id
      })));
    }

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'STATEMENT_GENERATED',
      entity_type: 'landlord_statement',
      entity_id: statementId,
      meta: JSON.stringify({ tenancy_id: t.tenancy_id, statement_number: b.statement_number, invoice_number: invoiceNumber, period_start: b.period_start, period_end: b.period_end, payout: payout.toFixed(2) }),
      ip_address: req.ip || null
    });

    // The NRL is a lettings detail ROCA Estates doesn't hold: remember what the
    // admin used on this statement for the landlord's next one.
    const nrl = typeof b.nrl_number === 'string' ? b.nrl_number.trim().slice(0, 100) : '';
    if (nrl && nrl !== formatNrl(t.nrl_hmrc_ref, t.landlord_initials)) {
      await trx('landlord_profiles').where({ user_id: t.landlord_id }).update({ nrl_hmrc_ref: nrl });
    }
  });

  for (const [rel, buf] of [[statementPath, statementPdf], [invoicePath, invoicePdf]]) {
    if (!rel) continue;
    const abs = path.join(process.cwd(), rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buf);
  }

  return res.status(201).json({
    success: true,
    data: [{
      statement_id: statementId,
      invoice_id: invoiceId,
      statement_number: b.statement_number,
      invoice_number: invoiceNumber,
      landlord_id: t.landlord_id,
      period_start: b.period_start,
      period_end: b.period_end,
      gross_rent: totalIncome.toFixed(2),
      net_paid: payout.toFixed(2),
      status: 'draft'
    }]
  });
};
