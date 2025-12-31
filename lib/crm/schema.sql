-- CRM Schema: Contacts, Lists, Campaigns, and Outreach Messages

-- Contact Lists (for segmentation)
CREATE TABLE IF NOT EXISTS crm_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts
CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Basic info
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  company TEXT,
  title TEXT,

  -- Social handles
  twitter_handle TEXT,
  linkedin_url TEXT,

  -- Segmentation
  tags TEXT[] DEFAULT '{}',
  source TEXT,

  -- Engagement
  last_contacted_at TIMESTAMPTZ,
  last_response_at TIMESTAMPTZ,
  engagement_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced', 'invalid')),

  -- Custom fields (JSONB for flexibility)
  custom_fields JSONB DEFAULT '{}',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint per user+email
  UNIQUE(user_id, email)
);

-- Contact-List membership (many-to-many)
CREATE TABLE IF NOT EXISTS crm_contact_lists (
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
  list_id UUID REFERENCES crm_lists(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (contact_id, list_id)
);

-- Campaign Templates
CREATE TABLE IF NOT EXISTS crm_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'twitter', 'linkedin')),
  subject TEXT,
  body TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns
CREATE TABLE IF NOT EXISTS crm_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Targeting
  list_ids UUID[] DEFAULT '{}',
  tag_filters TEXT[] DEFAULT '{}',

  -- Content
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'twitter', 'linkedin', 'multi')),
  template_id UUID REFERENCES crm_templates(id),
  subject TEXT,
  body TEXT NOT NULL,

  -- Scheduling
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Stats
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  unsubscribed_count INTEGER DEFAULT 0,

  -- Settings
  send_rate_limit INTEGER DEFAULT 60, -- per minute
  timezone TEXT DEFAULT 'America/New_York',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outreach Messages (individual sends)
CREATE TABLE IF NOT EXISTS crm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES crm_campaigns(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,

  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'twitter', 'linkedin')),

  -- Content
  subject TEXT,
  body TEXT NOT NULL,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed')),

  -- External IDs (for tracking)
  external_id TEXT,

  -- Tracking timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,

  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_contacts_user ON crm_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_phone ON crm_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_tags ON crm_contacts USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_crm_lists_user ON crm_lists(user_id);

CREATE INDEX IF NOT EXISTS idx_crm_campaigns_user ON crm_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_status ON crm_campaigns(status);

CREATE INDEX IF NOT EXISTS idx_crm_messages_user ON crm_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_messages_contact ON crm_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_messages_campaign ON crm_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_crm_messages_status ON crm_messages(status);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crm_contacts_updated ON crm_contacts;
CREATE TRIGGER trg_crm_contacts_updated
  BEFORE UPDATE ON crm_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_crm_lists_updated ON crm_lists;
CREATE TRIGGER trg_crm_lists_updated
  BEFORE UPDATE ON crm_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_crm_campaigns_updated ON crm_campaigns;
CREATE TRIGGER trg_crm_campaigns_updated
  BEFORE UPDATE ON crm_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_crm_templates_updated ON crm_templates;
CREATE TRIGGER trg_crm_templates_updated
  BEFORE UPDATE ON crm_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_crm_messages_updated ON crm_messages;
CREATE TRIGGER trg_crm_messages_updated
  BEFORE UPDATE ON crm_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
