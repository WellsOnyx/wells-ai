'use client'

/**
 * Unified Dashboard - Grain & Vault Branding
 *
 * Design principles:
 * - Dead simple: One input, AI handles everything
 * - Premium: Dark theme with emerald accents, glassmorphism
 * - Crisp: Sharp edges where needed, smooth animations
 * - Unified: All journeys accessible from one place
 * - Brand: Always Grain & Vault with "Powered by WellsAI" attribution
 */

import { useUser } from '@clerk/nextjs'
import { UserButton } from '@clerk/nextjs'
import { useSearchParams, useRouter } from 'next/navigation'
import { userButtonAppearance } from '@/lib/clerk-theme'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Send,
  Loader2,
  Sparkles,
  ChevronDown,
  Wallet,
  ShoppingCart,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  MoreHorizontal,
  ExternalLink,
  Handshake,
  Brain,
  Coins,
} from 'lucide-react'

// Types
type JourneyType = 'treasury' | 'deals' | 'sourcing' | 'sales' | 'hiring'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface QuickAction {
  label: string
  prompt: string
  icon?: React.ElementType
}

// Journey configuration
const JOURNEYS: Record<JourneyType, {
  label: string
  icon: React.ElementType
  color: string
  actions: QuickAction[]
  tagline: string
}> = {
  treasury: {
    label: 'Treasury',
    icon: Wallet,
    color: '#10B981',
    tagline: "Your treasury is ready. What do you need?",
    actions: [
      { label: 'Check balance', prompt: "What's my GRAIN balance?" },
      { label: 'Send payment', prompt: 'Send GRAIN to...' },
      { label: 'View activity', prompt: 'Show recent transactions' },
    ]
  },
  deals: {
    label: 'Deals',
    icon: Handshake,
    color: '#8B5CF6',
    tagline: "Frictionless B2B. Say 'yes, proceed' and it's done.",
    actions: [
      { label: 'New deal', prompt: 'I want to create a deal...' },
      { label: 'My deals', prompt: 'Show my active deals' },
      { label: 'Trusted partners', prompt: 'Who are my trusted partners?' },
    ]
  },
  sourcing: {
    label: 'Sourcing',
    icon: ShoppingCart,
    color: '#3B82F6',
    tagline: "Ready to source. What are you looking for?",
    actions: [
      { label: 'Get quotes', prompt: 'I need quotes for...' },
      { label: 'Find suppliers', prompt: 'Find suppliers for...' },
      { label: 'Track orders', prompt: 'Show my active orders' },
    ]
  },
  sales: {
    label: 'Sales',
    icon: TrendingUp,
    color: '#8B5CF6',
    tagline: "Let's find you customers. Where should we start?",
    actions: [
      { label: 'Find leads', prompt: 'Find me qualified buyers' },
      { label: 'View RFQs', prompt: 'Show incoming RFQs' },
      { label: 'Check pipeline', prompt: "What's in my pipeline?" },
    ]
  },
  hiring: {
    label: 'Hiring',
    icon: Users,
    color: '#F59E0B',
    tagline: "Ready to build your team. Who do you need?",
    actions: [
      { label: 'Post job', prompt: 'I need to hire a...' },
      { label: 'Find talent', prompt: 'Find candidates for...' },
      { label: 'View applicants', prompt: 'Show my applicants' },
    ]
  },
}

export default function Dashboard() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()

  // State
  const [activeJourney, setActiveJourney] = useState<JourneyType>('treasury')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showJourneyPicker, setShowJourneyPicker] = useState(false)

  // Treasury data
  const [grainBalance, setGrainBalance] = useState<number>(0)
  const [grainPrice, setGrainPrice] = useState<number>(1.0234)
  const [recentTx, setRecentTx] = useState<any[]>([])

  // Refs
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Set journey from URL
  useEffect(() => {
    const journey = searchParams.get('journey') as JourneyType
    if (journey && JOURNEYS[journey]) {
      setActiveJourney(journey)
    }
  }, [searchParams])

  // Fetch treasury data
  useEffect(() => {
    async function fetchTreasury() {
      try {
        const res = await fetch('/api/grain/profile')
        if (res.ok) {
          const data = await res.json()
          setGrainBalance(data.grainBalance || 0)
          setGrainPrice(data.grainPrice || 1.0234)
        }

        const txRes = await fetch('/api/grain/transactions?limit=3')
        if (txRes.ok) {
          const data = await txRes.json()
          setRecentTx(data.transactions || [])
        }
      } catch (e) {
        // Silent fail - show zeros
      }
    }
    fetchTreasury()
  }, [])

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send message
  const sendMessage = useCallback(async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || isLoading) return

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          journey: activeJourney,
        }),
      })

      const data = await res.json()

      const assistantMessage: Message = {
        id: `msg_${Date.now()}_ai`,
        role: 'assistant',
        content: data.message || data.response || "I'm on it.",
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = {
        id: `msg_${Date.now()}_err`,
        role: 'assistant',
        content: "Something went wrong. Try again.",
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, activeJourney])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const currentJourney = JOURNEYS[activeJourney]
  const JourneyIcon = currentJourney.icon
  const firstName = user?.firstName || 'there'

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#030712]">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Header - Always Grain & Vault */}
      <header className="h-16 border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Coins className="w-4 h-4 text-black" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-sm" />
            </div>
            <span className="font-semibold text-white">Grain & Vault</span>
          </Link>

          {/* Journey Picker */}
          <div className="relative">
            <button
              onClick={() => setShowJourneyPicker(!showJourneyPicker)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 hover:border-white/30 bg-white/5 transition-all"
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: currentJourney.color }}
              />
              <span className="text-sm font-medium text-white">
                {currentJourney.label}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {showJourneyPicker && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowJourneyPicker(false)}
                />
                <div className="absolute top-full mt-2 right-0 w-48 bg-gray-900 border-white/10 rounded-xl shadow-lg border py-2 z-20">
                  {Object.entries(JOURNEYS).map(([key, journey]) => {
                    const Icon = journey.icon
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          setActiveJourney(key as JourneyType)
                          setShowJourneyPicker(false)
                          router.push(`/dashboard?journey=${key}`)
                        }}
                        className={`w-full px-4 py-2.5 flex items-center gap-3 hover:bg-white/5 transition-all ${
                          activeJourney === key ? 'bg-white/5' : ''
                        }`}
                      >
                        <Icon className="w-4 h-4" style={{ color: journey.color }} />
                        <span className="text-sm text-white">
                          {journey.label}
                        </span>
                        {activeJourney === key && (
                          <CheckCircle2 className="w-4 h-4 ml-auto text-emerald-500" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* User */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-white/40 text-xs">
              <Brain className="w-3 h-3" />
              <span>Powered by WellsAI</span>
            </div>
            <UserButton appearance={userButtonAppearance} />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 relative z-10">
        {/* Hero Section */}
        {messages.length === 0 && (
          <div className="mb-12">
            <h1 className="text-4xl font-semibold text-white mb-2">
              Hey {firstName}
            </h1>
            <p className="text-lg text-gray-400">
              {currentJourney.tagline}
            </p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Column - Chat */}
          <div className="lg:col-span-2">
            {/* Messages */}
            {messages.length > 0 && (
              <div className="mb-6 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] ${
                        msg.role === 'user'
                          ? 'bg-emerald-600 text-white rounded-3xl rounded-br-lg px-5 py-3'
                          : 'bg-white/5 border border-white/10 rounded-3xl rounded-bl-lg px-5 py-3'
                      }`}
                    >
                      <p className={`text-[15px] leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user' ? 'text-white' : 'text-gray-200'
                      }`}>
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 border-white/10 border rounded-3xl rounded-bl-lg px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Input */}
            <div className="bg-white/5 border-white/10 rounded-2xl border overflow-hidden">
              <div className="flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything..."
                  className="flex-1 px-5 py-4 text-[15px] bg-transparent text-white placeholder-gray-500 focus:outline-none"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="m-2 p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            {messages.length === 0 && (
              <div className="mt-6">
                <div className="flex flex-wrap gap-2">
                  {currentJourney.actions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(action.prompt)}
                      className="px-4 py-2 bg-white/5 border-white/10 text-gray-300 hover:border-white/20 hover:text-white border rounded-full text-sm transition-all"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Treasury Card */}
            <div className="bg-gradient-to-br from-emerald-900/50 to-teal-900/30 border-emerald-500/20 rounded-2xl border p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-emerald-400">
                  GRAIN Balance
                </span>
                <button className="p-1 hover:bg-white/5 rounded-lg transition-all">
                  <MoreHorizontal className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="mb-1">
                <span className="text-3xl font-semibold text-white">
                  {grainBalance.toLocaleString()}
                </span>
                <span className="text-lg ml-1 text-gray-400">GRAIN</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">
                  ${(grainBalance * grainPrice).toLocaleString()}
                </span>
                <span className="text-emerald-500 flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" />
                  {((grainPrice - 1) * 100).toFixed(2)}%
                </span>
              </div>

              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex gap-2">
                  <button
                    onClick={() => sendMessage("Send GRAIN to...")}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-all"
                  >
                    Send
                  </button>
                  <button
                    onClick={() => sendMessage("I need to deposit funds")}
                    className="flex-1 py-2 px-3 bg-white/10 hover:bg-white/15 text-white text-sm font-medium rounded-lg transition-all"
                  >
                    Deposit
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white/5 border-white/10 rounded-2xl border p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-400">
                  Recent Activity
                </span>
              </div>

              {recentTx.length === 0 ? (
                <div className="text-center py-6">
                  <Clock className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No activity yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentTx.slice(0, 3).map((tx, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        tx.direction === 'received' ? 'bg-emerald-500/20' : 'bg-white/10'
                      }`}>
                        {tx.direction === 'received' ? (
                          <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {tx.type || 'Transfer'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {tx.counterparty || 'System'}
                        </p>
                      </div>
                      <span className={`text-sm font-medium ${
                        tx.direction === 'received' ? 'text-emerald-400' : 'text-white'
                      }`}>
                        {tx.direction === 'received' ? '+' : '-'}{tx.amount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Credit Line */}
            <div className="bg-white/5 border-white/10 rounded-2xl border p-5">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-gray-400">
                  Credit Line
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-semibold text-white">
                  $50,000
                </span>
                <span className="text-sm text-gray-500">available</span>
              </div>
              <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full w-1/4 bg-amber-500 rounded-full" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                $12,500 used of $62,500 limit • 0% interest
              </p>
            </div>

            {/* Journey specific cards */}
            {activeJourney === 'sourcing' && (
              <div className="bg-white/5 border-white/10 rounded-2xl border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ShoppingCart className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-gray-400">Active RFQs</span>
                </div>
                <div className="text-center py-4">
                  <p className="text-2xl font-semibold text-white">0</p>
                  <p className="text-sm text-gray-500 mt-1">Start sourcing to see RFQs</p>
                </div>
              </div>
            )}

            {activeJourney === 'hiring' && (
              <div className="bg-white/5 border-white/10 rounded-2xl border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-gray-400">Open Roles</span>
                </div>
                <div className="text-center py-4">
                  <p className="text-2xl font-semibold text-white">0</p>
                  <p className="text-sm text-gray-500 mt-1">Post a job to get started</p>
                </div>
              </div>
            )}

            {activeJourney === 'sales' && (
              <div className="bg-white/5 border-white/10 rounded-2xl border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-gray-400">Pipeline</span>
                </div>
                <div className="text-center py-4">
                  <p className="text-2xl font-semibold text-white">$0</p>
                  <p className="text-sm text-gray-500 mt-1">Find leads to build pipeline</p>
                </div>
              </div>
            )}

            {activeJourney === 'deals' && (
              <div className="bg-white/5 border-white/10 rounded-2xl border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Handshake className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-gray-400">Active Deals</span>
                </div>
                <div className="text-center py-4">
                  <p className="text-2xl font-semibold text-white">0</p>
                  <p className="text-sm text-gray-500 mt-1">Create a deal to get started</p>
                </div>
              </div>
            )}

            {/* Learn more card */}
            <div className="bg-gradient-to-br from-violet-900/30 to-purple-900/20 rounded-2xl border border-violet-500/20 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-medium text-violet-400">Powered by WellsAI</span>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                AI-to-AI negotiation. Instant settlement. 1% success fee only when deals close.
              </p>
              <Link
                href="/grain-vault"
                className="flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                Learn more <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
