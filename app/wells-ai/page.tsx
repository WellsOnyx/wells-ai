'use client'

/**
 * Wells AI Landing Page
 * wellsonyx.io
 *
 * Journey-focused conversational platform
 */

import Link from 'next/link'
import {
  Rocket,
  ShoppingCart,
  Store,
  Briefcase,
  ArrowRight,
  CheckCircle,
  MessageSquare
} from 'lucide-react'

const JOURNEYS = [
  {
    icon: Rocket,
    title: 'Founder Journey',
    tagline: 'Build your company faster',
    description: 'Need to hire a CTO? Source equipment? Find your first 10 customers? Raise capital? Wells handles it.',
    outcomes: [
      'Hire key roles in weeks, not months',
      'Source equipment and services instantly',
      'Launch customer acquisition campaigns',
      'Connect with investors'
    ],
    cta: 'Start Founder Journey',
    href: '/founder/chat',
    color: 'from-amber-500 to-orange-600'
  },
  {
    icon: ShoppingCart,
    title: 'Buyer Journey',
    tagline: 'Procure without the pain',
    description: 'Tell Wells what you need. Get matched with verified suppliers. Compare quotes. Close deals.',
    outcomes: [
      'RFQs that write themselves',
      'Instant supplier matching',
      'Compare quotes in real-time',
      'Close deals with escrow protection'
    ],
    cta: 'Start Buying',
    href: '/buyer/chat',
    color: 'from-blue-500 to-cyan-600'
  },
  {
    icon: Store,
    title: 'Seller Journey',
    tagline: 'Win deals on autopilot',
    description: 'Get notified of qualified RFQs that match your catalog. Respond instantly. Win more business.',
    outcomes: [
      'Pre-qualified leads delivered to you',
      'SMS alerts for hot opportunities',
      'Fast quote submission',
      'Automated deal tracking'
    ],
    cta: 'Start Selling',
    href: '/suppliers/onboard',
    color: 'from-green-500 to-emerald-600'
  },
  {
    icon: Briefcase,
    title: 'Job Seeker Journey',
    tagline: 'Find work that fits',
    description: 'Tell Wells what you\'re looking for. Get matched with companies hiring. Skip the resume spam.',
    outcomes: [
      'Personalized job matching',
      'Direct company connections',
      'Skills-based recommendations',
      'Interview coordination'
    ],
    cta: 'Find Opportunities',
    href: '/jobs/chat',
    color: 'from-purple-500 to-pink-600'
  }
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
              <Link href="#journeys" className="text-gray-300 hover:text-white transition-colors">
                Journeys
              </Link>
              <Link href="#how-it-works" className="text-gray-300 hover:text-white transition-colors">
                How It Works
              </Link>
              <Link href="/grain-vault" className="text-gray-300 hover:text-white transition-colors">
                Grain & Vault
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
            Whatever Your Journey,
            <br />
            Wells Gets It Done
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 mb-12">
            Founder? Buyer? Seller? Job seeker? Just talk to Wells.
            <br />
            The AI that turns conversations into outcomes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/founder/chat"
              className="px-8 py-4 bg-amber-500 text-black rounded-xl font-bold text-lg hover:bg-amber-600 transition-all hover:scale-105 flex items-center gap-2"
            >
              Start Your Journey
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="#how-it-works"
              className="px-8 py-4 bg-gray-900 border border-gray-800 rounded-xl font-semibold text-lg hover:border-amber-500 transition-all"
            >
              See How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Journeys Section */}
      <section id="journeys" className="container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Choose Your Journey</h2>
          <p className="text-xl text-gray-400">Each path designed for your specific needs</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-7xl mx-auto">
          {JOURNEYS.map((journey, index) => (
            <div
              key={index}
              className="bg-gray-900 border border-gray-800 rounded-xl p-8 hover:border-amber-500 transition-all group"
            >
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${journey.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <journey.icon className="w-7 h-7 text-white" />
              </div>

              <h3 className="text-2xl font-bold mb-2">{journey.title}</h3>
              <p className="text-amber-400 text-sm font-semibold mb-4">{journey.tagline}</p>
              <p className="text-gray-400 mb-6">{journey.description}</p>

              <ul className="space-y-3 mb-8">
                {journey.outcomes.map((outcome, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-gray-300">
                    <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    {outcome}
                  </li>
                ))}
              </ul>

              <Link
                href={journey.href}
                className="block w-full text-center px-6 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-600 transition-colors"
              >
                {journey.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="container mx-auto px-4 py-24 bg-gray-900/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">How Wells Works</h2>
            <p className="text-xl text-gray-400">Just three steps. No forms. No complexity.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-bold mb-2">Talk to Wells</h3>
              <p className="text-gray-400">Tell Wells what you need in plain English. No forms, no templates.</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-bold mb-2">Wells Gets to Work</h3>
              <p className="text-gray-400">AI finds matches, sends outreach, coordinates responses automatically.</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-bold mb-2">You Close Deals</h3>
              <p className="text-gray-400">Review results, make decisions, close deals with built-in escrow.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-12">
          <MessageSquare className="w-16 h-16 mx-auto mb-6 text-black" />
          <h2 className="text-4xl md:text-5xl font-bold text-black mb-6">
            Ready to Start?
          </h2>
          <p className="text-xl text-black/80 mb-8">
            No credit card. No setup. Just talk to Wells.
          </p>
          <Link
            href="/founder/chat"
            className="inline-flex items-center gap-2 px-8 py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-900 transition-all hover:scale-105"
          >
            Start Your Journey
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
                AI that turns conversations into outcomes
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Journeys</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/founder/chat" className="hover:text-white transition-colors">Founder</Link></li>
                <li><Link href="/buyer/chat" className="hover:text-white transition-colors">Buyer</Link></li>
                <li><Link href="/suppliers/onboard" className="hover:text-white transition-colors">Seller</Link></li>
                <li><Link href="/jobs/chat" className="hover:text-white transition-colors">Job Seeker</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="#how-it-works" className="hover:text-white transition-colors">How It Works</Link></li>
                <li><Link href="/grain-vault" className="hover:text-white transition-colors">Grain & Vault</Link></li>
                <li><Link href="/partnerships" className="hover:text-white transition-colors">Partnerships</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
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
