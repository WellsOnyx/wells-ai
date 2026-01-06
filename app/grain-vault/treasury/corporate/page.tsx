'use client'

/**
 * Corporate Treasury Page
 *
 * Target: Corporate CFOs & Treasurers
 * Focus: Protecting operating cash, credit lines for payroll/AP, ERP integration
 */

import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  Shield,
  Coins,
  TrendingUp,
  Vault,
  Lock,
  Zap,
  CheckCircle2,
  Sparkles,
  DollarSign,
  BarChart3,
  FileCheck,
  Briefcase,
  Clock,
  BadgeCheck,
  Users,
  Database,
  Brain,
  RefreshCw,
  CreditCard,
  Calculator
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
      ${hover ? 'hover:border-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-500' : ''}
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
        bg-gradient-to-r from-emerald-500 to-teal-500
        text-black font-semibold rounded-2xl
        shadow-xl shadow-emerald-500/25
        hover:shadow-emerald-500/40 hover:scale-[1.02]
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
            <Link href="/grain-vault/treasury/corporate" className="px-4 py-2 text-emerald-400 text-sm font-medium rounded-lg bg-emerald-500/10 transition-all">
              Corporate
            </Link>
            <Link href="/grain-vault/treasury/nonprofit" className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium rounded-lg hover:bg-white/5 transition-all">
              Nonprofit
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="hidden sm:block px-4 py-2 text-white/70 hover:text-white text-sm font-medium transition-all">
              Sign In
            </Link>
            <Link
              href="/join?journey=treasury"
              className="group relative px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-black text-sm font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-105"
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.25),rgba(255,255,255,0))]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_60%,rgba(20,184,166,0.15),transparent)]" />
      </div>

      {/* Floating orbs */}
      <div className="absolute w-[600px] h-[600px] bg-gradient-to-br from-emerald-600/30 to-teal-800/20 rounded-full blur-3xl -top-32 -left-32 animate-pulse opacity-50" />
      <div className="absolute w-[400px] h-[400px] bg-gradient-to-br from-teal-500/20 to-emerald-600/10 rounded-full blur-3xl -bottom-20 -right-20 animate-pulse opacity-50" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full backdrop-blur-sm mb-8">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 text-sm font-medium">Corporate Treasury</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-6">
              Protect Operating Cash.
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 bg-clip-text text-transparent">
                Unlock 0% Credit.
              </span>
            </h1>

            <p className="text-lg text-white/60 mb-8 leading-relaxed max-w-xl">
              As a CFO, your #1 job is protecting cash while keeping operations running.
              Grain & Vault gives you 100% protected reserves with a 1:1 credit line for
              payroll, AP, and working capital - at 0% interest.
            </p>

            {/* Key benefits */}
            <div className="space-y-3 mb-10">
              <div className="flex items-center gap-3 text-white/70">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>100% protected operating cash - always withdrawable</span>
              </div>
              <div className="flex items-center gap-3 text-white/70">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>0% interest credit line for payroll & AP</span>
              </div>
              <div className="flex items-center gap-3 text-white/70">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Native ERP integration (NetSuite, SAP, Dynamics)</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <ShimmerButton href="/join?journey=treasury" className="text-center">
                Open Your Vault
                <ArrowRight className="w-5 h-5" />
              </ShimmerButton>
              <ShimmerButton href="/grain-vault/demo" variant="secondary" className="text-center">
                Schedule CFO Demo
              </ShimmerButton>
            </div>
          </div>

          {/* Right: Visual */}
          <div className="hidden lg:block">
            <GlassCard className="p-8" hover={false}>
              <div className="text-center mb-6">
                <div className="text-sm text-emerald-400 font-medium mb-2">Example: $10M Operating Cash</div>
                <div className="text-3xl font-bold text-white">Treasury Dashboard</div>
              </div>

              <div className="space-y-4">
                {/* Protected Reserves */}
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Vault className="w-5 h-5 text-emerald-400" />
                      <span className="text-white font-medium">Protected Reserves</span>
                    </div>
                    <span className="text-emerald-400 font-bold">$10,000,000</span>
                  </div>
                  <div className="h-2 bg-emerald-500/20 rounded-full overflow-hidden">
                    <div className="h-full w-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full" />
                  </div>
                </div>

                {/* Credit Available */}
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-amber-400" />
                      <span className="text-white font-medium">GRAIN Credit Available</span>
                    </div>
                    <span className="text-amber-400 font-bold">1,000,000 GRAIN</span>
                  </div>
                  <div className="text-sm text-white/50">1:1 ratio at $10/GRAIN lock price</div>
                </div>

                {/* Monthly Payroll */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-white/50" />
                      <span className="text-white/70">Monthly Payroll Coverage</span>
                    </div>
                    <span className="text-white font-medium">8 months</span>
                  </div>
                </div>

                {/* Interest Saved */}
                <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-violet-400" />
                      <span className="text-white font-medium">Annual Interest Saved</span>
                    </div>
                    <span className="text-violet-400 font-bold">$850,000</span>
                  </div>
                  <div className="text-sm text-white/50">vs 8.5% traditional credit line</div>
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
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-white/70 text-sm font-medium">The Three-Layer Model</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">
            How Corporate Treasury
            <br />
            <span className="text-white/40">Actually Works</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Layer 1 */}
          <GlassCard className="p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/30">
              <Vault className="w-7 h-7 text-white" />
            </div>
            <div className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">Layer 1</div>
            <h3 className="text-2xl font-bold text-white mb-3">Protected Deposit</h3>
            <p className="text-white/50 leading-relaxed mb-6">
              Your operating cash is 100% protected. No exposure to lending risk.
              Full withdrawal available anytime. This is YOUR money.
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-white/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                100% principal protection
              </li>
              <li className="flex items-center gap-2 text-sm text-white/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Same-day withdrawal
              </li>
              <li className="flex items-center gap-2 text-sm text-white/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Full audit trail
              </li>
            </ul>
          </GlassCard>

          {/* Layer 2 */}
          <GlassCard className="p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-amber-500/30">
              <Coins className="w-7 h-7 text-white" />
            </div>
            <div className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">Layer 2</div>
            <h3 className="text-2xl font-bold text-white mb-3">GRAIN Credit Line</h3>
            <p className="text-white/50 leading-relaxed mb-6">
              Get 1:1 credit in GRAIN at your deposit price. 0% interest.
              Use for payroll, AP, vendor payments - all settled instantly.
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-white/60">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                0% interest, always
              </li>
              <li className="flex items-center gap-2 text-sm text-white/60">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                Pay suppliers instantly
              </li>
              <li className="flex items-center gap-2 text-sm text-white/60">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                Run payroll in GRAIN
              </li>
            </ul>
          </GlassCard>

          {/* Layer 3 */}
          <GlassCard className="p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-violet-500/30">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div className="text-violet-400 text-xs font-semibold uppercase tracking-wider mb-3">Layer 3</div>
            <h3 className="text-2xl font-bold text-white mb-3">Appreciation</h3>
            <p className="text-white/50 leading-relaxed mb-6">
              As the network grows, you receive bonus GRAIN. Your purchasing
              power increases without taking on additional risk.
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-white/60">
                <CheckCircle2 className="w-4 h-4 text-violet-400" />
                Network growth rewards
              </li>
              <li className="flex items-center gap-2 text-sm text-white/60">
                <CheckCircle2 className="w-4 h-4 text-violet-400" />
                No additional risk
              </li>
              <li className="flex items-center gap-2 text-sm text-white/60">
                <CheckCircle2 className="w-4 h-4 text-violet-400" />
                Compound purchasing power
              </li>
            </ul>
          </GlassCard>
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// CORPORATE BENEFITS
// ============================================================================

function CorporateBenefitsSection() {
  const benefits = [
    {
      icon: Shield,
      title: 'Protect Operating Cash',
      description: 'Keep 100% of your operating reserves protected while still accessing credit. No more choosing between safety and liquidity.',
      color: 'emerald'
    },
    {
      icon: CreditCard,
      title: '0% Interest Credit Lines',
      description: 'Eliminate interest expense on working capital. Your 1:1 GRAIN credit line has 0% interest forever - not 0% for 12 months.',
      color: 'amber'
    },
    {
      icon: RefreshCw,
      title: 'Instant AP Settlement',
      description: 'Pay suppliers in seconds, not days. No more payment failures, no more late fees, no more strained vendor relationships.',
      color: 'teal'
    },
    {
      icon: Users,
      title: 'Payroll Without Risk',
      description: 'Run payroll through GRAIN credit. Your deposit stays protected while employees get paid on time, every time.',
      color: 'violet'
    },
    {
      icon: Database,
      title: 'Native ERP Integration',
      description: 'Connect NetSuite, SAP, Dynamics 365, or QuickBooks. Push payables directly to Grain & Vault for instant settlement.',
      color: 'rose'
    },
    {
      icon: BarChart3,
      title: 'Real-Time Treasury View',
      description: 'See your complete treasury position in one dashboard. Protected reserves, credit usage, appreciation, and forecasts.',
      color: 'cyan'
    },
  ]

  const colorClasses = {
    emerald: 'from-emerald-400 to-teal-500 shadow-emerald-500/30 text-emerald-400',
    amber: 'from-amber-400 to-orange-500 shadow-amber-500/30 text-amber-400',
    teal: 'from-teal-400 to-cyan-500 shadow-teal-500/30 text-teal-400',
    violet: 'from-violet-400 to-purple-500 shadow-violet-500/30 text-violet-400',
    rose: 'from-rose-400 to-pink-500 shadow-rose-500/30 text-rose-400',
    cyan: 'from-cyan-400 to-blue-500 shadow-cyan-500/30 text-cyan-400',
  }

  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 bg-[#030712]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(16,185,129,0.08),transparent)]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span className="text-white/70 text-sm font-medium">Built for CFOs</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">
            Corporate Treasury,
            <br />
            <span className="text-white/40">Reimagined</span>
          </h2>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            Everything a CFO needs to protect cash, manage liquidity, and eliminate
            the friction of traditional banking.
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
// COMPARISON SECTION
// ============================================================================

function ComparisonSection() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712]" />

      <div className="relative z-10 max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-6">
            Traditional Banking vs Grain & Vault
          </h2>
        </div>

        <GlassCard className="overflow-hidden" hover={false}>
          <div className="grid grid-cols-3 text-center border-b border-white/10">
            <div className="p-6 border-r border-white/10"></div>
            <div className="p-6 border-r border-white/10 bg-white/5">
              <div className="text-white/50 text-sm mb-1">Traditional</div>
              <div className="text-white font-semibold">Bank Credit Line</div>
            </div>
            <div className="p-6 bg-emerald-500/10">
              <div className="text-emerald-400 text-sm mb-1">Grain & Vault</div>
              <div className="text-white font-semibold">Protected Treasury</div>
            </div>
          </div>

          {[
            { label: 'Interest Rate', traditional: '8-12% APR', vault: '0% Forever' },
            { label: 'Principal Protection', traditional: 'None (lending risk)', vault: '100% Protected' },
            { label: 'Settlement Speed', traditional: '1-3 business days', vault: 'Instant (<1 sec)' },
            { label: 'Transaction Fees', traditional: '2-3% card fees', vault: '0% Fees' },
            { label: 'Credit Approval', traditional: 'Weeks + covenants', vault: 'Instant, 1:1 ratio' },
            { label: 'Withdrawal Access', traditional: 'Limited by terms', vault: 'Anytime, any amount' },
          ].map((row, idx) => (
            <div key={idx} className="grid grid-cols-3 text-center border-b border-white/10 last:border-0">
              <div className="p-4 border-r border-white/10 text-white/70 text-sm font-medium text-left pl-6">
                {row.label}
              </div>
              <div className="p-4 border-r border-white/10 text-white/50 text-sm">
                {row.traditional}
              </div>
              <div className="p-4 text-emerald-400 text-sm font-medium bg-emerald-500/5">
                {row.vault}
              </div>
            </div>
          ))}
        </GlassCard>
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
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(16,185,129,0.15),transparent)]" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-500 rounded-3xl mb-10 shadow-2xl shadow-emerald-500/30">
          <Building2 className="w-10 h-10 text-black" />
        </div>

        <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-6">
          Ready to Transform
          <br />
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Your Treasury?
          </span>
        </h2>

        <p className="text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed">
          Join CFOs using Grain & Vault for protected operating cash,
          zero-interest credit, and instant settlement.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <ShimmerButton href="/join?journey=treasury" className="w-full sm:w-auto text-lg">
            Open Your Vault
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </ShimmerButton>
          <ShimmerButton href="/grain-vault/demo" variant="secondary" className="w-full sm:w-auto text-lg">
            Schedule CFO Demo
          </ShimmerButton>
        </div>

        <p className="mt-8 text-white/40 text-sm">
          No minimum deposit. No credit check. Get started in minutes.
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

export default function CorporateTreasuryPage() {
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
          background: rgba(16, 185, 129, 0.3);
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 185, 129, 0.5);
        }
        ::selection {
          background: rgba(16, 185, 129, 0.3);
          color: white;
        }
      `}</style>

      <Navigation />
      <HeroSection />
      <ThreeLayerSection />
      <CorporateBenefitsSection />
      <ComparisonSection />
      <CTASection />
      <Footer />
    </div>
  )
}
