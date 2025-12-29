-- Wells AI Scheduling Schema
-- Database tables for the conversational scheduling system

-- ============================================================================
-- SCHEDULED MEETINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS scheduled_meetings (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,

    -- Meeting details
    topic VARCHAR(500) NOT NULL,
    description TEXT,
    attendee VARCHAR(255) NOT NULL,
    attendee_email VARCHAR(255),
    attendees JSONB DEFAULT '[]'::jsonb,

    -- Timing
    duration INTEGER NOT NULL DEFAULT 30,
    scheduled_time TIMESTAMPTZ,
    proposed_times JSONB DEFAULT '[]'::jsonb,

    -- Type and location
    type VARCHAR(20) NOT NULL DEFAULT 'video',
    location VARCHAR(500),
    meeting_link VARCHAR(500),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    notes TEXT,
    invite_sent BOOLEAN DEFAULT FALSE,

    -- Calendar integration
    calendar_event_id VARCHAR(255),
    calendar_type VARCHAR(20),  -- 'google', 'outlook', 'apple', 'caldav'

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Indexes
    CONSTRAINT valid_status CHECK (status IN ('draft', 'proposed', 'confirmed', 'cancelled', 'completed')),
    CONSTRAINT valid_type CHECK (type IN ('video', 'phone', 'in_person'))
);

CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_user ON scheduled_meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_time ON scheduled_meetings(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_status ON scheduled_meetings(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_calendar ON scheduled_meetings(calendar_event_id);

-- ============================================================================
-- USER SCHEDULING PREFERENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_scheduling_preferences (
    user_id VARCHAR(64) PRIMARY KEY,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Common preferences extracted for indexing
    default_duration INTEGER DEFAULT 30,
    default_meeting_type VARCHAR(20) DEFAULT 'video',
    timezone VARCHAR(50) DEFAULT 'America/New_York',

    -- Working hours
    working_hours_start TIME DEFAULT '09:00',
    working_hours_end TIME DEFAULT '17:00',

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CALENDAR CONNECTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS calendar_connections (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,

    -- Connection details
    type VARCHAR(20) NOT NULL,  -- 'google', 'outlook', 'apple', 'caldav'
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,

    -- OAuth tokens (encrypted in production)
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,

    -- CalDAV-specific
    caldav_url VARCHAR(500),
    caldav_username VARCHAR(255),

    -- Status
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_synced_at TIMESTAMPTZ,
    sync_error TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_calendar_type CHECK (type IN ('google', 'outlook', 'apple', 'caldav')),
    UNIQUE(user_id, email, type)
);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_user ON calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_active ON calendar_connections(user_id, is_active);

-- ============================================================================
-- MEETING REMINDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS meeting_reminders (
    id VARCHAR(64) PRIMARY KEY,
    meeting_id VARCHAR(64) NOT NULL REFERENCES scheduled_meetings(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL,

    -- Reminder timing
    remind_at TIMESTAMPTZ NOT NULL,
    minutes_before INTEGER NOT NULL,

    -- Delivery
    channel VARCHAR(20) NOT NULL DEFAULT 'in_app',  -- 'in_app', 'email', 'sms', 'push'
    sent_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_reminders_meeting ON meeting_reminders(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_reminders_pending ON meeting_reminders(remind_at) WHERE sent_at IS NULL;

-- ============================================================================
-- SCHEDULING REQUESTS (for async scheduling with external parties)
-- ============================================================================

CREATE TABLE IF NOT EXISTS scheduling_requests (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,

    -- Request details
    topic VARCHAR(500) NOT NULL,
    duration INTEGER NOT NULL DEFAULT 30,
    meeting_type VARCHAR(20) DEFAULT 'video',

    -- Attendee
    attendee_name VARCHAR(255),
    attendee_email VARCHAR(255) NOT NULL,

    -- Available slots offered
    proposed_slots JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Response tracking
    selected_slot JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',

    -- Expiration
    expires_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,

    CONSTRAINT valid_request_status CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_scheduling_requests_user ON scheduling_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_requests_attendee ON scheduling_requests(attendee_email);
CREATE INDEX IF NOT EXISTS idx_scheduling_requests_status ON scheduling_requests(status);

-- ============================================================================
-- CALENDAR SYNC LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS calendar_sync_log (
    id SERIAL PRIMARY KEY,
    connection_id VARCHAR(64) NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL,

    -- Sync details
    sync_type VARCHAR(20) NOT NULL,  -- 'full', 'incremental', 'push'
    events_synced INTEGER DEFAULT 0,
    events_created INTEGER DEFAULT 0,
    events_updated INTEGER DEFAULT 0,
    events_deleted INTEGER DEFAULT 0,

    -- Status
    status VARCHAR(20) NOT NULL,  -- 'success', 'partial', 'failed'
    error_message TEXT,

    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_calendar_sync_log_connection ON calendar_sync_log(connection_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_log_user ON calendar_sync_log(user_id);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_scheduling_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
DROP TRIGGER IF EXISTS scheduled_meetings_updated_at ON scheduled_meetings;
CREATE TRIGGER scheduled_meetings_updated_at
    BEFORE UPDATE ON scheduled_meetings
    FOR EACH ROW
    EXECUTE FUNCTION update_scheduling_updated_at();

DROP TRIGGER IF EXISTS user_scheduling_preferences_updated_at ON user_scheduling_preferences;
CREATE TRIGGER user_scheduling_preferences_updated_at
    BEFORE UPDATE ON user_scheduling_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_scheduling_updated_at();

DROP TRIGGER IF EXISTS calendar_connections_updated_at ON calendar_connections;
CREATE TRIGGER calendar_connections_updated_at
    BEFORE UPDATE ON calendar_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_scheduling_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE scheduled_meetings IS 'Stores all meetings scheduled through WellsAI';
COMMENT ON TABLE user_scheduling_preferences IS 'User preferences for meeting scheduling';
COMMENT ON TABLE calendar_connections IS 'OAuth connections to external calendar providers';
COMMENT ON TABLE meeting_reminders IS 'Scheduled reminders for upcoming meetings';
COMMENT ON TABLE scheduling_requests IS 'Async scheduling requests sent to external parties';
COMMENT ON TABLE calendar_sync_log IS 'Log of calendar synchronization operations';
