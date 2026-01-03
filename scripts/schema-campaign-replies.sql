-- ============================================
-- CAMPAIGN REPLY DETECTION SCHEMA
-- ============================================
-- Matches incoming messages to cold-start campaigns
-- Tracks reply metrics, A/B test results, sentiment
-- ============================================

-- =====================================================
-- CAMPAIGN VARIANTS (A/B Testing)
-- =====================================================

CREATE TABLE IF NOT EXISTS campaign_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE CASCADE,

  -- Variant identification
  name TEXT NOT NULL, -- 'A', 'B', 'Control', etc.
  description TEXT,

  -- Content variations
  subject_template TEXT,
  body_template TEXT,
  tone TEXT, -- 'professional', 'casual', 'direct', 'friendly'

  -- Distribution
  traffic_percentage INTEGER DEFAULT 50, -- Percentage of contacts to receive this variant

  -- Metrics
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  total_positive_replies INTEGER DEFAULT 0,
  total_negative_replies INTEGER DEFAULT 0,
  total_neutral_replies INTEGER DEFAULT 0,
  total_meetings_booked INTEGER DEFAULT 0,

  -- Calculated metrics (updated by triggers)
  open_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_delivered > 0 THEN (total_opened::DECIMAL / total_delivered * 100) ELSE 0 END
  ) STORED,
  reply_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_delivered > 0 THEN (total_replied::DECIMAL / total_delivered * 100) ELSE 0 END
  ) STORED,
  positive_reply_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_replied > 0 THEN (total_positive_replies::DECIMAL / total_replied * 100) ELSE 0 END
  ) STORED,

  -- Status
  is_winner BOOLEAN DEFAULT FALSE,
  winner_declared_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CAMPAIGN REPLY MATCHES
-- =====================================================

CREATE TABLE IF NOT EXISTS campaign_reply_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to inbox message
  inbox_message_id TEXT NOT NULL,
  inbox_thread_id TEXT,

  -- Link to campaign
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES campaign_variants(id) ON DELETE SET NULL,
  original_message_id UUID REFERENCES outreach_messages(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES outreach_contacts(id) ON DELETE SET NULL,

  -- Match method
  match_method TEXT NOT NULL, -- 'in_reply_to', 'references', 'subject', 'phone_number', 'email_thread', 'ai_inference'
  match_confidence DECIMAL(5,2) DEFAULT 1.0, -- 0-1 confidence score
  match_metadata JSONB, -- Additional match details

  -- Reply details
  channel TEXT NOT NULL, -- 'email', 'sms', 'linkedin', 'whatsapp'
  reply_from TEXT, -- Email/phone/handle
  reply_subject TEXT,
  reply_body TEXT,
  reply_received_at TIMESTAMPTZ NOT NULL,

  -- AI Analysis (populated by reply-analyzer)
  sentiment TEXT, -- 'positive', 'negative', 'neutral'
  sentiment_score DECIMAL(5,2), -- -1 to 1
  intent TEXT, -- 'interested', 'not_interested', 'meeting_request', 'question', 'forward_request', 'unsubscribe', 'out_of_office'
  intent_confidence DECIMAL(5,2),
  buying_signals JSONB, -- Detected buying signals
  objections JSONB, -- Detected objections
  key_phrases TEXT[],
  suggested_response TEXT,
  analysis_metadata JSONB,
  analyzed_at TIMESTAMPTZ,

  -- Hot lead scoring
  is_hot_lead BOOLEAN DEFAULT FALSE,
  lead_score INTEGER DEFAULT 0, -- 0-100
  lead_score_reasons JSONB,

  -- Notification status
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMPTZ,
  notification_channels TEXT[], -- ['sms', 'slack', 'email']

  -- Processing status
  status TEXT DEFAULT 'pending', -- 'pending', 'analyzed', 'notified', 'actioned', 'dismissed'
  actioned_at TIMESTAMPTZ,
  actioned_by TEXT,
  action_taken TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- REPLY NOTIFICATION SETTINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS reply_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,

  -- Global notification settings
  notifications_enabled BOOLEAN DEFAULT TRUE,

  -- Channel settings
  sms_enabled BOOLEAN DEFAULT TRUE,
  sms_phone TEXT,

  slack_enabled BOOLEAN DEFAULT TRUE,
  slack_webhook_url TEXT,
  slack_channel TEXT,

  email_enabled BOOLEAN DEFAULT TRUE,
  notification_email TEXT,

  push_enabled BOOLEAN DEFAULT FALSE,
  push_token TEXT,

  -- Alert conditions
  alert_on_all_replies BOOLEAN DEFAULT FALSE,
  alert_on_positive_only BOOLEAN DEFAULT TRUE,
  alert_on_meeting_requests BOOLEAN DEFAULT TRUE,
  alert_on_questions BOOLEAN DEFAULT TRUE,
  min_lead_score_for_alert INTEGER DEFAULT 60,

  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '07:00',
  quiet_hours_timezone TEXT DEFAULT 'America/New_York',

  -- Rate limiting
  max_alerts_per_hour INTEGER DEFAULT 20,
  digest_mode BOOLEAN DEFAULT FALSE, -- Batch notifications instead of real-time
  digest_frequency TEXT DEFAULT 'hourly', -- 'hourly', 'daily'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- REPLY NOTIFICATION LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS reply_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  reply_match_id UUID REFERENCES campaign_reply_matches(id) ON DELETE CASCADE,

  -- Notification details
  channel TEXT NOT NULL, -- 'sms', 'slack', 'email', 'push'
  recipient TEXT NOT NULL, -- Phone/webhook/email/token

  -- Content
  title TEXT,
  body TEXT,
  metadata JSONB,

  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed', 'clicked'
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  error_message TEXT,

  -- Provider info
  provider TEXT, -- 'twilio', 'slack', 'resend', 'pusher'
  provider_message_id TEXT,
  provider_response JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CAMPAIGN REPLY STATS (Aggregated metrics)
-- =====================================================

CREATE TABLE IF NOT EXISTS campaign_reply_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE CASCADE UNIQUE,

  -- Overall reply metrics
  total_replies INTEGER DEFAULT 0,
  unique_repliers INTEGER DEFAULT 0,
  avg_reply_time_hours DECIMAL(8,2),

  -- Sentiment breakdown
  positive_replies INTEGER DEFAULT 0,
  negative_replies INTEGER DEFAULT 0,
  neutral_replies INTEGER DEFAULT 0,

  -- Intent breakdown
  interested_replies INTEGER DEFAULT 0,
  not_interested_replies INTEGER DEFAULT 0,
  meeting_request_replies INTEGER DEFAULT 0,
  question_replies INTEGER DEFAULT 0,
  forward_request_replies INTEGER DEFAULT 0,
  unsubscribe_replies INTEGER DEFAULT 0,
  out_of_office_replies INTEGER DEFAULT 0,

  -- Conversion metrics
  hot_leads_generated INTEGER DEFAULT 0,
  meetings_booked INTEGER DEFAULT 0,
  deals_started INTEGER DEFAULT 0,

  -- Best performing content
  best_subject_line TEXT,
  best_variant_id UUID REFERENCES campaign_variants(id),

  -- Time-based analysis
  peak_reply_hour INTEGER, -- 0-23
  peak_reply_day TEXT, -- 'monday', 'tuesday', etc.

  -- Last analysis
  last_analyzed_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SMS REPLY MATCHING (Phone-based matching)
-- =====================================================

CREATE TABLE IF NOT EXISTS sms_outreach_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES campaign_variants(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES outreach_contacts(id) ON DELETE SET NULL,
  message_id UUID REFERENCES outreach_messages(id) ON DELETE SET NULL,

  -- Phone numbers
  from_phone TEXT NOT NULL,
  to_phone TEXT NOT NULL,
  to_phone_normalized TEXT NOT NULL, -- E.164 format for matching

  -- Message content
  body TEXT NOT NULL,

  -- Provider info
  provider_message_id TEXT,

  -- Timing
  sent_at TIMESTAMPTZ DEFAULT NOW(),

  -- Used for reply window matching
  reply_window_expires_at TIMESTAMPTZ, -- Only match replies within this window

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Campaign variants
CREATE INDEX IF NOT EXISTS idx_campaign_variants_campaign ON campaign_variants(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_variants_winner ON campaign_variants(campaign_id, is_winner) WHERE is_winner = TRUE;

-- Reply matches
CREATE INDEX IF NOT EXISTS idx_campaign_reply_matches_inbox ON campaign_reply_matches(inbox_message_id);
CREATE INDEX IF NOT EXISTS idx_campaign_reply_matches_campaign ON campaign_reply_matches(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_reply_matches_contact ON campaign_reply_matches(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_reply_matches_status ON campaign_reply_matches(status);
CREATE INDEX IF NOT EXISTS idx_campaign_reply_matches_hot ON campaign_reply_matches(is_hot_lead) WHERE is_hot_lead = TRUE;
CREATE INDEX IF NOT EXISTS idx_campaign_reply_matches_sentiment ON campaign_reply_matches(sentiment);
CREATE INDEX IF NOT EXISTS idx_campaign_reply_matches_intent ON campaign_reply_matches(intent);
CREATE INDEX IF NOT EXISTS idx_campaign_reply_matches_received ON campaign_reply_matches(reply_received_at DESC);

-- Notification settings
CREATE INDEX IF NOT EXISTS idx_reply_notification_settings_user ON reply_notification_settings(user_id);

-- Notification log
CREATE INDEX IF NOT EXISTS idx_reply_notification_log_user ON reply_notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_reply_notification_log_match ON reply_notification_log(reply_match_id);
CREATE INDEX IF NOT EXISTS idx_reply_notification_log_status ON reply_notification_log(status);

-- Reply stats
CREATE INDEX IF NOT EXISTS idx_campaign_reply_stats_campaign ON campaign_reply_stats(campaign_id);

-- SMS log for phone matching
CREATE INDEX IF NOT EXISTS idx_sms_outreach_log_phone ON sms_outreach_log(to_phone_normalized);
CREATE INDEX IF NOT EXISTS idx_sms_outreach_log_campaign ON sms_outreach_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sms_outreach_log_window ON sms_outreach_log(to_phone_normalized, reply_window_expires_at)
  WHERE reply_window_expires_at > NOW();

-- =====================================================
-- ADD COLUMNS TO EXISTING TABLES
-- =====================================================

-- Add variant tracking to outreach_messages
ALTER TABLE outreach_messages
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES campaign_variants(id),
  ADD COLUMN IF NOT EXISTS in_reply_to_header TEXT,
  ADD COLUMN IF NOT EXISTS message_id_header TEXT,
  ADD COLUMN IF NOT EXISTS references_header TEXT[];

-- Add reply metrics to outreach_campaigns
ALTER TABLE outreach_campaigns
  ADD COLUMN IF NOT EXISTS total_positive_replies INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_negative_replies INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_neutral_replies INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_hot_leads INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_reply_sentiment DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ab_testing_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS winning_variant_id UUID REFERENCES campaign_variants(id);

-- Add campaign tracking to inbox messages
ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS is_campaign_reply BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS campaign_reply_match_id UUID REFERENCES campaign_reply_matches(id),
  ADD COLUMN IF NOT EXISTS in_reply_to_header TEXT,
  ADD COLUMN IF NOT EXISTS references_header TEXT[];

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update variant stats when a reply is matched
CREATE OR REPLACE FUNCTION update_variant_stats_on_reply()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.variant_id IS NOT NULL THEN
    UPDATE campaign_variants
    SET
      total_replied = total_replied + 1,
      total_positive_replies = total_positive_replies + CASE WHEN NEW.sentiment = 'positive' THEN 1 ELSE 0 END,
      total_negative_replies = total_negative_replies + CASE WHEN NEW.sentiment = 'negative' THEN 1 ELSE 0 END,
      total_neutral_replies = total_neutral_replies + CASE WHEN NEW.sentiment = 'neutral' THEN 1 ELSE 0 END,
      updated_at = NOW()
    WHERE id = NEW.variant_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for variant stats
DROP TRIGGER IF EXISTS trigger_update_variant_stats_on_reply ON campaign_reply_matches;
CREATE TRIGGER trigger_update_variant_stats_on_reply
AFTER INSERT ON campaign_reply_matches
FOR EACH ROW
WHEN (NEW.status = 'analyzed')
EXECUTE FUNCTION update_variant_stats_on_reply();

-- Function to update campaign reply stats
CREATE OR REPLACE FUNCTION update_campaign_reply_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update campaign totals
  IF NEW.campaign_id IS NOT NULL THEN
    UPDATE outreach_campaigns
    SET
      total_positive_replies = (
        SELECT COUNT(*) FROM campaign_reply_matches
        WHERE campaign_id = NEW.campaign_id AND sentiment = 'positive'
      ),
      total_negative_replies = (
        SELECT COUNT(*) FROM campaign_reply_matches
        WHERE campaign_id = NEW.campaign_id AND sentiment = 'negative'
      ),
      total_neutral_replies = (
        SELECT COUNT(*) FROM campaign_reply_matches
        WHERE campaign_id = NEW.campaign_id AND sentiment = 'neutral'
      ),
      total_hot_leads = (
        SELECT COUNT(*) FROM campaign_reply_matches
        WHERE campaign_id = NEW.campaign_id AND is_hot_lead = TRUE
      ),
      updated_at = NOW()
    WHERE id = NEW.campaign_id;

    -- Upsert campaign reply stats
    INSERT INTO campaign_reply_stats (campaign_id, total_replies, positive_replies, negative_replies, neutral_replies)
    VALUES (NEW.campaign_id, 1,
      CASE WHEN NEW.sentiment = 'positive' THEN 1 ELSE 0 END,
      CASE WHEN NEW.sentiment = 'negative' THEN 1 ELSE 0 END,
      CASE WHEN NEW.sentiment = 'neutral' THEN 1 ELSE 0 END
    )
    ON CONFLICT (campaign_id) DO UPDATE SET
      total_replies = campaign_reply_stats.total_replies + 1,
      positive_replies = campaign_reply_stats.positive_replies + CASE WHEN NEW.sentiment = 'positive' THEN 1 ELSE 0 END,
      negative_replies = campaign_reply_stats.negative_replies + CASE WHEN NEW.sentiment = 'negative' THEN 1 ELSE 0 END,
      neutral_replies = campaign_reply_stats.neutral_replies + CASE WHEN NEW.sentiment = 'neutral' THEN 1 ELSE 0 END,
      interested_replies = campaign_reply_stats.interested_replies + CASE WHEN NEW.intent = 'interested' THEN 1 ELSE 0 END,
      not_interested_replies = campaign_reply_stats.not_interested_replies + CASE WHEN NEW.intent = 'not_interested' THEN 1 ELSE 0 END,
      meeting_request_replies = campaign_reply_stats.meeting_request_replies + CASE WHEN NEW.intent = 'meeting_request' THEN 1 ELSE 0 END,
      question_replies = campaign_reply_stats.question_replies + CASE WHEN NEW.intent = 'question' THEN 1 ELSE 0 END,
      hot_leads_generated = campaign_reply_stats.hot_leads_generated + CASE WHEN NEW.is_hot_lead THEN 1 ELSE 0 END,
      last_analyzed_at = NOW(),
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for campaign reply stats
DROP TRIGGER IF EXISTS trigger_update_campaign_reply_stats ON campaign_reply_matches;
CREATE TRIGGER trigger_update_campaign_reply_stats
AFTER INSERT OR UPDATE ON campaign_reply_matches
FOR EACH ROW
WHEN (NEW.status = 'analyzed')
EXECUTE FUNCTION update_campaign_reply_stats();
