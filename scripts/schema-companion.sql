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
-- CHAT QUEUE - ALL NOTIFICATIONS SURFACE THROUGH CHAT
-- ============================================================================

-- Chat queue for proactive notifications
CREATE TABLE IF NOT EXISTS chat_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('insight', 'completion', 'reminder', 'celebration', 'alert', 'update')),
    priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low', 'info')),
    message TEXT NOT NULL,
    detailed_message TEXT,
    actions JSONB DEFAULT '[]'::jsonb,
    related_insight_id TEXT REFERENCES proactive_insights(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ
);

CREATE INDEX idx_chat_queue_user ON chat_queue(user_id);
CREATE INDEX idx_chat_queue_pending ON chat_queue(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_chat_queue_priority ON chat_queue(priority, created_at DESC);
CREATE INDEX idx_chat_queue_type ON chat_queue(type);

-- ============================================================================
-- ACTION COMPLETIONS - TRACK WHAT WELLS HAS ACCOMPLISHED
-- ============================================================================

-- Completed actions that Wells has performed
CREATE TABLE IF NOT EXISTS action_completions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('negotiation', 'order', 'payment', 'contract', 'deal', 'task', 'insight_action')),
    entity_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'partial')),
    summary TEXT NOT NULL,
    details JSONB,
    value_generated JSONB,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_action_completions_user ON action_completions(user_id);
CREATE INDEX idx_action_completions_type ON action_completions(user_id, type);
CREATE INDEX idx_action_completions_recent ON action_completions(user_id, completed_at DESC);

-- ============================================================================
-- AUTONOMY OVERRIDES - USER CUSTOM AUTONOMY SETTINGS
-- ============================================================================

-- User autonomy overrides (custom settings on top of trust-based defaults)
CREATE TABLE IF NOT EXISTS user_autonomy_overrides (
    user_id TEXT PRIMARY KEY,
    overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- USER SESSIONS - TRACK ACTIVITY FOR PROACTIVE GREETINGS
-- ============================================================================

-- Track user sessions for "returning user" detection
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    last_login TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_count INTEGER DEFAULT 1,
    total_duration_minutes INTEGER DEFAULT 0,
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_login ON user_sessions(user_id, last_login DESC);

-- ============================================================================
-- DEALS TABLE (if not exists) - FOR ACTIVE DEAL TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS deals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    value DECIMAL(15, 2),
    stage TEXT NOT NULL DEFAULT 'discovery',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled', 'won', 'lost')),
    supplier_id TEXT,
    buyer_id TEXT,
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deals_user ON deals(user_id);
CREATE INDEX idx_deals_active ON deals(user_id, status) WHERE status = 'active';

-- ============================================================================
-- CONTRACTS TABLE (if not exists) - FOR CONTRACT TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS contracts (
    id TEXT PRIMARY KEY,
    buyer_id TEXT NOT NULL,
    supplier_id TEXT,
    category TEXT,
    annual_value DECIMAL(15, 2),
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'expired', 'terminated')),
    terms JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contracts_buyer ON contracts(buyer_id);
CREATE INDEX idx_contracts_expiring ON contracts(buyer_id, end_date) WHERE status = 'active';

-- ============================================================================
-- NEGOTIATIONS TABLE (if not exists) - FOR COMPLETED NEGOTIATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS negotiations (
    id TEXT PRIMARY KEY,
    buyer_id TEXT NOT NULL,
    supplier_id TEXT,
    category TEXT,
    initial_ask DECIMAL(15, 2),
    final_price DECIMAL(15, 2),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'stalled')),
    po_created BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_negotiations_buyer ON negotiations(buyer_id);
CREATE INDEX idx_negotiations_recent ON negotiations(buyer_id, completed_at DESC);

-- ============================================================================
-- ADDITIONAL HELPER VIEWS
-- ============================================================================

-- View for chat queue with insight details
CREATE OR REPLACE VIEW chat_queue_enriched_view AS
SELECT
    cq.*,
    pi.title as insight_title,
    pi.category as insight_category,
    pi.urgency as insight_urgency,
    pi.potential_value,
    pi.potential_value_type
FROM chat_queue cq
LEFT JOIN proactive_insights pi ON cq.related_insight_id = pi.id
WHERE cq.read_at IS NULL
  AND (cq.expires_at IS NULL OR cq.expires_at > NOW());

-- View for user activity summary
CREATE OR REPLACE VIEW user_activity_summary_view AS
SELECT
    us.user_id,
    us.last_login,
    us.session_count,
    EXTRACT(EPOCH FROM (NOW() - us.last_login)) / 3600 as hours_since_login,
    uts.score as trust_score,
    uts.tier as trust_tier,
    (SELECT COUNT(*) FROM chat_queue cq WHERE cq.user_id = us.user_id AND cq.read_at IS NULL) as pending_notifications,
    (SELECT COUNT(*) FROM proactive_insights pi WHERE pi.user_id = us.user_id AND pi.acted_upon = false AND pi.dismissed = false) as pending_insights,
    (SELECT COUNT(*) FROM deals d WHERE d.user_id = us.user_id AND d.status = 'active') as active_deals
FROM user_sessions us
LEFT JOIN user_trust_scores uts ON us.user_id = uts.user_id;

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

-- Sample chat queue items
INSERT INTO chat_queue (id, user_id, type, priority, message, actions)
VALUES
    ('chat_sample_1', 'sample_user_1', 'insight', 'high', 'Your bearing supplier raised prices 8%. I found Precision Bearings can match your specs at 12% less.', '[{"id": "get_quotes", "label": "Get Quotes", "actionType": "ai_task"}]'::jsonb),
    ('chat_sample_2', 'sample_user_1', 'completion', 'info', 'Negotiation with TechCorp finished - we got $4,800 (4% under budget). PO created and sent.', '[{"id": "view", "label": "View Details", "actionType": "navigation"}]'::jsonb),
    ('chat_sample_3', 'sample_user_1', 'reminder', 'medium', 'Contract with Acme Corp expires in 30 days. Based on your history, you have 15% leverage.', '[{"id": "negotiate", "label": "Help Me Negotiate", "actionType": "ai_task"}]'::jsonb)
ON CONFLICT (id) DO NOTHING;
*/

-- ============================================================================
-- WELLS INSIGHTS TABLE (New structured format)
-- ============================================================================

-- Main insights table with the new Insight interface structure
CREATE TABLE IF NOT EXISTS wells_insights (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('savings', 'anomaly', 'vendor', 'market', 'risk', 'opportunity', 'job_match')),
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    details TEXT NOT NULL,
    actionable BOOLEAN NOT NULL DEFAULT TRUE,
    suggested_action TEXT,
    potential_value DECIMAL(15, 2),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    acted_on BOOLEAN NOT NULL DEFAULT FALSE,
    acted_on_at TIMESTAMPTZ,
    dismissed BOOLEAN NOT NULL DEFAULT FALSE,
    dismissed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_wells_insights_user ON wells_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_wells_insights_pending ON wells_insights(user_id, acted_on, dismissed) WHERE acted_on = false AND dismissed = false;
CREATE INDEX IF NOT EXISTS idx_wells_insights_type ON wells_insights(type);
CREATE INDEX IF NOT EXISTS idx_wells_insights_priority ON wells_insights(priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wells_insights_created ON wells_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wells_insights_unread ON wells_insights(user_id, read_at) WHERE read_at IS NULL;

-- ============================================================================
-- WELLS USER PREFERENCES
-- ============================================================================

-- User preferences for insight generation and delivery
CREATE TABLE IF NOT EXISTS wells_user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,

    -- Insight frequency preferences
    insight_frequency TEXT DEFAULT 'realtime' CHECK (insight_frequency IN ('realtime', 'hourly', 'daily', 'weekly')),
    max_insights_per_day INTEGER DEFAULT 10,

    -- Notification channels
    notification_channels JSONB DEFAULT '{
        "in_app": true,
        "email": false,
        "sms": false,
        "slack": false,
        "teams": false
    }'::jsonb,

    -- Priority thresholds
    email_priority_threshold TEXT DEFAULT 'high' CHECK (email_priority_threshold IN ('low', 'medium', 'high', 'urgent')),
    sms_priority_threshold TEXT DEFAULT 'urgent' CHECK (sms_priority_threshold IN ('low', 'medium', 'high', 'urgent')),

    -- Quiet hours
    quiet_hours_enabled BOOLEAN DEFAULT FALSE,
    quiet_hours_start TEXT DEFAULT '22:00',
    quiet_hours_end TEXT DEFAULT '08:00',
    timezone TEXT DEFAULT 'America/New_York',

    -- Insight type preferences
    enabled_insight_types TEXT[] DEFAULT ARRAY['savings', 'anomaly', 'vendor', 'market', 'risk', 'opportunity', 'job_match'],

    -- Learning preferences
    learn_from_actions BOOLEAN DEFAULT TRUE,
    personalize_insights BOOLEAN DEFAULT TRUE,

    -- Pause controls
    paused BOOLEAN DEFAULT FALSE,
    paused_until TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wells_user_prefs_user ON wells_user_preferences(user_id);

-- ============================================================================
-- WELLS ACTIVITY LOG
-- ============================================================================

-- Track what Wells is doing/monitoring for each user
CREATE TABLE IF NOT EXISTS wells_activity_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,

    -- Activity details
    action_type TEXT NOT NULL CHECK (action_type IN (
        'monitoring', 'analyzing', 'tracking', 'searching', 'negotiating', 'matching'
    )),
    description TEXT NOT NULL,

    -- Related entities
    related_entity_type TEXT CHECK (related_entity_type IN (
        'rfq', 'order', 'invoice', 'contract', 'supplier', 'job', 'application', 'deal'
    )),
    related_entity_id TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- Status
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_wells_activity_user ON wells_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_wells_activity_status ON wells_activity_log(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_wells_activity_recent ON wells_activity_log(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_wells_activity_type ON wells_activity_log(action_type);

-- ============================================================================
-- VIEWS FOR WELLS ACTIVITY
-- ============================================================================

-- View for current Wells activity per user
CREATE OR REPLACE VIEW wells_current_activity_view AS
SELECT
    user_id,
    COUNT(*) FILTER (WHERE status = 'in_progress') as active_tasks,
    COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '1 hour') as recently_completed,
    ARRAY_AGG(description) FILTER (WHERE status = 'in_progress') as current_descriptions,
    MAX(started_at) FILTER (WHERE status = 'in_progress') as latest_activity
FROM wells_activity_log
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id;

-- View for insight effectiveness
CREATE OR REPLACE VIEW wells_insight_effectiveness_view AS
SELECT
    type,
    priority,
    COUNT(*) as total_insights,
    COUNT(*) FILTER (WHERE acted_on = true) as acted_on_count,
    COUNT(*) FILTER (WHERE dismissed = true) as dismissed_count,
    ROUND(AVG(potential_value)::numeric, 2) as avg_potential_value,
    ROUND((COUNT(*) FILTER (WHERE acted_on = true)::decimal / NULLIF(COUNT(*), 0) * 100)::numeric, 2) as action_rate
FROM wells_insights
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY type, priority
ORDER BY action_rate DESC;

-- ============================================================================
-- TRIGGERS FOR WELLS TABLES
-- ============================================================================

-- Update timestamp trigger for wells_user_preferences
CREATE OR REPLACE FUNCTION update_wells_prefs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wells_prefs_updated
    BEFORE UPDATE ON wells_user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_wells_prefs_timestamp();

-- ============================================================================
-- END OF SCHEMA ADDITIONS
-- ============================================================================
