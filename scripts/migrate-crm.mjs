/**
 * CRM Schema Migration Script
 * Run with: node scripts/migrate-crm.mjs
 */

import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const POSTGRES_URL = process.env.POSTGRES_URL ||
  'postgres://b288371bbbbb29cd267aa0ade8770d4ac1243b8a7cb697ffc39601fe023830ef:sk_Jd7l0MLiqHCr2Lu3Q9psH@db.prisma.io:5432/postgres?sslmode=require'

async function migrate() {
  console.log('🚀 Starting CRM schema migration...')

  const pool = new pg.Pool({
    connectionString: POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    const schemaPath = path.join(__dirname, '..', 'lib', 'crm', 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')

    console.log('📄 Read schema file...')

    // Split into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`📝 Found ${statements.length} statements to execute...`)

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      try {
        await pool.query(stmt)
        console.log(`✅ Statement ${i + 1}/${statements.length} executed`)
      } catch (error) {
        // Skip duplicate errors for IF NOT EXISTS
        if (error.code === '42P07' || error.code === '42710') {
          console.log(`⏭️  Statement ${i + 1}: Already exists, skipping`)
        } else {
          console.error(`❌ Statement ${i + 1} failed:`, error.message)
          console.error('Statement:', stmt.substring(0, 100) + '...')
        }
      }
    }

    // Verify tables
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'crm_%'
      ORDER BY table_name
    `)

    console.log('\n📊 CRM Tables created:')
    tables.rows.forEach(row => console.log(`   - ${row.table_name}`))

    console.log('\n✅ Migration complete!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

migrate()
