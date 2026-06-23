import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import bcrypt from 'bcrypt';

// Date utility functions immune to timezone shifts
const addDays = (dateStr, days) => {
  const parts = dateStr.split('-');
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addMonths = (dateStr, months) => {
  const parts = dateStr.split('-');
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setMonth(d.getMonth() + months);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLastDayOfCurrentMonth = () => {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-indexed
  const lastDay = new Date(y, m + 1, 0); // Day 0 of next month is the last day of current month
  const year = lastDay.getFullYear();
  const month = String(lastDay.getMonth() + 1).padStart(2, '0');
  const day = String(lastDay.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const completeOnboarding = catchAsync(async (req, res, next) => {
  const {
    // Step 1
    landlordName, landlordEmail, landlordPhone, tobStatus,
    // Step 2
    passportNumber, kycStatus, ownershipShare,
    // Step 3
    addressLine1, city, postcode, gasSafety, eicrStatus,
    // Step 4
    serviceLevel, managementFee, marketingPrice,
    // Step 5
    tenantName, tenantEmail, rentPrice, startDate, depositSchemeId,
    // Step 6
    utilityProvider, councilTaxBand, moveInChecklist
  } = req.body;

  // Basic validation check for required fields
  if (!landlordName || !landlordEmail || !landlordPhone || !tobStatus ||
      !passportNumber || !kycStatus || !ownershipShare ||
      !addressLine1 || !city || !postcode || !gasSafety || !eicrStatus ||
      !serviceLevel || !managementFee || !marketingPrice ||
      !tenantName || !rentPrice || !startDate || !depositSchemeId ||
      !utilityProvider || !councilTaxBand || !moveInChecklist) {
    throw new ApiError(400, 'Missing required onboarding form fields');
  }

  const result = await db.transaction(async (trx) => {
    // 1. Create user record for landlord (role=LANDLORD) — or find existing by email
    const normalizedEmail = landlordEmail.toLowerCase().trim();
    let landlordUser = await trx('users').where('email', normalizedEmail).first();
    let landlordId;

    if (landlordUser) {
      landlordId = landlordUser.id;
      // Ensure the existing user role matches LANDLORD
      if (landlordUser.role !== 'LANDLORD') {
        await trx('users').where('id', landlordId).update({ role: 'LANDLORD' });
      }
    } else {
      const hashedPassword = await bcrypt.hash('RocaWelcome123!', 10);
      const [newLandlordId] = await trx('users').insert({
        name: landlordName,
        email: normalizedEmail,
        password: hashedPassword,
        phone: landlordPhone,
        role: 'LANDLORD'
      });
      landlordId = newLandlordId;
    }

    // 2. Create/Update landlord_profile with kyc_status, tob_status
    let tobDbStatus = 'not_sent';
    if (tobStatus === 'Signed') tobDbStatus = 'signed';
    else if (tobStatus === 'Sent') tobDbStatus = 'sent';
    else if (tobStatus === 'Not Sent') tobDbStatus = 'not_sent';

    const kycDbStatus = kycStatus.toLowerCase(); // 'passed', 'pending', or 'failed'

    const existingProfile = await trx('landlord_profiles').where('user_id', landlordId).first();
    if (existingProfile) {
      await trx('landlord_profiles').where('user_id', landlordId).update({
        kyc_status: kycDbStatus,
        kyc_ref: passportNumber,
        tob_status: tobDbStatus,
        tob_signed_at: tobStatus === 'Signed' ? trx.fn.now() : existingProfile.tob_signed_at,
        ownership_confirmed: kycStatus === 'Passed' ? 1 : existingProfile.ownership_confirmed,
        ownership_share: parseFloat(ownershipShare),
        updated_at: trx.fn.now()
      });
    } else {
      await trx('landlord_profiles').insert({
        user_id: landlordId,
        kyc_status: kycDbStatus,
        kyc_ref: passportNumber,
        tob_status: tobDbStatus,
        tob_signed_at: tobStatus === 'Signed' ? trx.fn.now() : null,
        ownership_confirmed: kycStatus === 'Passed' ? 1 : 0,
        ownership_share: parseFloat(ownershipShare),
        kyc_provider: 'HIPLA',
        is_overseas: 0,
        nrl_hmrc_approved: 0,
        nrl_withhold_pct: 20.00
      });
    }

    // 3. Create property record with address, rent_pcm=rentPrice, mgmt_fee_pct=managementFee
    const [propertyId] = await trx('properties').insert({
      landlord_id: landlordId,
      address_line1: addressLine1,
      city: city,
      postcode: postcode,
      status: 'let', // Directly let since tenancy is established
      rent_pcm: parseFloat(rentPrice).toFixed(2),
      mgmt_fee_pct: parseFloat(managementFee).toFixed(2)
    });

    // 4. Update property_certificates for GAS (gasSafety) and EICR (eicrStatus)
    const certTypes = ['EPC', 'EICR', 'GAS', 'SMOKE_CO', 'HMO', 'PAT'];
    const certRows = certTypes.map((type) => {
      let statusVal = 'not_uploaded';
      if (type === 'GAS') {
        if (gasSafety === 'Compliant') statusVal = 'compliant';
        else if (gasSafety === 'Non-Compliant') statusVal = 'expired';
      } else if (type === 'EICR') {
        if (eicrStatus === 'Compliant') statusVal = 'compliant';
        else if (eicrStatus === 'Non-Compliant') statusVal = 'expired';
      }
      return {
        property_id: propertyId,
        cert_type: type,
        status: statusVal
      };
    });
    await trx('property_certificates').insert(certRows);

    // 5. Create letting_agents record (or find by name) for marketingPrice instruction
    let agent = await trx('letting_agents').where('company_name', 'ROCA Lettings').first();
    let agentId;
    if (!agent) {
      const [newAgentId] = await trx('letting_agents').insert({
        company_name: 'ROCA Lettings',
        contact_name: 'Onboarding System',
        email: 'info@rocaliving.com',
        phone: '02071234567',
        redress_scheme: 'The Property Ombudsman',
        cmp_provider: 'Client Money Protect',
        status: 'active'
      });
      agentId = newAgentId;
    } else {
      agentId = agent.id;
    }

    // 6. Create agent_instruction
    const [instructionId] = await trx('agent_instructions').insert({
      agent_id: agentId,
      property_id: propertyId,
      landlord_id: landlordId,
      agency_basis: 'sole agency',
      agent_fee_basis: 'percentage',
      agent_fee_amount: parseFloat(managementFee).toFixed(2),
      roca_letting_fee: 0.00,
      marketing_rent: parseFloat(marketingPrice).toFixed(2),
      status: 'active',
      instructed_at: trx.fn.now(),
      created_by: req.user.id
    });

    // 7. Create tenancy with start_date, rent_pcm
    const tenancyEndDate = addMonths(startDate, 12);
    const [tenancyId] = await trx('tenancies').insert({
      property_id: propertyId,
      status: 'active',
      start_date: startDate,
      end_date: tenancyEndDate,
      rent_pcm: parseFloat(rentPrice).toFixed(2),
      rent_frequency: 'monthly',
      agent_letting_fee: 0.00,
      roca_letting_fee: 0.00,
      created_by: req.user.id
    });

    // 8. Create tenant record
    await trx('tenants').insert({
      tenancy_id: tenancyId,
      name: tenantName,
      email: tenantEmail || null,
      phone: null,
      is_lead_tenant: 1,
      right_to_rent_status: 'pending'
    });

    // 9. Create deposit with amount = rentPrice × 5/52 × 5
    const calculatedDeposit = parseFloat(rentPrice * 25 / 52).toFixed(2);
    const registerDue = addDays(startDate, 30);
    await trx('deposits').insert({
      tenancy_id: tenancyId,
      holding_deposit: null,
      tenancy_deposit: calculatedDeposit,
      scheme: 'TDS',
      received_at: startDate,
      register_due: registerDue,
      status: 'pending_registration',
      notes: depositSchemeId ? `Certificate ID: ${depositSchemeId}` : null
    });

    // 10. Create utility record for utilityProvider
    await trx('utilities').insert([
      {
        property_id: propertyId,
        tenancy_id: tenancyId,
        utility_type: 'gas',
        supplier: utilityProvider,
        direction: 'into_tenant',
        status: 'pending',
        notes: 'Onboarded from wizard'
      },
      {
        property_id: propertyId,
        tenancy_id: tenancyId,
        utility_type: 'council_tax',
        supplier: 'Local Council',
        direction: 'into_tenant',
        status: 'pending',
        notes: `Council Tax Band: ${councilTaxBand}`
      }
    ]);

    // 11. Create fire_safety_signoff record if moveInChecklist = 'Completed'
    if (moveInChecklist === 'Completed') {
      await trx('fire_safety_signoffs').insert({
        tenancy_id: tenancyId,
        briefed_by: req.user.id,
        briefed_at: trx.fn.now(),
        tenant_acknowledged: 1,
        notes: 'Completed move-in checklist'
      });
    }

    // 12. Generate rent_schedules for 12 months
    const schedules = [];
    for (let i = 0; i < 12; i++) {
      const dueDate = addMonths(startDate, i);
      schedules.push({
        tenancy_id: tenancyId,
        due_date: dueDate,
        amount: parseFloat(rentPrice).toFixed(2),
        status: 'due'
      });
    }
    await trx('rent_schedules').insert(schedules);

    // 13. Update all compliance_checklist items to complete
    const checklistItems = [
      { item_code: 'GAS_CERT', item_label: 'Gas Safety Certificate' },
      { item_code: 'EICR_CERT', item_label: 'Electrical Installation Condition Report' },
      { item_code: 'EPC_CERT', item_label: 'Energy Performance Certificate' },
      { item_code: 'SMOKE_CO', item_label: 'Smoke & Carbon Monoxide Alarms' },
      { item_code: 'KEYS_RECEIVED', item_label: 'Physical Key References Received' }
    ];
    const checklistRows = checklistItems.map((item) => ({
      scope: 'property',
      entity_id: propertyId,
      item_code: item.item_code,
      item_label: item.item_label,
      applicable: 1,
      status: 'complete',
      verified_at: trx.fn.now(),
      verified_by: req.user.id,
      notes: 'Completed during onboarding wizard'
    }));
    await trx('compliance_checklist').insert(checklistRows);

    // 14. Write audit_log (action: 'ONBOARDING_COMPLETED', meta: { landlord_id, property_id, tenancy_id })
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'ONBOARDING_COMPLETED',
      entity_type: 'property',
      entity_id: propertyId,
      meta: JSON.stringify({ landlord_id: landlordId, property_id: propertyId, tenancy_id: tenancyId }),
      ip_address: req.ip || null
    });

    return {
      landlord_id: landlordId,
      property_id: propertyId,
      tenancy_id: tenancyId,
      statement_due_date: getLastDayOfCurrentMonth()
    };
  });

  res.status(201).json({
    success: true,
    data: result
  });
});
