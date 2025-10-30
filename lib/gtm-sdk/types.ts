/**
 * @wells/gtm-sdk - Type Definitions
 * Complete GTM automation at 33bps on closed ACV
 */

// ============================================
// Core SDK Types
// ============================================

export interface WellsGTMConfig {
  apiKey: string
  icp: ICPDefinition
  goal: string // "book 5 demos/week", "$100k MRR in 90 days", etc.
  outreach?: OutreachConfig
  billing?: BillingConfig
  integrations?: IntegrationConfig
}

export interface ICPDefinition {
  role: string | string[] // "CPO", "VP Engineering", etc.
  companySize?: string // "500-5000", "10000+", etc.
  industry?: string | string[] // "SaaS", "FinTech", etc.
  geography?: string | string[] // "US", "North America", etc.
  techStack?: string[] // "AWS", "Kubernetes", etc.
  revenue?: string // "$10M-$100M", etc.
  fundingStage?: string // "Series A", "Series B+", etc.
  signals?: ProspectSignal[] // Hiring, funding events, etc.
}

export interface ProspectSignal {
  type: 'hiring' | 'funding' | 'product_launch' | 'expansion' | 'tech_migration'
  keywords?: string[]
  recency?: number // days
}

export interface OutreachConfig {
  channelsEnabled: OutreachChannel[]
  dailyLimit: number // max outreach per day
  tone: 'professional' | 'casual' | 'consultative'
  personalization: 'high' | 'medium' | 'low'
  followUpSequence: FollowUpStep[]
}

export type OutreachChannel = 'linkedin' | 'email' | 'twitter' | 'phone'

export interface FollowUpStep {
  delayDays: number
  channel: OutreachChannel
  template: string
}

export interface BillingConfig {
  model: 'success_fee' | 'hybrid'
  successFeeBps: number // 33 = 0.33%
  monthlyMinimum?: number
  paymentTerms: 'net30' | 'net60' | 'net90'
}

export interface IntegrationConfig {
  crm?: 'salesforce' | 'hubspot' | 'pipedrive'
  calendar?: 'google' | 'outlook' | 'calendly'
  slack?: string // Slack webhook URL
  analytics?: string // PostHog, Mixpanel, etc.
}

// ============================================
// Prospect Types
// ============================================

export interface Prospect {
  id: string
  name: string
  email?: string
  linkedinUrl?: string
  twitterUrl?: string
  role: string
  company: Company
  icpScore: number // 0-100
  signals: ProspectSignal[]
  status: ProspectStatus
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface Company {
  name: string
  website?: string
  linkedinUrl?: string
  size: string
  industry: string
  location: string
  revenue?: string
  fundingStage?: string
  techStack?: string[]
  recentNews?: NewsItem[]
}

export interface NewsItem {
  title: string
  url: string
  date: Date
  type: 'funding' | 'hiring' | 'product' | 'expansion'
}

export type ProspectStatus =
  | 'discovered'
  | 'qualified'
  | 'outreach_sent'
  | 'replied'
  | 'meeting_booked'
  | 'meeting_held'
  | 'opportunity_created'
  | 'in_negotiation'
  | 'closed_won'
  | 'closed_lost'
  | 'nurturing'
  | 'disqualified'

// ============================================
// Outreach Types
// ============================================

export interface OutreachMessage {
  id: string
  prospectId: string
  channel: OutreachChannel
  subject?: string // for email/LinkedIn
  body: string
  status: OutreachStatus
  sentAt?: Date
  deliveredAt?: Date
  openedAt?: Date
  repliedAt?: Date
  reply?: string
  metadata?: Record<string, any>
}

export type OutreachStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'replied'
  | 'bounced'
  | 'failed'

// ============================================
// Meeting Types
// ============================================

export interface Meeting {
  id: string
  prospectId: string
  scheduledAt: Date
  duration: number // minutes
  type: 'discovery' | 'demo' | 'follow_up' | 'close'
  status: MeetingStatus
  attendees: string[]
  calendarEventId?: string
  notes?: string
  outcome?: MeetingOutcome
  nextSteps?: string[]
  createdAt: Date
  updatedAt: Date
}

export type MeetingStatus = 'scheduled' | 'confirmed' | 'held' | 'no_show' | 'cancelled'

export interface MeetingOutcome {
  qualified: boolean
  interest: 'high' | 'medium' | 'low'
  budget?: string
  timeline?: string
  nextMeeting?: Date
  estimatedACV?: number
}

// ============================================
// Pipeline Types
// ============================================

export interface Opportunity {
  id: string
  prospectId: string
  name: string
  stage: OpportunityStage
  amount: number // ACV
  probability: number // 0-100
  expectedCloseDate: Date
  owner: string
  activities: Activity[]
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export type OpportunityStage =
  | 'discovery'
  | 'qualification'
  | 'demo'
  | 'proposal'
  | 'negotiation'
  | 'contract_review'
  | 'closed_won'
  | 'closed_lost'

export interface Activity {
  id: string
  type: 'email' | 'call' | 'meeting' | 'note' | 'task'
  description: string
  date: Date
  outcome?: string
}

// ============================================
// Analytics Types
// ============================================

export interface GTMMetrics {
  prospecting: ProspectingMetrics
  outreach: OutreachMetrics
  meetings: MeetingMetrics
  pipeline: PipelineMetrics
  revenue: RevenueMetrics
}

export interface ProspectingMetrics {
  totalProspects: number
  qualifiedProspects: number
  averageICPScore: number
  prospectsByStage: Record<ProspectStatus, number>
  prospectsBySource: Record<string, number>
}

export interface OutreachMetrics {
  totalOutreach: number
  deliveryRate: number // %
  openRate: number // %
  replyRate: number // %
  positiveReplyRate: number // %
  averageResponseTime: number // hours
}

export interface MeetingMetrics {
  totalMeetings: number
  showRate: number // %
  conversionToOpportunity: number // %
  averageMeetingValue: number
  meetingsByType: Record<Meeting['type'], number>
}

export interface PipelineMetrics {
  totalOpportunities: number
  totalPipelineValue: number
  averageDealSize: number
  winRate: number // %
  averageSalesCycle: number // days
  opportunitiesByStage: Record<OpportunityStage, number>
  forecastedRevenue: number
}

export interface RevenueMetrics {
  closedWonACV: number
  wellsFee: number // 33bps
  totalInvoiced: number
  totalPaid: number
  outstandingAR: number
  averagePaymentTime: number // days
}

// ============================================
// SDK Response Types
// ============================================

export interface GTMResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  metadata?: {
    requestId: string
    timestamp: Date
    rateLimit?: RateLimitInfo
  }
}

export interface RateLimitInfo {
  limit: number
  remaining: number
  resetAt: Date
}

// ============================================
// Webhook Types
// ============================================

export interface WebhookEvent {
  id: string
  type: WebhookEventType
  data: any
  timestamp: Date
}

export type WebhookEventType =
  | 'prospect.discovered'
  | 'prospect.qualified'
  | 'outreach.sent'
  | 'outreach.replied'
  | 'meeting.booked'
  | 'meeting.held'
  | 'opportunity.created'
  | 'opportunity.stage_changed'
  | 'deal.closed_won'
  | 'deal.closed_lost'
  | 'invoice.created'
  | 'invoice.paid'
