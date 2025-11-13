-- ==========================================
-- Calendar Integration Schema
-- ==========================================
--
-- Supports Google Calendar, Microsoft Outlook/365, and Apple Calendar
-- with OAuth 2.0 authentication and encrypted token storage
--

-- ==========================================
-- USER CALENDAR CONNECTIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS user_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft', 'apple')),
  provider_account_id TEXT NOT NULL, -- Provider's unique ID for the account
  email TEXT NOT NULL,
  display_name TEXT,

  -- Encrypted OAuth tokens (AES-256-GCM)
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scope TEXT NOT NULL,

  -- Connection status
  connected BOOLEAN DEFAULT true,
  is_primary BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sync_at TIMESTAMP WITH TIME ZONE,

  -- Ensure one connection per provider per email per user
  UNIQUE (user_id, provider, email)
);

-- Indexes for performance
CREATE INDEX idx_calendar_connections_user_id ON user_calendar_connections(user_id);
CREATE INDEX idx_calendar_connections_provider ON user_calendar_connections(provider);
CREATE INDEX idx_calendar_connections_primary ON user_calendar_connections(user_id, is_primary) WHERE is_primary = true;
CREATE INDEX idx_calendar_connections_connected ON user_calendar_connections(user_id, connected) WHERE connected = true;

-- ==========================================
-- CALENDAR EVENTS
-- ==========================================

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  connection_id UUID NOT NULL REFERENCES user_calendar_connections(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft', 'apple')),
  provider_event_id TEXT NOT NULL, -- Provider's unique ID for the event

  -- Event details
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,

  -- Time information
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  is_all_day BOOLEAN DEFAULT false,

  -- Participants (stored as JSONB for flexibility)
  organizer JSONB NOT NULL, -- { email, displayName, status, isOrganizer }
  attendees JSONB DEFAULT '[]'::jsonb, -- Array of { email, displayName, status, isOptional }

  -- Meeting details
  meeting_url TEXT,
  conference_data JSONB, -- Video conferencing details

  -- Metadata
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'confidential')),
  html_link TEXT,
  ical_uid TEXT,
  sequence INTEGER DEFAULT 0,

  -- Recurrence
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT, -- iCal RRULE format
  recurrence_exceptions TEXT[], -- Dates to exclude

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Ensure one event per provider event ID
  UNIQUE (user_id, provider, provider_event_id)
);

-- Indexes for performance
CREATE INDEX idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_connection_id ON calendar_events(connection_id);
CREATE INDEX idx_calendar_events_time_range ON calendar_events(user_id, start_time, end_time);
CREATE INDEX idx_calendar_events_provider_id ON calendar_events(provider, provider_event_id);
CREATE INDEX idx_calendar_events_deleted ON calendar_events(user_id) WHERE deleted_at IS NULL;

-- GIN index for JSONB attendees search
CREATE INDEX idx_calendar_events_attendees ON calendar_events USING GIN (attendees);

-- ==========================================
-- CALENDAR SYNC LOG
-- ==========================================

CREATE TABLE IF NOT EXISTS calendar_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  connection_id UUID NOT NULL REFERENCES user_calendar_connections(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft', 'apple')),

  -- Sync details
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),

  -- Results
  events_added INTEGER DEFAULT 0,
  events_updated INTEGER DEFAULT 0,
  events_deleted INTEGER DEFAULT 0,
  error TEXT,

  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,

  -- For incremental syncs
  sync_token TEXT
);

-- Indexes for performance
CREATE INDEX idx_sync_log_user_id ON calendar_sync_log(user_id);
CREATE INDEX idx_sync_log_connection_id ON calendar_sync_log(connection_id);
CREATE INDEX idx_sync_log_status ON calendar_sync_log(status, started_at);

-- ==========================================
-- CALENDAR AVAILABILITY PREFERENCES
-- ==========================================
-- Optional: Store user's availability preferences

CREATE TABLE IF NOT EXISTS calendar_availability_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,

  -- Working hours (JSONB for flexibility)
  -- Format: { "monday": { "enabled": true, "start": "09:00", "end": "17:00" }, ... }
  working_hours JSONB DEFAULT '{
    "monday": {"enabled": true, "start": "09:00", "end": "17:00"},
    "tuesday": {"enabled": true, "start": "09:00", "end": "17:00"},
    "wednesday": {"enabled": true, "start": "09:00", "end": "17:00"},
    "thursday": {"enabled": true, "start": "09:00", "end": "17:00"},
    "friday": {"enabled": true, "start": "09:00", "end": "17:00"},
    "saturday": {"enabled": false, "start": "09:00", "end": "17:00"},
    "sunday": {"enabled": false, "start": "09:00", "end": "17:00"}
  }'::jsonb,

  -- Timezone
  timezone TEXT DEFAULT 'America/Los_Angeles',

  -- Buffer times (minutes)
  buffer_before INTEGER DEFAULT 0,
  buffer_after INTEGER DEFAULT 0,

  -- Meeting preferences
  min_meeting_duration INTEGER DEFAULT 15, -- minutes
  max_meetings_per_day INTEGER DEFAULT 10,

  -- Auto-accept settings
  auto_accept_invites BOOLEAN DEFAULT false,
  auto_accept_domains TEXT[], -- Auto-accept from these email domains

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_availability_user_id ON calendar_availability_preferences(user_id);

-- ==========================================
-- CALENDAR WEBHOOKS (for real-time sync)
-- ==========================================
-- Optional: Store webhook subscriptions for push notifications

CREATE TABLE IF NOT EXISTS calendar_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES user_calendar_connections(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft', 'apple')),

  -- Webhook details
  webhook_id TEXT NOT NULL, -- Provider's webhook/channel ID
  resource_uri TEXT NOT NULL, -- Resource being watched
  expiration TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Status
  active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_notification_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_webhooks_connection_id ON calendar_webhooks(connection_id);
CREATE INDEX idx_webhooks_expiration ON calendar_webhooks(expiration) WHERE active = true;

-- ==========================================
-- HELPER FUNCTIONS
-- ==========================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_calendar_connections_updated_at
  BEFORE UPDATE ON user_calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_availability_preferences_updated_at
  BEFORE UPDATE ON calendar_availability_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- SAMPLE QUERIES
-- ==========================================

-- Get user's connected calendars
-- SELECT * FROM user_calendar_connections WHERE user_id = 'user_123' AND connected = true;

-- Get user's primary calendar
-- SELECT * FROM user_calendar_connections WHERE user_id = 'user_123' AND is_primary = true LIMIT 1;

-- Get events in date range
-- SELECT * FROM calendar_events
-- WHERE user_id = 'user_123'
--   AND deleted_at IS NULL
--   AND start_time >= '2025-01-01'
--   AND start_time < '2025-02-01'
-- ORDER BY start_time;

-- Get events with specific attendee
-- SELECT * FROM calendar_events
-- WHERE user_id = 'user_123'
--   AND attendees @> '[{"email": "john@example.com"}]'::jsonb;

-- Find free time slots (events that don't overlap with busy time)
-- SELECT
--   start_time,
--   end_time,
--   EXTRACT(EPOCH FROM (end_time - start_time))/60 as duration_minutes
-- FROM calendar_events
-- WHERE user_id = 'user_123'
--   AND deleted_at IS NULL
--   AND start_time >= NOW()
--   AND start_time < NOW() + INTERVAL '7 days'
-- ORDER BY start_time;

-- Get sync history
-- SELECT * FROM calendar_sync_log
-- WHERE user_id = 'user_123'
-- ORDER BY started_at DESC
-- LIMIT 10;

-- ==========================================
-- COMMENTS
-- ==========================================

COMMENT ON TABLE user_calendar_connections IS 'Stores OAuth connections to user calendars (Google, Microsoft, Apple)';
COMMENT ON TABLE calendar_events IS 'Cached calendar events from all connected calendars';
COMMENT ON TABLE calendar_sync_log IS 'Log of calendar synchronization operations';
COMMENT ON TABLE calendar_availability_preferences IS 'User preferences for availability and meeting scheduling';
COMMENT ON TABLE calendar_webhooks IS 'Webhook subscriptions for real-time calendar updates';

COMMENT ON COLUMN user_calendar_connections.access_token_encrypted IS 'AES-256-GCM encrypted access token';
COMMENT ON COLUMN user_calendar_connections.refresh_token_encrypted IS 'AES-256-GCM encrypted refresh token';
COMMENT ON COLUMN calendar_events.conference_data IS 'Video conferencing details (Google Meet, Teams, etc.)';
COMMENT ON COLUMN calendar_events.recurrence_rule IS 'iCal RRULE format for recurring events';
