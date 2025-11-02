/**
 * LinkedIn Integration Connection API
 *
 * Allows users to connect their LinkedIn integration
 * (manual, Phantombuster, or browser extension)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import {
  connectLinkedInIntegration,
  type LinkedInIntegration
} from '@/lib/gtm/linkedin-integration'

/**
 * GET /api/gtm/linkedin/connect
 * Get current LinkedIn integration status
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch integration from Clerk metadata
    const clerk = await clerkClient()
    const user = await clerk.users.getUser(userId)
    const integration = user.publicMetadata?.linkedInIntegration as LinkedInIntegration | undefined

    return NextResponse.json({
      connected: !!integration?.connected,
      provider: integration?.provider || null,
      dailyConnectionLimit: integration?.dailyConnectionLimit || 15,
      dailyMessageLimit: integration?.dailyMessageLimit || 20
    })
  } catch (error: any) {
    console.error('[LINKEDIN_CONNECT_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch integration' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/gtm/linkedin/connect
 * Connect LinkedIn integration
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      provider,
      credentials
    }: {
      provider: 'manual' | 'phantombuster' | 'browser-extension'
      credentials?: any
    } = body

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider required' },
        { status: 400 }
      )
    }

    // Create integration
    const integration = await connectLinkedInIntegration(
      userId,
      provider,
      credentials
    )

    // Store in Clerk metadata (encrypted credentials should be handled separately)
    const clerk = await clerkClient()
    const currentUser = await clerk.users.getUser(userId)
    await clerk.users.updateUser(userId, {
      publicMetadata: {
        ...(currentUser.publicMetadata || {}),
        linkedInIntegration: {
          userId: integration.userId,
          provider: integration.provider,
          connected: integration.connected,
          dailyConnectionLimit: integration.dailyConnectionLimit,
          dailyMessageLimit: integration.dailyMessageLimit,
          lastSyncAt: integration.lastSyncAt
        }
      }
    })

    console.log('[LINKEDIN_INTEGRATION_CONNECTED]', {
      userId,
      provider
    })

    return NextResponse.json({
      success: true,
      integration: {
        provider: integration.provider,
        connected: integration.connected,
        dailyConnectionLimit: integration.dailyConnectionLimit,
        dailyMessageLimit: integration.dailyMessageLimit
      }
    })
  } catch (error: any) {
    console.error('[LINKEDIN_CONNECT_POST]', error)
    return NextResponse.json(
      { error: 'Failed to connect integration' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/gtm/linkedin/connect
 * Disconnect LinkedIn integration
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Remove from Clerk metadata
    const clerk = await clerkClient()
    const user = await clerk.users.getUser(userId)
    const metadata = user.publicMetadata || {}
    delete (metadata as any).linkedInIntegration

    await clerk.users.updateUser(userId, {
      publicMetadata: metadata
    })

    console.log('[LINKEDIN_INTEGRATION_DISCONNECTED]', { userId })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[LINKEDIN_CONNECT_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to disconnect integration' },
      { status: 500 }
    )
  }
}
