'use client'

/**
 * Wells Onyx Landing Page - Redesigned 2025
 * wellsonyx.io
 *
 * AI-powered B2B commerce platform
 * Just tell Wells what you need. Get it done.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Rocket,
  ShoppingCart,
  Store,
  Briefcase,
  ArrowRight,
  CheckCircle,
  MessageSquare,
  Zap,
  Sparkles,
  Shield,
  TrendingUp,
  Users,
  Clock,
  DollarSign,
  ChevronRight,
  Target,
  Lock,
  Handshake,
  Percent,
  Search,
  FileCheck,
  BadgeCheck
} from 'lucide-react'

const JOURNEYS = [
  {
    icon: Rocket,
    title: 'Founder',
    tagline: '"I need to hire a CTO"',
    description: 'Tell Wells what you\'re building. Get matched with talent, suppliers, customers, and investors.',
    outcomes: [
      'Say "I need a fractional CFO" → get 3 qualified candidates',
      'Say "Source 1000 units" → get 5 supplier quotes',
      'Say "Find enterprise customers" → get warm intros'
    ],
    cta: 'Talk to Wells',
    href: '/founder/chat',
    gradient: 'from-amber-500 via-orange-500 to-red-500'
  },
  {
    icon: ShoppingCart,
    title: 'Buyer',
    tagline: '"I need industrial equipment"',
    description: 'Describe what you need. Wells writes the RFQ, finds suppliers, and handles escrow.',
    outcomes: [
      '"Need 50 motors" → RFQ sent to verified suppliers',
      'Compare quotes side-by-side in 24 hours',
      'One click to accept → money escrowed instantly'
    ],
    cta: 'Start Sourcing',
    href: '/buyer/chat',
    gradient: 'from-blue-500 via-cyan-500 to-teal-500'
  },
  {
    icon: Store,
    title: 'Seller',
    tagline: '"Send me qualified leads"',
    description: 'Register your catalog. Wells matches you with buyers. Win more business.',
    outcomes: [
      'Wake up to qualified RFQs matching your products',
      'One-tap quote submission from your phone',
      'Get paid instantly via secure escrow'
    ],
    cta: 'Join as Seller',
    href: '/suppliers/join',
    gradient: 'from-green-500 via-emerald-500 to-teal-500'
  },
  {
    icon: Briefcase,
    title: 'Jobs',
    tagline: '"I\'m looking for VP roles"',
    description: 'Tell Wells your ideal role. Get matched with companies actually hiring.',
    outcomes: [
      '"Looking for remote eng roles" → matched with 5 companies',
      'Direct intro to hiring managers (no HR filter)',
      'Salary negotiation guidance included'
    ],
    cta: 'Find Your Role',
    href: '/jobs/chat',
    gradient: 'from-purple-500 via-pink-500 to-rose-500'
  }
]

const TRUST_METRICS = [
  { icon: TrendingUp, value: '$2.3M+', label: 'Deals Closed' },
  { icon: Users, value: '500+', label: 'Active Users' },
  { icon: Clock, value: '< 48h', label: 'Avg. Response Time' },
  { icon: Shield, value: '1%', label: 'Simple Fee' }
]

const FEATURES = [
  {
    icon: Target,
    title: 'AI-Powered Matching',
    description: 'Advanced algorithms analyze your needs and match you with the perfect suppliers, candidates, or customers in seconds.',
    gradient: 'from-blue-500 to-cyan-500'
  },
  {
    icon: Lock,
    title: 'Escrow Protection',
    description: 'Built-in secure escrow ensures safe payments for both buyers and sellers. Money released only when you\'re satisfied.',
    gradient: 'from-green-500 to-emerald-500'
  },
  {
    icon: Handshake,
    title: 'Real-Time Negotiation',
    description: 'Negotiate terms, pricing, and delivery in real-time with AI assistance. Close deals faster with smart suggestions.',
    gradient: 'from-purple-500 to-pink-500'
  },
  {
    icon: Percent,
    title: 'Only 1% on Success',
    description: 'No upfront costs, no subscriptions. Pay only 1% when you successfully close a deal. Free to browse and quote.',
    gradient: 'from-amber-500 to-orange-500'
  },
  {
    icon: MessageSquare,
    title: 'Natural Language',
    description: 'Talk to Wells like you would a colleague. No forms, no templates, no complexity. Just conversation.',
    gradient: 'from-teal-500 to-cyan-500'
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Get matched and receive quotes within 24-48 hours. Close deals in days, not months with automated workflows.',
    gradient: 'from-yellow-500 to-amber-500'
  },
  {
    icon: BadgeCheck,
    title: 'Verified Network',
    description: 'Every supplier and professional is verified. Access a trusted network of quality partners and talent.',
    gradient: 'from-indigo-500 to-purple-500'
  },
  {
    icon: FileCheck,
    title: 'Automated Compliance',
    description: 'Legal docs, contracts, and compliance handled automatically. Focus on your business, not paperwork.',
    gradient: 'from-rose-500 to-red-500'
  }
]

// Live Dashboard Component - shows real signups or forward-looking message
function LiveDashboardSection() {
  const [data, setData] = useState<{
    liveMetrics: { totalVolume: string; activeUsers: string; avgResponseTime: string; successFee: string }
    recentCompanies: { name: string; abbr: string; joinedAt: string }[] | null
    isLive: boolean
  } | null>(null)

  useEffect(() => {
    fetch('/api/stats/live')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetch('/api/stats/live')
        .then(r => r.json())
        .then(setData)
        .catch(() => {})
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const metrics = data?.liveMetrics || {
    totalVolume: '$2.3M+',
    activeUsers: '500+',
    avgResponseTime: '< 48h',
    successFee: '1%'
  }

  return (
    <section className="container mx-auto px-4 lg:px-8 py-16 md:py-24">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-sm font-semibold mb-4">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {data?.isLive ? 'Live Platform Activity' : 'Early Access Open'}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white/90">
            {data?.isLive ? 'Companies Building with Wells' : 'Be Among the First'}
          </h2>
          <p className="text-gray-400 mt-3 max-w-2xl mx-auto">
            {data?.isLive
              ? 'Real-time activity from businesses using Wells AI to close deals faster'
              : 'Join innovative companies already discovering the power of AI-driven commerce'}
          </p>
        </div>

        {/* Companies Grid or Early Access CTA */}
        <div className="mb-16">
          {data?.isLive && data.recentCompanies ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {data.recentCompanies.map((company, index) => (
                <div
                  key={index}
                  className="group relative bg-white/[0.02] border border-white/10 rounded-xl p-6 hover:bg-white/[0.05] hover:border-green-500/30 transition-all duration-300 backdrop-blur-sm"
                >
                  <div className="absolute top-3 right-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  </div>
                  <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 flex items-center justify-center">
                    <span className="text-lg font-bold text-amber-400">{company.abbr}</span>
                  </div>
                  <p className="text-sm text-white font-medium text-center">{company.name}</p>
                  <p className="text-xs text-gray-500 text-center mt-1">Just joined</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="relative bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/10 border border-amber-500/20 rounded-2xl p-8 md:p-12 text-center overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.1),transparent_70%)]" />
              <div className="relative">
                <Rocket className="w-16 h-16 mx-auto mb-6 text-amber-400" />
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                  Early Access is Open
                </h3>
                <p className="text-gray-400 mb-8 max-w-xl mx-auto">
                  Be among the first to experience AI-powered B2B commerce. No waitlist, no credit card required.
                  Start talking to Wells today and close your first deal.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    href="/founder/chat"
                    className="px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-black rounded-xl font-bold text-lg hover:from-amber-400 hover:to-amber-500 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/50"
                  >
                    Start Free Today
                  </Link>
                  <div className="text-sm text-gray-500">
                    No commitment • 1% only on closed deals
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Metrics Dashboard */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 blur-3xl -z-10" />
          <div className="relative bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 rounded-2xl p-8 md:p-12 backdrop-blur-xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
              {[
                { icon: DollarSign, stat: metrics.totalVolume, label: 'Deal Pipeline', description: 'Active opportunities' },
                { icon: Users, stat: metrics.activeUsers, label: 'Active Users', description: 'And growing daily' },
                { icon: Clock, stat: metrics.avgResponseTime, label: 'Avg Response', description: 'Quote turnaround' },
                { icon: TrendingUp, stat: metrics.successFee, label: 'Success Fee', description: 'Pay only when you win' }
              ].map((item, index) => (
                <div key={index} className="text-center group cursor-default">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 flex items-center justify-center group-hover:scale-110 transition-all">
                    <item.icon className="w-7 h-7 text-amber-400" />
                  </div>
                  <div className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-br from-white via-white to-gray-400 bg-clip-text text-transparent">
                    {item.stat}
                  </div>
                  <div className="text-sm md:text-base font-semibold text-white mb-1">{item.label}</div>
                  <div className="text-xs text-gray-500">{item.description}</div>
                </div>
              ))}
            </div>
            <div className="mt-10 pt-8 border-t border-white/10">
              <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 text-gray-400 text-sm">
                <span className="inline-flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-500" />
                  Enterprise-grade security
                </span>
                <span className="hidden md:inline text-gray-600">•</span>
                <span className="inline-flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Built-in escrow protection
                </span>
                <span className="hidden md:inline text-gray-600">•</span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-amber-500" />
                  99.9% uptime SLA
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function WellsOnyxHome() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      {/* Gradient Overlay Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(251,191,36,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(251,191,36,0.05),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,black,transparent_20%,transparent_80%,black)]" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/10 glass sticky top-0 z-50 shadow-xl">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/40 transition-all group-hover:scale-110">
                  <Sparkles className="w-5 h-5 text-black" />
                </div>
                <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">WellsAI</span>
              </Link>

              <nav className="hidden md:flex items-center gap-8">
                <Link href="#journeys" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                  Journeys
                </Link>
                <Link href="#how-it-works" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                  How It Works
                </Link>
                <Link href="#pricing" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                  Pricing
                </Link>
                <Link
                  href="/admin/leads"
                  className="text-sm font-medium text-gray-400 hover:text-amber-500 transition-colors"
                >
                  Admin
                </Link>
                <Link
                  href="/founder/chat"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black rounded-lg font-semibold text-sm hover:from-amber-400 hover:to-amber-500 transition-all hover:scale-105 hover:shadow-xl hover:shadow-amber-500/50 active:scale-95"
                >
                  Get Started
                </Link>
              </nav>

              {/* Mobile Menu Button */}
              <div className="md:hidden flex items-center gap-3">
                <Link
                  href="/admin/leads"
                  className="text-sm font-medium text-gray-400 hover:text-amber-500 transition-colors"
                >
                  Admin
                </Link>
                <Link
                  href="/founder/chat"
                  className="px-4 py-2 bg-amber-500 text-black rounded-lg font-semibold text-sm"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="container mx-auto px-4 lg:px-8 pt-20 pb-32 md:pt-32 md:pb-40 relative overflow-hidden">
          {/* Dramatic ambient lighting effects */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Primary glow - top center */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-amber-500/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
            {/* Secondary glow - bottom left */}
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-orange-500/10 rounded-full blur-[100px]" />
            {/* Accent glow - right */}
            <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-amber-400/10 rounded-full blur-[80px]" />
            {/* Radial gradient overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.3)_100%)]" />
          </div>

          <div className="max-w-5xl mx-auto text-center relative">
            {/* Floating particles effect */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 bg-amber-400/30 rounded-full"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animation: `float ${5 + Math.random() * 10}s ease-in-out infinite`,
                    animationDelay: `${Math.random() * 5}s`,
                  }}
                />
              ))}
            </div>

            {/* Badge with pulse effect */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-sm font-semibold mb-8 backdrop-blur-sm shadow-lg shadow-amber-500/10 relative group animate-pulse" style={{ animationDuration: '3s' }}>
              <div className="absolute inset-0 rounded-full bg-amber-500/5 blur-xl group-hover:bg-amber-500/10 transition-colors" />
              <Sparkles className="w-4 h-4 relative z-10" />
              <span className="relative z-10">AI That Actually Does Things</span>
            </div>

            {/* Headline with enhanced gradient and glow */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight relative">
              <span className="block bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent drop-shadow-2xl">
                Talk to Wells.
              </span>
              <span className="block relative">
                <span className="absolute inset-0 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent blur-2xl opacity-50" aria-hidden="true">
                  Get It Done.
                </span>
                <span className="relative bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                  Get It Done.
                </span>
              </span>
            </h1>

            {/* Compelling subheadline */}
            <p className="text-xl md:text-2xl text-gray-400 mb-3 max-w-3xl mx-auto leading-relaxed">
              Need to hire? Source suppliers? Find customers? Close deals?
            </p>
            <p className="text-2xl md:text-3xl text-white font-semibold mb-4 bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              Just tell Wells what you need.
            </p>
            <p className="text-lg text-gray-500 mb-12 max-w-2xl mx-auto">
              AI-powered B2B commerce that turns conversations into closed deals.
            </p>

            {/* Premium CTA Buttons with gradients and shadows */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link
                href="/founder/chat"
                className="group relative px-8 py-4 bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-black rounded-xl font-bold text-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-2xl shadow-amber-500/30 hover:shadow-amber-500/50 overflow-hidden"
              >
                {/* Shimmer effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <span className="relative z-10">Talk to Wells Now</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform relative z-10" />
              </Link>
              <Link
                href="/demo"
                className="group relative px-8 py-4 bg-white/5 border border-white/10 rounded-xl font-semibold text-lg hover:bg-white/10 hover:border-white/20 transition-all backdrop-blur-sm hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl overflow-hidden"
              >
                {/* Subtle gradient on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative z-10">See What Wells Can Do</span>
              </Link>
            </div>

            {/* Launch indicator */}
            <div className="flex items-center justify-center gap-6 mb-16 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-amber-500" />
                <span>Now in Early Access</span>
              </div>
              <div className="hidden sm:block w-px h-4 bg-white/10" />
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-lg shadow-green-500/50 animate-pulse" style={{ animationDuration: '2s' }} />
                <span>Live support 24/7</span>
              </div>
            </div>

            {/* Enhanced Trust Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto">
              {TRUST_METRICS.map((metric, index) => (
                <div key={index} className="relative group cursor-pointer">
                  {/* Glow effect on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-amber-500/0 group-hover:from-amber-500/10 group-hover:to-orange-500/10 rounded-xl blur-xl transition-all duration-500" />
                  {/* Card */}
                  <div className="relative card-premium p-6 group-hover:scale-105 transition-all duration-300">
                    {/* Animated border on hover */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-500/0 via-amber-500/50 to-amber-500/0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ padding: '1px', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude' }} />
                    <metric.icon className="w-6 h-6 text-amber-500 mb-3 mx-auto group-hover:scale-110 group-hover:text-amber-400 transition-all drop-shadow-lg" />
                    <div className="text-2xl md:text-3xl font-bold text-white mb-1 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent group-hover:from-amber-400 group-hover:to-amber-500 transition-all">{metric.value}</div>
                    <div className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">{metric.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* Live Dashboard / Early Access Section */}
        <LiveDashboardSection />
        {/* Journeys Section */}
        <section id="journeys" className="container mx-auto px-4 lg:px-8 py-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
              What Do You Need?
            </h2>
            <p className="text-xl text-gray-400">Tell Wells. Watch it happen.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-7xl mx-auto">
            {JOURNEYS.map((journey, index) => (
              <Link
                key={index}
                href={journey.href}
                className="group relative bg-gradient-to-b from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-8 hover:border-white/20 hover:from-white/10 hover:to-white/5 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02]"
              >
                {/* Gradient Accent */}
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${journey.gradient} rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity shadow-lg`} />

                {/* Ambient glow on hover */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${journey.gradient} opacity-0 group-hover:opacity-5 blur-xl transition-opacity pointer-events-none`} />

                {/* Icon */}
                <div className={`relative w-14 h-14 rounded-xl bg-gradient-to-br ${journey.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg group-hover:shadow-xl`}>
                  <journey.icon className="w-7 h-7 text-white" />
                </div>

                {/* Content */}
                <div className="mb-6">
                  <h3 className="text-2xl font-bold mb-2 group-hover:text-amber-400 transition-colors">
                    {journey.title}
                  </h3>
                  <p className="text-amber-400 text-sm font-semibold mb-4">{journey.tagline}</p>
                  <p className="text-gray-400 leading-relaxed">{journey.description}</p>
                </div>

                {/* Outcomes */}
                <ul className="space-y-3 mb-8">
                  {journey.outcomes.map((outcome, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-gray-300">
                      <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="flex items-center justify-between text-amber-400 font-semibold group-hover:text-amber-300 transition-colors">
                  <span>{journey.cta}</span>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Features Section - Premium */}
        <section className="container mx-auto px-4 lg:px-8 py-24 relative overflow-hidden">
          {/* Background Accent */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative">
            <div className="text-center mb-20">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-sm font-semibold mb-6 backdrop-blur-sm">
                <Sparkles className="w-4 h-4" />
                Platform Features
              </div>
              <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
                <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  Everything You Need
                </span>
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                Powerful AI-driven tools to streamline your entire business workflow
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {FEATURES.map((feature, index) => (
                <div
                  key={index}
                  className="group relative bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 rounded-2xl p-8 hover:border-white/20 hover:from-white/10 hover:to-white/5 transition-all duration-500 cursor-pointer overflow-hidden"
                  style={{
                    animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`
                  }}
                >
                  {/* Gradient Glow on Hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 blur-2xl transition-all duration-500 pointer-events-none`} />

                  {/* Shimmer Effect */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />

                  <div className="relative">
                    {/* Icon */}
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 shadow-lg group-hover:shadow-2xl group-hover:scale-110 transition-all duration-500 relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                      <feature.icon className="w-7 h-7 text-white relative z-10" />
                    </div>

                    {/* Content */}
                    <h3 className="text-xl font-bold mb-3 group-hover:text-amber-400 transition-colors duration-300">
                      {feature.title}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed group-hover:text-gray-300 transition-colors duration-300">
                      {feature.description}
                    </p>
                  </div>

                  {/* Bottom Border Accent */}
                  <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works - Enhanced */}
        <section id="how-it-works" className="container mx-auto px-4 lg:px-8 py-24 relative">
          {/* Background Gradient Orbs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
          </div>

          <div className="max-w-6xl mx-auto relative">
            <div className="text-center mb-20">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-sm font-semibold mb-6 backdrop-blur-sm">
                <Zap className="w-4 h-4" />
                Simple Process
              </div>
              <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
                <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  How Wells Works
                </span>
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                Three simple steps. No forms. No complexity. Just results.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 md:gap-12">
              {[
                {
                  step: '01',
                  icon: MessageSquare,
                  title: 'Talk to Wells',
                  description: 'Tell Wells what you need in plain English. No forms, no templates, just natural conversation.',
                  details: 'Wells understands context and asks clarifying questions to ensure perfect matches.'
                },
                {
                  step: '02',
                  icon: Search,
                  title: 'Wells Gets to Work',
                  description: 'AI finds matches, sends outreach, and coordinates responses automatically in the background.',
                  details: 'Machine learning algorithms screen thousands of options to find your perfect match.'
                },
                {
                  step: '03',
                  icon: CheckCircle,
                  title: 'You Close Deals',
                  description: 'Review results, negotiate terms, and close deals with built-in escrow protection.',
                  details: 'Secure payments, automated contracts, and compliance handled for you.'
                }
              ].map((step, index) => (
                <div
                  key={index}
                  className="relative group"
                  style={{
                    animation: `fadeInUp 0.6s ease-out ${index * 0.2}s both`
                  }}
                >
                  {/* Connector Line */}
                  {index < 2 && (
                    <div className="hidden md:block absolute top-20 left-[60%] w-[80%] h-0.5 z-0">
                      <div className="h-full bg-gradient-to-r from-amber-500/50 via-amber-500/30 to-transparent" />
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                    </div>
                  )}

                  <div className="text-center relative z-10">
                    {/* Step Number Badge */}
                    <div className="relative inline-flex mb-6">
                      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-4xl font-bold shadow-2xl shadow-amber-500/50 group-hover:scale-110 group-hover:shadow-amber-500/70 transition-all duration-500 relative overflow-hidden">
                        {/* Animated Background */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                        {/* Pulse Ring */}
                        <div className="absolute inset-0 rounded-2xl border-4 border-amber-400 opacity-0 group-hover:opacity-100 group-hover:scale-125 transition-all duration-500" />

                        <span className="relative z-10 text-black">{step.step}</span>
                      </div>
                    </div>

                    {/* Icon */}
                    <div className="flex justify-center mb-4">
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 group-hover:border-amber-500/30 transition-all duration-300">
                        <step.icon className="w-6 h-6 text-amber-400 group-hover:scale-110 transition-transform duration-300" />
                      </div>
                    </div>

                    {/* Content */}
                    <h3 className="text-2xl font-bold mb-4 group-hover:text-amber-400 transition-colors duration-300">
                      {step.title}
                    </h3>
                    <p className="text-gray-300 leading-relaxed mb-3 group-hover:text-white transition-colors duration-300">
                      {step.description}
                    </p>
                    <p className="text-sm text-gray-500 leading-relaxed group-hover:text-gray-400 transition-colors duration-300">
                      {step.details}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom CTA */}
            <div className="text-center mt-16">
              <Link
                href="/founder/chat"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-black rounded-xl font-bold text-lg hover:from-amber-400 hover:to-amber-500 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/50 group"
              >
                Get Started Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="container mx-auto px-4 lg:px-8 py-24">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
                Simple Pricing
              </h2>
              <p className="text-xl text-gray-400">1% flat on closed deals. That's it.</p>
            </div>

            <div className="relative bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-3xl p-8 md:p-12 backdrop-blur-sm overflow-hidden">
              {/* Background Gradient Accent */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent pointer-events-none" />

              <div className="relative grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 rounded-full text-amber-400 text-sm font-semibold mb-6">
                    <Zap className="w-4 h-4" />
                    Pay Only When You Win
                  </div>
                  <h3 className="text-4xl md:text-5xl font-bold mb-6">
                    1% Success Fee
                  </h3>
                  <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                    We only charge when you close a deal. Searching, matching, quoting, and negotiation are all completely free.
                  </p>
                  <ul className="space-y-4">
                    {[
                      'Free to search and get quotes',
                      'Free matching and introductions',
                      '1% only on completed transactions',
                      'Built-in escrow protection'
                    ].map((item, index) => (
                      <li key={index} className="flex items-center gap-3 text-gray-300">
                        <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-black/50 border border-white/10 rounded-2xl p-10 text-center backdrop-blur-sm">
                  <div className="text-7xl md:text-8xl font-bold bg-gradient-to-br from-amber-400 to-amber-600 bg-clip-text text-transparent mb-3">
                    1%
                  </div>
                  <div className="text-gray-400 text-lg mb-8">of deal value</div>
                  <Link
                    href="/founder/chat"
                    className="block w-full px-8 py-4 bg-amber-500 text-black rounded-xl font-bold text-lg hover:bg-amber-400 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/50 mb-4"
                  >
                    Start for Free
                  </Link>
                  <p className="text-sm text-gray-500">No credit card required</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="container mx-auto px-4 lg:px-8 py-24">
          <div className="max-w-4xl mx-auto relative">
            {/* Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl blur-3xl opacity-20" />

            <div className="relative bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl p-12 md:p-16 text-center overflow-hidden">
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl" />

              <div className="relative">
                <MessageSquare className="w-16 h-16 mx-auto mb-6 text-black/80" />
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-black mb-6 tracking-tight">
                  Stop Searching.
                  <br />
                  Start Talking.
                </h2>
                <p className="text-xl md:text-2xl text-black/80 mb-10 max-w-2xl mx-auto">
                  Tell Wells what you need. Get it done.
                </p>
                <Link
                  href="/founder/chat"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-900 transition-all hover:scale-105 hover:shadow-2xl"
                >
                  Talk to Wells Now
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 bg-white/[0.02] backdrop-blur-sm">
          <div className="container mx-auto px-4 lg:px-8 py-16">
            <div className="grid md:grid-cols-5 gap-12 mb-12">
              <div className="md:col-span-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-black" />
                  </div>
                  <span className="text-xl font-bold tracking-tight">WellsAI</span>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
                  AI that turns conversations into outcomes. Just tell Wells what you need and watch it happen.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-4 text-sm">Journeys</h4>
                <ul className="space-y-3 text-sm text-gray-400">
                  <li><Link href="/founder/chat" className="hover:text-white transition-colors">Founder</Link></li>
                  <li><Link href="/buyer/chat" className="hover:text-white transition-colors">Buyer</Link></li>
                  <li><Link href="/suppliers/join" className="hover:text-white transition-colors">Seller</Link></li>
                  <li><Link href="/jobs/chat" className="hover:text-white transition-colors">Jobs</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-4 text-sm">Platform</h4>
                <ul className="space-y-3 text-sm text-gray-400">
                  <li><Link href="#how-it-works" className="hover:text-white transition-colors">How It Works</Link></li>
                  <li><Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                  <li><Link href="/demo" className="hover:text-white transition-colors">See Demo</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-4 text-sm">Get Started</h4>
                <ul className="space-y-3 text-sm text-gray-400">
                  <li><Link href="/founder/chat" className="hover:text-white transition-colors">Talk to Wells</Link></li>
                  <li><Link href="/admin/leads" className="hover:text-white transition-colors">Admin</Link></li>
                </ul>
              </div>
            </div>

            <div className="border-t border-white/10 pt-8 text-center text-sm text-gray-500">
              <p>© 2025 WellsAI. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
