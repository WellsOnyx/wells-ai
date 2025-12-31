'use client'

/**
 * Grain & Vault - How It Works
 * Interactive Commercial Demo Experience
 *
 * A cinematic, scroll-driven journey through the GRAIN ecosystem
 *
 * THE REAL GRAIN MODEL:
 * - Deposit USD → Get GRAIN at 1:1
 * - Treasury invests in real assets (commercial real estate, etc.)
 * - Assets appreciate → GRAIN purchasing power grows
 * - SPENDING in ecosystem: Use full balance (principal + appreciation)
 * - CASH OUT to USD: Only get original principal back (1:1)
 * - This creates natural retention while being honest about liquidity
 *
 * SETTLEMENTS:
 * - "Instant" settlement with 24-72hr escrow hold
 * - 24hr: Standard transactions
 * - 48hr: High value (>$10k)
 * - 72hr: New users (<30 days) or flagged accounts
 * - No chargebacks - escrow handles disputes
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

// Interactive deposit simulator - Now shows Principal vs Appreciation
function DepositSimulator() {
  const [amount, setAmount] = useState(1000)
  const [months, setMonths] = useState(12)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(0)
  const [showCashOutInfo, setShowCashOutInfo] = useState(false)

  // Simulated appreciation (2% per month average from real estate, etc.)
  const monthlyRate = 0.02

  // Traditional savings comparison (0.5% APY)
  const traditionalRate = 0.005 / 12

  useEffect(() => {
    if (!isPlaying) return

    const interval = setInterval(() => {
      setCurrentMonth(prev => {
        if (prev >= months) {
          setIsPlaying(false)
          return months
        }
        return prev + 1
      })
    }, 200)

    return () => clearInterval(interval)
  }, [isPlaying, months])

  // GRAIN Values - The Real Model
  const principal = amount // Original deposit - always withdrawable 1:1
  const totalGrainValue = amount * Math.pow(1 + monthlyRate, currentMonth)
  const appreciation = totalGrainValue - principal // Gains from treasury growth
  const spendingPower = totalGrainValue // Can spend full amount in ecosystem
  const cashOutValue = principal // Can only withdraw original deposit
  const appreciationPercent = ((totalGrainValue / principal) - 1) * 100

  return (
    <div className="relative">
      <div className="absolute -inset-1 bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl blur opacity-20" />
      <div className="relative bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold text-white">See How GRAIN Works</h3>
          <div className="flex items-center gap-2 text-sm text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live Simulator
          </div>
        </div>

        {/* Amount Slider */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400">Your Deposit</span>
            <span className="text-2xl font-bold text-white">${amount.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min={100}
            max={100000}
            step={100}
            value={amount}
            onChange={(e) => {
              setAmount(Number(e.target.value))
              setCurrentMonth(0)
            }}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-green-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>$100</span>
            <span>$100,000</span>
          </div>
        </div>

        {/* Time Slider */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400">Time Period</span>
            <span className="text-2xl font-bold text-white">{months} months</span>
          </div>
          <input
            type="range"
            min={1}
            max={60}
            value={months}
            onChange={(e) => {
              setMonths(Number(e.target.value))
              setCurrentMonth(0)
            }}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-green-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>1 month</span>
            <span>5 years</span>
          </div>
        </div>

        {/* Play Button */}
        <button
          onClick={() => {
            if (currentMonth >= months) setCurrentMonth(0)
            setIsPlaying(!isPlaying)
          }}
          className="w-full py-4 mb-8 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform"
        >
          {isPlaying ? (
            <>
              <Pause className="w-5 h-5" />
              Pause Simulation
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Watch Your GRAIN Grow
            </>
          )}
        </button>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
              initial={{ width: 0 }}
              animate={{ width: `${(currentMonth / months) * 100}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Month 0</span>
            <span className="text-green-400 font-medium">Month {currentMonth}</span>
            <span>Month {months}</span>
          </div>
        </div>

        {/* GRAIN Balance Breakdown - The Real Model */}
        <div className="bg-gradient-to-br from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Zap className="w-6 h-6 text-black" />
              </div>
              <div>
                <div className="text-sm text-gray-400">Your GRAIN Balance</div>
                <div className="text-3xl font-bold text-white">
                  {totalGrainValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-lg text-green-400">GRAIN</span>
                </div>
              </div>
            </div>
            {appreciationPercent > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 rounded-lg">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-green-400 font-bold">+{appreciationPercent.toFixed(1)}%</span>
              </div>
            )}
          </div>

          {/* Principal vs Appreciation Breakdown */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-black/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Landmark className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-400">Principal</span>
              </div>
              <div className="text-2xl font-bold text-white">${principal.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-1">Your original deposit</div>
            </div>
            <div className="bg-black/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">Appreciation</span>
              </div>
              <div className="text-2xl font-bold text-green-400">
                +${appreciation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-gray-500 mt-1">From treasury growth</div>
            </div>
          </div>

          {/* Key Insight: Spend vs Cash Out */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-500/20 border border-green-500/40 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium text-green-400">Spend in GRAIN</span>
              </div>
              <div className="text-2xl font-bold text-white">
                ${spendingPower.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-green-400/70 mt-1">Full purchasing power</div>
            </div>
            <div
              className="bg-blue-500/20 border border-blue-500/40 rounded-lg p-4 cursor-pointer hover:bg-blue-500/30 transition-colors"
              onClick={() => setShowCashOutInfo(!showCashOutInfo)}
            >
              <div className="flex items-center gap-2 mb-2">
                <Banknote className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-400">Cash Out to USD</span>
                <AlertCircle className="w-3 h-3 text-blue-400/50" />
              </div>
              <div className="text-2xl font-bold text-white">${cashOutValue.toLocaleString()}</div>
              <div className="text-xs text-blue-400/70 mt-1">1:1 with deposit</div>
            </div>
          </div>

          {/* Cash Out Explanation */}
          <AnimatePresence>
            {showCashOutInfo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-gray-300">
                    <p className="font-medium text-blue-400 mb-2">Why is cash-out limited to principal?</p>
                    <p className="text-gray-400 mb-2">
                      Your appreciation comes from real asset growth (commercial real estate, etc.).
                      These assets aren't fully liquid, so we can't pay out gains in cash.
                    </p>
                    <p className="text-gray-400">
                      <strong className="text-green-400">The benefit:</strong> Spend your full balance within the GRAIN ecosystem
                      and enjoy all your gains. Your money works harder when it stays in GRAIN.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Comparison with Bank */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <div className="text-sm text-gray-400">Same deposit in a bank</div>
                <div className="text-xl font-bold text-white">
                  ${(amount * Math.pow(1 + traditionalRate, currentMonth)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">0.5% APY</div>
              <div className="text-red-400 text-sm">
                +${((amount * Math.pow(1 + traditionalRate, currentMonth)) - amount).toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom callout */}
        {appreciation > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 rounded-xl bg-gradient-to-r from-green-500/20 to-blue-500/20 border border-green-500/30"
          >
            <div className="text-center">
              <span className="text-gray-400">Extra purchasing power with GRAIN: </span>
              <span className="text-2xl font-bold text-green-400">
                ${appreciation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="text-center text-xs text-gray-500 mt-2">
              Use it for payments, transfers, or purchases within the GRAIN network
            </div>
          </motion.div>
        )}
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
      icon: Wallet,
      title: 'Deposit Funds',
      description: 'Add money instantly using your card or bank account. Your deposit becomes your principal - always withdrawable 1:1.',
      features: [
        'Instant deposits with card or bank',
        'Zero deposit fees',
        'Available in 180+ countries',
        'Principal always protected'
      ],
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Building2,
      title: 'Treasury Invests',
      description: 'Your deposit backs GRAIN while our treasury invests in real assets - commercial real estate, income properties, and more.',
      features: [
        '100% asset-backed reserves',
        'Commercial real estate portfolio',
        'Diversified investments',
        'Professional management'
      ],
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: TrendingUp,
      title: 'Appreciation Grows',
      description: 'As treasury assets appreciate, your GRAIN purchasing power grows. All holders benefit equally from ecosystem growth.',
      features: [
        'Real asset appreciation',
        'Purchasing power increases',
        'Anti-inflationary by design',
        'Compound growth over time'
      ],
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: ShoppingCart,
      title: 'Spend or Hold',
      description: 'Use your full GRAIN balance for payments and transfers. Cash out to USD anytime at 1:1 with your original deposit.',
      features: [
        'Full balance spendable in ecosystem',
        'Zero transaction fees',
        'Cash out principal anytime',
        'Appreciation unlocks in GRAIN'
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
            Experience the future of money. Watch your purchasing power grow instead of shrink.
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
                <AnimatedNumber value={180} suffix="+" />
              </div>
              <div className="text-sm text-gray-500">Countries</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-400 mb-2">
                <AnimatedNumber value={100} suffix="%" />
              </div>
              <div className="text-sm text-gray-500">Asset-Backed</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-400 mb-2">
                <AnimatedNumber value={0} suffix="%" />
              </div>
              <div className="text-sm text-gray-500">Transaction Fees</div>
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
              Your money is losing value.{' '}
              <span className="text-red-400">Every single day.</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Inflation erodes your purchasing power while banks profit from your deposits.
              It's a system designed to work against you.
            </p>
          </motion.div>

          {/* Inflation visualization */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {[
              {
                year: '2020',
                value: 100,
                label: '$100 could buy',
                items: ['Full grocery cart', '2 movie tickets + dinner', '1 tank of gas']
              },
              {
                year: '2023',
                value: 82,
                label: '$100 now buys',
                items: ['3/4 grocery cart', '1 movie ticket + dinner', '3/4 tank of gas']
              },
              {
                year: '2025',
                value: 71,
                label: '$100 will buy',
                items: ['Half grocery cart', 'Just dinner', 'Half tank of gas']
              }
            ].map((item, i) => (
              <motion.div
                key={item.year}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8">
                  <div className="text-sm text-red-400 font-medium mb-2">{item.year}</div>
                  <div className="text-5xl font-bold text-white mb-2">${item.value}</div>
                  <div className="text-sm text-gray-500 mb-6">purchasing power</div>
                  <div className="space-y-2">
                    {item.items.map((text, j) => (
                      <div key={j} className="flex items-center gap-2 text-sm text-gray-400">
                        {i === 0 ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <X className="w-4 h-4 text-red-400" />
                        )}
                        {text}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Connecting arrow */}
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-6 transform -translate-y-1/2 text-red-500/50">
                    <ChevronRight className="w-8 h-8" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
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
              <TrendingUp className="w-4 h-4" />
              The Solution
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              GRAIN:{' '}
              <span className="text-green-400">Money that appreciates.</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Instead of losing value, your GRAIN grows as our treasury expands.
              Every holder benefits equally from ecosystem growth.
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
              Live Calculator
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              See the{' '}
              <span className="text-purple-400">difference</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Compare GRAIN to traditional savings. Drag the sliders and watch the magic happen.
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
              100% backed.{' '}
              <span className="text-blue-400">100% transparent.</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Every GRAIN is fully collateralized by real assets. Verify anytime with our real-time blockchain audits.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: FileCheck,
                title: 'Real-Time Audits',
                description: 'Blockchain-verified reserves updated every 2 seconds. No trust required.',
                stat: '2s',
                statLabel: 'Audit refresh'
              },
              {
                icon: Lock,
                title: '100% Collateralized',
                description: 'Every GRAIN is backed 1:1 by USDC in secure, audited reserves.',
                stat: '100%',
                statLabel: 'Collateral ratio'
              },
              {
                icon: Eye,
                title: 'Full Transparency',
                description: 'View reserve addresses, transaction history, and audit reports anytime.',
                stat: '24/7',
                statLabel: 'Visibility'
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
                Ready to grow your purchasing power?
              </h2>

              <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
                Join thousands who've already made the switch.
                Start with any amount. Your principal is always protected.
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
                  0% fees
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Principal protected
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
