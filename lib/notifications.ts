/**
 * Notification Utilities
 *
 * Handles sending notifications via Slack, email, etc.
 */

import { Lead } from './leads-db'

// ============================================================================
// SLACK NOTIFICATIONS
// ============================================================================

/**
 * Send a Slack notification for a new lead
 */
export async function notifyNewLead(lead: Lead): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL

  if (!webhookUrl) {
    console.log('SLACK_WEBHOOK_URL not configured, skipping Slack notification')
    return
  }

  try {
    const message = formatLeadForSlack(lead)

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    })

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`)
    }

    console.log('Slack notification sent for lead:', lead.id)
  } catch (error) {
    console.error('Error sending Slack notification:', error)
    // Don't throw - notification failures shouldn't break the flow
  }
}

/**
 * Format lead data for Slack message
 */
function formatLeadForSlack(lead: Lead) {
  // Determine emoji based on journey
  const journeyEmojis: Record<Lead['journey'], string> = {
    founder: '👔',
    buyer: '🛒',
    seller: '💼',
    jobs: '💼',
  }

  const emoji = journeyEmojis[lead.journey] || '📋'

  // Format budget if available
  const budgetText = lead.budget ? `$${lead.budget.toLocaleString()}` : 'Not specified'

  // Build blocks for rich formatting
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} New Lead: ${lead.userName}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Journey:*\n${lead.journey.charAt(0).toUpperCase() + lead.journey.slice(1)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Email:*\n${lead.userEmail}`,
        },
        {
          type: 'mrkdwn',
          text: `*Priority:*\n${lead.priority || 'Medium'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Budget:*\n${budgetText}`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Requirements:*\n${lead.requirements}`,
      },
    },
  ]

  // Add company if available
  if (lead.userCompany) {
    blocks[1].fields.splice(1, 0, {
      type: 'mrkdwn',
      text: `*Company:*\n${lead.userCompany}`,
    })
  }

  // Add phone if available
  if (lead.userPhone) {
    blocks[1].fields.push({
      type: 'mrkdwn',
      text: `*Phone:*\n${lead.userPhone}`,
    })
  }

  // Add timeline if available
  if (lead.timeline) {
    blocks[1].fields.push({
      type: 'mrkdwn',
      text: `*Timeline:*\n${lead.timeline}`,
    })
  }

  // Add conversation preview (last 2 messages)
  if (lead.conversationHistory && lead.conversationHistory.length > 0) {
    const recentMessages = lead.conversationHistory.slice(-2)
    const conversationPreview = recentMessages
      .map((msg) => `*${msg.role === 'user' ? 'User' : 'Wells'}:* ${msg.content}`)
      .join('\n')

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Recent Conversation:*\n${conversationPreview}`,
      },
    })
  }

  // Add divider and footer
  blocks.push(
    {
      type: 'divider',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Lead ID: ${lead.id} | Created: ${new Date(lead.createdAt).toLocaleString()} | Source: ${lead.source}`,
        },
      ],
    }
  )

  return {
    text: `New Lead: ${lead.userName} (${lead.journey})`, // Fallback text
    blocks,
  }
}

// ============================================================================
// EMAIL NOTIFICATIONS
// ============================================================================

/**
 * Send an email notification for a new lead
 */
export async function notifyNewLeadEmail(lead: Lead, recipientEmail: string): Promise<void> {
  // This would integrate with SendGrid, Resend, or another email service
  // For now, we'll just log it
  console.log('Email notification would be sent to:', recipientEmail)
  console.log('Lead:', lead.id, lead.userName, lead.userEmail)

  // TODO: Implement actual email sending
  // Example with Resend:
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // await resend.emails.send({
  //   from: 'wells@wellsonyx.com',
  //   to: recipientEmail,
  //   subject: `New Lead: ${lead.userName} (${lead.journey})`,
  //   html: formatLeadForEmail(lead)
  // })
}

/**
 * Format lead data for email
 */
function formatLeadForEmail(lead: Lead): string {
  const budgetText = lead.budget ? `$${lead.budget.toLocaleString()}` : 'Not specified'

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
        .field { margin-bottom: 15px; }
        .field-label { font-weight: 600; color: #6b7280; font-size: 12px; text-transform: uppercase; }
        .field-value { font-size: 16px; margin-top: 4px; }
        .requirements { background: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .conversation { background: #eff6ff; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6; }
        .message { margin-bottom: 10px; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">🎯 New Lead Captured</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">${lead.userName} is interested in ${lead.journey}</p>
        </div>
        <div class="content">
          <div class="field">
            <div class="field-label">Contact</div>
            <div class="field-value">
              <strong>${lead.userName}</strong><br>
              ${lead.userEmail}
              ${lead.userPhone ? `<br>${lead.userPhone}` : ''}
              ${lead.userCompany ? `<br>${lead.userCompany}` : ''}
            </div>
          </div>

          <div class="field">
            <div class="field-label">Journey Type</div>
            <div class="field-value">${lead.journey.charAt(0).toUpperCase() + lead.journey.slice(1)}</div>
          </div>

          <div class="field">
            <div class="field-label">Priority</div>
            <div class="field-value">${lead.priority || 'Medium'}</div>
          </div>

          ${
            lead.budget
              ? `
          <div class="field">
            <div class="field-label">Budget</div>
            <div class="field-value">${budgetText}</div>
          </div>
          `
              : ''
          }

          ${
            lead.timeline
              ? `
          <div class="field">
            <div class="field-label">Timeline</div>
            <div class="field-value">${lead.timeline}</div>
          </div>
          `
              : ''
          }

          <div class="requirements">
            <div class="field-label">Requirements</div>
            <div style="margin-top: 8px;">${lead.requirements}</div>
          </div>

          ${
            lead.conversationHistory && lead.conversationHistory.length > 0
              ? `
          <div class="conversation">
            <div class="field-label">Recent Conversation</div>
            <div style="margin-top: 10px;">
              ${lead.conversationHistory
                .slice(-3)
                .map(
                  (msg) => `
                <div class="message">
                  <strong>${msg.role === 'user' ? 'User' : 'Wells'}:</strong> ${msg.content}
                </div>
              `
                )
                .join('')}
            </div>
          </div>
          `
              : ''
          }

          <div class="footer">
            <p>Lead ID: ${lead.id}</p>
            <p>Created: ${new Date(lead.createdAt).toLocaleString()}</p>
            <p>Source: ${lead.source}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}
