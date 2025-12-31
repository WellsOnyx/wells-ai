-- ============================================================================
-- WELLS AI - PARTNER REFERRAL SYSTEM SCHEMA
-- ============================================================================
-- Complete partner/affiliate system with:
-- - Partner tiers and commission structures
-- - Referral tracking and attribution
-- - Commission calculation and payouts
-- - Performance analytics

-- ============================================================================
-- PARTNERS (Affiliates, Resellers, Agencies)
-- ============================================================================

CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,          -- Clerk user ID

  -- Partner Info
  name TEXT NOT NULL,
  company_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,

  -- Partner Type
  partner_type TEXT NOT NULL DEFAULT 'affiliate',  -- affiliate, reseller, agency, strategic
  tier TEXT NOT NULL DEFAULT 'starter',            -- starter, bronze, silver, gold, platinum, elite

  -- Referral Code
  referral_code TEXT UNIQUE NOT NULL,     -- e.g., "PARTNER123"
  custom_link TEXT,                       -- Custom vanity URL slug

  -- Commission Structure
  commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.10,  -- Base rate (10%)
  commission_type TEXT NOT NULL DEFAULT 'percentage', -- percentage, flat, hybrid
  flat_commission DECIMAL(10,2),          -- If flat or hybrid
  recurring_commission BOOLEAN DEFAULT TRUE,
  recurring_months INTEGER DEFAULT 12,    -- How long to pay recurring

  -- Payment Info
  payment_method TEXT DEFAULT 'bank',     -- bank, paypal, crypto, check
  payment_email TEXT,
  bank_account_id TEXT,                   -- Stripe connected account or bank details
  crypto_wallet TEXT,
  minimum_payout DECIMAL(10,2) DEFAULT 100.00,

  -- Stats (denormalized for performance)
  total_referrals INTEGER DEFAULT 0,
  active_referrals INTEGER DEFAULT 0,
  total_revenue_generated DECIMAL(20,2) DEFAULT 0,
  total_commissions_earned DECIMAL(20,2) DEFAULT 0,
  total_commissions_paid DECIMAL(20,2) DEFAULT 0,
  pending_commission DECIMAL(20,2) DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, suspended, terminated
  approved_at TIMESTAMP,
  approved_by TEXT,

  -- Metadata
  notes TEXT,
  tags TEXT[],
  metadata JSONB,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_partners_user ON partners(user_id);
CREATE INDEX idx_partners_code ON partners(referral_code);
CREATE INDEX idx_partners_type ON partners(partner_type);
CREATE INDEX idx_partners_tier ON partners(tier);
CREATE INDEX idx_partners_status ON partners(status);

-- ============================================================================
-- PARTNER TIERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS partner_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  min_referrals INTEGER DEFAULT 0,
  min_revenue DECIMAL(20,2) DEFAULT 0,

  -- Commission Rates
  base_commission_rate DECIMAL(5,4) NOT NULL,
  bonus_commission_rate DECIMAL(5,4) DEFAULT 0,

  -- Benefits
  dedicated_support BOOLEAN DEFAULT FALSE,
  custom_landing_pages BOOLEAN DEFAULT FALSE,
  api_access BOOLEAN DEFAULT FALSE,
  white_label BOOLEAN DEFAULT FALSE,
  co_marketing BOOLEAN DEFAULT FALSE,
  early_access BOOLEAN DEFAULT FALSE,

  -- Visual
  color TEXT,
  badge_url TEXT,

  display_order INTEGER DEFAULT 0
);

INSERT INTO partner_tiers (id, name, min_referrals, min_revenue, base_commission_rate, bonus_commission_rate, dedicated_support, custom_landing_pages, api_access, color, display_order) VALUES
('starter', 'Starter', 0, 0, 0.10, 0, FALSE, FALSE, FALSE, '#6B7280', 0),
('bronze', 'Bronze', 5, 5000, 0.12, 0.02, FALSE, FALSE, FALSE, '#CD7F32', 1),
('silver', 'Silver', 20, 25000, 0.15, 0.03, FALSE, TRUE, FALSE, '#C0C0C0', 2),
('gold', 'Gold', 50, 100000, 0.18, 0.05, TRUE, TRUE, TRUE, '#FFD700', 3),
('platinum', 'Platinum', 100, 500000, 0.22, 0.08, TRUE, TRUE, TRUE, '#E5E4E2', 4),
('elite', 'Elite', 250, 1000000, 0.30, 0.10, TRUE, TRUE, TRUE, '#9333EA', 5)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- REFERRALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,

  -- Referred User
  referred_user_id TEXT NOT NULL,
  referred_email TEXT,
  referred_name TEXT,

  -- Attribution
  referral_code TEXT NOT NULL,
  landing_page TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  ip_address TEXT,
  user_agent TEXT,

  -- Conversion Tracking
  clicked_at TIMESTAMP,
  signed_up_at TIMESTAMP,
  first_purchase_at TIMESTAMP,
  qualified_at TIMESTAMP,              -- When they became commission-eligible

  -- Status
  status TEXT NOT NULL DEFAULT 'clicked', -- clicked, signed_up, qualified, active, churned, refunded

  -- Revenue Tracking
  total_revenue DECIMAL(20,2) DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_referrals_partner ON referrals(partner_id);
CREATE INDEX idx_referrals_user ON referrals(referred_user_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_created ON referrals(created_at DESC);

-- ============================================================================
-- COMMISSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,

  -- Transaction that triggered commission
  transaction_id TEXT,
  transaction_type TEXT NOT NULL,       -- signup, purchase, subscription, renewal
  transaction_amount DECIMAL(20,2) NOT NULL,
  transaction_date TIMESTAMP NOT NULL,

  -- Commission Calculation
  commission_rate DECIMAL(5,4) NOT NULL,
  commission_type TEXT NOT NULL,        -- percentage, flat, bonus
  commission_amount DECIMAL(20,2) NOT NULL,

  -- Recurring
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_month INTEGER,              -- Which month of recurring (1, 2, 3...)

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, paid, cancelled, refunded
  approved_at TIMESTAMP,
  approved_by TEXT,

  -- Payout
  payout_id UUID,                       -- Links to payouts table
  paid_at TIMESTAMP,

  -- Metadata
  notes TEXT,
  metadata JSONB,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_commissions_partner ON commissions(partner_id);
CREATE INDEX idx_commissions_referral ON commissions(referral_id);
CREATE INDEX idx_commissions_status ON commissions(status);
CREATE INDEX idx_commissions_created ON commissions(created_at DESC);
CREATE INDEX idx_commissions_payout ON commissions(payout_id);

-- ============================================================================
-- PAYOUTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS partner_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,

  -- Payout Details
  amount DECIMAL(20,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  payment_method TEXT NOT NULL,

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  commission_count INTEGER NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  processed_at TIMESTAMP,
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  failure_reason TEXT,

  -- Payment Reference
  payment_reference TEXT,               -- Stripe payout ID, PayPal transaction, etc.
  payment_details JSONB,

  -- Metadata
  notes TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payouts_partner ON partner_payouts(partner_id);
CREATE INDEX idx_payouts_status ON partner_payouts(status);
CREATE INDEX idx_payouts_created ON partner_payouts(created_at DESC);

-- ============================================================================
-- REFERRAL CLICKS (For attribution tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS referral_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,

  -- Click Details
  ip_address TEXT,
  user_agent TEXT,
  referer TEXT,
  landing_page TEXT,

  -- UTM Parameters
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,

  -- Conversion
  converted BOOLEAN DEFAULT FALSE,
  referral_id UUID REFERENCES referrals(id),

  clicked_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_clicks_partner ON referral_clicks(partner_id);
CREATE INDEX idx_clicks_code ON referral_clicks(referral_code);
CREATE INDEX idx_clicks_date ON referral_clicks(clicked_at DESC);

-- ============================================================================
-- PARTNER LINKS (Custom tracking links)
-- ============================================================================

CREATE TABLE IF NOT EXISTS partner_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,

  -- Link Details
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,            -- Custom URL slug
  destination_url TEXT NOT NULL,        -- Where to redirect

  -- UTM Override
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  -- Stats
  click_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_partner_links_partner ON partner_links(partner_id);
CREATE INDEX idx_partner_links_slug ON partner_links(slug);

-- ============================================================================
-- PARTNER RESOURCES (Marketing materials, assets)
-- ============================================================================

CREATE TABLE IF NOT EXISTS partner_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Resource Details
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,               -- banner, email_template, landing_page, video, guide
  file_url TEXT,
  thumbnail_url TEXT,

  -- Dimensions (for banners)
  width INTEGER,
  height INTEGER,

  -- Access
  min_tier TEXT DEFAULT 'starter',
  is_public BOOLEAN DEFAULT TRUE,

  -- Stats
  download_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_resources_category ON partner_resources(category);
CREATE INDEX idx_resources_tier ON partner_resources(min_tier);

-- ============================================================================
-- PARTNER APPLICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS partner_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,

  -- Applicant Info
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  website TEXT,

  -- Application Details
  partner_type TEXT NOT NULL,
  audience_size TEXT,                   -- e.g., "10K-50K", "100K+"
  audience_description TEXT,
  promotion_methods TEXT[],             -- blog, email, social, paid_ads, etc.
  monthly_traffic INTEGER,
  existing_partnerships TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, reviewing, approved, rejected
  reviewed_at TIMESTAMP,
  reviewed_by TEXT,
  rejection_reason TEXT,

  -- If approved, links to partner
  partner_id UUID REFERENCES partners(id),

  -- Metadata
  notes TEXT,
  metadata JSONB,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_applications_status ON partner_applications(status);
CREATE INDEX idx_applications_email ON partner_applications(email);
CREATE INDEX idx_applications_created ON partner_applications(created_at DESC);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Partner dashboard summary
CREATE OR REPLACE VIEW v_partner_dashboard AS
SELECT
  p.id,
  p.user_id,
  p.name,
  p.company_name,
  p.partner_type,
  p.tier,
  pt.name as tier_name,
  p.referral_code,
  p.commission_rate,
  p.total_referrals,
  p.active_referrals,
  p.total_revenue_generated,
  p.total_commissions_earned,
  p.total_commissions_paid,
  p.pending_commission,
  p.status,
  -- Calculate conversion rate
  CASE
    WHEN (SELECT COUNT(*) FROM referral_clicks rc WHERE rc.partner_id = p.id) > 0
    THEN ROUND(100.0 * p.total_referrals / (SELECT COUNT(*) FROM referral_clicks rc WHERE rc.partner_id = p.id), 2)
    ELSE 0
  END as conversion_rate,
  -- Next tier info
  (SELECT pt2.name FROM partner_tiers pt2 WHERE pt2.display_order = pt.display_order + 1) as next_tier,
  (SELECT pt2.min_referrals FROM partner_tiers pt2 WHERE pt2.display_order = pt.display_order + 1) as next_tier_referrals,
  (SELECT pt2.min_revenue FROM partner_tiers pt2 WHERE pt2.display_order = pt.display_order + 1) as next_tier_revenue
FROM partners p
LEFT JOIN partner_tiers pt ON p.tier = pt.id;

-- Referral performance by partner
CREATE OR REPLACE VIEW v_referral_performance AS
SELECT
  p.id as partner_id,
  p.name as partner_name,
  p.referral_code,
  DATE(r.created_at) as date,
  COUNT(*) as clicks,
  COUNT(*) FILTER (WHERE r.status != 'clicked') as signups,
  COUNT(*) FILTER (WHERE r.status IN ('qualified', 'active')) as qualified,
  SUM(r.total_revenue) as revenue
FROM partners p
LEFT JOIN referrals r ON r.partner_id = p.id
GROUP BY p.id, p.name, p.referral_code, DATE(r.created_at);

-- Commission summary by month
CREATE OR REPLACE VIEW v_commission_summary AS
SELECT
  p.id as partner_id,
  p.name as partner_name,
  DATE_TRUNC('month', c.created_at) as month,
  COUNT(*) as commission_count,
  SUM(c.commission_amount) as total_amount,
  SUM(c.commission_amount) FILTER (WHERE c.status = 'pending') as pending_amount,
  SUM(c.commission_amount) FILTER (WHERE c.status = 'approved') as approved_amount,
  SUM(c.commission_amount) FILTER (WHERE c.status = 'paid') as paid_amount
FROM partners p
LEFT JOIN commissions c ON c.partner_id = p.id
GROUP BY p.id, p.name, DATE_TRUNC('month', c.created_at);

-- Top partners leaderboard
CREATE OR REPLACE VIEW v_partner_leaderboard AS
SELECT
  p.id,
  p.name,
  p.company_name,
  p.tier,
  pt.name as tier_name,
  p.total_referrals,
  p.total_revenue_generated,
  p.total_commissions_earned,
  RANK() OVER (ORDER BY p.total_revenue_generated DESC) as revenue_rank,
  RANK() OVER (ORDER BY p.total_referrals DESC) as referral_rank
FROM partners p
LEFT JOIN partner_tiers pt ON p.tier = pt.id
WHERE p.status = 'active'
ORDER BY p.total_revenue_generated DESC;
