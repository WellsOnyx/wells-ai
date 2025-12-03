'use client'

import { useState, useEffect, useRef } from 'react'
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
  TrendingUp,
  FastForward,
  Loader2
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
  const [statusText, setStatusText] = useState('')
  const [showSkipButton, setShowSkipButton] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Smooth scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [displayedMessages, isTyping])

  // Show skip button after first message
  useEffect(() => {
    if (currentMessage > 0 && step === 'demo') {
      setShowSkipButton(true)
    } else {
      setShowSkipButton(false)
    }
  }, [currentMessage, step])

  // Auto-advance messages in demo with enhanced timing
  useEffect(() => {
    if (step === 'demo' && selectedJourney) {
      const journey = JOURNEYS[selectedJourney]
      if (currentMessage < journey.demoSteps.length) {
        const currentMsg = journey.demoSteps[currentMessage]
        const isWells = currentMsg.role === 'wells'

        // Calculate delays based on message length and role
        const messageLength = currentMsg.message.length
        const baseDelay = isWells ? 1200 : 800 // Delay before typing starts
        const typingDuration = isWells
          ? Math.min(3500, messageLength * 25) // Wells types slower (up to 3.5s)
          : Math.min(2000, messageLength * 15) // User types faster (up to 2s)

        // Set status text for Wells messages
        if (isWells) {
          const statusMessages = [
            'Wells is analyzing...',
            'Wells is thinking...',
            'Wells is negotiating...',
            'Wells is working...'
          ]
          setStatusText(statusMessages[Math.floor(Math.random() * statusMessages.length)])
        }

        // Show typing indicator after base delay
        const typingTimer = setTimeout(() => {
          setIsTyping(true)
        }, baseDelay)

        // Show message after typing duration
        const messageTimer = setTimeout(() => {
          setDisplayedMessages(prev => [...prev, journey.demoSteps[currentMessage]])
          setCurrentMessage(prev => prev + 1)
          setIsTyping(false)
          setStatusText('')
        }, baseDelay + typingDuration)

        return () => {
          clearTimeout(typingTimer)
          clearTimeout(messageTimer)
        }
      } else if (currentMessage === journey.demoSteps.length) {
        // Longer delay before showing results
        setStatusText('Preparing your results...')
        const timer = setTimeout(() => {
          setStep('result')
          setStatusText('')
        }, 2500)
        return () => clearTimeout(timer)
      }
    }
  }, [step, selectedJourney, currentMessage])

  const skipToResults = () => {
    if (selectedJourney) {
      const journey = JOURNEYS[selectedJourney]
      setDisplayedMessages(journey.demoSteps)
      setCurrentMessage(journey.demoSteps.length)
      setIsTyping(false)
      setTimeout(() => setStep('result'), 500)
    }
  }

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
    setStatusText('')
    setShowSkipButton(false)
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
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out forwards;
        }

        .animate-scaleIn {
          animation: scaleIn 0.5s ease-out forwards;
        }

        .animate-slideInLeft {
          animation: slideInLeft 0.5s ease-out forwards;
        }

        .animate-slideInRight {
          animation: slideInRight 0.5s ease-out forwards;
        }

        .stagger-1 { animation-delay: 0.1s; opacity: 0; }
        .stagger-2 { animation-delay: 0.2s; opacity: 0; }
        .stagger-3 { animation-delay: 0.3s; opacity: 0; }
        .stagger-4 { animation-delay: 0.4s; opacity: 0; }
        .stagger-5 { animation-delay: 0.5s; opacity: 0; }
      `}</style>

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
              <div className="flex items-center justify-between mb-8">
                <button
                  onClick={() => setStep('select')}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Choose Different Journey
                </button>

                {showSkipButton && (
                  <button
                    onClick={skipToResults}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all text-sm animate-fadeInUp"
                  >
                    <FastForward className="w-4 h-4" />
                    Skip to Results
                  </button>
                )}
              </div>

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

                {/* Status Text */}
                {statusText && (
                  <div className="flex items-center justify-center gap-2 mb-4 text-amber-400 text-sm animate-fadeInUp">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {statusText}
                  </div>
                )}

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                    <span>Step {currentMessage} of {JOURNEYS[selectedJourney].demoSteps.length}</span>
                    <span>{Math.round((currentMessage / JOURNEYS[selectedJourney].demoSteps.length) * 100)}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-600 transition-all duration-700 ease-out"
                      style={{ width: `${(currentMessage / JOURNEYS[selectedJourney].demoSteps.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Chat Messages */}
                <div
                  ref={chatContainerRef}
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 max-h-[500px] overflow-y-auto"
                >
                  {displayedMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 ${
                        msg.role === 'user' ? 'flex-row-reverse animate-slideInRight' : 'animate-slideInLeft'
                      }`}
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
                        <p className="text-sm md:text-base leading-relaxed">{msg.message}</p>
                      </div>
                    </div>
                  ))}

                  {/* Typing Indicator */}
                  {isTyping && (
                    <div className="flex items-start gap-3 animate-fadeInUp">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-5 h-5 text-black" />
                      </div>
                      <div className="bg-white/10 p-4 rounded-2xl">
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }} />
                          <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1s' }} />
                          <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1s' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Progress Dots */}
                <div className="mt-6 flex items-center justify-center gap-2">
                  {JOURNEYS[selectedJourney].demoSteps.map((_, idx) => (
                    <div
                      key={idx}
                      className={`rounded-full transition-all duration-500 ${
                        idx < currentMessage
                          ? 'w-2 h-2 bg-amber-500'
                          : idx === currentMessage
                          ? 'w-3 h-3 bg-amber-400 animate-pulse'
                          : 'w-2 h-2 bg-white/20'
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
              {/* Celebration Effect */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(30)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full animate-fadeInUp"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `-10px`,
                      animationDelay: `${Math.random() * 0.5}s`,
                      animationDuration: `${2 + Math.random() * 2}s`,
                      transform: `translateY(${100 + Math.random() * 200}vh) rotate(${Math.random() * 360}deg)`
                    }}
                  />
                ))}
              </div>

              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-8 animate-scaleIn">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>

              <h2 className="text-3xl md:text-4xl font-bold mb-4 animate-fadeInUp">
                {selectedJourney === 'seller' ? 'Profile Active!' : 'Deal Ready!'}
              </h2>
              <p className="text-gray-400 mb-12 max-w-xl animate-fadeInUp" style={{ animationDelay: '0.1s', opacity: 0 }}>
                {selectedJourney === 'founder' && "Wells negotiated with suppliers, secured the best pricing, and has your deal ready to close."}
                {selectedJourney === 'buyer' && "Wells sourced vendors, ran parallel negotiations, and found you the best deal."}
                {selectedJourney === 'seller' && "Your supplier profile is live. Wells is already matching you with buyer opportunities."}
                {selectedJourney === 'jobs' && "Wells screened candidates, identified top matches, and they're ready for interviews."}
              </p>

              {/* Results Grid with Staggered Animation */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl mb-12">
                {Object.entries(JOURNEYS[selectedJourney].result).map(([key, value], idx) => (
                  <div
                    key={key}
                    className={`bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 hover:border-amber-500/30 transition-all hover:scale-105 animate-scaleIn stagger-${idx + 1}`}
                  >
                    <div className="text-2xl font-bold text-amber-500 mb-1">{value}</div>
                    <div className="text-xs text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center gap-4 animate-fadeInUp stagger-5">
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
