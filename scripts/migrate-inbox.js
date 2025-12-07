#!/usr/bin/env node
/**
 * Migrate Unified Inbox Tables
 * Run: node scripts/migrate-inbox.js
 *
 * Requires POSTGRES_URL environment variable
 * Creates tables for unified inbox supporting:
 * - Gmail, SMS, LinkedIn, X, Instagram, iMessage, Wells AI
 */

const { createClient } = require('@vercel/postgres');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const connectionString = process.env.POSTGRES_URL || process.env.wellsmemory_POSTGRES_URL;

  if (!connectionString) {
    console.error('❌ POSTGRES_URL environment variable is required');
    console.log('Run: source .env.local && node scripts/migrate-inbox.js');
    process.exit(1);
  }

  const client = createClient({ connectionString });

  try {
    await client.connect();
    console.log('🚀 Connected to database\n');

    // Read the schema file
    const schemaPath = path.join(__dirname, 'schema-inbox.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📦 Running unified inbox schema migration...\n');

    // Split the schema into individual statements
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let tablesCreated = 0;
    let indexesCreated = 0;

    for (const statement of statements) {
      if (statement.includes('CREATE TABLE')) {
        const tableName = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
        if (tableName) {
          console.log(`📦 Creating table: ${tableName}...`);
          await client.query(statement);
          console.log(`✅ ${tableName} created`);
          tablesCreated++;
        }
      } else if (statement.includes('CREATE INDEX')) {
        const indexName = statement.match(/CREATE INDEX IF NOT EXISTS (\w+)/)?.[1];
        if (indexName) {
          await client.query(statement);
          indexesCreated++;
        }
      } else {
        // Execute other statements
        await client.query(statement);
      }
    }

    console.log(`\n✅ Created ${tablesCreated} tables`);
    console.log(`✅ Created ${indexesCreated} indexes\n`);

    // Verify tables
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'inbox_%'
      ORDER BY table_name
    `);

    console.log('📋 Unified Inbox tables:');
    result.rows.forEach(row => console.log(`   ✓ ${row.table_name}`));

    // Show table counts
    console.log('\n📊 Table statistics:');
    for (const row of result.rows) {
      const countResult = await client.query(`SELECT COUNT(*) FROM ${row.table_name}`);
      console.log(`   ${row.table_name}: ${countResult.rows[0].count} rows`);
    }

    console.log('\n✅ Migration complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Connect Gmail accounts via OAuth');
    console.log('   2. Set up LinkedIn integration');
    console.log('   3. Configure X (Twitter) API');
    console.log('   4. Add Instagram Business API');
    console.log('   5. Set up iMessage sync (macOS)');
    console.log('   6. Test unified inbox UI');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
