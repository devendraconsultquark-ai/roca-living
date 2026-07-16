import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

const formatTicket = (t) => {
  if (!t) return null;
  return {
    ...t,
    quote_amount: t.quote_amount !== null && t.quote_amount !== undefined ? parseFloat(t.quote_amount).toFixed(2) : null,
    invoice_amount: t.invoice_amount !== null && t.invoice_amount !== undefined ? parseFloat(t.invoice_amount).toFixed(2) : null,
    spend_threshold_auto_approve: t.spend_threshold_auto_approve !== null && t.spend_threshold_auto_approve !== undefined ? parseFloat(t.spend_threshold_auto_approve).toFixed(2) : null,
    landlord_approved_at: t.landlord_approved_at ? new Date(t.landlord_approved_at).toISOString() : null,
    completed_at: t.completed_at ? new Date(t.completed_at).toISOString() : null,
    created_at: t.created_at ? new Date(t.created_at).toISOString() : null,
    updated_at: t.updated_at ? new Date(t.updated_at).toISOString() : null
  };
};

const VALID_TRANSITIONS = {
  'new': ['triaged', 'cancelled'],
  'triaged': ['awaiting_approval', 'in_progress', 'cancelled'],
  'awaiting_approval': ['in_progress', 'cancelled'],
  'in_progress': ['complete', 'cancelled'],
  'complete': [],
  'cancelled': []
};

export const createTicket = catchAsync(async (req, res, next) => {
  const { property_id, tenancy_id, urgency, title, description, quote_amount, spend_threshold_auto_approve } = req.body;

  if (!property_id || !urgency || !title || !description) {
    throw new ApiError(400, 'Property, urgency, title, and description are required');
  }

  const property = await db('properties').where('id', property_id).first();
  if (!property) {
    throw new ApiError(404, 'Property not found');
  }

  // A landlord may only raise tickets against their own properties (prevents IDOR write +
  // injecting contractor_cost deductions onto another landlord's ledger).
  const isLandlordCaller = req.user.role === 'LANDLORD';
  if (isLandlordCaller && property.landlord_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to create a ticket for this property');
  }

  // If a tenancy is referenced it must belong to the same property.
  if (tenancy_id) {
    const tenancy = await db('tenancies').where('id', tenancy_id).first();
    if (!tenancy || tenancy.property_id !== property.id) {
      throw new ApiError(400, 'Tenancy does not belong to the specified property');
    }
  }

  // Quotes and auto-approval thresholds are admin-set: a landlord-supplied quote
  // would let the caller mint pre-approved contractor_cost ledger deductions.
  const quoteAmt = !isLandlordCaller && quote_amount !== undefined ? parseFloat(quote_amount) : 0;
  const threshold = !isLandlordCaller && spend_threshold_auto_approve !== undefined ? parseFloat(spend_threshold_auto_approve) : 250.00;

  let ticketStatus = 'new';
  let landlordApproved = null;
  let landlordApprovedAt = null;

  if (urgency === 'emergency') {
    ticketStatus = 'in_progress';
  } else if (urgency === 'routine' && quoteAmt > 0 && quoteAmt <= threshold) {
    ticketStatus = 'in_progress';
    landlordApproved = 1;
    landlordApprovedAt = new Date();
  }

  const result = await db.transaction(async (trx) => {
    // 1. Insert ticket
    const [ticketId] = await trx('maintenance_tickets').insert({
      property_id,
      tenancy_id: tenancy_id || null,
      reported_by: req.user.id,
      urgency,
      title,
      description,
      status: ticketStatus,
      landlord_approved: landlordApproved,
      landlord_approved_at: landlordApprovedAt,
      quote_amount: quoteAmt > 0 ? quoteAmt.toFixed(2) : null,
      spend_threshold_auto_approve: threshold.toFixed(2)
    });

    // 2. Create deduction transaction if auto-approved
    if (landlordApproved === 1 && quoteAmt > 0) {
      await trx('transactions').insert({
        type: 'contractor_cost',
        property_id,
        landlord_id: property.landlord_id,
        ticket_id: ticketId,
        amount: quoteAmt.toFixed(2),
        transaction_date: trx.fn.now(),
        reconciled: 1,
        created_by: req.user.id,
        description: `Contractor cost deduction for auto-approved maintenance ticket ID ${ticketId} (${title})`
      });
    }

    // 3. Write audit log
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'MAINTENANCE_TICKET_CREATED',
      entity_type: 'maintenance_ticket',
      entity_id: ticketId,
      meta: JSON.stringify({ property_id, urgency, title, status: ticketStatus, quote_amount: quoteAmt }),
      ip_address: req.ip || null
    });

    const ticket = await trx('maintenance_tickets').where('id', ticketId).first();
    return formatTicket(ticket);
  });

  res.status(201).json({
    success: true,
    data: result
  });
});

export const updateTicketStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status, contractor_id, quote_amount, landlord_approved, notes } = req.body;

  const ticket = await db('maintenance_tickets').where('id', id).first();
  if (!ticket) {
    throw new ApiError(404, 'Maintenance ticket not found');
  }

  const property = await db('properties').where('id', ticket.property_id).first();

  const currentStatus = ticket.status;
  const newStatus = status || currentStatus;

  // Validate status transition if changing
  if (status && status !== currentStatus) {
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(status)) {
      throw new ApiError(400, `Invalid status transition from '${currentStatus}' to '${status}'`);
    }
  }

  const isApproved = landlord_approved === true || landlord_approved === 1;
  const quoteAmt = quote_amount !== undefined ? parseFloat(quote_amount) : parseFloat(ticket.quote_amount || 0);

  const updateData = {};
  if (status !== undefined) updateData.status = status;
  if (contractor_id !== undefined) updateData.contractor_id = contractor_id;
  if (quote_amount !== undefined) updateData.quote_amount = parseFloat(quote_amount).toFixed(2);
  if (landlord_approved !== undefined) {
    updateData.landlord_approved = isApproved ? 1 : 0;
    if (isApproved) {
      updateData.landlord_approved_at = db.fn.now();
    } else {
      updateData.landlord_approved_at = null;
    }
  }
  if (newStatus === 'complete') {
    updateData.completed_at = db.fn.now();
  }

  await db.transaction(async (trx) => {
    // 1. Create deduction transaction if newly approved and quote > 0
    if (isApproved && quoteAmt > 0) {
      const existingTx = await trx('transactions')
        .where({ type: 'contractor_cost', ticket_id: id })
        .first();

      if (!existingTx) {
        await trx('transactions').insert({
          type: 'contractor_cost',
          property_id: ticket.property_id,
          landlord_id: property.landlord_id,
          ticket_id: id,
          amount: quoteAmt.toFixed(2),
          transaction_date: trx.fn.now(),
          reconciled: 1,
          created_by: req.user.id,
          description: `Contractor cost deduction for approved maintenance ticket ID ${id} (${ticket.title})`
        });
      }
    }

    // 1b. Reverse the deduction if the admin explicitly un-approves the quote.
    if (landlord_approved !== undefined && !isApproved) {
      const removed = await trx('transactions')
        .where({ type: 'contractor_cost', ticket_id: id })
        .delete();
      if (removed > 0) {
        await trx('audit_log').insert({
          actor_id: req.user.id,
          actor_role: req.user.role,
          action: 'CONTRACTOR_COST_REVERSED',
          entity_type: 'maintenance_ticket',
          entity_id: id,
          meta: JSON.stringify({ reason: 'quote un-approved', transactions_removed: removed }),
          ip_address: req.ip || null
        });
      }
    }

    // 2. Perform updates
    if (Object.keys(updateData).length > 0) {
      await trx('maintenance_tickets')
        .where('id', id)
        .update({
          ...updateData,
          updated_at: trx.fn.now()
        });
    }

    // 3. Write Audit Log — build a JSON-safe meta (exclude Knex raw fn objects)
    const auditMeta = {
      notes: notes || null,
      ...(status !== undefined && { status }),
      ...(contractor_id !== undefined && { contractor_id }),
      ...(quote_amount !== undefined && { quote_amount: parseFloat(quote_amount).toFixed(2) }),
      ...(landlord_approved !== undefined && { landlord_approved: isApproved ? 1 : 0 }),
      ...(newStatus === 'complete' && { completed_at: 'NOW()' })
    };
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'MAINTENANCE_TICKET_UPDATED',
      entity_type: 'maintenance_ticket',
      entity_id: id,
      meta: JSON.stringify(auditMeta),
      ip_address: req.ip || null
    });
  });

  const updatedTicket = await db('maintenance_tickets').where('id', id).first();

  res.json({
    success: true,
    data: formatTicket(updatedTicket)
  });
});

export const getAllTickets = catchAsync(async (req, res, next) => {
  const { status, urgency, property_id } = req.query;

  let query = db('maintenance_tickets')
    .join('properties', 'maintenance_tickets.property_id', 'properties.id')
    .join('users as landlords', 'properties.landlord_id', 'landlords.id')
    .leftJoin('contractors', 'maintenance_tickets.contractor_id', 'contractors.id')
    .select(
      'maintenance_tickets.*',
      'properties.address_line1',
      'properties.city',
      'properties.postcode',
      'landlords.name as landlord_name',
      'contractors.company_name as contractor_company',
      'contractors.trade as contractor_trade'
    );

  if (status) query.where('maintenance_tickets.status', status);
  if (urgency) query.where('maintenance_tickets.urgency', urgency);
  if (property_id) query.where('maintenance_tickets.property_id', property_id);

  const list = await query.orderBy('maintenance_tickets.created_at', 'desc');

  res.json({
    success: true,
    data: list.map(t => ({
      ...formatTicket(t),
      property_address: `${t.address_line1}, ${t.city}`,
      landlord_name: t.landlord_name,
      contractor_company: t.contractor_company || '-',
      contractor_trade: t.contractor_trade || '-'
    }))
  });
});

export const getMyTickets = catchAsync(async (req, res, next) => {
  const list = await db('maintenance_tickets')
    .join('properties', 'maintenance_tickets.property_id', 'properties.id')
    .leftJoin('contractors', 'maintenance_tickets.contractor_id', 'contractors.id')
    .select(
      'maintenance_tickets.*',
      'properties.address_line1',
      'properties.city',
      'properties.postcode',
      'contractors.company_name as contractor_company'
    )
    .where('properties.landlord_id', req.user.id)
    .orderBy('maintenance_tickets.created_at', 'desc');

  res.json({
    success: true,
    data: list.map(t => ({
      ...formatTicket(t),
      property_address: `${t.address_line1}, ${t.city}`,
      contractor_company: t.contractor_company || '-'
    }))
  });
});

export const approveQuote = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const ticket = await db('maintenance_tickets').where('id', id).first();
  if (!ticket) {
    throw new ApiError(404, 'Maintenance ticket not found');
  }

  const property = await db('properties').where('id', ticket.property_id).first();
  if (property.landlord_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to approve quotes for this property');
  }

  const quoteAmt = parseFloat(ticket.quote_amount || 0);

  await db.transaction(async (trx) => {
    // 1. Create deduction transaction if quote > 0 and doesn't exist yet
    if (quoteAmt > 0) {
      const existingTx = await trx('transactions')
        .where({ type: 'contractor_cost', ticket_id: id })
        .first();

      if (!existingTx) {
        await trx('transactions').insert({
          type: 'contractor_cost',
          property_id: ticket.property_id,
          landlord_id: property.landlord_id,
          ticket_id: id,
          amount: quoteAmt.toFixed(2),
          transaction_date: trx.fn.now(),
          reconciled: 1,
          created_by: req.user.id,
          description: `Contractor cost deduction for approved maintenance ticket ID ${id} (${ticket.title})`
        });
      }
    }

    // 2. Update status & approval
    await trx('maintenance_tickets')
      .where('id', id)
      .update({
        landlord_approved: 1,
        landlord_approved_at: trx.fn.now(),
        status: 'in_progress',
        updated_at: trx.fn.now()
      });

    // 3. Write Audit Log
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'MAINTENANCE_TICKET_QUOTE_APPROVED',
      entity_type: 'maintenance_ticket',
      entity_id: id,
      meta: JSON.stringify({ landlord_approved: 1, status: 'in_progress' }),
      ip_address: req.ip || null
    });
  });

  const updatedTicket = await db('maintenance_tickets').where('id', id).first();

  res.json({
    success: true,
    data: formatTicket(updatedTicket)
  });
});

export const declineQuote = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const ticket = await db('maintenance_tickets').where('id', id).first();
  if (!ticket) {
    throw new ApiError(404, 'Maintenance ticket not found');
  }

  const property = await db('properties').where('id', ticket.property_id).first();
  if (!property || property.landlord_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to decline quotes for this property');
  }

  await db.transaction(async (trx) => {
    await trx('maintenance_tickets')
      .where('id', id)
      .update({
        landlord_approved: 0,
        status: 'cancelled',
        updated_at: trx.fn.now()
      });

    // Declining cancels the job — reverse any deduction created by an earlier
    // approval so the landlord isn't charged for work that won't happen.
    const removed = await trx('transactions')
      .where({ type: 'contractor_cost', ticket_id: id })
      .delete();

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'MAINTENANCE_TICKET_QUOTE_DECLINED',
      entity_type: 'maintenance_ticket',
      entity_id: id,
      meta: JSON.stringify({ landlord_approved: 0, status: 'cancelled', transactions_removed: removed }),
      ip_address: req.ip || null
    });
  });

  const updatedTicket = await db('maintenance_tickets').where('id', id).first();

  res.json({
    success: true,
    data: formatTicket(updatedTicket)
  });
});

// ─── Ticket images ──────────────────────────────────────────────────────────

// A landlord may only touch images on tickets against their own properties.
const assertTicketAccess = async (ticketId, user) => {
  const ticket = await db('maintenance_tickets').where('id', ticketId).first();
  if (!ticket) {
    throw new ApiError(404, 'Maintenance ticket not found');
  }
  if (user.role === 'LANDLORD') {
    const property = await db('properties').where('id', ticket.property_id).first();
    if (!property || property.landlord_id !== user.id) {
      throw new ApiError(403, 'You do not have permission to access this ticket');
    }
  }
  return ticket;
};

export const uploadTicketImage = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!req.file) {
    throw new ApiError(400, 'No image uploaded');
  }

  try {
    await assertTicketAccess(id, req.user);
  } catch (err) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    throw err;
  }

  const document_path = `uploads/maintenance/${req.file.filename}`;

  const [imageId] = await db('maintenance_images').insert({
    ticket_id: id,
    document_path,
    uploaded_by: req.user.id
  });

  await db('audit_log').insert({
    actor_id: req.user.id,
    actor_role: req.user.role,
    action: 'MAINTENANCE_IMAGE_UPLOADED',
    entity_type: 'maintenance_ticket',
    entity_id: id,
    meta: JSON.stringify({ image_id: imageId, original_name: req.file.originalname }),
    ip_address: req.ip || null
  });

  res.status(201).json({
    success: true,
    data: { id: imageId, ticket_id: parseInt(id, 10), document_path }
  });
});

export const getTicketImages = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await assertTicketAccess(id, req.user);

  const images = await db('maintenance_images').where('ticket_id', id).orderBy('created_at', 'asc');

  res.json({
    success: true,
    data: images.map(img => ({
      id: img.id,
      ticket_id: img.ticket_id,
      created_at: img.created_at ? new Date(img.created_at).toISOString() : null
    }))
  });
});

export const downloadTicketImage = catchAsync(async (req, res, next) => {
  const { imageId } = req.params;

  const image = await db('maintenance_images').where('id', imageId).first();
  if (!image) {
    throw new ApiError(404, 'Image not found');
  }
  await assertTicketAccess(image.ticket_id, req.user);

  const absolutePath = path.isAbsolute(image.document_path)
    ? image.document_path
    : path.join(process.cwd(), image.document_path);
  const resolved = path.resolve(absolutePath);
  if (!resolved.startsWith(path.resolve(path.join(process.cwd(), 'uploads')))) {
    logger.warn(`Blocked maintenance image download outside uploads dir: ${resolved}`);
    throw new ApiError(404, 'Image file not found');
  }
  if (!fs.existsSync(resolved)) {
    logger.warn(`Maintenance image missing on disk: ${resolved}`);
    throw new ApiError(404, 'Image file not found');
  }

  res.sendFile(resolved);
});

// ─── Contractors ────────────────────────────────────────────────────────────

export const getAllContractors = catchAsync(async (req, res, next) => {
  const { status, trade } = req.query;

  let query = db('contractors').select('*');
  if (status) query.where('status', status);
  if (trade) query.where('trade', 'like', `%${trade}%`);

  const list = await query.orderBy('company_name', 'asc');

  res.json({
    success: true,
    data: list.map(c => ({
      ...c,
      rating: c.rating !== null && c.rating !== undefined ? parseFloat(c.rating).toFixed(2) : null,
      insurance_expiry: c.insurance_expiry ? new Date(c.insurance_expiry).toISOString().split('T')[0] : null,
      created_at: c.created_at ? new Date(c.created_at).toISOString() : null
    }))
  });
});

export const createContractor = catchAsync(async (req, res, next) => {
  const { company_name, trade, contact_name, email, phone, insurance_expiry, rating, preferred } = req.body;

  if (!company_name || !trade) {
    throw new ApiError(400, 'company_name and trade are required');
  }

  const [contractorId] = await db('contractors').insert({
    company_name,
    trade,
    contact_name: contact_name || null,
    email: email || null,
    phone: phone || null,
    insurance_expiry: insurance_expiry || null,
    rating: rating !== undefined ? parseFloat(rating).toFixed(2) : null,
    preferred: preferred ? 1 : 0,
    status: 'active'
  });

  const contractor = await db('contractors').where('id', contractorId).first();

  res.status(201).json({
    success: true,
    data: {
      ...contractor,
      rating: contractor.rating !== null ? parseFloat(contractor.rating).toFixed(2) : null,
      insurance_expiry: contractor.insurance_expiry ? new Date(contractor.insurance_expiry).toISOString().split('T')[0] : null,
      created_at: contractor.created_at ? new Date(contractor.created_at).toISOString() : null
    }
  });
});

export const updateContractor = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { company_name, trade, contact_name, email, phone, insurance_expiry, rating, preferred, status } = req.body;

  const contractor = await db('contractors').where('id', id).first();
  if (!contractor) {
    throw new ApiError(404, 'Contractor not found');
  }

  const updates = {};
  if (company_name !== undefined) updates.company_name = company_name;
  if (trade !== undefined) updates.trade = trade;
  if (contact_name !== undefined) updates.contact_name = contact_name;
  if (email !== undefined) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (insurance_expiry !== undefined) updates.insurance_expiry = insurance_expiry || null;
  if (rating !== undefined) updates.rating = rating !== null && rating !== '' ? parseFloat(rating).toFixed(2) : null;
  if (preferred !== undefined) updates.preferred = preferred ? 1 : 0;
  if (status !== undefined) updates.status = status;

  if (Object.keys(updates).length > 0) {
    await db('contractors').where('id', id).update(updates);
    
    // Audit log
    await db('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'CONTRACTOR_UPDATED',
      entity_type: 'contractor',
      entity_id: id,
      meta: JSON.stringify(updates),
      ip_address: req.ip || null
    });
  }

  const updatedContractor = await db('contractors').where('id', id).first();

  res.json({
    success: true,
    data: {
      ...updatedContractor,
      rating: updatedContractor.rating !== null ? parseFloat(updatedContractor.rating).toFixed(2) : null,
      insurance_expiry: updatedContractor.insurance_expiry ? new Date(updatedContractor.insurance_expiry).toISOString().split('T')[0] : null,
      created_at: updatedContractor.created_at ? new Date(updatedContractor.created_at).toISOString() : null
    }
  });
});

export const deleteContractor = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const contractor = await db('contractors').where('id', id).first();
  if (!contractor) {
    throw new ApiError(404, 'Contractor not found');
  }

  await db.transaction(async (trx) => {
    await trx('maintenance_tickets').where('contractor_id', id).update({ contractor_id: null });
    await trx('contractors').where('id', id).delete();

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'CONTRACTOR_DELETED',
      entity_type: 'contractor',
      entity_id: id,
      meta: JSON.stringify({ company_name: contractor.company_name }),
      ip_address: req.ip || null
    });
  });

  res.json({
    success: true,
    message: 'Contractor deleted successfully'
  });
});

export const getContractorById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const contractor = await db('contractors').where('id', id).first();
  if (!contractor) {
    throw new ApiError(404, 'Contractor not found');
  }

  // Assigned maintenance tickets
  const tickets = await db('maintenance_tickets')
    .join('properties', 'maintenance_tickets.property_id', 'properties.id')
    .select(
      'maintenance_tickets.id',
      'maintenance_tickets.title',
      'maintenance_tickets.status',
      'maintenance_tickets.urgency',
      'maintenance_tickets.quote_amount',
      'maintenance_tickets.invoice_amount',
      'maintenance_tickets.created_at',
      'maintenance_tickets.completed_at',
      'properties.address_line1',
      'properties.city',
      'properties.postcode'
    )
    .where('maintenance_tickets.contractor_id', id)
    .orderBy('maintenance_tickets.created_at', 'desc');

  res.json({
    success: true,
    data: {
      ...contractor,
      rating: contractor.rating !== null ? parseFloat(contractor.rating).toFixed(2) : null,
      insurance_expiry: contractor.insurance_expiry
        ? new Date(contractor.insurance_expiry).toISOString().split('T')[0]
        : null,
      created_at: contractor.created_at ? new Date(contractor.created_at).toISOString() : null,
      tickets: tickets.map(t => ({
        ...t,
        property_address: `${t.address_line1}, ${t.city} ${t.postcode}`,
        quote_amount: t.quote_amount !== null ? parseFloat(t.quote_amount).toFixed(2) : null,
        invoice_amount: t.invoice_amount !== null ? parseFloat(t.invoice_amount).toFixed(2) : null,
        created_at: t.created_at ? new Date(t.created_at).toISOString() : null,
        completed_at: t.completed_at ? new Date(t.completed_at).toISOString() : null,
      })),
    }
  });
});
