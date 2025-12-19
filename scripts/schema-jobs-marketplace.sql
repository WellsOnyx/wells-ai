-- ============================================================================
-- WELLS AI JOB MARKETPLACE / TALENT NETWORK SCHEMA
-- "High-End Mechanical Turk" - Premium Task Marketplace
-- ============================================================================
--
-- THE VISION:
-- A curated talent network where verified workers connect with high-value
-- opportunities from buyers, sellers, and founders. All payments flow through
-- GRAIN escrow with full individual-level attribution tracking.
--
-- KEY FLOWS:
-- 1. Workers register skills, availability, rates, portfolio
-- 2. Task posters (buyers/sellers/founders) post tasks/gigs
-- 3. Wells AI proactively matches workers to opportunities
-- 4. Payment flows through GRAIN escrow with milestone releases
-- 5. Attribution tracks who referred worker AND who sourced task
--
-- STATUS FLOW:
-- posted -> matched -> applied -> assigned -> in_progress -> submitted -> approved -> paid
--
-- Run: psql $POSTGRES_URL < scripts/schema-jobs-marketplace.sql
-- ============================================================================

-- ============================================================================
-- 1. WORKER_PROFILES - Skills, availability, rates, portfolio, verification
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to core user system
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,

  -- Profile
  display_name TEXT NOT NULL,
  headline TEXT, -- e.g., "Full-Stack Developer | Ex-Google | 10yr exp"
  bio TEXT,
  avatar_url TEXT,
  portfolio_url TEXT,
  linkedin_url TEXT,
  github_url TEXT,

  -- Location & Timezone
  timezone TEXT DEFAULT 'America/New_York',
  country TEXT DEFAULT 'US',
  city TEXT,
  remote_only BOOLEAN DEFAULT true,
  willing_to_travel BOOLEAN DEFAULT false,

  -- Rates
  hourly_rate_min DECIMAL(10,2), -- Minimum acceptable hourly rate
  hourly_rate_max DECIMAL(10,2), -- Preferred hourly rate
  project_rate_min DECIMAL(12,2), -- Minimum project rate
  currency TEXT DEFAULT 'USD',
  accepts_grain_payment BOOLEAN DEFAULT true, -- Accept GRAIN tokens
  grain_premium_percent DECIMAL(5,2) DEFAULT 0, -- % premium for GRAIN payment

  -- Availability
  availability_status TEXT DEFAULT 'available' CHECK (
    availability_status IN ('available', 'limited', 'busy', 'unavailable')
  ),
  hours_per_week_available INTEGER DEFAULT 40,
  available_from DATE, -- When they can start new work
  response_time_hours INTEGER DEFAULT 24, -- Typical response time

  -- Preferences
  preferred_task_types TEXT[] DEFAULT '{}', -- micro, project, ongoing
  preferred_categories TEXT[] DEFAULT '{}', -- development, design, etc.
  min_task_duration TEXT DEFAULT 'any', -- any, 1_week, 1_month, 3_months
  max_concurrent_tasks INTEGER DEFAULT 3,

  -- Stats (computed/updated via triggers)
  total_tasks_completed INTEGER DEFAULT 0,
  total_tasks_in_progress INTEGER DEFAULT 0,
  total_earned_grain DECIMAL(20,6) DEFAULT 0,
  total_earned_usd DECIMAL(20,2) DEFAULT 0,
  avg_rating DECIMAL(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  on_time_delivery_rate DECIMAL(5,2) DEFAULT 0, -- Percentage
  acceptance_rate DECIMAL(5,2) DEFAULT 0, -- % of offered tasks accepted

  -- Verification
  verification_status TEXT DEFAULT 'unverified' CHECK (
    verification_status IN ('unverified', 'email_verified', 'identity_verified', 'background_checked', 'elite')
  ),
  verified_at TIMESTAMPTZ,
  verified_by TEXT, -- Admin user or system
  identity_documents JSONB DEFAULT '{}', -- Encrypted doc references
  background_check_id TEXT, -- External check reference

  -- Platform Status
  status TEXT DEFAULT 'pending_review' CHECK (
    status IN ('pending_review', 'active', 'suspended', 'banned', 'inactive')
  ),
  status_reason TEXT,
  featured BOOLEAN DEFAULT false, -- Show in featured workers
  featured_until TIMESTAMPTZ,

  -- Attribution (who brought this worker)
  referral_code TEXT UNIQUE, -- Their unique referral code
  referred_by_user_id UUID, -- Who referred them
  referred_by_code TEXT, -- The referral code used

  -- Metadata
  onboarding_completed_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mw_user_id ON marketplace_workers(user_id);
CREATE INDEX IF NOT EXISTS idx_mw_email ON marketplace_workers(email);
CREATE INDEX IF NOT EXISTS idx_mw_status ON marketplace_workers(status);
CREATE INDEX IF NOT EXISTS idx_mw_availability ON marketplace_workers(availability_status);
CREATE INDEX IF NOT EXISTS idx_mw_verification ON marketplace_workers(verification_status);
CREATE INDEX IF NOT EXISTS idx_mw_avg_rating ON marketplace_workers(avg_rating DESC);
CREATE INDEX IF NOT EXISTS idx_mw_hourly_rate ON marketplace_workers(hourly_rate_min, hourly_rate_max);
CREATE INDEX IF NOT EXISTS idx_mw_country ON marketplace_workers(country);
CREATE INDEX IF NOT EXISTS idx_mw_referral_code ON marketplace_workers(referral_code);
CREATE INDEX IF NOT EXISTS idx_mw_referred_by ON marketplace_workers(referred_by_user_id);
CREATE INDEX IF NOT EXISTS idx_mw_featured ON marketplace_workers(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_mw_last_active ON marketplace_workers(last_active_at DESC);

-- ============================================================================
-- 2. WORKER_SKILLS - Many-to-many skill tags with proficiency levels
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_skill_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Skill info
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, -- development, design, writing, marketing, etc.
  parent_skill_id UUID REFERENCES marketplace_skill_tags(id),

  -- Metadata
  description TEXT,
  suggested_hourly_rate_min DECIMAL(10,2),
  suggested_hourly_rate_max DECIMAL(10,2),
  demand_score INTEGER DEFAULT 50, -- 0-100, how in-demand this skill is

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mst_category ON marketplace_skill_tags(category);
CREATE INDEX IF NOT EXISTS idx_mst_slug ON marketplace_skill_tags(slug);
CREATE INDEX IF NOT EXISTS idx_mst_parent ON marketplace_skill_tags(parent_skill_id);
CREATE INDEX IF NOT EXISTS idx_mst_active ON marketplace_skill_tags(is_active);

-- Worker skills junction table
CREATE TABLE IF NOT EXISTS marketplace_worker_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  worker_id UUID NOT NULL REFERENCES marketplace_workers(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES marketplace_skill_tags(id) ON DELETE CASCADE,

  -- Proficiency
  proficiency_level TEXT DEFAULT 'intermediate' CHECK (
    proficiency_level IN ('beginner', 'intermediate', 'advanced', 'expert')
  ),
  years_experience INTEGER DEFAULT 1,

  -- Proof
  is_verified BOOLEAN DEFAULT false,
  verification_method TEXT, -- 'portfolio', 'test', 'certification', 'endorsement'
  verification_details JSONB DEFAULT '{}',

  -- Endorsements
  endorsement_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(worker_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_mws_worker ON marketplace_worker_skills(worker_id);
CREATE INDEX IF NOT EXISTS idx_mws_skill ON marketplace_worker_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_mws_proficiency ON marketplace_worker_skills(proficiency_level);
CREATE INDEX IF NOT EXISTS idx_mws_verified ON marketplace_worker_skills(is_verified);

-- ============================================================================
-- 3. TASK_POSTINGS - Posted tasks/gigs with requirements, budget, timeline
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Poster info
  poster_user_id UUID NOT NULL,
  poster_type TEXT NOT NULL CHECK (poster_type IN ('buyer', 'seller', 'founder', 'internal')),
  poster_company TEXT,

  -- Task details
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT NOT NULL,
  requirements TEXT, -- Detailed requirements
  deliverables JSONB DEFAULT '[]', -- List of expected deliverables

  -- Categorization
  category TEXT NOT NULL,
  subcategory TEXT,
  skills_required UUID[] DEFAULT '{}', -- References to skill_tags
  skills_preferred UUID[] DEFAULT '{}',

  -- Task type & duration
  task_type TEXT NOT NULL DEFAULT 'project' CHECK (
    task_type IN ('micro', 'project', 'ongoing', 'full_time_contract')
  ),
  estimated_hours_min INTEGER,
  estimated_hours_max INTEGER,
  duration_type TEXT DEFAULT 'fixed' CHECK (
    duration_type IN ('fixed', 'hourly', 'monthly', 'milestone')
  ),

  -- Budget
  budget_type TEXT NOT NULL DEFAULT 'fixed' CHECK (
    budget_type IN ('fixed', 'hourly', 'monthly', 'negotiable')
  ),
  budget_min DECIMAL(12,2),
  budget_max DECIMAL(12,2),
  budget_currency TEXT DEFAULT 'USD',
  pays_in_grain BOOLEAN DEFAULT false, -- Offers GRAIN payment
  grain_bonus_percent DECIMAL(5,2) DEFAULT 0, -- Extra % if paid in GRAIN

  -- Timeline
  start_date DATE,
  deadline DATE,
  urgency TEXT DEFAULT 'normal' CHECK (
    urgency IN ('low', 'normal', 'high', 'urgent', 'critical')
  ),

  -- Worker requirements
  min_rating DECIMAL(3,2) DEFAULT 0,
  min_completed_tasks INTEGER DEFAULT 0,
  verification_required TEXT DEFAULT 'email_verified' CHECK (
    verification_required IN ('unverified', 'email_verified', 'identity_verified', 'background_checked', 'elite')
  ),
  location_requirement TEXT DEFAULT 'anywhere', -- 'anywhere', 'us_only', 'specific_countries'
  allowed_countries TEXT[] DEFAULT '{}',
  timezone_requirement TEXT, -- e.g., 'overlap_4_hours_est'

  -- Visibility & matching
  visibility TEXT DEFAULT 'public' CHECK (
    visibility IN ('public', 'invite_only', 'matched_only', 'private')
  ),
  auto_match_enabled BOOLEAN DEFAULT true,
  invite_only_workers UUID[] DEFAULT '{}', -- Specific workers invited

  -- Status tracking
  status TEXT DEFAULT 'draft' CHECK (
    status IN (
      'draft',           -- Not yet published
      'posted',          -- Live and accepting applications
      'matched',         -- AI has suggested matches
      'reviewing',       -- Reviewing applications
      'assigned',        -- Worker assigned
      'in_progress',     -- Work underway
      'submitted',       -- Worker submitted for review
      'revision',        -- Needs revision
      'approved',        -- Work approved
      'paid',            -- Payment released
      'completed',       -- All done
      'cancelled',       -- Cancelled
      'disputed'         -- In dispute
    )
  ),

  -- Assignment (when assigned)
  assigned_worker_id UUID REFERENCES marketplace_workers(id),
  assigned_at TIMESTAMPTZ,

  -- Escrow integration
  escrow_id TEXT, -- Links to escrow_deals
  escrow_funded BOOLEAN DEFAULT false,
  escrow_amount DECIMAL(20,2),

  -- Stats
  view_count INTEGER DEFAULT 0,
  application_count INTEGER DEFAULT 0,

  -- Attribution (who sourced this task)
  sourced_by_user_id UUID, -- Who brought in this task
  source_channel TEXT, -- 'organic', 'referral', 'partnership', 'outbound', etc.
  source_campaign TEXT, -- Campaign ID if applicable

  -- Metadata
  attachments JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  posted_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mt_poster ON marketplace_tasks(poster_user_id);
CREATE INDEX IF NOT EXISTS idx_mt_poster_type ON marketplace_tasks(poster_type);
CREATE INDEX IF NOT EXISTS idx_mt_status ON marketplace_tasks(status);
CREATE INDEX IF NOT EXISTS idx_mt_category ON marketplace_tasks(category);
CREATE INDEX IF NOT EXISTS idx_mt_task_type ON marketplace_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_mt_visibility ON marketplace_tasks(visibility);
CREATE INDEX IF NOT EXISTS idx_mt_budget ON marketplace_tasks(budget_min, budget_max);
CREATE INDEX IF NOT EXISTS idx_mt_urgency ON marketplace_tasks(urgency);
CREATE INDEX IF NOT EXISTS idx_mt_deadline ON marketplace_tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_mt_assigned_worker ON marketplace_tasks(assigned_worker_id);
CREATE INDEX IF NOT EXISTS idx_mt_escrow ON marketplace_tasks(escrow_id);
CREATE INDEX IF NOT EXISTS idx_mt_sourced_by ON marketplace_tasks(sourced_by_user_id);
CREATE INDEX IF NOT EXISTS idx_mt_skills_required ON marketplace_tasks USING GIN(skills_required);
CREATE INDEX IF NOT EXISTS idx_mt_created ON marketplace_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mt_open ON marketplace_tasks(status, visibility) WHERE status IN ('posted', 'matched');

-- ============================================================================
-- 4. TASK_APPLICATIONS - Worker applications to tasks
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  task_id UUID NOT NULL REFERENCES marketplace_tasks(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES marketplace_workers(id) ON DELETE CASCADE,

  -- Application content
  cover_letter TEXT NOT NULL,
  proposed_rate DECIMAL(12,2), -- Their proposed rate
  proposed_rate_type TEXT DEFAULT 'fixed' CHECK (
    proposed_rate_type IN ('fixed', 'hourly', 'monthly')
  ),
  proposed_timeline TEXT, -- "2 weeks", "5 business days", etc.
  proposed_start_date DATE,

  -- Supporting materials
  relevant_portfolio_items JSONB DEFAULT '[]', -- Links to portfolio pieces
  attachments JSONB DEFAULT '[]',

  -- Application source
  application_source TEXT DEFAULT 'direct' CHECK (
    application_source IN ('direct', 'ai_match', 'invitation', 'referral')
  ),
  match_score DECIMAL(5,2), -- AI match confidence if applicable

  -- Status
  status TEXT DEFAULT 'pending' CHECK (
    status IN (
      'pending',        -- Awaiting review
      'shortlisted',    -- Poster interested
      'interviewing',   -- In discussion
      'accepted',       -- Awarded the task
      'rejected',       -- Not selected
      'withdrawn'       -- Worker withdrew
    )
  ),
  status_reason TEXT,

  -- Communication
  messages_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  shortlisted_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,

  UNIQUE(task_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_ma_task ON marketplace_applications(task_id);
CREATE INDEX IF NOT EXISTS idx_ma_worker ON marketplace_applications(worker_id);
CREATE INDEX IF NOT EXISTS idx_ma_status ON marketplace_applications(status);
CREATE INDEX IF NOT EXISTS idx_ma_source ON marketplace_applications(application_source);
CREATE INDEX IF NOT EXISTS idx_ma_match_score ON marketplace_applications(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_ma_created ON marketplace_applications(created_at DESC);

-- ============================================================================
-- 5. TASK_ASSIGNMENTS - Awarded tasks with milestones
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  task_id UUID NOT NULL REFERENCES marketplace_tasks(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES marketplace_workers(id) ON DELETE CASCADE,
  application_id UUID REFERENCES marketplace_applications(id),

  -- Agreed terms
  agreed_rate DECIMAL(12,2) NOT NULL,
  agreed_rate_type TEXT NOT NULL CHECK (
    agreed_rate_type IN ('fixed', 'hourly', 'monthly', 'milestone')
  ),
  agreed_currency TEXT DEFAULT 'USD',
  pay_in_grain BOOLEAN DEFAULT false,
  grain_conversion_rate DECIMAL(20,10), -- GRAIN price at agreement time

  -- Timeline
  start_date DATE NOT NULL,
  expected_end_date DATE,
  actual_end_date DATE,

  -- Contract details
  contract_type TEXT DEFAULT 'standard' CHECK (
    contract_type IN ('standard', 'nda', 'custom')
  ),
  contract_signed_at TIMESTAMPTZ,
  contract_document_url TEXT,

  -- Escrow
  escrow_id TEXT NOT NULL, -- Links to escrow_deals
  escrow_amount DECIMAL(20,2) NOT NULL,
  escrow_funded BOOLEAN DEFAULT false,
  escrow_funded_at TIMESTAMPTZ,

  -- Progress tracking
  total_milestones INTEGER DEFAULT 0,
  completed_milestones INTEGER DEFAULT 0,
  progress_percent DECIMAL(5,2) DEFAULT 0,

  -- Hours tracking (for hourly contracts)
  total_hours_logged DECIMAL(10,2) DEFAULT 0,
  hours_approved DECIMAL(10,2) DEFAULT 0,
  hours_pending DECIMAL(10,2) DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'pending_escrow' CHECK (
    status IN (
      'pending_escrow',  -- Waiting for escrow funding
      'active',          -- In progress
      'paused',          -- Temporarily paused
      'submitted',       -- Final work submitted
      'revision',        -- Revision requested
      'approved',        -- Work approved
      'completed',       -- All payments released
      'cancelled',       -- Cancelled
      'disputed'         -- In dispute resolution
    )
  ),
  status_reason TEXT,

  -- Ratings (after completion)
  poster_rating_of_worker DECIMAL(3,2),
  worker_rating_of_poster DECIMAL(3,2),

  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  UNIQUE(task_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_mass_task ON marketplace_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_mass_worker ON marketplace_assignments(worker_id);
CREATE INDEX IF NOT EXISTS idx_mass_status ON marketplace_assignments(status);
CREATE INDEX IF NOT EXISTS idx_mass_escrow ON marketplace_assignments(escrow_id);
CREATE INDEX IF NOT EXISTS idx_mass_start_date ON marketplace_assignments(start_date);
CREATE INDEX IF NOT EXISTS idx_mass_active ON marketplace_assignments(status) WHERE status = 'active';

-- ============================================================================
-- 6. TASK_MILESTONES - Deliverables with escrow amounts
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  assignment_id UUID NOT NULL REFERENCES marketplace_assignments(id) ON DELETE CASCADE,

  -- Milestone details
  sequence_number INTEGER NOT NULL, -- 1, 2, 3...
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  deliverables JSONB DEFAULT '[]', -- List of expected items

  -- Amount
  amount DECIMAL(20,2) NOT NULL,
  amount_currency TEXT DEFAULT 'USD',
  amount_in_grain DECIMAL(24,6), -- If paying in GRAIN

  -- Timeline
  due_date DATE,
  estimated_hours INTEGER,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (
    status IN (
      'pending',         -- Not started
      'in_progress',     -- Worker working on it
      'submitted',       -- Worker submitted
      'revision',        -- Needs changes
      'approved',        -- Poster approved
      'released',        -- Payment released
      'disputed'         -- In dispute
    )
  ),

  -- Escrow release
  escrow_release_id TEXT, -- escrow_transactions reference
  released_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,

  UNIQUE(assignment_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_mm_assignment ON marketplace_milestones(assignment_id);
CREATE INDEX IF NOT EXISTS idx_mm_status ON marketplace_milestones(status);
CREATE INDEX IF NOT EXISTS idx_mm_due_date ON marketplace_milestones(due_date);
CREATE INDEX IF NOT EXISTS idx_mm_pending_release ON marketplace_milestones(status) WHERE status = 'approved';

-- ============================================================================
-- 7. TASK_SUBMISSIONS - Worker submissions for milestones
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  milestone_id UUID NOT NULL REFERENCES marketplace_milestones(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES marketplace_assignments(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES marketplace_workers(id) ON DELETE CASCADE,

  -- Submission version
  version INTEGER DEFAULT 1,
  is_final BOOLEAN DEFAULT false,

  -- Content
  description TEXT NOT NULL,
  submission_notes TEXT,

  -- Deliverables
  deliverables JSONB DEFAULT '[]', -- Array of delivered items
  /*
    [
      {
        "type": "file",
        "name": "final_design.fig",
        "url": "https://...",
        "size_bytes": 1234567
      },
      {
        "type": "link",
        "name": "Staging Site",
        "url": "https://staging.example.com"
      },
      {
        "type": "text",
        "name": "Documentation",
        "content": "..."
      }
    ]
  */
  attachments JSONB DEFAULT '[]',

  -- Time tracking
  hours_logged DECIMAL(10,2),

  -- Review status
  status TEXT DEFAULT 'pending_review' CHECK (
    status IN (
      'pending_review',
      'approved',
      'revision_requested',
      'rejected'
    )
  ),

  -- Feedback
  reviewer_feedback TEXT,
  revision_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID, -- Poster user ID

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msub_milestone ON marketplace_submissions(milestone_id);
CREATE INDEX IF NOT EXISTS idx_msub_assignment ON marketplace_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_msub_worker ON marketplace_submissions(worker_id);
CREATE INDEX IF NOT EXISTS idx_msub_status ON marketplace_submissions(status);
CREATE INDEX IF NOT EXISTS idx_msub_created ON marketplace_submissions(created_at DESC);

-- ============================================================================
-- 8. TASK_REVIEWS - Two-way reviews (poster reviews worker, worker reviews poster)
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  task_id UUID NOT NULL REFERENCES marketplace_tasks(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES marketplace_assignments(id) ON DELETE CASCADE,

  -- Reviewer & reviewee
  reviewer_user_id UUID NOT NULL,
  reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('poster', 'worker')),
  reviewee_user_id UUID NOT NULL,

  -- Rating
  overall_rating DECIMAL(3,2) NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),

  -- Dimension ratings (1-5)
  communication_rating DECIMAL(3,2),
  quality_rating DECIMAL(3,2),
  timeliness_rating DECIMAL(3,2),
  professionalism_rating DECIMAL(3,2),
  value_rating DECIMAL(3,2), -- Value for money / fair compensation

  -- Review content
  review_title TEXT,
  review_text TEXT,

  -- Visibility
  is_public BOOLEAN DEFAULT true,

  -- Response
  response_text TEXT,
  response_at TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'published' CHECK (
    status IN ('pending_moderation', 'published', 'hidden', 'removed')
  ),
  moderation_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(assignment_id, reviewer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_mr_task ON marketplace_reviews(task_id);
CREATE INDEX IF NOT EXISTS idx_mr_assignment ON marketplace_reviews(assignment_id);
CREATE INDEX IF NOT EXISTS idx_mr_reviewer ON marketplace_reviews(reviewer_user_id);
CREATE INDEX IF NOT EXISTS idx_mr_reviewee ON marketplace_reviews(reviewee_user_id);
CREATE INDEX IF NOT EXISTS idx_mr_reviewer_type ON marketplace_reviews(reviewer_type);
CREATE INDEX IF NOT EXISTS idx_mr_rating ON marketplace_reviews(overall_rating DESC);
CREATE INDEX IF NOT EXISTS idx_mr_status ON marketplace_reviews(status);

-- ============================================================================
-- 9. WORKER_EARNINGS - GRAIN earnings history
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  worker_id UUID NOT NULL REFERENCES marketplace_workers(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES marketplace_tasks(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES marketplace_assignments(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES marketplace_milestones(id),

  -- Earning type
  earning_type TEXT NOT NULL CHECK (
    earning_type IN (
      'milestone_payment',   -- Regular milestone payment
      'hourly_payment',      -- Hourly work payment
      'completion_bonus',    -- Bonus for completion
      'tip',                 -- Tip from poster
      'referral_commission', -- Commission from referring workers
      'task_source_commission' -- Commission from sourcing tasks
    )
  ),

  -- Amounts
  gross_amount_usd DECIMAL(20,2) NOT NULL,
  platform_fee_usd DECIMAL(20,2) DEFAULT 0, -- Wells AI platform fee
  net_amount_usd DECIMAL(20,2) NOT NULL,

  -- GRAIN payment (if applicable)
  paid_in_grain BOOLEAN DEFAULT false,
  grain_amount DECIMAL(24,6),
  grain_price_at_payment DECIMAL(20,10),

  -- Attribution commissions deducted
  attribution_total_usd DECIMAL(20,2) DEFAULT 0,

  -- Transaction reference
  grain_transaction_id UUID, -- Links to grain_transactions
  escrow_transaction_id TEXT, -- Links to escrow_transactions

  -- Status
  status TEXT DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'reversed')
  ),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_me_worker ON marketplace_earnings(worker_id);
CREATE INDEX IF NOT EXISTS idx_me_task ON marketplace_earnings(task_id);
CREATE INDEX IF NOT EXISTS idx_me_assignment ON marketplace_earnings(assignment_id);
CREATE INDEX IF NOT EXISTS idx_me_milestone ON marketplace_earnings(milestone_id);
CREATE INDEX IF NOT EXISTS idx_me_type ON marketplace_earnings(earning_type);
CREATE INDEX IF NOT EXISTS idx_me_status ON marketplace_earnings(status);
CREATE INDEX IF NOT EXISTS idx_me_grain_tx ON marketplace_earnings(grain_transaction_id);
CREATE INDEX IF NOT EXISTS idx_me_created ON marketplace_earnings(created_at DESC);

-- ============================================================================
-- 10. WORKER_AVAILABILITY - Calendar/schedule data
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  worker_id UUID NOT NULL REFERENCES marketplace_workers(id) ON DELETE CASCADE,

  -- Availability type
  availability_type TEXT NOT NULL CHECK (
    availability_type IN (
      'available',      -- Open for work
      'busy',           -- Working on something
      'time_off',       -- Vacation/PTO
      'blocked',        -- Cannot work these times
      'preferred'       -- Preferred working hours
    )
  ),

  -- Time range
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT false,

  -- Recurring
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern TEXT, -- 'daily', 'weekly', 'monthly'
  recurrence_days TEXT[], -- ['monday', 'tuesday', 'wednesday']
  recurrence_end_date DATE,

  -- Context
  title TEXT,
  notes TEXT,
  task_id UUID REFERENCES marketplace_tasks(id), -- If blocked for specific task

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mav_worker ON marketplace_availability(worker_id);
CREATE INDEX IF NOT EXISTS idx_mav_type ON marketplace_availability(availability_type);
CREATE INDEX IF NOT EXISTS idx_mav_daterange ON marketplace_availability(start_datetime, end_datetime);
CREATE INDEX IF NOT EXISTS idx_mav_task ON marketplace_availability(task_id);
CREATE INDEX IF NOT EXISTS idx_mav_recurring ON marketplace_availability(is_recurring) WHERE is_recurring = true;

-- ============================================================================
-- 11. JOB_ATTRIBUTIONS - Individual-level attribution tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Attribution type
  attribution_type TEXT NOT NULL CHECK (
    attribution_type IN (
      'worker_referral',    -- Referred a worker to platform
      'task_source',        -- Sourced a task/client
      'deal_close',         -- Helped close a deal
      'milestone_bonus'     -- Bonus on milestone completion
    )
  ),

  -- The person receiving commission
  beneficiary_user_id UUID NOT NULL,
  beneficiary_type TEXT NOT NULL CHECK (
    beneficiary_type IN ('worker', 'sales_rep', 'partner', 'investor')
  ),

  -- The source of the attribution
  -- For worker referrals: the referred worker
  referred_worker_id UUID REFERENCES marketplace_workers(id),
  -- For task sourcing: the task
  sourced_task_id UUID REFERENCES marketplace_tasks(id),
  -- The assignment that generated this commission
  assignment_id UUID REFERENCES marketplace_assignments(id),
  milestone_id UUID REFERENCES marketplace_milestones(id),

  -- Commission structure
  commission_percent DECIMAL(5,2) NOT NULL, -- e.g., 5.00 for 5%
  commission_type TEXT DEFAULT 'percentage' CHECK (
    commission_type IN ('percentage', 'flat_fee', 'tiered')
  ),

  -- Attribution chain level (1 = direct, 2 = second level, etc.)
  attribution_level INTEGER DEFAULT 1,
  parent_attribution_id UUID REFERENCES marketplace_attributions(id), -- For chain tracking

  -- Amounts
  base_amount DECIMAL(20,2), -- Amount commission is calculated on
  commission_amount_usd DECIMAL(20,2),
  commission_amount_grain DECIMAL(24,6),
  grain_price DECIMAL(20,10),

  -- Status
  status TEXT DEFAULT 'pending' CHECK (
    status IN (
      'pending',      -- Awaiting trigger event
      'earned',       -- Earned, awaiting payment
      'processing',   -- Being paid out
      'paid',         -- Paid to beneficiary
      'voided'        -- Cancelled/reversed
    )
  ),

  -- Payment reference
  payout_earning_id UUID REFERENCES marketplace_earnings(id),
  grain_transaction_id UUID,

  -- Duration (for ongoing commissions)
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ, -- NULL = forever

  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  earned_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mattr_type ON marketplace_attributions(attribution_type);
CREATE INDEX IF NOT EXISTS idx_mattr_beneficiary ON marketplace_attributions(beneficiary_user_id);
CREATE INDEX IF NOT EXISTS idx_mattr_beneficiary_type ON marketplace_attributions(beneficiary_type);
CREATE INDEX IF NOT EXISTS idx_mattr_referred_worker ON marketplace_attributions(referred_worker_id);
CREATE INDEX IF NOT EXISTS idx_mattr_sourced_task ON marketplace_attributions(sourced_task_id);
CREATE INDEX IF NOT EXISTS idx_mattr_assignment ON marketplace_attributions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_mattr_status ON marketplace_attributions(status);
CREATE INDEX IF NOT EXISTS idx_mattr_parent ON marketplace_attributions(parent_attribution_id);
CREATE INDEX IF NOT EXISTS idx_mattr_level ON marketplace_attributions(attribution_level);
CREATE INDEX IF NOT EXISTS idx_mattr_created ON marketplace_attributions(created_at DESC);

-- Multi-level attribution chain table (for 4-level referral tracking)
CREATE TABLE IF NOT EXISTS marketplace_attribution_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The worker or task this chain is for
  chain_type TEXT NOT NULL CHECK (chain_type IN ('worker', 'task')),
  worker_id UUID REFERENCES marketplace_workers(id),
  task_id UUID REFERENCES marketplace_tasks(id),

  -- 4-level referral chain
  level_1_user_id UUID NOT NULL,
  level_1_percent DECIMAL(5,2) DEFAULT 5.00,

  level_2_user_id UUID,
  level_2_percent DECIMAL(5,2) DEFAULT 2.50,

  level_3_user_id UUID,
  level_3_percent DECIMAL(5,2) DEFAULT 1.25,

  level_4_user_id UUID,
  level_4_percent DECIMAL(5,2) DEFAULT 0.625,

  -- Totals
  total_commission_percent DECIMAL(5,2),
  total_paid_out_usd DECIMAL(20,2) DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(worker_id),
  UNIQUE(task_id)
);

CREATE INDEX IF NOT EXISTS idx_mac_worker ON marketplace_attribution_chains(worker_id);
CREATE INDEX IF NOT EXISTS idx_mac_task ON marketplace_attribution_chains(task_id);
CREATE INDEX IF NOT EXISTS idx_mac_l1 ON marketplace_attribution_chains(level_1_user_id);
CREATE INDEX IF NOT EXISTS idx_mac_l2 ON marketplace_attribution_chains(level_2_user_id);
CREATE INDEX IF NOT EXISTS idx_mac_l3 ON marketplace_attribution_chains(level_3_user_id);
CREATE INDEX IF NOT EXISTS idx_mac_l4 ON marketplace_attribution_chains(level_4_user_id);

-- ============================================================================
-- 12. PROACTIVE_JOB_MATCHES - AI-detected matches between workers and opportunities
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_proactive_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Match parties
  worker_id UUID NOT NULL REFERENCES marketplace_workers(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES marketplace_tasks(id) ON DELETE CASCADE,

  -- Match details
  match_score DECIMAL(5,2) NOT NULL, -- 0-100 confidence score
  match_type TEXT NOT NULL CHECK (
    match_type IN (
      'skill_match',      -- Skills align well
      'budget_match',     -- Rate expectations align
      'availability_match', -- Timing works
      'experience_match', -- Experience level fits
      'location_match',   -- Location/timezone fits
      'multi_factor'      -- Multiple factors combined
    )
  ),

  -- Match reasoning (for AI explainability)
  match_reasons JSONB DEFAULT '[]', -- Array of reasons
  /*
    [
      {"factor": "skills", "score": 95, "detail": "Expert in React, TypeScript"},
      {"factor": "rate", "score": 80, "detail": "Within budget range"},
      {"factor": "availability", "score": 100, "detail": "Immediately available"}
    ]
  */

  skill_overlap_percent DECIMAL(5,2), -- % of required skills matched
  rate_compatibility_score DECIMAL(5,2), -- How well rates align

  -- AI model info
  model_version TEXT,
  model_confidence DECIMAL(5,4),

  -- Status
  status TEXT DEFAULT 'new' CHECK (
    status IN (
      'new',              -- Just created
      'sent_to_worker',   -- Notified worker
      'worker_interested', -- Worker expressed interest
      'worker_declined',   -- Worker not interested
      'sent_to_poster',   -- Notified poster
      'poster_interested', -- Poster wants to proceed
      'poster_declined',   -- Poster not interested
      'converted',        -- Became an application
      'expired'           -- Match expired
    )
  ),

  -- Conversion tracking
  converted_to_application_id UUID REFERENCES marketplace_applications(id),

  -- Notifications
  worker_notified_at TIMESTAMPTZ,
  worker_notified_via TEXT, -- 'email', 'sms', 'push', 'in_app'
  worker_responded_at TIMESTAMPTZ,
  poster_notified_at TIMESTAMPTZ,
  poster_responded_at TIMESTAMPTZ,

  -- Expiry
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(worker_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_mpm_worker ON marketplace_proactive_matches(worker_id);
CREATE INDEX IF NOT EXISTS idx_mpm_task ON marketplace_proactive_matches(task_id);
CREATE INDEX IF NOT EXISTS idx_mpm_score ON marketplace_proactive_matches(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_mpm_type ON marketplace_proactive_matches(match_type);
CREATE INDEX IF NOT EXISTS idx_mpm_status ON marketplace_proactive_matches(status);
CREATE INDEX IF NOT EXISTS idx_mpm_expires ON marketplace_proactive_matches(expires_at);
CREATE INDEX IF NOT EXISTS idx_mpm_new ON marketplace_proactive_matches(status, created_at DESC) WHERE status = 'new';

-- ============================================================================
-- TRIGGERS - Auto-update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION marketplace_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_marketplace_workers_updated
  BEFORE UPDATE ON marketplace_workers
  FOR EACH ROW EXECUTE FUNCTION marketplace_update_timestamp();

CREATE TRIGGER trg_marketplace_worker_skills_updated
  BEFORE UPDATE ON marketplace_worker_skills
  FOR EACH ROW EXECUTE FUNCTION marketplace_update_timestamp();

CREATE TRIGGER trg_marketplace_tasks_updated
  BEFORE UPDATE ON marketplace_tasks
  FOR EACH ROW EXECUTE FUNCTION marketplace_update_timestamp();

CREATE TRIGGER trg_marketplace_applications_updated
  BEFORE UPDATE ON marketplace_applications
  FOR EACH ROW EXECUTE FUNCTION marketplace_update_timestamp();

CREATE TRIGGER trg_marketplace_assignments_updated
  BEFORE UPDATE ON marketplace_assignments
  FOR EACH ROW EXECUTE FUNCTION marketplace_update_timestamp();

CREATE TRIGGER trg_marketplace_milestones_updated
  BEFORE UPDATE ON marketplace_milestones
  FOR EACH ROW EXECUTE FUNCTION marketplace_update_timestamp();

CREATE TRIGGER trg_marketplace_reviews_updated
  BEFORE UPDATE ON marketplace_reviews
  FOR EACH ROW EXECUTE FUNCTION marketplace_update_timestamp();

CREATE TRIGGER trg_marketplace_availability_updated
  BEFORE UPDATE ON marketplace_availability
  FOR EACH ROW EXECUTE FUNCTION marketplace_update_timestamp();

CREATE TRIGGER trg_marketplace_attributions_updated
  BEFORE UPDATE ON marketplace_attributions
  FOR EACH ROW EXECUTE FUNCTION marketplace_update_timestamp();

CREATE TRIGGER trg_marketplace_attribution_chains_updated
  BEFORE UPDATE ON marketplace_attribution_chains
  FOR EACH ROW EXECUTE FUNCTION marketplace_update_timestamp();

CREATE TRIGGER trg_marketplace_proactive_matches_updated
  BEFORE UPDATE ON marketplace_proactive_matches
  FOR EACH ROW EXECUTE FUNCTION marketplace_update_timestamp();

-- ============================================================================
-- TRIGGER - Update worker stats after review
-- ============================================================================

CREATE OR REPLACE FUNCTION update_worker_stats_after_review()
RETURNS TRIGGER AS $$
DECLARE
  v_worker_id UUID;
  v_new_avg DECIMAL(3,2);
  v_rating_count INTEGER;
BEGIN
  -- Get the worker ID from the assignment
  SELECT worker_id INTO v_worker_id
  FROM marketplace_assignments
  WHERE id = NEW.assignment_id;

  -- Calculate new average rating
  SELECT
    ROUND(AVG(overall_rating)::DECIMAL, 2),
    COUNT(*)
  INTO v_new_avg, v_rating_count
  FROM marketplace_reviews
  WHERE reviewer_type = 'poster'
    AND reviewee_user_id IN (
      SELECT user_id FROM marketplace_workers WHERE id = v_worker_id
    )
    AND status = 'published';

  -- Update worker profile
  UPDATE marketplace_workers
  SET
    avg_rating = COALESCE(v_new_avg, 0),
    rating_count = COALESCE(v_rating_count, 0),
    updated_at = NOW()
  WHERE id = v_worker_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_worker_stats
  AFTER INSERT OR UPDATE ON marketplace_reviews
  FOR EACH ROW
  WHEN (NEW.reviewer_type = 'poster' AND NEW.status = 'published')
  EXECUTE FUNCTION update_worker_stats_after_review();

-- ============================================================================
-- TRIGGER - Update worker earnings after milestone completion
-- ============================================================================

CREATE OR REPLACE FUNCTION update_worker_earnings_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE marketplace_workers
    SET
      total_earned_usd = total_earned_usd + NEW.net_amount_usd,
      total_earned_grain = total_earned_grain + COALESCE(NEW.grain_amount, 0),
      updated_at = NOW()
    WHERE id = NEW.worker_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_worker_earnings
  AFTER UPDATE ON marketplace_earnings
  FOR EACH ROW EXECUTE FUNCTION update_worker_earnings_stats();

-- ============================================================================
-- TRIGGER - Update task status counts
-- ============================================================================

CREATE OR REPLACE FUNCTION update_task_application_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE marketplace_tasks
    SET application_count = application_count + 1
    WHERE id = NEW.task_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE marketplace_tasks
    SET application_count = GREATEST(0, application_count - 1)
    WHERE id = OLD.task_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_application_count
  AFTER INSERT OR DELETE ON marketplace_applications
  FOR EACH ROW EXECUTE FUNCTION update_task_application_count();

-- ============================================================================
-- VIEWS - Useful aggregated data
-- ============================================================================

-- Active open tasks with match potential
CREATE OR REPLACE VIEW marketplace_open_tasks AS
SELECT
  t.*,
  (SELECT COUNT(*) FROM marketplace_applications a WHERE a.task_id = t.id AND a.status = 'pending') as pending_applications,
  (SELECT COUNT(*) FROM marketplace_proactive_matches m WHERE m.task_id = t.id AND m.status = 'new') as ai_matches
FROM marketplace_tasks t
WHERE t.status IN ('posted', 'matched', 'reviewing')
  AND t.visibility = 'public'
ORDER BY t.urgency DESC, t.created_at DESC;

-- Worker leaderboard
CREATE OR REPLACE VIEW marketplace_worker_leaderboard AS
SELECT
  w.id,
  w.display_name,
  w.headline,
  w.avatar_url,
  w.country,
  w.hourly_rate_min,
  w.hourly_rate_max,
  w.avg_rating,
  w.rating_count,
  w.total_tasks_completed,
  w.total_earned_usd,
  w.on_time_delivery_rate,
  w.verification_status,
  w.featured,
  (SELECT array_agg(DISTINCT st.name)
   FROM marketplace_worker_skills ws
   JOIN marketplace_skill_tags st ON ws.skill_id = st.id
   WHERE ws.worker_id = w.id
   LIMIT 5) as top_skills
FROM marketplace_workers w
WHERE w.status = 'active'
  AND w.availability_status IN ('available', 'limited')
ORDER BY w.featured DESC, w.avg_rating DESC, w.total_tasks_completed DESC;

-- Pending payouts
CREATE OR REPLACE VIEW marketplace_pending_payouts AS
SELECT
  e.worker_id,
  w.display_name as worker_name,
  w.email as worker_email,
  SUM(e.net_amount_usd) as total_pending_usd,
  SUM(e.grain_amount) as total_pending_grain,
  COUNT(*) as pending_count
FROM marketplace_earnings e
JOIN marketplace_workers w ON e.worker_id = w.id
WHERE e.status = 'pending'
GROUP BY e.worker_id, w.display_name, w.email
ORDER BY total_pending_usd DESC;

-- Attribution leaderboard
CREATE OR REPLACE VIEW marketplace_attribution_leaderboard AS
SELECT
  a.beneficiary_user_id,
  a.beneficiary_type,
  COUNT(*) FILTER (WHERE a.status = 'paid') as paid_attributions,
  COUNT(*) FILTER (WHERE a.status = 'earned') as pending_attributions,
  SUM(a.commission_amount_usd) FILTER (WHERE a.status = 'paid') as total_earned_usd,
  SUM(a.commission_amount_usd) FILTER (WHERE a.status = 'earned') as pending_usd,
  COUNT(DISTINCT a.referred_worker_id) as workers_referred,
  COUNT(DISTINCT a.sourced_task_id) as tasks_sourced
FROM marketplace_attributions a
WHERE a.status IN ('paid', 'earned')
GROUP BY a.beneficiary_user_id, a.beneficiary_type
ORDER BY total_earned_usd DESC NULLS LAST;

-- ============================================================================
-- FUNCTIONS - Helper functions
-- ============================================================================

-- Generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code(p_prefix TEXT DEFAULT 'W')
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate code: prefix + 6 random alphanumeric chars
    v_code := p_prefix || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

    -- Check if exists
    SELECT EXISTS(
      SELECT 1 FROM marketplace_workers WHERE referral_code = v_code
    ) INTO v_exists;

    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Calculate match score between worker and task
CREATE OR REPLACE FUNCTION calculate_match_score(
  p_worker_id UUID,
  p_task_id UUID
) RETURNS TABLE (
  score DECIMAL(5,2),
  skill_score DECIMAL(5,2),
  rate_score DECIMAL(5,2),
  availability_score DECIMAL(5,2),
  experience_score DECIMAL(5,2),
  reasons JSONB
) AS $$
DECLARE
  v_worker RECORD;
  v_task RECORD;
  v_skill_overlap INTEGER;
  v_required_skills INTEGER;
  v_skill_score DECIMAL(5,2);
  v_rate_score DECIMAL(5,2);
  v_avail_score DECIMAL(5,2);
  v_exp_score DECIMAL(5,2);
  v_total_score DECIMAL(5,2);
  v_reasons JSONB := '[]'::JSONB;
BEGIN
  -- Get worker
  SELECT * INTO v_worker FROM marketplace_workers WHERE id = p_worker_id;

  -- Get task
  SELECT * INTO v_task FROM marketplace_tasks WHERE id = p_task_id;

  IF v_worker IS NULL OR v_task IS NULL THEN
    RETURN QUERY SELECT 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, '[]'::JSONB;
    RETURN;
  END IF;

  -- Calculate skill match
  SELECT COUNT(*) INTO v_required_skills
  FROM unnest(v_task.skills_required) AS skill_id;

  IF v_required_skills > 0 THEN
    SELECT COUNT(*) INTO v_skill_overlap
    FROM marketplace_worker_skills ws
    WHERE ws.worker_id = p_worker_id
      AND ws.skill_id = ANY(v_task.skills_required);

    v_skill_score := LEAST(100, (v_skill_overlap::DECIMAL / v_required_skills::DECIMAL) * 100);
  ELSE
    v_skill_score := 50; -- Neutral if no skills required
  END IF;

  -- Calculate rate compatibility
  IF v_task.budget_type = 'hourly' AND v_worker.hourly_rate_min IS NOT NULL THEN
    IF v_worker.hourly_rate_min <= v_task.budget_max AND
       v_worker.hourly_rate_max >= v_task.budget_min THEN
      v_rate_score := 100;
    ELSIF v_worker.hourly_rate_min <= v_task.budget_max * 1.2 THEN
      v_rate_score := 70;
    ELSE
      v_rate_score := 30;
    END IF;
  ELSIF v_task.budget_type = 'fixed' AND v_worker.project_rate_min IS NOT NULL THEN
    IF v_worker.project_rate_min <= v_task.budget_max THEN
      v_rate_score := 100;
    ELSE
      v_rate_score := 40;
    END IF;
  ELSE
    v_rate_score := 50;
  END IF;

  -- Calculate availability score
  IF v_worker.availability_status = 'available' THEN
    v_avail_score := 100;
  ELSIF v_worker.availability_status = 'limited' THEN
    v_avail_score := 70;
  ELSIF v_worker.availability_status = 'busy' THEN
    v_avail_score := 30;
  ELSE
    v_avail_score := 0;
  END IF;

  -- Calculate experience score based on rating and completed tasks
  v_exp_score := LEAST(100,
    (COALESCE(v_worker.avg_rating, 0) * 15) +
    (LEAST(v_worker.total_tasks_completed, 20) * 2.5)
  );

  -- Check verification requirement
  IF v_task.verification_required = 'elite' AND v_worker.verification_status != 'elite' THEN
    v_exp_score := v_exp_score * 0.5;
  ELSIF v_task.verification_required = 'background_checked' AND
        v_worker.verification_status NOT IN ('background_checked', 'elite') THEN
    v_exp_score := v_exp_score * 0.6;
  END IF;

  -- Calculate total score (weighted average)
  v_total_score := (v_skill_score * 0.35) + (v_rate_score * 0.25) +
                   (v_avail_score * 0.20) + (v_exp_score * 0.20);

  -- Build reasons
  v_reasons := jsonb_build_array(
    jsonb_build_object('factor', 'skills', 'score', v_skill_score,
      'detail', format('%s of %s required skills', v_skill_overlap, v_required_skills)),
    jsonb_build_object('factor', 'rate', 'score', v_rate_score,
      'detail', format('Rate range $%s-$%s', v_worker.hourly_rate_min, v_worker.hourly_rate_max)),
    jsonb_build_object('factor', 'availability', 'score', v_avail_score,
      'detail', v_worker.availability_status),
    jsonb_build_object('factor', 'experience', 'score', v_exp_score,
      'detail', format('%s tasks, %s avg rating', v_worker.total_tasks_completed, v_worker.avg_rating))
  );

  RETURN QUERY SELECT v_total_score, v_skill_score, v_rate_score, v_avail_score, v_exp_score, v_reasons;
END;
$$ LANGUAGE plpgsql;

-- Process attribution payout for a milestone
CREATE OR REPLACE FUNCTION process_milestone_attributions(
  p_milestone_id UUID,
  p_base_amount DECIMAL(20,2)
) RETURNS TABLE (
  attribution_id UUID,
  beneficiary_user_id UUID,
  commission_usd DECIMAL(20,2),
  level INTEGER
) AS $$
DECLARE
  v_assignment RECORD;
  v_chain RECORD;
  v_commission DECIMAL(20,2);
  v_new_attribution_id UUID;
BEGIN
  -- Get assignment and worker
  SELECT a.*, w.id as worker_id
  INTO v_assignment
  FROM marketplace_milestones m
  JOIN marketplace_assignments a ON m.assignment_id = a.id
  JOIN marketplace_workers w ON a.worker_id = w.id
  WHERE m.id = p_milestone_id;

  IF v_assignment IS NULL THEN
    RETURN;
  END IF;

  -- Get attribution chain for this worker
  SELECT * INTO v_chain
  FROM marketplace_attribution_chains
  WHERE worker_id = v_assignment.worker_id
    AND is_active = true;

  IF v_chain IS NULL THEN
    RETURN;
  END IF;

  -- Process Level 1
  IF v_chain.level_1_user_id IS NOT NULL THEN
    v_commission := p_base_amount * (v_chain.level_1_percent / 100);

    INSERT INTO marketplace_attributions (
      attribution_type, beneficiary_user_id, beneficiary_type,
      referred_worker_id, milestone_id, assignment_id,
      commission_percent, attribution_level,
      base_amount, commission_amount_usd, status
    ) VALUES (
      'worker_referral', v_chain.level_1_user_id, 'worker',
      v_assignment.worker_id, p_milestone_id, v_assignment.id,
      v_chain.level_1_percent, 1,
      p_base_amount, v_commission, 'earned'
    ) RETURNING id INTO v_new_attribution_id;

    RETURN QUERY SELECT v_new_attribution_id, v_chain.level_1_user_id, v_commission, 1;
  END IF;

  -- Process Level 2
  IF v_chain.level_2_user_id IS NOT NULL THEN
    v_commission := p_base_amount * (v_chain.level_2_percent / 100);

    INSERT INTO marketplace_attributions (
      attribution_type, beneficiary_user_id, beneficiary_type,
      referred_worker_id, milestone_id, assignment_id,
      commission_percent, attribution_level,
      base_amount, commission_amount_usd, status
    ) VALUES (
      'worker_referral', v_chain.level_2_user_id, 'worker',
      v_assignment.worker_id, p_milestone_id, v_assignment.id,
      v_chain.level_2_percent, 2,
      p_base_amount, v_commission, 'earned'
    ) RETURNING id INTO v_new_attribution_id;

    RETURN QUERY SELECT v_new_attribution_id, v_chain.level_2_user_id, v_commission, 2;
  END IF;

  -- Process Level 3
  IF v_chain.level_3_user_id IS NOT NULL THEN
    v_commission := p_base_amount * (v_chain.level_3_percent / 100);

    INSERT INTO marketplace_attributions (
      attribution_type, beneficiary_user_id, beneficiary_type,
      referred_worker_id, milestone_id, assignment_id,
      commission_percent, attribution_level,
      base_amount, commission_amount_usd, status
    ) VALUES (
      'worker_referral', v_chain.level_3_user_id, 'worker',
      v_assignment.worker_id, p_milestone_id, v_assignment.id,
      v_chain.level_3_percent, 3,
      p_base_amount, v_commission, 'earned'
    ) RETURNING id INTO v_new_attribution_id;

    RETURN QUERY SELECT v_new_attribution_id, v_chain.level_3_user_id, v_commission, 3;
  END IF;

  -- Process Level 4
  IF v_chain.level_4_user_id IS NOT NULL THEN
    v_commission := p_base_amount * (v_chain.level_4_percent / 100);

    INSERT INTO marketplace_attributions (
      attribution_type, beneficiary_user_id, beneficiary_type,
      referred_worker_id, milestone_id, assignment_id,
      commission_percent, attribution_level,
      base_amount, commission_amount_usd, status
    ) VALUES (
      'worker_referral', v_chain.level_4_user_id, 'worker',
      v_assignment.worker_id, p_milestone_id, v_assignment.id,
      v_chain.level_4_percent, 4,
      p_base_amount, v_commission, 'earned'
    ) RETURNING id INTO v_new_attribution_id;

    RETURN QUERY SELECT v_new_attribution_id, v_chain.level_4_user_id, v_commission, 4;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED DATA - Skill Tags
-- ============================================================================

INSERT INTO marketplace_skill_tags (name, slug, category, suggested_hourly_rate_min, suggested_hourly_rate_max, demand_score) VALUES
  -- Development
  ('JavaScript', 'javascript', 'development', 50, 150, 95),
  ('TypeScript', 'typescript', 'development', 60, 175, 90),
  ('React', 'react', 'development', 65, 180, 92),
  ('Next.js', 'nextjs', 'development', 70, 200, 88),
  ('Node.js', 'nodejs', 'development', 60, 175, 90),
  ('Python', 'python', 'development', 55, 175, 93),
  ('PostgreSQL', 'postgresql', 'development', 60, 160, 85),
  ('AWS', 'aws', 'development', 75, 200, 88),
  ('Docker', 'docker', 'development', 65, 175, 82),
  ('GraphQL', 'graphql', 'development', 70, 180, 78),

  -- Design
  ('UI Design', 'ui-design', 'design', 50, 150, 88),
  ('UX Design', 'ux-design', 'design', 55, 175, 90),
  ('Figma', 'figma', 'design', 45, 140, 92),
  ('Brand Design', 'brand-design', 'design', 60, 200, 75),
  ('Motion Graphics', 'motion-graphics', 'design', 55, 175, 70),

  -- Writing
  ('Technical Writing', 'technical-writing', 'writing', 40, 120, 78),
  ('Content Strategy', 'content-strategy', 'writing', 50, 150, 75),
  ('Copywriting', 'copywriting', 'writing', 45, 140, 80),
  ('SEO Writing', 'seo-writing', 'writing', 35, 100, 72),

  -- Marketing
  ('SEO', 'seo', 'marketing', 45, 150, 82),
  ('PPC', 'ppc', 'marketing', 50, 160, 78),
  ('Social Media', 'social-media', 'marketing', 35, 100, 75),
  ('Email Marketing', 'email-marketing', 'marketing', 40, 120, 70),

  -- Data
  ('Data Analysis', 'data-analysis', 'data', 55, 160, 88),
  ('Machine Learning', 'machine-learning', 'data', 80, 250, 85),
  ('Data Visualization', 'data-visualization', 'data', 50, 140, 75),

  -- Business
  ('Financial Modeling', 'financial-modeling', 'business', 75, 200, 80),
  ('Business Analysis', 'business-analysis', 'business', 60, 175, 78),
  ('Project Management', 'project-management', 'business', 55, 150, 82),
  ('Virtual Assistant', 'virtual-assistant', 'business', 20, 50, 85)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE marketplace_workers IS 'Worker profiles with skills, rates, and verification status';
COMMENT ON TABLE marketplace_skill_tags IS 'Skill taxonomy with categories and rate benchmarks';
COMMENT ON TABLE marketplace_worker_skills IS 'Many-to-many worker skills with proficiency levels';
COMMENT ON TABLE marketplace_tasks IS 'Posted tasks/gigs from buyers, sellers, and founders';
COMMENT ON TABLE marketplace_applications IS 'Worker applications to tasks';
COMMENT ON TABLE marketplace_assignments IS 'Awarded task assignments with escrow integration';
COMMENT ON TABLE marketplace_milestones IS 'Task milestones with individual escrow releases';
COMMENT ON TABLE marketplace_submissions IS 'Worker deliverable submissions for milestones';
COMMENT ON TABLE marketplace_reviews IS 'Two-way reviews between posters and workers';
COMMENT ON TABLE marketplace_earnings IS 'GRAIN/USD earnings history for workers';
COMMENT ON TABLE marketplace_availability IS 'Worker calendar and schedule data';
COMMENT ON TABLE marketplace_attributions IS 'Individual-level commission tracking';
COMMENT ON TABLE marketplace_attribution_chains IS 'Multi-level referral chains (4 levels)';
COMMENT ON TABLE marketplace_proactive_matches IS 'AI-detected worker-task matches';

COMMENT ON FUNCTION calculate_match_score IS 'Calculate AI match score between a worker and task';
COMMENT ON FUNCTION process_milestone_attributions IS 'Calculate and create attribution payouts for a milestone';
COMMENT ON FUNCTION generate_referral_code IS 'Generate unique referral code for workers';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
