/**
 * GTM Conversion Card - Inline journey onboarding in chat
 *
 * Appears when Wells detects GTM intent (finding customers, generating leads)
 * Converts users early (2-3 messages) instead of waiting
 *
 * "you need to convert me much earlier in the convo so you know who the buyer is"
 */

'use client'

import { useState } from 'react'

interface GTMConversionCardProps {
  intent: {
    whatTheySell?: string
    whoTheyTarget?: string
    goal?: string // 'find_customers' | 'generate_leads' | 'close_deals'
    confidence: number
  }
  onStart?: () => void // Callback when user starts GTM journey
  onDismiss?: () => void // Callback when user dismisses
}

export function GTMConversionCard({ intent, onStart, onDismiss }: GTMConversionCardProps) {
  const [started, setStarted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const handleStart = () => {
    setStarted(true)
    if (onStart) onStart()
  }

  const handleDismiss = () => {
    setDismissed(true)
    if (onDismiss) onDismiss()
  }

  if (dismissed) {
    return null // Don't show if dismissed
  }

  if (started) {
    return (
      <div className="my-4 p-6 bg-[#dba63f]/10 border border-[#dba63f] rounded-sm">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-6 h-6 text-[#dba63f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h3 className="text-lg font-bold text-[#183b6d]">GTM Journey Started</h3>
        </div>
        <p className="text-sm text-[#575757]">
          I'll ask you a few questions to understand your ideal customer, then I'll start sourcing and reaching out on your behalf.
        </p>
      </div>
    )
  }

  // Get goal-specific copy
  const goalCopy = getGoalCopy(intent.goal)

  return (
    <div className="my-4 p-6 bg-white border-2 border-[#9ea1a7]/20 rounded-sm hover:border-[#dba63f] transition-all shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-[#dba63f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h3 className="text-sm font-medium text-[#9ea1a7] tracking-wide uppercase">GTM Journey Detected</h3>
          </div>
          <h2 className="text-2xl font-bold text-[#183b6d] mb-2">{goalCopy.title}</h2>
          <p className="text-[#575757] leading-relaxed">{goalCopy.description}</p>
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="text-[#9ea1a7] hover:text-[#575757] transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* What we detected */}
      {(intent.whatTheySell || intent.whoTheyTarget) && (
        <div className="mb-4 p-4 bg-[#f5f5f5] rounded-sm">
          <p className="text-xs font-medium text-[#9ea1a7] tracking-wide uppercase mb-2">What I Understand So Far</p>
          {intent.whatTheySell && (
            <div className="mb-1">
              <span className="text-sm font-medium text-[#183b6d]">You sell:</span>
              <span className="text-sm text-[#575757] ml-2">{intent.whatTheySell}</span>
            </div>
          )}
          {intent.whoTheyTarget && (
            <div>
              <span className="text-sm font-medium text-[#183b6d]">Target customers:</span>
              <span className="text-sm text-[#575757] ml-2">{intent.whoTheyTarget}</span>
            </div>
          )}
        </div>
      )}

      {/* What Wells will do */}
      <div className="mb-6 space-y-3">
        <p className="text-xs font-medium text-[#9ea1a7] tracking-wide uppercase">How Wells Helps</p>
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[#dba63f] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-[#575757]">I'll qualify your ideal customer profile through conversation</p>
          </div>
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[#dba63f] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-[#575757]">I'll identify and reach out to qualified prospects on your behalf</p>
          </div>
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[#dba63f] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-[#575757]">You'll only see qualified, interested leads (not just contact info)</p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleStart}
          className="flex-1 px-6 py-3 bg-[#dba63f] text-white font-medium text-sm tracking-wide rounded-sm hover:bg-[#c89430] transition-all shadow-md"
        >
          Start GTM Journey
        </button>
        <button
          onClick={handleDismiss}
          className="px-6 py-3 border border-[#9ea1a7]/30 text-[#575757] font-medium text-sm tracking-wide rounded-sm hover:border-[#9ea1a7] hover:bg-[#f5f5f5] transition-all"
        >
          Not Now
        </button>
      </div>

      {/* Confidence indicator (subtle) */}
      {intent.confidence > 0.8 && (
        <div className="mt-4 pt-4 border-t border-[#9ea1a7]/10">
          <p className="text-xs text-[#9ea1a7]">
            High confidence match based on your conversation
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Get copy based on user's goal
 */
function getGoalCopy(goal?: string): { title: string; description: string } {
  switch (goal) {
    case 'find_customers':
      return {
        title: 'Find Customers',
        description: "I can help you identify and reach qualified customers for your product or service. I'll handle the sourcing and outreach."
      }

    case 'generate_leads':
      return {
        title: 'Generate Leads',
        description: "I'll build a pipeline of qualified leads for your sales team. You focus on closing, I handle prospecting."
      }

    case 'close_deals':
      return {
        title: 'Close More Deals',
        description: "I can help you optimize your sales process, from initial outreach to closing. Let's build your GTM engine."
      }

    default:
      return {
        title: 'Grow Your Business',
        description: 'I can help you find the right customers and close more deals. Let me handle the sourcing and outreach.'
      }
  }
}

export default GTMConversionCard
