const { Client } = require('pg');
const fs = require('fs');

async function migrate() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();
  console.log('Connected to database');
  console.log('');
  console.log('='.repeat(70));
  console.log('INVOICE FINANCING ENGINE');
  console.log('"Get Paid Today. Pay Later. Everyone Wins."');
  console.log('='.repeat(70));
  console.log('');

  const schemaFile = fs.readFileSync('scripts/schema-invoice-financing.sql', 'utf8');

  const statements = [];
  let current = '';
  let inFunction = false;

  const lines = schemaFile.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('--') && !current.trim()) continue;
    current += line + '\n';

    if (line.includes('$$ LANGUAGE') || line.includes('$$;')) {
      inFunction = false;
      statements.push(current.trim());
      current = '';
    } else if (line.includes('AS $$')) {
      inFunction = true;
    } else if (!inFunction && line.trim().endsWith(';') && current.trim()) {
      statements.push(current.trim());
      current = '';
    }
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  console.log(`Found ${statements.length} statements to execute\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt || stmt.length < 5) continue;

    const firstLine = stmt.split('\n').find(l => l.trim() && !l.trim().startsWith('--')) || '';
    const desc = firstLine.substring(0, 60);

    try {
      await client.query(stmt);
      console.log(`✓ ${i + 1}/${statements.length}: ${desc}...`);
      success++;
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate key')) {
        console.log(`⊘ ${i + 1}/${statements.length}: Already exists`);
        skipped++;
      } else if (err.message.includes('does not exist') && stmt.includes('DROP')) {
        console.log(`⊘ ${i + 1}/${statements.length}: Nothing to drop`);
        skipped++;
      } else {
        console.error(`✗ ${i + 1}/${statements.length}: ${err.message.substring(0, 80)}`);
        failed++;
      }
    }
  }

  console.log(`\nResults: ${success} success, ${skipped} skipped, ${failed} failed\n`);

  // Verify
  console.log('='.repeat(70));
  console.log('VERIFICATION');
  console.log('='.repeat(70));

  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND (
      table_name LIKE 'financing_%'
      OR table_name LIKE 'financeable_%'
      OR table_name LIKE 'early_payment_%'
      OR table_name LIKE 'discount_%'
    )
    ORDER BY table_name
  `);

  console.log('\n📊 Invoice Financing Tables:');
  tables.rows.forEach(row => console.log('  -', row.table_name));

  // Check functions
  try {
    const funcs = await client.query(`
      SELECT routine_name FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND (
        routine_name LIKE 'request_%financing%'
        OR routine_name LIKE 'fund_%'
        OR routine_name LIKE 'generate_early_%'
        OR routine_name LIKE 'accept_early_%'
      )
      ORDER BY routine_name
    `);
    console.log('\n⚡ Financing Functions:');
    funcs.rows.forEach(f => console.log('  -', f.routine_name));
  } catch (e) {
    console.log('\n⚠ Could not list functions:', e.message);
  }

  // Check views
  try {
    const views = await client.query(`
      SELECT table_name FROM information_schema.views
      WHERE table_schema = 'public'
      AND (
        table_name LIKE 'financing_%'
        OR table_name LIKE 'supplier_financing_%'
        OR table_name LIKE 'buyer_financing_%'
        OR table_name LIKE 'daily_financing_%'
        OR table_name LIKE 'early_payment_%'
      )
      ORDER BY table_name
    `);
    console.log('\n👁 Financing Views:');
    views.rows.forEach(v => console.log('  -', v.table_name));
  } catch (e) {
    console.log('\n⚠ Could not list views:', e.message);
  }

  await client.end();

  console.log('\n' + '='.repeat(70));
  console.log('✓ INVOICE FINANCING ENGINE MIGRATION COMPLETE!');
  console.log('');
  console.log('THE ECONOMICS:');
  console.log('');
  console.log('  $100K Invoice, NET60:');
  console.log('  Day 0: Supplier gets $97K (2% discount + 1% reserve)');
  console.log('  Day 0: Wells earns $2K, holds $1K reserve');
  console.log('  Day 60: Buyer pays $100K → Wells releases reserve');
  console.log('');
  console.log('  OR with Dynamic Discounting:');
  console.log('  Day 10: Buyer pays $98K, saves 2%, earns GRAIN');
  console.log('  Day 10: Supplier gets $98K faster');
  console.log('  Day 10: Wells saves cost of capital');
  console.log('');
  console.log('  EVERYONE WINS.');
  console.log('='.repeat(70));
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
