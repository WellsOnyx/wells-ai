/**
 * POST /api/settings/email/test
 * Test email configuration by sending a test email
 */

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  getUserEmailConfig,
  testEmailConfig,
  type UserEmailConfig
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
    const { testEmail, config } = body

    if (!testEmail) {
      return NextResponse.json(
        { error: 'Test email address is required' },
        { status: 400 }
      )
    }

    // Get email config (either from request or from database)
    let emailConfig: UserEmailConfig | null = null

    if (config) {
      // Use provided config (for testing before saving)
      emailConfig = config as UserEmailConfig
    } else {
      // Use saved config
      emailConfig = await getUserEmailConfig(userId)

      if (!emailConfig) {
        return NextResponse.json(
          { error: 'No email configuration found. Please configure your email settings first.' },
          { status: 404 }
        )
      }
    }

    // Test email configuration
    const result = await testEmailConfig(userId, emailConfig, testEmail)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        details: result.details
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          error: result.error
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[API] Failed to test email config:', error)
    return NextResponse.json(
      { error: 'Failed to test email configuration' },
      { status: 500 }
    )
  }
}
