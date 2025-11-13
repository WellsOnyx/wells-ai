/**
 * Email sending via Resend
 */

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function sendEmail(params: {
  to: string
  subject: string
  text: string
  html?: string
  inReplyTo?: string
  from?: string
}): Promise<{
  success: boolean
  platformMessageId?: string
  response?: any
  error?: string
}> {
  try {
    const fromEmail = params.from || process.env.RESEND_FROM_EMAIL || 'wells@inbox.wellsai.com'

    const result = await resend.emails.send({
      from: fromEmail,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      headers: params.inReplyTo
        ? {
            'In-Reply-To': params.inReplyTo,
            References: params.inReplyTo,
          }
        : undefined,
    })

    if (result.error) {
      return {
        success: false,
        error: result.error.message,
      }
    }

    return {
      success: true,
      platformMessageId: result.data?.id,
      response: result.data,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
