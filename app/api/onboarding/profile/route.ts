/**
 * Onboarding Profile API
 *
 * GET - Retrieve current progressive profile data
 * POST - Update profile data during onboarding
 * PATCH - Partial profile updates
 *
 * Now supports progressive profile building through conversation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient, currentUser } from '@clerk/nextjs/server'
import { UserProfile } from '@/lib/onboarding/types'
import { getOrCreateProfile, upsertProfile, updateProfileFields } from '@/lib/onboarding/db'
import { calculateCompleteness, getMissingFields, ProgressiveProfile } from '@/lib/onboarding/profile-schema'

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    // Get progressive profile from database
    const progressiveProfile = await getOrCreateProfile(userId, {
      email: user.primaryEmailAddress?.emailAddress,
      name: user.firstName || undefined,
    })

    // Calculate completeness and missing fields
    const completeness = calculateCompleteness(progressiveProfile)
    const missingFields = getMissingFields(progressiveProfile)

    // Build legacy profile format for backwards compatibility
    const legacyProfile: Partial<UserProfile> = {
      userId,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.primaryEmailAddress?.emailAddress || '',
      phone: user.primaryPhoneNumber?.phoneNumber,
      avatarUrl: user.imageUrl,
      journey: progressiveProfile.journey as UserProfile['journey'] || user.publicMetadata?.selectedJourney as UserProfile['journey'],
    }

    // Get extended profile from private metadata for backwards compat
    const privateProfile = user.privateMetadata?.fullProfile as Partial<UserProfile> | undefined
    if (privateProfile) {
      Object.assign(legacyProfile, privateProfile)
    }

    return NextResponse.json({
      // Legacy format
      profile: legacyProfile,

      // New progressive format
      progressiveProfile: {
        id: progressiveProfile.id,
        userId: progressiveProfile.userId,
        journey: progressiveProfile.journey,
        journeys: progressiveProfile.journeys,
        name: progressiveProfile.name,
        email: progressiveProfile.email,
        phone: progressiveProfile.phone,

        // Journey-specific data
        buyer: progressiveProfile.buyer,
        seller: progressiveProfile.seller,
        founder: progressiveProfile.founder,
        jobs: progressiveProfile.jobs,

        // Meta
        completeness,
        confidenceScores: progressiveProfile.confidenceScores,
        lastUpdated: progressiveProfile.lastUpdated,
        createdAt: progressiveProfile.createdAt,
      },

      // Helpful meta
      meta: {
        completeness,
        missingFields: missingFields.map(f => ({
          key: f.key,
          label: f.label,
          priority: f.priority,
          questionHint: f.questionHint,
        })),
        isComplete: completeness >= 80,
        canHelp: completeness >= 40,
      },
    })
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

    // Also update progressive profile
    const progressiveProfile = await getOrCreateProfile(userId)

    // Map legacy fields to progressive profile
    if (profileUpdates.journey) {
      progressiveProfile.journey = profileUpdates.journey as ProgressiveProfile['journey']
    }
    if (profileUpdates.firstName) {
      progressiveProfile.name = profileUpdates.firstName
    }
    if (profileUpdates.company) {
      // Set company in relevant journey profile
      if (progressiveProfile.journey === 'buyer') {
        if (!progressiveProfile.buyer) progressiveProfile.buyer = {}
        progressiveProfile.buyer.company = profileUpdates.company
      } else if (progressiveProfile.journey === 'seller') {
        if (!progressiveProfile.seller) progressiveProfile.seller = {}
        progressiveProfile.seller.company = profileUpdates.company
      } else if (progressiveProfile.journey === 'founder') {
        if (!progressiveProfile.founder) progressiveProfile.founder = {}
        progressiveProfile.founder.company = profileUpdates.company
      }
    }

    await upsertProfile(progressiveProfile)
    const completeness = calculateCompleteness(progressiveProfile)

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      progressiveProfile: {
        id: progressiveProfile.id,
        journey: progressiveProfile.journey,
        completeness,
      },
    })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH - Update progressive profile directly
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Get current profile
    const profile = await getOrCreateProfile(userId)

    // Apply partial updates
    if (body.journey) profile.journey = body.journey
    if (body.name) profile.name = body.name
    if (body.phone) profile.phone = body.phone

    // Journey-specific updates
    if (body.buyer) {
      profile.buyer = { ...profile.buyer, ...body.buyer }
    }
    if (body.seller) {
      profile.seller = { ...profile.seller, ...body.seller }
    }
    if (body.founder) {
      profile.founder = { ...profile.founder, ...body.founder }
    }
    if (body.jobs) {
      profile.jobs = { ...profile.jobs, ...body.jobs }
    }

    // Save
    await upsertProfile(profile)
    const completeness = calculateCompleteness(profile)
    const missingFields = getMissingFields(profile)

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        journey: profile.journey,
        completeness,
        buyer: profile.buyer,
        seller: profile.seller,
        founder: profile.founder,
        jobs: profile.jobs,
      },
      meta: {
        missingFields: missingFields.slice(0, 3).map(f => ({
          key: f.key,
          label: f.label,
          questionHint: f.questionHint,
        })),
      },
    })
  } catch (error) {
    console.error('Error patching profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
