import db from "../src/config/db.js";

async function run() {
  try {
    const logs = await db('audit_log')
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(20);
    console.log('AUDIT LOGS:');
    logs.forEach(l => {
      console.log(`- Time: ${l.created_at}, Actor: ${l.actor_id}, Action: ${l.action}, Meta: ${l.meta}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await db.destroy();
  }
}

run();
