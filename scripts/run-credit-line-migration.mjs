/**
 * Credit Line Model Migration
 *
 * Run this to set up the credit line schema:
 * POSTGRES_URL="..." node scripts/run-credit-line-migration.mjs
 */

import { readFileSync } from 'fs'
import { Client } from 'pg'

const POSTGRES_URL = process.env.POSTGRES_URL

if (!POSTGRES_URL) {
  console.error('Error: POSTGRES_URL environment variable is required')
  process.exit(1)
}

async function runMigration() {
  const client = new Client({
    connectionString: POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    console.log('Connecting to database...')
    await client.connect()
    console.log('Connected!')

    // Read the schema file
    const schemaPath = new URL('./schema-credit-line.sql', import.meta.url)
    const schema = readFileSync(schemaPath, 'utf8')

    console.log('\nRunning credit line migration...')
    console.log('This will create:')
    console.log('  - credit_line_positions')
    console.log('  - credit_line_transactions')
    console.log('  - revenue_ledgers')
    console.log('  - revenue_allocations')
    console.log('  - founder_ledgers')
    console.log('  - founder_annuity_transactions')
    console.log('  - real_assets')
    console.log('  - asset_valuations')
    console.log('  - asset_documents')
    console.log('  - asset_income')
    console.log('  - Views and functions')
    console.log('')

    await client.query(schema)

    console.log('Migration completed successfully!')

    // Verify tables were created
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'credit_line_positions',
        'credit_line_transactions',
        'revenue_ledgers',
        'revenue_allocations',
        'founder_ledgers',
        'founder_annuity_transactions',
        'real_assets',
        'asset_valuations',
        'asset_documents',
        'asset_income'
      )
      ORDER BY table_name
    `)

    console.log('\nCreated tables:')
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`)
    })

    // Check revenue ledgers were initialized
    const ledgers = await client.query(`SELECT ledger_type, balance FROM revenue_ledgers`)
    console.log('\nRevenue ledgers initialized:')
    ledgers.rows.forEach(row => {
      console.log(`  - ${row.ledger_type}: $${row.balance}`)
    })

    // Check founder ledgers were initialized
    const founders = await client.query(`SELECT founder_id, display_name, annuity_balance FROM founder_ledgers`)
    console.log('\nFounder ledgers initialized:')
    founders.rows.forEach(row => {
      console.log(`  - ${row.display_name} (${row.founder_id}): $${row.annuity_balance}`)
    })

    console.log('\nCredit Line Model is ready!')
    console.log('\nAPI Endpoints:')
    console.log('  GET  /api/grain/credit-line?userId=xxx - Get position')
    console.log('  POST /api/grain/credit-line           - Deposit/spend/repay/withdraw')
    console.log('  GET  /api/grain/revenue               - Revenue ledgers')
    console.log('  GET  /api/grain/assets                - Real assets')

  } catch (error) {
    console.error('Migration failed:', error.message)
    if (error.detail) {
      console.error('Details:', error.detail)
    }
    process.exit(1)
  } finally {
    await client.end()
  }
}

runMigration()
