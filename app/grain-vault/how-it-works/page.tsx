'use client'

/**
 * Grain & Vault - How It Works
 * Interactive Commercial Demo Experience
 *
 * A cinematic, scroll-driven journey through the GRAIN ecosystem
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
  FileCheck
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

// Interactive deposit simulator
function DepositSimulator() {
  const [amount, setAmount] = useState(1000)
  const [months, setMonths] = useState(12)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(0)

  // Simulated appreciation (2% per month average)
  const monthlyRate = 0.02
  const projectedValue = amount * Math.pow(1 + monthlyRate, months)
  const totalGain = projectedValue - amount
  const percentGain = ((projectedValue / amount) - 1) * 100

  // Traditional savings comparison (0.5% APY)
  const traditionalRate = 0.005 / 12
  const traditionalValue = amount * Math.pow(1 + traditionalRate, months)
  const traditionalGain = traditionalValue - amount

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

  const currentValue = amount * Math.pow(1 + monthlyRate, currentMonth)

  return (
    <div className="relative">
      <div className="absolute -inset-1 bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl blur opacity-20" />
      <div className="relative bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold text-white">Try It Yourself</h3>
          <div className="flex items-center gap-2 text-sm text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live Simulator
          </div>
        </div>

        {/* Amount Slider */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400">Deposit Amount</span>
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
              Watch Your Money Grow
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

        {/* Results Comparison */}
        <div className="grid grid-cols-2 gap-4">
          {/* GRAIN */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                <Zap className="w-4 h-4 text-black" />
              </div>
              <span className="font-bold text-green-400">GRAIN</span>
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              ${currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="flex items-center gap-2 text-green-400">
              <TrendingUp className="w-4 h-4" />
              <span className="font-medium">
                +${(currentValue - amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-green-400/60">
                ({(((currentValue / amount) - 1) * 100).toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* Traditional */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-red-400" />
              </div>
              <span className="font-bold text-red-400">Bank Savings</span>
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              ${(amount * Math.pow(1 + traditionalRate, currentMonth)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="flex items-center gap-2 text-red-400">
              <TrendingDown className="w-4 h-4" />
              <span className="font-medium">
                +${((amount * Math.pow(1 + traditionalRate, currentMonth)) - amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-red-400/60">
                (0.5% APY)
              </span>
            </div>
          </div>
        </div>

        {/* Difference callout */}
        {currentMonth > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 rounded-xl bg-gradient-to-r from-green-500/20 to-blue-500/20 border border-green-500/30"
          >
            <div className="text-center">
              <span className="text-gray-400">With GRAIN you earn </span>
              <span className="text-2xl font-bold text-green-400">
                ${((currentValue - amount) - ((amount * Math.pow(1 + traditionalRate, currentMonth)) - amount)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-gray-400"> more</span>
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
      description: 'Add money instantly using your card or bank account. Available in 180+ countries with zero deposit fees.',
      features: [
        'Instant deposits with card or bank',
        'Zero deposit fees',
        'Available in 180+ countries',
        'Secure & encrypted'
      ],
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: RefreshCw,
      title: 'Convert to GRAIN',
      description: 'Your deposit automatically converts to GRAIN at the current market rate. GRAIN is 100% backed by real assets.',
      features: [
        'Instant conversion',
        '100% asset-backed',
        'Real-time pricing',
        'No hidden fees'
      ],
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: TrendingUp,
      title: 'Watch It Grow',
      description: 'Unlike traditional money that loses value to inflation, GRAIN is designed to appreciate as our treasury grows.',
      features: [
        'Anti-inflationary by design',
        'Treasury-backed appreciation',
        'All holders benefit equally',
        'Compound growth'
      ],
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: Globe,
      title: 'Use Anywhere',
      description: 'Spend, send, or withdraw your GRAIN anytime. Instant transfers globally with zero fees.',
      features: [
        'Instant global transfers',
        'Zero transaction fees',
        'Convert back anytime',
        'Full control, always'
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
              <div className="text-sm text-gray-500">Collateralized</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-400 mb-2">
                {'<'}<AnimatedNumber value={1} />s
              </div>
              <div className="text-sm text-gray-500">Settlement</div>
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
                Ready to grow your money?
              </h2>

              <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
                Join thousands who've already made the switch.
                Start with any amount. Withdraw anytime.
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
                  No lock-ups
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Withdraw anytime
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
