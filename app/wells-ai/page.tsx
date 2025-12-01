'use client'

/**
 * Wells AI Landing Page
 * wellsai.com
 *
 * Conversational B2B procurement platform
 */

import Link from 'next/link'
import {
  MessageSquare,
  Zap,
  Target,
  CheckCircle,
  ArrowRight,
  Users,
  Clock,
  DollarSign
} from 'lucide-react'

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'Conversational RFQs',
    description: 'Tell Wells what you need in plain English. No forms, no complexity.'
  },
  {
    icon: Zap,
    title: 'Instant Matching',
    description: 'AI finds and notifies the right suppliers in seconds, not days.'
  },
  {
    icon: Target,
    title: 'Automated Outreach',
    description: 'Suppliers get SMS alerts immediately. Average 48hr quote turnaround.'
  },
  {
    icon: CheckCircle,
    title: 'Deal Tracking',
    description: 'See quotes, negotiate terms, and close deals all in one place.'
  }
]

const USE_CASES = [
  {
    title: 'For Founders',
    description: 'Need a CTO? Equipment? First 10 customers? Wells handles it.',
    cta: 'Start as Founder',
    href: '/founder/chat',
    stats: ['Hire a CTO in 2 weeks', 'Find 10 customers in 10 days', 'Source equipment in 48 hours']
  },
  {
    title: 'For Buyers',
    description: 'Enterprise procurement teams sourcing suppliers at scale.',
    cta: 'Start Sourcing',
    href: '/chat',
    stats: ['50+ verified suppliers', '$2M in deals closed', '33bps transaction fee']
  },
  {
    title: 'For Suppliers',
    description: 'Get qualified RFQs delivered directly to your phone.',
    cta: 'Join as Supplier',
    href: '/suppliers/join',
    stats: ['No monthly fees', 'SMS alerts', 'Pre-qualified leads']
  }
]

const SOCIAL_PROOF = [
  { metric: '50+', label: 'Active Suppliers' },
  { metric: '$2M+', label: 'Deals Closed' },
  { metric: '48hrs', label: 'Avg Quote Time' },
  { metric: '0.33%', label: 'Transaction Fee' }
]

export default function WellsAILanding() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600" />
              <span className="text-xl font-bold">Wells AI</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="#features" className="text-gray-300 hover:text-white transition-colors">
                Features
              </Link>
              <Link href="#use-cases" className="text-gray-300 hover:text-white transition-colors">
                Use Cases
              </Link>
              <Link href="#pricing" className="text-gray-300 hover:text-white transition-colors">
                Pricing
              </Link>
              <Link href="/grain-vault" className="text-gray-300 hover:text-white transition-colors">
                For Developers
              </Link>
              <Link
                href="/founder/chat"
                className="px-4 py-2 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-600 transition-colors"
              >
                Talk to Wells
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Procurement That Talks Back
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 mb-12">
            Talk to Wells. Get suppliers matched. Close deals faster.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/founder/chat"
              className="px-8 py-4 bg-amber-500 text-black rounded-xl font-bold text-lg hover:bg-amber-600 transition-all hover:scale-105 flex items-center gap-2"
            >
              Start Sourcing
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="#demo"
              className="px-8 py-4 bg-gray-900 border border-gray-800 rounded-xl font-semibold text-lg hover:border-amber-500 transition-all"
            >
              Watch Demo
            </Link>
          </div>
        </div>

        {/* Social Proof */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20 max-w-4xl mx-auto">
          {SOCIAL_PROOF.map((item, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl font-bold text-amber-500 mb-2">{item.metric}</div>
              <div className="text-gray-400">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">How Wells Works</h2>
          <p className="text-xl text-gray-400">AI-powered procurement that actually works</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {FEATURES.map((feature, index) => (
            <div
              key={index}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-amber-500 transition-all"
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-black" />
              </div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="use-cases" className="container mx-auto px-4 py-24 bg-gray-900/50">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Built for Your Workflow</h2>
          <p className="text-xl text-gray-400">Whether you're a founder, buyer, or supplier</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {USE_CASES.map((useCase, index) => (
            <div
              key={index}
              className="bg-black border border-gray-800 rounded-xl p-8 hover:border-amber-500 transition-all"
            >
              <h3 className="text-2xl font-bold mb-3">{useCase.title}</h3>
              <p className="text-gray-400 mb-6">{useCase.description}</p>

              <ul className="space-y-2 mb-8">
                {useCase.stats.map((stat, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    {stat}
                  </li>
                ))}
              </ul>

              <Link
                href={useCase.href}
                className="block w-full text-center px-6 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-600 transition-colors"
              >
                {useCase.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Simple, Transparent Pricing</h2>
          <p className="text-xl text-gray-400 mb-12">
            Free to use. Pay only when you close deals.
          </p>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12">
            <div className="flex items-center justify-center gap-4 mb-6">
              <DollarSign className="w-16 h-16 text-amber-500" />
              <div className="text-6xl font-bold">0.33%</div>
            </div>
            <p className="text-2xl text-gray-300 mb-8">
              That's it. 33 basis points when deals close.
            </p>

            <div className="grid md:grid-cols-3 gap-6 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-semibold mb-1">No Setup Fees</div>
                  <div className="text-sm text-gray-400">Start sourcing immediately</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-semibold mb-1">No Monthly Fees</div>
                  <div className="text-sm text-gray-400">Pay per transaction only</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-semibold mb-1">No Hidden Costs</div>
                  <div className="text-sm text-gray-400">What you see is what you pay</div>
                </div>
              </div>
            </div>

            <div className="mt-8 p-6 bg-black rounded-lg">
              <div className="text-sm text-gray-400 mb-2">Example</div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">$100,000 deal</span>
                <span className="text-2xl font-bold text-amber-500">$330 fee</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-12">
          <h2 className="text-4xl md:text-5xl font-bold text-black mb-6">
            Ready to Talk to Wells?
          </h2>
          <p className="text-xl text-black/80 mb-8">
            No credit card required. Start sourcing in seconds.
          </p>
          <Link
            href="/founder/chat"
            className="inline-flex items-center gap-2 px-8 py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-900 transition-all hover:scale-105"
          >
            Start Sourcing
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
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600" />
                <span className="text-xl font-bold">Wells AI</span>
              </div>
              <p className="text-gray-400 text-sm">
                Conversational procurement for B2B commerce
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="#features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="#use-cases" className="hover:text-white transition-colors">Use Cases</Link></li>
                <li><Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/founder/chat" className="hover:text-white transition-colors">Get Started</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link href="https://grainandvault.com" className="hover:text-white transition-colors">Grain & Vault</Link></li>
                <li><Link href="/partnerships" className="hover:text-white transition-colors">Partnerships</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
                <li><Link href="/api" className="hover:text-white transition-colors">API</Link></li>
                <li><Link href="/support" className="hover:text-white transition-colors">Support</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>© 2025 Wells Onyx. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
