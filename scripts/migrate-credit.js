/**
 * Credit Underwriting Migration Script
 * Run: node scripts/migrate-credit.js
 */

const { sql } = require('@vercel/postgres');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Starting Wells AI Credit Underwriting Migration...\n');

  try {
    // Read the SQL schema file
    const schemaPath = path.join(__dirname, 'schema-credit-underwriting.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('📄 Found schema file: schema-credit-underwriting.sql');

    // Split into individual statements (by semicolon)
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Extract table/view name for logging
      const match = statement.match(/CREATE TABLE.*?(\w+)\s*\(/i) ||
                    statement.match(/CREATE.*?VIEW\s+(\w+)/i) ||
                    statement.match(/CREATE INDEX.*?ON\s+(\w+)/i);

      const objectName = match ? match[1] : `Statement ${i + 1}`;

      try {
        console.log(`  ⏳ Creating ${objectName}...`);
        await sql.query(statement);
        console.log(`  ✅ ${objectName} created successfully`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`  ⚠️  ${objectName} already exists, skipping`);
        } else {
          console.error(`  ❌ Error creating ${objectName}:`, error.message);
          throw error;
        }
      }
    }

    console.log('\n✅ Migration completed successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...\n');

    const tables = [
      'credit_applications',
      'underwriting_data',
      'credit_lines',
      'credit_draws',
      'credit_payments',
      'credit_transactions',
      'payment_intercepts',
      'credit_alerts'
    ];

    for (const table of tables) {
      try {
        const result = await sql.query(`
          SELECT COUNT(*) as count
          FROM information_schema.tables
          WHERE table_name = '${table}'
        `);

        if (result.rows[0].count > 0) {
          console.log(`  ✅ ${table}`);
        } else {
          console.log(`  ❌ ${table} not found`);
        }
      } catch (error) {
        console.log(`  ❌ Error checking ${table}:`, error.message);
      }
    }

    console.log('\n🎉 Credit Underwriting System is ready!\n');
    console.log('Next steps:');
    console.log('  1. Configure Plaid credentials in .env.local');
    console.log('  2. Configure Codat credentials (optional)');
    console.log('  3. Run: npm run dev');
    console.log('  4. Visit: http://localhost:3000/credit/apply\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration
runMigration();
