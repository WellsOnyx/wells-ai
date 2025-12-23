'use client'

/**
 * WellsAI About Page
 * Company story, mission, and team
 */

import Link from 'next/link'
import { ArrowRight, Sparkles, Target, Users, Zap, Building2, Globe } from 'lucide-react'

const VALUES = [
  {
    icon: Target,
    title: 'Outcome-Driven',
    description: 'We measure success by pipeline generated and deals closed. Our success-based pricing ensures alignment with your business objectives.'
  },
  {
    icon: Zap,
    title: 'Enterprise Speed',
    description: 'Fortune 500 velocity without the overhead. Vendor responses in 48 hours. Supplier matches in seconds. RFQs deployed instantly.'
  },
  {
    icon: Users,
    title: 'Human-in-the-Loop',
    description: "AI handles sourcing, outreach, and negotiation. Your team retains approval authority. Enterprise governance built-in."
  }
]

const TEAM = [
  {
    name: 'Jonah Manning',
    role: 'Founder & CEO',
    bio: 'Former enterprise procurement leader. Built WellsAI to transform indirect sourcing and B2B commerce.',
    image: null
  },
  {
    name: 'Wells',
    role: 'AI Agent',
    bio: 'Trained on enterprise transactions across MRO, professional services, and strategic sourcing. Always on.',
    image: null,
    isAI: true
  }
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600&display=swap');
        .font-playfair { font-family: 'Playfair Display', Georgia, serif; }
      `}</style>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-gray-900 dark:text-white font-semibold text-[17px]">
            <div className="w-7 h-7 bg-gradient-to-br from-gray-800 to-gray-900 dark:from-white dark:to-gray-200 rounded-[7px] flex items-center justify-center text-white dark:text-gray-900 text-[13px] font-bold">
              W
            </div>
            WellsAI
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              Home
            </Link>
            <Link
              href="/chat"
              className="px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-16 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <div className="inline-flex px-3.5 py-1.5 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full text-[11px] font-semibold text-white uppercase tracking-wider mb-5">
            Enterprise AI Platform
          </div>
          <h1 className="font-playfair text-[clamp(40px,5vw,56px)] font-medium text-gray-900 dark:text-white mb-6 tracking-tight">
            Transforming Enterprise<br />Procurement & Sales
          </h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            WellsAI is an AI-powered execution platform for indirect sourcing, enterprise sales,
            and strategic partnerships. Describe your requirements. Deploy AI agents. Done.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-20 dark:bg-gray-950">
        <div className="max-w-[800px] mx-auto px-6">
          <h2 className="font-playfair text-3xl font-medium text-gray-900 dark:text-white mb-6">Our Story</h2>
          <div className="prose prose-lg text-gray-600 dark:text-gray-400 dark:prose-invert">
            <p>
              WellsAI started from a simple observation: enterprise procurement and sales processes are fundamentally broken.
            </p>
            <p>
              Indirect sourcing teams spend weeks gathering quotes. Enterprise sales reps burn hours on manual outreach.
              Executive searches drag on for months. Strategic partnerships stall in endless email chains.
              Billions in value lost to process friction.
            </p>
            <p>
              We built Wells to be the AI that executes. Not another dashboard or chatbot —
              an autonomous agent that deploys RFQs, qualifies vendors, conducts outreach, and manages negotiations.
              Describe your requirements. Deploy. Done.
            </p>
            <p>
              Our success-based model at 33 basis points means our incentives align with yours.
              We don't charge for seats or conversations. We charge when deals close.
              True partnership in enterprise commerce.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-playfair text-3xl font-medium text-gray-900 dark:text-white mb-4">What We Believe</h2>
            <p className="text-lg text-gray-500 dark:text-gray-400">The principles that guide everything we build.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {VALUES.map((value, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-8">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-500/20 rounded-xl flex items-center justify-center mb-5">
                  <value.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{value.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 dark:bg-gray-950">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-playfair text-3xl font-medium text-gray-900 dark:text-white mb-4">Meet the Team</h2>
            <p className="text-lg text-gray-500 dark:text-gray-400">Human expertise. AI execution.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-8 max-w-2xl mx-auto">
            {TEAM.map((member, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center">
                <div className={`w-20 h-20 mx-auto mb-5 rounded-2xl flex items-center justify-center ${
                  member.isAI
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 dark:from-white dark:to-gray-200'
                    : 'bg-gradient-to-br from-blue-500 to-violet-500'
                }`}>
                  {member.isAI ? (
                    <Sparkles className="w-8 h-8 text-white dark:text-gray-900" />
                  ) : (
                    <span className="text-3xl font-bold text-white">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{member.name}</h3>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-3">{member.role}</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Part of Wells Onyx */}
      <section className="py-16 bg-gray-900 dark:bg-black">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <div className="inline-flex px-3 py-1.5 bg-white/10 rounded-full text-xs font-semibold text-white/70 uppercase tracking-wider mb-4">
            Wells Onyx Ecosystem
          </div>
          <h2 className="text-2xl font-medium text-white mb-4">
            Enterprise Infrastructure for AI-Native Commerce
          </h2>
          <p className="text-white/60 max-w-xl mx-auto mb-8">
            WellsAI is part of the Wells Onyx platform — including Grain & Vault for enterprise treasury
            and working capital management.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/grain-vault"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-600 transition-all"
            >
              Grain & Vault
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-20 dark:bg-gray-950">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <h2 className="font-playfair text-3xl font-medium text-gray-900 dark:text-white mb-4">
            Ready to Transform Your Procurement?
          </h2>
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-8">
            Schedule a demo or deploy Wells to your first workflow today.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/contact"
              className="px-6 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
            >
              Contact Sales
            </Link>
            <Link
              href="/chat"
              className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all"
            >
              Deploy Wells →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-200 dark:border-gray-800 dark:bg-gray-950">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 text-gray-900 dark:text-white font-semibold text-[17px] mb-4">
            <div className="w-7 h-7 bg-gradient-to-br from-gray-800 to-gray-900 dark:from-white dark:to-gray-200 rounded-[7px] flex items-center justify-center text-white dark:text-gray-900 text-[13px] font-bold">
              W
            </div>
            WellsAI
          </Link>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            © 2025 WellsAI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
