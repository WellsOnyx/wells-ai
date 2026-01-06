'use client'

/**
 * Treasury Landing Page - Journey Selector
 *
 * Main entry point for CFO/Treasurer journeys
 * Speaks to: Corporate CFOs, Nonprofit CFOs, Faith-based orgs, ESA/SFO managers, Endowment managers
 */

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  Heart,
  Church,
  GraduationCap,
  Landmark,
  Shield,
  Coins,
  TrendingUp,
  Vault,
  Lock,
  Zap,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Globe,
  Clock,
  BadgeCheck,
  DollarSign,
  Users,
  Brain
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
            <Link href="/#how-it-works" className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium rounded-lg hover:bg-white/5 transition-all">
              How It Works
            </Link>
            <Link href="/grain-vault/treasury" className="px-4 py-2 text-emerald-400 text-sm font-medium rounded-lg bg-emerald-500/10 transition-all">
              Treasury Solutions
            </Link>
            <Link href="/grain-vault/blog" className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium rounded-lg hover:bg-white/5 transition-all">
              Blog
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
// JOURNEY CARDS
// ============================================================================

const TREASURY_JOURNEYS = [
  {
    id: 'corporate',
    title: 'Corporate Treasury',
    subtitle: 'CFOs & Treasurers',
    description: 'Protect operating cash, unlock 0% credit lines for payroll and AP. Eliminate payment failures.',
    icon: Building2,
    color: 'emerald',
    href: '/grain-vault/treasury/corporate',
    features: ['Operating cash protection', '1:1 credit for payroll/AP', 'ERP integration'],
  },
  {
    id: 'nonprofit',
    title: 'Nonprofit Treasury',
    subtitle: 'Nonprofit CFOs',
    description: 'Safeguard endowments, streamline grant disbursement, and maintain fiduciary compliance.',
    icon: Heart,
    color: 'rose',
    href: '/grain-vault/treasury/nonprofit',
    features: ['Endowment protection', 'Grant disbursement', 'Fiduciary compliance'],
  },
  {
    id: 'faith',
    title: 'Faith-Based Organizations',
    subtitle: 'Church & Ministry Finance',
    description: 'Protect tithes and offerings, manage building funds, and ensure transparent stewardship.',
    icon: Church,
    color: 'violet',
    href: '/grain-vault/treasury/faith',
    features: ['Tithe protection', 'Building fund management', 'Transparent stewardship'],
  },
  {
    id: 'education',
    title: 'ESA & SFO Management',
    subtitle: 'Education Finance',
    description: 'Manage Education Savings Accounts and Scholarship Fund Organizations with compliance built-in.',
    icon: GraduationCap,
    color: 'amber',
    href: '/grain-vault/treasury/education',
    features: ['ESA fund management', 'Compliance automation', 'Parent disbursements'],
  },
  {
    id: 'endowment',
    title: 'Endowment Management',
    subtitle: 'Universities & Foundations',
    description: 'Institutional-grade treasury for university endowments and foundation assets.',
    icon: Landmark,
    color: 'teal',
    href: '/grain-vault/treasury/nonprofit',
    features: ['Long-term preservation', 'Spending policy compliance', 'Board reporting'],
  },
]

function JourneyCard({ journey }: { journey: typeof TREASURY_JOURNEYS[0] }) {
  const Icon = journey.icon
  const colorClasses = {
    emerald: {
      icon: 'from-emerald-400 to-teal-500',
      shadow: 'shadow-emerald-500/30',
      badge: 'bg-emerald-500/20 text-emerald-300',
      check: 'text-emerald-400',
    },
    rose: {
      icon: 'from-rose-400 to-pink-500',
      shadow: 'shadow-rose-500/30',
      badge: 'bg-rose-500/20 text-rose-300',
      check: 'text-rose-400',
    },
    violet: {
      icon: 'from-violet-400 to-purple-500',
      shadow: 'shadow-violet-500/30',
      badge: 'bg-violet-500/20 text-violet-300',
      check: 'text-violet-400',
    },
    amber: {
      icon: 'from-amber-400 to-orange-500',
      shadow: 'shadow-amber-500/30',
      badge: 'bg-amber-500/20 text-amber-300',
      check: 'text-amber-400',
    },
    teal: {
      icon: 'from-teal-400 to-cyan-500',
      shadow: 'shadow-teal-500/30',
      badge: 'bg-teal-500/20 text-teal-300',
      check: 'text-teal-400',
    },
  }[journey.color]

  return (
    <Link href={journey.href}>
      <GlassCard className="p-6 h-full group cursor-pointer">
        <div className={`w-14 h-14 bg-gradient-to-br ${colorClasses.icon} rounded-2xl flex items-center justify-center mb-5 shadow-xl ${colorClasses.shadow} group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-7 h-7 text-white" />
        </div>

        <div className={`inline-flex items-center gap-2 px-3 py-1 ${colorClasses.badge} rounded-full text-xs font-semibold uppercase tracking-wider mb-3`}>
          {journey.subtitle}
        </div>

        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">
          {journey.title}
        </h3>

        <p className="text-white/50 text-sm leading-relaxed mb-4">
          {journey.description}
        </p>

        <ul className="space-y-2 mb-4">
          {journey.features.map((feature, idx) => (
            <li key={idx} className="flex items-center gap-2 text-sm text-white/60">
              <CheckCircle2 className={`w-4 h-4 ${colorClasses.check}`} />
              {feature}
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium group-hover:gap-3 transition-all">
          Learn more
          <ChevronRight className="w-4 h-4" />
        </div>
      </GlassCard>
    </Link>
  )
}

// ============================================================================
// HERO SECTION
// ============================================================================

function HeroSection() {
  return (
    <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden pt-24 pb-12">
      {/* Background */}
      <div className="absolute inset-0 bg-[#030712]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.25),rgba(255,255,255,0))]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_60%,rgba(20,184,166,0.15),transparent)]" />
      </div>

      {/* Floating orbs */}
      <div className="absolute w-[600px] h-[600px] bg-gradient-to-br from-emerald-600/30 to-teal-800/20 rounded-full blur-3xl -top-32 -left-32 animate-pulse opacity-50" />
      <div className="absolute w-[400px] h-[400px] bg-gradient-to-br from-teal-500/20 to-emerald-600/10 rounded-full blur-3xl -bottom-20 -right-20 animate-pulse opacity-50" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full backdrop-blur-sm mb-8">
          <Vault className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-400 text-sm font-medium">Treasury Solutions</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-[1.1] mb-6">
          Treasury Built for
          <br />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 bg-clip-text text-transparent">
            Your Mission
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
          Whether you manage corporate cash, nonprofit endowments, church funds, or education savings -
          Grain & Vault protects your reserves while unlocking 0% credit.
        </p>

        {/* Trust indicators */}
        <div className="flex flex-wrap items-center justify-center gap-8 text-white/40 text-sm">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400/80">100% Protected</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            <span>0% Interest</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            <span>Fiduciary-Ready</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            <span>Instant Settlement</span>
          </div>
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// JOURNEY SELECTOR SECTION
// ============================================================================

function JourneySelectorSection() {
  return (
    <section className="relative py-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Choose Your Treasury Path
          </h2>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            We've built specialized solutions for every type of organization.
            Select your segment to see how we can help.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TREASURY_JOURNEYS.map((journey) => (
            <JourneyCard key={journey.id} journey={journey} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// THREE LAYER SECTION
// ============================================================================

function ThreeLayerSection() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 bg-[#030712]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(16,185,129,0.08),transparent)]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-white/70 text-sm font-medium">The Three-Layer Model</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">
            One Deposit.
            <span className="text-white/40"> Three Layers of Value.</span>
          </h2>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            Every dollar you deposit creates protection, credit, and appreciation.
            Your treasury works harder without taking on risk.
          </p>
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
              Your deposit is 100% protected and always withdrawable.
              It backs your credit line 1:1 while earning treasury yield.
            </p>
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <BadgeCheck className="w-4 h-4" />
              <span>100% yours, always</span>
            </div>
          </GlassCard>

          {/* Layer 2 */}
          <GlassCard className="p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-amber-500/30">
              <Coins className="w-7 h-7 text-white" />
            </div>
            <div className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">Layer 2</div>
            <h3 className="text-2xl font-bold text-white mb-3">GRAIN Credit Line</h3>
            <p className="text-white/50 leading-relaxed mb-6">
              Get 1:1 GRAIN credit at deposit price. 0% interest.
              0% transaction fees. Pay suppliers, run payroll, disburse funds.
            </p>
            <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
              <DollarSign className="w-4 h-4" />
              <span>0% interest forever</span>
            </div>
          </GlassCard>

          {/* Layer 3 */}
          <GlassCard className="p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-violet-500/30">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div className="text-violet-400 text-xs font-semibold uppercase tracking-wider mb-3">Layer 3</div>
            <h3 className="text-2xl font-bold text-white mb-3">Appreciation</h3>
            <p className="text-white/50 leading-relaxed mb-6">
              Bonus GRAIN from ecosystem growth. Your purchasing power
              grows as more organizations join the network.
            </p>
            <div className="flex items-center gap-2 text-violet-400 text-sm font-medium">
              <TrendingUp className="w-4 h-4" />
              <span>Grows with the network</span>
            </div>
          </GlassCard>
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
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1a] to-[#030712]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(16,185,129,0.15),transparent)]" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-500 rounded-3xl mb-10 shadow-2xl shadow-emerald-500/30">
          <Vault className="w-10 h-10 text-black" />
        </div>

        <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-6">
          Ready to Protect
          <br />
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Your Treasury?
          </span>
        </h2>

        <p className="text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed">
          Join organizations using Grain & Vault for protected reserves,
          zero-interest credit, and instant settlement.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <ShimmerButton href="/join?journey=treasury" className="w-full sm:w-auto text-lg">
            Open Your Vault
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </ShimmerButton>
          <ShimmerButton href="/grain-vault/demo" variant="secondary" className="w-full sm:w-auto text-lg">
            Book a Demo
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

export default function TreasuryLandingPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white antialiased overflow-x-hidden">
      <style jsx global>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-shift {
          animation: gradient-shift 4s ease infinite;
        }
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
      <JourneySelectorSection />
      <ThreeLayerSection />
      <CTASection />
      <Footer />
    </div>
  )
}
