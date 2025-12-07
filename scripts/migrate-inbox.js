#!/usr/bin/env node
/**
 * Migrate Inbox Tables
 * Run: node scripts/migrate-inbox.js
 *
 * Requires POSTGRES_URL environment variable
 */

const { createClient } = require('@vercel/postgres');

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

    // Create inbox_conversations table
    console.log('📦 Creating inbox_conversations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS inbox_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id TEXT NOT NULL,
        contact_name TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        contact_company TEXT,
        subject TEXT,
        channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'slack', 'chat', 'whatsapp')),
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'archived')),
        priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        intent TEXT,
        sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
        category TEXT,
        assigned_to TEXT,
        unread_count INTEGER DEFAULT 1,
        last_message_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_message_preview TEXT,
        lead_id UUID,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ inbox_conversations created\n');

    // Create inbox_messages table
    console.log('📦 Creating inbox_messages table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS inbox_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES inbox_conversations(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        content_html TEXT,
        direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
        sender_type TEXT NOT NULL CHECK (sender_type IN ('contact', 'user', 'ai', 'system')),
        sender_id TEXT,
        sender_name TEXT,
        channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'slack', 'chat', 'whatsapp')),
        channel_message_id TEXT,
        email_subject TEXT,
        email_from TEXT,
        email_to TEXT,
        email_cc TEXT,
        email_attachments JSONB DEFAULT '[]',
        sms_from TEXT,
        sms_to TEXT,
        ai_generated BOOLEAN DEFAULT FALSE,
        ai_approved BOOLEAN,
        ai_approved_by TEXT,
        ai_approved_at TIMESTAMP,
        status TEXT DEFAULT 'sent' CHECK (status IN ('draft', 'pending_approval', 'sending', 'sent', 'delivered', 'failed', 'read')),
        error_message TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        sent_at TIMESTAMP,
        delivered_at TIMESTAMP,
        read_at TIMESTAMP
      )
    `);
    console.log('✅ inbox_messages created\n');

    // Create inbox_quick_replies table
    console.log('📦 Creating inbox_quick_replies table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS inbox_quick_replies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT,
        shortcut TEXT,
        channel TEXT,
        created_by TEXT,
        use_count INTEGER DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ inbox_quick_replies created\n');

    // Create inbox_ai_templates table
    console.log('📦 Creating inbox_ai_templates table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS inbox_ai_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        system_prompt TEXT NOT NULL,
        example_input TEXT,
        example_output TEXT,
        category TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ inbox_ai_templates created\n');

    // Create indexes
    console.log('📦 Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_inbox_conversations_contact ON inbox_conversations(contact_id)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_conversations_status ON inbox_conversations(status)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_conversations_channel ON inbox_conversations(channel)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_conversations_last_message ON inbox_conversations(last_message_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_conversations_assigned ON inbox_conversations(assigned_to)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_messages_conversation ON inbox_messages(conversation_id)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_messages_created ON inbox_messages(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_inbox_messages_channel ON inbox_messages(channel)',
    ];

    for (const indexSql of indexes) {
      await client.query(indexSql);
    }
    console.log('✅ Indexes created\n');

    // Verify
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'inbox_%'
      ORDER BY table_name
    `);

    console.log('📋 Inbox tables created:');
    result.rows.forEach(row => console.log(`   - ${row.table_name}`));

    console.log('\n✅ Migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
