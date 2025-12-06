const { Client } = require('pg');
const fs = require('fs');

async function migrate() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();
  console.log('Connected to database');

  // Read the schema and split by $$ delimiters for proper function handling
  const schemaFile = fs.readFileSync('scripts/schema-ledger.sql', 'utf8');

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
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name LIKE 'gv_%'
    ORDER BY table_name
  `);

  console.log('Grain & Vault ledger tables:');
  tables.rows.forEach(row => console.log('  -', row.table_name));

  // Show currencies
  try {
    const currencies = await client.query(`SELECT code, name FROM gv_currencies ORDER BY code`);
    console.log(`\n💱 Currencies (${currencies.rows.length}):`);
    currencies.rows.forEach(c => console.log(`  - ${c.code}: ${c.name}`));
  } catch (e) {
    console.log('Could not fetch currencies:', e.message);
  }

  // Show FX margin config
  try {
    const margins = await client.query(`
      SELECT * FROM gv_fx_margin_config WHERE is_active = true LIMIT 1
    `);

    if (margins.rows.length > 0) {
      const m = margins.rows[0];
      console.log('\n📊 Default FX Margin Config:');
      console.log(`  Grain & Vault margin: ${m.base_margin_bp}bp (${m.base_margin_bp / 100}%)`);
      console.log(`  Provider fee (Airwallex): ${m.provider_fee_bp}bp (${m.provider_fee_bp / 100}%)`);
      console.log(`  Total user pays: ${m.base_margin_bp + m.provider_fee_bp}bp (${(m.base_margin_bp + m.provider_fee_bp) / 100}%)`);
      console.log(`\n  Volume Tiers:`);
      console.log(`    Tier 1 (< $${m.tier_threshold_1}): ${m.tier_1_margin_bp}bp`);
      console.log(`    Tier 2 ($${m.tier_threshold_1}-$${m.tier_threshold_2}): ${m.tier_2_margin_bp}bp`);
      console.log(`    Tier 3 ($${m.tier_threshold_2}+): ${m.tier_3_margin_bp}bp`);
    }
  } catch (e) {
    console.log('Could not fetch margin config:', e.message);
  }

  await client.end();
  console.log('\n✓ Migration complete!');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
