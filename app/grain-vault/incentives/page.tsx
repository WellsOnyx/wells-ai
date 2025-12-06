'use client'

/**
 * Grain & Vault Incentives Page
 * grainandvault.com/incentives
 *
 * Showcases GRAIN rewards, referral program, and appreciation mechanics
 */

import Link from 'next/link'
import {
  Sparkles,
  TrendingUp,
  Users,
  Gift,
  ArrowRight,
  CheckCircle,
  Star,
  Zap,
  Shield,
  Clock,
  DollarSign,
  Coins,
  Trophy,
  Wallet,
  BarChart3,
  ChevronRight,
  ExternalLink
} from 'lucide-react'

export default function IncentivesPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                  <div className="w-4 h-4 bg-black rounded-sm" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-sm" />
              </div>
              <span className="text-lg font-semibold tracking-tight">Grain & Vault</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link href="/#products" className="text-sm text-gray-400 hover:text-white transition-colors">
                Products
              </Link>
              <Link href="/#treasury-sdk" className="text-sm text-gray-400 hover:text-white transition-colors">
                Treasury SDK
              </Link>
              <Link href="/incentives" className="text-sm text-green-400 font-medium">
                Rewards
              </Link>
              <Link href="/enterprise" className="text-sm text-gray-400 hover:text-white transition-colors">
                Enterprise
              </Link>
              <div className="flex items-center gap-3 ml-4">
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
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 via-black to-black" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-8">
              <Gift className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-400 font-medium">Rewards Program</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="text-white">Earn while you</span>
              <br />
              <span className="bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 bg-clip-text text-transparent">
                hold & transact
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-gray-400 mb-12 leading-relaxed max-w-3xl mx-auto">
              GRAIN appreciates over time. Refer others and earn bonus GRAIN.
              Early adopters get exclusive rewards.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link
                href="/signup"
                className="group px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black rounded-xl font-semibold text-lg transition-all hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/50 flex items-center gap-2"
              >
                Start Earning
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="#how-it-works"
                className="group px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-xl font-semibold text-lg transition-all flex items-center gap-2"
              >
                <BarChart3 className="w-5 h-5" />
                How It Works
              </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-amber-400 mb-1">3.2%</div>
                <div className="text-sm text-gray-400">Avg. Monthly Growth</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-green-400 mb-1">1,000</div>
                <div className="text-sm text-gray-400">Referral Bonus GRAIN</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-blue-400 mb-1">5%</div>
                <div className="text-sm text-gray-400">Early Adopter Bonus</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-purple-400 mb-1">0</div>
                <div className="text-sm text-gray-400">Hidden Fees</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* GRAIN Appreciation Section */}
      <section id="how-it-works" className="py-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">GRAIN Appreciation</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Unlike traditional stablecoins, GRAIN is designed to appreciate over time.
              Your value grows while you hold.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: How it works */}
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">100% Collateralized Foundation</h3>
                  <p className="text-gray-400">
                    Every GRAIN starts backed 1:1 by USDC. This is your floor - value never drops below this.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Float Appreciation</h3>
                  <p className="text-gray-400">
                    Transaction fees and float reserves are added to the asset pool. As the pool grows,
                    GRAIN value increases for all holders.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Price Protection</h3>
                  <p className="text-gray-400">
                    If manipulation is detected, GRAIN automatically freezes at the previous high.
                    After audit, it resets higher. Your value is always protected.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Compound Growth</h3>
                  <p className="text-gray-400">
                    The more the network is used, the more value accumulates. Early adopters benefit most
                    from network growth.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Visual */}
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-green-500 rounded-2xl blur opacity-20" />
              <div className="relative bg-gradient-to-br from-amber-500/10 to-green-500/10 border border-amber-500/20 rounded-2xl p-8">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-lg font-bold">GRAIN Value Over Time</h4>
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>

                {/* Simulated chart */}
                <div className="h-48 flex items-end gap-2 mb-6">
                  {[1.0, 1.02, 1.03, 1.05, 1.08, 1.10, 1.12, 1.15, 1.18, 1.20, 1.22, 1.25].map((value, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-gradient-to-t from-amber-500 to-green-400 rounded-t"
                        style={{ height: `${(value - 0.9) * 300}%` }}
                      />
                      {i % 3 === 0 && (
                        <span className="text-[10px] text-gray-500">M{i + 1}</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-black/30 rounded-lg">
                    <div className="text-lg font-bold text-white">$1.00</div>
                    <div className="text-xs text-gray-500">Starting Value</div>
                  </div>
                  <div className="p-3 bg-black/30 rounded-lg">
                    <div className="text-lg font-bold text-green-400">$1.25</div>
                    <div className="text-xs text-gray-500">Year 1 (Est.)</div>
                  </div>
                  <div className="p-3 bg-black/30 rounded-lg">
                    <div className="text-lg font-bold text-amber-400">+25%</div>
                    <div className="text-xs text-gray-500">Appreciation</div>
                  </div>
                </div>

                <p className="mt-4 text-xs text-gray-500 text-center">
                  * Appreciation rates vary based on network activity. Past performance does not guarantee future results.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Referral Program Section */}
      <section className="py-24 px-6 lg:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
              <Users className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400 font-medium">Referral Program</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Refer & Earn</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Grow the network and earn GRAIN. Both you and your referral get rewarded.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 mb-16">
            {/* Tier 1 */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity" />
              <div className="relative bg-gradient-to-br from-[#0a0f0a] to-black border border-green-500/20 rounded-2xl p-8 hover:border-green-500/40 transition-all h-full">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mb-6">
                  <Star className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Starter</h3>
                <div className="text-4xl font-bold text-green-400 mb-4">500 GRAIN</div>
                <p className="text-gray-400 mb-6">Per successful referral</p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    First 5 referrals
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Referral gets 250 GRAIN
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Instant credit to wallet
                  </li>
                </ul>
              </div>
            </div>

            {/* Tier 2 */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity" />
              <div className="relative bg-gradient-to-br from-[#0f0a05] to-black border border-amber-500/20 rounded-2xl p-8 hover:border-amber-500/40 transition-all h-full">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-amber-400" />
                  </div>
                  <span className="px-3 py-1 bg-amber-500/20 rounded-full text-xs text-amber-400 font-medium">Popular</span>
                </div>
                <h3 className="text-2xl font-bold mb-2">Growth</h3>
                <div className="text-4xl font-bold text-amber-400 mb-4">1,000 GRAIN</div>
                <p className="text-gray-400 mb-6">Per successful referral</p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-amber-500" />
                    Referrals 6-25
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-amber-500" />
                    Referral gets 500 GRAIN
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-amber-500" />
                    Priority support access
                  </li>
                </ul>
              </div>
            </div>

            {/* Tier 3 */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity" />
              <div className="relative bg-gradient-to-br from-[#0a050f] to-black border border-purple-500/20 rounded-2xl p-8 hover:border-purple-500/40 transition-all h-full">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-6">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Ambassador</h3>
                <div className="text-4xl font-bold text-purple-400 mb-4">2,500 GRAIN</div>
                <p className="text-gray-400 mb-6">Per successful referral</p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-purple-500" />
                    26+ referrals
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-purple-500" />
                    Referral gets 1,000 GRAIN
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-purple-500" />
                    Ambassador badge + perks
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* How to refer */}
          <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-8 md:p-12">
            <h3 className="text-2xl font-bold mb-8 text-center">How to Refer</h3>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-green-400">1</span>
                </div>
                <h4 className="font-semibold mb-2">Get Your Link</h4>
                <p className="text-sm text-gray-400">
                  Find your unique referral link in your dashboard
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-amber-400">2</span>
                </div>
                <h4 className="font-semibold mb-2">Share It</h4>
                <p className="text-sm text-gray-400">
                  Send to friends, colleagues, or your network
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-purple-400">3</span>
                </div>
                <h4 className="font-semibold mb-2">Earn GRAIN</h4>
                <p className="text-sm text-gray-400">
                  Get credited instantly when they sign up
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Early Adopter Bonus */}
      <section className="py-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 rounded-3xl blur opacity-20" />
            <div className="relative bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-red-500/10 border border-amber-500/30 rounded-3xl p-8 md:p-16 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/30 mb-6">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-amber-400 font-medium">Limited Time</span>
              </div>

              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Early Adopter Bonus
              </h2>
              <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
                Sign up now and get 5% bonus GRAIN on your first deposit.
                Available for the first 10,000 accounts.
              </p>

              <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-10">
                <div className="p-4 bg-black/30 rounded-xl">
                  <div className="text-3xl font-bold text-amber-400">5%</div>
                  <div className="text-sm text-gray-400">Deposit Bonus</div>
                </div>
                <div className="p-4 bg-black/30 rounded-xl">
                  <div className="text-3xl font-bold text-green-400">$50K</div>
                  <div className="text-sm text-gray-400">Max Bonus Cap</div>
                </div>
                <div className="p-4 bg-black/30 rounded-xl">
                  <div className="text-3xl font-bold text-purple-400">7,234</div>
                  <div className="text-sm text-gray-400">Spots Remaining</div>
                </div>
              </div>

              <Link
                href="/signup"
                className="group inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black rounded-xl font-semibold text-lg transition-all hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/50"
              >
                Claim Your Bonus
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Transaction Rewards */}
      <section className="py-24 px-6 lg:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Transaction Rewards</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              The more you transact, the more you earn. Every payment builds your rewards balance.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Coins className="w-7 h-7 text-green-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Payment Rewards</h3>
                  <p className="text-sm text-gray-400">Earn on every transaction</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                  <span className="text-gray-300">Standard Payments</span>
                  <span className="text-green-400 font-semibold">0.1% back</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                  <span className="text-gray-300">Large Payments ($10K+)</span>
                  <span className="text-green-400 font-semibold">0.15% back</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                  <span className="text-gray-300">Enterprise Payments ($100K+)</span>
                  <span className="text-green-400 font-semibold">0.2% back</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Wallet className="w-7 h-7 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Balance Rewards</h3>
                  <p className="text-sm text-gray-400">Earn on holdings</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                  <span className="text-gray-300">Hold $10K+ for 30 days</span>
                  <span className="text-blue-400 font-semibold">100 GRAIN</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                  <span className="text-gray-300">Hold $100K+ for 30 days</span>
                  <span className="text-blue-400 font-semibold">1,000 GRAIN</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                  <span className="text-gray-300">Hold $1M+ for 30 days</span>
                  <span className="text-blue-400 font-semibold">10,000 GRAIN</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-green-500/10 to-purple-500/10" />

        <div className="relative max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Start earning today
          </h2>

          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
            Open your Grain & Vault account and start earning GRAIN through
            appreciation, referrals, and transaction rewards.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="group px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black rounded-xl font-semibold text-lg transition-all hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/50 flex items-center gap-2"
            >
              Open Free Account
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/#treasury-sdk"
              className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-xl font-semibold text-lg transition-all flex items-center gap-2"
            >
              Enterprise Options
              <ExternalLink className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                  <div className="w-3 h-3 bg-black rounded-sm" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-sm" />
              </div>
              <span className="text-sm text-gray-400">
                © 2025 Grain & Vault. A{' '}
                <Link href="https://wellsonyx.io" className="text-amber-400 hover:text-amber-300">
                  Wells Onyx
                </Link>
                {' '}company.
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/privacy" className="text-gray-500 hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="text-gray-500 hover:text-white transition-colors">Terms</Link>
              <Link href="mailto:support@grainandvault.com" className="text-gray-500 hover:text-white transition-colors">Support</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
