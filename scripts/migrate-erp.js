// ERP Integration Migration Script
// Run this to set up the ERP intercept tables

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('Starting ERP integration migration...');

  try {
    // Read SQL schema file
    const schemaPath = path.join(__dirname, 'schema-erp-connections.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Execute schema
    console.log('Creating tables...');
    await sql(schema);

    console.log('✓ ERP integration tables created successfully');

    // Verify tables exist
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'erp_%'
      ORDER BY table_name
    `;

    console.log('\nCreated tables:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));

    console.log('\n✓ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Set up QuickBooks app at: https://developer.intuit.com/');
    console.log('2. Set up Xero app at: https://developer.xero.com/');
    console.log('3. Set up Codat account at: https://www.codat.io/');
    console.log('4. Add credentials to .env.local');
    console.log('5. Visit /erp/connect to start connecting ERPs');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
