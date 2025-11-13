-- Calendar Integration Tables
-- Supports Cal.com and future providers (Google Calendar, Outlook)

-- Calendar connections (user's connected calendars)
CREATE TABLE IF NOT EXISTS calendar_connections (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  provider VARCHAR(50) NOT NULL, -- 'calcom', 'google', 'outlook'

  -- Encrypted API credentials
  api_key_encrypted TEXT,
  api_key_iv TEXT,
  api_key_auth_tag TEXT,

  -- OAuth tokens (for Google/Outlook)
  access_token_encrypted TEXT,
  access_token_iv TEXT,
  access_token_auth_tag TEXT,
  refresh_token_encrypted TEXT,
  refresh_token_iv TEXT,
  refresh_token_auth_tag TEXT,
  token_expires_at TIMESTAMP,

  -- Connection status
  connected BOOLEAN DEFAULT true,
  calendar_email VARCHAR(255),
  calendar_name VARCHAR(255),

  -- Sync info
  last_sync_at TIMESTAMP,
  sync_enabled BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, provider)
);

-- Calendar bookings (scheduled meetings)
CREATE TABLE IF NOT EXISTS calendar_bookings (
  id VARCHAR(255) PRIMARY KEY,
  user_id TEXT NOT NULL,
  booking_uid VARCHAR(255) NOT NULL, -- Cal.com UID or Google event ID

  -- Meeting details
  title VARCHAR(500) NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  duration_minutes INTEGER,

  -- Attendees (stored as JSON array)
  attendees JSONB DEFAULT '[]'::jsonb,

  -- Location & conferencing
  location VARCHAR(500),
  meeting_url TEXT, -- Video call URL

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'cancelled'

  -- Metadata
  timezone VARCHAR(100) DEFAULT 'UTC',
  provider VARCHAR(50) DEFAULT 'calcom',
  external_id VARCHAR(255), -- ID in external calendar system

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  cancelled_at TIMESTAMP,

  UNIQUE(user_id, booking_uid)
);

-- Calendar availability settings (future feature)
CREATE TABLE IF NOT EXISTS calendar_availability (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL UNIQUE,

  -- Working hours (stored as JSON)
  working_hours JSONB DEFAULT '{
    "monday": {"start": "09:00", "end": "17:00", "enabled": true},
    "tuesday": {"start": "09:00", "end": "17:00", "enabled": true},
    "wednesday": {"start": "09:00", "end": "17:00", "enabled": true},
    "thursday": {"start": "09:00", "end": "17:00", "enabled": true},
    "friday": {"start": "09:00", "end": "17:00", "enabled": true},
    "saturday": {"start": "09:00", "end": "17:00", "enabled": false},
    "sunday": {"start": "09:00", "end": "17:00", "enabled": false}
  }'::jsonb,

  -- Preferences
  timezone VARCHAR(100) DEFAULT 'America/Los_Angeles',
  buffer_before_minutes INTEGER DEFAULT 0,
  buffer_after_minutes INTEGER DEFAULT 0,
  minimum_notice_hours INTEGER DEFAULT 24,
  max_bookings_per_day INTEGER DEFAULT 8,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_connections_user_id ON calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_provider ON calendar_connections(provider);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_connected ON calendar_connections(connected);

CREATE INDEX IF NOT EXISTS idx_calendar_bookings_user_id ON calendar_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_bookings_start_time ON calendar_bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_bookings_status ON calendar_bookings(status);
CREATE INDEX IF NOT EXISTS idx_calendar_bookings_user_start ON calendar_bookings(user_id, start_time);

CREATE INDEX IF NOT EXISTS idx_calendar_availability_user_id ON calendar_availability(user_id);

-- Add calendar connection to Prisma schema (manual step - see schema update)
COMMENT ON TABLE calendar_connections IS 'Stores encrypted calendar API credentials for Cal.com, Google Calendar, etc.';
COMMENT ON TABLE calendar_bookings IS 'Tracks all scheduled meetings created through Wells AI';
COMMENT ON TABLE calendar_availability IS 'User availability preferences for smart scheduling';
