-- Founder Services Schema
-- Additional founder services: Network Sourcing, Unified Inbox, Hiring, Financials, Marketing
-- Follows patterns from schema-founder-projects.sql

-- ============================================================================
-- ENUMS - NETWORK SOURCING
-- ============================================================================

CREATE TYPE sourcing_request_type AS ENUM (
    'customer',
    'supplier',
    'talent',
    'investor',
    'partner'
);

CREATE TYPE sourcing_request_status AS ENUM (
    'draft',
    'active',
    'paused',
    'fulfilled',
    'cancelled'
);

CREATE TYPE sourcing_match_status AS ENUM (
    'identified',
    'researching',
    'qualified',
    'intro_requested',
    'intro_sent',
    'connected',
    'passed',
    'declined'
);

CREATE TYPE intro_status AS ENUM (
    'pending',
    'sent',
    'accepted',
    'declined',
    'expired'
);

CREATE TYPE conversion_type AS ENUM (
    'customer_acquired',
    'supplier_contracted',
    'talent_hired',
    'investment_closed',
    'partnership_signed'
);

-- ============================================================================
-- ENUMS - UNIFIED INBOX
-- ============================================================================

CREATE TYPE inbox_channel_type AS ENUM (
    'email',
    'sms',
    'whatsapp',
    'linkedin',
    'twitter',
    'instagram',
    'facebook',
    'slack',
    'discord',
    'intercom',
    'zendesk',
    'other'
);

CREATE TYPE inbox_channel_status AS ENUM (
    'connected',
    'disconnected',
    'error',
    'pending_auth'
);

CREATE TYPE thread_status AS ENUM (
    'open',
    'snoozed',
    'archived',
    'spam',
    'trash'
);

CREATE TYPE thread_priority AS ENUM (
    'urgent',
    'high',
    'normal',
    'low'
);

CREATE TYPE message_direction AS ENUM (
    'inbound',
    'outbound'
);

CREATE TYPE message_status AS ENUM (
    'draft',
    'sending',
    'sent',
    'delivered',
    'read',
    'failed',
    'bounced'
);

-- ============================================================================
-- ENUMS - HIRING
-- ============================================================================

CREATE TYPE job_status AS ENUM (
    'draft',
    'open',
    'paused',
    'closed',
    'filled',
    'cancelled'
);

CREATE TYPE job_type AS ENUM (
    'full_time',
    'part_time',
    'contract',
    'freelance',
    'internship'
);

CREATE TYPE job_location_type AS ENUM (
    'onsite',
    'remote',
    'hybrid'
);

CREATE TYPE candidate_source AS ENUM (
    'direct_apply',
    'linkedin',
    'indeed',
    'referral',
    'agency',
    'sourced',
    'careers_page',
    'other'
);

CREATE TYPE candidate_stage AS ENUM (
    'new',
    'screening',
    'phone_screen',
    'interview',
    'technical',
    'onsite',
    'reference_check',
    'offer',
    'hired',
    'rejected',
    'withdrawn'
);

CREATE TYPE interview_type AS ENUM (
    'phone_screen',
    'video',
    'onsite',
    'technical',
    'panel',
    'culture_fit',
    'final'
);

CREATE TYPE interview_status AS ENUM (
    'scheduled',
    'confirmed',
    'completed',
    'cancelled',
    'no_show',
    'rescheduled'
);

CREATE TYPE offer_status AS ENUM (
    'draft',
    'pending_approval',
    'approved',
    'sent',
    'accepted',
    'declined',
    'expired',
    'withdrawn'
);

CREATE TYPE onboarding_task_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'blocked',
    'skipped'
);

-- ============================================================================
-- ENUMS - FINANCIALS
-- ============================================================================

CREATE TYPE transaction_type AS ENUM (
    'income',
    'expense',
    'transfer',
    'refund',
    'adjustment'
);

CREATE TYPE transaction_status AS ENUM (
    'pending',
    'cleared',
    'reconciled',
    'void'
);

CREATE TYPE budget_period AS ENUM (
    'monthly',
    'quarterly',
    'annual'
);

CREATE TYPE budget_status AS ENUM (
    'draft',
    'active',
    'closed'
);

-- ============================================================================
-- ENUMS - MARKETING
-- ============================================================================

CREATE TYPE content_type AS ENUM (
    'blog_post',
    'social_post',
    'email',
    'landing_page',
    'video',
    'podcast',
    'ebook',
    'whitepaper',
    'case_study',
    'press_release',
    'infographic',
    'other'
);

CREATE TYPE content_status AS ENUM (
    'idea',
    'draft',
    'review',
    'approved',
    'published',
    'archived'
);

CREATE TYPE ad_platform AS ENUM (
    'google_ads',
    'meta_ads',
    'linkedin_ads',
    'twitter_ads',
    'tiktok_ads',
    'snapchat_ads',
    'pinterest_ads',
    'amazon_ads',
    'microsoft_ads',
    'other'
);

CREATE TYPE campaign_status AS ENUM (
    'draft',
    'pending_review',
    'active',
    'paused',
    'completed',
    'cancelled'
);

CREATE TYPE campaign_objective AS ENUM (
    'awareness',
    'traffic',
    'engagement',
    'leads',
    'conversions',
    'app_installs',
    'video_views',
    'reach'
);

CREATE TYPE creative_type AS ENUM (
    'image',
    'video',
    'carousel',
    'collection',
    'story',
    'text',
    'responsive'
);

CREATE TYPE creative_status AS ENUM (
    'draft',
    'pending_review',
    'approved',
    'rejected',
    'active',
    'paused',
    'archived'
);

-- ============================================================================
-- NETWORK SOURCING TABLES
-- ============================================================================

-- 1. Sourcing Requests - What the founder is looking for
CREATE TABLE founder_sourcing_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    founder_id UUID NOT NULL,
    project_id UUID,
    request_type sourcing_request_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    requirements JSONB DEFAULT '{}',
    ideal_profile JSONB DEFAULT '{}',
    target_count INTEGER DEFAULT 1,
    matched_count INTEGER DEFAULT 0,
    converted_count INTEGER DEFAULT 0,
    status sourcing_request_status NOT NULL DEFAULT 'draft',
    priority VARCHAR(20) DEFAULT 'medium',
    budget_range JSONB,
    deadline DATE,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_counts CHECK (
        target_count > 0 AND
        matched_count >= 0 AND
        converted_count >= 0 AND
        converted_count <= matched_count
    )
);

-- 2. Sourcing Matches - Network matches found
CREATE TABLE founder_sourcing_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES founder_sourcing_requests(id) ON DELETE CASCADE,
    matched_entity_id UUID,
    matched_entity_type VARCHAR(50),
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    contact_linkedin VARCHAR(500),
    company_name VARCHAR(255),
    company_website VARCHAR(500),
    match_score DECIMAL(5, 2),
    match_reasons JSONB DEFAULT '[]',
    status sourcing_match_status NOT NULL DEFAULT 'identified',
    source VARCHAR(100),
    notes TEXT,
    research_data JSONB DEFAULT '{}',
    last_contacted_at TIMESTAMPTZ,
    next_action VARCHAR(255),
    next_action_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_match_score CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 100))
);

-- 3. Sourcing Intros - Introduction tracking
CREATE TABLE founder_sourcing_intros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES founder_sourcing_matches(id) ON DELETE CASCADE,
    introducer_id UUID,
    introducer_name VARCHAR(255),
    introducer_email VARCHAR(255),
    intro_method VARCHAR(50),
    intro_message TEXT,
    status intro_status NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    response_notes TEXT,
    follow_up_count INTEGER DEFAULT 0,
    last_follow_up_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Sourcing Conversions - Successful conversions
CREATE TABLE founder_sourcing_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES founder_sourcing_matches(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES founder_sourcing_requests(id) ON DELETE CASCADE,
    conversion_type conversion_type NOT NULL,
    conversion_date DATE NOT NULL DEFAULT CURRENT_DATE,
    deal_value DECIMAL(15, 2),
    fee_percentage DECIMAL(5, 2),
    fee_amount DECIMAL(15, 2),
    fee_status VARCHAR(50) DEFAULT 'pending',
    fee_paid_at TIMESTAMPTZ,
    contract_id UUID,
    notes TEXT,
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_fees CHECK (
        (fee_percentage IS NULL OR (fee_percentage >= 0 AND fee_percentage <= 100)) AND
        (fee_amount IS NULL OR fee_amount >= 0)
    )
);

-- ============================================================================
-- UNIFIED INBOX TABLES
-- ============================================================================

-- 1. Inbox Channels - Connected communication channels
CREATE TABLE founder_inbox_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    founder_id UUID NOT NULL,
    channel_type inbox_channel_type NOT NULL,
    channel_name VARCHAR(255) NOT NULL,
    account_identifier VARCHAR(255),
    status inbox_channel_status NOT NULL DEFAULT 'pending_auth',
    credentials_encrypted TEXT,
    oauth_tokens JSONB,
    last_sync_at TIMESTAMPTZ,
    sync_cursor VARCHAR(500),
    settings JSONB DEFAULT '{}',
    error_message TEXT,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(founder_id, channel_type, account_identifier)
);

-- 2. Inbox Contacts - Unified contact database
CREATE TABLE founder_inbox_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    founder_id UUID NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(255),
    title VARCHAR(255),
    avatar_url VARCHAR(500),
    channel_identifiers JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    first_contacted_at TIMESTAMPTZ,
    last_contacted_at TIMESTAMPTZ,
    message_count INTEGER DEFAULT 0,
    sentiment_score DECIMAL(3, 2),
    is_vip BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Inbox Threads - Unified conversation threads
CREATE TABLE founder_inbox_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    founder_id UUID NOT NULL,
    channel_id UUID REFERENCES founder_inbox_channels(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES founder_inbox_contacts(id) ON DELETE SET NULL,
    external_thread_id VARCHAR(500),
    subject VARCHAR(500),
    preview TEXT,
    status thread_status NOT NULL DEFAULT 'open',
    priority thread_priority NOT NULL DEFAULT 'normal',
    is_starred BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    assigned_to UUID,
    labels TEXT[] DEFAULT '{}',
    message_count INTEGER DEFAULT 0,
    first_message_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    snoozed_until TIMESTAMPTZ,
    ai_summary TEXT,
    ai_suggested_reply TEXT,
    ai_sentiment VARCHAR(50),
    ai_category VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Inbox Messages - Individual messages
CREATE TABLE founder_inbox_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES founder_inbox_threads(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES founder_inbox_channels(id) ON DELETE SET NULL,
    external_message_id VARCHAR(500),
    direction message_direction NOT NULL,
    status message_status NOT NULL DEFAULT 'sent',
    sender_name VARCHAR(255),
    sender_identifier VARCHAR(255),
    recipient_identifiers TEXT[] DEFAULT '{}',
    cc_identifiers TEXT[] DEFAULT '{}',
    bcc_identifiers TEXT[] DEFAULT '{}',
    subject VARCHAR(500),
    body_text TEXT,
    body_html TEXT,
    attachments JSONB DEFAULT '[]',
    headers JSONB DEFAULT '{}',
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    failed_reason TEXT,
    is_auto_reply BOOLEAN DEFAULT FALSE,
    ai_generated BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- HIRING TABLES
-- ============================================================================

-- 1. Job Postings
CREATE TABLE founder_job_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    founder_id UUID NOT NULL,
    company_id UUID,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    requirements TEXT,
    responsibilities TEXT,
    benefits TEXT,
    department VARCHAR(100),
    job_type job_type NOT NULL DEFAULT 'full_time',
    location_type job_location_type NOT NULL DEFAULT 'remote',
    location_city VARCHAR(100),
    location_state VARCHAR(100),
    location_country VARCHAR(100),
    salary_min DECIMAL(12, 2),
    salary_max DECIMAL(12, 2),
    salary_currency VARCHAR(3) DEFAULT 'USD',
    equity_min DECIMAL(5, 4),
    equity_max DECIMAL(5, 4),
    experience_min INTEGER,
    experience_max INTEGER,
    skills_required TEXT[] DEFAULT '{}',
    skills_preferred TEXT[] DEFAULT '{}',
    status job_status NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    closes_at TIMESTAMPTZ,
    application_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    external_job_ids JSONB DEFAULT '{}',
    hiring_manager_id UUID,
    recruiter_id UUID,
    interview_stages JSONB DEFAULT '[]',
    scorecard_template JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_salary CHECK (
        salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max
    ),
    CONSTRAINT valid_equity CHECK (
        (equity_min IS NULL OR (equity_min >= 0 AND equity_min <= 1)) AND
        (equity_max IS NULL OR (equity_max >= 0 AND equity_max <= 1)) AND
        (equity_min IS NULL OR equity_max IS NULL OR equity_min <= equity_max)
    ),
    CONSTRAINT valid_experience CHECK (
        experience_min IS NULL OR experience_max IS NULL OR experience_min <= experience_max
    )
);

-- 2. Candidates
CREATE TABLE founder_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES founder_job_postings(id) ON DELETE CASCADE,
    founder_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    linkedin_url VARCHAR(500),
    portfolio_url VARCHAR(500),
    resume_url VARCHAR(500),
    resume_text TEXT,
    cover_letter TEXT,
    source candidate_source NOT NULL DEFAULT 'direct_apply',
    source_detail VARCHAR(255),
    referrer_id UUID,
    referrer_name VARCHAR(255),
    stage candidate_stage NOT NULL DEFAULT 'new',
    stage_entered_at TIMESTAMPTZ DEFAULT NOW(),
    rating DECIMAL(3, 2),
    skills_matched TEXT[] DEFAULT '{}',
    experience_years INTEGER,
    current_company VARCHAR(255),
    current_title VARCHAR(255),
    expected_salary DECIMAL(12, 2),
    expected_salary_currency VARCHAR(3) DEFAULT 'USD',
    notice_period_days INTEGER,
    location VARCHAR(255),
    timezone VARCHAR(100),
    work_authorization VARCHAR(100),
    visa_required BOOLEAN DEFAULT FALSE,
    ai_score DECIMAL(5, 2),
    ai_analysis JSONB DEFAULT '{}',
    scorecards JSONB DEFAULT '[]',
    notes TEXT,
    rejection_reason VARCHAR(255),
    withdrawn_reason VARCHAR(255),
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_rating CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
    CONSTRAINT valid_ai_score CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100))
);

-- 3. Interviews
CREATE TABLE founder_interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES founder_candidates(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES founder_job_postings(id) ON DELETE CASCADE,
    interview_type interview_type NOT NULL,
    round_number INTEGER DEFAULT 1,
    interviewer_ids UUID[] DEFAULT '{}',
    interviewer_names TEXT[] DEFAULT '{}',
    scheduled_at TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 60,
    timezone VARCHAR(100),
    location VARCHAR(255),
    video_link VARCHAR(500),
    calendar_event_id VARCHAR(255),
    status interview_status NOT NULL DEFAULT 'scheduled',
    completed_at TIMESTAMPTZ,
    feedback JSONB DEFAULT '[]',
    overall_rating DECIMAL(3, 2),
    recommendation VARCHAR(50),
    notes TEXT,
    recording_url VARCHAR(500),
    cancelled_reason VARCHAR(255),
    rescheduled_from UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_interview_rating CHECK (overall_rating IS NULL OR (overall_rating >= 0 AND overall_rating <= 5)),
    CONSTRAINT valid_round CHECK (round_number > 0),
    CONSTRAINT valid_duration CHECK (duration_minutes > 0)
);

-- 4. Offers
CREATE TABLE founder_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES founder_candidates(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES founder_job_postings(id) ON DELETE CASCADE,
    founder_id UUID NOT NULL,
    status offer_status NOT NULL DEFAULT 'draft',
    base_salary DECIMAL(12, 2) NOT NULL,
    salary_currency VARCHAR(3) DEFAULT 'USD',
    bonus_amount DECIMAL(12, 2),
    bonus_type VARCHAR(50),
    equity_percentage DECIMAL(5, 4),
    equity_shares INTEGER,
    equity_type VARCHAR(50),
    vesting_schedule VARCHAR(100),
    cliff_months INTEGER,
    signing_bonus DECIMAL(12, 2),
    relocation_bonus DECIMAL(12, 2),
    benefits_summary TEXT,
    start_date DATE,
    job_title VARCHAR(255),
    reporting_to VARCHAR(255),
    location VARCHAR(255),
    remote_policy VARCHAR(100),
    special_terms TEXT,
    offer_letter_url VARCHAR(500),
    sent_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    declined_reason VARCHAR(255),
    negotiation_notes TEXT,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1,
    previous_offer_id UUID REFERENCES founder_offers(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_equity_offer CHECK (
        (equity_percentage IS NULL OR (equity_percentage >= 0 AND equity_percentage <= 1)) AND
        (equity_shares IS NULL OR equity_shares >= 0)
    )
);

-- 5. Onboarding Tasks
CREATE TABLE founder_onboarding_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES founder_candidates(id) ON DELETE SET NULL,
    employee_id UUID,
    founder_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    assigned_to UUID,
    assignee_name VARCHAR(255),
    due_date DATE,
    due_days_after_start INTEGER,
    status onboarding_task_status NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    completed_by UUID,
    is_required BOOLEAN DEFAULT TRUE,
    dependencies UUID[] DEFAULT '{}',
    template_id UUID,
    order_index INTEGER DEFAULT 0,
    notes TEXT,
    attachments JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- FINANCIALS TABLES
-- ============================================================================

-- 1. Budget Categories
CREATE TABLE founder_budget_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    founder_id UUID NOT NULL,
    parent_id UUID REFERENCES founder_budget_categories(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    color VARCHAR(7),
    icon VARCHAR(50),
    is_income BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    order_index INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(founder_id, code)
);

-- 2. Budgets
CREATE TABLE founder_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    founder_id UUID NOT NULL,
    category_id UUID REFERENCES founder_budget_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    period_type budget_period NOT NULL DEFAULT 'monthly',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    budgeted_amount DECIMAL(15, 2) NOT NULL,
    actual_amount DECIMAL(15, 2) DEFAULT 0,
    variance_amount DECIMAL(15, 2) GENERATED ALWAYS AS (budgeted_amount - actual_amount) STORED,
    status budget_status NOT NULL DEFAULT 'active',
    rollover_enabled BOOLEAN DEFAULT FALSE,
    rollover_amount DECIMAL(15, 2) DEFAULT 0,
    alert_threshold_percent DECIMAL(5, 2) DEFAULT 80,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_budget_period CHECK (period_end >= period_start),
    CONSTRAINT valid_budget_amounts CHECK (budgeted_amount >= 0),
    CONSTRAINT valid_threshold CHECK (alert_threshold_percent >= 0 AND alert_threshold_percent <= 100)
);

-- 3. Financial Transactions
CREATE TABLE founder_financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    founder_id UUID NOT NULL,
    category_id UUID REFERENCES founder_budget_categories(id) ON DELETE SET NULL,
    budget_id UUID REFERENCES founder_budgets(id) ON DELETE SET NULL,
    transaction_type transaction_type NOT NULL,
    status transaction_status NOT NULL DEFAULT 'pending',
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    exchange_rate DECIMAL(12, 6) DEFAULT 1,
    amount_usd DECIMAL(15, 2),
    transaction_date DATE NOT NULL,
    description TEXT,
    payee_name VARCHAR(255),
    payee_id UUID,
    account_name VARCHAR(100),
    account_id VARCHAR(100),
    external_id VARCHAR(255),
    external_source VARCHAR(100),
    reference_number VARCHAR(100),
    invoice_number VARCHAR(100),
    receipt_url VARCHAR(500),
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_id UUID,
    tags TEXT[] DEFAULT '{}',
    tax_deductible BOOLEAN DEFAULT FALSE,
    tax_category VARCHAR(100),
    reconciled_at TIMESTAMPTZ,
    reconciled_by UUID,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- MARKETING TABLES
-- ============================================================================

-- 1. Marketing Content
CREATE TABLE founder_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    founder_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255),
    content_type content_type NOT NULL,
    status content_status NOT NULL DEFAULT 'idea',
    body TEXT,
    excerpt TEXT,
    thumbnail_url VARCHAR(500),
    media_urls TEXT[] DEFAULT '{}',
    author_id UUID,
    author_name VARCHAR(255),
    target_audience VARCHAR(255),
    target_keywords TEXT[] DEFAULT '{}',
    seo_title VARCHAR(255),
    seo_description TEXT,
    published_at TIMESTAMPTZ,
    scheduled_at TIMESTAMPTZ,
    platforms TEXT[] DEFAULT '{}',
    platform_post_ids JSONB DEFAULT '{}',
    engagement_metrics JSONB DEFAULT '{}',
    view_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    campaign_ids UUID[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Ad Campaigns
CREATE TABLE founder_ad_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    founder_id UUID NOT NULL,
    platform ad_platform NOT NULL,
    external_campaign_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    objective campaign_objective NOT NULL,
    status campaign_status NOT NULL DEFAULT 'draft',
    budget_type VARCHAR(50) DEFAULT 'daily',
    budget_amount DECIMAL(12, 2),
    budget_currency VARCHAR(3) DEFAULT 'USD',
    spent_amount DECIMAL(12, 2) DEFAULT 0,
    start_date DATE,
    end_date DATE,
    target_audience JSONB DEFAULT '{}',
    targeting_locations TEXT[] DEFAULT '{}',
    targeting_demographics JSONB DEFAULT '{}',
    targeting_interests TEXT[] DEFAULT '{}',
    bid_strategy VARCHAR(100),
    bid_amount DECIMAL(12, 4),
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    conversions BIGINT DEFAULT 0,
    ctr DECIMAL(8, 4),
    cpc DECIMAL(12, 4),
    cpm DECIMAL(12, 4),
    cpa DECIMAL(12, 4),
    roas DECIMAL(12, 4),
    conversion_value DECIMAL(15, 2) DEFAULT 0,
    last_synced_at TIMESTAMPTZ,
    sync_error TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_campaign_dates CHECK (
        start_date IS NULL OR end_date IS NULL OR end_date >= start_date
    ),
    CONSTRAINT valid_campaign_budget CHECK (budget_amount IS NULL OR budget_amount >= 0)
);

-- 3. Ad Creatives
CREATE TABLE founder_ad_creatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES founder_ad_campaigns(id) ON DELETE CASCADE,
    external_creative_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    creative_type creative_type NOT NULL,
    status creative_status NOT NULL DEFAULT 'draft',
    headline VARCHAR(255),
    description TEXT,
    body TEXT,
    call_to_action VARCHAR(100),
    destination_url VARCHAR(500),
    display_url VARCHAR(255),
    image_urls TEXT[] DEFAULT '{}',
    video_url VARCHAR(500),
    video_thumbnail_url VARCHAR(500),
    carousel_cards JSONB DEFAULT '[]',
    dimensions VARCHAR(50),
    aspect_ratio VARCHAR(20),
    file_size_bytes INTEGER,
    duration_seconds INTEGER,
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    conversions BIGINT DEFAULT 0,
    ctr DECIMAL(8, 4),
    engagement_rate DECIMAL(8, 4),
    quality_score DECIMAL(5, 2),
    relevance_score DECIMAL(5, 2),
    ab_test_group VARCHAR(10),
    approved_at TIMESTAMPTZ,
    approved_by UUID,
    rejection_reason TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Ad Spend Tracking
CREATE TABLE founder_ad_spend (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES founder_ad_campaigns(id) ON DELETE CASCADE,
    creative_id UUID REFERENCES founder_ad_creatives(id) ON DELETE SET NULL,
    spend_date DATE NOT NULL,
    spend_amount DECIMAL(12, 4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    conversions BIGINT DEFAULT 0,
    conversion_value DECIMAL(15, 2) DEFAULT 0,
    video_views BIGINT DEFAULT 0,
    video_completions BIGINT DEFAULT 0,
    reach BIGINT DEFAULT 0,
    frequency DECIMAL(8, 4),
    ctr DECIMAL(8, 4),
    cpc DECIMAL(12, 4),
    cpm DECIMAL(12, 4),
    cpa DECIMAL(12, 4),
    roas DECIMAL(12, 4),
    breakdown_dimensions JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(campaign_id, creative_id, spend_date),
    CONSTRAINT valid_spend CHECK (spend_amount >= 0)
);

-- 5. Marketing Budgets
CREATE TABLE founder_marketing_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    founder_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    period_type budget_period NOT NULL DEFAULT 'monthly',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_budget DECIMAL(15, 2) NOT NULL,
    allocated_amount DECIMAL(15, 2) DEFAULT 0,
    spent_amount DECIMAL(15, 2) DEFAULT 0,
    remaining_amount DECIMAL(15, 2) GENERATED ALWAYS AS (total_budget - spent_amount) STORED,
    platform_allocations JSONB DEFAULT '{}',
    channel_allocations JSONB DEFAULT '{}',
    status budget_status NOT NULL DEFAULT 'active',
    alert_threshold_percent DECIMAL(5, 2) DEFAULT 80,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_marketing_budget_period CHECK (period_end >= period_start),
    CONSTRAINT valid_marketing_budget_amounts CHECK (total_budget >= 0),
    CONSTRAINT valid_marketing_threshold CHECK (alert_threshold_percent >= 0 AND alert_threshold_percent <= 100)
);

-- ============================================================================
-- INDEXES - NETWORK SOURCING
-- ============================================================================

-- Sourcing requests indexes
CREATE INDEX idx_sourcing_requests_founder ON founder_sourcing_requests(founder_id);
CREATE INDEX idx_sourcing_requests_founder_status ON founder_sourcing_requests(founder_id, status);
CREATE INDEX idx_sourcing_requests_type ON founder_sourcing_requests(request_type);
CREATE INDEX idx_sourcing_requests_type_status ON founder_sourcing_requests(request_type, status);
CREATE INDEX idx_sourcing_requests_project ON founder_sourcing_requests(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_sourcing_requests_deadline ON founder_sourcing_requests(deadline) WHERE deadline IS NOT NULL;
CREATE INDEX idx_sourcing_requests_created ON founder_sourcing_requests(created_at);

-- Sourcing matches indexes
CREATE INDEX idx_sourcing_matches_request ON founder_sourcing_matches(request_id);
CREATE INDEX idx_sourcing_matches_request_status ON founder_sourcing_matches(request_id, status);
CREATE INDEX idx_sourcing_matches_status ON founder_sourcing_matches(status);
CREATE INDEX idx_sourcing_matches_score ON founder_sourcing_matches(match_score DESC) WHERE match_score IS NOT NULL;
CREATE INDEX idx_sourcing_matches_next_action ON founder_sourcing_matches(next_action_date) WHERE next_action_date IS NOT NULL;
CREATE INDEX idx_sourcing_matches_entity ON founder_sourcing_matches(matched_entity_type, matched_entity_id);
CREATE INDEX idx_sourcing_matches_email ON founder_sourcing_matches(contact_email) WHERE contact_email IS NOT NULL;

-- Sourcing intros indexes
CREATE INDEX idx_sourcing_intros_match ON founder_sourcing_intros(match_id);
CREATE INDEX idx_sourcing_intros_status ON founder_sourcing_intros(status);
CREATE INDEX idx_sourcing_intros_introducer ON founder_sourcing_intros(introducer_id) WHERE introducer_id IS NOT NULL;
CREATE INDEX idx_sourcing_intros_sent_at ON founder_sourcing_intros(sent_at) WHERE sent_at IS NOT NULL;
CREATE INDEX idx_sourcing_intros_expires ON founder_sourcing_intros(expires_at) WHERE expires_at IS NOT NULL;

-- Sourcing conversions indexes
CREATE INDEX idx_sourcing_conversions_match ON founder_sourcing_conversions(match_id);
CREATE INDEX idx_sourcing_conversions_request ON founder_sourcing_conversions(request_id);
CREATE INDEX idx_sourcing_conversions_type ON founder_sourcing_conversions(conversion_type);
CREATE INDEX idx_sourcing_conversions_date ON founder_sourcing_conversions(conversion_date);
CREATE INDEX idx_sourcing_conversions_fee_status ON founder_sourcing_conversions(fee_status);

-- ============================================================================
-- INDEXES - UNIFIED INBOX
-- ============================================================================

-- Inbox channels indexes
CREATE INDEX idx_inbox_channels_founder ON founder_inbox_channels(founder_id);
CREATE INDEX idx_inbox_channels_founder_type ON founder_inbox_channels(founder_id, channel_type);
CREATE INDEX idx_inbox_channels_status ON founder_inbox_channels(status);
CREATE INDEX idx_inbox_channels_last_sync ON founder_inbox_channels(last_sync_at);

-- Inbox contacts indexes
CREATE INDEX idx_inbox_contacts_founder ON founder_inbox_contacts(founder_id);
CREATE INDEX idx_inbox_contacts_email ON founder_inbox_contacts(email) WHERE email IS NOT NULL;
CREATE INDEX idx_inbox_contacts_phone ON founder_inbox_contacts(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_inbox_contacts_company ON founder_inbox_contacts(company) WHERE company IS NOT NULL;
CREATE INDEX idx_inbox_contacts_vip ON founder_inbox_contacts(founder_id) WHERE is_vip = TRUE;
CREATE INDEX idx_inbox_contacts_last_contacted ON founder_inbox_contacts(last_contacted_at);
CREATE INDEX idx_inbox_contacts_tags ON founder_inbox_contacts USING GIN(tags);

-- Inbox threads indexes
CREATE INDEX idx_inbox_threads_founder ON founder_inbox_threads(founder_id);
CREATE INDEX idx_inbox_threads_founder_status ON founder_inbox_threads(founder_id, status);
CREATE INDEX idx_inbox_threads_channel ON founder_inbox_threads(channel_id) WHERE channel_id IS NOT NULL;
CREATE INDEX idx_inbox_threads_contact ON founder_inbox_threads(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_inbox_threads_status ON founder_inbox_threads(status);
CREATE INDEX idx_inbox_threads_priority ON founder_inbox_threads(priority);
CREATE INDEX idx_inbox_threads_starred ON founder_inbox_threads(founder_id) WHERE is_starred = TRUE;
CREATE INDEX idx_inbox_threads_unread ON founder_inbox_threads(founder_id) WHERE is_read = FALSE;
CREATE INDEX idx_inbox_threads_assigned ON founder_inbox_threads(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_inbox_threads_last_message ON founder_inbox_threads(last_message_at DESC);
CREATE INDEX idx_inbox_threads_snoozed ON founder_inbox_threads(snoozed_until) WHERE snoozed_until IS NOT NULL;
CREATE INDEX idx_inbox_threads_labels ON founder_inbox_threads USING GIN(labels);
CREATE INDEX idx_inbox_threads_external ON founder_inbox_threads(external_thread_id) WHERE external_thread_id IS NOT NULL;

-- Inbox messages indexes
CREATE INDEX idx_inbox_messages_thread ON founder_inbox_messages(thread_id);
CREATE INDEX idx_inbox_messages_channel ON founder_inbox_messages(channel_id) WHERE channel_id IS NOT NULL;
CREATE INDEX idx_inbox_messages_direction ON founder_inbox_messages(direction);
CREATE INDEX idx_inbox_messages_status ON founder_inbox_messages(status);
CREATE INDEX idx_inbox_messages_sent_at ON founder_inbox_messages(sent_at);
CREATE INDEX idx_inbox_messages_external ON founder_inbox_messages(external_message_id) WHERE external_message_id IS NOT NULL;
CREATE INDEX idx_inbox_messages_sender ON founder_inbox_messages(sender_identifier) WHERE sender_identifier IS NOT NULL;
CREATE INDEX idx_inbox_messages_body_search ON founder_inbox_messages USING GIN(to_tsvector('english', body_text)) WHERE body_text IS NOT NULL;

-- ============================================================================
-- INDEXES - HIRING
-- ============================================================================

-- Job postings indexes
CREATE INDEX idx_job_postings_founder ON founder_job_postings(founder_id);
CREATE INDEX idx_job_postings_founder_status ON founder_job_postings(founder_id, status);
CREATE INDEX idx_job_postings_status ON founder_job_postings(status);
CREATE INDEX idx_job_postings_type ON founder_job_postings(job_type);
CREATE INDEX idx_job_postings_location_type ON founder_job_postings(location_type);
CREATE INDEX idx_job_postings_department ON founder_job_postings(department) WHERE department IS NOT NULL;
CREATE INDEX idx_job_postings_published ON founder_job_postings(published_at) WHERE published_at IS NOT NULL;
CREATE INDEX idx_job_postings_closes ON founder_job_postings(closes_at) WHERE closes_at IS NOT NULL;
CREATE INDEX idx_job_postings_hiring_manager ON founder_job_postings(hiring_manager_id) WHERE hiring_manager_id IS NOT NULL;
CREATE INDEX idx_job_postings_skills ON founder_job_postings USING GIN(skills_required);

-- Candidates indexes
CREATE INDEX idx_candidates_job ON founder_candidates(job_id);
CREATE INDEX idx_candidates_founder ON founder_candidates(founder_id);
CREATE INDEX idx_candidates_job_stage ON founder_candidates(job_id, stage);
CREATE INDEX idx_candidates_stage ON founder_candidates(stage);
CREATE INDEX idx_candidates_source ON founder_candidates(source);
CREATE INDEX idx_candidates_email ON founder_candidates(email) WHERE email IS NOT NULL;
CREATE INDEX idx_candidates_rating ON founder_candidates(rating DESC) WHERE rating IS NOT NULL;
CREATE INDEX idx_candidates_ai_score ON founder_candidates(ai_score DESC) WHERE ai_score IS NOT NULL;
CREATE INDEX idx_candidates_stage_entered ON founder_candidates(stage_entered_at);
CREATE INDEX idx_candidates_referrer ON founder_candidates(referrer_id) WHERE referrer_id IS NOT NULL;
CREATE INDEX idx_candidates_created ON founder_candidates(created_at);
CREATE INDEX idx_candidates_tags ON founder_candidates USING GIN(tags);

-- Interviews indexes
CREATE INDEX idx_interviews_candidate ON founder_interviews(candidate_id);
CREATE INDEX idx_interviews_job ON founder_interviews(job_id);
CREATE INDEX idx_interviews_status ON founder_interviews(status);
CREATE INDEX idx_interviews_type ON founder_interviews(interview_type);
CREATE INDEX idx_interviews_scheduled ON founder_interviews(scheduled_at);
CREATE INDEX idx_interviews_upcoming ON founder_interviews(scheduled_at) WHERE status IN ('scheduled', 'confirmed') AND scheduled_at > NOW();
CREATE INDEX idx_interviews_interviewers ON founder_interviews USING GIN(interviewer_ids);
CREATE INDEX idx_interviews_calendar ON founder_interviews(calendar_event_id) WHERE calendar_event_id IS NOT NULL;

-- Offers indexes
CREATE INDEX idx_offers_candidate ON founder_offers(candidate_id);
CREATE INDEX idx_offers_job ON founder_offers(job_id);
CREATE INDEX idx_offers_founder ON founder_offers(founder_id);
CREATE INDEX idx_offers_status ON founder_offers(status);
CREATE INDEX idx_offers_sent ON founder_offers(sent_at) WHERE sent_at IS NOT NULL;
CREATE INDEX idx_offers_expires ON founder_offers(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_offers_pending ON founder_offers(founder_id) WHERE status IN ('draft', 'pending_approval', 'sent');

-- Onboarding tasks indexes
CREATE INDEX idx_onboarding_tasks_candidate ON founder_onboarding_tasks(candidate_id) WHERE candidate_id IS NOT NULL;
CREATE INDEX idx_onboarding_tasks_employee ON founder_onboarding_tasks(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX idx_onboarding_tasks_founder ON founder_onboarding_tasks(founder_id);
CREATE INDEX idx_onboarding_tasks_status ON founder_onboarding_tasks(status);
CREATE INDEX idx_onboarding_tasks_assigned ON founder_onboarding_tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_onboarding_tasks_due ON founder_onboarding_tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_onboarding_tasks_category ON founder_onboarding_tasks(category) WHERE category IS NOT NULL;
CREATE INDEX idx_onboarding_tasks_pending ON founder_onboarding_tasks(founder_id) WHERE status IN ('pending', 'in_progress');

-- ============================================================================
-- INDEXES - FINANCIALS
-- ============================================================================

-- Budget categories indexes
CREATE INDEX idx_budget_categories_founder ON founder_budget_categories(founder_id);
CREATE INDEX idx_budget_categories_parent ON founder_budget_categories(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_budget_categories_active ON founder_budget_categories(founder_id) WHERE is_active = TRUE;
CREATE INDEX idx_budget_categories_income ON founder_budget_categories(founder_id, is_income);

-- Budgets indexes
CREATE INDEX idx_budgets_founder ON founder_budgets(founder_id);
CREATE INDEX idx_budgets_founder_status ON founder_budgets(founder_id, status);
CREATE INDEX idx_budgets_category ON founder_budgets(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_budgets_period ON founder_budgets(period_type);
CREATE INDEX idx_budgets_period_range ON founder_budgets(period_start, period_end);
CREATE INDEX idx_budgets_status ON founder_budgets(status);
CREATE INDEX idx_budgets_active ON founder_budgets(founder_id) WHERE status = 'active';

-- Financial transactions indexes
CREATE INDEX idx_financial_txn_founder ON founder_financial_transactions(founder_id);
CREATE INDEX idx_financial_txn_category ON founder_financial_transactions(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_financial_txn_budget ON founder_financial_transactions(budget_id) WHERE budget_id IS NOT NULL;
CREATE INDEX idx_financial_txn_type ON founder_financial_transactions(transaction_type);
CREATE INDEX idx_financial_txn_status ON founder_financial_transactions(status);
CREATE INDEX idx_financial_txn_date ON founder_financial_transactions(transaction_date);
CREATE INDEX idx_financial_txn_founder_date ON founder_financial_transactions(founder_id, transaction_date);
CREATE INDEX idx_financial_txn_date_range ON founder_financial_transactions(founder_id, transaction_date DESC);
CREATE INDEX idx_financial_txn_payee ON founder_financial_transactions(payee_id) WHERE payee_id IS NOT NULL;
CREATE INDEX idx_financial_txn_account ON founder_financial_transactions(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX idx_financial_txn_external ON founder_financial_transactions(external_source, external_id);
CREATE INDEX idx_financial_txn_recurring ON founder_financial_transactions(recurring_id) WHERE recurring_id IS NOT NULL;
CREATE INDEX idx_financial_txn_tags ON founder_financial_transactions USING GIN(tags);
CREATE INDEX idx_financial_txn_tax ON founder_financial_transactions(founder_id) WHERE tax_deductible = TRUE;
CREATE INDEX idx_financial_txn_unreconciled ON founder_financial_transactions(founder_id) WHERE status != 'reconciled';

-- ============================================================================
-- INDEXES - MARKETING
-- ============================================================================

-- Content indexes
CREATE INDEX idx_content_founder ON founder_content(founder_id);
CREATE INDEX idx_content_founder_status ON founder_content(founder_id, status);
CREATE INDEX idx_content_type ON founder_content(content_type);
CREATE INDEX idx_content_status ON founder_content(status);
CREATE INDEX idx_content_published ON founder_content(published_at) WHERE published_at IS NOT NULL;
CREATE INDEX idx_content_scheduled ON founder_content(scheduled_at) WHERE scheduled_at IS NOT NULL AND status != 'published';
CREATE INDEX idx_content_author ON founder_content(author_id) WHERE author_id IS NOT NULL;
CREATE INDEX idx_content_platforms ON founder_content USING GIN(platforms);
CREATE INDEX idx_content_tags ON founder_content USING GIN(tags);
CREATE INDEX idx_content_campaigns ON founder_content USING GIN(campaign_ids);
CREATE INDEX idx_content_slug ON founder_content(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_content_keywords ON founder_content USING GIN(target_keywords);

-- Ad campaigns indexes
CREATE INDEX idx_ad_campaigns_founder ON founder_ad_campaigns(founder_id);
CREATE INDEX idx_ad_campaigns_founder_platform ON founder_ad_campaigns(founder_id, platform);
CREATE INDEX idx_ad_campaigns_platform ON founder_ad_campaigns(platform);
CREATE INDEX idx_ad_campaigns_status ON founder_ad_campaigns(status);
CREATE INDEX idx_ad_campaigns_platform_status ON founder_ad_campaigns(platform, status);
CREATE INDEX idx_ad_campaigns_objective ON founder_ad_campaigns(objective);
CREATE INDEX idx_ad_campaigns_date_range ON founder_ad_campaigns(start_date, end_date);
CREATE INDEX idx_ad_campaigns_active ON founder_ad_campaigns(founder_id) WHERE status = 'active';
CREATE INDEX idx_ad_campaigns_external ON founder_ad_campaigns(platform, external_campaign_id);
CREATE INDEX idx_ad_campaigns_last_sync ON founder_ad_campaigns(last_synced_at);

-- Ad creatives indexes
CREATE INDEX idx_ad_creatives_campaign ON founder_ad_creatives(campaign_id);
CREATE INDEX idx_ad_creatives_type ON founder_ad_creatives(creative_type);
CREATE INDEX idx_ad_creatives_status ON founder_ad_creatives(status);
CREATE INDEX idx_ad_creatives_campaign_status ON founder_ad_creatives(campaign_id, status);
CREATE INDEX idx_ad_creatives_ab_test ON founder_ad_creatives(campaign_id, ab_test_group) WHERE ab_test_group IS NOT NULL;
CREATE INDEX idx_ad_creatives_external ON founder_ad_creatives(external_creative_id) WHERE external_creative_id IS NOT NULL;
CREATE INDEX idx_ad_creatives_performance ON founder_ad_creatives(ctr DESC) WHERE ctr IS NOT NULL;

-- Ad spend indexes
CREATE INDEX idx_ad_spend_campaign ON founder_ad_spend(campaign_id);
CREATE INDEX idx_ad_spend_creative ON founder_ad_spend(creative_id) WHERE creative_id IS NOT NULL;
CREATE INDEX idx_ad_spend_date ON founder_ad_spend(spend_date);
CREATE INDEX idx_ad_spend_campaign_date ON founder_ad_spend(campaign_id, spend_date);
CREATE INDEX idx_ad_spend_date_range ON founder_ad_spend(spend_date DESC);

-- Marketing budgets indexes
CREATE INDEX idx_mkt_budgets_founder ON founder_marketing_budgets(founder_id);
CREATE INDEX idx_mkt_budgets_founder_status ON founder_marketing_budgets(founder_id, status);
CREATE INDEX idx_mkt_budgets_period ON founder_marketing_budgets(period_type);
CREATE INDEX idx_mkt_budgets_period_range ON founder_marketing_budgets(period_start, period_end);
CREATE INDEX idx_mkt_budgets_status ON founder_marketing_budgets(status);
CREATE INDEX idx_mkt_budgets_active ON founder_marketing_budgets(founder_id) WHERE status = 'active';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamps
CREATE TRIGGER update_founder_sourcing_requests_updated_at
    BEFORE UPDATE ON founder_sourcing_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_founder_sourcing_matches_updated_at
    BEFORE UPDATE ON founder_sourcing_matches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_founder_sourcing_intros_updated_at
    BEFORE UPDATE ON founder_sourcing_intros
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_founder_inbox_channels_updated_at
    BEFORE UPDATE ON founder_inbox_channels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_founder_inbox_contacts_updated_at
    BEFORE UPDATE ON founder_inbox_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_founder_inbox_threads_updated_at
    BEFORE UPDATE ON founder_inbox_threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_founder_job_postings_updated_at
    BEFORE UPDATE ON founder_job_postings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_founder_candidates_updated_at
    BEFORE UPDATE ON founder_candidates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_founder_interviews_updated_at
    BEFORE UPDATE ON founder_interviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_founder_offers_updated_at
    BEFORE UPDATE ON founder_offers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_founder_onboarding_tasks_updated_at
    BEFORE UPDATE ON founder_onboarding_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_founder_budget_categories_updated_at
    BEFORE UPDATE ON founder_budget_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_founder_budgets_updated_at
    BEFORE UPDATE ON founder_budgets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_founder_financial_transactions_updated_at
    BEFORE UPDATE ON founder_financial_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_founder_content_updated_at
    BEFORE UPDATE ON founder_content
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_founder_ad_campaigns_updated_at
    BEFORE UPDATE ON founder_ad_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_founder_ad_creatives_updated_at
    BEFORE UPDATE ON founder_ad_creatives
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_founder_marketing_budgets_updated_at
    BEFORE UPDATE ON founder_marketing_budgets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TRIGGER FUNCTIONS - BUSINESS LOGIC
-- ============================================================================

-- Update sourcing request counts when matches change
CREATE OR REPLACE FUNCTION update_sourcing_request_counts()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE founder_sourcing_requests
    SET
        matched_count = (
            SELECT COUNT(*) FROM founder_sourcing_matches
            WHERE request_id = COALESCE(NEW.request_id, OLD.request_id)
            AND status NOT IN ('passed', 'declined')
        ),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.request_id, OLD.request_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sourcing_counts_insert
    AFTER INSERT ON founder_sourcing_matches
    FOR EACH ROW
    EXECUTE FUNCTION update_sourcing_request_counts();

CREATE TRIGGER trigger_update_sourcing_counts_update
    AFTER UPDATE OF status ON founder_sourcing_matches
    FOR EACH ROW
    EXECUTE FUNCTION update_sourcing_request_counts();

CREATE TRIGGER trigger_update_sourcing_counts_delete
    AFTER DELETE ON founder_sourcing_matches
    FOR EACH ROW
    EXECUTE FUNCTION update_sourcing_request_counts();

-- Update thread message count and timestamps
CREATE OR REPLACE FUNCTION update_thread_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE founder_inbox_threads
    SET
        message_count = (
            SELECT COUNT(*) FROM founder_inbox_messages
            WHERE thread_id = NEW.thread_id
        ),
        first_message_at = COALESCE(first_message_at, NEW.sent_at),
        last_message_at = NEW.sent_at,
        is_read = CASE WHEN NEW.direction = 'inbound' THEN FALSE ELSE is_read END,
        preview = LEFT(NEW.body_text, 200),
        updated_at = NOW()
    WHERE id = NEW.thread_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_thread_on_message
    AFTER INSERT ON founder_inbox_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_thread_on_message();

-- Update contact message count and last contacted
CREATE OR REPLACE FUNCTION update_contact_on_message()
RETURNS TRIGGER AS $$
DECLARE
    v_contact_id UUID;
BEGIN
    SELECT contact_id INTO v_contact_id
    FROM founder_inbox_threads
    WHERE id = NEW.thread_id;

    IF v_contact_id IS NOT NULL THEN
        UPDATE founder_inbox_contacts
        SET
            message_count = message_count + 1,
            first_contacted_at = COALESCE(first_contacted_at, NEW.sent_at),
            last_contacted_at = NEW.sent_at,
            updated_at = NOW()
        WHERE id = v_contact_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_contact_on_message
    AFTER INSERT ON founder_inbox_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_contact_on_message();

-- Update job posting application count
CREATE OR REPLACE FUNCTION update_job_application_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE founder_job_postings
    SET
        application_count = (
            SELECT COUNT(*) FROM founder_candidates
            WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
        ),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.job_id, OLD.job_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_job_app_count_insert
    AFTER INSERT ON founder_candidates
    FOR EACH ROW
    EXECUTE FUNCTION update_job_application_count();

CREATE TRIGGER trigger_update_job_app_count_delete
    AFTER DELETE ON founder_candidates
    FOR EACH ROW
    EXECUTE FUNCTION update_job_application_count();

-- Update budget actual amounts from transactions
CREATE OR REPLACE FUNCTION update_budget_actual_amount()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the specific budget if linked
    IF COALESCE(NEW.budget_id, OLD.budget_id) IS NOT NULL THEN
        UPDATE founder_budgets
        SET
            actual_amount = (
                SELECT COALESCE(SUM(
                    CASE
                        WHEN transaction_type = 'expense' THEN amount
                        WHEN transaction_type = 'refund' THEN -amount
                        ELSE 0
                    END
                ), 0)
                FROM founder_financial_transactions
                WHERE budget_id = COALESCE(NEW.budget_id, OLD.budget_id)
                AND status != 'void'
            ),
            updated_at = NOW()
        WHERE id = COALESCE(NEW.budget_id, OLD.budget_id);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_budget_on_txn_insert
    AFTER INSERT ON founder_financial_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_budget_actual_amount();

CREATE TRIGGER trigger_update_budget_on_txn_update
    AFTER UPDATE ON founder_financial_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_budget_actual_amount();

CREATE TRIGGER trigger_update_budget_on_txn_delete
    AFTER DELETE ON founder_financial_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_budget_actual_amount();

-- Update campaign metrics from ad spend
CREATE OR REPLACE FUNCTION update_campaign_from_spend()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE founder_ad_campaigns
    SET
        spent_amount = (
            SELECT COALESCE(SUM(spend_amount), 0)
            FROM founder_ad_spend
            WHERE campaign_id = NEW.campaign_id
        ),
        impressions = (
            SELECT COALESCE(SUM(impressions), 0)
            FROM founder_ad_spend
            WHERE campaign_id = NEW.campaign_id
        ),
        clicks = (
            SELECT COALESCE(SUM(clicks), 0)
            FROM founder_ad_spend
            WHERE campaign_id = NEW.campaign_id
        ),
        conversions = (
            SELECT COALESCE(SUM(conversions), 0)
            FROM founder_ad_spend
            WHERE campaign_id = NEW.campaign_id
        ),
        conversion_value = (
            SELECT COALESCE(SUM(conversion_value), 0)
            FROM founder_ad_spend
            WHERE campaign_id = NEW.campaign_id
        ),
        updated_at = NOW()
    WHERE id = NEW.campaign_id;

    -- Calculate derived metrics
    UPDATE founder_ad_campaigns
    SET
        ctr = CASE WHEN impressions > 0 THEN (clicks::DECIMAL / impressions) * 100 ELSE NULL END,
        cpc = CASE WHEN clicks > 0 THEN spent_amount / clicks ELSE NULL END,
        cpm = CASE WHEN impressions > 0 THEN (spent_amount / impressions) * 1000 ELSE NULL END,
        cpa = CASE WHEN conversions > 0 THEN spent_amount / conversions ELSE NULL END,
        roas = CASE WHEN spent_amount > 0 THEN conversion_value / spent_amount ELSE NULL END
    WHERE id = NEW.campaign_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_campaign_from_spend
    AFTER INSERT OR UPDATE ON founder_ad_spend
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_from_spend();

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- Sourcing pipeline summary
CREATE OR REPLACE VIEW v_sourcing_pipeline_summary AS
SELECT
    sr.founder_id,
    sr.id as request_id,
    sr.title,
    sr.request_type,
    sr.status,
    sr.target_count,
    COUNT(sm.id) as total_matches,
    COUNT(sm.id) FILTER (WHERE sm.status = 'identified') as identified,
    COUNT(sm.id) FILTER (WHERE sm.status = 'qualified') as qualified,
    COUNT(sm.id) FILTER (WHERE sm.status IN ('intro_requested', 'intro_sent')) as in_intro,
    COUNT(sm.id) FILTER (WHERE sm.status = 'connected') as connected,
    COUNT(sc.id) as converted,
    COALESCE(SUM(sc.deal_value), 0) as total_deal_value,
    sr.deadline,
    sr.created_at
FROM founder_sourcing_requests sr
LEFT JOIN founder_sourcing_matches sm ON sm.request_id = sr.id
LEFT JOIN founder_sourcing_conversions sc ON sc.request_id = sr.id
GROUP BY sr.id;

-- Inbox overview
CREATE OR REPLACE VIEW v_inbox_overview AS
SELECT
    t.founder_id,
    COUNT(*) as total_threads,
    COUNT(*) FILTER (WHERE t.status = 'open' AND t.is_read = FALSE) as unread_count,
    COUNT(*) FILTER (WHERE t.status = 'open') as open_count,
    COUNT(*) FILTER (WHERE t.priority = 'urgent' AND t.status = 'open') as urgent_count,
    COUNT(*) FILTER (WHERE t.is_starred) as starred_count,
    COUNT(*) FILTER (WHERE t.status = 'snoozed') as snoozed_count,
    MAX(t.last_message_at) as last_activity_at
FROM founder_inbox_threads t
GROUP BY t.founder_id;

-- Hiring pipeline summary
CREATE OR REPLACE VIEW v_hiring_pipeline_summary AS
SELECT
    jp.founder_id,
    jp.id as job_id,
    jp.title,
    jp.status as job_status,
    jp.application_count,
    COUNT(c.id) FILTER (WHERE c.stage = 'new') as new_candidates,
    COUNT(c.id) FILTER (WHERE c.stage = 'screening') as in_screening,
    COUNT(c.id) FILTER (WHERE c.stage IN ('phone_screen', 'interview', 'technical', 'onsite')) as interviewing,
    COUNT(c.id) FILTER (WHERE c.stage = 'offer') as in_offer,
    COUNT(c.id) FILTER (WHERE c.stage = 'hired') as hired,
    COUNT(c.id) FILTER (WHERE c.stage = 'rejected') as rejected,
    COUNT(i.id) FILTER (WHERE i.status = 'scheduled' AND i.scheduled_at > NOW()) as upcoming_interviews,
    COUNT(o.id) FILTER (WHERE o.status = 'sent') as pending_offers,
    jp.published_at,
    jp.closes_at
FROM founder_job_postings jp
LEFT JOIN founder_candidates c ON c.job_id = jp.id
LEFT JOIN founder_interviews i ON i.job_id = jp.id
LEFT JOIN founder_offers o ON o.job_id = jp.id
GROUP BY jp.id;

-- Financial summary by period
CREATE OR REPLACE VIEW v_financial_summary AS
SELECT
    ft.founder_id,
    DATE_TRUNC('month', ft.transaction_date) as period,
    SUM(CASE WHEN ft.transaction_type = 'income' THEN ft.amount ELSE 0 END) as total_income,
    SUM(CASE WHEN ft.transaction_type = 'expense' THEN ft.amount ELSE 0 END) as total_expenses,
    SUM(CASE WHEN ft.transaction_type = 'income' THEN ft.amount ELSE 0 END) -
        SUM(CASE WHEN ft.transaction_type = 'expense' THEN ft.amount ELSE 0 END) as net_cashflow,
    COUNT(*) as transaction_count,
    COUNT(*) FILTER (WHERE ft.status = 'pending') as pending_count
FROM founder_financial_transactions ft
WHERE ft.status != 'void'
GROUP BY ft.founder_id, DATE_TRUNC('month', ft.transaction_date);

-- Marketing performance summary
CREATE OR REPLACE VIEW v_marketing_performance AS
SELECT
    ac.founder_id,
    ac.platform,
    ac.status,
    COUNT(ac.id) as campaign_count,
    COALESCE(SUM(ac.budget_amount), 0) as total_budget,
    COALESCE(SUM(ac.spent_amount), 0) as total_spent,
    COALESCE(SUM(ac.impressions), 0) as total_impressions,
    COALESCE(SUM(ac.clicks), 0) as total_clicks,
    COALESCE(SUM(ac.conversions), 0) as total_conversions,
    COALESCE(SUM(ac.conversion_value), 0) as total_conversion_value,
    CASE WHEN SUM(ac.impressions) > 0
        THEN (SUM(ac.clicks)::DECIMAL / SUM(ac.impressions)) * 100
        ELSE NULL END as overall_ctr,
    CASE WHEN SUM(ac.clicks) > 0
        THEN SUM(ac.spent_amount) / SUM(ac.clicks)
        ELSE NULL END as overall_cpc,
    CASE WHEN SUM(ac.spent_amount) > 0
        THEN SUM(ac.conversion_value) / SUM(ac.spent_amount)
        ELSE NULL END as overall_roas
FROM founder_ad_campaigns ac
GROUP BY ac.founder_id, ac.platform, ac.status;

-- ============================================================================
-- COMMENTS
-- ============================================================================

-- Network Sourcing
COMMENT ON TABLE founder_sourcing_requests IS 'Sourcing requests for finding customers, suppliers, talent, investors, or partners';
COMMENT ON TABLE founder_sourcing_matches IS 'Network matches found for sourcing requests with scoring and status tracking';
COMMENT ON TABLE founder_sourcing_intros IS 'Introduction tracking for warm intros to matches';
COMMENT ON TABLE founder_sourcing_conversions IS 'Successful conversions from matches with deal values and fees';

-- Unified Inbox
COMMENT ON TABLE founder_inbox_channels IS 'Connected communication channels (email, SMS, social, etc.)';
COMMENT ON TABLE founder_inbox_contacts IS 'Unified contact database across all channels';
COMMENT ON TABLE founder_inbox_threads IS 'Unified conversation threads from all channels';
COMMENT ON TABLE founder_inbox_messages IS 'Individual messages within threads';

-- Hiring
COMMENT ON TABLE founder_job_postings IS 'Job postings with requirements, compensation, and hiring workflow';
COMMENT ON TABLE founder_candidates IS 'Candidates from all sources with stage tracking and scoring';
COMMENT ON TABLE founder_interviews IS 'Interview scheduling and feedback tracking';
COMMENT ON TABLE founder_offers IS 'Offer management with compensation details and negotiation tracking';
COMMENT ON TABLE founder_onboarding_tasks IS 'Onboarding checklists and task completion tracking';

-- Financials
COMMENT ON TABLE founder_budget_categories IS 'Hierarchical budget categories for expense classification';
COMMENT ON TABLE founder_budgets IS 'Budget allocations by period with actual vs budgeted tracking';
COMMENT ON TABLE founder_financial_transactions IS 'Aggregated financial transactions from all sources';

-- Marketing
COMMENT ON TABLE founder_content IS 'Marketing content pieces across all formats';
COMMENT ON TABLE founder_ad_campaigns IS 'Ad campaigns across all platforms with performance metrics';
COMMENT ON TABLE founder_ad_creatives IS 'Campaign creatives with A/B testing support';
COMMENT ON TABLE founder_ad_spend IS 'Daily spend tracking with granular metrics';
COMMENT ON TABLE founder_marketing_budgets IS 'Marketing budget allocation by period and channel';
