-- Unified Inbox Schema
-- Supports Gmail, SMS, LinkedIn, X (Twitter), Instagram, iMessage, and Wells AI internal messages

-- Connected accounts (Gmail, LinkedIn, X, etc.)
CREATE TABLE IF NOT EXISTS inbox_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'gmail', 'linkedin', 'x', 'instagram', 'sms', 'imessage', 'wells'
  email TEXT, -- for email accounts
  phone TEXT, -- for SMS
  handle TEXT, -- for social accounts
  display_name TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  last_sync_at TIMESTAMP,
  sync_cursor TEXT, -- for pagination/incremental sync
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Unified contacts
CREATE TABLE IF NOT EXISTS inbox_contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  name TEXT,
  company TEXT,
  avatar_url TEXT,
  linkedin_url TEXT,
  twitter_handle TEXT,
  instagram_handle TEXT,
  tags TEXT[], -- for categorization
  vip BOOLEAN DEFAULT false,
  last_contacted_at TIMESTAMP,
  contact_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Conversation threads
CREATE TABLE IF NOT EXISTS inbox_threads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT REFERENCES inbox_accounts(id),
  provider TEXT NOT NULL,
  external_thread_id TEXT, -- provider's thread ID
  subject TEXT,
  snippet TEXT, -- preview text
  participants JSONB, -- array of contact IDs or external identifiers
  labels TEXT[], -- inbox, sent, archived, trash, etc.
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_important BOOLEAN DEFAULT false,
  is_snoozed BOOLEAN DEFAULT false,
  snooze_until TIMESTAMP,
  ai_summary TEXT, -- AI-generated summary
  ai_priority TEXT, -- 'urgent', 'important', 'normal', 'low'
  ai_category TEXT, -- 'deals', 'recruiting', 'support', 'newsletter', etc.
  ai_suggested_action TEXT,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Individual messages
CREATE TABLE IF NOT EXISTS inbox_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT REFERENCES inbox_threads(id),
  account_id TEXT REFERENCES inbox_accounts(id),
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_message_id TEXT,
  direction TEXT NOT NULL, -- 'inbound', 'outbound'
  from_address TEXT,
  from_name TEXT,
  to_addresses JSONB, -- array
  cc_addresses JSONB,
  bcc_addresses JSONB,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  attachments JSONB, -- array of {name, url, size, mime_type}
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  ai_summary TEXT,
  ai_sentiment TEXT, -- 'positive', 'neutral', 'negative', 'urgent'
  ai_entities JSONB, -- extracted entities (dates, amounts, names)
  ai_suggested_reply TEXT,
  sent_at TIMESTAMP,
  received_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Draft messages
CREATE TABLE IF NOT EXISTS inbox_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT REFERENCES inbox_accounts(id),
  thread_id TEXT REFERENCES inbox_threads(id),
  to_addresses JSONB,
  cc_addresses JSONB,
  bcc_addresses JSONB,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  attachments JSONB,
  ai_generated BOOLEAN DEFAULT false,
  scheduled_for TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Snooze queue
CREATE TABLE IF NOT EXISTS inbox_snooze (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  thread_id TEXT REFERENCES inbox_threads(id),
  snooze_until TIMESTAMP NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Follow-up reminders
CREATE TABLE IF NOT EXISTS inbox_reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  thread_id TEXT REFERENCES inbox_threads(id),
  message_id TEXT REFERENCES inbox_messages(id),
  remind_at TIMESTAMP NOT NULL,
  reminder_type TEXT, -- 'follow_up', 'no_response', 'custom'
  note TEXT,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- AI-powered smart filters and rules
CREATE TABLE IF NOT EXISTS inbox_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB, -- {from: [...], subject_contains: [...], ai_category: [...]}
  actions JSONB, -- {label: [...], archive: true, mark_read: true, etc.}
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- execution order
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sync status tracking for reliability
CREATE TABLE IF NOT EXISTS inbox_sync_log (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES inbox_accounts(id),
  provider TEXT NOT NULL,
  sync_started_at TIMESTAMP NOT NULL,
  sync_completed_at TIMESTAMP,
  status TEXT, -- 'running', 'completed', 'failed'
  messages_synced INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inbox_accounts_user ON inbox_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_accounts_provider ON inbox_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_inbox_contacts_user ON inbox_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_contacts_email ON inbox_contacts(email);
CREATE INDEX IF NOT EXISTS idx_inbox_contacts_phone ON inbox_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_user ON inbox_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_account ON inbox_threads(account_id);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_last_message ON inbox_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_provider ON inbox_threads(provider);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_labels ON inbox_threads USING GIN(labels);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_unread ON inbox_threads(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_inbox_messages_thread ON inbox_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_user ON inbox_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_received ON inbox_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_direction ON inbox_messages(direction);
CREATE INDEX IF NOT EXISTS idx_inbox_drafts_user ON inbox_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_snooze_user_until ON inbox_snooze(user_id, snooze_until);
CREATE INDEX IF NOT EXISTS idx_inbox_reminders_user ON inbox_reminders(user_id, remind_at) WHERE is_completed = false;
CREATE INDEX IF NOT EXISTS idx_inbox_sync_log_account ON inbox_sync_log(account_id);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_inbox_messages_body_text ON inbox_messages USING gin(to_tsvector('english', body_text));
CREATE INDEX IF NOT EXISTS idx_inbox_messages_subject ON inbox_messages USING gin(to_tsvector('english', subject));
CREATE INDEX IF NOT EXISTS idx_inbox_threads_subject ON inbox_threads USING gin(to_tsvector('english', subject));
