-- ============================================================================
-- COLD START ENGINE SCHEMA
-- ============================================================================
-- The nuclear launch system for WellsAI
-- Import 155k+ contacts, blast personalized outreach, track conversions
-- ============================================================================

-- Contacts table (deduplicated across all sources)
CREATE TABLE IF NOT EXISTS coldstart_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact info
  email TEXT,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,

  -- Professional info
  company TEXT,
  title TEXT,
  linkedin_url TEXT,
  twitter_handle TEXT,

  -- Source tracking
  source TEXT NOT NULL, -- linkedin, twitter, email_export, crm, manual, referral, signup, supplier_db
  source_id TEXT, -- Original ID from source

  -- Categorization
  tags TEXT[] DEFAULT '{}',
  relationship TEXT DEFAULT 'unknown', -- strong, medium, weak, unknown

  -- Timestamps
  last_interaction TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(email),
  UNIQUE(phone)
);

-- Outreach campaigns
CREATE TABLE IF NOT EXISTS coldstart_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,

  -- Targeting filters
  source_filter TEXT[] DEFAULT '{}',
  tag_filter TEXT[] DEFAULT '{}',
  relationship_filter TEXT[] DEFAULT '{}',

  -- Channels
  channels TEXT[] DEFAULT '{email}',

  -- Status
  status TEXT DEFAULT 'draft', -- draft, scheduled, running, paused, completed
  scheduled_start TIMESTAMP,
  rate_limit INTEGER DEFAULT 100, -- per hour per channel

  -- Metrics
  total_targeted INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  total_converted INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Campaign variants (for A/B testing)
CREATE TABLE IF NOT EXISTS coldstart_campaign_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES coldstart_campaigns(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  weight INTEGER DEFAULT 100, -- for weighted random selection

  -- Email content
  email_subject TEXT,
  email_body TEXT,

  -- SMS content
  sms_body TEXT,

  -- Social content
  linkedin_message TEXT,
  twitter_dm TEXT,

  -- Metrics for this variant
  sent INTEGER DEFAULT 0,
  opened INTEGER DEFAULT 0,
  clicked INTEGER DEFAULT 0,
  converted INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Individual outreach records
CREATE TABLE IF NOT EXISTS coldstart_outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES coldstart_contacts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES coldstart_campaigns(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES coldstart_campaign_variants(id),
  channel TEXT NOT NULL, -- email, sms, linkedin, twitter

  -- Status tracking
  status TEXT DEFAULT 'queued', -- queued, sent, delivered, opened, clicked, replied, converted, bounced, failed

  -- Timestamps
  queued_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  replied_at TIMESTAMP,
  converted_at TIMESTAMP,

  -- Content sent (for audit)
  subject TEXT,
  body TEXT,

  -- Tracking
  tracking_id TEXT UNIQUE NOT NULL,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,

  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),

  -- Prevent duplicate outreach
  UNIQUE(contact_id, campaign_id, channel)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_email ON coldstart_contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON coldstart_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_source ON coldstart_contacts(source);
CREATE INDEX IF NOT EXISTS idx_contacts_relationship ON coldstart_contacts(relationship);
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON coldstart_contacts USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON coldstart_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_variants_campaign ON coldstart_campaign_variants(campaign_id);

CREATE INDEX IF NOT EXISTS idx_outreach_contact ON coldstart_outreach(contact_id);
CREATE INDEX IF NOT EXISTS idx_outreach_campaign ON coldstart_outreach(campaign_id);
CREATE INDEX IF NOT EXISTS idx_outreach_status ON coldstart_outreach(status);
CREATE INDEX IF NOT EXISTS idx_outreach_tracking ON coldstart_outreach(tracking_id);
CREATE INDEX IF NOT EXISTS idx_outreach_queued ON coldstart_outreach(status, queued_at) WHERE status = 'queued';

-- Full text search on contacts
CREATE INDEX IF NOT EXISTS idx_contacts_search ON coldstart_contacts
  USING GIN(to_tsvector('english', COALESCE(full_name, '') || ' ' || COALESCE(company, '') || ' ' || COALESCE(email, '')));

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Campaign performance overview
CREATE OR REPLACE VIEW coldstart_campaign_performance AS
SELECT
  c.id,
  c.name,
  c.status,
  c.channels,
  c.total_targeted,
  c.total_sent,
  c.total_opened,
  c.total_clicked,
  c.total_converted,
  CASE WHEN c.total_sent > 0
    THEN ROUND((c.total_opened::DECIMAL / c.total_sent) * 100, 2)
    ELSE 0
  END as open_rate,
  CASE WHEN c.total_opened > 0
    THEN ROUND((c.total_clicked::DECIMAL / c.total_opened) * 100, 2)
    ELSE 0
  END as click_rate,
  CASE WHEN c.total_sent > 0
    THEN ROUND((c.total_converted::DECIMAL / c.total_sent) * 100, 2)
    ELSE 0
  END as conversion_rate,
  c.created_at
FROM coldstart_campaigns c;

-- Variant A/B test results
CREATE OR REPLACE VIEW coldstart_variant_performance AS
SELECT
  v.id,
  v.campaign_id,
  v.name,
  v.weight,
  v.sent,
  v.opened,
  v.clicked,
  v.converted,
  CASE WHEN v.sent > 0
    THEN ROUND((v.opened::DECIMAL / v.sent) * 100, 2)
    ELSE 0
  END as open_rate,
  CASE WHEN v.opened > 0
    THEN ROUND((v.clicked::DECIMAL / v.opened) * 100, 2)
    ELSE 0
  END as click_rate,
  CASE WHEN v.sent > 0
    THEN ROUND((v.converted::DECIMAL / v.sent) * 100, 2)
    ELSE 0
  END as conversion_rate
FROM coldstart_campaign_variants v;

-- Contact outreach history
CREATE OR REPLACE VIEW coldstart_contact_history AS
SELECT
  c.id as contact_id,
  c.email,
  c.full_name,
  c.company,
  c.source,
  c.relationship,
  COUNT(o.id) as total_outreach,
  COUNT(o.id) FILTER (WHERE o.status = 'opened') as opens,
  COUNT(o.id) FILTER (WHERE o.status = 'clicked') as clicks,
  COUNT(o.id) FILTER (WHERE o.status = 'converted') as conversions,
  MAX(o.sent_at) as last_contacted
FROM coldstart_contacts c
LEFT JOIN coldstart_outreach o ON c.id = o.contact_id
GROUP BY c.id;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE coldstart_contacts IS 'Master contact list for cold start campaign - deduplicated across all sources';
COMMENT ON TABLE coldstart_campaigns IS 'Outreach campaigns with targeting and A/B testing';
COMMENT ON TABLE coldstart_campaign_variants IS 'Message variants for A/B testing within campaigns';
COMMENT ON TABLE coldstart_outreach IS 'Individual outreach records with full tracking';

COMMENT ON COLUMN coldstart_contacts.relationship IS 'Relationship strength: strong (direct connection), medium (2nd degree), weak (3rd degree), unknown';
COMMENT ON COLUMN coldstart_outreach.tracking_id IS 'Unique ID for tracking opens/clicks via pixel and link rewriting';
