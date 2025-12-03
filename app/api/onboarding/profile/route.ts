/**
 * Onboarding Profile API
 *
 * GET - Retrieve current profile data
 * POST - Update profile data during onboarding
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { UserProfile } from '@/lib/onboarding/types'

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    // Build profile from Clerk user data
    const profile: Partial<UserProfile> = {
      userId,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.primaryEmailAddress?.emailAddress || '',
      phone: user.primaryPhoneNumber?.phoneNumber,
      avatarUrl: user.imageUrl,
      journey: user.publicMetadata?.selectedJourney as UserProfile['journey'],
    }

    // Get extended profile from private metadata
    const privateProfile = user.privateMetadata?.fullProfile as Partial<UserProfile> | undefined
    if (privateProfile) {
      Object.assign(profile, privateProfile)
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const profileUpdates = body as Partial<UserProfile>

    const client = await clerkClient()

    // Get current private metadata
    const user = await client.users.getUser(userId)
    const currentProfile = (user.privateMetadata?.fullProfile as Partial<UserProfile>) || {}

    // Merge updates
    const updatedProfile = {
      ...currentProfile,
      ...profileUpdates,
    }

    // Update private metadata with full profile
    await client.users.updateUserMetadata(userId, {
      privateMetadata: {
        fullProfile: updatedProfile,
      },
      publicMetadata: {
        selectedJourney: profileUpdates.journey || user.publicMetadata?.selectedJourney,
      }
    })

    // Update user's first/last name if changed
    if (profileUpdates.firstName || profileUpdates.lastName) {
      await client.users.updateUser(userId, {
        ...(profileUpdates.firstName && { firstName: profileUpdates.firstName }),
        ...(profileUpdates.lastName && { lastName: profileUpdates.lastName }),
      })
    }

    return NextResponse.json({
      success: true,
      profile: updatedProfile
    })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
