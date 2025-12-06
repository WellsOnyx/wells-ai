'use client'

/**
 * Grain & Vault Landing Page - Premium Redesign
 * grainandvault.com
 *
 * Treasury infrastructure for modern finance teams
 * Zero friction payments. Protected reserves. Native ERP integration.
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
  AlertCircle,
  ChevronRight,
  Play,
  Download,
  ExternalLink
} from 'lucide-react'

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
        {'\n  '}variant: <span className="text-green-400">'s4hana'</span>,
        {'\n  '}auth: {'{'} type: <span className="text-green-400">'oauth2'</span>, clientId, clientSecret {'}'}
        {'\n'}{'}'})
        {'\n\n'}
        <span className="text-purple-400">await</span> sap.<span className="text-yellow-400">connect</span>()
        {'\n\n'}
        <span className="text-gray-500">// Pay vendor instantly via SAP</span>
        {'\n'}<span className="text-purple-400">await</span> sap.<span className="text-yellow-400">createPayment</span>({'{'}
        {'\n  '}vendorId: <span className="text-green-400">'VEND-00234'</span>,
        {'\n  '}amount: <span className="text-blue-300">25000</span>,
        {'\n  '}currency: <span className="text-green-400">'GRAIN'</span>,
        {'\n  '}companyCode: <span className="text-green-400">'1000'</span>
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
        {'\n  '}variant: <span className="text-green-400">'fusion'</span>,
        {'\n  '}auth: {'{'} type: <span className="text-green-400">'oauth2'</span>, clientId, clientSecret {'}'}
        {'\n'}{'}'})
        {'\n\n'}
        <span className="text-purple-400">await</span> oracle.<span className="text-yellow-400">connect</span>()
        {'\n\n'}
        <span className="text-gray-500">// Pay vendor with Oracle sync</span>
        {'\n'}<span className="text-purple-400">await</span> oracle.<span className="text-yellow-400">createPayment</span>({'{'}
        {'\n  '}vendorId: <span className="text-green-400">'100000001234567'</span>,
        {'\n  '}amount: <span className="text-blue-300">50000</span>,
        {'\n  '}currency: <span className="text-green-400">'GRAIN'</span>,
        {'\n  '}businessUnit: <span className="text-green-400">'US Operations'</span>
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
        {'\n  '}auth: {'{'}
        {'\n    '}type: <span className="text-green-400">'tba'</span>,
        {'\n    '}consumerKey, consumerSecret, tokenId, tokenSecret
        {'\n  '}
        {'\n'}{'}'})
        {'\n\n'}
        <span className="text-purple-400">await</span> netsuite.<span className="text-yellow-400">connect</span>()
        {'\n\n'}
        <span className="text-gray-500">// Pay vendor - auto-syncs to NetSuite</span>
        {'\n'}<span className="text-purple-400">await</span> netsuite.<span className="text-yellow-400">createPayment</span>({'{'}
        {'\n  '}vendorId: <span className="text-green-400">'1234'</span>,
        {'\n  '}amount: <span className="text-blue-300">25000</span>,
        {'\n  '}currency: <span className="text-green-400">'GRAIN'</span>,
        {'\n  '}subsidiary: <span className="text-green-400">'1'</span>
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
        <span className="text-gray-500">// Connect to D365 Finance & Operations</span>
        {'\n'}<span className="text-blue-400">const</span> dynamics = <span className="text-yellow-400">createDynamics365Adapter</span>({'{'}
        {'\n  '}host: <span className="text-green-400">'your-org.operations.dynamics.com'</span>,
        {'\n  '}tenant: <span className="text-green-400">'your-tenant-id'</span>,
        {'\n  '}variant: <span className="text-green-400">'finance-operations'</span>,
        {'\n  '}auth: {'{'} type: <span className="text-green-400">'oauth2'</span>, clientId, clientSecret {'}'}
        {'\n'}{'}'})
        {'\n\n'}
        <span className="text-purple-400">await</span> dynamics.<span className="text-yellow-400">connect</span>()
        {'\n\n'}
        <span className="text-gray-500">// Instant vendor payment</span>
        {'\n'}<span className="text-purple-400">await</span> dynamics.<span className="text-yellow-400">createPayment</span>({'{'}
        {'\n  '}vendorId: <span className="text-green-400">'V-000123'</span>,
        {'\n  '}amount: <span className="text-blue-300">35000</span>,
        {'\n  '}currency: <span className="text-green-400">'GRAIN'</span>,
        {'\n  '}legalEntity: <span className="text-green-400">'USMF'</span>
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
        <span className="text-gray-500">// Connect to Workday Financial Management</span>
        {'\n'}<span className="text-blue-400">const</span> workday = <span className="text-yellow-400">createWorkdayAdapter</span>({'{'}
        {'\n  '}host: <span className="text-green-400">'wd2-impl-services1.workday.com'</span>,
        {'\n  '}tenant: <span className="text-green-400">'your-tenant'</span>,
        {'\n  '}auth: {'{'}
        {'\n    '}type: <span className="text-green-400">'oauth2'</span>,
        {'\n    '}clientId, clientSecret, refreshToken
        {'\n  '}
        {'\n'}{'}'})
        {'\n\n'}
        <span className="text-purple-400">await</span> workday.<span className="text-yellow-400">connect</span>()
        {'\n\n'}
        <span className="text-gray-500">// Pay supplier via Workday</span>
        {'\n'}<span className="text-purple-400">await</span> workday.<span className="text-yellow-400">createPayment</span>({'{'}
        {'\n  '}vendorId: <span className="text-green-400">'SUPP-00234'</span>,
        {'\n  '}amount: <span className="text-blue-300">18000</span>,
        {'\n  '}currency: <span className="text-green-400">'GRAIN'</span>,
        {'\n  '}company: <span className="text-green-400">'Global Modern Services'</span>
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
        {'\n  '}auth: {'{'}
        {'\n    '}type: <span className="text-green-400">'oauth2'</span>,
        {'\n    '}clientId, clientSecret, scope: <span className="text-green-400">'core.invoice.read'</span>
        {'\n  '}
        {'\n'}{'}'})
        {'\n\n'}
        <span className="text-purple-400">await</span> coupa.<span className="text-yellow-400">connect</span>()
        {'\n\n'}
        <span className="text-gray-500">// Pay via Coupa Pay</span>
        {'\n'}<span className="text-purple-400">await</span> coupa.<span className="text-yellow-400">createPayment</span>({'{'}
        {'\n  '}vendorId: <span className="text-green-400">'45678'</span>,
        {'\n  '}amount: <span className="text-blue-300">42000</span>,
        {'\n  '}currency: <span className="text-green-400">'GRAIN'</span>,
        {'\n  '}invoiceNumber: <span className="text-green-400">'INV-2024-0123'</span>
        {'\n'}{'}'})
      </>
    )
  }
}

const erpList = ['SAP', 'Oracle', 'NetSuite', 'Dynamics 365', 'Workday', 'Coupa'] as const

export default function GrainVaultLanding() {
  const [selectedERP, setSelectedERP] = useState<string>('NetSuite')

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                  <div className="w-4 h-4 bg-black rounded-sm" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-sm" />
              </div>
              <span className="text-lg font-semibold tracking-tight">Grain & Vault</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <Link href="#products" className="text-sm text-gray-400 hover:text-white transition-colors">
                Products
              </Link>
              <Link href="#treasury-sdk" className="text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium">
                Treasury SDK
              </Link>
              <Link href="#developers" className="text-sm text-gray-400 hover:text-white transition-colors">
                Developers
              </Link>
              <Link href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">
                Pricing
              </Link>
              <div className="flex items-center gap-3 ml-4">
                <Link
                  href="/demo"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Docs
                </Link>
                <Link
                  href="/signin"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-black text-sm font-medium rounded-lg transition-all"
                >
                  Open Account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 lg:px-8 overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-green-500/10 via-black to-black" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/20 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 mb-8">
              <Sparkles className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400 font-medium">Treasury SDK Now Available</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="text-white">Treasury infrastructure</span>
              <br />
              <span className="bg-gradient-to-r from-green-400 via-green-500 to-emerald-600 bg-clip-text text-transparent">
                that just works
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-gray-400 mb-12 leading-relaxed max-w-3xl mx-auto">
              Zero-friction payments with GRAIN. Protected reserves with VAULT.
              Native ERP integration for CFOs and treasury teams.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link
                href="/signup"
                className="group px-8 py-4 bg-green-500 hover:bg-green-600 text-black rounded-xl font-semibold text-lg transition-all hover:scale-105 hover:shadow-2xl hover:shadow-green-500/50 flex items-center gap-2"
              >
                Open Account
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="#treasury-sdk"
                className="group px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-xl font-semibold text-lg transition-all flex items-center gap-2"
              >
                <Code className="w-5 h-5" />
                Explore SDK
              </Link>
              <Link
                href="/demo"
                className="group px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-xl font-semibold text-lg transition-all flex items-center gap-2"
              >
                <Play className="w-5 h-5" />
                Interactive Demo
              </Link>
            </div>

            {/* Trust Bar */}
            <div className="flex items-center justify-center gap-8 text-sm text-gray-500">
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
          </div>

          {/* Code Preview */}
          <div className="mt-20 max-w-4xl mx-auto">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 rounded-2xl blur opacity-20" />
              <div className="relative bg-[#0d1117] border border-white/10 rounded-2xl p-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="text-xs text-gray-500">treasury-payment.ts</div>
                </div>
                <pre className="text-sm overflow-x-auto">
                  <code className="text-gray-300">
                    <span className="text-purple-400">import</span> {'{'} createTreasurySDK {'}'} <span className="text-purple-400">from</span> <span className="text-green-400">'@grainandvault/sdk'</span>
                    {'\n\n'}
                    <span className="text-blue-400">const</span> treasury = <span className="text-yellow-400">createTreasurySDK</span>({'{'}
                    {'\n  '}apiKey: process.env.<span className="text-green-400">GRAIN_VAULT_KEY</span>,
                    {'\n  '}erp: <span className="text-green-400">'netsuite'</span>,
                    {'\n'}{'}'})
                    {'\n\n'}
                    <span className="text-gray-500">// Pay vendor instantly - 0% friction</span>
                    {'\n'}<span className="text-purple-400">await</span> treasury.<span className="text-yellow-400">pay</span>({'{'}
                    {'\n  '}vendor: <span className="text-green-400">'0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'</span>,
                    {'\n  '}amount: <span className="text-blue-300">25000</span>,
                    {'\n  '}currency: <span className="text-green-400">'GRAIN'</span>,
                    {'\n  '}reference: <span className="text-green-400">'PO-2024-001234'</span>
                    {'\n'}{'}'})
                    {'\n\n'}
                    <span className="text-gray-500">// Settlement: &lt;1 second</span>
                    {'\n'}
                    <span className="text-gray-500">// Chargeback risk: 0%</span>
                  </code>
                </pre>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">{'<'}1s</div>
              <div className="text-sm text-gray-400">Settlement Time</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">0%</div>
              <div className="text-sm text-gray-400">Payment Friction</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">100%</div>
              <div className="text-sm text-gray-400">Collateral Ratio</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">24/7</div>
              <div className="text-sm text-gray-400">Blockchain Audits</div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="py-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Two products. One platform.</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              GRAIN eliminates payment friction. VAULT protects your reserves.
              Together, they power enterprise treasury operations.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* GRAIN Card */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity" />
              <div className="relative bg-gradient-to-br from-[#0a0f0a] to-black border border-green-500/20 rounded-2xl p-8 hover:border-green-500/40 transition-all">
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
                  GRAIN moves money at the speed of business.
                </p>

                <div className="space-y-4 mb-8">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    </div>
                    <div>
                      <div className="font-medium mb-1">Instant Settlement</div>
                      <div className="text-sm text-gray-500">Sub-second finality. No waiting periods.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    </div>
                    <div>
                      <div className="font-medium mb-1">Zero Chargebacks</div>
                      <div className="text-sm text-gray-500">Transactions are final. No reversals.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    </div>
                    <div>
                      <div className="font-medium mb-1">Global by Default</div>
                      <div className="text-sm text-gray-500">No borders. No currency conversion.</div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/10">
                  <div className="grid grid-cols-3 gap-4 text-center">
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
                </div>
              </div>
            </div>

            {/* VAULT Card */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity" />
              <div className="relative bg-gradient-to-br from-[#0a0a0f] to-black border border-blue-500/20 rounded-2xl p-8 hover:border-blue-500/40 transition-all">
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
                  100% collateralized reserves with real-time blockchain audits.
                  Complete transparency, zero counterparty risk.
                </p>

                <div className="space-y-4 mb-8">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-3 h-3 text-blue-400" />
                    </div>
                    <div>
                      <div className="font-medium mb-1">100% Collateralized</div>
                      <div className="text-sm text-gray-500">Every GRAIN backed by $1.00 USDC.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-3 h-3 text-blue-400" />
                    </div>
                    <div>
                      <div className="font-medium mb-1">Real-Time Audits</div>
                      <div className="text-sm text-gray-500">Every block. Fully transparent.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-3 h-3 text-blue-400" />
                    </div>
                    <div>
                      <div className="font-medium mb-1">On-Chain Proof</div>
                      <div className="text-sm text-gray-500">Verifiable reserves. No black boxes.</div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/10">
                  <div className="grid grid-cols-3 gap-4 text-center">
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
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Treasury SDK Section - Main Conversion Point */}
      <section id="treasury-sdk" className="relative py-32 px-6 lg:px-8 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-black via-purple-950/10 to-black" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

        <div className="relative max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
              <Code className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-400 font-medium">Treasury SDK</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Enterprise treasury infrastructure
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                in your ERP
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Drop-in SDK for SAP, Oracle, NetSuite, and more. CFOs get instant liquidity,
              procurement gets faster payments, treasury gets real-time visibility.
            </p>
          </div>

          {/* Key Benefits */}
          <div className="grid md:grid-cols-3 gap-6 mb-20">
            <div className="bg-gradient-to-br from-purple-500/5 to-transparent border border-purple-500/20 rounded-xl p-6 hover:border-purple-500/40 transition-all">
              <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-4">
                <DollarSign className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">0% Payment Friction</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Instant settlement, no failed transactions, no chargebacks.
                Pay vendors at the speed of conversation.
              </p>
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-3xl font-bold text-purple-400">{'<'}1s</div>
                <div className="text-xs text-gray-500">Average settlement time</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500/5 to-transparent border border-green-500/20 rounded-xl p-6 hover:border-green-500/40 transition-all">
              <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">1:1 Credit Line</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Deposit GRAIN, get instant credit. Use it for payments while your
                balance stays put and appreciates.
              </p>
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-3xl font-bold text-green-400">100%</div>
                <div className="text-xs text-gray-500">Credit line on deposits</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/20 rounded-xl p-6 hover:border-blue-500/40 transition-all">
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Protected Value</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                100% collateralized reserves with real-time audits.
                Your treasury, secured and transparent.
              </p>
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-3xl font-bold text-blue-400">100%</div>
                <div className="text-xs text-gray-500">Collateralization ratio</div>
              </div>
            </div>
          </div>

          {/* Integration Section */}
          <div className="mb-20">
            <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-8 md:p-12">
              <div className="flex items-center gap-3 mb-8">
                <Building2 className="w-8 h-8 text-purple-400" />
                <h3 className="text-2xl md:text-3xl font-bold">Native ERP Integration</h3>
              </div>

              <p className="text-gray-400 mb-8 text-lg leading-relaxed">
                Plug into your existing financial infrastructure. No rip-and-replace.
                No data migration. Just add one SDK and unlock zero-friction treasury operations.
              </p>

              {/* ERP Logos Grid - Interactive */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-8">
                {erpList.map((erp) => (
                  <button
                    key={erp}
                    onClick={() => setSelectedERP(erp)}
                    className={`relative p-4 text-center rounded-lg transition-all duration-300 cursor-pointer ${
                      selectedERP === erp
                        ? 'bg-purple-500/20 border-2 border-purple-500 shadow-lg shadow-purple-500/20 scale-105'
                        : 'bg-black/50 border border-white/10 hover:border-purple-500/30 hover:bg-purple-500/5'
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

              {/* Selected ERP indicator */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className="text-sm text-gray-500">Showing SDK for:</span>
                <span className="text-sm font-semibold text-purple-400">{selectedERP}</span>
              </div>

              {/* Code Example - Dynamic based on selected ERP */}
              <div className="relative">
                <div className={`absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl blur transition-opacity duration-300 ${
                  selectedERP ? 'opacity-20' : 'opacity-10'
                }`} />
                <div className="relative bg-[#0d1117] border border-white/10 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-2">
                      <Code className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-gray-400 transition-all duration-300">
                        {erpCodeExamples[selectedERP]?.filename || 'treasury-sdk.ts'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-1 rounded">
                        {selectedERP} SDK
                      </span>
                      <button className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors">
                        <Download className="w-3 h-3" />
                        Copy
                      </button>
                    </div>
                  </div>
                  <div className="p-6 overflow-x-auto min-h-[320px]">
                    <pre className="text-sm">
                      <code className="text-gray-300">
                        {erpCodeExamples[selectedERP]?.code}
                      </code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
            <div>
              <h3 className="text-3xl font-bold mb-6">Built for modern treasury teams</h3>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <FileCheck className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="font-semibold mb-2">Procurement Champions It</div>
                    <p className="text-gray-400 text-sm">
                      Instant vendor payments strengthen supplier relationships.
                      Better terms, priority fulfillment, and happier partners.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <div className="font-semibold mb-2">Finance Approves It</div>
                    <p className="text-gray-400 text-sm">
                      1:1 credit line on deposits plus GRAIN appreciation plus zero failed payments
                      equals easy CFO sign-off.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="font-semibold mb-2">Vendors Join Automatically</div>
                    <p className="text-gray-400 text-sm">
                      Invite your vendor ecosystem. Onboarding takes minutes.
                      Network effects compound as more join.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="font-semibold mb-2">Real-Time Visibility</div>
                    <p className="text-gray-400 text-sm">
                      Live treasury dashboard with balance, credit, settlements, and audit trail.
                      Full transparency, zero latency.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Dashboard Preview */}
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-20" />
              <div className="relative bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 rounded-2xl p-8">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-lg font-bold">Treasury Dashboard</h4>
                  <Activity className="w-5 h-5 text-purple-400" />
                </div>

                <div className="space-y-4">
                  <div className="bg-black/50 border border-white/10 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">GRAIN Balance</span>
                      <Wallet className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="text-2xl font-bold">2,487,594 GRAIN</div>
                    <div className="text-xs text-green-400 mt-1">+3.2% vs deposit value</div>
                  </div>

                  <div className="bg-black/50 border border-white/10 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">Available Credit</span>
                      <TrendingUp className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="text-2xl font-bold text-green-400">2,487,594 GRAIN</div>
                    <div className="text-xs text-gray-500 mt-1">1:1 credit line</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/50 border border-white/10 rounded-lg p-4">
                      <div className="text-sm text-gray-400 mb-1">Avg Settlement</div>
                      <div className="text-xl font-bold">0.8s</div>
                    </div>
                    <div className="bg-black/50 border border-white/10 rounded-lg p-4">
                      <div className="text-sm text-gray-400 mb-1">Failed Payments</div>
                      <div className="text-xl font-bold text-purple-400">0</div>
                    </div>
                  </div>

                  <div className="bg-black/50 border border-white/10 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">Collateral Health</span>
                      <Shield className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full w-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full" />
                      </div>
                      <span className="text-sm font-bold text-blue-400">100%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-white/10">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span>Audited 2 seconds ago</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <a
              href="mailto:sdk@grainandvault.com?subject=Treasury SDK Access Request&body=I'm interested in getting SDK access for my organization.%0A%0ACompany:%0AUse Case:%0AExpected Monthly Volume:"
              className="group inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-xl font-semibold text-lg transition-all hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50"
            >
              <Code className="w-5 h-5" />
              Get SDK Access
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
            <p className="mt-4 text-sm text-gray-500">
              Production-ready in minutes. Full documentation included.
            </p>
          </div>
        </div>
      </section>

      {/* Built for Everyone Section */}
      <section id="developers" className="py-24 px-6 lg:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Built for everyone</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Whether you're a CFO, treasury manager, or developer,
              getting started takes minutes, not months.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-black/50 border border-white/10 rounded-xl p-8 hover:border-green-500/30 transition-all">
              <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center mb-6">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">For CFOs</h3>
              <p className="text-gray-400 text-sm mb-6">
                No technical expertise required. Our dashboard shows your treasury health,
                credit lines, and payment status in plain English.
              </p>
              <Link
                href="/demo"
                className="text-green-400 hover:text-green-300 text-sm font-medium inline-flex items-center gap-1"
              >
                View Dashboard
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="bg-black/50 border border-white/10 rounded-xl p-8 hover:border-blue-500/30 transition-all">
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-6">
                <Building2 className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">For Treasury Teams</h3>
              <p className="text-gray-400 text-sm mb-6">
                One-click ERP integration. Automated reconciliation.
                No more spreadsheet gymnastics or manual entry.
              </p>
              <Link
                href="/demo"
                className="text-blue-400 hover:text-blue-300 text-sm font-medium inline-flex items-center gap-1"
              >
                See Integration
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="bg-black/50 border border-white/10 rounded-xl p-8 hover:border-purple-500/30 transition-all">
              <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-6">
                <Code className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">For Developers</h3>
              <p className="text-gray-400 text-sm mb-6">
                Modern APIs, type-safe SDKs, and a sandbox environment.
                Ship treasury features in hours, not quarters.
              </p>
              <Link
                href="/demo"
                className="text-purple-400 hover:text-purple-300 text-sm font-medium inline-flex items-center gap-1"
              >
                API Docs
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Next-Generation Stability Section */}
      <section className="py-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Next-generation stability</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              VAULT protects your value with automatic manipulation detection
              and the industry's most rigorous stability guarantee.
            </p>
          </div>

          {/* Main Stability Feature */}
          <div className="mb-16">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur opacity-20" />
              <div className="relative bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-2xl p-8 md:p-12">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-8">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl md:text-3xl font-bold mb-2">Automatic Price Protection</h3>
                    <p className="text-gray-400">When VAULT detects currency manipulation, it acts instantly.</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-black/30 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-blue-400" />
                      </div>
                      <span className="text-sm font-semibold text-blue-400">Step 1</span>
                    </div>
                    <h4 className="font-bold mb-2">Manipulation Detected</h4>
                    <p className="text-sm text-gray-400">
                      AI monitors market conditions 24/7. Any abnormal activity triggers immediate review.
                    </p>
                  </div>

                  <div className="bg-black/30 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Lock className="w-5 h-5 text-purple-400" />
                      </div>
                      <span className="text-sm font-semibold text-purple-400">Step 2</span>
                    </div>
                    <h4 className="font-bold mb-2">Price Freeze</h4>
                    <p className="text-sm text-gray-400">
                      GRAIN price automatically locks to the previous day's high. Your value is protected.
                    </p>
                  </div>

                  <div className="bg-black/30 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <FileCheck className="w-5 h-5 text-green-400" />
                      </div>
                      <span className="text-sm font-semibold text-green-400">Step 3</span>
                    </div>
                    <h4 className="font-bold mb-2">7-Day Audit</h4>
                    <p className="text-sm text-gray-400">
                      Full blockchain audit of float and asset reserves. Price resets higher after verification.
                    </p>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-white/10 text-center">
                  <p className="text-lg text-gray-300 mb-2">The result?</p>
                  <p className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    The most stable stablecoin in existence.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stability Metrics */}
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-xl bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="font-semibold mb-2">Price Protection</h3>
              <p className="text-sm text-gray-400">Auto-freeze on manipulation</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-xl bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="font-semibold mb-2">100% Collateral</h3>
              <p className="text-sm text-gray-400">Plus asset reserves in float</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-xl bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <Activity className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="font-semibold mb-2">7-Day Deep Audit</h3>
              <p className="text-sm text-gray-400">Full transparency on-chain</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-xl bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="font-semibold mb-2">Value Only Goes Up</h3>
              <p className="text-sm text-gray-400">Reset higher after audits</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative py-32 px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-blue-500/10 to-purple-500/10" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Zap className="w-8 h-8 text-black" />
            </div>
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>

          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Ready to modernize your treasury?
          </h2>

          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
            Join forward-thinking finance teams building on Grain & Vault.
            Get started in minutes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="#treasury-sdk"
              className="group px-8 py-4 bg-green-500 hover:bg-green-600 text-black rounded-xl font-semibold text-lg transition-all hover:scale-105 hover:shadow-2xl hover:shadow-green-500/50 flex items-center gap-2"
            >
              Get SDK Access
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/demo"
              className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-xl font-semibold text-lg transition-all flex items-center gap-2"
            >
              Read Documentation
              <ExternalLink className="w-5 h-5" />
            </Link>
          </div>

          <p className="mt-8 text-sm text-gray-500">
            Questions? <Link href="mailto:treasury@grainandvault.com" className="text-green-400 hover:text-green-300">Contact our team</Link>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-5 gap-12 mb-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                    <div className="w-4 h-4 bg-black rounded-sm" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-sm" />
                </div>
                <span className="text-lg font-semibold">Grain & Vault</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Treasury infrastructure for modern finance teams.
                Zero-friction payments with protected reserves.
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Lock className="w-3 h-3" />
                <span>SOC 2 Type II Certified</span>
              </div>
            </div>

            {/* Products */}
            <div>
              <h4 className="font-semibold mb-4 text-sm">Products</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="#products" className="text-gray-400 hover:text-white transition-colors">GRAIN</Link></li>
                <li><Link href="#products" className="text-gray-400 hover:text-white transition-colors">VAULT</Link></li>
                <li><Link href="#treasury-sdk" className="text-purple-400 hover:text-purple-300 transition-colors">Treasury SDK</Link></li>
                <li><Link href="#pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</Link></li>
              </ul>
            </div>

            {/* Developers */}
            <div>
              <h4 className="font-semibold mb-4 text-sm">Developers</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/demo" className="text-gray-400 hover:text-white transition-colors">Documentation</Link></li>
                <li><Link href="/demo" className="text-gray-400 hover:text-white transition-colors">API Reference</Link></li>
                <li><Link href="/demo" className="text-gray-400 hover:text-white transition-colors">SDKs</Link></li>
                <li><Link href="/demo" className="text-gray-400 hover:text-white transition-colors">Sandbox</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-semibold mb-4 text-sm">Company</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/about" className="text-gray-400 hover:text-white transition-colors">About</Link></li>
                <li><Link href="/security" className="text-gray-400 hover:text-white transition-colors">Security</Link></li>
                <li><Link href="/support" className="text-gray-400 hover:text-white transition-colors">Support</Link></li>
                <li><Link href="/partnerships" className="text-gray-400 hover:text-white transition-colors">Partners</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-500">
              <p>© 2025 Grain & Vault. All rights reserved.</p>
              <p className="mt-1">
                Grain & Vault is a{' '}
                <Link href="https://wellsonyx.io" className="text-amber-400 hover:text-amber-300 transition-colors">
                  Wells Onyx
                </Link>
                {' '}portfolio company.
              </p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/privacy" className="text-gray-500 hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="text-gray-500 hover:text-white transition-colors">Terms</Link>
              <Link href="/cookies" className="text-gray-500 hover:text-white transition-colors">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* WellsAI Chat Widget - Grain & Vault is our first customer */}
      <WellsAIChatWidget
        brandColor="#22C55E"
        accentColor="#10B981"
        brandName="Grain & Vault Support"
        context="You are a support assistant for Grain & Vault, a treasury infrastructure platform. You help users with: GRAIN payments (zero-friction instant settlement), VAULT reserves (100% collateralized), Treasury SDK integration (SAP, Oracle, NetSuite, Dynamics 365, Workday, Coupa), account setup, and technical questions about the API. Be concise, helpful, and knowledgeable about enterprise treasury operations."
        journey="support"
        greeting="Hi! I'm here to help with Grain & Vault. Ask me about GRAIN payments, VAULT reserves, the Treasury SDK, or getting started with your account."
        placeholder="Ask about treasury, payments, SDK..."
        position="bottom-right"
      />
    </div>
  )
}
