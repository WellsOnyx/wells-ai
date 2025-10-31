/**
 * Twilio SMS Helper
 * Sends SMS notifications via Twilio
 */

import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER

// Initialize Twilio client (only if credentials are configured)
let twilioClient: ReturnType<typeof twilio> | null = null
if (accountSid && authToken) {
  twilioClient = twilio(accountSid, authToken)
}

export interface SMSOptions {
  to: string
  body: string
  from?: string
}

/**
 * Send SMS message via Twilio
 */
export async function sendSMS(options: SMSOptions): Promise<{
  success: boolean
  messageId?: string
  error?: string
}> {
  if (!twilioClient) {
    console.warn('[Twilio] Not configured - skipping SMS send')
    return {
      success: false,
      error: 'Twilio not configured',
    }
  }

  if (!twilioPhoneNumber) {
    console.error('[Twilio] TWILIO_PHONE_NUMBER not set')
    return {
      success: false,
      error: 'Twilio phone number not configured',
    }
  }

  try {
    const message = await twilioClient.messages.create({
      body: options.body,
      from: options.from || twilioPhoneNumber,
      to: options.to,
    })

    console.log(`[Twilio] SMS sent successfully: ${message.sid}`)

    return {
      success: true,
      messageId: message.sid,
    }
  } catch (error: any) {
    console.error(`[Twilio] Failed to send SMS:`, error)

    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * Send bulk SMS messages
 */
export async function sendBulkSMS(messages: SMSOptions[]): Promise<{
  successful: number
  failed: number
  results: Array<{ success: boolean; messageId?: string; error?: string }>
}> {
  const results = await Promise.all(messages.map((msg) => sendSMS(msg)))

  const successful = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  return {
    successful,
    failed,
    results,
  }
}

export default {
  sendSMS,
  sendBulkSMS,
}
