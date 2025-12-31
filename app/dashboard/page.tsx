'use client'

/**
 * Unified Dashboard - Premium Minimal Design
 *
 * Design principles:
 * - Dead simple: One input, AI handles everything
 * - High-end: Lots of whitespace, subtle shadows, refined typography
 * - Crisp: Sharp edges where needed, smooth animations
 * - Unified: All journeys accessible from one place
 */

import { useUser } from '@clerk/nextjs'
import { UserButton } from '@clerk/nextjs'
import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send,
  Loader2,
  Sparkles,
  ChevronDown,
  Wallet,
  ShoppingCart,
  Users,
  Briefcase,
  ArrowRight,
  Plus,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  MoreHorizontal,
} from 'lucide-react'

// Types
type JourneyType = 'treasury' | 'sourcing' | 'sales' | 'hiring'

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

// Journey configuration - minimal
const JOURNEYS: Record<JourneyType, {
  label: string
  icon: React.ElementType
  color: string
  actions: QuickAction[]
}> = {
  treasury: {
    label: 'Treasury',
    icon: Wallet,
    color: '#10B981',
    actions: [
      { label: 'Check balance', prompt: "What's my GRAIN balance?" },
      { label: 'Send payment', prompt: 'Send GRAIN to...' },
      { label: 'View activity', prompt: 'Show recent transactions' },
    ]
  },
  sourcing: {
    label: 'Sourcing',
    icon: ShoppingCart,
    color: '#3B82F6',
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
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header - Ultra minimal */}
      <header className="h-16 border-b border-gray-100 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">W</span>
            </div>
            <span className="font-semibold text-gray-900">Wells</span>
          </div>

          {/* Journey Picker */}
          <div className="relative">
            <button
              onClick={() => setShowJourneyPicker(!showJourneyPicker)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 hover:border-gray-300 transition-all bg-white"
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: currentJourney.color }}
              />
              <span className="text-sm font-medium text-gray-700">{currentJourney.label}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {showJourneyPicker && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowJourneyPicker(false)}
                />
                <div className="absolute top-full mt-2 right-0 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-20">
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
                        className={`w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-all ${
                          activeJourney === key ? 'bg-gray-50' : ''
                        }`}
                      >
                        <Icon className="w-4 h-4" style={{ color: journey.color }} />
                        <span className="text-sm text-gray-700">{journey.label}</span>
                        {activeJourney === key && (
                          <CheckCircle2 className="w-4 h-4 ml-auto text-gray-400" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* User */}
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-8 h-8",
              }
            }}
          />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero Section - Context aware */}
        {messages.length === 0 && (
          <div className="mb-12">
            <h1 className="text-4xl font-semibold text-gray-900 mb-2">
              Hey {firstName}
            </h1>
            <p className="text-lg text-gray-500">
              {activeJourney === 'treasury' && "Your treasury is ready. What do you need?"}
              {activeJourney === 'sourcing' && "Ready to source. What are you looking for?"}
              {activeJourney === 'sales' && "Let's find you customers. Where should we start?"}
              {activeJourney === 'hiring' && "Ready to build your team. Who do you need?"}
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
                          ? 'bg-gray-900 text-white rounded-3xl rounded-br-lg px-5 py-3'
                          : 'bg-white border border-gray-100 rounded-3xl rounded-bl-lg px-5 py-3 shadow-sm'
                      }`}
                    >
                      <p className={`text-[15px] leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user' ? 'text-white' : 'text-gray-700'
                      }`}>
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-100 rounded-3xl rounded-bl-lg px-5 py-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Input - The main interaction */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Wells anything..."
                  className="flex-1 px-5 py-4 text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="m-2 p-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Actions - Show when no messages */}
            {messages.length === 0 && (
              <div className="mt-6">
                <div className="flex flex-wrap gap-2">
                  {currentJourney.actions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(action.prompt)}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-all"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Context Cards */}
          <div className="space-y-4">
            {/* Treasury Card - Always visible */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-500">GRAIN Balance</span>
                <button className="p-1 hover:bg-gray-100 rounded-lg transition-all">
                  <MoreHorizontal className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div className="mb-1">
                <span className="text-3xl font-semibold text-gray-900">
                  {grainBalance.toLocaleString()}
                </span>
                <span className="text-lg text-gray-400 ml-1">GRAIN</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">
                  ${(grainBalance * grainPrice).toLocaleString()}
                </span>
                <span className="text-emerald-600 flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" />
                  {((grainPrice - 1) * 100).toFixed(2)}%
                </span>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex gap-2">
                  <button
                    onClick={() => sendMessage("Send GRAIN to...")}
                    className="flex-1 py-2 px-3 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-all"
                  >
                    Send
                  </button>
                  <button
                    onClick={() => sendMessage("I need to deposit funds")}
                    className="flex-1 py-2 px-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-all"
                  >
                    Deposit
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-500">Recent Activity</span>
              </div>

              {recentTx.length === 0 ? (
                <div className="text-center py-6">
                  <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No activity yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentTx.slice(0, 3).map((tx, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        tx.direction === 'received' ? 'bg-emerald-50' : 'bg-gray-100'
                      }`}>
                        {tx.direction === 'received' ? (
                          <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-gray-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {tx.type || 'Transfer'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {tx.counterparty || 'System'}
                        </p>
                      </div>
                      <span className={`text-sm font-medium ${
                        tx.direction === 'received' ? 'text-emerald-600' : 'text-gray-900'
                      }`}>
                        {tx.direction === 'received' ? '+' : '-'}{tx.amount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Credit Line - If available */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-500">Credit Line</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-semibold text-gray-900">$50,000</span>
                <span className="text-sm text-gray-400">available</span>
              </div>
              <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full w-1/4 bg-emerald-500 rounded-full" />
              </div>
              <p className="text-xs text-gray-400 mt-2">$12,500 used of $62,500 limit</p>
            </div>

            {/* Journey specific cards could go here */}
            {activeJourney === 'sourcing' && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ShoppingCart className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-500">Active RFQs</span>
                </div>
                <div className="text-center py-4">
                  <p className="text-2xl font-semibold text-gray-900">0</p>
                  <p className="text-sm text-gray-400 mt-1">Start sourcing to see RFQs</p>
                </div>
              </div>
            )}

            {activeJourney === 'hiring' && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-gray-500">Open Roles</span>
                </div>
                <div className="text-center py-4">
                  <p className="text-2xl font-semibold text-gray-900">0</p>
                  <p className="text-sm text-gray-400 mt-1">Post a job to get started</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
