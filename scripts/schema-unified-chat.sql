-- ============================================================================
-- UNIFIED CHAT SCHEMA
-- Shared conversation storage across Wells AI and Grain & Vault
-- Run: psql $POSTGRES_URL < scripts/schema-unified-chat.sql
-- ============================================================================

-- UNIFIED CONVERSATIONS
-- Single table for all conversations across both products
CREATE TABLE IF NOT EXISTS unified_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User Identity (Clerk-based)
  clerk_user_id TEXT NOT NULL,

  -- Product Context
  product_origin TEXT NOT NULL CHECK (product_origin IN ('wellsai', 'grainvault')),
  current_product TEXT NOT NULL CHECK (current_product IN ('wellsai', 'grainvault')),

  -- Conversation Metadata
  title TEXT,
  summary TEXT,

  -- Journey/Mode Context
  journey TEXT, -- founder, buyer, seller, jobs, treasury, master
  mode TEXT, -- specific mode within product

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),

  -- Tracking
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP,

  -- Cross-Product Context
  related_conversation_ids UUID[],
  tags TEXT[],

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unified_conversations_user ON unified_conversations(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_unified_conversations_product_origin ON unified_conversations(product_origin);
CREATE INDEX IF NOT EXISTS idx_unified_conversations_current_product ON unified_conversations(current_product);
CREATE INDEX IF NOT EXISTS idx_unified_conversations_status ON unified_conversations(status);
CREATE INDEX IF NOT EXISTS idx_unified_conversations_journey ON unified_conversations(journey);
CREATE INDEX IF NOT EXISTS idx_unified_conversations_created ON unified_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_conversations_last_message ON unified_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_conversations_tags ON unified_conversations USING GIN(tags);

-- UNIFIED MESSAGES
-- Individual messages within conversations
CREATE TABLE IF NOT EXISTS unified_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES unified_conversations(id) ON DELETE CASCADE,

  -- Message Content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- Product Context (which product was user on when this message was sent)
  product_context TEXT NOT NULL CHECK (product_context IN ('wellsai', 'grainvault')),

  -- Tool/Action Results
  tool_use JSONB, -- Claude tool use data
  tool_results JSONB, -- Results from tool execution

  -- Action tracking (lead capture, negotiation, treasury action, etc.)
  action_type TEXT, -- capture_lead, start_negotiation, prepare_payment, etc.
  action_data JSONB,
  action_status TEXT CHECK (action_status IN ('pending', 'completed', 'failed', 'cancelled')),

  -- Message Metadata
  tokens_used INTEGER,
  model_used TEXT,
  latency_ms INTEGER,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_unified_messages_conversation ON unified_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_unified_messages_role ON unified_messages(role);
CREATE INDEX IF NOT EXISTS idx_unified_messages_product_context ON unified_messages(product_context);
CREATE INDEX IF NOT EXISTS idx_unified_messages_action_type ON unified_messages(action_type);
CREATE INDEX IF NOT EXISTS idx_unified_messages_created ON unified_messages(created_at DESC);

-- USER CONTEXT
-- Cross-product memory and preferences
CREATE TABLE IF NOT EXISTS unified_user_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL UNIQUE,

  -- User Preferences
  preferred_product TEXT CHECK (preferred_product IN ('wellsai', 'grainvault')),
  default_journey TEXT,

  -- Cross-Product Insights
  wellsai_profile JSONB DEFAULT '{}', -- Wells AI specific context
  grainvault_profile JSONB DEFAULT '{}', -- Grain & Vault specific context

  -- Shared Context
  recent_topics TEXT[], -- Recent conversation topics
  key_entities JSONB DEFAULT '{}', -- Important entities mentioned (companies, people, amounts)
  preferences JSONB DEFAULT '{}', -- Communication preferences

  -- Activity Tracking
  wellsai_message_count INTEGER DEFAULT 0,
  grainvault_message_count INTEGER DEFAULT 0,
  total_message_count INTEGER DEFAULT 0,

  -- Last Activity
  last_wellsai_activity TIMESTAMP,
  last_grainvault_activity TIMESTAMP,
  last_activity TIMESTAMP,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unified_user_context_clerk_user ON unified_user_context(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_unified_user_context_last_activity ON unified_user_context(last_activity DESC);

-- CONVERSATION SUMMARY CACHE
-- Pre-computed summaries for fast context retrieval
CREATE TABLE IF NOT EXISTS unified_conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES unified_conversations(id) ON DELETE CASCADE,

  -- Summary Data
  summary_text TEXT NOT NULL,
  key_topics TEXT[],
  entities_mentioned JSONB DEFAULT '{}',
  action_items JSONB DEFAULT '[]',

  -- Summary Metadata
  message_count_at_summary INTEGER NOT NULL,
  summary_type TEXT NOT NULL CHECK (summary_type IN ('auto', 'manual', 'final')),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(conversation_id, message_count_at_summary)
);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_conversation ON unified_conversation_summaries(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_created ON unified_conversation_summaries(created_at DESC);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_unified_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_unified_conversations_updated_at
  BEFORE UPDATE ON unified_conversations
  FOR EACH ROW EXECUTE FUNCTION update_unified_updated_at();

CREATE TRIGGER update_unified_user_context_updated_at
  BEFORE UPDATE ON unified_user_context
  FOR EACH ROW EXECUTE FUNCTION update_unified_updated_at();

-- Update conversation message count and last message time
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE unified_conversations
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_message_count
  AFTER INSERT ON unified_messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- Update user context on message
CREATE OR REPLACE FUNCTION update_user_context_on_message()
RETURNS TRIGGER AS $$
DECLARE
  product_field TEXT;
  message_count_field TEXT;
BEGIN
  -- Determine which product fields to update
  IF NEW.product_context = 'wellsai' THEN
    product_field := 'last_wellsai_activity';
    message_count_field := 'wellsai_message_count';
  ELSE
    product_field := 'last_grainvault_activity';
    message_count_field := 'grainvault_message_count';
  END IF;

  -- Update or insert user context
  INSERT INTO unified_user_context (
    clerk_user_id,
    wellsai_message_count,
    grainvault_message_count,
    total_message_count,
    last_wellsai_activity,
    last_grainvault_activity,
    last_activity
  )
  SELECT
    c.clerk_user_id,
    CASE WHEN NEW.product_context = 'wellsai' THEN 1 ELSE 0 END,
    CASE WHEN NEW.product_context = 'grainvault' THEN 1 ELSE 0 END,
    1,
    CASE WHEN NEW.product_context = 'wellsai' THEN NEW.created_at ELSE NULL END,
    CASE WHEN NEW.product_context = 'grainvault' THEN NEW.created_at ELSE NULL END,
    NEW.created_at
  FROM unified_conversations c
  WHERE c.id = NEW.conversation_id
  ON CONFLICT (clerk_user_id) DO UPDATE SET
    wellsai_message_count = CASE
      WHEN NEW.product_context = 'wellsai'
      THEN unified_user_context.wellsai_message_count + 1
      ELSE unified_user_context.wellsai_message_count
    END,
    grainvault_message_count = CASE
      WHEN NEW.product_context = 'grainvault'
      THEN unified_user_context.grainvault_message_count + 1
      ELSE unified_user_context.grainvault_message_count
    END,
    total_message_count = unified_user_context.total_message_count + 1,
    last_wellsai_activity = CASE
      WHEN NEW.product_context = 'wellsai'
      THEN NEW.created_at
      ELSE unified_user_context.last_wellsai_activity
    END,
    last_grainvault_activity = CASE
      WHEN NEW.product_context = 'grainvault'
      THEN NEW.created_at
      ELSE unified_user_context.last_grainvault_activity
    END,
    last_activity = NEW.created_at,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_context_on_new_message
  AFTER INSERT ON unified_messages
  FOR EACH ROW
  WHEN (NEW.role = 'user')
  EXECUTE FUNCTION update_user_context_on_message();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active conversations with latest message
CREATE OR REPLACE VIEW active_conversations_view AS
SELECT
  c.id,
  c.clerk_user_id,
  c.product_origin,
  c.current_product,
  c.title,
  c.summary,
  c.journey,
  c.message_count,
  c.last_message_at,
  c.created_at,

  -- Latest message preview
  (
    SELECT content
    FROM unified_messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) AS last_message_preview,

  (
    SELECT role
    FROM unified_messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) AS last_message_role

FROM unified_conversations c
WHERE c.status = 'active'
ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC;

-- User context enriched view
CREATE OR REPLACE VIEW user_context_enriched AS
SELECT
  uc.*,

  -- Conversation counts by product
  (SELECT COUNT(*) FROM unified_conversations WHERE clerk_user_id = uc.clerk_user_id AND product_origin = 'wellsai' AND status = 'active') AS active_wellsai_conversations,
  (SELECT COUNT(*) FROM unified_conversations WHERE clerk_user_id = uc.clerk_user_id AND product_origin = 'grainvault' AND status = 'active') AS active_grainvault_conversations,

  -- Total conversations
  (SELECT COUNT(*) FROM unified_conversations WHERE clerk_user_id = uc.clerk_user_id AND status = 'active') AS total_active_conversations

FROM unified_user_context uc;

-- ============================================================================
-- SAMPLE QUERIES (commented out)
-- ============================================================================

-- Get user's conversation history across both products
-- SELECT * FROM active_conversations_view WHERE clerk_user_id = 'user_xxx' ORDER BY last_message_at DESC;

-- Get recent context for user (last 10 messages across all conversations)
-- SELECT m.*, c.product_origin, c.journey
-- FROM unified_messages m
-- JOIN unified_conversations c ON m.conversation_id = c.id
-- WHERE c.clerk_user_id = 'user_xxx' AND c.status = 'active'
-- ORDER BY m.created_at DESC
-- LIMIT 10;

-- Get cross-product insights
-- SELECT * FROM user_context_enriched WHERE clerk_user_id = 'user_xxx';
