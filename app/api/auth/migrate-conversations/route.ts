/**
 * Migrate Conversations API - Move anonymous conversations to authenticated user
 * Enables seamless cross-device sync after magic link sign-in
 */

import { NextRequest, NextResponse } from 'next/server'
import { migrateAnonymousConversations } from '@/lib/memory'

export async function POST(request: NextRequest) {
  try {
    const { anonymousUserId, authenticatedUserId } = await request.json()

    if (!anonymousUserId || !authenticatedUserId) {
      return NextResponse.json(
        { error: 'Both anonymousUserId and authenticatedUserId are required' },
        { status: 400 }
      )
    }

    if (anonymousUserId === authenticatedUserId) {
      return NextResponse.json(
        { migratedCount: 0, message: 'User IDs are the same, no migration needed' },
        { status: 200 }
      )
    }

    console.log(`[MIGRATION API] Migrating from ${anonymousUserId} to ${authenticatedUserId}`)

    // Migrate conversations using memory system
    const result = await migrateAnonymousConversations(anonymousUserId, authenticatedUserId)

    console.log(`[MIGRATION API] Success: ${result.migratedCount} conversations migrated`)

    return NextResponse.json({
      success: true,
      migratedCount: result.migratedCount,
      message: `Successfully migrated ${result.migratedCount} conversations`
    })
  } catch (error: any) {
    console.error('[MIGRATION API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to migrate conversations' },
      { status: 500 }
    )
  }
}
