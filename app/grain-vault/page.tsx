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
  Sparkles,
  BarChart3,
  FileCheck,
  Clock,
  Play,
  Download,
  ExternalLink
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
                  <Link href="/grain-vault/signin" className="text-sm text-gray-400 hover:text-white transition-colors">
                    Sign In
                  </Link>
                  <ShimmerButton variant="primary" size="sm" className="bg-gradient-to-r from-green-500 to-green-600" onClick={() => window.location.href = '/grain-vault/signup'}>
                    Open Account
                  </ShimmerButton>
                </nav>

                {/* Mobile */}
                <div className="md:hidden">
                  <ShimmerButton size="sm" className="bg-green-500" onClick={() => window.location.href = '/grain-vault/signup'}>
                    Start
                  </ShimmerButton>
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
              <ShimmerButton size="lg" className="bg-gradient-to-r from-green-500 to-green-600" onClick={() => window.location.href = '/grain-vault/signup'}>
                Open Account
                <ArrowRight className="w-5 h-5" />
              </ShimmerButton>
              <ShimmerButton variant="secondary" size="lg" onClick={() => document.getElementById('treasury-sdk')?.scrollIntoView()}>
                <Code className="w-5 h-5" />
                Explore SDK
              </ShimmerButton>
              <ShimmerButton variant="ghost" size="lg" onClick={() => window.location.href = '/demo'}>
                <Play className="w-5 h-5" />
                Interactive Demo
              </ShimmerButton>
            </div>

            {/* Trust Bar */}
            <div className="flex items-center justify-center gap-8 text-sm text-gray-500 mb-16">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>SOC 2 Type II</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>100% Collateralized</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Real-time Audits</span>
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
                    Instant settlement with no chargebacks, no reversals, and no geographic limits.
                  </p>

                  <div className="space-y-4 mb-8">
                    {['Instant Settlement', 'Zero Chargebacks', 'Global by Default'].map((item, i) => (
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
              <a
                href="mailto:sdk@grainandvault.com?subject=Treasury SDK Access Request"
                className="group inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-semibold text-lg transition-all hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50"
              >
                <Code className="w-5 h-5" />
                Get SDK Access
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
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
                  onClick={() => window.location.href = '/grain-vault/signup'}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-900 transition-all hover:scale-105"
                >
                  Open Account
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
                  <h4 className="font-semibold mb-4 text-sm">Developers</h4>
                  <ul className="space-y-3 text-sm text-gray-400">
                    <li><Link href="/demo" className="hover:text-white transition-colors">Documentation</Link></li>
                    <li><Link href="/demo" className="hover:text-white transition-colors">API Reference</Link></li>
                    <li><Link href="/demo" className="hover:text-white transition-colors">SDKs</Link></li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-4 text-sm">Company</h4>
                  <ul className="space-y-3 text-sm text-gray-400">
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
        brandName="Grain & Vault Support"
        context="You are a support assistant for Grain & Vault, a treasury infrastructure platform. Help with GRAIN payments, VAULT reserves, Treasury SDK integration, and account setup."
        journey="support"
        greeting="Hi! Ask me about GRAIN payments, VAULT reserves, or the Treasury SDK."
        placeholder="Ask about treasury, payments, SDK..."
        position="bottom-right"
      />
    </div>
  )
}
