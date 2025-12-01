/**
 * POST /api/gtm/email/send
 * Unified email sending endpoint with intelligent routing
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sendEmailSmart, getRoutingSuggestion, type EmailContext } from '@/lib/email/router'
import { z } from 'zod'

const SendEmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1),
  text: z.string().min(1),
  html: z.string().optional(),
  cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  replyTo: z.string().email().optional(),
  // Context for routing
  importance: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  isSequence: z.boolean().default(false),
  hasAttachments: z.boolean().default(false),
  requiresPersonalization: z.boolean().default(false)
})

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

    // Parse and validate request body
    const body = await req.json()
    const validation = SendEmailSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validation.error.errors
        },
        { status: 400 }
      )
    }

    const {
      to,
      subject,
      text,
      html,
      cc,
      bcc,
      replyTo,
      importance,
      isSequence,
      hasAttachments,
      requiresPersonalization
    } = validation.data

    // Build email context
    const context: EmailContext = {
      userId,
      importance,
      volume: Array.isArray(to) ? to.length : 1,
      isSequence,
      hasAttachments,
      requiresPersonalization
    }

    // Get routing suggestion (for Wells AI conversational response)
    const suggestion = await getRoutingSuggestion(context)

    // Send email with smart routing
    const result = await sendEmailSmart(context, {
      to,
      subject,
      text,
      html,
      cc,
      bcc,
      replyTo
    })

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to send email',
          details: result.error,
          provider: result.provider,
          routing: result.routing
        },
        { status: 500 }
      )
    }

    console.log(`✅ Email sent via ${result.provider}: ${result.messageId}`)

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      provider: result.provider,
      routing: result.routing,
      suggestion // Wells AI conversational message
    })
  } catch (error) {
    console.error('[EMAIL-SEND] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/gtm/email/send
 * Get routing suggestion without sending
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const importance = searchParams.get('importance') as 'low' | 'medium' | 'high' | 'critical' || 'medium'
    const volume = parseInt(searchParams.get('volume') || '1')
    const isSequence = searchParams.get('isSequence') === 'true'

    const context: EmailContext = {
      userId,
      importance,
      volume,
      isSequence
    }

    const suggestion = await getRoutingSuggestion(context)

    return NextResponse.json({
      suggestion,
      context
    })
  } catch (error) {
    console.error('[EMAIL-SEND] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get routing suggestion' },
      { status: 500 }
    )
  }
}
