'use client'

/**
 * Vault Product Page
 * Treasury management and custody
 */

import Link from 'next/link'
import {
  Coins,
  ArrowRight,
  Shield,
  TrendingUp,
  BarChart3,
  Lock,
  Eye,
  RefreshCw,
  Wallet,
  PieChart
} from 'lucide-react'

const FEATURES = [
  {
    icon: Shield,
    title: 'Institutional Custody',
    description: 'Multi-sig security with hardware security modules. SOC 2 Type II certified.'
  },
  {
    icon: TrendingUp,
    title: 'Yield Optimization',
    description: 'Earn competitive yields on idle treasury. Risk-adjusted strategies with full transparency.'
  },
  {
    icon: BarChart3,
    title: 'Real-Time Analytics',
    description: 'Live dashboards showing holdings, yields, and exposure across all assets and chains.'
  },
  {
    icon: Eye,
    title: 'Full Transparency',
    description: 'Complete audit trail for every transaction. On-chain proof of reserves.'
  },
  {
    icon: RefreshCw,
    title: 'Instant Liquidity',
    description: 'Access your funds anytime. No lock-ups or withdrawal delays.'
  },
  {
    icon: Lock,
    title: 'Policy Controls',
    description: 'Granular access controls, spending limits, and approval workflows.'
  }
]

const YIELD_TIERS = [
  { range: '$0 - $1M', apy: '4.5%', features: ['Basic custody', 'Standard yield', 'Email support'] },
  { range: '$1M - $10M', apy: '5.2%', features: ['Priority custody', 'Enhanced yield', 'Dedicated support'] },
  { range: '$10M+', apy: 'Custom', features: ['White-glove service', 'Custom strategies', 'Direct line to team'] }
]

export default function VaultPage() {
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
            <Link href="/grain-vault/grain" className="text-sm text-white/70 hover:text-white transition-colors">
              Grain
            </Link>
            <Link href="/grain-vault/vault" className="text-sm text-emerald-400 font-medium">
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
          <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[100px]"></div>
        </div>

        <div className="max-w-[1200px] mx-auto px-6 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 rounded-full text-xs font-medium text-emerald-300 mb-6">
              <Shield className="w-3.5 h-3.5" />
              Treasury Management
            </div>
            <h1 className="font-space text-[clamp(40px,5vw,64px)] font-bold leading-[1.1] mb-6">
              <span className="text-emerald-400">Vault</span>
              <br />
              <span className="text-white">Secure Treasury, Optimized Yield</span>
            </h1>
            <p className="text-xl text-white/60 mb-10 leading-relaxed max-w-2xl">
              Institutional-grade custody meets DeFi yields. Manage your treasury across
              multiple chains with complete security and transparency.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <Link
                href="/grain-vault/waitlist"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-emerald-500 text-[#0a0f1a] font-semibold rounded-xl hover:bg-emerald-400 transition-all"
              >
                Get Started
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/grain-vault/security"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-white/5 border border-white/10 text-white font-medium rounded-xl hover:bg-white/10 transition-all"
              >
                Security Details
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="py-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="glass-card rounded-3xl p-8">
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white/5 rounded-2xl p-5">
                <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
                  <Wallet className="w-4 h-4" />
                  Total Balance
                </div>
                <div className="text-3xl font-bold text-white">$12.4M</div>
                <div className="text-emerald-400 text-sm mt-1">+2.3% this month</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-5">
                <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
                  <TrendingUp className="w-4 h-4" />
                  Current APY
                </div>
                <div className="text-3xl font-bold text-emerald-400">5.2%</div>
                <div className="text-white/40 text-sm mt-1">Blended rate</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-5">
                <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
                  <BarChart3 className="w-4 h-4" />
                  30d Earnings
                </div>
                <div className="text-3xl font-bold text-white">$53.2K</div>
                <div className="text-white/40 text-sm mt-1">Yield earned</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-5">
                <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
                  <PieChart className="w-4 h-4" />
                  Assets
                </div>
                <div className="text-3xl font-bold text-white">4</div>
                <div className="text-white/40 text-sm mt-1">Across 3 chains</div>
              </div>
            </div>
            <div className="text-center text-white/40 text-sm">
              Live dashboard preview • Your actual data will appear here
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-space text-4xl font-bold text-white mb-4">
              Enterprise-Grade Treasury
            </h2>
            <p className="text-lg text-white/50">
              Security, yield, and visibility — all in one platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <div key={i} className="glass-card rounded-2xl p-6">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Yield Tiers */}
      <section className="py-24 bg-white/[0.02]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-space text-4xl font-bold text-white mb-4">Yield Tiers</h2>
            <p className="text-lg text-white/50">Higher balances unlock better rates and dedicated support.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {YIELD_TIERS.map((tier, i) => (
              <div key={i} className={`glass-card rounded-2xl p-8 ${i === 1 ? 'ring-2 ring-emerald-500/50' : ''}`}>
                {i === 1 && (
                  <div className="text-center mb-4">
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-medium rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="text-center mb-6">
                  <div className="text-white/50 text-sm mb-1">Balance</div>
                  <div className="text-xl font-semibold text-white">{tier.range}</div>
                </div>
                <div className="text-center mb-6">
                  <div className="text-4xl font-bold text-emerald-400">{tier.apy}</div>
                  <div className="text-white/40 text-sm">APY</div>
                </div>
                <ul className="space-y-3">
                  {tier.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-white/60 text-sm">
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="glass-card rounded-3xl p-12">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex px-3 py-1 bg-emerald-500/20 rounded-full text-xs font-medium text-emerald-300 mb-4">
                  Security First
                </div>
                <h2 className="font-space text-3xl font-bold text-white mb-4">
                  Your Assets Are Safe
                </h2>
                <p className="text-white/60 mb-6 leading-relaxed">
                  Vault is built on battle-tested infrastructure. Multi-sig custody,
                  insurance coverage, and 24/7 monitoring keep your treasury secure.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-white">$100M+</div>
                    <div className="text-white/40 text-sm">Insurance Coverage</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-white">SOC 2</div>
                    <div className="text-white/40 text-sm">Type II Certified</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="w-48 h-48 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 rounded-full flex items-center justify-center">
                  <Shield className="w-24 h-24 text-emerald-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <h2 className="font-space text-4xl font-bold text-white mb-4">
            Start Earning on Your Treasury
          </h2>
          <p className="text-lg text-white/50 mb-10 max-w-xl mx-auto">
            Join the waitlist to get early access to Vault. Minimum deposit: $100K.
          </p>
          <Link
            href="/grain-vault/waitlist"
            className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 text-[#0a0f1a] font-semibold rounded-xl hover:bg-emerald-400 transition-all text-lg"
          >
            Join Waitlist
            <ArrowRight className="w-5 h-5" />
          </Link>
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
