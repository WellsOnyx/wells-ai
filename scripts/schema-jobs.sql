-- Wells AI Job Seeker Journey Schema
-- High-End Mechanical Turk for Buyers, Sellers, and Founders
-- Created: 2025-12-19

-- ============================================
-- 1. WORKER PROFILES
-- ============================================
CREATE TABLE IF NOT EXISTS worker_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    bio TEXT,
    avatar_url TEXT,

    -- Skills and rates
    skills TEXT[] DEFAULT '{}',
    hourly_rate DECIMAL(10, 2),
    min_project_rate DECIMAL(10, 2),

    -- Availability
    availability_status VARCHAR(20) DEFAULT 'available'
        CHECK (availability_status IN ('available', 'busy', 'unavailable')),
    availability_hours_per_week INTEGER DEFAULT 40,
    preferred_task_types TEXT[] DEFAULT '{}',

    -- Location
    timezone VARCHAR(50),
    location VARCHAR(255),

    -- Stats
    total_tasks_completed INTEGER DEFAULT 0,
    total_earned DECIMAL(12, 2) DEFAULT 0,
    avg_rating DECIMAL(3, 2) DEFAULT 0,

    -- Verification and status
    verified_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'suspended', 'inactive')),

    -- Attribution (referral system)
    attribution_code VARCHAR(20) UNIQUE,
    referred_by_user_id UUID,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for worker_profiles
CREATE INDEX IF NOT EXISTS idx_worker_profiles_user_id ON worker_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_status ON worker_profiles(status);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_availability ON worker_profiles(availability_status);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_skills ON worker_profiles USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_attribution_code ON worker_profiles(attribution_code);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_referred_by ON worker_profiles(referred_by_user_id);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_avg_rating ON worker_profiles(avg_rating DESC);

-- ============================================
-- 2. TASK CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS task_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES task_categories(id) ON DELETE SET NULL,
    suggested_hourly_rate DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for task_categories
CREATE INDEX IF NOT EXISTS idx_task_categories_parent ON task_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_task_categories_active ON task_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_task_categories_name ON task_categories(name);

-- ============================================
-- 3. TASKS
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poster_user_id UUID NOT NULL,
    poster_type VARCHAR(20) NOT NULL
        CHECK (poster_type IN ('buyer', 'seller', 'founder')),

    -- Task details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES task_categories(id) ON DELETE SET NULL,

    -- Task type
    task_type VARCHAR(20) NOT NULL DEFAULT 'micro'
        CHECK (task_type IN ('micro', 'project', 'ongoing')),

    -- Requirements
    skills_required TEXT[] DEFAULT '{}',

    -- Budget
    budget_type VARCHAR(10) NOT NULL DEFAULT 'fixed'
        CHECK (budget_type IN ('fixed', 'hourly')),
    budget_amount DECIMAL(12, 2) NOT NULL,
    budget_currency VARCHAR(3) DEFAULT 'USD',

    -- Timeline
    estimated_hours INTEGER,
    deadline TIMESTAMP WITH TIME ZONE,

    -- Escrow link
    escrow_id UUID,

    -- Status
    status VARCHAR(20) DEFAULT 'draft'
        CHECK (status IN ('draft', 'open', 'assigned', 'in_progress', 'submitted', 'completed', 'cancelled')),

    -- Visibility
    visibility VARCHAR(20) DEFAULT 'public'
        CHECK (visibility IN ('public', 'invite_only', 'matched_only')),

    -- AI matching
    auto_match_enabled BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for tasks
CREATE INDEX IF NOT EXISTS idx_tasks_poster_user_id ON tasks(poster_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_poster_type ON tasks(poster_type);
CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_visibility ON tasks(visibility);
CREATE INDEX IF NOT EXISTS idx_tasks_skills_required ON tasks USING GIN(skills_required);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_budget ON tasks(budget_amount);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_escrow_id ON tasks(escrow_id);

-- Composite index for open task searches
CREATE INDEX IF NOT EXISTS idx_tasks_open_search ON tasks(status, visibility, task_type) WHERE status = 'open';

-- ============================================
-- 4. TASK APPLICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS task_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,

    -- Application details
    cover_message TEXT,
    proposed_rate DECIMAL(10, 2),
    proposed_timeline VARCHAR(100),

    -- Status
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure one application per worker per task
    UNIQUE(task_id, worker_id)
);

-- Indexes for task_applications
CREATE INDEX IF NOT EXISTS idx_task_applications_task_id ON task_applications(task_id);
CREATE INDEX IF NOT EXISTS idx_task_applications_worker_id ON task_applications(worker_id);
CREATE INDEX IF NOT EXISTS idx_task_applications_status ON task_applications(status);
CREATE INDEX IF NOT EXISTS idx_task_applications_created_at ON task_applications(created_at DESC);

-- ============================================
-- 5. TASK ASSIGNMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    application_id UUID REFERENCES task_applications(id) ON DELETE SET NULL,

    -- Agreed terms
    agreed_rate DECIMAL(10, 2) NOT NULL,
    agreed_timeline VARCHAR(100),

    -- Escrow
    escrow_transaction_id UUID,

    -- Timeline
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_at TIMESTAMP WITH TIME ZONE,

    -- Status
    status VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure one active assignment per task
    UNIQUE(task_id, worker_id)
);

-- Indexes for task_assignments
CREATE INDEX IF NOT EXISTS idx_task_assignments_task_id ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_worker_id ON task_assignments(worker_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_status ON task_assignments(status);
CREATE INDEX IF NOT EXISTS idx_task_assignments_due_at ON task_assignments(due_at);
CREATE INDEX IF NOT EXISTS idx_task_assignments_escrow ON task_assignments(escrow_transaction_id);

-- ============================================
-- 6. TASK DELIVERABLES
-- ============================================
CREATE TABLE IF NOT EXISTS task_deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES task_assignments(id) ON DELETE CASCADE,

    -- Deliverable content
    description TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',

    -- Submission
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Review status
    status VARCHAR(20) DEFAULT 'pending_review'
        CHECK (status IN ('pending_review', 'approved', 'revision_requested', 'rejected')),
    reviewer_notes TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for task_deliverables
CREATE INDEX IF NOT EXISTS idx_task_deliverables_assignment_id ON task_deliverables(assignment_id);
CREATE INDEX IF NOT EXISTS idx_task_deliverables_status ON task_deliverables(status);
CREATE INDEX IF NOT EXISTS idx_task_deliverables_submitted_at ON task_deliverables(submitted_at DESC);

-- ============================================
-- 7. TASK REVIEWS
-- ============================================
CREATE TABLE IF NOT EXISTS task_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    reviewer_user_id UUID NOT NULL,
    reviewee_user_id UUID NOT NULL,

    -- Review content
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,

    -- Review type
    review_type VARCHAR(20) NOT NULL
        CHECK (review_type IN ('poster_of_worker', 'worker_of_poster')),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure one review per direction per task
    UNIQUE(task_id, reviewer_user_id, reviewee_user_id)
);

-- Indexes for task_reviews
CREATE INDEX IF NOT EXISTS idx_task_reviews_task_id ON task_reviews(task_id);
CREATE INDEX IF NOT EXISTS idx_task_reviews_reviewer ON task_reviews(reviewer_user_id);
CREATE INDEX IF NOT EXISTS idx_task_reviews_reviewee ON task_reviews(reviewee_user_id);
CREATE INDEX IF NOT EXISTS idx_task_reviews_rating ON task_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_task_reviews_type ON task_reviews(review_type);

-- ============================================
-- 8. WORKER EARNINGS
-- ============================================
CREATE TABLE IF NOT EXISTS worker_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES task_assignments(id) ON DELETE SET NULL,

    -- Amounts (in GRAIN)
    gross_amount DECIMAL(12, 2) NOT NULL,
    platform_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
    net_amount DECIMAL(12, 2) NOT NULL,

    -- Attribution payout
    attribution_payout DECIMAL(12, 2) DEFAULT 0,

    -- GRAIN transaction reference
    grain_transaction_id UUID,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for worker_earnings
CREATE INDEX IF NOT EXISTS idx_worker_earnings_worker_id ON worker_earnings(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_earnings_task_id ON worker_earnings(task_id);
CREATE INDEX IF NOT EXISTS idx_worker_earnings_assignment_id ON worker_earnings(assignment_id);
CREATE INDEX IF NOT EXISTS idx_worker_earnings_grain_tx ON worker_earnings(grain_transaction_id);
CREATE INDEX IF NOT EXISTS idx_worker_earnings_created_at ON worker_earnings(created_at DESC);

-- ============================================
-- 9. WORKER ATTRIBUTION (4-Level Referral Chain)
-- ============================================
CREATE TABLE IF NOT EXISTS worker_attribution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL UNIQUE REFERENCES worker_profiles(id) ON DELETE CASCADE,

    -- Level 1 (Direct referrer)
    l1_user_id UUID,
    l1_share_percent DECIMAL(5, 2) DEFAULT 5.00,

    -- Level 2
    l2_user_id UUID,
    l2_share_percent DECIMAL(5, 2) DEFAULT 2.50,

    -- Level 3
    l3_user_id UUID,
    l3_share_percent DECIMAL(5, 2) DEFAULT 1.25,

    -- Level 4
    l4_user_id UUID,
    l4_share_percent DECIMAL(5, 2) DEFAULT 0.625,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for worker_attribution
CREATE INDEX IF NOT EXISTS idx_worker_attribution_worker_id ON worker_attribution(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_attribution_l1 ON worker_attribution(l1_user_id);
CREATE INDEX IF NOT EXISTS idx_worker_attribution_l2 ON worker_attribution(l2_user_id);
CREATE INDEX IF NOT EXISTS idx_worker_attribution_l3 ON worker_attribution(l3_user_id);
CREATE INDEX IF NOT EXISTS idx_worker_attribution_l4 ON worker_attribution(l4_user_id);

-- ============================================
-- 10. PROACTIVE OPPORTUNITIES (AI-Detected)
-- ============================================
CREATE TABLE IF NOT EXISTS proactive_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source
    source_type VARCHAR(20) NOT NULL
        CHECK (source_type IN ('buyer_need', 'seller_need', 'founder_stage')),
    source_user_id UUID NOT NULL,
    source_context JSONB DEFAULT '{}',

    -- AI-suggested task
    suggested_task_title VARCHAR(255) NOT NULL,
    suggested_task_description TEXT,
    suggested_skills TEXT[] DEFAULT '{}',
    suggested_budget DECIMAL(12, 2),

    -- Matched workers
    matched_workers UUID[] DEFAULT '{}',

    -- Status
    status VARCHAR(20) DEFAULT 'new'
        CHECK (status IN ('new', 'converted', 'dismissed')),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for proactive_opportunities
CREATE INDEX IF NOT EXISTS idx_proactive_opportunities_source_type ON proactive_opportunities(source_type);
CREATE INDEX IF NOT EXISTS idx_proactive_opportunities_source_user ON proactive_opportunities(source_user_id);
CREATE INDEX IF NOT EXISTS idx_proactive_opportunities_status ON proactive_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_proactive_opportunities_skills ON proactive_opportunities USING GIN(suggested_skills);
CREATE INDEX IF NOT EXISTS idx_proactive_opportunities_matched ON proactive_opportunities USING GIN(matched_workers);
CREATE INDEX IF NOT EXISTS idx_proactive_opportunities_created_at ON proactive_opportunities(created_at DESC);

-- ============================================
-- TRIGGER: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
DROP TRIGGER IF EXISTS update_worker_profiles_updated_at ON worker_profiles;
CREATE TRIGGER update_worker_profiles_updated_at
    BEFORE UPDATE ON worker_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED: Default Task Categories
-- ============================================
INSERT INTO task_categories (name, description, suggested_hourly_rate, is_active) VALUES
    ('Data Entry', 'Basic data entry and form filling tasks', 15.00, true),
    ('Research', 'Market research, competitive analysis, data gathering', 25.00, true),
    ('Writing', 'Content writing, copywriting, editing', 35.00, true),
    ('Design', 'Graphic design, UI/UX, illustrations', 50.00, true),
    ('Development', 'Software development, scripting, automation', 75.00, true),
    ('Analysis', 'Data analysis, financial modeling, reporting', 60.00, true),
    ('Admin Support', 'Virtual assistance, scheduling, coordination', 20.00, true),
    ('Sales Support', 'Lead generation, outreach, CRM management', 30.00, true),
    ('Customer Service', 'Support tickets, chat support, phone support', 18.00, true),
    ('Translation', 'Document translation, localization', 40.00, true)
ON CONFLICT DO NOTHING;

-- Add subcategories
INSERT INTO task_categories (name, description, parent_id, suggested_hourly_rate, is_active)
SELECT 'Web Development', 'Frontend and backend web development', id, 80.00, true
FROM task_categories WHERE name = 'Development'
ON CONFLICT DO NOTHING;

INSERT INTO task_categories (name, description, parent_id, suggested_hourly_rate, is_active)
SELECT 'Mobile Development', 'iOS and Android app development', id, 85.00, true
FROM task_categories WHERE name = 'Development'
ON CONFLICT DO NOTHING;

INSERT INTO task_categories (name, description, parent_id, suggested_hourly_rate, is_active)
SELECT 'Logo Design', 'Brand logos and identity design', id, 60.00, true
FROM task_categories WHERE name = 'Design'
ON CONFLICT DO NOTHING;

INSERT INTO task_categories (name, description, parent_id, suggested_hourly_rate, is_active)
SELECT 'Blog Writing', 'Blog posts and articles', id, 30.00, true
FROM task_categories WHERE name = 'Writing'
ON CONFLICT DO NOTHING;

-- ============================================
-- COMMENTS for documentation
-- ============================================
COMMENT ON TABLE worker_profiles IS 'Worker registration and profiles for the job seeker platform';
COMMENT ON TABLE task_categories IS 'Hierarchical categories for task classification';
COMMENT ON TABLE tasks IS 'Posted work opportunities from buyers, sellers, and founders';
COMMENT ON TABLE task_applications IS 'Worker applications to open tasks';
COMMENT ON TABLE task_assignments IS 'Active work assignments linking workers to tasks';
COMMENT ON TABLE task_deliverables IS 'Submitted work and deliverables for review';
COMMENT ON TABLE task_reviews IS 'Bidirectional ratings between posters and workers';
COMMENT ON TABLE worker_earnings IS 'GRAIN earnings history for workers';
COMMENT ON TABLE worker_attribution IS '4-level referral attribution chain for workers';
COMMENT ON TABLE proactive_opportunities IS 'AI-detected opportunities from user activity';

COMMENT ON COLUMN worker_profiles.attribution_code IS 'Unique referral code for recruiting new workers';
COMMENT ON COLUMN worker_profiles.referred_by_user_id IS 'User who referred this worker to the platform';
COMMENT ON COLUMN tasks.poster_type IS 'Type of user posting: buyer, seller, or founder';
COMMENT ON COLUMN tasks.escrow_id IS 'Links to escrow system when task is assigned';
COMMENT ON COLUMN worker_attribution.l1_share_percent IS 'Direct referrer gets 5% of worker earnings';
COMMENT ON COLUMN worker_attribution.l2_share_percent IS 'Second level gets 2.5% of worker earnings';
COMMENT ON COLUMN worker_attribution.l3_share_percent IS 'Third level gets 1.25% of worker earnings';
COMMENT ON COLUMN worker_attribution.l4_share_percent IS 'Fourth level gets 0.625% of worker earnings';

-- ============================================
-- 11. INDIVIDUAL ATTRIBUTION SERVICE TABLES
-- These tables support the attribution-service.ts
-- for tracking referrals, task sources, and introductions
-- ============================================

-- ============================================
-- 11a. WORKER REFERRALS (Individual Attribution)
-- Tracks who referred workers with configurable terms
-- ============================================
CREATE TABLE IF NOT EXISTS job_worker_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id VARCHAR(100) NOT NULL, -- Clerk user ID of referrer
    worker_id VARCHAR(100) NOT NULL,   -- Clerk user ID of referred worker

    -- Commission terms
    commission_percent DECIMAL(5, 2) NOT NULL DEFAULT 20.00, -- % of Wells fee
    duration VARCHAR(20) NOT NULL DEFAULT '1_year'
        CHECK (duration IN ('first_task', '3_months', '1_year', 'lifetime')),
    expires_at TIMESTAMP WITH TIME ZONE,
    max_payouts INTEGER, -- Optional cap on payouts

    -- Stats
    tasks_completed INTEGER DEFAULT 0,
    total_earned DECIMAL(12, 2) DEFAULT 0,

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(referrer_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_job_worker_referrals_referrer ON job_worker_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_job_worker_referrals_worker ON job_worker_referrals(worker_id);
CREATE INDEX IF NOT EXISTS idx_job_worker_referrals_active ON job_worker_referrals(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_job_worker_referrals_expires ON job_worker_referrals(expires_at);

-- ============================================
-- 11b. WORKER ATTRIBUTION CHAIN (4-Level)
-- Stores the referral chain for each worker
-- ============================================
CREATE TABLE IF NOT EXISTS job_worker_attribution_chain (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id VARCHAR(100) NOT NULL UNIQUE, -- Clerk user ID

    -- 4-level attribution chain
    l1_user_id VARCHAR(100), -- Direct referrer
    l2_user_id VARCHAR(100), -- Referrer's referrer
    l3_user_id VARCHAR(100), -- L2's referrer
    l4_user_id VARCHAR(100), -- L3's referrer

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_worker_attr_chain_worker ON job_worker_attribution_chain(worker_id);
CREATE INDEX IF NOT EXISTS idx_job_worker_attr_chain_l1 ON job_worker_attribution_chain(l1_user_id);
CREATE INDEX IF NOT EXISTS idx_job_worker_attr_chain_l2 ON job_worker_attribution_chain(l2_user_id);
CREATE INDEX IF NOT EXISTS idx_job_worker_attr_chain_l3 ON job_worker_attribution_chain(l3_user_id);
CREATE INDEX IF NOT EXISTS idx_job_worker_attr_chain_l4 ON job_worker_attribution_chain(l4_user_id);

-- ============================================
-- 11c. TASK SOURCES (Who Sourced the Task)
-- Tracks who identified/created task opportunities
-- ============================================
CREATE TABLE IF NOT EXISTS job_task_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sourcer_id VARCHAR(100) NOT NULL, -- Clerk user ID of sourcer
    task_id UUID NOT NULL,

    -- Commission
    commission_percent DECIMAL(5, 2) NOT NULL DEFAULT 20.00, -- % of Wells fee

    -- Status
    was_completed BOOLEAN DEFAULT false,
    amount_earned DECIMAL(12, 2) DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(task_id) -- Only one sourcer per task
);

CREATE INDEX IF NOT EXISTS idx_job_task_sources_sourcer ON job_task_sources(sourcer_id);
CREATE INDEX IF NOT EXISTS idx_job_task_sources_task ON job_task_sources(task_id);
CREATE INDEX IF NOT EXISTS idx_job_task_sources_completed ON job_task_sources(was_completed);

-- ============================================
-- 11d. INTRODUCTIONS (Matchmaking)
-- Tracks who introduced workers to task posters
-- ============================================
CREATE TABLE IF NOT EXISTS job_introductions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    introducer_id VARCHAR(100) NOT NULL, -- Clerk user ID of introducer
    worker_id VARCHAR(100) NOT NULL,     -- Clerk user ID of worker
    task_id UUID NOT NULL,

    -- Outcome
    was_successful BOOLEAN DEFAULT false,
    amount_earned DECIMAL(12, 2) DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(introducer_id, worker_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_job_introductions_introducer ON job_introductions(introducer_id);
CREATE INDEX IF NOT EXISTS idx_job_introductions_worker ON job_introductions(worker_id);
CREATE INDEX IF NOT EXISTS idx_job_introductions_task ON job_introductions(task_id);
CREATE INDEX IF NOT EXISTS idx_job_introductions_successful ON job_introductions(was_successful);

-- ============================================
-- 11e. ATTRIBUTION PAYOUTS
-- Records all attribution commission payments
-- ============================================
CREATE TABLE IF NOT EXISTS job_attribution_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL,
    attribution_type VARCHAR(20) NOT NULL
        CHECK (attribution_type IN ('worker_referral', 'task_source', 'introduction', 'placement')),
    recipient_id VARCHAR(100) NOT NULL, -- Clerk user ID
    recipient_name VARCHAR(200),

    -- Amounts
    amount DECIMAL(12, 2) NOT NULL,
    grain_amount BIGINT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 4),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_job_attribution_payouts_task ON job_attribution_payouts(task_id);
CREATE INDEX IF NOT EXISTS idx_job_attribution_payouts_recipient ON job_attribution_payouts(recipient_id);
CREATE INDEX IF NOT EXISTS idx_job_attribution_payouts_type ON job_attribution_payouts(attribution_type);
CREATE INDEX IF NOT EXISTS idx_job_attribution_payouts_status ON job_attribution_payouts(status);
CREATE INDEX IF NOT EXISTS idx_job_attribution_payouts_level ON job_attribution_payouts(level);
CREATE INDEX IF NOT EXISTS idx_job_attribution_payouts_created ON job_attribution_payouts(created_at DESC);

-- ============================================
-- 11f. USER ATTRIBUTION DEFAULTS
-- Stores default referral terms per user
-- ============================================
CREATE TABLE IF NOT EXISTS job_user_attribution_defaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL UNIQUE, -- Clerk user ID

    -- Default terms
    commission_percent DECIMAL(5, 2) NOT NULL DEFAULT 20.00,
    duration VARCHAR(20) NOT NULL DEFAULT '1_year'
        CHECK (duration IN ('first_task', '3_months', '1_year', 'lifetime')),
    max_payouts INTEGER,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_user_attr_defaults_user ON job_user_attribution_defaults(user_id);

-- ============================================
-- COMMENTS for new tables
-- ============================================
COMMENT ON TABLE job_worker_referrals IS 'Individual worker referrals with configurable commission terms';
COMMENT ON TABLE job_worker_attribution_chain IS '4-level referral chain for each worker';
COMMENT ON TABLE job_task_sources IS 'Tracks who sourced/identified task opportunities';
COMMENT ON TABLE job_introductions IS 'Tracks matchmaking introductions between workers and tasks';
COMMENT ON TABLE job_attribution_payouts IS 'All attribution commission payments';
COMMENT ON TABLE job_user_attribution_defaults IS 'User default referral terms';

COMMENT ON COLUMN job_worker_referrals.commission_percent IS 'Percentage of Wells 10% fee (e.g., 20 = 2% of task total)';
COMMENT ON COLUMN job_worker_referrals.duration IS 'How long the referral earns: first_task, 3_months, 1_year, or lifetime';
COMMENT ON COLUMN job_attribution_payouts.level IS '1-4 indicating depth in referral chain';
COMMENT ON COLUMN job_attribution_payouts.grain_amount IS 'Amount in GRAIN tokens';
