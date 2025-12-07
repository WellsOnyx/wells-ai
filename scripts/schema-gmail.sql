-- Gmail Integration Database Schema
-- Supports multiple Gmail accounts per user with incremental sync

-- Gmail accounts table
CREATE TABLE IF NOT EXISTS gmail_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  account_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  history_id TEXT, -- For incremental sync using Gmail History API
  watch_expiration TIMESTAMP, -- When Gmail push notifications expire
  labels JSONB DEFAULT '[]', -- Gmail labels/folders
  last_sync_at TIMESTAMP,
  sync_status TEXT NOT NULL DEFAULT 'active' CHECK (sync_status IN ('active', 'paused', 'error')),
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, email)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_gmail_accounts_user_id ON gmail_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_accounts_email ON gmail_accounts(email);
CREATE INDEX IF NOT EXISTS idx_gmail_accounts_sync_status ON gmail_accounts(sync_status);
CREATE INDEX IF NOT EXISTS idx_gmail_accounts_watch_expiration ON gmail_accounts(watch_expiration) WHERE watch_expiration IS NOT NULL;

-- Gmail messages metadata (for tracking sync state)
-- Note: Full messages are stored in inbox_messages table
CREATE TABLE IF NOT EXISTS gmail_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES gmail_accounts(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL, -- Gmail's message ID
  gmail_thread_id TEXT NOT NULL, -- Gmail's thread ID
  history_id TEXT NOT NULL, -- History ID when this message was synced
  label_ids JSONB DEFAULT '[]', -- Current labels on this message
  is_unread BOOLEAN DEFAULT TRUE,
  is_starred BOOLEAN DEFAULT FALSE,
  is_important BOOLEAN DEFAULT FALSE,
  inbox_message_id UUID, -- Reference to inbox_messages table
  synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, gmail_message_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gmail_messages_account ON gmail_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_gmail_id ON gmail_messages(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_thread ON gmail_messages(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_inbox ON gmail_messages(inbox_message_id);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_unread ON gmail_messages(is_unread) WHERE is_unread = TRUE;

-- Gmail sync log (for debugging and monitoring)
CREATE TABLE IF NOT EXISTS gmail_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES gmail_accounts(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'webhook')),
  messages_synced INTEGER DEFAULT 0,
  start_history_id TEXT,
  end_history_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gmail_sync_log_account ON gmail_sync_log(account_id);
CREATE INDEX IF NOT EXISTS idx_gmail_sync_log_created ON gmail_sync_log(created_at DESC);

-- Add subject column to inbox_conversations if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inbox_conversations'
    AND column_name = 'subject'
  ) THEN
    ALTER TABLE inbox_conversations ADD COLUMN subject TEXT;
  END IF;
END $$;

-- Add email-specific columns to inbox_messages if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inbox_messages'
    AND column_name = 'email_subject'
  ) THEN
    ALTER TABLE inbox_messages ADD COLUMN email_subject TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inbox_messages'
    AND column_name = 'email_from'
  ) THEN
    ALTER TABLE inbox_messages ADD COLUMN email_from TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inbox_messages'
    AND column_name = 'email_to'
  ) THEN
    ALTER TABLE inbox_messages ADD COLUMN email_to TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inbox_messages'
    AND column_name = 'email_cc'
  ) THEN
    ALTER TABLE inbox_messages ADD COLUMN email_cc TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inbox_messages'
    AND column_name = 'email_attachments'
  ) THEN
    ALTER TABLE inbox_messages ADD COLUMN email_attachments JSONB DEFAULT '[]';
  END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE gmail_accounts IS 'Stores Gmail account credentials and sync state for each user';
COMMENT ON COLUMN gmail_accounts.history_id IS 'Gmail History ID for incremental sync - tracks last sync point';
COMMENT ON COLUMN gmail_accounts.watch_expiration IS 'When Gmail push notifications expire and need renewal';
COMMENT ON TABLE gmail_messages IS 'Tracks Gmail message metadata and sync state';
COMMENT ON TABLE gmail_sync_log IS 'Audit log of sync operations for monitoring and debugging';
