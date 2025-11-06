/**
 * Email Tool for Wells AI
 *
 * Allows Wells to send emails on behalf of the authenticated user
 */

export const EMAIL_TOOL_DEFINITION = {
  name: 'send_email',
  description: 'Send an email on behalf of the authenticated user. Use this when the user asks you to send an email, draft an email, or contact someone via email.',
  input_schema: {
    type: 'object' as const,
    properties: {
      to: {
        type: 'string',
        description: 'Recipient email address (e.g., john@example.com)'
      },
      subject: {
        type: 'string',
        description: 'Email subject line'
      },
      message: {
        type: 'string',
        description: 'Email body content (plain text)'
      },
      toName: {
        type: 'string',
        description: 'Recipient name (optional, for personalization)'
      }
    },
    required: ['to', 'subject', 'message']
  }
}

export interface SendEmailInput {
  to: string
  subject: string
  message: string
  toName?: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
  sentToday?: number
  dailyLimit?: number
}

/**
 * Execute email send via the email API
 */
export async function executeSendEmail(
  input: SendEmailInput,
  baseUrl: string
): Promise<SendEmailResult> {
  try {
    const response = await fetch(`${baseUrl}/api/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(input)
    })

    const result = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Failed to send email'
      }
    }

    return {
      success: true,
      messageId: result.messageId,
      sentToday: result.sentToday,
      dailyLimit: result.dailyLimit
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error while sending email'
    }
  }
}
