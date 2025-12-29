-- ============================================================================
-- WELLS AI PROACTIVE COMPANION & INSIGHTS ENGINE SCHEMA
-- ============================================================================
-- "The wise store up choice food and olive oil,
--  but fools gulp theirs down." - Proverbs 21:20
--
-- This schema supports the Wells AI Companion system which makes Wells
-- feel like a living companion that's always working for you.
-- ============================================================================

-- ============================================================================
-- PROACTIVE INSIGHTS
-- ============================================================================

-- Main insights table - stores all generated proactive insights
CREATE TABLE IF NOT EXISTS proactive_insights (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    journey TEXT NOT NULL CHECK (journey IN ('buyer', 'seller', 'founder', 'job_seeker')),
    category TEXT NOT NULL CHECK (category IN (
        'cost_savings', 'revenue_opportunity', 'risk_alert', 'contract_reminder',
        'market_intelligence', 'performance_tip', 'celebration', 'relationship',
        'compliance', 'strategic'
    )),
    urgency TEXT NOT NULL CHECK (urgency IN ('critical', 'high', 'medium', 'low', 'info')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    detailed_explanation TEXT,
    potential_value DECIMAL(15, 2),
    potential_value_type TEXT CHECK (potential_value_type IN ('savings', 'revenue', 'time', 'risk_avoided')),
    action_options JSONB DEFAULT '[]'::jsonb,
    related_entities JSONB,
    data_points JSONB,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acted_upon BOOLEAN NOT NULL DEFAULT FALSE,
    acted_upon_at TIMESTAMPTZ,
    action_taken TEXT,
    dismissed BOOLEAN NOT NULL DEFAULT FALSE,
    dismissed_at TIMESTAMPTZ,
    dismiss_reason TEXT
);

CREATE INDEX idx_proactive_insights_user ON proactive_insights(user_id);
CREATE INDEX idx_proactive_insights_pending ON proactive_insights(user_id, acted_upon, dismissed) WHERE acted_upon = false AND dismissed = false;
CREATE INDEX idx_proactive_insights_urgency ON proactive_insights(urgency, created_at DESC);
CREATE INDEX idx_proactive_insights_category ON proactive_insights(category);
CREATE INDEX idx_proactive_insights_created ON proactive_insights(created_at DESC);

-- Track what actions users take on insights (for learning)
CREATE TABLE IF NOT EXISTS insight_actions (
    id SERIAL PRIMARY KEY,
    insight_id TEXT REFERENCES proactive_insights(id),
    action_taken TEXT NOT NULL,
    action_result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insight_actions_insight ON insight_actions(insight_id);

-- AI responses generated when acting on insights
CREATE TABLE IF NOT EXISTS insight_ai_responses (
    id SERIAL PRIMARY KEY,
    insight_id TEXT REFERENCES proactive_insights(id),
    user_id TEXT NOT NULL,
    task TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insight_ai_responses_insight ON insight_ai_responses(insight_id);

-- Confirmations for confirm-type actions
CREATE TABLE IF NOT EXISTS insight_confirmations (
    id SERIAL PRIMARY KEY,
    insight_id TEXT REFERENCES proactive_insights(id),
    action_id TEXT NOT NULL,
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User feedback on insight quality
CREATE TABLE IF NOT EXISTS insight_feedback (
    id SERIAL PRIMARY KEY,
    insight_id TEXT REFERENCES proactive_insights(id),
    user_id TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insight_feedback_insight ON insight_feedback(insight_id);
CREATE INDEX idx_insight_feedback_user ON insight_feedback(user_id);

-- ============================================================================
-- NOTIFICATION DELIVERY
-- ============================================================================

-- User notification preferences
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    user_id TEXT PRIMARY KEY,
    channels JSONB NOT NULL DEFAULT '{}'::jsonb,
    digest_time TEXT,
    digest_day_of_week INTEGER,
    timezone TEXT DEFAULT 'America/New_York',
    global_quiet_hours_start TEXT,
    global_quiet_hours_end TEXT,
    pause_all BOOLEAN DEFAULT FALSE,
    pause_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track notification deliveries
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id TEXT PRIMARY KEY,
    insight_id TEXT REFERENCES proactive_insights(id),
    user_id TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'slack', 'teams')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failure_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_deliveries_user ON notification_deliveries(user_id);
CREATE INDEX idx_notification_deliveries_status ON notification_deliveries(status, scheduled_for);
CREATE INDEX idx_notification_deliveries_insight ON notification_deliveries(insight_id);

-- Scheduled deliveries queue
CREATE TABLE IF NOT EXISTS scheduled_deliveries (
    id SERIAL PRIMARY KEY,
    insight_id TEXT REFERENCES proactive_insights(id),
    user_id TEXT,
    scheduled_for TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'delivered', 'failed', 'cancelled')),
    delivered_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scheduled_deliveries_pending ON scheduled_deliveries(status, scheduled_for) WHERE status IN ('pending', 'scheduled');

-- ============================================================================
-- TRUST SCORING
-- ============================================================================

-- User trust scores and relationship metrics
CREATE TABLE IF NOT EXISTS user_trust_scores (
    user_id TEXT PRIMARY KEY,
    score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    tier TEXT NOT NULL DEFAULT 'new' CHECK (tier IN ('new', 'developing', 'trusted', 'partner')),
    factors JSONB NOT NULL DEFAULT '{}'::jsonb,
    milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
    autonomy_level JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trust events log
CREATE TABLE IF NOT EXISTS trust_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    details JSONB,
    impact_score DECIMAL(4, 2) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trust_events_user ON trust_events(user_id, timestamp DESC);
CREATE INDEX idx_trust_events_type ON trust_events(event_type);

-- ============================================================================
-- MEMORY ENHANCEMENT
-- ============================================================================

-- User communication preferences (learned from interactions)
CREATE TABLE IF NOT EXISTS user_communication_preferences (
    user_id TEXT PRIMARY KEY,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Personality adaptation settings
CREATE TABLE IF NOT EXISTS personality_adaptations (
    user_id TEXT PRIMARY KEY,
    adaptation JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User goals and timeline tracking
CREATE TABLE IF NOT EXISTS user_goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('revenue', 'cost_savings', 'efficiency', 'growth', 'career', 'personal')),
    target_value DECIMAL(15, 2),
    target_unit TEXT,
    deadline TIMESTAMPTZ,
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    milestones JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_user_goals_user ON user_goals(user_id);
CREATE INDEX idx_user_goals_active ON user_goals(user_id, completed) WHERE completed = false;

-- Conversation references for future recall
CREATE TABLE IF NOT EXISTS conversation_references (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    conversation_date TIMESTAMPTZ NOT NULL,
    topic TEXT NOT NULL,
    summary TEXT NOT NULL,
    outcome TEXT,
    follow_up_needed BOOLEAN DEFAULT FALSE,
    follow_up_date TIMESTAMPTZ,
    related_goals TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversation_references_user ON conversation_references(user_id, conversation_date DESC);
CREATE INDEX idx_conversation_references_follow_up ON conversation_references(user_id, follow_up_needed, follow_up_date) WHERE follow_up_needed = true;

-- Important dates to remember
CREATE TABLE IF NOT EXISTS important_dates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('birthday', 'anniversary', 'deadline', 'renewal', 'custom')),
    reminder_days INTEGER[] DEFAULT '{7, 1}'::integer[],
    recurring BOOLEAN DEFAULT FALSE,
    last_notified TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_important_dates_user ON important_dates(user_id, date);

-- User relationships tracking
CREATE TABLE IF NOT EXISTS user_relationships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('customer', 'supplier', 'partner', 'colleague', 'investor', 'other')),
    company TEXT,
    notes TEXT,
    last_interaction TIMESTAMPTZ,
    interaction_count INTEGER DEFAULT 0,
    sentiment TEXT DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'needs_attention')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE INDEX idx_user_relationships_user ON user_relationships(user_id);
CREATE INDEX idx_user_relationships_attention ON user_relationships(user_id, sentiment) WHERE sentiment = 'needs_attention';

-- User integrations (webhooks, connected services)
CREATE TABLE IF NOT EXISTS user_integrations (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    slack_webhook_url TEXT,
    teams_webhook_url TEXT,
    discord_webhook_url TEXT,
    custom_webhook_url TEXT,
    integration_settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_user_integrations_user ON user_integrations(user_id);

-- ============================================================================
-- INSIGHT GENERATOR TRACKING
-- ============================================================================

-- Track insight generator runs
CREATE TABLE IF NOT EXISTS insight_generator_runs (
    id SERIAL PRIMARY KEY,
    run_id TEXT UNIQUE NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    users_processed INTEGER DEFAULT 0,
    insights_generated INTEGER DEFAULT 0,
    insights_delivered INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    duration_ms INTEGER
);

CREATE INDEX idx_insight_generator_runs_started ON insight_generator_runs(started_at DESC);

-- Learning data for insight optimization
CREATE TABLE IF NOT EXISTS insight_learning_data (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    urgency TEXT NOT NULL,
    journey TEXT NOT NULL,
    total_generated INTEGER DEFAULT 0,
    action_rate DECIMAL(5, 4) DEFAULT 0,
    avg_value DECIMAL(15, 2) DEFAULT 0,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(category, urgency, journey)
);

CREATE INDEX idx_insight_learning_data_lookup ON insight_learning_data(category, urgency, journey);

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View for pending insights with user context
CREATE OR REPLACE VIEW pending_insights_view AS
SELECT
    pi.*,
    uts.tier as user_tier,
    uts.score as user_trust_score,
    unp.channels as notification_channels,
    unp.pause_all as notifications_paused
FROM proactive_insights pi
LEFT JOIN user_trust_scores uts ON pi.user_id = uts.user_id
LEFT JOIN user_notification_preferences unp ON pi.user_id = unp.user_id
WHERE pi.acted_upon = false
  AND pi.dismissed = false
  AND (pi.expires_at IS NULL OR pi.expires_at > NOW());

-- View for insight effectiveness metrics
CREATE OR REPLACE VIEW insight_effectiveness_view AS
SELECT
    category,
    urgency,
    journey,
    COUNT(*) as total_insights,
    COUNT(*) FILTER (WHERE acted_upon = true) as acted_upon_count,
    COUNT(*) FILTER (WHERE dismissed = true) as dismissed_count,
    ROUND(AVG(potential_value)::numeric, 2) as avg_potential_value,
    ROUND((COUNT(*) FILTER (WHERE acted_upon = true)::decimal / NULLIF(COUNT(*), 0) * 100)::numeric, 2) as action_rate
FROM proactive_insights
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY category, urgency, journey
ORDER BY action_rate DESC;

-- View for user relationship health
CREATE OR REPLACE VIEW user_trust_summary_view AS
SELECT
    uts.user_id,
    uts.score,
    uts.tier,
    uts.factors->>'moneySaved' as money_saved,
    uts.factors->>'moneyEarned' as money_earned,
    uts.factors->>'successfulDeals' as successful_deals,
    uts.factors->>'insightsActedUpon' as insights_acted_upon,
    jsonb_array_length(uts.milestones) as milestone_count,
    uts.autonomy_level->>'autoNegotiate' as auto_negotiate_enabled,
    uts.autonomy_level->>'autoApproveThreshold' as auto_approve_threshold,
    uts.last_updated,
    uts.created_at
FROM user_trust_scores uts;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to calculate insight action rate for a user
CREATE OR REPLACE FUNCTION get_user_insight_action_rate(p_user_id TEXT)
RETURNS DECIMAL AS $$
DECLARE
    v_total INTEGER;
    v_acted INTEGER;
BEGIN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE acted_upon = true)
    INTO v_total, v_acted
    FROM proactive_insights
    WHERE user_id = p_user_id
      AND created_at > NOW() - INTERVAL '90 days';

    IF v_total = 0 THEN
        RETURN 0;
    END IF;

    RETURN ROUND((v_acted::decimal / v_total * 100)::numeric, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to get total value delivered to a user
CREATE OR REPLACE FUNCTION get_user_value_delivered(p_user_id TEXT)
RETURNS TABLE(
    money_saved DECIMAL,
    money_earned DECIMAL,
    risks_avoided INTEGER,
    risk_value_avoided DECIMAL,
    total_value DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE((factors->>'moneySaved')::decimal, 0) as money_saved,
        COALESCE((factors->>'moneyEarned')::decimal, 0) as money_earned,
        COALESCE((factors->>'risksAvoided')::integer, 0) as risks_avoided,
        COALESCE((factors->>'riskValueAvoided')::decimal, 0) as risk_value_avoided,
        COALESCE((factors->>'moneySaved')::decimal, 0) +
        COALESCE((factors->>'moneyEarned')::decimal, 0) +
        COALESCE((factors->>'riskValueAvoided')::decimal, 0) as total_value
    FROM user_trust_scores
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA (Development only)
-- ============================================================================

-- Uncomment to insert sample data for development
/*
INSERT INTO user_trust_scores (user_id, score, tier, factors, autonomy_level)
VALUES (
    'sample_user_1',
    45,
    'developing',
    '{"totalInteractions": 50, "successfulDeals": 5, "moneySaved": 5000, "moneyEarned": 10000, "insightsActedUpon": 20, "insightsDismissed": 5, "insightSuccessRate": 80}'::jsonb,
    '{"autoNegotiate": false, "autoApproveThreshold": 1000, "proactiveOutreach": true}'::jsonb
)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO proactive_insights (id, user_id, journey, category, urgency, title, message, potential_value, potential_value_type)
VALUES
    ('sample_insight_1', 'sample_user_1', 'buyer', 'cost_savings', 'high', 'Bearing costs up 15%', 'I found 3 alternatives that could save $12K/year.', 12000, 'savings'),
    ('sample_insight_2', 'sample_user_1', 'buyer', 'contract_reminder', 'medium', 'Contract expires in 30 days', 'Market rates are 8% lower - good time to renegotiate.', 8000, 'savings'),
    ('sample_insight_3', 'sample_user_1', 'buyer', 'risk_alert', 'critical', 'Unusual invoice detected', '$50K invoice from a new vendor requires verification.', 50000, 'risk_avoided')
ON CONFLICT (id) DO NOTHING;
*/
