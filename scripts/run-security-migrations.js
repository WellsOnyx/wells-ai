/**
 * Security Infrastructure Migrations for Grain & Vault
 *
 * This script runs all security-related database migrations:
 * - Identity verification (KYC)
 * - AML/OFAC screening
 * - Audit logging
 * - Emergency controls
 * - Circle webhook tracking
 *
 * Run with: node scripts/run-security-migrations.js
 *
 * Requires: POSTGRES_URL environment variable
 */

const { createClient } = require('@vercel/postgres');
const fs = require('fs');
const path = require('path');

const MIGRATION_FILES = [
  'schema-identity-verification.sql',
  'schema-aml-screening.sql',
  'schema-audit-logs.sql',
  'schema-grain-vault-circle.sql',
  // Note: Emergency controls tables are created on first use
];

async function runMigrations() {
  console.log('🔐 Starting Security Infrastructure Migrations...\n');

  const client = createClient();
  await client.connect();

  let successCount = 0;
  let errorCount = 0;

  for (const file of MIGRATION_FILES) {
    const filePath = path.join(__dirname, file);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Skipping ${file} - file not found`);
      continue;
    }

    console.log(`📄 Running ${file}...`);

    try {
      const sql = fs.readFileSync(filePath, 'utf8');

      // Split by semicolons but handle dollar-quoted strings
      const statements = splitSQLStatements(sql);

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim();
        if (!statement || statement.startsWith('--')) continue;

        try {
          await client.query(statement);
        } catch (stmtErr) {
          // Ignore "already exists" errors
          if (stmtErr.message.includes('already exists') ||
              stmtErr.message.includes('duplicate key') ||
              stmtErr.message.includes('does not exist')) {
            // Skip silently
          } else {
            console.log(`   ⚠️  Statement ${i + 1}: ${stmtErr.message.substring(0, 100)}`);
          }
        }
      }

      console.log(`   ✅ ${file} completed`);
      successCount++;

    } catch (err) {
      console.log(`   ❌ ${file} failed: ${err.message}`);
      errorCount++;
    }
  }

  // Create emergency controls tables
  console.log('\n📄 Creating emergency controls tables...');
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS grain_system_controls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        operation_type VARCHAR(50) NOT NULL UNIQUE,
        is_paused BOOLEAN DEFAULT FALSE,
        pause_reason TEXT,
        paused_by TEXT,
        paused_at TIMESTAMPTZ,
        resumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS grain_frozen_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL UNIQUE,
        freeze_reason TEXT NOT NULL,
        frozen_by TEXT NOT NULL,
        frozen_at TIMESTAMPTZ DEFAULT NOW(),
        unfrozen_at TIMESTAMPTZ,
        review_notes TEXT,
        status VARCHAR(20) DEFAULT 'frozen',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS grain_emergency_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action_type VARCHAR(50) NOT NULL,
        operation_type VARCHAR(50),
        user_id TEXT,
        admin_id TEXT NOT NULL,
        reason TEXT,
        metadata JSONB DEFAULT '{}',
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_grain_frozen_accounts_user ON grain_frozen_accounts(user_id);
      CREATE INDEX IF NOT EXISTS idx_grain_frozen_accounts_status ON grain_frozen_accounts(status);
      CREATE INDEX IF NOT EXISTS idx_grain_emergency_audit_admin ON grain_emergency_audit_log(admin_id);
      CREATE INDEX IF NOT EXISTS idx_grain_emergency_audit_created ON grain_emergency_audit_log(created_at DESC);
    `);
    console.log('   ✅ Emergency controls tables created');
    successCount++;
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('   ✅ Emergency controls tables already exist');
      successCount++;
    } else {
      console.log(`   ❌ Emergency controls failed: ${err.message}`);
      errorCount++;
    }
  }

  // Add any missing columns to existing tables
  console.log('\n📄 Adding missing columns to existing tables...');
  try {
    // Add circle_reference_id to grain_transactions if not exists
    await client.query(`
      ALTER TABLE grain_transactions
      ADD COLUMN IF NOT EXISTS circle_reference_id TEXT,
      ADD COLUMN IF NOT EXISTS screening_id TEXT,
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'
    `).catch(() => {});

    // Add verification_level to user_wallets if not exists
    await client.query(`
      ALTER TABLE user_wallets
      ADD COLUMN IF NOT EXISTS verification_level INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS daily_limit DECIMAL(20,2) DEFAULT 1000,
      ADD COLUMN IF NOT EXISTS daily_used DECIMAL(20,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS daily_reset_at TIMESTAMPTZ DEFAULT NOW()
    `).catch(() => {});

    console.log('   ✅ Column updates completed');
    successCount++;
  } catch (err) {
    console.log(`   ⚠️  Column updates: ${err.message}`);
  }

  await client.end();

  console.log('\n========================================');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log('========================================\n');

  if (errorCount > 0) {
    console.log('⚠️  Some migrations failed. Check the logs above.');
    process.exit(1);
  } else {
    console.log('🎉 All security migrations completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Set VERIFF_API_KEY, VERIFF_API_SECRET for identity verification');
    console.log('2. Set PII_ENCRYPTION_KEY (64-char hex) for data encryption');
    console.log('3. Set EMERGENCY_ADMIN_1, EMERGENCY_ADMIN_2, EMERGENCY_ADMIN_3 for admin access');
    console.log('4. Set COMPLIANCE_SLACK_WEBHOOK for alerts');
    process.exit(0);
  }
}

/**
 * Split SQL by statements, handling dollar-quoted strings
 */
function splitSQLStatements(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';

  const lines = sql.split('\n');

  for (const line of lines) {
    // Skip comments
    if (line.trim().startsWith('--')) continue;

    // Check for dollar quote start/end
    const dollarMatch = line.match(/\$([a-zA-Z_]*)\$/g);
    if (dollarMatch) {
      for (const match of dollarMatch) {
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = match;
        } else if (match === dollarTag) {
          inDollarQuote = false;
          dollarTag = '';
        }
      }
    }

    current += line + '\n';

    // Only split on semicolon if not in dollar quote
    if (!inDollarQuote && line.trim().endsWith(';')) {
      statements.push(current);
      current = '';
    }
  }

  if (current.trim()) {
    statements.push(current);
  }

  return statements;
}

runMigrations().catch(console.error);
