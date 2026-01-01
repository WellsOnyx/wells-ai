-- AI-to-AI Negotiation Rooms Schema
-- Buyer <-> Wells (Buyer) <-> Wells (Supplier) <-> Supplier
-- Humans never meet. AIs handle everything.

-- Negotiation rooms
CREATE TABLE IF NOT EXISTS negotiation_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'preparing',  -- preparing, negotiating, agreed, failed, expired

  -- The humans (who never meet)
  buyer_id TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_company TEXT,
  seller_id TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  seller_company TEXT,

  -- What's being negotiated
  subject TEXT NOT NULL,
  description TEXT,

  -- Mandates (JSON)
  buyer_mandate JSONB NOT NULL,
  seller_mandate JSONB NOT NULL,

  -- Negotiation config
  current_round INTEGER NOT NULL DEFAULT 0,
  max_rounds INTEGER NOT NULL DEFAULT 10,

  -- Outcome
  agreed_terms JSONB,
  failure_reason TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Indexes
  CONSTRAINT valid_status CHECK (status IN ('preparing', 'negotiating', 'agreed', 'failed', 'expired'))
);

-- Negotiation rounds (the AI-to-AI conversation)
CREATE TABLE IF NOT EXISTS negotiation_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES negotiation_rooms(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,

  -- Wells (Buyer) agent
  buyer_message TEXT NOT NULL,
  buyer_proposed_terms JSONB NOT NULL,
  buyer_reasoning TEXT,  -- Internal, not shown to other side
  buyer_satisfaction INTEGER NOT NULL DEFAULT 50,

  -- Wells (Supplier) agent
  seller_message TEXT,
  seller_counter_terms JSONB,
  seller_reasoning TEXT,  -- Internal, not shown to other side
  seller_satisfaction INTEGER DEFAULT 50,

  -- Round analysis
  convergence INTEGER NOT NULL DEFAULT 0,  -- 0-100
  sticking_points TEXT[],

  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(room_id, round_number)
);

-- Quick reference for user's negotiations
CREATE TABLE IF NOT EXISTS user_negotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  room_id UUID NOT NULL REFERENCES negotiation_rooms(id) ON DELETE CASCADE,
  role TEXT NOT NULL,  -- buyer or seller
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, room_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_negotiation_rooms_status ON negotiation_rooms(status);
CREATE INDEX IF NOT EXISTS idx_negotiation_rooms_buyer ON negotiation_rooms(buyer_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_rooms_seller ON negotiation_rooms(seller_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_rooms_expires ON negotiation_rooms(expires_at);
CREATE INDEX IF NOT EXISTS idx_negotiation_rounds_room ON negotiation_rounds(room_id);
CREATE INDEX IF NOT EXISTS idx_user_negotiations_user ON user_negotiations(user_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_negotiation_room_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating timestamp
DROP TRIGGER IF EXISTS negotiation_rooms_updated_at ON negotiation_rooms;
CREATE TRIGGER negotiation_rooms_updated_at
  BEFORE UPDATE ON negotiation_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_negotiation_room_timestamp();
