'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTrustMoments, TrustMomentsContainer, type TrustMomentType } from './index'

/**
 * TrustMomentsDemo
 *
 * Demo component to test and showcase all trust moments.
 * Use this to preview each moment during development.
 */
export function TrustMomentsDemo() {
  const {
    activeMoment,
    isVisible,
    showMoment,
    dismissMoment,
    hideMoment,
    reset,
    getProgress,
  } = useTrustMoments()

  const [userInput, setUserInput] = useState(
    'I need eco-friendly packaging for cosmetics, about 10K units, within 30 days'
  )

  const moments: { id: TrustMomentType; label: string; color: string }[] = [
    { id: 'instant-understanding', label: 'Instant Understanding', color: 'from-amber-500 to-orange-500' },
    { id: 'speed-demo', label: 'Speed Demo', color: 'from-cyan-500 to-blue-500' },
    { id: 'privacy-promise', label: 'Privacy Promise', color: 'from-emerald-500 to-green-500' },
    { id: 'ai-to-ai-explainer', label: 'AI-to-AI Explainer', color: 'from-violet-500 to-purple-500' },
    { id: 'live-activity', label: 'Live Activity', color: 'from-green-500 to-cyan-500' },
    { id: 'honesty-moment', label: 'Honesty Moment', color: 'from-amber-500 to-yellow-500' },
    { id: 'control-reminder', label: 'Control Reminder', color: 'from-blue-500 to-cyan-500' },
  ]

  const progress = getProgress()

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
            Trust Moments Demo
          </h1>
          <p className="text-gray-400">
            Preview each trust-building moment in the Wells AI onboarding flow.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8 p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Trust Moments Progress</span>
            <span className="text-sm text-amber-400 font-medium">
              {progress.shown} / {progress.total} shown
            </span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress.percentage}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <button
            onClick={reset}
            className="mt-3 text-xs text-gray-500 hover:text-white transition-colors"
          >
            Reset all moments
          </button>
        </div>

        {/* Test Input */}
        <div className="mb-8 p-4 bg-white/5 rounded-xl border border-white/10">
          <label className="block text-sm text-gray-400 mb-2">
            Test User Input (for Instant Understanding)
          </label>
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 resize-none"
            rows={3}
            placeholder="Describe your needs..."
          />
        </div>

        {/* Moment Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {moments.map((moment) => (
            <button
              key={moment.id}
              onClick={() => showMoment(moment.id)}
              className={`
                relative p-4 rounded-xl border border-white/10
                bg-gradient-to-br ${moment.color} bg-opacity-10
                hover:border-white/20 transition-all group overflow-hidden
              `}
            >
              {/* Background gradient on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${moment.color} opacity-0 group-hover:opacity-10 transition-opacity`} />

              <span className="relative text-sm font-medium text-white">
                {moment.label}
              </span>

              {/* Active indicator */}
              {activeMoment === moment.id && (
                <motion.span
                  layoutId="activeMoment"
                  className="absolute bottom-2 right-2 w-2 h-2 bg-green-500 rounded-full"
                />
              )}
            </button>
          ))}
        </div>

        {/* Info Card */}
        <div className="p-6 bg-white/5 rounded-xl border border-white/10">
          <h3 className="text-lg font-semibold mb-4 text-amber-400">
            Integration Guide
          </h3>
          <div className="space-y-4 text-sm text-gray-400">
            <div>
              <code className="text-cyan-400 bg-black/40 px-2 py-1 rounded">
                useTrustMoments()
              </code>
              <p className="mt-1">
                Hook to manage trust moment state. Returns methods to show, dismiss, and track moments.
              </p>
            </div>
            <div>
              <code className="text-cyan-400 bg-black/40 px-2 py-1 rounded">
                triggerMoment(&apos;before-sensitive-info&apos;)
              </code>
              <p className="mt-1">
                Automatically shows the best moment for a given trigger context.
              </p>
            </div>
            <div>
              <code className="text-cyan-400 bg-black/40 px-2 py-1 rounded">
                TrustMomentsContainer
              </code>
              <p className="mt-1">
                Drop-in component that renders the active trust moment with backdrop.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Moments Container */}
      <TrustMomentsContainer
        activeMoment={activeMoment}
        isVisible={isVisible}
        onDismiss={dismissMoment}
        onComplete={hideMoment}
        userInput={userInput}
        category="cosmetics packaging"
      />
    </div>
  )
}

export default TrustMomentsDemo
