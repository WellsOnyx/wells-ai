// @ts-nocheck
/**
 * Twitter Chat API
 *
 * Conversational interface for all Twitter operations.
 * POST - Send a message about Twitter
 * GET - Check Twitter status
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { handleTwitterMessage, executeTwitterAction } from '@/lib/twitter/twitter-handler'
import { isTwitterConfigured, validateCredentials, getMe } from '@/lib/twitter/twitter-client'
import { v4 as uuidv4 } from 'uuid'

export const runtime = 'nodejs'
export const maxDuration = 60

// ============================================================================
// POST - Handle Twitter Messages
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { message, sessionId, confirmAction, context } = body

    // Handle confirmation of pending action
    if (confirmAction) {
      const result = await executeTwitterAction(confirmAction)
      return NextResponse.json({
        success: true,
        ...result
      })
    }

    // Handle regular message
    if (!message) {
      return NextResponse.json(
        { error: 'Message required' },
        { status: 400 }
      )
    }

    const session = sessionId || uuidv4()
    const response = await handleTwitterMessage(userId, session, message, context)

    return NextResponse.json({
      success: true,
      sessionId: session,
      ...response
    })
  } catch (error: any) {
    console.error('[Twitter API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process message', details: error.message },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Check Twitter Status
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const configured = isTwitterConfigured()

    if (!configured) {
      return NextResponse.json({
        configured: false,
        status: 'incomplete',
        message: 'Twitter API credentials not fully configured',
        missing: [
          !process.env.TWITTER_API_KEY && 'TWITTER_API_KEY',
          !process.env.TWITTER_API_KEY_SECRET && 'TWITTER_API_KEY_SECRET',
          !process.env.TWITTER_ACCESS_TOKEN && 'TWITTER_ACCESS_TOKEN',
          !process.env.TWITTER_ACCESS_TOKEN_SECRET && 'TWITTER_ACCESS_TOKEN_SECRET'
        ].filter(Boolean)
      })
    }

    try {
      const valid = await validateCredentials()

      if (valid) {
        const me = await getMe()
        return NextResponse.json({
          configured: true,
          status: 'connected',
          account: {
            id: me.id,
            name: me.name,
            username: me.username
          }
        })
      } else {
        return NextResponse.json({
          configured: true,
          status: 'invalid',
          message: 'Credentials configured but not working'
        })
      }
    } catch (error: any) {
      return NextResponse.json({
        configured: true,
        status: 'error',
        message: error.message
      })
    }
  } catch (error: any) {
    console.error('[Twitter API] Status check error:', error)
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    )
  }
}
