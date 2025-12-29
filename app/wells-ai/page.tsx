'use client'

/**
 * WellsAI Premium Landing Page
 * Clean, light design with orbital journey selector and live ecosystem visualization
 */

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'

// Demo chat messages
const DEMO_MESSAGES = [
  { role: 'user', content: 'I need to find a CTO for my AI startup' },
  { role: 'ai', content: "Got it. I'll search for CTOs with AI/ML experience. What stage — pre-seed, seed, or Series A?" },
  { role: 'user', content: 'Seed, raising $3M' },
  { role: 'ai', content: 'Found 12 candidates. 3 are actively looking. Want me to send intros?' }
]

export default function WellsAILanding() {
  const [chatStep, setChatStep] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const [activeConnections, setActiveConnections] = useState(847)
  const [matchesToday, setMatchesToday] = useState(23)

  // Chat animation
  useEffect(() => {
    const showNextMessage = () => {
      if (chatStep < DEMO_MESSAGES.length) {
        setIsTyping(true)
        setTimeout(() => {
          setIsTyping(false)
          setChatStep(prev => prev + 1)
        }, 1200)
      }
    }

    const timer = setTimeout(showNextMessage, chatStep === 0 ? 500 : 2000)
    return () => clearTimeout(timer)
  }, [chatStep])

  // Reset chat animation
  useEffect(() => {
    if (chatStep >= DEMO_MESSAGES.length) {
      const resetTimer = setTimeout(() => setChatStep(0), 5000)
      return () => clearTimeout(resetTimer)
    }
  }, [chatStep])

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
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased">
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
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/5">
        <div className="max-w-[1200px] mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link href="/wells-ai" className="flex items-center gap-2.5 text-gray-900 font-semibold text-[17px] tracking-tight">
            <div className="w-7 h-7 bg-gradient-to-br from-gray-800 to-gray-900 rounded-[7px] flex items-center justify-center text-white text-[13px] font-bold">
              W
            </div>
            WellsAI
          </Link>

          <div className="flex items-center gap-2">
            <Link href="#journeys" className="text-gray-600 text-sm font-medium px-3.5 py-2 rounded-lg hover:text-gray-900 hover:bg-gray-100 transition-all">
              Journeys
            </Link>
            <Link href="#how" className="text-gray-600 text-sm font-medium px-3.5 py-2 rounded-lg hover:text-gray-900 hover:bg-gray-100 transition-all">
              How It Works
            </Link>
            <Link href="#pricing" className="text-gray-600 text-sm font-medium px-3.5 py-2 rounded-lg hover:text-gray-900 hover:bg-gray-100 transition-all">
              Pricing
            </Link>
            <Link href="/wells-ai/blog" className="text-gray-600 text-sm font-medium px-3.5 py-2 rounded-lg hover:text-gray-900 hover:bg-gray-100 transition-all">
              Blog
            </Link>
            <Link
              href="/founder/chat"
              className="ml-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-[10px] hover:bg-gray-800 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-36 pb-24 bg-gradient-to-b from-gray-50 to-white overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-20 items-center">
            {/* Left - Copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-[13px] font-medium text-gray-600 mb-6 shadow-sm">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse-soft" />
                AI That Actually Does Things
              </div>

              <h1 className="font-playfair text-[clamp(44px,5.5vw,64px)] font-medium leading-[1.1] text-gray-900 mb-5 tracking-tight">
                Talk to Wells.
                <br />
                <em className="bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">Get It Done.</em>
              </h1>

              <p className="text-lg text-gray-500 mb-8 leading-relaxed max-w-[480px]">
                Need to hire? Source suppliers? Find customers? Close deals? Just tell Wells what you need — in plain English.
              </p>

              <div className="flex gap-3 flex-wrap">
                <Link
                  href="/founder/chat"
                  className="px-7 py-3.5 bg-gray-900 text-white text-[15px] font-medium rounded-xl hover:bg-gray-800 transition-all hover:-translate-y-0.5 hover:shadow-xl"
                >
                  Talk to Wells →
                </Link>
                <Link
                  href="#how"
                  className="px-7 py-3.5 bg-white text-gray-700 text-[15px] font-medium rounded-xl border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all"
                >
                  See How It Works
                </Link>
              </div>
            </div>

            {/* Right - Chat Preview */}
            <div className="relative">
              {/* Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.08)_0%,transparent_70%)] pointer-events-none" />

              <div className="relative bg-white border border-gray-200 rounded-[20px] overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.02),0_12px_24px_rgba(0,0,0,0.06),0_24px_48px_rgba(0,0,0,0.04)]">
                {/* Chat Header */}
                <div className="px-5 py-4 bg-gray-900 flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-500 rounded-[10px] flex items-center justify-center text-white font-semibold text-sm">
                    W
                  </div>
                  <div>
                    <h4 className="text-white text-sm font-semibold">Wells</h4>
                    <span className="text-white/50 text-xs flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      Online now
                    </span>
                  </div>
                </div>

                {/* Chat Body */}
                <div className="p-6 min-h-[300px] flex flex-col gap-4 bg-gray-50">
                  {DEMO_MESSAGES.slice(0, chatStep).map((msg, i) => (
                    <div
                      key={i}
                      className={`chat-message-animate max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-white text-gray-900 self-end border border-gray-200 rounded-br-md shadow-sm'
                          : 'bg-gray-900 text-white self-start rounded-bl-md shadow-md'
                      }`}
                      style={{ animationDelay: `${i * 0.1}s` }}
                    >
                      {msg.content}
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex gap-1 px-4 py-3.5 bg-gray-900 rounded-2xl rounded-bl-md self-start">
                      <span className="w-1.5 h-1.5 bg-white/40 rounded-full typing-dot" />
                      <span className="w-1.5 h-1.5 bg-white/40 rounded-full typing-dot" />
                      <span className="w-1.5 h-1.5 bg-white/40 rounded-full typing-dot" />
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <div className="px-5 py-4 bg-white border-t border-gray-200 flex gap-3">
                  <input
                    type="text"
                    placeholder="Tell Wells what you need..."
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-[10px] text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                    readOnly
                  />
                  <button className="px-5 py-3 bg-gray-900 text-white text-sm font-medium rounded-[10px] hover:bg-gray-800 transition-all">
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-b border-gray-200">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '$2.3M+', label: 'Deals Closed' },
              { value: '500+', label: 'Active Users' },
              { value: '< 48h', label: 'Response Time' },
              { value: '1%', label: 'Simple Fee' }
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl font-bold text-gray-900 tracking-tight mb-1">{stat.value}</div>
                <div className="text-sm font-medium text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Journeys Section */}
      <section id="journeys" className="py-28">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex px-3.5 py-1.5 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full text-[11px] font-semibold text-white uppercase tracking-wider mb-5">
              4 Journeys
            </div>
            <h2 className="font-playfair text-[clamp(36px,4vw,48px)] font-medium text-gray-900 mb-4 tracking-tight">
              What Do You Need?
            </h2>
            <p className="text-lg text-gray-500">Tell Wells. Watch it happen.</p>
          </div>

          {/* Journey Cards Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: '👤',
                title: 'Founder',
                example: '"I need to hire a CTO"',
                desc: 'Get matched with talent, suppliers, customers, and investors.',
                href: '/founder/chat',
                color: 'blue',
                bgColor: 'bg-blue-50'
              },
              {
                icon: '🛒',
                title: 'Buyer',
                example: '"I need industrial equipment"',
                desc: 'Wells writes the RFQ, finds suppliers, handles escrow.',
                href: '/buyer/chat',
                color: 'violet',
                bgColor: 'bg-violet-50'
              },
              {
                icon: '🏪',
                title: 'Seller',
                example: '"Send me qualified leads"',
                desc: 'Register your catalog. Wells matches you with buyers.',
                href: '/suppliers/join',
                color: 'emerald',
                bgColor: 'bg-emerald-50'
              },
              {
                icon: '💼',
                title: 'Jobs',
                example: '"I\'m looking for VP roles"',
                desc: 'Get matched with companies actually hiring.',
                href: '/jobs/chat',
                color: 'amber',
                bgColor: 'bg-amber-50'
              }
            ].map((journey, i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-2xl p-7 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5 hover:border-gray-300 transition-all duration-300 group"
              >
                <div className={`w-11 h-11 ${journey.bgColor} rounded-xl flex items-center justify-center text-lg mb-4`}>
                  {journey.icon}
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">{journey.title}</h3>
                <p className={`text-[13px] font-medium mb-2.5 ${
                  journey.color === 'blue' ? 'text-blue-500' :
                  journey.color === 'violet' ? 'text-violet-500' :
                  journey.color === 'emerald' ? 'text-emerald-500' :
                  'text-amber-500'
                }`}>
                  {journey.example}
                </p>
                <p className="text-[13px] text-gray-500 leading-relaxed mb-4">{journey.desc}</p>
                <Link
                  href={journey.href}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-900 group-hover:gap-2.5 transition-all"
                >
                  Get Started →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dynamic Ecosystem Visualization */}
      <section className="bg-gradient-to-b from-gray-50 to-gray-100 overflow-hidden">
        <div className="py-20 text-center">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="inline-flex px-3.5 py-1.5 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full text-[11px] font-semibold text-white uppercase tracking-wider mb-5">
              Live Ecosystem
            </div>
            <h2 className="font-playfair text-[clamp(36px,4vw,48px)] font-medium text-gray-900 mb-4 tracking-tight">
              Watch the Network Come Alive
            </h2>
            <p className="text-lg text-gray-500">Real-time matching across founders, buyers, sellers, and talent</p>
          </div>
        </div>

        <div className="relative max-w-[1400px] h-[500px] mx-auto">
          {/* Central Wells Hub */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
            {/* Rings */}
            <div className="absolute w-[140px] h-[140px] border border-blue-500/30 rounded-full left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hub-ring-pulse" />
            <div className="absolute w-[180px] h-[180px] border border-blue-500/20 border-dashed rounded-full left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ring-rotate" />
            <div className="absolute w-[220px] h-[220px] border border-blue-500/10 rounded-full left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hub-ring-pulse-delayed" />

            {/* Core */}
            <div className="relative w-[100px] h-[100px] bg-gradient-to-br from-gray-900 to-gray-800 rounded-full flex flex-col items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_4px_24px_rgba(10,15,26,0.4),0_0_60px_rgba(59,130,246,0.2)] z-10">
              <span className="text-3xl font-bold text-white">W</span>
              <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Wells AI</span>
            </div>
          </div>

          {/* Journey Clusters */}
          <div className="absolute left-[8%] top-[15%]">
            <div className="flex flex-col gap-1 mb-4">
              <span className="text-2xl">👤</span>
              <span className="text-sm font-semibold text-blue-500">Founders</span>
              <span className="text-[11px] text-gray-500 font-medium">127 active</span>
            </div>
            <div className="flex flex-wrap gap-2 max-w-[100px]">
              {[12, 10, 8, 10, 6, 8, 6].map((size, i) => (
                <div key={i} className={`w-[${size}px] h-[${size}px] bg-blue-500 rounded-full node-pulse`} style={{ width: size, height: size, opacity: 1 - i * 0.1, animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>

          <div className="absolute left-[8%] bottom-[15%]">
            <div className="flex flex-col gap-1 mb-4">
              <span className="text-2xl">🛒</span>
              <span className="text-sm font-semibold text-violet-500">Buyers</span>
              <span className="text-[11px] text-gray-500 font-medium">89 active</span>
            </div>
            <div className="flex flex-wrap gap-2 max-w-[100px]">
              {[12, 10, 8, 10, 6, 8].map((size, i) => (
                <div key={i} className="bg-violet-500 rounded-full node-pulse" style={{ width: size, height: size, opacity: 1 - i * 0.1, animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>

          <div className="absolute right-[8%] top-[15%]">
            <div className="flex flex-col gap-1 mb-4 items-end">
              <span className="text-2xl">🏪</span>
              <span className="text-sm font-semibold text-emerald-500">Sellers</span>
              <span className="text-[11px] text-gray-500 font-medium">203 active</span>
            </div>
            <div className="flex flex-wrap gap-2 max-w-[100px] justify-end">
              {[12, 10, 8, 10, 6, 8, 6, 10].map((size, i) => (
                <div key={i} className="bg-emerald-500 rounded-full node-pulse" style={{ width: size, height: size, opacity: 1 - i * 0.08, animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>

          <div className="absolute right-[8%] bottom-[15%]">
            <div className="flex flex-col gap-1 mb-4 items-end">
              <span className="text-2xl">💼</span>
              <span className="text-sm font-semibold text-amber-500">Job Seekers</span>
              <span className="text-[11px] text-gray-500 font-medium">341 active</span>
            </div>
            <div className="flex flex-wrap gap-2 max-w-[100px] justify-end">
              {[12, 10, 8, 10, 6, 8, 6].map((size, i) => (
                <div key={i} className="bg-amber-500 rounded-full node-pulse" style={{ width: size, height: size, opacity: 1 - i * 0.1, animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>

          {/* Stats Overlay */}
          <div className="absolute top-10 right-10 flex flex-col gap-4 z-20">
            <div className="flex flex-col items-end px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm">
              <span className="text-2xl font-bold text-gray-900 tabular-nums">{activeConnections}</span>
              <span className="text-[11px] text-gray-500 font-medium">Active connections</span>
            </div>
            <div className="flex flex-col items-end px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm">
              <span className="text-2xl font-bold text-gray-900 tabular-nums">{matchesToday}</span>
              <span className="text-[11px] text-gray-500 font-medium">Matches today</span>
            </div>
            <div className="flex flex-col items-end px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm">
              <span className="text-2xl font-bold text-gray-900">$127K</span>
              <span className="text-[11px] text-gray-500 font-medium">Pipeline value</span>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-20">
            {[
              { type: 'founder', text: '<strong>CTO matched</strong> for Series A startup', time: '2s ago' },
              { type: 'buyer', text: '<strong>RFQ sent</strong> to 12 suppliers', time: '5s ago' },
              { type: 'seller', text: '<strong>$45K deal</strong> closed via escrow', time: '12s ago' }
            ].map((item, i) => (
              <div
                key={i}
                className="activity-animate flex items-center gap-2.5 px-4 py-2.5 bg-white border border-gray-200 rounded-full text-[13px] shadow-sm"
                style={{ animationDelay: `${i * 0.5}s` }}
              >
                <span className={`w-2 h-2 rounded-full ${
                  item.type === 'founder' ? 'bg-blue-500' :
                  item.type === 'buyer' ? 'bg-violet-500' :
                  item.type === 'seller' ? 'bg-emerald-500' :
                  'bg-amber-500'
                }`} />
                <span className="text-gray-600" dangerouslySetInnerHTML={{ __html: item.text }} />
                <span className="text-[11px] text-gray-400 ml-auto">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-28 bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex px-3.5 py-1.5 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full text-[11px] font-semibold text-white uppercase tracking-wider mb-5">
              Platform
            </div>
            <h2 className="font-playfair text-[clamp(36px,4vw,48px)] font-medium text-gray-900 tracking-tight">
              Everything You Need
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '🎯', title: 'AI Matching', desc: 'Perfect matches found in seconds, not weeks.' },
              { icon: '🔒', title: 'Built-in Escrow', desc: 'Secure payments with milestone protection.' },
              { icon: '🤝', title: 'Negotiate', desc: 'Close deals faster with AI-assisted terms.' },
              { icon: '⚡', title: '24-48h Quotes', desc: 'Rapid turnaround on every request.' }
            ].map((feature, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-2xl p-7 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 transition-all">
                <div className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center text-lg mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-[15px] font-semibold text-gray-900 mb-1.5">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="py-28 bg-gray-50">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex px-3.5 py-1.5 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full text-[11px] font-semibold text-white uppercase tracking-wider mb-5">
              Process
            </div>
            <h2 className="font-playfair text-[clamp(36px,4vw,48px)] font-medium text-gray-900 mb-4 tracking-tight">
              How Wells Works
            </h2>
            <p className="text-lg text-gray-500">Three steps. Zero complexity.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 mt-16">
            {[
              { num: '01', title: 'Talk to Wells', desc: 'Tell Wells what you need in plain English. No forms, no templates.' },
              { num: '02', title: 'Wells Works', desc: 'AI finds matches, sends outreach, coordinates everything.' },
              { num: '03', title: 'You Close', desc: 'Review results, negotiate terms, close with built-in escrow.' }
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-[52px] h-[52px] bg-gray-900 text-white rounded-full flex items-center justify-center text-lg font-semibold mx-auto mb-5">
                  {step.num}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2.5">{step.title}</h3>
                <p className="text-[15px] text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
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
              1% Success Fee
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
      <section className="py-28 text-center">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="font-playfair text-[clamp(36px,4vw,48px)] font-medium text-gray-900 mb-4 tracking-tight">
            Stop Searching. Start Talking.
          </h2>
          <p className="text-lg text-gray-500 mb-8">Tell Wells what you need. Get it done.</p>
          <Link
            href="/founder/chat"
            className="inline-flex px-7 py-3.5 bg-gray-900 text-white text-[15px] font-medium rounded-xl hover:bg-gray-800 transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            Talk to Wells Now →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-gray-200">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="max-w-[260px]">
              <Link href="/wells-ai" className="flex items-center gap-2.5 text-gray-900 font-semibold text-[17px] tracking-tight mb-3">
                <div className="w-7 h-7 bg-gradient-to-br from-gray-800 to-gray-900 rounded-[7px] flex items-center justify-center text-white text-[13px] font-bold">
                  W
                </div>
                WellsAI
              </Link>
              <p className="text-sm text-gray-500 leading-relaxed">AI that turns conversations into outcomes.</p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-4">Journeys</h4>
              <div className="space-y-2">
                <Link href="/founder/chat" className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">Founder</Link>
                <Link href="/buyer/chat" className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">Buyer</Link>
                <Link href="/suppliers/join" className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">Seller</Link>
                <Link href="/jobs/chat" className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">Jobs</Link>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-4">Resources</h4>
              <div className="space-y-2">
                <Link href="/wells-ai/blog" className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">Blog</Link>
                <Link href="#how" className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">How It Works</Link>
                <Link href="/demo" className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">See Demo</Link>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-4">Company</h4>
              <div className="space-y-2">
                <Link href="/about" className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">About</Link>
                <Link href="/sign-in" className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">Sign In</Link>
                <Link href="/grain-vault" className="block text-sm text-emerald-500 hover:text-emerald-600 transition-colors">Grain & Vault</Link>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-8 border-t border-gray-200">
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
