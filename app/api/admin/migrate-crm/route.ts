/**
 * CRM Migration API - Run database migrations
 * POST /api/admin/migrate-crm
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

const ADMIN_KEY = process.env.COLD_START_MASTER_KEY || 'wells-master-2024-coldstart'

const CRM_SCHEMA = `
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
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  company TEXT,
  title TEXT,
  twitter_handle TEXT,
  linkedin_url TEXT,
  tags TEXT[] DEFAULT '{}',
  source TEXT,
  last_contacted_at TIMESTAMPTZ,
  last_response_at TIMESTAMPTZ,
  engagement_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced', 'invalid')),
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
);

-- Contact-List membership
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
  list_ids UUID[] DEFAULT '{}',
  tag_filters TEXT[] DEFAULT '{}',
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'twitter', 'linkedin', 'multi')),
  template_id UUID REFERENCES crm_templates(id),
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  unsubscribed_count INTEGER DEFAULT 0,
  send_rate_limit INTEGER DEFAULT 60,
  timezone TEXT DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outreach Messages
CREATE TABLE IF NOT EXISTS crm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES crm_campaigns(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'twitter', 'linkedin')),
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed')),
  external_id TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`

const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_crm_contacts_user ON crm_contacts(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email)',
  'CREATE INDEX IF NOT EXISTS idx_crm_contacts_phone ON crm_contacts(phone)',
  'CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(status)',
  'CREATE INDEX IF NOT EXISTS idx_crm_contacts_tags ON crm_contacts USING GIN(tags)',
  'CREATE INDEX IF NOT EXISTS idx_crm_lists_user ON crm_lists(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_crm_campaigns_user ON crm_campaigns(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_crm_campaigns_status ON crm_campaigns(status)',
  'CREATE INDEX IF NOT EXISTS idx_crm_messages_user ON crm_messages(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_crm_messages_contact ON crm_messages(contact_id)',
  'CREATE INDEX IF NOT EXISTS idx_crm_messages_campaign ON crm_messages(campaign_id)',
  'CREATE INDEX IF NOT EXISTS idx_crm_messages_status ON crm_messages(status)',
]

export async function POST(request: Request) {
  try {
    const { adminKey } = await request.json().catch(() => ({}))

    if (adminKey !== ADMIN_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results: string[] = []

    // Run main schema
    try {
      await query(CRM_SCHEMA)
      results.push('✅ Core tables created')
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
      AND table_name LIKE 'crm_%'
      ORDER BY table_name
    `)

    return NextResponse.json({
      success: true,
      message: 'CRM migration complete',
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
