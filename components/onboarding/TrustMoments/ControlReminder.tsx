'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TRUST_MOMENT_ANIMATIONS } from '@/lib/onboarding/trust-moments'

interface ControlReminderProps {
  isVisible: boolean
  onAcknowledge: () => void
  onDismiss?: () => void
}

const CONTROL_POINTS = [
  {
    id: 'control',
    text: "One more thing - you're always in control.",
    isHeader: true,
  },
  {
    id: 'commit',
    text: "I'll never commit you to anything without your approval.",
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    id: 'decisions',
    text: 'Big decisions come back to you. I just do the legwork.',
    icon: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2',
  },
]

/**
 * Trust Moment 7: Control Reminder
 *
 * Reassure users they maintain control over all decisions.
 */
export function ControlReminder({
  isVisible,
  onAcknowledge,
  onDismiss,
}: ControlReminderProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAll, setShowAll] = useState(false)

  // Reset on show
  useEffect(() => {
    if (isVisible) {
      setCurrentIndex(0)
      setShowAll(false)
    }
  }, [isVisible])

  // Animate through points
  useEffect(() => {
    if (!isVisible || showAll) return

    const timer = setTimeout(() => {
      if (currentIndex < CONTROL_POINTS.length - 1) {
        setCurrentIndex((prev) => prev + 1)
      } else {
        setShowAll(true)
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [currentIndex, isVisible, showAll])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{
            duration: TRUST_MOMENT_ANIMATIONS.enter.duration / 1000,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="relative"
        >
          {/* Blue trust glow */}
          <motion.div
            animate={{ opacity: [0.2, 0.35, 0.2] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute -inset-2 bg-gradient-to-b from-blue-500/15 via-cyan-500/10 to-transparent rounded-2xl blur-xl"
          />

          {/* Main card */}
          <div className="relative bg-black/60 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="relative">
                <motion.div
                  animate={{
                    scale: [1, 1.05, 1],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </motion.div>
              </div>
              <div>
                <h3 className="text-white font-semibold">You&apos;re In Charge</h3>
                <span className="text-xs text-blue-400/80">Your decisions, your pace</span>
              </div>
            </div>

            {/* Control points */}
            <div className="space-y-4 mb-6">
              {CONTROL_POINTS.map((point, index) => (
                <motion.div
                  key={point.id}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{
                    opacity: showAll || index <= currentIndex ? 1 : 0.3,
                    x: showAll || index <= currentIndex ? 0 : -10,
                  }}
                  transition={{ duration: 0.4 }}
                  className={point.isHeader ? '' : 'flex items-start gap-3'}
                >
                  {point.isHeader ? (
                    <p className="text-white text-lg font-medium">{point.text}</p>
                  ) : (
                    <>
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                          showAll || index <= currentIndex
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-white/5 text-gray-600'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={point.icon} />
                        </svg>
                      </div>
                      <p
                        className={`text-sm leading-relaxed pt-1.5 transition-colors ${
                          showAll || index <= currentIndex ? 'text-white/90' : 'text-gray-600'
                        }`}
                      >
                        {point.text}
                      </p>
                    </>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Visual: Control dial */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: showAll ? 1 : 0, scale: showAll ? 1 : 0.9 }}
              transition={{ duration: 0.5 }}
              className="flex justify-center mb-5"
            >
              <div className="relative w-20 h-20">
                {/* Outer ring */}
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="6"
                  />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="url(#controlGradient)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray="283"
                    initial={{ strokeDashoffset: 283 }}
                    animate={{ strokeDashoffset: 0 }}
                    transition={{ duration: 1.5, delay: 0.5, ease: 'easeOut' }}
                    transform="rotate(-90 50 50)"
                  />
                  <defs>
                    <linearGradient id="controlGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#06B6D4" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* Center icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                    className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </motion.div>
                </div>
              </div>
            </motion.div>

            {/* Acknowledge button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: showAll ? 1 : 0, y: showAll ? 0 : 10 }}
              onClick={onAcknowledge}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-medium py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Let&apos;s get started
              </span>
            </motion.button>

            {/* Dismiss button */}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ControlReminder
