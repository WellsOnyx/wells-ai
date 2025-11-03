/**
 * Outreach Campaign Orchestrator
 *
 * Handles scheduling and sending of outreach touches via:
 * - Email (SendGrid/Resend)
 * - SMS (Twilio)
 *
 * Runs on cron job (every 15 minutes) to check for scheduled touches.
 */

import type {
  OutreachCampaign,
  OutreachProspect,
  OutreachTouch,
  OutreachTouchDelivery
} from './wells-outreach-system'
import {
  calculateNextTouchDate,
  renderMessageTemplate
} from './wells-outreach-system'
import type { RoleQualification } from './sourcing-qualification'

/**
 * Process all active campaigns
 *
 * Called by cron job every 15 minutes
 */
export async function processActiveCampaigns(): Promise<{
  campaignsProcessed: number
  touchesSent: number
  errors: string[]
}> {
  const errors: string[] = []
  let campaignsProcessed = 0
  let touchesSent = 0

  try {
    // TODO: Fetch active campaigns from database
    const activeCampaigns: OutreachCampaign[] = []

    for (const campaign of activeCampaigns) {
      try {
        const sent = await processCampaign(campaign)
        touchesSent += sent
        campaignsProcessed++
      } catch (error: any) {
        errors.push(`Campaign ${campaign.id}: ${error.message}`)
      }
    }
  } catch (error: any) {
    errors.push(`Failed to fetch campaigns: ${error.message}`)
  }

  return {
    campaignsProcessed,
    touchesSent,
    errors
  }
}

/**
 * Process single campaign
 *
 * Find prospects ready for next touch and send
 */
export async function processCampaign(
  campaign: OutreachCampaign
): Promise<number> {
  if (campaign.status !== 'active') {
    return 0
  }

  const now = new Date()
  let touchesSent = 0

  // Daily limits
  let whatsappSentToday = 0
  let twitterSentToday = 0
  let smsSentToday = 0
  let emailsSentToday = 0

  // Find prospects ready for next touch
  for (const prospect of campaign.prospects) {
    // Skip if not active
    if (prospect.status !== 'active') {
      continue
    }

    // Check if next touch is due
    if (!prospect.nextTouchAt || prospect.nextTouchAt > now) {
      continue
    }

    // Get next touch from sequence
    const nextTouch = campaign.sequence.touches.find(
      (t) => t.touchNumber === prospect.currentTouch + 1
    )

    if (!nextTouch) {
      // No more touches - mark as completed
      prospect.status = 'completed'
      // TODO: Update in database
      continue
    }

    // Check daily limits
    if (nextTouch.channel === 'whatsapp' && whatsappSentToday >= campaign.dailyWhatsAppLimit) {
      console.log(`[ORCHESTRATOR] Daily WhatsApp limit reached for campaign ${campaign.id}`)
      break
    }

    if (nextTouch.channel === 'twitter' && twitterSentToday >= campaign.dailyTwitterLimit) {
      console.log(`[ORCHESTRATOR] Daily Twitter limit reached for campaign ${campaign.id}`)
      continue // Skip this prospect but continue processing others
    }

    if (nextTouch.channel === 'sms' && smsSentToday >= campaign.dailySMSLimit) {
      console.log(`[ORCHESTRATOR] Daily SMS limit reached for campaign ${campaign.id}`)
      continue // Skip this prospect but continue processing others
    }

    if (nextTouch.channel === 'email' && emailsSentToday >= campaign.dailyEmailLimit) {
      console.log(`[ORCHESTRATOR] Daily email limit reached for campaign ${campaign.id}`)
      break
    }

    // Send touch
    try {
      const sent = await sendTouch(campaign, prospect, nextTouch)

      if (sent) {
        touchesSent++

        // Update counters
        if (nextTouch.channel === 'whatsapp') {
          whatsappSentToday++
        } else if (nextTouch.channel === 'twitter') {
          twitterSentToday++
        } else if (nextTouch.channel === 'sms') {
          smsSentToday++
        } else if (nextTouch.channel === 'email') {
          emailsSentToday++
        }

        // Update prospect
        prospect.currentTouch = nextTouch.touchNumber

        // Calculate next touch date
        const nextNextTouch = campaign.sequence.touches.find(
          (t) => t.touchNumber === prospect.currentTouch + 1
        )

        if (nextNextTouch) {
          prospect.nextTouchAt = calculateNextTouchDate(
            prospect.enrolledAt,
            nextNextTouch
          )
        } else {
          // No more touches
          prospect.nextTouchAt = undefined
        }

        // TODO: Update in database
      }
    } catch (error: any) {
      console.error(`[ORCHESTRATOR] Failed to send touch:`, error)

      // Record failed touch
      const delivery: OutreachTouchDelivery = {
        touchNumber: nextTouch.touchNumber,
        channel: nextTouch.channel,
        sentAt: now,
        status: 'failed',
        error: error.message
      }

      prospect.touches.push(delivery)

      // TODO: Update in database
    }
  }

  return touchesSent
}

/**
 * Send single touch to prospect
 */
export async function sendTouch(
  campaign: OutreachCampaign,
  prospect: OutreachProspect,
  touch: OutreachTouch
): Promise<boolean> {
  const now = new Date()

  // Prepare message variables
  const variables = {
    firstName: prospect.candidate.firstName,
    lastName: prospect.candidate.lastName || '',
    company: prospect.candidate.currentCompany || '',
    expertise: prospect.candidate.expertise || '',
    contribution: prospect.candidate.potentialContribution || '',
    valueProposition: campaign.qualification.whatTheySell || '',
    senderName: 'Wells', // TODO: Get from user settings
    calendlyLink: 'https://calendly.com/wellsonyx', // TODO: Get from user settings
    socialProof: 'closed 3 deals in your industry', // TODO: Dynamic
    benefit1: campaign.qualification.judgmentCriteria?.[0] || '',
    benefit2: campaign.qualification.judgmentCriteria?.[1] || '',
    benefit3: campaign.qualification.judgmentCriteria?.[2] || '',
    outcome: campaign.qualification.whatTheySell || ''
  }

  // Render message
  const message = renderMessageTemplate(touch.message, variables)
  const subject = touch.subject
    ? renderMessageTemplate(touch.subject, variables)
    : undefined

  // Create delivery record
  const delivery: OutreachTouchDelivery = {
    touchNumber: touch.touchNumber,
    channel: touch.channel,
    scheduledFor: prospect.nextTouchAt,
    sentAt: now,
    status: 'sent'
  }

  // Send via appropriate channel
  if (touch.channel === 'whatsapp') {
    if (!prospect.whatsappNumber) {
      console.log(`[ORCHESTRATOR] Skipping WhatsApp - no number for prospect ${prospect.id}`)
      delivery.status = 'failed'
      delivery.error = 'No WhatsApp number'
      prospect.touches.push(delivery)
      return false
    }

    const sent = await sendWhatsApp(
      prospect.whatsappNumber,
      message
    )

    if (sent) {
      delivery.status = 'sent'
      prospect.touches.push(delivery)
      return true
    } else {
      delivery.status = 'failed'
      delivery.error = 'Failed to send WhatsApp'
      prospect.touches.push(delivery)
      return false
    }
  }

  if (touch.channel === 'twitter') {
    if (!prospect.twitterHandle) {
      console.log(`[ORCHESTRATOR] Skipping Twitter - no handle for prospect ${prospect.id}`)
      delivery.status = 'failed'
      delivery.error = 'No Twitter handle'
      prospect.touches.push(delivery)
      return false
    }

    const sent = await sendTwitterDM(
      prospect.twitterHandle,
      message
    )

    if (sent) {
      delivery.status = 'sent'
      prospect.touches.push(delivery)
      return true
    } else {
      delivery.status = 'failed'
      delivery.error = 'Failed to send Twitter DM'
      prospect.touches.push(delivery)
      return false
    }
  }

  if (touch.channel === 'email') {
    const sent = await sendEmail(
      prospect.email,
      subject || 'Quick question',
      message
    )

    if (sent) {
      delivery.status = 'sent'
      prospect.touches.push(delivery)
      return true
    } else {
      delivery.status = 'failed'
      delivery.error = 'Failed to send email'
      prospect.touches.push(delivery)
      return false
    }
  }

  if (touch.channel === 'sms') {
    if (!prospect.phone) {
      console.log(`[ORCHESTRATOR] Skipping SMS - no phone for prospect ${prospect.id}`)
      delivery.status = 'failed'
      delivery.error = 'No phone number'
      prospect.touches.push(delivery)
      return false
    }

    const sent = await sendSMS(prospect.phone, message)

    if (sent) {
      delivery.status = 'sent'
      prospect.touches.push(delivery)
      return true
    } else {
      delivery.status = 'failed'
      delivery.error = 'Failed to send SMS'
      prospect.touches.push(delivery)
      return false
    }
  }

  if (touch.channel === 'linkedin-manual') {
    // LinkedIn is manual - just create a reminder for user
    console.log(`[ORCHESTRATOR] LinkedIn touch - user must send manually`)
    delivery.status = 'scheduled'
    prospect.touches.push(delivery)
    return false
  }

  return false
}

/**
 * Send email via SendGrid or Resend
 */
export async function sendEmail(
  to: string,
  subject: string,
  message: string
): Promise<boolean> {
  try {
    // TODO: Integrate with Resend (preferred) or SendGrid
    // For now, log the email

    console.log(`[EMAIL] Sending to ${to}`)
    console.log(`[EMAIL] Subject: ${subject}`)
    console.log(`[EMAIL] Message:`, message)

    // TODO: Actual sending logic
    // const resend = new Resend(process.env.RESEND_API_KEY)
    // await resend.emails.send({
    //   from: 'Wells <wells@wellsonyx.com>',
    //   to,
    //   subject,
    //   html: message.replace(/\n/g, '<br>')
    // })

    return true
  } catch (error: any) {
    console.error(`[EMAIL] Failed to send:`, error)
    return false
  }
}

/**
 * Send WhatsApp via Meta Cloud API
 *
 * Uses Meta's WhatsApp Business Platform API (direct)
 * Message templates must be pre-approved by Meta
 */
export async function sendWhatsApp(
  to: string,
  message: string,
  templateParams?: Record<string, string>
): Promise<boolean> {
  try {
    const { getWhatsAppClient, sendWellsOutreach } = await import('../whatsapp-business')

    // If templateParams provided, use template message (cold outreach)
    if (templateParams) {
      await sendWellsOutreach(to, {
        firstName: templateParams.firstName || '',
        senderName: templateParams.senderName || 'Wells',
        valueProposition: templateParams.valueProposition || '',
        expertise: templateParams.expertise || '',
        contribution: templateParams.contribution || ''
      })

      console.log(`[WHATSAPP] Template message sent to ${to}`)
      return true
    }

    // Otherwise, send text message (session message, within 24hr window)
    const client = getWhatsAppClient()
    await client.sendText(to, message, true)

    console.log(`[WHATSAPP] Text message sent to ${to}`)
    return true
  } catch (error: any) {
    console.error(`[WHATSAPP] Failed to send:`, error)
    return false
  }
}

/**
 * Send Twitter DM via Twitter API v2
 *
 * Requires Twitter API Pro ($5,000/mo) or Enterprise
 * Rate limit: 500 DMs per day per account
 */
export async function sendTwitterDM(
  handle: string,
  message: string
): Promise<boolean> {
  try {
    // TODO: Integrate with Twitter API v2
    // Requires OAuth 2.0 authentication

    console.log(`[TWITTER] Sending DM to @${handle}`)
    console.log(`[TWITTER] Message:`, message)

    // TODO: Actual sending logic
    // 1. Get user ID from handle
    // 2. Check if user accepts DMs
    // 3. Send DM via API
    // const response = await twitterClient.v2.sendDm({
    //   recipient_id: userId,
    //   text: message
    // })

    return true
  } catch (error: any) {
    console.error(`[TWITTER] Failed to send:`, error)
    return false
  }
}

/**
 * Send SMS via Twilio
 */
export async function sendSMS(
  to: string,
  message: string
): Promise<boolean> {
  try {
    // Use existing Twilio integration
    const { sendSMS: twilioSendSMS } = await import('../twilio')

    const result = await twilioSendSMS({ to, body: message })
    return result.success
  } catch (error: any) {
    console.error(`[SMS] Failed to send:`, error)
    return false
  }
}

/**
 * Handle inbound email reply
 *
 * Called by email webhook (SendGrid/Resend)
 */
export async function handleEmailReply(
  from: string,
  subject: string,
  body: string
): Promise<void> {
  // TODO: Find prospect by email
  // TODO: Mark as responded
  // TODO: Classify response (Step 3: Self-screening)
  // TODO: Update campaign stats
  // TODO: Notify user

  console.log(`[EMAIL_REPLY] From: ${from}`)
  console.log(`[EMAIL_REPLY] Subject: ${subject}`)
  console.log(`[EMAIL_REPLY] Body:`, body)
}

/**
 * Handle inbound SMS reply
 *
 * Called by Twilio webhook
 */
export async function handleSMSReply(
  from: string,
  body: string
): Promise<void> {
  // TODO: Find prospect by phone
  // TODO: Mark as responded
  // TODO: Classify response (Step 3: Self-screening)
  // TODO: Update campaign stats
  // TODO: Notify user

  console.log(`[SMS_REPLY] From: ${from}`)
  console.log(`[SMS_REPLY] Body:`, body)
}

/**
 * Handle email bounce
 *
 * Called by email webhook
 */
export async function handleEmailBounce(
  to: string,
  bounceReason: string
): Promise<void> {
  // TODO: Find prospect by email
  // TODO: Mark as bounced
  // TODO: Update campaign stats

  console.log(`[EMAIL_BOUNCE] To: ${to}`)
  console.log(`[EMAIL_BOUNCE] Reason:`, bounceReason)
}

/**
 * Classify response using AI (Step 3: Self-screening)
 *
 * Determines if response is:
 * - Qualified (interested + good fit)
 * - Unqualified (interested but bad fit, or not interested)
 * - Crazy (spam, angry, etc.)
 */
export async function classifyResponse(
  responseText: string,
  qualification: RoleQualification
): Promise<{
  qualified: boolean
  interestLevel: 'high' | 'medium' | 'low' | 'crazy'
  reasoning: string
}> {
  // TODO: Use Claude to classify response
  // Based on PROPRIETARY_METHOD.md Step 3 logic

  const prompt = `You are classifying a response to a sales/recruiting outreach message.

Qualification criteria:
${JSON.stringify(qualification.judgmentCriteria, null, 2)}

Response:
"${responseText}"

Is this person:
1. Interested? (yes/no/maybe)
2. Qualified based on criteria? (yes/no/unknown)
3. Reasonable to talk to? (yes/no - filter out angry/spam)

Classify as:
- "high": Interested + qualified
- "medium": Interested but need to qualify further
- "low": Not interested or not qualified
- "crazy": Angry, spam, unreasonable

Return JSON: { "qualified": boolean, "interestLevel": "high"|"medium"|"low"|"crazy", "reasoning": "..." }`

  // TODO: Call Claude API
  console.log(`[CLASSIFY] Prompt:`, prompt)

  // Placeholder
  return {
    qualified: false,
    interestLevel: 'low',
    reasoning: 'TODO: Implement AI classification'
  }
}

export default {
  processActiveCampaigns,
  processCampaign,
  sendTouch,
  sendWhatsApp,
  sendTwitterDM,
  sendSMS,
  sendEmail,
  handleEmailReply,
  handleSMSReply,
  handleEmailBounce,
  classifyResponse
}
