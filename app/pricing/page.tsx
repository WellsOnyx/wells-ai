'use client'

import { useRouter } from 'next/navigation'
import { Check, Sparkles, TrendingUp, ShoppingCart, Briefcase, Zap } from 'lucide-react'

export default function PricingPage() {
  const router = useRouter()

  const plans = [
    {
      name: 'Seller',
      icon: TrendingUp,
      price: 500,
      description: 'Launch GTM campaigns that actually work',
      features: [
        '50 leads per month from Apollo.io',
        'AI-generated personalized outreach',
        'Email campaigns via Instantly.ai',
        'Campaign performance tracking',
        'Unlimited campaign creation',
        'Response handling & follow-ups',
        'Meeting scheduling automation',
        'Wells AI companion 24/7'
      ],
      cta: 'Start Selling',
      journey: 'seller',
      highlight: false
    },
    {
      name: 'Founder',
      icon: Sparkles,
      price: 1000,
      description: 'Your AI operating system for everything',
      features: [
        'Everything in Seller + Buyer + Job Seeker',
        'Cross-journey orchestration',
        'Business analytics & insights',
        'Unlimited everything',
        'Priority support',
        'Custom integrations',
        'Dedicated success manager',
        'Wells AI working 24/7 across all areas'
      ],
      cta: 'Run Your Business',
      journey: 'founder',
      highlight: true
    },
    {
      name: 'Buyer',
      icon: ShoppingCart,
      price: 300,
      description: 'Procurement made simple',
      features: [
        'Unlimited RFQ creation',
        'Supplier matching & discovery',
        '7+ verified suppliers',
        'Quote comparison tools',
        'Automated negotiation',
        'Contract generation',
        'Payment processing (coming)',
        'Wells AI handles procurement'
      ],
      cta: 'Start Sourcing',
      journey: 'buyer',
      highlight: false
    },
    {
      name: 'Job Seeker',
      icon: Briefcase,
      price: 200,
      description: 'Land your dream job faster',
      features: [
        'Unlimited job search',
        'AI applies to jobs for you',
        'Resume optimization for ATS',
        'Interview prep & coaching',
        'Salary negotiation assistant',
        'Application tracking',
        '8+ curated opportunities',
        'Wells AI is your career coach'
      ],
      cta: 'Find Your Job',
      journey: 'job_seeker',
      highlight: false
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            AI That Actually <span className="text-amber-500">Does The Work</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Not another chatbot that just gives advice. Wells takes real action - launches campaigns, sources products, applies to jobs. Pick your journey.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {plans.map((plan) => {
            const Icon = plan.icon
            return (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 ${
                  plan.highlight
                    ? 'bg-gradient-to-br from-amber-600 to-amber-700 border-2 border-amber-400 shadow-2xl shadow-amber-500/20 scale-105'
                    : 'bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-black text-amber-400 px-4 py-1 rounded-full text-sm font-bold border border-amber-400">
                    MOST POPULAR
                  </div>
                )}

                <div className="mb-6">
                  <Icon className={`w-12 h-12 mb-4 ${plan.highlight ? 'text-black' : 'text-amber-500'}`} />
                  <h3 className={`text-2xl font-bold mb-2 ${plan.highlight ? 'text-black' : 'text-white'}`}>
                    {plan.name}
                  </h3>
                  <p className={`text-sm mb-4 ${plan.highlight ? 'text-black/80' : 'text-gray-400'}`}>
                    {plan.description}
                  </p>
                  <div className="flex items-baseline mb-6">
                    <span className={`text-4xl font-bold ${plan.highlight ? 'text-black' : 'text-white'}`}>
                      ${plan.price}
                    </span>
                    <span className={`ml-2 ${plan.highlight ? 'text-black/70' : 'text-gray-400'}`}>
                      /month
                    </span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <Check className={`w-5 h-5 mr-3 flex-shrink-0 mt-0.5 ${
                        plan.highlight ? 'text-black' : 'text-amber-500'
                      }`} />
                      <span className={`text-sm ${plan.highlight ? 'text-black' : 'text-gray-300'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => router.push(`/sign-up?journey=${plan.journey}`)}
                  className={`w-full py-3 px-6 rounded-full font-semibold transition-all ${
                    plan.highlight
                      ? 'bg-black text-amber-400 hover:bg-gray-900'
                      : 'bg-amber-500 text-black hover:bg-amber-400'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            )
          })}
        </div>

        {/* Trust Indicators */}
        <div className="text-center mb-16">
          <p className="text-gray-400 mb-8">Powered by the best tools in the business</p>
          <div className="flex justify-center items-center gap-12 flex-wrap opacity-60">
            <div className="text-gray-400 font-semibold">Apollo.io</div>
            <div className="text-gray-400 font-semibold">Instantly.ai</div>
            <div className="text-gray-400 font-semibold">Claude Sonnet 4.5</div>
            <div className="text-gray-400 font-semibold">Anthropic</div>
          </div>
        </div>

        {/* ROI Section */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-12 border border-gray-700 mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              The Math Makes Sense
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Wells pays for itself in the first week. Here's how:
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-amber-500 mb-2">20+ hrs</div>
              <div className="text-gray-400">Saved per week</div>
              <div className="text-sm text-gray-500 mt-2">
                No more manual lead searching, email writing, or job applications
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-amber-500 mb-2">$10K+</div>
              <div className="text-gray-400">Cost of hiring equivalent</div>
              <div className="text-sm text-gray-500 mt-2">
                VA, SDR, or recruiter would cost 10-20x more per month
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-amber-500 mb-2">24/7</div>
              <div className="text-gray-400">Always working</div>
              <div className="text-sm text-gray-500 mt-2">
                Wells never sleeps, never takes vacation, always on your side
              </div>
            </div>
          </div>
        </div>

        {/* FAQs */}
        <div className="max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Questions?
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">
                What's the difference between this and ChatGPT?
              </h3>
              <p className="text-gray-400">
                ChatGPT gives advice. Wells takes action. We actually launch your campaigns, find suppliers, apply to jobs - real work gets done.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Can I switch plans?
              </h3>
              <p className="text-gray-400">
                Absolutely. Upgrade to Founder to get all journeys, or switch between Seller/Buyer/Job Seeker anytime.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Do I need Apollo or Instantly accounts?
              </h3>
              <p className="text-gray-400">
                Nope! We include everything. Leads, email sending, AI - it's all built in. Just sign up and start.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">
                What if I need help?
              </h3>
              <p className="text-gray-400">
                Wells is your companion 24/7. Plus, Founder plan includes a dedicated success manager.
              </p>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center">
          <button
            onClick={() => router.push('/sign-up')}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black px-8 py-4 rounded-full text-lg font-bold hover:scale-105 transition-transform shadow-lg shadow-amber-500/30"
          >
            <Zap className="w-6 h-6" />
            Start Free Trial
          </button>
          <p className="text-gray-400 mt-4">
            14-day free trial. No credit card required.
          </p>
        </div>
      </div>
    </div>
  )
}
