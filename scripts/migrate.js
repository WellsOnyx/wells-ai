/**
 * Database migration script
 * Run with: npm run db:migrate
 */

const { sql } = require('@vercel/postgres')
const fs = require('fs')
const path = require('path')

async function migrate() {
  console.log('🚀 Starting database migration...')

  try {
    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')

    // Execute schema
    console.log('📝 Executing schema...')
    await sql.query(schema)

    console.log('✅ Migration completed successfully!')
    console.log('\n📊 Database structure:')
    console.log('  - suppliers (with indexes)')
    console.log('  - rfqs')
    console.log('  - quotes')
    console.log('  - deals')
    console.log('  - conversations')
    console.log('  - analytics_events')
    console.log('  - gtm_prospects')
    console.log('  - gtm_outreach')
    console.log('  - performance_metrics')
    console.log('\n📈 Views created:')
    console.log('  - daily_metrics (materialized)')
    console.log('  - supplier_performance')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

migrate()
