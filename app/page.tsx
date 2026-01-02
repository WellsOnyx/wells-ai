'use client'

/**
 * Grain & Vault - Unified Landing Page
 * Light mode design (WellsAI aesthetic) featuring Grain & Vault as the treasury product
 * with WellsAI as the intelligence layer powering it all
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MessageSquare, Zap, Shield, TrendingUp, Globe, ChevronDown } from 'lucide-react'
import HeroChat from '@/components/HeroChat'
import EcosystemVisualization from '@/components/EcosystemVisualization'
import ThemeToggle from '@/components/ThemeToggle'
import Testimonials from '@/app/components/Testimonials'
import FAQ from '@/app/components/FAQ'

export default function UnifiedLanding() {
  const [activeConnections, setActiveConnections] = useState(847)
  const [matchesToday, setMatchesToday] = useState(23)
  const [productsOpen, setProductsOpen] = useState(false)

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
            <div className="relative">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                <div className="w-3.5 h-3.5 bg-white dark:bg-gray-900 rounded-sm" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-sm" />
            </div>
            Grain & Vault
          </Link>

          <div className="flex items-center gap-2">
            {/* Products Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProductsOpen(!productsOpen)}
                className="flex items-center gap-1 text-gray-600 dark:text-gray-300 text-sm font-medium px-3.5 py-2 rounded-lg hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
              >
                Products
                <ChevronDown className={`w-4 h-4 transition-transform ${productsOpen ? 'rotate-180' : ''}`} />
              </button>
              {productsOpen && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl py-2 z-50">
                  <Link href="/wells-ai" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">WellsAI</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Intelligence layer</div>
                    </div>
                  </Link>
                  <Link href="/grain-vault" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">GRAIN</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Zero-friction payments</div>
                    </div>
                  </Link>
                  <Link href="/grain-vault#products" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <Shield className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">VAULT</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Protected reserves</div>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            <Link href="/wells-ai" className="text-gray-600 dark:text-gray-300 text-sm font-medium px-3.5 py-2 rounded-lg hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
              WellsAI
            </Link>
            <Link href="/grain-vault/blog" className="text-gray-600 dark:text-gray-300 text-sm font-medium px-3.5 py-2 rounded-lg hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
              Blog
            </Link>
            <ThemeToggle variant="minimal" />
            <Link
              href="/join"
              className="ml-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium rounded-[10px] hover:from-emerald-600 hover:to-emerald-700 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/25"
            >
              Get Started
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
                Treasury Infrastructure for Modern Finance
              </div>

              <h1 className="font-playfair text-[clamp(44px,5.5vw,64px)] font-medium leading-[1.1] text-gray-900 dark:text-white mb-5 tracking-tight">
                Treasury that
                <br />
                <em className="bg-gradient-to-r from-emerald-500 to-blue-500 bg-clip-text text-transparent">just works.</em>
              </h1>

              <p className="text-lg text-gray-500 dark:text-gray-400 mb-8 leading-relaxed max-w-[480px]">
                Zero-friction payments with GRAIN. Protected reserves with VAULT.
                Intelligent automation powered by WellsAI. Modern treasury for CFOs and finance teams.
              </p>

              <div className="flex gap-3 flex-wrap">
                <Link
                  href="/join"
                  className="px-7 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[15px] font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/25"
                >
                  Join Waitlist
                </Link>
                <Link
                  href="/grain-vault"
                  className="px-7 py-3.5 bg-white dark:bg-white/10 text-gray-700 dark:text-white text-[15px] font-medium rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/20 hover:border-gray-300 dark:hover:border-white/20 transition-all"
                >
                  Explore Products
                </Link>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center gap-6 mt-8 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-500" />
                  <span>180+ Countries</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-500" />
                  <span>100% Collateralized</span>
                </div>
              </div>
            </div>

            {/* Right - Product Preview Cards */}
            <div className="relative">
              {/* Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.08)_0%,transparent_70%)] pointer-events-none" />

              <div className="grid gap-4">
                {/* GRAIN Card */}
                <Link href="/grain-vault" className="group relative bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/10 hover:border-emerald-500/30 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Zap className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">GRAIN</h3>
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium rounded-full">Payment Token</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Zero-friction payments that appreciate over time. Anti-inflationary by design.</p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-emerald-500 font-semibold">&lt;1s settlement</span>
                        <span className="text-gray-400">0% chargebacks</span>
                      </div>
                    </div>
                  </div>
                </Link>

                {/* VAULT Card */}
                <Link href="/grain-vault#products" className="group relative bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-500/30 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Shield className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">VAULT</h3>
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-full">Reserve Protection</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">100% collateralized reserves with real-time blockchain audits.</p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-blue-500 font-semibold">100% backed</span>
                        <span className="text-gray-400">24/7 audits</span>
                      </div>
                    </div>
                  </div>
                </Link>

                {/* WellsAI Integration Card */}
                <Link href="/wells-ai" className="group relative bg-gradient-to-r from-gray-900 to-gray-800 dark:from-white/10 dark:to-white/5 border border-gray-700 dark:border-white/10 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/10 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-violet-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl font-bold text-white">W</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-white">Powered by WellsAI</h3>
                        <span className="px-2 py-0.5 bg-violet-500/20 text-violet-400 text-xs font-medium rounded-full">Intelligence Layer</span>
                      </div>
                      <p className="text-sm text-gray-400 mb-3">Enterprise AI that executes. Sourcing, sales, hiring, and partnerships - all automated.</p>
                      <div className="flex items-center gap-2 text-sm text-violet-400 group-hover:gap-3 transition-all">
                        <span>Explore WellsAI</span>
                        <span>-&gt;</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-b border-gray-200 dark:border-white/10">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '<1s', label: 'Settlement Time' },
              { value: '180+', label: 'Countries Supported' },
              { value: '100%', label: 'Collateralized' },
              { value: '24/7', label: 'Blockchain Audits' }
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight mb-1">{stat.value}</div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How GRAIN Works */}
      <section className="py-28">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full text-[11px] font-semibold text-white uppercase tracking-wider mb-5">
              How It Works
            </div>
            <h2 className="font-playfair text-[clamp(36px,4vw,48px)] font-medium text-gray-900 dark:text-white mb-4 tracking-tight">
              Money That Works For You
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Unlike traditional currencies that lose value over time, GRAIN is designed to appreciate.
              Your purchasing power grows while you hold.
            </p>
          </div>

          {/* Steps */}
          <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {[
              {
                num: '01',
                icon: '💳',
                title: 'Deposit',
                desc: 'Add funds instantly with card or bank transfer. Available in 180+ countries via Circle.',
                color: 'blue'
              },
              {
                num: '02',
                icon: '✨',
                title: 'Convert to GRAIN',
                desc: 'Your deposit converts to GRAIN at the current market price.',
                color: 'emerald'
              },
              {
                num: '03',
                icon: '📈',
                title: 'Watch It Grow',
                desc: 'As our treasury grows, GRAIN appreciates. Your balance gains value automatically.',
                color: 'violet'
              },
              {
                num: '04',
                icon: '🌍',
                title: 'Use Anywhere',
                desc: 'Spend, send, or withdraw anytime. Your money, your control.',
                color: 'amber'
              }
            ].map((step, i) => (
              <div key={i} className="relative">
                {i < 3 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-gray-200 dark:from-white/20 to-transparent" />
                )}
                <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-lg transition-all">
                  <div className="relative w-14 h-14 bg-gray-100 dark:bg-white/10 rounded-2xl flex items-center justify-center text-2xl mb-4">
                    {step.icon}
                    <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      step.color === 'blue' ? 'bg-blue-500' :
                      step.color === 'emerald' ? 'bg-emerald-500' :
                      step.color === 'violet' ? 'bg-violet-500' :
                      'bg-amber-500'
                    }`}>
                      {step.num}
                    </div>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WellsAI Intelligence Section */}
      <section className="py-28 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900/50 dark:to-[#0a0f1a]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left - Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-500/10 to-violet-500/10 border border-blue-500/20 rounded-full text-[13px] font-medium text-blue-600 dark:text-blue-400 mb-6">
                <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-violet-500 rounded flex items-center justify-center text-white text-[10px] font-bold">W</div>
                Powered by WellsAI
              </div>

              <h2 className="font-playfair text-[clamp(32px,4vw,44px)] font-medium text-gray-900 dark:text-white mb-5 tracking-tight">
                Intelligence Layer
                <br />
                <em className="bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">That Executes</em>
              </h2>

              <p className="text-lg text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                WellsAI powers the intelligence behind Grain & Vault. From automated treasury optimization
                to enterprise workflows - describe what you need, watch it execute.
              </p>

              <div className="space-y-4 mb-8">
                {[
                  { icon: '🏢', title: 'Indirect Sourcing', desc: 'RFQs, vendor qualification, competitive bidding' },
                  { icon: '📈', title: 'Enterprise Sales', desc: 'Target identification, outreach sequences, scheduling' },
                  { icon: '👔', title: 'Executive Search', desc: 'Candidate sourcing, screening, offer negotiation' },
                  { icon: '🤝', title: 'Strategic Partnerships', desc: 'Partner discovery, deal structuring, onboarding' }
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 hover:border-violet-500/30 transition-all">
                    <div className="w-10 h-10 bg-violet-50 dark:bg-violet-500/10 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                href="/wells-ai"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all hover:-translate-y-0.5"
              >
                Explore WellsAI
                <span>-&gt;</span>
              </Link>
            </div>

            {/* Right - Interactive Chat Preview */}
            <div className="relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.08)_0%,transparent_70%)] pointer-events-none" />
              <HeroChat />
            </div>
          </div>
        </div>
      </section>

      {/* Live Network Visualization */}
      <section className="bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-[#0a0f1a] overflow-hidden">
        <div className="py-20 text-center">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="inline-flex px-3.5 py-1.5 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full text-[11px] font-semibold text-white uppercase tracking-wider mb-5">
              Live Network
            </div>
            <h2 className="font-playfair text-[clamp(36px,4vw,48px)] font-medium text-gray-900 dark:text-white mb-4 tracking-tight">
              Enterprise Network in Motion
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400">Real-time matching across the WellsAI ecosystem</p>
          </div>
        </div>

        <div className="max-w-[1400px] mx-auto px-6">
          <EcosystemVisualization
            activeConnections={activeConnections}
            matchesToday={matchesToday}
          />
        </div>
      </section>

      {/* Testimonials Section */}
      <Testimonials />

      {/* Comparison Section */}
      <section className="py-28 bg-white dark:bg-[#0a0f1a]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full text-[11px] font-semibold text-white uppercase tracking-wider mb-5">
              Why Grain
            </div>
            <h2 className="font-playfair text-[clamp(36px,4vw,48px)] font-medium text-gray-900 dark:text-white tracking-tight">
              Stop Losing to Inflation
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Traditional Money */}
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-500/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-red-500 rotate-180" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400">Traditional Money</h3>
                  <p className="text-sm text-red-500/70">Loses value every year</p>
                </div>
              </div>
              <ul className="space-y-4">
                {[
                  { title: 'Inflation erodes savings', desc: '$100 today buys less next year' },
                  { title: 'Banks profit from deposits', desc: 'They earn interest, you get almost nothing' },
                  { title: 'Hidden fees everywhere', desc: 'Transfer fees, exchange fees, ATM fees' }
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-red-500 font-bold mt-0.5">x</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{item.title}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* GRAIN */}
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">GRAIN</h3>
                  <p className="text-sm text-emerald-500/70">Designed to appreciate</p>
                </div>
              </div>
              <ul className="space-y-4">
                {[
                  { title: 'Purchasing power grows', desc: 'GRAIN only goes up in value' },
                  { title: 'You benefit from treasury growth', desc: 'As reserves grow, so does your GRAIN value' },
                  { title: '100% backed, always', desc: 'Every GRAIN is fully backed by real assets' }
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-emerald-500 font-bold mt-0.5">+</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{item.title}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <FAQ />

      {/* CTA */}
      <section className="py-28 bg-gradient-to-br from-emerald-600 to-blue-600">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>

          <h2 className="font-playfair text-[clamp(36px,4vw,48px)] font-medium text-white mb-4 tracking-tight">
            Ready to Modernize Your Treasury?
          </h2>
          <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
            Join the waitlist for early access to GRAIN and VAULT. Enterprise priority available.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/join"
              className="px-8 py-4 bg-white text-gray-900 text-[15px] font-semibold rounded-xl hover:bg-gray-100 transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              Join the Waitlist
            </Link>
            <Link
              href="/wells-ai"
              className="px-8 py-4 bg-white/10 text-white text-[15px] font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-all"
            >
              Explore WellsAI
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-[#0a0f1a]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="max-w-[260px]">
              <Link href="/" className="flex items-center gap-2.5 text-gray-900 dark:text-white font-semibold text-[17px] tracking-tight mb-3">
                <div className="relative">
                  <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                    <div className="w-3 h-3 bg-white dark:bg-gray-900 rounded-sm" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-sm" />
                </div>
                Grain & Vault
              </Link>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">Treasury infrastructure for modern finance teams.</p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Products</h4>
              <div className="space-y-2">
                <Link href="/grain-vault" className="block text-sm text-emerald-500 hover:text-emerald-600 transition-colors">GRAIN</Link>
                <Link href="/grain-vault#products" className="block text-sm text-blue-500 hover:text-blue-600 transition-colors">VAULT</Link>
                <Link href="/grain-vault#treasury-sdk" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Treasury SDK</Link>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Platform</h4>
              <div className="space-y-2">
                <Link href="/wells-ai" className="block text-sm text-violet-500 hover:text-violet-600 transition-colors">WellsAI</Link>
                <Link href="/grain-vault/blog" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Blog</Link>
                <Link href="/demo" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Request Demo</Link>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Company</h4>
              <div className="space-y-2">
                <Link href="/about" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">About</Link>
                <Link href="/sign-in" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Sign In</Link>
                <Link href="https://wellsonyx.io" className="block text-sm text-amber-500 hover:text-amber-600 transition-colors">Wells Onyx</Link>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-8 border-t border-gray-200 dark:border-white/10">
            <p className="text-[13px] text-gray-400">2025 Grain & Vault. A Wells Onyx company.</p>
            <div className="flex items-center gap-4 text-[13px] text-gray-400">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                All Systems Operational
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Chat FAB */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="absolute inset-0 border-2 border-emerald-500 rounded-2xl animate-ping opacity-20" />
        <Link
          href="/founder/chat"
          className="relative w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-[0_4px_12px_rgba(16,185,129,0.3),0_8px_24px_rgba(16,185,129,0.2)] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(16,185,129,0.4),0_12px_32px_rgba(16,185,129,0.3)] transition-all"
        >
          <MessageSquare className="w-6 h-6 text-white" />
        </Link>
      </div>
    </div>
  )
}
