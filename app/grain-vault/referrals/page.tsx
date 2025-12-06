'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import {
  ArrowLeft,
  Gift,
  Users,
  TrendingUp,
  Copy,
  Check,
  Share2,
  Trophy,
  ChevronRight,
  Loader2,
  Twitter,
  Linkedin,
  Mail,
  Star,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react'

interface ReferralDashboard {
  hasCode: boolean
  code?: string
  referralLink?: string
  shareUrls?: {
    twitter: string
    linkedin: string
    email: string
  }
  tier?: string
  tierName?: string
  badgeColor?: string
  customCodeEnabled?: boolean
  nextTier?: string
  nextTierRequirement?: number
  referralsToNextTier?: number
  stats?: {
    totalReferrals: number
    successfulReferrals: number
    pendingReferrals: number
    totalGrainEarned: number
    referralsThisMonth: number
    grainEarnedThisMonth: number
    pendingRewards: number
  }
  rewardAmount?: number
  refereeBonus?: number
  recentReferrals?: Array<{
    id: string
    email: string
    status: string
    reward: number
    createdAt: string
  }>
  leaderboardRank?: number
  message?: string
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'text-yellow-400', icon: <Clock className="w-4 h-4" /> },
  signed_up: { label: 'Signed Up', color: 'text-blue-400', icon: <Users className="w-4 h-4" /> },
  verified: { label: 'Verified', color: 'text-purple-400', icon: <Check className="w-4 h-4" /> },
  qualified: { label: 'Qualified', color: 'text-green-400', icon: <CheckCircle className="w-4 h-4" /> },
  rewarded: { label: 'Rewarded', color: 'text-green-400', icon: <Gift className="w-4 h-4" /> },
  rejected: { label: 'Rejected', color: 'text-red-400', icon: <XCircle className="w-4 h-4" /> },
  expired: { label: 'Expired', color: 'text-gray-400', icon: <Clock className="w-4 h-4" /> }
}

export default function ReferralDashboardPage() {
  const { isLoaded, isSignedIn } = useUser()
  const [dashboard, setDashboard] = useState<ReferralDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [customCode, setCustomCode] = useState('')
  const [settingCustomCode, setSettingCustomCode] = useState(false)
  const [customCodeError, setCustomCodeError] = useState('')

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/grain-vault/referral/dashboard')
      const data = await res.json()
      setDashboard(data)
    } catch (error) {
      console.error('Failed to fetch dashboard:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchDashboard()
    } else if (isLoaded && !isSignedIn) {
      setLoading(false)
    }
  }, [isLoaded, isSignedIn, fetchDashboard])

  const copyLink = async () => {
    if (dashboard?.referralLink) {
      await navigator.clipboard.writeText(dashboard.referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const setCustomReferralCode = async () => {
    if (!customCode.trim()) return

    setSettingCustomCode(true)
    setCustomCodeError('')

    try {
      const res = await fetch('/api/grain-vault/referral/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customCode: customCode.trim() })
      })
      const data = await res.json()

      if (!res.ok) {
        setCustomCodeError(data.error || 'Failed to set custom code')
      } else {
        setCustomCode('')
        fetchDashboard()
      }
    } catch {
      setCustomCodeError('Failed to set custom code')
    } finally {
      setSettingCustomCode(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="text-center">
          <Gift className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Sign in to access referrals</h1>
          <p className="text-gray-400 mb-6">Create an account to start earning GRAIN rewards</p>
          <Link
            href="/grain-vault/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold hover:from-green-600 hover:to-emerald-700 transition-all"
          >
            Get Started
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    )
  }

  if (!dashboard?.hasCode) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="text-center">
          <Gift className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Get Your Referral Code</h1>
          <p className="text-gray-400 mb-6">{dashboard?.message || 'Generate your code to start earning'}</p>
          <button
            onClick={fetchDashboard}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold hover:from-green-600 hover:to-emerald-700 transition-all"
          >
            Generate Code
            <Gift className="w-5 h-5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/grain-vault/account"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Account
          </Link>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <div className="w-3 h-3 bg-black rounded-sm" />
              </div>
            </div>
            <span className="font-semibold text-white">Grain & Vault</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Referral Program</h1>
          <p className="text-gray-400">Earn GRAIN by inviting others to join Grain & Vault</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-2xl font-bold text-white">{dashboard.stats?.successfulReferrals || 0}</div>
            <div className="text-sm text-gray-400">Successful Referrals</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-2xl font-bold text-green-400">{dashboard.stats?.totalGrainEarned || 0}</div>
            <div className="text-sm text-gray-400">GRAIN Earned</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-2xl font-bold text-yellow-400">{dashboard.stats?.pendingReferrals || 0}</div>
            <div className="text-sm text-gray-400">Pending</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-2xl font-bold text-purple-400">#{dashboard.leaderboardRank || '-'}</div>
            <div className="text-sm text-gray-400">Leaderboard Rank</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Referral Link Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-green-500/20 via-black to-blue-500/10 border border-white/10">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-green-400" />
                Your Referral Link
              </h2>

              <div className="mb-4">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-black/50 border border-white/10">
                  <code className="flex-1 text-sm text-gray-300 truncate">
                    {dashboard.referralLink}
                  </code>
                  <button
                    onClick={copyLink}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Code: <span className="text-green-400 font-mono">{dashboard.code}</span>
                </p>
              </div>

              {/* Share Buttons */}
              <div className="flex gap-2">
                <a
                  href={dashboard.shareUrls?.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 p-3 rounded-lg bg-[#1DA1F2]/20 hover:bg-[#1DA1F2]/30 border border-[#1DA1F2]/30 transition-colors flex items-center justify-center gap-2"
                >
                  <Twitter className="w-4 h-4 text-[#1DA1F2]" />
                  <span className="text-sm text-white">Tweet</span>
                </a>
                <a
                  href={dashboard.shareUrls?.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 p-3 rounded-lg bg-[#0077B5]/20 hover:bg-[#0077B5]/30 border border-[#0077B5]/30 transition-colors flex items-center justify-center gap-2"
                >
                  <Linkedin className="w-4 h-4 text-[#0077B5]" />
                  <span className="text-sm text-white">Share</span>
                </a>
                <a
                  href={dashboard.shareUrls?.email}
                  className="flex-1 p-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 transition-colors flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-white">Email</span>
                </a>
              </div>
            </div>

            {/* Tier Card */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                Your Tier
              </h2>

              <div className="flex items-center gap-4 mb-4">
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${dashboard.badgeColor}20` }}
                >
                  <Star className="w-8 h-8" style={{ color: dashboard.badgeColor }} />
                </div>
                <div>
                  <div className="text-xl font-bold text-white">{dashboard.tierName}</div>
                  <div className="text-sm text-gray-400">
                    <span className="text-green-400">{dashboard.rewardAmount} GRAIN</span> per referral
                  </div>
                </div>
              </div>

              {dashboard.nextTier && (
                <div className="p-4 rounded-xl bg-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-400">Next: {dashboard.nextTier}</span>
                    <span className="text-sm text-gray-400">
                      {dashboard.stats?.successfulReferrals || 0}/{dashboard.nextTierRequirement}
                    </span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, ((dashboard.stats?.successfulReferrals || 0) / (dashboard.nextTierRequirement || 1)) * 100)}%`
                      }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    {dashboard.referralsToNextTier} more referrals to unlock
                  </p>
                </div>
              )}
            </div>

            {/* Custom Code (if enabled) */}
            {dashboard.customCodeEnabled && (
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <h2 className="text-lg font-semibold text-white mb-4">Custom Code</h2>
                <p className="text-sm text-gray-400 mb-4">
                  Create a memorable custom code for your referral link
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                    placeholder="MYCODE"
                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:border-green-500 focus:outline-none"
                    maxLength={20}
                  />
                  <button
                    onClick={setCustomReferralCode}
                    disabled={settingCustomCode || !customCode.trim()}
                    className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 disabled:cursor-not-allowed text-white font-medium transition-colors"
                  >
                    {settingCustomCode ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Set'}
                  </button>
                </div>
                {customCodeError && (
                  <p className="mt-2 text-sm text-red-400">{customCodeError}</p>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Recent Referrals */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Recent Referrals
            </h2>

            {dashboard.recentReferrals && dashboard.recentReferrals.length > 0 ? (
              <div className="space-y-3">
                {dashboard.recentReferrals.map((referral) => {
                  const status = statusConfig[referral.status] || statusConfig.pending
                  return (
                    <div
                      key={referral.id}
                      className="p-4 rounded-xl bg-white/5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-gray-400">
                          {status.icon}
                        </div>
                        <div>
                          <div className="font-medium text-white">{referral.email}</div>
                          <div className={`text-sm ${status.color}`}>{status.label}</div>
                        </div>
                      </div>
                      {referral.status === 'rewarded' && (
                        <div className="text-green-400 font-semibold">
                          +{referral.reward} GRAIN
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No referrals yet</p>
                <p className="text-sm text-gray-500 mt-1">Share your link to start earning!</p>
              </div>
            )}
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-8 p-6 rounded-2xl bg-white/5 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            How It Works
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                <Share2 className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="font-semibold text-white mb-1">1. Share Your Link</h3>
              <p className="text-sm text-gray-400">Send your unique referral link to friends and colleagues</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="font-semibold text-white mb-1">2. They Sign Up</h3>
              <p className="text-sm text-gray-400">They create an account and make their first deposit</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
                <Gift className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="font-semibold text-white mb-1">3. Both Earn GRAIN</h3>
              <p className="text-sm text-gray-400">
                You get <span className="text-green-400">{dashboard.rewardAmount} GRAIN</span>,
                they get <span className="text-green-400">{dashboard.refereeBonus} GRAIN</span>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
