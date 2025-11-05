/**
 * Resend Email Integration with Deliverability Best Practices
 *
 * Features:
 * - Automatic warmup protection (gradual volume increase)
 * - Rate limiting (prevent spam flags)
 * - SPF/DKIM/DMARC best practices
 * - Bounce tracking
 * - Deliverability scoring
 */

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// ====================
// WARMUP & THROTTLING
// ====================

interface EmailStats {
  date: string
  sentCount: number
  bounceCount: number
  spamReportCount: number
}

// In-memory stats (TODO: move to database for production)
const emailStats: EmailStats[] = []

/**
 * Get daily send limit based on account age and warmup schedule
 *
 * WARMUP SCHEDULE (Standard Best Practice):
 * - Day 1-3: 20 emails/day
 * - Day 4-7: 50 emails/day
 * - Day 8-14: 100 emails/day
 * - Day 15-21: 250 emails/day
 * - Day 22-28: 500 emails/day
 * - Day 29+: 1000 emails/day
 */
function getDailyLimit(accountAgeDays: number): number {
  if (accountAgeDays < 3) return 20
  if (accountAgeDays < 7) return 50
  if (accountAgeDays < 14) return 100
  if (accountAgeDays < 21) return 250
  if (accountAgeDays < 28) return 500
  return 1000 // Max daily send
}

/**
 * Get account age in days
 * Calculate from first email sent or manually set
 */
function getAccountAgeDays(): number {
  const ACCOUNT_START_DATE = process.env.RESEND_ACCOUNT_START_DATE
  if (!ACCOUNT_START_DATE) {
    // Default to Day 1 if not set (very conservative)
    return 1
  }

  const startDate = new Date(ACCOUNT_START_DATE)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - startDate.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

/**
 * Get today's email stats
 */
function getTodayStats(): EmailStats {
  const today = new Date().toISOString().split('T')[0]
  let stats = emailStats.find(s => s.date === today)

  if (!stats) {
    stats = {
      date: today,
      sentCount: 0,
      bounceCount: 0,
      spamReportCount: 0
    }
    emailStats.push(stats)
  }

  return stats
}

/**
 * Check if we can send email without hitting limits
 */
function canSendEmail(): { canSend: boolean; reason?: string; dailyLimit: number; sentToday: number } {
  const accountAge = getAccountAgeDays()
  const dailyLimit = getDailyLimit(accountAge)
  const todayStats = getTodayStats()

  // Check daily limit
  if (todayStats.sentCount >= dailyLimit) {
    return {
      canSend: false,
      reason: `Daily limit reached (${dailyLimit} emails/day during warmup period)`,
      dailyLimit,
      sentToday: todayStats.sentCount
    }
  }

  // Check bounce rate (>5% is problematic)
  const bounceRate = todayStats.sentCount > 0
    ? (todayStats.bounceCount / todayStats.sentCount) * 100
    : 0

  if (bounceRate > 5) {
    return {
      canSend: false,
      reason: `Bounce rate too high (${bounceRate.toFixed(1)}% - threshold is 5%)`,
      dailyLimit,
      sentToday: todayStats.sentCount
    }
  }

  // Check spam reports (>0.1% is problematic)
  const spamRate = todayStats.sentCount > 0
    ? (todayStats.spamReportCount / todayStats.sentCount) * 100
    : 0

  if (spamRate > 0.1) {
    return {
      canSend: false,
      reason: `Spam report rate too high (${spamRate.toFixed(2)}% - threshold is 0.1%)`,
      dailyLimit,
      sentToday: todayStats.sentCount
    }
  }

  return {
    canSend: true,
    dailyLimit,
    sentToday: todayStats.sentCount
  }
}

// ====================
// EMAIL SENDING
// ====================

export interface SendEmailParams {
  to: string
  toName?: string
  subject: string
  text: string
  html?: string
  from?: string
  fromName?: string
  replyTo?: string
  tags?: Record<string, string>
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
  throttled?: boolean
  dailyLimit?: number
  sentToday?: number
}

/**
 * Send email with automatic warmup protection
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  // Check if we can send
  const throttleCheck = canSendEmail()

  if (!throttleCheck.canSend) {
    console.warn('[RESEND] Email throttled:', throttleCheck.reason)
    return {
      success: false,
      error: throttleCheck.reason,
      throttled: true,
      dailyLimit: throttleCheck.dailyLimit,
      sentToday: throttleCheck.sentToday
    }
  }

  // Prepare email
  // Default to wells@wellsonyx.com (system email) if not provided
  const from = params.from || process.env.RESEND_FROM_EMAIL || 'wells@wellsonyx.com'
  const fromName = params.fromName || 'Wells'
  const fromAddress = `${fromName} <${from}>`

  // Generate HTML from text if not provided
  const html = params.html || generateHtmlFromText(params.text)

  try {
    // Send via Resend
    const result = await resend.emails.send({
      from: fromAddress,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: html,
      replyTo: params.replyTo
    })

    // Track success
    const todayStats = getTodayStats()
    todayStats.sentCount++

    console.log('[RESEND] Email sent successfully:', {
      to: params.to,
      subject: params.subject,
      messageId: result.data?.id,
      sentToday: todayStats.sentCount,
      dailyLimit: throttleCheck.dailyLimit,
      accountAge: getAccountAgeDays()
    })

    return {
      success: true,
      messageId: result.data?.id,
      dailyLimit: throttleCheck.dailyLimit,
      sentToday: todayStats.sentCount
    }

  } catch (error: any) {
    console.error('[RESEND] Failed to send email:', error)

    // Track bounces and spam reports
    if (error.message?.includes('bounce') || error.message?.includes('invalid email')) {
      const todayStats = getTodayStats()
      todayStats.bounceCount++
    }

    if (error.message?.includes('spam')) {
      const todayStats = getTodayStats()
      todayStats.spamReportCount++
    }

    return {
      success: false,
      error: error.message || 'Failed to send email',
      throttled: false
    }
  }
}

/**
 * Generate simple HTML from plain text
 * Preserves line breaks and basic formatting
 */
function generateHtmlFromText(text: string): string {
  const lines = text.split('\n').map(line => {
    // Convert markdown-style bold **text** to <strong>
    line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

    // Convert URLs to links
    line = line.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" style="color: #dba63f; text-decoration: underline;">$1</a>'
    )

    return line || '<br/>'
  })

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${lines.join('\n')}

  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
    <p>Wells Onyx</p>
    <p>Sent via <a href="https://wellsonyx.com" style="color: #dba63f; text-decoration: none;">wellsonyx.com</a></p>
  </div>
</body>
</html>
  `.trim()
}

// ====================
// UTILITIES
// ====================

/**
 * Get warmup status and recommendations
 */
export function getWarmupStatus() {
  const accountAge = getAccountAgeDays()
  const dailyLimit = getDailyLimit(accountAge)
  const todayStats = getTodayStats()
  const remaining = dailyLimit - todayStats.sentCount

  let phase = 'Initial Warmup (Days 1-3)'
  if (accountAge >= 28) phase = 'Fully Warmed'
  else if (accountAge >= 21) phase = 'Near Full (Days 22-28)'
  else if (accountAge >= 14) phase = 'Mid Warmup (Days 15-21)'
  else if (accountAge >= 7) phase = 'Early Warmup (Days 8-14)'
  else if (accountAge >= 3) phase = 'Early Warmup (Days 4-7)'

  return {
    accountAgeDays: accountAge,
    phase,
    dailyLimit,
    sentToday: todayStats.sentCount,
    remaining,
    bounceCount: todayStats.bounceCount,
    spamReportCount: todayStats.spamReportCount,
    bounceRate: todayStats.sentCount > 0 ? (todayStats.bounceCount / todayStats.sentCount) * 100 : 0,
    spamRate: todayStats.sentCount > 0 ? (todayStats.spamReportCount / todayStats.sentCount) * 100 : 0
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Check if email is likely to bounce
 * (basic validation, for production use a verification service)
 */
export function isLikelyValidEmail(email: string): boolean {
  if (!isValidEmail(email)) return false

  // Check for common typos
  const commonTypos = ['gmial.com', 'gmai.com', 'yahooo.com', 'outlok.com']
  const domain = email.split('@')[1]
  if (commonTypos.includes(domain)) return false

  // Check for disposable email domains
  const disposableDomains = ['tempmail.com', 'throwaway.email', 'guerrillamail.com']
  if (disposableDomains.includes(domain)) return false

  return true
}
