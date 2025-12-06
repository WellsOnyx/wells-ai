const { Client } = require('pg');
const fs = require('fs');

async function migrate() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();
  console.log('Connected to database');
  console.log('');
  console.log('='.repeat(60));
  console.log('GRAIN EXTERNAL LEDGER MIGRATION');
  console.log('Hard Asset-Backed Appreciating Stablecoin');
  console.log('='.repeat(60));
  console.log('');

  // Read the schema and split by $$ delimiters for proper function handling
  const schemaFile = fs.readFileSync('scripts/schema-grain-external.sql', 'utf8');

  // Split by CREATE statements, keeping functions together
  const statements = [];
  let current = '';
  let inFunction = false;

  const lines = schemaFile.split('\n');
  for (const line of lines) {
    // Skip pure comments at start
    if (line.trim().startsWith('--') && !current.trim()) continue;

    current += line + '\n';

    // Check if we're entering a function
    if (line.includes('$$ LANGUAGE') || line.includes('$$;')) {
      inFunction = false;
      statements.push(current.trim());
      current = '';
    } else if (line.includes('AS $$')) {
      inFunction = true;
    } else if (!inFunction && line.trim().endsWith(';') && current.trim()) {
      // Regular statement ends
      statements.push(current.trim());
      current = '';
    }
  }

  // Add any remaining
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

    // Get first line for description
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

  // Verify tables were created
  console.log('='.repeat(60));
  console.log('VERIFICATION');
  console.log('='.repeat(60));

  // GRAIN token tables
  const grainTables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name LIKE 'grain_%'
    ORDER BY table_name
  `);

  console.log('\n📦 GRAIN External Tables:');
  grainTables.rows.forEach(row => console.log('  -', row.table_name));

  // Hard asset tables
  console.log('\n🏭 Hard Asset Tables:');
  const assetTables = ['grain_asset_categories', 'grain_hard_assets', 'grain_asset_valuations', 'grain_asset_income', 'grain_asset_investments'];
  for (const table of assetTables) {
    const exists = grainTables.rows.some(r => r.table_name === table);
    console.log(`  ${exists ? '✓' : '✗'} ${table}`);
  }

  // Show asset categories
  try {
    const categories = await client.query(`SELECT id, name, target_allocation_pct FROM grain_asset_categories ORDER BY target_allocation_pct DESC`);
    console.log('\n📊 Asset Categories:');
    categories.rows.forEach(c => console.log(`  - ${c.name} (${c.id}): ${c.target_allocation_pct}% target`));
  } catch (e) {
    console.log('\n⚠ Could not fetch categories:', e.message);
  }

  // Show token state
  try {
    const token = await client.query(`SELECT * FROM grain_token WHERE id = 1`);
    if (token.rows.length > 0) {
      const t = token.rows[0];
      console.log('\n💎 GRAIN Token State:');
      console.log(`  Supply: ${t.circulating_supply} GRAIN`);
      console.log(`  Price: $${t.current_price}`);
      console.log(`  USD Reserve: $${t.usd_reserve}`);
      console.log(`  Hard Asset Value: $${t.hard_asset_current_value}`);
      console.log(`  Total Backing: $${t.total_backing}`);
      console.log(`  Liquid Backing: ${t.liquid_backing_pct}%`);
      console.log(`  Hard Asset Backing: ${t.hard_asset_backing_pct}%`);
    }
  } catch (e) {
    console.log('\n⚠ Could not fetch token state:', e.message);
  }

  // List functions
  try {
    const funcs = await client.query(`
      SELECT routine_name FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name LIKE 'grain_%'
      ORDER BY routine_name
    `);
    console.log('\n⚡ GRAIN Functions:');
    funcs.rows.forEach(f => console.log('  -', f.routine_name));
  } catch (e) {
    console.log('\n⚠ Could not list functions:', e.message);
  }

  // List views
  try {
    const views = await client.query(`
      SELECT table_name FROM information_schema.views
      WHERE table_schema = 'public'
      AND table_name LIKE 'grain_%'
      ORDER BY table_name
    `);
    console.log('\n👁 GRAIN Views:');
    views.rows.forEach(v => console.log('  -', v.table_name));
  } catch (e) {
    console.log('\n⚠ Could not list views:', e.message);
  }

  await client.end();

  console.log('\n' + '='.repeat(60));
  console.log('✓ GRAIN External Ledger Migration Complete!');
  console.log('');
  console.log('GRAIN Economics:');
  console.log('  Price = (USD Reserve + Yield + Hard Assets) / Supply');
  console.log('');
  console.log('Hard Asset Multiplier Effect:');
  console.log('  Platform Fees → Hard Asset Investments');
  console.log('  Hard Assets → Appreciation + Income');
  console.log('  Income → More Assets → Exponential Growth');
  console.log('='.repeat(60));
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
