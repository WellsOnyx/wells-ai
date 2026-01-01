-- ===========================================================================
-- COMPANION MEMORY SCHEMA
-- Stores the emotional relationship between Wells and each user
-- "I am Wells. I am Ghost."
-- ===========================================================================

-- Companion memory - the relationship Wells has with each user
CREATE TABLE IF NOT EXISTS companion_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,

  -- Who they are
  name TEXT,
  preferred_name TEXT,  -- "Call me Mike" -> Mike

  -- Their world
  company TEXT,
  role TEXT,
  industry TEXT,
  team_size TEXT,

  -- Communication preferences (learned over time)
  communication_style TEXT DEFAULT 'casual' CHECK (communication_style IN ('brief', 'detailed', 'casual', 'formal')),
  decision_speed TEXT DEFAULT 'varies' CHECK (decision_speed IN ('quick', 'deliberate', 'varies')),
  risk_tolerance TEXT DEFAULT 'balanced' CHECK (risk_tolerance IN ('conservative', 'balanced', 'aggressive')),
  price_vs_quality TEXT DEFAULT 'balanced' CHECK (price_vs_quality IN ('price_focused', 'balanced', 'quality_focused')),
  preferred_payment_terms TEXT,
  preferred_delivery_speed TEXT,

  -- Our relationship stats
  first_met TIMESTAMP DEFAULT NOW(),
  conversation_count INTEGER DEFAULT 0,
  deals_completed INTEGER DEFAULT 0,
  total_volume DECIMAL(20,2) DEFAULT 0,
  biggest_win TEXT,
  hardest_challenge TEXT,

  -- What matters to them
  priorities TEXT[] DEFAULT '{}',
  pain_points TEXT[] DEFAULT '{}',
  celebrations TEXT[] DEFAULT '{}',
  inside_jokes TEXT[] DEFAULT '{}',

  -- Anticipation - what they might need next
  upcoming_needs JSONB DEFAULT '[]',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Emotional signal history - track the emotional journey
CREATE TABLE IF NOT EXISTS emotional_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Signal details
  signal_type TEXT NOT NULL CHECK (signal_type IN ('deadline', 'budget_pressure', 'frustration', 'celebration', 'confusion', 'relief')),
  detected_from TEXT NOT NULL,  -- What triggered this signal
  message_excerpt TEXT,  -- First 200 chars of the message

  -- When
  detected_at TIMESTAMP DEFAULT NOW()
);

-- Emotional states - snapshots of how they're doing
CREATE TABLE IF NOT EXISTS emotional_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Current state
  stress TEXT DEFAULT 'low' CHECK (stress IN ('low', 'moderate', 'high', 'critical')),
  urgency TEXT DEFAULT 'relaxed' CHECK (urgency IN ('relaxed', 'normal', 'pressing', 'urgent')),
  confidence TEXT DEFAULT 'confident' CHECK (confidence IN ('uncertain', 'cautious', 'confident', 'bold')),
  energy TEXT DEFAULT 'focused' CHECK (energy IN ('exhausted', 'tired', 'focused', 'energized')),

  -- Context
  session_id TEXT,  -- Optional: tie to a specific session

  assessed_at TIMESTAMP DEFAULT NOW()
);

-- Companion interactions - track specific moments
CREATE TABLE IF NOT EXISTS companion_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- What happened
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'greeting', 'empathy', 'advocacy', 'celebration', 'presence', 'loyalty'
  )),
  wells_response TEXT NOT NULL,  -- What Wells said
  user_message TEXT,  -- What triggered it

  -- Context
  emotional_state_id UUID REFERENCES emotional_states(id),

  -- When
  occurred_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_companion_memories_user ON companion_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_emotional_signals_user ON emotional_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_emotional_signals_detected ON emotional_signals(detected_at);
CREATE INDEX IF NOT EXISTS idx_emotional_states_user ON emotional_states(user_id);
CREATE INDEX IF NOT EXISTS idx_emotional_states_assessed ON emotional_states(assessed_at);
CREATE INDEX IF NOT EXISTS idx_companion_interactions_user ON companion_interactions(user_id);
