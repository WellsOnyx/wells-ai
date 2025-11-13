/**
 * Slack Integration Database Schema
 * Stores Slack workspace installations and interaction data
 */

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Slack Workspace Installations
CREATE TABLE IF NOT EXISTS slack_installations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id VARCHAR(255) UNIQUE NOT NULL,
  team_name VARCHAR(255) NOT NULL,
  bot_user_id VARCHAR(255) NOT NULL,
  bot_token TEXT NOT NULL, -- Encrypted in production
  scope TEXT NOT NULL,
  app_id VARCHAR(255),
  authed_user_id VARCHAR(255),
  authed_user_token TEXT, -- Encrypted in production
  metadata JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_slack_installations_team_id ON slack_installations(team_id);
CREATE INDEX IF NOT EXISTS idx_slack_installations_active ON slack_installations(is_active);

-- Slack User Mappings
-- Maps Slack users to Wells AI user accounts
CREATE TABLE IF NOT EXISTS slack_user_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slack_user_id VARCHAR(255) NOT NULL,
  slack_team_id VARCHAR(255) NOT NULL,
  wells_user_id VARCHAR(255), -- Wells AI user ID
  wells_user_email VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(slack_user_id, slack_team_id)
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_slack_user ON slack_user_mappings(slack_user_id, slack_team_id);
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_wells_user ON slack_user_mappings(wells_user_id);

-- Slack Command History
-- Tracks all slash commands executed
CREATE TABLE IF NOT EXISTS slack_command_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(255),
  channel_id VARCHAR(255),
  channel_name VARCHAR(255),
  command VARCHAR(100) NOT NULL,
  command_text TEXT,
  response_url TEXT,
  trigger_id VARCHAR(255),
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for command analytics
CREATE INDEX IF NOT EXISTS idx_slack_command_history_team ON slack_command_history(team_id);
CREATE INDEX IF NOT EXISTS idx_slack_command_history_user ON slack_command_history(user_id);
CREATE INDEX IF NOT EXISTS idx_slack_command_history_command ON slack_command_history(command);
CREATE INDEX IF NOT EXISTS idx_slack_command_history_created ON slack_command_history(created_at DESC);

-- Slack Events Log
-- Logs all Slack events received
CREATE TABLE IF NOT EXISTS slack_events_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for event processing
CREATE INDEX IF NOT EXISTS idx_slack_events_log_team ON slack_events_log(team_id);
CREATE INDEX IF NOT EXISTS idx_slack_events_log_type ON slack_events_log(event_type);
CREATE INDEX IF NOT EXISTS idx_slack_events_log_processed ON slack_events_log(processed);
CREATE INDEX IF NOT EXISTS idx_slack_events_log_created ON slack_events_log(created_at DESC);

-- Slack RFQ Channel Mapping
-- Links RFQs to Slack channels for notifications
CREATE TABLE IF NOT EXISTS slack_rfq_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id UUID REFERENCES rfqs(id) ON DELETE CASCADE,
  team_id VARCHAR(255) NOT NULL,
  channel_id VARCHAR(255) NOT NULL,
  channel_name VARCHAR(255),
  message_ts VARCHAR(255), -- Timestamp of the original RFQ message
  thread_ts VARCHAR(255), -- Thread timestamp for replies
  created_by_user_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(rfq_id, team_id, channel_id)
);

-- Index for RFQ notifications
CREATE INDEX IF NOT EXISTS idx_slack_rfq_channels_rfq ON slack_rfq_channels(rfq_id);
CREATE INDEX IF NOT EXISTS idx_slack_rfq_channels_team_channel ON slack_rfq_channels(team_id, channel_id);

-- Slack Deal Notifications
-- Tracks deal notifications sent to Slack
CREATE TABLE IF NOT EXISTS slack_deal_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  team_id VARCHAR(255) NOT NULL,
  channel_id VARCHAR(255) NOT NULL,
  message_ts VARCHAR(255) NOT NULL,
  notification_type VARCHAR(50) NOT NULL, -- created, updated, completed, failed
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for notification history
CREATE INDEX IF NOT EXISTS idx_slack_deal_notifications_deal ON slack_deal_notifications(deal_id);
CREATE INDEX IF NOT EXISTS idx_slack_deal_notifications_team ON slack_deal_notifications(team_id);

-- View: Slack Installation Analytics
CREATE OR REPLACE VIEW slack_installation_analytics AS
SELECT
  si.team_id,
  si.team_name,
  si.is_active,
  si.created_at as installed_at,
  COUNT(DISTINCT sum.slack_user_id) as unique_users,
  COUNT(DISTINCT sch.command) as commands_used,
  COUNT(sch.id) as total_commands_executed,
  COUNT(CASE WHEN sch.created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as commands_24h,
  COUNT(CASE WHEN sch.created_at > NOW() - INTERVAL '7 days' THEN 1 END) as commands_7d,
  MAX(sch.created_at) as last_activity
FROM slack_installations si
LEFT JOIN slack_user_mappings sum ON si.team_id = sum.slack_team_id
LEFT JOIN slack_command_history sch ON si.team_id = sch.team_id
GROUP BY si.team_id, si.team_name, si.is_active, si.created_at;

-- View: Slack Command Analytics
CREATE OR REPLACE VIEW slack_command_analytics AS
SELECT
  command,
  COUNT(*) as total_executions,
  COUNT(DISTINCT team_id) as unique_teams,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(CASE WHEN success = true THEN 1 END) as successful,
  COUNT(CASE WHEN success = false THEN 1 END) as failed,
  ROUND(AVG(execution_time_ms), 2) as avg_execution_time_ms,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as executions_24h,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as executions_7d,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as executions_30d
FROM slack_command_history
GROUP BY command
ORDER BY total_executions DESC;

-- View: Active Slack RFQs
CREATE OR REPLACE VIEW active_slack_rfqs AS
SELECT
  r.id as rfq_id,
  r.requirements,
  r.status,
  src.team_id,
  src.channel_id,
  src.channel_name,
  src.message_ts,
  src.thread_ts,
  src.created_at as posted_at,
  COUNT(q.id) as quote_count
FROM rfqs r
JOIN slack_rfq_channels src ON r.id = src.rfq_id
LEFT JOIN quotes q ON r.id = q.rfq_id
WHERE r.status IN ('open', 'quoted', 'negotiating')
GROUP BY r.id, r.requirements, r.status, src.team_id, src.channel_id, src.channel_name, src.message_ts, src.thread_ts, src.created_at
ORDER BY src.created_at DESC;

-- Function: Log Slack Command
CREATE OR REPLACE FUNCTION log_slack_command(
  p_team_id VARCHAR,
  p_user_id VARCHAR,
  p_user_name VARCHAR,
  p_channel_id VARCHAR,
  p_command VARCHAR,
  p_command_text TEXT,
  p_success BOOLEAN,
  p_error_message TEXT,
  p_execution_time_ms INTEGER
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO slack_command_history (
    team_id, user_id, user_name, channel_id, command, command_text,
    success, error_message, execution_time_ms
  ) VALUES (
    p_team_id, p_user_id, p_user_name, p_channel_id, p_command, p_command_text,
    p_success, p_error_message, p_execution_time_ms
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Get or Create Slack User Mapping
CREATE OR REPLACE FUNCTION get_or_create_slack_user_mapping(
  p_slack_user_id VARCHAR,
  p_slack_team_id VARCHAR,
  p_wells_user_email VARCHAR
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO slack_user_mappings (slack_user_id, slack_team_id, wells_user_email, wells_user_id)
  VALUES (p_slack_user_id, p_slack_team_id, p_wells_user_email, 'slack_' || p_slack_user_id)
  ON CONFLICT (slack_user_id, slack_team_id) DO UPDATE
  SET wells_user_email = p_wells_user_email, updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Link RFQ to Slack Channel
CREATE OR REPLACE FUNCTION link_rfq_to_slack(
  p_rfq_id UUID,
  p_team_id VARCHAR,
  p_channel_id VARCHAR,
  p_message_ts VARCHAR,
  p_created_by_user_id VARCHAR
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO slack_rfq_channels (
    rfq_id, team_id, channel_id, message_ts, created_by_user_id
  ) VALUES (
    p_rfq_id, p_team_id, p_channel_id, p_message_ts, p_created_by_user_id
  )
  ON CONFLICT (rfq_id, team_id, channel_id) DO UPDATE
  SET message_ts = p_message_ts, updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE slack_installations IS 'Stores Slack workspace installations and OAuth tokens';
COMMENT ON TABLE slack_user_mappings IS 'Maps Slack users to Wells AI user accounts';
COMMENT ON TABLE slack_command_history IS 'Tracks all slash commands executed by users';
COMMENT ON TABLE slack_events_log IS 'Logs all Slack events received for debugging';
COMMENT ON TABLE slack_rfq_channels IS 'Links RFQs to Slack channels for notifications';
COMMENT ON TABLE slack_deal_notifications IS 'Tracks deal notifications sent to Slack';
COMMENT ON VIEW slack_installation_analytics IS 'Analytics for Slack workspace usage';
COMMENT ON VIEW slack_command_analytics IS 'Analytics for slash command usage';
COMMENT ON VIEW active_slack_rfqs IS 'Active RFQs posted in Slack channels';
