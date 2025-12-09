-- Social Inbox Schema
-- Tables for WhatsApp, WhatsApp Cloud, and X (Twitter) DM integration

-- ============================================================================
-- WHATSAPP (Twilio) TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  whatsapp_id TEXT NOT NULL, -- Format: whatsapp:+1234567890
  contact_name TEXT,
  profile_picture_url TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(account_id, whatsapp_id)
);

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
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_threads_account ON whatsapp_threads(account_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_threads_last_message ON whatsapp_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_thread ON whatsapp_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON whatsapp_messages(created_at DESC);

-- ============================================================================
-- WHATSAPP CLOUD API TABLES (Free Tier)
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_cloud_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  wa_id TEXT NOT NULL, -- WhatsApp ID (phone number)
  profile_name TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  is_read BOOLEAN DEFAULT false,
  conversation_window_expires TIMESTAMP WITH TIME ZONE, -- 24h window for free responses
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(account_id, wa_id)
);

CREATE TABLE IF NOT EXISTS whatsapp_cloud_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES whatsapp_cloud_threads(id) ON DELETE CASCADE,
  wa_message_id TEXT UNIQUE, -- WhatsApp message ID
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  message_type TEXT NOT NULL, -- text, image, video, audio, document, location, contacts, interactive, template
  content JSONB NOT NULL, -- Message content varies by type
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_cloud_threads_account ON whatsapp_cloud_threads(account_id);
CREATE INDEX IF NOT EXISTS idx_wa_cloud_threads_last_message ON whatsapp_cloud_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_cloud_threads_window ON whatsapp_cloud_threads(conversation_window_expires);
CREATE INDEX IF NOT EXISTS idx_wa_cloud_messages_thread ON whatsapp_cloud_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_wa_cloud_messages_wa_id ON whatsapp_cloud_messages(wa_message_id);

-- ============================================================================
-- X (TWITTER) DM TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS twitter_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL UNIQUE,
  twitter_user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL, -- Unix timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS twitter_dm_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  participant_id TEXT NOT NULL, -- Twitter user ID
  participant_username TEXT,
  participant_name TEXT,
  participant_profile_image TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(account_id, participant_id)
);

CREATE TABLE IF NOT EXISTS twitter_dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES twitter_dm_threads(id) ON DELETE CASCADE,
  twitter_message_id TEXT UNIQUE, -- Twitter's message ID
  sender_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  text TEXT,
  media_urls JSONB,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_twitter_tokens_account ON twitter_tokens(account_id);
CREATE INDEX IF NOT EXISTS idx_twitter_dm_threads_account ON twitter_dm_threads(account_id);
CREATE INDEX IF NOT EXISTS idx_twitter_dm_threads_last_message ON twitter_dm_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_twitter_dm_messages_thread ON twitter_dm_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_twitter_dm_messages_twitter_id ON twitter_dm_messages(twitter_message_id);

-- ============================================================================
-- OAUTH STATES TABLE (for OAuth flows)
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL,
  provider TEXT NOT NULL, -- twitter, google, etc.
  code_verifier TEXT, -- For PKCE flows
  redirect_uri TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

-- Clean up expired states automatically (run periodically)
-- DELETE FROM oauth_states WHERE expires_at < NOW();

-- ============================================================================
-- UNIFIED INBOX UPDATES - Add new providers
-- ============================================================================

-- Add provider column check for new providers (if inbox_threads exists)
DO $$
BEGIN
  -- Check if the constraint exists and update it if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'inbox_threads_provider_check'
  ) THEN
    ALTER TABLE inbox_threads DROP CONSTRAINT inbox_threads_provider_check;
    ALTER TABLE inbox_threads ADD CONSTRAINT inbox_threads_provider_check
      CHECK (provider IN ('gmail', 'sms', 'wells_internal', 'whatsapp', 'whatsapp_cloud', 'twitter', 'linkedin', 'instagram'));
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- inbox_threads doesn't exist, that's fine
    NULL;
  WHEN others THEN
    NULL;
END
$$;
