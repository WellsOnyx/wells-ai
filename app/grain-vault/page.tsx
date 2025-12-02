'use client'

/**
 * Grain & Vault Landing Page
 * grainandvault.com
 *
 * Payments without friction. Value without risk.
 */

import Link from 'next/link'
import {
  Zap,
  Shield,
  ArrowRight,
  CheckCircle,
  TrendingUp,
  Lock,
  Globe,
  Activity,
  Code,
  Database,
  Wallet,
  Building2,
  Percent,
  DollarSign
} from 'lucide-react'

export default function GrainVaultLanding() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-600" />
              <span className="text-xl font-bold">Grain & Vault</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="#grain" className="text-gray-300 hover:text-white transition-colors">
                Grain
              </Link>
              <Link href="#vault" className="text-gray-300 hover:text-white transition-colors">
                Vault
              </Link>
              <Link href="#treasury-sdk" className="text-purple-400 hover:text-purple-300 transition-colors font-semibold">
                Treasury SDK
              </Link>
              <Link href="#enterprise" className="text-gray-300 hover:text-white transition-colors">
                Enterprise
              </Link>
              <Link
                href="https://docs.grainandvault.com"
                className="px-4 py-2 bg-green-500 text-black rounded-lg font-semibold hover:bg-green-600 transition-colors"
              >
                Documentation
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Payments Without Friction.
            <br />
            Value Without Risk.
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 mb-12">
            Grain moves money at the speed of conversation.
            <br />
            Vault keeps your value stable through blockchain audits.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="#grain"
              className="px-8 py-4 bg-green-500 text-black rounded-xl font-bold text-lg hover:bg-green-600 transition-all hover:scale-105 flex items-center gap-2"
            >
              Explore Grain
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="#vault"
              className="px-8 py-4 bg-gray-900 border border-gray-800 rounded-xl font-semibold text-lg hover:border-green-500 transition-all"
            >
              Learn About Vault
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="text-4xl font-bold text-green-500 mb-2">110%</div>
            <div className="text-gray-400">Collateralized</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-500 mb-2">&lt;1s</div>
            <div className="text-gray-400">Settlement</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-500 mb-2">24/7</div>
            <div className="text-gray-400">Audit Trail</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-500 mb-2">$0</div>
            <div className="text-gray-400">Chargeback Risk</div>
          </div>
        </div>
      </section>

      {/* Grain Section */}
      <section id="grain" className="container mx-auto px-4 py-24 bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <Zap className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-5xl font-bold">Grain</h2>
              </div>
              <p className="text-2xl text-green-400 mb-6 font-semibold">Zero Friction Payments</p>
              <p className="text-xl text-gray-400 mb-8">
                Grain settles transactions instantly. No chargebacks. No reversals. No fraud.
                Just clean, fast payments that work like they should.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold mb-1">Instant Settlement</div>
                    <div className="text-sm text-gray-400">Money moves in under 1 second. No waiting, no delays.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold mb-1">No Chargebacks</div>
                    <div className="text-sm text-gray-400">Transactions are final. You keep what you earn.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold mb-1">Global by Default</div>
                    <div className="text-sm text-gray-400">Works everywhere. No currency conversion, no borders.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold mb-1">Built for B2B</div>
                    <div className="text-sm text-gray-400">Milestone payments, escrow, dispute resolution included.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500/10 to-emerald-600/10 border border-green-500/20 rounded-2xl p-8">
              <div className="space-y-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Transaction Speed</span>
                  <span className="text-green-400 font-bold">&lt;1 second</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Settlement Finality</span>
                  <span className="text-green-400 font-bold">Instant</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Chargeback Risk</span>
                  <span className="text-green-400 font-bold">0%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Geographic Limits</span>
                  <span className="text-green-400 font-bold">None</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Payment Friction</span>
                  <span className="text-green-400 font-bold">0%</span>
                </div>

                <div className="pt-6 border-t border-green-500/20">
                  <Globe className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-center text-sm text-gray-400">
                    Powered by Base L2. USDC-backed. Battle-tested infrastructure.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Vault Section */}
      <section id="vault" className="container mx-auto px-4 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1 bg-gradient-to-br from-blue-500/10 to-purple-600/10 border border-blue-500/20 rounded-2xl p-8">
              <div className="space-y-6">
                <div className="flex items-center gap-4 mb-6">
                  <Lock className="w-12 h-12 text-blue-400" />
                  <div>
                    <div className="text-2xl font-bold">Treasury Protection</div>
                    <div className="text-sm text-gray-400">Real-time blockchain audits</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-black/50 rounded-lg">
                    <span className="text-gray-400">Collateral Ratio</span>
                    <span className="text-blue-400 font-bold">110%</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-black/50 rounded-lg">
                    <span className="text-gray-400">Reserve Assets</span>
                    <span className="text-blue-400 font-bold">USDC</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-black/50 rounded-lg">
                    <span className="text-gray-400">Audit Frequency</span>
                    <span className="text-blue-400 font-bold">Every Block</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-black/50 rounded-lg">
                    <span className="text-gray-400">Transparency</span>
                    <span className="text-blue-400 font-bold">100% On-Chain</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-blue-500/20">
                  <Activity className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                  <p className="text-center text-sm text-gray-400">
                    Every transaction verifiable. Every reserve auditable. No black boxes.
                  </p>
                </div>
              </div>
            </div>

            <div className="order-1 md:order-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Shield className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-5xl font-bold">Vault</h2>
              </div>
              <p className="text-2xl text-blue-400 mb-6 font-semibold">Value Protection Through Audits</p>
              <p className="text-xl text-gray-400 mb-8">
                Vault keeps your float stable through continuous blockchain audits.
                No surprises. No hidden risks. Just transparent, protected value.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold mb-1">110% Collateralized</div>
                    <div className="text-sm text-gray-400">Every GRAIN backed by $1.10 in reserves. Over-collateralized by design.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold mb-1">Real-Time Audits</div>
                    <div className="text-sm text-gray-400">Every transaction verified on-chain. Reserves audited every block.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold mb-1">Transparent Reserves</div>
                    <div className="text-sm text-gray-400">See exactly what backs your value. No hidden assets.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold mb-1">Stable Float</div>
                    <div className="text-sm text-gray-400">Treasury management that maintains value through market volatility.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Treasury SDK Section - THE BIG UNLOCK */}
      <section id="treasury-sdk" className="container mx-auto px-4 py-24 bg-gradient-to-b from-black to-purple-950/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-sm font-semibold mb-6">
              <Code className="w-4 h-4" />
              NEW: Treasury SDK
            </div>
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              Zero Friction Payments
              <br />
              <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                In Your ERP
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              CFOs and Treasury teams can now implement Grain & Vault directly in their native ERP
              and vendor ecosystem. Procurement champions it. Finance approves it. Everyone wins.
            </p>
          </div>

          {/* Value Props */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-black/50 border border-purple-500/20 rounded-xl p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <Percent className="w-8 h-8 text-purple-400" />
              </div>
              <div className="text-4xl font-bold text-purple-400 mb-2">0%</div>
              <div className="text-lg font-semibold mb-2">Payment Friction</div>
              <p className="text-gray-400 text-sm">
                Instant settlement. No waiting on banks. No failed payments. No chargebacks.
              </p>
            </div>

            <div className="bg-black/50 border border-green-500/20 rounded-xl p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-green-400" />
              </div>
              <div className="text-4xl font-bold text-green-400 mb-2">1:1</div>
              <div className="text-lg font-semibold mb-2">Credit Line</div>
              <p className="text-gray-400 text-sm">
                Deposit GRAIN, get instant credit. Use it for transactions while your balance stays put.
              </p>
            </div>

            <div className="bg-black/50 border border-amber-500/20 rounded-xl p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-amber-400" />
              </div>
              <div className="text-4xl font-bold text-amber-400 mb-2">$0</div>
              <div className="text-lg font-semibold mb-2">Failed Payments</div>
              <p className="text-gray-400 text-sm">
                No bounced checks. No declined cards. No chargeback risk. Money moves.
              </p>
            </div>
          </div>

          {/* ERP Integrations */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 mb-16">
            <div className="flex items-center gap-3 mb-6">
              <Database className="w-8 h-8 text-purple-400" />
              <h3 className="text-2xl font-bold">Native ERP Integration</h3>
            </div>
            <p className="text-gray-400 mb-8">
              Drop-in SDK for your existing financial systems. No rip-and-replace. No migration headaches.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {['SAP', 'Oracle', 'NetSuite', 'Dynamics 365', 'Workday', 'Coupa'].map((erp) => (
                <div key={erp} className="bg-black/50 border border-gray-700 rounded-lg p-4 text-center">
                  <div className="text-sm font-semibold text-gray-300">{erp}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-6 bg-black/50 rounded-xl">
              <div className="text-sm text-gray-400 mb-4">Quick Start</div>
              <pre className="text-sm text-purple-300 overflow-x-auto">
{`import { createTreasurySDK } from '@grainandvault/treasury-sdk'

const treasury = createTreasurySDK({
  apiKey: process.env.GRAIN_VAULT_API_KEY,
  organizationId: 'acme-corp',
  erpType: 'netsuite',
})

await treasury.initialize()

// Pay a vendor instantly - 0% friction
await treasury.payVendor({
  vendorWallet: '0x...',
  amount: 25000,
  reference: 'PO-2024-001234',
})

// Check your 1:1 credit line
const credit = await treasury.getCreditLine()
// credit.creditAvailable === your balance`}
              </pre>
            </div>
          </div>

          {/* How It Works for Treasury */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-3xl font-bold mb-6">Built for Treasury Teams</h3>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="font-semibold mb-1">Procurement Champions It</div>
                    <p className="text-gray-400 text-sm">
                      Faster vendor payments = better supplier relationships. Procurement teams love it.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <div className="font-semibold mb-1">Finance Approves It</div>
                    <p className="text-gray-400 text-sm">
                      1:1 credit line on deposits + GRAIN appreciation + zero failed payments = easy CFO sign-off.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="font-semibold mb-1">Vendors Join Automatically</div>
                    <p className="text-gray-400 text-sm">
                      Invite your vendor ecosystem. They onboard in minutes. Network effects kick in.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-8">
              <h4 className="text-lg font-bold mb-6">Treasury Dashboard Preview</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-black/50 rounded-lg">
                  <span className="text-gray-400">GRAIN Balance</span>
                  <span className="text-white font-bold">2.4M GRAIN</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-black/50 rounded-lg">
                  <span className="text-gray-400">Available Credit</span>
                  <span className="text-green-400 font-bold">2.4M GRAIN</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-black/50 rounded-lg">
                  <span className="text-gray-400">GRAIN Value (vs deposit)</span>
                  <span className="text-amber-400 font-bold">+3.2%</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-black/50 rounded-lg">
                  <span className="text-gray-400">Failed Payments</span>
                  <span className="text-purple-400 font-bold">0</span>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-16">
            <Link
              href="https://docs.grainandvault.com/treasury-sdk"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-bold text-lg hover:scale-105 transition-transform"
            >
              <Code className="w-5 h-5" />
              Get Treasury SDK Access
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Enterprise Section */}
      <section id="enterprise" className="container mx-auto px-4 py-24 bg-gray-900/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Built for Enterprise Treasury</h2>
          <p className="text-xl text-gray-400 mb-12">
            Grain handles the friction. Vault handles the risk.
            <br />
            Together, they make B2B payments actually work.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-black border border-gray-800 rounded-xl p-8">
              <TrendingUp className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-3">For Platforms</h3>
              <p className="text-gray-400 text-sm mb-4">
                Integrate Grain for instant settlement. Rely on Vault to keep your treasury stable.
                No payment failures, no value risk.
              </p>
              <Link
                href="https://docs.grainandvault.com/platforms"
                className="text-green-400 hover:text-green-300 text-sm font-semibold inline-flex items-center gap-2"
              >
                Platform Documentation
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-black border border-gray-800 rounded-xl p-8">
              <Lock className="w-12 h-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-3">For Enterprises</h3>
              <p className="text-gray-400 text-sm mb-4">
                Use Grain for supplier payments. Trust Vault to protect your reserves.
                Full audit trail, zero chargeback risk.
              </p>
              <Link
                href="https://docs.grainandvault.com/enterprises"
                className="text-blue-400 hover:text-blue-300 text-sm font-semibold inline-flex items-center gap-2"
              >
                Enterprise Documentation
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-12">
          <div className="flex items-center justify-center gap-4 mb-6">
            <Zap className="w-12 h-12 text-black" />
            <Shield className="w-12 h-12 text-black" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-black mb-6">
            Ready to Build?
          </h2>
          <p className="text-xl text-black/80 mb-8">
            Integrate Grain & Vault into your treasury infrastructure
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="https://docs.grainandvault.com"
              className="inline-flex items-center gap-2 px-8 py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-900 transition-all hover:scale-105"
            >
              View Documentation
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="#treasury-sdk"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-gray-100 transition-all"
            >
              Get SDK Access
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-900/50">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-600" />
                <span className="text-xl font-bold">Grain & Vault</span>
              </div>
              <p className="text-gray-400 text-sm">
                Payments without friction. Value without risk.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="#grain" className="hover:text-white transition-colors">Grain</Link></li>
                <li><Link href="#vault" className="hover:text-white transition-colors">Vault</Link></li>
                <li><Link href="#treasury-sdk" className="hover:text-white transition-colors">Treasury SDK</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Developers</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="https://docs.grainandvault.com" className="hover:text-white transition-colors">Documentation</Link></li>
                <li><Link href="https://docs.grainandvault.com/api" className="hover:text-white transition-colors">API Reference</Link></li>
                <li><Link href="https://github.com/grainandvault" className="hover:text-white transition-colors">GitHub</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link href="/support" className="hover:text-white transition-colors">Support</Link></li>
                <li><Link href="/partnerships" className="hover:text-white transition-colors">Partnerships</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>© 2025 Grain & Vault. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
