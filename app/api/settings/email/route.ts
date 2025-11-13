/**
 * GET /api/settings/email
 * Get user's email configuration
 */

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getUserEmailConfig } from '@/lib/email-config'

export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's email config
    const config = await getUserEmailConfig(userId)

    if (!config) {
      return NextResponse.json(
        { configured: false, message: 'No email configuration found' },
        { status: 200 }
      )
    }

    // Return config (without sensitive credentials)
    const response: any = {
      configured: true,
      provider: config.provider,
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      replyTo: config.replyTo
    }

    // Add provider-specific non-sensitive info
    if (config.provider === 'SMTP') {
      response.smtpHost = (config as any).smtpHost
      response.smtpPort = (config as any).smtpPort
      response.smtpUsername = (config as any).smtpUsername
      response.smtpSecure = (config as any).smtpSecure
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API] Failed to get email config:', error)
    return NextResponse.json(
      { error: 'Failed to get email configuration' },
      { status: 500 }
    )
  }
}
