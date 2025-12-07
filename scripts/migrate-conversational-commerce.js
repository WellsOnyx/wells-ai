const { Client } = require('pg');
const fs = require('fs');

async function migrate() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();
  console.log('Connected to database');
  console.log('');
  console.log('='.repeat(70));
  console.log('CONVERSATIONAL COMMERCE ENGINE');
  console.log('"Just Ask. We\'ll Handle It."');
  console.log('='.repeat(70));
  console.log('');

  const schemaFile = fs.readFileSync('scripts/schema-conversational-commerce.sql', 'utf8');

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
    AND table_name LIKE 'chat_%'
    ORDER BY table_name
  `);

  console.log('\n📊 Conversational Commerce Tables:');
  tables.rows.forEach(row => console.log('  -', row.table_name));

  // Check intents
  try {
    const intents = await client.query(`
      SELECT id, category, display_name FROM chat_intents ORDER BY category, id
    `);
    console.log('\n🎯 Registered Intents:');
    let lastCategory = '';
    intents.rows.forEach(i => {
      if (i.category !== lastCategory) {
        console.log(`\n  [${i.category}]`);
        lastCategory = i.category;
      }
      console.log(`    - ${i.id}: ${i.display_name}`);
    });
  } catch (e) {
    console.log('\n⚠ Could not list intents:', e.message);
  }

  // Check functions
  try {
    const funcs = await client.query(`
      SELECT routine_name FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name LIKE 'process_chat_%'
      ORDER BY routine_name
    `);
    console.log('\n⚡ Chat Functions:');
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
        table_name LIKE 'workspace_%'
        OR table_name LIKE 'intent_%'
        OR table_name LIKE 'user_engagement%'
      )
      ORDER BY table_name
    `);
    console.log('\n👁 Analytics Views:');
    views.rows.forEach(v => console.log('  -', v.table_name));
  } catch (e) {
    console.log('\n⚠ Could not list views:', e.message);
  }

  await client.end();

  console.log('\n' + '='.repeat(70));
  console.log('✓ CONVERSATIONAL COMMERCE ENGINE MIGRATION COMPLETE!');
  console.log('');
  console.log('SUPPORTED CHANNELS:');
  console.log('  - Slack');
  console.log('  - Microsoft Teams');
  console.log('  - Discord');
  console.log('  - WhatsApp/SMS');
  console.log('  - Web Widget');
  console.log('');
  console.log('EXAMPLE CONVERSATION:');
  console.log('');
  console.log('  User: "Order 500 latex gloves"');
  console.log('  Bot:  "Found 3M Latex Gloves - $89.99. Add to cart?"');
  console.log('  User: "Yes"');
  console.log('  Bot:  "✅ Order submitted! PO-12345"');
  console.log('  Bot:  "You earned 9 GRAIN! 🌾"');
  console.log('');
  console.log('  NO FORMS. NO LOGINS. JUST CONVERSATION.');
  console.log('='.repeat(70));
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
