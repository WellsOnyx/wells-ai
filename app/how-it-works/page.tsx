'use client'

/**
 * WellsAI How It Works Page
 * Step-by-step explanation of the platform
 */

import Link from 'next/link'
import { MessageSquare, Search, FileText, Handshake, Shield, ArrowRight, Play, CheckCircle } from 'lucide-react'

const STEPS = [
  {
    number: '01',
    icon: MessageSquare,
    title: 'Tell Wells What You Need',
    description: 'Start a conversation with Wells, just like texting a colleague. Describe what you\'re looking for — a supplier, a service, talent, whatever your business needs.',
    details: [
      '"I need 10,000 custom widgets by Q2"',
      '"Find me a fractional CFO with SaaS experience"',
      '"We need packaging suppliers in the Midwest"'
    ],
    color: 'blue'
  },
  {
    number: '02',
    icon: Search,
    title: 'Wells Finds Matches',
    description: 'Wells searches our network of 500+ vetted suppliers and service providers. AI-powered matching means you get relevant options, not a firehose of irrelevant results.',
    details: [
      'Matches based on your specific requirements',
      'Pre-qualified suppliers with verified credentials',
      'Real-time availability and capacity checks'
    ],
    color: 'violet'
  },
  {
    number: '03',
    icon: FileText,
    title: 'Get Quotes in 48 Hours',
    description: 'Wells sends your RFQ to matched suppliers and collects quotes. No back-and-forth emails. No chasing vendors. Quotes appear in your dashboard, ready to compare.',
    details: [
      'Standardized format for easy comparison',
      'All questions handled by Wells',
      'Average 48-hour quote turnaround'
    ],
    color: 'emerald'
  },
  {
    number: '04',
    icon: Handshake,
    title: 'Close the Deal',
    description: 'Accept a quote and Wells handles the paperwork. Contracts, terms, payment — all streamlined through the platform. You focus on the relationship, we handle the admin.',
    details: [
      'One-click contract generation',
      'Built-in escrow for secure payments',
      'Milestone tracking and delivery confirmation'
    ],
    color: 'amber'
  }
]

const USE_CASES = [
  {
    title: 'Procurement Teams',
    description: 'Source suppliers, compare quotes, and close deals faster than traditional RFP processes.',
    icon: '📦'
  },
  {
    title: 'HR & Recruiting',
    description: 'Find contractors, agencies, and fractional executives. Hire talent without the headhunter fees.',
    icon: '👥'
  },
  {
    title: 'Sales Teams',
    description: 'Get discovered by buyers actively looking for your services. No cold outreach required.',
    icon: '📈'
  },
  {
    title: 'Operations',
    description: 'Manage vendor relationships, track orders, and handle payments all in one place.',
    icon: '⚙️'
  }
]

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-white">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600&display=swap');
        .font-playfair { font-family: 'Playfair Display', Georgia, serif; }
      `}</style>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-gray-900 font-semibold text-[17px]">
            <div className="w-7 h-7 bg-gradient-to-br from-gray-800 to-gray-900 rounded-[7px] flex items-center justify-center text-white text-[13px] font-bold">
              W
            </div>
            WellsAI
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Pricing
            </Link>
            <Link
              href="/chat"
              className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <div className="inline-flex px-3.5 py-1.5 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full text-[11px] font-semibold text-white uppercase tracking-wider mb-5">
            How It Works
          </div>
          <h1 className="font-playfair text-[clamp(40px,5vw,56px)] font-medium text-gray-900 mb-6 tracking-tight">
            From Conversation to Closed Deal<br />in Four Simple Steps
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
            No forms. No phone tag. No weeks of waiting. Just tell Wells what you need and watch deals materialize.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-all"
            >
              Try It Now
              <ArrowRight className="w-5 h-5" />
            </Link>
            <button className="inline-flex items-center gap-2 px-6 py-3.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all">
              <Play className="w-5 h-5" />
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="space-y-24">
            {STEPS.map((step, i) => (
              <div
                key={i}
                className={`flex items-center gap-16 ${i % 2 === 1 ? 'flex-row-reverse' : ''}`}
              >
                {/* Content */}
                <div className="flex-1">
                  <div className="inline-flex items-center gap-3 mb-4">
                    <span className={`text-5xl font-bold text-${step.color}-500/20`}>{step.number}</span>
                    <div className={`w-12 h-12 bg-${step.color}-100 rounded-xl flex items-center justify-center`}>
                      <step.icon className={`w-6 h-6 text-${step.color}-600`} />
                    </div>
                  </div>
                  <h2 className="text-3xl font-semibold text-gray-900 mb-4">{step.title}</h2>
                  <p className="text-lg text-gray-600 mb-6 leading-relaxed">{step.description}</p>
                  <ul className="space-y-3">
                    {step.details.map((detail, j) => (
                      <li key={j} className="flex items-start gap-3">
                        <CheckCircle className={`w-5 h-5 text-${step.color}-500 flex-shrink-0 mt-0.5`} />
                        <span className="text-gray-700">{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Visual */}
                <div className="flex-1">
                  <div className={`aspect-[4/3] bg-gradient-to-br from-${step.color}-50 to-${step.color}-100/50 rounded-3xl border border-${step.color}-200/50 flex items-center justify-center`}>
                    <div className={`w-24 h-24 bg-${step.color}-500 rounded-2xl flex items-center justify-center shadow-xl shadow-${step.color}-500/25`}>
                      <step.icon className="w-12 h-12 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="font-playfair text-3xl font-medium text-gray-900 mb-4">
              Built-In Protection at Every Step
            </h2>
            <p className="text-lg text-gray-600 mb-10">
              Every transaction is protected by our escrow system. Funds are held securely until you confirm delivery. If something goes wrong, you're covered.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
                <div className="text-2xl mb-2">🔒</div>
                <h3 className="font-semibold text-gray-900 mb-1">Secure Escrow</h3>
                <p className="text-sm text-gray-500">Funds held until delivery confirmed</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
                <div className="text-2xl mb-2">✅</div>
                <h3 className="font-semibold text-gray-900 mb-1">Vetted Suppliers</h3>
                <p className="text-sm text-gray-500">All suppliers verified & rated</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
                <div className="text-2xl mb-2">🛡️</div>
                <h3 className="font-semibold text-gray-900 mb-1">Dispute Resolution</h3>
                <p className="text-sm text-gray-500">We mediate if issues arise</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-playfair text-3xl font-medium text-gray-900 mb-4">
              Built for Modern Business Teams
            </h2>
            <p className="text-lg text-gray-500">
              Whether you're buying, selling, or hiring — Wells makes it faster.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {USE_CASES.map((useCase, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1 transition-all duration-300">
                <div className="text-4xl mb-4">{useCase.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{useCase.title}</h3>
                <p className="text-gray-600 text-sm">{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <h2 className="font-playfair text-4xl font-medium text-white mb-4">
            Ready to See It in Action?
          </h2>
          <p className="text-xl text-white/60 mb-8 max-w-xl mx-auto">
            Start a conversation with Wells right now. No signup required to explore.
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-900 font-medium rounded-xl hover:bg-gray-100 transition-all text-lg"
          >
            Talk to Wells Now
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-200">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 text-gray-900 font-semibold text-[17px] mb-4">
            <div className="w-7 h-7 bg-gradient-to-br from-gray-800 to-gray-900 rounded-[7px] flex items-center justify-center text-white text-[13px] font-bold">
              W
            </div>
            WellsAI
          </Link>
          <p className="text-sm text-gray-500">
            © 2025 WellsAI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
