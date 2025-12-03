-- ============================================================================
-- WELLS AI LEAD CAPTURE SCHEMA
-- Run: psql $POSTGRES_URL < scripts/schema-leads.sql
-- ============================================================================

-- LEADS TABLE
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User Information
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_phone TEXT,
  user_company TEXT,

  -- Lead Details
  journey TEXT NOT NULL, -- 'founder', 'buyer', 'seller', 'jobs'
  requirements TEXT NOT NULL, -- Text summary of what they need
  conversation_history JSONB NOT NULL DEFAULT '[]', -- Array of chat messages

  -- Metadata
  status TEXT NOT NULL DEFAULT 'new', -- 'new', 'contacted', 'in_progress', 'closed', 'won', 'lost'
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  source TEXT DEFAULT 'chat', -- 'chat', 'widget', 'api'

  -- Extracted Info (optional, for better filtering)
  intent TEXT, -- 'hire', 'source', 'sell', 'find_job', 'raise'
  budget DECIMAL(20, 2),
  timeline TEXT,

  -- Contact Tracking
  contacted_at TIMESTAMP,
  contacted_by TEXT,
  last_contact_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_email ON leads(user_email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_journey ON leads(journey);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);

-- LEAD NOTES (for sales team to add notes)
CREATE TABLE IF NOT EXISTS lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- Note content
  note TEXT NOT NULL,
  note_type TEXT DEFAULT 'general', -- 'general', 'call', 'email', 'meeting', 'follow_up'

  -- Author
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_created_at ON lead_notes(created_at DESC);

-- LEAD ACTIVITIES (auto-tracked activities)
CREATE TABLE IF NOT EXISTS lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- Activity details
  activity_type TEXT NOT NULL, -- 'created', 'status_changed', 'contacted', 'note_added', 'email_sent'
  activity_data JSONB,

  -- Tracking
  performed_by TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_created_at ON lead_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_activities_type ON lead_activities(activity_type);
