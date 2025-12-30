/**
 * Join Complete API
 *
 * Saves user signup data and journey routing info to Clerk metadata
 * and optionally to the database for server-side access.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { JourneyType, UserRole, UserNeed } from '@/lib/routing/journey-router'

interface JoinCompleteRequest {
  email: string
  companyName?: string
  role: UserRole
  needs: UserNeed[]
  erpSystem?: string
  primaryJourney: JourneyType
  activeJourneys: JourneyType[]
  referralCode?: string
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const body: JoinCompleteRequest = await request.json()

    // Validate required fields
    if (!body.email || !body.role || !body.needs || body.needs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Update Clerk metadata with user context
    const client = await clerkClient()
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        // Onboarding state
        onboardingStarted: true,
        onboardingStep: 'complete',
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),

        // User context
        companyName: body.companyName,
        role: body.role,
        needs: body.needs,
        erpSystem: body.erpSystem,
        erpConnected: body.erpSystem && body.erpSystem !== 'none' && body.erpSystem !== 'wells_native',

        // Journey routing
        selectedJourney: body.primaryJourney, // For backwards compatibility
        primaryJourney: body.primaryJourney,
        activeJourneys: body.activeJourneys,

        // Referral tracking
        referralCode: body.referralCode,
        signupCompletedAt: new Date().toISOString(),
      },
      privateMetadata: {
        // Store sensitive info in private metadata
        signupEmail: body.email,
        signupTimestamp: new Date().toISOString(),
      }
    })

    // TODO: Also save to database for server-side queries
    // This would involve creating a users table or updating an existing one
    // For now, we rely on Clerk metadata

    // If there's a referral code, track it
    if (body.referralCode) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/referrals/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referralCode: body.referralCode,
            referredUserId: userId,
            referredEmail: body.email,
          }),
        })
      } catch (e) {
        // Don't fail signup if referral tracking fails
        console.error('Failed to track referral:', e)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Join completed successfully',
      data: {
        userId,
        primaryJourney: body.primaryJourney,
        activeJourneys: body.activeJourneys,
        nextRoute: getNextRoute(body.primaryJourney, body.erpSystem),
      }
    })

  } catch (error) {
    console.error('Join complete error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to complete join' },
      { status: 500 }
    )
  }
}

function getNextRoute(primaryJourney: JourneyType, erpSystem?: string): string {
  // If using WellsAI as ERP or no ERP, go straight to dashboard
  if (!erpSystem || erpSystem === 'none' || erpSystem === 'wells_native') {
    return '/dashboard'
  }

  // If they selected an ERP to connect, route to integrations
  if (primaryJourney === 'treasury') {
    return '/settings/integrations?focus=erp'
  }

  return '/dashboard'
}
