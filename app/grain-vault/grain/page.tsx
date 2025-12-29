'use client'

/**
 * Grain Product Page
 * Stablecoin infrastructure
 */

import Link from 'next/link'
import {
  Coins,
  ArrowRight,
  Shield,
  Zap,
  Globe,
  CheckCircle,
  Building2,
  RefreshCw,
  Lock,
  FileCheck
} from 'lucide-react'

const FEATURES = [
  {
    icon: Zap,
    title: 'Instant Issuance',
    description: 'Issue stablecoins in seconds, not days. API-first design for seamless integration.'
  },
  {
    icon: Shield,
    title: 'Fully Backed',
    description: 'Every token is 100% backed by audited reserves. Real-time proof of reserves.'
  },
  {
    icon: Globe,
    title: 'Multi-Chain',
    description: 'Deploy on Ethereum, Polygon, Solana, and more. Native cross-chain bridges.'
  },
  {
    icon: Lock,
    title: 'Compliance Built-In',
    description: 'KYC/AML, sanctions screening, and regulatory reporting included by default.'
  },
  {
    icon: RefreshCw,
    title: 'Instant Redemption',
    description: 'Redeem to fiat instantly. No waiting periods. Automatic off-ramp to your bank.'
  },
  {
    icon: FileCheck,
    title: 'Audit Ready',
    description: 'Complete transaction history, immutable records, and third-party attestations.'
  }
]

const INTEGRATIONS = [
  { name: 'Circle USDC', logo: '○' },
  { name: 'Ethereum', logo: '◇' },
  { name: 'Polygon', logo: '⬡' },
  { name: 'Solana', logo: '◎' },
  { name: 'Arbitrum', logo: '△' },
  { name: 'Base', logo: '▣' }
]

export default function GrainPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white font-sans antialiased">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');
        .font-space { font-family: 'Space Grotesk', sans-serif; }

        .glass-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
      `}</style>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#0a0f1a]/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/grain-vault" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-emerald-400 rounded-lg flex items-center justify-center">
              <Coins className="w-4 h-4 text-[#0a0f1a]" />
            </div>
            <span className="font-space font-semibold text-lg">Grain & Vault</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/grain-vault/grain" className="text-sm text-amber-400 font-medium">
              Grain
            </Link>
            <Link href="/grain-vault/vault" className="text-sm text-white/70 hover:text-white transition-colors">
              Vault
            </Link>
            <Link href="/grain-vault/docs" className="text-sm text-white/70 hover:text-white transition-colors">
              Docs
            </Link>
          </div>
          <Link
            href="/grain-vault/waitlist"
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-emerald-500 text-[#0a0f1a] text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            Get Access
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[100px]"></div>
        </div>

        <div className="max-w-[1200px] mx-auto px-6 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 rounded-full text-xs font-medium text-amber-300 mb-6">
              <Coins className="w-3.5 h-3.5" />
              Stablecoin Infrastructure
            </div>
            <h1 className="font-space text-[clamp(40px,5vw,64px)] font-bold leading-[1.1] mb-6">
              <span className="text-amber-400">Grain</span>
              <br />
              <span className="text-white">Issue Stablecoins at Scale</span>
            </h1>
            <p className="text-xl text-white/60 mb-10 leading-relaxed max-w-2xl">
              Enterprise-grade stablecoin issuance with built-in compliance.
              Issue, manage, and redeem digital dollars programmatically.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <Link
                href="/grain-vault/waitlist"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-amber-500 text-[#0a0f1a] font-semibold rounded-xl hover:bg-amber-400 transition-all"
              >
                Get Started
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/grain-vault/docs"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-white/5 border border-white/10 text-white font-medium rounded-xl hover:bg-white/10 transition-all"
              >
                API Reference
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-space text-4xl font-bold text-white mb-4">
              Everything You Need
            </h2>
            <p className="text-lg text-white/50">
              Full-featured stablecoin infrastructure, ready for production.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <div key={i} className="glass-card rounded-2xl p-6">
                <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-white/[0.02]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-space text-4xl font-bold text-white mb-4">How Grain Works</h2>
            <p className="text-lg text-white/50">Three simple steps to digital dollar issuance.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-amber-400">1</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Deposit Fiat</h3>
              <p className="text-white/50">
                Send USD via wire transfer. Funds clear same-day for verified accounts.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-amber-400">2</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Mint Tokens</h3>
              <p className="text-white/50">
                Call our API to mint stablecoins. Tokens appear in your wallet instantly.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-amber-400">3</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Transfer & Redeem</h3>
              <p className="text-white/50">
                Move tokens anywhere on-chain. Redeem to fiat anytime with instant settlement.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-24">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <h2 className="font-space text-2xl font-bold text-white mb-8">Supported Networks</h2>
          <div className="flex items-center justify-center gap-8 flex-wrap">
            {INTEGRATIONS.map((integration, i) => (
              <div key={i} className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors">
                <span className="text-2xl">{integration.logo}</span>
                <span className="text-sm font-medium">{integration.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="glass-card rounded-3xl p-12 text-center">
            <h2 className="font-space text-3xl font-bold text-white mb-4">
              Ready to Issue Your First Stablecoin?
            </h2>
            <p className="text-white/50 mb-8 max-w-lg mx-auto">
              Join the waitlist for early access to Grain. We're onboarding select enterprises now.
            </p>
            <Link
              href="/grain-vault/waitlist"
              className="inline-flex items-center gap-2 px-8 py-4 bg-amber-500 text-[#0a0f1a] font-semibold rounded-xl hover:bg-amber-400 transition-all"
            >
              Join Waitlist
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <Link href="/grain-vault" className="inline-flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-emerald-400 rounded-lg flex items-center justify-center">
              <Coins className="w-4 h-4 text-[#0a0f1a]" />
            </div>
            <span className="font-space font-semibold">Grain & Vault</span>
          </Link>
          <p className="text-sm text-white/30">
            © 2025 Wells Onyx. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
