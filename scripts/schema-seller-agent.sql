-- ============================================================================
-- SELLER AI AGENT & CATALOG SYSTEM
-- Wells AI - Complete Seller Agent Schema
-- ============================================================================
--
-- This schema supports:
-- 1. Seller AI agent configuration (pricing rules, negotiation style)
-- 2. Product catalog management
-- 3. Quote generation and tracking
-- 4. AI-to-AI negotiation sessions
-- 5. Performance metrics and analytics
--
-- ============================================================================

-- ============================================================================
-- TABLE 1: seller_ai_configs
-- Seller's AI agent configuration and preferences
-- ============================================================================
CREATE TABLE IF NOT EXISTS seller_ai_configs (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,

  -- Business description
  business_description TEXT,
  product_categories JSONB DEFAULT '[]',
  specializations JSONB DEFAULT '[]',

  -- Pricing strategy
  -- {
  --   "minMargin": 15,
  --   "targetMargin": 30,
  --   "walkAwayMargin": 5,
  --   "volumeDiscountTiers": [
  --     {"minQuantity": 100, "discountPercent": 5},
  --     {"minQuantity": 500, "discountPercent": 10}
  --   ],
  --   "urgencyPremium": 20,
  --   "standardLeadTimeDays": 7,
  --   "rushLeadTimeDays": 3,
  --   "repeatCustomerDiscount": 5,
  --   "firstOrderDiscount": 10
  -- }
  pricing_strategy JSONB NOT NULL DEFAULT '{}',

  -- Negotiation style
  -- {
  --   "aggression": "balanced",
  --   "maxConcessions": 3,
  --   "concessionSize": 25,
  --   "walkAwayThreshold": 10,
  --   "requireJustification": false,
  --   "bundleUpsell": true
  -- }
  negotiation_style JSONB NOT NULL DEFAULT '{}',

  -- Auto-response settings
  -- {
  --   "enabled": true,
  --   "quoteResponseHours": 2,
  --   "autoApproveUnder": 5000,
  --   "requireApprovalOver": 25000,
  --   "autoApproveMarginOver": 25,
  --   "workingHoursOnly": false,
  --   "workingHoursStart": 9,
  --   "workingHoursEnd": 17,
  --   "workingDays": [1,2,3,4,5]
  -- }
  auto_response JSONB NOT NULL DEFAULT '{}',

  -- Notification preferences
  -- {
  --   "email": true,
  --   "sms": true,
  --   "slack": false,
  --   "notifyOnNewRfq": true,
  --   "notifyOnQuoteSent": true,
  --   "notifyOnDealClosed": true,
  --   "dailySummary": true
  -- }
  notifications JSONB NOT NULL DEFAULT '{}',

  -- Contact info
  preferred_contact_method TEXT DEFAULT 'email',
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  slack_webhook TEXT,

  -- AI personality
  agent_tone TEXT DEFAULT 'professional' CHECK (agent_tone IN ('professional', 'friendly', 'direct')),
  company_tagline TEXT,
  value_propositions JSONB DEFAULT '[]',

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_seller_configs_seller ON seller_ai_configs(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_configs_active ON seller_ai_configs(is_active) WHERE is_active = true;

-- ============================================================================
-- TABLE 2: seller_catalog
-- Product catalog with AI matching capabilities
-- ============================================================================
CREATE TABLE IF NOT EXISTS seller_catalog (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,

  -- Product info
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  tags JSONB DEFAULT '[]',

  -- Pricing structure
  -- {
  --   "basePrice": 100.00,
  --   "currency": "USD",
  --   "priceUnit": "unit",
  --   "costPrice": 60.00,
  --   "marginPercent": 40,
  --   "volumeDiscounts": [
  --     {"minQuantity": 100, "discountPercent": 5}
  --   ],
  --   "minOrderQuantity": 1,
  --   "maxOrderQuantity": 10000
  -- }
  pricing JSONB NOT NULL DEFAULT '{}',

  -- Lead time configuration
  -- {
  --   "standardDays": 7,
  --   "rushDays": 3,
  --   "rushPremiumPercent": 20,
  --   "customLeadDays": 14,
  --   "customPremiumPercent": 10
  -- }
  lead_time JSONB NOT NULL DEFAULT '{}',

  -- Availability
  -- {
  --   "inStock": true,
  --   "stockQuantity": 500,
  --   "restockDate": "2024-02-01",
  --   "madeToOrder": false,
  --   "seasonalAvailability": {"startMonth": 3, "endMonth": 10}
  -- }
  availability JSONB NOT NULL DEFAULT '{}',

  -- Additional details
  specifications JSONB DEFAULT '{}',
  images JSONB DEFAULT '[]',

  -- AI matching
  search_keywords JSONB DEFAULT '[]',
  matching_weight DECIMAL(3,2) DEFAULT 1.0,

  -- Sync source
  source_type TEXT DEFAULT 'manual' CHECK (source_type IN ('manual', 'csv', 'shopify', 'woocommerce', 'erp', 'conversation')),
  source_id TEXT,
  last_synced_at TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_seller ON seller_catalog(seller_id);
CREATE INDEX IF NOT EXISTS idx_catalog_category ON seller_catalog(category);
CREATE INDEX IF NOT EXISTS idx_catalog_active ON seller_catalog(seller_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_catalog_keywords ON seller_catalog USING GIN(search_keywords);
CREATE INDEX IF NOT EXISTS idx_catalog_sku ON seller_catalog(sku) WHERE sku IS NOT NULL;

-- ============================================================================
-- TABLE 3: catalog_ingestion_jobs
-- Track catalog import jobs from various sources
-- ============================================================================
CREATE TABLE IF NOT EXISTS catalog_ingestion_jobs (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('csv', 'shopify', 'woocommerce', 'erp', 'manual', 'conversation')),

  -- Job status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'mapping', 'importing', 'completed', 'failed')),

  -- Progress tracking
  total_records INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  successful_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,

  -- Errors and mapping
  errors JSONB DEFAULT '[]',
  field_mapping JSONB,
  source_config JSONB,

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ingestion_seller ON catalog_ingestion_jobs(seller_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_status ON catalog_ingestion_jobs(status);

-- ============================================================================
-- TABLE 4: seller_quotes
-- AI-generated quotes for RFQs
-- ============================================================================
CREATE TABLE IF NOT EXISTS seller_quotes (
  id TEXT PRIMARY KEY,
  rfq_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  seller_company TEXT NOT NULL,

  -- Quote details
  line_items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(20,2) NOT NULL,
  discount_amount DECIMAL(20,2) DEFAULT 0,
  discount_reason TEXT,
  shipping_cost DECIMAL(20,2) DEFAULT 0,
  rush_fee DECIMAL(20,2) DEFAULT 0,
  total DECIMAL(20,2) NOT NULL,
  currency TEXT DEFAULT 'USD',

  -- Terms
  payment_terms TEXT DEFAULT 'NET30',
  valid_until TIMESTAMPTZ NOT NULL,
  delivery_terms TEXT,
  warranty TEXT,

  -- Margin analysis (internal)
  calculated_margin DECIMAL(5,2),
  target_margin DECIMAL(5,2),
  is_auto_approved BOOLEAN DEFAULT false,
  requires_approval BOOLEAN DEFAULT true,

  -- Status tracking
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'sent', 'accepted', 'rejected', 'expired', 'negotiating')),
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,

  -- AI reasoning
  ai_reasoning TEXT,
  confidence_score DECIMAL(3,2),
  matched_products JSONB DEFAULT '[]',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotes_seller ON seller_quotes(seller_id);
CREATE INDEX IF NOT EXISTS idx_quotes_rfq ON seller_quotes(rfq_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON seller_quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_pending ON seller_quotes(seller_id, status) WHERE status = 'pending_approval';
CREATE INDEX IF NOT EXISTS idx_quotes_created ON seller_quotes(created_at DESC);

-- ============================================================================
-- TABLE 5: quote_events
-- Audit trail for quote lifecycle
-- ============================================================================
CREATE TABLE IF NOT EXISTS quote_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('ai', 'seller', 'buyer', 'system')),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_events_quote ON quote_events(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_events_type ON quote_events(event_type);

-- ============================================================================
-- TABLE 6: seller_negotiations
-- AI-to-AI negotiation sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS seller_negotiations (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  buyer_id TEXT,

  -- Price positions
  initial_seller_price DECIMAL(20,2) NOT NULL,
  initial_buyer_offer DECIMAL(20,2),
  current_seller_price DECIMAL(20,2) NOT NULL,
  current_buyer_offer DECIMAL(20,2),

  -- Negotiation state
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'seller_accepted', 'buyer_accepted', 'no_deal', 'escalated', 'expired')),
  round INTEGER DEFAULT 0,
  max_rounds INTEGER DEFAULT 5,

  -- Message history
  -- [
  --   {
  --     "id": "msg_xxx",
  --     "round": 1,
  --     "from": "buyer_ai",
  --     "type": "offer",
  --     "content": {"price": 9000, "message": "...", "reasoning": "..."},
  --     "timestamp": "2024-01-15T10:00:00Z"
  --   }
  -- ]
  messages JSONB DEFAULT '[]',

  -- Constraints
  seller_floor_price DECIMAL(20,2) NOT NULL,
  seller_target_price DECIMAL(20,2) NOT NULL,
  buyer_ceiling_price DECIMAL(20,2),

  -- Outcome
  final_price DECIMAL(20,2),
  final_terms JSONB,
  deal_id TEXT,

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_negotiations_seller ON seller_negotiations(seller_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_quote ON seller_negotiations(quote_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_status ON seller_negotiations(status);
CREATE INDEX IF NOT EXISTS idx_negotiations_active ON seller_negotiations(seller_id, status) WHERE status = 'active';

-- ============================================================================
-- TABLE 7: seller_reviews
-- Customer ratings and reviews
-- ============================================================================
CREATE TABLE IF NOT EXISTS seller_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id TEXT NOT NULL,
  buyer_id TEXT NOT NULL,
  deal_id TEXT,
  quote_id TEXT,

  -- Rating
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT,

  -- Specific ratings
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  delivery_rating INTEGER CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
  value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),

  -- Status
  is_verified BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_seller ON seller_reviews(seller_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON seller_reviews(seller_id, rating);

-- ============================================================================
-- TABLE 8: seller_performance_snapshots
-- Historical performance data for trending
-- ============================================================================
CREATE TABLE IF NOT EXISTS seller_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id TEXT NOT NULL,
  snapshot_date DATE NOT NULL,

  -- Metrics
  total_rfqs INTEGER DEFAULT 0,
  total_quotes INTEGER DEFAULT 0,
  deals_won INTEGER DEFAULT 0,
  deals_closed INTEGER DEFAULT 0,
  total_revenue DECIMAL(20,2) DEFAULT 0,

  -- Rates
  win_rate DECIMAL(5,2) DEFAULT 0,
  quote_rate DECIMAL(5,2) DEFAULT 0,
  close_rate DECIMAL(5,2) DEFAULT 0,

  -- Timing and pricing
  avg_response_hours DECIMAL(10,2) DEFAULT 0,
  avg_margin DECIMAL(5,2) DEFAULT 0,
  avg_deal_size DECIMAL(20,2) DEFAULT 0,

  -- Negotiation
  total_negotiations INTEGER DEFAULT 0,
  negotiations_won INTEGER DEFAULT 0,
  avg_discount DECIMAL(5,2) DEFAULT 0,

  -- Customer
  avg_rating DECIMAL(3,2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  repeat_customer_rate DECIMAL(5,2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (seller_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_seller ON seller_performance_snapshots(seller_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON seller_performance_snapshots(snapshot_date DESC);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active seller agents summary
CREATE OR REPLACE VIEW active_seller_agents AS
SELECT
  sac.seller_id,
  sac.company_name,
  sac.agent_tone,
  (sac.auto_response->>'enabled')::boolean as auto_response_enabled,
  (sac.pricing_strategy->>'targetMargin')::numeric as target_margin,
  sac.negotiation_style->>'aggression' as negotiation_style,
  COUNT(DISTINCT sc.id) as product_count,
  COUNT(DISTINCT sq.id) FILTER (WHERE sq.status = 'sent') as quotes_sent,
  COUNT(DISTINCT sq.id) FILTER (WHERE sq.status = 'accepted') as deals_won,
  sac.last_active_at,
  sac.created_at
FROM seller_ai_configs sac
LEFT JOIN seller_catalog sc ON sac.seller_id = sc.seller_id AND sc.is_active = true
LEFT JOIN seller_quotes sq ON sac.seller_id = sq.seller_id
WHERE sac.is_active = true
GROUP BY sac.seller_id, sac.company_name, sac.agent_tone, sac.auto_response,
         sac.pricing_strategy, sac.negotiation_style, sac.last_active_at, sac.created_at;

-- Quote pipeline view
CREATE OR REPLACE VIEW seller_quote_pipeline AS
SELECT
  sq.seller_id,
  sq.status,
  COUNT(*) as count,
  SUM(sq.total) as total_value,
  AVG(sq.calculated_margin) as avg_margin,
  AVG(EXTRACT(EPOCH FROM (sq.sent_at - sq.created_at)) / 3600)
    FILTER (WHERE sq.sent_at IS NOT NULL) as avg_response_hours
FROM seller_quotes sq
WHERE sq.created_at >= NOW() - INTERVAL '30 days'
GROUP BY sq.seller_id, sq.status;

-- Active negotiations view
CREATE OR REPLACE VIEW active_seller_negotiations AS
SELECT
  sn.id,
  sn.seller_id,
  sac.company_name,
  sn.quote_id,
  sn.current_seller_price,
  sn.current_buyer_offer,
  sn.round,
  sn.max_rounds,
  sn.status,
  CASE
    WHEN sn.current_buyer_offer IS NOT NULL
    THEN ((sn.current_seller_price - sn.current_buyer_offer) / sn.current_seller_price) * 100
    ELSE 0
  END as price_gap_percent,
  sn.last_activity_at,
  sn.expires_at
FROM seller_negotiations sn
JOIN seller_ai_configs sac ON sn.seller_id = sac.seller_id
WHERE sn.status = 'active'
ORDER BY sn.last_activity_at DESC;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update seller's last active timestamp
CREATE OR REPLACE FUNCTION update_seller_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE seller_ai_configs
  SET last_active_at = NOW()
  WHERE seller_id = NEW.seller_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for quote activity
DROP TRIGGER IF EXISTS trigger_quote_updates_seller_active ON seller_quotes;
CREATE TRIGGER trigger_quote_updates_seller_active
  AFTER INSERT OR UPDATE ON seller_quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_last_active();

-- Trigger for negotiation activity
DROP TRIGGER IF EXISTS trigger_negotiation_updates_seller_active ON seller_negotiations;
CREATE TRIGGER trigger_negotiation_updates_seller_active
  AFTER INSERT OR UPDATE ON seller_negotiations
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_last_active();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE seller_ai_configs IS 'AI agent configuration for sellers including pricing rules and negotiation behavior';
COMMENT ON TABLE seller_catalog IS 'Product catalog with AI-matching capabilities';
COMMENT ON TABLE seller_quotes IS 'AI-generated quotes for RFQs';
COMMENT ON TABLE seller_negotiations IS 'AI-to-AI negotiation sessions between buyer and seller agents';
COMMENT ON TABLE seller_performance_snapshots IS 'Historical performance data for trending and analytics';

COMMENT ON COLUMN seller_ai_configs.pricing_strategy IS 'Pricing rules including margins, discounts, and premiums';
COMMENT ON COLUMN seller_ai_configs.negotiation_style IS 'AI negotiation behavior: conservative, balanced, or aggressive';
COMMENT ON COLUMN seller_ai_configs.auto_response IS 'Automatic quote generation and approval settings';

COMMENT ON COLUMN seller_catalog.search_keywords IS 'AI-generated keywords for product matching';
COMMENT ON COLUMN seller_catalog.matching_weight IS 'Weight for AI matching algorithm (0.0-1.0)';

COMMENT ON COLUMN seller_quotes.ai_reasoning IS 'AI explanation for pricing decisions';
COMMENT ON COLUMN seller_quotes.confidence_score IS 'AI confidence in quote accuracy (0.0-1.0)';

COMMENT ON COLUMN seller_negotiations.messages IS 'Full negotiation history with AI reasoning';
COMMENT ON COLUMN seller_negotiations.seller_floor_price IS 'Minimum acceptable price based on margin rules';

-- ============================================================================
-- TABLE 9: seller_buyer_preferences
-- Buyer exclusions, VIP lists, and tier definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS seller_buyer_preferences (
  seller_id TEXT PRIMARY KEY,

  -- Buyer Lists
  excluded_buyers JSONB DEFAULT '[]', -- Buyers to not work with
  priority_buyers JSONB DEFAULT '[]', -- VIP buyers get better terms

  -- Tier Definitions
  buyer_tiers JSONB DEFAULT '{
    "gold": {"minOrders": 10, "discountPercent": 10},
    "silver": {"minOrders": 5, "discountPercent": 5},
    "bronze": {"minOrders": 1, "discountPercent": 0}
  }',

  -- Auto-classification Rules
  auto_classify BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE 10: seller_pricing_rules
-- Custom pricing rules beyond simple volume discounts
-- ============================================================================
CREATE TABLE IF NOT EXISTS seller_pricing_rules (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,

  -- Rule Definition
  rule_type TEXT NOT NULL CHECK (rule_type IN ('volume_discount', 'buyer_tier', 'seasonal', 'margin_floor', 'time_limited', 'bundle', 'custom')),
  name TEXT NOT NULL,
  description TEXT,

  -- Conditions (when to apply the rule)
  -- Examples:
  -- {"minQuantity": 100, "maxQuantity": 500}
  -- {"buyerTier": "gold", "minOrderValue": 1000}
  -- {"category": "Electronics", "startDate": "2024-01-01", "endDate": "2024-12-31"}
  conditions JSONB NOT NULL DEFAULT '{}',

  -- Adjustments (what the rule does)
  -- Examples:
  -- {"type": "percentage", "amount": -10} -- 10% discount
  -- {"type": "fixed", "amount": -50} -- $50 off
  -- {"type": "margin_floor", "minMargin": 15}
  adjustments JSONB NOT NULL DEFAULT '{}',

  -- Priority (higher = evaluated first)
  priority INTEGER DEFAULT 0,

  -- Applicability
  applies_to_products JSONB DEFAULT '[]', -- Empty = all products
  applies_to_categories JSONB DEFAULT '[]', -- Empty = all categories
  applies_to_buyers JSONB DEFAULT '[]', -- Empty = all buyers

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Validity Period
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_seller ON seller_pricing_rules(seller_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_type ON seller_pricing_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_active ON seller_pricing_rules(seller_id, is_active) WHERE is_active = true;

-- ============================================================================
-- TABLE 11: seller_agents
-- Core seller agent configurations (alternate structure)
-- ============================================================================
CREATE TABLE IF NOT EXISTS seller_agents (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL UNIQUE,

  -- Business Information
  company_name TEXT NOT NULL,
  company_description TEXT,
  industry TEXT,

  -- Agent Configuration (stored as JSONB for flexibility)
  config JSONB NOT NULL DEFAULT '{
    "minMargin": 15,
    "maxDiscount": 20,
    "autoApproveBelow": 5000,
    "responseTimeTarget": "within_hour",
    "negotiationStyle": "balanced",
    "preferredPaymentTerms": ["NET30"],
    "volumeDiscountTiers": [
      {"minQuantity": 100, "discountPercent": 5},
      {"minQuantity": 500, "discountPercent": 10},
      {"minQuantity": 1000, "discountPercent": 15}
    ],
    "rushOrderPremium": 20,
    "standardLeadTimeDays": 7,
    "rushLeadTimeDays": 3
  }',

  -- Status
  is_active BOOLEAN DEFAULT true,
  onboarding_completed BOOLEAN DEFAULT false,
  last_activity_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_agents_seller ON seller_agents(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_agents_active ON seller_agents(is_active) WHERE is_active = true;

COMMENT ON TABLE seller_buyer_preferences IS 'Buyer exclusions, VIP lists, and tier definitions for seller agents';
COMMENT ON TABLE seller_pricing_rules IS 'Custom pricing rules beyond simple volume discounts';
COMMENT ON TABLE seller_agents IS 'Core seller agent configurations for the Seller AI Agent System';
