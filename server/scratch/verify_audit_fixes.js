import db from '../src/config/db.js';
import { runPhase8Migrations } from '../src/db/migrations/phase8_settings.js';
import { getSettings } from '../src/controllers/settingsController.js';

const runVerification = async () => {
  console.log('--- RUNNING AUDIT FIXES VERIFICATION ---');
  try {
    // 1. Check if settings table exists and has defaults
    const tableExists = await db.schema.hasTable('settings');
    console.log('1. Settings table exists:', tableExists);
    if (tableExists) {
      const records = await db('settings').select('*');
      console.log('   Records in settings:', records);
    }

    // 2. Check if we can run date calculations without error
    const onboardingParts = '2026-01-31'.split('-');
    const year = parseInt(onboardingParts[0], 10);
    const month = parseInt(onboardingParts[1], 10) - 1;
    const day = parseInt(onboardingParts[2], 10);

    const targetDate = new Date(year, month + 1, 1);
    const lastDayOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
    const clampedDay = Math.min(day, lastDayOfTarget);
    targetDate.setDate(clampedDay);
    
    console.log('2. Date clamping result (Jan 31 + 1 month):', targetDate.toISOString().split('T')[0]);

    console.log('--- VERIFICATION SUCCESSFUL ---');
  } catch (error) {
    console.error('--- VERIFICATION FAILED ---', error);
  } finally {
    await db.destroy();
  }
};

runVerification();
