'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  generateSpeedDemoStages,
  TRUST_MOMENT_ANIMATIONS,
  type SpeedDemoStage,
} from '@/lib/onboarding/trust-moments'

interface SpeedDemoProps {
  isVisible: boolean
  category?: string
  onComplete: () => void
  onDismiss?: () => void
}

/**
 * Trust Moment 2: The Speed Demo
 *
 * Show how fast Wells works. User mentions a need,
 * Wells immediately shows animated progress:
 * "Searching 2,847 suppliers..." -> "Found 23 matches" -> "Analyzing..." -> "Top 3 ready"
 */
export function SpeedDemo({
  isVisible,
  category,
  onComplete,
  onDismiss,
}: SpeedDemoProps) {
  const [stages, setStages] = useState<SpeedDemoStage[]>([])
  const [currentStageIndex, setCurrentStageIndex] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [progress, setProgress] = useState(0)

  // Generate stages on mount
  useEffect(() => {
    if (isVisible) {
      setStages(generateSpeedDemoStages(category))
      setCurrentStageIndex(0)
      setIsComplete(false)
      setProgress(0)
    }
  }, [isVisible, category])

  // Progress through stages
  useEffect(() => {
    if (!isVisible || stages.length === 0) return

    const currentStage = stages[currentStageIndex]
    if (!currentStage) return

    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const stageProgress = ((currentStageIndex + 1) / stages.length) * 100
        const nextProgress = Math.min(prev + 2, stageProgress)
        return nextProgress
      })
    }, currentStage.duration / 50)

    // Move to next stage
    const timer = setTimeout(() => {
      if (currentStageIndex < stages.length - 1) {
        setCurrentStageIndex((prev) => prev + 1)
      } else {
        setIsComplete(true)
        setProgress(100)
        setTimeout(onComplete, 1500)
      }
    }, currentStage.duration)

    return () => {
      clearInterval(progressInterval)
      clearTimeout(timer)
    }
  }, [currentStageIndex, stages, isVisible, onComplete])

  const currentStage = stages[currentStageIndex]

  const getIcon = (iconType: SpeedDemoStage['icon']) => {
    switch (iconType) {
      case 'search':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )
      case 'filter':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        )
      case 'analyze':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        )
      case 'check':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

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
          {/* Animated glow effect */}
          <motion.div
            animate={{
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute -inset-2 bg-gradient-to-r from-cyan-500/20 via-amber-500/20 to-cyan-500/20 rounded-2xl blur-xl"
          />

          {/* Main card */}
          <div className="relative bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden">
            {/* Scanning line effect */}
            {!isComplete && (
              <motion.div
                animate={{ y: ['0%', '400%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent"
                style={{ top: '20%' }}
              />
            )}

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="relative">
                <motion.div
                  animate={!isComplete ? { rotate: 360 } : {}}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </motion.div>
              </div>
              <div>
                <span className="text-cyan-400 font-medium text-sm">Wells is working</span>
              </div>
            </div>

            {/* Stage display */}
            <div className="min-h-[80px] mb-5">
              <AnimatePresence mode="wait">
                {currentStage && (
                  <motion.div
                    key={currentStage.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-4"
                  >
                    {/* Icon */}
                    <motion.div
                      animate={
                        currentStage.icon === 'search'
                          ? { scale: [1, 1.1, 1] }
                          : currentStage.icon === 'analyze'
                          ? { rotateY: [0, 180, 360] }
                          : {}
                      }
                      transition={{ duration: 1, repeat: Infinity }}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        isComplete
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-white/10 text-amber-400'
                      }`}
                    >
                      {isComplete ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        getIcon(currentStage.icon)
                      )}
                    </motion.div>

                    {/* Text */}
                    <div className="flex-1">
                      <motion.p
                        key={currentStage.text}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-white text-lg font-medium"
                      >
                        {currentStage.text}
                      </motion.p>

                      {/* Counter animation for counts */}
                      {currentStage.count && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="flex items-center gap-2 mt-1"
                        >
                          {currentStage.id === 'searching' && (
                            <span className="text-sm text-gray-400">
                              Checking verified suppliers...
                            </span>
                          )}
                          {currentStage.id === 'found' && (
                            <span className="text-sm text-green-400">
                              Quality matches identified
                            </span>
                          )}
                          {currentStage.id === 'ready' && (
                            <span className="text-sm text-amber-400">
                              Best options selected
                            </span>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Completion state */}
              {isComplete && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <motion.svg
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      className="w-6 h-6 text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </motion.svg>
                  </div>
                  <div>
                    <p className="text-white text-lg font-medium">Ready to show you options</p>
                    <p className="text-sm text-gray-400">That took less than 10 seconds</p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Progress bar */}
            <div className="relative">
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan-400 to-amber-400 rounded-full"
                  style={{ width: `${progress}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>

              {/* Stage indicators */}
              <div className="flex justify-between mt-2">
                {stages.map((stage, index) => (
                  <div
                    key={stage.id}
                    className={`flex items-center gap-1 text-xs ${
                      index <= currentStageIndex
                        ? 'text-amber-400'
                        : 'text-gray-600'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        index <= currentStageIndex
                          ? 'bg-amber-400'
                          : 'bg-gray-600'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Particles effect */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 100, x: Math.random() * 100 }}
                  animate={{
                    opacity: [0, 0.5, 0],
                    y: -20,
                    x: Math.random() * 200 - 100,
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.3,
                    ease: 'easeOut',
                  }}
                  className="absolute bottom-0 left-1/2 w-1 h-1 bg-amber-400 rounded-full"
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default SpeedDemo
