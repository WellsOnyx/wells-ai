-- Wells AI Matching Engine Database Schema
-- Run this migration to set up the matching engine tables

-- ============================================================================
-- SOURCING REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS sourcing_requests (
  id VARCHAR(255) PRIMARY KEY,
  buyer_id VARCHAR(255),
  buyer_name VARCHAR(255),
  buyer_email VARCHAR(255),

  -- What they need
  title VARCHAR(500) NOT NULL,
  description TEXT,
  raw_request TEXT,

  -- Category
  category VARCHAR(255) NOT NULL DEFAULT 'general',
  parent_category VARCHAR(255),
  related_categories TEXT[], -- Array of related categories

  -- Specifications (stored as JSONB)
  specifications JSONB DEFAULT '[]',
  required_certifications TEXT[],
  preferred_certifications TEXT[],

  -- Volume & Timing
  quantity INTEGER DEFAULT 0,
  quantity_unit VARCHAR(100) DEFAULT 'units',
  frequency VARCHAR(50) DEFAULT 'one-time', -- one-time, monthly, quarterly, annual
  delivery_deadline TIMESTAMP WITH TIME ZONE,
  urgency VARCHAR(50) DEFAULT 'standard', -- standard, urgent, critical

  -- Location
  delivery_location VARCHAR(500),
  delivery_city VARCHAR(255),
  delivery_region VARCHAR(255),
  delivery_country VARCHAR(255),

  -- Budget
  target_price DECIMAL(12, 2),
  max_price DECIMAL(12, 2),
  currency VARCHAR(10) DEFAULT 'USD',

  -- GRAIN preferences
  prefer_grain_enabled BOOLEAN DEFAULT true,
  require_grain_enabled BOOLEAN DEFAULT false,

  -- Status
  status VARCHAR(50) DEFAULT 'active', -- draft, active, matching, matched, in_progress, completed, cancelled
  matching_started_at TIMESTAMP WITH TIME ZONE,
  matching_completed_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sourcing_requests_buyer ON sourcing_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_requests_category ON sourcing_requests(category);
CREATE INDEX IF NOT EXISTS idx_sourcing_requests_status ON sourcing_requests(status);
CREATE INDEX IF NOT EXISTS idx_sourcing_requests_created ON sourcing_requests(created_at DESC);

-- ============================================================================
-- SUPPLIER EXTENSIONS
-- ============================================================================

-- Add matching-specific columns to suppliers table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'suppliers' AND column_name = 'grain_enabled') THEN
    ALTER TABLE suppliers ADD COLUMN grain_enabled BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'suppliers' AND column_name = 'grain_account_id') THEN
    ALTER TABLE suppliers ADD COLUMN grain_account_id VARCHAR(255);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'suppliers' AND column_name = 'categories') THEN
    ALTER TABLE suppliers ADD COLUMN categories TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'suppliers' AND column_name = 'headquarters') THEN
    ALTER TABLE suppliers ADD COLUMN headquarters VARCHAR(500);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'suppliers' AND column_name = 'warehouses') THEN
    ALTER TABLE suppliers ADD COLUMN warehouses TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'suppliers' AND column_name = 'capabilities') THEN
    ALTER TABLE suppliers ADD COLUMN capabilities JSONB DEFAULT '{}';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'suppliers' AND column_name = 'performance') THEN
    ALTER TABLE suppliers ADD COLUMN performance JSONB DEFAULT '{}';
  END IF;
END $$;

-- ============================================================================
-- SOURCING MATCHES
-- ============================================================================

CREATE TABLE IF NOT EXISTS sourcing_matches (
  id VARCHAR(255) PRIMARY KEY,
  request_id VARCHAR(255) REFERENCES sourcing_requests(id),
  supplier_id VARCHAR(255),

  -- Scores
  overall_score INTEGER NOT NULL,
  score_breakdown JSONB NOT NULL,

  -- Match reasoning
  reasoning TEXT,
  strengths TEXT[],
  concerns TEXT[],

  -- Estimates
  estimated_price DECIMAL(12, 2),
  estimated_lead_time INTEGER,
  estimated_capacity_fit VARCHAR(50), -- exact, good, possible, stretch

  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, viewed, interested, rejected, connected, deal_started, deal_completed

  -- Introduction
  introduction_id VARCHAR(255),
  introduced_at TIMESTAMP WITH TIME ZONE,
  buyer_viewed_at TIMESTAMP WITH TIME ZONE,
  buyer_responded_at TIMESTAMP WITH TIME ZONE,
  supplier_viewed_at TIMESTAMP WITH TIME ZONE,
  supplier_responded_at TIMESTAMP WITH TIME ZONE,

  -- Deal progression
  deal_room_id VARCHAR(255),
  transaction_id VARCHAR(255),

  -- Attribution
  fee_earned DECIMAL(12, 2),
  fee_captured_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  matched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sourcing_matches_request ON sourcing_matches(request_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_matches_supplier ON sourcing_matches(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_matches_status ON sourcing_matches(status);
CREATE INDEX IF NOT EXISTS idx_sourcing_matches_score ON sourcing_matches(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_sourcing_matches_matched ON sourcing_matches(matched_at DESC);

-- ============================================================================
-- INTRODUCTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS introductions (
  id VARCHAR(255) PRIMARY KEY,
  match_id VARCHAR(255) REFERENCES sourcing_matches(id),
  request_id VARCHAR(255) REFERENCES sourcing_requests(id),
  buyer_id VARCHAR(255),
  supplier_id VARCHAR(255),

  -- Content
  buyer_intro_message TEXT,
  supplier_intro_message TEXT,

  -- Summarized info
  request_summary TEXT,
  supplier_summary TEXT,

  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- draft, sent, opened, buyer_interested, buyer_passed, supplier_interested, supplier_passed, mutual_interest, deal_room_created

  -- Tracking
  sent_at TIMESTAMP WITH TIME ZONE,
  buyer_opened_at TIMESTAMP WITH TIME ZONE,
  buyer_responded_at TIMESTAMP WITH TIME ZONE,
  buyer_response VARCHAR(50), -- interested, passed, need_more_info
  supplier_opened_at TIMESTAMP WITH TIME ZONE,
  supplier_responded_at TIMESTAMP WITH TIME ZONE,
  supplier_response VARCHAR(50), -- interested, passed, need_more_info

  -- Deal room
  deal_room_created_at TIMESTAMP WITH TIME ZONE,
  deal_room_id VARCHAR(255),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_introductions_match ON introductions(match_id);
CREATE INDEX IF NOT EXISTS idx_introductions_buyer ON introductions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_introductions_supplier ON introductions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_introductions_status ON introductions(status);

-- ============================================================================
-- DEAL ROOMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_rooms (
  id VARCHAR(255) PRIMARY KEY,
  introduction_id VARCHAR(255) REFERENCES introductions(id),
  request_id VARCHAR(255) REFERENCES sourcing_requests(id),
  buyer_id VARCHAR(255),
  supplier_id VARCHAR(255),

  -- Status
  status VARCHAR(50) DEFAULT 'active', -- active, negotiating, agreement_pending, completed, cancelled

  -- Deal details
  agreed_price DECIMAL(12, 2),
  agreed_quantity INTEGER,
  agreed_delivery_date TIMESTAMP WITH TIME ZONE,

  -- Documents
  proposal_url TEXT,
  contract_url TEXT,

  -- Transaction
  transaction_id VARCHAR(255),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deal_rooms_buyer ON deal_rooms(buyer_id);
CREATE INDEX IF NOT EXISTS idx_deal_rooms_supplier ON deal_rooms(supplier_id);
CREATE INDEX IF NOT EXISTS idx_deal_rooms_status ON deal_rooms(status);

-- ============================================================================
-- MATCH ATTRIBUTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS match_attributions (
  id VARCHAR(255) PRIMARY KEY,
  match_id VARCHAR(255) REFERENCES sourcing_matches(id),
  request_id VARCHAR(255) REFERENCES sourcing_requests(id),
  supplier_id VARCHAR(255),
  buyer_id VARCHAR(255),

  -- Tracking
  matched_at TIMESTAMP WITH TIME ZONE NOT NULL,
  introduced_at TIMESTAMP WITH TIME ZONE,
  deal_started_at TIMESTAMP WITH TIME ZONE,
  transaction_id VARCHAR(255),
  transaction_completed_at TIMESTAMP WITH TIME ZONE,

  -- Attribution window
  attribution_window_days INTEGER DEFAULT 90,
  attribution_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Fee calculation
  transaction_value DECIMAL(12, 2),
  fee_percentage DECIMAL(5, 4) DEFAULT 0.01, -- 1% = 0.01
  fee_amount DECIMAL(12, 2),
  fee_currency VARCHAR(10) DEFAULT 'USD',

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, attributed, fee_calculated, fee_captured, expired

  -- Payment
  fee_invoice_id VARCHAR(255),
  fee_paid_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_match_attributions_match ON match_attributions(match_id);
CREATE INDEX IF NOT EXISTS idx_match_attributions_buyer ON match_attributions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_match_attributions_supplier ON match_attributions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_match_attributions_status ON match_attributions(status);
CREATE INDEX IF NOT EXISTS idx_match_attributions_expires ON match_attributions(attribution_expires_at);
CREATE INDEX IF NOT EXISTS idx_match_attributions_pending ON match_attributions(buyer_id, supplier_id, status)
  WHERE status = 'pending';

-- ============================================================================
-- FEE INVOICES
-- ============================================================================

CREATE TABLE IF NOT EXISTS fee_invoices (
  id VARCHAR(255) PRIMARY KEY,
  attribution_id VARCHAR(255) REFERENCES match_attributions(id),
  match_id VARCHAR(255),
  transaction_id VARCHAR(255),

  buyer_id VARCHAR(255),
  supplier_id VARCHAR(255),

  fee_amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',

  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, paid, overdue, cancelled

  payment_id VARCHAR(255),
  paid_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fee_invoices_attribution ON fee_invoices(attribution_id);
CREATE INDEX IF NOT EXISTS idx_fee_invoices_status ON fee_invoices(status);

-- ============================================================================
-- TRUST SCORES TABLE (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS trust_scores (
  id VARCHAR(255) PRIMARY KEY,
  entity_id VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- buyer, supplier

  trust_score INTEGER DEFAULT 50,
  trust_tier VARCHAR(50) DEFAULT 'new', -- new, verified, established, trusted, elite, legendary

  -- Factors
  completion_rate INTEGER DEFAULT 50,
  on_time_rate INTEGER DEFAULT 50,
  dispute_rate INTEGER DEFAULT 100,
  tenure_score INTEGER DEFAULT 0,
  verification_score INTEGER DEFAULT 0,
  payment_score INTEGER DEFAULT 50,
  volume_score INTEGER DEFAULT 0,
  response_score INTEGER DEFAULT 50,

  -- Badges
  badges TEXT[],

  -- Raw metrics
  total_deals INTEGER DEFAULT 0,
  completed_deals INTEGER DEFAULT 0,
  disputed_deals INTEGER DEFAULT 0,
  total_volume DECIMAL(12, 2) DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trust_scores_entity ON trust_scores(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_trust_scores_tier ON trust_scores(trust_tier);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE sourcing_requests IS 'Buyer sourcing requests that need supplier matching';
COMMENT ON TABLE sourcing_matches IS 'Matches between sourcing requests and suppliers';
COMMENT ON TABLE introductions IS 'Introductions between matched buyers and suppliers';
COMMENT ON TABLE deal_rooms IS 'Deal rooms for active negotiations';
COMMENT ON TABLE match_attributions IS 'Attribution tracking for the 1% sourcing fee';
COMMENT ON TABLE fee_invoices IS 'Invoices for sourcing fees';
COMMENT ON TABLE trust_scores IS 'Trust and reputation scores for buyers and suppliers';
