-- ============================================
-- COLD START & OUTREACH SYSTEM SCHEMA
-- ============================================
-- Conversational cold-start for 150K+ contacts
-- Personalized outreach, not spam
-- Wells has a soul
-- ============================================

-- =====================================================
-- CONTACT UPLOADS (Batch Tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS contact_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Upload metadata
  filename TEXT,
  file_size_bytes INTEGER,
  total_rows INTEGER,

  -- Parsing results
  valid_contacts INTEGER DEFAULT 0,
  duplicate_contacts INTEGER DEFAULT 0,
  invalid_contacts INTEGER DEFAULT 0,
  enriched_contacts INTEGER DEFAULT 0,

  -- Column mapping (auto-detected or user-specified)
  column_mapping JSONB,
  -- e.g., { "email": "Email Address", "first_name": "First", "company": "Organization" }

  -- Processing status
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  error_message TEXT,

  -- Source tracking
  source TEXT, -- 'csv_upload', 'apollo', 'linkedin', 'manual'
  source_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CONTACTS (The 150K+ Contacts)
-- =====================================================

CREATE TABLE IF NOT EXISTS outreach_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  upload_id UUID REFERENCES contact_uploads(id),

  -- Primary contact info
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  twitter_handle TEXT,

  -- Name
  first_name TEXT,
  last_name TEXT,
  full_name TEXT GENERATED ALWAYS AS (
    COALESCE(first_name || ' ', '') || COALESCE(last_name, '')
  ) STORED,

  -- Professional info
  title TEXT,
  department TEXT,
  seniority TEXT, -- 'c_level', 'vp', 'director', 'manager', 'individual'

  -- Company info (enriched from email domain if not provided)
  company_name TEXT,
  company_domain TEXT,
  company_linkedin TEXT,
  company_size TEXT, -- 'startup', 'small', 'medium', 'enterprise'
  company_employee_count INTEGER,
  company_revenue_estimate DECIMAL(20,2),
  industry TEXT,

  -- Location
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'United States',
  timezone TEXT,

  -- ICP scoring
  icp_score INTEGER DEFAULT 0, -- 0-100
  icp_match_reasons JSONB, -- ['title_match', 'industry_match', 'size_match']
  segment TEXT, -- User-defined segment via conversation
  tags TEXT[] DEFAULT '{}',

  -- Enrichment
  enriched BOOLEAN DEFAULT false,
  enriched_at TIMESTAMPTZ,
  enrichment_source TEXT, -- 'clearbit', 'apollo', 'inferred'
  enrichment_data JSONB,

  -- Outreach status
  status TEXT DEFAULT 'new',
  -- new, qualified, contacted, responded, meeting_booked, converted, unsubscribed, bounced

  -- Engagement tracking
  last_contacted_at TIMESTAMPTZ,
  last_response_at TIMESTAMPTZ,
  total_messages_sent INTEGER DEFAULT 0,
  total_opens INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,

  -- Opt-out tracking
  unsubscribed BOOLEAN DEFAULT false,
  unsubscribed_at TIMESTAMPTZ,
  unsubscribe_reason TEXT,

  -- Duplicate prevention
  email_hash TEXT GENERATED ALWAYS AS (MD5(LOWER(TRIM(COALESCE(email, ''))))) STORED,

  -- Metadata
  source_row_data JSONB, -- Original row from CSV
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint on email per user (allow same contact for different users)
  UNIQUE(user_id, email_hash)
);

-- =====================================================
-- OUTREACH MESSAGES (What Was Sent)
-- =====================================================

CREATE TABLE IF NOT EXISTS outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  contact_id UUID REFERENCES outreach_contacts(id) ON DELETE CASCADE,

  -- Channel
  channel TEXT NOT NULL, -- 'email', 'twitter_dm', 'linkedin_dm', 'linkedin_connection', 'sms'

  -- Message content (personalized, not template)
  subject TEXT, -- For email
  body TEXT NOT NULL,

  -- AI generation metadata
  ai_generated BOOLEAN DEFAULT true,
  generation_prompt TEXT, -- What Wells was told about this person
  personalization_factors JSONB,
  -- { "used_title": true, "used_company": true, "mentioned_industry": true, "specific_hook": "recent funding" }

  -- Wells personality used
  personality_mode TEXT DEFAULT 'default', -- 'default', 'playful', 'direct', 'thoughtful'

  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  -- Delivery status
  status TEXT DEFAULT 'draft',
  -- draft, scheduled, sending, sent, delivered, opened, clicked, replied, bounced, failed

  -- Provider info
  provider TEXT, -- 'resend', 'twitter_api', 'linkedin_api', 'twilio'
  provider_message_id TEXT,
  provider_response JSONB,

  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Approval workflow (for first messages or sensitive outreach)
  requires_approval BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Cost tracking
  cost DECIMAL(8,4) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- OUTREACH EVENTS (Opens, Clicks, Replies)
-- =====================================================

CREATE TABLE IF NOT EXISTS outreach_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES outreach_messages(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES outreach_contacts(id) ON DELETE CASCADE,

  -- Event type
  event_type TEXT NOT NULL,
  -- sent, delivered, opened, clicked, replied, bounced, complained, unsubscribed

  -- Event metadata
  event_data JSONB,
  -- For clicks: { "link_url": "...", "link_text": "..." }
  -- For replies: { "reply_text": "...", "sentiment": "positive" }

  -- For replies - the actual response
  reply_content TEXT,
  reply_sentiment TEXT, -- 'positive', 'neutral', 'negative', 'interested', 'not_interested'
  reply_intent TEXT, -- 'meeting_request', 'question', 'decline', 'forward_to_colleague'

  -- Tracking
  ip_address TEXT,
  user_agent TEXT,
  location JSONB, -- { "city": "...", "country": "..." }

  -- Provider webhook data
  provider TEXT,
  provider_event_id TEXT,
  webhook_payload JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- BUYING SIGNALS (Detected Signals)
-- =====================================================

CREATE TABLE IF NOT EXISTS buying_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Signal source
  source TEXT NOT NULL, -- 'twitter', 'linkedin', 'news', 'job_board', 'funding_db', 'website'
  source_url TEXT,
  source_id TEXT, -- External ID from source

  -- Signal type
  signal_type TEXT NOT NULL,
  -- 'job_posting' - Hiring procurement/purchasing roles
  -- 'competitor_complaint' - Complaining about a competitor on X
  -- 'funding_announcement' - Just raised money
  -- 'expansion' - Opening new office, growing team
  -- 'contract_expiring' - Mentioned contract renewal
  -- 'pain_point_expressed' - Publicly mentioned a problem we solve
  -- 'decision_maker_change' - New VP/Director of Procurement

  -- Signal strength
  strength INTEGER DEFAULT 50, -- 0-100, how strong is this signal?
  confidence DECIMAL(5,2) DEFAULT 0.5, -- 0-1, how confident are we?

  -- Company info
  company_name TEXT,
  company_domain TEXT,
  company_linkedin TEXT,

  -- Person info (if signal is about a specific person)
  person_name TEXT,
  person_title TEXT,
  person_linkedin TEXT,
  person_twitter TEXT,

  -- Signal content
  title TEXT,
  description TEXT,
  raw_content TEXT, -- The actual tweet, job posting, article text
  extracted_keywords TEXT[],

  -- Signal metadata
  signal_date TIMESTAMPTZ, -- When did this signal occur?
  detected_at TIMESTAMPTZ DEFAULT NOW(),

  -- Processing status
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  matched_to_sellers BOOLEAN DEFAULT false,

  -- Expiry (signals go stale)
  expires_at TIMESTAMPTZ, -- Some signals are time-sensitive

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SIGNAL MATCHES (Signal -> Seller Matches)
-- =====================================================

CREATE TABLE IF NOT EXISTS signal_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES buying_signals(id) ON DELETE CASCADE,
  seller_user_id TEXT NOT NULL, -- The seller this signal matches

  -- Match scoring
  match_score INTEGER DEFAULT 0, -- 0-100
  match_reasons JSONB,
  -- ['icp_match', 'industry_match', 'location_match', 'solution_fit']

  -- Recommended action
  recommended_action TEXT, -- 'outreach_now', 'monitor', 'add_to_nurture'
  action_urgency TEXT DEFAULT 'normal', -- 'immediate', 'high', 'normal', 'low'

  -- Draft outreach (generated by Wells)
  draft_message TEXT,
  draft_channel TEXT, -- 'email', 'linkedin', 'twitter'
  draft_personalization JSONB, -- What Wells used to personalize

  -- Status
  status TEXT DEFAULT 'new', -- new, reviewed, approved, sent, dismissed

  -- User interaction
  viewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  dismiss_reason TEXT,

  -- If outreach was sent
  outreach_message_id UUID REFERENCES outreach_messages(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- OUTREACH CAMPAIGNS (Conversational Campaigns)
-- =====================================================

CREATE TABLE IF NOT EXISTS outreach_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Campaign basics
  name TEXT NOT NULL,
  description TEXT,

  -- Segment (defined via conversation)
  segment_criteria JSONB,
  -- { "titles": ["VP", "Director"], "industries": ["Manufacturing"], "company_size": ["medium", "enterprise"] }

  -- Wells personality for this campaign
  personality_mode TEXT DEFAULT 'default',
  custom_voice_notes TEXT, -- User's notes to Wells about tone

  -- Channel config
  channels TEXT[] DEFAULT ARRAY['email'],
  primary_channel TEXT DEFAULT 'email',

  -- Sending config
  daily_limit INTEGER DEFAULT 50,
  send_window_start INTEGER DEFAULT 9, -- 9 AM
  send_window_end INTEGER DEFAULT 17, -- 5 PM
  send_timezone TEXT DEFAULT 'America/New_York',
  send_days TEXT[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],

  -- NOT a sequence - one message only
  is_single_message BOOLEAN DEFAULT true,

  -- A/B testing (if enabled)
  ab_testing_enabled BOOLEAN DEFAULT false,

  -- Status
  status TEXT DEFAULT 'draft', -- draft, active, paused, completed
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Metrics (denormalized for quick access)
  total_contacts INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  total_meetings INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_unsubscribed INTEGER DEFAULT 0,

  -- Conversion
  open_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_delivered > 0 THEN (total_opened::DECIMAL / total_delivered * 100) ELSE 0 END
  ) STORED,
  reply_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_delivered > 0 THEN (total_replied::DECIMAL / total_delivered * 100) ELSE 0 END
  ) STORED,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CAMPAIGN CONTACTS (Link contacts to campaigns)
-- =====================================================

CREATE TABLE IF NOT EXISTS campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES outreach_contacts(id) ON DELETE CASCADE,

  -- Status within this campaign
  status TEXT DEFAULT 'queued', -- queued, sent, delivered, opened, replied, converted, skipped

  -- Skip reasons
  skipped_reason TEXT, -- 'unsubscribed', 'recently_contacted', 'no_email', 'low_icp_score'

  -- Message sent in this campaign
  message_id UUID REFERENCES outreach_messages(id),

  -- Timing
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(campaign_id, contact_id)
);

-- =====================================================
-- CONVERSATION CONTEXT (Chat State for Cold Start)
-- =====================================================

CREATE TABLE IF NOT EXISTS coldstart_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,

  -- Current state in the cold start flow
  flow_state TEXT DEFAULT 'initial',
  -- initial, uploading, parsing, segmenting, crafting, reviewing, sending, monitoring

  -- Context
  context JSONB DEFAULT '{}',
  -- Stores: activeUploadId, activeCampaignId, selectedSegment, etc.

  -- Messages (for continuity)
  message_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, session_id)
);

-- =====================================================
-- OUTREACH WINS (Celebrate!)
-- =====================================================

CREATE TABLE IF NOT EXISTS outreach_wins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  contact_id UUID REFERENCES outreach_contacts(id),
  campaign_id UUID REFERENCES outreach_campaigns(id),
  message_id UUID REFERENCES outreach_messages(id),

  -- Win type
  win_type TEXT NOT NULL, -- 'reply', 'meeting_booked', 'deal_started', 'deal_closed'

  -- Win details
  win_value DECIMAL(20,2), -- Dollar value if known
  win_description TEXT,

  -- The journey
  messages_sent INTEGER DEFAULT 1,
  time_to_win_hours INTEGER,

  -- Celebrated?
  celebrated BOOLEAN DEFAULT false,
  celebrated_at TIMESTAMPTZ,
  celebration_message TEXT, -- What Wells said to celebrate

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE (150K+ contacts)
-- =====================================================

-- Contact lookups
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_user ON outreach_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_email ON outreach_contacts(email);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_email_hash ON outreach_contacts(email_hash);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_company ON outreach_contacts(company_name);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_status ON outreach_contacts(status);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_segment ON outreach_contacts(segment);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_icp_score ON outreach_contacts(icp_score DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_tags ON outreach_contacts USING GIN(tags);

-- Fast segment queries
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_segment_query ON outreach_contacts(user_id, status, icp_score DESC);

-- Message lookups
CREATE INDEX IF NOT EXISTS idx_outreach_messages_user ON outreach_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_contact ON outreach_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_status ON outreach_messages(status);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_scheduled ON outreach_messages(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_outreach_messages_channel ON outreach_messages(channel);

-- Event lookups
CREATE INDEX IF NOT EXISTS idx_outreach_events_message ON outreach_events(message_id);
CREATE INDEX IF NOT EXISTS idx_outreach_events_contact ON outreach_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_outreach_events_type ON outreach_events(event_type);
CREATE INDEX IF NOT EXISTS idx_outreach_events_created ON outreach_events(created_at DESC);

-- Signal lookups
CREATE INDEX IF NOT EXISTS idx_buying_signals_type ON buying_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_buying_signals_company ON buying_signals(company_domain);
CREATE INDEX IF NOT EXISTS idx_buying_signals_unprocessed ON buying_signals(processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_buying_signals_date ON buying_signals(signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_buying_signals_expires ON buying_signals(expires_at) WHERE expires_at IS NOT NULL;

-- Match lookups
CREATE INDEX IF NOT EXISTS idx_signal_matches_seller ON signal_matches(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_signal_matches_signal ON signal_matches(signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_matches_status ON signal_matches(status);
CREATE INDEX IF NOT EXISTS idx_signal_matches_new ON signal_matches(seller_user_id, status) WHERE status = 'new';

-- Campaign lookups
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_user ON outreach_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_status ON outreach_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign ON campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_contact ON campaign_contacts(contact_id);

-- Upload tracking
CREATE INDEX IF NOT EXISTS idx_contact_uploads_user ON contact_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_uploads_status ON contact_uploads(status);

-- Win tracking
CREATE INDEX IF NOT EXISTS idx_outreach_wins_user ON outreach_wins(user_id);
CREATE INDEX IF NOT EXISTS idx_outreach_wins_type ON outreach_wins(win_type);
CREATE INDEX IF NOT EXISTS idx_outreach_wins_uncelebrated ON outreach_wins(user_id) WHERE celebrated = false;

-- Conversation state
CREATE INDEX IF NOT EXISTS idx_coldstart_conversations_user ON coldstart_conversations(user_id, session_id);

-- =====================================================
-- FUNCTIONS FOR COMMON OPERATIONS
-- =====================================================

-- Function to update contact stats after message event
CREATE OR REPLACE FUNCTION update_contact_stats_on_event()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE outreach_contacts
  SET
    total_opens = total_opens + CASE WHEN NEW.event_type = 'opened' THEN 1 ELSE 0 END,
    total_clicks = total_clicks + CASE WHEN NEW.event_type = 'clicked' THEN 1 ELSE 0 END,
    total_replies = total_replies + CASE WHEN NEW.event_type = 'replied' THEN 1 ELSE 0 END,
    last_response_at = CASE WHEN NEW.event_type = 'replied' THEN NOW() ELSE last_response_at END,
    status = CASE
      WHEN NEW.event_type = 'replied' AND status != 'converted' THEN 'responded'
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = NEW.contact_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_contact_stats
AFTER INSERT ON outreach_events
FOR EACH ROW
EXECUTE FUNCTION update_contact_stats_on_event();

-- Function to update campaign stats after message event
CREATE OR REPLACE FUNCTION update_campaign_stats_on_event()
RETURNS TRIGGER AS $$
DECLARE
  v_campaign_id UUID;
BEGIN
  -- Get campaign ID from message
  SELECT campaign_id INTO v_campaign_id
  FROM campaign_contacts
  WHERE message_id = NEW.message_id;

  IF v_campaign_id IS NOT NULL THEN
    UPDATE outreach_campaigns
    SET
      total_delivered = total_delivered + CASE WHEN NEW.event_type = 'delivered' THEN 1 ELSE 0 END,
      total_opened = total_opened + CASE WHEN NEW.event_type = 'opened' THEN 1 ELSE 0 END,
      total_clicked = total_clicked + CASE WHEN NEW.event_type = 'clicked' THEN 1 ELSE 0 END,
      total_replied = total_replied + CASE WHEN NEW.event_type = 'replied' THEN 1 ELSE 0 END,
      total_bounced = total_bounced + CASE WHEN NEW.event_type = 'bounced' THEN 1 ELSE 0 END,
      total_unsubscribed = total_unsubscribed + CASE WHEN NEW.event_type = 'unsubscribed' THEN 1 ELSE 0 END,
      updated_at = NOW()
    WHERE id = v_campaign_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_campaign_stats
AFTER INSERT ON outreach_events
FOR EACH ROW
EXECUTE FUNCTION update_campaign_stats_on_event();
