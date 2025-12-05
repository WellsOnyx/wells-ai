/**
 * Treasury Database Migration Script
 *
 * Run this script to set up the Treasury SDK database tables
 *
 * Usage:
 *   node scripts/migrate-treasury.js
 *
 * Or with direct connection:
 *   POSTGRES_URL="your_connection_string" node scripts/migrate-treasury.js
 */

const { sql } = require('@vercel/postgres')
const fs = require('fs')
const path = require('path')

async function migrate() {
  try {
    console.log('🚀 Starting Treasury SDK database migration...\n')

    // Read the schema file
    const schemaPath = path.join(__dirname, 'schema-treasury.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')

    console.log('📖 Read schema file:', schemaPath)
    console.log('📝 Schema size:', schema.length, 'characters\n')

    // Split schema into statements (simple split on semicolons, ignoring comments)
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log('📊 Found', statements.length, 'SQL statements\n')

    // Execute each statement
    let successCount = 0
    let skipCount = 0
    let errorCount = 0

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]

      // Skip comments and empty statements
      if (!statement || statement.startsWith('--')) {
        skipCount++
        continue
      }

      // Get statement type for logging
      const statementType = statement.split(/\s+/)[0].toUpperCase()
      const tableName = extractTableName(statement)

      try {
        await sql.query(statement + ';')
        successCount++
        console.log(`✅ [${i + 1}/${statements.length}] ${statementType} ${tableName || ''}`)
      } catch (error) {
        // Some errors are expected (like "already exists")
        if (error.message.includes('already exists')) {
          console.log(`⚠️  [${i + 1}/${statements.length}] ${statementType} ${tableName || ''} - already exists (skipping)`)
          skipCount++
        } else {
          console.error(`❌ [${i + 1}/${statements.length}] ${statementType} ${tableName || ''} - Error:`, error.message)
          errorCount++
        }
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('📈 Migration Summary:')
    console.log('   ✅ Successful:', successCount)
    console.log('   ⚠️  Skipped:', skipCount)
    console.log('   ❌ Errors:', errorCount)
    console.log('='.repeat(60))

    if (errorCount > 0) {
      console.log('\n⚠️  Migration completed with errors. Please review the errors above.')
      process.exit(1)
    } else {
      console.log('\n✨ Migration completed successfully!')

      // Verify tables
      console.log('\n🔍 Verifying tables...')
      const tables = await verifyTables()
      console.log('✅ Found', tables.length, 'treasury tables:', tables.join(', '))
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  }
}

function extractTableName(statement) {
  // Try to extract table name from CREATE TABLE, CREATE INDEX, etc.
  const patterns = [
    /CREATE TABLE IF NOT EXISTS (\w+)/i,
    /CREATE TABLE (\w+)/i,
    /CREATE INDEX IF NOT EXISTS \w+ ON (\w+)/i,
    /CREATE TRIGGER \w+ (?:BEFORE|AFTER) \w+ ON (\w+)/i,
    /ALTER TABLE (\w+)/i,
  ]

  for (const pattern of patterns) {
    const match = statement.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return ''
}

async function verifyTables() {
  const result = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE 'treasury_%'
    ORDER BY table_name
  `
  return result.rows.map(row => row.table_name)
}

// Run migration
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('\n✅ Done!')
      process.exit(0)
    })
    .catch(error => {
      console.error('\n❌ Fatal error:', error)
      process.exit(1)
    })
}

module.exports = { migrate }
