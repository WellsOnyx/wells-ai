'use client'

/**
 * Trust Recommendations Component
 *
 * Shows actionable recommendations to improve trust score
 */

import { TrustRecommendation } from '@/lib/reputation/types'

interface TrustRecommendationsProps {
  recommendations: TrustRecommendation[]
  onAction?: (recommendation: TrustRecommendation) => void
  className?: string
}

const PRIORITY_CONFIG = {
  high: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    label: 'High Priority',
  },
  medium: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    label: 'Medium',
  },
  low: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    label: 'Low',
  },
}

const CATEGORY_ICONS = {
  transaction: '💼',
  communication: '💬',
  verification: '✓',
  behavior: '⭐',
  review: '📝',
}

export function TrustRecommendations({
  recommendations,
  onAction,
  className = '',
}: TrustRecommendationsProps) {
  if (recommendations.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-white/40">No recommendations at this time.</p>
        <p className="text-white/60 text-sm mt-1">Keep up the great work!</p>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {recommendations.map((rec, index) => {
        const priorityConfig = PRIORITY_CONFIG[rec.priority]
        const icon = CATEGORY_ICONS[rec.category] || '💡'

        return (
          <div
            key={index}
            className={`
              p-4 rounded-xl border
              ${priorityConfig.bg} ${priorityConfig.border}
              ${onAction ? 'cursor-pointer hover:bg-white/5 transition-colors' : ''}
            `}
            onClick={() => onAction?.(rec)}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">{icon}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-white">{rec.action}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${priorityConfig.bg} ${priorityConfig.text}`}>
                    +{rec.potentialImpact} pts
                  </span>
                </div>
                <p className="text-sm text-white/60">{rec.description}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default TrustRecommendations
