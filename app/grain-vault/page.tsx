'use client'

/**
 * Grain & Vault Landing Page
 * grainandvault.com
 *
 * Blockchain payment infrastructure for B2B commerce
 */

import Link from 'next/link'
import {
  Shield,
  Zap,
  Code,
  Lock,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Coins,
  FileCode
} from 'lucide-react'

const FEATURES = [
  {
    icon: Coins,
    title: 'GRAIN Token',
    description: 'USDC-backed stablecoin that auto-revalues based on treasury NAV. 110% collateralized.'
  },
  {
    icon: Shield,
    title: 'Vault Treasury',
    description: 'Multi-asset treasury management with real-time NAV tracking and yield generation.'
  },
  {
    icon: Lock,
    title: 'Smart Escrow',
    description: 'Milestone-based payments with dispute resolution. Settles in seconds, not days.'
  },
  {
    icon: Code,
    title: 'Developer SDK',
    description: 'Integrate payments in 3 lines of code. TypeScript SDK with full type safety.'
  }
]

const USE_CASES = [
  {
    title: 'B2B Marketplaces',
    description: 'Enable secure escrow for equipment purchases and supplier payments.',
    benefits: ['5-second settlement', 'Milestone payments', 'Automated dispute resolution']
  },
  {
    title: 'SaaS Platforms',
    description: 'Add payment rails to your procurement or marketplace platform.',
    benefits: ['33bps transaction fee', 'White-label ready', 'Full API access']
  },
  {
    title: 'Supply Chain',
    description: 'Pay suppliers on delivery confirmation with smart contract verification.',
    benefits: ['Programmable payments', 'Multi-party escrows', 'Compliance ready']
  }
]

const STATS = [
  { metric: '$10M+', label: 'Total Value Locked' },
  { metric: '0.33%', label: 'Transaction Fee' },
  { metric: '5 sec', label: 'Settlement Time' },
  { metric: '110%', label: 'Collateral Ratio' }
]

const TECH_STACK = [
  { name: 'Base L2', description: 'Ethereum rollup with low fees' },
  { name: 'USDC', description: 'Circle-backed stablecoin' },
  { name: 'OpenZeppelin', description: 'Battle-tested smart contracts' },
  { name: 'Ethers.js', description: 'TypeScript blockchain SDK' }
]

export default function GrainVaultLanding() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500" />
              <span className="text-xl font-bold">Grain & Vault</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="#features" className="text-gray-300 hover:text-white transition-colors">
                Features
              </Link>
              <Link href="#docs" className="text-gray-300 hover:text-white transition-colors">
                Docs
              </Link>
              <Link href="#api" className="text-gray-300 hover:text-white transition-colors">
                API
              </Link>
              <Link href="/wells-ai" className="text-gray-300 hover:text-white transition-colors">
                Wells AI
              </Link>
              <Link
                href="/grain/dashboard"
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                Get API Key
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-full mb-6">
            <Zap className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-300">Built on Base L2 • Audited by Trail of Bits</span>
          </div>

          <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
            Payment Rails for B2B Commerce
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 mb-12">
            Smart contract escrow. USDC-backed stablecoin. 33bps fees.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="#docs"
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-xl font-bold text-lg hover:opacity-90 transition-all hover:scale-105 flex items-center gap-2"
            >
              Read Docs
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="#api"
              className="px-8 py-4 bg-gray-900 border border-gray-800 rounded-xl font-semibold text-lg hover:border-green-500 transition-all"
            >
              Try API
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20 max-w-4xl mx-auto">
          {STATS.map((item, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent mb-2">
                {item.metric}
              </div>
              <div className="text-gray-400">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Infrastructure Built to Scale</h2>
          <p className="text-xl text-gray-400">Production-ready payment rails for B2B platforms</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {FEATURES.map((feature, index) => (
            <div
              key={index}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-green-500 transition-all"
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-gray-400 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Code Example */}
      <section id="api" className="container mx-auto px-4 py-24 bg-gray-900/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Integrate in Minutes</h2>
            <p className="text-xl text-gray-400">TypeScript SDK with full documentation</p>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-xl p-8 overflow-x-auto">
            <div className="flex items-center gap-2 mb-4">
              <FileCode className="w-5 h-5 text-green-400" />
              <span className="text-sm text-gray-400 font-mono">create-escrow.ts</span>
            </div>
            <pre className="text-sm text-gray-300 font-mono">
              <code>{`import { GrainVault } from '@grainvault/sdk'

const vault = new GrainVault({ apiKey: process.env.GRAIN_API_KEY })

// Create escrow with milestones
const escrow = await vault.escrow.create({
  depositor: '0x...',
  beneficiary: '0x...',
  amount: 100000, // $100k
  milestones: [
    { description: 'Delivery', percentage: 5000 },
    { description: 'Installation', percentage: 5000 }
  ]
})

// Fund escrow
await vault.escrow.fund(escrow.id, { token: 'USDC' })

// Complete milestone
await vault.escrow.completeMilestone(escrow.id, 0)`}</code>
            </pre>
          </div>

          <div className="flex justify-center mt-8">
            <Link
              href="/docs"
              className="px-6 py-3 bg-gray-900 border border-gray-800 rounded-lg hover:border-green-500 transition-colors font-semibold"
            >
              View Full Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Built for B2B Platforms</h2>
          <p className="text-xl text-gray-400">Payment infrastructure for modern commerce</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {USE_CASES.map((useCase, index) => (
            <div
              key={index}
              className="bg-gray-900 border border-gray-800 rounded-xl p-8 hover:border-green-500 transition-all"
            >
              <h3 className="text-2xl font-bold mb-3">{useCase.title}</h3>
              <p className="text-gray-400 mb-6">{useCase.description}</p>

              <ul className="space-y-2">
                {useCase.benefits.map((benefit, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-gray-300">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="container mx-auto px-4 py-24 bg-gray-900/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Battle-Tested Technology</h2>
          <p className="text-xl text-gray-400 mb-12">
            Built on industry-standard blockchain infrastructure
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {TECH_STACK.map((tech, index) => (
              <div key={index} className="bg-gray-950 border border-gray-800 rounded-lg p-6">
                <div className="font-bold text-lg mb-2">{tech.name}</div>
                <div className="text-sm text-gray-400">{tech.description}</div>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-gray-950 border border-gray-800 rounded-xl">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mb-2">
              <Shield className="w-4 h-4 text-green-400" />
              <span>Security First</span>
            </div>
            <p className="text-gray-300">
              Smart contracts audited by Trail of Bits. Bug bounty: $100K for critical vulnerabilities.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Simple, Transparent Pricing</h2>
          <p className="text-xl text-gray-400 mb-12">
            Pay per transaction. No setup fees. No monthly fees.
          </p>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12">
            <div className="flex items-center justify-center gap-4 mb-6">
              <TrendingUp className="w-16 h-16 text-green-400" />
              <div className="text-6xl font-bold">0.33%</div>
            </div>
            <p className="text-2xl text-gray-300 mb-8">
              That's 33 basis points per transaction
            </p>

            <div className="overflow-x-auto mb-8">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="pb-3 text-gray-400">Transaction Size</th>
                    <th className="pb-3 text-gray-400">Fee (33bps)</th>
                    <th className="pb-3 text-gray-400">vs Credit Card (2.9%)</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-gray-800">
                    <td className="py-3">$10,000</td>
                    <td className="py-3 font-semibold text-green-400">$33</td>
                    <td className="py-3 text-gray-500">$290</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3">$100,000</td>
                    <td className="py-3 font-semibold text-green-400">$330</td>
                    <td className="py-3 text-gray-500">$2,900</td>
                  </tr>
                  <tr>
                    <td className="py-3">$1,000,000</td>
                    <td className="py-3 font-semibold text-green-400">$3,300</td>
                    <td className="py-3 text-gray-500">$29,000</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-sm text-gray-400">
              Enterprise volume discounts available. Contact us for custom pricing.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-green-500 to-blue-500 rounded-2xl p-12">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Build?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Get your API key and start integrating in minutes.
          </p>
          <Link
            href="/grain/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-900 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all hover:scale-105"
          >
            Get API Key
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-900/50">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500" />
                <span className="text-xl font-bold">Grain & Vault</span>
              </div>
              <p className="text-gray-400 text-sm">
                Blockchain payment infrastructure for B2B commerce
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="#features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="#api" className="hover:text-white transition-colors">API</Link></li>
                <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Developers</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/docs/quickstart" className="hover:text-white transition-colors">Quick Start</Link></li>
                <li><Link href="/docs/sdk" className="hover:text-white transition-colors">SDK Reference</Link></li>
                <li><Link href="/docs/api" className="hover:text-white transition-colors">API Reference</Link></li>
                <li><Link href="https://github.com/grainvault" className="hover:text-white transition-colors">GitHub</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link href="https://wellsai.com" className="hover:text-white transition-colors">Wells AI</Link></li>
                <li><Link href="/security" className="hover:text-white transition-colors">Security</Link></li>
                <li><Link href="/audits" className="hover:text-white transition-colors">Audits</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>© 2025 Wells Onyx. All rights reserved. Built on Base L2.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
