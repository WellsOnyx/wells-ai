'use client'

/**
 * Grain & Vault - Enterprise Demo Page
 *
 * Interactive demo for enterprise treasury/procurement buyers
 * Features:
 * - Credit line calculator
 * - ROI visualization
 * - Case study scenarios
 * - Clear CTA to schedule call
 */

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  DollarSign,
  TrendingUp,
  Shield,
  Zap,
  Calculator,
  Building2,
  ChevronRight,
  CheckCircle,
  ArrowRight,
  Clock,
  Percent,
  PiggyBank,
  CreditCard,
  RefreshCw,
  Play,
  Users,
  FileText,
  Lock,
  Wallet,
  BarChart3,
} from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

interface CalculatorInputs {
  monthlySpend: number
  currentPaymentFees: number
  currentYield: number
  industryType: string
}

interface ROIResults {
  annualYield: number
  feeSavings: number
  totalAnnualValue: number
  creditLine: number
  depositAmount: number
  monthlyPaymentVolume: number
  yearsToBreakeven: number
}

interface CaseStudy {
  id: string
  company: string
  industry: string
  logo: string
  metrics: {
    monthlySpend: number
    previousFees: number
    newFees: number
    yield: number
    savings: number
  }
  quote: string
  contact: string
  title: string
}

// =============================================================================
// DATA
// =============================================================================

const CASE_STUDIES: CaseStudy[] = [
  {
    id: '1',
    company: 'Midwest Manufacturing Co.',
    industry: 'Industrial Equipment',
    logo: 'M',
    metrics: {
      monthlySpend: 1200000,
      previousFees: 30000,
      newFees: 12000,
      yield: 54000,
      savings: 72000,
    },
    quote: "We went from earning 0.1% on idle cash to 4.5%. The credit line means we can pay suppliers same-day without touching our operating reserves.",
    contact: 'Jennifer Walsh',
    title: 'Controller',
  },
  {
    id: '2',
    company: 'Pacific Foods Distribution',
    industry: 'Food & Beverage',
    logo: 'P',
    metrics: {
      monthlySpend: 2500000,
      previousFees: 62500,
      newFees: 25000,
      yield: 112500,
      savings: 150000,
    },
    quote: "The integration with our ERP was seamless. What used to take our AP team 2 weeks now happens automatically.",
    contact: 'Michael Chen',
    title: 'VP Finance',
  },
  {
    id: '3',
    company: 'Southern Supply Chain',
    industry: 'Logistics',
    logo: 'S',
    metrics: {
      monthlySpend: 800000,
      previousFees: 20000,
      newFees: 8000,
      yield: 36000,
      savings: 48000,
    },
    quote: "Zero failed payments. Zero chargebacks. Our supplier relationships have never been better.",
    contact: 'Amanda Foster',
    title: 'CFO',
  },
]

const INDUSTRY_OPTIONS = [
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'wholesale', label: 'Wholesale Distribution' },
  { value: 'construction', label: 'Construction' },
  { value: 'food_beverage', label: 'Food & Beverage' },
  { value: 'logistics', label: 'Logistics & Supply Chain' },
  { value: 'industrial', label: 'Industrial Equipment' },
  { value: 'other', label: 'Other' },
]

// =============================================================================
// COMPONENT
// =============================================================================

export default function EnterpriseDemoPage() {
  const [inputs, setInputs] = useState<CalculatorInputs>({
    monthlySpend: 500000,
    currentPaymentFees: 2.5,
    currentYield: 0.5,
    industryType: 'manufacturing',
  })

  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedCaseStudy, setSelectedCaseStudy] = useState<CaseStudy | null>(null)
  const [activeTab, setActiveTab] = useState<'calculator' | 'cases' | 'how'>('calculator')

  // Calculate ROI
  const results: ROIResults = useMemo(() => {
    const depositAmount = inputs.monthlySpend // Deposit = 1 month of spend
    const annualSpend = inputs.monthlySpend * 12

    // GRAIN yield at 4.5%
    const annualYield = Math.round(depositAmount * 0.045)

    // Fee savings (current fees - GRAIN's 1%)
    const currentAnnualFees = annualSpend * (inputs.currentPaymentFees / 100)
    const grainAnnualFees = annualSpend * 0.01
    const feeSavings = Math.round(currentAnnualFees - grainAnnualFees)

    // Total annual value
    const totalAnnualValue = annualYield + feeSavings

    // Credit line = deposit amount (1:1)
    const creditLine = depositAmount

    return {
      annualYield,
      feeSavings,
      totalAnnualValue,
      creditLine,
      depositAmount,
      monthlyPaymentVolume: inputs.monthlySpend,
      yearsToBreakeven: 0, // Instant ROI since no setup fees
    }
  }, [inputs])

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`
    }
    return `$${(amount / 1000).toFixed(0)}K`
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/grain-vault" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-black" />
              </div>
              <span className="text-xl font-bold tracking-tight">Grain & Vault</span>
            </Link>

            <div className="flex items-center gap-4">
              <span className="hidden md:inline text-sm text-gray-400">Enterprise Demo</span>
              <a
                href="https://cal.com/grainvault/demo"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-400 text-black font-medium rounded-lg transition-colors"
              >
                <Clock className="w-4 h-4" />
                Schedule Demo
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 lg:py-24 border-b border-white/10">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-full text-green-400 text-sm font-medium mb-6">
            <Building2 className="w-4 h-4" />
            Enterprise Treasury Solution
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
            Turn Predictable Spend Into <br />
            <span className="bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
              4.5%+ Annual Yield
            </span>
          </h1>

          <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-8">
            Deposit your predictable supplier spend. Get a 1:1 credit line at 0% interest.
            Pay vendors at 0% fees. Your deposit appreciates while you use it.
          </p>

          <div className="flex flex-wrap justify-center gap-6 mb-12">
            {[
              { icon: Shield, label: '100% Principal Protected' },
              { icon: Zap, label: '0% Payment Fees' },
              { icon: TrendingUp, label: '4.5%+ Annual Yield' },
              { icon: RefreshCw, label: 'Instant Liquidity' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-gray-300">
                <item.icon className="w-5 h-5 text-green-400" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tab Navigation */}
      <div className="border-b border-white/10 bg-white/[0.02]">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex gap-8">
            {[
              { id: 'calculator', label: 'ROI Calculator', icon: Calculator },
              { id: 'cases', label: 'Case Studies', icon: FileText },
              { id: 'how', label: 'How It Works', icon: Play },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  flex items-center gap-2 py-4 border-b-2 transition-colors text-sm font-medium
                  ${activeTab === tab.id
                    ? 'border-green-500 text-green-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'}
                `}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 lg:px-8 py-12">
        {/* Calculator Tab */}
        {activeTab === 'calculator' && (
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Input Side */}
            <div>
              <h2 className="text-2xl font-bold mb-6">Calculate Your ROI</h2>
              <p className="text-gray-400 mb-8">
                See how much Grain & Vault can save your organization based on your current spend and payment costs.
              </p>

              <div className="space-y-6">
                {/* Monthly Spend */}
                <div>
                  <label className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Monthly Supplier Spend</span>
                    <span className="text-green-400 font-mono">{formatCurrency(inputs.monthlySpend)}</span>
                  </label>
                  <input
                    type="range"
                    min="100000"
                    max="5000000"
                    step="50000"
                    value={inputs.monthlySpend}
                    onChange={(e) => setInputs(prev => ({ ...prev, monthlySpend: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-green-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>$100K</span>
                    <span>$5M</span>
                  </div>
                </div>

                {/* Current Payment Fees */}
                <div>
                  <label className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Current Payment Processing Fees</span>
                    <span className="text-orange-400 font-mono">{inputs.currentPaymentFees}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="4"
                    step="0.1"
                    value={inputs.currentPaymentFees}
                    onChange={(e) => setInputs(prev => ({ ...prev, currentPaymentFees: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0% (ACH only)</span>
                    <span>4% (Cards)</span>
                  </div>
                </div>

                {/* Current Treasury Yield */}
                <div>
                  <label className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Current Treasury Yield</span>
                    <span className="text-gray-400 font-mono">{inputs.currentYield}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="4"
                    step="0.1"
                    value={inputs.currentYield}
                    onChange={(e) => setInputs(prev => ({ ...prev, currentYield: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-gray-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0% (Operating Account)</span>
                    <span>4% (Money Market)</span>
                  </div>
                </div>

                {/* Industry */}
                <div>
                  <label className="text-sm font-medium block mb-3">Industry</label>
                  <select
                    value={inputs.industryType}
                    onChange={(e) => setInputs(prev => ({ ...prev, industryType: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-green-500"
                  >
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Results Side */}
            <div>
              <div className="bg-gradient-to-br from-green-500/10 to-cyan-500/10 border border-green-500/30 rounded-2xl p-8">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-green-400" />
                  Your Annual Value
                </h3>

                <div className="text-5xl font-bold text-green-400 mb-6">
                  {formatCurrency(results.totalAnnualValue)}
                  <span className="text-lg text-gray-400 font-normal">/year</span>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-green-400" />
                      <div>
                        <div className="text-sm text-gray-400">Treasury Yield (4.5%)</div>
                        <div className="text-xs text-gray-500">On ${formatCurrency(results.depositAmount)} deposit</div>
                      </div>
                    </div>
                    <div className="text-xl font-semibold text-green-400">
                      +{formatCurrency(results.annualYield)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-cyan-400" />
                      <div>
                        <div className="text-sm text-gray-400">Payment Fee Savings</div>
                        <div className="text-xs text-gray-500">{inputs.currentPaymentFees}% → 1%</div>
                      </div>
                    </div>
                    <div className="text-xl font-semibold text-cyan-400">
                      +{formatCurrency(results.feeSavings)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-black/30 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Credit Line</div>
                    <div className="text-2xl font-bold">{formatCurrency(results.creditLine)}</div>
                    <div className="text-xs text-gray-500">1:1 with deposit</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Break Even</div>
                    <div className="text-2xl font-bold text-green-400">Day 1</div>
                    <div className="text-xs text-gray-500">No setup fees</div>
                  </div>
                </div>

                <a
                  href="https://cal.com/grainvault/demo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-4 bg-green-500 hover:bg-green-400 text-black font-semibold rounded-xl transition-colors"
                >
                  Schedule Demo
                  <ArrowRight className="w-5 h-5" />
                </a>

                <p className="text-xs text-gray-500 text-center mt-4">
                  15-minute call. See exactly how Grain & Vault works for your business.
                </p>
              </div>

              {/* Key Benefits */}
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <Shield className="w-6 h-6 text-green-400 mb-2" />
                  <h4 className="font-medium mb-1">100% Protected</h4>
                  <p className="text-xs text-gray-400">USDC backed by cash & T-bills, audited monthly</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <RefreshCw className="w-6 h-6 text-cyan-400 mb-2" />
                  <h4 className="font-medium mb-1">Instant Liquidity</h4>
                  <p className="text-xs text-gray-400">Withdraw to USD in under 24 hours</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <Lock className="w-6 h-6 text-purple-400 mb-2" />
                  <h4 className="font-medium mb-1">SOC 2 Compliant</h4>
                  <p className="text-xs text-gray-400">Enterprise-grade security and custody</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <Zap className="w-6 h-6 text-yellow-400 mb-2" />
                  <h4 className="font-medium mb-1">ERP Integration</h4>
                  <p className="text-xs text-gray-400">NetSuite, SAP, Oracle, Workday ready</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Case Studies Tab */}
        {activeTab === 'cases' && (
          <div>
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold mb-4">Companies Using Grain & Vault</h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                See how finance leaders at manufacturing and distribution companies are optimizing their treasury and payments.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {CASE_STUDIES.map((study) => (
                <div
                  key={study.id}
                  className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-green-500/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedCaseStudy(study)}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/30 to-cyan-500/30 flex items-center justify-center text-lg font-bold">
                      {study.logo}
                    </div>
                    <div>
                      <h3 className="font-semibold">{study.company}</h3>
                      <p className="text-sm text-gray-400">{study.industry}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-black/30 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Monthly Spend</div>
                      <div className="font-semibold">{formatCurrency(study.metrics.monthlySpend)}</div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Annual Savings</div>
                      <div className="font-semibold text-green-400">+{formatCurrency(study.metrics.savings)}</div>
                    </div>
                  </div>

                  <blockquote className="text-sm text-gray-400 italic mb-4 line-clamp-3">
                    "{study.quote}"
                  </blockquote>

                  <div className="text-sm">
                    <span className="text-gray-300">{study.contact}</span>
                    <span className="text-gray-500"> - {study.title}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Detailed Case Study Modal */}
            {selectedCaseStudy && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500/30 to-cyan-500/30 flex items-center justify-center text-xl font-bold">
                        {selectedCaseStudy.logo}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{selectedCaseStudy.company}</h3>
                        <p className="text-gray-400">{selectedCaseStudy.industry}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedCaseStudy(null)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <span className="text-2xl">&times;</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-black/30 rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">Monthly Spend</div>
                      <div className="text-lg font-bold">{formatCurrency(selectedCaseStudy.metrics.monthlySpend)}</div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">Previous Fees</div>
                      <div className="text-lg font-bold text-red-400">{formatCurrency(selectedCaseStudy.metrics.previousFees)}/yr</div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">GRAIN Fees</div>
                      <div className="text-lg font-bold text-green-400">{formatCurrency(selectedCaseStudy.metrics.newFees)}/yr</div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">Treasury Yield</div>
                      <div className="text-lg font-bold text-cyan-400">+{formatCurrency(selectedCaseStudy.metrics.yield)}/yr</div>
                    </div>
                  </div>

                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 mb-8">
                    <div className="text-center">
                      <div className="text-sm text-gray-400 mb-2">Total Annual Value</div>
                      <div className="text-4xl font-bold text-green-400">{formatCurrency(selectedCaseStudy.metrics.savings)}</div>
                    </div>
                  </div>

                  <blockquote className="text-lg italic mb-6 border-l-4 border-green-500 pl-4">
                    "{selectedCaseStudy.quote}"
                  </blockquote>

                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-medium">{selectedCaseStudy.contact}</div>
                      <div className="text-sm text-gray-400">{selectedCaseStudy.title}, {selectedCaseStudy.company}</div>
                    </div>
                  </div>

                  <a
                    href="https://cal.com/grainvault/demo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-4 bg-green-500 hover:bg-green-400 text-black font-semibold rounded-xl transition-colors"
                  >
                    See Similar Results for Your Company
                    <ArrowRight className="w-5 h-5" />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* How It Works Tab */}
        {activeTab === 'how' && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold mb-4">How Grain & Vault Works</h2>
              <p className="text-gray-400">
                A simple 4-step process to transform your treasury and payments.
              </p>
            </div>

            <div className="space-y-8">
              {[
                {
                  step: 1,
                  title: 'Deposit Your Predictable Spend',
                  description: 'Transfer your typical monthly supplier payment amount to Grain & Vault. Funds convert to USDC and begin earning 4.5%+ yield immediately.',
                  icon: PiggyBank,
                  color: 'from-green-500 to-green-600',
                },
                {
                  step: 2,
                  title: 'Get a 1:1 Credit Line',
                  description: 'Your deposit unlocks an equal credit line at 0% interest. Use this GRAIN credit to pay suppliers without touching your earning deposit.',
                  icon: CreditCard,
                  color: 'from-cyan-500 to-cyan-600',
                },
                {
                  step: 3,
                  title: 'Pay Suppliers Instantly',
                  description: 'Vendors receive USD via ACH or wire. They don\'t need to know or do anything different. Sub-second settlement, 0% payment fees.',
                  icon: Zap,
                  color: 'from-yellow-500 to-orange-500',
                },
                {
                  step: 4,
                  title: 'Watch Your Treasury Grow',
                  description: 'Your deposit appreciates 4.5%+ annually while you use it for payments. Real-time dashboard shows your yield, payments, and reconciliation.',
                  icon: TrendingUp,
                  color: 'from-purple-500 to-pink-500',
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                      <item.icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm text-gray-500">Step {item.step}</span>
                      <h3 className="text-xl font-semibold">{item.title}</h3>
                    </div>
                    <p className="text-gray-400">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 bg-white/5 border border-white/10 rounded-2xl p-8">
              <h3 className="text-xl font-semibold mb-6 text-center">The Math</h3>

              <div className="grid md:grid-cols-3 gap-8 text-center">
                <div>
                  <div className="text-4xl font-bold text-green-400 mb-2">4.5%+</div>
                  <div className="text-gray-400">Annual Yield</div>
                  <div className="text-xs text-gray-500 mt-1">On your deposit</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-cyan-400 mb-2">0%</div>
                  <div className="text-gray-400">Payment Fees</div>
                  <div className="text-xs text-gray-500 mt-1">1% sourcing fee (COGS)</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-purple-400 mb-2">1:1</div>
                  <div className="text-gray-400">Credit Ratio</div>
                  <div className="text-xs text-gray-500 mt-1">Deposit = Credit Line</div>
                </div>
              </div>
            </div>

            <div className="mt-12 text-center">
              <a
                href="https://cal.com/grainvault/demo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 bg-green-500 hover:bg-green-400 text-black font-semibold rounded-xl transition-colors"
              >
                Schedule a 15-Minute Demo
                <ArrowRight className="w-5 h-5" />
              </a>
              <p className="text-sm text-gray-500 mt-4">
                See it in action. Run the numbers for your business.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Bottom CTA */}
      <section className="border-t border-white/10 bg-gradient-to-br from-green-500/10 to-cyan-500/10 py-16">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Optimize Your Treasury?</h2>
          <p className="text-gray-400 max-w-2xl mx-auto mb-8">
            Join finance leaders at manufacturing and distribution companies who are earning 4.5%+
            on their operating cash while paying suppliers at 0% fees.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://cal.com/grainvault/demo"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-400 text-black font-semibold rounded-xl transition-colors"
            >
              <Clock className="w-5 h-5" />
              Book 15-Min Demo
            </a>
            <a
              href="mailto:enterprise@grainandvault.com?subject=Enterprise Inquiry"
              className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
            >
              Contact Enterprise Sales
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <p>© 2025 Grain & Vault. All rights reserved.</p>
            <p>
              Grain & Vault is a{' '}
              <Link href="https://wellsonyx.io" className="text-green-400 hover:text-green-300 transition-colors">
                Wells Onyx
              </Link>
              {' '}portfolio company.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
