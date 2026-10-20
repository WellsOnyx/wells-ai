// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * WELLS AI COMMAND CENTER
 *
 * The unified interface where users tell Wells AI what they need
 * and watch it work. Four journeys, zero human interaction required.
 *
 * Journeys:
 * 1. BUYER - Procure anything without talking to salespeople
 * 2. SELLER - Sell your products without cold outreach
 * 3. FOUNDER - GTM your startup without being "salesy"
 * 4. WORKER - Work through Wells, get paid through Wells
 */

// Journey definitions
const JOURNEYS = {
  buyer: {
    id: 'buyer',
    title: 'I Need to Buy',
    subtitle: 'Procure anything. Zero salespeople.',
    icon: '🛒',
    gradient: 'from-blue-500 to-cyan-400',
    description: 'Tell Wells AI what you need. We find the best suppliers, negotiate prices, and handle everything.',
    placeholder: 'I need 500 boxes of nitrile gloves, preferably blue, delivered within 2 weeks...',
    capabilities: ['Supplier Discovery', 'Price Negotiation', 'Contract Generation', 'Order Tracking', 'GRAIN Rewards']
  },
  seller: {
    id: 'seller',
    title: 'I Need to Sell',
    subtitle: 'Reach buyers. Zero cold calls.',
    icon: '💰',
    gradient: 'from-emerald-500 to-teal-400',
    description: 'Tell Wells AI about your products. We find qualified buyers and close deals on your behalf.',
    placeholder: 'I manufacture industrial safety equipment - gloves, goggles, respirators. Looking for B2B buyers...',
    capabilities: ['Buyer Discovery', 'Lead Qualification', 'Proposal Generation', 'Deal Closing', 'GRAIN Rewards']
  },
  founder: {
    id: 'founder',
    title: 'I Need GTM',
    subtitle: 'Launch your product. Zero awkwardness.',
    icon: '🚀',
    gradient: 'from-purple-500 to-pink-400',
    description: 'Tell Wells AI about your product. We handle the entire go-to-market - outreach, demos, closing.',
    placeholder: 'I built an AI code review tool for enterprise. Need to reach VP of Engineering at Fortune 500...',
    capabilities: ['ICP Definition', 'Outreach Automation', 'Demo Scheduling', 'Pipeline Management', 'GRAIN Rewards']
  },
  worker: {
    id: 'worker',
    title: 'I Need Work',
    subtitle: 'Work through Wells. Get paid through Wells.',
    icon: '⚡',
    gradient: 'from-amber-500 to-orange-400',
    description: 'Tell Wells AI your skills. We find projects, negotiate rates, and handle all payments.',
    placeholder: 'I\'m a senior React developer with 5 years experience. Available for contract work...',
    capabilities: ['Project Matching', 'Rate Negotiation', 'Contract Management', 'Instant Payments', 'GRAIN Rewards']
  }
}

// Activity types with icons
const ACTIVITY_ICONS = {
  searching: '🔍',
  found: '✨',
  analyzing: '🧠',
  negotiating: '🤝',
  generating: '📝',
  waiting: '⏳',
  success: '✅',
  opportunity: '💡',
  grain: '🌾'
}

export default function CommandCenter() {
  const [selectedJourney, setSelectedJourney] = useState<string | null>(null)
  const [userInput, setUserInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [activities, setActivities] = useState<any[]>([])
  const [decisions, setDecisions] = useState<any[]>([])
  const [results, setResults] = useState<any[]>([])
  const [grainEarned, setGrainEarned] = useState(0)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const activityRef = useRef<HTMLDivElement>(null)

  // Auto-scroll activity feed
  useEffect(() => {
    if (activityRef.current) {
      activityRef.current.scrollTop = activityRef.current.scrollHeight
    }
  }, [activities])

  // Simulate Wells AI working
  const startJourney = async () => {
    if (!userInput.trim() || !selectedJourney) return

    setIsProcessing(true)
    setActivities([])
    setDecisions([])
    setResults([])
    setGrainEarned(0)

    const journey = JOURNEYS[selectedJourney as keyof typeof JOURNEYS]

    // Generate conversation ID
    const convId = `conv_${Date.now()}`
    setConversationId(convId)

    // Simulate AI activity
    const simulateActivity = async (type: string, message: string, delay: number) => {
      await new Promise(r => setTimeout(r, delay))
      setActivities(prev => [...prev, {
        id: Date.now(),
        type,
        message,
        timestamp: new Date().toLocaleTimeString()
      }])
    }

    // Journey-specific simulation
    if (selectedJourney === 'buyer') {
      await simulateActivity('analyzing', 'Understanding your requirements...', 500)
      await simulateActivity('searching', 'Searching 2,847 verified suppliers...', 1500)
      await simulateActivity('found', 'Found 12 matching suppliers', 2000)
      await simulateActivity('analyzing', 'Analyzing pricing history and reliability scores...', 1500)
      await simulateActivity('negotiating', 'Initiating negotiations with top 3 suppliers...', 2000)

      // Add decision cards
      setDecisions([
        {
          id: 1,
          type: 'supplier_selection',
          title: 'Supplier Options Ready',
          description: 'Wells AI found 3 optimal suppliers based on price, quality, and delivery time.',
          options: [
            { id: 'a', name: 'MedSupply Pro', price: '$12,450', delivery: '5 days', rating: 4.9, savings: '18%' },
            { id: 'b', name: 'SafetyFirst Inc', price: '$12,890', delivery: '3 days', rating: 4.8, savings: '15%' },
            { id: 'c', name: 'BulkMed Direct', price: '$11,200', delivery: '8 days', rating: 4.7, savings: '26%' }
          ],
          aiRecommendation: 'MedSupply Pro offers the best balance of price, speed, and reliability.'
        }
      ])

      await simulateActivity('waiting', 'Awaiting your decision on supplier selection...', 500)
      await simulateActivity('grain', '+50 GRAIN earned for using Wells AI procurement', 1000)
      setGrainEarned(50)

    } else if (selectedJourney === 'seller') {
      await simulateActivity('analyzing', 'Analyzing your product catalog...', 500)
      await simulateActivity('searching', 'Scanning 50,000+ active procurement requests...', 1500)
      await simulateActivity('found', 'Found 28 qualified buyer opportunities', 2000)
      await simulateActivity('analyzing', 'Scoring leads by budget, urgency, and fit...', 1500)
      await simulateActivity('generating', 'Generating personalized outreach for top leads...', 2000)

      setDecisions([
        {
          id: 1,
          type: 'lead_approval',
          title: 'Qualified Leads Ready',
          description: 'Wells AI identified high-intent buyers ready for outreach.',
          leads: [
            { id: 'a', company: 'Acme Manufacturing', budget: '$50K+', urgency: 'High', contact: 'VP Procurement' },
            { id: 'b', company: 'TechCorp Industries', budget: '$25K+', urgency: 'Medium', contact: 'Supply Chain Dir' },
            { id: 'c', company: 'Global Logistics Co', budget: '$100K+', urgency: 'High', contact: 'CPO' }
          ],
          aiRecommendation: 'Recommend prioritizing Acme Manufacturing - 94% match score.'
        }
      ])

      await simulateActivity('waiting', 'Ready to send outreach. Approve to proceed...', 500)
      await simulateActivity('grain', '+75 GRAIN earned for seller onboarding', 1000)
      setGrainEarned(75)

    } else if (selectedJourney === 'founder') {
      await simulateActivity('analyzing', 'Understanding your product and market...', 500)
      await simulateActivity('searching', 'Identifying ideal customer profiles...', 1500)
      await simulateActivity('found', 'Mapped 847 potential enterprise accounts', 2000)
      await simulateActivity('analyzing', 'Building outreach sequences...', 1500)
      await simulateActivity('generating', 'Creating personalized value propositions...', 2000)

      setDecisions([
        {
          id: 1,
          type: 'gtm_strategy',
          title: 'GTM Strategy Ready',
          description: 'Wells AI designed a complete go-to-market playbook for your product.',
          strategy: {
            icp: 'VP Engineering at Fortune 500 tech companies',
            channels: ['LinkedIn', 'Email', 'Warm Intros'],
            messaging: 'Save 40% on code review time with AI-powered analysis',
            pipeline: '847 accounts → 200 outreach → 40 demos → 8 deals (projected)'
          },
          aiRecommendation: 'Start with LinkedIn outreach - 3.2x higher response rate for your ICP.'
        }
      ])

      await simulateActivity('waiting', 'GTM strategy ready for launch. Approve to begin...', 500)
      await simulateActivity('grain', '+100 GRAIN earned for founder GTM setup', 1000)
      setGrainEarned(100)

    } else if (selectedJourney === 'worker') {
      await simulateActivity('analyzing', 'Analyzing your skills and experience...', 500)
      await simulateActivity('searching', 'Matching against 3,200+ active projects...', 1500)
      await simulateActivity('found', 'Found 15 matching opportunities', 2000)
      await simulateActivity('negotiating', 'Negotiating rates on your behalf...', 2000)
      await simulateActivity('generating', 'Preparing contracts for top matches...', 1500)

      setDecisions([
        {
          id: 1,
          type: 'project_matching',
          title: 'Projects Ready',
          description: 'Wells AI matched you with high-value projects and negotiated competitive rates.',
          projects: [
            { id: 'a', company: 'FinTech Startup', role: 'Senior React Dev', rate: '$150/hr', duration: '3 months', start: 'Immediate' },
            { id: 'b', company: 'E-commerce Giant', role: 'Frontend Lead', rate: '$175/hr', duration: '6 months', start: '2 weeks' },
            { id: 'c', company: 'Healthcare Platform', role: 'React Architect', rate: '$200/hr', duration: '4 months', start: '1 month' }
          ],
          aiRecommendation: 'FinTech Startup offers immediate start with room for rate increase.'
        },
        {
          id: 2,
          type: 'payment_setup',
          title: 'Payment Setup',
          description: 'Work through Wells, get paid through Wells. No invoicing, no chasing payments.',
          benefits: [
            'Instant payments upon milestone completion',
            'Wells handles all contracts and compliance',
            'Earn GRAIN on every payment',
            '1:1 GRAIN credit line for advances'
          ]
        }
      ])

      await simulateActivity('waiting', 'Projects ready for acceptance...', 500)
      await simulateActivity('grain', '+125 GRAIN earned for worker activation', 1000)
      setGrainEarned(125)
    }
  }

  // Handle decision
  const handleDecision = async (decisionId: number, choice: string) => {
    setDecisions(prev => prev.filter(d => d.id !== decisionId))

    setActivities(prev => [...prev, {
      id: Date.now(),
      type: 'success',
      message: `Decision confirmed: ${choice}`,
      timestamp: new Date().toLocaleTimeString()
    }])

    // Simulate follow-up actions
    await new Promise(r => setTimeout(r, 1000))

    setActivities(prev => [...prev, {
      id: Date.now(),
      type: 'generating',
      message: 'Executing your decision...',
      timestamp: new Date().toLocaleTimeString()
    }])

    await new Promise(r => setTimeout(r, 2000))

    setActivities(prev => [...prev, {
      id: Date.now(),
      type: 'success',
      message: 'Action completed successfully!',
      timestamp: new Date().toLocaleTimeString()
    }])

    setResults([{
      id: 1,
      title: 'Journey Progress',
      status: 'In Progress',
      nextStep: 'Wells AI is handling the next steps automatically.',
      grain: grainEarned + 25
    }])

    setGrainEarned(prev => prev + 25)
  }

  // Journey selection view
  if (!selectedJourney) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '4s' }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-16">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-6">
              <span className="text-amber-400">🌾</span>
              <span className="text-sm text-gray-300">Powered by GRAIN</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">
              Wells AI
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                Command Center
              </span>
            </h1>

            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Tell us what you need. We handle everything.
              <br />
              <span className="text-gray-500">Zero human interaction required.</span>
            </p>
          </div>

          {/* Journey Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {Object.values(JOURNEYS).map((journey) => (
              <button
                key={journey.id}
                onClick={() => setSelectedJourney(journey.id)}
                className="group relative overflow-hidden rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-6 text-left transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:scale-[1.02] hover:shadow-2xl"
              >
                {/* Gradient overlay on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${journey.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />

                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-4xl">{journey.icon}</span>
                    <svg className="w-6 h-6 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-1">{journey.title}</h3>
                  <p className="text-gray-400 mb-4">{journey.subtitle}</p>

                  <div className="flex flex-wrap gap-2">
                    {journey.capabilities.slice(0, 3).map((cap, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Bottom tagline */}
          <div className="text-center mt-16">
            <p className="text-gray-500 text-sm">
              "Your companion for the post-AI economy"
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Active journey view
  const journey = JOURNEYS[selectedJourney as keyof typeof JOURNEYS]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br ${journey.gradient} rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse`} />
      </div>

      <div className="relative z-10 h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setSelectedJourney(null)
                  setIsProcessing(false)
                  setActivities([])
                  setDecisions([])
                  setResults([])
                  setUserInput('')
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{journey.icon}</span>
                  <h1 className="text-xl font-bold text-white">{journey.title}</h1>
                </div>
                <p className="text-sm text-gray-400">{journey.subtitle}</p>
              </div>
            </div>

            {/* GRAIN counter */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20">
              <span className="text-amber-400">🌾</span>
              <span className="text-amber-400 font-bold">{grainEarned} GRAIN</span>
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: Input & Activity */}
          <div className="w-1/2 border-r border-white/10 flex flex-col">
            {/* Input area */}
            <div className="p-6 border-b border-white/10">
              <label className="block text-sm text-gray-400 mb-2">What do you need?</label>
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={journey.placeholder}
                className="w-full h-32 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 resize-none"
                disabled={isProcessing}
              />
              <button
                onClick={startJourney}
                disabled={!userInput.trim() || isProcessing}
                className={`mt-4 w-full py-3 rounded-xl font-medium transition-all ${
                  !userInput.trim() || isProcessing
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : `bg-gradient-to-r ${journey.gradient} text-white hover:opacity-90`
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Wells AI is working...
                  </span>
                ) : (
                  'Start Journey'
                )}
              </button>
            </div>

            {/* Activity feed */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="px-6 py-3 border-b border-white/10">
                <h2 className="text-sm font-medium text-gray-400">AI Activity Feed</h2>
              </div>
              <div ref={activityRef} className="flex-1 overflow-y-auto p-6 space-y-3">
                {activities.length === 0 ? (
                  <div className="text-center text-gray-500 mt-8">
                    <p>Wells AI is standing by...</p>
                    <p className="text-sm mt-2">Start a journey to see activity</p>
                  </div>
                ) : (
                  activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10 animate-fadeIn"
                    >
                      <span className="text-xl">{ACTIVITY_ICONS[activity.type as keyof typeof ACTIVITY_ICONS] || '⚡'}</span>
                      <div className="flex-1">
                        <p className="text-white">{activity.message}</p>
                        <p className="text-xs text-gray-500 mt-1">{activity.timestamp}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Decisions & Results */}
          <div className="w-1/2 flex flex-col">
            {/* Decisions */}
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-sm font-medium text-gray-400 mb-4">Your Decisions</h2>

              {decisions.length === 0 && !isProcessing && (
                <div className="text-center text-gray-500 mt-8">
                  <p>No decisions needed yet</p>
                  <p className="text-sm mt-2">Wells AI will present options here</p>
                </div>
              )}

              {decisions.map((decision) => (
                <div
                  key={decision.id}
                  className="mb-6 p-6 rounded-xl bg-white/5 border border-white/10 animate-fadeIn"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">{decision.title}</h3>
                      <p className="text-sm text-gray-400">{decision.description}</p>
                    </div>
                    <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs">
                      Action Required
                    </span>
                  </div>

                  {/* AI Recommendation */}
                  {decision.aiRecommendation && (
                    <div className="mb-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <p className="text-sm text-purple-300">
                        <span className="font-medium">🧠 Wells AI Recommends:</span> {decision.aiRecommendation}
                      </p>
                    </div>
                  )}

                  {/* Options based on decision type */}
                  {decision.options && (
                    <div className="space-y-3">
                      {decision.options.map((opt: any) => (
                        <button
                          key={opt.id}
                          onClick={() => handleDecision(decision.id, opt.name)}
                          className="w-full p-4 rounded-lg bg-white/5 border border-white/10 text-left hover:bg-white/10 hover:border-white/20 transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-white">{opt.name}</h4>
                              <p className="text-sm text-gray-400">
                                {opt.price} • {opt.delivery} delivery • ⭐ {opt.rating}
                              </p>
                            </div>
                            <span className="text-emerald-400 font-medium">{opt.savings} savings</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {decision.leads && (
                    <div className="space-y-3">
                      {decision.leads.map((lead: any) => (
                        <button
                          key={lead.id}
                          onClick={() => handleDecision(decision.id, lead.company)}
                          className="w-full p-4 rounded-lg bg-white/5 border border-white/10 text-left hover:bg-white/10 hover:border-white/20 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-white">{lead.company}</h4>
                              <p className="text-sm text-gray-400">
                                {lead.contact} • Budget: {lead.budget}
                              </p>
                            </div>
                            <span className={`text-sm px-2 py-1 rounded-full ${
                              lead.urgency === 'High' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {lead.urgency} urgency
                            </span>
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={() => handleDecision(decision.id, 'Approve all')}
                        className={`w-full py-3 rounded-lg bg-gradient-to-r ${journey.gradient} text-white font-medium hover:opacity-90 transition-opacity`}
                      >
                        Approve All & Send Outreach
                      </button>
                    </div>
                  )}

                  {decision.projects && (
                    <div className="space-y-3">
                      {decision.projects.map((proj: any) => (
                        <button
                          key={proj.id}
                          onClick={() => handleDecision(decision.id, proj.company)}
                          className="w-full p-4 rounded-lg bg-white/5 border border-white/10 text-left hover:bg-white/10 hover:border-white/20 transition-all"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-white">{proj.company}</h4>
                            <span className="text-emerald-400 font-bold">{proj.rate}</span>
                          </div>
                          <p className="text-sm text-gray-400">
                            {proj.role} • {proj.duration} • Start: {proj.start}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  {decision.strategy && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-white/5">
                          <p className="text-xs text-gray-500 mb-1">Target ICP</p>
                          <p className="text-sm text-white">{decision.strategy.icp}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5">
                          <p className="text-xs text-gray-500 mb-1">Channels</p>
                          <p className="text-sm text-white">{decision.strategy.channels.join(', ')}</p>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5">
                        <p className="text-xs text-gray-500 mb-1">Pipeline Projection</p>
                        <p className="text-sm text-white">{decision.strategy.pipeline}</p>
                      </div>
                      <button
                        onClick={() => handleDecision(decision.id, 'Launch GTM')}
                        className={`w-full py-3 rounded-lg bg-gradient-to-r ${journey.gradient} text-white font-medium hover:opacity-90 transition-opacity`}
                      >
                        🚀 Launch GTM Campaign
                      </button>
                    </div>
                  )}

                  {decision.benefits && (
                    <div className="space-y-3">
                      <ul className="space-y-2">
                        {decision.benefits.map((benefit: string, i: number) => (
                          <li key={i} className="flex items-center gap-2 text-gray-300">
                            <span className="text-emerald-400">✓</span>
                            {benefit}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => handleDecision(decision.id, 'Setup payments')}
                        className={`w-full py-3 rounded-lg bg-gradient-to-r ${journey.gradient} text-white font-medium hover:opacity-90 transition-opacity`}
                      >
                        Setup Payments Through Wells
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Results */}
              {results.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-sm font-medium text-gray-400 mb-4">Results</h2>
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-white">{result.title}</h3>
                        <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm">
                          {result.status}
                        </span>
                      </div>
                      <p className="text-gray-400 mb-4">{result.nextStep}</p>
                      <div className="flex items-center gap-2 text-amber-400">
                        <span>🌾</span>
                        <span className="font-bold">+{result.grain} GRAIN earned</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
