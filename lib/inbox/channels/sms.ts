/**
 * SMS sending via Twilio
 */

import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export async function sendSMS(params: {
  to: string
  body: string
  from?: string
  mediaUrl?: string[]
}): Promise<{
  success: boolean
  platformMessageId?: string
  response?: any
  error?: string
}> {
  try {
    const fromNumber = params.from || process.env.TWILIO_PHONE_NUMBER!

    const message = await client.messages.create({
      to: params.to,
      from: fromNumber,
      body: params.body,
      mediaUrl: params.mediaUrl,
    })

    return {
      success: true,
      platformMessageId: message.sid,
      response: {
        sid: message.sid,
        status: message.status,
        dateCreated: message.dateCreated,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
