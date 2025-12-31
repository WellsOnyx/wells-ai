'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  generateLiveActivity,
  TRUST_MOMENT_ANIMATIONS,
  type LiveActivityItem,
} from '@/lib/onboarding/trust-moments'

interface LiveActivityProps {
  isVisible: boolean
  onDismiss?: () => void
  autoHideAfter?: number // ms to auto-hide
}

/**
 * Trust Moment 5: Social Proof (subtle)
 *
 * Not testimonials - instead, real-time-ish activity that shows Wells is WORKING.
 * "Last week, I helped 47 buyers save an average of 18% on their orders."
 * "Right now, I'm negotiating 12 deals. 3 just closed in the last hour."
 */
export function LiveActivity({
  isVisible,
  onDismiss,
  autoHideAfter = 6000,
}: LiveActivityProps) {
  const [activity, setActivity] = useState<LiveActivityItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAll, setShowAll] = useState(false)

  // Generate activity on mount
  useEffect(() => {
    if (isVisible) {
      setActivity(generateLiveActivity())
      setCurrentIndex(0)
      setShowAll(false)
    }
  }, [isVisible])

  // Animate through items
  useEffect(() => {
    if (!isVisible || activity.length === 0) return

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev < activity.length - 1) {
          return prev + 1
        } else {
          setShowAll(true)
          return prev
        }
      })
    }, 1200)

    return () => clearInterval(timer)
  }, [isVisible, activity])

  // Auto-hide
  useEffect(() => {
    if (!isVisible || !onDismiss || !autoHideAfter) return

    const timer = setTimeout(() => {
      onDismiss()
    }, autoHideAfter)

    return () => clearTimeout(timer)
  }, [isVisible, onDismiss, autoHideAfter])

  const getIcon = (type: LiveActivityItem['type']) => {
    switch (type) {
      case 'deals_closed':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'savings':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'negotiations_active':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )
      case 'matches_made':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )
    }
  }

  const getColor = (type: LiveActivityItem['type']) => {
    switch (type) {
      case 'deals_closed':
        return 'text-green-400 bg-green-500/20'
      case 'savings':
        return 'text-amber-400 bg-amber-500/20'
      case 'negotiations_active':
        return 'text-blue-400 bg-blue-500/20'
      case 'matches_made':
        return 'text-cyan-400 bg-cyan-500/20'
    }
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -5, scale: 0.98 }}
          transition={{
            duration: TRUST_MOMENT_ANIMATIONS.enter.duration / 1000,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="relative"
        >
          {/* Subtle pulsing glow */}
          <motion.div
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -inset-1 bg-gradient-to-r from-green-500/10 via-amber-500/10 to-blue-500/10 rounded-xl blur-lg"
          />

          {/* Main card - more compact */}
          <div className="relative bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 shadow-xl">
            {/* Live indicator */}
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-xs text-gray-400 font-medium">Wells is active</span>
            </div>

            {/* Activity items - grid layout */}
            <div className="grid grid-cols-2 gap-2">
              {activity.map((item, index) => (
                <motion.div
                  key={item.type}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{
                    opacity: showAll || index <= currentIndex ? 1 : 0.3,
                    scale: showAll || index <= currentIndex ? 1 : 0.95,
                  }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-2 bg-white/5 rounded-lg px-2.5 py-2"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${getColor(item.type)}`}>
                    {getIcon(item.type)}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-white block">{item.metric}</span>
                    <span className="text-xs text-gray-500 block truncate">{item.timeframe}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Auto-dismiss indicator */}
            {autoHideAfter && (
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: autoHideAfter / 1000, ease: 'linear' }}
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500/50 to-amber-500/0 origin-left rounded-b-xl"
              />
            )}

            {/* Dismiss button */}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="absolute top-2 right-2 text-gray-600 hover:text-white transition-colors p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

export default LiveActivity
