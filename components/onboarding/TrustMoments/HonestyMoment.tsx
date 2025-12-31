'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TRUST_MOMENT_ANIMATIONS } from '@/lib/onboarding/trust-moments'

interface HonestyMomentProps {
  isVisible: boolean
  onAcknowledge: () => void
  onDismiss?: () => void
}

const HONESTY_POINTS = [
  {
    id: 'help',
    text: "If I can't help you, I'll tell you.",
    icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    id: 'waste',
    text: "I won't waste your time with bad matches or impossible deals.",
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    id: 'straight',
    text: "If something's outside my capabilities, I'll be straight with you.",
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
]

/**
 * Trust Moment 6: The Guarantee
 *
 * Honesty builds trust. Wells admits its limitations upfront.
 */
export function HonestyMoment({
  isVisible,
  onAcknowledge,
  onDismiss,
}: HonestyMomentProps) {
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
      if (currentIndex < HONESTY_POINTS.length - 1) {
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
          {/* Subtle warm glow */}
          <motion.div
            animate={{ opacity: [0.2, 0.35, 0.2] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute -inset-2 bg-gradient-to-b from-amber-500/15 via-orange-500/10 to-transparent rounded-2xl blur-xl"
          />

          {/* Main card */}
          <div className="relative bg-black/60 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400/80 to-orange-500/80 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold">My Promise</h3>
                <span className="text-xs text-amber-400/80">Straight talk</span>
              </div>
            </div>

            {/* Honesty points */}
            <div className="space-y-3 mb-6">
              {HONESTY_POINTS.map((point, index) => (
                <motion.div
                  key={point.id}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{
                    opacity: showAll || index <= currentIndex ? 1 : 0.3,
                    x: showAll || index <= currentIndex ? 0 : -10,
                  }}
                  transition={{ duration: 0.4 }}
                  className="flex items-start gap-3"
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                      showAll || index <= currentIndex
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-white/5 text-gray-600'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={point.icon} />
                    </svg>
                  </div>
                  <p
                    className={`text-sm leading-relaxed pt-1.5 transition-colors ${
                      showAll || index <= currentIndex ? 'text-white' : 'text-gray-600'
                    }`}
                  >
                    {point.text}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Signature line */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: showAll ? 1 : 0, scaleX: showAll ? 1 : 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-3 mb-5"
            >
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
              <span className="text-xs text-gray-500 italic">No fine print</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
            </motion.div>

            {/* Acknowledge button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: showAll ? 1 : 0, y: showAll ? 0 : 10 }}
              onClick={onAcknowledge}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-500/30 text-white font-medium py-3 px-4 rounded-xl transition-all"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
                I appreciate that
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

export default HonestyMoment
