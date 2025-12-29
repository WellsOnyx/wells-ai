'use client'

/**
 * WellsAI Premium Landing Page
 * Clean, light design with orbital journey selector and live ecosystem visualization
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import HeroChat from '@/components/HeroChat'
import EcosystemVisualization from '@/components/EcosystemVisualization'
import ThemeToggle from '@/components/ThemeToggle'

export default function WellsAILanding() {
  const [activeConnections, setActiveConnections] = useState(847)
  const [matchesToday, setMatchesToday] = useState(23)

  // Live stats updates
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveConnections(prev => prev + Math.floor(Math.random() * 3))
      if (Math.random() > 0.7) {
        setMatchesToday(prev => prev + 1)
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0f1a] text-gray-900 dark:text-white font-sans antialiased transition-colors duration-300">
      {/* Custom Styles */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&display=swap');

        :root {
          --navy-900: #0a0f1a;
          --navy-800: #111827;
          --blue-500: #3b82f6;
          --violet-500: #8b5cf6;
          --emerald-500: #10b981;
          --amber-500: #f59e0b;
        }

        .font-playfair {
          font-family: 'Playfair Display', Georgia, serif;
        }

        @keyframes pulse-soft {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes msg-appear {
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes bounce-dots {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }

        @keyframes rotate-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes pulse-ring {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
          100% { transform: translate(-50%, -50%) scale(1.3); opacity: 0; }
        }

        @keyframes rotate-ring {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @keyframes node-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }

        @keyframes feed-in {
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-pulse-soft {
          animation: pulse-soft 2s ease-in-out infinite;
        }

        .chat-message-animate {
          opacity: 0;
          transform: translateY(8px);
          animation: msg-appear 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .typing-dot {
          animation: bounce-dots 1.4s ease-in-out infinite;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.15s; }
        .typing-dot:nth-child(3) { animation-delay: 0.3s; }

        .hub-ring-rotate {
          animation: rotate-slow 20s linear infinite;
        }

        .hub-ring-rotate-reverse {
          animation: rotate-slow 30s linear infinite reverse;
        }

        .hub-ring-pulse {
          animation: pulse-ring 3s ease-out infinite;
        }

        .hub-ring-pulse-delayed {
          animation: pulse-ring 3s ease-out infinite 1s;
        }

        .ring-rotate {
          animation: rotate-ring 20s linear infinite;
        }

        .node-pulse {
          animation: node-pulse 2s ease-in-out infinite;
        }

        .activity-animate {
          opacity: 0;
          transform: translateY(10px);
          animation: feed-in 0.4s ease forwards;
        }
      `}</style>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#0a0f1a]/80 backdrop-blur-xl border-b border-black/5 dark:border-white/10">
        <div className="max-w-[1200px] mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-gray-900 dark:text-white font-semibold text-[17px] tracking-tight">
            <div className="w-7 h-7 bg-gradient-to-br from-gray-800 to-gray-900 dark:from-blue-500 dark:to-violet-500 rounded-[7px] flex items-center justify-center text-white text-[13px] font-bold">
              W
            </div>
            WellsAI
          </Link>

          <div className="flex items-center gap-2">
            <Link href="#journeys" className="text-gray-600 dark:text-gray-300 text-sm font-medium px-3.5 py-2 rounded-lg hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
              Workflows
            </Link>
            <Link href="#enterprise" className="text-gray-600 dark:text-gray-300 text-sm font-medium px-3.5 py-2 rounded-lg hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
              Use Cases
            </Link>
            <Link href="#pricing" className="text-gray-600 dark:text-gray-300 text-sm font-medium px-3.5 py-2 rounded-lg hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
              Pricing
            </Link>
            <Link href="/wells-ai/blog" className="text-gray-600 dark:text-gray-300 text-sm font-medium px-3.5 py-2 rounded-lg hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
              Blog
            </Link>
            <ThemeToggle variant="minimal" />
            <Link
              href="/founder/chat"
              className="ml-2 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-[10px] hover:bg-gray-800 dark:hover:bg-gray-100 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              Start Workflow
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-36 pb-24 bg-gradient-to-b from-gray-50 to-white dark:from-[#0a0f1a] dark:to-[#0a0f1a] overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-20 items-center">
            {/* Left - Copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-full text-[13px] font-medium text-gray-600 dark:text-gray-300 mb-6 shadow-sm">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse-soft" />
                Enterprise AI That Executes
              </div>

              <h1 className="font-playfair text-[clamp(44px,5.5vw,64px)] font-medium leading-[1.1] text-gray-900 dark:text-white mb-5 tracking-tight">
                Describe. Deploy.
                <br />
                <em className="bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">Done.</em>
              </h1>

              <p className="text-lg text-gray-500 dark:text-gray-400 mb-8 leading-relaxed max-w-[480px]">
                Indirect sourcing. Enterprise sales. Executive hiring. Strategic partnerships. Tell Wells your objective — watch it execute.
              </p>

              <div className="flex gap-3 flex-wrap">
                <Link
                  href="/founder/chat"
                  className="px-7 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[15px] font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all hover:-translate-y-0.5 hover:shadow-xl"
                >
                  Start a Workflow →
                </Link>
                <Link
                  href="#how"
                  className="px-7 py-3.5 bg-white dark:bg-white/10 text-gray-700 dark:text-white text-[15px] font-medium rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/20 hover:border-gray-300 dark:hover:border-white/20 transition-all"
                >
                  See Platform
                </Link>
              </div>
            </div>

            {/* Right - Interactive Chat with Wells */}
            <div className="relative">
              {/* Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.08)_0%,transparent_70%)] pointer-events-none" />

              <HeroChat />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-b border-gray-200 dark:border-white/10">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '$2.3M+', label: 'Pipeline Generated' },
              { value: '500+', label: 'Enterprise Users' },
              { value: '< 48h', label: 'Vendor Response' },
              { value: '33bps', label: 'Success Fee' }
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight mb-1">{stat.value}</div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflows Section */}
      <section id="journeys" className="py-28">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex px-3.5 py-1.5 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full text-[11px] font-semibold text-white uppercase tracking-wider mb-5">
              Workflows
            </div>
            <h2 className="font-playfair text-[clamp(36px,4vw,48px)] font-medium text-gray-900 dark:text-white mb-4 tracking-tight">
              Enterprise Workflows
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400">Describe your objective. Wells handles execution.</p>
          </div>

          {/* Workflow Cards Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: '🏢',
                title: 'Indirect Sourcing',
                example: '"Source MRO suppliers in APAC"',
                desc: 'RFQs, vendor qualification, competitive bidding, contract negotiation.',
                href: '/founder/chat',
                color: 'blue',
                bgColor: 'bg-blue-50 dark:bg-blue-500/10'
              },
              {
                icon: '📈',
                title: 'Enterprise Sales',
                example: '"Find F500 procurement leads"',
                desc: 'Target account identification, outreach sequences, meeting scheduling.',
                href: '/buyer/chat',
                color: 'violet',
                bgColor: 'bg-violet-50 dark:bg-violet-500/10'
              },
              {
                icon: '👔',
                title: 'Executive Search',
                example: '"Hire a CFO with PE experience"',
                desc: 'Candidate sourcing, screening, scheduling, offer negotiation.',
                href: '/suppliers/join',
                color: 'emerald',
                bgColor: 'bg-emerald-50 dark:bg-emerald-500/10'
              },
              {
                icon: '🤝',
                title: 'Strategic Partnerships',
                example: '"Find channel partners in EMEA"',
                desc: 'Partner identification, outreach, deal structuring, onboarding.',
                href: '/jobs/chat',
                color: 'amber',
                bgColor: 'bg-amber-50 dark:bg-amber-500/10'
              }
            ].map((journey, i) => (
              <div
                key={i}
                className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-7 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-white/5 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-300 group"
              >
                <div className={`w-11 h-11 ${journey.bgColor} rounded-xl flex items-center justify-center text-lg mb-4`}>
                  {journey.icon}
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{journey.title}</h3>
                <p className={`text-[13px] font-medium mb-2.5 ${
                  journey.color === 'blue' ? 'text-blue-500' :
                  journey.color === 'violet' ? 'text-violet-500' :
                  journey.color === 'emerald' ? 'text-emerald-500' :
                  'text-amber-500'
                }`}>
                  {journey.example}
                </p>
                <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed mb-4">{journey.desc}</p>
                <Link
                  href={journey.href}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-900 dark:text-white group-hover:gap-2.5 transition-all"
                >
                  Launch Workflow →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dynamic Ecosystem Visualization */}
      <section className="bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-[#0a0f1a] overflow-hidden">
        <div className="py-20 text-center">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="inline-flex px-3.5 py-1.5 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full text-[11px] font-semibold text-white uppercase tracking-wider mb-5">
              Live Network
            </div>
            <h2 className="font-playfair text-[clamp(36px,4vw,48px)] font-medium text-gray-900 dark:text-white mb-4 tracking-tight">
              Enterprise Network in Motion
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400">Procurement teams, vendors, executives, and partners — all connected.</p>
          </div>
        </div>

        <div className="max-w-[1400px] mx-auto px-6">
          <EcosystemVisualization
            activeConnections={activeConnections}
            matchesToday={matchesToday}
          />
        </div>
      </section>

      {/* Features */}
      <section className="py-28 bg-white dark:bg-[#0a0f1a]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex px-3.5 py-1.5 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full text-[11px] font-semibold text-white uppercase tracking-wider mb-5">
              Platform
            </div>
            <h2 className="font-playfair text-[clamp(36px,4vw,48px)] font-medium text-gray-900 dark:text-white tracking-tight">
              Built for Enterprise
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '🎯', title: 'Intelligent Matching', desc: 'AI-driven vendor and candidate matching with qualification scoring.' },
              { icon: '🔒', title: 'Secure Transactions', desc: 'Escrow, milestone payments, and compliance-ready contracts.' },
              { icon: '📊', title: 'Pipeline Analytics', desc: 'Real-time visibility into sourcing, sales, and hiring workflows.' },
              { icon: '⚡', title: 'Rapid Execution', desc: 'RFQs out in hours. Qualified responses in 48h or less.' }
            ].map((feature, i) => (
              <div key={i} className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-7 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-white/5 transition-all">
                <div className="w-11 h-11 bg-gray-100 dark:bg-white/10 rounded-xl flex items-center justify-center text-lg mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-1.5">{feature.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="py-28 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex px-3.5 py-1.5 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full text-[11px] font-semibold text-white uppercase tracking-wider mb-5">
              Process
            </div>
            <h2 className="font-playfair text-[clamp(36px,4vw,48px)] font-medium text-gray-900 dark:text-white mb-4 tracking-tight">
              How It Works
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400">Describe. Deploy. Done.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 mt-16">
            {[
              { num: '01', title: 'Define Objective', desc: 'Describe what you need: sourcing, sales, hiring, or partnerships. Natural language.' },
              { num: '02', title: 'Wells Executes', desc: 'AI identifies targets, qualifies matches, sends outreach, coordinates responses.' },
              { num: '03', title: 'You Approve', desc: 'Review qualified opportunities. Negotiate terms. Close with secure payments.' }
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-[52px] h-[52px] bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full flex items-center justify-center text-lg font-semibold mx-auto mb-5">
                  {step.num}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2.5">{step.title}</h3>
                <p className="text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise Use Cases */}
      <section id="enterprise" className="py-28 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900/50 dark:to-[#0a0f1a] border-t border-gray-100 dark:border-white/5">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex px-3.5 py-1.5 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full text-[11px] font-semibold text-white uppercase tracking-wider mb-5">
              Use Cases
            </div>
            <h2 className="font-playfair text-[clamp(36px,4vw,48px)] font-medium text-gray-900 dark:text-white mb-4 tracking-tight">
              From Brief to Execution
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Whether you're sourcing, selling, hiring, or partnering — Wells turns natural language into qualified pipeline.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left - Value Props */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-6">Capabilities</h3>

              <div className="space-y-5">
                {[
                  { icon: '🏭', title: 'Strategic Sourcing', desc: 'MRO, indirect spend, professional services. RFQs, vendor qualification, competitive bidding.' },
                  { icon: '📈', title: 'Outbound Sales', desc: 'ICP targeting, account research, personalized sequences, meeting scheduling.' },
                  { icon: '👔', title: 'Talent Acquisition', desc: 'Executive search, candidate sourcing, screening, interview coordination.' },
                  { icon: '🤝', title: 'Channel Development', desc: 'Partner identification, outreach, deal structuring, contract negotiation.' }
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20 hover:shadow-lg hover:shadow-gray-100/50 dark:hover:shadow-white/5 transition-all">
                    <div className="w-12 h-12 bg-violet-50 dark:bg-violet-500/10 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-0.5">{item.title}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mt-8 p-5 bg-gray-900 rounded-2xl">
                {[
                  { value: '48h', label: 'Time to Quotes' },
                  { value: '23%', label: 'Avg Cost Reduction' },
                  { value: '500+', label: 'Qualified Vendors' }
                ].map((stat, i) => (
                  <div key={i} className="text-center">
                    <div className="text-2xl font-bold text-white">{stat.value}</div>
                    <div className="text-xs text-white/50">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right - Interactive Chat */}
            <div className="relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.08)_0%,transparent_70%)] pointer-events-none" />
              <HeroChat />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-28 bg-gray-900">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex px-3.5 py-1.5 bg-white/10 rounded-full text-[11px] font-semibold text-white uppercase tracking-wider mb-5">
              Pricing
            </div>
            <h2 className="font-playfair text-[clamp(36px,4vw,48px)] font-medium text-white mb-4 tracking-tight">
              33bps Success Fee
            </h2>
            <p className="text-lg text-white/50">We only win when you win. Everything else is free.</p>
          </div>

          <div className="max-w-[480px] mx-auto bg-white/5 border border-white/10 rounded-3xl p-12 text-center backdrop-blur-xl">
            <div className="text-7xl font-bold text-white tracking-tight">1%</div>
            <div className="text-base text-white/50 mb-8">of closed deal value</div>

            <ul className="text-left mb-8 space-y-0">
              {[
                'Free to search and get quotes',
                'Free matching and introductions',
                '1% only on completed deals',
                'Built-in escrow protection'
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 py-3.5 border-b border-white/10 text-[15px] text-white/80">
                  <span className="text-emerald-500 font-semibold">✓</span>
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/founder/chat"
              className="block w-full py-4 bg-white text-gray-900 text-base font-medium rounded-xl hover:bg-gray-100 transition-all hover:-translate-y-0.5"
            >
              Start for Free
            </Link>
            <p className="mt-4 text-[13px] text-white/40">No credit card required</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 text-center bg-white dark:bg-[#0a0f1a]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="font-playfair text-[clamp(36px,4vw,48px)] font-medium text-gray-900 dark:text-white mb-4 tracking-tight">
            Stop Managing. Start Executing.
          </h2>
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-8">Define your objective. Let Wells handle the rest.</p>
          <Link
            href="/founder/chat"
            className="inline-flex px-7 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[15px] font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            Start a Workflow →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-[#0a0f1a]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="max-w-[260px]">
              <Link href="/" className="flex items-center gap-2.5 text-gray-900 dark:text-white font-semibold text-[17px] tracking-tight mb-3">
                <div className="w-7 h-7 bg-gradient-to-br from-gray-800 to-gray-900 dark:from-blue-500 dark:to-violet-500 rounded-[7px] flex items-center justify-center text-white text-[13px] font-bold">
                  W
                </div>
                WellsAI
              </Link>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">Enterprise AI that executes.</p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Workflows</h4>
              <div className="space-y-2">
                <Link href="/founder/chat" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Indirect Sourcing</Link>
                <Link href="/buyer/chat" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Enterprise Sales</Link>
                <Link href="/suppliers/join" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Executive Search</Link>
                <Link href="/jobs/chat" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Partnerships</Link>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Resources</h4>
              <div className="space-y-2">
                <Link href="/wells-ai/blog" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Blog</Link>
                <Link href="#how" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">How It Works</Link>
                <Link href="/demo" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Request Demo</Link>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Company</h4>
              <div className="space-y-2">
                <Link href="/about" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">About</Link>
                <Link href="/sign-in" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Sign In</Link>
                <Link href="/grain-vault" className="block text-sm text-emerald-500 hover:text-emerald-600 transition-colors">Grain & Vault</Link>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-8 border-t border-gray-200 dark:border-white/10">
            <p className="text-[13px] text-gray-400">© 2025 WellsAI. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Floating Chat FAB */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="absolute inset-0 border-2 border-blue-500 rounded-2xl animate-ping opacity-20" />
        <Link
          href="/founder/chat"
          className="relative w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.15),0_8px_24px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(0,0,0,0.2),0_12px_32px_rgba(0,0,0,0.15)] transition-all"
        >
          <MessageSquare className="w-6 h-6 text-white" />
        </Link>
      </div>
    </div>
  )
}
