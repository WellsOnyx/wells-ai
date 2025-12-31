-- ============================================================================
-- SUPPLIER SOURCING PROFILES AND OPPORTUNITIES SYSTEM
-- ============================================================================
--
-- Complete supplier-side system for:
-- - Supplier profile management (what they sell, capabilities, certifications)
-- - Opportunity matching (connecting suppliers to buyer RFQs)
-- - Deal tracking and GRAIN payment integration
--
-- Related schemas:
-- - schema-suppliers.sql (basic supplier table)
-- - schema-rfq-flow.sql (buyer RFQ management)
-- - schema-grain.sql (GRAIN payment wallets)
--
-- ============================================================================

-- ============================================================================
-- SUPPLIER PROFILES (Extended profile for sourcing marketplace)
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Company Information
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL UNIQUE,
  contact_phone VARCHAR(50),
  website VARCHAR(255),

  -- What They Sell
  categories TEXT[] NOT NULL DEFAULT '{}',      -- Primary categories (technology, industrial, etc.)
  subcategories TEXT[] DEFAULT '{}',             -- Specific subcategories
  product_description TEXT,                       -- Free-form description of offerings

  -- Capabilities
  certifications TEXT[] DEFAULT '{}',            -- ISO 9001, FDA Approved, etc.
  monthly_capacity VARCHAR(50) DEFAULT 'medium', -- small, medium, large, enterprise
  lead_time_days INTEGER NOT NULL DEFAULT 7,     -- Standard lead time
  minimum_order_value DECIMAL(12,2) DEFAULT 0,   -- Minimum order value in USD

  -- Service Areas / Coverage
  service_areas TEXT[] NOT NULL DEFAULT '{}',    -- Regions they can serve

  -- Fulfillment Capabilities
  can_drop_ship BOOLEAN DEFAULT FALSE,
  can_white_label BOOLEAN DEFAULT FALSE,

  -- Payment Preferences
  accepts_grain BOOLEAN DEFAULT TRUE,            -- Accept GRAIN instant payment
  payment_terms VARCHAR(20) DEFAULT 'NET30',     -- Standard payment terms
  grain_wallet_id UUID REFERENCES grain_wallets(id),

  -- Matching & Scoring
  match_score INTEGER DEFAULT 50,                -- Overall profile quality score (0-100)
  response_rate DECIMAL(5,2) DEFAULT 0,          -- Historical response rate
  win_rate DECIMAL(5,2) DEFAULT 0,               -- Historical deal win rate

  -- Status & Timestamps
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'active', 'paused', 'rejected', 'churned'
  )),
  onboarded_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for supplier_profiles
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_email ON supplier_profiles(contact_email);
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_status ON supplier_profiles(status);
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_categories ON supplier_profiles USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_certifications ON supplier_profiles USING GIN(certifications);
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_service_areas ON supplier_profiles USING GIN(service_areas);
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_grain ON supplier_profiles(accepts_grain) WHERE accepts_grain = TRUE;

-- ============================================================================
-- SUPPLIER CAPABILITIES (Detailed capability breakdown)
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES supplier_profiles(id) ON DELETE CASCADE,

  -- Capability details
  capability_type VARCHAR(50) NOT NULL,  -- manufacturing, logistics, service, etc.
  capability_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Capacity details
  capacity_volume INTEGER,               -- Units per period
  capacity_period VARCHAR(20),           -- day, week, month
  lead_time_min INTEGER,                 -- Minimum lead time in days
  lead_time_max INTEGER,                 -- Maximum lead time in days

  -- Equipment/Resources
  equipment TEXT[],                      -- Specific equipment/tools
  resources TEXT[],                      -- Resources available

  -- Verification
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verified_by VARCHAR(255),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(supplier_id, capability_type, capability_name)
);

CREATE INDEX IF NOT EXISTS idx_supplier_capabilities_supplier ON supplier_capabilities(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_capabilities_type ON supplier_capabilities(capability_type);

-- ============================================================================
-- SUPPLIER CATEGORIES (Many-to-many with category metadata)
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_category_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES supplier_profiles(id) ON DELETE CASCADE,

  category_id VARCHAR(100) NOT NULL,     -- Category identifier
  category_name VARCHAR(255) NOT NULL,   -- Category display name
  is_primary BOOLEAN DEFAULT FALSE,      -- Is this a primary category?

  -- Category-specific details
  experience_years INTEGER,              -- Years in this category
  annual_volume DECIMAL(15,2),           -- Annual volume in this category

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(supplier_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_category_mapping_supplier ON supplier_category_mapping(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_category_mapping_category ON supplier_category_mapping(category_id);

-- ============================================================================
-- SUPPLIER CERTIFICATIONS (Detailed certification tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES supplier_profiles(id) ON DELETE CASCADE,

  certification_name VARCHAR(255) NOT NULL,
  certification_body VARCHAR(255),       -- Issuing body
  certification_number VARCHAR(100),     -- Certificate number

  issued_at DATE,
  expires_at DATE,
  document_url VARCHAR(500),             -- Link to certificate

  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(supplier_id, certification_name)
);

CREATE INDEX IF NOT EXISTS idx_supplier_certifications_supplier ON supplier_certifications(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_certifications_name ON supplier_certifications(certification_name);
CREATE INDEX IF NOT EXISTS idx_supplier_certifications_expires ON supplier_certifications(expires_at);

-- ============================================================================
-- SUPPLIER SERVICE AREAS (Detailed geographic coverage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES supplier_profiles(id) ON DELETE CASCADE,

  region_type VARCHAR(50) NOT NULL,      -- state, region, country, international
  region_name VARCHAR(255) NOT NULL,
  region_code VARCHAR(20),               -- State code, country code, etc.

  -- Shipping details for this region
  standard_lead_time INTEGER,            -- Days to deliver
  expedited_available BOOLEAN DEFAULT FALSE,
  expedited_lead_time INTEGER,
  shipping_cost_type VARCHAR(20),        -- flat, calculated, free

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(supplier_id, region_type, region_name)
);

CREATE INDEX IF NOT EXISTS idx_supplier_service_areas_supplier ON supplier_service_areas(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_service_areas_region ON supplier_service_areas(region_type, region_name);

-- ============================================================================
-- SUPPLIER OPPORTUNITIES (Matched RFQs for suppliers)
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES supplier_profiles(id) ON DELETE CASCADE,

  -- Matching details (from AI matching engine)
  match_score INTEGER NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  match_reasons TEXT[] DEFAULT '{}',
  match_concerns TEXT[] DEFAULT '{}',

  -- Estimated pricing
  estimated_value DECIMAL(15,2),
  estimated_margin DECIMAL(5,2),

  -- Supplier response
  status VARCHAR(30) DEFAULT 'new' CHECK (status IN (
    'new',              -- Just matched, not seen
    'viewed',           -- Supplier viewed opportunity
    'interested',       -- Supplier expressed interest
    'intro_requested',  -- Supplier requested buyer intro
    'quoting',          -- Supplier is preparing quote
    'quoted',           -- Quote submitted
    'negotiating',      -- In negotiation
    'won',              -- Deal won
    'lost',             -- Deal lost to competitor
    'declined',         -- Supplier declined opportunity
    'expired'           -- Opportunity expired
  )),

  -- Response details
  responded_at TIMESTAMPTZ,
  supplier_message TEXT,
  supplier_note TEXT,

  -- Quote details (if quoting)
  quoted_price DECIMAL(15,2),
  quoted_lead_time INTEGER,
  quote_valid_until TIMESTAMPTZ,
  quote_notes TEXT,

  -- Deal linkage (if won)
  deal_id UUID,

  -- Notifications
  notified_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(rfq_id, supplier_id)
);

-- Indexes for supplier_opportunities
CREATE INDEX IF NOT EXISTS idx_supplier_opportunities_supplier ON supplier_opportunities(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_opportunities_rfq ON supplier_opportunities(rfq_id);
CREATE INDEX IF NOT EXISTS idx_supplier_opportunities_status ON supplier_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_supplier_opportunities_score ON supplier_opportunities(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_opportunities_new ON supplier_opportunities(supplier_id, status) WHERE status = 'new';

-- ============================================================================
-- SUPPLIER DEALS (Won opportunities tracked for payment)
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES supplier_opportunities(id),
  supplier_id UUID NOT NULL REFERENCES supplier_profiles(id),
  buyer_company VARCHAR(255) NOT NULL,
  buyer_contact VARCHAR(255),
  buyer_email VARCHAR(255),

  -- Deal details
  description TEXT NOT NULL,
  category VARCHAR(100),
  quantity INTEGER,
  unit_price DECIMAL(15,2),
  total_value DECIMAL(15,2) NOT NULL,

  -- Deal lifecycle
  stage VARCHAR(30) DEFAULT 'negotiating' CHECK (stage IN (
    'negotiating', 'contract', 'fulfilled', 'invoiced', 'paid', 'closed', 'cancelled'
  )),

  -- Dates
  expected_delivery DATE,
  actual_delivery DATE,
  invoiced_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  -- Payment
  payment_method VARCHAR(20) DEFAULT 'grain' CHECK (payment_method IN (
    'grain', 'ach', 'wire', 'check', 'card'
  )),
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'processing', 'completed', 'failed', 'refunded'
  )),
  grain_transaction_id UUID,

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_deals_supplier ON supplier_deals(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_deals_stage ON supplier_deals(stage);
CREATE INDEX IF NOT EXISTS idx_supplier_deals_payment_status ON supplier_deals(payment_status);

-- ============================================================================
-- SUPPLIER PAYMENTS (GRAIN and traditional payment tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES supplier_deals(id),
  supplier_id UUID NOT NULL REFERENCES supplier_profiles(id),

  -- Payment details
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN (
    'grain', 'ach', 'wire', 'check', 'card'
  )),

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'
  )),

  -- GRAIN-specific
  grain_transaction_id UUID,
  grain_wallet_id UUID,

  -- Traditional payment details
  reference_number VARCHAR(100),
  bank_reference VARCHAR(100),

  -- Dates
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  -- Fees
  gross_amount DECIMAL(15,2) NOT NULL,
  fee_amount DECIMAL(10,2) DEFAULT 0,
  net_amount DECIMAL(15,2) NOT NULL,
  fee_payer VARCHAR(20) DEFAULT 'buyer',  -- buyer, supplier, split

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_deal ON supplier_payments(deal_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_status ON supplier_payments(status);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_type ON supplier_payments(payment_type);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active supplier profiles with stats
CREATE OR REPLACE VIEW supplier_profile_stats AS
SELECT
  sp.id,
  sp.company_name,
  sp.contact_email,
  sp.categories,
  sp.certifications,
  sp.monthly_capacity,
  sp.lead_time_days,
  sp.accepts_grain,
  sp.status,
  sp.created_at,
  COUNT(DISTINCT so.id) FILTER (WHERE so.status = 'new') as new_opportunities,
  COUNT(DISTINCT so.id) FILTER (WHERE so.status IN ('interested', 'intro_requested', 'quoting')) as active_opportunities,
  COUNT(DISTINCT sd.id) as total_deals,
  COUNT(DISTINCT sd.id) FILTER (WHERE sd.stage = 'paid') as completed_deals,
  COALESCE(SUM(sd.total_value) FILTER (WHERE sd.payment_status = 'completed'), 0) as total_revenue,
  COALESCE(SUM(sd.total_value) FILTER (WHERE sp.accepts_grain AND sd.payment_method = 'grain' AND sd.payment_status = 'completed'), 0) as grain_revenue
FROM supplier_profiles sp
LEFT JOIN supplier_opportunities so ON sp.id = so.supplier_id
LEFT JOIN supplier_deals sd ON sp.id = sd.supplier_id
GROUP BY sp.id;

-- Opportunity pipeline for suppliers
CREATE OR REPLACE VIEW supplier_opportunity_pipeline AS
SELECT
  sp.id as supplier_id,
  sp.company_name,
  so.status as opportunity_status,
  COUNT(*) as count,
  SUM(so.estimated_value) as total_value
FROM supplier_profiles sp
JOIN supplier_opportunities so ON sp.id = so.supplier_id
WHERE sp.status = 'active'
GROUP BY sp.id, sp.company_name, so.status
ORDER BY sp.company_name, so.status;

-- GRAIN payment summary
CREATE OR REPLACE VIEW supplier_grain_summary AS
SELECT
  sp.id as supplier_id,
  sp.company_name,
  sp.grain_wallet_id,
  COUNT(DISTINCT spm.id) FILTER (WHERE spm.payment_type = 'grain' AND spm.status = 'completed') as grain_payments,
  COALESCE(SUM(spm.net_amount) FILTER (WHERE spm.payment_type = 'grain' AND spm.status = 'completed'), 0) as grain_received,
  COALESCE(SUM(spm.fee_amount) FILTER (WHERE spm.payment_type = 'grain' AND spm.status = 'completed'), 0) as fees_saved
FROM supplier_profiles sp
LEFT JOIN supplier_payments spm ON sp.id = spm.supplier_id
WHERE sp.accepts_grain = TRUE
GROUP BY sp.id;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_supplier_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS trigger_supplier_profiles_updated ON supplier_profiles;
CREATE TRIGGER trigger_supplier_profiles_updated
  BEFORE UPDATE ON supplier_profiles
  FOR EACH ROW EXECUTE FUNCTION update_supplier_profile_timestamp();

DROP TRIGGER IF EXISTS trigger_supplier_opportunities_updated ON supplier_opportunities;
CREATE TRIGGER trigger_supplier_opportunities_updated
  BEFORE UPDATE ON supplier_opportunities
  FOR EACH ROW EXECUTE FUNCTION update_supplier_profile_timestamp();

DROP TRIGGER IF EXISTS trigger_supplier_deals_updated ON supplier_deals;
CREATE TRIGGER trigger_supplier_deals_updated
  BEFORE UPDATE ON supplier_deals
  FOR EACH ROW EXECUTE FUNCTION update_supplier_profile_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE supplier_profiles IS 'Extended supplier profiles for the Wells AI sourcing marketplace';
COMMENT ON TABLE supplier_capabilities IS 'Detailed capability breakdown for suppliers';
COMMENT ON TABLE supplier_category_mapping IS 'Many-to-many mapping of suppliers to categories';
COMMENT ON TABLE supplier_certifications IS 'Supplier certifications with verification status';
COMMENT ON TABLE supplier_service_areas IS 'Geographic service coverage for suppliers';
COMMENT ON TABLE supplier_opportunities IS 'RFQ opportunities matched to suppliers';
COMMENT ON TABLE supplier_deals IS 'Won deals and transactions';
COMMENT ON TABLE supplier_payments IS 'Payment tracking including GRAIN instant payments';

COMMENT ON COLUMN supplier_profiles.accepts_grain IS 'Whether supplier accepts GRAIN instant payment - saves 2-3% vs card fees';
COMMENT ON COLUMN supplier_profiles.match_score IS 'AI-calculated profile quality score for matching';
COMMENT ON COLUMN supplier_opportunities.match_score IS 'AI-calculated match score between supplier and RFQ';
COMMENT ON COLUMN supplier_payments.grain_transaction_id IS 'Reference to GRAIN ledger transaction';

-- ============================================================================
-- SEED DATA (Sample suppliers for testing)
-- ============================================================================

-- Insert sample supplier profile
INSERT INTO supplier_profiles (
  company_name,
  contact_name,
  contact_email,
  contact_phone,
  website,
  categories,
  subcategories,
  product_description,
  certifications,
  monthly_capacity,
  lead_time_days,
  minimum_order_value,
  service_areas,
  can_drop_ship,
  can_white_label,
  accepts_grain,
  payment_terms,
  status,
  onboarded_at
) VALUES (
  'Demo Industrial Supply Co.',
  'Demo User',
  'demo@demosupplier.com',
  '+1-555-0100',
  'https://demosupplier.com',
  ARRAY['industrial', 'electronics'],
  ARRAY['Motors', 'Sensors', 'Power Supplies'],
  'Full-service industrial and electronic component supplier with nationwide coverage',
  ARRAY['ISO 9001', 'UL Listed', 'RoHS Compliant'],
  'large',
  5,
  500.00,
  ARRAY['National (All US)', 'West Coast (CA, WA, OR)'],
  true,
  true,
  true,
  'NET30',
  'active',
  NOW()
) ON CONFLICT (contact_email) DO NOTHING;
