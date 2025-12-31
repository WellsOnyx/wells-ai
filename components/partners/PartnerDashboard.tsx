'use client'

/**
 * Partner Dashboard Component
 *
 * Complete affiliate/referral dashboard showing:
 * - Referral stats and tier progress
 * - Commission tracking
 * - Payout history
 * - Custom link management
 */

import { useState, useEffect } from 'react'
import { PartnerDashboard as DashboardData } from '@/lib/partners/types'

interface Props {
  className?: string
}

const TIER_COLORS: Record<string, string> = {
  starter: 'from-gray-500 to-gray-600',
  bronze: 'from-amber-600 to-amber-700',
  silver: 'from-gray-300 to-gray-400',
  gold: 'from-yellow-400 to-yellow-500',
  platinum: 'from-slate-300 to-slate-400',
  elite: 'from-purple-500 to-purple-600',
}

export function PartnerDashboard({ className = '' }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchDashboard()
  }, [])

  async function fetchDashboard() {
    try {
      const res = await fetch('/api/partners?dashboard=true')
      if (!res.ok) {
        if (res.status === 404) {
          setError('not_partner')
        } else {
          throw new Error('Failed to fetch dashboard')
        }
        return
      }
      const dashboard = await res.json()
      setData(dashboard)
    } catch (err) {
      setError('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  function copyReferralLink() {
    if (!data) return
    const link = `${window.location.origin}/join?ref=${data.partner.referralCode}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className={`animate-pulse space-y-4 ${className}`}>
        <div className="h-32 bg-white/5 rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error === 'not_partner') {
    return (
      <div className={`text-center py-12 ${className}`}>
        <h3 className="text-xl font-bold text-white mb-2">Become a Partner</h3>
        <p className="text-white/60 mb-6">
          Earn commissions by referring customers to our platform.
        </p>
        <a
          href="/partners/apply"
          className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-medium text-white transition-colors"
        >
          Apply Now
        </a>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className={`text-center py-12 text-red-400 ${className}`}>
        {error || 'Failed to load dashboard'}
      </div>
    )
  }

  const { partner, tierConfig, nextTier, stats, recentReferrals, recentCommissions } = data

  const tierProgress = nextTier
    ? {
        referrals: Math.min(100, (partner.totalReferrals / nextTier.minReferrals) * 100),
        revenue: Math.min(100, (partner.totalRevenueGenerated / nextTier.minRevenue) * 100),
      }
    : { referrals: 100, revenue: 100 }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Tier Badge */}
      <div className={`p-6 rounded-2xl bg-gradient-to-r ${TIER_COLORS[partner.tier] || TIER_COLORS.starter}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm">Partner Status</p>
            <h2 className="text-2xl font-bold text-white">{tierConfig.name} Partner</h2>
            <p className="text-white/80 mt-1">
              {(tierConfig.baseCommissionRate * 100).toFixed(0)}% base commission
              {tierConfig.bonusCommissionRate > 0 &&
                ` + ${(tierConfig.bonusCommissionRate * 100).toFixed(0)}% bonus`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-white/60 text-sm">Your Referral Code</p>
            <button
              onClick={copyReferralLink}
              className="text-xl font-mono font-bold text-white hover:underline"
            >
              {partner.referralCode}
            </button>
            <p className="text-white/60 text-xs mt-1">
              {copied ? 'Copied!' : 'Click to copy link'}
            </p>
          </div>
        </div>

        {/* Tier Progress */}
        {nextTier && (
          <div className="mt-4 p-3 bg-black/20 rounded-xl">
            <p className="text-white/80 text-sm mb-2">
              Progress to {nextTier.name}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs text-white/60 mb-1">
                  <span>Referrals</span>
                  <span>{partner.totalReferrals} / {nextTier.minReferrals}</span>
                </div>
                <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white/80 rounded-full transition-all"
                    style={{ width: `${tierProgress.referrals}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-white/60 mb-1">
                  <span>Revenue</span>
                  <span>${partner.totalRevenueGenerated.toLocaleString()} / ${nextTier.minRevenue.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white/80 rounded-full transition-all"
                    style={{ width: `${tierProgress.revenue}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="This Month's Clicks"
          value={stats.clicksThisMonth.toLocaleString()}
          icon="click"
        />
        <StatCard
          label="New Signups"
          value={stats.signupsThisMonth.toLocaleString()}
          subtext={`${(stats.conversionRate * 100).toFixed(1)}% conversion`}
          icon="users"
        />
        <StatCard
          label="Revenue Generated"
          value={`$${stats.revenueThisMonth.toLocaleString()}`}
          icon="dollar"
        />
        <StatCard
          label="Commissions Earned"
          value={`$${stats.commissionsThisMonth.toLocaleString()}`}
          icon="cash"
        />
      </div>

      {/* Pending Payout */}
      {partner.pendingCommission > 0 && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-400 font-medium">Pending Payout</p>
              <p className="text-2xl font-bold text-white">
                ${partner.pendingCommission.toLocaleString()}
              </p>
            </div>
            {partner.pendingCommission >= partner.minimumPayout && (
              <button className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-medium transition-colors">
                Request Payout
              </button>
            )}
          </div>
          {partner.pendingCommission < partner.minimumPayout && (
            <p className="text-green-400/60 text-sm mt-2">
              Minimum payout: ${partner.minimumPayout.toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Referrals */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <h3 className="font-semibold text-white mb-4">Recent Referrals</h3>
          {recentReferrals.length === 0 ? (
            <p className="text-white/40 text-sm">No referrals yet</p>
          ) : (
            <div className="space-y-3">
              {recentReferrals.slice(0, 5).map((ref) => (
                <div key={ref.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm">
                      {ref.referredEmail || 'Anonymous'}
                    </p>
                    <p className="text-white/40 text-xs">
                      {new Date(ref.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge status={ref.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Commissions */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <h3 className="font-semibold text-white mb-4">Recent Commissions</h3>
          {recentCommissions.length === 0 ? (
            <p className="text-white/40 text-sm">No commissions yet</p>
          ) : (
            <div className="space-y-3">
              {recentCommissions.slice(0, 5).map((comm) => (
                <div key={comm.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm">
                      ${comm.commissionAmount.toFixed(2)}
                      <span className="text-white/40 ml-2">
                        from ${comm.transactionAmount.toFixed(2)}
                      </span>
                    </p>
                    <p className="text-white/40 text-xs">
                      {new Date(comm.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <CommissionStatusBadge status={comm.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lifetime Stats */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <h3 className="font-semibold text-white mb-4">Lifetime Stats</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-white/40 text-sm">Total Referrals</p>
            <p className="text-xl font-bold text-white">
              {partner.totalReferrals.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-white/40 text-sm">Active Referrals</p>
            <p className="text-xl font-bold text-white">
              {partner.activeReferrals.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-white/40 text-sm">Total Revenue</p>
            <p className="text-xl font-bold text-white">
              ${partner.totalRevenueGenerated.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-white/40 text-sm">Total Earned</p>
            <p className="text-xl font-bold text-green-400">
              ${partner.totalCommissionsEarned.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Tier Benefits */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <h3 className="font-semibold text-white mb-4">Your Benefits</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Benefit
            label="Base Commission"
            value={`${(tierConfig.baseCommissionRate * 100).toFixed(0)}%`}
            active
          />
          {tierConfig.bonusCommissionRate > 0 && (
            <Benefit
              label="Bonus Commission"
              value={`+${(tierConfig.bonusCommissionRate * 100).toFixed(0)}%`}
              active
            />
          )}
          <Benefit
            label="Dedicated Support"
            active={tierConfig.dedicatedSupport}
          />
          <Benefit
            label="Custom Landing Pages"
            active={tierConfig.customLandingPages}
          />
          <Benefit
            label="API Access"
            active={tierConfig.apiAccess}
          />
          <Benefit
            label="White Label"
            active={tierConfig.whiteLabel}
          />
          <Benefit
            label="Co-Marketing"
            active={tierConfig.coMarketing}
          />
          <Benefit
            label="Early Access"
            active={tierConfig.earlyAccess}
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  subtext,
  icon,
}: {
  label: string
  value: string
  subtext?: string
  icon: 'click' | 'users' | 'dollar' | 'cash'
}) {
  const icons = {
    click: '🖱️',
    users: '👥',
    dollar: '💰',
    cash: '💵',
  }

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icons[icon]}</span>
        <span className="text-white/40 text-sm">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {subtext && <p className="text-white/40 text-xs mt-1">{subtext}</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    clicked: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
    signed_up: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    qualified: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    active: { bg: 'bg-green-500/20', text: 'text-green-400' },
    churned: { bg: 'bg-red-500/20', text: 'text-red-400' },
    refunded: { bg: 'bg-red-500/20', text: 'text-red-400' },
  }

  const { bg, text } = config[status] || config.clicked

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${bg} ${text}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function CommissionStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    approved: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    paid: { bg: 'bg-green-500/20', text: 'text-green-400' },
    cancelled: { bg: 'bg-red-500/20', text: 'text-red-400' },
    refunded: { bg: 'bg-red-500/20', text: 'text-red-400' },
  }

  const { bg, text } = config[status] || config.pending

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${bg} ${text}`}>
      {status}
    </span>
  )
}

function Benefit({
  label,
  value,
  active,
}: {
  label: string
  value?: string
  active: boolean
}) {
  return (
    <div
      className={`p-3 rounded-lg ${
        active ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-white/5 opacity-50'
      }`}
    >
      <p className={`text-sm font-medium ${active ? 'text-white' : 'text-white/40'}`}>
        {label}
      </p>
      {value && (
        <p className={`text-lg font-bold ${active ? 'text-purple-400' : 'text-white/40'}`}>
          {value}
        </p>
      )}
      {!value && (
        <p className={`text-xs ${active ? 'text-purple-400' : 'text-white/40'}`}>
          {active ? '✓ Included' : 'Not included'}
        </p>
      )}
    </div>
  )
}

export default PartnerDashboard
