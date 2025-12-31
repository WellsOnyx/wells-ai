// Run the unified payments schema migration using pg directly
import pg from 'pg';
import { readFileSync } from 'fs';

const { Client } = pg;

async function runMigration() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('No database connection string provided');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to database');

  const schema = readFileSync('./scripts/schema-unified-payments.sql', 'utf8');

  // Split by statement - handles multi-line and functions
  const statements = [];
  let current = '';
  let inFunction = false;

  for (const line of schema.split('\n')) {
    current += line + '\n';

    if (line.includes('$$ LANGUAGE')) {
      inFunction = false;
    }
    if (line.includes('AS $$')) {
      inFunction = true;
    }

    if (!inFunction && line.trim().endsWith(';') && !line.trim().startsWith('--')) {
      statements.push(current.trim());
      current = '';
    }
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  console.log(`Found ${statements.length} statements to execute`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt || stmt.startsWith('--')) {
      skipped++;
      continue;
    }

    try {
      await client.query(stmt);
      success++;
      process.stdout.write('.');
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        success++;
        process.stdout.write('s');
      } else if (err.message.includes('does not exist') && stmt.includes('DROP')) {
        skipped++;
        process.stdout.write('-');
      } else {
        console.log(`\n\nError in statement ${i + 1}:`);
        console.log(stmt.substring(0, 200) + '...');
        console.log('Error:', err.message);
        failed++;
      }
    }
  }

  await client.end();

  console.log(`\n\nMigration complete:`);
  console.log(`  Success: ${success}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed:  ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
