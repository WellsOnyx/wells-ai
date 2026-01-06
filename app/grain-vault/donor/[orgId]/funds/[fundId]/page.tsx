'use client'

/**
 * SPECIFIC FUND VIEW - Donor Transparency Portal
 *
 * Shows detailed information about a specific fund:
 * - Fund purpose/restriction
 * - Current balance
 * - Grants made from this fund
 * - Donor recognition (if not anonymous)
 *
 * Grain & Vault Emerald Theme
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import {
  Shield,
  Heart,
  TrendingUp,
  Users,
  Building2,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  DollarSign,
  Target,
  Award,
  Clock,
  BarChart3,
  Calendar,
  FileText,
  Share2,
  Copy,
  Check,
  ArrowLeft,
  Sparkles,
  Lock,
  AlertCircle,
} from 'lucide-react'
import {
  GlassCard,
  BentoGrid,
  BentoItem,
  ShimmerButton,
  FloatingBadge,
  GlowOrb,
  NoiseOverlay,
  AnimatedText,
  ProgressBar,
  Divider,
} from '@/components/ui/modern'
import {
  DonorPortal,
  DonorPortalOrg,
  DonorPortalEndowment,
  DonorPortalFund,
  DonorPortalGrant,
  DonorRecognition,
  mockDonorPortalData,
} from '@/lib/grain/donor-portal'

export default function FundDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const orgId = params.orgId as string
  const fundId = params.fundId as string
  const isEmbed = searchParams.get('embed') === 'true'

  // State
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<DonorPortalOrg | null>(null)
  const [fund, setFund] = useState<DonorPortalFund | null>(null)
  const [grants, setGrants] = useState<DonorPortalGrant[]>([])
  const [donors, setDonors] = useState<DonorRecognition[]>([])
  const [copied, setCopied] = useState(false)

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        // In production, fetch from API
        // const res = await fetch(`/api/grain/donor-portal/${orgId}/funds/${fundId}`)
        // const data = await res.json()

        // For now, use mock data
        await new Promise(resolve => setTimeout(resolve, 500))
        setOrg(mockDonorPortalData.org)

        // Find specific fund
        const foundFund = mockDonorPortalData.funds.find(f => f.id === fundId)
        setFund(foundFund || mockDonorPortalData.funds[0])

        // Filter grants for this fund
        const fundGrants = mockDonorPortalData.grants.filter(
          g => g.fundId === fundId || g.fundId === mockDonorPortalData.funds[0].id
        )
        setGrants(fundGrants)

        // Set donors
        setDonors(mockDonorPortalData.topDonors)
      } catch (error) {
        console.error('Error loading fund details:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [orgId, fundId])

  // Copy share link
  const handleShare = async () => {
    const url = window.location.href
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center animate-pulse">
            <Target className="w-8 h-8 text-white" />
          </div>
          <div className="text-gray-400">Loading fund details...</div>
        </div>
      </div>
    )
  }

  // Error state
  if (!org || !fund) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <GlassCard padding="lg" className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/20 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold mb-2">Fund Not Found</h1>
          <p className="text-gray-400 mb-6">
            The fund you&apos;re looking for doesn&apos;t exist or has been closed.
          </p>
          <ShimmerButton
            variant="secondary"
            onClick={() => window.location.href = `/grain-vault/donor/${orgId}`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Portal
          </ShimmerButton>
        </GlassCard>
      </div>
    )
  }

  // Calculate progress
  const progress = DonorPortal.calculateFundProgress(fund)

  // Status badge color
  const statusColors = {
    open: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    fully_allocated: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  }

  return (
    <div className={`min-h-screen ${isEmbed ? '' : 'bg-black'} text-white antialiased overflow-x-hidden`}>
      {/* Background Effects */}
      {!isEmbed && (
        <>
          <NoiseOverlay />
          <div className="fixed inset-0 pointer-events-none overflow-hidden">
            <GlowOrb color="green" size="xl" position={{ top: '-200px', left: '20%' }} />
            <GlowOrb color="green" size="lg" position={{ bottom: '10%', right: '-100px' }} animate={false} />
          </div>
        </>
      )}

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        {!isEmbed && (
          <header className="fixed top-0 left-0 right-0 z-50">
            <GlassCard hover={false} padding="none" className="rounded-none border-x-0 border-t-0">
              <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                  <div className="flex items-center gap-4">
                    <Link
                      href={`/grain-vault/donor/${orgId}`}
                      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span className="text-sm">Back to {org.name}</span>
                    </Link>
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleShare}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-4 h-4" />
                          <span>Share</span>
                        </>
                      )}
                    </button>
                    <ShimmerButton
                      size="sm"
                      className="bg-gradient-to-r from-emerald-500 to-emerald-600"
                      onClick={() => window.location.href = `/grain-vault/donate/${orgId}?fund=${fundId}`}
                    >
                      <Heart className="w-4 h-4" />
                      Donate to This Fund
                    </ShimmerButton>
                  </div>
                </div>
              </div>
            </GlassCard>
          </header>
        )}

        {/* Hero Section */}
        <section className={`${isEmbed ? 'pt-8' : 'pt-24'} pb-8 px-6 lg:px-8`}>
          <div className="max-w-5xl mx-auto">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
              <Link href={`/grain-vault/donor/${orgId}`} className="hover:text-white transition-colors">
                {org.name}
              </Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-white">{fund.name}</span>
            </div>

            {/* Fund Header */}
            <div className="flex flex-col md:flex-row items-start gap-6 mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                <Target className="w-8 h-8 text-white" />
              </div>

              <div className="flex-1">
                <div className="flex items-center flex-wrap gap-3 mb-2">
                  <h1 className="text-3xl md:text-4xl font-bold">{fund.name}</h1>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColors[fund.status]}`}>
                    {fund.status === 'open' ? 'Accepting Donations' : fund.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-lg text-gray-400">{fund.description}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Fund Stats */}
        <section className="py-6 px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <BentoGrid cols={3}>
              <BentoItem>
                <GlassCard hover glow="green" padding="lg" className="h-full text-center">
                  <div className="text-3xl font-bold text-emerald-400 mb-1">
                    {DonorPortal.formatCurrency(fund.currentBalance, { compact: true })}
                  </div>
                  <div className="text-sm text-gray-400">Current Balance</div>
                  {fund.targetAmount && (
                    <div className="mt-3">
                      <ProgressBar value={progress.percent} color="green" size="sm" />
                      <div className="text-xs text-gray-500 mt-1">
                        {progress.percent.toFixed(0)}% of {DonorPortal.formatCurrency(fund.targetAmount, { compact: true })} goal
                      </div>
                    </div>
                  )}
                </GlassCard>
              </BentoItem>

              <BentoItem>
                <GlassCard hover glow="green" padding="lg" className="h-full text-center">
                  <div className="text-3xl font-bold text-emerald-400 mb-1">
                    {fund.donorCount}
                  </div>
                  <div className="text-sm text-gray-400">Generous Donors</div>
                  <div className="mt-3 flex items-center justify-center">
                    <div className="flex -space-x-2">
                      {[...Array(Math.min(5, fund.donorCount))].map((_, i) => (
                        <div
                          key={i}
                          className="w-8 h-8 rounded-full bg-emerald-500/30 border-2 border-black flex items-center justify-center text-xs font-bold text-emerald-400"
                        >
                          {String.fromCharCode(65 + i)}
                        </div>
                      ))}
                      {fund.donorCount > 5 && (
                        <div className="w-8 h-8 rounded-full bg-white/10 border-2 border-black flex items-center justify-center text-xs font-bold text-gray-400">
                          +{fund.donorCount - 5}
                        </div>
                      )}
                    </div>
                  </div>
                </GlassCard>
              </BentoItem>

              <BentoItem>
                <GlassCard hover glow="green" padding="lg" className="h-full text-center">
                  <div className="text-3xl font-bold text-emerald-400 mb-1">
                    {fund.grantsCount}
                  </div>
                  <div className="text-sm text-gray-400">Grants Awarded</div>
                  <div className="mt-3 text-sm text-gray-500">
                    {DonorPortal.formatCurrency(fund.totalGrantsMade, { compact: true })} disbursed
                  </div>
                </GlassCard>
              </BentoItem>
            </BentoGrid>
          </div>
        </section>

        {/* Fund Purpose & Restrictions */}
        <section className="py-6 px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Purpose */}
              <GlassCard padding="lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Target className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h2 className="text-xl font-bold">Fund Purpose</h2>
                </div>
                <p className="text-gray-300 leading-relaxed">{fund.purpose}</p>

                {fund.designatedUse && (
                  <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-sm text-emerald-400 font-semibold mb-1">Designated Use</div>
                    <p className="text-gray-300 text-sm">{fund.designatedUse}</p>
                  </div>
                )}
              </GlassCard>

              {/* Restrictions */}
              <GlassCard padding="lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-400" />
                  </div>
                  <h2 className="text-xl font-bold">Fund Restrictions</h2>
                </div>

                {fund.restrictions && fund.restrictions.length > 0 ? (
                  <ul className="space-y-3">
                    {fund.restrictions.map((restriction, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle className="w-4 h-4 text-blue-400" />
                        </div>
                        <span className="text-gray-300">{restriction}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-400">
                    This is an unrestricted fund. Donations may be used at the organization&apos;s
                    discretion to further their mission.
                  </p>
                )}
              </GlassCard>
            </div>
          </div>
        </section>

        {/* Grants from this Fund */}
        <section className="py-6 px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <GlassCard padding="lg">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Grants from This Fund</h2>
                    <p className="text-sm text-gray-400">See the impact your donations make</p>
                  </div>
                </div>
              </div>

              {grants.length > 0 ? (
                <div className="space-y-4">
                  {grants.map((grant, i) => (
                    <div
                      key={grant.id}
                      className="p-5 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/30 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <Award className="w-6 h-6 text-emerald-400" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div>
                              <h3 className="font-semibold text-lg">{grant.recipientName}</h3>
                              {grant.recipientDescription && (
                                <p className="text-sm text-gray-400">{grant.recipientDescription}</p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-xl font-bold text-emerald-400">
                                {DonorPortal.formatCurrency(grant.amount)}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Clock className="w-3 h-3" />
                                {DonorPortal.formatDate(grant.createdAt)}
                              </div>
                            </div>
                          </div>

                          <p className="text-gray-300 mb-3">{grant.purpose}</p>

                          {grant.impactDescription && (
                            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-1">
                                <Sparkles className="w-4 h-4" />
                                Impact
                              </div>
                              <p className="text-sm text-gray-300">{grant.impactDescription}</p>
                            </div>
                          )}

                          {/* Status Badge */}
                          <div className="mt-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              grant.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : grant.status === 'disbursed'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              <CheckCircle className="w-3 h-3" />
                              {grant.status.charAt(0).toUpperCase() + grant.status.slice(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                    <Heart className="w-8 h-8 text-gray-500" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Grants Yet</h3>
                  <p className="text-gray-400 max-w-md mx-auto">
                    This fund is still building. Be one of the first to contribute and
                    help make the first grant possible.
                  </p>
                </div>
              )}
            </GlassCard>
          </div>
        </section>

        {/* Donor Recognition */}
        <section className="py-6 px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <GlassCard padding="lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Award className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Donor Recognition</h2>
                  <p className="text-sm text-gray-400">Thank you to our generous supporters</p>
                </div>
              </div>

              {/* Tier Legend */}
              <div className="flex flex-wrap gap-4 mb-6 p-4 rounded-xl bg-white/5">
                {(['founding', 'champion', 'sustaining', 'supporter', 'friend'] as const).map(tier => {
                  const info = DonorPortal.getTierInfo(tier)
                  return (
                    <div key={tier} className="flex items-center gap-2 text-sm">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: info.color }}
                      />
                      <span className="text-gray-400">{info.name}</span>
                    </div>
                  )
                })}
              </div>

              {/* Donor List */}
              <div className="grid md:grid-cols-2 gap-4">
                {donors.map((donor) => {
                  const tierInfo = DonorPortal.getTierInfo(donor.tier)
                  return (
                    <div
                      key={donor.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10"
                    >
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${tierInfo.color}20` }}
                      >
                        {donor.isAnonymous ? (
                          <Lock className="w-5 h-5 text-gray-400" />
                        ) : (
                          <span className="text-xl font-bold" style={{ color: tierInfo.color }}>
                            {donor.displayName.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{donor.displayName}</span>
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                            style={{
                              backgroundColor: `${tierInfo.color}20`,
                              color: tierInfo.color,
                            }}
                          >
                            {tierInfo.name}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400">
                          {DonorPortal.timeAgo(donor.donatedAt)}
                        </div>
                      </div>
                      <div className="font-bold text-emerald-400 flex-shrink-0">
                        {DonorPortal.formatCurrency(donor.amount, { compact: true })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Call to Join */}
              <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20 text-center">
                <p className="text-gray-300 mb-3">
                  Join these generous donors in making a difference.
                </p>
                <ShimmerButton
                  size="sm"
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600"
                  onClick={() => window.location.href = `/grain-vault/donate/${orgId}?fund=${fundId}`}
                >
                  <Heart className="w-4 h-4" />
                  Donate to This Fund
                </ShimmerButton>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Fund Protection */}
        <section className="py-6 px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <GlassCard padding="lg" glow="green">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold">Fund Protection</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-300 mb-4">
                    All donations to this fund are protected by Grain & Vault&apos;s treasury infrastructure.
                    Your contribution is 100% protected and can only be used for its designated purpose.
                  </p>
                  <ul className="space-y-2">
                    {[
                      '100% of your donation is protected',
                      'Funds can only be used for designated purpose',
                      'Real-time transparency on fund usage',
                      'Withdraw-protected principal guarantee',
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-400">
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-black/30 rounded-xl p-6 border border-emerald-500/20">
                  <div className="text-sm text-gray-400 mb-2">Protection Status</div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xl font-bold text-emerald-400">Fully Protected</span>
                  </div>
                  <div className="text-sm text-gray-400">
                    This fund is backed by Grain & Vault&apos;s 100% collateralized treasury.
                    All donations are safe and secure.
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* CTA */}
        <section className="py-12 px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-600" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />

              <div className="relative p-10 md:p-12 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-black/20 flex items-center justify-center">
                  <Heart className="w-7 h-7 text-white" />
                </div>

                <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                  Support {fund.name}
                </h2>
                <p className="text-lg text-white/80 mb-6 max-w-xl mx-auto">
                  Your donation is 100% protected and will directly support {fund.purpose.toLowerCase()}.
                </p>

                {fund.targetAmount && progress.remaining > 0 && (
                  <div className="mb-6 p-4 rounded-xl bg-black/20 inline-block">
                    <span className="text-white/80">Only </span>
                    <span className="text-white font-bold">
                      {DonorPortal.formatCurrency(progress.remaining, { compact: true })}
                    </span>
                    <span className="text-white/80"> left to reach our goal!</span>
                  </div>
                )}

                <button
                  onClick={() => window.location.href = `/grain-vault/donate/${orgId}?fund=${fundId}`}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-900 transition-all hover:scale-105"
                >
                  <Heart className="w-5 h-5" />
                  Donate Now
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        {!isEmbed && (
          <footer className="py-8 px-6 lg:px-8 border-t border-white/10">
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
              <Link
                href={`/grain-vault/donor/${orgId}`}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to {org.name}
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <div className="w-3 h-3 bg-black rounded-sm" />
                </div>
                <span className="text-sm text-gray-400">
                  Powered by <span className="text-white font-medium">Grain & Vault</span>
                </span>
              </div>
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}
