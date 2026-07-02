import db from '../src/config/db.js';

async function check() {
  try {
    const hasColumn = await db.schema.hasColumn('landlord_profiles', 'landlord_reference');
    console.log('Has landlord_reference column:', hasColumn);

    if (hasColumn) {
      const records = await db('landlord_profiles').select('id', 'user_id', 'landlord_reference').limit(5);
      console.log('Sample landlord records:', records);
    }
  } catch (err) {
    console.error('Error checking DB:', err);
  } finally {
    await db.destroy();
  }
}

check();
