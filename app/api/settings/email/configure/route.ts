/**
 * POST /api/settings/email/configure
 * Save user's email configuration
 */

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  saveUserEmailConfig,
  validateSMTPConfig,
  validateResendConfig,
  testSMTPConnection,
  testResendApiKey,
  type UserEmailConfig,
  type SMTPConfig,
  type ResendConfig
} from '@/lib/email-config'

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await req.json()
    const { provider, ...configData } = body

    // Validate provider
    if (!provider || !['RESEND', 'SMTP', 'GMAIL_OAUTH', 'OUTLOOK_OAUTH'].includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Must be one of: RESEND, SMTP, GMAIL_OAUTH, OUTLOOK_OAUTH' },
        { status: 400 }
      )
    }

    // Validate configuration based on provider
    if (provider === 'SMTP') {
      const validation = validateSMTPConfig(configData)
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Invalid SMTP configuration', details: validation.errors },
          { status: 400 }
        )
      }

      // Test SMTP connection before saving
      const testResult = await testSMTPConnection(configData as SMTPConfig)
      if (!testResult.success) {
        return NextResponse.json(
          {
            error: 'SMTP connection test failed',
            message: testResult.message,
            details: testResult.error
          },
          { status: 400 }
        )
      }
    } else if (provider === 'RESEND') {
      const validation = validateResendConfig(configData)
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Invalid Resend configuration', details: validation.errors },
          { status: 400 }
        )
      }

      // Test Resend API key before saving
      const testResult = await testResendApiKey(configData.resendApiKey)
      if (!testResult.success) {
        return NextResponse.json(
          {
            error: 'Resend API key test failed',
            message: testResult.message,
            details: testResult.error
          },
          { status: 400 }
        )
      }
    } else {
      return NextResponse.json(
        { error: `Provider ${provider} not yet implemented` },
        { status: 501 }
      )
    }

    // Prepare config object
    const config: UserEmailConfig = {
      provider,
      ...configData
    } as UserEmailConfig

    // Save configuration
    const result = await saveUserEmailConfig(userId, config)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to save email configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Email configuration saved successfully',
      provider
    })
  } catch (error) {
    console.error('[API] Failed to configure email:', error)
    return NextResponse.json(
      { error: 'Failed to configure email' },
      { status: 500 }
    )
  }
}
