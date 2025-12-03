/**
 * Complete Onboarding API
 *
 * POST - Mark onboarding as complete and save final profile
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { UserProfile } from '@/lib/onboarding/types'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { profile } = body as { profile: Partial<UserProfile> }

    // Update Clerk user with final profile data
    const client = await clerkClient()

    // Update public metadata to mark complete
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        onboardingCompleted: true,
        onboardingStep: 'complete',
        onboardingProgress: 100,
        onboardingCompletedAt: new Date().toISOString(),
        selectedJourney: profile.journey,
        // Store profile summary in metadata
        profileSummary: {
          journey: profile.journey,
          company: profile.founderProfile?.companyName ||
                   profile.buyerProfile?.companyName ||
                   profile.sellerProfile?.companyName ||
                   undefined,
          role: profile.role,
        }
      },
      privateMetadata: {
        // Store full profile in private metadata
        fullProfile: profile,
      }
    })

    // Update user's first and last name if provided
    if (profile.firstName || profile.lastName) {
      await client.users.updateUser(userId, {
        firstName: profile.firstName,
        lastName: profile.lastName,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully',
      redirectTo: '/dashboard'
    })
  } catch (error) {
    console.error('Error completing onboarding:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
