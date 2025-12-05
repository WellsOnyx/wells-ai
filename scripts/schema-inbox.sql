-- Unified Inbox Schema for Wells AI
-- All messages from all channels in one place

-- Conversations table (threads)
CREATE TABLE IF NOT EXISTS inbox_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact info (normalized across channels)
  contact_id TEXT NOT NULL,  -- Unique identifier for the contact
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  contact_company TEXT,

  -- Conversation metadata
  subject TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'slack', 'chat', 'whatsapp')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'archived')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- AI classification
  intent TEXT,  -- What the contact wants (quote, support, sales, etc.)
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  category TEXT,  -- Auto-categorized topic

  -- Assignment
  assigned_to TEXT,  -- User ID of assigned team member

  -- Tracking
  unread_count INTEGER DEFAULT 1,
  last_message_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_message_preview TEXT,

  -- Lead link (if converted to lead)
  lead_id UUID,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Messages table (individual messages within conversations)
CREATE TABLE IF NOT EXISTS inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES inbox_conversations(id) ON DELETE CASCADE,

  -- Message content
  content TEXT NOT NULL,
  content_html TEXT,  -- For rich email content

  -- Direction and sender
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('contact', 'user', 'ai', 'system')),
  sender_id TEXT,  -- User ID if sent by team member
  sender_name TEXT,

  -- Channel-specific metadata
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'slack', 'chat', 'whatsapp')),
  channel_message_id TEXT,  -- Original message ID from channel (Twilio SID, email Message-ID, etc.)

  -- Email-specific fields
  email_subject TEXT,
  email_from TEXT,
  email_to TEXT,
  email_cc TEXT,
  email_attachments JSONB DEFAULT '[]',

  -- SMS-specific fields
  sms_from TEXT,
  sms_to TEXT,

  -- AI metadata
  ai_generated BOOLEAN DEFAULT FALSE,
  ai_approved BOOLEAN,  -- NULL = not AI, TRUE = approved, FALSE = rejected
  ai_approved_by TEXT,
  ai_approved_at TIMESTAMP,

  -- Status
  status TEXT DEFAULT 'sent' CHECK (status IN ('draft', 'pending_approval', 'sending', 'sent', 'delivered', 'failed', 'read')),
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP
);

-- Quick replies / canned responses
CREATE TABLE IF NOT EXISTS inbox_quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  shortcut TEXT,  -- e.g., "/thanks" to insert
  channel TEXT,  -- NULL = all channels
  created_by TEXT,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Message templates for AI
CREATE TABLE IF NOT EXISTS inbox_ai_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  example_input TEXT,
  example_output TEXT,
  category TEXT,  -- sales, support, quotes, etc.
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_contact ON inbox_conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_status ON inbox_conversations(status);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_channel ON inbox_conversations(channel);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_last_message ON inbox_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_assigned ON inbox_conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_unread ON inbox_conversations(unread_count) WHERE unread_count > 0;

CREATE INDEX IF NOT EXISTS idx_inbox_messages_conversation ON inbox_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_created ON inbox_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_channel ON inbox_messages(channel);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_pending ON inbox_messages(status) WHERE status = 'pending_approval';

-- Full-text search on messages
CREATE INDEX IF NOT EXISTS idx_inbox_messages_content_search ON inbox_messages USING gin(to_tsvector('english', content));
