-- Advanced Contacts Features Schema
-- Campaign management, bulk operations, analytics, and interaction tracking

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Contact Tags Table (for flexible categorization)
CREATE TABLE IF NOT EXISTS contact_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, name)
);

CREATE INDEX idx_contact_tags_user ON contact_tags(user_id);

-- Contact-Tag Junction Table
CREATE TABLE IF NOT EXISTS contact_tag_assignments (
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES contact_tags(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),

  PRIMARY KEY (contact_id, tag_id)
);

CREATE INDEX idx_contact_tag_assignments_contact ON contact_tag_assignments(contact_id);
CREATE INDEX idx_contact_tag_assignments_tag ON contact_tag_assignments(tag_id);

-- Campaigns Table
CREATE TABLE IF NOT EXISTS contact_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,

  -- Campaign details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft', -- draft, active, paused, completed, archived

  -- Targeting filters (stored as JSONB for flexibility)
  filters JSONB DEFAULT '{}', -- e.g., {"relationship_type": "customer", "importance_score": {"min": 70}}

  -- Campaign metadata
  goal VARCHAR(255), -- e.g., "Re-engage dormant customers"
  start_date TIMESTAMP,
  end_date TIMESTAMP,

  -- Stats (updated by triggers)
  contact_count INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  responses_received INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contact_campaigns_user ON contact_campaigns(user_id);
CREATE INDEX idx_contact_campaigns_status ON contact_campaigns(status);
CREATE INDEX idx_contact_campaigns_created ON contact_campaigns(created_at DESC);

-- Campaign-Contact Junction Table
CREATE TABLE IF NOT EXISTS campaign_contacts (
  campaign_id UUID REFERENCES contact_campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  added_by VARCHAR(50) DEFAULT 'manual', -- manual, filter, bulk

  -- Contact-specific campaign stats
  messages_sent INTEGER DEFAULT 0,
  last_contacted TIMESTAMP,
  responded BOOLEAN DEFAULT false,

  PRIMARY KEY (campaign_id, contact_id)
);

CREATE INDEX idx_campaign_contacts_campaign ON campaign_contacts(campaign_id);
CREATE INDEX idx_campaign_contacts_contact ON campaign_contacts(contact_id);

-- Contact Interactions Table
-- Track all interactions beyond messages (calls, meetings, deals, etc.)
CREATE TABLE IF NOT EXISTS contact_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,

  -- Interaction details
  type VARCHAR(50) NOT NULL, -- email, call, meeting, demo, deal, note, etc.
  subject VARCHAR(500),
  description TEXT,
  outcome VARCHAR(100), -- success, failed, scheduled, cancelled, etc.

  -- Timing
  interaction_date TIMESTAMP NOT NULL,
  duration_minutes INTEGER,

  -- Linked entities
  deal_id UUID, -- Link to deal if applicable
  message_id UUID, -- Link to inbound/outbound message

  -- Metadata
  metadata JSONB DEFAULT '{}', -- Store call recordings, meeting notes, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contact_interactions_contact ON contact_interactions(contact_id);
CREATE INDEX idx_contact_interactions_user ON contact_interactions(user_id);
CREATE INDEX idx_contact_interactions_type ON contact_interactions(type);
CREATE INDEX idx_contact_interactions_date ON contact_interactions(interaction_date DESC);
CREATE INDEX idx_contact_interactions_created ON contact_interactions(created_at DESC);

-- Contact Custom Fields Table
-- Allow users to add custom fields to contacts
CREATE TABLE IF NOT EXISTS contact_custom_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,

  field_name VARCHAR(100) NOT NULL,
  field_type VARCHAR(50) NOT NULL, -- text, number, date, boolean, select
  field_options JSONB, -- For select type, array of options

  is_required BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, field_name)
);

CREATE INDEX idx_contact_custom_fields_user ON contact_custom_fields(user_id);

-- Contact Custom Field Values Table
CREATE TABLE IF NOT EXISTS contact_custom_field_values (
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  field_id UUID REFERENCES contact_custom_fields(id) ON DELETE CASCADE,

  value TEXT, -- Store all values as text, convert based on field_type

  updated_at TIMESTAMP DEFAULT NOW(),

  PRIMARY KEY (contact_id, field_id)
);

CREATE INDEX idx_contact_custom_field_values_contact ON contact_custom_field_values(contact_id);
CREATE INDEX idx_contact_custom_field_values_field ON contact_custom_field_values(field_id);

-- Contact Notes Table
-- Quick notes about contacts
CREATE TABLE IF NOT EXISTS contact_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,

  note TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contact_notes_contact ON contact_notes(contact_id);
CREATE INDEX idx_contact_notes_user ON contact_notes(user_id);
CREATE INDEX idx_contact_notes_created ON contact_notes(created_at DESC);

-- Contact Source Tracking
-- Track where contacts came from
CREATE TABLE IF NOT EXISTS contact_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,

  name VARCHAR(100) NOT NULL,
  type VARCHAR(50), -- import, form, api, manual, integration, etc.
  description TEXT,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, name)
);

CREATE INDEX idx_contact_sources_user ON contact_sources(user_id);

-- Add source_id to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES contact_sources(id);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'; -- active, inactive, archived
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE INDEX idx_contacts_source ON contacts(source_id);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);

-- Triggers

-- Update campaign contact count
CREATE OR REPLACE FUNCTION update_campaign_contact_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE contact_campaigns
    SET contact_count = contact_count + 1
    WHERE id = NEW.campaign_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE contact_campaigns
    SET contact_count = contact_count - 1
    WHERE id = OLD.campaign_id;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_campaign_count_on_add AFTER INSERT ON campaign_contacts
  FOR EACH ROW EXECUTE FUNCTION update_campaign_contact_count();

CREATE TRIGGER update_campaign_count_on_remove AFTER DELETE ON campaign_contacts
  FOR EACH ROW EXECUTE FUNCTION update_campaign_contact_count();

-- Update contact last_contact_date on interaction
CREATE OR REPLACE FUNCTION update_contact_last_contact()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contacts
  SET last_contact_date = NEW.interaction_date
  WHERE id = NEW.contact_id
    AND (last_contact_date IS NULL OR last_contact_date < NEW.interaction_date);
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contact_on_interaction AFTER INSERT ON contact_interactions
  FOR EACH ROW EXECUTE FUNCTION update_contact_last_contact();

-- Auto-update updated_at
CREATE TRIGGER update_contact_campaigns_updated_at BEFORE UPDATE ON contact_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_interactions_updated_at BEFORE UPDATE ON contact_interactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_notes_updated_at BEFORE UPDATE ON contact_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Materialized Views for Analytics

-- Contact source breakdown
CREATE MATERIALIZED VIEW IF NOT EXISTS contact_source_stats AS
SELECT
  c.user_id,
  COALESCE(cs.name, 'Unknown') as source_name,
  COUNT(c.id) as total_contacts,
  COUNT(c.id) FILTER (WHERE c.status = 'active') as active_contacts,
  AVG(c.importance_score) as avg_importance,
  MIN(c.created_at) as first_contact_date,
  MAX(c.created_at) as most_recent_contact_date
FROM contacts c
LEFT JOIN contact_sources cs ON c.source_id = cs.id
GROUP BY c.user_id, cs.name;

CREATE UNIQUE INDEX idx_contact_source_stats_user_source
  ON contact_source_stats(user_id, source_name);

-- Contact engagement stats
CREATE MATERIALIZED VIEW IF NOT EXISTS contact_engagement_stats AS
SELECT
  c.user_id,
  c.relationship_type,
  COUNT(c.id) as total_contacts,
  AVG(c.total_messages_received) as avg_messages_received,
  AVG(c.total_messages_sent) as avg_messages_sent,
  AVG(c.importance_score) as avg_importance,
  COUNT(c.id) FILTER (WHERE c.last_contact_date > NOW() - INTERVAL '30 days') as active_last_30d,
  COUNT(c.id) FILTER (WHERE c.last_contact_date > NOW() - INTERVAL '90 days') as active_last_90d,
  COUNT(c.id) FILTER (WHERE c.last_contact_date IS NULL OR c.last_contact_date < NOW() - INTERVAL '90 days') as dormant
FROM contacts c
WHERE c.status = 'active'
GROUP BY c.user_id, c.relationship_type;

CREATE UNIQUE INDEX idx_contact_engagement_stats_user_type
  ON contact_engagement_stats(user_id, relationship_type);

-- Function to refresh analytics views
CREATE OR REPLACE FUNCTION refresh_contact_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY contact_source_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY contact_engagement_stats;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;
