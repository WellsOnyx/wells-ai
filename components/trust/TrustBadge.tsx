'use client'

/**
 * Trust Badge Component
 *
 * Displays a user's trust tier as a badge with optional score
 */

import { TrustTier } from '@/lib/reputation/types'

interface TrustBadgeProps {
  tier: TrustTier
  score?: number
  size?: 'sm' | 'md' | 'lg'
  showScore?: boolean
  className?: string
}

const TIER_CONFIG: Record<TrustTier, { name: string; color: string; bgColor: string; icon: string }> = {
  new: {
    name: 'New',
    color: '#6B7280',
    bgColor: 'bg-gray-500/20',
    icon: '✦',
  },
  bronze: {
    name: 'Bronze',
    color: '#CD7F32',
    bgColor: 'bg-amber-700/20',
    icon: '🥉',
  },
  silver: {
    name: 'Silver',
    color: '#C0C0C0',
    bgColor: 'bg-gray-300/20',
    icon: '🥈',
  },
  gold: {
    name: 'Gold',
    color: '#FFD700',
    bgColor: 'bg-yellow-500/20',
    icon: '🥇',
  },
  platinum: {
    name: 'Platinum',
    color: '#E5E4E2',
    bgColor: 'bg-slate-300/20',
    icon: '💎',
  },
  elite: {
    name: 'Elite',
    color: '#9333EA',
    bgColor: 'bg-purple-500/20',
    icon: '👑',
  },
}

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-2 text-base',
}

export function TrustBadge({
  tier,
  score,
  size = 'md',
  showScore = false,
  className = '',
}: TrustBadgeProps) {
  const config = TIER_CONFIG[tier]

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium
        ${config.bgColor} ${SIZE_CLASSES[size]} ${className}
      `}
      style={{ color: config.color, borderColor: config.color }}
    >
      <span>{config.icon}</span>
      <span>{config.name}</span>
      {showScore && score !== undefined && (
        <span className="opacity-70">({Math.round(score)})</span>
      )}
    </div>
  )
}

export default TrustBadge
