#!/usr/bin/env node
/**
 * WORKER EOR MIGRATION
 *
 * Run the Worker EOR schema migration.
 * This creates the infrastructure for:
 * - Workers working THROUGH Wells
 * - Getting PAID through Wells
 * - GRAIN rewards on every payment
 * - The conduit for post-AI workforce
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ Connected to database');

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'schema-worker-eor.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split into statements
    const statements = sql
      .split(/;[\s]*$/m)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`\nExecuting ${statements.length} statements...\n`);

    let success = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.substring(0, 80).replace(/\n/g, ' ');

      try {
        await client.query(stmt);
        console.log(`✓ [${i + 1}/${statements.length}] ${preview}...`);
        success++;
      } catch (e) {
        if (e.message.includes('already exists') ||
            e.message.includes('duplicate key') ||
            e.message.includes('does not exist') && stmt.includes('DROP')) {
          console.log(`⊘ [${i + 1}/${statements.length}] Skipped (already exists): ${preview}...`);
          skipped++;
        } else {
          console.error(`✗ [${i + 1}/${statements.length}] FAILED: ${e.message}`);
          console.error(`   Statement: ${preview}...`);
          failed++;
        }
      }
    }

    console.log('\n========================================');
    console.log('WORKER EOR MIGRATION COMPLETE');
    console.log('========================================');
    console.log(`✓ Success: ${success}`);
    console.log(`⊘ Skipped: ${skipped}`);
    console.log(`✗ Failed: ${failed}`);
    console.log('========================================\n');

    // Verify tables created
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (
        table_name LIKE 'worker%' OR
        table_name LIKE 'eor_%' OR
        table_name LIKE 'journey_%'
      )
      ORDER BY table_name
    `);

    console.log('Worker EOR Tables:');
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // Verify functions created
    const functions = await client.query(`
      SELECT routine_name FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_type = 'FUNCTION'
      AND (
        routine_name LIKE '%worker%' OR
        routine_name LIKE '%skill%' OR
        routine_name LIKE '%rate%' OR
        routine_name LIKE '%experience%' OR
        routine_name LIKE '%match%' OR
        routine_name LIKE '%profile%'
      )
      ORDER BY routine_name
    `);

    console.log('\nWorker EOR Functions:');
    functions.rows.forEach(row => {
      console.log(`  - ${row.routine_name}()`);
    });

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✓ Database connection closed');
  }
}

migrate();
