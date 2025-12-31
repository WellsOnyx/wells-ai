'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TRUST_MOMENT_ANIMATIONS } from '@/lib/onboarding/trust-moments'

interface AItoAIExplainerProps {
  isVisible: boolean
  onContinue: () => void
  onDismiss?: () => void
}

/**
 * Trust Moment 4: The AI-to-AI Explanation
 *
 * Explain the unique AI-to-AI negotiation model with an animated diagram:
 * You -> Your AI -> Their AI -> Them
 */
export function AItoAIExplainer({
  isVisible,
  onContinue,
  onDismiss,
}: AItoAIExplainerProps) {
  const [animationStep, setAnimationStep] = useState(0)
  const [showDiagram, setShowDiagram] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  // Reset and animate on show
  useEffect(() => {
    if (isVisible) {
      setAnimationStep(0)
      setShowDiagram(false)
      setIsComplete(false)

      // Show explanation text first
      const timer1 = setTimeout(() => setAnimationStep(1), 500)
      const timer2 = setTimeout(() => setAnimationStep(2), 1500)
      const timer3 = setTimeout(() => setAnimationStep(3), 2500)
      const timer4 = setTimeout(() => {
        setShowDiagram(true)
        setAnimationStep(4)
      }, 3500)
      const timer5 = setTimeout(() => setIsComplete(true), 5500)

      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        clearTimeout(timer3)
        clearTimeout(timer4)
        clearTimeout(timer5)
      }
    }
  }, [isVisible])

  const explanationTexts = [
    { id: 1, text: "Here's something unique about how I work:" },
    { id: 2, text: 'When you buy or sell, you never talk to the other party directly.' },
    { id: 3, text: 'I talk to THEIR AI. We negotiate. We find middle ground.' },
    { id: 4, text: 'No awkward conversations. No emotional negotiations. Just results.' },
  ]

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
          {/* Multi-color glow */}
          <motion.div
            animate={{
              background: [
                'radial-gradient(circle at 30% 50%, rgba(245, 158, 11, 0.15), transparent 50%), radial-gradient(circle at 70% 50%, rgba(139, 92, 246, 0.15), transparent 50%)',
                'radial-gradient(circle at 40% 50%, rgba(139, 92, 246, 0.15), transparent 50%), radial-gradient(circle at 60% 50%, rgba(245, 158, 11, 0.15), transparent 50%)',
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, repeatType: 'reverse' }}
            className="absolute -inset-4 rounded-3xl blur-xl opacity-60"
          />

          {/* Main card */}
          <div className="relative bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <span className="text-violet-400 font-medium text-sm">How Wells Works</span>
              </div>
            </div>

            {/* Explanation texts */}
            <div className="space-y-3 mb-6">
              {explanationTexts.map((item) => (
                <motion.p
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{
                    opacity: animationStep >= item.id ? 1 : 0,
                    x: animationStep >= item.id ? 0 : -10,
                  }}
                  transition={{ duration: 0.4 }}
                  className={`text-base leading-relaxed ${
                    item.id === 1
                      ? 'text-violet-300'
                      : item.id === 4
                      ? 'text-amber-400 font-medium'
                      : 'text-white'
                  }`}
                >
                  {item.text}
                </motion.p>
              ))}
            </div>

            {/* Animated diagram */}
            <AnimatePresence>
              {showDiagram && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.5 }}
                  className="mb-6"
                >
                  <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                    <div className="flex items-center justify-between relative">
                      {/* You */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex flex-col items-center z-10"
                      >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mb-2 shadow-lg shadow-blue-500/30">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <span className="text-xs text-blue-400 font-medium">You</span>
                      </motion.div>

                      {/* Your AI (Wells) */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                        className="flex flex-col items-center z-10"
                      >
                        <motion.div
                          animate={{ boxShadow: ['0 0 20px rgba(245, 158, 11, 0.3)', '0 0 30px rgba(245, 158, 11, 0.5)', '0 0 20px rgba(245, 158, 11, 0.3)'] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mb-2"
                        >
                          <span className="text-black font-bold text-sm">W</span>
                        </motion.div>
                        <span className="text-xs text-amber-400 font-medium">Your AI</span>
                      </motion.div>

                      {/* Their AI */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.6 }}
                        className="flex flex-col items-center z-10"
                      >
                        <motion.div
                          animate={{ boxShadow: ['0 0 20px rgba(139, 92, 246, 0.3)', '0 0 30px rgba(139, 92, 246, 0.5)', '0 0 20px rgba(139, 92, 246, 0.3)'] }}
                          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                          className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center mb-2"
                        >
                          <span className="text-white font-bold text-sm">AI</span>
                        </motion.div>
                        <span className="text-xs text-violet-400 font-medium">Their AI</span>
                      </motion.div>

                      {/* Them */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.8 }}
                        className="flex flex-col items-center z-10"
                      >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center mb-2 shadow-lg shadow-gray-500/30">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <span className="text-xs text-gray-400 font-medium">Them</span>
                      </motion.div>

                      {/* Connection lines */}
                      <svg className="absolute inset-0 w-full h-full" style={{ top: '28%' }}>
                        {/* You to Your AI */}
                        <motion.path
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{ delay: 1, duration: 0.5 }}
                          d="M 48 0 L 90 0"
                          stroke="url(#gradient1)"
                          strokeWidth="2"
                          strokeDasharray="4 2"
                          fill="none"
                        />
                        {/* Your AI to Their AI - animated pulse */}
                        <motion.path
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{ delay: 1.3, duration: 0.5 }}
                          d="M 130 0 L 195 0"
                          stroke="url(#gradient2)"
                          strokeWidth="3"
                          fill="none"
                        />
                        {/* Their AI to Them */}
                        <motion.path
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{ delay: 1.6, duration: 0.5 }}
                          d="M 235 0 L 280 0"
                          stroke="url(#gradient3)"
                          strokeWidth="2"
                          strokeDasharray="4 2"
                          fill="none"
                        />
                        <defs>
                          <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#3B82F6" />
                            <stop offset="100%" stopColor="#F59E0B" />
                          </linearGradient>
                          <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#F59E0B" />
                            <stop offset="100%" stopColor="#8B5CF6" />
                          </linearGradient>
                          <linearGradient id="gradient3" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#8B5CF6" />
                            <stop offset="100%" stopColor="#6B7280" />
                          </linearGradient>
                        </defs>
                      </svg>

                      {/* Animated data flow */}
                      <motion.div
                        animate={{ x: [0, 280, 0] }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
                        className="absolute left-12 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 shadow-lg shadow-amber-500/50"
                        style={{ top: '35%' }}
                      />
                    </div>

                    {/* Center label */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 2 }}
                      className="flex justify-center mt-4"
                    >
                      <span className="text-xs bg-white/10 text-gray-400 px-3 py-1 rounded-full">
                        AI-to-AI Negotiation
                      </span>
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Continue button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: isComplete ? 1 : 0, y: isComplete ? 0 : 10 }}
              onClick={onContinue}
              className="w-full bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white font-medium py-3 px-4 rounded-xl transition-all shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Got it, let&apos;s continue
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

export default AItoAIExplainer
