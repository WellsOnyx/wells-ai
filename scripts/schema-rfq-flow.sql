-- ============================================================================
-- RFQ TRANSACTION FLOW - Complete Schema
-- Wells AI Buyer Transaction System
-- ============================================================================

-- ============================================================================
-- TABLE 1: rfq_constraints (Buyer negotiation limits)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rfq_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL,

  -- Budget constraints
  max_total_budget DECIMAL(20,2),
  max_unit_price DECIMAL(20,2),
  target_total_price DECIMAL(20,2),
  target_unit_price DECIMAL(20,2),

  -- Timeline constraints
  required_delivery_date DATE,
  max_lead_time_days INTEGER,
  preferred_lead_time_days INTEGER,

  -- Payment terms
  acceptable_payment_terms TEXT[] DEFAULT '{}',
  preferred_payment_terms TEXT,

  -- Quality requirements
  minimum_warranty_months INTEGER,
  required_certifications TEXT[] DEFAULT '{}',

  -- Negotiation preferences
  auto_negotiate BOOLEAN DEFAULT true,
  negotiation_aggression VARCHAR(20) DEFAULT 'balanced',
  allow_counter_offers BOOLEAN DEFAULT true,
  max_negotiation_rounds INTEGER DEFAULT 5,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE 2: rfq_quotes (Supplier quotes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rfq_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL,
  supplier_id UUID NOT NULL,

  -- Pricing
  unit_price DECIMAL(20,2) NOT NULL,
  quantity INTEGER NOT NULL,
  total_price DECIMAL(20,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',

  -- Terms
  lead_time_days INTEGER NOT NULL,
  payment_terms TEXT,
  warranty_months INTEGER,
  shipping_cost DECIMAL(20,2) DEFAULT 0,
  shipping_method TEXT,

  -- Quote details
  valid_until TIMESTAMPTZ,
  notes TEXT,
  line_items JSONB DEFAULT '[]',

  -- AI generation
  ai_generated BOOLEAN DEFAULT false,
  ai_confidence_score DECIMAL(5,2),
  source_catalog_id TEXT,

  -- Negotiation tracking
  is_initial_quote BOOLEAN DEFAULT true,
  parent_quote_id UUID,
  negotiation_round INTEGER DEFAULT 0,

  -- Status
  status VARCHAR(20) DEFAULT 'pending',
  supplier_confirmed BOOLEAN DEFAULT false,
  supplier_confirmed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'negotiating', 'accepted', 'rejected', 'expired', 'withdrawn'))
);

-- ============================================================================
-- TABLE 3: rfq_negotiations (AI-to-AI negotiation sessions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rfq_negotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL,
  quote_id UUID NOT NULL,
  supplier_id UUID NOT NULL,

  -- Positions
  buyer_constraints JSONB NOT NULL,
  initial_supplier_position JSONB NOT NULL,
  current_supplier_position JSONB,

  -- Negotiation state
  status VARCHAR(20) DEFAULT 'active',
  current_round INTEGER DEFAULT 1,
  max_rounds INTEGER DEFAULT 5,

  -- Messages (negotiation history)
  messages JSONB[] DEFAULT '{}',

  -- Outcome
  outcome VARCHAR(20),
  final_terms JSONB,
  final_quote_id UUID,

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Analytics
  total_price_reduction DECIMAL(20,2),
  reduction_percentage DECIMAL(5,2),
  rounds_used INTEGER,

  CONSTRAINT valid_negotiation_status CHECK (status IN ('active', 'paused', 'completed', 'failed', 'timeout', 'buyer_accepted', 'supplier_withdrawn')),
  CONSTRAINT valid_outcome CHECK (outcome IS NULL OR outcome IN ('agreement', 'no_agreement', 'buyer_accepted', 'supplier_withdrew', 'timeout', 'manual_override'))
);

-- ============================================================================
-- TABLE 4: rfq_awards (Winning quote awards)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rfq_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL,
  quote_id UUID NOT NULL,
  supplier_id UUID NOT NULL,
  negotiation_id UUID,

  -- Award details
  award_amount DECIMAL(20,2) NOT NULL,
  award_quantity INTEGER NOT NULL,
  award_unit_price DECIMAL(20,2) NOT NULL,
  award_terms JSONB NOT NULL,

  -- Deal linkage
  deal_id UUID,
  escrow_id UUID,

  -- ERP integration
  erp_connection_id UUID,
  erp_po_id TEXT,
  erp_po_number TEXT,
  erp_po_created_at TIMESTAMPTZ,
  erp_vendor_id TEXT,
  erp_sync_status VARCHAR(20) DEFAULT 'pending',
  erp_sync_error TEXT,

  -- Status
  status VARCHAR(20) DEFAULT 'pending',

  -- Timestamps
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  supplier_acknowledged_at TIMESTAMPTZ,
  payment_initiated_at TIMESTAMPTZ,
  payment_completed_at TIMESTAMPTZ,

  CONSTRAINT valid_award_status CHECK (status IN ('pending', 'acknowledged', 'payment_pending', 'paid', 'fulfilled', 'completed', 'cancelled', 'disputed'))
);

-- ============================================================================
-- TABLE 5: rfq_fulfillment (Delivery tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rfq_fulfillment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  award_id UUID NOT NULL,
  rfq_id UUID NOT NULL,

  -- Shipping details
  status VARCHAR(20) DEFAULT 'pending',
  carrier TEXT,
  tracking_number TEXT,
  tracking_url TEXT,

  -- Dates
  estimated_ship_date DATE,
  actual_ship_date DATE,
  estimated_delivery_date DATE,
  actual_delivery_date DATE,

  -- Delivery confirmation
  delivery_confirmed BOOLEAN DEFAULT false,
  delivery_confirmed_by TEXT,
  delivery_confirmed_at TIMESTAMPTZ,
  delivery_proof_url TEXT,
  delivery_notes TEXT,

  -- Quality check
  inspection_required BOOLEAN DEFAULT false,
  inspection_status VARCHAR(20),
  inspection_notes TEXT,

  -- ERP receipt
  erp_receipt_id TEXT,
  erp_receipt_created_at TIMESTAMPTZ,

  -- Issues
  has_issues BOOLEAN DEFAULT false,
  issue_description TEXT,
  issue_resolution TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_fulfillment_status CHECK (status IN ('pending', 'processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'delayed', 'cancelled', 'returned'))
);

-- ============================================================================
-- TABLE 6: rfq_documents (Generated RFP/RFQ documents)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rfq_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL,

  -- Document info
  document_type VARCHAR(20) NOT NULL,
  version INTEGER DEFAULT 1,

  -- Content
  title TEXT NOT NULL,
  content JSONB NOT NULL,

  -- File storage
  file_url TEXT,
  file_format VARCHAR(10),
  file_size_bytes INTEGER,

  -- Status
  status VARCHAR(20) DEFAULT 'draft',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_doc_type CHECK (document_type IN ('rfq', 'rfp', 'quote_comparison', 'award_letter', 'po', 'invoice', 'receipt')),
  CONSTRAINT valid_doc_status CHECK (status IN ('draft', 'final', 'sent', 'archived'))
);

-- ============================================================================
-- TABLE 7: supplier_catalog (Supplier pricing rules for AI quotes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS supplier_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL,

  -- Product info
  product_category TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT,
  product_description TEXT,

  -- Pricing
  base_unit_price DECIMAL(20,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  minimum_order_qty INTEGER DEFAULT 1,

  -- Volume discounts
  volume_discounts JSONB DEFAULT '[]',

  -- Lead times
  standard_lead_time_days INTEGER NOT NULL,
  rush_lead_time_days INTEGER,
  rush_fee_percentage DECIMAL(5,2),

  -- Terms
  default_payment_terms TEXT,
  warranty_months INTEGER,

  -- AI pricing rules
  ai_pricing_enabled BOOLEAN DEFAULT true,
  ai_min_margin_percentage DECIMAL(5,2) DEFAULT 15,
  ai_negotiation_floor_percentage DECIMAL(5,2) DEFAULT 5,
  ai_auto_quote_enabled BOOLEAN DEFAULT true,

  -- Status
  active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- rfq_constraints indexes
CREATE INDEX IF NOT EXISTS idx_rfq_constraints_rfq ON rfq_constraints(rfq_id);

-- rfq_quotes indexes
CREATE INDEX IF NOT EXISTS idx_rfq_quotes_rfq ON rfq_quotes(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_quotes_supplier ON rfq_quotes(supplier_id);
CREATE INDEX IF NOT EXISTS idx_rfq_quotes_status ON rfq_quotes(status);
CREATE INDEX IF NOT EXISTS idx_rfq_quotes_created ON rfq_quotes(created_at DESC);

-- rfq_negotiations indexes
CREATE INDEX IF NOT EXISTS idx_rfq_negotiations_rfq ON rfq_negotiations(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_negotiations_quote ON rfq_negotiations(quote_id);
CREATE INDEX IF NOT EXISTS idx_rfq_negotiations_status ON rfq_negotiations(status);

-- rfq_awards indexes
CREATE INDEX IF NOT EXISTS idx_rfq_awards_rfq ON rfq_awards(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_awards_supplier ON rfq_awards(supplier_id);
CREATE INDEX IF NOT EXISTS idx_rfq_awards_deal ON rfq_awards(deal_id);
CREATE INDEX IF NOT EXISTS idx_rfq_awards_status ON rfq_awards(status);

-- rfq_fulfillment indexes
CREATE INDEX IF NOT EXISTS idx_rfq_fulfillment_award ON rfq_fulfillment(award_id);
CREATE INDEX IF NOT EXISTS idx_rfq_fulfillment_rfq ON rfq_fulfillment(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_fulfillment_status ON rfq_fulfillment(status);

-- rfq_documents indexes
CREATE INDEX IF NOT EXISTS idx_rfq_documents_rfq ON rfq_documents(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_documents_type ON rfq_documents(document_type);

-- supplier_catalog indexes
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_supplier ON supplier_catalog(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_category ON supplier_catalog(product_category);
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_active ON supplier_catalog(active) WHERE active = true;

-- ============================================================================
-- Add status column to existing rfqs table if not exists
-- ============================================================================
DO $$
BEGIN
  -- Add new statuses to rfqs if the constraint doesn't include them
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'rfqs' AND constraint_name = 'rfqs_status_check'
  ) THEN
    ALTER TABLE rfqs DROP CONSTRAINT IF EXISTS rfqs_status_check;
  END IF;

  -- Add new check constraint with all statuses
  ALTER TABLE rfqs ADD CONSTRAINT rfqs_status_check
    CHECK (status IN ('open', 'matched', 'quoting', 'negotiating', 'quoted', 'awarded', 'payment_pending', 'paid', 'fulfilling', 'delivered', 'completed', 'closed', 'cancelled'));
EXCEPTION
  WHEN others THEN
    -- Table might not exist yet, ignore
    NULL;
END $$;

-- ============================================================================
-- DONE
-- ============================================================================
