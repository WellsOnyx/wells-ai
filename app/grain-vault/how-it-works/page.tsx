'use client'

/**
 * Grain & Vault - How It Works
 * Interactive Commercial Demo Experience
 *
 * A cinematic, scroll-driven journey through the GRAIN ecosystem
 *
 * KEY VALUE PROPOSITIONS:
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. Your deposit is always protected - You can get your money back anytime
 * 2. GRAIN grows in value - The more the ecosystem grows, the more your GRAIN is worth
 * 3. Real backing, real value - Not crypto speculation, backed by real assets
 * 4. Zero fees inside the ecosystem - Payments within GRAIN are free
 *
 * PREFERRED LANGUAGE:
 * - "Protected deposit" instead of "principal"
 * - "Current value" instead of "GRAIN price × balance"
 * - "Ecosystem growth" instead of "platform valuation"
 * - "Cash available" instead of "USDC liquidity"
 * - "Total value" instead of "equity value"
 *
 * LANGUAGE TO AVOID:
 * - Any mention of "equity" or "liquidity" as separate concepts
 * - Technical terms like "treasury", "coverage ratio", "vault floor"
 * - Formulas or calculations
 * - Comparisons to crypto/blockchain mechanics
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion'
import {
  Zap,
  Shield,
  ArrowRight,
  ArrowDown,
  CheckCircle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Globe,
  Lock,
  Clock,
  Wallet,
  Building2,
  CreditCard,
  RefreshCw,
  Play,
  Pause,
  ChevronRight,
  Sparkles,
  BarChart3,
  PiggyBank,
  ArrowUpRight,
  Check,
  X,
  CircleDollarSign,
  Banknote,
  BadgePercent,
  Timer,
  Eye,
  FileCheck,
  AlertCircle,
  ShoppingCart,
  Send,
  Landmark,
  Scale,
  HandshakeIcon
} from 'lucide-react'

// Animated counter component
function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 2000
}: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  duration?: number
}) {
  const [displayValue, setDisplayValue] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (!isInView) return

    let startTime: number
    let animationFrame: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)

      // Easing function
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(eased * value)

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [isInView, value, duration])

  return (
    <span ref={ref}>
      {prefix}{displayValue.toFixed(decimals)}{suffix}
    </span>
  )
}

// Floating particle background
function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(50)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-green-500/30 rounded-full"
          initial={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
            y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
          }}
          animate={{
            y: [null, -20, 20],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            repeatType: 'reverse',
            delay: Math.random() * 2,
          }}
        />
      ))}
    </div>
  )
}

// Interactive value growth calculator - Shows potential ecosystem growth
function DepositSimulator() {
  const [depositAmount, setDepositAmount] = useState(50000)
  const [currency, setCurrency] = useState('USD')
  const [showBreakdown, setShowBreakdown] = useState(false)

  // Value growth based on ecosystem expansion (not fees)
  // Conservative projection: ecosystem growth creates value
  const ecosystemGrowthRate = 0.08 // 8% annual ecosystem growth (conservative)
  const yearOneValue = depositAmount * (1 + ecosystemGrowthRate)
  const yearThreeValue = depositAmount * Math.pow(1 + ecosystemGrowthRate, 3)
  const yearFiveValue = depositAmount * Math.pow(1 + ecosystemGrowthRate, 5)

  // Total value growth projection
  const yearlyGrowth = yearOneValue - depositAmount
  const threeYearGrowth = yearThreeValue - depositAmount
  const fiveYearGrowth = yearFiveValue - depositAmount

  // Currency conversion display
  const fxRates: Record<string, { rate: number; symbol: string }> = {
    USD: { rate: 1, symbol: '$' },
    EUR: { rate: 0.92, symbol: '€' },
    GBP: { rate: 0.79, symbol: '£' },
    MXN: { rate: 17.15, symbol: '$' },
    BRL: { rate: 4.97, symbol: 'R$' },
    CAD: { rate: 1.36, symbol: 'C$' },
  }
  const fx = fxRates[currency] || fxRates.USD

  const formatCurrency = (usd: number) => {
    const local = usd * fx.rate
    if (currency === 'USD') return `$${local.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    return `${fx.symbol}${local.toLocaleString(undefined, { maximumFractionDigits: 0 })} (≈$${usd.toLocaleString(undefined, { maximumFractionDigits: 0 })})`
  }

  return (
    <div className="relative">
      <div className="absolute -inset-1 bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl blur opacity-20" />
      <div className="relative bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold text-white">See Your Potential Value Growth</h3>
          <div className="flex items-center gap-2 text-sm text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Value Calculator
          </div>
        </div>

        {/* Deposit Amount Slider */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400">Your Protected Deposit</span>
            <span className="text-2xl font-bold text-white">{formatCurrency(depositAmount)}</span>
          </div>
          <input
            type="range"
            min={1000}
            max={1000000}
            step={1000}
            value={depositAmount}
            onChange={(e) => setDepositAmount(Number(e.target.value))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-green-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>$1,000</span>
            <span>$1,000,000</span>
          </div>
        </div>

        {/* Currency Selector */}
        <div className="mb-8">
          <div className="text-sm text-gray-400 mb-3">Display Currency</div>
          <div className="flex gap-2 flex-wrap">
            {Object.keys(fxRates).map(c => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  currency === c
                    ? 'bg-green-500 text-black'
                    : 'bg-white/10 text-gray-400 hover:bg-white/20'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="bg-gradient-to-br from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-xl p-6 mb-6">
          <div className="text-center mb-6">
            <div className="text-sm text-gray-400 mb-2">Potential Value in 5 Years</div>
            <div className="text-5xl font-bold text-green-400">
              {formatCurrency(yearFiveValue)}
            </div>
            <div className="text-sm text-gray-500 mt-2">
              That's +{formatCurrency(fiveYearGrowth)} in ecosystem growth
            </div>
          </div>

          {/* Breakdown toggle */}
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full py-3 rounded-lg bg-white/10 text-gray-300 font-medium hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
          >
            {showBreakdown ? 'Hide' : 'Show'} Growth Timeline
            <ChevronRight className={`w-4 h-4 transition-transform ${showBreakdown ? 'rotate-90' : ''}`} />
          </button>

          <AnimatePresence>
            {showBreakdown && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 space-y-3"
              >
                {/* Year 1 */}
                <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <div>
                      <div className="text-sm text-white">After 1 Year</div>
                      <div className="text-xs text-gray-500">Protected deposit + growth</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-bold">{formatCurrency(yearOneValue)}</div>
                    <div className="text-xs text-gray-500">+{formatCurrency(yearlyGrowth)} growth</div>
                  </div>
                </div>

                {/* Year 3 */}
                <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <div>
                      <div className="text-sm text-white">After 3 Years</div>
                      <div className="text-xs text-gray-500">Compounding ecosystem growth</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-bold">{formatCurrency(yearThreeValue)}</div>
                    <div className="text-xs text-gray-500">+{formatCurrency(threeYearGrowth)} growth</div>
                  </div>
                </div>

                {/* Year 5 */}
                <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <div>
                      <div className="text-sm text-white">After 5 Years</div>
                      <div className="text-xs text-gray-500">Full ecosystem value</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-bold">{formatCurrency(yearFiveValue)}</div>
                    <div className="text-xs text-gray-500">+{formatCurrency(fiveYearGrowth)} growth</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* The Key Point */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-blue-400 font-medium mb-1">Your Deposit is Always Protected</p>
              <p className="text-gray-400">
                Your {formatCurrency(depositAmount)} is backed by real assets and always accessible.
                As the ecosystem grows, so does your current value. Zero fees when paying
                others in the network. Cash available whenever you need it.
              </p>
            </div>
          </div>
        </div>

        {/* Important Note */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <span className="text-green-400 font-medium">Protected deposit</span> + ecosystem growth = your total value
        </div>
      </div>
    </div>
  )
}

// Step card component
function StepCard({
  step,
  icon: Icon,
  title,
  description,
  features,
  color,
  isActive
}: {
  step: number
  icon: any
  title: string
  description: string
  features: string[]
  color: string
  isActive: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: step * 0.1 }}
      className={`relative ${isActive ? 'scale-105' : 'scale-100'} transition-transform duration-300`}
    >
      <div className={`absolute -inset-1 bg-gradient-to-r ${color} rounded-2xl blur opacity-20`} />
      <div className="relative bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 h-full">
        {/* Step number */}
        <div className={`absolute -top-4 -left-4 w-10 h-10 rounded-full bg-gradient-to-r ${color} flex items-center justify-center text-black font-bold text-lg`}>
          {step}
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className={`w-14 h-14 rounded-xl bg-gradient-to-r ${color} flex items-center justify-center`}>
            <Icon className="w-7 h-7 text-black" />
          </div>
          <h3 className="text-2xl font-bold text-white">{title}</h3>
        </div>

        <p className="text-gray-400 mb-6 text-lg leading-relaxed">{description}</p>

        <ul className="space-y-3">
          {features.map((feature, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="flex items-center gap-3 text-gray-300"
            >
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              {feature}
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}

// Main component
export default function HowItWorksPage() {
  const [activeStep, setActiveStep] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef })

  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '50%'])
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])

  const steps = [
    {
      icon: Shield,
      title: 'Protected Deposit',
      description: 'Make a deposit and your money is protected from day one. Backed by real assets, accessible anytime.',
      features: [
        'Deposit protected immediately',
        'Backed by real assets',
        'Access your cash anytime',
        'No hidden fees or lock-ups'
      ],
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: TrendingUp,
      title: 'Watch Your Value Grow',
      description: 'As more people join and use the ecosystem, total value grows. Your current value increases with the ecosystem.',
      features: [
        'Value grows with ecosystem',
        'Real activity creates real value',
        'Not speculation or promises',
        'Track your growth in real-time'
      ],
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: Zap,
      title: 'Zero Fees Inside',
      description: 'Pay anyone in the network with zero fees. Your full value transfers instantly to the recipient.',
      features: [
        'Zero fees on network payments',
        'Instant transfers',
        'Full value moves with you',
        'Pay vendors, team, anyone'
      ],
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: Wallet,
      title: 'Cash Always Available',
      description: 'Your protected deposit is always accessible. Need cash? It is available when you need it. No waiting.',
      features: [
        'Access cash anytime',
        'No minimum hold period',
        'Your money, your control',
        'Protected deposit + growth'
      ],
      color: 'from-amber-500 to-orange-500'
    }
  ]

  return (
    <div ref={containerRef} className="min-h-screen bg-black text-white overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none">
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-green-950/30 via-black to-blue-950/30"
          style={{ y: backgroundY }}
        />
        <ParticleField />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/grain-vault" className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <div className="w-4 h-4 bg-black rounded-sm" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-sm" />
            </div>
            <span className="text-lg font-semibold">Grain & Vault</span>
          </Link>

          <Link
            href="/join?journey=treasury"
            className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-black font-semibold rounded-lg hover:scale-105 transition-transform"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-20">
        <motion.div style={{ opacity }} className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-medium mb-8"
          >
            <Play className="w-4 h-4" />
            Interactive Experience
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-5xl md:text-7xl font-bold mb-6"
          >
            How{' '}
            <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
              GRAIN
            </span>
            {' '}Works
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl md:text-2xl text-gray-400 mb-12 max-w-2xl mx-auto"
          >
            Your deposit is protected. Your value grows with the ecosystem. Cash is always available.
          </motion.p>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-3 gap-8 mb-16 max-w-2xl mx-auto"
          >
            <div className="text-center">
              <div className="text-4xl font-bold text-green-400 mb-2">
                <AnimatedNumber value={100} suffix="%" />
              </div>
              <div className="text-sm text-gray-500">Protected</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-400 mb-2">
                Real
              </div>
              <div className="text-sm text-gray-500">Asset-Backed</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-400 mb-2">
                <AnimatedNumber value={0} suffix="%" />
              </div>
              <div className="text-sm text-gray-500">Fees Inside Network</div>
            </div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex flex-col items-center gap-2 text-gray-500"
          >
            <span className="text-sm">Scroll to explore</span>
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <ArrowDown className="w-6 h-6" />
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* The Problem Section */}
      <section className="relative py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium mb-6">
              <TrendingDown className="w-4 h-4" />
              The Problem
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Your money deserves better.{' '}
              <span className="text-red-400">Way better.</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Inflation erodes your savings. Banks profit from your deposits.
              Your money sits idle while the world grows without you.
            </p>
          </motion.div>

          {/* Value erosion visualization */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {[
              {
                title: 'Bank Savings',
                amount: '$100,000',
                problem: '0.5% growth',
                reality: 'Inflation wins',
                breakdown: ['Purchasing power shrinks', 'Bank profits from your money', 'No real growth for you']
              },
              {
                title: 'Moving Money',
                amount: 'Every transfer',
                problem: 'Fees add up',
                reality: 'Value leaks out',
                breakdown: ['Hidden transfer costs', 'Processing fees everywhere', 'Money leaves your pocket']
              },
              {
                title: 'Idle Deposits',
                amount: 'Just sitting there',
                problem: 'Zero opportunity',
                reality: 'Missed growth',
                breakdown: ['Not working for you', 'No ecosystem benefit', 'Potential wasted']
              }
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8">
                  <div className="text-sm text-red-400 font-medium mb-2">{item.title}</div>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-2xl font-bold text-white">{item.amount}</span>
                  </div>
                  <div className="text-sm text-gray-500 mb-4">
                    The problem: <span className="text-red-400 font-medium">{item.problem}</span>
                  </div>
                  <div className="space-y-2">
                    {item.breakdown.map((text, j) => (
                      <div key={j} className="flex items-center gap-2 text-sm text-gray-400">
                        <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                        {text}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Solution callout */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center bg-green-500/10 border border-green-500/30 rounded-2xl p-8"
          >
            <div className="text-gray-400 mb-2">What if your money could be</div>
            <div className="text-5xl font-bold text-green-400 mb-2">Protected + Growing</div>
            <div className="text-gray-500">with cash always available when you need it?</div>
          </motion.div>
        </div>
      </section>

      {/* The Solution Section */}
      <section className="relative py-32 px-6 bg-gradient-to-b from-black via-green-950/20 to-black">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              The Solution
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              GRAIN:{' '}
              <span className="text-green-400">Protected. Growing. Accessible.</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Your deposit is always protected. Your value grows with the ecosystem.
              Zero fees when you pay within the network. Cash available anytime.
            </p>
          </motion.div>

          {/* Steps */}
          <div className="grid md:grid-cols-2 gap-8 mb-20">
            {steps.map((step, i) => (
              <StepCard
                key={i}
                step={i + 1}
                {...step}
                isActive={activeStep === i + 1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Simulator Section */}
      <section className="relative py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              Value Calculator
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              See your{' '}
              <span className="text-purple-400">potential growth</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Enter your deposit amount and see how your value could grow with the ecosystem.
            </p>
          </motion.div>

          <DepositSimulator />
        </div>
      </section>

      {/* Trust & Security Section */}
      <section className="relative py-32 px-6 bg-gradient-to-b from-black via-blue-950/20 to-black">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-medium mb-6">
              <Shield className="w-4 h-4" />
              Trust & Security
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Real backing.{' '}
              <span className="text-blue-400">Real protection.</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Your deposit is backed by real assets. Always protected. Always accessible.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: 'Protected Deposits',
                description: 'Your deposit is backed by real assets. Access your cash whenever you need it.',
                stat: '100%',
                statLabel: 'Protected'
              },
              {
                icon: TrendingUp,
                title: 'Growing Value',
                description: 'As the ecosystem grows, so does your current value. Real activity, real growth.',
                stat: 'Real',
                statLabel: 'Asset-backed'
              },
              {
                icon: Wallet,
                title: 'Always Accessible',
                description: 'Your money is always accessible. No lock-ups, no waiting periods.',
                stat: '24/7',
                statLabel: 'Cash available'
              }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-8"
              >
                <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center mb-6">
                  <item.icon className="w-7 h-7 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-gray-400 mb-6">{item.description}</p>
                <div className="pt-6 border-t border-blue-500/30">
                  <div className="text-3xl font-bold text-blue-400">{item.stat}</div>
                  <div className="text-sm text-gray-500">{item.statLabel}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Settlements & Escrow Section */}
      <section className="relative py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium mb-6">
              <Clock className="w-4 h-4" />
              Instant Settlements*
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Fast payments.{' '}
              <span className="text-amber-400">Protected by escrow.</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              GRAIN transactions settle instantly on your ledger, with a short escrow period to ensure
              order completion and prevent disputes. No chargebacks, no surprises.
            </p>
          </motion.div>

          {/* Escrow Timeline */}
          <div className="relative mb-16">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-amber-500 via-green-500 to-green-500/0" />

            <div className="space-y-12">
              {/* Payment Initiated */}
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative grid md:grid-cols-2 gap-8 items-center"
              >
                <div className="md:text-right">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm font-medium mb-3">
                    <Send className="w-3 h-3" />
                    Step 1
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Payment Initiated</h3>
                  <p className="text-gray-400">
                    You send GRAIN to a merchant or another user. The transaction appears instantly on both ledgers.
                  </p>
                </div>
                <div className="hidden md:block" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-blue-500 border-4 border-black" />
              </motion.div>

              {/* Escrow Period */}
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative grid md:grid-cols-2 gap-8 items-center"
              >
                <div className="hidden md:block" />
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm font-medium mb-3">
                    <Timer className="w-3 h-3" />
                    Step 2
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Escrow Hold</h3>
                  <p className="text-gray-400 mb-4">
                    Funds are held in secure escrow while the order is fulfilled. This protects both parties.
                  </p>
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                    <div className="text-sm text-amber-400 font-medium mb-2">Hold Duration</div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="text-center">
                        <div className="text-lg font-bold text-white">24hr</div>
                        <div className="text-gray-500">Standard</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-white">48hr</div>
                        <div className="text-gray-500">High value</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-white">72hr</div>
                        <div className="text-gray-500">New users</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-amber-500 border-4 border-black" />
              </motion.div>

              {/* Released */}
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative grid md:grid-cols-2 gap-8 items-center"
              >
                <div className="md:text-right">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-medium mb-3">
                    <CheckCircle className="w-3 h-3" />
                    Step 3
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Funds Released</h3>
                  <p className="text-gray-400">
                    After the escrow period, funds are automatically released to the recipient. No action needed.
                  </p>
                </div>
                <div className="hidden md:block" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-green-500 border-4 border-black" />
              </motion.div>
            </div>
          </div>

          {/* Dispute Resolution */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-2xl p-8"
          >
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Scale className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-3">Dispute Resolution</h3>
                <p className="text-gray-400 mb-6">
                  If there's an issue with your transaction, you can open a dispute during the escrow period.
                  Our resolution team reviews evidence from both parties and makes a fair decision.
                </p>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-black/30 rounded-lg p-4">
                    <div className="text-purple-400 font-medium mb-1">No Chargebacks</div>
                    <div className="text-sm text-gray-500">Escrow replaces traditional chargebacks for cleaner resolution</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-4">
                    <div className="text-purple-400 font-medium mb-1">Evidence-Based</div>
                    <div className="text-sm text-gray-500">Both parties submit proof, we make fair decisions</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-4">
                    <div className="text-purple-400 font-medium mb-1">Fast Resolution</div>
                    <div className="text-sm text-gray-500">Most disputes resolved within 24-48 hours</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Asterisk note */}
          <div className="mt-8 text-center text-sm text-gray-500">
            * Transactions appear instantly on your ledger. Funds are held in escrow for 24-72 hours depending on transaction type and account status.
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-blue-600" />
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />

            <div className="relative p-12 md:p-20 text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-3 mb-8"
              >
                <div className="w-16 h-16 rounded-2xl bg-black/20 flex items-center justify-center">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <div className="w-16 h-16 rounded-2xl bg-black/20 flex items-center justify-center">
                  <Shield className="w-8 h-8 text-white" />
                </div>
              </motion.div>

              <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
                Ready to grow your value?
              </h2>

              <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
                Join thousands who have already made the switch.
                Start with any amount. Your deposit is always protected.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/join?journey=treasury"
                  className="inline-flex items-center gap-3 px-10 py-5 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-900 transition-all hover:scale-105"
                >
                  Get Started Free
                  <ArrowRight className="w-6 h-6" />
                </Link>
                <Link
                  href="/grain-vault/deposit"
                  className="inline-flex items-center gap-3 px-10 py-5 bg-white/20 text-white rounded-xl font-bold text-lg hover:bg-white/30 transition-all backdrop-blur-sm"
                >
                  <DollarSign className="w-5 h-5" />
                  Make a Deposit
                </Link>
              </div>

              <div className="mt-10 flex items-center justify-center gap-6 text-sm text-white/60">
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  No minimums
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Zero fees
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Deposit protected
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <Link href="/grain-vault" className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <div className="w-3 h-3 bg-black rounded-sm" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-sm" />
            </div>
            <span className="font-semibold">Grain & Vault</span>
          </Link>

          <div className="flex items-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-green-500" />
              SOC 2 Type II
            </span>
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              All Systems Operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
