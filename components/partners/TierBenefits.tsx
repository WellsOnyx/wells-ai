'use client'

/**
 * Tier Benefits Component
 *
 * Shows all partner tiers and their benefits
 */

import { useState, useEffect } from 'react'
import { TierConfig } from '@/lib/partners/types'

interface Props {
  currentTier?: string
  className?: string
}

const TIER_GRADIENTS: Record<string, string> = {
  starter: 'from-gray-600 to-gray-700',
  bronze: 'from-amber-600 to-amber-700',
  silver: 'from-gray-300 to-gray-500',
  gold: 'from-yellow-400 to-yellow-600',
  platinum: 'from-slate-300 to-slate-500',
  elite: 'from-purple-500 to-purple-700',
}

export function TierBenefits({ currentTier, className = '' }: Props) {
  const [tiers, setTiers] = useState<TierConfig[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTiers()
  }, [])

  async function fetchTiers() {
    try {
      const res = await fetch('/api/partners/tiers')
      if (res.ok) {
        const data = await res.json()
        setTiers(data.tiers)
      }
    } catch (err) {
      console.error('Failed to fetch tiers:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="grid md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-white/5 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiers.map(tier => {
          const isCurrent = tier.id === currentTier
          const gradient = TIER_GRADIENTS[tier.id] || TIER_GRADIENTS.starter

          return (
            <div
              key={tier.id}
              className={`relative rounded-2xl overflow-hidden ${
                isCurrent ? 'ring-2 ring-purple-500' : ''
              }`}
            >
              {isCurrent && (
                <div className="absolute top-3 right-3 px-2 py-1 bg-purple-500 rounded-full text-xs font-medium text-white">
                  Current
                </div>
              )}

              {/* Header */}
              <div className={`p-6 bg-gradient-to-r ${gradient}`}>
                <h3 className="text-xl font-bold text-white">{tier.name}</h3>
                <p className="text-white/80 mt-1">
                  {(tier.baseCommissionRate * 100).toFixed(0)}% commission
                  {tier.bonusCommissionRate > 0 &&
                    ` + ${(tier.bonusCommissionRate * 100).toFixed(0)}% bonus`}
                </p>
              </div>

              {/* Requirements */}
              <div className="p-6 bg-white/5 border-t border-white/10">
                <p className="text-white/40 text-sm mb-3">Requirements</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 text-sm">Referrals</span>
                    <span className="text-white font-medium">
                      {tier.minReferrals === 0 ? 'None' : tier.minReferrals.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 text-sm">Revenue</span>
                    <span className="text-white font-medium">
                      {tier.minRevenue === 0 ? 'None' : `$${tier.minRevenue.toLocaleString()}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Benefits */}
              <div className="p-6 bg-white/[0.02] border-t border-white/10">
                <p className="text-white/40 text-sm mb-3">Benefits</p>
                <div className="space-y-2">
                  <BenefitRow label="Dedicated Support" active={tier.dedicatedSupport} />
                  <BenefitRow label="Custom Landing Pages" active={tier.customLandingPages} />
                  <BenefitRow label="API Access" active={tier.apiAccess} />
                  <BenefitRow label="White Label" active={tier.whiteLabel} />
                  <BenefitRow label="Co-Marketing" active={tier.coMarketing} />
                  <BenefitRow label="Early Access" active={tier.earlyAccess} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BenefitRow({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {active ? (
        <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-white/20" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <span className={active ? 'text-white/80' : 'text-white/30'}>{label}</span>
    </div>
  )
}

export default TierBenefits
