import db from '../src/config/db.js';
import { runPhase11Migrations } from '../src/db/migrations/phase11_unique_references.js';

const check = async () => {
  try {
    console.log('Running Phase 11 migrations manually for test...');
    await runPhase11Migrations();

    console.log('\n--- Properties ---');
    const props = await db('properties').select('id', 'name', 'property_reference', 'address_line1');
    console.log(props);

    console.log('\n--- Documents ---');
    const docs = await db('documents').select('id', 'filename', 'doc_reference').limit(5);
    console.log(docs);

    console.log('\n--- Statements ---');
    const stmts = await db('landlord_statements').select('id', 'statement_number', 'statement_reference').limit(5);
    console.log(stmts);

  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await db.destroy();
  }
};

check();
