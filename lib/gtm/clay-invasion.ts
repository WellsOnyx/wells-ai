/**
 * Clay.earth Silent Invasion System
 * 150K+ multi-channel contact database → Autonomous outreach machine
 */

export interface ClayContact {
  // Core Identity
  id: string
  firstName: string
  lastName: string
  fullName: string
  title: string
  company: string

  // Contact Channels (not all will be present)
  email?: string
  linkedInUrl?: string
  twitterHandle?: string
  phone?: string

  // Enrichment Data
  industry?: string
  companySize?: string
  fundingStage?: string
  recentFunding?: {
    amount: string
    date: string
    round: string
  }
  companySignals?: {
    hiring?: boolean
    productLaunch?: boolean
    acquisition?: boolean
    expansion?: boolean
  }

  // Scoring
  fitScore?: number // 0-100, how well they match ICP
  reachability?: number // 0-100, how many channels available
  timing?: number // 0-100, buying signals strength

  // Practice Group Assignment
  practiceGroup?: 'executive-search' | 'ai-ops' | 'idre-agency'

  // Tracking
  status?: 'new' | 'queued' | 'outreach-sent' | 'responded' | 'qualified' | 'unqualified'
  channels?: Array<'email' | 'linkedin' | 'twitter' | 'sms'>
  lastContacted?: Date
}

/**
 * Smart Channel Router
 * Decides which channel(s) to use based on contact data + practice group
 */
export function routeContact(contact: ClayContact): {
  primary: 'email' | 'linkedin' | 'twitter' | 'sms' | null
  secondary?: Array<'email' | 'linkedin' | 'twitter' | 'sms'>
  reasoning: string
} {
  const availableChannels: Array<'email' | 'linkedin' | 'twitter' | 'sms'> = []

  if (contact.email) availableChannels.push('email')
  if (contact.linkedInUrl) availableChannels.push('linkedin')
  if (contact.twitterHandle) availableChannels.push('twitter')
  if (contact.phone) availableChannels.push('sms')

  if (availableChannels.length === 0) {
    return { primary: null, reasoning: 'No contact channels available' }
  }

  // Practice group specific routing
  switch (contact.practiceGroup) {
    case 'executive-search':
      // Execs prefer LinkedIn > Email > SMS
      if (contact.linkedInUrl) {
        return {
          primary: 'linkedin',
          secondary: contact.email ? ['email'] : [],
          reasoning: 'Executives respond best to LinkedIn for talent discussions'
        }
      }
      if (contact.email) {
        return {
          primary: 'email',
          secondary: contact.linkedInUrl ? ['linkedin'] : [],
          reasoning: 'Professional email for executive search'
        }
      }
      break

    case 'ai-ops':
      // CTOs are on Twitter, also check LinkedIn
      if (contact.twitterHandle) {
        return {
          primary: 'twitter',
          secondary: [contact.email && 'email', contact.linkedInUrl && 'linkedin'].filter(Boolean) as any,
          reasoning: 'CTOs are active on Twitter/X for AI discussions'
        }
      }
      if (contact.linkedInUrl) {
        return {
          primary: 'linkedin',
          secondary: contact.email ? ['email'] : [],
          reasoning: 'LinkedIn for technical leadership conversations'
        }
      }
      if (contact.email) {
        return {
          primary: 'email',
          reasoning: 'Email fallback for AI Ops prospects'
        }
      }
      break

    case 'idre-agency':
      // Healthcare CFOs prefer formal email > LinkedIn
      if (contact.email) {
        return {
          primary: 'email',
          secondary: contact.linkedInUrl ? ['linkedin'] : [],
          reasoning: 'Healthcare executives prefer professional email'
        }
      }
      if (contact.linkedInUrl) {
        return {
          primary: 'linkedin',
          reasoning: 'LinkedIn for healthcare CFO outreach'
        }
      }
      break
  }

  // Default: Email first if available
  if (contact.email) {
    return {
      primary: 'email',
      secondary: availableChannels.filter(c => c !== 'email'),
      reasoning: 'Default to email for B2B'
    }
  }

  // Fallback to first available
  return {
    primary: availableChannels[0],
    reasoning: 'Using first available channel'
  }
}

/**
 * Multi-Channel Campaign Strategy
 * Orchestrates touches across channels over time
 */
export interface CampaignStrategy {
  name: string
  practiceGroup: 'executive-search' | 'ai-ops' | 'idre-agency'
  contactsPerDay: number
  touches: Array<{
    day: number
    channel: 'email' | 'linkedin' | 'twitter' | 'sms'
    messageType: 'intro' | 'value' | 'social-proof' | 'urgency' | 'final'
    condition?: string // e.g., "only if no response to previous"
  }>
}

export const SILENT_INVASION_CAMPAIGNS: Record<string, CampaignStrategy> = {
  'exec-search-blitz': {
    name: 'Executive Search - Multi-Channel Blitz',
    practiceGroup: 'executive-search',
    contactsPerDay: 100, // 100/day = 3,000/month = 36,000/year from 150K list
    touches: [
      {
        day: 0,
        channel: 'linkedin',
        messageType: 'intro',
        condition: 'if linkedin available'
      },
      {
        day: 1,
        channel: 'email',
        messageType: 'intro',
        condition: 'if no linkedin response'
      },
      {
        day: 4,
        channel: 'email',
        messageType: 'value',
        condition: 'if no response'
      },
      {
        day: 7,
        channel: 'linkedin',
        messageType: 'social-proof',
        condition: 'if connected but no response'
      },
      {
        day: 10,
        channel: 'sms',
        messageType: 'urgency',
        condition: 'if fitScore > 80 and no response'
      }
    ]
  },

  'ai-ops-twitter-first': {
    name: 'AI Ops - Twitter → Email',
    practiceGroup: 'ai-ops',
    contactsPerDay: 150, // Higher volume, faster sales cycle
    touches: [
      {
        day: 0,
        channel: 'twitter',
        messageType: 'intro',
        condition: 'if twitter available - engage with tweets first'
      },
      {
        day: 2,
        channel: 'twitter',
        messageType: 'value',
        condition: 'DM after engagement'
      },
      {
        day: 3,
        channel: 'email',
        messageType: 'intro',
        condition: 'parallel email sequence'
      },
      {
        day: 6,
        channel: 'linkedin',
        messageType: 'social-proof',
        condition: 'if no response'
      },
      {
        day: 10,
        channel: 'email',
        messageType: 'final',
        condition: 'final touch'
      }
    ]
  },

  'idre-email-heavy': {
    name: 'IDRE - Email-First (Healthcare Formal)',
    practiceGroup: 'idre-agency',
    contactsPerDay: 50, // Lower volume, longer sales cycle, higher deal value
    touches: [
      {
        day: 0,
        channel: 'email',
        messageType: 'intro',
        condition: 'professional introduction'
      },
      {
        day: 3,
        channel: 'email',
        messageType: 'value',
        condition: 'if no response - case study'
      },
      {
        day: 7,
        channel: 'linkedin',
        messageType: 'social-proof',
        condition: 'LinkedIn connection with context'
      },
      {
        day: 14,
        channel: 'email',
        messageType: 'urgency',
        condition: 'if no response - compliance deadline angle'
      },
      {
        day: 21,
        channel: 'sms',
        messageType: 'final',
        condition: 'if fitScore > 90 - high-value only'
      }
    ]
  }
}

/**
 * Lead Scoring Algorithm
 * Prioritizes which contacts to reach out to first
 */
export function scoreContact(contact: ClayContact): number {
  let score = 0

  // Fit Score (0-40 points)
  // Does their profile match our ICP?
  if (contact.practiceGroup === 'executive-search') {
    if (contact.title?.match(/(CEO|Chief Executive|CHRO|VP Talent)/i)) score += 20
    if (contact.fundingStage?.match(/(Series B|Series C|Growth)/i)) score += 10
    if (contact.companySignals?.hiring) score += 10
  }

  if (contact.practiceGroup === 'ai-ops') {
    if (contact.title?.match(/(CTO|VP Engineering|Head of AI)/i)) score += 20
    if (contact.industry?.match(/(Software|SaaS|AI|Technology)/i)) score += 10
    if (contact.companySignals?.productLaunch) score += 10
  }

  if (contact.practiceGroup === 'idre-agency') {
    if (contact.title?.match(/(CFO|COO|VP Revenue Cycle)/i)) score += 20
    if (contact.industry?.match(/(Healthcare|Hospital)/i)) score += 10
    if (contact.companySize?.match(/(1000|5000|10000)/)) score += 10
  }

  // Reachability (0-30 points)
  const channelCount = [contact.email, contact.linkedInUrl, contact.twitterHandle, contact.phone]
    .filter(Boolean).length
  score += channelCount * 7.5 // Max 30 points for 4 channels

  // Timing (0-30 points)
  if (contact.recentFunding) score += 15 // Just raised money = buying mode
  if (contact.companySignals?.hiring) score += 10 // Hiring = exec search opportunity
  if (contact.companySignals?.productLaunch) score += 10 // Product launch = AI ops need
  if (contact.companySignals?.acquisition) score += 10 // Acquisition = IDRE scale need

  return Math.min(score, 100)
}

/**
 * Clay API Integration Schema
 */
export interface ClayAPIConfig {
  apiKey: string
  tableId: string
  webhookUrl?: string // For real-time enrichment updates
}

export async function fetchClayContacts(
  config: ClayAPIConfig,
  filters?: {
    practiceGroup?: string
    minFitScore?: number
    limit?: number
  }
): Promise<ClayContact[]> {
  // This will be implemented once we have Clay API access
  // For now, return mock structure
  console.log('Clay API integration coming soon...')
  return []
}

/**
 * Outreach Orchestrator
 * Manages multi-channel sequences
 */
export interface OutreachTask {
  contactId: string
  channel: 'email' | 'linkedin' | 'twitter' | 'sms'
  messageType: 'intro' | 'value' | 'social-proof' | 'urgency' | 'final'
  scheduledFor: Date
  personalizedMessage?: string
  status: 'scheduled' | 'sent' | 'failed' | 'response-received'
}

export async function scheduleOutreach(
  contacts: ClayContact[],
  strategy: CampaignStrategy
): Promise<OutreachTask[]> {
  const tasks: OutreachTask[] = []

  for (const contact of contacts) {
    const routing = routeContact(contact)

    if (!routing.primary) continue

    // Schedule touches based on strategy
    for (const touch of strategy.touches) {
      tasks.push({
        contactId: contact.id,
        channel: touch.channel,
        messageType: touch.messageType,
        scheduledFor: new Date(Date.now() + touch.day * 24 * 60 * 60 * 1000),
        status: 'scheduled'
      })
    }
  }

  return tasks
}
