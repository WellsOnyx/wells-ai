'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Users,
  ShoppingCart,
  Briefcase,
  Building2,
  CheckCircle,
  Clock,
  DollarSign,
  MessageSquare,
  Zap,
  Target,
  Handshake,
  FileText,
  Send,
  Bot,
  User,
  TrendingUp
} from 'lucide-react'

type Journey = 'founder' | 'buyer' | 'seller' | 'jobs' | null
type Step = 'intro' | 'select' | 'demo' | 'result'

const JOURNEYS = {
  founder: {
    title: 'Founder Journey',
    subtitle: 'Launch your business with AI',
    icon: Building2,
    color: 'amber',
    description: 'Tell Wells what you need for your business. Get suppliers, contractors, and deals negotiated automatically.',
    demoSteps: [
      { role: 'user', message: "I need to source packaging suppliers for my D2C skincare brand. Budget is $50k for initial order." },
      { role: 'wells', message: "I found 12 packaging suppliers that match your requirements. Analyzing their capabilities, MOQs, and pricing..." },
      { role: 'wells', message: "Top 3 matches ready. PremiumPack offers custom glass bottles at $2.40/unit (MOQ 5,000). Starting negotiations now..." },
      { role: 'wells', message: "Negotiation complete! Secured $2.15/unit with 30-day payment terms. That's $12,500 savings on your first order. Ready to close?" },
    ],
    result: {
      savings: '$12,500',
      time: '< 2 hours',
      suppliers: '3 vetted',
      status: 'Deal Ready'
    }
  },
  buyer: {
    title: 'Buyer Journey',
    subtitle: 'AI-powered procurement',
    icon: ShoppingCart,
    color: 'blue',
    description: 'Source anything your business needs. Wells handles RFQs, negotiations, and vendor management.',
    demoSteps: [
      { role: 'user', message: "We need 10,000 branded t-shirts for our company event. Need them in 3 weeks." },
      { role: 'wells', message: "Searching supplier network... Found 8 vendors with inventory. Checking print capabilities and rush delivery options..." },
      { role: 'wells', message: "3 vendors confirmed rush capability. Initiating parallel negotiations for best pricing..." },
      { role: 'wells', message: "Best offer: $8.50/shirt with 2-week delivery, includes screen printing. Competitor offered $11.20. Proceed with order?" },
    ],
    result: {
      savings: '$27,000',
      time: '< 45 min',
      suppliers: '8 quoted',
      status: 'Ready to Order'
    }
  },
  seller: {
    title: 'Seller Journey',
    subtitle: 'Join the supplier network',
    icon: Users,
    color: 'green',
    description: 'Get discovered by buyers. Wells matches you with opportunities and handles negotiations on your behalf.',
    demoSteps: [
      { role: 'user', message: "I manufacture custom metal parts. CNC machining, laser cutting, finishing. Want more B2B clients." },
      { role: 'wells', message: "Great! Let me analyze your capabilities. What's your typical MOQ, lead time, and specialty materials?" },
      { role: 'user', message: "MOQ 100 units, 2-week lead time, we specialize in aerospace-grade aluminum and titanium." },
      { role: 'wells', message: "Profile created! You match 23 active RFQs. 3 buyers are looking for titanium machining right now. I'll represent you in negotiations." },
    ],
    result: {
      opportunities: '23 matches',
      time: '< 10 min',
      revenue: '$180k pipeline',
      status: 'Active'
    }
  },
  jobs: {
    title: 'Jobs Journey',
    subtitle: 'AI recruiting assistant',
    icon: Briefcase,
    color: 'purple',
    description: 'Hire faster. Wells screens candidates, schedules interviews, and negotiates offers.',
    demoSteps: [
      { role: 'user', message: "I need a senior React developer. Remote OK, $150-180k range. Must have TypeScript experience." },
      { role: 'wells', message: "Searching candidate network... Found 47 matching profiles. Analyzing skills, experience, and availability..." },
      { role: 'wells', message: "Top 5 candidates identified. 3 are actively looking. Initiating outreach and screening conversations..." },
      { role: 'wells', message: "2 candidates passed screening and are interested. Both available for interviews this week. Shall I schedule?" },
    ],
    result: {
      candidates: '47 found',
      time: '< 1 hour',
      qualified: '5 top matches',
      status: 'Interview Ready'
    }
  }
}

export default function WellsDemo() {
  const [step, setStep] = useState<Step>('intro')
  const [selectedJourney, setSelectedJourney] = useState<Journey>(null)
  const [currentMessage, setCurrentMessage] = useState(0)
  const [displayedMessages, setDisplayedMessages] = useState<typeof JOURNEYS.founder.demoSteps>([])
  const [isTyping, setIsTyping] = useState(false)

  // Auto-advance messages in demo
  useEffect(() => {
    if (step === 'demo' && selectedJourney) {
      const journey = JOURNEYS[selectedJourney]
      if (currentMessage < journey.demoSteps.length) {
        setIsTyping(true)
        const delay = journey.demoSteps[currentMessage].role === 'wells' ? 2000 : 1000
        const timer = setTimeout(() => {
          setDisplayedMessages(prev => [...prev, journey.demoSteps[currentMessage]])
          setCurrentMessage(prev => prev + 1)
          setIsTyping(false)
        }, delay)
        return () => clearTimeout(timer)
      } else if (currentMessage === journey.demoSteps.length) {
        // Auto-advance to result after a delay
        const timer = setTimeout(() => {
          setStep('result')
        }, 1500)
        return () => clearTimeout(timer)
      }
    }
  }, [step, selectedJourney, currentMessage])

  const handleSelectJourney = (journey: Journey) => {
    setSelectedJourney(journey)
    setCurrentMessage(0)
    setDisplayedMessages([])
    setStep('demo')
  }

  const handleReset = () => {
    setStep('intro')
    setSelectedJourney(null)
    setCurrentMessage(0)
    setDisplayedMessages([])
  }

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
      amber: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', gradient: 'from-amber-500 to-orange-600' },
      blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', gradient: 'from-blue-500 to-cyan-600' },
      green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', gradient: 'from-green-500 to-emerald-600' },
      purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', gradient: 'from-purple-500 to-pink-600' },
    }
    return colors[color] || colors.amber
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold text-xl">WellsAI</span>
          </Link>
          <button
            onClick={handleReset}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Reset Demo
          </button>
        </div>
      </header>

      <main className="pt-20 pb-12 px-6">
        <div className="max-w-4xl mx-auto">

          {/* Intro Step */}
          {step === 'intro' && (
            <div className="min-h-[80vh] flex flex-col items-center justify-center text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-sm mb-8">
                <Zap className="w-4 h-4" />
                Interactive Demo
              </div>

              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                See What <span className="text-amber-500">Wells</span> Can Do
              </h1>

              <p className="text-xl text-gray-400 max-w-2xl mb-12">
                Experience AI that actually gets things done. Choose a journey
                and watch Wells negotiate, source, and close deals in real-time.
              </p>

              <button
                onClick={() => setStep('select')}
                className="group inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-semibold rounded-xl hover:from-amber-400 hover:to-orange-500 transition-all hover:scale-105"
              >
                Start Demo
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {/* Select Journey Step */}
          {step === 'select' && (
            <div className="min-h-[80vh] flex flex-col items-center justify-center">
              <button
                onClick={() => setStep('intro')}
                className="self-start flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-center">
                What do you need?
              </h2>
              <p className="text-gray-400 mb-12 text-center">
                Choose a scenario and see Wells in action
              </p>

              <div className="grid md:grid-cols-2 gap-6 w-full max-w-3xl">
                {(Object.entries(JOURNEYS) as [Journey, typeof JOURNEYS.founder][]).map(([key, journey]) => {
                  const colors = getColorClasses(journey.color)
                  const Icon = journey.icon
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelectJourney(key as Journey)}
                      className={`group p-6 bg-white/5 border border-white/10 rounded-2xl text-left hover:${colors.border} hover:bg-white/10 transition-all`}
                    >
                      <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center mb-4`}>
                        <Icon className={`w-6 h-6 ${colors.text}`} />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">{journey.title}</h3>
                      <p className={`text-sm ${colors.text} mb-3`}>{journey.subtitle}</p>
                      <p className="text-gray-400 text-sm">{journey.description}</p>
                      <div className="mt-4 flex items-center gap-2 text-white/60 group-hover:text-white transition-colors">
                        <span className="text-sm">Try this demo</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Demo Step - Chat Interface */}
          {step === 'demo' && selectedJourney && (
            <div className="min-h-[80vh] flex flex-col">
              <button
                onClick={() => setStep('select')}
                className="self-start flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Choose Different Journey
              </button>

              <div className="flex-1 flex flex-col">
                {/* Journey Header */}
                <div className="text-center mb-8">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 ${getColorClasses(JOURNEYS[selectedJourney].color).bg} rounded-full ${getColorClasses(JOURNEYS[selectedJourney].color).text} text-sm mb-4`}>
                    {(() => {
                      const Icon = JOURNEYS[selectedJourney].icon
                      return <Icon className="w-4 h-4" />
                    })()}
                    {JOURNEYS[selectedJourney].title}
                  </div>
                  <h2 className="text-2xl font-bold">Watch Wells Work</h2>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 max-h-[500px] overflow-y-auto">
                  {displayedMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.role === 'user'
                          ? 'bg-white/10'
                          : 'bg-gradient-to-br from-amber-500 to-orange-600'
                      }`}>
                        {msg.role === 'user' ? (
                          <User className="w-5 h-5 text-white" />
                        ) : (
                          <Bot className="w-5 h-5 text-black" />
                        )}
                      </div>
                      <div className={`max-w-[80%] p-4 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-amber-500/20 text-white'
                          : 'bg-white/10 text-gray-200'
                      }`}>
                        <p className="text-sm md:text-base">{msg.message}</p>
                      </div>
                    </div>
                  ))}

                  {/* Typing Indicator */}
                  {isTyping && (
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-5 h-5 text-black" />
                      </div>
                      <div className="bg-white/10 p-4 rounded-2xl">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress */}
                <div className="mt-6 flex items-center justify-center gap-2">
                  {JOURNEYS[selectedJourney].demoSteps.map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        idx < currentMessage ? 'bg-amber-500' : 'bg-white/20'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Result Step */}
          {step === 'result' && selectedJourney && (
            <div className="min-h-[80vh] flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-8 animate-pulse">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>

              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {selectedJourney === 'seller' ? 'Profile Active!' : 'Deal Ready!'}
              </h2>
              <p className="text-gray-400 mb-12 max-w-xl">
                {selectedJourney === 'founder' && "Wells negotiated with suppliers, secured the best pricing, and has your deal ready to close."}
                {selectedJourney === 'buyer' && "Wells sourced vendors, ran parallel negotiations, and found you the best deal."}
                {selectedJourney === 'seller' && "Your supplier profile is live. Wells is already matching you with buyer opportunities."}
                {selectedJourney === 'jobs' && "Wells screened candidates, identified top matches, and they're ready for interviews."}
              </p>

              {/* Results Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl mb-12">
                {Object.entries(JOURNEYS[selectedJourney].result).map(([key, value]) => (
                  <div key={key} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="text-2xl font-bold text-amber-500 mb-1">{value}</div>
                    <div className="text-xs text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Link
                  href={selectedJourney === 'seller' ? '/suppliers/join' : `/${selectedJourney}/chat`}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-semibold rounded-xl hover:from-amber-400 hover:to-orange-500 transition-all hover:scale-105"
                >
                  {selectedJourney === 'seller' ? 'Join Supplier Network' : 'Try It For Real'}
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                >
                  Try Another Journey
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
          <p>1% success fee. No upfront costs. Only pay when deals close.</p>
        </div>
      </footer>
    </div>
  )
}
