/**
 * Wells AI - Email Service
 * Consent-gated email sending with Instantly.ai integration
 */

import { queueAction } from './consent'
import { writeAuditAction } from './audit-ledger'
import { sendEmailViaInstantly, listCampaigns } from './instantly'

// Configure defaults
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@wellsonyx.com'
const FROM_NAME = process.env.FROM_NAME || 'Wells Onyx'
const DEFAULT_CAMPAIGN_ID = process.env.INSTANTLY_DEFAULT_CAMPAIGN_ID || ''

// ===== TYPES =====

export interface EmailParams {
  to: string
  toName?: string
  subject: string
  html: string
  text?: string
  attachments?: EmailAttachment[]
  metadata?: Record<string, any>
}

export interface EmailAttachment {
  filename: string
  content: string // Base64 encoded
  type?: string
  disposition?: 'attachment' | 'inline'
}

export interface QueuedEmail {
  actionId: string
  to: string
  subject: string
  preview: string
  status: 'pending' | 'approved' | 'rejected' | 'sent' | 'failed'
  createdAt: string
}

// ===== EMAIL QUEUE =====

const emailQueue = new Map<string, QueuedEmail>()

/**
 * Queue email for consent approval
 * Returns actionId to track status
 */
export async function queueEmail(params: EmailParams): Promise<string> {
  // Create email preview (first 200 chars of text or HTML stripped)
  const preview = params.text
    ? params.text.substring(0, 200)
    : params.html.replace(/<[^>]*>/g, '').substring(0, 200)

  // Queue for consent
  const consentAction = await queueAction({
    actionType: 'email',
    title: `Send email to ${params.toName || params.to}`,
    description: `Subject: ${params.subject}`,
    recipient: params.to,
    messagePreview: preview,
    metadata: {
      to: params.to,
      toName: params.toName,
      subject: params.subject,
      hasAttachments: (params.attachments?.length || 0) > 0,
      attachmentCount: params.attachments?.length || 0,
      ...params.metadata
    }
  })

  // Store in email queue
  emailQueue.set(consentAction.actionId, {
    actionId: consentAction.actionId,
    to: params.to,
    subject: params.subject,
    preview,
    status: 'pending',
    createdAt: new Date().toISOString()
  })

  return consentAction.actionId
}

/**
 * Send email after approval
 * Called by consent system after user approves
 */
export async function sendEmail(actionId: string, params: EmailParams, campaignId?: string): Promise<void> {
  const queuedEmail = emailQueue.get(actionId)
  if (!queuedEmail) {
    throw new Error(`Email ${actionId} not found in queue`)
  }

  // Use provided campaign ID or default
  const useCampaignId = campaignId || DEFAULT_CAMPAIGN_ID

  if (!useCampaignId) {
    console.warn('⚠️  No Instantly campaign ID - email not sent (configure INSTANTLY_DEFAULT_CAMPAIGN_ID)')

    // Update queue status
    emailQueue.set(actionId, {
      ...queuedEmail,
      status: 'sent'
    })

    // Log to audit
    await writeAuditAction({
      actionId,
      actionType: 'email',
      title: `Email queued (no campaign): ${params.subject}`,
      description: `To: ${params.to}`,
      recipient: params.to,
      decision: 'approve',
      decidedBy: 'system',
      metadata: {
        mode: 'dry_run',
        reason: 'No Instantly campaign ID configured'
      }
    })

    return
  }

  try {
    // Send via Instantly.ai
    await sendEmailViaInstantly({
      actionId,
      to: params.to,
      toName: params.toName,
      subject: params.subject,
      campaignId: useCampaignId,
      metadata: {
        html: params.html.substring(0, 500), // Store preview
        text: params.text?.substring(0, 500),
        hasAttachments: (params.attachments?.length || 0) > 0,
        attachmentCount: params.attachments?.length || 0,
        ...params.metadata
      }
    })

    // Update queue status
    emailQueue.set(actionId, {
      ...queuedEmail,
      status: 'sent'
    })

    console.log(`✅ Email queued via Instantly: ${params.to} - ${params.subject}`)
  } catch (error: any) {
    // Update queue status
    emailQueue.set(actionId, {
      ...queuedEmail,
      status: 'failed'
    })

    console.error(`❌ Email failed: ${params.to} - ${error.message}`)
    throw error
  }
}

/**
 * Get email status
 */
export function getEmailStatus(actionId: string): QueuedEmail | undefined {
  return emailQueue.get(actionId)
}

/**
 * Get all queued emails
 */
export function getAllQueuedEmails(): QueuedEmail[] {
  return Array.from(emailQueue.values())
}

/**
 * Helper: Create email HTML from template
 */
export function createEmailHTML(options: {
  title: string
  content: string
  footer?: string
}): string {
  const { title, content, footer } = options

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      color: #000;
      font-size: 24px;
      margin-bottom: 20px;
    }
    p {
      margin-bottom: 15px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #999;
    }
    .cta {
      display: inline-block;
      padding: 12px 24px;
      background-color: #000;
      color: #fff;
      text-decoration: none;
      border-radius: 4px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="content">
    ${content}
  </div>
  ${footer ? `<div class="footer">${footer}</div>` : ''}
</body>
</html>
  `.trim()
}

// ===== EXPORTS =====

export default {
  queueEmail,
  sendEmail,
  getEmailStatus,
  getAllQueuedEmails,
  createEmailHTML
}
