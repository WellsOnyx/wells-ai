/**
 * Wells Onyx GTM Quick Launcher
 *
 * One-command system to sell Wells Onyx executive search services using Wells AI.
 * This is the ultimate dog-food moment - using our platform to sell our own services.
 *
 * Integrates:
 * - Wells Onyx practice group templates
 * - 20-year sourcing methodology (80-90% zone)
 * - Assumptive messaging formula
 * - Instantly.ai for email delivery
 */

import {
  WELLS_ONYX_PRACTICE_GROUPS,
  getPracticeGroup,
  generatePersonalizedEmail,
  generatePersonalizedLinkedIn,
  type PracticeGroup
} from './wells-onyx-templates'

export interface QuickLaunchParams {
  practiceGroupId: string  // 'cybersecurity', 'fintech', 'aerospace', etc.
  targetCount?: number     // How many prospects to find (default: 25)
  instantlyApiKey?: string // User's Instantly API key (optional - can use Wells stack)
}

export interface Prospect {
  firstName: string
  lastName: string
  email: string
  company: string
  title: string
  linkedInUrl?: string
  trigger?: string  // Recent news/event that makes them receptive
  signals: {
    tenureMonths: number
    companyStage: string
    likelyOpen: boolean  // Based on 80-90% signals
    reason: string       // Why they're in the sweet spot
  }
}

export interface Campaign {
  id: string
  practiceGroup: PracticeGroup
  prospects: Prospect[]
  messages: Array<{
    prospectEmail: string
    channel: 'email' | 'linkedin'
    subject?: string
    body: string
    approved: boolean
    sent: boolean
  }>
  status: 'draft' | 'ready' | 'sending' | 'sent'
  createdAt: Date
}

/**
 * Quick Launch - One Command to Start Selling
 *
 * Usage:
 * ```
 * const campaign = await quickLaunch({ practiceGroupId: 'cybersecurity' })
 * // Wells AI finds prospects, generates messages, queues for approval
 * ```
 */
export async function quickLaunch(params: QuickLaunchParams): Promise<Campaign> {
  const practiceGroup = getPracticeGroup(params.practiceGroupId)
  if (!practiceGroup) {
    throw new Error(`Practice group not found: ${params.practiceGroupId}`)
  }

  // Step 1: Find prospects in 80-90% zone
  console.log(`[WELLS ONYX GTM] Finding prospects for ${practiceGroup.name}...`)
  const prospects = await findProspectsIn80to90Zone({
    practiceGroup,
    targetCount: params.targetCount || 25
  })

  console.log(`[WELLS ONYX GTM] Found ${prospects.length} prospects in 80-90% zone`)

  // Step 2: Generate messages using Wells Onyx formula
  console.log(`[WELLS ONYX GTM] Generating personalized messages...`)
  const messages = prospects.map((prospect) => {
    // Email message
    const emailMessage = generatePersonalizedEmail({
      practiceGroupId: params.practiceGroupId,
      prospect: {
        firstName: prospect.firstName,
        company: prospect.company,
        trigger: prospect.trigger,
        recentMilestone: prospect.trigger
      }
    })

    return {
      prospectEmail: prospect.email,
      channel: 'email' as const,
      subject: emailMessage.subject,
      body: emailMessage.body,
      approved: false,
      sent: false
    }
  })

  const campaign: Campaign = {
    id: `wo_gtm_${Date.now()}`,
    practiceGroup,
    prospects,
    messages,
    status: 'draft',
    createdAt: new Date()
  }

  console.log(`[WELLS ONYX GTM] Campaign created: ${campaign.id}`)
  console.log(`[WELLS ONYX GTM] ${prospects.length} prospects, ${messages.length} messages queued`)
  console.log(`[WELLS ONYX GTM] Next: Review messages and approve to send`)

  return campaign
}

/**
 * Find prospects in the 80-90% zone using proprietary targeting
 *
 * This implements the methodology from PROPRIETARY_METHOD.md:
 * - NOT 100% (too competitive, unreachable)
 * - NOT 50% (under-qualified)
 * - THE SWEET SPOT: Qualified enough, reachable enough
 */
async function findProspectsIn80to90Zone(params: {
  practiceGroup: PracticeGroup
  targetCount: number
}): Promise<Prospect[]> {
  const { practiceGroup, targetCount } = params

  // This would integrate with Apollo.io, LinkedIn Sales Navigator, or Instantly.ai
  // For now, returning mock data structure to show the flow

  const mockProspects: Prospect[] = [
    {
      firstName: 'Sarah',
      lastName: 'Chen',
      email: 'sarah.chen@midtier-tech.com',
      company: 'MidTier Tech Corp',
      title: 'VP of Human Resources',
      linkedInUrl: 'https://linkedin.com/in/sarahchen',
      trigger: 'recently announced Series C funding',
      signals: {
        tenureMonths: 28, // 2.3 years - past honeymoon, not too settled
        companyStage: 'Series C',
        likelyOpen: true,
        reason: '80-90% ZONE: 28 months tenure (sweet spot), company just raised (hiring mode), HR leader (feels pain of exec search), not at FAANG (reachable)'
      }
    },
    {
      firstName: 'Michael',
      lastName: 'Rodriguez',
      email: 'mrodriguez@growth-company.io',
      company: 'Growth Company Inc',
      title: 'Chief Operating Officer',
      trigger: 'expanded into 3 new states',
      signals: {
        tenureMonths: 22,
        companyStage: 'Series B',
        likelyOpen: true,
        reason: '80-90% ZONE: COO at scaling company (feels hiring pain), recent expansion (needs execs for new markets), 22 months tenure (receptive to new relationships)'
      }
    }
  ]

  // In production, this would:
  // 1. Search Instantly.ai or Apollo.io using practiceGroup.icp
  // 2. Apply 80-90% filters:
  //    - Tenure: 18-36 months (sweet spot)
  //    - Company stage: Match but not too hot
  //    - Recent triggers: Funding, expansion, incidents
  //    - Exclude: FAANG, recent promotions, just joined
  // 3. Return {targetCount} prospects

  return mockProspects.slice(0, targetCount)
}

/**
 * Approve campaign and send messages
 */
export async function approveCampaign(params: {
  campaign: Campaign
  instantlyApiKey: string
  instantlyCampaignId?: string
}): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  for (const message of params.campaign.messages) {
    if (!message.approved) continue

    try {
      // Send via Instantly.ai
      await sendViaInstantly({
        apiKey: params.instantlyApiKey,
        campaignId: params.instantlyCampaignId || process.env.INSTANTLY_CAMPAIGN_ID!,
        to: message.prospectEmail,
        subject: message.subject!,
        body: message.body
      })

      message.sent = true
      sent++
    } catch (error) {
      console.error(`[WELLS ONYX GTM] Failed to send to ${message.prospectEmail}:`, error)
      failed++
    }
  }

  params.campaign.status = 'sent'
  return { sent, failed }
}

/**
 * Send email via Instantly.ai
 */
async function sendViaInstantly(params: {
  apiKey: string
  campaignId: string
  to: string
  subject: string
  body: string
}): Promise<void> {
  const response = await fetch('https://api.instantly.ai/api/v1/lead/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      api_key: params.apiKey,
      campaign_id: params.campaignId,
      email: params.to,
      variables: {
        subject: params.subject,
        message: params.body
      }
    })
  })

  if (!response.ok) {
    throw new Error(`Instantly API error: ${response.statusText}`)
  }
}

/**
 * Preview campaign before sending
 */
export function previewCampaign(campaign: Campaign): string {
  const lines = [
    `WELLS ONYX GTM CAMPAIGN: ${campaign.practiceGroup.name}`,
    ``,
    `Prospects: ${campaign.prospects.length}`,
    `Messages: ${campaign.messages.length}`,
    ``,
    `--- SAMPLE MESSAGE ---`,
    ``,
    `Subject: ${campaign.messages[0]?.subject}`,
    ``,
    campaign.messages[0]?.body,
    ``,
    `--- 80-90% ZONE TARGETING ---`,
    ``,
    ...campaign.prospects.slice(0, 3).map(p =>
      `${p.firstName} ${p.lastName} (${p.title} at ${p.company})\n  ${p.signals.reason}`
    ),
    ``,
    `Next: Approve messages and send via Instantly.ai`
  ]

  return lines.join('\n')
}

/**
 * Integration with Wells AI chat
 *
 * This detects when you ask Wells to sell your services and triggers the quick launch.
 *
 * Example conversation:
 *
 * User: "Wells, find me buyers for my cybersecurity practice"
 * Wells: [Detects intent, calls quickLaunch({ practiceGroupId: 'cybersecurity' })]
 * Wells: "I've identified 25 prospects in the 80-90% zone - VPs of HR and COOs at
 *        Series B/C companies who recently raised funding or expanded. I've drafted
 *        personalized messages using your formula. Want to review before I send?"
 */
export async function detectWellsOnyxGTMIntent(message: string): Promise<{
  isWellsOnyxGTM: boolean
  practiceGroupId?: string
  confidence: number
}> {
  const lowerMessage = message.toLowerCase()

  // Detect practice groups
  if (lowerMessage.includes('cybersecurity') || lowerMessage.includes('ciso')) {
    return { isWellsOnyxGTM: true, practiceGroupId: 'cybersecurity', confidence: 0.95 }
  }

  if (lowerMessage.includes('fintech') || lowerMessage.includes('chief risk')) {
    return { isWellsOnyxGTM: true, practiceGroupId: 'fintech', confidence: 0.95 }
  }

  if (lowerMessage.includes('aerospace') || lowerMessage.includes('defense')) {
    return { isWellsOnyxGTM: true, practiceGroupId: 'aerospace', confidence: 0.95 }
  }

  if (lowerMessage.includes('healthcare') || lowerMessage.includes('medical')) {
    return { isWellsOnyxGTM: true, practiceGroupId: 'healthcare', confidence: 0.95 }
  }

  if (lowerMessage.includes('saas') || lowerMessage.includes('cro') || lowerMessage.includes('revenue')) {
    return { isWellsOnyxGTM: true, practiceGroupId: 'saas', confidence: 0.95 }
  }

  // Generic exec search intent
  if (
    (lowerMessage.includes('find') || lowerMessage.includes('get')) &&
    (lowerMessage.includes('buyers') || lowerMessage.includes('clients') || lowerMessage.includes('customers')) &&
    (lowerMessage.includes('practice') || lowerMessage.includes('exec search') || lowerMessage.includes('search'))
  ) {
    return { isWellsOnyxGTM: true, confidence: 0.85 }
  }

  return { isWellsOnyxGTM: false, confidence: 0 }
}
