/**
 * Run full Grain & Vault migration
 * Creates all necessary tables for treasury operations
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  // Use the same connection string as Vercel
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('ERROR: No database connection string found');
    console.error('Set POSTGRES_URL or DATABASE_URL environment variable');
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected!');

    // Run the base schema first
    console.log('\n=== Running base Grain & Vault schema ===');
    const baseSchema = fs.readFileSync(
      path.join(__dirname, 'schema-grain-vault.sql'),
      'utf8'
    );
    await client.query(baseSchema);
    console.log('Base schema complete!');

    // Then run the Circle additions
    console.log('\n=== Running Circle integration schema ===');
    const circleSchema = fs.readFileSync(
      path.join(__dirname, 'run-in-vercel-dashboard.sql'),
      'utf8'
    );
    await client.query(circleSchema);
    console.log('Circle schema complete!');

    // Verify tables exist
    console.log('\n=== Verifying tables ===');
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'treasury_accounts', 
        'grain_transactions', 
        'deposit_sessions',
        'withdrawal_requests',
        'payment_audit_log',
        'circle_webhook_events'
      )
      ORDER BY table_name
    `);
    console.log('Tables found:', result.rows.map(r => r.table_name).join(', '));

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('Migration error:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
