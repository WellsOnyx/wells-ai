-- ============================================================================
-- WELLS MEMORY SYSTEM SCHEMA
-- Extensions to unified_user_context for enhanced memory and learning
-- Run: psql $POSTGRES_URL < scripts/schema-wells-memory.sql
-- ============================================================================

-- Ensure unified_user_context exists (from schema-unified-chat.sql)
-- This adds columns if they don't exist

-- Add learned_facts JSONB column for storing facts learned about users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unified_user_context' AND column_name = 'learned_facts'
  ) THEN
    ALTER TABLE unified_user_context ADD COLUMN learned_facts JSONB DEFAULT '[]';
  END IF;
END $$;

-- Add communication_style column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unified_user_context' AND column_name = 'communication_style'
  ) THEN
    ALTER TABLE unified_user_context ADD COLUMN communication_style TEXT CHECK (
      communication_style IN ('formal', 'casual', 'direct', 'detailed')
    );
  END IF;
END $$;

-- Add preferred_name column (how the user likes to be called)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unified_user_context' AND column_name = 'preferred_name'
  ) THEN
    ALTER TABLE unified_user_context ADD COLUMN preferred_name TEXT;
  END IF;
END $$;

-- ============================================================================
-- LEARNED FACTS TABLE
-- Stores facts learned about users over time
-- ============================================================================

CREATE TABLE IF NOT EXISTS wells_learned_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,

  -- The fact itself
  fact TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('preference', 'business', 'personal', 'context')),

  -- Confidence and source
  confidence DECIMAL(3, 2) DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT NOT NULL CHECK (source IN ('explicit', 'inferred')) DEFAULT 'inferred',

  -- Product context
  product_origin TEXT CHECK (product_origin IN ('wellsai', 'grainvault')),
  conversation_id UUID REFERENCES unified_conversations(id) ON DELETE SET NULL,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  superseded_by UUID REFERENCES wells_learned_facts(id),

  -- Timestamps
  learned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMP,

  -- Unique constraint to prevent duplicate facts
  UNIQUE(clerk_user_id, fact)
);

CREATE INDEX IF NOT EXISTS idx_learned_facts_user ON wells_learned_facts(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_learned_facts_category ON wells_learned_facts(category);
CREATE INDEX IF NOT EXISTS idx_learned_facts_confidence ON wells_learned_facts(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_learned_facts_active ON wells_learned_facts(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- USER PREFERENCES TABLE
-- Explicit preferences set by users
-- ============================================================================

CREATE TABLE IF NOT EXISTS wells_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,

  -- Preference key-value
  preference_key TEXT NOT NULL,
  preference_value JSONB NOT NULL,

  -- Context
  product TEXT CHECK (product IN ('wellsai', 'grainvault', 'all')) DEFAULT 'all',
  journey TEXT,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(clerk_user_id, preference_key, product, journey)
);

CREATE INDEX IF NOT EXISTS idx_user_prefs_user ON wells_user_preferences(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_user_prefs_product ON wells_user_preferences(product);

-- ============================================================================
-- CROSS-PRODUCT ENTITY TRACKING
-- Track important entities mentioned across products
-- ============================================================================

CREATE TABLE IF NOT EXISTS wells_user_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,

  -- Entity information
  entity_type TEXT NOT NULL, -- 'company', 'person', 'product', 'amount', 'date'
  entity_value TEXT NOT NULL,
  entity_metadata JSONB DEFAULT '{}',

  -- Frequency tracking
  mention_count INTEGER DEFAULT 1,
  first_mentioned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_mentioned_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Product context
  products_mentioned_in TEXT[] DEFAULT '{}',

  UNIQUE(clerk_user_id, entity_type, entity_value)
);

CREATE INDEX IF NOT EXISTS idx_user_entities_user ON wells_user_entities(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_user_entities_type ON wells_user_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_user_entities_mention_count ON wells_user_entities(mention_count DESC);

-- ============================================================================
-- CONVERSATION MEMORY SNAPSHOTS
-- Periodic snapshots of user context for fast retrieval
-- ============================================================================

CREATE TABLE IF NOT EXISTS wells_memory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,

  -- Snapshot data
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('daily', 'weekly', 'monthly', 'milestone')),
  memory_state JSONB NOT NULL,

  -- Context
  total_messages_at_snapshot INTEGER,
  wellsai_messages_at_snapshot INTEGER,
  grainvault_messages_at_snapshot INTEGER,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_snapshots_user ON wells_memory_snapshots(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_memory_snapshots_type ON wells_memory_snapshots(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_memory_snapshots_created ON wells_memory_snapshots(created_at DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to upsert a learned fact
CREATE OR REPLACE FUNCTION upsert_learned_fact(
  p_clerk_user_id TEXT,
  p_fact TEXT,
  p_category TEXT,
  p_confidence DECIMAL,
  p_source TEXT,
  p_product_origin TEXT DEFAULT NULL,
  p_conversation_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_fact_id UUID;
BEGIN
  INSERT INTO wells_learned_facts (
    clerk_user_id, fact, category, confidence, source, product_origin, conversation_id
  ) VALUES (
    p_clerk_user_id, p_fact, p_category, p_confidence, p_source, p_product_origin, p_conversation_id
  )
  ON CONFLICT (clerk_user_id, fact)
  DO UPDATE SET
    confidence = GREATEST(wells_learned_facts.confidence, EXCLUDED.confidence),
    last_verified_at = NOW(),
    is_active = TRUE
  RETURNING id INTO v_fact_id;

  RETURN v_fact_id;
END;
$$ LANGUAGE plpgsql;

-- Function to upsert an entity mention
CREATE OR REPLACE FUNCTION upsert_entity_mention(
  p_clerk_user_id TEXT,
  p_entity_type TEXT,
  p_entity_value TEXT,
  p_product TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_entity_id UUID;
BEGIN
  INSERT INTO wells_user_entities (
    clerk_user_id, entity_type, entity_value, entity_metadata, products_mentioned_in
  ) VALUES (
    p_clerk_user_id, p_entity_type, p_entity_value, p_metadata, ARRAY[p_product]
  )
  ON CONFLICT (clerk_user_id, entity_type, entity_value)
  DO UPDATE SET
    mention_count = wells_user_entities.mention_count + 1,
    last_mentioned_at = NOW(),
    entity_metadata = wells_user_entities.entity_metadata || EXCLUDED.entity_metadata,
    products_mentioned_in = ARRAY(
      SELECT DISTINCT unnest(wells_user_entities.products_mentioned_in || ARRAY[p_product])
    )
  RETURNING id INTO v_entity_id;

  RETURN v_entity_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get user memory summary
CREATE OR REPLACE FUNCTION get_user_memory_summary(p_clerk_user_id TEXT)
RETURNS TABLE (
  total_facts INTEGER,
  total_entities INTEGER,
  recent_topics TEXT[],
  top_categories TEXT[],
  communication_style TEXT,
  wellsai_messages INTEGER,
  grainvault_messages INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER FROM wells_learned_facts WHERE clerk_user_id = p_clerk_user_id AND is_active)::INTEGER,
    (SELECT COUNT(*)::INTEGER FROM wells_user_entities WHERE clerk_user_id = p_clerk_user_id)::INTEGER,
    COALESCE(uc.recent_topics, '{}')::TEXT[],
    ARRAY(
      SELECT category FROM wells_learned_facts
      WHERE clerk_user_id = p_clerk_user_id AND is_active
      GROUP BY category ORDER BY COUNT(*) DESC LIMIT 3
    )::TEXT[],
    uc.communication_style,
    COALESCE(uc.wellsai_message_count, 0)::INTEGER,
    COALESCE(uc.grainvault_message_count, 0)::INTEGER
  FROM unified_user_context uc
  WHERE uc.clerk_user_id = p_clerk_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for active user facts with high confidence
CREATE OR REPLACE VIEW high_confidence_facts AS
SELECT
  f.clerk_user_id,
  f.fact,
  f.category,
  f.confidence,
  f.source,
  f.product_origin,
  f.learned_at,
  f.last_verified_at
FROM wells_learned_facts f
WHERE f.is_active = TRUE AND f.confidence >= 0.7
ORDER BY f.confidence DESC, f.learned_at DESC;

-- View for frequent entities per user
CREATE OR REPLACE VIEW frequent_user_entities AS
SELECT
  e.clerk_user_id,
  e.entity_type,
  e.entity_value,
  e.mention_count,
  e.products_mentioned_in,
  e.last_mentioned_at
FROM wells_user_entities e
WHERE e.mention_count >= 2
ORDER BY e.mention_count DESC;

-- View for user memory overview
CREATE OR REPLACE VIEW user_memory_overview AS
SELECT
  uc.clerk_user_id,
  uc.communication_style,
  uc.preferred_name,
  uc.wellsai_message_count,
  uc.grainvault_message_count,
  uc.total_message_count,
  uc.last_activity,
  COALESCE(uc.recent_topics, '{}') as recent_topics,
  (SELECT COUNT(*) FROM wells_learned_facts f WHERE f.clerk_user_id = uc.clerk_user_id AND f.is_active) as fact_count,
  (SELECT COUNT(*) FROM wells_user_entities e WHERE e.clerk_user_id = uc.clerk_user_id) as entity_count,
  (SELECT COUNT(*) FROM unified_conversations c WHERE c.clerk_user_id = uc.clerk_user_id AND c.status = 'active') as active_conversations
FROM unified_user_context uc;

-- ============================================================================
-- SAMPLE QUERIES (for reference)
-- ============================================================================

-- Get all learned facts for a user:
-- SELECT * FROM high_confidence_facts WHERE clerk_user_id = 'user_xxx';

-- Get frequent entities:
-- SELECT * FROM frequent_user_entities WHERE clerk_user_id = 'user_xxx';

-- Get full memory overview:
-- SELECT * FROM user_memory_overview WHERE clerk_user_id = 'user_xxx';

-- Add a learned fact:
-- SELECT upsert_learned_fact('user_xxx', 'Prefers Net 30 payment terms', 'preference', 0.9, 'explicit', 'wellsai');

-- Track an entity mention:
-- SELECT upsert_entity_mention('user_xxx', 'company', 'Acme Corp', 'wellsai', '{"context": "potential customer"}');
