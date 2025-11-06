/**
 * Email Send API
 *
 * Handles email sending with automatic provider selection and deliverability guardrails.
 * Integrated with Wells chat for conversational email sending.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, getWarmupStatus, isValidEmail } from '@/lib/resend-email'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

interface EmailRequest {
  to: string
  toName?: string
  subject: string
  message: string // Plain text message (will be converted to HTML)
  from?: string
  fromName?: string
  replyTo?: string
  userId?: string
}

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user from NextAuth
    const session = await getServerSession(authOptions)
    const userEmail = session?.user?.email || undefined
    const userName = session?.user?.name || undefined

    const body: EmailRequest = await req.json()

    // Validation
    if (!body.to || !body.subject || !body.message) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: to, subject, message'
        },
        { status: 400 }
      )
    }

    // Validate email format
    if (!isValidEmail(body.to)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid email address: ${body.to}`
        },
        { status: 400 }
      )
    }

    // Send email via Resend
    // Use authenticated user's email as sender (if available)
    const result = await sendEmail({
      to: body.to,
      toName: body.toName,
      subject: body.subject,
      text: body.message,
      from: body.from || userEmail, // Use logged-in user's email
      fromName: body.fromName || userName, // Use logged-in user's name
      replyTo: body.replyTo,
      tags: {
        userId: body.userId || authData.userId || 'anonymous',
        source: 'wells-chat'
      }
    })

    // If throttled, return helpful message
    if (result.throttled) {
      const warmupStatus = getWarmupStatus()
      return NextResponse.json(
        {
          success: false,
          throttled: true,
          error: result.error,
          warmupStatus: {
            phase: warmupStatus.phase,
            dailyLimit: warmupStatus.dailyLimit,
            sentToday: warmupStatus.sentToday,
            remaining: warmupStatus.remaining,
            accountAgeDays: warmupStatus.accountAgeDays
          }
        },
        { status: 429 }
      )
    }

    // If error, return error
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        { status: 500 }
      )
    }

    // Success!
    const warmupStatus = getWarmupStatus()
    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      sentToday: result.sentToday,
      dailyLimit: result.dailyLimit,
      remaining: warmupStatus.remaining,
      warmupPhase: warmupStatus.phase
    })

  } catch (error: any) {
    console.error('[EMAIL API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send email'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/email/send - Get warmup status
 * Useful for checking rate limits before sending
 */
export async function GET(req: NextRequest) {
  try {
    const status = getWarmupStatus()
    return NextResponse.json({
      warmup: status,
      canSendMore: status.remaining > 0,
      recommendation: status.remaining > 0
        ? `You can send ${status.remaining} more emails today`
        : `Daily limit reached (${status.dailyLimit}/day). Try again tomorrow or during ${status.phase} warmup phase.`
    })
  } catch (error: any) {
    console.error('[EMAIL API] Error getting status:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get warmup status'
      },
      { status: 500 }
    )
  }
}
