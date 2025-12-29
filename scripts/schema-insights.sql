-- ============================================================================
-- Conversational Insights Schema
-- Business intelligence through natural language
-- ============================================================================

-- Custom Alerts
-- Users can set up alerts like "Alert me if any deal over $10k stalls"
CREATE TABLE IF NOT EXISTS custom_alerts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    condition_type VARCHAR(50) NOT NULL, -- deal_stalled, deal_over_threshold, conversion_drop, lead_spike, revenue_milestone, inactive_lead, custom
    threshold DECIMAL(15, 2),
    entity VARCHAR(255), -- specific entity to watch
    custom_query TEXT, -- for custom conditions
    channels TEXT[] DEFAULT ARRAY['chat'], -- chat, email, slack, sms
    frequency VARCHAR(20) DEFAULT 'daily', -- realtime, hourly, daily, weekly
    enabled BOOLEAN DEFAULT true,
    last_triggered TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Index for efficient alert checking
CREATE INDEX IF NOT EXISTS idx_custom_alerts_user ON custom_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_alerts_enabled ON custom_alerts(user_id, enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_custom_alerts_condition ON custom_alerts(condition_type);

-- Alert History (when alerts are triggered)
CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id VARCHAR(64) REFERENCES custom_alerts(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    condition_met TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(255),
    notification_sent BOOLEAN DEFAULT false,
    notification_channels TEXT[],
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_alert_history_alert ON alert_history(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_user ON alert_history(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_triggered ON alert_history(triggered_at);

-- Digest Preferences
-- Users can configure their briefings/digests
CREATE TABLE IF NOT EXISTS digest_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL UNIQUE,
    morning_digest BOOLEAN DEFAULT true,
    evening_digest BOOLEAN DEFAULT false,
    weekly_digest BOOLEAN DEFAULT true,
    morning_time TIME DEFAULT '08:00',
    evening_time TIME DEFAULT '18:00',
    weekly_day INTEGER DEFAULT 1, -- 1 = Monday
    sections TEXT[] DEFAULT ARRAY['pipeline_summary', 'urgent_items', 'recommendations'],
    channels TEXT[] DEFAULT ARRAY['chat'],
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_digest_prefs_user ON digest_preferences(user_id);

-- Insight Queries Log
-- Track what users are asking for analytics purposes
CREATE TABLE IF NOT EXISTS insight_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    query TEXT NOT NULL,
    parsed_intent JSONB,
    category VARCHAR(50),
    action VARCHAR(50),
    time_range VARCHAR(20),
    response_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insight_queries_user ON insight_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_insight_queries_category ON insight_queries(category);
CREATE INDEX IF NOT EXISTS idx_insight_queries_created ON insight_queries(created_at);

-- Saved Reports
-- Users can save report configurations for quick access
CREATE TABLE IF NOT EXISTS saved_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    report_type VARCHAR(50) NOT NULL, -- pipeline, revenue, leads, full, custom
    config JSONB NOT NULL DEFAULT '{}', -- time_range, metrics, filters, etc.
    schedule VARCHAR(50), -- daily, weekly, monthly, or null for on-demand
    last_generated TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_reports_user ON saved_reports(user_id);

-- Insight Feedback
-- Track when users find insights helpful or not
CREATE TABLE IF NOT EXISTS insight_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    query_id UUID REFERENCES insight_queries(id),
    helpful BOOLEAN,
    feedback_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insight_feedback_query ON insight_feedback(query_id);

-- Metrics Snapshots
-- Store periodic snapshots for historical comparison
CREATE TABLE IF NOT EXISTS metrics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    snapshot_date DATE NOT NULL,
    snapshot_type VARCHAR(20) NOT NULL, -- daily, weekly, monthly
    metrics JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_snapshots_unique
ON metrics_snapshots(user_id, snapshot_date, snapshot_type);

CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_user_date
ON metrics_snapshots(user_id, snapshot_date);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_custom_alerts_updated ON custom_alerts;
CREATE TRIGGER trigger_custom_alerts_updated
    BEFORE UPDATE ON custom_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_insights_updated_at();

DROP TRIGGER IF EXISTS trigger_digest_prefs_updated ON digest_preferences;
CREATE TRIGGER trigger_digest_prefs_updated
    BEFORE UPDATE ON digest_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_insights_updated_at();

DROP TRIGGER IF EXISTS trigger_saved_reports_updated ON saved_reports;
CREATE TRIGGER trigger_saved_reports_updated
    BEFORE UPDATE ON saved_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_insights_updated_at();

-- ============================================================================
-- Sample Data (for testing)
-- ============================================================================

-- Example custom alerts
-- INSERT INTO custom_alerts (id, user_id, name, condition_type, threshold, channels, frequency)
-- VALUES
--     ('alert_sample_1', 'user_test123', 'High-value deal stalled', 'deal_over_threshold', 10000, ARRAY['chat', 'email'], 'daily'),
--     ('alert_sample_2', 'user_test123', 'Lead not contacted in 48h', 'inactive_lead', 48, ARRAY['chat'], 'hourly'),
--     ('alert_sample_3', 'user_test123', 'Lead volume spike', 'lead_spike', 5, ARRAY['chat', 'slack'], 'realtime');

COMMENT ON TABLE custom_alerts IS 'User-configured alerts for business events';
COMMENT ON TABLE alert_history IS 'History of triggered alerts';
COMMENT ON TABLE digest_preferences IS 'User preferences for daily/weekly briefings';
COMMENT ON TABLE insight_queries IS 'Log of all insight queries for analytics';
COMMENT ON TABLE saved_reports IS 'User-saved report configurations';
COMMENT ON TABLE metrics_snapshots IS 'Historical snapshots of key metrics';
