'use client'

/**
 * WellsAI Pricing Page
 * Simple, transparent pricing with comparison table and FAQ
 */

import { useState } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, ArrowRight, Sparkles, Building2 } from 'lucide-react'

const FEATURES = [
  { title: 'Unlimited AI agent deployments', included: true },
  { title: 'Indirect sourcing workflows', included: true },
  { title: 'Enterprise sales automation', included: true },
  { title: 'Vendor qualification & matching', included: true },
  { title: 'Executive search capabilities', included: true },
  { title: 'Strategic partnership discovery', included: true },
  { title: 'Built-in escrow & payment rails', included: true },
  { title: 'Real-time pipeline tracking', included: true },
  { title: 'ERP & CRM integrations', included: true },
  { title: 'Enterprise support & SLAs', included: true }
]

const COMPARISON = [
  {
    feature: 'Implementation',
    wells: 'Same day',
    traditional: '6-12 months',
    others: '1-3 months'
  },
  {
    feature: 'Platform Fee',
    wells: 'None',
    traditional: '$50K-$500K/yr',
    others: '$5K-$50K/yr'
  },
  {
    feature: 'Success Fee',
    wells: '33 bps',
    traditional: '2-5%',
    others: '1-3%'
  },
  {
    feature: 'Time to First Quote',
    wells: '< 48 hours',
    traditional: '2-4 weeks',
    others: '1-2 weeks'
  },
  {
    feature: 'Vendor Network',
    wells: '10K+ qualified',
    traditional: 'Build your own',
    others: 'Limited'
  },
  {
    feature: 'AI Execution',
    wells: 'Autonomous',
    traditional: 'Manual',
    others: 'Assisted'
  },
  {
    feature: 'Human Approval',
    wells: 'Built-in',
    traditional: 'N/A',
    others: 'Limited'
  }
]

const FAQS = [
  {
    question: 'What is the 33 basis points fee?',
    answer: 'Our success fee is 0.33% of closed transaction value. You only pay when a deal closes. If you receive quotes but don\'t proceed, there\'s no charge. This aligns our incentives with your outcomes.'
  },
  {
    question: 'What if a deal falls through?',
    answer: 'No closed deal, no fee. Our escrow system holds funds until both parties confirm transaction completion. You\'re protected throughout the process.'
  },
  {
    question: 'Are there platform or seat fees?',
    answer: 'No. Zero platform fees. Zero seat licenses. Zero setup costs. The 33 basis points success fee is our only revenue. We succeed when you succeed.'
  },
  {
    question: 'How does enterprise escrow work?',
    answer: 'When you accept a quote, funds are held in our institutional escrow. Upon delivery confirmation, we release payment to the vendor (minus our fee). Bank-grade security for both parties.'
  },
  {
    question: 'Volume pricing for large enterprises?',
    answer: 'For annual transaction volumes over $10M, we offer custom enterprise agreements with volume discounts and dedicated support. Contact our enterprise team.'
  },
  {
    question: 'What payment rails are supported?',
    answer: 'ACH, wire transfers, SWIFT, and major credit cards. Multi-currency support for international transactions. SOC 2 compliant with enterprise-grade security.'
  }
]

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

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
            Enterprise Pricing
          </div>
          <h1 className="font-playfair text-[clamp(40px,5vw,56px)] font-medium text-gray-900 dark:text-white mb-4 tracking-tight">
            Success-Based Pricing
          </h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Zero platform fees. Zero seat licenses. Pay only when deals close.
          </p>
        </div>
      </section>

      {/* Main Pricing Card */}
      <section className="pb-24 dark:bg-gray-950">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-xl mx-auto bg-white dark:bg-gray-900 border-2 border-gray-900 dark:border-white/20 rounded-3xl p-10 shadow-xl relative overflow-hidden">
            {/* Badge */}
            <div className="absolute top-0 right-0 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-semibold px-4 py-1.5 rounded-bl-xl">
              Success-Based
            </div>

            <div className="text-center mb-8">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-7xl font-bold text-gray-900 dark:text-white tracking-tight">33</span>
                <span className="text-2xl font-semibold text-gray-500 dark:text-gray-400">bps</span>
              </div>
              <p className="text-lg text-gray-500 dark:text-gray-400 mt-2">of closed transaction value</p>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Full platform access:
              </h3>
              <ul className="space-y-3">
                {FEATURES.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-[15px] text-gray-700 dark:text-gray-300">
                    <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    {feature.title}
                  </li>
                ))}
              </ul>
            </div>

            <Link
              href="/chat"
              className="mt-8 w-full flex items-center justify-center gap-2 px-6 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-base font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              Deploy Wells Now
              <ArrowRight className="w-5 h-5" />
            </Link>

            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-4">
              No credit card required • Deploy in minutes
            </p>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-24 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-playfair text-3xl font-medium text-gray-900 dark:text-white mb-4">
              Platform Comparison
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400">
              See how WellsAI compares to traditional procurement and legacy platforms.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-900 dark:text-white">Feature</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-gray-900 dark:text-white bg-blue-50 dark:bg-blue-500/20 rounded-t-xl">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-6 h-6 bg-gray-900 dark:bg-white rounded-md flex items-center justify-center text-white dark:text-gray-900 text-xs font-bold">
                        W
                      </div>
                      WellsAI
                    </div>
                  </th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-gray-500 dark:text-gray-400">Traditional Procurement</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-gray-500 dark:text-gray-400">Legacy Platforms</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={i} className="border-b border-gray-200 dark:border-gray-700">
                    <td className="py-4 px-4 text-sm text-gray-700 dark:text-gray-300">{row.feature}</td>
                    <td className="py-4 px-4 text-center text-sm font-medium text-gray-900 dark:text-white bg-blue-50 dark:bg-blue-500/20">
                      {row.wells}
                    </td>
                    <td className="py-4 px-4 text-center text-sm text-gray-500 dark:text-gray-400">{row.traditional}</td>
                    <td className="py-4 px-4 text-center text-sm text-gray-500 dark:text-gray-400">{row.others}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 dark:bg-gray-950">
        <div className="max-w-[800px] mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-playfair text-3xl font-medium text-gray-900 dark:text-white mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400">
              Everything you need to know about enterprise pricing.
            </p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="text-[15px] font-medium text-gray-900 dark:text-white">{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      openFaq === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-[15px] text-gray-600 dark:text-gray-400 leading-relaxed">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise CTA */}
      <section className="py-16 bg-gray-900 dark:bg-black">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-xs font-semibold text-white/80 uppercase tracking-wider mb-4">
            <Building2 className="w-3 h-3" />
            Enterprise
          </div>
          <h2 className="text-3xl font-medium text-white mb-4">
            Volume Pricing for Large Enterprises
          </h2>
          <p className="text-lg text-white/60 mb-8 max-w-xl mx-auto">
            Custom agreements for organizations with $10M+ annual transaction volume.
            Dedicated support, SLAs, and volume discounts.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-white text-gray-900 font-medium rounded-xl hover:bg-gray-100 transition-all"
          >
            Contact Enterprise Sales
            <ArrowRight className="w-4 h-4" />
          </Link>
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
