'use client'

/**
 * Wells Onyx Landing Page - Redesigned 2025
 * wellsonyx.io
 *
 * AI-powered B2B commerce platform
 * Just tell Wells what you need. Get it done.
 */

import Link from 'next/link'
import {
  Rocket,
  ShoppingCart,
  Store,
  Briefcase,
  ArrowRight,
  CheckCircle,
  MessageSquare,
  Zap,
  Sparkles,
  Shield,
  TrendingUp,
  Users,
  Clock,
  DollarSign,
  ChevronRight
} from 'lucide-react'

const JOURNEYS = [
  {
    icon: Rocket,
    title: 'Founder',
    tagline: '"I need to hire a CTO"',
    description: 'Tell Wells what you\'re building. Get matched with talent, suppliers, customers, and investors.',
    outcomes: [
      'Say "I need a fractional CFO" → get 3 qualified candidates',
      'Say "Source 1000 units" → get 5 supplier quotes',
      'Say "Find enterprise customers" → get warm intros'
    ],
    cta: 'Talk to Wells',
    href: '/founder/chat',
    gradient: 'from-amber-500 via-orange-500 to-red-500'
  },
  {
    icon: ShoppingCart,
    title: 'Buyer',
    tagline: '"I need industrial equipment"',
    description: 'Describe what you need. Wells writes the RFQ, finds suppliers, and handles escrow.',
    outcomes: [
      '"Need 50 motors" → RFQ sent to verified suppliers',
      'Compare quotes side-by-side in 24 hours',
      'One click to accept → money escrowed instantly'
    ],
    cta: 'Start Sourcing',
    href: '/buyer/chat',
    gradient: 'from-blue-500 via-cyan-500 to-teal-500'
  },
  {
    icon: Store,
    title: 'Seller',
    tagline: '"Send me qualified leads"',
    description: 'Register your catalog. Wells matches you with buyers. Win more business.',
    outcomes: [
      'Wake up to qualified RFQs matching your products',
      'One-tap quote submission from your phone',
      'Get paid instantly via secure escrow'
    ],
    cta: 'Join as Seller',
    href: '/suppliers/onboard',
    gradient: 'from-green-500 via-emerald-500 to-teal-500'
  },
  {
    icon: Briefcase,
    title: 'Jobs',
    tagline: '"I\'m looking for VP roles"',
    description: 'Tell Wells your ideal role. Get matched with companies actually hiring.',
    outcomes: [
      '"Looking for remote eng roles" → matched with 5 companies',
      'Direct intro to hiring managers (no HR filter)',
      'Salary negotiation guidance included'
    ],
    cta: 'Find Your Role',
    href: '/jobs/chat',
    gradient: 'from-purple-500 via-pink-500 to-rose-500'
  }
]

const TRUST_METRICS = [
  { icon: TrendingUp, value: '$2.3M+', label: 'Deals Closed' },
  { icon: Users, value: '500+', label: 'Active Users' },
  { icon: Clock, value: '< 48h', label: 'Avg. Response Time' },
  { icon: Shield, value: '1%', label: 'Simple Fee' }
]

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'Natural Language',
    description: 'Talk to Wells like you would a colleague. No forms, no templates, no complexity.'
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Matching',
    description: 'Advanced algorithms find the perfect suppliers, candidates, or customers for your needs.'
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Get matched and receive quotes within 24-48 hours. Close deals in days, not months.'
  },
  {
    icon: Shield,
    title: 'Secure Escrow',
    description: 'Built-in escrow protection ensures safe payments for both buyers and sellers.'
  }
]

export default function WellsOnyxHome() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      {/* Gradient Overlay Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(251,191,36,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(251,191,36,0.05),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,black,transparent_20%,transparent_80%,black)]" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/40 transition-all">
                  <Sparkles className="w-5 h-5 text-black" />
                </div>
                <span className="text-xl font-bold tracking-tight">WellsAI</span>
              </Link>

              <nav className="hidden md:flex items-center gap-8">
                <Link href="#journeys" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                  Journeys
                </Link>
                <Link href="#how-it-works" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                  How It Works
                </Link>
                <Link href="#pricing" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                  Pricing
                </Link>
                <Link
                  href="/sign-in"
                  className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="px-5 py-2 bg-amber-500 text-black rounded-lg font-semibold text-sm hover:bg-amber-400 transition-all hover:scale-105 hover:shadow-lg hover:shadow-amber-500/50"
                >
                  Sign Up
                </Link>
              </nav>

              {/* Mobile Menu Button */}
              <div className="md:hidden flex items-center gap-3">
                <Link
                  href="/sign-in"
                  className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="px-4 py-2 bg-amber-500 text-black rounded-lg font-semibold text-sm"
                >
                  Sign Up
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="container mx-auto px-4 lg:px-8 pt-20 pb-32 md:pt-32 md:pb-40">
          <div className="max-w-5xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-sm font-semibold mb-8 backdrop-blur-sm">
              <Sparkles className="w-4 h-4" />
              AI That Actually Does Things
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight">
              <span className="block bg-gradient-to-r from-white via-white to-gray-500 bg-clip-text text-transparent">
                Talk to Wells.
              </span>
              <span className="block bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                Get It Done.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-gray-400 mb-4 max-w-3xl mx-auto leading-relaxed">
              Need to hire? Source suppliers? Find customers? Close deals?
            </p>
            <p className="text-2xl md:text-3xl text-white font-semibold mb-12">
              Just tell Wells what you need.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link
                href="/founder/chat"
                className="group px-8 py-4 bg-amber-500 text-black rounded-xl font-bold text-lg hover:bg-amber-400 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/50 flex items-center gap-2"
              >
                Talk to Wells Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/demo"
                className="px-8 py-4 bg-white/5 border border-white/10 rounded-xl font-semibold text-lg hover:bg-white/10 hover:border-white/20 transition-all backdrop-blur-sm"
              >
                See What Wells Can Do
              </Link>
            </div>

            {/* Trust Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {TRUST_METRICS.map((metric, index) => (
                <div key={index} className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm hover:bg-white/10 transition-all">
                  <metric.icon className="w-6 h-6 text-amber-500 mb-3 mx-auto" />
                  <div className="text-2xl md:text-3xl font-bold text-white mb-1">{metric.value}</div>
                  <div className="text-sm text-gray-400">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Journeys Section */}
        <section id="journeys" className="container mx-auto px-4 lg:px-8 py-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
              What Do You Need?
            </h2>
            <p className="text-xl text-gray-400">Tell Wells. Watch it happen.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-7xl mx-auto">
            {JOURNEYS.map((journey, index) => (
              <Link
                key={index}
                href={journey.href}
                className="group relative bg-gradient-to-b from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-8 hover:border-white/20 hover:from-white/10 hover:to-white/5 transition-all duration-300"
              >
                {/* Gradient Accent */}
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${journey.gradient} rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity`} />

                {/* Icon */}
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${journey.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg`}>
                  <journey.icon className="w-7 h-7 text-white" />
                </div>

                {/* Content */}
                <div className="mb-6">
                  <h3 className="text-2xl font-bold mb-2 group-hover:text-amber-400 transition-colors">
                    {journey.title}
                  </h3>
                  <p className="text-amber-400 text-sm font-semibold mb-4">{journey.tagline}</p>
                  <p className="text-gray-400 leading-relaxed">{journey.description}</p>
                </div>

                {/* Outcomes */}
                <ul className="space-y-3 mb-8">
                  {journey.outcomes.map((outcome, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-gray-300">
                      <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="flex items-center justify-between text-amber-400 font-semibold group-hover:text-amber-300 transition-colors">
                  <span>{journey.cta}</span>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 lg:px-8 py-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
              Built for Speed
            </h2>
            <p className="text-xl text-gray-400">No forms. No complexity. Just results.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {FEATURES.map((feature, index) => (
              <div
                key={index}
                className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/10 hover:border-white/20 transition-all backdrop-blur-sm"
              >
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-black" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="container mx-auto px-4 lg:px-8 py-24">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
                How Wells Works
              </h2>
              <p className="text-xl text-gray-400">Three steps. No forms. No complexity.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: '01',
                  title: 'Talk to Wells',
                  description: 'Tell Wells what you need in plain English. No forms, no templates, just conversation.'
                },
                {
                  step: '02',
                  title: 'Wells Gets to Work',
                  description: 'AI finds matches, sends outreach, coordinates responses automatically in the background.'
                },
                {
                  step: '03',
                  title: 'You Close Deals',
                  description: 'Review results, make decisions, close deals with built-in escrow protection.'
                }
              ].map((step, index) => (
                <div key={index} className="relative group">
                  {/* Connector Line */}
                  {index < 2 && (
                    <div className="hidden md:block absolute top-16 left-1/2 w-full h-0.5 bg-gradient-to-r from-amber-500/50 to-transparent" />
                  )}

                  <div className="text-center relative">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-3xl font-bold mx-auto mb-6 shadow-2xl shadow-amber-500/50 group-hover:scale-110 transition-transform">
                      {step.step}
                    </div>
                    <h3 className="text-2xl font-bold mb-4">{step.title}</h3>
                    <p className="text-gray-400 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="container mx-auto px-4 lg:px-8 py-24">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
                Simple Pricing
              </h2>
              <p className="text-xl text-gray-400">1% flat on closed deals. That's it.</p>
            </div>

            <div className="relative bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-3xl p-8 md:p-12 backdrop-blur-sm overflow-hidden">
              {/* Background Gradient Accent */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent pointer-events-none" />

              <div className="relative grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 rounded-full text-amber-400 text-sm font-semibold mb-6">
                    <Zap className="w-4 h-4" />
                    Pay Only When You Win
                  </div>
                  <h3 className="text-4xl md:text-5xl font-bold mb-6">
                    1% Success Fee
                  </h3>
                  <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                    We only charge when you close a deal. Searching, matching, quoting, and negotiation are all completely free.
                  </p>
                  <ul className="space-y-4">
                    {[
                      'Free to search and get quotes',
                      'Free matching and introductions',
                      '1% only on completed transactions',
                      'Built-in escrow protection'
                    ].map((item, index) => (
                      <li key={index} className="flex items-center gap-3 text-gray-300">
                        <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-black/50 border border-white/10 rounded-2xl p-10 text-center backdrop-blur-sm">
                  <div className="text-7xl md:text-8xl font-bold bg-gradient-to-br from-amber-400 to-amber-600 bg-clip-text text-transparent mb-3">
                    1%
                  </div>
                  <div className="text-gray-400 text-lg mb-8">of deal value</div>
                  <Link
                    href="/founder/chat"
                    className="block w-full px-8 py-4 bg-amber-500 text-black rounded-xl font-bold text-lg hover:bg-amber-400 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/50 mb-4"
                  >
                    Start for Free
                  </Link>
                  <p className="text-sm text-gray-500">No credit card required</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="container mx-auto px-4 lg:px-8 py-24">
          <div className="max-w-4xl mx-auto relative">
            {/* Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl blur-3xl opacity-20" />

            <div className="relative bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl p-12 md:p-16 text-center overflow-hidden">
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl" />

              <div className="relative">
                <MessageSquare className="w-16 h-16 mx-auto mb-6 text-black/80" />
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-black mb-6 tracking-tight">
                  Stop Searching.
                  <br />
                  Start Talking.
                </h2>
                <p className="text-xl md:text-2xl text-black/80 mb-10 max-w-2xl mx-auto">
                  Tell Wells what you need. Get it done.
                </p>
                <Link
                  href="/founder/chat"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-900 transition-all hover:scale-105 hover:shadow-2xl"
                >
                  Talk to Wells Now
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 bg-white/[0.02] backdrop-blur-sm">
          <div className="container mx-auto px-4 lg:px-8 py-16">
            <div className="grid md:grid-cols-5 gap-12 mb-12">
              <div className="md:col-span-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-black" />
                  </div>
                  <span className="text-xl font-bold tracking-tight">WellsAI</span>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
                  AI that turns conversations into outcomes. Just tell Wells what you need and watch it happen.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-4 text-sm">Journeys</h4>
                <ul className="space-y-3 text-sm text-gray-400">
                  <li><Link href="/founder/chat" className="hover:text-white transition-colors">Founder</Link></li>
                  <li><Link href="/buyer/chat" className="hover:text-white transition-colors">Buyer</Link></li>
                  <li><Link href="/suppliers/onboard" className="hover:text-white transition-colors">Seller</Link></li>
                  <li><Link href="/jobs/chat" className="hover:text-white transition-colors">Jobs</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-4 text-sm">Platform</h4>
                <ul className="space-y-3 text-sm text-gray-400">
                  <li><Link href="#how-it-works" className="hover:text-white transition-colors">How It Works</Link></li>
                  <li><Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                  <li><Link href="/partnerships" className="hover:text-white transition-colors">Partnerships</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-4 text-sm">Company</h4>
                <ul className="space-y-3 text-sm text-gray-400">
                  <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                  <li><Link href="/support" className="hover:text-white transition-colors">Support</Link></li>
                </ul>
              </div>
            </div>

            <div className="border-t border-white/10 pt-8 text-center text-sm text-gray-500">
              <p>© 2025 WellsAI. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
