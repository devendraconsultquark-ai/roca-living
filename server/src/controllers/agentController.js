import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';

// Formatting helpers
const formatAgent = (a) => {
  if (!a) return null;
  return {
    ...a,
    created_at: a.created_at ? new Date(a.created_at).toISOString() : null
  };
};

const formatInstruction = (ins) => {
  if (!ins) return null;
  return {
    ...ins,
    agent_fee_amount: ins.agent_fee_amount !== null && ins.agent_fee_amount !== undefined ? parseFloat(ins.agent_fee_amount).toFixed(2) : null,
    roca_letting_fee: ins.roca_letting_fee !== null && ins.roca_letting_fee !== undefined ? parseFloat(ins.roca_letting_fee).toFixed(2) : null,
    marketing_rent: ins.marketing_rent !== null && ins.marketing_rent !== undefined ? parseFloat(ins.marketing_rent).toFixed(2) : null,
    instructed_at: ins.instructed_at ? new Date(ins.instructed_at).toISOString() : null,
    completed_at: ins.completed_at ? new Date(ins.completed_at).toISOString() : null
  };
};

const formatViewing = (v) => {
  if (!v) return null;
  return {
    ...v,
    viewed_at: v.viewed_at ? new Date(v.viewed_at).toISOString() : null,
    created_at: v.created_at ? new Date(v.created_at).toISOString() : null
  };
};

export const getAllAgents = catchAsync(async (req, res, next) => {
  // Return all letting agents, including a count of active instructions
  const list = await db('letting_agents')
    .leftJoin('agent_instructions', function() {
      this.on('letting_agents.id', '=', 'agent_instructions.agent_id')
        .andOn('agent_instructions.status', '=', db.raw("'active'"));
    })
    .select(
      'letting_agents.*',
      db.raw('COUNT(agent_instructions.id) as activeProperties')
    )
    .groupBy('letting_agents.id')
    .orderBy('letting_agents.company_name', 'asc');

  const formatted = list.map(a => ({
    ...formatAgent(a),
    activeProperties: parseInt(a.activeProperties || 0, 10)
  }));

  res.json({
    success: true,
    data: formatted
  });
});

export const createAgent = catchAsync(async (req, res, next) => {
  const { company_name, contact_name, email, phone, redress_scheme, cmp_provider } = req.body;

  if (!company_name) {
    throw new ApiError(400, 'Company name is required');
  }

  const [agentId] = await db('letting_agents').insert({
    company_name,
    contact_name: contact_name || null,
    email: email || null,
    phone: phone || null,
    redress_scheme: redress_scheme || null,
    cmp_provider: cmp_provider || null,
    status: 'active'
  });

  const newAgent = await db('letting_agents').where('id', agentId).first();

  // Audit Log
  await db('audit_log').insert({
    actor_id: req.user.id,
    actor_role: req.user.role,
    action: 'AGENT_CREATED',
    entity_type: 'letting_agent',
    entity_id: agentId,
    meta: JSON.stringify({ company_name }),
    ip_address: req.ip || null
  });

  res.status(201).json({
    success: true,
    data: formatAgent(newAgent)
  });
});

export const updateAgent = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { company_name, contact_name, email, phone, redress_scheme, cmp_provider, status } = req.body;

  const agentExists = await db('letting_agents').where('id', id).first();
  if (!agentExists) {
    throw new ApiError(404, 'Letting agent not found');
  }

  const updateData = {};
  if (company_name !== undefined) updateData.company_name = company_name;
  if (contact_name !== undefined) updateData.contact_name = contact_name;
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;
  if (redress_scheme !== undefined) updateData.redress_scheme = redress_scheme;
  if (cmp_provider !== undefined) updateData.cmp_provider = cmp_provider;
  if (status !== undefined) updateData.status = status;

  if (Object.keys(updateData).length > 0) {
    await db('letting_agents').where('id', id).update(updateData);
    
    // Audit Log
    await db('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'AGENT_UPDATED',
      entity_type: 'letting_agent',
      entity_id: id,
      meta: JSON.stringify(updateData),
      ip_address: req.ip || null
    });
  }

  const updatedAgent = await db('letting_agents').where('id', id).first();

  res.json({
    success: true,
    data: formatAgent(updatedAgent)
  });
});

export const createInstruction = catchAsync(async (req, res, next) => {
  const { id } = req.params; // agent_id
  const { property_id, marketing_rent, agent_fee_basis, agent_fee_amount, roca_letting_fee, agency_basis } = req.body;

  if (!property_id) {
    throw new ApiError(400, 'Property ID is required');
  }

  // Verify agent and property exist
  const agent = await db('letting_agents').where('id', id).first();
  if (!agent) {
    throw new ApiError(404, 'Letting agent not found');
  }

  const property = await db('properties').where('id', property_id).first();
  if (!property) {
    throw new ApiError(404, 'Property not found');
  }

  const landlord_id = property.landlord_id;

  const [instructionId] = await db('agent_instructions').insert({
    agent_id: id,
    property_id,
    landlord_id,
    agency_basis: agency_basis || null,
    agent_fee_basis: agent_fee_basis || 'percentage',
    agent_fee_amount: agent_fee_amount !== undefined && agent_fee_amount !== null ? parseFloat(agent_fee_amount).toFixed(2) : null,
    roca_letting_fee: roca_letting_fee !== undefined && roca_letting_fee !== null ? parseFloat(roca_letting_fee).toFixed(2) : null,
    marketing_rent: marketing_rent !== undefined && marketing_rent !== null ? parseFloat(marketing_rent).toFixed(2) : null,
    status: 'active',
    instructed_at: db.fn.now(),
    created_by: req.user.id
  });

  const newInstruction = await db('agent_instructions').where('id', instructionId).first();

  // Audit Log
  await db('audit_log').insert({
    actor_id: req.user.id,
    actor_role: req.user.role,
    action: 'AGENT_INSTRUCTION_CREATED',
    entity_type: 'agent_instruction',
    entity_id: instructionId,
    meta: JSON.stringify({ agent_id: id, property_id, landlord_id }),
    ip_address: req.ip || null
  });

  res.status(201).json({
    success: true,
    data: formatInstruction(newInstruction)
  });
});

export const addViewing = catchAsync(async (req, res, next) => {
  const { id } = req.params; // instruction_id
  const { viewed_at, applicant_name, applicant_ref, feedback, outcome } = req.body;

  if (!viewed_at) {
    throw new ApiError(400, 'Viewing date and time are required');
  }

  const instruction = await db('agent_instructions').where('id', id).first();
  if (!instruction) {
    throw new ApiError(404, 'Agent instruction not found');
  }

  const [viewingId] = await db('viewings').insert({
    instruction_id: id,
    viewed_at: new Date(viewed_at),
    applicant_name: applicant_name || null,
    applicant_ref: applicant_ref || null,
    feedback: feedback || null,
    outcome: outcome || null
  });

  const newViewing = await db('viewings').where('id', viewingId).first();

  // Audit Log
  await db('audit_log').insert({
    actor_id: req.user.id,
    actor_role: req.user.role,
    action: 'AGENT_VIEWING_ADDED',
    entity_type: 'viewing',
    entity_id: viewingId,
    meta: JSON.stringify({ instruction_id: id, outcome }),
    ip_address: req.ip || null
  });

  res.status(201).json({
    success: true,
    data: formatViewing(newViewing)
  });
});

export const getInstructionViewings = catchAsync(async (req, res, next) => {
  const { id } = req.params; // instruction_id

  const instruction = await db('agent_instructions').where('id', id).first();
  if (!instruction) {
    throw new ApiError(404, 'Agent instruction not found');
  }

  const viewings = await db('viewings')
    .where('instruction_id', id)
    .orderBy('viewed_at', 'desc');

  res.json({
    success: true,
    data: viewings.map(formatViewing)
  });
});

export const deleteAgent = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const agent = await db('letting_agents').where('id', id).first();
  if (!agent) {
    throw new ApiError(404, 'Letting agent not found');
  }

  await db.transaction(async (trx) => {
    await trx('agent_instructions').where('agent_id', id).delete();
    await trx('letting_agents').where('id', id).delete();

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'AGENT_DELETED',
      entity_type: 'letting_agent',
      entity_id: id,
      meta: JSON.stringify({ company_name: agent.company_name }),
      ip_address: req.ip || null
    });
  });

  res.json({
    success: true,
    message: 'Letting agent deleted successfully'
  });
});

export const getAgentById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const agent = await db('letting_agents').where('id', id).first();
  if (!agent) {
    throw new ApiError(404, 'Letting agent not found');
  }

  // Active instructions with property + landlord info
  const instructions = await db('agent_instructions')
    .join('properties', 'agent_instructions.property_id', 'properties.id')
    .join('users as landlords', 'agent_instructions.landlord_id', 'landlords.id')
    .select(
      'agent_instructions.*',
      'properties.address_line1',
      'properties.address_line2',
      'properties.city',
      'properties.postcode',
      'landlords.name as landlord_name'
    )
    .where('agent_instructions.agent_id', id)
    .orderBy('agent_instructions.instructed_at', 'desc');

  // Viewings count per instruction
  const instructionIds = instructions.map(i => i.id);
  let viewingCounts = {};
  if (instructionIds.length > 0) {
    const counts = await db('viewings')
      .whereIn('instruction_id', instructionIds)
      .select('instruction_id')
      .count('id as total')
      .groupBy('instruction_id');
    counts.forEach(c => { viewingCounts[c.instruction_id] = parseInt(c.total, 10); });
  }

  res.json({
    success: true,
    data: {
      ...formatAgent(agent),
      instructions: instructions.map(ins => ({
        ...ins,
        property_address: `${ins.address_line1}${ins.address_line2 ? ', ' + ins.address_line2 : ''}, ${ins.city} ${ins.postcode}`,
        marketing_rent: ins.marketing_rent !== null ? parseFloat(ins.marketing_rent).toFixed(2) : null,
        agent_fee_amount: ins.agent_fee_amount !== null ? parseFloat(ins.agent_fee_amount).toFixed(2) : null,
        instructed_at: ins.instructed_at ? new Date(ins.instructed_at).toISOString() : null,
        viewings_count: viewingCounts[ins.id] || 0,
      })),
    }
  });
});
