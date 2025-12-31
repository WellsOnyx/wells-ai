'use client'

/**
 * Trust Card Component
 *
 * Comprehensive trust profile display card
 */

import { TrustSummary, TrustTier } from '@/lib/reputation/types'
import { TrustBadge } from './TrustBadge'
import { TrustScore } from './TrustScore'
import { VerificationBadges } from './VerificationBadges'

interface TrustCardProps {
  summary: TrustSummary
  showDetails?: boolean
  className?: string
}

export function TrustCard({
  summary,
  showDetails = true,
  className = '',
}: TrustCardProps) {
  return (
    <div
      className={`
        bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Trust Score</h3>
          <TrustBadge tier={summary.tier} showScore />
        </div>
        <TrustScore score={summary.overallScore} size="lg" />
      </div>

      {/* Verification Status */}
      <div className="mb-6">
        <h4 className="text-sm text-white/60 mb-2">Verifications</h4>
        <VerificationBadges status={summary.verificationStatus} />
      </div>

      {showDetails && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <StatItem
              label="Transactions"
              value={summary.totalTransactions}
              subValue={`${summary.successRate}% success`}
            />
            <StatItem
              label="Reviews"
              value={summary.reviewCount}
              subValue={summary.avgReviewRating ? `${summary.avgReviewRating.toFixed(1)} avg` : 'No reviews'}
            />
            <StatItem
              label="Endorsements"
              value={summary.endorsementCount}
            />
            <StatItem
              label="Journey"
              value={formatJourney(summary.primaryJourney)}
            />
          </div>

          {/* Last Activity */}
          {summary.lastActivityAt && (
            <p className="text-xs text-white/40">
              Last active: {formatDate(summary.lastActivityAt)}
            </p>
          )}
        </>
      )}

      {/* Suspended Warning */}
      {summary.isSuspended && (
        <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm">
            ⚠️ This account is currently suspended
          </p>
        </div>
      )}
    </div>
  )
}

function StatItem({
  label,
  value,
  subValue,
}: {
  label: string
  value: string | number
  subValue?: string
}) {
  return (
    <div className="bg-white/5 rounded-lg p-3">
      <p className="text-xs text-white/50 mb-1">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
      {subValue && <p className="text-xs text-white/40">{subValue}</p>}
    </div>
  )
}

function formatJourney(journey: string): string {
  const map: Record<string, string> = {
    buyer: 'Buyer',
    seller: 'Seller',
    job_seeker: 'Job Seeker',
    founder: 'Founder',
  }
  return map[journey] || journey
}

function formatDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return new Date(date).toLocaleDateString()
}

export default TrustCard
