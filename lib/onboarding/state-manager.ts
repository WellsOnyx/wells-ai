/**
 * Wells AI Onboarding State Manager
 *
 * Handles persistence and retrieval of onboarding state.
 * Uses Clerk metadata for quick access + database for full data.
 */

import { clerkClient } from '@clerk/nextjs/server'
import {
  OnboardingState,
  OnboardingStep,
  UserJourney,
  ONBOARDING_STEPS
} from './types'

// In-memory cache for development (replace with Redis in production)
const stateCache = new Map<string, OnboardingState>()

export class OnboardingStateManager {
  /**
   * Get current onboarding state for user
   */
  static async getState(userId: string): Promise<OnboardingState | null> {
    // Check cache first
    const cached = stateCache.get(userId)
    if (cached) return cached

    // Get from Clerk metadata
    try {
      const client = await clerkClient()
      const user = await client.users.getUser(userId)
      const meta = user.publicMetadata as Record<string, unknown>

      if (meta.onboardingStarted) {
        const state: OnboardingState = {
          userId,
          currentStep: (meta.onboardingStep as OnboardingStep) || 'welcome',
          completedSteps: (meta.completedSteps as OnboardingStep[]) || [],
          selectedJourney: meta.selectedJourney as UserJourney | undefined,
          progress: (meta.onboardingProgress as number) || 0,
          startedAt: new Date(meta.onboardingStartedAt as string || Date.now()),
          lastUpdatedAt: new Date(meta.onboardingUpdatedAt as string || Date.now()),
          completedAt: meta.onboardingCompletedAt
            ? new Date(meta.onboardingCompletedAt as string)
            : undefined
        }
        stateCache.set(userId, state)
        return state
      }
    } catch (error) {
      console.error('Error getting onboarding state:', error)
    }

    return null
  }

  /**
   * Initialize onboarding for new user
   */
  static async initialize(userId: string): Promise<OnboardingState> {
    const state: OnboardingState = {
      userId,
      currentStep: 'welcome',
      completedSteps: [],
      progress: 0,
      startedAt: new Date(),
      lastUpdatedAt: new Date(),
    }

    // Save to Clerk metadata
    try {
      const client = await clerkClient()
      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          onboardingStarted: true,
          onboardingStep: 'welcome',
          completedSteps: [],
          onboardingProgress: 0,
          onboardingStartedAt: state.startedAt.toISOString(),
          onboardingUpdatedAt: state.lastUpdatedAt.toISOString(),
        }
      })
    } catch (error) {
      console.error('Error initializing onboarding:', error)
    }

    stateCache.set(userId, state)
    return state
  }

  /**
   * Update onboarding step
   */
  static async updateStep(
    userId: string,
    currentStep: OnboardingStep,
    completedSteps: OnboardingStep[],
    journey?: UserJourney
  ): Promise<void> {
    const progress = this.calculateProgress(completedSteps)

    // Update Clerk metadata
    try {
      const client = await clerkClient()
      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          onboardingStarted: true,
          onboardingStep: currentStep,
          completedSteps,
          selectedJourney: journey,
          onboardingProgress: progress,
          onboardingUpdatedAt: new Date().toISOString(),
        }
      })
    } catch (error) {
      console.error('Error updating onboarding step:', error)
    }

    // Update cache
    const existing = stateCache.get(userId)
    if (existing) {
      stateCache.set(userId, {
        ...existing,
        currentStep,
        completedSteps,
        selectedJourney: journey || existing.selectedJourney,
        progress,
        lastUpdatedAt: new Date()
      })
    }
  }

  /**
   * Mark onboarding as complete
   */
  static async complete(userId: string): Promise<void> {
    try {
      const client = await clerkClient()
      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          onboardingCompleted: true,
          onboardingStep: 'complete',
          onboardingProgress: 100,
          onboardingCompletedAt: new Date().toISOString(),
        }
      })
    } catch (error) {
      console.error('Error completing onboarding:', error)
    }

    // Update cache
    const existing = stateCache.get(userId)
    if (existing) {
      stateCache.set(userId, {
        ...existing,
        currentStep: 'complete',
        progress: 100,
        completedAt: new Date()
      })
    }
  }

  /**
   * Calculate progress percentage
   */
  static calculateProgress(completedSteps: OnboardingStep[]): number {
    const totalSteps = ONBOARDING_STEPS.length - 1 // Exclude 'complete'
    return Math.round((completedSteps.length / totalSteps) * 100)
  }

  /**
   * Get next step in flow
   */
  static getNextStep(currentStep: OnboardingStep): OnboardingStep {
    const currentIndex = ONBOARDING_STEPS.indexOf(currentStep)
    return ONBOARDING_STEPS[currentIndex + 1] || 'complete'
  }

  /**
   * Get previous step in flow
   */
  static getPreviousStep(currentStep: OnboardingStep): OnboardingStep | null {
    const currentIndex = ONBOARDING_STEPS.indexOf(currentStep)
    if (currentIndex <= 0) return null
    return ONBOARDING_STEPS[currentIndex - 1]
  }

  /**
   * Check if user has completed onboarding
   */
  static async isComplete(userId: string): Promise<boolean> {
    try {
      const client = await clerkClient()
      const user = await client.users.getUser(userId)
      return user.publicMetadata?.onboardingCompleted === true
    } catch {
      return false
    }
  }
}
