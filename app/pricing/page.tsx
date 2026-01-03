'use client'

/**
 * Grain & Vault Pricing Page
 * Three-tier pricing with glassmorphic cards and emerald accents
 * Free, Pro ($99/mo), Enterprise (Custom)
 * Monthly/Annual toggle with 20% annual discount
 * 1% success fee model highlighted
 */

import { useState } from 'react'
import Link from 'next/link'
import {
  Check,
  ChevronDown,
  ArrowRight,
  Sparkles,
  Building2,
  Zap,
  Shield,
  Users,
  Phone,
  Mail,
  Star,
  Crown,
  Rocket,
  TrendingUp,
  Clock,
  BadgeCheck,
  Headphones,
  Code,
  FileText,
  MessageSquare,
  Coins,
  Brain,
} from 'lucide-react'

// Pricing tiers data
const TIERS = [
  {
    name: 'Free',
    description: 'Get started with basic sourcing',
    monthlyPrice: 0,
    annualPrice: 0,
    priceLabel: 'Free forever',
    popular: false,
    color: 'gray',
    icon: Rocket,
    features: [
      { text: 'Basic supplier sourcing', included: true },
      { text: '5 RFQs per month', included: true },
      { text: 'Email support', included: true },
      { text: 'Standard matching algorithm', included: true },
      { text: 'Basic dashboard', included: true },
      { text: 'AI negotiations', included: false },
      { text: 'Priority matching', included: false },
      { text: 'Phone support', included: false },
    ],
    cta: 'Start Free',
    ctaLink: '/join',
  },
  {
    name: 'Pro',
    description: 'For growing teams that need more',
    monthlyPrice: 99,
    annualPrice: 79,
    priceLabel: '/month',
    popular: true,
    color: 'amber',
    icon: Star,
    features: [
      { text: 'Unlimited RFQs', included: true },
      { text: 'AI-powered negotiations', included: true },
      { text: 'Priority matching algorithm', included: true },
      { text: 'Phone & email support', included: true },
      { text: 'Advanced analytics', included: true },
      { text: 'Vendor scorecards', included: true },
      { text: 'Team collaboration (5 seats)', included: true },
      { text: 'Custom integrations', included: false },
    ],
    cta: 'Get Started',
    ctaLink: '/join?plan=pro',
  },
  {
    name: 'Enterprise',
    description: 'For organizations with complex needs',
    monthlyPrice: null,
    annualPrice: null,
    priceLabel: 'Custom pricing',
    popular: false,
    color: 'violet',
    icon: Crown,
    features: [
      { text: 'Everything in Pro', included: true },
      { text: 'Custom integrations (ERP, CRM)', included: true },
      { text: 'Dedicated account manager', included: true },
      { text: 'Enterprise SLA (99.9% uptime)', included: true },
      { text: 'Full API access', included: true },
      { text: 'Unlimited team seats', included: true },
      { text: 'Custom AI training', included: true },
      { text: 'On-premise deployment option', included: true },
    ],
    cta: 'Contact Sales',
    ctaLink: '/contact',
  },
]

const FAQS = [
  {
    question: 'What is the 1% success fee?',
    answer: 'Our success fee is 1% of closed transaction value. You only pay when a deal actually closes. If you receive quotes but don\'t proceed, there\'s no charge. This aligns our incentives with your outcomes - we only succeed when you do.'
  },
  {
    question: 'How does annual billing save me money?',
    answer: 'When you choose annual billing, you get 20% off the monthly rate. For Pro, that\'s $79/month instead of $99/month - saving you $240 per year. Annual plans also include priority onboarding and a dedicated success call.'
  },
  {
    question: 'What\'s included in AI negotiations?',
    answer: 'Our AI negotiations feature automatically handles back-and-forth with suppliers on your behalf. It negotiates pricing, terms, delivery schedules, and conditions - all while keeping you in the approval loop. You set the parameters, Wells executes.'
  },
  {
    question: 'Can I upgrade or downgrade anytime?',
    answer: 'Absolutely. Upgrade instantly and get prorated billing. Downgrade at the end of your billing cycle. No long-term contracts, no hidden fees, no cancellation penalties.'
  },
  {
    question: 'What integrations do you support?',
    answer: 'Pro includes Slack, email, and basic webhooks. Enterprise includes full integrations with NetSuite, SAP, Dynamics 365, Salesforce, HubSpot, and any system with an API. We also offer custom integration development.'
  },
  {
    question: 'Is there a free trial for Pro?',
    answer: 'Yes! Start with our Free tier and upgrade to Pro with a 14-day trial. No credit card required to try. If you love it, continue. If not, drop back to Free with no questions asked.'
  },
  {
    question: 'What does the Enterprise SLA cover?',
    answer: 'Enterprise SLA guarantees 99.9% uptime, 1-hour response time for critical issues, 24/7 support access, and dedicated infrastructure. We also provide quarterly business reviews and a named technical account manager.'
  },
  {
    question: 'How is the success fee calculated?',
    answer: 'The 1% fee is calculated on the final transaction value after negotiations. It\'s only charged when the deal closes and payment is processed. For Enterprise customers, we offer volume-based fee reductions.'
  },
]

// Comparison table data
const COMPARISON = [
  { feature: 'RFQs per month', free: '5', pro: 'Unlimited', enterprise: 'Unlimited' },
  { feature: 'AI Negotiations', free: '-', pro: 'Included', enterprise: 'Included + Custom Training' },
  { feature: 'Matching Algorithm', free: 'Standard', pro: 'Priority', enterprise: 'Priority + Custom Weights' },
  { feature: 'Support', free: 'Email', pro: 'Phone & Email', enterprise: '24/7 Dedicated' },
  { feature: 'Team Seats', free: '1', pro: '5', enterprise: 'Unlimited' },
  { feature: 'Integrations', free: '-', pro: 'Standard', enterprise: 'Custom' },
  { feature: 'API Access', free: '-', pro: 'Read-only', enterprise: 'Full Access' },
  { feature: 'SLA', free: '-', pro: '-', enterprise: '99.9% Uptime' },
  { feature: 'Account Manager', free: '-', pro: '-', enterprise: 'Dedicated' },
]

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(true)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0f1a] transition-colors">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600&display=swap');
        .font-playfair { font-family: 'Playfair Display', Georgia, serif; }

        .glassmorphic {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .glassmorphic-light {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .gold-glow {
          box-shadow: 0 0 40px rgba(245, 158, 11, 0.15), 0 0 80px rgba(245, 158, 11, 0.1);
        }

        .gold-border {
          border-image: linear-gradient(135deg, #fbbf24, #f59e0b, #d97706) 1;
        }
      `}</style>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#030712]/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-white font-semibold text-[17px] group">
            <div className="relative">
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-all">
                <Coins className="w-5 h-5 text-black" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-amber-500 rounded-sm" />
            </div>
            Grain & Vault
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/how-it-works" className="text-sm text-gray-400 hover:text-white transition-colors">
              How It Works
            </Link>
            <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
              Home
            </Link>
            <Link
              href="/join"
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-black text-sm font-medium rounded-xl hover:from-emerald-400 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/20"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-8 bg-gradient-to-b from-amber-50/50 via-white to-white dark:from-amber-500/5 dark:via-[#0a0f1a] dark:to-[#0a0f1a]">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <div className="inline-flex px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 rounded-full text-[11px] font-semibold text-white uppercase tracking-wider mb-6 shadow-lg shadow-amber-500/25">
            Simple, Transparent Pricing
          </div>
          <h1 className="font-playfair text-[clamp(40px,5vw,60px)] font-medium text-gray-900 dark:text-white mb-5 tracking-tight">
            Pay Only When{' '}
            <span className="bg-gradient-to-r from-amber-500 to-amber-600 bg-clip-text text-transparent">
              Deals Close
            </span>
          </h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-4">
            Choose your plan, then only pay our 1% success fee when transactions complete.
            Your success is our success.
          </p>
        </div>
      </section>

      {/* Success Fee Banner */}
      <section className="pb-12">
        <div className="max-w-[800px] mx-auto px-6">
          <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-6 md:p-8 text-center gold-glow">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
            <div className="relative">
              <div className="flex items-center justify-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-white/90" />
                <span className="text-white/90 text-sm font-medium uppercase tracking-wider">Success-Based Model</span>
              </div>
              <div className="flex items-baseline justify-center gap-2 mb-3">
                <span className="text-6xl md:text-7xl font-bold text-white">1%</span>
                <span className="text-2xl font-medium text-white/80">success fee</span>
              </div>
              <p className="text-white/90 text-lg max-w-md mx-auto">
                Only pay when deals close. No upfront costs. No hidden fees.
                <br />
                <span className="text-white/70 text-sm">Applied to closed transaction value</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Billing Toggle */}
      <section className="pb-8">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm font-medium transition-colors ${!isAnnual ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                isAnnual
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                  isAnnual ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium transition-colors ${isAnnual ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
              Annual
            </span>
            {isAnnual && (
              <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold rounded-full">
                Save 20%
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {TIERS.map((tier, i) => {
              const Icon = tier.icon
              const price = isAnnual ? tier.annualPrice : tier.monthlyPrice
              const isPopular = tier.popular

              return (
                <div
                  key={i}
                  className={`relative rounded-3xl p-8 transition-all duration-300 hover:-translate-y-1 ${
                    isPopular
                      ? 'glassmorphic-light dark:glassmorphic border-2 border-amber-400/50 dark:border-amber-500/30 gold-glow'
                      : 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 hover:shadow-xl'
                  }`}
                >
                  {/* Popular Badge */}
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <div className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg shadow-amber-500/30 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Most Popular
                      </div>
                    </div>
                  )}

                  {/* Header */}
                  <div className="mb-6">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                      tier.color === 'gray'
                        ? 'bg-gray-100 dark:bg-white/10'
                        : tier.color === 'amber'
                        ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/25'
                        : 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25'
                    }`}>
                      <Icon className={`w-6 h-6 ${
                        tier.color === 'gray' ? 'text-gray-600 dark:text-gray-400' : 'text-white'
                      }`} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{tier.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{tier.description}</p>
                  </div>

                  {/* Price */}
                  <div className="mb-6 pb-6 border-b border-gray-200 dark:border-white/10">
                    {price !== null ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-gray-900 dark:text-white">${price}</span>
                        <span className="text-gray-500 dark:text-gray-400">{tier.priceLabel}</span>
                      </div>
                    ) : (
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{tier.priceLabel}</div>
                    )}
                    {isAnnual && tier.monthlyPrice !== null && tier.monthlyPrice > 0 && (
                      <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                        <span className="line-through">${tier.monthlyPrice}/mo</span>
                        <span className="text-emerald-600 dark:text-emerald-400 ml-2">Save ${(tier.monthlyPrice - (tier.annualPrice || 0)) * 12}/yr</span>
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {tier.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-3">
                        {feature.included ? (
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isPopular
                              ? 'bg-amber-100 dark:bg-amber-500/20'
                              : 'bg-emerald-100 dark:bg-emerald-500/20'
                          }`}>
                            <Check className={`w-3 h-3 ${
                              isPopular ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`} />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-gray-300 dark:text-gray-600 text-xs">-</span>
                          </div>
                        )}
                        <span className={`text-sm ${
                          feature.included
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-gray-400 dark:text-gray-600'
                        }`}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Link
                    href={tier.ctaLink}
                    className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium transition-all ${
                      isPopular
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40'
                        : tier.color === 'violet'
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                        : 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/20'
                    }`}
                  >
                    {tier.cta}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )
            })}
          </div>

          {/* Plus success fee note */}
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
            All plans include our 1% success fee on closed transactions. No fees if no deals close.
          </p>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-24 bg-gray-50 dark:bg-white/[0.02]">
        <div className="max-w-[1000px] mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-playfair text-3xl font-medium text-gray-900 dark:text-white mb-4">
              Compare Plans
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400">
              Find the right plan for your team
            </p>
          </div>

          <div className="bg-white dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/10">
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-900 dark:text-white">Feature</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-gray-500 dark:text-gray-400">Free</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10">Pro</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-gray-500 dark:text-gray-400">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-white/5 last:border-b-0">
                    <td className="py-4 px-6 text-sm text-gray-700 dark:text-gray-300">{row.feature}</td>
                    <td className="py-4 px-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      {row.free === '-' ? <span className="text-gray-300 dark:text-gray-600">-</span> : row.free}
                    </td>
                    <td className="py-4 px-4 text-center text-sm font-medium text-gray-900 dark:text-white bg-amber-50/50 dark:bg-amber-500/5">
                      {row.pro === '-' ? <span className="text-gray-300 dark:text-gray-600">-</span> : row.pro}
                    </td>
                    <td className="py-4 px-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      {row.enterprise === '-' ? <span className="text-gray-300 dark:text-gray-600">-</span> : row.enterprise}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24">
        <div className="max-w-[800px] mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex px-3.5 py-1.5 bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/20 rounded-full text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-5">
              FAQ
            </div>
            <h2 className="font-playfair text-3xl font-medium text-gray-900 dark:text-white mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400">
              Everything you need to know about pricing and billing
            </p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden transition-all hover:border-gray-300 dark:hover:border-white/20"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="text-[15px] font-medium text-gray-900 dark:text-white pr-4">{faq.question}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    openFaq === i
                      ? 'bg-amber-100 dark:bg-amber-500/20'
                      : 'bg-gray-100 dark:bg-white/10'
                  }`}>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        openFaq === i
                          ? 'rotate-180 text-amber-600 dark:text-amber-400'
                          : 'text-gray-400'
                      }`}
                    />
                  </div>
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
      <section className="py-20 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 dark:from-gray-900 dark:via-gray-800 dark:to-black relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />

        {/* Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-amber-500/10 rounded-full blur-[120px]" />

        <div className="max-w-[1200px] mx-auto px-6 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-semibold text-white/80 uppercase tracking-wider mb-6 border border-white/10">
            <Building2 className="w-3.5 h-3.5" />
            Enterprise
          </div>
          <h2 className="text-4xl font-semibold text-white mb-4">
            Need a Custom Solution?
          </h2>
          <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto">
            Get custom pricing, dedicated support, and enterprise-grade features
            tailored to your organization's needs.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40"
            >
              Talk to Sales
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/join"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-all"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-8 text-white/40 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>SOC 2 Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <BadgeCheck className="w-4 h-4" />
              <span>99.9% Uptime SLA</span>
            </div>
            <div className="flex items-center gap-2">
              <Headphones className="w-4 h-4" />
              <span>24/7 Support</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10 bg-[#030712]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-3 text-white font-semibold text-[17px]">
              <div className="relative">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <Coins className="w-4 h-4 text-black" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-sm" />
              </div>
              Grain & Vault
            </Link>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-white/40 text-xs">
                <Brain className="w-3 h-3" />
                <span>Powered by WellsAI</span>
              </div>
              <p className="text-sm text-gray-500">
                © 2025 Grain & Vault
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
