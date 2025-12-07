-- ============================================================================
-- SUPPLIER ONBOARDING AND MATCHING SYSTEM
-- ============================================================================
--
-- Standalone supplier management with AI-powered matching
-- Tracks supplier capabilities, pricing, and matches them to RFQs
--
-- ============================================================================

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Company information
  company_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  website VARCHAR(255),

  -- Product categories (array of strings)
  products TEXT[] NOT NULL DEFAULT '{}',

  -- Pricing structure (JSONB)
  -- {
  --   "minimumOrder": 1000,
  --   "currency": "USD",
  --   "discountTiers": [
  --     {"minQuantity": 100, "discountPct": 5},
  --     {"minQuantity": 500, "discountPct": 10}
  --   ],
  --   "paymentTerms": "NET30"
  -- }
  pricing JSONB NOT NULL DEFAULT '{}',

  -- Operational capacity (JSONB)
  -- {
  --   "monthlyVolume": 10000,
  --   "leadTime": 7,
  --   "locations": ["Los Angeles", "Chicago", "Atlanta"]
  -- }
  capacity JSONB NOT NULL DEFAULT '{}',

  -- Certifications (array of strings)
  certifications TEXT[] DEFAULT '{}',

  -- Fulfillment details
  lead_time INTEGER NOT NULL DEFAULT 7, -- Standard lead time in days
  minimum_order DECIMAL(20,2) NOT NULL DEFAULT 0,

  -- Additional capabilities
  drop_ship_capable BOOLEAN DEFAULT FALSE,
  white_label_capable BOOLEAN DEFAULT FALSE,

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'active', 'paused', 'rejected'
  )),
  onboarded_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_products ON suppliers USING GIN(products);
CREATE INDEX IF NOT EXISTS idx_suppliers_certifications ON suppliers USING GIN(certifications);
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(contact_email);

-- RFQ (Request for Quote) tracking
CREATE TABLE IF NOT EXISTS rfqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Request details
  category VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  target_price DECIMAL(20,2),
  urgency VARCHAR(20) DEFAULT 'standard' CHECK (urgency IN (
    'standard', 'urgent', 'critical'
  )),
  delivery_location VARCHAR(255) NOT NULL,
  required_certifications TEXT[] DEFAULT '{}',
  additional_requirements TEXT,

  -- Requestor
  requestor_email VARCHAR(255),
  requestor_name VARCHAR(255),

  -- Status
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN (
    'open', 'matched', 'quoted', 'awarded', 'closed', 'cancelled'
  )),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfqs_status ON rfqs(status);
CREATE INDEX IF NOT EXISTS idx_rfqs_category ON rfqs(category);
CREATE INDEX IF NOT EXISTS idx_rfqs_created ON rfqs(created_at DESC);

-- Supplier matches for RFQs
CREATE TABLE IF NOT EXISTS supplier_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- AI-generated matching data
  match_score INTEGER NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  reasoning TEXT NOT NULL,
  strengths TEXT[] DEFAULT '{}',
  concerns TEXT[] DEFAULT '{}',

  -- Estimates
  estimated_price DECIMAL(20,2),
  estimated_lead_time INTEGER,

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'contacted', 'quoted', 'selected', 'rejected'
  )),

  -- Actual quote (if received)
  quoted_price DECIMAL(20,2),
  quoted_lead_time INTEGER,
  quote_received_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (rfq_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_rfq ON supplier_matches(rfq_id);
CREATE INDEX IF NOT EXISTS idx_matches_supplier ON supplier_matches(supplier_id);
CREATE INDEX IF NOT EXISTS idx_matches_score ON supplier_matches(match_score DESC);

-- ============================================================================
-- SEED DATA: Real-looking suppliers
-- ============================================================================

-- 1. Industrial Motors Supplier
INSERT INTO suppliers (
  company_name,
  contact_email,
  phone,
  website,
  products,
  pricing,
  capacity,
  certifications,
  lead_time,
  minimum_order,
  drop_ship_capable,
  white_label_capable,
  status,
  onboarded_at
) VALUES (
  'Midwest Motor Supply Co.',
  'sales@midwestmotors.com',
  '+1-312-555-0142',
  'https://midwestmotors.com',
  ARRAY['industrial motors', 'electric motors', 'motor parts', 'industrial equipment'],
  '{"minimumOrder": 500, "currency": "USD", "paymentTerms": "NET30", "discountTiers": [{"minQuantity": 50, "discountPct": 8}, {"minQuantity": 200, "discountPct": 15}]}'::jsonb,
  '{"monthlyVolume": 5000, "leadTime": 5, "locations": ["Chicago", "Detroit", "Milwaukee"]}'::jsonb,
  ARRAY['ISO9001', 'UL Listed', 'CSA Certified'],
  5,
  500.00,
  true,
  false,
  'active',
  NOW() - INTERVAL '90 days'
) ON CONFLICT DO NOTHING;

-- 2. Bearings Specialist
INSERT INTO suppliers (
  company_name,
  contact_email,
  phone,
  website,
  products,
  pricing,
  capacity,
  certifications,
  lead_time,
  minimum_order,
  drop_ship_capable,
  white_label_capable,
  status,
  onboarded_at
) VALUES (
  'Precision Bearing Solutions',
  'orders@precisionbearing.com',
  '+1-216-555-0198',
  'https://precisionbearing.com',
  ARRAY['bearings', 'roller bearings', 'ball bearings', 'industrial bearings', 'automotive parts'],
  '{"minimumOrder": 250, "currency": "USD", "paymentTerms": "NET45", "discountTiers": [{"minQuantity": 100, "discountPct": 5}, {"minQuantity": 500, "discountPct": 12}]}'::jsonb,
  '{"monthlyVolume": 15000, "leadTime": 3, "locations": ["Cleveland", "Pittsburgh", "Columbus"]}'::jsonb,
  ARRAY['ISO9001', 'ISO14001', 'IATF16949'],
  3,
  250.00,
  true,
  true,
  'active',
  NOW() - INTERVAL '120 days'
) ON CONFLICT DO NOTHING;

-- 3. Electronics Component Distributor
INSERT INTO suppliers (
  company_name,
  contact_email,
  phone,
  website,
  products,
  pricing,
  capacity,
  certifications,
  lead_time,
  minimum_order,
  drop_ship_capable,
  white_label_capable,
  status,
  onboarded_at
) VALUES (
  'TechSource Electronics',
  'procurement@techsource.com',
  '+1-408-555-0287',
  'https://techsource.com',
  ARRAY['electronics', 'semiconductors', 'circuit boards', 'electronic components', 'sensors'],
  '{"minimumOrder": 1000, "currency": "USD", "paymentTerms": "NET30", "discountTiers": [{"minQuantity": 1000, "discountPct": 10}, {"minQuantity": 5000, "discountPct": 18}]}'::jsonb,
  '{"monthlyVolume": 50000, "leadTime": 7, "locations": ["San Jose", "Austin", "Shenzhen"]}'::jsonb,
  ARRAY['ISO9001', 'RoHS Compliant', 'ESD Certified'],
  7,
  1000.00,
  true,
  false,
  'active',
  NOW() - INTERVAL '60 days'
) ON CONFLICT DO NOTHING;

-- 4. General Industrial Supplies
INSERT INTO suppliers (
  company_name,
  contact_email,
  phone,
  website,
  products,
  pricing,
  capacity,
  certifications,
  lead_time,
  minimum_order,
  drop_ship_capable,
  white_label_capable,
  status,
  onboarded_at
) VALUES (
  'Atlas Industrial Supply',
  'sales@atlasindustrial.com',
  '+1-713-555-0334',
  'https://atlasindustrial.com',
  ARRAY['industrial supplies', 'MRO', 'safety equipment', 'tools', 'fasteners', 'adhesives'],
  '{"minimumOrder": 150, "currency": "USD", "paymentTerms": "NET30", "discountTiers": [{"minQuantity": 25, "discountPct": 5}, {"minQuantity": 100, "discountPct": 10}, {"minQuantity": 500, "discountPct": 15}]}'::jsonb,
  '{"monthlyVolume": 20000, "leadTime": 2, "locations": ["Houston", "Dallas", "Atlanta", "Phoenix"]}'::jsonb,
  ARRAY['ISO9001', 'OSHA Compliant'],
  2,
  150.00,
  true,
  true,
  'active',
  NOW() - INTERVAL '180 days'
) ON CONFLICT DO NOTHING;

-- 5. Specialized Electronics Manufacturer
INSERT INTO suppliers (
  company_name,
  contact_email,
  phone,
  website,
  products,
  pricing,
  capacity,
  certifications,
  lead_time,
  minimum_order,
  drop_ship_capable,
  white_label_capable,
  status,
  onboarded_at
) VALUES (
  'Quantum Electronics Manufacturing',
  'bizdev@quantumelectronics.com',
  '+1-617-555-0423',
  'https://quantumelectronics.com',
  ARRAY['electronics', 'custom PCBs', 'embedded systems', 'IoT devices', 'sensors', 'controls'],
  '{"minimumOrder": 2500, "currency": "USD", "paymentTerms": "NET60", "discountTiers": [{"minQuantity": 500, "discountPct": 8}, {"minQuantity": 2000, "discountPct": 15}, {"minQuantity": 10000, "discountPct": 22}]}'::jsonb,
  '{"monthlyVolume": 25000, "leadTime": 14, "locations": ["Boston", "Raleigh", "Denver"]}'::jsonb,
  ARRAY['ISO9001', 'ISO13485', 'IPC-A-610', 'RoHS Compliant', 'UL Listed'],
  14,
  2500.00,
  false,
  true,
  'active',
  NOW() - INTERVAL '45 days'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active suppliers summary
CREATE OR REPLACE VIEW active_suppliers_summary AS
SELECT
  status,
  COUNT(*) as supplier_count,
  ARRAY_AGG(DISTINCT unnest(products)) as all_products,
  AVG(lead_time) as avg_lead_time,
  MIN(minimum_order) as min_order_value,
  MAX(minimum_order) as max_order_value
FROM suppliers
GROUP BY status;

-- Supplier performance view
CREATE OR REPLACE VIEW supplier_performance AS
SELECT
  s.id,
  s.company_name,
  s.status,
  s.products,
  s.lead_time,
  s.minimum_order,
  COUNT(DISTINCT sm.rfq_id) as rfq_matches,
  AVG(sm.match_score) as avg_match_score,
  COUNT(DISTINCT CASE WHEN sm.status = 'selected' THEN sm.rfq_id END) as wins,
  s.onboarded_at,
  s.created_at
FROM suppliers s
LEFT JOIN supplier_matches sm ON s.id = sm.supplier_id
GROUP BY s.id;

-- RFQ status overview
CREATE OR REPLACE VIEW rfq_status_overview AS
SELECT
  r.id,
  r.category,
  r.description,
  r.quantity,
  r.urgency,
  r.status,
  COUNT(sm.id) as supplier_matches,
  MAX(sm.match_score) as best_match_score,
  MIN(sm.quoted_price) as lowest_quote,
  r.created_at
FROM rfqs r
LEFT JOIN supplier_matches sm ON r.id = sm.rfq_id
GROUP BY r.id;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE suppliers IS 'Supplier onboarding and capability tracking';
COMMENT ON TABLE rfqs IS 'Request for Quotes from customers';
COMMENT ON TABLE supplier_matches IS 'AI-powered matching of suppliers to RFQs';

COMMENT ON COLUMN suppliers.pricing IS 'Pricing structure including minimum order, payment terms, and discount tiers';
COMMENT ON COLUMN suppliers.capacity IS 'Operational capacity including monthly volume and service locations';
COMMENT ON COLUMN supplier_matches.match_score IS 'AI-generated match score (0-100) based on requirements analysis';
