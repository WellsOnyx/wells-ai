-- ============================================
-- UNIFIED INBOX SCHEMA - Superhuman-Style
-- ============================================
-- Wells AI Unified Inbox System
-- Aggregates Gmail, Outlook, SMS, Twitter DM, LinkedIn, etc.
-- Superhuman meets Claude - fast, keyboard-driven, AI-augmented
-- ============================================

-- =====================================================
-- UNIFIED MESSAGE MODEL
-- =====================================================
-- Core message table that normalizes all channels

CREATE TABLE IF NOT EXISTS unified_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User/Account ownership
  user_id TEXT NOT NULL,
  account_id TEXT, -- Reference to connected account

  -- Source channel identification
  channel TEXT NOT NULL, -- 'gmail', 'outlook', 'sms', 'twitter_dm', 'linkedin', 'whatsapp', 'slack', 'imessage'
  channel_message_id TEXT, -- Original message ID from source
  channel_thread_id TEXT, -- Original thread/conversation ID from source

  -- Thread grouping (our internal threading)
  thread_id UUID, -- Groups related messages

  -- Direction and participants
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),

  -- From participant
  from_address TEXT, -- email, phone, or handle
  from_name TEXT,
  from_avatar_url TEXT,

  -- To participants (JSONB array)
  to_addresses JSONB DEFAULT '[]', -- [{address, name}]
  cc_addresses JSONB DEFAULT '[]',
  bcc_addresses JSONB DEFAULT '[]',

  -- Message content
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  snippet TEXT, -- First ~100 chars for preview

  -- Attachments (JSONB array)
  attachments JSONB DEFAULT '[]', -- [{id, name, url, size, mime_type}]
  has_attachments BOOLEAN GENERATED ALWAYS AS (jsonb_array_length(attachments) > 0) STORED,

  -- Status flags
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_trashed BOOLEAN DEFAULT false,
  is_spam BOOLEAN DEFAULT false,
  is_draft BOOLEAN DEFAULT false,

  -- Labels (Gmail-style, array)
  labels TEXT[] DEFAULT '{}',

  -- AI Analysis (populated by AI assistant)
  ai_category TEXT, -- 'lead', 'reply', 'spam', 'important', 'newsletter', 'transactional', 'campaign_reply'
  ai_priority TEXT CHECK (ai_priority IN ('urgent', 'high', 'normal', 'low')),
  ai_sentiment TEXT CHECK (ai_sentiment IN ('positive', 'neutral', 'negative', 'urgent')),
  ai_summary TEXT,
  ai_suggested_reply TEXT,
  ai_entities JSONB DEFAULT '[]', -- [{type, value, confidence}]
  ai_action_items JSONB DEFAULT '[]', -- [{description, due_date, priority}]

  -- Campaign reply matching
  matched_campaign_id UUID, -- Links to outreach_campaigns
  matched_outreach_message_id UUID, -- Links to outreach_messages
  is_campaign_reply BOOLEAN DEFAULT false,
  campaign_match_confidence DECIMAL(3,2), -- 0.00 to 1.00

  -- Contact linking
  contact_id UUID, -- Links to unified contact record

  -- Snooze functionality
  is_snoozed BOOLEAN DEFAULT false,
  snooze_until TIMESTAMPTZ,

  -- Timestamps
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Raw data preservation
  raw_headers JSONB, -- Original email headers
  raw_payload JSONB -- Original API response for debugging
);

-- =====================================================
-- UNIFIED THREADS (Conversation Grouping)
-- =====================================================

CREATE TABLE IF NOT EXISTS unified_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Thread metadata
  subject TEXT,
  snippet TEXT, -- Preview of last message

  -- Participants (aggregated from messages)
  participants JSONB DEFAULT '[]', -- [{address, name, avatar_url, channel}]
  participant_count INTEGER DEFAULT 0,

  -- Primary channel (where thread originated)
  primary_channel TEXT NOT NULL,

  -- Message stats
  message_count INTEGER DEFAULT 0,
  unread_count INTEGER DEFAULT 0,

  -- Status flags
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_trashed BOOLEAN DEFAULT false,
  is_spam BOOLEAN DEFAULT false,

  -- Snooze
  is_snoozed BOOLEAN DEFAULT false,
  snooze_until TIMESTAMPTZ,

  -- Labels
  labels TEXT[] DEFAULT '{}',

  -- AI categorization
  ai_category TEXT,
  ai_priority TEXT CHECK (ai_priority IN ('urgent', 'high', 'normal', 'low')),
  ai_summary TEXT,
  ai_suggested_action TEXT,

  -- Campaign matching
  is_campaign_reply BOOLEAN DEFAULT false,
  matched_campaign_id UUID,

  -- Timestamps
  first_message_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CONNECTED ACCOUNTS
-- =====================================================

CREATE TABLE IF NOT EXISTS inbox_connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Account type
  channel TEXT NOT NULL,

  -- Account identifiers
  email TEXT, -- For email accounts
  phone TEXT, -- For SMS
  handle TEXT, -- For social accounts
  display_name TEXT,
  avatar_url TEXT,

  -- OAuth tokens (encrypted in production)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  token_scope TEXT,

  -- Sync state
  sync_cursor TEXT, -- For incremental sync (e.g., Gmail history ID)
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle', -- 'idle', 'syncing', 'error', 'paused'
  sync_error TEXT,

  -- Settings
  is_active BOOLEAN DEFAULT true,
  sync_enabled BOOLEAN DEFAULT true,
  auto_reply_enabled BOOLEAN DEFAULT false,

  -- Metadata
  settings JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, channel, email),
  UNIQUE(user_id, channel, phone),
  UNIQUE(user_id, channel, handle)
);

-- =====================================================
-- UNIFIED CONTACTS
-- =====================================================

CREATE TABLE IF NOT EXISTS inbox_unified_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Primary contact info
  email TEXT,
  phone TEXT,

  -- Social handles
  twitter_handle TEXT,
  linkedin_url TEXT,
  instagram_handle TEXT,

  -- Identity
  name TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,

  -- Company info
  company TEXT,
  title TEXT,

  -- VIP and categorization
  is_vip BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',

  -- Engagement stats
  message_count INTEGER DEFAULT 0,
  last_contacted_at TIMESTAMPTZ,
  first_contacted_at TIMESTAMPTZ,
  avg_response_time_hours DECIMAL(10,2),

  -- Source tracking
  sources TEXT[] DEFAULT '{}', -- ['gmail', 'linkedin', 'crm']

  -- Enrichment
  enrichment_data JSONB DEFAULT '{}',
  enriched_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, email),
  UNIQUE(user_id, phone)
);

-- =====================================================
-- SYNC LOGS
-- =====================================================

CREATE TABLE IF NOT EXISTS inbox_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES inbox_connected_accounts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL,

  -- Sync details
  sync_type TEXT NOT NULL, -- 'full', 'incremental', 'manual'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Results
  status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed', 'cancelled'
  messages_synced INTEGER DEFAULT 0,
  messages_created INTEGER DEFAULT 0,
  messages_updated INTEGER DEFAULT 0,
  messages_skipped INTEGER DEFAULT 0,

  -- Error tracking
  error_message TEXT,
  error_details JSONB,

  -- Cursor state
  cursor_before TEXT,
  cursor_after TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SNOOZE QUEUE
-- =====================================================

CREATE TABLE IF NOT EXISTS inbox_snooze_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  thread_id UUID REFERENCES unified_threads(id) ON DELETE CASCADE,
  message_id UUID REFERENCES unified_messages(id) ON DELETE CASCADE,

  snooze_until TIMESTAMPTZ NOT NULL,
  reason TEXT,

  -- Processing
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT snooze_has_target CHECK (thread_id IS NOT NULL OR message_id IS NOT NULL)
);

-- =====================================================
-- QUICK ACTIONS LOG (for undo functionality)
-- =====================================================

CREATE TABLE IF NOT EXISTS inbox_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Action details
  action_type TEXT NOT NULL, -- 'archive', 'trash', 'star', 'read', 'snooze', 'categorize'
  target_type TEXT NOT NULL, -- 'message', 'thread'
  target_id UUID NOT NULL,

  -- State before action (for undo)
  previous_state JSONB NOT NULL,

  -- Undo tracking
  undone BOOLEAN DEFAULT false,
  undone_at TIMESTAMPTZ,

  -- Expiry (actions can only be undone for a limited time)
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AI REPLY DRAFTS
-- =====================================================

CREATE TABLE IF NOT EXISTS inbox_ai_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  thread_id UUID REFERENCES unified_threads(id) ON DELETE CASCADE,
  message_id UUID REFERENCES unified_messages(id) ON DELETE CASCADE,

  -- Draft content
  subject TEXT,
  body_text TEXT,
  body_html TEXT,

  -- AI generation info
  tone TEXT, -- 'professional', 'casual', 'friendly', 'formal'
  instruction TEXT, -- User's instruction to AI
  model_used TEXT,

  -- Status
  status TEXT DEFAULT 'draft', -- 'draft', 'approved', 'sent', 'discarded'

  -- Alternatives
  alternatives JSONB DEFAULT '[]', -- [{body_text, tone}]

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- KEYBOARD SHORTCUTS PREFERENCES
-- =====================================================

CREATE TABLE IF NOT EXISTS inbox_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,

  -- Display preferences
  default_view TEXT DEFAULT 'inbox', -- 'inbox', 'unread', 'starred', 'all'
  messages_per_page INTEGER DEFAULT 50,
  preview_style TEXT DEFAULT 'comfortable', -- 'comfortable', 'compact', 'cozy'

  -- Keyboard shortcuts enabled
  keyboard_shortcuts_enabled BOOLEAN DEFAULT true,
  custom_shortcuts JSONB DEFAULT '{}', -- Override default shortcuts

  -- AI preferences
  ai_suggestions_enabled BOOLEAN DEFAULT true,
  auto_categorize_enabled BOOLEAN DEFAULT true,
  smart_reply_enabled BOOLEAN DEFAULT true,

  -- Notification preferences
  notification_sound BOOLEAN DEFAULT true,
  desktop_notifications BOOLEAN DEFAULT true,
  email_digest TEXT DEFAULT 'none', -- 'none', 'daily', 'weekly'

  -- Channel-specific settings
  channel_settings JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CAMPAIGN REPLY MATCHING RULES
-- =====================================================

CREATE TABLE IF NOT EXISTS inbox_campaign_matchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  campaign_id UUID, -- Links to outreach_campaigns

  -- Matching criteria
  match_type TEXT NOT NULL, -- 'subject', 'from_domain', 'thread', 'custom'
  match_pattern TEXT, -- Regex or exact match

  -- Priority for conflict resolution
  priority INTEGER DEFAULT 0,

  -- Active status
  is_active BOOLEAN DEFAULT true,

  -- Stats
  matches_count INTEGER DEFAULT 0,
  last_match_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Unified Messages indexes
CREATE INDEX IF NOT EXISTS idx_unified_messages_user ON unified_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_messages_thread ON unified_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_unified_messages_channel ON unified_messages(channel);
CREATE INDEX IF NOT EXISTS idx_unified_messages_account ON unified_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_unified_messages_received ON unified_messages(received_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_unified_messages_unread ON unified_messages(user_id, is_read) WHERE is_read = false AND is_archived = false AND is_trashed = false;
CREATE INDEX IF NOT EXISTS idx_unified_messages_starred ON unified_messages(user_id) WHERE is_starred = true;
CREATE INDEX IF NOT EXISTS idx_unified_messages_archived ON unified_messages(user_id) WHERE is_archived = true;
CREATE INDEX IF NOT EXISTS idx_unified_messages_campaign_reply ON unified_messages(user_id, is_campaign_reply) WHERE is_campaign_reply = true;
CREATE INDEX IF NOT EXISTS idx_unified_messages_contact ON unified_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_unified_messages_from ON unified_messages(from_address);
CREATE INDEX IF NOT EXISTS idx_unified_messages_labels ON unified_messages USING GIN(labels);
CREATE INDEX IF NOT EXISTS idx_unified_messages_channel_id ON unified_messages(channel, channel_message_id);

-- Full-text search on messages
CREATE INDEX IF NOT EXISTS idx_unified_messages_body_fts ON unified_messages USING GIN(to_tsvector('english', COALESCE(body_text, '')));
CREATE INDEX IF NOT EXISTS idx_unified_messages_subject_fts ON unified_messages USING GIN(to_tsvector('english', COALESCE(subject, '')));

-- Unified Threads indexes
CREATE INDEX IF NOT EXISTS idx_unified_threads_user ON unified_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_threads_last_message ON unified_threads(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_unified_threads_unread ON unified_threads(user_id, is_read) WHERE is_read = false AND is_archived = false AND is_trashed = false;
CREATE INDEX IF NOT EXISTS idx_unified_threads_campaign ON unified_threads(user_id, is_campaign_reply) WHERE is_campaign_reply = true;
CREATE INDEX IF NOT EXISTS idx_unified_threads_category ON unified_threads(user_id, ai_category);
CREATE INDEX IF NOT EXISTS idx_unified_threads_priority ON unified_threads(user_id, ai_priority);

-- Connected Accounts indexes
CREATE INDEX IF NOT EXISTS idx_inbox_accounts_user ON inbox_connected_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_accounts_channel ON inbox_connected_accounts(channel);
CREATE INDEX IF NOT EXISTS idx_inbox_accounts_sync ON inbox_connected_accounts(sync_status) WHERE is_active = true;

-- Contacts indexes
CREATE INDEX IF NOT EXISTS idx_inbox_contacts_user ON inbox_unified_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_contacts_email ON inbox_unified_contacts(email);
CREATE INDEX IF NOT EXISTS idx_inbox_contacts_phone ON inbox_unified_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_inbox_contacts_company ON inbox_unified_contacts(company);
CREATE INDEX IF NOT EXISTS idx_inbox_contacts_vip ON inbox_unified_contacts(user_id) WHERE is_vip = true;

-- Sync logs indexes
CREATE INDEX IF NOT EXISTS idx_inbox_sync_logs_account ON inbox_sync_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_inbox_sync_logs_status ON inbox_sync_logs(status) WHERE status = 'running';

-- Snooze queue indexes
CREATE INDEX IF NOT EXISTS idx_inbox_snooze_due ON inbox_snooze_queue(snooze_until) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_inbox_snooze_user ON inbox_snooze_queue(user_id);

-- Action log indexes
CREATE INDEX IF NOT EXISTS idx_inbox_actions_user ON inbox_action_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_actions_undoable ON inbox_action_log(user_id, expires_at) WHERE undone = false;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update thread stats when message is added
CREATE OR REPLACE FUNCTION update_thread_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update thread message count and last_message_at
  UPDATE unified_threads
  SET
    message_count = (
      SELECT COUNT(*) FROM unified_messages WHERE thread_id = NEW.thread_id
    ),
    unread_count = (
      SELECT COUNT(*) FROM unified_messages WHERE thread_id = NEW.thread_id AND is_read = false
    ),
    is_read = NOT EXISTS (
      SELECT 1 FROM unified_messages WHERE thread_id = NEW.thread_id AND is_read = false
    ),
    last_message_at = GREATEST(last_message_at, COALESCE(NEW.received_at, NEW.sent_at, NOW())),
    snippet = NEW.snippet,
    updated_at = NOW()
  WHERE id = NEW.thread_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for message insert
DROP TRIGGER IF EXISTS trigger_update_thread_on_message ON unified_messages;
CREATE TRIGGER trigger_update_thread_on_message
AFTER INSERT ON unified_messages
FOR EACH ROW
WHEN (NEW.thread_id IS NOT NULL)
EXECUTE FUNCTION update_thread_stats();

-- Function to update thread read status when message is marked read
CREATE OR REPLACE FUNCTION update_thread_read_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read <> OLD.is_read THEN
    UPDATE unified_threads
    SET
      unread_count = (
        SELECT COUNT(*) FROM unified_messages WHERE thread_id = NEW.thread_id AND is_read = false
      ),
      is_read = NOT EXISTS (
        SELECT 1 FROM unified_messages WHERE thread_id = NEW.thread_id AND is_read = false
      ),
      updated_at = NOW()
    WHERE id = NEW.thread_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for message read status change
DROP TRIGGER IF EXISTS trigger_update_thread_read ON unified_messages;
CREATE TRIGGER trigger_update_thread_read
AFTER UPDATE ON unified_messages
FOR EACH ROW
WHEN (NEW.thread_id IS NOT NULL AND NEW.is_read <> OLD.is_read)
EXECUTE FUNCTION update_thread_read_status();

-- Function to process due snoozes
CREATE OR REPLACE FUNCTION process_due_snoozes()
RETURNS INTEGER AS $$
DECLARE
  processed_count INTEGER := 0;
  snooze_record RECORD;
BEGIN
  FOR snooze_record IN
    SELECT * FROM inbox_snooze_queue
    WHERE snooze_until <= NOW() AND processed = false
  LOOP
    -- Unsnooze thread
    IF snooze_record.thread_id IS NOT NULL THEN
      UPDATE unified_threads
      SET is_snoozed = false, snooze_until = NULL, updated_at = NOW()
      WHERE id = snooze_record.thread_id;
    END IF;

    -- Unsnooze message
    IF snooze_record.message_id IS NOT NULL THEN
      UPDATE unified_messages
      SET is_snoozed = false, snooze_until = NULL, updated_at = NOW()
      WHERE id = snooze_record.message_id;
    END IF;

    -- Mark as processed
    UPDATE inbox_snooze_queue
    SET processed = true, processed_at = NOW()
    WHERE id = snooze_record.id;

    processed_count := processed_count + 1;
  END LOOP;

  RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- Function to match campaign replies
CREATE OR REPLACE FUNCTION match_campaign_reply()
RETURNS TRIGGER AS $$
DECLARE
  campaign_match RECORD;
BEGIN
  -- Only check inbound messages
  IF NEW.direction <> 'inbound' THEN
    RETURN NEW;
  END IF;

  -- Try to find matching outreach message by email thread/subject
  SELECT om.id, om.campaign_id, oc.email
  INTO campaign_match
  FROM outreach_messages om
  JOIN outreach_contacts oc ON om.contact_id = oc.id
  WHERE om.user_id = NEW.user_id
    AND om.status = 'sent'
    AND (
      -- Match by from email
      oc.email = NEW.from_address
      -- Or match by subject similarity
      OR SIMILARITY(LOWER(NEW.subject), LOWER(om.subject)) > 0.7
    )
  ORDER BY om.sent_at DESC
  LIMIT 1;

  IF campaign_match.id IS NOT NULL THEN
    NEW.is_campaign_reply := true;
    NEW.matched_outreach_message_id := campaign_match.id;
    NEW.matched_campaign_id := campaign_match.campaign_id;
    NEW.ai_category := 'campaign_reply';
    NEW.campaign_match_confidence := 0.85;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for campaign reply matching
DROP TRIGGER IF EXISTS trigger_match_campaign_reply ON unified_messages;
CREATE TRIGGER trigger_match_campaign_reply
BEFORE INSERT ON unified_messages
FOR EACH ROW
EXECUTE FUNCTION match_campaign_reply();

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- Inbox view (unread, non-archived)
CREATE OR REPLACE VIEW inbox_view AS
SELECT
  t.*,
  (
    SELECT json_agg(json_build_object(
      'id', m.id,
      'snippet', m.snippet,
      'from_name', m.from_name,
      'received_at', m.received_at
    ) ORDER BY m.received_at DESC)
    FROM unified_messages m
    WHERE m.thread_id = t.id
    LIMIT 3
  ) as recent_messages
FROM unified_threads t
WHERE t.is_archived = false
  AND t.is_trashed = false
  AND t.is_spam = false
ORDER BY t.last_message_at DESC NULLS LAST;

-- Campaign replies view
CREATE OR REPLACE VIEW campaign_replies_view AS
SELECT
  m.*,
  oc.name as campaign_name,
  ocon.full_name as contact_name,
  ocon.company_name as contact_company
FROM unified_messages m
LEFT JOIN outreach_campaigns oc ON m.matched_campaign_id = oc.id
LEFT JOIN outreach_contacts ocon ON m.contact_id = ocon.id::uuid
WHERE m.is_campaign_reply = true
ORDER BY m.received_at DESC;
