'use client'

/**
 * Trust Breakdown Component
 *
 * Shows the breakdown of trust score components
 */

import { getScoreColor } from '@/lib/reputation/calculator'

interface TrustBreakdownProps {
  scores: {
    reliability: number
    responsiveness: number
    quality: number
    integrity: number
  }
  className?: string
}

const SCORE_LABELS = [
  { key: 'reliability', label: 'Reliability', description: 'Delivery & payment history' },
  { key: 'responsiveness', label: 'Responsiveness', description: 'Communication speed' },
  { key: 'quality', label: 'Quality', description: 'Work & product quality' },
  { key: 'integrity', label: 'Integrity', description: 'Honesty & trustworthiness' },
] as const

export function TrustBreakdown({ scores, className = '' }: TrustBreakdownProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {SCORE_LABELS.map((item) => {
        const score = scores[item.key as keyof typeof scores]
        const color = getScoreColor(score)

        return (
          <div key={item.key}>
            <div className="flex items-center justify-between mb-1">
              <div>
                <span className="text-sm font-medium text-white">{item.label}</span>
                <span className="text-xs text-white/40 ml-2">{item.description}</span>
              </div>
              <span className="text-sm font-semibold" style={{ color }}>
                {Math.round(score)}
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${score}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default TrustBreakdown
