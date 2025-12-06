const { Client } = require('pg');
const fs = require('fs');

async function migrate() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();
  console.log('Connected to database');

  const schema = fs.readFileSync('scripts/schema-referrals.sql', 'utf8');

  // Execute the whole schema at once (PostgreSQL handles multiple statements)
  try {
    await client.query(schema);
    console.log('✓ Referral schema created successfully!');
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log('⊘ Tables already exist, skipping...');
    } else {
      console.error('✗ Error:', e.message);

      // Try running individual statements for better error handling
      console.log('\nTrying individual statements...');
      const statements = schema.split(';').filter(s => s.trim().length > 10);

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i].trim();
        if (!stmt || stmt.startsWith('--')) continue;

        try {
          await client.query(stmt);
          console.log(`✓ Statement ${i + 1} executed`);
        } catch (err) {
          if (err.message.includes('already exists')) {
            console.log(`⊘ Statement ${i + 1}: already exists`);
          } else {
            console.error(`✗ Statement ${i + 1} failed:`, err.message.substring(0, 100));
          }
        }
      }
    }
  }

  // Verify tables were created
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name LIKE 'referral%'
  `);

  console.log('\nReferral tables in database:');
  tables.rows.forEach(row => console.log('  -', row.table_name));

  await client.end();
  console.log('\nMigration complete!');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
