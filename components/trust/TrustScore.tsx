'use client'

/**
 * Trust Score Component
 *
 * Displays a user's trust score with visual indicator
 */

import { getScoreColor, getScoreGrade } from '@/lib/reputation/calculator'

interface TrustScoreProps {
  score: number
  showGrade?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CONFIG = {
  sm: {
    container: 'w-12 h-12',
    text: 'text-sm',
    grade: 'text-xs',
    strokeWidth: 3,
  },
  md: {
    container: 'w-20 h-20',
    text: 'text-lg',
    grade: 'text-sm',
    strokeWidth: 4,
  },
  lg: {
    container: 'w-28 h-28',
    text: 'text-2xl',
    grade: 'text-base',
    strokeWidth: 5,
  },
}

export function TrustScore({
  score,
  showGrade = true,
  size = 'md',
  className = '',
}: TrustScoreProps) {
  const config = SIZE_CONFIG[size]
  const color = getScoreColor(score)
  const grade = getScoreGrade(score)

  // Calculate circle progress
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const offset = circumference - progress

  return (
    <div className={`relative ${config.container} ${className}`}>
      {/* Background circle */}
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={config.strokeWidth}
          className="text-white/10"
        />
        {/* Progress circle */}
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>

      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-bold ${config.text}`} style={{ color }}>
          {Math.round(score)}
        </span>
        {showGrade && (
          <span className={`opacity-60 ${config.grade}`}>{grade}</span>
        )}
      </div>
    </div>
  )
}

export default TrustScore
