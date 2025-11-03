/**
 * Wells Outreach System
 *
 * Custom multi-channel outreach platform that Wells fully controls.
 * NO dependence on LinkedIn API or third-party automation tools.
 *
 * Channels We Control:
 * - Email (SendGrid/Resend)
 * - SMS (Twilio)
 * - Optional: LinkedIn profile enrichment (data only, not outreach)
 *
 * Follows 20-year sourcing methodology:
 * - Step 0: Deep qualification
 * - Step 1: 80-90% zone targeting
 * - Step 2: Multi-touch messaging formula
 * - Step 3: Self-screening via responses
 */

import type { RoleQualification } from './sourcing-qualification'
import type { TargetCandidate } from './sourcing-engine'

/**
 * Outreach Channel
 *
 * Ordered by deliverability (best to worst):
 * - whatsapp: 98% open rate
 * - sms: 98% open rate
 * - twitter: 70-80% read rate
 * - email: 15-25% open rate
 * - linkedin-manual: Manual (reference only)
 */
export type OutreachChannel = 'whatsapp' | 'sms' | 'twitter' | 'email' | 'linkedin-manual'

/**
 * Multi-Touch Sequence Configuration
 *
 * NEW: Multi-channel approach (WhatsApp-first):
 * - Touch 1: WhatsApp (Day 0) - 98% open rate
 * - Touch 1b: Twitter DM (Day 0) - if profile found
 * - Touch 2: Email (Day 2) - if no response
 * - Touch 3: SMS (Day 4) - if phone available
 * - Touch 4: Email follow-up (Day 6)
 * - Touch 5: Final touch via best channel (Day 8)
 * - Optional: LinkedIn (manual reference only)
 */
export interface OutreachSequence {
  id: string
  name: string

  // Touches (ordered by day)
  touches: OutreachTouch[]

  // Timing
  totalDays: number

  // Status
  status: 'active' | 'paused' | 'archived'
  createdAt: Date
}

export interface OutreachTouch {
  touchNumber: number
  dayDelay: number // Days after campaign start
  channel: OutreachChannel

  // Message template (variables: {{firstName}}, {{company}}, etc.)
  subject?: string // For email
  message: string

  // Sending settings
  sendBetweenHours: [number, number] // e.g., [9, 17] for 9am-5pm
  randomizeDelay: boolean // Add 0-2 hour random delay
  skipWeekends: boolean
}

/**
 * Outreach Campaign
 */
export interface OutreachCampaign {
  id: string
  userId: string // Clerk user ID

  // Campaign config
  name: string
  qualification: RoleQualification
  sequence: OutreachSequence
  status: 'draft' | 'active' | 'paused' | 'completed'

  // Prospects
  prospects: OutreachProspect[]

  // Sending limits (to avoid spam filters and rate limits)
  dailyWhatsAppLimit: number // Max WhatsApp per day (recommended: 100-200)
  dailyTwitterLimit: number // Max Twitter DMs per day (recommended: 50-100, API limit: 500)
  dailySMSLimit: number // Max SMS per day (recommended: 50-100)
  dailyEmailLimit: number // Max emails per day (recommended: 50-100)

  // Tracking
  stats: CampaignStats
  createdAt: Date
  lastRunAt?: Date
}

/**
 * Outreach Prospect
 *
 * A prospect enrolled in an outreach campaign
 */
export interface OutreachProspect {
  id: string
  campaignId: string
  candidate: TargetCandidate

  // Contact info (ordered by deliverability priority)
  whatsappNumber?: string // E.164 format (e.g., +1234567890)
  twitterHandle?: string // @username or profile URL
  phone?: string // For SMS
  email: string // Fallback
  linkedinUrl?: string // Reference only, not for automation

  // Enrollment
  enrolledAt: Date
  currentTouch: number // Which touch they're on (0 = not started)
  nextTouchAt?: Date // When to send next touch

  // Status
  status: 'active' | 'responded' | 'bounced' | 'opted-out' | 'completed'

  // Response tracking (Step 3: Self-screening)
  respondedAt?: Date
  responseChannel?: OutreachChannel
  responseMessage?: string
  qualified?: boolean // Did they pass self-screening?
  interestLevel?: 'high' | 'medium' | 'low' | 'crazy'

  // Delivery tracking
  touches: OutreachTouchDelivery[]
}

export interface OutreachTouchDelivery {
  touchNumber: number
  channel: OutreachChannel

  // Sending
  sentAt?: Date
  scheduledFor?: Date

  // Delivery (for email)
  deliveredAt?: Date
  bouncedAt?: Date
  bounceReason?: string

  // Engagement
  openedAt?: Date
  clickedAt?: Date
  repliedAt?: Date

  // Status
  status: 'scheduled' | 'sent' | 'delivered' | 'bounced' | 'replied' | 'failed'
  error?: string
}

export interface CampaignStats {
  // Prospects
  totalProspects: number
  activeProspects: number
  respondedProspects: number
  bouncedProspects: number
  optedOutProspects: number
  completedProspects: number

  // Delivery (by channel)
  whatsappSent: number
  whatsappDelivered: number
  whatsappRead: number
  twitterSent: number
  twitterDelivered: number
  twitterRead: number
  smsSent: number
  smsDelivered: number
  emailsSent: number
  emailsDelivered: number
  emailsBounced: number
  emailsOpened: number
  emailsClicked: number

  // Responses (Step 3: Self-screening)
  responsesReceived: number
  qualifiedResponses: number // Passed self-screening
  unqualifiedResponses: number // Failed self-screening

  // Conversions
  meetingsBooked: number
  dealsCreated: number

  // Quality metrics (from methodology)
  responseRate: number // Target: 20-40%
  qualificationRate: number // Target: 50%+
  conversionRate: number // Target: 10-15%
  bounceRate: number // Target: < 5%
}

/**
 * Default Multi-Channel Sequence (WhatsApp-First)
 *
 * Based on 20-year methodology + 2025 deliverability reality
 * Priority: WhatsApp (98% open) → Twitter (70% read) → SMS (98%) → Email (15%)
 */
export function createDefaultMultiChannelSequence(): OutreachSequence {
  return {
    id: `seq-${Date.now()}`,
    name: 'Multi-Channel Sequence (WhatsApp-First)',
    totalDays: 8,
    status: 'active',
    touches: [
      {
        touchNumber: 1,
        dayDelay: 0, // Day 0 (immediate)
        channel: 'whatsapp',
        subject: undefined,
        message: `Hi {{firstName}}, {{senderName}} here from Wells Onyx.

{{valueProposition}}

I found your profile - you have expertise in {{expertise}} that could contribute to {{contribution}}.

I assume you're happy where you are but if you're keeping your eyes open to an opportunity, let me know.

Best,
{{senderName}}`,
        sendBetweenHours: [9, 17],
        randomizeDelay: true,
        skipWeekends: true
      },
      {
        touchNumber: 2,
        dayDelay: 0, // Day 0 (same day as WhatsApp, if Twitter found)
        channel: 'twitter',
        subject: undefined,
        message: `Hi {{firstName}}, saw your profile - {{valueProposition}}. {{expertise}} background is impressive. Worth connecting?`,
        sendBetweenHours: [9, 17],
        randomizeDelay: true,
        skipWeekends: true
      },
      {
        touchNumber: 3,
        dayDelay: 2, // Day 2 (if no WhatsApp/Twitter response)
        channel: 'email',
        subject: 'Quick question - {{company}}',
        message: `Hi {{firstName}},

{{valueProposition}}

I found your profile both as someone knowledgeable in {{expertise}} but also who could potentially contribute to {{contribution}}.

I assume you're happy where you are but if you're keeping your eyes and ears open to an opportunity, please circle back.

Best,
{{senderName}}`,
        sendBetweenHours: [9, 17],
        randomizeDelay: true,
        skipWeekends: true
      },
      {
        touchNumber: 4,
        dayDelay: 4, // Day 4 (SMS if available)
        channel: 'sms',
        subject: undefined,
        message: `Hi {{firstName}}, {{senderName}} from Wells Onyx. Reached out via WhatsApp/email about {{valueProposition}}. Worth a quick call? {{calendlyLink}}`,
        sendBetweenHours: [10, 16], // Narrower window for SMS
        randomizeDelay: true,
        skipWeekends: true
      },
      {
        touchNumber: 5,
        dayDelay: 6, // Day 6 (email follow-up)
        channel: 'email',
        subject: 'Re: Quick question - {{company}}',
        message: `{{firstName}} - following up on my note.

We just {{socialProof}}.

Our approach:
→ {{benefit1}}
→ {{benefit2}}
→ {{benefit3}}

Worth a 15-min call this week?

Calendly: {{calendlyLink}}

Best,
{{senderName}}`,
        sendBetweenHours: [9, 17],
        randomizeDelay: true,
        skipWeekends: true
      },
      {
        touchNumber: 6,
        dayDelay: 8, // Day 8 (final touch)
        channel: 'whatsapp', // Back to WhatsApp (best deliverability)
        subject: undefined,
        message: `{{firstName}} - last note!

I know you're busy. If {{company}} isn't looking for this right now, totally understand.

But if you ever need {{outcome}}, we're here:
• {{benefit1}}
• {{benefit2}}
• {{benefit3}}

Feel free to reach out anytime.

Best,
{{senderName}}`,
        sendBetweenHours: [9, 17],
        randomizeDelay: true,
        skipWeekends: true
      }
    ],
    createdAt: new Date()
  }
}

/**
 * Email-Only Sequence (Fallback - Lower Deliverability)
 *
 * Use only if WhatsApp/Twitter/SMS not available
 */
export function createEmailOnlySequence(): OutreachSequence {
  return {
    id: `seq-${Date.now()}`,
    name: 'Email-Only Sequence (Fallback)',
    totalDays: 7,
    status: 'active',
    touches: [
      {
        touchNumber: 1,
        dayDelay: 0, // Day 0
        channel: 'email',
        subject: 'Quick question - {{company}}',
        message: `Hi {{firstName}},

{{valueProposition}}

I found your profile both as someone knowledgeable in {{expertise}} but also who could potentially contribute to {{contribution}}.

I assume you're happy where you are but if you're keeping your eyes and ears open to an opportunity, please circle back.

Best,
{{senderName}}`,
        sendBetweenHours: [9, 17],
        randomizeDelay: true,
        skipWeekends: true
      },
      {
        touchNumber: 2,
        dayDelay: 3, // Day 3
        channel: 'email',
        subject: 'Re: Quick question - {{company}}',
        message: `{{firstName}} - following up.

We just {{socialProof}}.

Worth a quick call? {{calendlyLink}}

Best,
{{senderName}}`,
        sendBetweenHours: [9, 17],
        randomizeDelay: true,
        skipWeekends: true
      },
      {
        touchNumber: 3,
        dayDelay: 7, // Day 7 (final touch)
        channel: 'email',
        subject: 'Re: Quick question - {{company}}',
        message: `{{firstName}} - last note!

I know you're busy. If you ever need {{outcome}}, we're here:
• {{benefit1}}
• {{benefit2}}
• {{benefit3}}

Feel free to reach out anytime.

Best,
{{senderName}}`,
        sendBetweenHours: [9, 17],
        randomizeDelay: true,
        skipWeekends: true
      }
    ],
    createdAt: new Date()
  }
}

/**
 * Create outreach campaign from qualification
 */
export async function createOutreachCampaign(
  userId: string,
  name: string,
  qualification: RoleQualification,
  sequenceType: 'multi-channel' | 'email-only' = 'multi-channel'
): Promise<OutreachCampaign> {
  const sequence = sequenceType === 'multi-channel'
    ? createDefaultMultiChannelSequence()
    : createEmailOnlySequence()

  const campaign: OutreachCampaign = {
    id: `campaign-${Date.now()}`,
    userId,
    name,
    qualification,
    sequence,
    status: 'draft',
    prospects: [],

    // SAFE limits (avoid spam filters and rate limits)
    dailyWhatsAppLimit: 200, // WhatsApp: High limit (low spam risk)
    dailyTwitterLimit: 100, // Twitter: Conservative (API limit: 500/day)
    dailySMSLimit: 100, // SMS: Medium limit
    dailyEmailLimit: 100, // Email: Conservative (spam filter risk)

    stats: {
      totalProspects: 0,
      activeProspects: 0,
      respondedProspects: 0,
      bouncedProspects: 0,
      optedOutProspects: 0,
      completedProspects: 0,
      whatsappSent: 0,
      whatsappDelivered: 0,
      whatsappRead: 0,
      twitterSent: 0,
      twitterDelivered: 0,
      twitterRead: 0,
      smsSent: 0,
      smsDelivered: 0,
      emailsSent: 0,
      emailsDelivered: 0,
      emailsBounced: 0,
      emailsOpened: 0,
      emailsClicked: 0,
      responsesReceived: 0,
      qualifiedResponses: 0,
      unqualifiedResponses: 0,
      meetingsBooked: 0,
      dealsCreated: 0,
      responseRate: 0,
      qualificationRate: 0,
      conversionRate: 0,
      bounceRate: 0
    },
    createdAt: new Date()
  }

  return campaign
}

/**
 * Enroll prospect in campaign
 */
export async function enrollProspect(
  campaign: OutreachCampaign,
  candidate: TargetCandidate,
  email: string,
  options?: {
    whatsappNumber?: string
    twitterHandle?: string
    phone?: string
    linkedinUrl?: string
  }
): Promise<OutreachProspect> {
  const prospect: OutreachProspect = {
    id: `prospect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    campaignId: campaign.id,
    candidate,
    email,
    whatsappNumber: options?.whatsappNumber,
    twitterHandle: options?.twitterHandle,
    phone: options?.phone,
    linkedinUrl: options?.linkedinUrl, // Reference only (data enrichment)
    enrolledAt: new Date(),
    currentTouch: 0,
    nextTouchAt: new Date(), // Start immediately
    status: 'active',
    touches: []
  }

  return prospect
}

/**
 * Calculate when to send next touch
 */
export function calculateNextTouchDate(
  enrolledAt: Date,
  touch: OutreachTouch
): Date {
  const nextDate = new Date(enrolledAt)
  nextDate.setDate(nextDate.getDate() + touch.dayDelay)

  // Set to work hours
  const [startHour, endHour] = touch.sendBetweenHours
  nextDate.setHours(startHour + Math.floor(Math.random() * (endHour - startHour)))
  nextDate.setMinutes(Math.floor(Math.random() * 60))

  // Add random delay if enabled (0-2 hours)
  if (touch.randomizeDelay) {
    const randomMinutes = Math.floor(Math.random() * 120)
    nextDate.setMinutes(nextDate.getMinutes() + randomMinutes)
  }

  // Skip weekends if enabled
  if (touch.skipWeekends) {
    const dayOfWeek = nextDate.getDay()
    if (dayOfWeek === 0) { // Sunday → Monday
      nextDate.setDate(nextDate.getDate() + 1)
    } else if (dayOfWeek === 6) { // Saturday → Monday
      nextDate.setDate(nextDate.getDate() + 2)
    }
  }

  return nextDate
}

/**
 * Render message template with variables
 */
export function renderMessageTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let rendered = template

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g')
    rendered = rendered.replace(regex, value)
  }

  return rendered
}

/**
 * Calculate campaign quality metrics
 *
 * From PROPRIETARY_METHOD.md response targets
 */
export function calculateCampaignMetrics(campaign: OutreachCampaign): {
  responseRate: number
  qualificationRate: number
  conversionRate: number
  bounceRate: number
  diagnosis: string | null
} {
  const stats = campaign.stats

  // Response rate = responses / emails sent
  const responseRate = stats.emailsSent > 0
    ? stats.responsesReceived / stats.emailsSent
    : 0

  // Qualification rate = qualified responses / total responses
  const qualificationRate = stats.responsesReceived > 0
    ? stats.qualifiedResponses / stats.responsesReceived
    : 0

  // Conversion rate = meetings booked / emails sent
  const conversionRate = stats.emailsSent > 0
    ? stats.meetingsBooked / stats.emailsSent
    : 0

  // Bounce rate = bounced / sent
  const bounceRate = stats.emailsSent > 0
    ? stats.emailsBounced / stats.emailsSent
    : 0

  // Diagnose issues (from methodology)
  let diagnosis: string | null = null

  if (bounceRate > 0.05) {
    diagnosis = 'High bounce rate (>5%) - Check: Email quality. Consider email verification service.'
  } else if (responseRate < 0.1) {
    diagnosis = 'Low response rate (<10%) - Check: Are you in 80-90% zone or chasing 100%? Is messaging formula followed correctly?'
  } else if (responseRate > 0.2 && qualificationRate < 0.3) {
    diagnosis = 'High response but low qualification (<30%) - Check: Is message assumptive enough? Are you being too generic?'
  } else if (qualificationRate > 0.5 && conversionRate < 0.05) {
    diagnosis = 'High qualification but low conversion (<5%) - Check: Compensation competitive? Are you overselling?'
  }

  return {
    responseRate,
    qualificationRate,
    conversionRate,
    bounceRate,
    diagnosis
  }
}

export default {
  createOutreachCampaign,
  enrollProspect,
  calculateNextTouchDate,
  renderMessageTemplate,
  calculateCampaignMetrics,
  createDefaultMultiChannelSequence,
  createEmailOnlySequence
}
