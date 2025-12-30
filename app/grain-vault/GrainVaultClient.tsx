'use client'

/**
 * Grain & Vault Landing Page - 2025 Modern Design
 * grainandvault.com
 *
 * Glassmorphism + Bento Grid + Premium Animations
 * Treasury infrastructure that just works.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useUser, SignedIn, SignedOut } from '@clerk/nextjs'
import WellsAIChatWidget from '@/components/WellsAIChatWidget'
import {
  Zap,
  Shield,
  ArrowRight,
  CheckCircle,
  Code,
  Lock,
  Globe,
  Activity,
  Wallet,
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Sparkles,
  BarChart3,
  FileCheck,
  Clock,
  Play,
  Download,
  ExternalLink,
  Layers
} from 'lucide-react'
import {
  GlassCard,
  BentoGrid,
  BentoItem,
  ShimmerButton,
  FloatingBadge,
  MetricCard,
  GlowOrb,
  NoiseOverlay,
  AnimatedText
} from '@/components/ui/modern'

// ERP-specific SDK code examples
const erpCodeExamples: Record<string, { filename: string; code: React.ReactNode }> = {
  'SAP': {
    filename: 'sap-treasury.ts',
    code: (
      <>
        <span className="text-purple-400">import</span> {'{'} createSAPAdapter {'}'} <span className="text-purple-400">from</span> <span className="text-green-400">'@grainandvault/treasury-sdk/sap'</span>
        {'\n\n'}
        <span className="text-gray-500">// Connect to SAP S/4HANA via OData</span>
        {'\n'}<span className="text-blue-400">const</span> sap = <span className="text-yellow-400">createSAPAdapter</span>({'{'}
        {'\n  '}host: <span className="text-green-400">'your-tenant.s4hana.ondemand.com'</span>,
        {'\n  '}client: <span className="text-green-400">'100'</span>,
        {'\n  '}variant: <span className="text-green-400">'s4hana'</span>
        {'\n'}{'}'})
        {'\n\n'}
        <span className="text-purple-400">await</span> sap.<span className="text-yellow-400">createPayment</span>({'{'}
        {'\n  '}vendorId: <span className="text-green-400">'VEND-00234'</span>,
        {'\n  '}amount: <span className="text-blue-300">25000</span>,
        {'\n  '}currency: <span className="text-green-400">'GRAIN'</span>
        {'\n'}{'}'})
      </>
    )
  },
  'Oracle': {
    filename: 'oracle-treasury.ts',
    code: (
      <>
        <span className="text-purple-400">import</span> {'{'} createOracleAdapter {'}'} <span className="text-purple-400">from</span> <span className="text-green-400">'@grainandvault/treasury-sdk/oracle'</span>
        {'\n\n'}
        <span className="text-gray-500">// Connect to Oracle Fusion Cloud</span>
        {'\n'}<span className="text-blue-400">const</span> oracle = <span className="text-yellow-400">createOracleAdapter</span>({'{'}
        {'\n  '}host: <span className="text-green-400">'your-instance.oraclecloud.com'</span>,
        {'\n  '}variant: <span className="text-green-400">'fusion'</span>
        {'\n'}{'}'})
        {'\n\n'}
        <span className="text-purple-400">await</span> oracle.<span className="text-yellow-400">createPayment</span>({'{'}
        {'\n  '}vendorId: <span className="text-green-400">'100000001234567'</span>,
        {'\n  '}amount: <span className="text-blue-300">50000</span>,
        {'\n  '}currency: <span className="text-green-400">'GRAIN'</span>
        {'\n'}{'}'})
      </>
    )
  },
  'NetSuite': {
    filename: 'netsuite-treasury.ts',
    code: (
      <>
        <span className="text-purple-400">import</span> {'{'} createNetSuiteAdapter {'}'} <span className="text-purple-400">from</span> <span className="text-green-400">'@grainandvault/treasury-sdk/netsuite'</span>
        {'\n\n'}
        <span className="text-gray-500">// Connect via OAuth 1.0 TBA</span>
        {'\n'}<span className="text-blue-400">const</span> netsuite = <span className="text-yellow-400">createNetSuiteAdapter</span>({'{'}
        {'\n  '}accountId: <span className="text-green-400">'1234567'</span>,
        {'\n  '}auth: {'{'} type: <span className="text-green-400">'tba'</span> {'}'}
        {'\n'}{'}'})
        {'\n\n'}
        <span className="text-purple-400">await</span> netsuite.<span className="text-yellow-400">createPayment</span>({'{'}
        {'\n  '}vendorId: <span className="text-green-400">'1234'</span>,
        {'\n  '}amount: <span className="text-blue-300">25000</span>,
        {'\n  '}currency: <span className="text-green-400">'GRAIN'</span>
        {'\n'}{'}'})
      </>
    )
  },
  'Dynamics 365': {
    filename: 'dynamics-treasury.ts',
    code: (
      <>
        <span className="text-purple-400">import</span> {'{'} createDynamics365Adapter {'}'} <span className="text-purple-400">from</span> <span className="text-green-400">'@grainandvault/treasury-sdk/dynamics365'</span>
        {'\n\n'}
        <span className="text-gray-500">// Connect to D365 Finance</span>
        {'\n'}<span className="text-blue-400">const</span> dynamics = <span className="text-yellow-400">createDynamics365Adapter</span>({'{'}
        {'\n  '}host: <span className="text-green-400">'your-org.dynamics.com'</span>,
        {'\n  '}variant: <span className="text-green-400">'finance-operations'</span>
        {'\n'}{'}'})
        {'\n\n'}
        <span className="text-purple-400">await</span> dynamics.<span className="text-yellow-400">createPayment</span>({'{'}
        {'\n  '}vendorId: <span className="text-green-400">'V-000123'</span>,
        {'\n  '}amount: <span className="text-blue-300">35000</span>,
        {'\n  '}currency: <span className="text-green-400">'GRAIN'</span>
        {'\n'}{'}'})
      </>
    )
  },
  'Workday': {
    filename: 'workday-treasury.ts',
    code: (
      <>
        <span className="text-purple-400">import</span> {'{'} createWorkdayAdapter {'}'} <span className="text-purple-400">from</span> <span className="text-green-400">'@grainandvault/treasury-sdk/workday'</span>
        {'\n\n'}
        <span className="text-gray-500">// Connect to Workday Financial</span>
        {'\n'}<span className="text-blue-400">const</span> workday = <span className="text-yellow-400">createWorkdayAdapter</span>({'{'}
        {'\n  '}tenant: <span className="text-green-400">'your-tenant'</span>,
        {'\n  '}auth: {'{'} type: <span className="text-green-400">'oauth2'</span> {'}'}
        {'\n'}{'}'})
        {'\n\n'}
        <span className="text-purple-400">await</span> workday.<span className="text-yellow-400">createPayment</span>({'{'}
        {'\n  '}vendorId: <span className="text-green-400">'SUPP-00234'</span>,
        {'\n  '}amount: <span className="text-blue-300">18000</span>,
        {'\n  '}currency: <span className="text-green-400">'GRAIN'</span>
        {'\n'}{'}'})
      </>
    )
  },
  'Coupa': {
    filename: 'coupa-treasury.ts',
    code: (
      <>
        <span className="text-purple-400">import</span> {'{'} createCoupaAdapter {'}'} <span className="text-purple-400">from</span> <span className="text-green-400">'@grainandvault/treasury-sdk/coupa'</span>
        {'\n\n'}
        <span className="text-gray-500">// Connect to Coupa Treasury</span>
        {'\n'}<span className="text-blue-400">const</span> coupa = <span className="text-yellow-400">createCoupaAdapter</span>({'{'}
        {'\n  '}host: <span className="text-green-400">'your-company.coupahost.com'</span>,
        {'\n  '}auth: {'{'} type: <span className="text-green-400">'oauth2'</span> {'}'}
        {'\n'}{'}'})
        {'\n\n'}
        <span className="text-purple-400">await</span> coupa.<span className="text-yellow-400">createPayment</span>({'{'}
        {'\n  '}vendorId: <span className="text-green-400">'45678'</span>,
        {'\n  '}amount: <span className="text-blue-300">42000</span>,
        {'\n  '}currency: <span className="text-green-400">'GRAIN'</span>
        {'\n'}{'}'})
      </>
    )
  }
}

const erpList = ['SAP', 'Oracle', 'NetSuite', 'Dynamics 365', 'Workday', 'Coupa'] as const

export default function GrainVaultLanding() {
  const [selectedERP, setSelectedERP] = useState<string>('NetSuite')

  return (
    <div className="min-h-screen bg-black text-white antialiased overflow-x-hidden">
      {/* Noise Texture Overlay */}
      <NoiseOverlay />

      {/* Ambient Glow Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <GlowOrb color="green" size="xl" position={{ top: '-200px', left: '30%' }} />
        <GlowOrb color="blue" size="lg" position={{ bottom: '20%', right: '-100px' }} animate={false} />
        <GlowOrb color="purple" size="md" position={{ top: '60%', left: '-50px' }} />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50">
          <GlassCard hover={false} padding="none" className="rounded-none border-x-0 border-t-0">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                      <div className="w-4 h-4 bg-black rounded-sm" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-sm" />
                  </div>
                  <span className="text-lg font-semibold tracking-tight">
                    <AnimatedText text="Grain & Vault" gradient gradientColors="from-green-400 to-blue-400" />
                  </span>
                </div>

                <nav className="hidden md:flex items-center gap-8">
                  <Link href="#products" className="text-sm text-gray-400 hover:text-white transition-colors">
                    Products
                  </Link>
                  <Link href="#treasury-sdk" className="text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium">
                    Treasury SDK
                  </Link>
                  <Link href="/wells-ai" className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium">
                    WellsAI
                  </Link>

                  <SignedIn>
                    <Link href="/grain-vault/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
                      Dashboard
                    </Link>
                    <ShimmerButton variant="primary" size="sm" className="bg-gradient-to-r from-green-500 to-green-600" onClick={() => window.location.href = '/grain-vault/dashboard'}>
                      Dashboard
                    </ShimmerButton>
                  </SignedIn>

                  <SignedOut>
                    <Link href="/grain-vault/waitlist" className="text-sm text-amber-400 hover:text-amber-300 transition-colors font-medium">
                      Join Waitlist
                    </Link>
                    <ShimmerButton variant="primary" size="sm" className="bg-gradient-to-r from-amber-500 to-orange-600" onClick={() => window.location.href = '/grain-vault/waitlist'}>
                      Get Early Access
                    </ShimmerButton>
                  </SignedOut>
                </nav>

                {/* Mobile */}
                <div className="md:hidden">
                  <SignedIn>
                    <ShimmerButton size="sm" className="bg-green-500" onClick={() => window.location.href = '/grain-vault/dashboard'}>
                      Dashboard
                    </ShimmerButton>
                  </SignedIn>
                  <SignedOut>
                    <ShimmerButton size="sm" className="bg-amber-500" onClick={() => window.location.href = '/grain-vault/waitlist'}>
                      Waitlist
                    </ShimmerButton>
                  </SignedOut>
                </div>
              </div>
            </div>
          </GlassCard>
        </header>

        {/* Hero Section */}
        <section className="pt-32 pb-20 md:pt-40 md:pb-32 px-6 lg:px-8 relative">
          <div className="max-w-5xl mx-auto text-center">
            {/* Badge */}
            <div className="flex justify-center mb-8">
              <FloatingBadge color="green">
                <Code className="w-4 h-4" />
                Treasury SDK Now Available
              </FloatingBadge>
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
              <span className="block text-white">Treasury infrastructure</span>
              <span className="block">
                <AnimatedText
                  text="that just works"
                  gradient
                  gradientColors="from-green-400 via-green-500 to-emerald-600"
                  className="text-5xl md:text-7xl font-bold"
                />
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto">
              Zero-friction payments with GRAIN. Protected reserves with VAULT.
              Native ERP integration for CFOs and treasury teams.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <ShimmerButton size="lg" className="bg-gradient-to-r from-amber-500 to-orange-600" onClick={() => window.location.href = '/grain-vault/waitlist'}>
                Join the Waitlist
                <ArrowRight className="w-5 h-5" />
              </ShimmerButton>
              <ShimmerButton variant="secondary" size="lg" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
                <Sparkles className="w-5 h-5" />
                How It Works
              </ShimmerButton>
              <ShimmerButton variant="ghost" size="lg" onClick={() => document.getElementById('treasury-sdk')?.scrollIntoView({ behavior: 'smooth' })}>
                <Code className="w-5 h-5" />
                Treasury SDK
              </ShimmerButton>
            </div>

            {/* Trust Bar */}
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8 text-sm text-gray-500 mb-12">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-green-500" />
                <span className="font-medium text-white">180+ Countries</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>100% Collateralized</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Real-time Audits</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span>Instant Settlement</span>
              </div>
            </div>

            {/* Powered By Banner */}
            <div className="flex items-center justify-center gap-8 mb-16">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Powered by</div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white">C</span>
                  </div>
                  <span className="text-sm font-medium text-gray-300">Circle</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <Layers className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-300">Base</span>
                </div>
              </div>
            </div>

            {/* Stats Grid - Bento Style */}
            <BentoGrid cols={4} className="max-w-4xl mx-auto">
              <BentoItem>
                <MetricCard
                  value="<1s"
                  label="Settlement Time"
                  icon={<Zap className="w-7 h-7 text-green-400" />}
                />
              </BentoItem>
              <BentoItem>
                <MetricCard
                  value="0%"
                  label="Payment Friction"
                  icon={<TrendingUp className="w-7 h-7 text-green-400" />}
                />
              </BentoItem>
              <BentoItem>
                <MetricCard
                  value="100%"
                  label="Collateral Ratio"
                  icon={<Shield className="w-7 h-7 text-blue-400" />}
                />
              </BentoItem>
              <BentoItem>
                <MetricCard
                  value="24/7"
                  label="Blockchain Audits"
                  icon={<Activity className="w-7 h-7 text-purple-400" />}
                />
              </BentoItem>
            </BentoGrid>
          </div>
        </section>

        {/* How GRAIN Works - Consumer Focus */}
        <section id="how-it-works" className="py-24 px-6 lg:px-8 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-green-950/20 via-transparent to-transparent pointer-events-none" />

          <div className="relative max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <FloatingBadge color="green">
                <TrendingUp className="w-4 h-4" />
                Anti-Inflationary
              </FloatingBadge>
              <h2 className="text-4xl md:text-5xl font-bold mt-6 mb-4">
                Money that works <span className="text-green-400">for you</span>
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                Unlike traditional currencies that lose value over time, GRAIN is designed to appreciate.
                Your purchasing power grows while you hold.
              </p>
            </div>

            {/* The Problem / Solution */}
            <div className="grid md:grid-cols-2 gap-8 mb-16">
              {/* The Problem */}
              <GlassCard hover={false} padding="lg" className="border-red-500/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                    <TrendingDown className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-red-400">Traditional Money</h3>
                    <p className="text-sm text-gray-500">Loses value every year</p>
                  </div>
                </div>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-red-400 text-sm">✕</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-300">Inflation erodes your savings</p>
                      <p className="text-sm text-gray-500">$100 today buys less next year</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-red-400 text-sm">✕</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-300">Banks profit from your deposits</p>
                      <p className="text-sm text-gray-500">They earn interest, you get almost nothing</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-red-400 text-sm">✕</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-300">Hidden fees everywhere</p>
                      <p className="text-sm text-gray-500">Transfer fees, exchange fees, ATM fees</p>
                    </div>
                  </li>
                </ul>
              </GlassCard>

              {/* The Solution */}
              <GlassCard hover glow="green" padding="lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-green-400">GRAIN</h3>
                    <p className="text-sm text-gray-400">Designed to appreciate</p>
                  </div>
                </div>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">Your purchasing power grows</p>
                      <p className="text-sm text-gray-400">GRAIN only goes up in value</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">You benefit from treasury growth</p>
                      <p className="text-sm text-gray-400">As our reserves grow, so does your GRAIN value</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">100% backed, always</p>
                      <p className="text-sm text-gray-400">Every GRAIN is fully backed by real assets</p>
                    </div>
                  </li>
                </ul>
              </GlassCard>
            </div>

            {/* How It Works - Visual Steps */}
            <div className="mb-16">
              <h3 className="text-2xl font-bold text-center mb-12">How it works</h3>
              <div className="grid md:grid-cols-4 gap-6">
                {[
                  {
                    step: '1',
                    icon: Wallet,
                    title: 'Deposit',
                    desc: 'Add funds instantly with card or bank transfer. Available in 180+ countries.',
                    color: 'blue'
                  },
                  {
                    step: '2',
                    icon: Sparkles,
                    title: 'Convert to GRAIN',
                    desc: 'Your deposit converts to GRAIN at the current market price.',
                    color: 'green'
                  },
                  {
                    step: '3',
                    icon: TrendingUp,
                    title: 'Watch it Grow',
                    desc: 'As our treasury grows, GRAIN appreciates. Your balance gains value.',
                    color: 'purple'
                  },
                  {
                    step: '4',
                    icon: Globe,
                    title: 'Use Anywhere',
                    desc: 'Spend, send, or withdraw anytime. Your money, your control.',
                    color: 'amber'
                  }
                ].map((item, i) => (
                  <div key={i} className="relative">
                    {i < 3 && (
                      <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-white/20 to-transparent" />
                    )}
                    <GlassCard hover className="h-full text-center relative">
                      <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-${item.color}-500/20 flex items-center justify-center relative`}>
                        <item.icon className={`w-8 h-8 text-${item.color}-400`} />
                        <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full bg-${item.color}-500 text-black text-xs font-bold flex items-center justify-center`}>
                          {item.step}
                        </div>
                      </div>
                      <h4 className="text-lg font-bold mb-2">{item.title}</h4>
                      <p className="text-sm text-gray-400">{item.desc}</p>
                    </GlassCard>
                  </div>
                ))}
              </div>
            </div>

            {/* Value Proposition Banner */}
            <GlassCard hover={false} glow="green" padding="lg" className="text-center">
              <div className="max-w-3xl mx-auto">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 text-green-400 text-sm font-medium mb-6">
                  <TrendingUp className="w-4 h-4" />
                  Anti-Inflationary by Design
                </div>
                <h3 className="text-3xl md:text-4xl font-bold mb-4">
                  Stop losing money to inflation.
                  <br />
                  <span className="text-green-400">Start growing with GRAIN.</span>
                </h3>
                <p className="text-lg text-gray-400 mb-8">
                  While traditional money loses purchasing power year after year,
                  GRAIN is engineered to appreciate. Every holder benefits equally as our treasury grows.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <ShimmerButton size="lg" className="bg-gradient-to-r from-amber-500 to-orange-600" onClick={() => window.location.href = '/grain-vault/waitlist'}>
                    Join the Waitlist
                    <ArrowRight className="w-5 h-5" />
                  </ShimmerButton>
                  <div className="text-sm text-gray-500">
                    Limited early access · Enterprise priority
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Products Section */}
        <section id="products" className="py-24 px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <FloatingBadge color="blue" pulse={false}>Two Products</FloatingBadge>
              <h2 className="text-4xl md:text-5xl font-bold mt-6 mb-4">Two products. One platform.</h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                GRAIN eliminates payment friction. VAULT protects your reserves.
              </p>
            </div>

            <BentoGrid cols={2} className="gap-8">
              {/* GRAIN Card */}
              <BentoItem>
                <GlassCard hover glow="green" padding="lg" className="h-full">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-black" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">GRAIN</h3>
                      <p className="text-sm text-green-400">Zero-Friction Payments</p>
                    </div>
                  </div>

                  <p className="text-gray-400 mb-8 leading-relaxed">
                    Instant settlement with no chargebacks, no reversals, and no geographic limits. GRAIN appreciates as treasury grows - all holders benefit equally.
                  </p>

                  <div className="space-y-4 mb-8">
                    {['Instant Settlement', 'Appreciates with Treasury', 'Global by Default'].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="font-medium">{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-6 border-t border-white/10 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-400">{'<'}1s</div>
                      <div className="text-xs text-gray-500">Settlement</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-400">0%</div>
                      <div className="text-xs text-gray-500">Chargebacks</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-400">24/7</div>
                      <div className="text-xs text-gray-500">Uptime</div>
                    </div>
                  </div>
                </GlassCard>
              </BentoItem>

              {/* VAULT Card */}
              <BentoItem>
                <GlassCard hover glow="blue" padding="lg" className="h-full">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">VAULT</h3>
                      <p className="text-sm text-blue-400">Protected Reserves</p>
                    </div>
                  </div>

                  <p className="text-gray-400 mb-8 leading-relaxed">
                    100% collateralized reserves with real-time blockchain audits. Complete transparency.
                  </p>

                  <div className="space-y-4 mb-8">
                    {['100% Collateralized', 'Real-Time Audits', 'On-Chain Proof'].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
                        <span className="font-medium">{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-6 border-t border-white/10 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-400">100%</div>
                      <div className="text-xs text-gray-500">Collateral</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-400">100%</div>
                      <div className="text-xs text-gray-500">Transparent</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-400">2s</div>
                      <div className="text-xs text-gray-500">Audit Time</div>
                    </div>
                  </div>
                </GlassCard>
              </BentoItem>
            </BentoGrid>
          </div>
        </section>

        {/* Treasury SDK Section */}
        <section id="treasury-sdk" className="py-24 px-6 lg:px-8 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-950/10 to-transparent pointer-events-none" />

          <div className="relative max-w-7xl mx-auto">
            {/* Header */}
            <div className="text-center mb-16">
              <FloatingBadge color="purple">
                <Code className="w-4 h-4" />
                Treasury SDK
              </FloatingBadge>
              <h2 className="text-4xl md:text-5xl font-bold mt-6 mb-4">
                Enterprise treasury infrastructure
                <br />
                <AnimatedText text="in your ERP" gradient gradientColors="from-purple-400 to-pink-500" className="text-4xl md:text-5xl font-bold" />
              </h2>
              <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                Drop-in SDK for SAP, Oracle, NetSuite, and more.
              </p>
            </div>

            {/* Key Benefits */}
            <BentoGrid cols={3} className="mb-16">
              <BentoItem>
                <GlassCard hover glow="purple" className="h-full text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">0% Payment Friction</h3>
                  <p className="text-sm text-gray-400 mb-4">Instant settlement, no failed transactions</p>
                  <div className="text-3xl font-bold text-purple-400">{'<'}1s</div>
                  <div className="text-xs text-gray-500">Average settlement</div>
                </GlassCard>
              </BentoItem>

              <BentoItem>
                <GlassCard hover glow="green" className="h-full text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">1:1 Credit Line</h3>
                  <p className="text-sm text-gray-400 mb-4">Deposit GRAIN, get instant credit</p>
                  <div className="text-3xl font-bold text-green-400">100%</div>
                  <div className="text-xs text-gray-500">Credit line on deposits</div>
                </GlassCard>
              </BentoItem>

              <BentoItem>
                <GlassCard hover glow="blue" className="h-full text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Protected Value</h3>
                  <p className="text-sm text-gray-400 mb-4">100% collateralized reserves</p>
                  <div className="text-3xl font-bold text-blue-400">100%</div>
                  <div className="text-xs text-gray-500">Collateralization</div>
                </GlassCard>
              </BentoItem>
            </BentoGrid>

            {/* ERP Integration */}
            <GlassCard hover={false} padding="lg" className="mb-16">
              <div className="flex items-center gap-3 mb-8">
                <Building2 className="w-8 h-8 text-purple-400" />
                <h3 className="text-2xl font-bold">Native ERP Integration</h3>
              </div>

              {/* ERP Logos Grid */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-8">
                {erpList.map((erp) => (
                  <button
                    key={erp}
                    onClick={() => setSelectedERP(erp)}
                    className={`relative p-4 text-center rounded-lg transition-all duration-300 ${
                      selectedERP === erp
                        ? 'bg-purple-500/20 border-2 border-purple-500 scale-105'
                        : 'bg-white/5 border border-white/10 hover:border-purple-500/30'
                    }`}
                  >
                    {selectedERP === erp && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full animate-pulse" />
                    )}
                    <div className={`text-sm font-semibold ${
                      selectedERP === erp ? 'text-purple-300' : 'text-gray-300'
                    }`}>
                      {erp}
                    </div>
                  </button>
                ))}
              </div>

              {/* Code Example */}
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl blur opacity-20" />
                <div className="relative bg-[#0d1117] border border-white/10 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-2">
                      <Code className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-gray-400">
                        {erpCodeExamples[selectedERP]?.filename}
                      </span>
                    </div>
                    <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-1 rounded">
                      {selectedERP} SDK
                    </span>
                  </div>
                  <div className="p-6 overflow-x-auto min-h-[200px]">
                    <pre className="text-sm">
                      <code className="text-gray-300">
                        {erpCodeExamples[selectedERP]?.code}
                      </code>
                    </pre>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* CTA */}
            <div className="text-center">
              <Link
                href="/grain-vault/sdk-waitlist"
                className="group inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-semibold text-lg transition-all hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50"
              >
                <Code className="w-5 h-5" />
                Join SDK Waitlist
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* Built for Everyone */}
        <section className="py-24 px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <FloatingBadge color="green" pulse={false}>For Everyone</FloatingBadge>
              <h2 className="text-4xl md:text-5xl font-bold mt-6 mb-4">Built for everyone</h2>
              <p className="text-xl text-gray-400">CFO, treasury manager, or developer - get started in minutes.</p>
            </div>

            <BentoGrid cols={3}>
              {[
                { icon: DollarSign, title: 'For CFOs', desc: 'No technical expertise required. Dashboard shows treasury health in plain English.', color: 'green' },
                { icon: Building2, title: 'For Treasury Teams', desc: 'One-click ERP integration. Automated reconciliation. No spreadsheets.', color: 'blue' },
                { icon: Code, title: 'For Developers', desc: 'Modern APIs, type-safe SDKs, and sandbox environment.', color: 'purple' }
              ].map((item, i) => (
                <BentoItem key={i}>
                  <GlassCard hover glow={item.color as any} className="h-full">
                    <div className={`w-12 h-12 rounded-lg bg-${item.color}-500/20 flex items-center justify-center mb-6`}>
                      <item.icon className={`w-6 h-6 text-${item.color}-400`} />
                    </div>
                    <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                    <p className="text-gray-400 text-sm">{item.desc}</p>
                  </GlassCard>
                </BentoItem>
              ))}
            </BentoGrid>
          </div>
        </section>

        {/* Powered by WellsAI Section */}
        <section className="py-24 px-6 lg:px-8 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent pointer-events-none" />

          <div className="relative max-w-7xl mx-auto">
            <GlassCard hover glow="blue" padding="lg">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                {/* Left - Content */}
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
                      <span className="text-xl font-bold text-white">W</span>
                    </div>
                    <div>
                      <div className="text-xs text-blue-400 uppercase tracking-wider font-semibold">Powered by</div>
                      <h3 className="text-2xl font-bold text-white">WellsAI</h3>
                    </div>
                  </div>

                  <p className="text-lg text-gray-300 mb-6 leading-relaxed">
                    Grain & Vault is built on WellsAI - enterprise AI that executes. From automated treasury optimization
                    to intelligent matching and deal execution, WellsAI is the intelligence layer that makes it all work.
                  </p>

                  <ul className="space-y-3 mb-8">
                    {[
                      'Automated vendor sourcing and qualification',
                      'Intelligent payment routing and optimization',
                      'Real-time compliance and risk monitoring',
                      'Enterprise workflow automation'
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-3 text-gray-300">
                        <CheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/wells-ai"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-violet-500 text-white rounded-xl font-semibold hover:scale-105 transition-all"
                  >
                    Explore WellsAI
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>

                {/* Right - Visual */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-violet-500/20 rounded-2xl blur-xl" />
                  <div className="relative bg-black/40 rounded-2xl p-8 border border-white/10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-sm text-gray-500 ml-2">WellsAI Terminal</span>
                    </div>
                    <div className="space-y-4 font-mono text-sm">
                      <div className="text-gray-400">&gt; Analyzing treasury positions...</div>
                      <div className="text-blue-400">&gt; Found 3 optimization opportunities</div>
                      <div className="text-green-400">&gt; Automated payment routing: $2.3M saved</div>
                      <div className="text-violet-400">&gt; Vendor qualification: 47 suppliers matched</div>
                      <div className="text-gray-400 animate-pulse">&gt; _</div>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-blue-600" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />

              <div className="relative p-12 md:p-16 text-center">
                <div className="flex items-center justify-center gap-4 mb-8">
                  <div className="w-16 h-16 rounded-xl bg-black/20 flex items-center justify-center">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <div className="w-16 h-16 rounded-xl bg-black/20 flex items-center justify-center">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                </div>

                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                  Ready to modernize your treasury?
                </h2>
                <p className="text-xl text-white/80 mb-10">
                  Get started in minutes.
                </p>

                <button
                  onClick={() => window.location.href = '/grain-vault/waitlist'}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-900 transition-all hover:scale-105"
                >
                  Join the Waitlist
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10">
          <GlassCard hover={false} padding="none" className="rounded-none border-x-0 border-b-0">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
              <div className="grid md:grid-cols-4 gap-12 mb-12">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                        <div className="w-4 h-4 bg-black rounded-sm" />
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-sm" />
                    </div>
                    <span className="text-lg font-semibold">Grain & Vault</span>
                  </div>
                  <p className="text-gray-400 text-sm">
                    Treasury infrastructure for modern finance teams.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-4 text-sm">Products</h4>
                  <ul className="space-y-3 text-sm text-gray-400">
                    <li><Link href="#products" className="hover:text-white transition-colors">GRAIN</Link></li>
                    <li><Link href="#products" className="hover:text-white transition-colors">VAULT</Link></li>
                    <li><Link href="#treasury-sdk" className="text-purple-400 hover:text-purple-300 transition-colors">Treasury SDK</Link></li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-4 text-sm">Platform</h4>
                  <ul className="space-y-3 text-sm text-gray-400">
                    <li><Link href="/wells-ai" className="text-blue-400 hover:text-blue-300 transition-colors">WellsAI</Link></li>
                    <li><Link href="/demo" className="hover:text-white transition-colors">Documentation</Link></li>
                    <li><Link href="/demo" className="hover:text-white transition-colors">API Reference</Link></li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-4 text-sm">Company</h4>
                  <ul className="space-y-3 text-sm text-gray-400">
                    <li><Link href="/grain-vault/blog" className="text-green-400 hover:text-green-300 transition-colors">Blog</Link></li>
                    <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                    <li><Link href="/security" className="hover:text-white transition-colors">Security</Link></li>
                    <li><Link href="https://wellsonyx.io" className="text-amber-400 hover:text-amber-300 transition-colors">Wells Onyx</Link></li>
                  </ul>
                </div>
              </div>

              <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-sm text-gray-500">2025 Grain & Vault. A Wells Onyx company.</p>
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
            </div>
          </GlassCard>
        </footer>
      </div>

      {/* Chat Widget */}
      <WellsAIChatWidget
        brandColor="#22C55E"
        accentColor="#10B981"
        brandName="Grain & Vault"
        context={`You are a support assistant for Grain & Vault, a treasury infrastructure platform.

WHAT IS GRAIN?
GRAIN is our proprietary stablecoin that is ANTI-INFLATIONARY by design. Unlike traditional currencies that lose value over time, GRAIN is engineered to appreciate. Here's how it works:

1. GRAIN PRICE FORMULA: Price = (Total USDC Reserve + Equity Value) / Circulating GRAIN Supply
2. As our treasury grows, GRAIN's price increases - your purchasing power grows while you hold
3. GRAIN can ONLY go up in value - it's mathematically impossible for it to decrease
4. Every GRAIN is 100% backed by real assets (USDC + equity stakes)

HOW DEPOSITS WORK:
- Users deposit USD via Circle (card, bank transfer, wire) - available in 180+ countries
- Deposit converts to GRAIN at current market price
- Example: If GRAIN = $1.10 and you deposit $110, you receive 100 GRAIN
- Later if GRAIN rises to $1.20, your 100 GRAIN is now worth $120

WHY GRAIN IS BETTER:
- Traditional money: Loses purchasing power to inflation every year
- Banks profit from your deposits; you earn almost nothing
- Hidden fees for transfers, exchanges, ATMs

GRAIN:
- Your purchasing power INCREASES as you hold
- You benefit directly from treasury growth
- 100% backed, always - full transparency
- Powered by Circle (180+ countries) and Base blockchain

VAULT: Our protected reserves product - 100% collateralized, real-time blockchain audits, complete transparency.

Be enthusiastic about GRAIN's anti-inflationary design. Help users understand they're not just storing money - they're growing it. Answer questions about deposits, the GRAIN price formula, how appreciation works, and account setup.`}
        journey="support"
        greeting="Hi! I'm here to help you understand GRAIN - the anti-inflationary stablecoin. Ask me how your money can actually grow instead of losing value!"
        placeholder="How does GRAIN appreciation work?"
        position="bottom-right"
      />
    </div>
  )
}
