-- Seller GTM & Reactive Sales Schema
-- Complete seller journey: profile → catalog → reactive RFQs + proactive GTM

-- =====================================================
-- SELLER PROFILES & CATALOG
-- =====================================================

-- Enhanced supplier profiles for selling
CREATE TABLE IF NOT EXISTS seller_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  company_description TEXT,
  website TEXT,
  logo_url TEXT,

  -- Business details
  industry TEXT,
  company_size TEXT, -- 'startup', 'small', 'medium', 'enterprise'
  years_in_business INTEGER,
  locations TEXT[], -- ['Miami, FL', 'New York, NY']

  -- Capabilities
  categories TEXT[], -- ['Office Furniture', 'IT Equipment']
  certifications TEXT[], -- ['ISO 9001', 'Women-Owned']
  min_order_value DECIMAL(20,2),
  max_order_value DECIMAL(20,2),
  typical_lead_time_days INTEGER,

  -- Payment & terms
  accepted_payment_methods TEXT[], -- ['credit_card', 'ach', 'wire', 'grain']
  default_payment_terms TEXT DEFAULT 'Net 30',

  -- AI settings
  ai_enabled BOOLEAN DEFAULT true,
  ai_aggression TEXT DEFAULT 'balanced', -- 'conservative', 'balanced', 'aggressive'
  auto_quote_enabled BOOLEAN DEFAULT true,
  auto_negotiate_enabled BOOLEAN DEFAULT true,
  min_margin_percent DECIMAL(5,2) DEFAULT 15.00,

  -- GTM settings
  gtm_enabled BOOLEAN DEFAULT false,
  gtm_budget_monthly DECIMAL(20,2),
  gtm_target_industries TEXT[],
  gtm_target_company_sizes TEXT[],
  gtm_target_locations TEXT[],

  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'suspended'
  verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seller product/service catalog
CREATE TABLE IF NOT EXISTS seller_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES seller_profiles(id),

  -- Product info
  sku TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,

  -- Pricing
  base_price DECIMAL(20,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  price_unit TEXT DEFAULT 'each', -- 'each', 'per_hour', 'per_month', 'per_1000'
  min_quantity INTEGER DEFAULT 1,

  -- Volume discounts
  volume_discounts JSONB, -- [{min_qty: 100, discount_percent: 5}, ...]

  -- Availability
  in_stock BOOLEAN DEFAULT true,
  stock_quantity INTEGER,
  lead_time_days INTEGER,

  -- AI pricing rules
  ai_pricing_enabled BOOLEAN DEFAULT true,
  floor_price DECIMAL(20,2), -- Never go below this
  ceiling_price DECIMAL(20,2), -- Max for urgent orders
  competitor_match BOOLEAN DEFAULT false,

  -- Metadata
  tags TEXT[],
  images TEXT[],
  specifications JSONB,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- REACTIVE: RFQ MATCHING & RESPONSES
-- =====================================================

-- RFQs matched to sellers
CREATE TABLE IF NOT EXISTS seller_rfq_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES seller_profiles(id),
  rfq_id UUID NOT NULL, -- References rfqs table

  -- Match details
  match_score DECIMAL(5,2), -- 0-100 relevance score
  match_reasons TEXT[], -- ['category_match', 'location_match', 'capacity_match']

  -- Response tracking
  status TEXT DEFAULT 'pending', -- 'pending', 'viewed', 'quoted', 'declined', 'expired'
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  decline_reason TEXT,

  -- Auto-quote
  auto_quoted BOOLEAN DEFAULT false,
  quote_id UUID, -- References rfq_quotes table

  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seller's quote drafts (before submission)
CREATE TABLE IF NOT EXISTS seller_quote_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES seller_profiles(id),
  rfq_id UUID NOT NULL,
  match_id UUID REFERENCES seller_rfq_matches(id),

  -- Quote details
  line_items JSONB, -- [{catalog_id, quantity, unit_price, total}, ...]
  subtotal DECIMAL(20,2),
  discount_percent DECIMAL(5,2),
  discount_amount DECIMAL(20,2),
  total_price DECIMAL(20,2),

  -- Terms
  lead_time_days INTEGER,
  payment_terms TEXT,
  validity_days INTEGER DEFAULT 30,
  notes TEXT,

  -- AI assistance
  ai_suggested BOOLEAN DEFAULT false,
  ai_confidence DECIMAL(5,2),
  ai_rationale TEXT,

  status TEXT DEFAULT 'draft', -- 'draft', 'submitted', 'expired'
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PROACTIVE: GTM & OUTBOUND
-- =====================================================

-- Ideal Customer Profile (ICP) definitions
CREATE TABLE IF NOT EXISTS seller_icps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES seller_profiles(id),

  name TEXT NOT NULL, -- 'Enterprise Tech Companies', 'Mid-Market Healthcare'
  description TEXT,

  -- Targeting criteria
  industries TEXT[],
  company_sizes TEXT[], -- 'startup', 'small', 'medium', 'enterprise'
  company_size_min INTEGER, -- Employee count
  company_size_max INTEGER,
  revenue_min DECIMAL(20,2),
  revenue_max DECIMAL(20,2),
  locations TEXT[],

  -- Job title targeting
  target_titles TEXT[], -- 'CFO', 'VP Operations', 'Procurement Manager'
  decision_maker_level TEXT[], -- 'c_level', 'vp', 'director', 'manager'

  -- Behavioral signals
  buying_signals TEXT[], -- 'funding_round', 'new_office', 'hiring_spree'
  technologies TEXT[], -- tech stack they use

  -- Scoring weights
  weights JSONB, -- {industry: 30, size: 25, title: 25, signals: 20}

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discovered leads/prospects
CREATE TABLE IF NOT EXISTS seller_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES seller_profiles(id),
  icp_id UUID REFERENCES seller_icps(id),

  -- Company info
  company_name TEXT NOT NULL,
  company_domain TEXT,
  company_linkedin TEXT,
  company_industry TEXT,
  company_size TEXT,
  company_employee_count INTEGER,
  company_revenue_estimate DECIMAL(20,2),
  company_location TEXT,
  company_description TEXT,

  -- Contact info
  contact_name TEXT,
  contact_title TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  contact_linkedin TEXT,

  -- Scoring
  lead_score INTEGER, -- 0-100
  score_breakdown JSONB, -- {industry: 25, size: 20, signals: 30, ...}

  -- Signals detected
  buying_signals JSONB, -- [{signal: 'funding_round', data: {...}, detected_at: ...}]

  -- Source
  source TEXT, -- 'apollo', 'linkedin', 'wells_network', 'referral', 'inbound'
  source_data JSONB,

  -- Status tracking
  status TEXT DEFAULT 'new', -- 'new', 'researching', 'qualified', 'outreach', 'engaged', 'opportunity', 'won', 'lost', 'nurture'
  qualified_at TIMESTAMPTZ,

  -- Enrichment
  enriched BOOLEAN DEFAULT false,
  enriched_at TIMESTAMPTZ,
  enrichment_data JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outreach campaigns
CREATE TABLE IF NOT EXISTS seller_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES seller_profiles(id),
  icp_id UUID REFERENCES seller_icps(id),

  name TEXT NOT NULL,
  description TEXT,

  -- Campaign type
  type TEXT NOT NULL, -- 'email_sequence', 'linkedin', 'multi_channel', 'event', 'referral'

  -- Targeting
  target_lead_score_min INTEGER DEFAULT 50,
  target_statuses TEXT[] DEFAULT ARRAY['new', 'qualified'],
  max_leads_per_day INTEGER DEFAULT 50,

  -- Content
  templates JSONB, -- [{step: 1, channel: 'email', subject: '...', body: '...', delay_days: 0}, ...]

  -- AI settings
  ai_personalization BOOLEAN DEFAULT true,
  ai_timing_optimization BOOLEAN DEFAULT true,
  ai_ab_testing BOOLEAN DEFAULT false,

  -- Schedule
  send_days TEXT[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  send_hours_start INTEGER DEFAULT 9,
  send_hours_end INTEGER DEFAULT 17,
  timezone TEXT DEFAULT 'America/New_York',

  -- Limits
  daily_send_limit INTEGER DEFAULT 100,
  total_budget DECIMAL(20,2),

  -- Status
  status TEXT DEFAULT 'draft', -- 'draft', 'scheduled', 'active', 'paused', 'completed'
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Stats (denormalized for quick access)
  total_sent INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  total_meetings INTEGER DEFAULT 0,
  total_opportunities INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual outreach messages
CREATE TABLE IF NOT EXISTS seller_outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES seller_profiles(id),
  campaign_id UUID REFERENCES seller_campaigns(id),
  lead_id UUID REFERENCES seller_leads(id),

  -- Message details
  channel TEXT NOT NULL, -- 'email', 'linkedin', 'sms', 'call'
  step_number INTEGER DEFAULT 1,

  -- Content (personalized)
  subject TEXT,
  body TEXT,

  -- AI personalization
  ai_generated BOOLEAN DEFAULT false,
  ai_personalization_data JSONB, -- What AI used to personalize

  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  -- Engagement tracking
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'unsubscribed'
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,

  -- Email specifics
  email_message_id TEXT,
  email_thread_id TEXT,

  -- LinkedIn specifics
  linkedin_conversation_id TEXT,

  -- Response
  response_text TEXT,
  response_sentiment TEXT, -- 'positive', 'neutral', 'negative'

  -- Next action
  next_action TEXT,
  next_action_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PIPELINE & OPPORTUNITIES
-- =====================================================

-- Sales pipeline stages
CREATE TABLE IF NOT EXISTS seller_pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES seller_profiles(id),

  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,

  -- Stage properties
  probability DECIMAL(5,2), -- Win probability at this stage
  is_won BOOLEAN DEFAULT false,
  is_lost BOOLEAN DEFAULT false,

  -- Actions
  required_actions TEXT[], -- What must happen to advance

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Opportunities/Deals from seller perspective
CREATE TABLE IF NOT EXISTS seller_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES seller_profiles(id),
  lead_id UUID REFERENCES seller_leads(id),
  rfq_id UUID, -- If from reactive (RFQ response)

  -- Opportunity details
  name TEXT NOT NULL,
  description TEXT,

  -- Value
  amount DECIMAL(20,2),
  currency TEXT DEFAULT 'USD',
  probability DECIMAL(5,2),
  weighted_amount DECIMAL(20,2), -- amount * probability

  -- Pipeline
  stage_id UUID REFERENCES seller_pipeline_stages(id),
  stage_entered_at TIMESTAMPTZ DEFAULT NOW(),

  -- Source
  source TEXT, -- 'rfq', 'outbound', 'inbound', 'referral'
  campaign_id UUID REFERENCES seller_campaigns(id),

  -- Timing
  expected_close_date DATE,

  -- Products
  line_items JSONB, -- [{catalog_id, quantity, unit_price}, ...]

  -- Competition
  competitors TEXT[],
  competitive_notes TEXT,

  -- Next steps
  next_step TEXT,
  next_step_date DATE,

  -- Status
  status TEXT DEFAULT 'open', -- 'open', 'won', 'lost'
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  lost_reason TEXT,

  -- Linked deal (if won)
  deal_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Opportunity activities/timeline
CREATE TABLE IF NOT EXISTS seller_opportunity_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES seller_opportunities(id),
  seller_id UUID REFERENCES seller_profiles(id),

  -- Activity details
  type TEXT NOT NULL, -- 'email', 'call', 'meeting', 'proposal', 'negotiation', 'note', 'stage_change'
  title TEXT NOT NULL,
  description TEXT,

  -- Related entities
  outreach_id UUID REFERENCES seller_outreach(id),
  quote_id UUID,
  negotiation_id UUID,

  -- For stage changes
  from_stage_id UUID REFERENCES seller_pipeline_stages(id),
  to_stage_id UUID REFERENCES seller_pipeline_stages(id),

  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Outcome
  outcome TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SELLER AI AGENT MEMORY
-- =====================================================

-- Seller AI conversation context
CREATE TABLE IF NOT EXISTS seller_ai_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES seller_profiles(id),

  -- Context type
  context_type TEXT NOT NULL, -- 'negotiation', 'outreach', 'lead_research', 'rfq_response'
  reference_id UUID, -- ID of related entity

  -- AI memory
  conversation_history JSONB,
  learned_preferences JSONB,
  successful_tactics JSONB,

  -- Performance
  outcomes JSONB, -- Track what worked

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ANALYTICS & REPORTING
-- =====================================================

-- Daily seller metrics
CREATE TABLE IF NOT EXISTS seller_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES seller_profiles(id),
  metric_date DATE NOT NULL,

  -- RFQ metrics (reactive)
  rfqs_received INTEGER DEFAULT 0,
  rfqs_viewed INTEGER DEFAULT 0,
  rfqs_quoted INTEGER DEFAULT 0,
  rfqs_won INTEGER DEFAULT 0,
  rfq_response_rate DECIMAL(5,2),
  rfq_win_rate DECIMAL(5,2),
  rfq_revenue DECIMAL(20,2) DEFAULT 0,

  -- GTM metrics (proactive)
  leads_discovered INTEGER DEFAULT 0,
  leads_qualified INTEGER DEFAULT 0,
  outreach_sent INTEGER DEFAULT 0,
  outreach_opened INTEGER DEFAULT 0,
  outreach_replied INTEGER DEFAULT 0,
  meetings_booked INTEGER DEFAULT 0,

  -- Pipeline metrics
  opportunities_created INTEGER DEFAULT 0,
  opportunities_won INTEGER DEFAULT 0,
  opportunities_lost INTEGER DEFAULT 0,
  pipeline_value DECIMAL(20,2) DEFAULT 0,
  closed_revenue DECIMAL(20,2) DEFAULT 0,

  -- AI metrics
  ai_quotes_generated INTEGER DEFAULT 0,
  ai_negotiations_run INTEGER DEFAULT 0,
  ai_outreach_personalized INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(seller_id, metric_date)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_seller_profiles_user ON seller_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_status ON seller_profiles(status);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_categories ON seller_profiles USING GIN(categories);

CREATE INDEX IF NOT EXISTS idx_seller_catalog_seller ON seller_catalog(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_catalog_category ON seller_catalog(category);
CREATE INDEX IF NOT EXISTS idx_seller_catalog_active ON seller_catalog(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_seller_rfq_matches_seller ON seller_rfq_matches(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_rfq_matches_rfq ON seller_rfq_matches(rfq_id);
CREATE INDEX IF NOT EXISTS idx_seller_rfq_matches_status ON seller_rfq_matches(status);

CREATE INDEX IF NOT EXISTS idx_seller_leads_seller ON seller_leads(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_leads_icp ON seller_leads(icp_id);
CREATE INDEX IF NOT EXISTS idx_seller_leads_status ON seller_leads(status);
CREATE INDEX IF NOT EXISTS idx_seller_leads_score ON seller_leads(lead_score DESC);

CREATE INDEX IF NOT EXISTS idx_seller_campaigns_seller ON seller_campaigns(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_campaigns_status ON seller_campaigns(status);

CREATE INDEX IF NOT EXISTS idx_seller_outreach_seller ON seller_outreach(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_outreach_campaign ON seller_outreach(campaign_id);
CREATE INDEX IF NOT EXISTS idx_seller_outreach_lead ON seller_outreach(lead_id);
CREATE INDEX IF NOT EXISTS idx_seller_outreach_scheduled ON seller_outreach(scheduled_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_seller_opportunities_seller ON seller_opportunities(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_opportunities_stage ON seller_opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_seller_opportunities_status ON seller_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_seller_opportunities_close_date ON seller_opportunities(expected_close_date);

CREATE INDEX IF NOT EXISTS idx_seller_daily_metrics_seller_date ON seller_daily_metrics(seller_id, metric_date DESC);

-- =====================================================
-- DEFAULT PIPELINE STAGES (run once per new seller)
-- =====================================================

-- This would be run when a new seller is created:
-- INSERT INTO seller_pipeline_stages (seller_id, name, order_index, probability) VALUES
-- (seller_id, 'Lead', 1, 10),
-- (seller_id, 'Qualified', 2, 20),
-- (seller_id, 'Proposal', 3, 40),
-- (seller_id, 'Negotiation', 4, 60),
-- (seller_id, 'Verbal Commit', 5, 80),
-- (seller_id, 'Won', 6, 100),
-- (seller_id, 'Lost', 7, 0);

-- =====================================================
-- CONVERSATIONAL SELLER CHAT SYSTEM
-- =====================================================

-- Seller conversations (chat sessions)
CREATE TABLE IF NOT EXISTS seller_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES seller_profiles(id),
  clerk_user_id TEXT NOT NULL,

  -- Conversation metadata
  title TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'archived', 'deleted'

  -- Context
  context JSONB DEFAULT '{}', -- Stores lastMentionedLeadId, activeLeadIds, etc.

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual messages in seller conversations
CREATE TABLE IF NOT EXISTS seller_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES seller_conversations(id) ON DELETE CASCADE,

  -- Message content
  role TEXT NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,

  -- Intent tracking
  intent TEXT,
  action TEXT,

  -- Structured data returned
  data JSONB,

  -- Suggestions offered
  suggestions JSONB,
  follow_up_actions JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead activities (for activity logging)
CREATE TABLE IF NOT EXISTS seller_lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES seller_leads(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES seller_profiles(id),

  -- Activity details
  type TEXT NOT NULL, -- 'email_sent', 'call_made', 'meeting', 'note', 'status_change', 'quote_sent'
  description TEXT NOT NULL,
  outcome TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Who performed the action
  created_by TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead notes
CREATE TABLE IF NOT EXISTS seller_lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES seller_leads(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES seller_profiles(id),

  content TEXT NOT NULL,

  -- Who created the note
  created_by TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seller quotes (for the conversational quote generation)
CREATE TABLE IF NOT EXISTS seller_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES seller_profiles(id),
  lead_id UUID REFERENCES seller_leads(id),
  opportunity_id UUID REFERENCES seller_opportunities(id),
  rfq_id UUID,

  -- Quote identification
  quote_number TEXT NOT NULL,

  -- Quote content
  items JSONB NOT NULL, -- [{sku, name, description, quantity, unitPrice, discount, total}]
  subtotal DECIMAL(20,2) NOT NULL,
  discounts JSONB, -- [{name, type, value, amount}]
  taxes JSONB, -- [{name, rate, amount}]
  total DECIMAL(20,2) NOT NULL,
  currency TEXT DEFAULT 'USD',

  -- Validity
  valid_until TIMESTAMPTZ NOT NULL,

  -- Status
  status TEXT DEFAULT 'draft', -- 'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'superseded'

  -- Terms
  terms TEXT,
  notes TEXT,
  attachments TEXT[],

  -- Tracking
  created_by TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_seller_conversations_seller ON seller_conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_conversations_user ON seller_conversations(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_seller_conversations_status ON seller_conversations(status);
CREATE INDEX IF NOT EXISTS idx_seller_conversations_updated ON seller_conversations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_seller_conversation_messages_conversation ON seller_conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_seller_conversation_messages_created ON seller_conversation_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_seller_lead_activities_lead ON seller_lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_seller_lead_activities_seller ON seller_lead_activities(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_lead_activities_type ON seller_lead_activities(type);
CREATE INDEX IF NOT EXISTS idx_seller_lead_activities_created ON seller_lead_activities(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seller_lead_notes_lead ON seller_lead_notes(lead_id);

CREATE INDEX IF NOT EXISTS idx_seller_quotes_seller ON seller_quotes(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_quotes_lead ON seller_quotes(lead_id);
CREATE INDEX IF NOT EXISTS idx_seller_quotes_opportunity ON seller_quotes(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_seller_quotes_status ON seller_quotes(status);
CREATE INDEX IF NOT EXISTS idx_seller_quotes_valid_until ON seller_quotes(valid_until);

-- Add additional columns to seller_leads for pipeline management
ALTER TABLE seller_leads ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'discovery';
ALTER TABLE seller_leads ADD COLUMN IF NOT EXISTS budget DECIMAL(20,2);
ALTER TABLE seller_leads ADD COLUMN IF NOT EXISTS timeline TEXT;
ALTER TABLE seller_leads ADD COLUMN IF NOT EXISTS requirements TEXT;
ALTER TABLE seller_leads ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE seller_leads ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;
ALTER TABLE seller_leads ADD COLUMN IF NOT EXISTS next_follow_up TIMESTAMPTZ;
ALTER TABLE seller_leads ADD COLUMN IF NOT EXISTS assigned_to TEXT;

-- Index for stage-based queries
CREATE INDEX IF NOT EXISTS idx_seller_leads_stage ON seller_leads(stage);
