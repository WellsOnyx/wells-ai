'use client'

/**
 * Wells Onyx Landing Page
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
  Zap
} from 'lucide-react'

const JOURNEYS = [
  {
    icon: Rocket,
    title: 'Founder Journey',
    tagline: '"I need to hire a CTO"',
    description: 'Tell Wells what you\'re building. Get matched with talent, suppliers, customers, and investors. Close deals in days, not months.',
    outcomes: [
      'Say "I need a fractional CFO" → get 3 qualified candidates',
      'Say "Source 1000 units" → get 5 supplier quotes',
      'Say "Find enterprise customers" → get warm intros',
      'Say "Raise a seed round" → connect with relevant VCs'
    ],
    cta: 'Talk to Wells',
    href: '/founder/chat',
    color: 'from-amber-500 to-orange-600'
  },
  {
    icon: ShoppingCart,
    title: 'Buyer Journey',
    tagline: '"I need industrial equipment"',
    description: 'Describe what you need in plain English. Wells writes the RFQ, finds suppliers, compares quotes, and handles escrow.',
    outcomes: [
      '"Need 50 motors" → RFQ sent to verified suppliers',
      'Compare quotes side-by-side in 24 hours',
      'One click to accept → money escrowed instantly',
      'Delivery confirmed → payment released automatically'
    ],
    cta: 'Talk to Wells',
    href: '/buyer/chat',
    color: 'from-blue-500 to-cyan-600'
  },
  {
    icon: Store,
    title: 'Seller Journey',
    tagline: '"Send me qualified leads"',
    description: 'Register your catalog. Wells matches you with buyers. Get SMS alerts for hot RFQs. Win more business.',
    outcomes: [
      'Wake up to qualified RFQs matching your products',
      'One-tap quote submission from your phone',
      'Get paid instantly via GRAIN escrow',
      'Build trust score → win bigger deals'
    ],
    cta: 'Join as Seller',
    href: '/suppliers/onboard',
    color: 'from-green-500 to-emerald-600'
  },
  {
    icon: Briefcase,
    title: 'Job Seeker Journey',
    tagline: '"I\'m looking for VP roles"',
    description: 'Tell Wells your ideal role. Get matched with companies actually hiring. Skip the job board noise.',
    outcomes: [
      '"Looking for remote eng roles" → matched with 5 companies',
      'Direct intro to hiring managers (no HR filter)',
      'Interview prep with AI coaching',
      'Salary negotiation guidance included'
    ],
    cta: 'Talk to Wells',
    href: '/jobs/chat',
    color: 'from-purple-500 to-pink-600'
  }
]

export default function WellsOnyxLanding() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600" />
              <span className="text-xl font-bold">Wells Onyx</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="#journeys" className="text-gray-300 hover:text-white transition-colors">
                Journeys
              </Link>
              <Link href="#how-it-works" className="text-gray-300 hover:text-white transition-colors">
                How It Works
              </Link>
              <Link href="#pricing" className="text-gray-300 hover:text-white transition-colors">
                Pricing
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
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-300 text-sm font-semibold mb-6">
            <MessageSquare className="w-4 h-4" />
            AI That Actually Does Things
          </div>
          <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Talk to Wells.
            <br />
            Get It Done.
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 mb-8">
            Need to hire? Source suppliers? Find customers? Close deals?
            <br />
            <span className="text-white font-semibold">Just tell Wells what you need.</span>
          </p>
          <p className="text-lg text-amber-400 mb-12">
            No forms. No searches. No back-and-forth. Just outcomes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/founder/chat"
              className="px-8 py-4 bg-amber-500 text-black rounded-xl font-bold text-lg hover:bg-amber-600 transition-all hover:scale-105 flex items-center gap-2"
            >
              Talk to Wells Now
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="#journeys"
              className="px-8 py-4 bg-gray-900 border border-gray-800 rounded-xl font-semibold text-lg hover:border-amber-500 transition-all"
            >
              See What Wells Can Do
            </Link>
          </div>
        </div>
      </section>

      {/* Journeys Section */}
      <section id="journeys" className="container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">What Do You Need?</h2>
          <p className="text-xl text-gray-400">Tell Wells. Watch it happen.</p>
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

      {/* Pricing Section */}
      <section id="pricing" className="container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Simple Pricing</h2>
            <p className="text-xl text-gray-400">1% flat on closed deals. That's it.</p>
          </div>

          <div className="bg-gray-900 border border-amber-500/30 rounded-2xl p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 rounded-full text-amber-400 text-sm font-semibold mb-4">
                  <Zap className="w-4 h-4" />
                  Pay Only When You Win
                </div>
                <h3 className="text-3xl font-bold mb-4">1% Success Fee</h3>
                <p className="text-gray-400 mb-6">
                  We only charge when you close a deal. Searching, matching, quoting, and negotiation are all free.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-gray-300">
                    <CheckCircle className="w-5 h-5 text-amber-500" />
                    Free to search and get quotes
                  </li>
                  <li className="flex items-center gap-3 text-gray-300">
                    <CheckCircle className="w-5 h-5 text-amber-500" />
                    Free matching and introductions
                  </li>
                  <li className="flex items-center gap-3 text-gray-300">
                    <CheckCircle className="w-5 h-5 text-amber-500" />
                    1% only on completed transactions
                  </li>
                  <li className="flex items-center gap-3 text-gray-300">
                    <CheckCircle className="w-5 h-5 text-amber-500" />
                    Built-in escrow protection
                  </li>
                </ul>
              </div>
              <div className="bg-black/50 rounded-xl p-8 text-center">
                <div className="text-6xl font-bold text-amber-500 mb-2">1%</div>
                <div className="text-gray-400 mb-6">of deal value</div>
                <Link
                  href="/founder/chat"
                  className="block w-full px-6 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-600 transition-colors"
                >
                  Start for Free
                </Link>
                <p className="text-xs text-gray-500 mt-4">No credit card required</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-12">
          <MessageSquare className="w-16 h-16 mx-auto mb-6 text-black" />
          <h2 className="text-4xl md:text-5xl font-bold text-black mb-6">
            Stop Searching.
            <br />
            Start Talking.
          </h2>
          <p className="text-xl text-black/80 mb-8">
            Tell Wells what you need. Get it done.
          </p>
          <Link
            href="/founder/chat"
            className="inline-flex items-center gap-2 px-8 py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-900 transition-all hover:scale-105"
          >
            Talk to Wells Now
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
                <span className="text-xl font-bold">Wells Onyx</span>
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
                <li><Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
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
