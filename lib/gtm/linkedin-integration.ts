/**
 * LinkedIn GTM Integration - BYOI Pattern
 *
 * Users bring their own LinkedIn infrastructure:
 * - Personal LinkedIn account
 * - LinkedIn Sales Navigator (optional, for advanced search)
 * - Phantombuster account (optional, for automation)
 *
 * Wells provides:
 * - 80-90% zone targeting intelligence
 * - Message templates following 20-year methodology
 * - Campaign orchestration and tracking
 * - Response classification
 */

import type { RoleQualification } from './sourcing-qualification'
import type { TargetCandidate, OutreachMessage } from './sourcing-engine'
import { generateOutreachMessage } from './sourcing-engine'

/**
 * LinkedIn Campaign - Orchestrates outreach following the methodology
 */
export interface LinkedInCampaign {
  id: string
  userId: string // Clerk user ID

  // Campaign config
  name: string
  qualification: RoleQualification
  status: 'draft' | 'active' | 'paused' | 'completed'

  // Targeting
  searchCriteria: LinkedInSearchCriteria
  targetCandidates: TargetCandidate[]

  // Automation settings
  automationProvider?: 'manual' | 'phantombuster' | 'browser-extension'
  dailyConnectionLimit: number // SAFE: 5-15/day max
  dailyMessageLimit: number // SAFE: 10-20/day max

  // Safety settings
  accountAge?: 'new' | 'established' | 'aged' // Determines limits
  randomDelayMin?: number // Min minutes between actions (default: 5)
  randomDelayMax?: number // Max minutes between actions (default: 15)
  workHoursOnly?: boolean // Only run 9am-5pm (default: true)
  skipWeekends?: boolean // No automation Sat/Sun (default: true)

  // Tracking
  stats: CampaignStats
  createdAt: Date
  lastRunAt?: Date
}

export interface LinkedInSearchCriteria {
  // Sales Navigator filters
  keywords?: string[]
  titles?: string[]
  companies?: string[]
  industries?: string[]
  companySize?: string[] // ['51-200', '201-500', etc.]
  geography?: string[]

  // Boolean search (if not using Sales Navigator)
  booleanQuery?: string

  // Exclusions
  excludeCompanies?: string[]
  excludeTitles?: string[]
}

export interface CampaignStats {
  // Connection requests
  connectionRequestsSent: number
  connectionRequestsAccepted: number
  connectionRequestsDeclined: number
  connectionRequestsPending: number

  // Messages
  messagesSent: number
  messagesDelivered: number
  messagesRead: number

  // Responses (Step 3: Self-screening)
  responsesReceived: number
  qualifiedResponses: number // Passed self-screening
  unqualifiedResponses: number // Failed self-screening

  // Conversions
  meetingsBooked: number
  dealsCreated: number

  // Quality metrics (from PROPRIETARY_METHOD.md)
  responseRate: number // Target: 20-40%
  qualificationRate: number // Target: 50%+
  conversionRate: number // Target: 10-15%
}

/**
 * LinkedIn Connection Request
 * Max 300 characters
 */
export interface ConnectionRequest {
  candidateId: string
  linkedInUrl: string

  // Message (generated from methodology)
  note: string // Max 300 chars

  // Tracking
  sentAt?: Date
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn'
  acceptedAt?: Date
}

/**
 * LinkedIn Message (sent after connection accepted)
 * Follows 3-touch sequence from methodology
 */
export interface LinkedInMessage {
  campaignId: string
  candidateId: string

  // Message content
  touchNumber: 1 | 2 | 3 // Day 1, Day 4, Day 7
  message: string

  // Tracking
  sentAt?: Date
  deliveredAt?: Date
  readAt?: Date
  respondedAt?: Date
  response?: string

  // Classification (Step 3: Self-screening)
  qualified?: boolean
  interestLevel?: 'high' | 'medium' | 'low' | 'crazy'
}

/**
 * Generate LinkedIn connection request following Step 2 formula
 *
 * CRITICAL: Connection notes are max 300 characters
 */
export function generateConnectionRequest(
  candidate: TargetCandidate,
  qualification: RoleQualification
): ConnectionRequest {
  const firstName = candidate.firstName
  const company = candidate.currentCompany

  // Formula: "Hi {{firstName}}, [VALUE PROP IN 1 LINE]. Worth connecting?"
  let note = ''

  if (qualification.roleType === 'other' && qualification.whatTheySell) {
    // GTM use case (selling to prospects)
    note = `Hi ${firstName}, saw ${company}'s work. ${qualification.whatTheySell.substring(0, 100)}. Worth connecting?`
  } else {
    // Recruiting use case (finding candidates)
    note = `Hi ${firstName}, working with companies hiring ${qualification.roleTitle}s. Saw your background at ${company}. Worth connecting?`
  }

  // Ensure under 300 chars
  if (note.length > 300) {
    note = note.substring(0, 297) + '...'
  }

  return {
    candidateId: candidate.id,
    linkedInUrl: candidate.linkedinUrl || '',
    note,
    status: 'pending'
  }
}

/**
 * Generate 3-touch LinkedIn message sequence
 *
 * Based on PROPRIETARY_METHOD.md Step 2 and Step 3:
 * - Day 1: Initial outreach (assumptive, personalized)
 * - Day 4: Value-driven follow-up (social proof, specific outcomes)
 * - Day 7: Final touch (permission to close loop)
 */
export function generate3TouchSequence(
  candidate: TargetCandidate,
  qualification: RoleQualification,
  campaignId: string
): LinkedInMessage[] {
  const firstName = candidate.firstName
  const company = candidate.currentCompany
  const expertise = candidate.expertise
  const contribution = candidate.potentialContribution

  // Touch 1: Day 1 (Immediate after connection)
  const touch1: LinkedInMessage = {
    campaignId,
    candidateId: candidate.id,
    touchNumber: 1,
    message: `Thanks for connecting, ${firstName}!

Quick context: ${qualification.whatTheySell || `I work with companies hiring ${qualification.roleTitle}s`}.

I found your profile both as someone knowledgeable in ${expertise} but also who could potentially contribute to ${contribution}.

I assume you're happy where you are but if you're keeping your eyes and ears open to an opportunity, please circle back.

Best,
[Your Name]`
  }

  // Touch 2: Day 4 (Follow-up with social proof)
  const touch2: LinkedInMessage = {
    campaignId,
    candidateId: candidate.id,
    touchNumber: 2,
    message: `${firstName} - following up on my note.

We just [SOCIAL PROOF: recent win with similar company/person].

Our approach:
→ [BENEFIT 1]
→ [BENEFIT 2]
→ [BENEFIT 3]

Worth a 15-min call this week?

Calendly: [LINK]

Best,
[Your Name]`
  }

  // Touch 3: Day 7 (Final touch - permission to close)
  const touch3: LinkedInMessage = {
    campaignId,
    candidateId: candidate.id,
    touchNumber: 3,
    message: `${firstName} - last note!

I know you're busy. If ${company} isn't ${qualification.roleType === 'other' ? 'looking for this right now' : 'hiring for this role'}, totally understand.

But if you ever need [OUTCOME THEY WANT], we're here:
• [BENEFIT 1]
• [BENEFIT 2]
• [BENEFIT 3]

Feel free to reach out anytime.

Best,
[Your Name]`
  }

  return [touch1, touch2, touch3]
}

/**
 * Create LinkedIn campaign from qualification
 */
export async function createLinkedInCampaign(
  userId: string,
  qualification: RoleQualification,
  searchCriteria: LinkedInSearchCriteria
): Promise<LinkedInCampaign> {
  const campaign: LinkedInCampaign = {
    id: `linkedin-campaign-${Date.now()}`,
    userId,
    name: qualification.roleTitle || 'LinkedIn GTM Campaign',
    qualification,
    status: 'draft',
    searchCriteria,
    targetCandidates: [],

    // ULTRA-SAFE defaults (start slow, scale up)
    dailyConnectionLimit: 5, // Week 1: 5/day
    dailyMessageLimit: 10,   // Week 1: 10/day
    accountAge: 'new',       // Assume new until proven otherwise
    randomDelayMin: 5,       // 5-15 min delays between actions
    randomDelayMax: 15,
    workHoursOnly: true,     // Only 9am-5pm
    skipWeekends: true,      // No weekend automation
    stats: {
      connectionRequestsSent: 0,
      connectionRequestsAccepted: 0,
      connectionRequestsDeclined: 0,
      connectionRequestsPending: 0,
      messagesSent: 0,
      messagesDelivered: 0,
      messagesRead: 0,
      responsesReceived: 0,
      qualifiedResponses: 0,
      unqualifiedResponses: 0,
      meetingsBooked: 0,
      dealsCreated: 0,
      responseRate: 0,
      qualificationRate: 0,
      conversionRate: 0
    },
    createdAt: new Date()
  }

  return campaign
}

/**
 * Generate targeting list from qualification
 *
 * Uses judgment criteria as keywords (Step 0 from methodology)
 */
export function generateLinkedInSearchCriteria(
  qualification: RoleQualification
): LinkedInSearchCriteria {
  const criteria: LinkedInSearchCriteria = {
    keywords: qualification.judgmentCriteria || [],
    companies: qualification.targeting?.targetCompanies || [],
    industries: qualification.targeting?.targetIndustries || [],
    excludeCompanies: qualification.targeting?.avoidCompanies || []
  }

  // Add role-specific targeting
  if (qualification.roleType === 'engineering') {
    criteria.titles = [
      qualification.roleTitle,
      `Senior ${qualification.roleTitle}`,
      `Lead ${qualification.roleTitle}`,
      `Staff ${qualification.roleTitle}`
    ]
  } else if (qualification.roleType === 'sales') {
    criteria.titles = [
      qualification.roleTitle,
      'Account Executive',
      'Sales Manager',
      'VP Sales'
    ]
  } else if (qualification.roleType === 'executive') {
    criteria.titles = [
      qualification.roleTitle,
      'CEO', 'CTO', 'CFO', 'COO',
      'VP', 'SVP', 'EVP'
    ]
  }

  // Geographic targeting
  if (qualification.location?.city) {
    criteria.geography = [qualification.location.city]
  } else if (qualification.location?.remoteScope === 'us-only') {
    criteria.geography = ['United States']
  }

  // Company size targeting
  if (qualification.targeting?.targetCompanies) {
    criteria.companySize = ['51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10000+']
  }

  return criteria
}

/**
 * Calculate campaign quality metrics
 *
 * From PROPRIETARY_METHOD.md response targets
 */
export function calculateCampaignMetrics(campaign: LinkedInCampaign): {
  responseRate: number
  qualificationRate: number
  conversionRate: number
  diagnosis: string | null
} {
  const stats = campaign.stats

  // Response rate = responses / messages sent
  const responseRate = stats.messagesSent > 0
    ? stats.responsesReceived / stats.messagesSent
    : 0

  // Qualification rate = qualified responses / total responses
  const qualificationRate = stats.responsesReceived > 0
    ? stats.qualifiedResponses / stats.responsesReceived
    : 0

  // Conversion rate = meetings booked / messages sent
  const conversionRate = stats.messagesSent > 0
    ? stats.meetingsBooked / stats.messagesSent
    : 0

  // Diagnose issues (from sourcing-engine.ts diagnoseTargeting)
  let diagnosis: string | null = null

  if (responseRate < 0.1) {
    diagnosis = 'Low response rate - Check: Are you in 80-90% zone or chasing 100%? Is messaging formula followed correctly?'
  } else if (responseRate > 0.2 && qualificationRate < 0.3) {
    diagnosis = 'High response but low qualification - Check: Is message assumptive enough? Are you being too generic?'
  } else if (qualificationRate > 0.5 && conversionRate < 0.05) {
    diagnosis = 'High qualification but low conversion - Check: Compensation competitive? Are you overselling?'
  }

  return {
    responseRate,
    qualificationRate,
    conversionRate,
    diagnosis
  }
}

/**
 * LinkedIn integration providers
 */
export interface LinkedInIntegration {
  userId: string
  provider: 'manual' | 'phantombuster' | 'browser-extension'

  // Credentials (encrypted in Clerk metadata)
  credentials?: {
    phantombusterApiKey?: string
    phantombusterAgentId?: string
    linkedInEmail?: string
    linkedInSessionCookie?: string
  }

  // Status
  connected: boolean
  lastSyncAt?: Date

  // Limits
  dailyConnectionLimit: number
  dailyMessageLimit: number
}

/**
 * Connect LinkedIn integration
 */
export async function connectLinkedInIntegration(
  userId: string,
  provider: 'manual' | 'phantombuster' | 'browser-extension',
  credentials?: LinkedInIntegration['credentials']
): Promise<LinkedInIntegration> {
  const integration: LinkedInIntegration = {
    userId,
    provider,
    credentials,
    connected: true,
    // SAFE limits based on provider
    dailyConnectionLimit: provider === 'manual' ? 20 : 5,  // Automated: start at 5/day
    dailyMessageLimit: provider === 'manual' ? 30 : 10     // Automated: start at 10/day
  }

  // TODO: Store encrypted credentials in Clerk user metadata

  return integration
}

/**
 * Send connection request via provider
 */
export async function sendConnectionRequest(
  integration: LinkedInIntegration,
  request: ConnectionRequest
): Promise<boolean> {
  if (integration.provider === 'manual') {
    // Manual: Return false, user will copy-paste
    console.log('📋 Manual connection request - user will copy-paste')
    return false
  }

  if (integration.provider === 'phantombuster') {
    // Use existing Phantombuster integration
    const { sendLinkedInMessageViaPhantom } = await import('./integrations')
    return await sendLinkedInMessageViaPhantom(request.linkedInUrl, request.note)
  }

  if (integration.provider === 'browser-extension') {
    // TODO: Implement browser extension communication
    console.log('🔌 Browser extension not implemented yet')
    return false
  }

  return false
}

/**
 * Send LinkedIn message via provider
 */
export async function sendLinkedInMessage(
  integration: LinkedInIntegration,
  message: LinkedInMessage
): Promise<boolean> {
  if (integration.provider === 'manual') {
    // Manual: Return false, user will copy-paste
    console.log('📋 Manual message - user will copy-paste')
    return false
  }

  if (integration.provider === 'phantombuster') {
    // Use existing Phantombuster integration
    const { sendLinkedInMessageViaPhantom } = await import('./integrations')
    // TODO: Get LinkedIn URL from candidate
    return await sendLinkedInMessageViaPhantom('[linkedin-url]', message.message)
  }

  if (integration.provider === 'browser-extension') {
    // TODO: Implement browser extension communication
    console.log('🔌 Browser extension not implemented yet')
    return false
  }

  return false
}

export default {
  createLinkedInCampaign,
  generateLinkedInSearchCriteria,
  generateConnectionRequest,
  generate3TouchSequence,
  calculateCampaignMetrics,
  connectLinkedInIntegration,
  sendConnectionRequest,
  sendLinkedInMessage
}
