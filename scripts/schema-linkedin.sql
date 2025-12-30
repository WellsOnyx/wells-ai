-- =============================================================================
-- LinkedIn Integration Schema
-- =============================================================================
--
-- Tables:
-- - linkedin_profiles: Cached profile data
-- - linkedin_messages_queue: Messages to send (manual queue)
-- - linkedin_connections: Tracking connection status
-- - linkedin_content_queue: Posts to publish
-- - linkedin_extension_sessions: Browser extension auth
-- - linkedin_campaign_stats: Aggregated campaign stats
--
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- LINKEDIN PROFILES
-- Cached and enriched LinkedIn profile data
-- =============================================================================

CREATE TABLE IF NOT EXISTS linkedin_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- LinkedIn identifiers
  linkedin_url TEXT UNIQUE NOT NULL,
  linkedin_id TEXT, -- Vanity URL or numeric ID

  -- Basic info
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  headline TEXT,
  location TEXT,

  -- Professional info
  current_title TEXT,
  current_company TEXT,
  industry TEXT,

  -- Rich data (when available from enrichment)
  about TEXT,
  experience JSONB DEFAULT '[]'::jsonb,
  education JSONB DEFAULT '[]'::jsonb,
  skills JSONB DEFAULT '[]'::jsonb,

  -- Activity signals
  recent_posts JSONB DEFAULT '[]'::jsonb,
  activity_signals JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'enrichment', 'parsed', 'sales_navigator', 'extension')),
  enrichment_service TEXT,
  last_enriched_at TIMESTAMPTZ,

  -- User ownership
  user_id TEXT NOT NULL,

  -- Connection tracking
  connection_status TEXT DEFAULT 'unknown' CHECK (connection_status IN ('unknown', 'pending', 'connected', 'following', 'blocked')),
  connection_degree INTEGER, -- 1st, 2nd, 3rd degree
  mutual_connections INTEGER,

  -- Notes
  notes TEXT,
  tags JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for linkedin_profiles
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_user_id ON linkedin_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_linkedin_id ON linkedin_profiles(linkedin_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_company ON linkedin_profiles(current_company);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_connection_status ON linkedin_profiles(user_id, connection_status);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_updated_at ON linkedin_profiles(updated_at DESC);

-- Full text search on profiles
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_search ON linkedin_profiles
  USING gin(to_tsvector('english', coalesce(full_name, '') || ' ' || coalesce(current_company, '') || ' ' || coalesce(current_title, '')));

-- =============================================================================
-- LINKEDIN MESSAGES QUEUE
-- Messages ready for manual sending
-- =============================================================================

CREATE TABLE IF NOT EXISTS linkedin_messages_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,

  -- Recipient info (denormalized for quick access)
  profile_id UUID REFERENCES linkedin_profiles(id) ON DELETE SET NULL,
  linkedin_url TEXT NOT NULL,
  recipient_name TEXT,
  recipient_title TEXT,
  recipient_company TEXT,

  -- Message content
  message_type TEXT NOT NULL CHECK (message_type IN ('connection_request', 'inmail', 'followup', 'direct_message', 'comment')),
  content TEXT NOT NULL,
  character_count INTEGER NOT NULL,
  subject TEXT, -- For InMails

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'copied', 'sent', 'response_received', 'declined', 'skipped', 'error')),
  copied_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  response_at TIMESTAMPTZ,
  response_content TEXT,

  -- Metadata
  campaign_id UUID,
  priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  scheduled_for TIMESTAMPTZ,

  -- Personalization tracking
  personalization_factors JSONB DEFAULT '[]'::jsonb,
  wells_notes TEXT,

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for linkedin_messages_queue
CREATE INDEX IF NOT EXISTS idx_linkedin_queue_user_status ON linkedin_messages_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_linkedin_queue_profile ON linkedin_messages_queue(profile_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_queue_campaign ON linkedin_messages_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_queue_pending ON linkedin_messages_queue(user_id, status, priority DESC, created_at ASC)
  WHERE status IN ('pending', 'copied');
CREATE INDEX IF NOT EXISTS idx_linkedin_queue_sent_date ON linkedin_messages_queue(user_id, sent_at)
  WHERE status = 'sent';

-- =============================================================================
-- LINKEDIN CONNECTIONS
-- Track connection request history and status
-- =============================================================================

CREATE TABLE IF NOT EXISTS linkedin_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,

  -- Profile reference
  profile_id UUID REFERENCES linkedin_profiles(id) ON DELETE CASCADE,
  linkedin_url TEXT NOT NULL,

  -- Connection status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'declined', 'withdrawn', 'blocked')),

  -- Request details
  request_message_id UUID REFERENCES linkedin_messages_queue(id) ON DELETE SET NULL,
  request_sent_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,

  -- Interaction history
  last_interaction_at TIMESTAMPTZ,
  interaction_count INTEGER DEFAULT 0,

  -- Metadata
  source TEXT DEFAULT 'outreach' CHECK (source IN ('outreach', 'inbound', 'import', 'sales_navigator')),
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(user_id, linkedin_url)
);

-- Indexes for linkedin_connections
CREATE INDEX IF NOT EXISTS idx_linkedin_connections_user ON linkedin_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_connections_status ON linkedin_connections(user_id, status);
CREATE INDEX IF NOT EXISTS idx_linkedin_connections_profile ON linkedin_connections(profile_id);

-- =============================================================================
-- LINKEDIN CONTENT QUEUE
-- Posts, comments, and other content to publish
-- =============================================================================

CREATE TABLE IF NOT EXISTS linkedin_content_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,

  -- Content type
  type TEXT NOT NULL CHECK (type IN ('post', 'comment', 'article_idea', 'poll', 'carousel_idea')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'scheduled', 'posted', 'archived')),

  -- Content
  title TEXT,
  body TEXT NOT NULL,
  hashtags JSONB DEFAULT '[]'::jsonb,
  mentions JSONB DEFAULT '[]'::jsonb,
  media_urls JSONB DEFAULT '[]'::jsonb,

  -- For comments
  target_post_url TEXT,
  target_post_content TEXT,
  target_profile_url TEXT,

  -- Scheduling
  scheduled_for TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  linkedin_post_id TEXT,

  -- Performance metrics
  impressions INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  engagement_rate DECIMAL(5,2),

  -- Metadata
  theme TEXT,
  goal TEXT,
  audience TEXT,
  wells_notes TEXT,
  character_count INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for linkedin_content_queue
CREATE INDEX IF NOT EXISTS idx_linkedin_content_user ON linkedin_content_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_content_status ON linkedin_content_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_linkedin_content_scheduled ON linkedin_content_queue(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_linkedin_content_type ON linkedin_content_queue(user_id, type);

-- =============================================================================
-- LINKEDIN EXTENSION SESSIONS
-- Authentication and state for browser extension
-- =============================================================================

CREATE TABLE IF NOT EXISTS linkedin_extension_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,

  -- Session info
  session_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,

  -- Extension metadata
  extension_version TEXT,
  browser_info JSONB,

  -- Activity tracking
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  messages_sent_today INTEGER DEFAULT 0,
  connections_today INTEGER DEFAULT 0,
  errors_today INTEGER DEFAULT 0,

  -- Settings
  settings JSONB DEFAULT '{
    "autoFillEnabled": true,
    "autoSendEnabled": false,
    "sendDelay": 30,
    "maxDailyMessages": 50,
    "workingHoursOnly": true,
    "pauseOnRateLimit": true
  }'::jsonb,

  -- State
  is_active BOOLEAN DEFAULT true,
  is_paused BOOLEAN DEFAULT false,
  pause_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for linkedin_extension_sessions
CREATE INDEX IF NOT EXISTS idx_linkedin_extension_user ON linkedin_extension_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_extension_token ON linkedin_extension_sessions(session_token) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_linkedin_extension_expires ON linkedin_extension_sessions(expires_at);

-- =============================================================================
-- LINKEDIN CAMPAIGNS
-- Group messages and track campaign performance
-- =============================================================================

CREATE TABLE IF NOT EXISTS linkedin_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,

  -- Campaign info
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),

  -- Targeting
  target_criteria JSONB DEFAULT '{}'::jsonb,
  target_profiles JSONB DEFAULT '[]'::jsonb,

  -- Messaging
  message_template_id TEXT,
  message_type TEXT DEFAULT 'connection_request',
  personality_mode TEXT DEFAULT 'default',

  -- Stats (denormalized for quick access)
  total_messages INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  response_count INTEGER DEFAULT 0,
  connection_count INTEGER DEFAULT 0,
  meeting_count INTEGER DEFAULT 0,

  -- Rate limiting
  daily_limit INTEGER DEFAULT 25,
  weekly_limit INTEGER DEFAULT 100,

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for linkedin_campaigns
CREATE INDEX IF NOT EXISTS idx_linkedin_campaigns_user ON linkedin_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_campaigns_status ON linkedin_campaigns(user_id, status);

-- =============================================================================
-- LINKEDIN ACTIVITY LOG
-- Track all LinkedIn-related activities
-- =============================================================================

CREATE TABLE IF NOT EXISTS linkedin_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,

  -- Activity details
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'profile_viewed', 'profile_enriched',
    'message_drafted', 'message_copied', 'message_sent', 'message_skipped',
    'response_received', 'connection_accepted', 'connection_declined',
    'content_drafted', 'content_posted',
    'extension_connected', 'extension_error',
    'rate_limit_warning', 'rate_limit_hit'
  )),

  -- References
  profile_id UUID REFERENCES linkedin_profiles(id) ON DELETE SET NULL,
  message_id UUID REFERENCES linkedin_messages_queue(id) ON DELETE SET NULL,
  content_id UUID REFERENCES linkedin_content_queue(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES linkedin_campaigns(id) ON DELETE SET NULL,

  -- Activity metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for linkedin_activity_log
CREATE INDEX IF NOT EXISTS idx_linkedin_activity_user ON linkedin_activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_activity_type ON linkedin_activity_log(activity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_activity_profile ON linkedin_activity_log(profile_id);

-- Partition by date for scalability (optional)
-- CREATE INDEX IF NOT EXISTS idx_linkedin_activity_date ON linkedin_activity_log(created_at);

-- =============================================================================
-- LINKEDIN DAILY STATS
-- Pre-aggregated daily statistics
-- =============================================================================

CREATE TABLE IF NOT EXISTS linkedin_daily_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  date DATE NOT NULL,

  -- Message stats
  messages_drafted INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  messages_skipped INTEGER DEFAULT 0,

  -- Response stats
  responses_received INTEGER DEFAULT 0,
  positive_responses INTEGER DEFAULT 0,
  negative_responses INTEGER DEFAULT 0,

  -- Connection stats
  connection_requests_sent INTEGER DEFAULT 0,
  connections_accepted INTEGER DEFAULT 0,
  connections_declined INTEGER DEFAULT 0,

  -- Content stats
  posts_drafted INTEGER DEFAULT 0,
  posts_published INTEGER DEFAULT 0,
  comments_made INTEGER DEFAULT 0,

  -- Calculated metrics
  response_rate DECIMAL(5,2),
  connection_rate DECIMAL(5,2),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(user_id, date)
);

-- Indexes for linkedin_daily_stats
CREATE INDEX IF NOT EXISTS idx_linkedin_stats_user_date ON linkedin_daily_stats(user_id, date DESC);

-- =============================================================================
-- VIEWS
-- =============================================================================

-- View: Pending messages with profile info
CREATE OR REPLACE VIEW linkedin_pending_queue_view AS
SELECT
  q.*,
  p.full_name as profile_full_name,
  p.current_title as profile_title,
  p.current_company as profile_company,
  p.headline as profile_headline,
  p.connection_status as profile_connection_status
FROM linkedin_messages_queue q
LEFT JOIN linkedin_profiles p ON q.profile_id = p.id
WHERE q.status IN ('pending', 'copied')
ORDER BY q.priority DESC, q.created_at ASC;

-- View: Weekly stats summary
CREATE OR REPLACE VIEW linkedin_weekly_stats_view AS
SELECT
  user_id,
  date_trunc('week', date) as week_start,
  SUM(messages_sent) as total_sent,
  SUM(responses_received) as total_responses,
  SUM(connections_accepted) as total_connections,
  CASE WHEN SUM(messages_sent) > 0
    THEN (SUM(responses_received)::decimal / SUM(messages_sent) * 100)
    ELSE 0
  END as response_rate,
  CASE WHEN SUM(connection_requests_sent) > 0
    THEN (SUM(connections_accepted)::decimal / SUM(connection_requests_sent) * 100)
    ELSE 0
  END as connection_rate
FROM linkedin_daily_stats
GROUP BY user_id, date_trunc('week', date)
ORDER BY week_start DESC;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function: Update message count in campaigns
CREATE OR REPLACE FUNCTION update_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.campaign_id IS NOT NULL THEN
    UPDATE linkedin_campaigns
    SET
      total_messages = (SELECT COUNT(*) FROM linkedin_messages_queue WHERE campaign_id = NEW.campaign_id),
      sent_count = (SELECT COUNT(*) FROM linkedin_messages_queue WHERE campaign_id = NEW.campaign_id AND status = 'sent'),
      response_count = (SELECT COUNT(*) FROM linkedin_messages_queue WHERE campaign_id = NEW.campaign_id AND status = 'response_received'),
      updated_at = NOW()
    WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update campaign stats on message status change
DROP TRIGGER IF EXISTS trigger_update_campaign_stats ON linkedin_messages_queue;
CREATE TRIGGER trigger_update_campaign_stats
  AFTER INSERT OR UPDATE OF status ON linkedin_messages_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_stats();

-- Function: Update daily stats
CREATE OR REPLACE FUNCTION update_linkedin_daily_stats(
  p_user_id TEXT,
  p_stat_type TEXT,
  p_increment INTEGER DEFAULT 1
)
RETURNS VOID AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
BEGIN
  INSERT INTO linkedin_daily_stats (user_id, date)
  VALUES (p_user_id, v_today)
  ON CONFLICT (user_id, date) DO NOTHING;

  EXECUTE format('
    UPDATE linkedin_daily_stats
    SET %I = COALESCE(%I, 0) + $1, updated_at = NOW()
    WHERE user_id = $2 AND date = $3
  ', p_stat_type, p_stat_type)
  USING p_increment, p_user_id, v_today;
END;
$$ LANGUAGE plpgsql;

-- Function: Check weekly rate limits
CREATE OR REPLACE FUNCTION check_linkedin_weekly_limits(p_user_id TEXT)
RETURNS TABLE (
  connection_requests_this_week INTEGER,
  connection_requests_remaining INTEGER,
  messages_this_week INTEGER,
  is_near_limit BOOLEAN
) AS $$
DECLARE
  v_weekly_limit INTEGER := 100;
  v_connection_count INTEGER;
  v_message_count INTEGER;
BEGIN
  SELECT
    COALESCE(SUM(connection_requests_sent), 0),
    COALESCE(SUM(messages_sent), 0)
  INTO v_connection_count, v_message_count
  FROM linkedin_daily_stats
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - INTERVAL '7 days';

  RETURN QUERY SELECT
    v_connection_count,
    v_weekly_limit - v_connection_count,
    v_message_count,
    (v_weekly_limit - v_connection_count) <= 10;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE linkedin_profiles IS 'Cached LinkedIn profile data with enrichment from various sources';
COMMENT ON TABLE linkedin_messages_queue IS 'Queue of LinkedIn messages for manual copy-paste sending';
COMMENT ON TABLE linkedin_connections IS 'Track connection request history and current status';
COMMENT ON TABLE linkedin_content_queue IS 'Posts and content to publish on LinkedIn';
COMMENT ON TABLE linkedin_extension_sessions IS 'Browser extension authentication and state';
COMMENT ON TABLE linkedin_campaigns IS 'Group messages into campaigns for tracking';
COMMENT ON TABLE linkedin_activity_log IS 'Audit log of all LinkedIn-related activities';
COMMENT ON TABLE linkedin_daily_stats IS 'Pre-aggregated daily statistics for quick access';

-- =============================================================================
-- GRANTS (adjust schema/roles as needed)
-- =============================================================================

-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO wells_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO wells_app;
