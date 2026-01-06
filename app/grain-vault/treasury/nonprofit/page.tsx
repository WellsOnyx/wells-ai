'use client'

/**
 * Nonprofit Treasury Page
 *
 * Target: Nonprofit CFOs & Endowment Managers
 * Focus: Endowment protection, grant disbursement, fiduciary compliance
 */

import Link from 'next/link'
import {
  ArrowRight,
  Heart,
  Shield,
  Coins,
  TrendingUp,
  Vault,
  Lock,
  Zap,
  CheckCircle2,
  Sparkles,
  DollarSign,
  FileCheck,
  Landmark,
  Clock,
  BadgeCheck,
  Users,
  Scale,
  Brain,
  Gift,
  Building,
  PieChart,
  BookOpen
} from 'lucide-react'

// ============================================================================
// GLASS CARD COMPONENT
// ============================================================================

function GlassCard({
  children,
  className = '',
  hover = true
}: {
  children: React.ReactNode
  className?: string
  hover?: boolean
}) {
  return (
    <div className={`
      relative overflow-hidden rounded-3xl
      bg-gradient-to-br from-white/[0.08] to-white/[0.02]
      border border-white/10
      backdrop-blur-xl
      ${hover ? 'hover:border-rose-500/30 hover:shadow-2xl hover:shadow-rose-500/10 transition-all duration-500' : ''}
      ${className}
    `}>
      {children}
    </div>
  )
}

// ============================================================================
// SHIMMER BUTTON COMPONENT
// ============================================================================

function ShimmerButton({
  children,
  href,
  variant = 'primary',
  className = ''
}: {
  children: React.ReactNode
  href: string
  variant?: 'primary' | 'secondary'
  className?: string
}) {
  if (variant === 'secondary') {
    return (
      <Link
        href={href}
        className={`
          group relative px-8 py-4
          bg-white/5 border border-white/10
          text-white font-semibold rounded-2xl
          hover:bg-white/10 hover:border-white/20
          transition-all duration-300 backdrop-blur-sm
          ${className}
        `}
      >
        {children}
      </Link>
    )
  }

  return (
    <Link
      href={href}
      className={`
        group relative px-8 py-4 overflow-hidden
        bg-gradient-to-r from-rose-500 to-pink-500
        text-white font-semibold rounded-2xl
        shadow-xl shadow-rose-500/25
        hover:shadow-rose-500/40 hover:scale-[1.02]
        transition-all duration-300
        ${className}
      `}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </Link>
  )
}

// ============================================================================
// NAVIGATION
// ============================================================================

function Navigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-2xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-all duration-300 group-hover:scale-105">
                <Coins className="w-5 h-5 text-black" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-gradient-to-br from-amber-400 to-amber-500 rounded-md" />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-semibold text-lg tracking-tight">Grain & Vault</span>
              <span className="text-white/40 text-[10px] font-medium -mt-0.5 tracking-wider uppercase">Treasury</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <Link href="/grain-vault/treasury" className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium rounded-lg hover:bg-white/5 transition-all">
              All Solutions
            </Link>
            <Link href="/grain-vault/treasury/corporate" className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium rounded-lg hover:bg-white/5 transition-all">
              Corporate
            </Link>
            <Link href="/grain-vault/treasury/nonprofit" className="px-4 py-2 text-rose-400 text-sm font-medium rounded-lg bg-rose-500/10 transition-all">
              Nonprofit
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="hidden sm:block px-4 py-2 text-white/70 hover:text-white text-sm font-medium transition-all">
              Sign In
            </Link>
            <Link
              href="/join?journey=treasury"
              className="group relative px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-semibold rounded-xl hover:from-rose-400 hover:to-pink-400 transition-all shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 hover:scale-105"
            >
              <span className="relative z-10 flex items-center gap-2">
                Get Started
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

// ============================================================================
// HERO SECTION
// ============================================================================

function HeroSection() {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden pt-24">
      {/* Background */}
      <div className="absolute inset-0 bg-[#030712]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(244,63,94,0.2),rgba(255,255,255,0))]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_60%,rgba(236,72,153,0.15),transparent)]" />
      </div>

      {/* Floating orbs */}
      <div className="absolute w-[600px] h-[600px] bg-gradient-to-br from-rose-600/30 to-pink-800/20 rounded-full blur-3xl -top-32 -left-32 animate-pulse opacity-50" />
      <div className="absolute w-[400px] h-[400px] bg-gradient-to-br from-pink-500/20 to-rose-600/10 rounded-full blur-3xl -bottom-20 -right-20 animate-pulse opacity-50" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-full backdrop-blur-sm mb-8">
              <Heart className="w-4 h-4 text-rose-400" />
              <span className="text-rose-400 text-sm font-medium">Nonprofit Treasury</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-6">
              Protect Your Mission.
              <br />
              <span className="bg-gradient-to-r from-rose-400 via-pink-400 to-rose-500 bg-clip-text text-transparent">
                Empower Your Impact.
              </span>
            </h1>

            <p className="text-lg text-white/60 mb-8 leading-relaxed max-w-xl">
              As a nonprofit CFO, you're entrusted with donor dollars and endowment assets.
              Grain & Vault provides 100% protection with fiduciary-grade reporting,
              plus 0% credit for grant disbursements.
            </p>

            {/* Key benefits */}
            <div className="space-y-3 mb-10">
              <div className="flex items-center gap-3 text-white/70">
                <CheckCircle2 className="w-5 h-5 text-rose-400" />
                <span>100% endowment protection - never risk donor funds</span>
              </div>
              <div className="flex items-center gap-3 text-white/70">
                <CheckCircle2 className="w-5 h-5 text-rose-400" />
                <span>Instant grant disbursement with full audit trail</span>
              </div>
              <div className="flex items-center gap-3 text-white/70">
                <CheckCircle2 className="w-5 h-5 text-rose-400" />
                <span>Fiduciary-ready reporting for board & regulators</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <ShimmerButton href="/join?journey=treasury" className="text-center">
                Protect Your Endowment
                <ArrowRight className="w-5 h-5" />
              </ShimmerButton>
              <ShimmerButton href="/grain-vault/demo" variant="secondary" className="text-center">
                Schedule Demo
              </ShimmerButton>
            </div>
          </div>

          {/* Right: Visual */}
          <div className="hidden lg:block">
            <GlassCard className="p-8" hover={false}>
              <div className="text-center mb-6">
                <div className="text-sm text-rose-400 font-medium mb-2">Example: $50M Endowment</div>
                <div className="text-3xl font-bold text-white">Endowment Dashboard</div>
              </div>

              <div className="space-y-4">
                {/* Protected Endowment */}
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Vault className="w-5 h-5 text-rose-400" />
                      <span className="text-white font-medium">Protected Endowment</span>
                    </div>
                    <span className="text-rose-400 font-bold">$50,000,000</span>
                  </div>
                  <div className="h-2 bg-rose-500/20 rounded-full overflow-hidden">
                    <div className="h-full w-full bg-gradient-to-r from-rose-400 to-pink-400 rounded-full" />
                  </div>
                </div>

                {/* Grant Disbursement Credit */}
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5 text-amber-400" />
                      <span className="text-white font-medium">Grant Credit Available</span>
                    </div>
                    <span className="text-amber-400 font-bold">5,000,000 GRAIN</span>
                  </div>
                  <div className="text-sm text-white/50">For program & grant disbursements</div>
                </div>

                {/* Spending Policy */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-white/50" />
                      <span className="text-white/70">5% Spending Policy</span>
                    </div>
                    <span className="text-white font-medium">$2.5M/year</span>
                  </div>
                </div>

                {/* Compliance Status */}
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Scale className="w-5 h-5 text-emerald-400" />
                      <span className="text-white font-medium">Fiduciary Compliance</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400 text-sm">Active</span>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// THREE LAYER MODEL
// ============================================================================

function ThreeLayerSection() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-rose-400" />
            <span className="text-white/70 text-sm font-medium">The Three-Layer Model</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">
            Donor Funds Deserve
            <br />
            <span className="text-white/40">Maximum Protection</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Layer 1 */}
          <GlassCard className="p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-rose-400 to-pink-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-rose-500/30">
              <Vault className="w-7 h-7 text-white" />
            </div>
            <div className="text-rose-400 text-xs font-semibold uppercase tracking-wider mb-3">Layer 1</div>
            <h3 className="text-2xl font-bold text-white mb-3">Protected Endowment</h3>
            <p className="text-white/50 leading-relaxed mb-6">
              Donor funds and endowment assets are 100% protected.
              No exposure to market risk. Full transparency for board reporting.
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-white/60">
                <CheckCircle2 className="w-4 h-4 text-rose-400" />
                100% principal protection
              </li>
              <li className="flex items-center gap-2 text-sm text-white/60">
                <CheckCircle2 className="w-4 h-4 text-rose-400" />
                Donor trust maintained
              </li>
              <li className="flex items-center gap-2 text-sm text-white/60">
                <CheckCircle2 className="w-4 h-4 text-rose-400" />
                Real-time board reporting
              </li>
            </ul>
          </GlassCard>

          {/* Layer 2 */}
          <GlassCard className="p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-amber-500/30">
              <Gift className="w-7 h-7 text-white" />
            </div>
            <div className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">Layer 2</div>
            <h3 className="text-2xl font-bold text-white mb-3">Grant Credit Line</h3>
            <p className="text-white/50 leading-relaxed mb-6">
              Disburse grants instantly using 0% interest credit.
              Pay grantees, vendors, and programs without touching principal.
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-white/60">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                0% interest disbursements
              </li>
              <li className="flex items-center gap-2 text-sm text-white/60">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                Instant grantee payments
              </li>
              <li className="flex items-center gap-2 text-sm text-white/60">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                Complete audit trail
              </li>
            </ul>
          </GlassCard>

          {/* Layer 3 */}
          <GlassCard className="p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-violet-500/30">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div className="text-violet-400 text-xs font-semibold uppercase tracking-wider mb-3">Layer 3</div>
            <h3 className="text-2xl font-bold text-white mb-3">Mission Growth</h3>
            <p className="text-white/50 leading-relaxed mb-6">
              Network appreciation grows your purchasing power.
              More impact without additional fundraising.
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-white/60">
                <CheckCircle2 className="w-4 h-4 text-violet-400" />
                Expanded mission reach
              </li>
              <li className="flex items-center gap-2 text-sm text-white/60">
                <CheckCircle2 className="w-4 h-4 text-violet-400" />
                No additional fundraising
              </li>
              <li className="flex items-center gap-2 text-sm text-white/60">
                <CheckCircle2 className="w-4 h-4 text-violet-400" />
                Compound impact
              </li>
            </ul>
          </GlassCard>
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// NONPROFIT BENEFITS
// ============================================================================

function NonprofitBenefitsSection() {
  const benefits = [
    {
      icon: Shield,
      title: 'Endowment Protection',
      description: 'Keep 100% of your endowment protected. Never expose donor funds to lending risk or market volatility.',
      color: 'rose'
    },
    {
      icon: Gift,
      title: 'Instant Grant Disbursement',
      description: 'Send grant payments in seconds, not weeks. Grantees receive funds immediately with full documentation.',
      color: 'amber'
    },
    {
      icon: Scale,
      title: 'Fiduciary Compliance',
      description: 'Built-in compliance reporting for boards, auditors, and regulators. Meet your fiduciary duties effortlessly.',
      color: 'emerald'
    },
    {
      icon: BookOpen,
      title: 'Donor Transparency',
      description: 'Show donors exactly how their funds are protected and deployed. Build trust with complete transparency.',
      color: 'violet'
    },
    {
      icon: PieChart,
      title: 'Spending Policy Automation',
      description: 'Enforce your 4-5% spending policy automatically. Credit line sized to your sustainable disbursement rate.',
      color: 'teal'
    },
    {
      icon: Users,
      title: 'Board Reporting',
      description: 'One-click reports for board meetings. Endowment health, disbursements, compliance status - all in real-time.',
      color: 'cyan'
    },
  ]

  const colorClasses = {
    rose: 'from-rose-400 to-pink-500 shadow-rose-500/30 text-rose-400',
    amber: 'from-amber-400 to-orange-500 shadow-amber-500/30 text-amber-400',
    emerald: 'from-emerald-400 to-teal-500 shadow-emerald-500/30 text-emerald-400',
    violet: 'from-violet-400 to-purple-500 shadow-violet-500/30 text-violet-400',
    teal: 'from-teal-400 to-cyan-500 shadow-teal-500/30 text-teal-400',
    cyan: 'from-cyan-400 to-blue-500 shadow-cyan-500/30 text-cyan-400',
  }

  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 bg-[#030712]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(244,63,94,0.08),transparent)]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6">
            <Heart className="w-4 h-4 text-rose-400" />
            <span className="text-white/70 text-sm font-medium">Built for Nonprofits</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">
            Treasury That Serves
            <br />
            <span className="text-white/40">Your Mission</span>
          </h2>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            Everything a nonprofit CFO needs to protect endowments, manage disbursements,
            and maintain fiduciary compliance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit, idx) => {
            const Icon = benefit.icon
            const colors = colorClasses[benefit.color as keyof typeof colorClasses]
            return (
              <GlassCard key={idx} className="p-6">
                <div className={`w-12 h-12 bg-gradient-to-br ${colors.split(' ')[0]} ${colors.split(' ')[1]} rounded-xl flex items-center justify-center mb-4 shadow-lg ${colors.split(' ')[2]}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{benefit.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{benefit.description}</p>
              </GlassCard>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// USE CASES SECTION
// ============================================================================

function UseCasesSection() {
  const useCases = [
    {
      title: 'Community Foundations',
      description: 'Manage donor-advised funds with complete protection and instant grant disbursement to local nonprofits.',
      icon: Building,
    },
    {
      title: 'University Endowments',
      description: 'Protect alumni gifts while funding scholarships, research, and capital projects.',
      icon: Landmark,
    },
    {
      title: 'Healthcare Foundations',
      description: 'Safeguard charitable assets while supporting patient care programs and medical research.',
      icon: Heart,
    },
    {
      title: 'Arts & Culture',
      description: 'Preserve endowments for museums, symphonies, and cultural institutions for generations.',
      icon: Sparkles,
    },
  ]

  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-6">
            Trusted by Nonprofits of All Types
          </h2>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            From community foundations to university endowments, organizations trust
            Grain & Vault to protect and grow their impact.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {useCases.map((useCase, idx) => {
            const Icon = useCase.icon
            return (
              <GlassCard key={idx} className="p-6 flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-rose-400 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/30 flex-shrink-0">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">{useCase.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{useCase.description}</p>
                </div>
              </GlassCard>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// CTA SECTION
// ============================================================================

function CTASection() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 bg-[#030712]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(244,63,94,0.15),transparent)]" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-rose-400 via-rose-500 to-pink-500 rounded-3xl mb-10 shadow-2xl shadow-rose-500/30">
          <Heart className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-6">
          Ready to Protect
          <br />
          <span className="bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent">
            Your Mission?
          </span>
        </h2>

        <p className="text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed">
          Join foundations and nonprofits using Grain & Vault for
          endowment protection and fiduciary compliance.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <ShimmerButton href="/join?journey=treasury" className="w-full sm:w-auto text-lg">
            Protect Your Endowment
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </ShimmerButton>
          <ShimmerButton href="/grain-vault/demo" variant="secondary" className="w-full sm:w-auto text-lg">
            Schedule Demo
          </ShimmerButton>
        </div>

        <p className="mt-8 text-white/40 text-sm">
          No minimum. Fiduciary-ready from day one.
        </p>
      </div>
    </section>
  )
}

// ============================================================================
// FOOTER
// ============================================================================

function Footer() {
  return (
    <footer className="relative border-t border-white/10 bg-[#030712]">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                <Coins className="w-5 h-5 text-black" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-gradient-to-br from-amber-400 to-amber-500 rounded-md" />
            </div>
            <span className="text-white font-semibold text-lg">Grain & Vault</span>
          </Link>

          <div className="flex items-center gap-2 text-white/30 text-sm">
            <Brain className="w-4 h-4" />
            <span>Powered by WellsAI</span>
          </div>

          <p className="text-white/30 text-sm">
            © 2025 Grain & Vault. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function NonprofitTreasuryPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white antialiased overflow-x-hidden">
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.5);
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(244, 63, 94, 0.3);
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(244, 63, 94, 0.5);
        }
        ::selection {
          background: rgba(244, 63, 94, 0.3);
          color: white;
        }
      `}</style>

      <Navigation />
      <HeroSection />
      <ThreeLayerSection />
      <NonprofitBenefitsSection />
      <UseCasesSection />
      <CTASection />
      <Footer />
    </div>
  )
}
