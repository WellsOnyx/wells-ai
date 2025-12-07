/**
 * Email Service using Resend
 *
 * Handles all email communications for Wells AI platform
 * Direct, helpful, no corporate fluff - just like Wells
 */

import { Resend } from 'resend'
import { Lead } from './leads-db'

// ============================================================================
// CONFIGURATION
// ============================================================================

// Lazy-initialize Resend client to avoid build-time errors when API key is not set
let resendClient: Resend | null = null

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Wells AI <hello@wellsonyx.com>'
const TEAM_EMAIL = process.env.WELLS_TEAM_EMAIL || 'team@wellsonyx.com'

// ============================================================================
// LEAD CONFIRMATION EMAIL (to user)
// ============================================================================

export interface LeadDetails {
  id: string
  userName: string
  userEmail: string
  journey: 'founder' | 'buyer' | 'seller' | 'jobs'
  requirements: string
  timeline?: string | null
  budget?: number | null
}

/**
 * Confirms to the user their request was received
 */
export async function sendLeadConfirmation(
  email: string,
  leadDetails: LeadDetails
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not configured, skipping confirmation email')
    return
  }

  try {
    const resend = getResendClient()
    if (!resend) return

    const html = generateConfirmationEmail(leadDetails)

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `We got your request - ${leadDetails.journey}`,
      html,
    })

    console.log(`Confirmation email sent to ${email}`)
  } catch (error) {
    console.error('Error sending confirmation email:', error)
    // Don't throw - email failures shouldn't break the flow
  }
}

function generateConfirmationEmail(lead: LeadDetails): string {
  const journeyMessages = {
    founder: "We'll help you find the right talent or services to grow your business.",
    buyer: "We'll connect you with the right suppliers and get you competitive quotes.",
    seller: "We'll help you find qualified buyers and maximize your opportunities.",
    jobs: "We'll match you with opportunities that fit your skills and goals.",
  }

  const journeyMessage = journeyMessages[lead.journey]
  const timelineText = lead.timeline ? `\n<p><strong>Timeline:</strong> ${lead.timeline}</p>` : ''
  const budgetText = lead.budget
    ? `\n<p><strong>Budget:</strong> $${lead.budget.toLocaleString()}</p>`
    : ''

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
      color: #1f2937;
      margin: 0;
      padding: 0;
      background: #f3f4f6;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .header p {
      margin: 10px 0 0 0;
      opacity: 0.9;
      font-size: 16px;
    }
    .content {
      padding: 40px 30px;
    }
    .content p {
      margin: 0 0 16px 0;
      font-size: 16px;
    }
    .details {
      background: #f9fafb;
      border-left: 4px solid #0f172a;
      padding: 20px;
      margin: 24px 0;
      border-radius: 6px;
    }
    .details h2 {
      margin: 0 0 12px 0;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      font-weight: 600;
    }
    .details p {
      margin: 8px 0;
      font-size: 15px;
    }
    .cta {
      background: #0f172a;
      color: white;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 8px;
      display: inline-block;
      font-weight: 600;
      margin: 24px 0;
    }
    .footer {
      background: #f9fafb;
      padding: 30px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      margin: 8px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Request Received</h1>
      <p>We're on it, ${lead.userName.split(' ')[0]}</p>
    </div>

    <div class="content">
      <p>Thanks for reaching out. ${journeyMessage}</p>

      <p>Our team reviews every request within 24 hours. We'll dig into your requirements and get back to you with next steps.</p>

      <div class="details">
        <h2>What You're Looking For</h2>
        <p><strong>Type:</strong> ${lead.journey.charAt(0).toUpperCase() + lead.journey.slice(1)}</p>
        <p><strong>Requirements:</strong> ${lead.requirements}</p>${timelineText}${budgetText}
      </div>

      <p><strong>What happens next?</strong></p>
      <p>1. We'll review your requirements<br>
         2. We'll identify the best matches or opportunities<br>
         3. You'll hear from us with concrete next steps</p>

      <p>No fluff. No sales pitches. Just results.</p>

      <p>Questions in the meantime? Just reply to this email.</p>

      <p>— Wells AI Team</p>
    </div>

    <div class="footer">
      <p>Wells AI - Direct answers, real solutions</p>
      <p>Request ID: ${lead.id}</p>
    </div>
  </div>
</body>
</html>
  `
}

// ============================================================================
// TEAM NOTIFICATION EMAIL (to Wells team)
// ============================================================================

/**
 * Notifies Wells team of new lead
 */
export async function sendLeadNotification(leadDetails: Lead): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not configured, skipping team notification')
    return
  }

  try {
    const resend = getResendClient()
    if (!resend) return

    const html = generateTeamNotificationEmail(leadDetails)

    await resend.emails.send({
      from: FROM_EMAIL,
      to: TEAM_EMAIL,
      subject: `New Lead: ${leadDetails.userName} - ${leadDetails.journey}`,
      html,
      replyTo: leadDetails.userEmail,
    })

    console.log(`Team notification sent for lead ${leadDetails.id}`)
  } catch (error) {
    console.error('Error sending team notification:', error)
    // Don't throw - email failures shouldn't break the flow
  }
}

function generateTeamNotificationEmail(lead: Lead): string {
  const priorityColors = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
    urgent: '#dc2626',
  }

  const priorityColor = priorityColors[lead.priority || 'medium']
  const budgetText = lead.budget ? `$${lead.budget.toLocaleString()}` : 'Not specified'

  let conversationHTML = ''
  if (lead.conversationHistory && lead.conversationHistory.length > 0) {
    const recentMessages = lead.conversationHistory.slice(-3)
    conversationHTML = `
      <div class="conversation">
        <h3>Recent Conversation</h3>
        ${recentMessages
          .map(
            (msg) => `
          <div class="message ${msg.role}">
            <strong>${msg.role === 'user' ? 'User' : 'Wells'}:</strong>
            <p>${msg.content}</p>
          </div>
        `
          )
          .join('')}
      </div>
    `
  }

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
      color: #1f2937;
      margin: 0;
      padding: 0;
      background: #f3f4f6;
    }
    .container {
      max-width: 700px;
      margin: 40px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      padding: 30px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
    }
    .header .meta {
      margin-top: 10px;
      opacity: 0.95;
      font-size: 14px;
    }
    .priority-badge {
      display: inline-block;
      background: ${priorityColor};
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      margin-left: 10px;
    }
    .content {
      padding: 30px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin: 24px 0;
    }
    .info-item {
      background: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      border-left: 3px solid #6366f1;
    }
    .info-item h3 {
      margin: 0 0 8px 0;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      font-weight: 600;
    }
    .info-item p {
      margin: 0;
      font-size: 15px;
      font-weight: 500;
      color: #1f2937;
    }
    .requirements {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 20px;
      border-radius: 8px;
      margin: 24px 0;
    }
    .requirements h3 {
      margin: 0 0 12px 0;
      font-size: 14px;
      text-transform: uppercase;
      color: #1e40af;
      font-weight: 600;
    }
    .conversation {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin: 24px 0;
    }
    .conversation h3 {
      margin: 0 0 16px 0;
      font-size: 14px;
      text-transform: uppercase;
      color: #6b7280;
      font-weight: 600;
    }
    .message {
      background: white;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 12px;
      border-left: 3px solid #d1d5db;
    }
    .message.user {
      border-left-color: #6366f1;
    }
    .message strong {
      color: #6366f1;
      font-size: 13px;
    }
    .message p {
      margin: 4px 0 0 0;
      font-size: 14px;
    }
    .actions {
      background: #f9fafb;
      padding: 20px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
      margin-top: 30px;
    }
    .action-button {
      background: #6366f1;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 8px;
      display: inline-block;
      font-weight: 600;
      margin: 0 8px;
    }
    .footer {
      background: #0f172a;
      color: white;
      padding: 20px;
      text-align: center;
      font-size: 13px;
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 New Lead Captured</h1>
      <div class="meta">
        ${lead.userName} • ${lead.userEmail}
        <span class="priority-badge">${lead.priority || 'medium'} priority</span>
      </div>
    </div>

    <div class="content">
      <div class="info-grid">
        <div class="info-item">
          <h3>Journey Type</h3>
          <p>${lead.journey.charAt(0).toUpperCase() + lead.journey.slice(1)}</p>
        </div>

        <div class="info-item">
          <h3>Source</h3>
          <p>${lead.source || 'Chat'}</p>
        </div>

        ${
          lead.userCompany
            ? `
        <div class="info-item">
          <h3>Company</h3>
          <p>${lead.userCompany}</p>
        </div>
        `
            : ''
        }

        ${
          lead.userPhone
            ? `
        <div class="info-item">
          <h3>Phone</h3>
          <p>${lead.userPhone}</p>
        </div>
        `
            : ''
        }

        ${
          lead.timeline
            ? `
        <div class="info-item">
          <h3>Timeline</h3>
          <p>${lead.timeline}</p>
        </div>
        `
            : ''
        }

        <div class="info-item">
          <h3>Budget</h3>
          <p>${budgetText}</p>
        </div>
      </div>

      <div class="requirements">
        <h3>Requirements</h3>
        <p>${lead.requirements}</p>
      </div>

      ${conversationHTML}
    </div>

    <div class="actions">
      <p style="margin: 0 0 16px 0; color: #6b7280;">Take action on this lead</p>
      <a href="mailto:${lead.userEmail}" class="action-button">Reply to ${lead.userName.split(' ')[0]}</a>
    </div>

    <div class="footer">
      <p>Lead ID: ${lead.id} • Created: ${new Date(lead.createdAt).toLocaleString()}</p>
    </div>
  </div>
</body>
</html>
  `
}

// ============================================================================
// DEAL UPDATE EMAIL (to user)
// ============================================================================

export interface DealDetails {
  id: string
  userName: string
  status: 'new' | 'contacted' | 'in_progress' | 'closed' | 'won' | 'lost'
  statusMessage: string
  nextSteps?: string
  contactName?: string
}

/**
 * Updates user on deal progress
 */
export async function sendDealUpdate(
  email: string,
  dealDetails: DealDetails
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not configured, skipping deal update email')
    return
  }

  try {
    const resend = getResendClient()
    if (!resend) return

    const html = generateDealUpdateEmail(dealDetails)

    const statusSubjects = {
      new: 'Your request is being reviewed',
      contacted: "We've reached out",
      in_progress: 'Progress update on your request',
      closed: 'Update on your request',
      won: 'Great news about your request',
      lost: 'Update on your request',
    }

    const subject = statusSubjects[dealDetails.status] || 'Update on your request'

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html,
    })

    console.log(`Deal update email sent to ${email}`)
  } catch (error) {
    console.error('Error sending deal update email:', error)
    // Don't throw - email failures shouldn't break the flow
  }
}

function generateDealUpdateEmail(deal: DealDetails): string {
  const statusColors = {
    new: '#6366f1',
    contacted: '#3b82f6',
    in_progress: '#8b5cf6',
    closed: '#6b7280',
    won: '#10b981',
    lost: '#ef4444',
  }

  const statusColor = statusColors[deal.status]
  const statusLabels = {
    new: 'Under Review',
    contacted: 'We Reached Out',
    in_progress: 'In Progress',
    closed: 'Closed',
    won: 'Success',
    lost: 'Closed',
  }

  const statusLabel = statusLabels[deal.status]
  const contactText = deal.contactName ? ` by ${deal.contactName}` : ''
  const nextStepsHTML = deal.nextSteps
    ? `
      <div class="next-steps">
        <h3>Next Steps</h3>
        <p>${deal.nextSteps}</p>
      </div>
    `
    : ''

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
      color: #1f2937;
      margin: 0;
      padding: 0;
      background: #f3f4f6;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: ${statusColor};
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .status-badge {
      display: inline-block;
      background: rgba(255, 255, 255, 0.2);
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      margin-top: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 40px 30px;
    }
    .content p {
      margin: 0 0 16px 0;
      font-size: 16px;
    }
    .update-box {
      background: #f9fafb;
      border-left: 4px solid ${statusColor};
      padding: 20px;
      margin: 24px 0;
      border-radius: 6px;
    }
    .next-steps {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 20px;
      margin: 24px 0;
      border-radius: 8px;
    }
    .next-steps h3 {
      margin: 0 0 12px 0;
      font-size: 14px;
      text-transform: uppercase;
      color: #1e40af;
      font-weight: 600;
    }
    .footer {
      background: #f9fafb;
      padding: 30px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Update on Your Request</h1>
      <div class="status-badge">${statusLabel}</div>
    </div>

    <div class="content">
      <p>Hey ${deal.userName.split(' ')[0]},</p>

      <div class="update-box">
        <p>${deal.statusMessage}${contactText}</p>
      </div>

      ${nextStepsHTML}

      <p>Questions? Just reply to this email - we're here to help.</p>

      <p>— Wells AI Team</p>
    </div>

    <div class="footer">
      <p>Wells AI - Direct answers, real solutions</p>
      <p>Request ID: ${deal.id}</p>
    </div>
  </div>
</body>
</html>
  `
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Test email configuration
 */
export async function testEmailConfiguration(): Promise<boolean> {
  const resend = getResendClient()
  if (!resend) {
    console.error('RESEND_API_KEY not configured')
    return false
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: 'test@resend.dev',
      subject: 'Wells AI - Email Configuration Test',
      html: '<p>Email configuration is working correctly!</p>',
    })
    return true
  } catch (error) {
    console.error('Email configuration test failed:', error)
    return false
  }
}
