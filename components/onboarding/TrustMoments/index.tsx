'use client'

/**
 * Wells AI Trust Moments Components
 *
 * Trust-building moments throughout onboarding that make users think
 * "wow, this is different."
 *
 * Each component is a subtle "aside" from Wells with unique visual treatment.
 */

import { AnimatePresence } from 'framer-motion'

// Import types and utilities from the orchestration module
import {
  useTrustMoments,
  TrustMomentManager,
  TRUST_MOMENTS,
  TRUST_MOMENT_ANIMATIONS,
  parseUserInput,
  generateReflection,
  generateLiveActivity,
  generateSpeedDemoStages,
  type TrustMomentType,
  type TrustMomentTrigger,
  type TrustMoment,
  type TrustMomentState,
  type UserInputSummary,
  type LiveActivityItem,
  type SpeedDemoStage,
} from '@/lib/onboarding/trust-moments'

// Import individual trust moment components
import { InstantUnderstanding } from './InstantUnderstanding'
import { SpeedDemo } from './SpeedDemo'
import { PrivacyPromise } from './PrivacyPromise'
import { AItoAIExplainer } from './AItoAIExplainer'
import { LiveActivity } from './LiveActivity'
import { HonestyMoment } from './HonestyMoment'
import { ControlReminder } from './ControlReminder'

// Re-export all components
export {
  InstantUnderstanding,
  SpeedDemo,
  PrivacyPromise,
  AItoAIExplainer,
  LiveActivity,
  HonestyMoment,
  ControlReminder,
}

// Re-export types and utilities
export {
  useTrustMoments,
  TrustMomentManager,
  TRUST_MOMENTS,
  TRUST_MOMENT_ANIMATIONS,
  parseUserInput,
  generateReflection,
  generateLiveActivity,
  generateSpeedDemoStages,
  type TrustMomentType,
  type TrustMomentTrigger,
  type TrustMoment,
  type TrustMomentState,
  type UserInputSummary,
  type LiveActivityItem,
  type SpeedDemoStage,
}

/**
 * Composite TrustMomentsContainer component
 * Handles rendering the active trust moment based on state
 */
interface TrustMomentsContainerProps {
  activeMoment: TrustMomentType | null
  isVisible: boolean
  onDismiss: () => void
  onComplete: () => void
  // Props for specific moments
  userInput?: string
  category?: string
}

export function TrustMomentsContainer({
  activeMoment,
  isVisible,
  onDismiss,
  onComplete,
  userInput = '',
  category,
}: TrustMomentsContainerProps) {
  const renderMoment = () => {
    switch (activeMoment) {
      case 'instant-understanding':
        return (
          <InstantUnderstanding
            userInput={userInput}
            isVisible={isVisible}
            onConfirm={onComplete}
            onCorrect={(correction) => {
              console.log('Correction:', correction)
              onComplete()
            }}
            onDismiss={onDismiss}
          />
        )
      case 'speed-demo':
        return (
          <SpeedDemo
            isVisible={isVisible}
            category={category}
            onComplete={onComplete}
            onDismiss={onDismiss}
          />
        )
      case 'privacy-promise':
        return (
          <PrivacyPromise
            isVisible={isVisible}
            onAcknowledge={onComplete}
            onDismiss={onDismiss}
          />
        )
      case 'ai-to-ai-explainer':
        return (
          <AItoAIExplainer
            isVisible={isVisible}
            onContinue={onComplete}
            onDismiss={onDismiss}
          />
        )
      case 'live-activity':
        return (
          <LiveActivity
            isVisible={isVisible}
            onDismiss={onDismiss}
            autoHideAfter={6000}
          />
        )
      case 'honesty-moment':
        return (
          <HonestyMoment
            isVisible={isVisible}
            onAcknowledge={onComplete}
            onDismiss={onDismiss}
          />
        )
      case 'control-reminder':
        return (
          <ControlReminder
            isVisible={isVisible}
            onAcknowledge={onComplete}
            onDismiss={onDismiss}
          />
        )
      default:
        return null
    }
  }

  return (
    <AnimatePresence mode="wait">
      {activeMoment && isVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onDismiss}
          />
          {/* Content */}
          <div className="relative z-10 w-full max-w-md">
            {renderMoment()}
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default TrustMomentsContainer
