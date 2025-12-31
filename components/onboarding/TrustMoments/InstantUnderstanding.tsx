'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  parseUserInput,
  generateReflection,
  TRUST_MOMENT_ANIMATIONS,
  type UserInputSummary,
} from '@/lib/onboarding/trust-moments'

interface InstantUnderstandingProps {
  userInput: string
  isVisible: boolean
  onConfirm: () => void
  onCorrect: (correction: string) => void
  onDismiss?: () => void
}

/**
 * Trust Moment 1: Instant Understanding
 *
 * When user describes their need, Wells doesn't just acknowledge -
 * Wells demonstrates understanding by reflecting back specifics.
 */
export function InstantUnderstanding({
  userInput,
  isVisible,
  onConfirm,
  onCorrect,
  onDismiss,
}: InstantUnderstandingProps) {
  const [summary, setSummary] = useState<UserInputSummary | null>(null)
  const [reflection, setReflection] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editedSummary, setEditedSummary] = useState<Partial<UserInputSummary>>({})
  const [showConfirmation, setShowConfirmation] = useState(false)

  // Parse user input when it changes
  useEffect(() => {
    if (userInput) {
      const parsed = parseUserInput(userInput)
      setSummary(parsed)
      setReflection(generateReflection(parsed))
      setEditedSummary({
        category: parsed.category,
        quantity: parsed.quantity,
        material: parsed.material,
        timeline: parsed.timeline,
      })
    }
  }, [userInput])

  const handleConfirm = useCallback(() => {
    setShowConfirmation(true)
    setTimeout(() => {
      onConfirm()
    }, 1500)
  }, [onConfirm])

  const handleEdit = useCallback(() => {
    setIsEditing(true)
  }, [])

  const handleSaveEdit = useCallback(() => {
    setIsEditing(false)
    // Generate new reflection with edited values
    const newReflection = generateReflection({
      ...summary!,
      ...editedSummary,
    })
    setReflection(newReflection)
  }, [summary, editedSummary])

  const handleCorrection = useCallback(() => {
    const correctionString = Object.entries(editedSummary)
      .filter(([_, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')
    onCorrect(correctionString)
    setShowConfirmation(true)
  }, [editedSummary, onCorrect])

  if (!summary) return null

  const summaryItems = [
    { key: 'category', label: 'Product', value: summary.category, icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    { key: 'quantity', label: 'Quantity', value: summary.quantity ? `${parseInt(summary.quantity).toLocaleString()} units` : null, icon: 'M7 20l4-16m2 16l4-16M6 9h14M4 15h14' },
    { key: 'material', label: 'Material', value: summary.material, icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { key: 'timeline', label: 'Timeline', value: summary.timeline, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  ].filter((item) => item.value)

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
          {/* Subtle glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 via-transparent to-amber-500/20 rounded-2xl blur-xl opacity-50" />

          {/* Main card */}
          <div className="relative bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
            {/* Wells indicator */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
              </div>
              <div>
                <span className="text-sm text-amber-400 font-medium">Wells understood</span>
              </div>
            </div>

            {/* Reflection text */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-white text-lg mb-5 leading-relaxed"
            >
              {reflection}
            </motion.p>

            {/* Summary items */}
            {!isEditing && summaryItems.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="grid grid-cols-2 gap-3 mb-5"
              >
                {summaryItems.map((item, index) => (
                  <motion.div
                    key={item.key}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2"
                  >
                    <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                    </svg>
                    <div className="min-w-0">
                      <span className="text-xs text-gray-500 block">{item.label}</span>
                      <span className="text-sm text-white truncate block">{item.value}</span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Edit mode */}
            {isEditing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 mb-5"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Product</label>
                    <input
                      type="text"
                      value={editedSummary.category || ''}
                      onChange={(e) => setEditedSummary({ ...editedSummary, category: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                      placeholder="e.g., packaging"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Quantity</label>
                    <input
                      type="text"
                      value={editedSummary.quantity || ''}
                      onChange={(e) => setEditedSummary({ ...editedSummary, quantity: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                      placeholder="e.g., 10000"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Material</label>
                    <input
                      type="text"
                      value={editedSummary.material || ''}
                      onChange={(e) => setEditedSummary({ ...editedSummary, material: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                      placeholder="e.g., eco-friendly"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Timeline</label>
                    <input
                      type="text"
                      value={editedSummary.timeline || ''}
                      onChange={(e) => setEditedSummary({ ...editedSummary, timeline: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                      placeholder="e.g., 30 days"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Save changes
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}

            {/* Actions */}
            {!isEditing && !showConfirmation && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex gap-3"
              >
                <button
                  onClick={handleConfirm}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-medium py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    That&apos;s right
                  </span>
                </button>
                <button
                  onClick={handleEdit}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors border border-white/10"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Let me correct
                  </span>
                </button>
              </motion.div>
            )}

            {/* Confirmation animation */}
            {showConfirmation && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-center gap-2 py-2"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center"
                >
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
                <span className="text-green-400 font-medium">Got it, let me update that.</span>
              </motion.div>
            )}

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

export default InstantUnderstanding
