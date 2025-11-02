/**
 * GTM Qualification API - Manage qualification state for GTM Journey
 *
 * Stores qualification data in Clerk user metadata
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import type { RoleQualification } from '@/lib/gtm/sourcing-qualification'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get qualification state from Clerk user metadata
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const gtmQualification = user.publicMetadata?.gtmQualification as Partial<RoleQualification> | undefined

    return NextResponse.json({
      success: true,
      qualification: gtmQualification || null,
      isActive: !!gtmQualification,
    })
  } catch (error) {
    console.error('[GTM QUALIFICATION] Error getting qualification:', error)
    return NextResponse.json({ error: 'Failed to get qualification' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { qualification } = body as { qualification: Partial<RoleQualification> }

    // Save qualification to Clerk user metadata
    const client = await clerkClient()
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        gtmQualification: qualification,
      },
    })

    return NextResponse.json({
      success: true,
      qualification,
    })
  } catch (error) {
    console.error('[GTM QUALIFICATION] Error saving qualification:', error)
    return NextResponse.json({ error: 'Failed to save qualification' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Clear qualification from Clerk user metadata
    const client = await clerkClient()
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        gtmQualification: null,
      },
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('[GTM QUALIFICATION] Error clearing qualification:', error)
    return NextResponse.json({ error: 'Failed to clear qualification' }, { status: 500 })
  }
}
