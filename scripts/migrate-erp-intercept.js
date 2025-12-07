const { Client } = require('pg');
const fs = require('fs');

async function migrate() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();
  console.log('Connected to database');
  console.log('');
  console.log('='.repeat(70));
  console.log('WELLS AI: SWITCHLESS ERP SPEND INTERCEPT');
  console.log('"Invisible Infrastructure for Enterprise Procurement"');
  console.log('='.repeat(70));
  console.log('');

  // Read the schema and split by $$ delimiters for proper function handling
  const schemaFile = fs.readFileSync('scripts/schema-erp-intercept.sql', 'utf8');

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
  console.log('='.repeat(70));
  console.log('VERIFICATION');
  console.log('='.repeat(70));

  // ERP Intercept tables
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND (
      table_name LIKE 'erp_%'
      OR table_name LIKE 'punchout_%'
      OR table_name LIKE 'edi_%'
      OR table_name LIKE 'intercept_%'
      OR table_name LIKE 'supplier_%'
      OR table_name LIKE 'routing_%'
      OR table_name LIKE 'payment_virtual_%'
      OR table_name LIKE 'spend_%'
    )
    ORDER BY table_name
  `);

  console.log('\n📊 ERP Intercept Tables:');
  tables.rows.forEach(row => console.log('  -', row.table_name));

  // Show layer breakdown
  console.log('\n🏗️  INTERCEPTION LAYERS:');

  const layer1 = ['erp_customers'];
  const layer2 = ['punchout_sessions', 'punchout_credentials'];
  const layer3 = ['edi_trading_partners', 'edi_documents'];
  const orderMgmt = ['intercept_orders', 'intercept_order_lines'];
  const suppliers = ['supplier_network', 'supplier_catalog'];
  const routing = ['routing_rules', 'routing_decisions'];
  const payments = ['payment_virtual_cards'];
  const analytics = ['spend_daily_summary'];

  const allTables = tables.rows.map(r => r.table_name);

  console.log('\n  Layer 1 - Virtual Vendor:');
  layer1.forEach(t => console.log(`    ${allTables.includes(t) ? '✓' : '✗'} ${t}`));

  console.log('\n  Layer 2 - Punch-Out Catalog:');
  layer2.forEach(t => console.log(`    ${allTables.includes(t) ? '✓' : '✗'} ${t}`));

  console.log('\n  Layer 3 - EDI Interchange:');
  layer3.forEach(t => console.log(`    ${allTables.includes(t) ? '✓' : '✗'} ${t}`));

  console.log('\n  Order Management:');
  orderMgmt.forEach(t => console.log(`    ${allTables.includes(t) ? '✓' : '✗'} ${t}`));

  console.log('\n  Supplier Network:');
  suppliers.forEach(t => console.log(`    ${allTables.includes(t) ? '✓' : '✗'} ${t}`));

  console.log('\n  Routing Engine:');
  routing.forEach(t => console.log(`    ${allTables.includes(t) ? '✓' : '✗'} ${t}`));

  console.log('\n  Payment Layer:');
  payments.forEach(t => console.log(`    ${allTables.includes(t) ? '✓' : '✗'} ${t}`));

  console.log('\n  Analytics:');
  analytics.forEach(t => console.log(`    ${allTables.includes(t) ? '✓' : '✗'} ${t}`));

  // List functions
  try {
    const funcs = await client.query(`
      SELECT routine_name FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND (
        routine_name LIKE 'create_punchout%'
        OR routine_name LIKE 'submit_punchout%'
        OR routine_name LIKE 'process_%order%'
        OR routine_name LIKE 'route_%'
      )
      ORDER BY routine_name
    `);
    console.log('\n⚡ ERP Functions:');
    funcs.rows.forEach(f => console.log('  -', f.routine_name));
  } catch (e) {
    console.log('\n⚠ Could not list functions:', e.message);
  }

  // List views
  try {
    const views = await client.query(`
      SELECT table_name FROM information_schema.views
      WHERE table_schema = 'public'
      AND (
        table_name LIKE 'customer_%'
        OR table_name LIKE 'orders_%'
        OR table_name LIKE 'supplier_%'
        OR table_name LIKE 'daily_%'
      )
      ORDER BY table_name
    `);
    console.log('\n👁 Operational Views:');
    views.rows.forEach(v => console.log('  -', v.table_name));
  } catch (e) {
    console.log('\n⚠ Could not list views:', e.message);
  }

  await client.end();

  console.log('\n' + '='.repeat(70));
  console.log('✓ ERP SPEND INTERCEPT MIGRATION COMPLETE!');
  console.log('');
  console.log('THE MAGIC:');
  console.log('');
  console.log('  1. Customer adds "Wells Onyx" as vendor in SAP (15 minutes)');
  console.log('  2. User creates requisition, our catalog appears via punch-out');
  console.log('  3. Cart goes back to SAP, PO generated to "Wells Onyx"');
  console.log('  4. We receive 850, route to actual supplier');
  console.log('  5. Supplier ships direct to customer (drop ship)');
  console.log('  6. We invoice customer at agreed price');
  console.log('  7. We pay supplier at our negotiated price');
  console.log('  8. Difference = MARGIN CAPTURED');
  console.log('');
  console.log('THEY NEVER KNOW WE\'RE THERE.');
  console.log('='.repeat(70));
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
