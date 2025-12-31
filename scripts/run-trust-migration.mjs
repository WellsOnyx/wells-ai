/**
 * Trust Schema Migration Script
 * Run with: node scripts/run-trust-migration.mjs
 *
 * For Prisma Accelerate databases, use the direct Neon connection
 */

import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function runMigration() {
  console.log('Starting trust schema migration...')

  // Read the SQL file
  const sqlPath = path.join(__dirname, 'schema-trust.sql')
  const sql = fs.readFileSync(sqlPath, 'utf-8')

  // Split into statements (simple split, handles most cases)
  const statements = sql
    .split(/;[\s]*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`Found ${statements.length} SQL statements to execute`)

  // Try multiple connection options
  const connectionString = process.env.POSTGRES_URL_NON_POOLING
    || process.env.DIRECT_DATABASE_URL
    || process.env.DATABASE_URL_DIRECT
    || process.env.POSTGRES_URL

  if (!connectionString) {
    throw new Error('No database connection string found')
  }

  // Prisma Accelerate URLs won't work with pg directly - need direct Neon URL
  if (connectionString.includes('prisma.io') || connectionString.includes('accelerate')) {
    console.log('Note: Prisma Accelerate URL detected.')
    console.log('For migrations, you need a direct database connection URL.')
    console.log('You can run migrations via the Vercel dashboard or Prisma Studio.')
    console.log('\nAlternatively, set POSTGRES_URL_NON_POOLING to your direct Neon connection.')
    process.exit(1)
  }

  console.log('Connecting to database...')
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('Connected!')

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]

    // Skip empty or comment-only statements
    if (!statement || statement.startsWith('--')) continue

    try {
      await client.query(statement)
      successCount++

      // Log progress for important statements
      if (statement.includes('CREATE TABLE')) {
        const tableName = statement.match(/CREATE TABLE[^(]+(\w+)/i)?.[1] || 'unknown'
        console.log(`✓ Created table: ${tableName}`)
      } else if (statement.includes('CREATE INDEX')) {
        console.log(`✓ Created index ${i + 1}`)
      } else if (statement.includes('CREATE OR REPLACE VIEW')) {
        const viewName = statement.match(/VIEW\s+(\w+)/i)?.[1] || 'unknown'
        console.log(`✓ Created view: ${viewName}`)
      } else if (statement.includes('INSERT INTO')) {
        console.log(`✓ Inserted seed data`)
      }
    } catch (error) {
      // Ignore "already exists" errors
      if (error.message?.includes('already exists')) {
        console.log(`⊘ Already exists (skipped)`)
      } else {
        console.error(`✗ Error on statement ${i + 1}:`, error.message)
        errorCount++
      }
    }
  }

  await client.end()

  console.log('\n=== Migration Complete ===')
  console.log(`Successful: ${successCount}`)
  console.log(`Errors: ${errorCount}`)

  // Verify tables were created
  const verifyClient = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
  await verifyClient.connect()

  const tables = await verifyClient.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name LIKE 'trust%'
    ORDER BY table_name
  `)

  console.log('\nTrust tables in database:')
  tables.rows.forEach(row => {
    console.log(`  - ${row.table_name}`)
  })

  await verifyClient.end()
}

runMigration().catch(console.error)
