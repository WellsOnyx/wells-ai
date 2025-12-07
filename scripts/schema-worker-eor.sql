-- ============================================
-- WELLS AI WORKER EOR (EMPLOYER OF RECORD) SCHEMA
-- ============================================
-- Workers work THROUGH Wells, get PAID through Wells
-- The post-AI workforce infrastructure
-- ============================================

-- ============================================
-- WORKERS
-- ============================================

-- Worker profiles
CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),

  -- Profile
  headline VARCHAR(500),
  bio TEXT,
  skills JSONB DEFAULT '[]',
  experience_years INTEGER,
  timezone VARCHAR(100),
  country VARCHAR(100),
  city VARCHAR(255),

  -- Work preferences
  preferred_rate_min DECIMAL(10,2),
  preferred_rate_max DECIMAL(10,2),
  rate_type VARCHAR(20) DEFAULT 'hourly', -- hourly, daily, project, monthly
  availability VARCHAR(50) DEFAULT 'available', -- available, partially_available, not_available
  work_type VARCHAR(50) DEFAULT 'remote', -- remote, onsite, hybrid

  -- Portfolio/links
  portfolio_url VARCHAR(500),
  linkedin_url VARCHAR(500),
  github_url VARCHAR(500),
  resume_url VARCHAR(500),

  -- Wells integration
  wallet_id UUID REFERENCES treasury_wallets(id),
  grain_balance DECIMAL(18,8) DEFAULT 0,

  -- Verification
  identity_verified BOOLEAN DEFAULT FALSE,
  background_checked BOOLEAN DEFAULT FALSE,
  skills_verified JSONB DEFAULT '[]',

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, active, suspended, churned
  onboarded_at TIMESTAMP,

  -- Metadata
  profile_completeness INTEGER DEFAULT 0,
  tags JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Worker skill assessments
CREATE TABLE IF NOT EXISTS worker_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id),

  skill_name VARCHAR(255) NOT NULL,
  category VARCHAR(100), -- development, design, marketing, sales, etc.
  proficiency_level VARCHAR(50), -- beginner, intermediate, advanced, expert
  years_experience INTEGER,

  -- Verification
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP,
  verified_by VARCHAR(100), -- wells_ai, third_party, client_review
  assessment_score DECIMAL(5,2),

  -- Evidence
  portfolio_items JSONB DEFAULT '[]',
  certifications JSONB DEFAULT '[]',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(worker_id, skill_name)
);

-- ============================================
-- CLIENTS (Companies hiring workers)
-- ============================================

CREATE TABLE IF NOT EXISTS eor_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Company info
  company_name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  industry VARCHAR(100),
  company_size VARCHAR(50),
  website VARCHAR(500),

  -- Contact
  primary_contact_name VARCHAR(255),
  primary_contact_email VARCHAR(255) NOT NULL,
  primary_contact_phone VARCHAR(50),

  -- Billing
  billing_email VARCHAR(255),
  billing_address JSONB DEFAULT '{}',
  payment_terms VARCHAR(50) DEFAULT 'net30',

  -- Wells integration
  customer_id UUID REFERENCES erp_customers(id),
  wallet_id UUID REFERENCES treasury_wallets(id),

  -- Status
  status VARCHAR(50) DEFAULT 'active',
  verified BOOLEAN DEFAULT FALSE,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- PROJECTS
-- ============================================

CREATE TABLE IF NOT EXISTS eor_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Client
  client_id UUID NOT NULL REFERENCES eor_clients(id),

  -- Project details
  title VARCHAR(500) NOT NULL,
  description TEXT,
  requirements TEXT,
  deliverables JSONB DEFAULT '[]',

  -- Type
  project_type VARCHAR(50) DEFAULT 'contract', -- contract, full_time, part_time, project
  work_type VARCHAR(50) DEFAULT 'remote',

  -- Timing
  start_date DATE,
  end_date DATE,
  duration_months INTEGER,
  hours_per_week INTEGER,

  -- Budget
  budget_type VARCHAR(50) DEFAULT 'hourly', -- hourly, fixed, monthly
  budget_min DECIMAL(12,2),
  budget_max DECIMAL(12,2),

  -- Skills required
  required_skills JSONB DEFAULT '[]',
  preferred_skills JSONB DEFAULT '[]',
  experience_required INTEGER, -- years

  -- Location
  timezone_preference VARCHAR(100),
  location_preference VARCHAR(255),

  -- Status
  status VARCHAR(50) DEFAULT 'open', -- draft, open, in_progress, filled, completed, cancelled

  -- AI matching
  ai_match_enabled BOOLEAN DEFAULT TRUE,
  auto_outreach_enabled BOOLEAN DEFAULT TRUE,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- ENGAGEMENTS (Worker <-> Project relationships)
-- ============================================

CREATE TABLE IF NOT EXISTS eor_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parties
  worker_id UUID NOT NULL REFERENCES workers(id),
  project_id UUID NOT NULL REFERENCES eor_projects(id),
  client_id UUID NOT NULL REFERENCES eor_clients(id),

  -- Terms (negotiated by Wells AI)
  rate DECIMAL(12,2) NOT NULL,
  rate_type VARCHAR(50) DEFAULT 'hourly',
  currency VARCHAR(10) DEFAULT 'USD',

  -- Wells fees
  wells_fee_percent DECIMAL(5,2) DEFAULT 5.00, -- 5% platform fee
  client_markup_percent DECIMAL(5,2) DEFAULT 10.00, -- markup on client side

  -- Payment schedule
  payment_frequency VARCHAR(50) DEFAULT 'biweekly', -- weekly, biweekly, monthly, milestone
  payment_terms VARCHAR(50) DEFAULT 'net7', -- how fast we pay the worker

  -- Contract
  contract_id UUID,
  contract_signed_at TIMESTAMP,

  -- Dates
  start_date DATE NOT NULL,
  end_date DATE,

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, active, paused, completed, terminated

  -- Totals (running)
  total_hours DECIMAL(10,2) DEFAULT 0,
  total_earned DECIMAL(12,2) DEFAULT 0,
  total_paid DECIMAL(12,2) DEFAULT 0,
  total_grain_earned DECIMAL(18,8) DEFAULT 0,

  -- Notes
  notes TEXT,
  termination_reason TEXT,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TIME TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS eor_timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  engagement_id UUID NOT NULL REFERENCES eor_engagements(id),
  worker_id UUID NOT NULL REFERENCES workers(id),

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Hours
  total_hours DECIMAL(10,2) DEFAULT 0,
  billable_hours DECIMAL(10,2) DEFAULT 0,

  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- draft, submitted, approved, rejected, paid
  submitted_at TIMESTAMP,
  approved_at TIMESTAMP,
  approved_by VARCHAR(255),
  rejected_reason TEXT,

  -- Line items
  entries JSONB DEFAULT '[]', -- Array of daily entries

  -- Amounts
  subtotal DECIMAL(12,2),
  adjustments DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2),

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- PAYMENTS (To workers from Wells)
-- ============================================

CREATE TABLE IF NOT EXISTS eor_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  worker_id UUID NOT NULL REFERENCES workers(id),
  engagement_id UUID REFERENCES eor_engagements(id),
  timesheet_id UUID REFERENCES eor_timesheets(id),

  -- Type
  payment_type VARCHAR(50) DEFAULT 'timesheet', -- timesheet, milestone, bonus, advance, adjustment

  -- Amount
  gross_amount DECIMAL(12,2) NOT NULL,
  wells_fee DECIMAL(12,2) DEFAULT 0,
  tax_withholding DECIMAL(12,2) DEFAULT 0,
  other_deductions DECIMAL(12,2) DEFAULT 0,
  net_amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',

  -- GRAIN rewards
  grain_earned DECIMAL(18,8) DEFAULT 0,
  grain_rate DECIMAL(5,4) DEFAULT 0.01, -- 1% in GRAIN

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed

  -- Payment method
  payment_method VARCHAR(50), -- bank_transfer, wallet, crypto
  payment_reference VARCHAR(255),

  -- Dates
  scheduled_date DATE,
  processed_at TIMESTAMP,

  -- From treasury
  from_wallet_id UUID REFERENCES treasury_wallets(id),
  to_wallet_id UUID REFERENCES treasury_wallets(id),

  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INVOICES (To clients from Wells)
-- ============================================

CREATE TABLE IF NOT EXISTS eor_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  client_id UUID NOT NULL REFERENCES eor_clients(id),
  engagement_id UUID REFERENCES eor_engagements(id),

  -- Invoice details
  invoice_number VARCHAR(100) NOT NULL UNIQUE,

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Amounts
  subtotal DECIMAL(12,2) NOT NULL,
  platform_fee DECIMAL(12,2) DEFAULT 0,
  taxes DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',

  -- Line items
  line_items JSONB DEFAULT '[]',

  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- draft, sent, viewed, paid, overdue, cancelled

  -- Dates
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  sent_at TIMESTAMP,
  viewed_at TIMESTAMP,
  paid_at TIMESTAMP,

  -- Payment
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),

  -- Early payment discount
  early_payment_discount_percent DECIMAL(5,2),
  early_payment_deadline DATE,

  -- GRAIN incentives
  grain_bonus_for_early_payment DECIMAL(18,8) DEFAULT 0,

  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- MATCHING & OPPORTUNITIES
-- ============================================

-- AI-generated matches
CREATE TABLE IF NOT EXISTS eor_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  worker_id UUID NOT NULL REFERENCES workers(id),
  project_id UUID NOT NULL REFERENCES eor_projects(id),

  -- Match scoring
  overall_score DECIMAL(5,2), -- 0-100
  skill_match_score DECIMAL(5,2),
  rate_match_score DECIMAL(5,2),
  availability_score DECIMAL(5,2),
  experience_score DECIMAL(5,2),

  -- AI reasoning
  match_reasons JSONB DEFAULT '[]',
  concerns JSONB DEFAULT '[]',

  -- Negotiation
  suggested_rate DECIMAL(12,2),
  rate_negotiation_notes TEXT,

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, viewed, applied, rejected, hired

  -- Actions
  sent_to_worker_at TIMESTAMP,
  worker_viewed_at TIMESTAMP,
  worker_applied_at TIMESTAMP,
  client_reviewed_at TIMESTAMP,

  -- Outcome
  outcome VARCHAR(50), -- hired, worker_declined, client_declined, expired
  outcome_reason TEXT,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(worker_id, project_id)
);

-- ============================================
-- CONTRACTS
-- ============================================

CREATE TABLE IF NOT EXISTS eor_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parties
  engagement_id UUID NOT NULL REFERENCES eor_engagements(id),
  worker_id UUID NOT NULL REFERENCES workers(id),
  client_id UUID NOT NULL REFERENCES eor_clients(id),

  -- Contract details
  contract_type VARCHAR(50) DEFAULT 'services', -- services, employment, nda

  -- Document
  document_url VARCHAR(500),
  document_hash VARCHAR(256), -- for verification

  -- Terms
  terms JSONB DEFAULT '{}',

  -- Signatures
  worker_signed_at TIMESTAMP,
  worker_signature_ip VARCHAR(50),
  client_signed_at TIMESTAMP,
  client_signature_ip VARCHAR(50),

  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- draft, sent, partially_signed, fully_signed, cancelled

  -- Dates
  effective_date DATE,
  expiration_date DATE,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- JOURNEY TRACKING
-- ============================================

-- Track all journey activities
CREATE TABLE IF NOT EXISTS journey_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Journey context
  journey_id UUID NOT NULL,
  journey_type VARCHAR(50) NOT NULL, -- buyer, seller, founder, worker
  user_id VARCHAR(255),

  -- Activity
  activity_type VARCHAR(100) NOT NULL,
  activity_message TEXT NOT NULL,

  -- Details
  details JSONB DEFAULT '{}',

  -- Status
  status VARCHAR(50) DEFAULT 'info', -- info, success, warning, error, decision_needed

  -- Metrics
  duration_ms INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Journey decisions
CREATE TABLE IF NOT EXISTS journey_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  journey_id UUID NOT NULL,
  journey_type VARCHAR(50) NOT NULL,
  user_id VARCHAR(255),

  -- Decision context
  decision_type VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,

  -- Options presented
  options JSONB DEFAULT '[]',
  ai_recommendation TEXT,

  -- User choice
  selected_option VARCHAR(255),
  decision_made_at TIMESTAMP,

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, decided, expired, skipped

  -- Outcome
  outcome_details JSONB DEFAULT '{}',

  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Journey results
CREATE TABLE IF NOT EXISTS journey_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  journey_id UUID NOT NULL,
  journey_type VARCHAR(50) NOT NULL,
  user_id VARCHAR(255),

  -- Result
  result_type VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,

  -- Metrics
  metrics JSONB DEFAULT '{}',

  -- GRAIN earned
  grain_earned DECIMAL(18,8) DEFAULT 0,

  -- Status
  status VARCHAR(50) DEFAULT 'active', -- active, completed, cancelled

  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Create worker profile
CREATE OR REPLACE FUNCTION create_worker_profile(
  p_email VARCHAR(255),
  p_full_name VARCHAR(255),
  p_skills JSONB DEFAULT '[]',
  p_headline VARCHAR(500) DEFAULT NULL,
  p_rate_min DECIMAL(10,2) DEFAULT NULL,
  p_rate_max DECIMAL(10,2) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_worker_id UUID;
  v_wallet_id UUID;
BEGIN
  -- Create treasury wallet for worker
  INSERT INTO treasury_wallets (wallet_type, status)
  VALUES ('worker', 'active')
  RETURNING id INTO v_wallet_id;

  -- Create worker profile
  INSERT INTO workers (
    email, full_name, headline, skills,
    preferred_rate_min, preferred_rate_max,
    wallet_id, status
  ) VALUES (
    p_email, p_full_name, p_headline, p_skills,
    p_rate_min, p_rate_max,
    v_wallet_id, 'pending'
  )
  RETURNING id INTO v_worker_id;

  -- Calculate initial profile completeness
  UPDATE workers
  SET profile_completeness = calculate_profile_completeness(v_worker_id)
  WHERE id = v_worker_id;

  RETURN v_worker_id;
END;
$$ LANGUAGE plpgsql;

-- Calculate profile completeness
CREATE OR REPLACE FUNCTION calculate_profile_completeness(p_worker_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 0;
  v_worker workers%ROWTYPE;
BEGIN
  SELECT * INTO v_worker FROM workers WHERE id = p_worker_id;

  IF v_worker.full_name IS NOT NULL THEN v_score := v_score + 10; END IF;
  IF v_worker.headline IS NOT NULL THEN v_score := v_score + 10; END IF;
  IF v_worker.bio IS NOT NULL THEN v_score := v_score + 10; END IF;
  IF jsonb_array_length(v_worker.skills) > 0 THEN v_score := v_score + 15; END IF;
  IF v_worker.experience_years IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_worker.preferred_rate_min IS NOT NULL THEN v_score := v_score + 10; END IF;
  IF v_worker.portfolio_url IS NOT NULL THEN v_score := v_score + 10; END IF;
  IF v_worker.linkedin_url IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_worker.github_url IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_worker.resume_url IS NOT NULL THEN v_score := v_score + 10; END IF;
  IF v_worker.identity_verified THEN v_score := v_score + 5; END IF;
  IF v_worker.background_checked THEN v_score := v_score + 5; END IF;

  RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- Match workers to project
CREATE OR REPLACE FUNCTION match_workers_to_project(p_project_id UUID)
RETURNS TABLE (
  worker_id UUID,
  overall_score DECIMAL(5,2),
  skill_match_score DECIMAL(5,2),
  rate_match_score DECIMAL(5,2)
) AS $$
DECLARE
  v_project eor_projects%ROWTYPE;
BEGIN
  SELECT * INTO v_project FROM eor_projects WHERE id = p_project_id;

  RETURN QUERY
  SELECT
    w.id as worker_id,
    -- Overall score (weighted average)
    (
      (COALESCE(skill_score(w.skills, v_project.required_skills), 0) * 0.4) +
      (COALESCE(rate_score(w.preferred_rate_min, w.preferred_rate_max, v_project.budget_min, v_project.budget_max), 0) * 0.3) +
      (COALESCE(experience_score(w.experience_years, v_project.experience_required), 0) * 0.2) +
      (CASE WHEN w.availability = 'available' THEN 100 ELSE 50 END * 0.1)
    )::DECIMAL(5,2) as overall_score,
    skill_score(w.skills, v_project.required_skills)::DECIMAL(5,2) as skill_match_score,
    rate_score(w.preferred_rate_min, w.preferred_rate_max, v_project.budget_min, v_project.budget_max)::DECIMAL(5,2) as rate_match_score
  FROM workers w
  WHERE w.status = 'active'
  AND w.availability IN ('available', 'partially_available')
  ORDER BY overall_score DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Helper: skill matching score
CREATE OR REPLACE FUNCTION skill_score(
  p_worker_skills JSONB,
  p_required_skills JSONB
)
RETURNS DECIMAL AS $$
DECLARE
  v_matched INTEGER := 0;
  v_required INTEGER;
  v_skill TEXT;
BEGIN
  v_required := jsonb_array_length(p_required_skills);
  IF v_required = 0 THEN RETURN 100; END IF;

  FOR v_skill IN SELECT jsonb_array_elements_text(p_required_skills) LOOP
    IF p_worker_skills ? v_skill OR
       EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(p_worker_skills) ws
         WHERE LOWER(ws) LIKE '%' || LOWER(v_skill) || '%'
       ) THEN
      v_matched := v_matched + 1;
    END IF;
  END LOOP;

  RETURN (v_matched::DECIMAL / v_required::DECIMAL) * 100;
END;
$$ LANGUAGE plpgsql;

-- Helper: rate matching score
CREATE OR REPLACE FUNCTION rate_score(
  p_worker_min DECIMAL,
  p_worker_max DECIMAL,
  p_project_min DECIMAL,
  p_project_max DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
  IF p_worker_min IS NULL OR p_project_max IS NULL THEN
    RETURN 70; -- Default score if rates not specified
  END IF;

  -- Check if ranges overlap
  IF p_worker_min <= p_project_max AND p_worker_max >= p_project_min THEN
    RETURN 100;
  ELSIF p_worker_min <= p_project_max * 1.2 THEN
    RETURN 70; -- Within 20% of budget
  ELSIF p_worker_min <= p_project_max * 1.5 THEN
    RETURN 40; -- Within 50% of budget
  ELSE
    RETURN 10;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Helper: experience matching score
CREATE OR REPLACE FUNCTION experience_score(
  p_worker_years INTEGER,
  p_required_years INTEGER
)
RETURNS DECIMAL AS $$
BEGIN
  IF p_required_years IS NULL OR p_required_years = 0 THEN
    RETURN 100;
  END IF;

  IF p_worker_years IS NULL THEN
    RETURN 50;
  END IF;

  IF p_worker_years >= p_required_years THEN
    RETURN 100;
  ELSIF p_worker_years >= p_required_years * 0.7 THEN
    RETURN 80;
  ELSIF p_worker_years >= p_required_years * 0.5 THEN
    RETURN 60;
  ELSE
    RETURN 30;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Process payment to worker
CREATE OR REPLACE FUNCTION process_worker_payment(
  p_worker_id UUID,
  p_engagement_id UUID,
  p_timesheet_id UUID,
  p_gross_amount DECIMAL(12,2)
)
RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
  v_wells_fee DECIMAL(12,2);
  v_net_amount DECIMAL(12,2);
  v_grain_earned DECIMAL(18,8);
  v_worker workers%ROWTYPE;
  v_engagement eor_engagements%ROWTYPE;
BEGIN
  SELECT * INTO v_worker FROM workers WHERE id = p_worker_id;
  SELECT * INTO v_engagement FROM eor_engagements WHERE id = p_engagement_id;

  -- Calculate fees
  v_wells_fee := p_gross_amount * (v_engagement.wells_fee_percent / 100);
  v_net_amount := p_gross_amount - v_wells_fee;

  -- Calculate GRAIN earned (1% of payment)
  v_grain_earned := v_net_amount * 0.01;

  -- Create payment record
  INSERT INTO eor_payments (
    worker_id, engagement_id, timesheet_id,
    payment_type, gross_amount, wells_fee, net_amount,
    grain_earned, status, scheduled_date,
    from_wallet_id, to_wallet_id
  ) VALUES (
    p_worker_id, p_engagement_id, p_timesheet_id,
    'timesheet', p_gross_amount, v_wells_fee, v_net_amount,
    v_grain_earned, 'pending', CURRENT_DATE + INTERVAL '1 day',
    (SELECT id FROM treasury_wallets WHERE wallet_type = 'operations' LIMIT 1),
    v_worker.wallet_id
  )
  RETURNING id INTO v_payment_id;

  -- Update worker's GRAIN balance
  UPDATE workers
  SET grain_balance = grain_balance + v_grain_earned
  WHERE id = p_worker_id;

  -- Update engagement totals
  UPDATE eor_engagements
  SET total_earned = total_earned + v_net_amount,
      total_grain_earned = total_grain_earned + v_grain_earned
  WHERE id = p_engagement_id;

  -- Log to GRAIN ledger
  INSERT INTO grain_ledger (
    wallet_id, type, quantity, reference_type, reference_id, reason, category
  ) VALUES (
    v_worker.wallet_id, 'credit', v_grain_earned,
    'worker_payment', v_payment_id::TEXT,
    'GRAIN earned on worker payment',
    'worker_reward'
  );

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS
-- ============================================

-- Worker dashboard view
CREATE OR REPLACE VIEW worker_dashboard AS
SELECT
  w.id,
  w.full_name,
  w.email,
  w.headline,
  w.availability,
  w.status,
  w.grain_balance,
  w.profile_completeness,

  -- Active engagements
  (SELECT COUNT(*) FROM eor_engagements e WHERE e.worker_id = w.id AND e.status = 'active') as active_engagements,

  -- Earnings
  (SELECT COALESCE(SUM(total_earned), 0) FROM eor_engagements e WHERE e.worker_id = w.id) as total_earned,

  -- Pending payments
  (SELECT COALESCE(SUM(net_amount), 0) FROM eor_payments p WHERE p.worker_id = w.id AND p.status = 'pending') as pending_payments,

  -- Match opportunities
  (SELECT COUNT(*) FROM eor_matches m WHERE m.worker_id = w.id AND m.status = 'pending') as pending_matches,

  w.created_at
FROM workers w;

-- Project pipeline view
CREATE OR REPLACE VIEW project_pipeline AS
SELECT
  p.id,
  p.title,
  c.company_name as client_name,
  p.project_type,
  p.status,
  p.budget_min,
  p.budget_max,
  p.start_date,

  -- Match stats
  (SELECT COUNT(*) FROM eor_matches m WHERE m.project_id = p.id) as total_matches,
  (SELECT COUNT(*) FROM eor_matches m WHERE m.project_id = p.id AND m.status = 'hired') as hired_count,

  -- Best match
  (SELECT overall_score FROM eor_matches m WHERE m.project_id = p.id ORDER BY overall_score DESC LIMIT 1) as best_match_score,

  p.created_at
FROM eor_projects p
JOIN eor_clients c ON p.client_id = c.id
ORDER BY p.created_at DESC;

-- Engagement activity view
CREATE OR REPLACE VIEW engagement_activity AS
SELECT
  e.id,
  w.full_name as worker_name,
  c.company_name as client_name,
  p.title as project_title,
  e.rate,
  e.rate_type,
  e.status,
  e.start_date,
  e.total_hours,
  e.total_earned,
  e.total_grain_earned,

  -- Recent payment
  (SELECT MAX(processed_at) FROM eor_payments pay WHERE pay.engagement_id = e.id) as last_payment,

  e.created_at
FROM eor_engagements e
JOIN workers w ON e.worker_id = w.id
JOIN eor_clients c ON e.client_id = c.id
JOIN eor_projects p ON e.project_id = p.id
ORDER BY e.start_date DESC;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_workers_email ON workers(email);
CREATE INDEX IF NOT EXISTS idx_workers_status ON workers(status);
CREATE INDEX IF NOT EXISTS idx_workers_availability ON workers(availability);
CREATE INDEX IF NOT EXISTS idx_workers_skills ON workers USING GIN(skills);

CREATE INDEX IF NOT EXISTS idx_eor_projects_status ON eor_projects(status);
CREATE INDEX IF NOT EXISTS idx_eor_projects_client ON eor_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_eor_projects_skills ON eor_projects USING GIN(required_skills);

CREATE INDEX IF NOT EXISTS idx_eor_engagements_worker ON eor_engagements(worker_id);
CREATE INDEX IF NOT EXISTS idx_eor_engagements_project ON eor_engagements(project_id);
CREATE INDEX IF NOT EXISTS idx_eor_engagements_status ON eor_engagements(status);

CREATE INDEX IF NOT EXISTS idx_eor_matches_worker ON eor_matches(worker_id);
CREATE INDEX IF NOT EXISTS idx_eor_matches_project ON eor_matches(project_id);
CREATE INDEX IF NOT EXISTS idx_eor_matches_status ON eor_matches(status);

CREATE INDEX IF NOT EXISTS idx_eor_payments_worker ON eor_payments(worker_id);
CREATE INDEX IF NOT EXISTS idx_eor_payments_status ON eor_payments(status);

CREATE INDEX IF NOT EXISTS idx_journey_activities_journey ON journey_activities(journey_id);
CREATE INDEX IF NOT EXISTS idx_journey_activities_type ON journey_activities(journey_type);

CREATE INDEX IF NOT EXISTS idx_journey_decisions_journey ON journey_decisions(journey_id);
CREATE INDEX IF NOT EXISTS idx_journey_decisions_status ON journey_decisions(status);

-- ============================================
-- SEED DATA
-- ============================================

-- Insert sample project types
-- (Would be populated via the API as real clients create projects)

COMMENT ON TABLE workers IS 'Workers who work through Wells and get paid through Wells';
COMMENT ON TABLE eor_engagements IS 'Active work relationships between workers and clients';
COMMENT ON TABLE eor_payments IS 'All payments made to workers through Wells';
COMMENT ON TABLE journey_activities IS 'Real-time activity feed for all journey types';
