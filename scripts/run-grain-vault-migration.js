/**
 * Run Grain & Vault Circle Migration
 * Adds Circle payment columns and tables
 */

const { sql } = require('@vercel/postgres');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('Running Grain & Vault Circle migration...\n');

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'schema-grain-vault-circle.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Split by semicolons and filter out empty statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments-only statements
      if (statement.split('\n').every(line => line.trim().startsWith('--') || line.trim() === '')) {
        continue;
      }

      try {
        await sql.query(statement);
        successCount++;

        // Log progress for significant statements
        if (statement.includes('CREATE TABLE')) {
          const tableName = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)?.[1];
          console.log(`✓ Created table: ${tableName || 'unknown'}`);
        } else if (statement.includes('ALTER TABLE')) {
          console.log(`✓ Altered table`);
        } else if (statement.includes('CREATE INDEX')) {
          console.log(`✓ Created index`);
        } else if (statement.includes('CREATE OR REPLACE FUNCTION')) {
          const funcName = statement.match(/CREATE OR REPLACE FUNCTION (\w+)/i)?.[1];
          console.log(`✓ Created function: ${funcName || 'unknown'}`);
        }
      } catch (error) {
        // Some errors are expected (like "already exists")
        if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
          console.log(`○ Skipped (already exists)`);
        } else {
          console.error(`✗ Error: ${error.message}`);
          errorCount++;
        }
      }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`Migration complete!`);
    console.log(`  ✓ Successful: ${successCount}`);
    console.log(`  ✗ Errors: ${errorCount}`);
    console.log(`${'='.repeat(50)}\n`);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
