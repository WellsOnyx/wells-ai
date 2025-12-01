'use client'

/**
 * Subtle onboarding progress indicator
 *
 * Shows progress without being intrusive.
 * Think: Ghost's light in Destiny - always there, but not demanding attention.
 */

import { OnboardingState, getOnboardingProgress, ONBOARDING_MILESTONES } from '@/lib/onboarding'

interface OnboardingProgressProps {
  state: OnboardingState
}

export default function OnboardingProgress({ state }: OnboardingProgressProps) {
  const progress = getOnboardingProgress(state)
  const phaseNames = {
    introduction: 'Getting to know you',
    first_win: 'Proving value',
    integration: 'Connecting systems',
    relationship: 'Building partnership',
    complete: 'Full companion'
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      {/* Progress bar - very subtle */}
      <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">
            {phaseNames[state.phase]}
          </span>
          <span className="text-xs text-gray-400">
            {progress}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Trust score indicator - subtle */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          <div className="flex-1">
            <div className="text-xs text-gray-500 mb-1">Trust</div>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full ${
                    i < Math.ceil(state.trustScore / 20)
                      ? 'bg-blue-500'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">Depth</div>
            <div className="text-sm font-medium text-gray-700">
              {state.conversationDepth}/10
            </div>
          </div>
        </div>

        {/* Recent milestones - celebrate! */}
        {state.milestones.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-2">Milestones</div>
            <div className="space-y-1">
              {state.milestones.slice(-3).map(milestoneId => {
                const milestone = ONBOARDING_MILESTONES[milestoneId]
                return milestone ? (
                  <div
                    key={milestoneId}
                    className="text-xs text-gray-600 flex items-center gap-2"
                  >
                    <span className="text-green-500">✓</span>
                    <span>{milestone.title}</span>
                  </div>
                ) : null
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
