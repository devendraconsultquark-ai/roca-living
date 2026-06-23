import cron from 'node-cron';
import db from '../config/db.js';
import logger from '../utils/logger.js';

// Job 1: Deposit Registration Reminder (daily at 8am)
export const checkDeposits = async () => {
  try {
    logger.info('Running deposit registration expiry check...');
    const deposits = await db('deposits')
      .join('tenancies', 'deposits.tenancy_id', 'tenancies.id')
      .join('properties', 'tenancies.property_id', 'properties.id')
      .select('deposits.*', 'properties.address_line1', 'properties.city')
      .whereNull('deposits.registered_at')
      .andWhere('deposits.register_due', '<=', db.raw('DATE_ADD(NOW(), INTERVAL 7 DAY)'));

    for (const dep of deposits) {
      const formattedDate = dep.register_due ? new Date(dep.register_due).toISOString().split('T')[0] : 'N/A';
      logger.warn(`Deposit registration warning: deposit for tenancy ID ${dep.tenancy_id} (Property: ${dep.address_line1}, ${dep.city}) is due for registration on ${formattedDate} but has not been registered yet.`);

      await db('audit_log').insert({
        action: 'DEPOSIT_REGISTRATION_REMINDER',
        entity_type: 'deposit',
        entity_id: dep.id,
        meta: JSON.stringify({ tenancy_id: dep.tenancy_id, register_due: formattedDate }),
        created_at: db.fn.now()
      });
    }
    logger.info(`Deposit registration expiry check complete. Processed ${deposits.length} deposits.`);
  } catch (error) {
    logger.error(`Error in deposit registration expiry check: ${error.message}`);
  }
};

// Job 2: Compliance Certificate Expiry Check (weekly, Monday 9am)
export const checkComplianceCertificates = async () => {
  try {
    logger.info('Running compliance certificates expiry check...');
    const certs = await db('property_certificates')
      .join('properties', 'property_certificates.property_id', 'properties.id')
      .select('property_certificates.*', 'properties.address_line1', 'properties.city')
      .where('property_certificates.expires_at', '<=', db.raw('DATE_ADD(NOW(), INTERVAL 90 DAY)'))
      .whereNot('property_certificates.status', 'expired');

    const now = new Date();
    let updatedCount = 0;

    for (const cert of certs) {
      const expiryDate = new Date(cert.expires_at);
      let newStatus = 'compliant';
      if (expiryDate < now) {
        newStatus = 'expired';
      } else if (expiryDate <= new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)) {
        newStatus = 'expiring_soon';
      }

      if (newStatus !== cert.status) {
        await db('property_certificates')
          .where('id', cert.id)
          .update({ status: newStatus, updated_at: db.fn.now() });

        const formattedExpiry = cert.expires_at ? new Date(cert.expires_at).toISOString().split('T')[0] : 'N/A';
        await db('audit_log').insert({
          action: 'COMPLIANCE_CERTIFICATE_STATUS_UPDATED',
          entity_type: 'property',
          entity_id: cert.property_id,
          meta: JSON.stringify({ cert_id: cert.id, cert_type: cert.cert_type, old_status: cert.status, new_status: newStatus, expires_at: formattedExpiry }),
          created_at: db.fn.now()
        });

        logger.warn(`Compliance certificate ${cert.cert_type} for property ${cert.address_line1}, ${cert.city} is ${newStatus}. Expiry: ${formattedExpiry}`);
        updatedCount++;
      }
    }
    logger.info(`Compliance certificates check complete. Updated ${updatedCount} certificates.`);
  } catch (error) {
    logger.error(`Error in compliance certificate expiry check: ${error.message}`);
  }
};

// Job 3: Rent Arrears Check (daily at 9am)
export const checkRentArrears = async () => {
  try {
    logger.info('Running rent arrears check...');
    const schedules = await db('rent_schedules')
      .where('due_date', '<', db.raw('CURDATE()'))
      .where('status', 'due');

    for (const s of schedules) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(s.due_date);
      const diffTime = Math.abs(today - dueDate);
      const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      await db('rent_schedules')
        .where('id', s.id)
        .update({ status: 'overdue' });

      await db('audit_log').insert({
        action: 'RENT_OVERDUE_FLAGGED',
        entity_type: 'tenancy',
        entity_id: s.tenancy_id,
        meta: JSON.stringify({ schedule_id: s.id, tenancy_id: s.tenancy_id, amount: parseFloat(s.amount).toFixed(2), days_overdue: daysOverdue }),
        created_at: db.fn.now()
      });
      logger.warn(`Rent payment overdue for tenancy ID ${s.tenancy_id}. Amount: £${parseFloat(s.amount).toFixed(2)}. Due: ${new Date(s.due_date).toISOString().split('T')[0]} (${daysOverdue} days overdue).`);
    }
    logger.info(`Rent arrears check complete. Flagged ${schedules.length} payments overdue.`);
  } catch (error) {
    logger.error(`Error in rent arrears check: ${error.message}`);
  }
};

// Job 4: Monthly Statement Reminder (1st of month at 7am)
export const logStatementReminder = () => {
  logger.info('REMINDER: Generate landlord statements for previous month');
};

// Scheduler setup
export const startScheduler = () => {
  logger.info('Initializing background jobs scheduler...');

  // Job 1: Deposit Registration Check - Daily at 8:00 AM
  cron.schedule('0 8 * * *', () => {
    checkDeposits().catch(err => logger.error(`Unhandled error in checkDeposits: ${err.message}`));
  });

  // Job 2: Compliance Certificates Check - Weekly, Mondays at 9:00 AM
  cron.schedule('0 9 * * 1', () => {
    checkComplianceCertificates().catch(err => logger.error(`Unhandled error in checkComplianceCertificates: ${err.message}`));
  });

  // Job 3: Rent Arrears Check - Daily at 9:00 AM
  cron.schedule('0 9 * * *', () => {
    checkRentArrears().catch(err => logger.error(`Unhandled error in checkRentArrears: ${err.message}`));
  });

  // Job 4: Monthly Statement Reminder - 1st of month at 7:00 AM
  cron.schedule('0 7 1 * *', () => {
    logStatementReminder();
  });

  logger.info('Background jobs scheduler initialized successfully.');
};
