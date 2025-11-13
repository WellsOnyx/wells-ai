const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.wellsmemory_DATABASE_URL ||
  'postgres://b288371bbbbb29cd267aa0ade8770d4ac1243b8a7cb697ffc39601fe023830ef:sk_Jd7l0MLiqHCr2Lu3Q9psH@db.prisma.io:5432/postgres?sslmode=require';

// Order matters - run main schema first, then others
const schemaFiles = [
  'schema.sql',           // Main schema first
  'schema-erp.sql',       // ERP tables
  'schema-slack.sql',     // Slack integration
  'schema-negotiation.sql', // Negotiation rooms
  'schema-widget.sql',    // Widget tracking
  'schema-inbox.sql',     // Inbox system
  'schema-calendar.sql',  // Calendar integration
  'schema-phase4.sql'     // Phase 4 additions
];

async function runMigration(client, filePath, fileName) {
  try {
    console.log(`\n📄 Running migration: ${fileName}`);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${fileName} - Skipping`);
      return { file: fileName, status: 'skipped', reason: 'file not found' };
    }

    const sqlContent = fs.readFileSync(filePath, 'utf8');

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const errors = [];

    // Try to run the entire file at once first
    try {
      await client.query(sqlContent);
      successCount = 1;
      console.log(`   ✅ Executed entire schema successfully`);
    } catch (error) {
      // If running the whole file fails, check if it's because tables already exist
      if (
        error.message.includes('already exists') ||
        error.code === '42P07' || // duplicate table
        error.code === '42701' || // duplicate column
        error.code === '42710'    // duplicate object
      ) {
        skipCount++;
        console.log(`   ⏭️  Schema already exists (skipped)`);
      } else {
        errorCount++;
        errors.push({
          statement: 'Full file execution',
          error: error.message.substring(0, 200)
        });
        console.log(`   ❌ Error executing full schema: ${error.message.substring(0, 100)}`);
      }
    }

    console.log(`   ✅ Success: ${successCount}, ⏭️  Skipped: ${skipCount}, ❌ Errors: ${errorCount}`);

    return {
      file: fileName,
      status: errorCount === 0 ? 'success' : 'partial',
      successCount,
      skipCount,
      errorCount,
      errors
    };
  } catch (error) {
    console.log(`   ❌ Failed to read or parse file: ${error.message}`);
    return {
      file: fileName,
      status: 'failed',
      error: error.message
    };
  }
}

async function main() {
  console.log('🚀 Wells AI Database Migration Runner\n');
  console.log('📍 Database: Prisma Postgres');
  console.log('🔗 Connection: db.prisma.io:5432\n');
  console.log('=' .repeat(60));

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    const results = [];

    for (const fileName of schemaFiles) {
      const filePath = path.join(__dirname, fileName);
      const result = await runMigration(client, filePath, fileName);
      results.push(result);
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 MIGRATION SUMMARY\n');

    let totalSuccess = 0;
    let totalPartial = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    results.forEach(result => {
      if (result.status === 'success') {
        console.log(`✅ ${result.file}: SUCCESS (${result.successCount} statements, ${result.skipCount} skipped)`);
        totalSuccess++;
      } else if (result.status === 'partial') {
        console.log(`⚠️  ${result.file}: PARTIAL (${result.successCount} success, ${result.errorCount} errors, ${result.skipCount} skipped)`);
        totalPartial++;
      } else if (result.status === 'skipped') {
        console.log(`⏭️  ${result.file}: SKIPPED (${result.reason})`);
        totalSkipped++;
      } else {
        console.log(`❌ ${result.file}: FAILED (${result.error})`);
        totalFailed++;
      }
    });

    console.log('\n' + '-'.repeat(60));
    console.log(`Total: ${totalSuccess} successful, ${totalPartial} partial, ${totalFailed} failed, ${totalSkipped} skipped`);
    console.log('=' .repeat(60) + '\n');

    // Show detailed errors if any
    const errorsExist = results.some(r => r.errors && r.errors.length > 0);
    if (errorsExist) {
      console.log('\n⚠️  DETAILED ERRORS:\n');
      results.forEach(result => {
        if (result.errors && result.errors.length > 0) {
          console.log(`${result.file}:`);
          result.errors.forEach((err, i) => {
            console.log(`  ${i + 1}. ${err.error}`);
            console.log(`     Statement: ${err.statement}...`);
          });
          console.log('');
        }
      });
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed. Migration process complete.');
  }
}

main();
