// @ts-nocheck
/**
 * Cold Start Protocol - Types
 *
 * MASTER ACCESS ONLY - Owner's autonomous demand generation engine
 *
 * "Wells, I need a cold start protocol for tort law firms"
 * → Wells autonomously sources, reaches out, registers, responds to RFPs,
 *   and only escalates when stuck.
 */

// ============================================================================
// CAMPAIGN & ICP TYPES
// ============================================================================

export type CampaignType =
  | 'supplier_acquisition'    // Find and onboard suppliers
  | 'buyer_acquisition'       // Find and close buyers
  | 'founder_outreach'        // Connect with founders for partnerships
  | 'talent_sourcing'         // Find job seekers / candidates
  | 'partnership_registration' // Register on partnership portals
  | 'rfp_response'            // Find and respond to RFPs
  | 'full_blitz'              // All of the above

export type CampaignStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'completed'
  | 'escalated'  // Needs human intervention

export type ActionStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'escalated'
  | 'awaiting_response'

export type Channel =
  | 'apollo'
  | 'linkedin'
  | 'linkedin_recruiter'
  | 'email'
  | 'rfp_portal'
  | 'partnership_form'
  | 'internal_database'
  | 'web_scrape'

export interface IcpDefinition {
  id: string
  name: string
  description: string

  // Firmographic filters
  industries: string[]
  companySizeMin?: number
  companySizeMax?: number
  revenueMin?: number
  revenueMax?: number
  locations?: string[]  // Cities, states, countries

  // Role filters
  titles?: string[]  // "Managing Partner", "CFO", "Procurement Director"
  seniorities?: ('c_suite' | 'vp' | 'director' | 'manager' | 'individual')[]
  departments?: string[]

  // Keywords & signals
  keywords?: string[]  // In company description, news, etc.
  technologies?: string[]  // Tech stack signals
  hiringSignals?: boolean  // Are they hiring?
  fundingSignals?: boolean  // Recent funding?

  // Exclusions
  excludeCompanies?: string[]
  excludeDomains?: string[]
  excludeIndustries?: string[]

  // Custom queries
  apolloQuery?: string  // Raw Apollo query
  linkedinQuery?: string  // Raw LinkedIn search query
}

export interface ColdStartCampaign {
  id: string
  name: string
  description: string
  type: CampaignType
  status: CampaignStatus

  // Target ICP
  icp: IcpDefinition

  // Channels to use
  channels: Channel[]

  // Goals & limits
  targetProspects: number
  dailyLimit: number  // Max actions per day
  totalBudget?: number  // If any paid channels

  // Timing
  startDate: string
  endDate?: string
  scheduleHours?: { start: number; end: number }  // 9-17 for business hours
  timezone?: string

  // Sequences
  outreachSequence: OutreachSequence
  followUpSequence: FollowUpSequence

  // Stats
  stats: CampaignStats

  // Escalation rules
  escalationRules: EscalationRule[]

  createdAt: string
  updatedAt: string
}

export interface OutreachSequence {
  id: string
  name: string
  steps: OutreachStep[]
}

export interface OutreachStep {
  stepNumber: number
  channel: Channel
  action: ActionType
  template?: string  // Message template with {{variables}}
  delayDays: number  // Days to wait before this step
  conditions?: StepCondition[]
}

export interface FollowUpSequence {
  maxFollowUps: number
  followUpDelayDays: number
  stopOnReply: boolean
  stopOnMeeting: boolean
}

export interface StepCondition {
  type: 'no_response' | 'opened_email' | 'clicked_link' | 'visited_site'
  value?: string
}

// ============================================================================
// ACTION TYPES
// ============================================================================

export type ActionType =
  | 'search_prospects'       // Find prospects from data source
  | 'enrich_prospect'        // Get more data on a prospect
  | 'send_connection'        // LinkedIn connection request
  | 'send_inmail'            // LinkedIn InMail
  | 'send_email'             // Email outreach
  | 'submit_form'            // Submit partnership/contact form
  | 'respond_to_rfp'         // Generate and submit RFP response
  | 'parse_response'         // Parse incoming response
  | 'schedule_meeting'       // Book meeting via calendar
  | 'escalate'               // Escalate to human

export interface CampaignAction {
  id: string
  campaignId: string
  prospectId?: string

  type: ActionType
  channel: Channel
  status: ActionStatus

  // Action details
  payload: Record<string, unknown>
  result?: ActionResult

  // Retry logic
  attempts: number
  maxAttempts: number
  lastError?: string

  // Timing
  scheduledAt: string
  startedAt?: string
  completedAt?: string

  // Escalation
  escalationReason?: string
  escalatedAt?: string
  resolvedAt?: string
  resolvedBy?: string
}

export interface ActionResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
  responseReceived?: boolean
  meetingBooked?: boolean
  nextAction?: ActionType
}

// ============================================================================
// PROSPECT TYPES
// ============================================================================

export interface Prospect {
  id: string
  campaignId: string

  // Identity
  firstName: string
  lastName: string
  email?: string
  phone?: string
  linkedinUrl?: string

  // Company
  companyName: string
  companyDomain?: string
  companyLinkedin?: string
  industry?: string
  companySize?: number
  revenue?: number

  // Role
  title: string
  seniority?: string
  department?: string

  // Location
  city?: string
  state?: string
  country?: string

  // Enrichment
  enrichedAt?: string
  enrichmentSource?: Channel
  customFields?: Record<string, unknown>

  // Engagement
  status: ProspectStatus
  score: number  // 0-100 lead score
  tags: string[]

  // Timeline
  actions: ProspectAction[]
  responses: ProspectResponse[]

  // Outcomes
  convertedAt?: string
  conversionType?: 'meeting' | 'signup' | 'deal' | 'partnership'

  createdAt: string
  updatedAt: string
}

export type ProspectStatus =
  | 'new'
  | 'contacted'
  | 'engaged'
  | 'replied'
  | 'meeting_scheduled'
  | 'converted'
  | 'not_interested'
  | 'bounced'
  | 'unsubscribed'

export interface ProspectAction {
  id: string
  type: ActionType
  channel: Channel
  status: ActionStatus
  timestamp: string
  details?: string
}

export interface ProspectResponse {
  id: string
  channel: Channel
  content: string
  sentiment: 'positive' | 'neutral' | 'negative'
  intent?: 'interested' | 'not_interested' | 'question' | 'meeting_request' | 'other'
  timestamp: string
  parsed: boolean
  autoReplied: boolean
}

// ============================================================================
// RFP TYPES
// ============================================================================

export interface RfpOpportunity {
  id: string
  campaignId?: string

  // Source
  source: string  // "sam.gov", "rfpdb.com", etc.
  sourceUrl: string

  // Details
  title: string
  description: string
  agency?: string  // Issuing organization
  category: string
  industry?: string

  // Requirements
  requirements?: string[]
  qualifications?: string[]
  certifications?: string[]  // Required certs

  // Dates
  postedDate: string
  dueDate: string
  questionDeadline?: string

  // Financials
  estimatedValue?: number
  contractType?: string  // Fixed, T&M, etc.

  // Status
  status: RfpStatus
  matchScore: number  // How well we match 0-100

  // Our response
  responseId?: string
  responseSubmittedAt?: string

  // Tracking
  createdAt: string
  updatedAt: string
}

export type RfpStatus =
  | 'discovered'
  | 'analyzing'
  | 'qualified'
  | 'disqualified'
  | 'drafting_response'
  | 'response_ready'
  | 'submitted'
  | 'won'
  | 'lost'
  | 'escalated'

export interface RfpResponse {
  id: string
  rfpId: string

  // Content
  executiveSummary: string
  technicalApproach: string
  managementApproach: string
  pastPerformance: string
  pricing?: PricingProposal

  // Attachments
  attachments: RfpAttachment[]

  // Review
  status: 'draft' | 'review' | 'approved' | 'submitted'
  reviewNotes?: string

  // Submission
  submissionMethod?: 'portal' | 'email' | 'mail'
  submittedAt?: string
  confirmationNumber?: string

  createdAt: string
  updatedAt: string
}

export interface PricingProposal {
  totalPrice: number
  lineItems: PricingLineItem[]
  paymentTerms: string
  validUntil: string
}

export interface PricingLineItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface RfpAttachment {
  name: string
  type: string
  url: string
}

// ============================================================================
// PARTNERSHIP FORM TYPES
// ============================================================================

export interface PartnershipPortal {
  id: string
  name: string
  url: string
  formUrl?: string

  // Company info
  company: string
  industry: string

  // Form fields we need to fill
  requiredFields: FormField[]
  optionalFields?: FormField[]

  // Our credentials
  registrationEmail?: string
  registrationComplete: boolean
  registeredAt?: string

  // Status
  status: PartnershipStatus
  lastChecked?: string

  createdAt: string
  updatedAt: string
}

export interface FormField {
  name: string
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'file' | 'checkbox'
  label: string
  required: boolean
  options?: string[]  // For select fields
  defaultValue?: string
  selector?: string  // CSS selector
}

export type PartnershipStatus =
  | 'discovered'
  | 'registration_pending'
  | 'registered'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'escalated'

// ============================================================================
// ESCALATION TYPES
// ============================================================================

export interface EscalationRule {
  condition: EscalationCondition
  action: 'notify' | 'pause_campaign' | 'pause_prospect' | 'require_approval'
  priority: 'low' | 'medium' | 'high' | 'critical'
  notificationChannel?: 'email' | 'sms' | 'slack' | 'in_app'
}

export type EscalationCondition =
  | { type: 'response_sentiment'; value: 'negative' }
  | { type: 'multiple_failures'; threshold: number }
  | { type: 'high_value_prospect'; scoreThreshold: number }
  | { type: 'complex_question'; keywords: string[] }
  | { type: 'legal_concern'; keywords: string[] }
  | { type: 'meeting_request' }
  | { type: 'pricing_question' }
  | { type: 'custom'; rule: string }

export interface Escalation {
  id: string
  campaignId: string
  prospectId?: string
  rfpId?: string
  actionId?: string

  type: string
  reason: string
  priority: 'low' | 'medium' | 'high' | 'critical'

  context: Record<string, unknown>
  suggestedAction?: string

  status: 'open' | 'in_progress' | 'resolved' | 'dismissed'
  assignedTo?: string

  createdAt: string
  resolvedAt?: string
  resolution?: string
}

// ============================================================================
// STATS & REPORTING
// ============================================================================

export interface CampaignStats {
  // Prospecting
  prospectsFound: number
  prospectsContacted: number
  prospectsEnriched: number

  // Engagement
  emailsSent: number
  emailsOpened: number
  emailsClicked: number
  connectionsSent: number
  connectionsAccepted: number
  inmailsSent: number

  // Responses
  totalResponses: number
  positiveResponses: number
  negativeResponses: number
  meetingsBooked: number

  // Conversions
  conversions: number
  conversionRate: number

  // RFPs
  rfpsFound: number
  rfpsSubmitted: number
  rfpsWon: number

  // Partnerships
  formsSubmitted: number
  partnershipsApproved: number

  // Escalations
  escalations: number
  escalationsResolved: number

  // Efficiency
  actionsPerDay: number
  successRate: number
  avgResponseTime: number  // Hours
}

// ============================================================================
// CREDENTIALS & CONFIG
// ============================================================================

export interface ChannelCredentials {
  apollo?: {
    apiKey: string
    dailyCredits: number
    usedCredits: number
  }
  linkedin?: {
    email: string
    password: string  // Encrypted
    sessionCookie?: string
    lastLogin?: string
  }
  linkedinRecruiter?: {
    email: string
    password: string  // Encrypted
    contractId?: string
    sessionCookie?: string
  }
  email?: {
    smtpHost: string
    smtpPort: number
    username: string
    password: string  // Encrypted
    fromName: string
    fromEmail: string
    replyTo?: string
  }
}

export interface ColdStartConfig {
  // Owner credentials
  ownerId: string
  ownerEmail: string

  // Channel credentials
  credentials: ChannelCredentials

  // Default templates
  defaultOutreachTemplates: Record<string, string>
  defaultRfpTemplates: Record<string, string>

  // Company info for forms
  companyInfo: {
    name: string
    website: string
    description: string
    address: string
    phone: string
    email: string
    taxId?: string
    duns?: string  // D-U-N-S number for government RFPs
    cage?: string  // CAGE code
    naicsCodes?: string[]
    certifications?: string[]
  }

  // Limits
  dailyActionLimit: number
  concurrentCampaigns: number

  // Notifications
  escalationEmail: string
  escalationPhone?: string
  slackWebhook?: string
}

// ============================================================================
// API TYPES
// ============================================================================

export interface ColdStartRequest {
  // Natural language command
  command: string

  // Or structured request
  campaignType?: CampaignType
  targetDescription?: string
  icp?: Partial<IcpDefinition>
  channels?: Channel[]

  // Options
  dryRun?: boolean
  autoStart?: boolean
}

export interface ColdStartResponse {
  success: boolean
  campaignId?: string
  campaign?: ColdStartCampaign

  // Preview
  estimatedProspects?: number
  estimatedActions?: number
  estimatedDuration?: string

  // If needs clarification
  clarificationNeeded?: boolean
  questions?: string[]

  // Errors
  error?: string
}
