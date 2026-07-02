import db, { emDb } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { generatePortraitPDFWithPuppeteer } from '../utils/puppeteerGenerator.js';
import { generateStandaloneStatementHTML } from '../templates/statementInvoiceTemplate.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Format Date to DD/MM/YYYY (en-GB format)
const formatDateGB = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// PDF generation helper returning a Promise
const generateStatementPDF = (statement, landlord, landlordProfile, payments, deductionsList, outputPath) => {
  return new Promise((resolve, reject) => {
    try {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      // Header: Logo Placeholder & ROCA Living Brand
      doc.rect(50, 45, 60, 40).fill('#1f2937');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12).text('ROCA', 55, 58, { width: 50, align: 'center' });

      doc.fillColor('#1f2937').fontSize(20).font('Helvetica-Bold').text('ROCA Living', 125, 45);
      doc.fontSize(9).font('Helvetica').fillColor('#4b5563').text('Lettings & Property Management', 125, 68);
      doc.text('Email: management@rocaliving.co.uk | Tel: 020 7123 4567', 125, 80);

      // Title & Statement Metadata
      doc.fillColor('#1f2937').fontSize(14).font('Helvetica-Bold').text('LANDLORD STATEMENT', 350, 45, { align: 'right' });
      doc.fontSize(9).font('Helvetica').fillColor('#4b5563')
        .text(`Statement ID: STMT-${statement.id}`, 350, 62, { align: 'right' })
        .text(`Period: ${formatDateGB(statement.period_start)} to ${formatDateGB(statement.period_end)}`, 350, 74, { align: 'right' })
        .text(`Date Issued: ${formatDateGB(new Date())}`, 350, 86, { align: 'right' });

      // Horizontal Divider
      doc.moveTo(50, 110).lineTo(545, 110).strokeColor('#e5e7eb').stroke();

      // Landlord Info & ROCA Info columns
      doc.fontSize(10).fillColor('#4b5563').text('Landlord Details:', 50, 130);
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1f2937').text(landlord.name || '', 50, 145);
      doc.fontSize(9).font('Helvetica').fillColor('#4b5563');

      const addressLines = [
        landlord.address || '',
        landlord.email || '',
        landlord.phone || ''
      ].filter(Boolean);

      let addressY = 160;
      addressLines.forEach(line => {
        doc.text(line, 50, addressY);
        addressY += 14;
      });

      // ----------------------------------------------------
      // Table 1: Rent Received
      // ----------------------------------------------------
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1f2937').text('Rent Receipts Collected', 50, 240);

      let y = 258;
      // Header row
      doc.rect(50, y, 495, 20).fill('#1f2937');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
      doc.text('Property Address', 60, y + 6);
      doc.text('Payment Date', 340, y + 6);
      doc.text('Amount Received', 460, y + 6, { align: 'right', width: 75 });

      y += 20;
      doc.font('Helvetica').fillColor('#374151');

      payments.forEach((p, idx) => {
        // Alternating background colors
        if (idx % 2 === 1) {
          doc.rect(50, y, 495, 20).fill('#f9fafb');
        }
        doc.fillColor('#374151');
        doc.text(`${p.address_line1}, ${p.city}`, 60, y + 6);
        doc.text(formatDateGB(p.received_at), 340, y + 6);
        doc.text(`£${parseFloat(p.amount).toFixed(2)}`, 460, y + 6, { align: 'right', width: 75 });
        y += 20;
      });

      // Total Gross Rent Row
      doc.rect(50, y, 495, 20).fill('#f3f4f6');
      doc.fillColor('#1f2937').font('Helvetica-Bold');
      doc.text('Total Gross Rent Received', 60, y + 6);
      doc.text(`£${parseFloat(statement.gross_rent).toFixed(2)}`, 460, y + 6, { align: 'right', width: 75 });

      // ----------------------------------------------------
      // Table 2: Deductions & Fees
      // ----------------------------------------------------
      y += 35;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1f2937').text('Fees & Deductions Breakdown', 50, y);

      y += 18;
      // Header row
      doc.rect(50, y, 495, 20).fill('#4b5563');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
      doc.text('Fee / Deduction Description', 60, y + 6);
      doc.text('Charge Amount', 460, y + 6, { align: 'right', width: 75 });

      y += 20;
      doc.font('Helvetica').fillColor('#374151');

      const feesAndDeductions = [
        { label: `Management Fee (${parseFloat(statement.mgmt_fee_pct || 0).toFixed(2)}%)`, amt: statement.mgmt_fee },
        { label: 'VAT on Management Fee (20%)', amt: statement.mgmt_fee_vat },
        { label: 'ROCA Letting Fee', amt: statement.roca_letting_fee },
        { label: 'Agent Letting Fee', amt: statement.agent_letting_fee },
        { label: 'NRL Tax Withholding', amt: statement.nrl_withheld }
      ];

      deductionsList.forEach(d => {
        feesAndDeductions.push({
          label: d.description || `Maintenance Deduction (${d.type})`,
          amt: d.amount
        });
      });

      let itemsPrinted = 0;
      feesAndDeductions.forEach(item => {
        const val = parseFloat(item.amt || 0);
        if (val > 0) {
          if (itemsPrinted % 2 === 1) {
            doc.rect(50, y, 495, 20).fill('#f9fafb');
          }
          doc.fillColor('#374151');
          doc.text(item.label, 60, y + 6);
          doc.text(`-£${val.toFixed(2)}`, 460, y + 6, { align: 'right', width: 75 });
          y += 20;
          itemsPrinted++;
        }
      });

      if (itemsPrinted === 0) {
        doc.text('No fees or deductions applied to this period.', 60, y + 6);
        y += 20;
      }

      // Total Deductions Row
      const totalDeductions = parseFloat(statement.mgmt_fee) +
        parseFloat(statement.mgmt_fee_vat) +
        parseFloat(statement.roca_letting_fee) +
        parseFloat(statement.agent_letting_fee) +
        parseFloat(statement.nrl_withheld) +
        parseFloat(statement.deductions);

      doc.rect(50, y, 495, 20).fill('#f3f4f6');
      doc.fillColor('#1f2937').font('Helvetica-Bold');
      doc.text('Total Fees & Deductions', 60, y + 6);
      doc.text(`-£${totalDeductions.toFixed(2)}`, 460, y + 6, { align: 'right', width: 75 });

      // ----------------------------------------------------
      // Net Payout Box
      // ----------------------------------------------------
      y += 35;
      doc.rect(50, y, 495, 42).fill('#f97316'); // text-brand-accent color tone
      doc.fillColor('#ffffff').fontSize(13).font('Helvetica-Bold');
      doc.text('NET PAYOUT TOTAL (Paid to Bank)', 70, y + 15);
      doc.fontSize(15).text(`£${parseFloat(statement.net_paid).toFixed(2)}`, 400, y + 14, { align: 'right', width: 130 });

      // Footer
      doc.fillColor('#9ca3af')
        .fontSize(7.5)
        .font('Helvetica')
        .text('ROCA Property Group Ltd, Company No. 04914778. Registered Office: 128 City Road, London, EC1V 2NX', 50, 750, { align: 'center', width: 495 });

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
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
    source_property_id = null,  // original property id in the source DB\
    landlord_id,   
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

  if (statement_number) {
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
    throw new ApiError(400, `Statement ${statement_number} already exists`);
  }

  // ── No cross-DB resolution. All data comes directly from the form. ──
  // For local-source properties, try to find the landlord_id in local DB (best-effort, not required).
  let landlordId = null;
  if (source === 'local' && landlord_name) {
    const localUser = await db('users')
      .where({ role: 'LANDLORD' })
      .where('name', 'like', `%${landlord_name}%`)
      .first();
    if (localUser) landlordId = localUser.id;
  }
  // For 'em' source — landlordId stays null. Data is stored as text.

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
  fs.writeFileSync(absolutePath, pdfBuffer);

  let statementId;
  await db.transaction(async (trx) => {
    // 1. Insert document record
    const tempDocRef = `TEMP-DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const [docId] = await trx('documents').insert({
      folder_id: null,
      owner_type: 'landlord',
      owner_id: landlordId || req.user.id,  // null for EM-sourced
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
      source_property_id: source_property_id ? String(source_property_id) : null,
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

    const txRows = ledgerRows.map(row => ({
      type: row.type,
      landlord_id: landlordId || null,
      statement_id: statementId,
      amount: parseFloat(row.amount || 0).toFixed(2),
      vat_amount: 0.00,
      description: row.desc,
      transaction_date: trx.fn.now(),
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

  if (!period_start || !period_end) {
    throw new ApiError(400, 'Period start and end dates are required');
  }

  // 1. Identify landlord ids
  let landlordIds = [];
  if (landlord_id) {
    landlordIds = [landlord_id];
  } else {
    const activeLandlords = await db('rent_payments')
      .join('tenancies', 'rent_payments.tenancy_id', 'tenancies.id')
      .join('properties', 'tenancies.property_id', 'properties.id')
      .select('properties.landlord_id')
      .where('rent_payments.reconciled', 1)
      .whereBetween('rent_payments.received_at', [period_start, period_end])
      .distinct();
    landlordIds = activeLandlords.map(item => item.landlord_id);
  }

  const summaries = [];

  for (const landlordId of landlordIds) {
    // Check if statement already exists for this landlord and period to ensure idempotency
    const existing = await db('landlord_statements')
      .where({ landlord_id: landlordId, period_start, period_end })
      .first();

    if (existing) {
      summaries.push({
        landlord_id: landlordId,
        status: 'skipped',
        message: 'Statement already exists for this period'
      });
      continue;
    }

    const landlord = await db('users').where({ id: landlordId, role: 'LANDLORD' }).first();
    if (!landlord) {
      if (landlord_id) {
        throw new ApiError(404, `Landlord with ID ${landlordId} not found`);
      }
      continue;
    }

    // Fetch payments
    const payments = await db('rent_payments')
      .join('tenancies', 'rent_payments.tenancy_id', 'tenancies.id')
      .join('properties', 'tenancies.property_id', 'properties.id')
      .select(
        'rent_payments.*',
        'properties.address_line1',
        'properties.city',
        'properties.postcode',
        'properties.mgmt_fee_pct',
        'tenancies.start_date as tenancy_start',
        'tenancies.end_date as tenancy_end'
      )
      .where('properties.landlord_id', landlordId)
      .where('rent_payments.reconciled', 1)
      .whereBetween('rent_payments.received_at', [period_start, period_end]);

    let gross_rent = 0.0;
    let totalWeightedFeePct = 0.0;
    let totalWeight = 0.0;

    payments.forEach(p => {
      const amt = parseFloat(p.amount);
      gross_rent += amt;
      const pct = p.mgmt_fee_pct !== null && p.mgmt_fee_pct !== undefined ? parseFloat(p.mgmt_fee_pct) : 12.00;
      totalWeightedFeePct += amt * pct;
      totalWeight += amt;
    });

    let mgmt_fee_pct = 12.00;
    if (totalWeight > 0) {
      mgmt_fee_pct = totalWeightedFeePct / totalWeight;
    } else {
      const landlordProperties = await db('properties').where('landlord_id', landlordId);
      if (landlordProperties.length > 0) {
        const sumPct = landlordProperties.reduce((acc, curr) => acc + (curr.mgmt_fee_pct !== null ? parseFloat(curr.mgmt_fee_pct) : 12.00), 0);
        mgmt_fee_pct = sumPct / landlordProperties.length;
      }
    }

    const mgmt_fee = (gross_rent * mgmt_fee_pct) / 100;
    const mgmt_fee_vat = mgmt_fee * 0.20;

    // Fetch unbilled contractor costs or deductions
    const deductionsList = await db('transactions')
      .where('landlord_id', landlordId)
      .whereIn('type', ['contractor_cost', 'deduction'])
      .whereNull('statement_id')
      .whereBetween('transaction_date', [period_start, period_end]);

    let deductions = 0.0;
    deductionsList.forEach(d => {
      deductions += parseFloat(d.amount);
    });

    // Fetch letting fees from tenancies starting in this period
    const tenanciesInPeriod = await db('tenancies')
      .join('properties', 'tenancies.property_id', 'properties.id')
      .select('tenancies.*')
      .where('properties.landlord_id', landlordId)
      .whereBetween('tenancies.start_date', [period_start, period_end]);

    let roca_letting_fee = 0.0;
    let agent_letting_fee = 0.0;
    tenanciesInPeriod.forEach(t => {
      if (t.roca_letting_fee) roca_letting_fee += parseFloat(t.roca_letting_fee);
      if (t.agent_letting_fee) agent_letting_fee += parseFloat(t.agent_letting_fee);
    });

    // Fetch landlord profile for overseas check
    const landlordProfile = await db('landlord_profiles').where('user_id', landlordId).first();
    let nrl_withheld = 0.0;
    const isOverseas = landlordProfile?.is_overseas === 1;
    const nrlApproved = landlordProfile?.nrl_hmrc_approved === 1;
    if (isOverseas && !nrlApproved) {
      const nrlPct = landlordProfile?.nrl_withhold_pct !== null && landlordProfile?.nrl_withhold_pct !== undefined
        ? parseFloat(landlordProfile.nrl_withhold_pct)
        : 20.00;
      const allowableExpenses = mgmt_fee + mgmt_fee_vat + roca_letting_fee + agent_letting_fee + deductions;
      const netIncomeForNrl = Math.max(0, gross_rent - allowableExpenses);
      nrl_withheld = (netIncomeForNrl * nrlPct) / 100;
    }

    // Formulas using precise rounding
    const grossRentStr = gross_rent.toFixed(2);
    const mgmtFeeStr = mgmt_fee.toFixed(2);
    const mgmtFeeVatStr = mgmt_fee_vat.toFixed(2);
    const deductionsStr = deductions.toFixed(2);
    const rocaLettingFeeStr = roca_letting_fee.toFixed(2);
    const agentLettingFeeStr = agent_letting_fee.toFixed(2);
    const nrlWithheldStr = nrl_withheld.toFixed(2);

    const netPaidVal = parseFloat(grossRentStr)
      - parseFloat(mgmtFeeStr)
      - parseFloat(mgmtFeeVatStr)
      - parseFloat(rocaLettingFeeStr)
      - parseFloat(agentLettingFeeStr)
      - parseFloat(deductionsStr)
      - parseFloat(nrlWithheldStr);
    const netPaidStr = netPaidVal.toFixed(2);

    // Save Statement and PDF in Transaction
    await db.transaction(async (trx) => {
      // 1. Insert into landlord_statements
      const tempStmtRef = `TEMP-STM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const [statementId] = await trx('landlord_statements').insert({
        landlord_id: landlordId,
        period_start,
        period_end,
        gross_rent: grossRentStr,
        mgmt_fee: mgmtFeeStr,
        mgmt_fee_vat: mgmtFeeVatStr,
        roca_letting_fee: rocaLettingFeeStr,
        agent_letting_fee: agentLettingFeeStr,
        deductions: deductionsStr,
        nrl_withheld: nrlWithheldStr,
        net_paid: netPaidStr,
        status: 'draft',
        generated_at: trx.fn.now(),
        generated_by: req.user.id,
        statement_reference: tempStmtRef
      });

      const statement_reference = `REM-STM-${String(statementId).padStart(5, '0')}`;
      await trx('landlord_statements')
        .where({ id: statementId })
        .update({ statement_reference });

      // 2. Generate PDF Document
      const filename = `RL_STMT_${landlordId}_${period_start}.pdf`;
      const relativePath = `uploads/statements/${filename}`;
      const absolutePath = path.join(process.cwd(), relativePath);

      const statementData = {
        id: statementId,
        period_start,
        period_end,
        gross_rent: grossRentStr,
        mgmt_fee: mgmtFeeStr,
        mgmt_fee_pct,
        mgmt_fee_vat: mgmtFeeVatStr,
        roca_letting_fee: rocaLettingFeeStr,
        agent_letting_fee: agentLettingFeeStr,
        deductions: deductionsStr,
        nrl_withheld: nrlWithheldStr,
        net_paid: netPaidStr
      };

      await generateStatementPDF(statementData, landlord, landlordProfile, payments, deductionsList, absolutePath);

      // 3. Insert Document Record
      const fileSize = fs.existsSync(absolutePath) ? fs.statSync(absolutePath).size : 0;
      const tempDocRef = `TEMP-DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const [docId] = await trx('documents').insert({
        folder_id: null,
        owner_type: 'landlord',
        owner_id: landlordId,
        doc_type: 'landlord_statement',
        filename,
        original_name: `Landlord Statement (${period_start} to ${period_end})`,
        mime_type: 'application/pdf',
        file_path: relativePath,
        file_size_bytes: fileSize,
        uploaded_by: req.user.id,
        doc_reference: tempDocRef
      });

      const doc_reference = `REM-DOC-${String(docId).padStart(5, '0')}`;
      await trx('documents')
        .where({ id: docId })
        .update({ doc_reference });

      // 4. Update landlord statement with document reference
      await trx('landlord_statements')
        .where('id', statementId)
        .update({ document_id: docId });

      // 5. Link deduction transactions to this statement
      if (deductionsList.length > 0) {
        const deductionIds = deductionsList.map(d => d.id);
        await trx('transactions')
          .whereIn('id', deductionIds)
          .update({ statement_id: statementId });
      }

      // 6. Insert new transaction ledger records
      const ledgerRows = [
        { type: 'mgmt_fee', amount: mgmtFeeStr, desc: `Management fee for Statement STMT-${statementId}` },
        { type: 'vat', amount: mgmtFeeVatStr, desc: `VAT on Management fee for Statement STMT-${statementId}` },
        { type: 'landlord_payout', amount: netPaidStr, desc: `Net payout generated for Statement STMT-${statementId}` }
      ];

      if (parseFloat(nrlWithheldStr) > 0) {
        ledgerRows.push({
          type: 'nrl_withholding',
          amount: nrlWithheldStr,
          desc: `NRL Tax Withholding for Statement STMT-${statementId}`
        });
      }

      const txRows = ledgerRows.map(row => ({
        type: row.type,
        landlord_id: landlordId,
        statement_id: statementId,
        amount: row.amount,
        vat_amount: row.type === 'vat' ? row.amount : 0.00,
        description: row.desc,
        transaction_date: trx.fn.now(),
        reconciled: 1,
        created_by: req.user.id
      }));

      await trx('transactions').insert(txRows);

      // 7. Write Audit Log
      await trx('audit_log').insert({
        actor_id: req.user.id,
        actor_role: req.user.role,
        action: 'STATEMENT_GENERATED',
        entity_type: 'landlord_statement',
        entity_id: statementId,
        meta: JSON.stringify({ landlord_id: landlordId, net_paid: netPaidStr, period_start, period_end }),
        ip_address: req.ip || null
      });

      summaries.push({
        statement_id: statementId,
        landlord_id: landlordId,
        landlord_name: landlord.name,
        period_start,
        period_end,
        gross_rent: grossRentStr,
        net_paid: netPaidStr,
        status: 'generated'
      });
    });
  }

  res.status(201).json({
    success: true,
    data: summaries
  });
});

export const getStatements = catchAsync(async (req, res, next) => {
  const statements = await db('landlord_statements')
    .join('users', 'landlord_statements.landlord_id', 'users.id')
    .select('landlord_statements.*', 'users.name as landlord_name')
    .orderBy('landlord_statements.created_at', 'desc');

  res.json({
    success: true,
    data: statements.map(formatStatement)
  });
});

export const getStatementById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const statement = await db('landlord_statements')
    .join('users', 'landlord_statements.landlord_id', 'users.id')
    .select('landlord_statements.*', 'users.name as landlord_name', 'users.email as landlord_email')
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
    throw new ApiError(404, `PDF file not found on disk: ${absolutePath}`);
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
      'profiles.nrl_number as landlord_nrl_number',
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
    console.error('[AutofillMetadata] Failed to fetch EM properties:', err.message);
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
      .select('users.email', 'landlord_profiles.initials', 'landlord_profiles.nrl_number');

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
    const rawNrl = localProfile?.nrl_number || '';
    const nrlFormatted = rawNrl && initials
      ? initials.split('/').map(ini => `${ini}:${rawNrl}`).join(' / ')
      : rawNrl;

    allProperties.push({
      source: 'em',
      property_id: p.property_id,
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
