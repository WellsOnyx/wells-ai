/**
 * Run Supplier Database Migration
 *
 * Sets up:
 * - NAICS codes reference table
 * - SIC codes reference table
 * - Supplier table extensions (industry codes, diversity, outreach tracking)
 * - Campaign and invite tracking tables
 */

import { readFileSync } from 'fs'
import { Client } from 'pg'

async function runMigration() {
  const connectionString = process.env.POSTGRES_URL

  if (!connectionString) {
    console.error('ERROR: POSTGRES_URL environment variable is required')
    console.log('Set it like: POSTGRES_URL="postgres://..." node scripts/run-supplier-migration.mjs')
    process.exit(1)
  }

  const client = new Client({ connectionString })

  try {
    console.log('Connecting to database...')
    await client.connect()
    console.log('Connected!')

    // Read and execute the SQL file
    const sqlPath = new URL('./schema-industry-codes.sql', import.meta.url).pathname
    console.log(`Reading migration file: ${sqlPath}`)

    const sql = readFileSync(sqlPath, 'utf8')

    console.log('Running migration...')
    await client.query(sql)

    console.log('Migration completed successfully!')

    // Verify tables exist
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('naics_codes', 'sic_codes', 'supplier_campaigns', 'supplier_invites', 'supplier_outreach_log')
    `)

    console.log('\nTables created/verified:')
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`)
    })

    // Count NAICS codes
    const naicsCount = await client.query('SELECT COUNT(*) FROM naics_codes')
    console.log(`\nNAICS codes loaded: ${naicsCount.rows[0].count}`)

    // Count SIC codes
    const sicCount = await client.query('SELECT COUNT(*) FROM sic_codes')
    console.log(`SIC codes loaded: ${sicCount.rows[0].count}`)

  } catch (error) {
    console.error('Migration failed:', error.message)
    if (error.detail) console.error('Detail:', error.detail)
    process.exit(1)
  } finally {
    await client.end()
    console.log('\nDatabase connection closed.')
  }
}

runMigration()
