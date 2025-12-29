-- =============================================================================
-- MULTI-CHANNEL CHAT ROUTER SCHEMA
-- =============================================================================
-- Supports cross-channel conversation continuity for WellsAI
-- Enables users to start on Slack and continue on SMS seamlessly
-- =============================================================================

-- Channel user identity mappings
-- Links channel-specific identifiers to WellsAI user accounts
CREATE TABLE IF NOT EXISTS channel_user_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT NOT NULL UNIQUE,

    -- Channel-specific identifiers
    email TEXT,
    phone TEXT,
    slack_user_id TEXT,
    discord_user_id TEXT,
    teams_user_id TEXT,
    imessage_id TEXT,
    external_id TEXT,

    -- Metadata
    display_name TEXT,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,

    -- Indexes for fast lookup
    CONSTRAINT unique_email UNIQUE (email),
    CONSTRAINT unique_phone UNIQUE (phone),
    CONSTRAINT unique_slack UNIQUE (slack_user_id),
    CONSTRAINT unique_discord UNIQUE (discord_user_id),
    CONSTRAINT unique_teams UNIQUE (teams_user_id),
    CONSTRAINT unique_imessage UNIQUE (imessage_id)
);

-- Indexes for channel_user_mappings
CREATE INDEX IF NOT EXISTS idx_channel_user_email ON channel_user_mappings(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_channel_user_phone ON channel_user_mappings(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_channel_user_slack ON channel_user_mappings(slack_user_id) WHERE slack_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_channel_user_discord ON channel_user_mappings(discord_user_id) WHERE discord_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_channel_user_teams ON channel_user_mappings(teams_user_id) WHERE teams_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_channel_user_imessage ON channel_user_mappings(imessage_id) WHERE imessage_id IS NOT NULL;

-- Conversation to channel mappings
-- Tracks which channels are participating in a conversation
CREATE TABLE IF NOT EXISTS channel_conversation_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL, -- References unified_conversations

    -- Channel information
    channel TEXT NOT NULL, -- 'web', 'slack', 'discord', 'sms', 'whatsapp', 'teams', 'email', 'imessage', 'api'
    channel_conversation_id TEXT NOT NULL, -- Channel-specific thread/conversation ID
    channel_workspace_id TEXT, -- Slack team ID, Discord guild ID, etc.
    channel_channel_id TEXT, -- Slack channel, Discord channel, etc.

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ, -- For temporary/ephemeral conversations

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,

    -- Ensure unique conversation per channel
    CONSTRAINT unique_conversation_channel UNIQUE (conversation_id, channel)
);

-- Indexes for channel_conversation_mappings
CREATE INDEX IF NOT EXISTS idx_channel_conv_conversation ON channel_conversation_mappings(conversation_id);
CREATE INDEX IF NOT EXISTS idx_channel_conv_channel ON channel_conversation_mappings(channel);
CREATE INDEX IF NOT EXISTS idx_channel_conv_lookup ON channel_conversation_mappings(channel, channel_conversation_id);
CREATE INDEX IF NOT EXISTS idx_channel_conv_active ON channel_conversation_mappings(is_active) WHERE is_active = TRUE;

-- Webhook event logs
-- Track incoming webhooks for debugging and analytics
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Event information
    platform TEXT NOT NULL, -- 'slack', 'discord', 'twilio', 'teams', 'sendblue', 'email', 'api'
    event_type TEXT NOT NULL,
    event_id TEXT, -- Platform-specific event ID

    -- Processing
    conversation_id UUID,
    message_id UUID,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    processing_time_ms INTEGER,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for webhook_logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_platform ON webhook_logs(platform);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_conversation ON webhook_logs(conversation_id) WHERE conversation_id IS NOT NULL;

-- Channel workspace configurations
-- Store workspace-specific settings for each channel
CREATE TABLE IF NOT EXISTS channel_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Workspace identification
    channel TEXT NOT NULL,
    workspace_id TEXT NOT NULL, -- External workspace ID (Slack team ID, Discord guild ID, etc.)
    workspace_name TEXT,

    -- Connection credentials
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    bot_user_id TEXT, -- Bot's user ID in the workspace

    -- Owner
    clerk_user_id TEXT, -- Who connected this workspace
    account_id UUID, -- Which Wells account this belongs to

    -- Configuration
    default_product TEXT DEFAULT 'wellsai', -- 'wellsai' or 'grainvault'
    default_journey TEXT,
    settings JSONB DEFAULT '{}',

    -- Status
    status TEXT DEFAULT 'active', -- 'active', 'disconnected', 'error'
    error_message TEXT,

    -- Stats
    messages_processed INTEGER DEFAULT 0,
    last_activity_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure unique workspace per channel
    CONSTRAINT unique_channel_workspace UNIQUE (channel, workspace_id)
);

-- Indexes for channel_workspaces
CREATE INDEX IF NOT EXISTS idx_channel_workspaces_channel ON channel_workspaces(channel);
CREATE INDEX IF NOT EXISTS idx_channel_workspaces_status ON channel_workspaces(status);
CREATE INDEX IF NOT EXISTS idx_channel_workspaces_clerk ON channel_workspaces(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_channel_workspaces_account ON channel_workspaces(account_id);

-- Channel message queue
-- For async message processing and retries
CREATE TABLE IF NOT EXISTS channel_message_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Message details
    channel TEXT NOT NULL,
    direction TEXT NOT NULL, -- 'inbound' or 'outbound'
    conversation_id UUID,

    -- Payload
    payload JSONB NOT NULL,
    formatted_response JSONB,

    -- Processing status
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'retrying'
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,

    -- Scheduling
    process_after TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for channel_message_queue
CREATE INDEX IF NOT EXISTS idx_channel_queue_status ON channel_message_queue(status);
CREATE INDEX IF NOT EXISTS idx_channel_queue_process ON channel_message_queue(process_after) WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_channel_queue_channel ON channel_message_queue(channel);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_channel_router_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DO $$
BEGIN
    -- channel_user_mappings
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_channel_user_mappings_updated') THEN
        CREATE TRIGGER trigger_channel_user_mappings_updated
            BEFORE UPDATE ON channel_user_mappings
            FOR EACH ROW EXECUTE FUNCTION update_channel_router_timestamp();
    END IF;

    -- channel_conversation_mappings
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_channel_conversation_mappings_updated') THEN
        CREATE TRIGGER trigger_channel_conversation_mappings_updated
            BEFORE UPDATE ON channel_conversation_mappings
            FOR EACH ROW EXECUTE FUNCTION update_channel_router_timestamp();
    END IF;

    -- channel_workspaces
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_channel_workspaces_updated') THEN
        CREATE TRIGGER trigger_channel_workspaces_updated
            BEFORE UPDATE ON channel_workspaces
            FOR EACH ROW EXECUTE FUNCTION update_channel_router_timestamp();
    END IF;

    -- channel_message_queue
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_channel_message_queue_updated') THEN
        CREATE TRIGGER trigger_channel_message_queue_updated
            BEFORE UPDATE ON channel_message_queue
            FOR EACH ROW EXECUTE FUNCTION update_channel_router_timestamp();
    END IF;
END $$;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Find user by any channel identifier
CREATE OR REPLACE FUNCTION find_user_by_channel_id(
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_slack_user_id TEXT DEFAULT NULL,
    p_discord_user_id TEXT DEFAULT NULL,
    p_teams_user_id TEXT DEFAULT NULL,
    p_imessage_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    clerk_user_id TEXT,
    email TEXT,
    phone TEXT,
    display_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cum.clerk_user_id,
        cum.email,
        cum.phone,
        cum.display_name
    FROM channel_user_mappings cum
    WHERE
        (p_email IS NOT NULL AND cum.email = p_email)
        OR (p_phone IS NOT NULL AND cum.phone = p_phone)
        OR (p_slack_user_id IS NOT NULL AND cum.slack_user_id = p_slack_user_id)
        OR (p_discord_user_id IS NOT NULL AND cum.discord_user_id = p_discord_user_id)
        OR (p_teams_user_id IS NOT NULL AND cum.teams_user_id = p_teams_user_id)
        OR (p_imessage_id IS NOT NULL AND cum.imessage_id = p_imessage_id)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Get active conversation for channel
CREATE OR REPLACE FUNCTION get_channel_conversation(
    p_channel TEXT,
    p_channel_conversation_id TEXT
)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
BEGIN
    SELECT ccm.conversation_id INTO v_conversation_id
    FROM channel_conversation_mappings ccm
    WHERE ccm.channel = p_channel
      AND ccm.channel_conversation_id = p_channel_conversation_id
      AND ccm.is_active = TRUE
      AND (ccm.expires_at IS NULL OR ccm.expires_at > NOW())
    ORDER BY ccm.updated_at DESC
    LIMIT 1;

    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Link conversation to channel
CREATE OR REPLACE FUNCTION link_conversation_to_channel(
    p_conversation_id UUID,
    p_channel TEXT,
    p_channel_conversation_id TEXT,
    p_channel_workspace_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_mapping_id UUID;
BEGIN
    INSERT INTO channel_conversation_mappings (
        conversation_id,
        channel,
        channel_conversation_id,
        channel_workspace_id
    ) VALUES (
        p_conversation_id,
        p_channel,
        p_channel_conversation_id,
        p_channel_workspace_id
    )
    ON CONFLICT (conversation_id, channel) DO UPDATE SET
        channel_conversation_id = EXCLUDED.channel_conversation_id,
        channel_workspace_id = COALESCE(EXCLUDED.channel_workspace_id, channel_conversation_mappings.channel_workspace_id),
        updated_at = NOW(),
        is_active = TRUE
    RETURNING id INTO v_mapping_id;

    RETURN v_mapping_id;
END;
$$ LANGUAGE plpgsql;

-- Get all channels for a conversation
CREATE OR REPLACE FUNCTION get_conversation_channels(
    p_conversation_id UUID
)
RETURNS TABLE (
    channel TEXT,
    channel_conversation_id TEXT,
    channel_workspace_id TEXT,
    last_message_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ccm.channel,
        ccm.channel_conversation_id,
        ccm.channel_workspace_id,
        ccm.last_message_at
    FROM channel_conversation_mappings ccm
    WHERE ccm.conversation_id = p_conversation_id
      AND ccm.is_active = TRUE
    ORDER BY ccm.last_message_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ANALYTICS VIEWS
-- =============================================================================

-- Channel activity summary
CREATE OR REPLACE VIEW channel_activity_summary AS
SELECT
    channel,
    COUNT(DISTINCT conversation_id) as total_conversations,
    COUNT(*) as total_channel_links,
    MAX(last_message_at) as last_activity,
    COUNT(CASE WHEN is_active THEN 1 END) as active_links
FROM channel_conversation_mappings
GROUP BY channel;

-- Cross-channel conversations (conversations that span multiple channels)
CREATE OR REPLACE VIEW cross_channel_conversations AS
SELECT
    conversation_id,
    ARRAY_AGG(DISTINCT channel ORDER BY channel) as channels,
    COUNT(DISTINCT channel) as channel_count,
    MIN(created_at) as first_channel_at,
    MAX(last_message_at) as last_activity
FROM channel_conversation_mappings
WHERE is_active = TRUE
GROUP BY conversation_id
HAVING COUNT(DISTINCT channel) > 1;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE channel_user_mappings IS 'Maps user identities across different chat channels to WellsAI accounts';
COMMENT ON TABLE channel_conversation_mappings IS 'Links WellsAI conversations to channel-specific threads for cross-channel continuity';
COMMENT ON TABLE webhook_logs IS 'Audit log for all incoming webhook events from chat platforms';
COMMENT ON TABLE channel_workspaces IS 'Configuration and credentials for connected workspaces (Slack teams, Discord guilds, etc.)';
COMMENT ON TABLE channel_message_queue IS 'Queue for async message processing and retry handling';
