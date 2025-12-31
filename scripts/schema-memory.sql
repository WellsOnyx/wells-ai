-- ============================================================================
-- WELLS MEMORY SYSTEM SCHEMA
-- "I will remember my covenant between me and you and all living creatures."
-- - Genesis 9:15
--
-- Complete schema for Wells' memory and personalization system.
-- Wells remembers EVERYTHING and uses it to personalize the experience.
--
-- Run: psql $POSTGRES_URL < scripts/schema-memory.sql
-- ============================================================================

-- ============================================================================
-- MAIN USER MEMORY TABLE
-- Core storage for all user memory data
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,

  -- ==========================================================================
  -- EXPLICIT FACTS (user told us)
  -- ==========================================================================
  name TEXT,
  preferred_name TEXT,
  email TEXT,
  phone TEXT,
  avatar TEXT,

  -- Professional info
  company TEXT,
  role TEXT,
  title TEXT,
  industry TEXT,
  company_size TEXT CHECK (company_size IN ('solo', 'startup', 'small', 'medium', 'enterprise')),
  department TEXT,

  -- Location
  location TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  timezone TEXT,

  -- Custom preferences (flexible JSONB)
  custom_preferences JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',

  -- ==========================================================================
  -- BEHAVIORAL PATTERNS (observed)
  -- ==========================================================================
  active_hours JSONB,  -- { start: 9, end: 17, timezone: 'America/New_York' }
  active_days TEXT[],
  response_speed TEXT CHECK (response_speed IN ('instant', 'quick', 'thoughtful', 'slow', 'varies')),
  avg_response_time INTEGER,  -- minutes
  communication_style TEXT CHECK (communication_style IN ('formal', 'casual', 'mixed', 'adaptive')),
  message_length TEXT CHECK (message_length IN ('brief', 'moderate', 'detailed', 'varies')),
  uses_emoji BOOLEAN DEFAULT FALSE,
  decision_style TEXT CHECK (decision_style IN ('quick', 'deliberate', 'consensus', 'data-driven')),
  avg_decision_time INTEGER,  -- minutes
  session_duration TEXT CHECK (session_duration IN ('short', 'medium', 'long', 'varies')),
  avg_session_minutes INTEGER,
  frequent_features TEXT[] DEFAULT '{}',
  rare_features TEXT[] DEFAULT '{}',
  typical_absence_hours INTEGER,
  typical_mood TEXT CHECK (typical_mood IN ('optimistic', 'neutral', 'stressed', 'focused')),

  -- ==========================================================================
  -- RELATIONSHIP HISTORY
  -- ==========================================================================
  first_contact TIMESTAMP NOT NULL DEFAULT NOW(),
  first_interaction_summary TEXT,
  total_interactions INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  successful_deals INTEGER DEFAULT 0,
  failed_deals INTEGER DEFAULT 0,
  total_value_transacted DECIMAL(15, 2) DEFAULT 0,
  avg_deal_value DECIMAL(15, 2),
  quotes_requested INTEGER DEFAULT 0,
  quotes_accepted INTEGER DEFAULT 0,
  quote_conversion_rate DECIMAL(5, 4),
  last_interaction TIMESTAMP NOT NULL DEFAULT NOW(),
  longest_streak INTEGER,
  current_streak INTEGER DEFAULT 0,
  trust_score INTEGER DEFAULT 0 CHECK (trust_score >= 0 AND trust_score <= 100),
  trust_tier TEXT DEFAULT 'new' CHECK (trust_tier IN ('new', 'developing', 'established', 'trusted', 'guardian')),
  milestones JSONB DEFAULT '[]',
  referrals_made INTEGER DEFAULT 0,
  referrals_received INTEGER DEFAULT 0,

  -- ==========================================================================
  -- RECENT CONTEXT (short-term memory)
  -- ==========================================================================
  last_topic TEXT,
  last_topic_timestamp TIMESTAMP,
  ongoing_projects JSONB DEFAULT '[]',
  pending_actions JSONB DEFAULT '[]',
  open_questions TEXT[] DEFAULT '{}',
  promises JSONB DEFAULT '[]',
  concerns TEXT[] DEFAULT '{}',
  sentiment_trend TEXT DEFAULT 'stable' CHECK (sentiment_trend IN ('improving', 'stable', 'declining')),
  conversation_summaries JSONB DEFAULT '[]',

  -- ==========================================================================
  -- LEARNED PREFERENCES
  -- ==========================================================================
  price_sensitivity TEXT DEFAULT 'medium' CHECK (price_sensitivity IN ('very_high', 'high', 'medium', 'low', 'price_not_priority')),
  max_acceptable_premium DECIMAL(5, 2),
  quality_priority TEXT DEFAULT 'medium' CHECK (quality_priority IN ('critical', 'high', 'medium', 'low', 'flexible')),
  quality_indicators TEXT[],
  speed_priority TEXT DEFAULT 'medium' CHECK (speed_priority IN ('critical', 'high', 'medium', 'low', 'flexible')),
  typical_lead_time TEXT,
  preferred_contact_method TEXT DEFAULT 'in-app' CHECK (preferred_contact_method IN ('email', 'sms', 'in-app', 'phone', 'any')),
  preferred_contact_times TEXT[],
  dont_disturb_hours JSONB,  -- { start: 22, end: 7 }
  notification_frequency TEXT DEFAULT 'daily' CHECK (notification_frequency IN ('realtime', 'hourly', 'daily', 'weekly')),
  notification_types JSONB DEFAULT '{"deals": true, "quotes": true, "reminders": true, "insights": true, "celebrations": true}',
  content_detail TEXT DEFAULT 'balanced' CHECK (content_detail IN ('summary', 'balanced', 'detailed')),
  wants_alternatives BOOLEAN DEFAULT TRUE,
  wants_explanations BOOLEAN DEFAULT TRUE,
  wants_proactive BOOLEAN DEFAULT TRUE,
  preferred_payment_terms TEXT[],
  preferred_payment_methods TEXT[],
  negotiation_style TEXT CHECK (negotiation_style IN ('aggressive', 'collaborative', 'analytical', 'relationship-focused')),
  risk_tolerance TEXT DEFAULT 'moderate' CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive')),
  brand_preferences JSONB,  -- { preferred: [], avoided: [] }

  -- ==========================================================================
  -- METADATA
  -- ==========================================================================
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_trust_tier ON user_memory(trust_tier);
CREATE INDEX IF NOT EXISTS idx_user_memory_last_interaction ON user_memory(last_interaction DESC);
CREATE INDEX IF NOT EXISTS idx_user_memory_company ON user_memory(company);
CREATE INDEX IF NOT EXISTS idx_user_memory_industry ON user_memory(industry);

-- ============================================================================
-- MEMORY FACTS TABLE
-- Individual facts learned about users
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Fact data
  fact_key TEXT NOT NULL,
  fact_value JSONB NOT NULL,
  confidence DECIMAL(3, 2) DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT NOT NULL DEFAULT 'inferred' CHECK (source IN ('explicit', 'inferred', 'observed')),

  -- Context
  context TEXT,
  conversation_id UUID,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Unique per user/key
  UNIQUE(user_id, fact_key)
);

CREATE INDEX IF NOT EXISTS idx_memory_facts_user ON memory_facts(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_facts_key ON memory_facts(fact_key);
CREATE INDEX IF NOT EXISTS idx_memory_facts_confidence ON memory_facts(confidence DESC);

-- ============================================================================
-- MEMORY INTERACTIONS TABLE
-- Entity mentions and interaction tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Entity info
  entity_type TEXT NOT NULL,  -- 'person', 'company', 'product', 'deal', etc.
  entity_name TEXT NOT NULL,

  -- Tracking
  mention_count INTEGER DEFAULT 1,
  first_mentioned TIMESTAMP NOT NULL DEFAULT NOW(),
  last_mentioned TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Context
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  metadata JSONB DEFAULT '{}',

  -- Unique per user/entity
  UNIQUE(user_id, entity_type, entity_name)
);

CREATE INDEX IF NOT EXISTS idx_memory_interactions_user ON memory_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_interactions_type ON memory_interactions(entity_type);
CREATE INDEX IF NOT EXISTS idx_memory_interactions_last ON memory_interactions(last_mentioned DESC);

-- ============================================================================
-- MEMORY PREFERENCES TABLE
-- Learned user preferences
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Preference data
  preference_type TEXT NOT NULL,
  preference_value JSONB NOT NULL,
  confidence DECIMAL(3, 2) DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),

  -- Context
  source TEXT DEFAULT 'observed' CHECK (source IN ('explicit', 'observed', 'inferred')),
  evidence TEXT[],

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Unique per user/type
  UNIQUE(user_id, preference_type)
);

CREATE INDEX IF NOT EXISTS idx_memory_preferences_user ON memory_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_preferences_type ON memory_preferences(preference_type);

-- ============================================================================
-- MEMORY INSIGHTS TABLE
-- Insights learned about users
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Insight data
  insight_type TEXT NOT NULL CHECK (insight_type IN ('preference', 'pattern', 'behavior', 'relationship')),
  insight_key TEXT NOT NULL,
  insight_value JSONB NOT NULL,
  confidence DECIMAL(3, 2) DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT DEFAULT 'observed' CHECK (source IN ('observed', 'inferred', 'stated')),

  -- Evidence
  evidence TEXT[],

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_insights_user ON memory_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_insights_type ON memory_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_memory_insights_confidence ON memory_insights(confidence DESC);

-- ============================================================================
-- LEARNING EVENTS TABLE
-- Raw learning events for pattern analysis
-- ============================================================================

CREATE TABLE IF NOT EXISTS learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Event data
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_events_user ON learning_events(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_events_type ON learning_events(event_type);
CREATE INDEX IF NOT EXISTS idx_learning_events_created ON learning_events(created_at DESC);

-- Partition by month for performance (optional, for high-volume)
-- CREATE INDEX IF NOT EXISTS idx_learning_events_created_month ON learning_events(date_trunc('month', created_at));

-- ============================================================================
-- SUPPLIER PREFERENCES TABLE
-- Preferred and avoided suppliers
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_supplier_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Supplier info
  supplier_id TEXT NOT NULL,
  supplier_name TEXT NOT NULL,

  -- Preference
  preference TEXT NOT NULL CHECK (preference IN ('preferred', 'avoided', 'neutral')),
  reason TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),

  -- History
  deals_completed INTEGER DEFAULT 0,
  last_interaction TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Unique per user/supplier
  UNIQUE(user_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_prefs_user ON memory_supplier_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_prefs_preference ON memory_supplier_preferences(preference);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update trust tier based on metrics
CREATE OR REPLACE FUNCTION update_trust_tier(p_user_id TEXT)
RETURNS TEXT AS $$
DECLARE
  v_tier TEXT;
  v_interactions INTEGER;
  v_deals INTEGER;
  v_value DECIMAL;
  v_score INTEGER;
BEGIN
  SELECT total_interactions, successful_deals, total_value_transacted, trust_score
  INTO v_interactions, v_deals, v_value, v_score
  FROM user_memory
  WHERE user_id = p_user_id;

  -- Calculate tier
  IF v_score >= 90 OR (v_deals >= 10 AND v_value >= 100000) THEN
    v_tier := 'guardian';
  ELSIF v_score >= 70 OR (v_deals >= 5 AND v_value >= 25000) THEN
    v_tier := 'trusted';
  ELSIF v_score >= 50 OR (v_deals >= 2 AND v_interactions >= 20) THEN
    v_tier := 'established';
  ELSIF v_interactions >= 5 THEN
    v_tier := 'developing';
  ELSE
    v_tier := 'new';
  END IF;

  -- Update the tier
  UPDATE user_memory
  SET trust_tier = v_tier, updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN v_tier;
END;
$$ LANGUAGE plpgsql;

-- Function to record an interaction and update counters
CREATE OR REPLACE FUNCTION record_memory_interaction(
  p_user_id TEXT,
  p_type TEXT  -- 'message', 'session', 'deal', 'quote'
)
RETURNS VOID AS $$
BEGIN
  -- Ensure memory exists
  INSERT INTO user_memory (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Update counters based on type
  CASE p_type
    WHEN 'message' THEN
      UPDATE user_memory
      SET total_messages = total_messages + 1,
          total_interactions = total_interactions + 1,
          last_interaction = NOW(),
          updated_at = NOW()
      WHERE user_id = p_user_id;

    WHEN 'session' THEN
      UPDATE user_memory
      SET total_sessions = total_sessions + 1,
          current_streak = CASE
            WHEN last_interaction > NOW() - INTERVAL '24 hours' THEN current_streak + 1
            ELSE 1
          END,
          longest_streak = GREATEST(
            COALESCE(longest_streak, 0),
            CASE
              WHEN last_interaction > NOW() - INTERVAL '24 hours' THEN current_streak + 1
              ELSE 1
            END
          ),
          last_interaction = NOW(),
          updated_at = NOW()
      WHERE user_id = p_user_id;

    WHEN 'deal' THEN
      UPDATE user_memory
      SET total_interactions = total_interactions + 1,
          last_interaction = NOW(),
          updated_at = NOW()
      WHERE user_id = p_user_id;

    WHEN 'quote' THEN
      UPDATE user_memory
      SET quotes_requested = quotes_requested + 1,
          total_interactions = total_interactions + 1,
          last_interaction = NOW(),
          updated_at = NOW()
      WHERE user_id = p_user_id;

    ELSE
      UPDATE user_memory
      SET total_interactions = total_interactions + 1,
          last_interaction = NOW(),
          updated_at = NOW()
      WHERE user_id = p_user_id;
  END CASE;

  -- Update trust tier
  PERFORM update_trust_tier(p_user_id);
END;
$$ LANGUAGE plpgsql;

-- Function to upsert a fact
CREATE OR REPLACE FUNCTION upsert_memory_fact(
  p_user_id TEXT,
  p_key TEXT,
  p_value JSONB,
  p_confidence DECIMAL DEFAULT 0.8,
  p_source TEXT DEFAULT 'inferred'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO memory_facts (user_id, fact_key, fact_value, confidence, source)
  VALUES (p_user_id, p_key, p_value, p_confidence, p_source)
  ON CONFLICT (user_id, fact_key) DO UPDATE SET
    fact_value = CASE WHEN EXCLUDED.confidence > memory_facts.confidence
      THEN EXCLUDED.fact_value ELSE memory_facts.fact_value END,
    confidence = GREATEST(memory_facts.confidence, EXCLUDED.confidence),
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get memory summary
CREATE OR REPLACE FUNCTION get_memory_summary(p_user_id TEXT)
RETURNS TABLE (
  name TEXT,
  company TEXT,
  trust_tier TEXT,
  total_interactions INTEGER,
  successful_deals INTEGER,
  total_value DECIMAL,
  days_together INTEGER,
  last_seen_hours INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    um.name,
    um.company,
    um.trust_tier,
    um.total_interactions,
    um.successful_deals,
    um.total_value_transacted,
    EXTRACT(DAY FROM NOW() - um.first_contact)::INTEGER,
    EXTRACT(HOUR FROM NOW() - um.last_interaction)::INTEGER
  FROM user_memory um
  WHERE um.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for active users with high engagement
CREATE OR REPLACE VIEW active_engaged_users AS
SELECT
  user_id,
  name,
  company,
  trust_tier,
  total_interactions,
  successful_deals,
  total_value_transacted,
  last_interaction,
  EXTRACT(DAY FROM NOW() - first_contact) as days_together
FROM user_memory
WHERE last_interaction > NOW() - INTERVAL '7 days'
  AND total_interactions >= 5
ORDER BY total_value_transacted DESC;

-- View for users needing attention (declining sentiment or long absence)
CREATE OR REPLACE VIEW users_needing_attention AS
SELECT
  user_id,
  name,
  company,
  trust_tier,
  sentiment_trend,
  EXTRACT(HOUR FROM NOW() - last_interaction) as hours_since_contact,
  concerns
FROM user_memory
WHERE (
  sentiment_trend = 'declining'
  OR last_interaction < NOW() - INTERVAL '14 days'
)
AND total_interactions >= 3
ORDER BY last_interaction ASC;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_memory_updated
  BEFORE UPDATE ON user_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_updated_at();

CREATE TRIGGER trigger_memory_facts_updated
  BEFORE UPDATE ON memory_facts
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_updated_at();

CREATE TRIGGER trigger_memory_preferences_updated
  BEFORE UPDATE ON memory_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_updated_at();

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Uncomment to insert sample data:
/*
INSERT INTO user_memory (
  user_id,
  name,
  preferred_name,
  company,
  role,
  industry,
  communication_style,
  decision_style,
  trust_tier,
  total_interactions,
  successful_deals,
  total_value_transacted,
  price_sensitivity,
  quality_priority
) VALUES (
  'test_user_1',
  'John Smith',
  'John',
  'Acme Corp',
  'Procurement Manager',
  'Manufacturing',
  'casual',
  'quick',
  'established',
  47,
  5,
  125000.00,
  'high',
  'critical'
);
*/

-- ============================================================================
-- GRANT PERMISSIONS (adjust as needed)
-- ============================================================================

-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
