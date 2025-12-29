-- ============================================================================
-- WELLS AI HRIS INTEGRATION SCHEMA
-- Job Seeker Flow - Wells represents candidates and collects 1% placement fees
-- ============================================================================

-- ============================================================================
-- 1. HRIS CONNECTIONS
-- Employer connections to HRIS systems via Merge.dev
-- ============================================================================
CREATE TABLE IF NOT EXISTS hris_connections (
  id TEXT PRIMARY KEY,
  employer_id TEXT NOT NULL,
  employer_name TEXT NOT NULL,

  -- Integration details
  provider TEXT NOT NULL CHECK (provider IN (
    'workday', 'bamboohr', 'greenhouse', 'lever',
    'sap_successfactors', 'adp', 'icims', 'jobvite',
    'smartrecruiters', 'other'
  )),
  account_token TEXT NOT NULL, -- Merge.dev account token
  integration_id TEXT NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'linked', 'error', 'disconnected'
  )),
  last_sync_at TIMESTAMP,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  job_postings_count INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hris_connections_employer ON hris_connections(employer_id);
CREATE INDEX IF NOT EXISTS idx_hris_connections_status ON hris_connections(status);
CREATE INDEX IF NOT EXISTS idx_hris_connections_provider ON hris_connections(provider);

-- ============================================================================
-- 2. HRIS JOB POSTINGS
-- Job postings synced from HRIS systems
-- ============================================================================
CREATE TABLE IF NOT EXISTS hris_job_postings (
  id TEXT PRIMARY KEY,
  remote_id TEXT NOT NULL, -- ID in the HRIS system
  connection_id TEXT NOT NULL REFERENCES hris_connections(id) ON DELETE CASCADE,
  employer_id TEXT NOT NULL,
  employer_name TEXT NOT NULL,

  -- Job details
  title TEXT NOT NULL,
  description TEXT,
  code TEXT, -- Internal job code
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'open', 'closed', 'draft', 'internal', 'pending'
  )),

  -- Organization
  departments TEXT[] DEFAULT '{}',
  offices TEXT[] DEFAULT '{}',
  hiring_managers JSONB DEFAULT '[]',
  recruiters JSONB DEFAULT '[]',

  -- Location
  location TEXT,
  location_type TEXT CHECK (location_type IN ('remote', 'onsite', 'hybrid')),

  -- Compensation (enriched)
  salary_min DECIMAL(12, 2),
  salary_max DECIMAL(12, 2),
  salary_currency TEXT DEFAULT 'USD',
  salary_period TEXT DEFAULT 'annual' CHECK (salary_period IN ('hourly', 'annual')),

  -- Requirements (enriched)
  experience_level TEXT,
  skills TEXT[] DEFAULT '{}',
  benefits TEXT[] DEFAULT '{}',

  -- HRIS timestamps
  remote_created_at TIMESTAMP,
  remote_updated_at TIMESTAMP,

  -- Local timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Prevent duplicates
  UNIQUE(connection_id, remote_id)
);

CREATE INDEX IF NOT EXISTS idx_hris_jobs_connection ON hris_job_postings(connection_id);
CREATE INDEX IF NOT EXISTS idx_hris_jobs_employer ON hris_job_postings(employer_id);
CREATE INDEX IF NOT EXISTS idx_hris_jobs_status ON hris_job_postings(status);
CREATE INDEX IF NOT EXISTS idx_hris_jobs_title ON hris_job_postings USING GIN(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_hris_jobs_skills ON hris_job_postings USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_hris_jobs_location ON hris_job_postings(location_type);
CREATE INDEX IF NOT EXISTS idx_hris_jobs_salary ON hris_job_postings(salary_min, salary_max);
CREATE INDEX IF NOT EXISTS idx_hris_jobs_created ON hris_job_postings(created_at DESC);

-- ============================================================================
-- 3. HRIS CANDIDATES
-- Candidates (job seekers) in HRIS systems
-- ============================================================================
CREATE TABLE IF NOT EXISTS hris_candidates (
  id TEXT PRIMARY KEY,
  remote_id TEXT, -- ID in HRIS (after submission)
  connection_id TEXT NOT NULL REFERENCES hris_connections(id) ON DELETE CASCADE,

  -- Personal info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,

  -- Resume
  resume_url TEXT,
  resume_text TEXT,

  -- Wells profile link
  worker_profile_id TEXT,
  user_id TEXT NOT NULL,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- One candidate per user per connection
  UNIQUE(user_id, connection_id)
);

CREATE INDEX IF NOT EXISTS idx_hris_candidates_connection ON hris_candidates(connection_id);
CREATE INDEX IF NOT EXISTS idx_hris_candidates_user ON hris_candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_hris_candidates_email ON hris_candidates(email);

-- ============================================================================
-- 4. HRIS APPLICATIONS
-- Job applications tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS hris_applications (
  id TEXT PRIMARY KEY,
  remote_id TEXT, -- ID in HRIS
  candidate_id TEXT NOT NULL REFERENCES hris_candidates(id) ON DELETE CASCADE,
  job_posting_id TEXT NOT NULL REFERENCES hris_job_postings(id) ON DELETE CASCADE,

  -- Status
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN (
    'applied', 'screening', 'phone_screen', 'interview',
    'final_interview', 'offer', 'offer_accepted', 'hired',
    'rejected', 'withdrawn'
  )),
  rejected_reason TEXT,

  -- Source
  source TEXT NOT NULL DEFAULT 'wells_ai',
  source_details TEXT,
  cover_letter TEXT,

  -- Timeline
  applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
  screened_at TIMESTAMP,
  interviewed_at TIMESTAMP,
  offered_at TIMESTAMP,
  hired_at TIMESTAMP,
  rejected_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- One application per candidate per job
  UNIQUE(candidate_id, job_posting_id)
);

CREATE INDEX IF NOT EXISTS idx_hris_apps_candidate ON hris_applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_hris_apps_job ON hris_applications(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_hris_apps_status ON hris_applications(status);
CREATE INDEX IF NOT EXISTS idx_hris_apps_applied ON hris_applications(applied_at DESC);

-- ============================================================================
-- 5. HRIS OFFERS
-- Job offers received
-- ============================================================================
CREATE TABLE IF NOT EXISTS hris_offers (
  id TEXT PRIMARY KEY,
  remote_id TEXT, -- ID in HRIS
  application_id TEXT NOT NULL REFERENCES hris_applications(id) ON DELETE CASCADE,

  -- Compensation
  base_salary DECIMAL(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  salary_period TEXT NOT NULL DEFAULT 'annual' CHECK (salary_period IN ('hourly', 'annual')),

  -- Additional comp
  signing_bonus DECIMAL(12, 2),
  equity TEXT, -- e.g., "0.1%", "10000 options"
  bonus_target DECIMAL(5, 2), -- Percentage
  relocation_bonus DECIMAL(12, 2),

  -- Details
  title TEXT,
  department TEXT,
  location TEXT,
  start_date DATE,
  expires_at TIMESTAMP,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'negotiating', 'accepted', 'rejected', 'expired'
  )),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hris_offers_application ON hris_offers(application_id);
CREATE INDEX IF NOT EXISTS idx_hris_offers_status ON hris_offers(status);
CREATE INDEX IF NOT EXISTS idx_hris_offers_salary ON hris_offers(base_salary);

-- ============================================================================
-- 6. HRIS COUNTER OFFERS
-- Negotiation history
-- ============================================================================
CREATE TABLE IF NOT EXISTS hris_counter_offers (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES hris_offers(id) ON DELETE CASCADE,

  -- Who made this counter
  from_party TEXT NOT NULL CHECK (from_party IN ('candidate', 'employer')),

  -- Proposed terms
  base_salary DECIMAL(12, 2),
  signing_bonus DECIMAL(12, 2),
  equity TEXT,
  start_date DATE,
  other_terms TEXT,

  -- Reasoning
  rationale TEXT NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN (
    'proposed', 'accepted', 'rejected', 'superseded'
  )),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hris_counters_offer ON hris_counter_offers(offer_id);
CREATE INDEX IF NOT EXISTS idx_hris_counters_party ON hris_counter_offers(from_party);
CREATE INDEX IF NOT EXISTS idx_hris_counters_status ON hris_counter_offers(status);

-- ============================================================================
-- 7. HRIS PLACEMENTS
-- Successful placements (for fee tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS hris_placements (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES hris_offers(id),
  application_id TEXT NOT NULL REFERENCES hris_applications(id),
  candidate_id TEXT NOT NULL REFERENCES hris_candidates(id),
  user_id TEXT NOT NULL,

  -- Employer
  employer_id TEXT NOT NULL,
  employer_name TEXT NOT NULL,
  job_title TEXT NOT NULL,

  -- Compensation
  annual_salary DECIMAL(12, 2) NOT NULL,
  salary_currency TEXT NOT NULL DEFAULT 'USD',

  -- Dates
  start_date DATE,
  hire_date DATE DEFAULT CURRENT_DATE,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending_start' CHECK (status IN (
    'pending_start', 'started', 'completed_guarantee',
    'terminated_early', 'cancelled'
  )),
  termination_date DATE,
  termination_reason TEXT,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hris_placements_user ON hris_placements(user_id);
CREATE INDEX IF NOT EXISTS idx_hris_placements_employer ON hris_placements(employer_id);
CREATE INDEX IF NOT EXISTS idx_hris_placements_status ON hris_placements(status);
CREATE INDEX IF NOT EXISTS idx_hris_placements_start ON hris_placements(start_date);

-- ============================================================================
-- 8. CANDIDATE PROFILES
-- Extended job seeker profiles
-- ============================================================================
CREATE TABLE IF NOT EXISTS candidate_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  worker_profile_id TEXT, -- Link to worker_profiles if exists

  -- Personal
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,

  -- Resume
  resume_url TEXT,
  resume_text TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,

  -- Skills & Experience
  skills TEXT[] DEFAULT '{}',
  years_experience INTEGER,
  current_title TEXT,
  current_company TEXT,
  desired_titles TEXT[] DEFAULT '{}',

  -- Preferences (JSON for flexibility)
  constraints JSONB DEFAULT '{}',
  -- Constraints include:
  -- minSalary, targetSalary, maxSalary
  -- locations[], remotePreference
  -- requiredBenefits[], preferredBenefits[]
  -- industries[], companySizes[]
  -- excludeCompanies[]
  -- mustHaveEquity, minEquityPercent
  -- visaSponsorship, relocationAssistance
  -- startDateFlexibility

  -- Agent settings
  auto_apply_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_apply_threshold INTEGER NOT NULL DEFAULT 80,
  notify_on_new_matches BOOLEAN NOT NULL DEFAULT true,
  weekly_digest BOOLEAN NOT NULL DEFAULT true,

  -- Stats
  total_applications INTEGER NOT NULL DEFAULT 0,
  active_applications INTEGER NOT NULL DEFAULT 0,
  offers_received INTEGER NOT NULL DEFAULT 0,
  placements_completed INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_user ON candidate_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_skills ON candidate_profiles USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_titles ON candidate_profiles USING GIN(desired_titles);

-- ============================================================================
-- 9. PLACEMENT FEES
-- 1% placement fee tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS placement_fees (
  id TEXT PRIMARY KEY,
  placement_id TEXT NOT NULL,

  -- Parties
  candidate_user_id TEXT NOT NULL,
  candidate_name TEXT NOT NULL,
  employer_id TEXT NOT NULL,
  employer_name TEXT NOT NULL,

  -- Job
  job_title TEXT NOT NULL,
  start_date DATE NOT NULL,

  -- Salary basis
  annual_salary DECIMAL(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Fee breakdown
  total_fee_percent DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
  total_fee_amount DECIMAL(12, 2) NOT NULL,

  -- Candidate portion
  candidate_fee_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.50,
  candidate_fee_amount DECIMAL(12, 2) NOT NULL,
  candidate_fee_status TEXT NOT NULL DEFAULT 'pending' CHECK (candidate_fee_status IN (
    'pending', 'invoiced', 'partial', 'paid', 'overdue', 'waived', 'refunded'
  )),
  candidate_fee_invoice_id TEXT,
  candidate_fee_paid_at TIMESTAMP,

  -- Employer portion
  employer_fee_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.50,
  employer_fee_amount DECIMAL(12, 2) NOT NULL,
  employer_fee_status TEXT NOT NULL DEFAULT 'pending' CHECK (employer_fee_status IN (
    'pending', 'invoiced', 'partial', 'paid', 'overdue', 'waived', 'refunded'
  )),
  employer_fee_invoice_id TEXT,
  employer_fee_paid_at TIMESTAMP,

  -- Payment terms
  payment_due_days INTEGER NOT NULL DEFAULT 30,
  candidate_payment_due DATE,
  employer_payment_due DATE,

  -- Guarantee period
  guarantee_days INTEGER NOT NULL DEFAULT 90,
  guarantee_ends_at DATE,
  is_guarantee_active BOOLEAN NOT NULL DEFAULT true,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending_start' CHECK (status IN (
    'pending_start', 'active', 'collecting', 'collected',
    'guarantee_claim', 'refunded', 'waived', 'cancelled'
  )),

  -- Waiver
  waived BOOLEAN NOT NULL DEFAULT false,
  waived_reason TEXT,
  waived_at TIMESTAMP,
  waived_by TEXT,

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_placement_fees_placement ON placement_fees(placement_id);
CREATE INDEX IF NOT EXISTS idx_placement_fees_candidate ON placement_fees(candidate_user_id);
CREATE INDEX IF NOT EXISTS idx_placement_fees_employer ON placement_fees(employer_id);
CREATE INDEX IF NOT EXISTS idx_placement_fees_status ON placement_fees(status);
CREATE INDEX IF NOT EXISTS idx_placement_fees_candidate_status ON placement_fees(candidate_fee_status);
CREATE INDEX IF NOT EXISTS idx_placement_fees_employer_status ON placement_fees(employer_fee_status);
CREATE INDEX IF NOT EXISTS idx_placement_fees_created ON placement_fees(created_at DESC);

-- ============================================================================
-- 10. PLACEMENT FEE EVENTS
-- Audit trail for fee changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS placement_fee_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_id TEXT NOT NULL REFERENCES placement_fees(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  amount DECIMAL(12, 2),
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_placement_fee_events_fee ON placement_fee_events(fee_id);
CREATE INDEX IF NOT EXISTS idx_placement_fee_events_type ON placement_fee_events(event_type);
CREATE INDEX IF NOT EXISTS idx_placement_fee_events_created ON placement_fee_events(created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_hris_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_hris_connections_timestamp ON hris_connections;
CREATE TRIGGER update_hris_connections_timestamp
  BEFORE UPDATE ON hris_connections
  FOR EACH ROW EXECUTE FUNCTION update_hris_timestamp();

DROP TRIGGER IF EXISTS update_hris_jobs_timestamp ON hris_job_postings;
CREATE TRIGGER update_hris_jobs_timestamp
  BEFORE UPDATE ON hris_job_postings
  FOR EACH ROW EXECUTE FUNCTION update_hris_timestamp();

DROP TRIGGER IF EXISTS update_hris_candidates_timestamp ON hris_candidates;
CREATE TRIGGER update_hris_candidates_timestamp
  BEFORE UPDATE ON hris_candidates
  FOR EACH ROW EXECUTE FUNCTION update_hris_timestamp();

DROP TRIGGER IF EXISTS update_hris_applications_timestamp ON hris_applications;
CREATE TRIGGER update_hris_applications_timestamp
  BEFORE UPDATE ON hris_applications
  FOR EACH ROW EXECUTE FUNCTION update_hris_timestamp();

DROP TRIGGER IF EXISTS update_hris_offers_timestamp ON hris_offers;
CREATE TRIGGER update_hris_offers_timestamp
  BEFORE UPDATE ON hris_offers
  FOR EACH ROW EXECUTE FUNCTION update_hris_timestamp();

DROP TRIGGER IF EXISTS update_hris_placements_timestamp ON hris_placements;
CREATE TRIGGER update_hris_placements_timestamp
  BEFORE UPDATE ON hris_placements
  FOR EACH ROW EXECUTE FUNCTION update_hris_timestamp();

DROP TRIGGER IF EXISTS update_candidate_profiles_timestamp ON candidate_profiles;
CREATE TRIGGER update_candidate_profiles_timestamp
  BEFORE UPDATE ON candidate_profiles
  FOR EACH ROW EXECUTE FUNCTION update_hris_timestamp();

DROP TRIGGER IF EXISTS update_placement_fees_timestamp ON placement_fees;
CREATE TRIGGER update_placement_fees_timestamp
  BEFORE UPDATE ON placement_fees
  FOR EACH ROW EXECUTE FUNCTION update_hris_timestamp();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active job seekers summary
CREATE OR REPLACE VIEW active_job_seekers AS
SELECT
  cp.user_id,
  cp.first_name || ' ' || cp.last_name as name,
  cp.desired_titles,
  cp.skills,
  (cp.constraints->>'minSalary')::integer as min_salary,
  (cp.constraints->>'targetSalary')::integer as target_salary,
  cp.constraints->>'remotePreference' as remote_preference,
  cp.total_applications,
  cp.offers_received,
  cp.auto_apply_enabled
FROM candidate_profiles cp
WHERE cp.auto_apply_enabled = true
  OR cp.notify_on_new_matches = true;

-- Placement fee summary
CREATE OR REPLACE VIEW placement_fee_summary AS
SELECT
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as total_placements,
  SUM(annual_salary) as total_salary_volume,
  SUM(total_fee_amount) as total_fees,
  SUM(CASE WHEN status = 'collected' THEN total_fee_amount ELSE 0 END) as collected_fees,
  SUM(CASE WHEN status IN ('pending_start', 'active', 'collecting') THEN total_fee_amount ELSE 0 END) as pending_fees,
  AVG(annual_salary) as avg_salary,
  AVG(total_fee_amount) as avg_fee
FROM placement_fees
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- Application pipeline
CREATE OR REPLACE VIEW application_pipeline AS
SELECT
  a.status,
  COUNT(*) as count,
  COUNT(DISTINCT a.candidate_id) as unique_candidates,
  COUNT(DISTINCT j.employer_id) as unique_employers
FROM hris_applications a
JOIN hris_job_postings j ON a.job_posting_id = j.id
GROUP BY a.status
ORDER BY
  CASE a.status
    WHEN 'applied' THEN 1
    WHEN 'screening' THEN 2
    WHEN 'phone_screen' THEN 3
    WHEN 'interview' THEN 4
    WHEN 'final_interview' THEN 5
    WHEN 'offer' THEN 6
    WHEN 'offer_accepted' THEN 7
    WHEN 'hired' THEN 8
    ELSE 9
  END;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE hris_connections IS 'Employer connections to HRIS/ATS systems via Merge.dev';
COMMENT ON TABLE hris_job_postings IS 'Job postings synced from connected HRIS systems';
COMMENT ON TABLE hris_candidates IS 'Candidate profiles submitted to HRIS systems';
COMMENT ON TABLE hris_applications IS 'Job applications submitted through Wells AI';
COMMENT ON TABLE hris_offers IS 'Job offers received by candidates';
COMMENT ON TABLE hris_counter_offers IS 'Negotiation rounds for job offers';
COMMENT ON TABLE hris_placements IS 'Successful job placements';
COMMENT ON TABLE candidate_profiles IS 'Extended job seeker profiles with preferences';
COMMENT ON TABLE placement_fees IS '1% placement fee tracking (0.5% candidate, 0.5% employer)';
COMMENT ON TABLE placement_fee_events IS 'Audit trail for placement fee changes';

COMMENT ON COLUMN placement_fees.total_fee_percent IS 'Total fee as percentage of annual salary (default 1%)';
COMMENT ON COLUMN placement_fees.candidate_fee_percent IS 'Candidate portion of fee (default 0.5%)';
COMMENT ON COLUMN placement_fees.employer_fee_percent IS 'Employer portion of fee (default 0.5%)';
COMMENT ON COLUMN placement_fees.guarantee_days IS 'Guarantee period in days (default 90 days)';
COMMENT ON COLUMN candidate_profiles.constraints IS 'Job search constraints: minSalary, targetSalary, locations, remotePreference, excludeCompanies, etc.';
