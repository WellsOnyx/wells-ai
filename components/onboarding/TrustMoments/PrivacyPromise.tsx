'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TRUST_MOMENT_ANIMATIONS } from '@/lib/onboarding/trust-moments'

interface PrivacyPromiseProps {
  isVisible: boolean
  onAcknowledge: () => void
  onDismiss?: () => void
}

const PRIVACY_POINTS = [
  {
    id: 'confidential',
    icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    text: 'Everything you tell me stays between us.',
    emphasis: 'confidential',
  },
  {
    id: 'negotiate',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    text: 'I negotiate on your behalf without revealing your limits.',
    emphasis: 'negotiate',
  },
  {
    id: 'protect',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    text: 'The other side never sees your budget, timeline pressure, or alternatives.',
    emphasis: 'protect',
  },
  {
    id: 'position',
    icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3',
    text: 'I protect your position.',
    emphasis: 'position',
  },
]

/**
 * Trust Moment 3: Privacy Promise
 *
 * Before asking for sensitive info, Wells explains how data is protected.
 * This builds trust through transparency about the negotiation process.
 */
export function PrivacyPromise({
  isVisible,
  onAcknowledge,
  onDismiss,
}: PrivacyPromiseProps) {
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
      if (currentIndex < PRIVACY_POINTS.length - 1) {
        setCurrentIndex((prev) => prev + 1)
      } else {
        setShowAll(true)
      }
    }, 1200)

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
          {/* Shield glow effect */}
          <motion.div
            animate={{
              opacity: [0.2, 0.4, 0.2],
              scale: [1, 1.02, 1],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute -inset-3 bg-gradient-to-b from-emerald-500/20 via-transparent to-emerald-500/10 rounded-3xl blur-xl"
          />

          {/* Main card */}
          <div className="relative bg-black/70 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="relative">
                <motion.div
                  animate={{
                    boxShadow: [
                      '0 0 0 0 rgba(16, 185, 129, 0.4)',
                      '0 0 0 8px rgba(16, 185, 129, 0)',
                    ],
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </motion.div>
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">Before we go further</h3>
                <p className="text-sm text-emerald-400">Your privacy is protected</p>
              </div>
            </div>

            {/* Privacy points */}
            <div className="space-y-3 mb-6">
              {PRIVACY_POINTS.map((point, index) => (
                <motion.div
                  key={point.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{
                    opacity: showAll || index <= currentIndex ? 1 : 0.3,
                    x: showAll || index <= currentIndex ? 0 : -10,
                  }}
                  transition={{
                    duration: 0.4,
                    delay: showAll ? 0 : index * 0.1,
                  }}
                  className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                    showAll || index <= currentIndex
                      ? 'bg-white/5'
                      : 'bg-transparent'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                      showAll || index <= currentIndex
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-white/5 text-gray-600'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={point.icon} />
                    </svg>
                  </div>
                  <p
                    className={`text-sm leading-relaxed pt-1 transition-colors ${
                      showAll || index <= currentIndex
                        ? 'text-white'
                        : 'text-gray-600'
                    }`}
                  >
                    {point.text}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Divider with lock icon */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
                <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>

            {/* Summary statement */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: showAll ? 1 : 0 }}
              className="text-center text-gray-400 text-sm mb-5"
            >
              Your negotiation strategy stays yours. Always.
            </motion.p>

            {/* Acknowledge button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: showAll ? 1 : 0, y: showAll ? 0 : 10 }}
              onClick={onAcknowledge}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-medium py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                I understand
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

export default PrivacyPromise
