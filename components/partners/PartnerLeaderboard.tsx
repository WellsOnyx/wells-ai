'use client'

/**
 * Partner Leaderboard Component
 *
 * Shows top performing partners
 */

import { useState, useEffect } from 'react'
import { LeaderboardEntry, PartnerTier } from '@/lib/partners/types'

interface Props {
  limit?: number
  className?: string
}

const TIER_COLORS: Record<string, string> = {
  starter: 'text-gray-400',
  bronze: 'text-amber-600',
  silver: 'text-gray-300',
  gold: 'text-yellow-400',
  platinum: 'text-slate-300',
  elite: 'text-purple-400',
}

const RANK_BADGES = ['🥇', '🥈', '🥉']

export function PartnerLeaderboard({ limit = 10, className = '' }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'revenue' | 'referrals'>('revenue')

  useEffect(() => {
    fetchLeaderboard()
  }, [limit])

  async function fetchLeaderboard() {
    try {
      const res = await fetch(`/api/partners/leaderboard?limit=${limit}`)
      if (res.ok) {
        const data = await res.json()
        setEntries(data.leaderboard)
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err)
    } finally {
      setLoading(false)
    }
  }

  const sortedEntries = [...entries].sort((a, b) => {
    if (sortBy === 'revenue') {
      return b.totalRevenueGenerated - a.totalRevenueGenerated
    }
    return b.totalReferrals - a.totalReferrals
  })

  if (loading) {
    return (
      <div className={`animate-pulse space-y-3 ${className}`}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-white/5 rounded-xl" />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className={`text-center py-8 text-white/40 ${className}`}>
        No partners yet. Be the first!
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Sort Toggle */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">Top Partners</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('revenue')}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              sortBy === 'revenue'
                ? 'bg-purple-500/20 text-purple-400'
                : 'bg-white/5 text-white/40 hover:text-white/60'
            }`}
          >
            By Revenue
          </button>
          <button
            onClick={() => setSortBy('referrals')}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              sortBy === 'referrals'
                ? 'bg-purple-500/20 text-purple-400'
                : 'bg-white/5 text-white/40 hover:text-white/60'
            }`}
          >
            By Referrals
          </button>
        </div>
      </div>

      {/* Leaderboard List */}
      <div className="space-y-2">
        {sortedEntries.map((entry, index) => {
          const rank = sortBy === 'revenue' ? entry.revenueRank : entry.referralRank

          return (
            <div
              key={entry.id}
              className={`p-4 rounded-xl border transition-colors ${
                index < 3
                  ? 'bg-gradient-to-r from-purple-500/10 to-transparent border-purple-500/20'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Rank */}
                <div className="w-8 text-center">
                  {rank <= 3 ? (
                    <span className="text-2xl">{RANK_BADGES[rank - 1]}</span>
                  ) : (
                    <span className="text-white/40 font-bold">#{rank}</span>
                  )}
                </div>

                {/* Name & Tier */}
                <div className="flex-1">
                  <p className="font-medium text-white">
                    {entry.name}
                    {entry.companyName && (
                      <span className="text-white/40 ml-2">@{entry.companyName}</span>
                    )}
                  </p>
                  <p className={`text-sm ${TIER_COLORS[entry.tier]}`}>
                    {entry.tierName} Partner
                  </p>
                </div>

                {/* Stats */}
                <div className="text-right">
                  <p className="font-bold text-white">
                    {sortBy === 'revenue'
                      ? `$${entry.totalRevenueGenerated.toLocaleString()}`
                      : entry.totalReferrals.toLocaleString()}
                  </p>
                  <p className="text-xs text-white/40">
                    {sortBy === 'revenue' ? 'Revenue' : 'Referrals'}
                  </p>
                </div>

                {/* Earnings */}
                <div className="text-right">
                  <p className="font-bold text-green-400">
                    ${entry.totalCommissionsEarned.toLocaleString()}
                  </p>
                  <p className="text-xs text-white/40">Earned</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default PartnerLeaderboard
