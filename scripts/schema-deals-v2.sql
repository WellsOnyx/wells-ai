-- Deals V2 Schema
-- Full persistence for Wells AI transaction engine

-- Drop old table if it exists (for fresh start)
-- DROP TABLE IF EXISTS deals CASCADE;

-- Create enhanced deals table
CREATE TABLE IF NOT EXISTS deals_v2 (
  id TEXT PRIMARY KEY,

  -- Buyer info
  buyer_id TEXT NOT NULL,
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_wallet_id TEXT,
  buyer_wallet_address TEXT,
  buyer_trust_score JSONB DEFAULT '{}',

  -- Seller info
  seller_id TEXT NOT NULL,
  seller_name TEXT,
  seller_email TEXT,
  seller_wallet_id TEXT,
  seller_wallet_address TEXT,
  seller_trust_score JSONB DEFAULT '{}',

  -- Terms
  amount DECIMAL(20, 2) NOT NULL,
  currency TEXT DEFAULT 'GRAIN',
  description TEXT,
  deliverables JSONB DEFAULT '[]',
  timeline JSONB,
  metadata JSONB DEFAULT '{}',

  -- Status & fees
  status TEXT DEFAULT 'proposed',
  platform_fee DECIMAL(20, 2) DEFAULT 0,
  platform_fee_percent DECIMAL(5, 2) DEFAULT 2.5,

  -- Escrow
  escrow_wallet_id TEXT,
  escrow_wallet_address TEXT,
  escrow_balance DECIMAL(20, 2) DEFAULT 0,
  transfer_ids JSONB DEFAULT '[]',

  -- Messages (negotiation history)
  messages JSONB DEFAULT '[]',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deals_v2_buyer ON deals_v2(buyer_id);
CREATE INDEX IF NOT EXISTS idx_deals_v2_seller ON deals_v2(seller_id);
CREATE INDEX IF NOT EXISTS idx_deals_v2_status ON deals_v2(status);
CREATE INDEX IF NOT EXISTS idx_deals_v2_created ON deals_v2(created_at DESC);

-- Deal history (for audit trail)
CREATE TABLE IF NOT EXISTS deal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id TEXT NOT NULL REFERENCES deals_v2(id),
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL, -- 'buyer', 'seller', 'system'
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_events_deal ON deal_events(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_events_actor ON deal_events(actor_id);
