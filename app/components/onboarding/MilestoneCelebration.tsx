'use client'

/**
 * Milestone celebration component
 *
 * Shows when user achieves a milestone.
 * Brief, joyful, then disappears.
 */

import { useEffect, useState } from 'react'
import { OnboardingMilestone } from '@/lib/onboarding'

interface MilestoneCelebrationProps {
  milestone: OnboardingMilestone
  onDismiss: () => void
}

export default function MilestoneCelebration({
  milestone,
  onDismiss
}: MilestoneCelebrationProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Fade in
    setTimeout(() => setVisible(true), 100)

    // Auto-dismiss after 4 seconds
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300)
    }, 4000)

    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 transition-all duration-300 ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
    >
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md border border-gray-100">
        {/* Celebration icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        {/* Milestone info */}
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {milestone.title}
          </h3>
          <p className="text-gray-600 mb-4">
            {milestone.description}
          </p>

          {/* Trust bonus */}
          {milestone.trustScoreBonus > 0 && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full">
              <span className="text-blue-600 text-sm font-medium">
                +{milestone.trustScoreBonus} Trust
              </span>
            </div>
          )}

          {/* Unlocks */}
          {milestone.unlocks && milestone.unlocks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="text-xs text-gray-500 mb-2">Unlocked:</div>
              <div className="space-y-1">
                {milestone.unlocks.map(unlock => (
                  <div
                    key={unlock}
                    className="text-sm text-gray-700 flex items-center justify-center gap-2"
                  >
                    <span>🔓</span>
                    <span>{unlock.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 -z-10"
        onClick={() => {
          setVisible(false)
          setTimeout(onDismiss, 300)
        }}
      />
    </div>
  )
}
