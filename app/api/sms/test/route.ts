/**
 * SMS Test Endpoint
 * Test real SMS delivery to hardcoded phones
 */

import twilio from 'twilio'
import { NextResponse } from 'next/server'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export async function POST(request: Request) {
  try {
    const { testMessage } = await request.json()

    // Hardcoded test phones from environment
    const testPhones = [
      process.env.TEST_PHONE_1,
      process.env.TEST_PHONE_2,
      process.env.TEST_PHONE_3,
    ].filter(Boolean) // Remove undefined phones

    if (testPhones.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No test phones configured. Set TEST_PHONE_1, TEST_PHONE_2, TEST_PHONE_3 in .env',
        },
        { status: 400 }
      )
    }

    if (!process.env.TWILIO_PHONE_NUMBER) {
      return NextResponse.json(
        {
          success: false,
          error: 'TWILIO_PHONE_NUMBER not configured in .env',
        },
        { status: 400 }
      )
    }

    // Default test message if none provided
    const message =
      testMessage ||
      `🔷 WELLS AI - SMS TEST

This is a test message to verify SMS delivery.

Time: ${new Date().toLocaleString()}

If you received this, SMS is working! ✅

Reply: 1=Yes | 2=No`

    console.log('[SMS Test] Starting test...')
    console.log('[SMS Test] From:', process.env.TWILIO_PHONE_NUMBER)
    console.log('[SMS Test] Test phones:', testPhones.length)

    const results = []

    for (const phone of testPhones) {
      try {
        console.log(`[SMS Test] Sending to ${phone}...`)

        const sms = await twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone,
        })

        console.log(`[SMS Test] Sent to ${phone} - Status: ${sms.status} - SID: ${sms.sid}`)

        results.push({
          phone,
          status: sms.status,
          sid: sms.sid,
          success: true,
          timestamp: new Date().toISOString(),
        })
      } catch (error: any) {
        console.error(`[SMS Test] Failed to send to ${phone}:`, error.message)

        results.push({
          phone,
          status: 'failed',
          error: error.message,
          success: false,
          timestamp: new Date().toISOString(),
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    console.log(`[SMS Test] Complete: ${successCount} sent, ${failureCount} failed`)

    return NextResponse.json({
      success: successCount > 0,
      message: `Sent ${successCount} messages, ${failureCount} failed`,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[SMS Test] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'SMS Test Endpoint',
    usage: 'POST to this endpoint to send test SMS',
    requiredEnv: [
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_PHONE_NUMBER',
      'TEST_PHONE_1',
      'TEST_PHONE_2 (optional)',
      'TEST_PHONE_3 (optional)',
    ],
    body: {
      testMessage: 'Optional custom test message',
    },
  })
}
