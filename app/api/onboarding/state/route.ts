/**
 * Onboarding State API
 *
 * GET - Retrieve current onboarding state
 * POST - Update onboarding state (step, progress, journey)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { OnboardingStep, UserJourney, ONBOARDING_STEPS } from '@/lib/onboarding/types'

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const meta = user.publicMetadata as Record<string, unknown>

    // If onboarding not started, return default state
    if (!meta.onboardingStarted) {
      return NextResponse.json({
        state: {
          userId,
          currentStep: 'welcome',
          completedSteps: [],
          progress: 0,
          startedAt: new Date().toISOString(),
        }
      })
    }

    // Return existing state
    return NextResponse.json({
      state: {
        userId,
        currentStep: meta.onboardingStep || 'welcome',
        completedSteps: meta.completedSteps || [],
        selectedJourney: meta.selectedJourney,
        progress: meta.onboardingProgress || 0,
        startedAt: meta.onboardingStartedAt,
        lastUpdatedAt: meta.onboardingUpdatedAt,
        completedAt: meta.onboardingCompletedAt,
      }
    })
  } catch (error) {
    console.error('Error fetching onboarding state:', error)
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
    const {
      currentStep,
      completedSteps,
      selectedJourney
    } = body as {
      currentStep: OnboardingStep
      completedSteps: OnboardingStep[]
      selectedJourney?: UserJourney
    }

    // Calculate progress
    const totalSteps = ONBOARDING_STEPS.length - 1 // Exclude 'complete'
    const progress = Math.round((completedSteps.length / totalSteps) * 100)

    // Update Clerk metadata
    const client = await clerkClient()
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        onboardingStarted: true,
        onboardingStep: currentStep,
        completedSteps,
        selectedJourney,
        onboardingProgress: progress,
        onboardingUpdatedAt: new Date().toISOString(),
        ...(completedSteps.length === 0 && { onboardingStartedAt: new Date().toISOString() }),
      }
    })

    return NextResponse.json({
      success: true,
      progress
    })
  } catch (error) {
    console.error('Error updating onboarding state:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
