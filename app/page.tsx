'use client'

/**
 * Grain & Vault - Unified Homepage
 *
 * The single source of truth for both wellsonyx.io and grainandvault.com
 * Grain & Vault is the leading brand with "Powered by WellsAI" attribution
 *
 * Design: Premium glassmorphism, emerald/green theme
 * Business Model: Protected deposit + 1:1 credit line + 0% fees
 */

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Sparkles,
  Shield,
  Zap,
  Brain,
  Globe,
  Lock,
  TrendingUp,
  Users,
  Building2,
  ChevronDown,
  Play,
  CheckCircle2,
  ArrowUpRight,
  MessageSquare,
  Boxes,
  Wallet,
  Coins,
  Vault,
  BarChart3,
  Code,
  Layers,
  BadgeCheck,
  Clock,
  DollarSign
} from 'lucide-react'

// ============================================================================
// ANIMATED COMPONENTS
// ============================================================================

function useCounter(end: number, duration: number = 2000, start: number = 0) {
  const [count, setCount] = useState(start)
  const [hasStarted, setHasStarted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true)
        }
      },
      { threshold: 0.3 }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [hasStarted])

  useEffect(() => {
    if (!hasStarted) return

    let startTime: number
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * (end - start) + start))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [hasStarted, end, start, duration])

  return { count, ref }
}

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
      {/* Shimmer effect */}
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
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      scrolled
        ? 'bg-black/80 backdrop-blur-2xl border-b border-white/5'
        : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
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

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            <Link href="#how-it-works" className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium rounded-lg hover:bg-white/5 transition-all">
              How It Works
            </Link>
            <Link href="#products" className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium rounded-lg hover:bg-white/5 transition-all">
              Products
            </Link>
            <Link href="#treasury" className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium rounded-lg hover:bg-white/5 transition-all">
              Treasury SDK
            </Link>
            <Link href="#wellsai" className="px-4 py-2 text-violet-400 hover:text-violet-300 text-sm font-medium rounded-lg hover:bg-violet-500/10 transition-all flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5" />
              WellsAI
            </Link>
            <Link href="/grain-vault/blog" className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium rounded-lg hover:bg-white/5 transition-all">
              Blog
            </Link>
          </div>

          {/* Right CTA */}
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
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Animated mesh gradient background */}
      <div className="absolute inset-0 bg-[#030712]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.25),rgba(255,255,255,0))]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_60%,rgba(20,184,166,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_20%_80%,rgba(251,191,36,0.08),transparent)]" />
      </div>

      {/* Animated grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" />

      {/* Floating orbs */}
      <div className="absolute w-[600px] h-[600px] bg-gradient-to-br from-emerald-600/30 to-teal-800/20 rounded-full blur-3xl -top-32 -left-32 animate-pulse opacity-50" />
      <div className="absolute w-[500px] h-[500px] bg-gradient-to-br from-teal-500/20 to-emerald-600/10 rounded-full blur-3xl -bottom-40 -right-20 animate-pulse opacity-50" style={{ animationDelay: '1s' }} />
      <div className="absolute w-[300px] h-[300px] bg-gradient-to-br from-amber-500/10 to-orange-600/5 rounded-full blur-3xl top-1/2 right-1/4 animate-pulse opacity-40" style={{ animationDelay: '2s' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full backdrop-blur-sm mb-8 animate-fade-in-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-emerald-400 text-sm font-medium">Enterprise Treasury Infrastructure</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white tracking-tight leading-[0.9] mb-8 animate-fade-in-up animation-delay-100">
            Protected Treasury.
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_auto]">
              Zero Friction.
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-in-up animation-delay-200">
            Deposit your predictable spend. 100% protected reserves.
            0% interest credit line. 0% transaction fees.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in-up animation-delay-300">
            <ShimmerButton href="/join?journey=treasury" className="w-full sm:w-auto">
              Open Your Vault
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </ShimmerButton>
            <ShimmerButton href="#how-it-works" variant="secondary" className="w-full sm:w-auto">
              <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-all mr-2">
                <Play className="w-3.5 h-3.5 text-white ml-0.5" />
              </div>
              See How It Works
            </ShimmerButton>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-white/40 text-sm animate-fade-in-up animation-delay-400">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400/80">100% Collateralized</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>&lt;1s Settlement</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span>Bank-Grade Security</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span>Global Infrastructure</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/20 rounded-full flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-white/40 rounded-full animate-scroll-indicator" />
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// THREE LAYER SECTION - The Core Value Prop
// ============================================================================

function ThreeLayerSection() {
  return (
    <section id="how-it-works" className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="text-white/70 text-sm font-medium">The Three Layers</span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight mb-6">
            How Your Money
            <br />
            <span className="text-white/40">Actually Works</span>
          </h2>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            One deposit creates three layers of value. Your cash is always protected,
            but it works harder for you.
          </p>
        </div>

        {/* Three Layer Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Layer 1: Protected Deposit */}
          <GlassCard className="p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/30">
              <Vault className="w-7 h-7 text-white" />
            </div>
            <div className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">Layer 1</div>
            <h3 className="text-2xl font-bold text-white mb-3">Protected Deposit</h3>
            <p className="text-white/50 leading-relaxed mb-6">
              Your USD deposit is 100% protected and always withdrawable.
              It backs your credit line 1:1 and earns yield for the treasury.
            </p>
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <BadgeCheck className="w-4 h-4" />
              <span>Always 100% yours</span>
            </div>
          </GlassCard>

          {/* Layer 2: Credit Line */}
          <GlassCard className="p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-amber-500/30">
              <Coins className="w-7 h-7 text-white" />
            </div>
            <div className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">Layer 2</div>
            <h3 className="text-2xl font-bold text-white mb-3">GRAIN Credit Line</h3>
            <p className="text-white/50 leading-relaxed mb-6">
              Get 1:1 GRAIN credit at deposit price. 0% interest.
              0% transaction fees. Spend with suppliers in the network.
            </p>
            <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
              <DollarSign className="w-4 h-4" />
              <span>0% interest forever</span>
            </div>
          </GlassCard>

          {/* Layer 3: Appreciation */}
          <GlassCard className="p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-violet-500/30">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div className="text-violet-400 text-xs font-semibold uppercase tracking-wider mb-3">Layer 3</div>
            <h3 className="text-2xl font-bold text-white mb-3">Appreciation</h3>
            <p className="text-white/50 leading-relaxed mb-6">
              Bonus GRAIN from ecosystem growth. Funded by transaction fees
              and treasury yield. Your purchasing power grows.
            </p>
            <div className="flex items-center gap-2 text-violet-400 text-sm font-medium">
              <TrendingUp className="w-4 h-4" />
              <span>Grows with the network</span>
            </div>
          </GlassCard>
        </div>

        {/* Example Flow */}
        <div className="mt-16">
          <GlassCard className="p-8 md:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-2xl font-bold text-white mb-6">Example: $1M Deposit</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                      <Vault className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-white font-semibold">Protected: $1,000,000</div>
                      <div className="text-white/50 text-sm">Your deposit, always available</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                      <Coins className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <div className="text-white font-semibold">Credit Line: 100,000 GRAIN</div>
                      <div className="text-white/50 text-sm">At $10/GRAIN (your lock-in price)</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                    <div className="w-10 h-10 bg-violet-500/20 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <div className="text-white font-semibold">Appreciation: Grows</div>
                      <div className="text-white/50 text-sm">Bonus GRAIN as network scales</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-center lg:text-left">
                <div className="text-5xl font-bold text-white mb-4">
                  0%
                </div>
                <div className="text-emerald-400 text-lg font-medium mb-2">Interest on Credit</div>
                <p className="text-white/50 mb-6">
                  Unlike traditional credit lines, GRAIN has no interest charges.
                  Use your credit line to pay suppliers, then replenish when convenient.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/join?journey=treasury"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all"
                  >
                    Start Your Deposit
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// PRODUCTS SECTION
// ============================================================================

function ProductsSection() {
  return (
    <section id="products" className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 bg-[#030712]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(16,185,129,0.08),transparent)]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6">
            <Boxes className="w-4 h-4 text-emerald-400" />
            <span className="text-white/70 text-sm font-medium">The Products</span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight mb-6">
            Three Products.
            <br />
            <span className="text-white/40">One Platform.</span>
          </h2>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* GRAIN */}
          <GlassCard className="p-8 lg:p-10">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-amber-500/30">
              <Coins className="w-8 h-8 text-white" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 rounded-full mb-4">
              <span className="text-amber-300 text-xs font-semibold uppercase tracking-wider">Currency</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">GRAIN</h3>
            <p className="text-white/50 leading-relaxed mb-6">
              The settlement currency. Backed 100% by treasury assets.
              Appreciates as the network grows. Zero transaction fees.
            </p>
            <ul className="space-y-3 text-white/60 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                100% asset-backed
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                &lt;1 second settlement
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                Zero chargebacks
              </li>
            </ul>
          </GlassCard>

          {/* VAULT */}
          <GlassCard className="p-8 lg:p-10">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/30">
              <Vault className="w-8 h-8 text-white" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full mb-4">
              <span className="text-emerald-300 text-xs font-semibold uppercase tracking-wider">Treasury</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">VAULT</h3>
            <p className="text-white/50 leading-relaxed mb-6">
              Protected reserve infrastructure. Your deposits are always 100%
              collateralized and withdrawable. Full transparency.
            </p>
            <ul className="space-y-3 text-white/60 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                100% protected reserves
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Real-time transparency
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Instant withdrawals
              </li>
            </ul>
          </GlassCard>

          {/* WellsAI */}
          <GlassCard className="p-8 lg:p-10 border-violet-500/20">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-violet-500/30">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 border border-violet-500/30 rounded-full mb-4">
              <span className="text-violet-300 text-xs font-semibold uppercase tracking-wider">AI Engine</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">WellsAI</h3>
            <p className="text-white/50 leading-relaxed mb-6">
              The intelligence layer. AI-to-AI negotiation. Automated sourcing,
              hiring, and sales. You approve, Wells executes.
            </p>
            <ul className="space-y-3 text-white/60 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-violet-400" />
                AI-to-AI negotiation
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-violet-400" />
                Human-in-the-loop approval
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-violet-400" />
                1% fee on AI-closed deals
              </li>
            </ul>
            <Link href="/wells-ai" className="mt-6 inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors">
              Learn more about WellsAI
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </GlassCard>
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// TREASURY SDK SECTION
// ============================================================================

function TreasurySDKSection() {
  return (
    <section id="treasury" className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#030712] to-[#0a0f1a]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6">
              <Code className="w-4 h-4 text-emerald-400" />
              <span className="text-white/70 text-sm font-medium">Treasury SDK</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-6">
              Integrate Treasury
              <br />
              <span className="text-white/40">In Minutes</span>
            </h2>
            <p className="text-lg text-white/50 mb-8 leading-relaxed">
              Connect your ERP. Push your payables. Let GRAIN handle settlement.
              Full visibility into treasury health, credit usage, and appreciation.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 text-white/70">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>REST API with TypeScript SDK</span>
              </div>
              <div className="flex items-center gap-3 text-white/70">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>NetSuite, SAP, Oracle connectors</span>
              </div>
              <div className="flex items-center gap-3 text-white/70">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Webhook events for all transactions</span>
              </div>
              <div className="flex items-center gap-3 text-white/70">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Sandbox environment included</span>
              </div>
            </div>

            <Link
              href="/join?journey=treasury"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all"
            >
              Get API Access
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Code Example */}
          <div>
            <GlassCard className="p-6 overflow-hidden" hover={false}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="text-white/30 text-xs ml-2 font-mono">treasury-sdk.ts</span>
              </div>
              <pre className="text-sm overflow-x-auto">
                <code className="text-white/80 font-mono">
{`import { GrainVault } from '@grainvault/sdk'

const vault = new GrainVault({
  apiKey: process.env.VAULT_API_KEY
})

// Push payable from ERP
const payment = await vault.payments.create({
  supplier_id: 'sup_123',
  amount_grain: 10000,
  invoice_ref: 'INV-2025-001',
  due_date: '2025-02-15'
})

// Check treasury health
const health = await vault.treasury.health()
console.log(health.credit_available)
// => 90000 GRAIN`}
                </code>
              </pre>
            </GlassCard>
          </div>
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// WELLSAI SECTION - Prominent AI Feature Section
// ============================================================================

function WellsAISection() {
  return (
    <section id="wellsai" className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1a] via-[#0f0a1a] to-[#030712]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(139,92,246,0.15),transparent)]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Content */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500/10 border border-violet-500/20 rounded-full mb-6">
              <Brain className="w-4 h-4 text-violet-400" />
              <span className="text-violet-300 text-sm font-medium">WellsAI - AI Execution Layer</span>
            </div>

            <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-6">
              AI That Actually
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                Does Things
              </span>
            </h2>

            <p className="text-lg text-white/50 mb-8 leading-relaxed">
              WellsAI is the intelligence layer. Tell it what you need - sourcing, hiring, sales, negotiations.
              AI-to-AI execution with human approval. You stay in control.
            </p>

            {/* Feature List */}
            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-4 p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                <div className="w-10 h-10 bg-violet-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <div className="text-white font-semibold mb-1">AI-to-AI Negotiation</div>
                  <div className="text-white/50 text-sm">Your AI negotiates with supplier AIs. Deals close faster.</div>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                <div className="w-10 h-10 bg-violet-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <div className="text-white font-semibold mb-1">Automated Sourcing</div>
                  <div className="text-white/50 text-sm">Find suppliers, get quotes, compare options - all automated.</div>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                <div className="w-10 h-10 bg-violet-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BadgeCheck className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <div className="text-white font-semibold mb-1">Human-in-the-Loop</div>
                  <div className="text-white/50 text-sm">Every deal requires your approval. AI executes, you decide.</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/wells-ai"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-400 hover:to-purple-500 transition-all shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
              >
                Explore WellsAI
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/10 transition-all"
              >
                See Demo
              </Link>
            </div>
          </div>

          {/* Right: Pricing Card */}
          <div>
            <GlassCard className="p-8 lg:p-10 border-violet-500/20" hover={false}>
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 border border-violet-500/30 rounded-full mb-4">
                  <span className="text-violet-300 text-xs font-semibold uppercase tracking-wider">WellsAI Pricing</span>
                </div>
                <div className="text-6xl font-bold text-white mb-2">
                  1<span className="text-violet-400">%</span>
                </div>
                <div className="text-white/50 text-lg">Success Fee</div>
              </div>

              <div className="border-t border-white/10 pt-8 mb-8">
                <p className="text-white/60 text-center mb-6">
                  Only pay when WellsAI closes deals for you.
                  <br />
                  No monthly fees. No setup costs.
                </p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-white/70 text-sm">Treasury (Grain & Vault)</span>
                    <span className="text-emerald-400 font-semibold">0% fees</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-white/70 text-sm">Payments (GRAIN)</span>
                    <span className="text-emerald-400 font-semibold">0% fees</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-violet-500/10 rounded-lg border border-violet-500/20">
                    <span className="text-white/70 text-sm">AI Sourcing & Deals (WellsAI)</span>
                    <span className="text-violet-400 font-semibold">1% on close</span>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <p className="text-white/40 text-xs">
                  The 1% fee is part of your Cost of Goods Sold (COGS),
                  <br />
                  not a transaction fee. Pay when value is delivered.
                </p>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// STATS SECTION - Treasury Metrics (separated from WellsAI)
// ============================================================================

function StatsSection() {
  return (
    <section className="relative py-20 overflow-hidden">
      <div className="absolute inset-0 bg-[#030712]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Section Label */}
        <div className="text-center mb-8">
          <span className="text-emerald-400/60 text-sm font-medium uppercase tracking-wider">Grain & Vault Treasury</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
          <GlassCard className="p-8 text-center">
            <div className="text-4xl md:text-5xl font-bold text-white mb-2">
              100<span className="text-emerald-400">%</span>
            </div>
            <div className="text-white/50 text-sm">Collateralized</div>
          </GlassCard>
          <GlassCard className="p-8 text-center">
            <div className="text-4xl md:text-5xl font-bold text-white mb-2">
              0<span className="text-emerald-400">%</span>
            </div>
            <div className="text-white/50 text-sm">Interest & Transaction Fees</div>
          </GlassCard>
          <GlassCard className="p-8 text-center col-span-2 lg:col-span-1">
            <div className="text-4xl md:text-5xl font-bold text-white mb-2">
              &lt;1<span className="text-emerald-400">s</span>
            </div>
            <div className="text-white/50 text-sm">Settlement</div>
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
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1a] to-[#030712]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(16,185,129,0.15),transparent)]" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Logo mark */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-500 rounded-3xl mb-10 shadow-2xl shadow-emerald-500/30">
          <Coins className="w-10 h-10 text-black" />
        </div>

        <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight mb-6">
          Ready to Modernize
          <br />
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Your Treasury?
          </span>
        </h2>

        <p className="text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed">
          Join enterprises using Grain & Vault for protected reserves,
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
          No minimum deposit. Start protecting your treasury today.
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
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
          {/* Brand */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                  <Coins className="w-5 h-5 text-black" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-gradient-to-br from-amber-400 to-amber-500 rounded-md" />
              </div>
              <span className="text-white font-semibold text-lg">Grain & Vault</span>
            </Link>
            <p className="text-white/40 text-sm leading-relaxed mb-4">
              Protected treasury infrastructure.
              Zero friction payments.
            </p>
            {/* Powered by WellsAI */}
            <div className="flex items-center gap-2 text-white/30 text-xs">
              <Brain className="w-3 h-3" />
              <span>Powered by WellsAI</span>
            </div>
          </div>

          {/* Products */}
          <div>
            <h4 className="text-white font-semibold mb-4">Products</h4>
            <ul className="space-y-3">
              <li><Link href="/grain-vault" className="text-white/50 hover:text-emerald-400 text-sm transition-colors">GRAIN</Link></li>
              <li><Link href="/grain-vault" className="text-white/50 hover:text-emerald-400 text-sm transition-colors">VAULT</Link></li>
              <li><Link href="/wells-ai" className="text-white/50 hover:text-emerald-400 text-sm transition-colors">WellsAI</Link></li>
              <li><Link href="/grain-vault/treasury" className="text-white/50 hover:text-emerald-400 text-sm transition-colors">Treasury SDK</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              <li><Link href="/grain-vault/blog" className="text-white/50 hover:text-emerald-400 text-sm transition-colors">Blog</Link></li>
              <li><a href="mailto:hello@grainandvault.com" className="text-white/50 hover:text-emerald-400 text-sm transition-colors">Contact</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-white font-semibold mb-4">Resources</h4>
            <ul className="space-y-3">
              <li><Link href="#how-it-works" className="text-white/50 hover:text-emerald-400 text-sm transition-colors">How It Works</Link></li>
              <li><Link href="/grain-vault/faq" className="text-white/50 hover:text-emerald-400 text-sm transition-colors">FAQ</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-3">
              <li><Link href="/privacy" className="text-white/50 hover:text-emerald-400 text-sm transition-colors">Privacy</Link></li>
              <li><Link href="/terms" className="text-white/50 hover:text-emerald-400 text-sm transition-colors">Terms</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/10">
          <p className="text-white/30 text-sm mb-4 md:mb-0">
            © 2025 Grain & Vault. A Wells Onyx company. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-white/30 text-sm">
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              All Systems Operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function GrainVaultHomepage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white antialiased overflow-x-hidden">
      {/* Custom styles for animations */}
      <style jsx global>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        @keyframes scroll-indicator {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(8px); opacity: 0.5; }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
        }

        .animation-delay-100 {
          animation-delay: 100ms;
        }

        .animation-delay-200 {
          animation-delay: 200ms;
        }

        .animation-delay-300 {
          animation-delay: 300ms;
        }

        .animation-delay-400 {
          animation-delay: 400ms;
        }

        .animate-gradient-shift {
          animation: gradient-shift 4s ease infinite;
        }

        .animate-scroll-indicator {
          animation: scroll-indicator 2s ease-in-out infinite;
        }

        /* Smooth scrolling */
        html {
          scroll-behavior: smooth;
        }

        /* Custom scrollbar - emerald theme */
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

        /* Selection - emerald */
        ::selection {
          background: rgba(16, 185, 129, 0.3);
          color: white;
        }
      `}</style>

      <Navigation />
      <HeroSection />
      <ThreeLayerSection />
      <ProductsSection />
      <TreasurySDKSection />
      <WellsAISection />
      <StatsSection />
      <CTASection />
      <Footer />

      {/* Floating chat FAB */}
      <Link
        href="/founder/chat"
        className="fixed bottom-6 right-6 z-50 group"
      >
        <div className="absolute inset-0 bg-emerald-500/30 rounded-2xl blur-xl group-hover:bg-emerald-500/50 transition-all" />
        <div className="relative w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-110 transition-all">
          <MessageSquare className="w-6 h-6 text-black" />
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-[#030712]">
          <span className="absolute inset-0 bg-amber-500 rounded-full animate-ping opacity-50" />
        </div>
      </Link>
    </div>
  )
}
