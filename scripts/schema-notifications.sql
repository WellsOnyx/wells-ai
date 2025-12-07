-- ============================================================================
-- WELLS ONYX NOTIFICATION SYSTEM
-- Database Schema for Notifications, Preferences, and Tracking
-- ============================================================================

-- ============================================================================
-- NOTIFICATION PREFERENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,

  -- Channel preferences
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Notification type preferences
  payment_notifications BOOLEAN NOT NULL DEFAULT true,
  credit_notifications BOOLEAN NOT NULL DEFAULT true,
  marketing_notifications BOOLEAN NOT NULL DEFAULT false,
  transaction_alerts BOOLEAN NOT NULL DEFAULT true,
  security_alerts BOOLEAN NOT NULL DEFAULT true,
  partner_updates BOOLEAN NOT NULL DEFAULT false,

  -- Quiet hours
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TEXT, -- HH:MM format (e.g., "22:00")
  quiet_hours_end TEXT,   -- HH:MM format (e.g., "08:00")
  timezone TEXT DEFAULT 'America/New_York',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user
  ON notification_preferences(user_id);

-- ============================================================================
-- NOTIFICATIONS LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recipient info
  user_id TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,

  -- Notification details
  type TEXT NOT NULL, -- payment_received, payment_claimed, credit_approved, etc.
  channel TEXT NOT NULL, -- email, sms, push, all
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'sent', -- sent, delivered, failed, bounced
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB, -- Store email_id, sms_id, and other provider-specific data
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_status
  ON notifications(status);

CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON notifications(type);

CREATE INDEX IF NOT EXISTS idx_notifications_sent_at
  ON notifications(sent_at DESC);

-- Index for webhook lookups by provider IDs
CREATE INDEX IF NOT EXISTS idx_notifications_email_id
  ON notifications((metadata->>'emailId'));

CREATE INDEX IF NOT EXISTS idx_notifications_sms_id
  ON notifications((metadata->>'smsId'));

-- ============================================================================
-- SCHEDULED NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recipient info
  user_id TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,

  -- Notification details
  type TEXT NOT NULL,
  channel TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  data JSONB NOT NULL,

  -- Scheduling
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed, cancelled
  error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for finding notifications to send
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_pending
  ON scheduled_notifications(status, scheduled_at)
  WHERE status = 'pending';

-- ============================================================================
-- NOTIFICATION ENGAGEMENT TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,

  -- Engagement type
  event_type TEXT NOT NULL, -- email.opened, email.clicked, sms.clicked, etc.
  event_data JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_notification_engagement_notification
  ON notification_engagement(notification_id);

CREATE INDEX IF NOT EXISTS idx_notification_engagement_event_type
  ON notification_engagement(event_type);

-- ============================================================================
-- UNSUBSCRIBE TOKENS
-- ============================================================================

CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

-- Index for token verification
CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token
  ON unsubscribe_tokens(token);

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_user
  ON unsubscribe_tokens(user_id);

-- ============================================================================
-- NOTIFICATION TEMPLATES (for future template management)
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template info
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- payment_received, credit_approved, etc.
  channel TEXT NOT NULL, -- email, sms

  -- Template content
  subject TEXT, -- For emails
  body_html TEXT, -- For emails
  body_text TEXT, -- For SMS or plain text emails

  -- Variables/placeholders
  variables JSONB, -- List of required variables (e.g., ["amount", "senderName"])

  -- Status
  active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for template lookups
CREATE INDEX IF NOT EXISTS idx_notification_templates_type_channel
  ON notification_templates(type, channel);

-- ============================================================================
-- NOTIFICATION ANALYTICS (aggregated stats)
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Date for aggregation
  date DATE NOT NULL,

  -- Aggregation dimensions
  type TEXT NOT NULL,
  channel TEXT NOT NULL,

  -- Metrics
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_delivered INTEGER NOT NULL DEFAULT 0,
  total_failed INTEGER NOT NULL DEFAULT 0,
  total_bounced INTEGER NOT NULL DEFAULT 0,
  total_opened INTEGER NOT NULL DEFAULT 0, -- For emails
  total_clicked INTEGER NOT NULL DEFAULT 0, -- For emails/SMS with links

  -- Timing metrics
  avg_delivery_time_seconds INTEGER, -- Average time to delivery

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(date, type, channel)
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_notification_analytics_date
  ON notification_analytics(date DESC);

CREATE INDEX IF NOT EXISTS idx_notification_analytics_type
  ON notification_analytics(type);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Recent notifications per user
CREATE OR REPLACE VIEW v_user_recent_notifications AS
SELECT
  user_id,
  type,
  channel,
  status,
  sent_at,
  delivered_at,
  metadata->>'emailId' as email_id,
  metadata->>'smsId' as sms_id
FROM notifications
WHERE sent_at > NOW() - INTERVAL '30 days'
ORDER BY sent_at DESC;

-- View: Notification delivery rates
CREATE OR REPLACE VIEW v_notification_delivery_rates AS
SELECT
  type,
  channel,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'bounced') as bounced,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'delivered') / NULLIF(COUNT(*), 0),
    2
  ) as delivery_rate_percent
FROM notifications
WHERE sent_at > NOW() - INTERVAL '7 days'
GROUP BY type, channel
ORDER BY total DESC;

-- View: User notification preferences summary
CREATE OR REPLACE VIEW v_user_notification_prefs_summary AS
SELECT
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE email_enabled) as email_enabled_count,
  COUNT(*) FILTER (WHERE sms_enabled) as sms_enabled_count,
  COUNT(*) FILTER (WHERE payment_notifications) as payment_notif_count,
  COUNT(*) FILTER (WHERE credit_notifications) as credit_notif_count,
  COUNT(*) FILTER (WHERE marketing_notifications) as marketing_notif_count,
  COUNT(*) FILTER (WHERE quiet_hours_enabled) as quiet_hours_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE email_enabled) / NULLIF(COUNT(*), 0), 2) as email_enabled_percent,
  ROUND(100.0 * COUNT(*) FILTER (WHERE sms_enabled) / NULLIF(COUNT(*), 0), 2) as sms_enabled_percent
FROM notification_preferences;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Update notification_preferences.updated_at on change
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Function: Aggregate daily notification stats
CREATE OR REPLACE FUNCTION aggregate_notification_stats(target_date DATE)
RETURNS VOID AS $$
BEGIN
  INSERT INTO notification_analytics (
    date,
    type,
    channel,
    total_sent,
    total_delivered,
    total_failed,
    total_bounced,
    total_opened,
    total_clicked,
    avg_delivery_time_seconds
  )
  SELECT
    target_date,
    n.type,
    n.channel,
    COUNT(*) as total_sent,
    COUNT(*) FILTER (WHERE n.status = 'delivered') as total_delivered,
    COUNT(*) FILTER (WHERE n.status = 'failed') as total_failed,
    COUNT(*) FILTER (WHERE n.status = 'bounced') as total_bounced,
    COUNT(DISTINCT e.id) FILTER (WHERE e.event_type = 'email.opened') as total_opened,
    COUNT(DISTINCT e.id) FILTER (WHERE e.event_type = 'email.clicked') as total_clicked,
    ROUND(AVG(EXTRACT(EPOCH FROM (n.delivered_at - n.sent_at)))) as avg_delivery_time_seconds
  FROM notifications n
  LEFT JOIN notification_engagement e ON e.notification_id = n.id
  WHERE DATE(n.sent_at) = target_date
  GROUP BY n.type, n.channel
  ON CONFLICT (date, type, channel)
  DO UPDATE SET
    total_sent = EXCLUDED.total_sent,
    total_delivered = EXCLUDED.total_delivered,
    total_failed = EXCLUDED.total_failed,
    total_bounced = EXCLUDED.total_bounced,
    total_opened = EXCLUDED.total_opened,
    total_clicked = EXCLUDED.total_clicked,
    avg_delivery_time_seconds = EXCLUDED.avg_delivery_time_seconds,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Insert sample notification preferences
INSERT INTO notification_preferences (
  user_id,
  email_enabled,
  sms_enabled,
  payment_notifications,
  credit_notifications,
  marketing_notifications
) VALUES
  ('user_test_1', true, true, true, true, false),
  ('user_test_2', true, false, true, true, true)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- CLEANUP / MAINTENANCE QUERIES
-- ============================================================================

-- Query: Delete old notifications (keep last 90 days)
-- Run this periodically as a maintenance task
-- DELETE FROM notifications WHERE sent_at < NOW() - INTERVAL '90 days';

-- Query: Delete old scheduled notifications (keep last 30 days)
-- DELETE FROM scheduled_notifications WHERE created_at < NOW() - INTERVAL '30 days' AND status != 'pending';

-- Query: Delete expired unsubscribe tokens
-- DELETE FROM unsubscribe_tokens WHERE expires_at < NOW();

-- ============================================================================
-- GRANTS (adjust based on your user roles)
-- ============================================================================

-- Grant permissions to application user (replace 'app_user' with your user)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE notification_preferences IS 'User preferences for notification channels and types';
COMMENT ON TABLE notifications IS 'Log of all sent notifications with delivery status';
COMMENT ON TABLE scheduled_notifications IS 'Notifications scheduled for future delivery';
COMMENT ON TABLE notification_engagement IS 'Track opens, clicks, and other engagement events';
COMMENT ON TABLE unsubscribe_tokens IS 'One-click unsubscribe tokens for email/SMS';
COMMENT ON TABLE notification_templates IS 'Notification templates for different types and channels';
COMMENT ON TABLE notification_analytics IS 'Aggregated daily notification statistics';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
