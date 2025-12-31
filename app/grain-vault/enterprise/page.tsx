'use client'

/**
 * Grain & Vault Enterprise Partnership Page
 * grainandvault.com/enterprise
 *
 * Enterprise features, volume pricing, and partnership opportunities
 */

import Link from 'next/link'
import {
  Building2,
  Shield,
  Zap,
  Code,
  ArrowRight,
  CheckCircle,
  Globe,
  Lock,
  Users,
  BarChart3,
  Settings,
  Headphones,
  FileCheck,
  TrendingUp,
  DollarSign,
  Clock,
  Server,
  Wallet,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  CreditCard
} from 'lucide-react'

export default function EnterprisePage() {
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
              <Link href="/incentives" className="text-sm text-gray-400 hover:text-white transition-colors">
                Rewards
              </Link>
              <Link href="/enterprise" className="text-sm text-purple-400 font-medium">
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
        <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 via-black to-black" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 mb-8">
              <Building2 className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-400 font-medium">Enterprise Solutions</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="text-white">Deposit your predictable spend.</span>
              <br />
              <span className="bg-gradient-to-r from-green-400 via-emerald-500 to-cyan-500 bg-clip-text text-transparent">
                100% protected. 0% interest.
              </span>
            </h1>

            {/* The Killer Value Prop */}
            <div className="grid md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-8">
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                <div className="text-2xl font-bold text-white">100%</div>
                <div className="text-sm text-green-400">Protected Deposit</div>
              </div>
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                <div className="text-2xl font-bold text-white">0%</div>
                <div className="text-sm text-blue-400">Interest Rate</div>
              </div>
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <div className="text-2xl font-bold text-white">1%</div>
                <div className="text-sm text-purple-400">Sourcing Fee (COGS)</div>
              </div>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <div className="text-2xl font-bold text-white">4.5%+</div>
                <div className="text-sm text-amber-400">Annual Appreciation</div>
              </div>
            </div>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-gray-400 mb-12 leading-relaxed max-w-3xl mx-auto">
              The Credit Line Model: Your deposit stays protected. Get a 1:1 GRAIN credit line.
              Pay suppliers with GRAIN. Your purchasing power appreciates over time.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <a
                href="mailto:enterprise@grainandvault.com?subject=Enterprise Inquiry&body=I'd like to learn more about Grain %26 Vault enterprise solutions.%0A%0ACompany:%0AExpected Monthly Volume:%0APrimary Use Case:"
                className="group px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-xl font-semibold text-lg transition-all hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50 flex items-center gap-2"
              >
                Contact Sales
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <Link
                href="#features"
                className="group px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-xl font-semibold text-lg transition-all flex items-center gap-2"
              >
                <FileCheck className="w-5 h-5" />
                View Features
              </Link>
            </div>

            {/* Trust Logos */}
            <div className="flex items-center justify-center gap-8 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-purple-500" />
                <span>SOC 2 Type II</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-purple-500" />
                <span>GDPR Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-purple-500" />
                <span>99.99% Uptime SLA</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Credit Line Model Explainer */}
      <section className="py-24 px-6 lg:px-8 bg-gradient-to-b from-black to-black/95">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">The Credit Line Model</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Unlike banks, we don't lend out your money. Your deposit stays protected
              while you get a 0% interest credit line to pay suppliers.
            </p>
          </div>

          {/* Three Layer Visual */}
          <div className="max-w-4xl mx-auto mb-16">
            {/* Layer 3: Appreciation (Top) */}
            <div className="p-6 rounded-t-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30 border-b-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/30 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-purple-400 font-medium">LAYER 3: APPRECIATION</p>
                    <p className="text-lg text-white font-semibold">Bonus GRAIN from ecosystem growth</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-purple-400">+4.5%</p>
                  <p className="text-sm text-gray-400">annual appreciation</p>
                </div>
              </div>
            </div>

            {/* Layer 2: Credit Line (Middle) */}
            <div className="p-6 bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-x border-blue-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/30 flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-blue-400 font-medium">LAYER 2: CREDIT LINE</p>
                    <p className="text-lg text-white font-semibold">1:1 GRAIN credit at deposit price</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-400">0%</p>
                  <p className="text-sm text-gray-400">interest forever</p>
                </div>
              </div>
            </div>

            {/* Layer 1: Protected Deposit (Bottom) */}
            <div className="p-6 rounded-b-2xl bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30 border-t-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500/30 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-green-400 font-medium">LAYER 1: PROTECTED DEPOSIT</p>
                    <p className="text-lg text-white font-semibold">Your cash, always available</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-400">100%</p>
                  <p className="text-sm text-gray-400">protected</p>
                </div>
              </div>
            </div>
          </div>

          {/* Example Flow */}
          <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="text-4xl font-bold text-green-400 mb-2">1</div>
              <h3 className="text-lg font-semibold mb-2">Deposit $1M</h3>
              <p className="text-sm text-gray-400">
                Your $1M is 100% protected in the vault. Get 100,000 GRAIN credit line at $10/GRAIN.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="text-4xl font-bold text-blue-400 mb-2">2</div>
              <h3 className="text-lg font-semibold mb-2">Pay Suppliers</h3>
              <p className="text-sm text-gray-400">
                Spend your GRAIN credit line to pay suppliers. 0% interest. 0% transaction fees.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="text-4xl font-bold text-purple-400 mb-2">3</div>
              <h3 className="text-lg font-semibold mb-2">Earn Appreciation</h3>
              <p className="text-sm text-gray-400">
                GRAIN appreciates 4.5%+ annually. Your purchasing power grows while your deposit stays protected.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Features Section */}
      <section id="features" className="py-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Enterprise-Grade Features</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Everything you need to run treasury operations at scale,
              with the security and compliance your organization requires.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white/5 border border-white/10 rounded-xl p-6 hover:border-purple-500/30 transition-all h-full">
                <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-4">
                  <Code className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-lg font-bold mb-2">Custom SDK Integration</h3>
                <p className="text-gray-400 text-sm">
                  White-glove integration support for SAP, Oracle, NetSuite, and any ERP system.
                  Dedicated engineering resources.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white/5 border border-white/10 rounded-xl p-6 hover:border-blue-500/30 transition-all h-full">
                <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-4">
                  <Lock className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-bold mb-2">Advanced Security</h3>
                <p className="text-gray-400 text-sm">
                  SSO/SAML integration, role-based access control, audit logging,
                  and custom security policies.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white/5 border border-white/10 rounded-xl p-6 hover:border-green-500/30 transition-all h-full">
                <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center mb-4">
                  <Headphones className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-lg font-bold mb-2">Dedicated Support</h3>
                <p className="text-gray-400 text-sm">
                  24/7 dedicated support team, named account manager,
                  quarterly business reviews.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white/5 border border-white/10 rounded-xl p-6 hover:border-amber-500/30 transition-all h-full">
                <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center mb-4">
                  <DollarSign className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-lg font-bold mb-2">Volume Pricing</h3>
                <p className="text-gray-400 text-sm">
                  Custom pricing based on volume. Significant discounts
                  for high-volume treasury operations.
                </p>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 to-pink-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white/5 border border-white/10 rounded-xl p-6 hover:border-red-500/30 transition-all h-full">
                <div className="w-12 h-12 rounded-lg bg-red-500/20 flex items-center justify-center mb-4">
                  <Globe className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-lg font-bold mb-2">Global Operations</h3>
                <p className="text-gray-400 text-sm">
                  Multi-region deployment, local compliance support,
                  and cross-border payment optimization.
                </p>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white/5 border border-white/10 rounded-xl p-6 hover:border-cyan-500/30 transition-all h-full">
                <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-lg font-bold mb-2">Advanced Analytics</h3>
                <p className="text-gray-400 text-sm">
                  Real-time treasury dashboards, custom reporting,
                  and predictive cash flow analytics.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Tiers */}
      <section className="py-24 px-6 lg:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Enterprise Plans</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Flexible pricing designed for organizations of all sizes.
              All plans include core GRAIN and VAULT features.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Growth Plan */}
            <div className="relative">
              <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-8 h-full">
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-2">Growth</h3>
                  <p className="text-sm text-gray-400">For growing companies</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold">$2,500</span>
                  <span className="text-gray-400">/month</span>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">Up to $10M monthly volume</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">Standard SDK integration</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">Business hours support</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">99.9% uptime SLA</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">10 team members</span>
                  </li>
                </ul>
                <Link
                  href="/signup?plan=growth"
                  className="block w-full py-3 text-center bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl font-medium transition-all"
                >
                  Get Started
                </Link>
              </div>
            </div>

            {/* Scale Plan */}
            <div className="relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl blur opacity-30" />
              <div className="relative bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl p-8 h-full">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold mb-2">Scale</h3>
                    <p className="text-sm text-gray-400">For large organizations</p>
                  </div>
                  <span className="px-3 py-1 bg-purple-500/20 rounded-full text-xs text-purple-400 font-medium">Popular</span>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold">$10,000</span>
                  <span className="text-gray-400">/month</span>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">Up to $100M monthly volume</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">Custom SDK integration</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">24/7 priority support</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">99.95% uptime SLA</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">SSO/SAML integration</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">Unlimited team members</span>
                  </li>
                </ul>
                <a
                  href="mailto:enterprise@grainandvault.com?subject=Scale Plan Inquiry"
                  className="block w-full py-3 text-center bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 rounded-xl font-medium transition-all"
                >
                  Contact Sales
                </a>
              </div>
            </div>

            {/* Enterprise Plan */}
            <div className="relative">
              <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-8 h-full">
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-2">Enterprise</h3>
                  <p className="text-sm text-gray-400">For Fortune 500</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold">Custom</span>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">Unlimited volume</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">White-glove integration</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">Dedicated account team</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">99.99% uptime SLA</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">Custom compliance</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">On-premise deployment option</span>
                  </li>
                </ul>
                <a
                  href="mailto:enterprise@grainandvault.com?subject=Enterprise Plan Inquiry"
                  className="block w-full py-3 text-center bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl font-medium transition-all"
                >
                  Contact Sales
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integration Partners */}
      <section className="py-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Seamless ERP Integration</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Native adapters for every major enterprise system.
              Your treasury, connected to your existing infrastructure.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {['SAP', 'Oracle', 'NetSuite', 'Dynamics 365', 'Workday', 'Coupa'].map((erp) => (
              <div
                key={erp}
                className="p-6 bg-white/5 border border-white/10 rounded-xl text-center hover:border-purple-500/30 transition-all"
              >
                <div className="text-lg font-semibold">{erp}</div>
                <div className="text-xs text-green-400 mt-1">SDK Ready</div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-400 mb-4">
              Don't see your ERP? We build custom integrations.
            </p>
            <a
              href="mailto:sdk@grainandvault.com?subject=Custom ERP Integration"
              className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-medium"
            >
              Request Custom Integration
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Security & Compliance */}
      <section className="py-24 px-6 lg:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Enterprise Security</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Built for the most demanding compliance requirements.
              Your data is protected at every layer.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-xl bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="font-semibold mb-2">SOC 2 Type II</h3>
              <p className="text-sm text-gray-400">Audited security controls</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-xl bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="font-semibold mb-2">GDPR Compliant</h3>
              <p className="text-sm text-gray-400">European data protection</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-xl bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <Server className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="font-semibold mb-2">On-Premise Option</h3>
              <p className="text-sm text-gray-400">Deploy in your infrastructure</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-xl bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <FileCheck className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="font-semibold mb-2">Custom Compliance</h3>
              <p className="text-sm text-gray-400">Industry-specific standards</p>
            </div>
          </div>
        </div>
      </section>

      {/* Partnership Program */}
      <section className="py-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 rounded-3xl blur opacity-20" />
            <div className="relative bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-amber-500/10 border border-purple-500/30 rounded-3xl p-8 md:p-16">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span className="text-sm text-amber-400 font-medium">Partner Program</span>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold mb-6">
                    Become a Partner
                  </h2>
                  <p className="text-gray-400 mb-8 leading-relaxed">
                    Join our partner ecosystem. System integrators, consultants, and
                    technology partners can earn recurring revenue by bringing
                    Grain & Vault to their clients.
                  </p>
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-amber-500" />
                      <span className="text-gray-300">Revenue share on referrals</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-amber-500" />
                      <span className="text-gray-300">Co-marketing opportunities</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-amber-500" />
                      <span className="text-gray-300">Technical training & certification</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-amber-500" />
                      <span className="text-gray-300">Deal registration protection</span>
                    </li>
                  </ul>
                  <a
                    href="mailto:partners@grainandvault.com?subject=Partnership Inquiry"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black rounded-xl font-semibold transition-all"
                  >
                    Apply to Partner
                    <ArrowRight className="w-5 h-5" />
                  </a>
                </div>

                <div className="space-y-4">
                  <div className="p-6 bg-black/30 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                        <Code className="w-6 h-6 text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold">System Integrators</h4>
                        <p className="text-sm text-gray-400">Implementation partners</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">
                      Deliver treasury transformation projects with our SDK.
                      Get trained, certified, and supported.
                    </p>
                  </div>

                  <div className="p-6 bg-black/30 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                        <MessageSquare className="w-6 h-6 text-green-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Consultants</h4>
                        <p className="text-sm text-gray-400">Advisory partners</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">
                      Recommend Grain & Vault to clients modernizing treasury.
                      Earn ongoing commissions.
                    </p>
                  </div>

                  <div className="p-6 bg-black/30 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                        <Settings className="w-6 h-6 text-purple-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Technology Partners</h4>
                        <p className="text-sm text-gray-400">Integration partners</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">
                      Build integrations with your platform.
                      Expand your ecosystem with treasury capabilities.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-pink-500/10" />

        <div className="relative max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Ready for enterprise treasury?
          </h2>

          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
            Talk to our enterprise team about custom solutions
            for your organization's treasury operations.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="mailto:enterprise@grainandvault.com?subject=Enterprise Demo Request"
              className="group px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-xl font-semibold text-lg transition-all hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50 flex items-center gap-2"
            >
              Schedule a Demo
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
            <Link
              href="/#treasury-sdk"
              className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-xl font-semibold text-lg transition-all flex items-center gap-2"
            >
              Explore SDK
              <ExternalLink className="w-5 h-5" />
            </Link>
          </div>

          <p className="mt-8 text-sm text-gray-500">
            Or call us: <span className="text-white">+1 (888) GRAIN-01</span>
          </p>
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
              <Link href="mailto:enterprise@grainandvault.com" className="text-gray-500 hover:text-white transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
