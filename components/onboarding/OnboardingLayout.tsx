'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { OnboardingStep, ONBOARDING_STEPS, STEP_CONFIG } from '@/lib/onboarding/types'

interface OnboardingLayoutProps {
  children: React.ReactNode
  currentStep: OnboardingStep
  onBack?: () => void
  showProgress?: boolean
}

export function OnboardingLayout({
  children,
  currentStep,
  onBack,
  showProgress = true
}: OnboardingLayoutProps) {
  const router = useRouter()
  const currentIndex = ONBOARDING_STEPS.indexOf(currentStep)
  const progress = Math.round((currentIndex / (ONBOARDING_STEPS.length - 1)) * 100)

  return (
    <div className="min-h-screen text-white flex flex-col">
      {/* Header with Progress */}
      {showProgress && currentStep !== 'welcome' && (
        <header className="border-b border-white/10 bg-navy-900/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              {/* Back Button */}
              {onBack && currentIndex > 0 && (
                <button
                  onClick={onBack}
                  className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              )}

              {/* Step Info */}
              <div className="text-right">
                <span className="text-sm text-gray-400">
                  Step {currentIndex + 1} of {ONBOARDING_STEPS.length}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold-400 to-gold-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Step Title */}
            <div className="mt-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {STEP_CONFIG[currentStep].title}
              </h2>
              <span className="text-sm text-gray-400">
                {STEP_CONFIG[currentStep].description}
              </span>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-4 text-center text-sm text-gray-500">
        <p>Secure onboarding powered by Wells AI</p>
      </footer>
    </div>
  )
}

// Progress Ring Component
export function ProgressRing({ progress, size = 120 }: { progress: number; size?: number }) {
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          className="text-white/10"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress circle */}
        <circle
          className="text-gold-500 transition-all duration-500 ease-out"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-white">{progress}%</span>
      </div>
    </div>
  )
}
