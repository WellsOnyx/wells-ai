'use client'

/**
 * Wells Onyx - 2025 Homepage Redesign
 * A premium, cutting-edge fintech landing page
 * Dark mode first with sophisticated animations
 * Bento grid layout, glassmorphism, mesh gradients
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
  Wallet
} from 'lucide-react'

// Animated counter hook
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

// Animated gradient orb component
function GradientOrb({ className }: { className?: string }) {
  return (
    <div className={`absolute rounded-full blur-3xl opacity-30 animate-pulse-slow ${className}`} />
  )
}

// Navigation component
function Navigation() {
  const [scrolled, setScrolled] = useState(false)
  const [productsOpen, setProductsOpen] = useState(false)

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
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/40 transition-all duration-300 group-hover:scale-105">
                <span className="text-black font-bold text-lg">W</span>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-md" />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-semibold text-lg tracking-tight">Wells Onyx</span>
              <span className="text-white/40 text-[10px] font-medium -mt-0.5 tracking-wider uppercase">Platform</span>
            </div>
          </Link>

          {/* Center Nav */}
          <div className="hidden md:flex items-center gap-1">
            {/* Products Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProductsOpen(!productsOpen)}
                onBlur={() => setTimeout(() => setProductsOpen(false), 150)}
                className="flex items-center gap-1.5 px-4 py-2 text-white/70 hover:text-white text-sm font-medium rounded-lg hover:bg-white/5 transition-all"
              >
                Products
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${productsOpen ? 'rotate-180' : ''}`} />
              </button>

              {productsOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-black/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Link href="/wells-ai" className="group flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 transition-all">
                    <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-all group-hover:scale-105">
                      <Brain className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold">WellsAI</span>
                        <span className="px-2 py-0.5 bg-violet-500/20 text-violet-400 text-[10px] font-semibold rounded-full uppercase tracking-wider">AI Engine</span>
                      </div>
                      <p className="text-white/50 text-sm mt-1">Enterprise AI that actually executes. Sourcing, hiring, sales, deals.</p>
                    </div>
                  </Link>

                  <Link href="/grain-vault" className="group flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 transition-all">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-all group-hover:scale-105">
                      <Wallet className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold">Grain & Vault</span>
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold rounded-full uppercase tracking-wider">Treasury</span>
                      </div>
                      <p className="text-white/50 text-sm mt-1">Zero-friction payments. Protected reserves. Modern treasury infrastructure.</p>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            <Link href="/wells-ai" className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium rounded-lg hover:bg-white/5 transition-all">
              WellsAI
            </Link>
            <Link href="/grain-vault" className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium rounded-lg hover:bg-white/5 transition-all">
              Grain & Vault
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
              href="/join"
              className="group relative px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-105"
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

// Hero Section
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Animated mesh gradient background */}
      <div className="absolute inset-0 bg-[#030712]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_60%,rgba(251,146,60,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_20%_80%,rgba(16,185,129,0.1),transparent)]" />
      </div>

      {/* Animated grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" />

      {/* Floating orbs */}
      <GradientOrb className="w-[600px] h-[600px] bg-gradient-to-br from-violet-600 to-purple-800 -top-32 -left-32 animate-float" />
      <GradientOrb className="w-[500px] h-[500px] bg-gradient-to-br from-amber-500 to-orange-600 -bottom-40 -right-20 animate-float-delayed" />
      <GradientOrb className="w-[300px] h-[300px] bg-gradient-to-br from-emerald-500 to-teal-600 top-1/2 right-1/4 animate-float-slow" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-sm mb-8 animate-fade-in-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span className="text-white/70 text-sm font-medium">Introducing Wells Onyx Platform</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white tracking-tight leading-[0.9] mb-8 animate-fade-in-up animation-delay-100">
            Enterprise AI
            <br />
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_auto]">
              That Executes
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-in-up animation-delay-200">
            Stop chatting with AI. Start using AI that does the work. WellsAI handles sourcing,
            sales, hiring, and deals. Grain & Vault manages your treasury. One platform.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in-up animation-delay-300">
            <Link
              href="/join"
              className="group w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-base font-semibold rounded-2xl hover:from-amber-400 hover:to-orange-400 transition-all shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02]"
            >
              <span className="flex items-center justify-center gap-2">
                Start Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
            <Link
              href="/demo"
              className="group w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-white/5 border border-white/10 text-white text-base font-semibold rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all backdrop-blur-sm"
            >
              <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-all">
                <Play className="w-3.5 h-3.5 text-white ml-0.5" />
              </div>
              Watch Demo
            </Link>
          </div>

          {/* Trust indicators - Early Access focused */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-white/40 text-sm animate-fade-in-up animation-delay-400">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400/80">Early Access</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Bank-Grade Security</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span>Global Infrastructure</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span>Enterprise Ready</span>
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

// Bento Grid Products Section
function ProductsSection() {
  return (
    <section className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6">
            <Boxes className="w-4 h-4 text-amber-400" />
            <span className="text-white/70 text-sm font-medium">The Platform</span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight mb-6">
            Two Products.
            <br />
            <span className="text-white/40">One Vision.</span>
          </h2>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            Wells Onyx combines intelligent automation with modern treasury infrastructure.
            Everything your enterprise needs, nothing it doesn't.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* WellsAI Card - Large */}
          <Link href="/wells-ai" className="group relative col-span-1 row-span-2 bg-gradient-to-br from-violet-500/10 to-purple-900/20 border border-violet-500/20 rounded-3xl p-8 lg:p-10 overflow-hidden hover:border-violet-500/40 transition-all duration-500 hover:shadow-2xl hover:shadow-violet-500/10">
            {/* Glow effect */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-violet-500/30 to-transparent rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative z-10">
              {/* Icon */}
              <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-violet-500/30 group-hover:scale-110 transition-transform duration-300">
                <Brain className="w-8 h-8 text-white" />
              </div>

              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 border border-violet-500/30 rounded-full mb-6">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-violet-300 text-xs font-semibold uppercase tracking-wider">AI Engine</span>
              </div>

              {/* Title */}
              <h3 className="text-3xl lg:text-4xl font-bold text-white mb-4">WellsAI</h3>

              {/* Description */}
              <p className="text-white/60 text-lg leading-relaxed mb-8">
                Enterprise AI that doesn't just chat - it executes. Tell Wells what you need:
                hiring, sourcing, sales, or deals. Watch it work.
              </p>

              {/* Features list */}
              <ul className="space-y-4 mb-10">
                {[
                  'Indirect Sourcing & RFQ Automation',
                  'Enterprise Sales & Outreach',
                  'Executive Search & Hiring',
                  'Partnership Development'
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-white/70">
                    <CheckCircle2 className="w-5 h-5 text-violet-400 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="flex items-center gap-2 text-violet-400 font-semibold group-hover:gap-4 transition-all">
                <span>Explore WellsAI</span>
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>
          </Link>

          {/* Grain & Vault Card */}
          <Link href="/grain-vault" className="group relative bg-gradient-to-br from-emerald-500/10 to-teal-900/20 border border-emerald-500/20 rounded-3xl p-8 lg:p-10 overflow-hidden hover:border-emerald-500/40 transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/10">
            {/* Glow effect */}
            <div className="absolute top-0 right-0 w-60 h-60 bg-gradient-to-br from-emerald-500/30 to-transparent rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative z-10">
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/30 group-hover:scale-110 transition-transform duration-300">
                  <Wallet className="w-7 h-7 text-white" />
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full">
                  <span className="text-emerald-300 text-xs font-semibold uppercase tracking-wider">Treasury</span>
                </div>
              </div>

              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">Grain & Vault</h3>
              <p className="text-white/60 leading-relaxed mb-6">
                Modern treasury infrastructure. Zero-friction payments with GRAIN.
                Protected reserves with VAULT.
              </p>

              <div className="flex items-center gap-2 text-emerald-400 font-semibold group-hover:gap-4 transition-all">
                <span>Learn More</span>
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>
          </Link>

          {/* Platform Benefits Card */}
          <div className="group relative bg-gradient-to-br from-amber-500/10 to-orange-900/20 border border-amber-500/20 rounded-3xl p-8 lg:p-10 overflow-hidden">
            <div className="absolute top-0 right-0 w-60 h-60 bg-gradient-to-br from-amber-500/20 to-transparent rounded-full blur-3xl" />

            <div className="relative z-10">
              <div className="grid grid-cols-2 gap-6">
                <StatCard value="<1" label="Settlement" suffix="s" />
                <StatCard value="100" label="Collateralized" suffix="%" />
                <StatCard value="0" label="Chargebacks" suffix="%" />
                <StatCard value="1" label="Simple Fee" suffix="%" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Stat Card Component
function StatCard({ value, label, suffix = '' }: { value: string, label: string, suffix?: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl lg:text-4xl font-bold text-white mb-1">
        {value}<span className="text-amber-400">{suffix}</span>
      </div>
      <div className="text-white/50 text-sm">{label}</div>
    </div>
  )
}

// How It Works Section
function HowItWorksSection() {
  const steps = [
    {
      number: '01',
      title: 'Tell Wells What You Need',
      description: 'Natural language. No forms. Just describe your sourcing, hiring, or sales goals.',
      icon: MessageSquare,
      gradient: 'from-violet-500 to-purple-600'
    },
    {
      number: '02',
      title: 'AI Executes Automatically',
      description: 'Wells finds suppliers, candidates, or leads. Sends RFQs. Schedules meetings. Does the work.',
      icon: Zap,
      gradient: 'from-amber-500 to-orange-500'
    },
    {
      number: '03',
      title: 'You Approve & Close',
      description: 'Review proposals, approve deals, make decisions. AI handles execution, you keep control.',
      icon: CheckCircle2,
      gradient: 'from-emerald-400 to-teal-500'
    }
  ]

  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 bg-[#030712]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(139,92,246,0.08),transparent)]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-white/70 text-sm font-medium">How It Works</span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight mb-6">
            Simple. Powerful.
            <br />
            <span className="text-white/40">Automated.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div
              key={i}
              className="group relative bg-white/[0.02] border border-white/10 rounded-3xl p-8 hover:bg-white/[0.04] hover:border-white/20 transition-all duration-300"
            >
              {/* Connection line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-white/20 to-transparent" />
              )}

              <div className={`w-14 h-14 bg-gradient-to-br ${step.gradient} rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <step.icon className="w-7 h-7 text-white" />
              </div>

              <div className="text-white/30 text-sm font-mono mb-3">{step.number}</div>
              <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
              <p className="text-white/50 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Metrics Section with animated counters
function MetricsSection() {
  const metric1 = useCounter(847, 2000)
  const metric2 = useCounter(23, 1500)
  const metric3 = useCounter(180, 2000)
  const metric4 = useCounter(99, 1800)

  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#030712] to-[#0a0f1a]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          <div ref={metric1.ref} className="text-center p-8 bg-white/[0.02] border border-white/10 rounded-3xl hover:bg-white/[0.04] transition-all">
            <div className="text-5xl md:text-6xl font-bold text-white mb-2">{metric1.count}</div>
            <div className="text-white/50 text-sm">Active Connections</div>
          </div>

          <div ref={metric2.ref} className="text-center p-8 bg-white/[0.02] border border-white/10 rounded-3xl hover:bg-white/[0.04] transition-all">
            <div className="text-5xl md:text-6xl font-bold text-white mb-2">{metric2.count}</div>
            <div className="text-white/50 text-sm">Deals Today</div>
          </div>

          <div ref={metric3.ref} className="text-center p-8 bg-white/[0.02] border border-white/10 rounded-3xl hover:bg-white/[0.04] transition-all">
            <div className="text-5xl md:text-6xl font-bold text-amber-400 mb-2">{metric3.count}+</div>
            <div className="text-white/50 text-sm">Countries</div>
          </div>

          <div ref={metric4.ref} className="text-center p-8 bg-white/[0.02] border border-white/10 rounded-3xl hover:bg-white/[0.04] transition-all">
            <div className="text-5xl md:text-6xl font-bold text-white mb-2">{metric4.count}%</div>
            <div className="text-white/50 text-sm">Uptime SLA</div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Early Access Section (replaces fake testimonials)
function EarlyAccessSection() {
  const benefits = [
    {
      title: "First Mover Advantage",
      description: "Join the network before your competitors. Early members shape the platform and get priority matching.",
      icon: Sparkles
    },
    {
      title: "Direct Founder Access",
      description: "Work directly with our team. Your feedback shapes the product. We're building this together.",
      icon: Users
    },
    {
      title: "Lock In Founding Rates",
      description: "Early Access members keep the 1% fee rate locked in. No bait-and-switch pricing.",
      icon: Lock
    }
  ]

  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 bg-[#030712]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_60%,rgba(251,146,60,0.08),transparent)]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 text-sm font-medium">Early Access Open</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-6">
            Join the Founding Network
          </h2>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            We're building the future of enterprise AI. Join Early Access and help shape what comes next.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {benefits.map((b, i) => (
            <div
              key={i}
              className="group relative bg-white/[0.02] border border-white/10 rounded-3xl p-8 hover:bg-white/[0.04] hover:border-amber-500/30 transition-all duration-300"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mb-6">
                <b.icon className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{b.title}</h3>
              <p className="text-white/50 leading-relaxed">{b.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// CTA Section
function CTASection() {
  return (
    <section className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1a] to-[#030712]" />

      {/* Animated gradient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(251,146,60,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_30%_70%,rgba(139,92,246,0.1),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_30%_at_70%_30%,rgba(16,185,129,0.1),transparent)]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Logo mark */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 rounded-3xl mb-10 shadow-2xl shadow-amber-500/30">
          <span className="text-black font-bold text-3xl">W</span>
        </div>

        <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight mb-6">
          Ready to Transform
          <br />
          <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
            Your Enterprise?
          </span>
        </h2>

        <p className="text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed">
          Join hundreds of businesses using Wells Onyx to automate operations,
          modernize treasury, and close deals faster.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/join"
            className="group w-full sm:w-auto px-10 py-5 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-lg font-semibold rounded-2xl hover:from-amber-400 hover:to-orange-400 transition-all shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02]"
          >
            <span className="flex items-center justify-center gap-3">
              Get Started Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          </Link>
          <Link
            href="/demo"
            className="w-full sm:w-auto px-10 py-5 bg-white/5 border border-white/20 text-white text-lg font-semibold rounded-2xl hover:bg-white/10 hover:border-white/30 transition-all backdrop-blur-sm"
          >
            Book a Demo
          </Link>
        </div>

        <p className="mt-8 text-white/40 text-sm">
          No credit card required. Start in 60 seconds.
        </p>
      </div>
    </section>
  )
}

// Footer
function Footer() {
  return (
    <footer className="relative border-t border-white/10 bg-[#030712]">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
          {/* Brand */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                  <span className="text-black font-bold text-lg">W</span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-md" />
              </div>
              <span className="text-white font-semibold text-lg">Wells Onyx</span>
            </Link>
            <p className="text-white/40 text-sm leading-relaxed">
              Enterprise AI that executes. Modern treasury infrastructure. One platform.
            </p>
          </div>

          {/* Products */}
          <div>
            <h4 className="text-white font-semibold mb-4">Products</h4>
            <ul className="space-y-3">
              <li><Link href="/wells-ai" className="text-white/50 hover:text-amber-400 text-sm transition-colors">WellsAI</Link></li>
              <li><Link href="/grain-vault" className="text-white/50 hover:text-amber-400 text-sm transition-colors">Grain & Vault</Link></li>
              <li><Link href="/wells-ai/source" className="text-white/50 hover:text-amber-400 text-sm transition-colors">Sourcing</Link></li>
              <li><Link href="/wells-ai/sell" className="text-white/50 hover:text-amber-400 text-sm transition-colors">Sales</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              <li><Link href="/grain-vault/blog" className="text-white/50 hover:text-amber-400 text-sm transition-colors">Blog</Link></li>
              <li><a href="mailto:hello@wellsonyx.com" className="text-white/50 hover:text-amber-400 text-sm transition-colors">Contact</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-white font-semibold mb-4">Resources</h4>
            <ul className="space-y-3">
              <li><Link href="/how-it-works" className="text-white/50 hover:text-amber-400 text-sm transition-colors">How It Works</Link></li>
              <li><Link href="/grain-vault/faq" className="text-white/50 hover:text-amber-400 text-sm transition-colors">FAQ</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-3">
              <li><Link href="/privacy" className="text-white/50 hover:text-amber-400 text-sm transition-colors">Privacy</Link></li>
              <li><Link href="/terms" className="text-white/50 hover:text-amber-400 text-sm transition-colors">Terms</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/10">
          <p className="text-white/30 text-sm mb-4 md:mb-0">
            2025 Wells Onyx. All rights reserved.
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

// Main Page Component
export default function WellsOnyxHomepage() {
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

        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(-10px) translateX(-5px); }
          75% { transform: translateY(-30px) translateX(5px); }
        }

        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-15px) translateX(-10px); }
          50% { transform: translateY(-25px) translateX(5px); }
          75% { transform: translateY(-10px) translateX(-5px); }
        }

        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }

        @keyframes scroll-indicator {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(8px); opacity: 0.5; }
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.5; }
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

        .animate-float {
          animation: float 15s ease-in-out infinite;
        }

        .animate-float-delayed {
          animation: float-delayed 18s ease-in-out infinite;
        }

        .animate-float-slow {
          animation: float-slow 10s ease-in-out infinite;
        }

        .animate-scroll-indicator {
          animation: scroll-indicator 2s ease-in-out infinite;
        }

        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }

        /* Smooth scrolling */
        html {
          scroll-behavior: smooth;
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.5);
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(251, 146, 60, 0.3);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(251, 146, 60, 0.5);
        }

        /* Selection */
        ::selection {
          background: rgba(251, 146, 60, 0.3);
          color: white;
        }
      `}</style>

      <Navigation />
      <HeroSection />
      <ProductsSection />
      <HowItWorksSection />
      <MetricsSection />
      <EarlyAccessSection />
      <CTASection />
      <Footer />

      {/* Floating chat FAB */}
      <Link
        href="/founder/chat"
        className="fixed bottom-6 right-6 z-50 group"
      >
        <div className="absolute inset-0 bg-amber-500/30 rounded-2xl blur-xl group-hover:bg-amber-500/50 transition-all" />
        <div className="relative w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-xl shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-110 transition-all">
          <MessageSquare className="w-6 h-6 text-black" />
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#030712]">
          <span className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-50" />
        </div>
      </Link>
    </div>
  )
}
