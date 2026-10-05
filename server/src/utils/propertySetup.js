// Shared setup for Roca Living property (lettings) records. Every path that
// makes a property part of ROCA Living's lettings — manual create, the
// "Managed by ROCA Living" switch, Add Tenant — must give it the same safety
// certificates and compliance checklist, or the Compliance pages stay empty
// for it. Phase 26 migration backfills properties created before this existed.

export const PROPERTY_CERT_TYPES = ['EPC', 'EICR', 'GAS', 'SMOKE_CO', 'HMO', 'PAT'];

export const PROPERTY_CHECKLIST_ITEMS = [
  { item_code: 'GAS_CERT', item_label: 'Gas Safety Certificate' },
  { item_code: 'EICR_CERT', item_label: 'Electrical Installation Condition Report' },
  { item_code: 'EPC_CERT', item_label: 'Energy Performance Certificate' },
  { item_code: 'SMOKE_CO', item_label: 'Smoke & Carbon Monoxide Alarms' },
  { item_code: 'KEYS_RECEIVED', item_label: 'Physical Key References Received' }
];

/**
 * Idempotently ensure a property has its certificate rows and its
 * property-scope compliance checklist: only missing rows are inserted, so it
 * is safe to call on every switch-on / tenancy / migration run.
 *
 * Must be called inside the caller's transaction (`trx`).
 */
export const ensurePropertyCompliance = async (trx, propertyId) => {
  const existingCerts = await trx('property_certificates').where({ property_id: propertyId }).pluck('cert_type');
  const missingCerts = PROPERTY_CERT_TYPES.filter((t) => !existingCerts.includes(t));
  if (missingCerts.length > 0) {
    await trx('property_certificates').insert(missingCerts.map((type) => ({
      property_id: propertyId,
      cert_type: type,
      status: 'not_uploaded'
    })));
  }

  const existingCodes = await trx('compliance_checklist')
    .where({ scope: 'property', entity_id: propertyId })
    .pluck('item_code');
  const missingItems = PROPERTY_CHECKLIST_ITEMS.filter((i) => !existingCodes.includes(i.item_code));
  if (missingItems.length > 0) {
    await trx('compliance_checklist').insert(missingItems.map((item) => ({
      scope: 'property',
      entity_id: propertyId,
      item_code: item.item_code,
      item_label: item.item_label,
      applicable: 1,
      status: 'pending'
    })));
  }

  return { certificates: missingCerts.length, checklist: missingItems.length };
};
