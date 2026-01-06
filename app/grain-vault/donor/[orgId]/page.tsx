'use client'

/**
 * DONOR TRANSPARENCY PORTAL - Public View
 *
 * A beautiful, confidence-inspiring portal that shows donors:
 * - Organization overview
 * - Total endowment size (protected)
 * - How funds are being used (grants)
 * - Impact metrics
 * - Fund protection explanation
 * - Option to donate more
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
  CheckCircle,
  DollarSign,
  Target,
  Award,
  Clock,
  BarChart3,
  PieChart,
  Sparkles,
  Lock,
  Globe,
  Twitter,
  Linkedin,
  Facebook,
  Share2,
  Copy,
  Check,
} from 'lucide-react'
import {
  GlassCard,
  BentoGrid,
  BentoItem,
  ShimmerButton,
  FloatingBadge,
  MetricCard,
  GlowOrb,
  NoiseOverlay,
  AnimatedText,
  ProgressBar,
} from '@/components/ui/modern'
import {
  DonorPortal,
  DonorPortalOrg,
  DonorPortalEndowment,
  DonorPortalFund,
  DonorPortalGrant,
  DonorRecognition,
  ImpactMetrics,
  mockDonorPortalData,
} from '@/lib/grain/donor-portal'

export default function DonorPortalPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const orgId = params.orgId as string
  const isEmbed = searchParams.get('embed') === 'true'
  const theme = searchParams.get('theme') || 'dark'

  // State
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<DonorPortalOrg | null>(null)
  const [endowment, setEndowment] = useState<DonorPortalEndowment | null>(null)
  const [funds, setFunds] = useState<DonorPortalFund[]>([])
  const [grants, setGrants] = useState<DonorPortalGrant[]>([])
  const [topDonors, setTopDonors] = useState<DonorRecognition[]>([])
  const [impactMetrics, setImpactMetrics] = useState<ImpactMetrics | null>(null)
  const [copied, setCopied] = useState(false)

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        // In production, fetch from API
        // const res = await fetch(`/api/grain/donor-portal/${orgId}`)
        // const data = await res.json()

        // For now, use mock data
        await new Promise(resolve => setTimeout(resolve, 500)) // Simulate loading
        setOrg(mockDonorPortalData.org)
        setEndowment(mockDonorPortalData.endowment)
        setFunds(mockDonorPortalData.funds)
        setGrants(mockDonorPortalData.grants)
        setTopDonors(mockDonorPortalData.topDonors)

        // Calculate impact metrics
        const donations = mockDonorPortalData.topDonors.map(d => ({
          amount: d.amount,
          donorId: d.id,
          date: d.donatedAt,
        }))
        const metrics = DonorPortal.calculateImpactMetrics(
          [mockDonorPortalData.endowment],
          mockDonorPortalData.funds,
          mockDonorPortalData.grants,
          donations
        )
        setImpactMetrics(metrics)
      } catch (error) {
        console.error('Error loading donor portal:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [orgId])

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
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div className="text-gray-400">Loading transparency portal...</div>
        </div>
      </div>
    )
  }

  // Error state
  if (!org || !endowment) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <GlassCard padding="lg" className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/20 flex items-center justify-center">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold mb-2">Organization Not Found</h1>
          <p className="text-gray-400 mb-6">
            The transparency portal you&apos;re looking for doesn&apos;t exist or has been disabled.
          </p>
          <ShimmerButton
            variant="secondary"
            onClick={() => window.location.href = '/grain-vault'}
          >
            Go to Grain & Vault
          </ShimmerButton>
        </GlassCard>
      </div>
    )
  }

  // Protection explanation
  const protection = DonorPortal.generateProtectionExplanation(endowment)

  // Fund usage breakdown
  const fundUsage = DonorPortal.generateFundUsageBreakdown(grants)

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
                  <Link href="/grain-vault" className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                        <div className="w-4 h-4 bg-black rounded-sm" />
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-sm" />
                    </div>
                    <span className="text-lg font-semibold tracking-tight text-gray-400">
                      Grain & Vault
                    </span>
                  </Link>

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
                      onClick={() => window.location.href = `/grain-vault/donate/${orgId}`}
                    >
                      <Heart className="w-4 h-4" />
                      Donate Now
                    </ShimmerButton>
                  </div>
                </div>
              </div>
            </GlassCard>
          </header>
        )}

        {/* Hero Section */}
        <section className={`${isEmbed ? 'pt-8' : 'pt-24'} pb-12 px-6 lg:px-8`}>
          <div className="max-w-6xl mx-auto">
            {/* Organization Header */}
            <div className="flex flex-col md:flex-row items-start gap-6 mb-8">
              {/* Logo */}
              {org.logoUrl ? (
                <img
                  src={org.logoUrl}
                  alt={org.name}
                  className="w-20 h-20 rounded-2xl object-cover border border-white/10"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <Building2 className="w-10 h-10 text-white" />
                </div>
              )}

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl md:text-4xl font-bold">{org.name}</h1>
                  {org.verified && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-emerald-400 font-medium">Verified</span>
                    </div>
                  )}
                </div>
                <p className="text-lg text-gray-400 mb-4">{org.mission}</p>

                {/* Social Links */}
                <div className="flex items-center gap-3">
                  {org.website && (
                    <a
                      href={org.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      <Globe className="w-4 h-4" />
                      Website
                    </a>
                  )}
                  {org.socialLinks?.twitter && (
                    <a href={org.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                      <Twitter className="w-4 h-4" />
                    </a>
                  )}
                  {org.socialLinks?.linkedin && (
                    <a href={org.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                      <Linkedin className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Transparency Badge */}
            <FloatingBadge color="green">
              <Shield className="w-4 h-4" />
              Transparent Giving - Powered by Grain & Vault
            </FloatingBadge>
          </div>
        </section>

        {/* Main Stats */}
        <section className="py-8 px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <BentoGrid cols={4}>
              <BentoItem>
                <GlassCard hover glow="green" padding="lg" className="h-full text-center">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Shield className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-bold text-emerald-400 mb-1">
                    {DonorPortal.formatCurrency(endowment.protectedPrincipal, { compact: true })}
                  </div>
                  <div className="text-sm text-gray-400">Protected Principal</div>
                </GlassCard>
              </BentoItem>

              <BentoItem>
                <GlassCard hover glow="green" padding="lg" className="h-full text-center">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <TrendingUp className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-bold text-emerald-400 mb-1">
                    {DonorPortal.formatCurrency(endowment.totalValue, { compact: true })}
                  </div>
                  <div className="text-sm text-gray-400">Total Endowment Value</div>
                </GlassCard>
              </BentoItem>

              <BentoItem>
                <GlassCard hover glow="green" padding="lg" className="h-full text-center">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Heart className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-bold text-emerald-400 mb-1">
                    {DonorPortal.formatCurrency(endowment.totalGrants, { compact: true })}
                  </div>
                  <div className="text-sm text-gray-400">Total Grants Made</div>
                </GlassCard>
              </BentoItem>

              <BentoItem>
                <GlassCard hover glow="green" padding="lg" className="h-full text-center">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-bold text-emerald-400 mb-1">
                    +{endowment.appreciationPercent}%
                  </div>
                  <div className="text-sm text-gray-400">Appreciation Earned</div>
                </GlassCard>
              </BentoItem>
            </BentoGrid>
          </div>
        </section>

        {/* Fund Protection Section */}
        <section className="py-8 px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <GlassCard glow="green" padding="lg">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">{protection.title}</h2>
                  <p className="text-gray-400">
                    Your donations are protected by Grain & Vault&apos;s treasury infrastructure.
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Protection Points */}
                <div className="space-y-4">
                  {protection.points.map((point, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className="text-gray-300">{point}</span>
                    </div>
                  ))}
                </div>

                {/* Coverage Visual */}
                <div className="bg-black/30 rounded-xl p-6 border border-emerald-500/20">
                  <div className="text-sm text-gray-400 mb-2">Protection Coverage</div>
                  <div className="text-4xl font-bold text-emerald-400 mb-4">
                    {(protection.coverage * 100).toFixed(0)}%
                  </div>
                  <ProgressBar
                    value={protection.coverage * 100}
                    max={150}
                    color="green"
                    showValue={false}
                    size="lg"
                  />
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>0%</span>
                    <span className="text-emerald-400">100% Protected</span>
                    <span>150%</span>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-emerald-400 font-medium">
                      {protection.status === 'fully_protected' ? 'Fully Protected' : 'Protected'}
                    </span>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* How Funds Are Used */}
        <section className="py-8 px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-1">How Funds Are Being Used</h2>
                <p className="text-gray-400">Transparent breakdown of grants and programs</p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Usage Breakdown */}
              <GlassCard padding="lg">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-emerald-400" />
                  Grant Categories
                </h3>
                <div className="space-y-4">
                  {fundUsage.map((category, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-400">{category.category}</span>
                        <span className="text-sm font-medium">
                          {DonorPortal.formatCurrency(category.amount, { compact: true })}
                        </span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${category.percent}%`,
                            backgroundColor: category.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Recent Grants */}
              <div className="md:col-span-2">
                <GlassCard padding="lg">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Heart className="w-5 h-5 text-emerald-400" />
                    Recent Grants
                  </h3>
                  <div className="space-y-4">
                    {grants.slice(0, 5).map((grant) => (
                      <div
                        key={grant.id}
                        className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10"
                      >
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <Award className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="font-semibold">{grant.recipientName}</div>
                              <div className="text-sm text-gray-400">{grant.purpose}</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="font-bold text-emerald-400">
                                {DonorPortal.formatCurrency(grant.amount)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {DonorPortal.timeAgo(grant.createdAt)}
                              </div>
                            </div>
                          </div>
                          {grant.impactDescription && (
                            <div className="mt-2 text-sm text-gray-400 italic">
                              &quot;{grant.impactDescription}&quot;
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>
            </div>
          </div>
        </section>

        {/* Available Funds */}
        <section className="py-8 px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-1">Giving Opportunities</h2>
                <p className="text-gray-400">Choose a fund that aligns with your values</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {funds.map((fund) => {
                const progress = DonorPortal.calculateFundProgress(fund)
                return (
                  <Link
                    key={fund.id}
                    href={`/grain-vault/donor/${orgId}/funds/${fund.id}`}
                    className="block group"
                  >
                    <GlassCard hover glow="green" padding="lg" className="h-full">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                          <Target className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          fund.status === 'open'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {fund.status === 'open' ? 'Accepting Donations' : fund.status}
                        </div>
                      </div>

                      <h3 className="text-xl font-bold mb-2 group-hover:text-emerald-400 transition-colors">
                        {fund.name}
                      </h3>
                      <p className="text-sm text-gray-400 mb-4">{fund.description}</p>

                      {/* Progress */}
                      {fund.targetAmount && (
                        <div className="mb-4">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-400">Progress</span>
                            <span className="font-medium">
                              {DonorPortal.formatCurrency(fund.currentBalance, { compact: true })} / {DonorPortal.formatCurrency(fund.targetAmount, { compact: true })}
                            </span>
                          </div>
                          <ProgressBar
                            value={progress.percent}
                            color="green"
                            showValue={false}
                          />
                        </div>
                      )}

                      {/* Stats */}
                      <div className="flex items-center gap-6 text-sm text-gray-400">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {fund.donorCount} donors
                        </div>
                        <div className="flex items-center gap-1">
                          <Heart className="w-4 h-4" />
                          {fund.grantsCount} grants
                        </div>
                      </div>

                      {/* View More Arrow */}
                      <div className="mt-4 flex items-center text-emerald-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
                        View Fund Details
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </div>
                    </GlassCard>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        {/* Impact Metrics */}
        {impactMetrics && (
          <section className="py-8 px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
              <GlassCard padding="lg">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-emerald-400" />
                  Impact Dashboard
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-emerald-400">
                      {impactMetrics.grantsCount}
                    </div>
                    <div className="text-sm text-gray-400">Grants Awarded</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-emerald-400">
                      {impactMetrics.donorCount}
                    </div>
                    <div className="text-sm text-gray-400">Total Donors</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-emerald-400">
                      {DonorPortal.formatCurrency(impactMetrics.averageGiftSize, { compact: true })}
                    </div>
                    <div className="text-sm text-gray-400">Average Gift</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-emerald-400">
                      {(impactMetrics.grantEfficiency * 100).toFixed(0)}%
                    </div>
                    <div className="text-sm text-gray-400">To Programs</div>
                  </div>
                </div>

                {/* This Year */}
                <div className="mt-8 pt-6 border-t border-white/10">
                  <h3 className="text-lg font-semibold mb-4">This Year</h3>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="bg-emerald-500/10 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-emerald-400">
                        {DonorPortal.formatCurrency(impactMetrics.thisYear.raised, { compact: true })}
                      </div>
                      <div className="text-sm text-gray-400">Raised</div>
                    </div>
                    <div className="bg-emerald-500/10 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-emerald-400">
                        {DonorPortal.formatCurrency(impactMetrics.thisYear.granted, { compact: true })}
                      </div>
                      <div className="text-sm text-gray-400">Granted</div>
                    </div>
                    <div className="bg-emerald-500/10 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-emerald-400">
                        {impactMetrics.thisYear.newDonors}
                      </div>
                      <div className="text-sm text-gray-400">New Donors</div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          </section>
        )}

        {/* Donor Recognition */}
        <section className="py-8 px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <GlassCard padding="lg">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Award className="w-6 h-6 text-emerald-400" />
                Donor Recognition
              </h2>

              <div className="space-y-4">
                {topDonors.map((donor) => {
                  const tierInfo = DonorPortal.getTierInfo(donor.tier)
                  return (
                    <div
                      key={donor.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10"
                    >
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${tierInfo.color}20` }}
                      >
                        <span className="text-xl font-bold" style={{ color: tierInfo.color }}>
                          {donor.displayName.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{donor.displayName}</span>
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${tierInfo.color}20`,
                              color: tierInfo.color,
                            }}
                          >
                            {tierInfo.name}
                          </span>
                        </div>
                        {donor.message && (
                          <p className="text-sm text-gray-400 mt-1 italic">&quot;{donor.message}&quot;</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-400">
                          {DonorPortal.formatCurrency(donor.amount, { compact: true })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {DonorPortal.timeAgo(donor.donatedAt)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Donate CTA */}
        <section className="py-12 px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-600" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />

              <div className="relative p-12 md:p-16 text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-black/20 flex items-center justify-center">
                  <Heart className="w-8 h-8 text-white" />
                </div>

                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Join Our Community of Givers
                </h2>
                <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
                  Your donation is 100% protected and will make a lasting impact.
                  Every dollar grows through Grain & Vault&apos;s appreciation engine.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={() => window.location.href = `/grain-vault/donate/${orgId}`}
                    className="inline-flex items-center gap-3 px-8 py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-900 transition-all hover:scale-105"
                  >
                    <Heart className="w-5 h-5" />
                    Make a Donation
                  </button>
                  <button
                    onClick={handleShare}
                    className="inline-flex items-center gap-2 px-6 py-4 bg-white/20 text-white rounded-xl font-semibold hover:bg-white/30 transition-all"
                  >
                    <Share2 className="w-5 h-5" />
                    Share This Page
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        {!isEmbed && (
          <footer className="py-8 px-6 lg:px-8 border-t border-white/10">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <div className="w-3 h-3 bg-black rounded-sm" />
                </div>
                <span className="text-sm text-gray-400">
                  Powered by <span className="text-white font-medium">Grain & Vault</span>
                </span>
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-400">
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  100% Protected
                </span>
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-500" />
                  Transparent
                </span>
              </div>
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}
