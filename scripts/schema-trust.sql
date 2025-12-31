-- ============================================================================
-- WELLS AI - TRUST & REPUTATION SYSTEM SCHEMA
-- ============================================================================
-- Comprehensive trust scoring for all user journeys:
-- Buyers, Sellers, Job Seekers, Founders

-- ============================================================================
-- TRUST PROFILES (Core identity)
-- ============================================================================

CREATE TABLE IF NOT EXISTS trust_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,

  -- Journey type
  primary_journey TEXT NOT NULL, -- buyer, seller, job_seeker, founder

  -- Composite Scores (0-100)
  overall_score DECIMAL(5,2) DEFAULT 50.00,
  reliability_score DECIMAL(5,2) DEFAULT 50.00,
  responsiveness_score DECIMAL(5,2) DEFAULT 50.00,
  quality_score DECIMAL(5,2) DEFAULT 50.00,
  integrity_score DECIMAL(5,2) DEFAULT 50.00,

  -- Trust Tier
  tier TEXT DEFAULT 'new', -- new, bronze, silver, gold, platinum, elite
  tier_updated_at TIMESTAMP,

  -- Verification Status
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  identity_verified BOOLEAN DEFAULT FALSE,
  business_verified BOOLEAN DEFAULT FALSE,
  bank_verified BOOLEAN DEFAULT FALSE,

  -- Activity Metrics
  total_transactions INTEGER DEFAULT 0,
  successful_transactions INTEGER DEFAULT 0,
  disputed_transactions INTEGER DEFAULT 0,
  total_volume DECIMAL(20,2) DEFAULT 0,

  -- Timing Metrics
  avg_response_time_hours DECIMAL(10,2),
  avg_completion_time_hours DECIMAL(10,2),
  on_time_rate DECIMAL(5,4) DEFAULT 1.0,

  -- Social Proof
  endorsement_count INTEGER DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  avg_review_rating DECIMAL(3,2),

  -- Risk Indicators
  warning_count INTEGER DEFAULT 0,
  suspension_count INTEGER DEFAULT 0,
  last_warning_at TIMESTAMP,
  is_suspended BOOLEAN DEFAULT FALSE,
  suspended_until TIMESTAMP,

  -- Timestamps
  first_activity_at TIMESTAMP,
  last_activity_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_trust_profiles_user ON trust_profiles(user_id);
CREATE INDEX idx_trust_profiles_tier ON trust_profiles(tier);
CREATE INDEX idx_trust_profiles_score ON trust_profiles(overall_score DESC);
CREATE INDEX idx_trust_profiles_journey ON trust_profiles(primary_journey);

-- ============================================================================
-- TRUST EVENTS (Individual actions that affect trust)
-- ============================================================================

CREATE TABLE IF NOT EXISTS trust_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Event Details
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL, -- transaction, communication, verification, behavior, review

  -- Impact
  score_impact DECIMAL(6,2) NOT NULL, -- Positive or negative
  reliability_impact DECIMAL(6,2) DEFAULT 0,
  responsiveness_impact DECIMAL(6,2) DEFAULT 0,
  quality_impact DECIMAL(6,2) DEFAULT 0,
  integrity_impact DECIMAL(6,2) DEFAULT 0,

  -- Context
  related_entity_type TEXT, -- rfq, transaction, negotiation, job, etc.
  related_entity_id UUID,
  counterparty_id TEXT,

  -- Details
  description TEXT,
  metadata JSONB,

  -- Decay
  decay_rate DECIMAL(5,4) DEFAULT 0.01, -- How fast impact fades (per day)
  expires_at TIMESTAMP, -- When event stops affecting score

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_trust_events_user ON trust_events(user_id);
CREATE INDEX idx_trust_events_type ON trust_events(event_type);
CREATE INDEX idx_trust_events_category ON trust_events(event_category);
CREATE INDEX idx_trust_events_created ON trust_events(created_at DESC);

-- ============================================================================
-- TRUST EVENT TYPES (Definitions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS trust_event_types (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Default impacts
  base_score_impact DECIMAL(6,2) NOT NULL,
  reliability_weight DECIMAL(3,2) DEFAULT 0,
  responsiveness_weight DECIMAL(3,2) DEFAULT 0,
  quality_weight DECIMAL(3,2) DEFAULT 0,
  integrity_weight DECIMAL(3,2) DEFAULT 0,

  -- Decay settings
  default_decay_rate DECIMAL(5,4) DEFAULT 0.01,
  default_ttl_days INTEGER DEFAULT 365,

  -- Applicability
  applies_to_journeys TEXT[], -- buyer, seller, job_seeker, founder

  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed event types
INSERT INTO trust_event_types (id, category, name, description, base_score_impact, reliability_weight, responsiveness_weight, quality_weight, integrity_weight, applies_to_journeys) VALUES
-- Transaction Events
('transaction_completed', 'transaction', 'Transaction Completed', 'Successfully completed a transaction', 5.0, 0.4, 0.2, 0.2, 0.2, ARRAY['buyer', 'seller']),
('transaction_on_time', 'transaction', 'On-Time Delivery', 'Delivered/paid on or before deadline', 3.0, 0.6, 0.2, 0.1, 0.1, ARRAY['buyer', 'seller']),
('transaction_late', 'transaction', 'Late Delivery', 'Delivered/paid after deadline', -5.0, 0.7, 0.2, 0.0, 0.1, ARRAY['buyer', 'seller']),
('transaction_cancelled', 'transaction', 'Transaction Cancelled', 'Cancelled after commitment', -8.0, 0.5, 0.1, 0.1, 0.3, ARRAY['buyer', 'seller']),
('transaction_disputed', 'transaction', 'Transaction Disputed', 'Dispute raised', -3.0, 0.2, 0.1, 0.3, 0.4, ARRAY['buyer', 'seller']),
('dispute_resolved_favor', 'transaction', 'Dispute Won', 'Dispute resolved in your favor', 2.0, 0.1, 0.1, 0.4, 0.4, ARRAY['buyer', 'seller']),
('dispute_resolved_against', 'transaction', 'Dispute Lost', 'Dispute resolved against you', -10.0, 0.2, 0.1, 0.3, 0.4, ARRAY['buyer', 'seller']),

-- Communication Events
('response_fast', 'communication', 'Fast Response', 'Responded within 1 hour', 1.0, 0.1, 0.8, 0.0, 0.1, ARRAY['buyer', 'seller', 'job_seeker', 'founder']),
('response_same_day', 'communication', 'Same-Day Response', 'Responded within 24 hours', 0.5, 0.1, 0.7, 0.1, 0.1, ARRAY['buyer', 'seller', 'job_seeker', 'founder']),
('response_slow', 'communication', 'Slow Response', 'Took more than 48 hours to respond', -2.0, 0.1, 0.8, 0.0, 0.1, ARRAY['buyer', 'seller', 'job_seeker', 'founder']),
('no_response', 'communication', 'No Response', 'Never responded to inquiry', -5.0, 0.3, 0.5, 0.0, 0.2, ARRAY['buyer', 'seller', 'job_seeker', 'founder']),

-- Verification Events
('email_verified', 'verification', 'Email Verified', 'Verified email address', 3.0, 0.1, 0.1, 0.1, 0.7, ARRAY['buyer', 'seller', 'job_seeker', 'founder']),
('phone_verified', 'verification', 'Phone Verified', 'Verified phone number', 5.0, 0.1, 0.1, 0.1, 0.7, ARRAY['buyer', 'seller', 'job_seeker', 'founder']),
('identity_verified', 'verification', 'Identity Verified', 'Passed identity verification', 10.0, 0.1, 0.1, 0.1, 0.7, ARRAY['buyer', 'seller', 'job_seeker', 'founder']),
('business_verified', 'verification', 'Business Verified', 'Business credentials verified', 15.0, 0.2, 0.1, 0.2, 0.5, ARRAY['seller', 'founder']),
('bank_verified', 'verification', 'Bank Verified', 'Bank account verified', 8.0, 0.1, 0.1, 0.1, 0.7, ARRAY['buyer', 'seller', 'founder']),

-- Review Events
('review_5_star', 'review', '5-Star Review', 'Received a 5-star review', 8.0, 0.2, 0.2, 0.4, 0.2, ARRAY['buyer', 'seller', 'job_seeker']),
('review_4_star', 'review', '4-Star Review', 'Received a 4-star review', 4.0, 0.2, 0.2, 0.4, 0.2, ARRAY['buyer', 'seller', 'job_seeker']),
('review_3_star', 'review', '3-Star Review', 'Received a 3-star review', 0.0, 0.2, 0.2, 0.4, 0.2, ARRAY['buyer', 'seller', 'job_seeker']),
('review_2_star', 'review', '2-Star Review', 'Received a 2-star review', -5.0, 0.2, 0.2, 0.4, 0.2, ARRAY['buyer', 'seller', 'job_seeker']),
('review_1_star', 'review', '1-Star Review', 'Received a 1-star review', -10.0, 0.2, 0.2, 0.4, 0.2, ARRAY['buyer', 'seller', 'job_seeker']),

-- Behavior Events
('profile_complete', 'behavior', 'Profile Complete', 'Completed profile 100%', 5.0, 0.1, 0.1, 0.3, 0.5, ARRAY['buyer', 'seller', 'job_seeker', 'founder']),
('endorsement_given', 'behavior', 'Gave Endorsement', 'Endorsed another user', 1.0, 0.1, 0.1, 0.1, 0.7, ARRAY['buyer', 'seller', 'job_seeker', 'founder']),
('endorsement_received', 'behavior', 'Received Endorsement', 'Received endorsement from verified user', 3.0, 0.2, 0.1, 0.3, 0.4, ARRAY['buyer', 'seller', 'job_seeker', 'founder']),
('referral_success', 'behavior', 'Successful Referral', 'Referred user who completed transaction', 5.0, 0.1, 0.1, 0.1, 0.7, ARRAY['buyer', 'seller', 'job_seeker', 'founder']),
('warning_issued', 'behavior', 'Warning Issued', 'Received a warning for policy violation', -15.0, 0.2, 0.1, 0.2, 0.5, ARRAY['buyer', 'seller', 'job_seeker', 'founder']),
('suspension', 'behavior', 'Account Suspended', 'Account was temporarily suspended', -30.0, 0.2, 0.1, 0.2, 0.5, ARRAY['buyer', 'seller', 'job_seeker', 'founder']),

-- Job Seeker Specific
('interview_completed', 'transaction', 'Interview Completed', 'Completed scheduled interview', 3.0, 0.3, 0.4, 0.2, 0.1, ARRAY['job_seeker']),
('interview_no_show', 'transaction', 'Interview No-Show', 'Missed scheduled interview', -15.0, 0.4, 0.3, 0.1, 0.2, ARRAY['job_seeker']),
('offer_accepted', 'transaction', 'Offer Accepted', 'Accepted job offer', 10.0, 0.4, 0.2, 0.2, 0.2, ARRAY['job_seeker']),
('offer_declined_late', 'transaction', 'Late Offer Decline', 'Declined offer after long delay', -5.0, 0.4, 0.3, 0.1, 0.2, ARRAY['job_seeker']),
('job_started', 'transaction', 'Job Started', 'Started new position', 15.0, 0.4, 0.2, 0.2, 0.2, ARRAY['job_seeker']),
('job_abandoned', 'transaction', 'Job Abandoned', 'Left position without notice', -25.0, 0.3, 0.2, 0.2, 0.3, ARRAY['job_seeker']),

-- Founder Specific
('funding_received', 'transaction', 'Funding Received', 'Successfully raised funding', 10.0, 0.3, 0.2, 0.3, 0.2, ARRAY['founder']),
('milestone_hit', 'transaction', 'Milestone Achieved', 'Hit a reported milestone', 5.0, 0.3, 0.2, 0.3, 0.2, ARRAY['founder']),
('investor_update', 'communication', 'Investor Update Sent', 'Sent regular investor update', 2.0, 0.2, 0.4, 0.2, 0.2, ARRAY['founder'])

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ENDORSEMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS trust_endorsements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endorser_id TEXT NOT NULL,
  endorsee_id TEXT NOT NULL,

  -- Endorsement Details
  relationship TEXT NOT NULL, -- worked_together, transacted, collaborated, knows_personally
  skills TEXT[],
  message TEXT,

  -- Weight (based on endorser's trust)
  weight DECIMAL(5,4) DEFAULT 1.0,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(endorser_id, endorsee_id)
);

CREATE INDEX idx_endorsements_endorsee ON trust_endorsements(endorsee_id);
CREATE INDEX idx_endorsements_endorser ON trust_endorsements(endorser_id);

-- ============================================================================
-- REVIEWS
-- ============================================================================

CREATE TABLE IF NOT EXISTS trust_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id TEXT NOT NULL,
  reviewee_id TEXT NOT NULL,

  -- Transaction Context
  transaction_type TEXT, -- rfq, negotiation, job, contract
  transaction_id UUID,

  -- Ratings (1-5)
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  reliability_rating INTEGER CHECK (reliability_rating >= 1 AND reliability_rating <= 5),
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),

  -- Content
  title TEXT,
  content TEXT,

  -- Response
  response TEXT,
  responded_at TIMESTAMP,

  -- Moderation
  is_visible BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE, -- Verified purchase/transaction
  flagged BOOLEAN DEFAULT FALSE,
  flagged_reason TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reviews_reviewee ON trust_reviews(reviewee_id);
CREATE INDEX idx_reviews_reviewer ON trust_reviews(reviewer_id);
CREATE INDEX idx_reviews_rating ON trust_reviews(overall_rating);

-- ============================================================================
-- TRUST SCORE HISTORY (For tracking changes over time)
-- ============================================================================

CREATE TABLE IF NOT EXISTS trust_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Scores at this point
  overall_score DECIMAL(5,2) NOT NULL,
  reliability_score DECIMAL(5,2),
  responsiveness_score DECIMAL(5,2),
  quality_score DECIMAL(5,2),
  integrity_score DECIMAL(5,2),

  -- Tier at this point
  tier TEXT,

  -- What triggered this snapshot
  trigger_event_id UUID REFERENCES trust_events(id),
  trigger_reason TEXT,

  recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_score_history_user ON trust_score_history(user_id);
CREATE INDEX idx_score_history_date ON trust_score_history(recorded_at DESC);

-- ============================================================================
-- TIER THRESHOLDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS trust_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  min_score DECIMAL(5,2) NOT NULL,
  min_transactions INTEGER DEFAULT 0,
  min_tenure_days INTEGER DEFAULT 0,

  -- Benefits
  benefits JSONB,

  -- Visual
  color TEXT,
  icon TEXT,
  badge_url TEXT,

  display_order INTEGER DEFAULT 0
);

INSERT INTO trust_tiers (id, name, min_score, min_transactions, min_tenure_days, color, display_order) VALUES
('new', 'New', 0, 0, 0, '#6B7280', 0),
('bronze', 'Bronze', 40, 1, 7, '#CD7F32', 1),
('silver', 'Silver', 60, 5, 30, '#C0C0C0', 2),
('gold', 'Gold', 75, 15, 90, '#FFD700', 3),
('platinum', 'Platinum', 88, 50, 180, '#E5E4E2', 4),
('elite', 'Elite', 95, 100, 365, '#9333EA', 5)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- User trust summary
CREATE OR REPLACE VIEW v_trust_summary AS
SELECT
  tp.user_id,
  tp.primary_journey,
  tp.overall_score,
  tp.tier,
  tt.name as tier_name,
  tt.color as tier_color,
  tp.total_transactions,
  tp.successful_transactions,
  CASE
    WHEN tp.total_transactions > 0
    THEN ROUND(100.0 * tp.successful_transactions / tp.total_transactions, 1)
    ELSE 100
  END as success_rate,
  tp.review_count,
  tp.avg_review_rating,
  tp.endorsement_count,
  tp.email_verified,
  tp.phone_verified,
  tp.identity_verified,
  tp.business_verified,
  tp.is_suspended,
  tp.last_activity_at
FROM trust_profiles tp
LEFT JOIN trust_tiers tt ON tp.tier = tt.id;

-- Recent trust events
CREATE OR REPLACE VIEW v_recent_trust_events AS
SELECT
  te.user_id,
  te.event_type,
  tet.name as event_name,
  te.event_category,
  te.score_impact,
  te.description,
  te.created_at,
  DATE_PART('day', NOW() - te.created_at) as days_ago
FROM trust_events te
LEFT JOIN trust_event_types tet ON te.event_type = tet.id
WHERE te.created_at > NOW() - INTERVAL '30 days'
ORDER BY te.created_at DESC;

-- Leaderboard
CREATE OR REPLACE VIEW v_trust_leaderboard AS
SELECT
  tp.user_id,
  tp.primary_journey,
  tp.overall_score,
  tp.tier,
  tt.name as tier_name,
  tp.total_transactions,
  tp.endorsement_count,
  RANK() OVER (PARTITION BY tp.primary_journey ORDER BY tp.overall_score DESC) as journey_rank,
  RANK() OVER (ORDER BY tp.overall_score DESC) as overall_rank
FROM trust_profiles tp
LEFT JOIN trust_tiers tt ON tp.tier = tt.id
WHERE tp.is_suspended = FALSE
  AND tp.total_transactions > 0;
