/**
 * Cold Start Migration API - Run database migrations for conversational CRM
 * POST /api/admin/migrate-coldstart
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

const ADMIN_KEY = process.env.COLD_START_MASTER_KEY || 'wells-master-2024-coldstart'

const COLDSTART_SCHEMA = `
-- Cold Start Campaigns
CREATE TABLE IF NOT EXISTS coldstart_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT,
  icp_config JSONB NOT NULL DEFAULT '{}',
  channels JSONB NOT NULL DEFAULT '["email"]',
  geo TEXT DEFAULT 'United States',
  daily_volume INTEGER DEFAULT 50,
  status TEXT DEFAULT 'draft',
  total_contacts INTEGER DEFAULT 0,
  total_reached INTEGER DEFAULT 0,
  total_responses INTEGER DEFAULT 0,
  total_meetings INTEGER DEFAULT 0,
  total_deals INTEGER DEFAULT 0,
  total_spend DECIMAL(12, 2) DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign Contacts
CREATE TABLE IF NOT EXISTS coldstart_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  campaign_id UUID REFERENCES coldstart_campaigns(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  twitter_handle TEXT,
  company_name TEXT,
  company_domain TEXT,
  company_size TEXT,
  industry TEXT,
  title TEXT,
  department TEXT,
  seniority TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  icp_score INTEGER DEFAULT 0,
  segment TEXT,
  tags TEXT[] DEFAULT '{}',
  enrichment_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'new',
  last_contacted_at TIMESTAMPTZ,
  last_response_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cold Start Activities
CREATE TABLE IF NOT EXISTS coldstart_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES coldstart_campaigns(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES coldstart_contacts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  message TEXT,
  subject TEXT,
  details JSONB DEFAULT '{}',
  call_duration_seconds INTEGER,
  call_recording_url TEXT,
  call_transcript TEXT,
  outcome TEXT,
  sentiment TEXT,
  next_action TEXT,
  provider TEXT,
  provider_id TEXT,
  provider_response JSONB,
  cost DECIMAL(8, 4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cold Start Conversations (for chat context)
CREATE TABLE IF NOT EXISTS coldstart_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  campaign_id UUID REFERENCES coldstart_campaigns(id) ON DELETE SET NULL,
  flow_state TEXT DEFAULT 'initial',
  context JSONB DEFAULT '{}',
  messages JSONB DEFAULT '[]',
  total_messages INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);

-- Contact Uploads (tracking CSV imports)
CREATE TABLE IF NOT EXISTS coldstart_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  filename TEXT,
  file_size_bytes INTEGER,
  total_rows INTEGER,
  valid_contacts INTEGER DEFAULT 0,
  duplicate_contacts INTEGER DEFAULT 0,
  invalid_contacts INTEGER DEFAULT 0,
  enriched_contacts INTEGER DEFAULT 0,
  column_mapping JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outreach Messages (for email/sms/linkedin)
CREATE TABLE IF NOT EXISTS coldstart_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  campaign_id UUID REFERENCES coldstart_campaigns(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES coldstart_contacts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  personalization_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  external_id TEXT,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  reply_content TEXT,
  reply_sentiment TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outreach Events (tracking opens, clicks, replies)
CREATE TABLE IF NOT EXISTS coldstart_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES coldstart_messages(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES coldstart_contacts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  channel TEXT,
  details JSONB DEFAULT '{}',
  reply_content TEXT,
  reply_sentiment TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`

const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_coldstart_campaigns_user ON coldstart_campaigns(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_coldstart_campaigns_status ON coldstart_campaigns(status)',
  'CREATE INDEX IF NOT EXISTS idx_coldstart_contacts_user ON coldstart_contacts(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_coldstart_contacts_campaign ON coldstart_contacts(campaign_id)',
  'CREATE INDEX IF NOT EXISTS idx_coldstart_contacts_status ON coldstart_contacts(status)',
  'CREATE INDEX IF NOT EXISTS idx_coldstart_contacts_email ON coldstart_contacts(email)',
  'CREATE INDEX IF NOT EXISTS idx_coldstart_activities_campaign ON coldstart_activities(campaign_id)',
  'CREATE INDEX IF NOT EXISTS idx_coldstart_activities_contact ON coldstart_activities(contact_id)',
  'CREATE INDEX IF NOT EXISTS idx_coldstart_conversations_user_session ON coldstart_conversations(user_id, session_id)',
  'CREATE INDEX IF NOT EXISTS idx_coldstart_messages_user ON coldstart_messages(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_coldstart_messages_campaign ON coldstart_messages(campaign_id)',
  'CREATE INDEX IF NOT EXISTS idx_coldstart_messages_contact ON coldstart_messages(contact_id)',
  'CREATE INDEX IF NOT EXISTS idx_coldstart_messages_status ON coldstart_messages(status)',
  'CREATE INDEX IF NOT EXISTS idx_coldstart_events_message ON coldstart_events(message_id)',
]

export async function POST(request: Request) {
  try {
    const { adminKey } = await request.json().catch(() => ({}))

    // Get env at runtime, not build time
    const runtimeKey = process.env.COLD_START_MASTER_KEY || 'wells-master-2024-coldstart'

    if (adminKey !== runtimeKey) {
      console.log('Auth failed - received:', adminKey?.slice(0, 10), 'expected:', runtimeKey?.slice(0, 10))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results: string[] = []

    // Run main schema
    try {
      await query(COLDSTART_SCHEMA)
      results.push('✅ Core coldstart tables created')
    } catch (error: any) {
      results.push(`⚠️ Core tables: ${error.message}`)
    }

    // Run indexes
    for (const idx of INDEXES) {
      try {
        await query(idx)
        results.push(`✅ ${idx.match(/idx_\w+/)?.[0] || 'index'}`)
      } catch (error: any) {
        if (error.code === '42P07' || error.message.includes('already exists')) {
          results.push(`⏭️ Index already exists`)
        } else {
          results.push(`⚠️ Index error: ${error.message}`)
        }
      }
    }

    // Verify tables
    const tables = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'coldstart_%'
      ORDER BY table_name
    `)

    return NextResponse.json({
      success: true,
      message: 'Cold start migration complete',
      tables: tables.rows.map(r => r.table_name),
      log: results
    })

  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json({
      error: 'Migration failed',
      details: error.message
    }, { status: 500 })
  }
}
