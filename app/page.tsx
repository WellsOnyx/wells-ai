'use client'

/**
 * Wells Onyx Landing Page - 2025 Modern Design
 * wellsonyx.io
 *
 * Glassmorphism + Bento Grid + Premium Animations
 * Just tell Wells what you need. Get it done.
 */

import Link from 'next/link'
import {
  Rocket,
  ShoppingCart,
  Store,
  Briefcase,
  ArrowRight,
  MessageSquare,
  Sparkles,
  Shield,
  TrendingUp,
  Users,
  Clock,
  DollarSign,
  Zap,
  Target,
  Lock,
  Handshake,
  CheckCircle
} from 'lucide-react'
import {
  GlassCard,
  BentoGrid,
  BentoItem,
  ShimmerButton,
  FloatingBadge,
  MetricCard,
  JourneyCard,
  GlowOrb,
  NoiseOverlay,
  AnimatedText
} from '@/components/ui/modern'

const JOURNEYS = [
  {
    icon: <Rocket className="w-7 h-7 text-white" />,
    title: 'Founder',
    tagline: '"I need to hire a CTO"',
    description: 'Tell Wells what you\'re building. Get matched with talent, suppliers, customers, and investors.',
    href: '/founder/chat',
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    featured: true
  },
  {
    icon: <ShoppingCart className="w-7 h-7 text-white" />,
    title: 'Buyer',
    tagline: '"I need industrial equipment"',
    description: 'Describe what you need. Wells writes the RFQ, finds suppliers, and handles escrow.',
    href: '/buyer/chat',
    gradient: 'from-blue-500 via-cyan-500 to-teal-500'
  },
  {
    icon: <Store className="w-7 h-7 text-white" />,
    title: 'Seller',
    tagline: '"Send me qualified leads"',
    description: 'Register your catalog. Wells matches you with buyers. Win more business.',
    href: '/suppliers/join',
    gradient: 'from-green-500 via-emerald-500 to-teal-500'
  },
  {
    icon: <Briefcase className="w-7 h-7 text-white" />,
    title: 'Jobs',
    tagline: '"I\'m looking for VP roles"',
    description: 'Tell Wells your ideal role. Get matched with companies actually hiring.',
    href: '/jobs/chat',
    gradient: 'from-purple-500 via-pink-500 to-rose-500'
  }
]

const FEATURES = [
  {
    icon: Target,
    title: 'AI Matching',
    description: 'Perfect matches in seconds',
    gradient: 'from-blue-500 to-cyan-500'
  },
  {
    icon: Lock,
    title: 'Escrow',
    description: 'Safe payments built-in',
    gradient: 'from-green-500 to-emerald-500'
  },
  {
    icon: Handshake,
    title: 'Negotiate',
    description: 'Close deals faster',
    gradient: 'from-purple-500 to-pink-500'
  },
  {
    icon: Zap,
    title: '24-48h',
    description: 'Quote turnaround',
    gradient: 'from-amber-500 to-orange-500'
  }
]

export default function WellsOnyxHome() {
  return (
    <div className="min-h-screen bg-black text-white antialiased overflow-x-hidden">
      {/* Noise Texture Overlay */}
      <NoiseOverlay />

      {/* Ambient Glow Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <GlowOrb color="amber" size="xl" position={{ top: '-200px', left: '20%' }} />
        <GlowOrb color="purple" size="lg" position={{ bottom: '10%', right: '-100px' }} animate={false} />
        <GlowOrb color="blue" size="md" position={{ top: '50%', left: '-50px' }} />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50">
          <GlassCard hover={false} padding="none" className="rounded-none border-x-0 border-t-0">
            <div className="container mx-auto px-4 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <Link href="/" className="flex items-center gap-3 group">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/40 transition-all group-hover:scale-110">
                    <Sparkles className="w-5 h-5 text-black" />
                  </div>
                  <span className="text-xl font-bold tracking-tight">
                    <AnimatedText text="WellsAI" gradient gradientColors="from-white via-white to-gray-400" />
                  </span>
                </Link>

                <nav className="hidden md:flex items-center gap-8">
                  <Link href="#journeys" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                    Journeys
                  </Link>
                  <Link href="#how-it-works" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                    How It Works
                  </Link>
                  <Link href="/sign-in" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                    Sign In
                  </Link>
                  <ShimmerButton size="sm" onClick={() => window.location.href = '/founder/chat'}>
                    Get Started
                  </ShimmerButton>
                </nav>

                {/* Mobile */}
                <div className="md:hidden flex items-center gap-3">
                  <ShimmerButton size="sm" onClick={() => window.location.href = '/founder/chat'}>
                    Start
                  </ShimmerButton>
                </div>
              </div>
            </div>
          </GlassCard>
        </header>

        {/* Hero Section */}
        <section className="pt-32 pb-20 md:pt-40 md:pb-32 px-4 lg:px-8 relative">
          {/* Animated background shapes */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl animate-float" />
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '-3s' }} />
          </div>

          <div className="max-w-5xl mx-auto text-center relative">
            {/* Badge */}
            <div className="flex justify-center mb-8 animate-slide-up">
              <FloatingBadge color="amber">
                AI That Actually Does Things
              </FloatingBadge>
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight animate-slide-up" style={{ animationDelay: '100ms' }}>
              <span className="block text-gradient-silver">
                Talk to Wells.
              </span>
              <span className="block">
                <AnimatedText
                  text="Get It Done."
                  gradient
                  gradientColors="from-amber-400 via-amber-500 to-orange-500"
                  className="text-5xl md:text-7xl lg:text-8xl font-bold"
                />
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-gray-400 mb-4 max-w-3xl mx-auto animate-slide-up" style={{ animationDelay: '200ms' }}>
              Need to hire? Source suppliers? Find customers? Close deals?
            </p>
            <p className="text-2xl md:text-3xl text-white font-semibold mb-12 animate-slide-up" style={{ animationDelay: '300ms' }}>
              Just tell Wells what you need.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-slide-up" style={{ animationDelay: '400ms' }}>
              <ShimmerButton size="lg" onClick={() => window.location.href = '/founder/chat'}>
                Talk to Wells Now
                <ArrowRight className="w-5 h-5" />
              </ShimmerButton>
              <ShimmerButton variant="secondary" size="lg" onClick={() => window.location.href = '/demo'}>
                See What Wells Can Do
              </ShimmerButton>
            </div>

            {/* Trust Metrics - Bento Style */}
            <BentoGrid cols={4} className="max-w-4xl mx-auto">
              <BentoItem>
                <MetricCard
                  value="$2.3M+"
                  label="Deals Closed"
                  icon={<DollarSign className="w-7 h-7 text-amber-400" />}
                />
              </BentoItem>
              <BentoItem>
                <MetricCard
                  value="500+"
                  label="Active Users"
                  icon={<Users className="w-7 h-7 text-amber-400" />}
                />
              </BentoItem>
              <BentoItem>
                <MetricCard
                  value="< 48h"
                  label="Response Time"
                  icon={<Clock className="w-7 h-7 text-amber-400" />}
                />
              </BentoItem>
              <BentoItem>
                <MetricCard
                  value="1%"
                  label="Simple Fee"
                  icon={<TrendingUp className="w-7 h-7 text-amber-400" />}
                />
              </BentoItem>
            </BentoGrid>
          </div>
        </section>

        {/* Journeys Section - Bento Grid */}
        <section id="journeys" className="py-24 px-4 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <FloatingBadge color="purple" pulse={false}>
                4 Journeys
              </FloatingBadge>
              <h2 className="text-4xl md:text-6xl font-bold mt-6 mb-4 tracking-tight">
                What Do You Need?
              </h2>
              <p className="text-xl text-gray-400">Tell Wells. Watch it happen.</p>
            </div>

            <BentoGrid cols={2} className="gap-6">
              {JOURNEYS.map((journey, index) => (
                <BentoItem key={index}>
                  <JourneyCard
                    icon={journey.icon}
                    title={journey.title}
                    tagline={journey.tagline}
                    description={journey.description}
                    gradient={journey.gradient}
                    href={journey.href}
                    featured={journey.featured}
                  />
                </BentoItem>
              ))}
            </BentoGrid>
          </div>
        </section>

        {/* Features Grid - Compact Bento */}
        <section className="py-24 px-4 lg:px-8 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/5 to-transparent pointer-events-none" />

          <div className="max-w-6xl mx-auto relative">
            <div className="text-center mb-16">
              <FloatingBadge color="green">Platform Features</FloatingBadge>
              <h2 className="text-4xl md:text-5xl font-bold mt-6 mb-4">
                Everything You Need
              </h2>
            </div>

            <BentoGrid cols={4}>
              {FEATURES.map((feature, index) => (
                <BentoItem key={index}>
                  <GlassCard hover glow="amber" className="h-full text-center">
                    <div className={`w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center`}>
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                    <p className="text-sm text-gray-400">{feature.description}</p>
                  </GlassCard>
                </BentoItem>
              ))}
            </BentoGrid>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-24 px-4 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <FloatingBadge color="blue">Simple Process</FloatingBadge>
              <h2 className="text-4xl md:text-5xl font-bold mt-6 mb-4">
                How Wells Works
              </h2>
              <p className="text-xl text-gray-400">Three steps. Zero complexity.</p>
            </div>

            <BentoGrid cols={3}>
              {[
                {
                  step: '01',
                  icon: MessageSquare,
                  title: 'Talk to Wells',
                  description: 'Tell Wells what you need in plain English. No forms, no templates.'
                },
                {
                  step: '02',
                  icon: Zap,
                  title: 'Wells Works',
                  description: 'AI finds matches, sends outreach, coordinates everything automatically.'
                },
                {
                  step: '03',
                  icon: CheckCircle,
                  title: 'You Close',
                  description: 'Review results, negotiate terms, close deals with built-in escrow.'
                }
              ].map((step, index) => (
                <BentoItem key={index}>
                  <GlassCard hover glow="amber" className="h-full text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-3xl font-bold text-black shadow-2xl shadow-amber-500/30">
                      {step.step}
                    </div>
                    <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <step.icon className="w-6 h-6 text-amber-400" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                    <p className="text-gray-400">{step.description}</p>
                  </GlassCard>
                </BentoItem>
              ))}
            </BentoGrid>
          </div>
        </section>

        {/* Pricing - Premium Glass Card */}
        <section className="py-24 px-4 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <GlassCard hover={false} padding="lg" className="relative overflow-hidden">
              {/* Background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-purple-500/10 pointer-events-none" />

              <div className="relative grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <FloatingBadge color="amber">Pay Only When You Win</FloatingBadge>
                  <h2 className="text-4xl md:text-5xl font-bold mt-6 mb-6">
                    1% Success Fee
                  </h2>
                  <p className="text-gray-400 text-lg mb-8">
                    We only charge when you close a deal. Everything else is free.
                  </p>
                  <ul className="space-y-4">
                    {['Free to search and get quotes', 'Free matching and introductions', '1% only on completed deals', 'Built-in escrow protection'].map((item, i) => (
                      <li key={i} className="flex items-center gap-3 text-gray-300">
                        <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="text-center">
                  <GlassCard hover={false} padding="lg">
                    <div className="text-7xl md:text-8xl font-bold mb-3">
                      <AnimatedText text="1%" gradient gradientColors="from-amber-400 to-amber-600" />
                    </div>
                    <div className="text-gray-400 text-lg mb-8">of deal value</div>
                    <ShimmerButton className="w-full" size="lg" onClick={() => window.location.href = '/founder/chat'}>
                      Start for Free
                    </ShimmerButton>
                    <p className="text-sm text-gray-500 mt-4">No credit card required</p>
                  </GlassCard>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 px-4 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden">
              {/* Gradient Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-amber-600" />

              {/* Decorative orbs */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl" />

              <div className="relative p-12 md:p-16 text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-6 text-black/80" />
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-black mb-6 tracking-tight">
                  Stop Searching.
                  <br />
                  Start Talking.
                </h2>
                <p className="text-xl md:text-2xl text-black/80 mb-10 max-w-2xl mx-auto">
                  Tell Wells what you need. Get it done.
                </p>
                <button
                  onClick={() => window.location.href = '/founder/chat'}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-900 transition-all hover:scale-105 hover:shadow-2xl"
                >
                  Talk to Wells Now
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10">
          <GlassCard hover={false} padding="none" className="rounded-none border-x-0 border-b-0">
            <div className="container mx-auto px-4 lg:px-8 py-16">
              <div className="grid md:grid-cols-4 gap-12 mb-12">
                <div className="md:col-span-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-black" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">WellsAI</span>
                  </div>
                  <p className="text-gray-400 text-sm">
                    AI that turns conversations into outcomes.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-4 text-sm">Journeys</h4>
                  <ul className="space-y-3 text-sm text-gray-400">
                    <li><Link href="/founder/chat" className="hover:text-white transition-colors">Founder</Link></li>
                    <li><Link href="/buyer/chat" className="hover:text-white transition-colors">Buyer</Link></li>
                    <li><Link href="/suppliers/join" className="hover:text-white transition-colors">Seller</Link></li>
                    <li><Link href="/jobs/chat" className="hover:text-white transition-colors">Jobs</Link></li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-4 text-sm">Resources</h4>
                  <ul className="space-y-3 text-sm text-gray-400">
                    <li><Link href="/wells-ai/blog" className="text-amber-400 hover:text-amber-300 transition-colors">Blog</Link></li>
                    <li><Link href="#how-it-works" className="hover:text-white transition-colors">How It Works</Link></li>
                    <li><Link href="/demo" className="hover:text-white transition-colors">See Demo</Link></li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-4 text-sm">Get Started</h4>
                  <ul className="space-y-3 text-sm text-gray-400">
                    <li><Link href="/founder/chat" className="hover:text-white transition-colors">Talk to Wells</Link></li>
                    <li><Link href="/sign-in" className="hover:text-white transition-colors">Sign In</Link></li>
                    <li><Link href="/grain-vault" className="text-green-400 hover:text-green-300 transition-colors">Grain & Vault</Link></li>
                  </ul>
                </div>
              </div>

              <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-sm text-gray-500">2025 WellsAI. All rights reserved.</p>
                <div className="flex items-center gap-6 text-sm text-gray-500">
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-500" />
                    Enterprise Security
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    All Systems Operational
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>
        </footer>
      </div>
    </div>
  )
}
