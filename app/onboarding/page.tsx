'use client'

import { useEffect, useState, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import {
  OnboardingStep,
  UserJourney,
  ONBOARDING_STEPS,
  UserProfile,
  FounderProfile,
  BuyerProfile,
  SellerProfile,
  JobsProfile
} from '@/lib/onboarding/types'

// Step Components
import { WelcomeStep } from '@/components/onboarding/steps/WelcomeStep'
import { JourneyStep } from '@/components/onboarding/steps/JourneyStep'
import { ProfileBasicStep } from '@/components/onboarding/steps/ProfileBasicStep'
import { ProfileExtendedStep } from '@/components/onboarding/steps/ProfileExtendedStep'
import { IntegrationsStep } from '@/components/onboarding/steps/IntegrationsStep'
import { TreasuryStep } from '@/components/onboarding/steps/TreasuryStep'
import { CompleteStep } from '@/components/onboarding/steps/CompleteStep'

export default function OnboardingPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  // Onboarding state
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome')
  const [completedSteps, setCompletedSteps] = useState<OnboardingStep[]>([])
  const [selectedJourney, setSelectedJourney] = useState<UserJourney | null>(null)

  // Profile data
  const [profile, setProfile] = useState<Partial<UserProfile>>({})
  const [isLoading, setIsLoading] = useState(true)

  // Load existing state from Clerk metadata
  useEffect(() => {
    if (!isLoaded || !user) return

    const meta = user.publicMetadata as Record<string, unknown>

    // Check if already completed
    if (meta.onboardingCompleted) {
      router.push('/dashboard')
      return
    }

    // Restore state
    if (meta.onboardingStarted) {
      setCurrentStep((meta.onboardingStep as OnboardingStep) || 'welcome')
      setCompletedSteps((meta.completedSteps as OnboardingStep[]) || [])
      setSelectedJourney((meta.selectedJourney as UserJourney) || null)
    }

    // Pre-fill profile from Clerk
    setProfile({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.primaryEmailAddress?.emailAddress || '',
      avatarUrl: user.imageUrl,
    })

    setIsLoading(false)
  }, [isLoaded, user, router])

  // Save state to Clerk
  const saveState = useCallback(async (
    step: OnboardingStep,
    completed: OnboardingStep[],
    journey?: UserJourney
  ) => {
    if (!user) return

    try {
      await fetch('/api/onboarding/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStep: step,
          completedSteps: completed,
          selectedJourney: journey || selectedJourney
        })
      })
    } catch (error) {
      console.error('Error saving state:', error)
    }
  }, [user, selectedJourney])

  // Navigate to next step
  const goToNextStep = useCallback(() => {
    const currentIndex = ONBOARDING_STEPS.indexOf(currentStep)
    const nextStep = ONBOARDING_STEPS[currentIndex + 1]

    if (nextStep) {
      const newCompleted = [...completedSteps, currentStep]
      setCompletedSteps(newCompleted)
      setCurrentStep(nextStep)
      saveState(nextStep, newCompleted)
    }
  }, [currentStep, completedSteps, saveState])

  // Navigate to previous step
  const goToPreviousStep = useCallback(() => {
    const currentIndex = ONBOARDING_STEPS.indexOf(currentStep)
    if (currentIndex > 0) {
      const prevStep = ONBOARDING_STEPS[currentIndex - 1]
      setCurrentStep(prevStep)
    }
  }, [currentStep])

  // Handle journey selection
  const handleJourneySelect = useCallback((journey: UserJourney) => {
    setSelectedJourney(journey)
    setProfile(prev => ({ ...prev, journey }))
    goToNextStep()
    saveState(ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(currentStep) + 1], [...completedSteps, currentStep], journey)
  }, [currentStep, completedSteps, goToNextStep, saveState])

  // Handle profile updates
  const handleProfileUpdate = useCallback((updates: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...updates }))
  }, [])

  // Complete onboarding
  const completeOnboarding = useCallback(async () => {
    try {
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile })
      })
      router.push('/dashboard')
    } catch (error) {
      console.error('Error completing onboarding:', error)
    }
  }, [profile, router])

  // Loading state
  if (isLoading || !isLoaded) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return <WelcomeStep onContinue={goToNextStep} />

      case 'journey':
        return <JourneyStep onSelect={handleJourneySelect} />

      case 'profile-basic':
        return (
          <ProfileBasicStep
            profile={profile}
            onUpdate={handleProfileUpdate}
            onContinue={goToNextStep}
          />
        )

      case 'profile-extended':
        return (
          <ProfileExtendedStep
            journey={selectedJourney!}
            profile={profile}
            onUpdate={handleProfileUpdate}
            onContinue={goToNextStep}
          />
        )

      case 'integrations':
        return (
          <IntegrationsStep
            onContinue={goToNextStep}
            onSkip={goToNextStep}
          />
        )

      case 'treasury':
        return (
          <TreasuryStep
            onContinue={goToNextStep}
            onSkip={goToNextStep}
          />
        )

      case 'complete':
        return (
          <CompleteStep
            journey={selectedJourney!}
            profile={profile}
            onComplete={completeOnboarding}
          />
        )

      default:
        return null
    }
  }

  return (
    <OnboardingLayout
      currentStep={currentStep}
      onBack={currentStep !== 'welcome' ? goToPreviousStep : undefined}
      showProgress={currentStep !== 'welcome' && currentStep !== 'complete'}
    >
      {renderStep()}
    </OnboardingLayout>
  )
}
