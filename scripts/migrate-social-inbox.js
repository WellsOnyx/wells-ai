const { Client } = require('pg');

async function migrate() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();
  console.log('Connected to database');

  // Create tables in order

  // 1. WhatsApp (Twilio) tables
  await client.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_threads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id TEXT NOT NULL,
      whatsapp_id TEXT NOT NULL,
      contact_name TEXT,
      profile_picture_url TEXT,
      last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      message_count INTEGER DEFAULT 0,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(account_id, whatsapp_id)
    )
  `);
  console.log('✓ whatsapp_threads');

  await client.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      thread_id UUID REFERENCES whatsapp_threads(id) ON DELETE CASCADE,
      from_number TEXT NOT NULL,
      to_number TEXT NOT NULL,
      body TEXT,
      media_urls JSONB,
      direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
      status TEXT DEFAULT 'pending',
      message_type TEXT DEFAULT 'text',
      twilio_sid TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  console.log('✓ whatsapp_messages');

  // 2. WhatsApp Cloud API tables
  await client.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_cloud_threads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id TEXT NOT NULL,
      wa_id TEXT NOT NULL,
      profile_name TEXT,
      last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      message_count INTEGER DEFAULT 0,
      is_read BOOLEAN DEFAULT false,
      conversation_window_expires TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(account_id, wa_id)
    )
  `);
  console.log('✓ whatsapp_cloud_threads');

  await client.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_cloud_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      thread_id UUID REFERENCES whatsapp_cloud_threads(id) ON DELETE CASCADE,
      wa_message_id TEXT UNIQUE,
      from_number TEXT NOT NULL,
      to_number TEXT NOT NULL,
      message_type TEXT NOT NULL,
      content JSONB NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
      status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
      timestamp TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  console.log('✓ whatsapp_cloud_messages');

  // 3. Twitter tokens
  await client.query(`
    CREATE TABLE IF NOT EXISTS twitter_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id TEXT NOT NULL UNIQUE,
      twitter_user_id TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at BIGINT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  console.log('✓ twitter_tokens');

  // 4. OAuth states
  await client.query(`
    CREATE TABLE IF NOT EXISTS oauth_states (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      state TEXT NOT NULL UNIQUE,
      account_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      code_verifier TEXT,
      redirect_uri TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL
    )
  `);
  console.log('✓ oauth_states');

  // 5. Create indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_whatsapp_threads_account ON whatsapp_threads(account_id)',
    'CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_thread ON whatsapp_messages(thread_id)',
    'CREATE INDEX IF NOT EXISTS idx_wa_cloud_threads_account ON whatsapp_cloud_threads(account_id)',
    'CREATE INDEX IF NOT EXISTS idx_wa_cloud_messages_thread ON whatsapp_cloud_messages(thread_id)',
    'CREATE INDEX IF NOT EXISTS idx_twitter_tokens_account ON twitter_tokens(account_id)',
    'CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state)',
  ];

  for (const idx of indexes) {
    await client.query(idx).catch(() => {});
  }
  console.log('✓ indexes created');

  // Verify all tables
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND (table_name LIKE 'whatsapp%' OR table_name LIKE 'twitter%' OR table_name = 'oauth_states')
    ORDER BY table_name
  `);

  console.log('\n=== Social Inbox Tables ===');
  tables.rows.forEach(row => console.log('  -', row.table_name));
  console.log('Total:', tables.rows.length, 'tables');

  await client.end();
}

migrate().catch(console.error);
