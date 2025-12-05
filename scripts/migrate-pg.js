/**
 * Treasury Database Migration Script (using pg directly)
 *
 * Run with: node scripts/migrate-pg.js
 */

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// Load .env.local
require('dotenv').config({ path: '.env.local' })

async function migrate() {
  const connectionString = process.env.POSTGRES_URL || process.env.wellsmemory_POSTGRES_URL || process.env.DATABASE_URL

  if (!connectionString || connectionString.includes('placeholder')) {
    console.error('❌ No valid database connection string found')
    console.log('Set POSTGRES_URL environment variable or add to .env.local')
    process.exit(1)
  }

  console.log('🔌 Connecting to database...')

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  })

  try {
    console.log('🚀 Starting Treasury SDK database migration...\n')

    // Read the schema file
    const schemaPath = path.join(__dirname, 'schema-treasury.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')

    console.log('📖 Read schema file:', schemaPath)
    console.log('📝 Schema size:', schema.length, 'characters\n')

    // Execute the entire schema as one transaction
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      // Split by double newlines to get logical statements
      // But execute CREATE TABLE statements individually
      const statements = schema
        .split(/;\s*\n/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      console.log('📊 Found', statements.length, 'SQL statements\n')

      let successCount = 0
      let skipCount = 0
      let errorCount = 0

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]

        if (!statement || statement.startsWith('--')) {
          skipCount++
          continue
        }

        const statementType = statement.split(/\s+/)[0].toUpperCase()

        try {
          await client.query(statement + ';')
          successCount++
          const preview = statement.substring(0, 60).replace(/\n/g, ' ')
          console.log(`✅ [${i + 1}/${statements.length}] ${preview}...`)
        } catch (error) {
          if (error.message.includes('already exists')) {
            skipCount++
            console.log(`⚠️  [${i + 1}/${statements.length}] Already exists (skipping)`)
          } else {
            console.error(`❌ [${i + 1}/${statements.length}] Error:`, error.message)
            errorCount++
          }
        }
      }

      await client.query('COMMIT')

      console.log('\n' + '='.repeat(60))
      console.log('📈 Migration Summary:')
      console.log('   ✅ Successful:', successCount)
      console.log('   ⚠️  Skipped:', skipCount)
      console.log('   ❌ Errors:', errorCount)
      console.log('='.repeat(60))

      // Verify tables
      console.log('\n🔍 Verifying tables...')
      const result = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name LIKE 'treasury_%'
        ORDER BY table_name
      `)
      const tables = result.rows.map(r => r.table_name)
      console.log('✅ Found', tables.length, 'treasury tables:', tables.join(', '))

    } finally {
      client.release()
    }

    console.log('\n✨ Migration completed!')

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

migrate()
