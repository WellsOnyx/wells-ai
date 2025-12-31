-- ============================================================================
-- COMMUNICATION GUARD SCHEMA
-- AI-to-AI Negotiation Communication Enforcement
-- ============================================================================
-- This schema tracks bypass attempts and enforces the rule that
-- humans NEVER talk directly to each other in negotiations.
-- ============================================================================

-- Drop tables if they exist
DROP TABLE IF EXISTS communication_bypass_attempts CASCADE;
DROP TABLE IF EXISTS ai_agent_states CASCADE;
DROP TABLE IF EXISTS human_instructions CASCADE;
DROP TABLE IF EXISTS translated_messages CASCADE;

-- ============================================================================
-- COMMUNICATION BYPASS ATTEMPTS
-- Logs any attempt to bypass the AI-to-AI communication layer
-- ============================================================================
CREATE TABLE IF NOT EXISTS communication_bypass_attempts (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Communication path
    origin VARCHAR(32) NOT NULL CHECK (origin IN ('buyer_human', 'buyer_ai', 'seller_human', 'seller_ai', 'system')),
    intended_destination VARCHAR(32) NOT NULL CHECK (intended_destination IN ('buyer_human', 'buyer_ai', 'seller_human', 'seller_ai')),

    -- Message details (truncated for storage)
    message_content TEXT,
    block_reason TEXT NOT NULL,

    -- User context
    user_id VARCHAR(64),
    ip_address VARCHAR(45),
    user_agent TEXT,

    -- Indexes for quick lookup
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bypass_session ON communication_bypass_attempts(session_id);
CREATE INDEX idx_bypass_origin ON communication_bypass_attempts(origin);
CREATE INDEX idx_bypass_timestamp ON communication_bypass_attempts(timestamp DESC);
CREATE INDEX idx_bypass_user ON communication_bypass_attempts(user_id);

-- ============================================================================
-- AI AGENT STATES
-- Tracks the state of AI agents representing each party
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_agent_states (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    party_type VARCHAR(16) NOT NULL CHECK (party_type IN ('buyer', 'seller')),
    agent_id VARCHAR(64) NOT NULL,

    -- Human's view (what AI told them)
    human_view_last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    human_view_current_offer JSONB,
    human_view_ai_interpretation TEXT,
    human_view_suggested_responses JSONB DEFAULT '[]'::jsonb,

    -- Actual negotiation state (AI-to-AI)
    actual_state_last_message JSONB,
    actual_state_current_terms JSONB,
    actual_state_round_number INT DEFAULT 0,

    -- Human's constraints
    human_constraints JSONB DEFAULT '{
        "maxPrice": null,
        "minPrice": null,
        "maxLeadTime": null,
        "nonNegotiables": [],
        "priorities": []
    }'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(session_id, party_type)
);

CREATE INDEX idx_agent_states_session ON ai_agent_states(session_id);
CREATE INDEX idx_agent_states_party ON ai_agent_states(party_type);

-- ============================================================================
-- HUMAN INSTRUCTIONS
-- Records human instructions to their AI agents
-- ============================================================================
CREATE TABLE IF NOT EXISTS human_instructions (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    party_type VARCHAR(16) NOT NULL CHECK (party_type IN ('buyer', 'seller')),

    -- Original instruction
    instruction_text TEXT NOT NULL,

    -- Parsed intent
    intent VARCHAR(32) CHECK (intent IN (
        'push_back_price', 'push_back_terms', 'accept_offer', 'reject_offer',
        'request_info', 'modify_constraints', 'set_limit', 'escalate',
        'pause', 'proceed', 'unknown'
    )),

    -- Extracted targets
    targets JSONB DEFAULT '[]'::jsonb,

    -- Preferences
    preferred_approach VARCHAR(16) CHECK (preferred_approach IN ('aggressive', 'balanced', 'conservative')),
    urgency VARCHAR(16) CHECK (urgency IN ('low', 'medium', 'high')),

    -- Processing status
    processed BOOLEAN DEFAULT FALSE,
    ai_acknowledgment TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_instructions_session ON human_instructions(session_id);
CREATE INDEX idx_instructions_intent ON human_instructions(intent);
CREATE INDEX idx_instructions_unprocessed ON human_instructions(session_id) WHERE processed = FALSE;

-- ============================================================================
-- TRANSLATED MESSAGES
-- Records AI translations of human messages for inter-party communication
-- ============================================================================
CREATE TABLE IF NOT EXISTS translated_messages (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    party_type VARCHAR(16) NOT NULL CHECK (party_type IN ('buyer', 'seller')),

    -- Original human input
    human_input TEXT NOT NULL,

    -- AI translation
    ai_translation TEXT NOT NULL,

    -- Extracted data
    key_points JSONB DEFAULT '[]'::jsonb,
    emotional_content_filtered BOOLEAN DEFAULT FALSE,
    extracted_position JSONB,
    confidence INT CHECK (confidence >= 0 AND confidence <= 100),

    -- Message routing
    used_in_negotiation BOOLEAN DEFAULT FALSE,
    negotiation_message_id VARCHAR(64),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_translated_session ON translated_messages(session_id);
CREATE INDEX idx_translated_party ON translated_messages(party_type);

-- ============================================================================
-- COMMUNICATION AUDIT LOG
-- Complete audit trail of all communication events
-- ============================================================================
CREATE TABLE IF NOT EXISTS communication_audit_log (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id VARCHAR(64) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Event type
    event_type VARCHAR(64) NOT NULL CHECK (event_type IN (
        'human_message_received',
        'human_message_translated',
        'ai_message_sent',
        'ai_message_received',
        'bypass_attempt_blocked',
        'decision_requested',
        'decision_received',
        'escalation_triggered',
        'negotiation_paused',
        'negotiation_resumed'
    )),

    -- Parties involved
    origin VARCHAR(32),
    destination VARCHAR(32),

    -- Event details
    details JSONB DEFAULT '{}'::jsonb,

    -- Outcome
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT
);

CREATE INDEX idx_audit_session ON communication_audit_log(session_id);
CREATE INDEX idx_audit_type ON communication_audit_log(event_type);
CREATE INDEX idx_audit_timestamp ON communication_audit_log(timestamp DESC);

-- ============================================================================
-- HUMAN DECISION POINTS
-- Tracks decisions that require human approval
-- ============================================================================
CREATE TABLE IF NOT EXISTS human_decision_points (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    party_type VARCHAR(16) NOT NULL CHECK (party_type IN ('buyer', 'seller')),

    -- Decision details
    decision_type VARCHAR(64) NOT NULL CHECK (decision_type IN (
        'accept_offer',
        'reject_offer',
        'counter_offer_approval',
        'exceed_budget',
        'change_constraints',
        'terminate_negotiation',
        'custom'
    )),

    -- Context
    context JSONB NOT NULL,
    ai_recommendation TEXT,
    options JSONB DEFAULT '[]'::jsonb,

    -- Status
    status VARCHAR(16) DEFAULT 'pending' CHECK (status IN ('pending', 'decided', 'expired', 'superseded')),
    decision VARCHAR(64),
    decision_timestamp TIMESTAMP WITH TIME ZONE,

    -- Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,

    UNIQUE(session_id, party_type, decision_type) WHERE status = 'pending'
);

CREATE INDEX idx_decisions_session ON human_decision_points(session_id);
CREATE INDEX idx_decisions_pending ON human_decision_points(party_type, status) WHERE status = 'pending';

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: Active bypass attempts in last 24 hours
CREATE OR REPLACE VIEW v_recent_bypass_attempts AS
SELECT
    ba.*,
    ns.buyer_org_name,
    ns.seller_org_name
FROM communication_bypass_attempts ba
LEFT JOIN multi_seller_negotiation_sessions ns ON ba.session_id = ns.id
WHERE ba.timestamp > NOW() - INTERVAL '24 hours'
ORDER BY ba.timestamp DESC;

-- View: Communication health by session
CREATE OR REPLACE VIEW v_session_communication_health AS
SELECT
    session_id,
    COUNT(CASE WHEN event_type = 'bypass_attempt_blocked' THEN 1 END) as bypass_attempts,
    COUNT(CASE WHEN event_type = 'human_message_translated' THEN 1 END) as messages_translated,
    COUNT(CASE WHEN event_type = 'decision_requested' THEN 1 END) as decisions_requested,
    COUNT(CASE WHEN event_type = 'decision_received' THEN 1 END) as decisions_received,
    MIN(timestamp) as first_activity,
    MAX(timestamp) as last_activity
FROM communication_audit_log
GROUP BY session_id;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Log a communication event
CREATE OR REPLACE FUNCTION log_communication_event(
    p_session_id VARCHAR(64),
    p_event_type VARCHAR(64),
    p_origin VARCHAR(32) DEFAULT NULL,
    p_destination VARCHAR(32) DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb,
    p_success BOOLEAN DEFAULT TRUE,
    p_error_message TEXT DEFAULT NULL
) RETURNS VARCHAR(64) AS $$
DECLARE
    v_event_id VARCHAR(64);
BEGIN
    v_event_id := gen_random_uuid()::text;

    INSERT INTO communication_audit_log (
        id, session_id, event_type, origin, destination, details, success, error_message
    ) VALUES (
        v_event_id, p_session_id, p_event_type, p_origin, p_destination, p_details, p_success, p_error_message
    );

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Check if communication path is allowed
CREATE OR REPLACE FUNCTION is_communication_allowed(
    p_origin VARCHAR(32),
    p_destination VARCHAR(32)
) RETURNS BOOLEAN AS $$
BEGIN
    -- Allowed paths
    IF (p_origin = 'buyer_human' AND p_destination = 'buyer_ai') OR
       (p_origin = 'seller_human' AND p_destination = 'seller_ai') OR
       (p_origin = 'buyer_ai' AND p_destination = 'seller_ai') OR
       (p_origin = 'seller_ai' AND p_destination = 'buyer_ai') OR
       (p_origin = 'buyer_ai' AND p_destination = 'buyer_human') OR
       (p_origin = 'seller_ai' AND p_destination = 'seller_human') OR
       (p_origin = 'system' AND p_destination IS NOT NULL) THEN
        RETURN TRUE;
    END IF;

    -- Blocked paths (explicit)
    IF (p_origin = 'buyer_human' AND p_destination = 'seller_human') OR
       (p_origin = 'buyer_human' AND p_destination = 'seller_ai') OR
       (p_origin = 'seller_human' AND p_destination = 'buyer_human') OR
       (p_origin = 'seller_human' AND p_destination = 'buyer_ai') THEN
        RETURN FALSE;
    END IF;

    -- Default deny
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Update timestamp on ai_agent_states
CREATE OR REPLACE FUNCTION update_agent_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_agent_state_updated
    BEFORE UPDATE ON ai_agent_states
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_state_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE communication_bypass_attempts IS 'Security audit log of attempts to bypass AI-mediated communication';
COMMENT ON TABLE ai_agent_states IS 'Current state of AI agents representing buyers and sellers';
COMMENT ON TABLE human_instructions IS 'Human instructions parsed and queued for AI execution';
COMMENT ON TABLE translated_messages IS 'Human messages translated to professional negotiation language';
COMMENT ON TABLE communication_audit_log IS 'Complete audit trail of all communication events';
COMMENT ON TABLE human_decision_points IS 'Decisions requiring explicit human approval';

COMMENT ON FUNCTION is_communication_allowed IS 'Validates if a communication path follows AI-to-AI protocol';
COMMENT ON FUNCTION log_communication_event IS 'Logs a communication event to the audit trail';
