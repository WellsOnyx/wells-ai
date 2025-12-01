/**
 * Email Provider Router
 * Intelligent routing between Gmail, Instantly, Resend, and SMTP
 */

import { getUserEmailConfig, type EmailProvider } from '../email-config'
import { sendGmailEmail, checkGmailRateLimit, type GmailSendOptions } from './gmail'
import { addProspectsToCampaign, type InstantlyProspect } from './instantly'
import { sendEmailWithUserConfig } from '../email-config'

export interface EmailRoutingDecision {
  provider: EmailProvider | 'INSTANTLY'
  reason: string
  confidence: number // 0-100
}

export interface EmailContext {
  userId: string
  importance: 'low' | 'medium' | 'high' | 'critical'
  volume?: number // Expected volume
  isSequence?: boolean // Part of automated sequence?
  hasAttachments?: boolean
  requiresPersonalization?: boolean
}

/**
 * Decide which email provider to use
 * Wells AI's intelligent routing logic
 */
export async function routeEmail(
  context: EmailContext
): Promise<EmailRoutingDecision> {
  const { userId, importance, volume = 1, isSequence, hasAttachments, requiresPersonalization } = context

  // Get user's configured providers
  const userConfig = await getUserEmailConfig(userId)
  const hasGmail = userConfig?.provider === 'GMAIL_OAUTH'
  const hasResend = userConfig?.provider === 'RESEND'
  const hasSMTP = userConfig?.provider === 'SMTP'

  // Check Gmail rate limit if available
  let gmailAllowed = false
  let gmailRemaining = 0

  if (hasGmail) {
    const rateLimit = await checkGmailRateLimit(userId)
    gmailAllowed = rateLimit.allowed
    gmailRemaining = rateLimit.remaining
  }

  // Decision tree

  // 1. Bulk sequences -> Instantly
  if (isSequence && volume > 10) {
    return {
      provider: 'INSTANTLY',
      reason: 'Best for automated sequences with follow-ups',
      confidence: 95
    }
  }

  // 2. Critical 1:1 emails -> Gmail (best deliverability)
  if (importance === 'critical' && volume === 1 && hasGmail && gmailAllowed) {
    return {
      provider: 'GMAIL_OAUTH',
      reason: 'Maximum deliverability for high-importance email',
      confidence: 100
    }
  }

  // 3. High-value with personalization -> Gmail
  if (importance === 'high' && requiresPersonalization && hasGmail && gmailAllowed) {
    return {
      provider: 'GMAIL_OAUTH',
      reason: 'Personal touch with Gmail increases response rates',
      confidence: 90
    }
  }

  // 4. Attachments -> Gmail or SMTP (better handling)
  if (hasAttachments) {
    if (hasGmail && gmailAllowed) {
      return {
        provider: 'GMAIL_OAUTH',
        reason: 'Gmail handles attachments reliably',
        confidence: 85
      }
    }
    if (hasSMTP) {
      return {
        provider: 'SMTP',
        reason: 'SMTP supports attachments',
        confidence: 80
      }
    }
  }

  // 5. Medium volume (10-50) -> Instantly if configured
  if (volume >= 10 && volume <= 50) {
    return {
      provider: 'INSTANTLY',
      reason: 'Efficiently handles medium-volume campaigns',
      confidence: 85
    }
  }

  // 6. Gmail available and under rate limit -> Use Gmail
  if (hasGmail && gmailAllowed && gmailRemaining > volume) {
    return {
      provider: 'GMAIL_OAUTH',
      reason: `Gmail available (${gmailRemaining} emails remaining today)`,
      confidence: 80
    }
  }

  // 7. Resend for transactional/reliable delivery
  if (hasResend) {
    return {
      provider: 'RESEND',
      reason: 'Reliable delivery for standard emails',
      confidence: 75
    }
  }

  // 8. SMTP as fallback
  if (hasSMTP) {
    return {
      provider: 'SMTP',
      reason: 'Using configured SMTP server',
      confidence: 70
    }
  }

  // 9. Default fallback
  return {
    provider: 'RESEND',
    reason: 'Using default email provider',
    confidence: 60
  }
}

/**
 * Send email with automatic provider routing
 */
export async function sendEmailSmart(
  context: EmailContext,
  emailData: {
    to: string | string[]
    subject: string
    text: string
    html?: string
    cc?: string | string[]
    bcc?: string | string[]
    replyTo?: string
  }
): Promise<{
  success: boolean
  provider: string
  messageId?: string
  error?: string
  routing: EmailRoutingDecision
}> {
  try {
    // Get routing decision
    const routing = await routeEmail(context)

    console.log(`[EMAIL-ROUTER] Routing email via ${routing.provider} - ${routing.reason}`)

    // Send via selected provider
    let result: { success: boolean; messageId?: string; error?: string }

    switch (routing.provider) {
      case 'GMAIL_OAUTH':
        result = await sendGmailEmail(context.userId, {
          to: emailData.to,
          subject: emailData.subject,
          text: emailData.text,
          html: emailData.html,
          cc: emailData.cc,
          bcc: emailData.bcc,
          replyTo: emailData.replyTo
        })
        break

      case 'INSTANTLY':
        // For Instantly, we need campaign context
        // This would typically be handled differently in production
        return {
          success: false,
          provider: routing.provider,
          error: 'Instantly requires campaign setup. Use createCampaign instead.',
          routing
        }

      case 'RESEND':
      case 'SMTP':
        const config = await getUserEmailConfig(context.userId)
        if (!config) {
          throw new Error('Email configuration not found')
        }

        result = await sendEmailWithUserConfig(config, {
          to: Array.isArray(emailData.to) ? emailData.to[0] : emailData.to,
          subject: emailData.subject,
          text: emailData.text,
          html: emailData.html
        })
        break

      default:
        throw new Error(`Unsupported provider: ${routing.provider}`)
    }

    return {
      ...result,
      provider: routing.provider,
      routing
    }
  } catch (error) {
    console.error('[EMAIL-ROUTER] Failed to send email:', error)
    return {
      success: false,
      provider: 'unknown',
      error: error instanceof Error ? error.message : 'Failed to send email',
      routing: {
        provider: 'RESEND',
        reason: 'Error occurred',
        confidence: 0
      }
    }
  }
}

/**
 * Wells AI conversational routing suggestions
 */
export async function getRoutingSuggestion(
  context: EmailContext
): Promise<string> {
  const routing = await routeEmail(context)

  const suggestions: Record<string, string> = {
    GMAIL_OAUTH: `I'll send this via your Gmail for maximum deliverability. This will appear as a personal email from you, which typically gets the best response rates.`,
    INSTANTLY: `For this campaign, I recommend using Instantly. It'll handle the sequence automatically and track responses for you.`,
    RESEND: `I'll use Resend for this - it's reliable and perfect for transactional emails.`,
    SMTP: `Sending via your SMTP server as configured.`
  }

  const suggestion = suggestions[routing.provider] || `Using ${routing.provider}`

  // Add context-specific tips
  if (routing.confidence < 80) {
    return `${suggestion}\n\n💡 Tip: For better deliverability, consider connecting your Gmail account.`
  }

  if (context.importance === 'critical' && routing.provider !== 'GMAIL_OAUTH') {
    return `${suggestion}\n\n💡 Note: For critical emails, Gmail typically provides the best deliverability.`
  }

  return suggestion
}

/**
 * Batch email routing
 * Splits emails across providers based on limits
 */
export async function routeBatchEmails(
  context: EmailContext,
  emails: Array<{
    to: string
    subject: string
    text: string
    html?: string
  }>
): Promise<{
  gmail: number
  instantly: number
  resend: number
  smtp: number
  plan: string
}> {
  const total = emails.length
  const { userId } = context

  // Get Gmail rate limit
  const gmailLimit = await checkGmailRateLimit(userId)
  const gmailAvailable = gmailLimit.remaining

  // Default allocation
  let gmailCount = 0
  let instantlyCount = 0
  let resendCount = 0
  let smtpCount = 0
  let plan = ''

  if (total <= gmailAvailable && context.importance === 'high') {
    // Send all via Gmail if possible and important
    gmailCount = total
    plan = 'All emails via Gmail for maximum impact'
  } else if (total > 50) {
    // Large batch -> mostly Instantly
    gmailCount = Math.min(10, gmailAvailable) // Send first 10 via Gmail
    instantlyCount = total - gmailCount
    plan = `First ${gmailCount} via Gmail (high-value), remaining ${instantlyCount} via Instantly (automated)`
  } else {
    // Medium batch -> split intelligently
    gmailCount = Math.min(total, gmailAvailable)
    resendCount = total - gmailCount
    plan = `${gmailCount} via Gmail, ${resendCount} via Resend`
  }

  return {
    gmail: gmailCount,
    instantly: instantlyCount,
    resend: resendCount,
    smtp: smtpCount,
    plan
  }
}
