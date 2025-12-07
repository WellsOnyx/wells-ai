-- ============================================
-- COLD START - MULTI-CHANNEL OUTREACH SCHEMA
-- ============================================
-- Revolutionary GTM beyond email:
-- Voice AI, LinkedIn, In-ERP, RCS/WhatsApp
-- ============================================

-- Cold Start Campaigns
CREATE TABLE IF NOT EXISTS coldstart_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT,
  icp_config JSONB NOT NULL,
  channels JSONB NOT NULL DEFAULT '[]',
  geo TEXT DEFAULT 'United States',
  daily_volume INTEGER DEFAULT 50,
  status TEXT DEFAULT 'draft', -- draft, active, paused, completed

  -- Metrics
  total_contacts INTEGER DEFAULT 0,
  total_reached INTEGER DEFAULT 0,
  total_responses INTEGER DEFAULT 0,
  total_meetings INTEGER DEFAULT 0,
  total_deals INTEGER DEFAULT 0,

  -- Costs
  total_spend DECIMAL(12, 2) DEFAULT 0,

  -- Timing
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Campaign Contacts (imported from Apollo, ZoomInfo, etc.)
CREATE TABLE IF NOT EXISTS coldstart_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES coldstart_campaigns(id),

  -- Contact info
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,

  -- Company info
  company_name TEXT,
  company_domain TEXT,
  company_size TEXT,
  industry TEXT,

  -- Professional info
  title TEXT,
  department TEXT,
  seniority TEXT,

  -- Enrichment data
  apollo_id TEXT,
  zoominfo_id TEXT,
  linkedin_id TEXT,
  enrichment_data JSONB,

  -- Status tracking
  status TEXT DEFAULT 'pending', -- pending, queued, contacted, responded, meeting_scheduled, converted, unsubscribed
  last_contacted_at TIMESTAMP,
  last_response_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cold Start Activities (all outreach actions)
CREATE TABLE IF NOT EXISTS coldstart_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES coldstart_campaigns(id),
  contact_id UUID REFERENCES coldstart_contacts(id),

  activity_type TEXT NOT NULL, -- call_initiated, call_completed, email_sent, linkedin_connection, linkedin_message, sms_sent, video_sent, meeting_scheduled
  channel TEXT NOT NULL, -- voice, linkedin, email, rcs, video, erp_presence

  -- Activity details
  message TEXT,
  details JSONB,

  -- For calls
  call_duration_seconds INTEGER,
  call_recording_url TEXT,
  call_transcript TEXT,

  -- Outcome
  outcome TEXT, -- success, failed, no_answer, voicemail, busy, rejected
  sentiment TEXT, -- positive, neutral, negative
  next_action TEXT,

  -- Provider info
  provider TEXT, -- vapi, bland, twilio, phantombuster, heygen
  provider_id TEXT,
  provider_response JSONB,

  -- Cost
  cost DECIMAL(8, 4) DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Cold Start Conversations (multi-turn tracking)
CREATE TABLE IF NOT EXISTS coldstart_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES coldstart_campaigns(id),
  contact_id UUID REFERENCES coldstart_contacts(id),

  channel TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- active, completed, paused

  -- Conversation summary
  messages JSONB DEFAULT '[]',
  total_messages INTEGER DEFAULT 0,
  last_message_at TIMESTAMP,

  -- AI analysis
  intent_signals JSONB,
  buying_stage TEXT, -- awareness, consideration, decision
  pain_points JSONB,

  -- Outcome
  outcome TEXT,
  meeting_scheduled_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Voice Call Logs (detailed)
CREATE TABLE IF NOT EXISTS coldstart_voice_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES coldstart_campaigns(id),
  contact_id UUID REFERENCES coldstart_contacts(id),
  activity_id UUID REFERENCES coldstart_activities(id),

  -- Call details
  phone_number TEXT,
  provider TEXT, -- vapi, bland
  provider_call_id TEXT,

  -- Status
  status TEXT, -- initiated, ringing, in_progress, completed, failed
  direction TEXT DEFAULT 'outbound',

  -- Timing
  initiated_at TIMESTAMP,
  answered_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INTEGER,

  -- Recording
  recording_url TEXT,
  transcript TEXT,
  transcript_json JSONB,

  -- AI Analysis
  summary TEXT,
  sentiment TEXT,
  key_topics JSONB,
  objections JSONB,
  next_actions JSONB,

  -- Outcome
  outcome TEXT, -- meeting_scheduled, interested, not_interested, callback_requested, voicemail, no_answer
  meeting_details JSONB,

  -- Cost
  cost DECIMAL(8, 4),

  created_at TIMESTAMP DEFAULT NOW()
);

-- LinkedIn Activities (detailed)
CREATE TABLE IF NOT EXISTS coldstart_linkedin_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES coldstart_campaigns(id),
  contact_id UUID REFERENCES coldstart_contacts(id),

  action_type TEXT, -- profile_view, connection_request, message, post_like, post_comment
  linkedin_url TEXT,

  -- Content
  message_content TEXT,
  post_url TEXT,

  -- Status
  status TEXT, -- pending, sent, accepted, replied, ignored
  sent_at TIMESTAMP,
  response_at TIMESTAMP,

  -- Response
  response_content TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- ICP Templates (saved configurations)
CREATE TABLE IF NOT EXISTS coldstart_icp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  name TEXT NOT NULL,
  title TEXT, -- e.g., "Chief Procurement Officer"
  keywords JSONB,
  industries JSONB,
  company_size TEXT,
  geo TEXT,

  -- Messaging
  pain_points JSONB,
  value_props JSONB,

  -- Scripts
  voice_script JSONB,
  linkedin_script JSONB,
  email_script JSONB,

  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Integrations (connected services)
CREATE TABLE IF NOT EXISTS coldstart_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  provider TEXT NOT NULL, -- apollo, zoominfo, vapi, bland, phantombuster, twilio, heygen
  status TEXT DEFAULT 'pending', -- pending, connected, disconnected, error

  -- Credentials (encrypted in production)
  api_key TEXT,
  config JSONB,

  -- Usage
  credits_remaining INTEGER,
  last_sync_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_coldstart_campaigns_user ON coldstart_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_coldstart_campaigns_status ON coldstart_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_coldstart_contacts_campaign ON coldstart_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_coldstart_contacts_status ON coldstart_contacts(status);
CREATE INDEX IF NOT EXISTS idx_coldstart_activities_campaign ON coldstart_activities(campaign_id);
CREATE INDEX IF NOT EXISTS idx_coldstart_activities_contact ON coldstart_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_coldstart_activities_type ON coldstart_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_coldstart_voice_calls_campaign ON coldstart_voice_calls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_coldstart_linkedin_campaign ON coldstart_linkedin_activities(campaign_id);
