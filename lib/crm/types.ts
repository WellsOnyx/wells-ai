/**
 * CRM Types - Contact and Campaign Management
 */

export interface Contact {
  id: string
  user_id: string

  // Basic info
  first_name: string
  last_name: string
  email?: string
  phone?: string
  company?: string
  title?: string

  // Social handles
  twitter_handle?: string
  linkedin_url?: string

  // Segmentation
  tags: string[]
  lists: string[]
  source?: string

  // Engagement tracking
  last_contacted_at?: string
  last_response_at?: string
  engagement_score: number
  status: 'active' | 'unsubscribed' | 'bounced' | 'invalid'

  // Custom fields
  custom_fields: Record<string, any>

  // Metadata
  created_at: string
  updated_at: string
}

export interface ContactList {
  id: string
  user_id: string
  name: string
  description?: string
  contact_count: number
  created_at: string
  updated_at: string
}

export interface Campaign {
  id: string
  user_id: string
  name: string
  description?: string

  // Targeting
  list_ids: string[]
  tag_filters: string[]

  // Content
  channel: 'email' | 'sms' | 'twitter' | 'linkedin' | 'multi'
  template_id?: string
  subject?: string
  body: string

  // Scheduling
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled'
  scheduled_at?: string
  started_at?: string
  completed_at?: string

  // Stats
  total_recipients: number
  sent_count: number
  delivered_count: number
  opened_count: number
  clicked_count: number
  replied_count: number
  bounced_count: number
  unsubscribed_count: number

  // Settings
  send_rate_limit?: number // per minute
  timezone?: string

  created_at: string
  updated_at: string
}

export interface OutreachMessage {
  id: string
  campaign_id?: string
  contact_id: string
  user_id: string

  channel: 'email' | 'sms' | 'twitter' | 'linkedin'

  // Content
  subject?: string
  body: string

  // Status
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'failed'

  // External IDs
  external_id?: string

  // Tracking
  sent_at?: string
  delivered_at?: string
  opened_at?: string
  clicked_at?: string
  replied_at?: string

  // Error handling
  error_message?: string
  retry_count: number

  created_at: string
  updated_at: string
}

export interface Template {
  id: string
  user_id: string
  name: string
  channel: 'email' | 'sms' | 'twitter' | 'linkedin'
  subject?: string
  body: string
  variables: string[] // e.g., ['first_name', 'company']
  created_at: string
  updated_at: string
}

// CSV Import types
export interface CSVColumn {
  header: string
  mappedField?: string
  sampleValues: string[]
}

export interface CSVImportMapping {
  columns: CSVColumn[]
  hasHeader: boolean
  delimiter: string
  listId?: string
  tags?: string[]
  source?: string
}

export interface CSVImportResult {
  total: number
  imported: number
  updated: number
  skipped: number
  errors: Array<{ row: number; message: string }>
}

// Outreach types
export interface OutreachRequest {
  contactIds: string[]
  channel: 'email' | 'sms' | 'twitter' | 'linkedin'
  subject?: string
  body: string
  scheduledAt?: string
  campaignName?: string
}

export interface BulkOutreachResult {
  total: number
  queued: number
  sent: number
  failed: number
  errors: Array<{ contactId: string; message: string }>
}
