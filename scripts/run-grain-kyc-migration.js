#!/usr/bin/env node
/**
 * Run GRAIN KYC Schema Migration
 *
 * Usage: node scripts/run-grain-kyc-migration.js
 *
 * Requires: POSTGRES_URL environment variable
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Starting GRAIN KYC Schema Migration...\n');

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ POSTGRES_URL or DATABASE_URL environment variable required');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, 'schema-grain-kyc.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split into individual statements (handle $$ blocks)
    const statements = [];
    let current = '';
    let inDollarBlock = false;

    for (const line of schema.split('\n')) {
      const trimmed = line.trim();

      // Skip pure comment lines
      if (trimmed.startsWith('--') && !inDollarBlock) {
        continue;
      }

      current += line + '\n';

      // Track $$ blocks for functions
      if (trimmed.includes('$$')) {
        inDollarBlock = !inDollarBlock;
      }

      // Statement ends with ; outside of $$ blocks
      if (trimmed.endsWith(';') && !inDollarBlock) {
        const stmt = current.trim();
        if (stmt.length > 1) {
          statements.push(stmt);
        }
        current = '';
      }
    }

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Extract first meaningful line for logging
      const lines = statement.split('\n').filter(l => l.trim() && !l.trim().startsWith('--'));
      const firstLine = (lines[0] || '').substring(0, 70);

      try {
        await client.query(statement);
        console.log(`✅ [${i + 1}/${statements.length}] ${firstLine}...`);
        successCount++;
      } catch (error) {
        // Some errors are expected (e.g., IF NOT EXISTS when already exists)
        if (error.message.includes('already exists') ||
            error.message.includes('duplicate key') ||
            error.message.includes('does not exist') ||
            error.message.includes('could not create unique index')) {
          console.log(`⏭️  [${i + 1}/${statements.length}] ${firstLine}... (skipped)`);
          skipCount++;
        } else {
          console.error(`❌ [${i + 1}/${statements.length}] ${firstLine}...`);
          console.error(`   Error: ${error.message}`);
          errorCount++;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 Migration Complete!`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('='.repeat(60));

    // Verify tables were created
    console.log('\n🔍 Verifying tables...\n');

    const tables = [
      'grain_user_profiles',
      'grain_treasury_events',
      'grain_asset_holdings',
      'grain_verification_requests',
      'user_wallets'
    ];

    for (const table of tables) {
      try {
        const result = await client.query(
          `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = $1`,
          [table]
        );
        if (parseInt(result.rows[0].count) > 0) {
          // Get row count
          const countResult = await client.query(`SELECT COUNT(*) as rows FROM ${table}`);
          console.log(`   ✅ ${table} (${countResult.rows[0].rows} rows)`);
        } else {
          console.log(`   ❌ ${table} NOT FOUND`);
        }
      } catch (e) {
        console.log(`   ⚠️  ${table} - ${e.message.substring(0, 40)}`);
      }
    }

    console.log('\n✨ Migration complete!\n');

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration().catch(console.error);
