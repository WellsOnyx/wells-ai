#!/usr/bin/env node
/**
 * Wells Onyx Fee System Database Migration
 *
 * Run: node scripts/migrate-fees.js
 */

const { sql } = require('@vercel/postgres')
const fs = require('fs')
const path = require('path')

async function migrate() {
  console.log('🚀 Starting Wells Onyx Fee System migration...\n')

  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, 'schema-fees.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')

    console.log('📋 Executing schema-fees.sql...')

    // Execute the schema
    await sql.query(schema)

    console.log('✅ Fee tables created successfully!\n')

    // Verify tables exist
    console.log('🔍 Verifying tables...')

    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('fees', 'fee_invoices', 'fee_splits')
      ORDER BY table_name
    `

    if (tables.rows.length === 3) {
      console.log('✅ All fee tables verified:')
      tables.rows.forEach(row => {
        console.log(`   - ${row.table_name}`)
      })
    } else {
      console.warn('⚠️  Warning: Some tables may be missing')
      console.log(`   Found ${tables.rows.length} of 3 expected tables`)
    }

    // Show table stats
    console.log('\n📊 Table Statistics:')

    const feesCount = await sql`SELECT COUNT(*) as count FROM fees`
    console.log(`   Fees: ${feesCount.rows[0].count} records`)

    const invoicesCount = await sql`SELECT COUNT(*) as count FROM fee_invoices`
    console.log(`   Invoices: ${invoicesCount.rows[0].count} records`)

    const splitsCount = await sql`SELECT COUNT(*) as count FROM fee_splits`
    console.log(`   Splits: ${splitsCount.rows[0].count} records`)

    console.log('\n✨ Migration complete!\n')
    console.log('Next steps:')
    console.log('  1. Set WELLS_TREASURY_WALLET_ADDRESS in your .env')
    console.log('  2. Test fee calculation: curl /api/fees/calculate')
    console.log('  3. Release a deal to trigger fee capture')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run migration
migrate()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
