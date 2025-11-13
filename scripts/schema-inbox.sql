-- Inbound Messages & Unified Inbox Schema
-- Critical infrastructure for AI-to-AI communication

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- Inbound Messages Table
-- Unified storage for all inbound communications
CREATE TABLE IF NOT EXISTS inbound_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL, -- User who receives this message

  -- Channel information
  channel VARCHAR(50) NOT NULL, -- email, sms, slack, discord, teams, whatsapp, etc
  channel_message_id VARCHAR(500), -- Original message ID from the platform

  -- Sender information
  sender_id VARCHAR(255), -- Platform-specific sender ID
  sender_name VARCHAR(255),
  sender_email VARCHAR(255),
  sender_phone VARCHAR(50),
  sender_metadata JSONB DEFAULT '{}', -- Additional sender info

  -- Message content
  subject VARCHAR(1000), -- For email, null for others
  body TEXT NOT NULL,
  html_body TEXT, -- For email HTML content
  attachments JSONB DEFAULT '[]', -- Array of attachment objects

  -- Threading & conversation
  thread_id VARCHAR(500), -- Platform thread ID (email thread, SMS conversation, etc)
  internal_thread_id UUID, -- Our internal thread grouping
  parent_message_id UUID REFERENCES inbound_messages(id), -- For replies
  is_thread_start BOOLEAN DEFAULT false,

  -- AI Understanding (processed by Claude)
  intent VARCHAR(100), -- ask_question, request_meeting, provide_info, negotiate, etc
  urgency VARCHAR(20) DEFAULT 'normal', -- low, normal, high, critical
  sentiment VARCHAR(20), -- positive, neutral, negative
  entities JSONB DEFAULT '{}', -- Extracted entities (names, dates, amounts, etc)
  action_items JSONB DEFAULT '[]', -- Extracted action items
  requires_response BOOLEAN DEFAULT false,
  suggested_response TEXT, -- Wells-drafted response

  -- Processing status
  processed_at TIMESTAMP,
  responded_at TIMESTAMP,
  response_message_id UUID, -- Link to outbound message

  -- Raw data
  raw_payload JSONB, -- Complete webhook payload
  headers JSONB DEFAULT '{}', -- Request headers (for debugging)

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_inbound_messages_user ON inbound_messages(user_id);
CREATE INDEX idx_inbound_messages_channel ON inbound_messages(channel);
CREATE INDEX idx_inbound_messages_sender_email ON inbound_messages(sender_email);
CREATE INDEX idx_inbound_messages_sender_phone ON inbound_messages(sender_phone);
CREATE INDEX idx_inbound_messages_thread ON inbound_messages(thread_id);
CREATE INDEX idx_inbound_messages_internal_thread ON inbound_messages(internal_thread_id);
CREATE INDEX idx_inbound_messages_created ON inbound_messages(created_at DESC);
CREATE INDEX idx_inbound_messages_intent ON inbound_messages(intent);
CREATE INDEX idx_inbound_messages_urgency ON inbound_messages(urgency);
CREATE INDEX idx_inbound_messages_requires_response ON inbound_messages(requires_response) WHERE requires_response = true;
CREATE INDEX idx_inbound_messages_unprocessed ON inbound_messages(created_at) WHERE processed_at IS NULL;

-- Full text search on body and subject
CREATE INDEX idx_inbound_messages_body_search ON inbound_messages USING gin(to_tsvector('english', body));
CREATE INDEX idx_inbound_messages_subject_search ON inbound_messages USING gin(to_tsvector('english', COALESCE(subject, '')));

-- Message Threads Table
-- Track conversation threads across channels
CREATE TABLE IF NOT EXISTS message_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,

  -- Thread identification
  channel VARCHAR(50) NOT NULL,
  platform_thread_id VARCHAR(500), -- Platform's thread ID

  -- Thread metadata
  subject VARCHAR(1000), -- Thread subject (from first message)
  participants JSONB DEFAULT '[]', -- Array of participant objects
  message_count INTEGER DEFAULT 0,

  -- Thread status
  status VARCHAR(50) DEFAULT 'active', -- active, archived, closed
  last_message_at TIMESTAMP,

  -- AI context
  thread_summary TEXT, -- AI-generated summary of thread
  thread_context JSONB DEFAULT '{}', -- Extracted context/state

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_message_threads_user ON message_threads(user_id);
CREATE INDEX idx_message_threads_channel ON message_threads(channel);
CREATE INDEX idx_message_threads_platform_thread ON message_threads(platform_thread_id);
CREATE INDEX idx_message_threads_status ON message_threads(status);
CREATE INDEX idx_message_threads_last_message ON message_threads(last_message_at DESC);

-- Outbound Messages Table
-- Track Wells' responses
CREATE TABLE IF NOT EXISTS outbound_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,

  -- Reply context
  in_reply_to UUID REFERENCES inbound_messages(id),
  thread_id UUID REFERENCES message_threads(id),

  -- Channel information
  channel VARCHAR(50) NOT NULL,
  recipient_id VARCHAR(255),
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(50),

  -- Message content
  subject VARCHAR(1000),
  body TEXT NOT NULL,
  html_body TEXT,
  attachments JSONB DEFAULT '[]',

  -- Send status
  status VARCHAR(50) DEFAULT 'draft', -- draft, pending_approval, approved, sent, failed
  approved_by VARCHAR(255), -- User who approved (if manual approval required)
  approved_at TIMESTAMP,
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,

  -- Platform response
  platform_message_id VARCHAR(500), -- ID from email/SMS/Slack API
  platform_response JSONB, -- Full API response
  error_message TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_outbound_messages_user ON outbound_messages(user_id);
CREATE INDEX idx_outbound_messages_reply_to ON outbound_messages(in_reply_to);
CREATE INDEX idx_outbound_messages_thread ON outbound_messages(thread_id);
CREATE INDEX idx_outbound_messages_channel ON outbound_messages(channel);
CREATE INDEX idx_outbound_messages_status ON outbound_messages(status);
CREATE INDEX idx_outbound_messages_pending_approval ON outbound_messages(status) WHERE status = 'pending_approval';
CREATE INDEX idx_outbound_messages_created ON outbound_messages(created_at DESC);

-- Contact Book Table
-- Track relationships and communication patterns
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,

  -- Contact information
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  company VARCHAR(255),
  role VARCHAR(255),

  -- Communication channels
  slack_user_id VARCHAR(255),
  discord_user_id VARCHAR(255),
  teams_user_id VARCHAR(255),
  linkedin_url VARCHAR(500),

  -- Relationship metadata
  relationship_type VARCHAR(50), -- customer, supplier, partner, employee, investor, etc
  importance_score INTEGER DEFAULT 50, -- 0-100
  first_contact_date TIMESTAMP,
  last_contact_date TIMESTAMP,

  -- Communication stats
  total_messages_received INTEGER DEFAULT 0,
  total_messages_sent INTEGER DEFAULT 0,
  avg_response_time_minutes INTEGER,
  preferred_channel VARCHAR(50),

  -- AI insights
  communication_style TEXT, -- AI-analyzed communication patterns
  topics_discussed JSONB DEFAULT '[]', -- Array of topic strings
  relationship_notes TEXT, -- AI-generated relationship notes

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Ensure uniqueness per user
  UNIQUE(user_id, email),
  UNIQUE(user_id, phone)
);

CREATE INDEX idx_contacts_user ON contacts(user_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_contacts_relationship ON contacts(relationship_type);
CREATE INDEX idx_contacts_importance ON contacts(importance_score DESC);
CREATE INDEX idx_contacts_last_contact ON contacts(last_contact_date DESC);

-- Auto-Response Rules Table
-- User preferences for automated responses
CREATE TABLE IF NOT EXISTS auto_response_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,

  -- Rule configuration
  name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 50, -- Higher priority rules evaluated first

  -- Conditions (all must match)
  channel_filter VARCHAR(50), -- null = all channels
  sender_filter VARCHAR(255), -- null = all senders, or specific email/phone
  intent_filter VARCHAR(100), -- null = all intents
  urgency_filter VARCHAR(20), -- null = all urgencies
  keyword_filters JSONB DEFAULT '[]', -- Array of keywords to match
  time_window JSONB, -- e.g., {"days": ["mon", "tue"], "hours": [9, 17]}

  -- Action
  action_type VARCHAR(50) NOT NULL, -- auto_respond, notify_only, forward, ignore
  response_template TEXT, -- Template for auto-response
  forward_to VARCHAR(255), -- Email/phone to forward to

  -- Settings
  require_approval BOOLEAN DEFAULT false, -- Draft for approval vs auto-send
  cooldown_hours INTEGER DEFAULT 24, -- Don't auto-respond to same sender within X hours

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_auto_response_rules_user ON auto_response_rules(user_id);
CREATE INDEX idx_auto_response_rules_enabled ON auto_response_rules(enabled) WHERE enabled = true;
CREATE INDEX idx_auto_response_rules_priority ON auto_response_rules(priority DESC);

-- Message Attachments Table
-- Store attachment metadata and references
CREATE TABLE IF NOT EXISTS message_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID, -- Can be inbound or outbound
  message_type VARCHAR(20) NOT NULL, -- 'inbound' or 'outbound'

  -- Attachment info
  filename VARCHAR(500) NOT NULL,
  content_type VARCHAR(255),
  size_bytes BIGINT,

  -- Storage
  storage_provider VARCHAR(50), -- s3, vercel_blob, cloudinary, etc
  storage_url TEXT NOT NULL,
  storage_key VARCHAR(500),

  -- Processing
  extracted_text TEXT, -- For PDFs, images (OCR), etc
  ai_summary TEXT, -- Claude-generated summary

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_attachments_message ON message_attachments(message_id, message_type);
CREATE INDEX idx_attachments_content_type ON message_attachments(content_type);

-- Webhook Events Table
-- Log all webhook events for debugging and replay
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Webhook info
  source VARCHAR(50) NOT NULL, -- resend, twilio, slack, discord, etc
  event_type VARCHAR(100) NOT NULL,
  event_id VARCHAR(500), -- Platform's event ID

  -- Verification
  signature VARCHAR(500),
  signature_valid BOOLEAN,

  -- Payload
  raw_payload JSONB NOT NULL,
  headers JSONB DEFAULT '{}',

  -- Processing
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP,
  error_message TEXT,
  created_message_id UUID REFERENCES inbound_messages(id),

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_source ON webhook_events(source);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed) WHERE processed = false;
CREATE INDEX idx_webhook_events_created ON webhook_events(created_at DESC);

-- Functions and Triggers

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inbound_messages_updated_at BEFORE UPDATE ON inbound_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_message_threads_updated_at BEFORE UPDATE ON message_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_outbound_messages_updated_at BEFORE UPDATE ON outbound_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auto_response_rules_updated_at BEFORE UPDATE ON auto_response_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update thread message count
CREATE OR REPLACE FUNCTION update_thread_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE message_threads
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at
  WHERE id = NEW.internal_thread_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER increment_thread_message_count AFTER INSERT ON inbound_messages
  FOR EACH ROW
  WHEN (NEW.internal_thread_id IS NOT NULL)
  EXECUTE FUNCTION update_thread_message_count();

-- Auto-update contact stats
CREATE OR REPLACE FUNCTION update_contact_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or create contact
  INSERT INTO contacts (
    user_id,
    email,
    phone,
    name,
    first_contact_date,
    last_contact_date,
    total_messages_received,
    preferred_channel
  ) VALUES (
    NEW.user_id,
    NEW.sender_email,
    NEW.sender_phone,
    NEW.sender_name,
    NEW.created_at,
    NEW.created_at,
    1,
    NEW.channel
  )
  ON CONFLICT (user_id, email)
  DO UPDATE SET
    last_contact_date = NEW.created_at,
    total_messages_received = contacts.total_messages_received + 1,
    phone = COALESCE(contacts.phone, NEW.sender_phone),
    name = COALESCE(contacts.name, NEW.sender_name);

  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contact_on_message AFTER INSERT ON inbound_messages
  FOR EACH ROW
  WHEN (NEW.sender_email IS NOT NULL OR NEW.sender_phone IS NOT NULL)
  EXECUTE FUNCTION update_contact_stats();

-- Views for common queries

-- Inbox view (unprocessed messages requiring attention)
CREATE OR REPLACE VIEW inbox_pending AS
SELECT
  im.*,
  c.name as sender_contact_name,
  c.company as sender_company,
  c.relationship_type,
  c.importance_score as sender_importance,
  mt.subject as thread_subject,
  mt.message_count as thread_message_count
FROM inbound_messages im
LEFT JOIN contacts c ON im.sender_email = c.email AND im.user_id = c.user_id
LEFT JOIN message_threads mt ON im.internal_thread_id = mt.id
WHERE im.processed_at IS NULL
ORDER BY
  CASE im.urgency
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'normal' THEN 3
    WHEN 'low' THEN 4
  END,
  im.created_at ASC;

-- Messages requiring response
CREATE OR REPLACE VIEW messages_requiring_response AS
SELECT
  im.*,
  c.name as sender_contact_name,
  c.company as sender_company,
  c.avg_response_time_minutes as expected_response_time,
  EXTRACT(EPOCH FROM (NOW() - im.created_at))/60 as minutes_since_received
FROM inbound_messages im
LEFT JOIN contacts c ON im.sender_email = c.email AND im.user_id = c.user_id
WHERE im.requires_response = true
  AND im.responded_at IS NULL
ORDER BY im.urgency DESC, im.created_at ASC;

-- Thread summary view
CREATE OR REPLACE VIEW thread_summary AS
SELECT
  mt.*,
  COUNT(im.id) as actual_message_count,
  MAX(im.created_at) as actual_last_message,
  ARRAY_AGG(DISTINCT im.sender_email) FILTER (WHERE im.sender_email IS NOT NULL) as sender_emails
FROM message_threads mt
LEFT JOIN inbound_messages im ON mt.id = im.internal_thread_id
GROUP BY mt.id;
