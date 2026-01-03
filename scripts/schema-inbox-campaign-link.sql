-- ============================================
-- INBOX-CAMPAIGN LINKING SCHEMA
-- ============================================
-- Links unified inbox to cold start campaigns
-- Enables tracking replies to outreach campaigns
-- ============================================

-- =====================================================
-- ADD CAMPAIGN COLUMNS TO INBOX THREADS
-- =====================================================

-- Add campaign tracking columns to inbox_threads
ALTER TABLE inbox_threads
  ADD COLUMN IF NOT EXISTS campaign_id UUID,
  ADD COLUMN IF NOT EXISTS campaign_outreach_id UUID,
  ADD COLUMN IF NOT EXISTS campaign_contact_id UUID,
  ADD COLUMN IF NOT EXISTS campaign_match_method TEXT,
  ADD COLUMN IF NOT EXISTS campaign_match_confidence DECIMAL(3,2);

-- Add index for campaign-linked threads
CREATE INDEX IF NOT EXISTS idx_inbox_threads_campaign
  ON inbox_threads(campaign_id) WHERE campaign_id IS NOT NULL;

-- Add index for finding threads by campaign
CREATE INDEX IF NOT EXISTS idx_inbox_threads_campaign_replies
  ON inbox_threads(user_id, campaign_id)
  WHERE campaign_id IS NOT NULL;

-- =====================================================
-- ADD CAMPAIGN COLUMNS TO INBOX MESSAGES
-- =====================================================

-- For inbox_messages (original table)
ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS campaign_id UUID,
  ADD COLUMN IF NOT EXISTS campaign_outreach_id UUID,
  ADD COLUMN IF NOT EXISTS is_campaign_reply BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_inbox_messages_campaign
  ON inbox_messages(campaign_id) WHERE campaign_id IS NOT NULL;

-- =====================================================
-- ADD CAMPAIGN COLUMNS TO INBOX_MESSAGES_V2 (if exists)
-- =====================================================

-- inbox_messages_v2 may be an alias or separate table
-- Run these conditionally
DO $$
BEGIN
  -- Check if inbox_messages_v2 exists and add columns
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'inbox_messages_v2') THEN
    ALTER TABLE inbox_messages_v2
      ADD COLUMN IF NOT EXISTS campaign_id UUID,
      ADD COLUMN IF NOT EXISTS campaign_outreach_id UUID,
      ADD COLUMN IF NOT EXISTS is_campaign_reply BOOLEAN DEFAULT FALSE;

    CREATE INDEX IF NOT EXISTS idx_inbox_messages_v2_campaign
      ON inbox_messages_v2(campaign_id) WHERE campaign_id IS NOT NULL;
  END IF;
END $$;

-- =====================================================
-- ADD MESSAGE_ID_HEADER TO OUTREACH FOR THREAD MATCHING
-- =====================================================

-- Add email headers to coldstart_outreach for reply matching
ALTER TABLE coldstart_outreach
  ADD COLUMN IF NOT EXISTS message_id_header TEXT,
  ADD COLUMN IF NOT EXISTS in_reply_to_header TEXT,
  ADD COLUMN IF NOT EXISTS references_header TEXT[],
  ADD COLUMN IF NOT EXISTS replied INTEGER DEFAULT 0;

-- Index for header-based reply matching
CREATE INDEX IF NOT EXISTS idx_coldstart_outreach_message_id
  ON coldstart_outreach(message_id_header) WHERE message_id_header IS NOT NULL;

-- =====================================================
-- ADD REPLIED COUNT TO VARIANTS
-- =====================================================

ALTER TABLE coldstart_campaign_variants
  ADD COLUMN IF NOT EXISTS replied INTEGER DEFAULT 0;

-- =====================================================
-- JUNCTION TABLE FOR THREAD-CAMPAIGN LINKS
-- =====================================================
-- Optional: Use this if you need many-to-many linking
-- (e.g., a thread could be linked to multiple campaigns)

CREATE TABLE IF NOT EXISTS inbox_thread_campaign_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id TEXT NOT NULL,
  message_id TEXT,
  user_id TEXT NOT NULL,

  -- Campaign link
  campaign_id UUID NOT NULL,
  outreach_id UUID,
  contact_id UUID,
  variant_id UUID,

  -- Match details
  match_method TEXT NOT NULL, -- 'email', 'phone', 'subject', 'tracking_id', 'thread_reference'
  match_confidence DECIMAL(3,2) DEFAULT 1.0,

  -- Original outreach info
  original_channel TEXT,
  original_sent_at TIMESTAMPTZ,
  original_subject TEXT,

  -- Reply analysis
  reply_sentiment TEXT, -- 'positive', 'negative', 'neutral'
  reply_intent TEXT, -- 'interested', 'not_interested', 'question', 'meeting_request', etc.
  is_hot_lead BOOLEAN DEFAULT FALSE,
  lead_score INTEGER DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'detected', -- 'detected', 'confirmed', 'dismissed'

  -- Timestamps
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign key constraints (soft - don't enforce if tables use TEXT ids)
  CONSTRAINT unique_thread_campaign UNIQUE(thread_id, campaign_id)
);

-- Indexes for junction table
CREATE INDEX IF NOT EXISTS idx_thread_campaign_links_thread ON inbox_thread_campaign_links(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_campaign_links_campaign ON inbox_thread_campaign_links(campaign_id);
CREATE INDEX IF NOT EXISTS idx_thread_campaign_links_user ON inbox_thread_campaign_links(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_campaign_links_hot_leads ON inbox_thread_campaign_links(campaign_id, is_hot_lead)
  WHERE is_hot_lead = TRUE;
CREATE INDEX IF NOT EXISTS idx_thread_campaign_links_status ON inbox_thread_campaign_links(status);

-- =====================================================
-- CAMPAIGN REPLY STATS VIEW
-- =====================================================

CREATE OR REPLACE VIEW inbox_campaign_reply_stats AS
SELECT
  c.id as campaign_id,
  c.name as campaign_name,
  c.status as campaign_status,
  c.total_sent,
  c.total_replied,
  CASE WHEN c.total_sent > 0
    THEN ROUND((c.total_replied::DECIMAL / c.total_sent) * 100, 2)
    ELSE 0
  END as reply_rate,

  -- Breakdown by sentiment
  COUNT(DISTINCT t.id) FILTER (WHERE t.ai_sentiment = 'positive') as positive_replies,
  COUNT(DISTINCT t.id) FILTER (WHERE t.ai_sentiment = 'negative') as negative_replies,
  COUNT(DISTINCT t.id) FILTER (WHERE t.ai_sentiment = 'neutral') as neutral_replies,

  -- Reply timing
  MIN(t.last_message_at) as first_reply_at,
  MAX(t.last_message_at) as last_reply_at,

  -- Thread stats
  COUNT(DISTINCT t.id) as reply_threads,
  SUM(t.message_count) as total_reply_messages

FROM coldstart_campaigns c
LEFT JOIN inbox_threads t ON t.campaign_id = c.id
GROUP BY c.id, c.name, c.status, c.total_sent, c.total_replied;

-- =====================================================
-- FUNCTION: AUTO-LINK CAMPAIGN REPLY
-- =====================================================

CREATE OR REPLACE FUNCTION auto_link_campaign_reply()
RETURNS TRIGGER AS $$
DECLARE
  matched_outreach RECORD;
BEGIN
  -- Only process inbound messages
  IF NEW.direction <> 'inbound' THEN
    RETURN NEW;
  END IF;

  -- Skip if already linked
  IF NEW.campaign_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Try to match by email
  SELECT
    o.id as outreach_id,
    o.campaign_id,
    o.contact_id,
    o.variant_id
  INTO matched_outreach
  FROM coldstart_outreach o
  JOIN coldstart_contacts c ON o.contact_id = c.id
  WHERE LOWER(c.email) = LOWER(NEW.from_address)
    AND o.status IN ('sent', 'delivered', 'opened', 'clicked')
  ORDER BY o.sent_at DESC
  LIMIT 1;

  IF matched_outreach.outreach_id IS NOT NULL THEN
    -- Update this message
    NEW.campaign_id := matched_outreach.campaign_id;
    NEW.campaign_outreach_id := matched_outreach.outreach_id;
    NEW.is_campaign_reply := TRUE;

    -- Update the outreach record
    UPDATE coldstart_outreach
    SET status = 'replied', replied_at = NOW()
    WHERE id = matched_outreach.outreach_id
      AND status IN ('sent', 'delivered', 'opened', 'clicked');

    -- Update campaign stats
    UPDATE coldstart_campaigns
    SET total_replied = total_replied + 1, updated_at = NOW()
    WHERE id = matched_outreach.campaign_id;

    -- Update variant stats
    IF matched_outreach.variant_id IS NOT NULL THEN
      UPDATE coldstart_campaign_variants
      SET replied = COALESCE(replied, 0) + 1
      WHERE id = matched_outreach.variant_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-linking on message insert
DROP TRIGGER IF EXISTS trigger_auto_link_campaign_reply ON inbox_messages;
CREATE TRIGGER trigger_auto_link_campaign_reply
  BEFORE INSERT ON inbox_messages
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_campaign_reply();

-- Create same trigger for inbox_messages_v2 if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'inbox_messages_v2') THEN
    DROP TRIGGER IF EXISTS trigger_auto_link_campaign_reply_v2 ON inbox_messages_v2;
    CREATE TRIGGER trigger_auto_link_campaign_reply_v2
      BEFORE INSERT ON inbox_messages_v2
      FOR EACH ROW
      EXECUTE FUNCTION auto_link_campaign_reply();
  END IF;
END $$;

-- =====================================================
-- FUNCTION: UPDATE THREAD CAMPAIGN INFO
-- =====================================================

CREATE OR REPLACE FUNCTION update_thread_campaign_link()
RETURNS TRIGGER AS $$
BEGIN
  -- When a message is linked to a campaign, update the thread too
  IF NEW.campaign_id IS NOT NULL AND NEW.thread_id IS NOT NULL THEN
    UPDATE inbox_threads
    SET
      campaign_id = NEW.campaign_id,
      campaign_outreach_id = NEW.campaign_outreach_id,
      campaign_match_method = 'email',
      campaign_match_confidence = 0.95,
      ai_category = 'campaign_reply',
      labels = array_append(array_remove(labels, 'campaign_reply'), 'campaign_reply'),
      updated_at = NOW()
    WHERE id = NEW.thread_id
      AND campaign_id IS NULL; -- Only update if not already linked
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for thread update after message insert
DROP TRIGGER IF EXISTS trigger_update_thread_campaign ON inbox_messages;
CREATE TRIGGER trigger_update_thread_campaign
  AFTER INSERT ON inbox_messages
  FOR EACH ROW
  WHEN (NEW.campaign_id IS NOT NULL)
  EXECUTE FUNCTION update_thread_campaign_link();

-- Same for inbox_messages_v2
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'inbox_messages_v2') THEN
    DROP TRIGGER IF EXISTS trigger_update_thread_campaign_v2 ON inbox_messages_v2;
    CREATE TRIGGER trigger_update_thread_campaign_v2
      AFTER INSERT ON inbox_messages_v2
      FOR EACH ROW
      WHEN (NEW.campaign_id IS NOT NULL)
      EXECUTE FUNCTION update_thread_campaign_link();
  END IF;
END $$;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON COLUMN inbox_threads.campaign_id IS 'Reference to coldstart_campaigns.id if this thread is a campaign reply';
COMMENT ON COLUMN inbox_threads.campaign_outreach_id IS 'Reference to coldstart_outreach.id for the original message';
COMMENT ON COLUMN inbox_threads.campaign_match_method IS 'How the campaign was matched: email, phone, subject, tracking_id, thread_reference';
COMMENT ON COLUMN inbox_threads.campaign_match_confidence IS 'Confidence score of the campaign match (0.0 to 1.0)';
COMMENT ON TABLE inbox_thread_campaign_links IS 'Junction table for detailed campaign reply tracking with sentiment analysis';
