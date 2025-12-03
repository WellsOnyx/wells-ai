'use client'

/**
 * Personalized Dashboard with Embedded Wells AI
 *
 * This is the main workspace after login. Wells is ready to work immediately.
 * Shows:
 * - Personalized greeting and context
 * - Embedded chat interface
 * - Quick actions based on journey
 * - Activity feed
 */

import { useUser } from '@clerk/nextjs'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import {
  Send,
  Loader2,
  Rocket,
  ShoppingCart,
  Store,
  Briefcase,
  TrendingUp,
  CheckCircle,
  Clock,
  Sparkles,
  Settings,
  Bell,
  ChevronRight
} from 'lucide-react'

type Journey = 'founder' | 'buyer' | 'seller' | 'jobs' | undefined

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const JOURNEY_CONFIG = {
  founder: {
    title: 'Founder Mode',
    icon: Rocket,
    color: 'amber',
    gradient: 'from-amber-500 to-orange-600',
    placeholder: "I need to hire a CTO...",
    greeting: "I'm ready to help you build. Need talent, customers, or funding?",
    quickActions: [
      { label: 'Hire Talent', prompt: 'I need to hire for my startup' },
      { label: 'Find Customers', prompt: 'I need to find customers for my product' },
      { label: 'Source Suppliers', prompt: 'I need to source suppliers' },
    ]
  },
  buyer: {
    title: 'Buyer Mode',
    icon: ShoppingCart,
    color: 'blue',
    gradient: 'from-blue-500 to-cyan-600',
    placeholder: "I need to source 10,000 units of...",
    greeting: "I'm ready to source. What products or services do you need?",
    quickActions: [
      { label: 'Get Quotes', prompt: 'I need quotes for bulk materials' },
      { label: 'Find Suppliers', prompt: 'Help me find verified suppliers' },
      { label: 'Compare Options', prompt: 'Compare suppliers for me' },
    ]
  },
  seller: {
    title: 'Seller Mode',
    icon: Store,
    color: 'green',
    gradient: 'from-green-500 to-emerald-600',
    placeholder: "I want to sell to companies looking for...",
    greeting: "I'm ready to find you customers. What do you sell?",
    quickActions: [
      { label: 'Find Leads', prompt: 'Find me qualified buyers' },
      { label: 'List Products', prompt: 'List my products to buyers' },
      { label: 'View Opportunities', prompt: 'Show me RFQs I can respond to' },
    ]
  },
  jobs: {
    title: 'Jobs Mode',
    icon: Briefcase,
    color: 'purple',
    gradient: 'from-purple-500 to-pink-600',
    placeholder: "I'm looking for a role as...",
    greeting: "I'm ready to help your job search. What role are you seeking?",
    quickActions: [
      { label: 'Find Roles', prompt: 'Find me relevant job opportunities' },
      { label: 'Update Profile', prompt: 'Help me update my profile' },
      { label: 'Prep Interview', prompt: 'Help me prepare for interviews' },
    ]
  },
}

export default function DashboardPage() {
  const { user, isLoaded } = useUser()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Get journey from Clerk metadata
  const journey = (user?.publicMetadata?.selectedJourney as Journey) || 'founder'
  const config = JOURNEY_CONFIG[journey] || JOURNEY_CONFIG.founder
  const firstName = user?.firstName || 'there'

  // Auto-scroll and initial greeting
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isLoaded && user && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Hey ${firstName}! ${config.greeting}`
      }])
    }
  }, [isLoaded, user, firstName, config.greeting, messages.length])

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || isLoading) return

    setInput('')
    setIsLoading(true)

    const updatedMessages: Message[] = [
      ...messages,
      { role: 'user', content: messageText },
    ]
    setMessages(updatedMessages)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          journey,
        }),
      })

      if (!response.ok) throw new Error('Failed to send message')

      const data = await response.json()
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: data.message },
      ])
    } catch {
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: "I'm having trouble connecting. Please try again." },
      ])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  const Icon = config.icon

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600" />
              <span className="text-xl font-bold">Wells Onyx</span>
            </Link>

            <div className="flex items-center gap-3">
              {/* Journey Indicator */}
              <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${config.gradient} bg-opacity-20 border border-${config.color}-500/30`}>
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{config.title}</span>
              </div>

              <button className="p-2 text-gray-400 hover:text-white transition-colors">
                <Bell className="w-5 h-5" />
              </button>
              <Link href="/settings" className="p-2 text-gray-400 hover:text-white transition-colors">
                <Settings className="w-5 h-5" />
              </Link>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-9 h-9",
                  }
                }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)]">
        {/* Sidebar - Quick Stats & Actions */}
        <aside className="hidden lg:flex flex-col w-72 border-r border-gray-800 bg-gray-950/50">
          {/* User Profile Summary */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">{firstName}</h3>
                <p className="text-sm text-gray-400">{config.title}</p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="p-4 border-b border-gray-800">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Activity</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  <span>Active Deals</span>
                </div>
                <span className="font-semibold">0</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Completed</span>
                </div>
                <span className="font-semibold">0</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span>Pending</span>
                </div>
                <span className="font-semibold">0</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-4 flex-1">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Quick Actions</h4>
            <div className="space-y-2">
              {config.quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(action.prompt)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 transition-all text-sm text-left"
                >
                  <span>{action.label}</span>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>
              ))}
            </div>
          </div>

          {/* Switch Journey */}
          <div className="p-4 border-t border-gray-800">
            <Link
              href="/onboarding"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>Switch Journey</span>
            </Link>
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-3xl mx-auto space-y-4">
              {/* Welcome Banner - Only show when no messages */}
              {messages.length <= 1 && (
                <div className={`rounded-2xl p-6 bg-gradient-to-br ${config.gradient}/10 border border-${config.color}-500/20 mb-6`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center flex-shrink-0`}>
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold mb-1">Wells is ready to work</h2>
                      <p className="text-gray-400">
                        Just type what you need. I'll find matches, negotiate deals, and only charge 1% when something closes.
                      </p>
                    </div>
                  </div>

                  {/* Mobile Quick Actions */}
                  <div className="lg:hidden flex flex-wrap gap-2 mt-4">
                    {config.quickActions.map((action, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(action.prompt)}
                        className={`px-3 py-1.5 rounded-full bg-${config.color}-500/20 border border-${config.color}-500/30 text-sm hover:bg-${config.color}-500/30 transition-colors`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? `bg-gradient-to-r ${config.gradient} text-white`
                        : 'bg-gray-900 border border-gray-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className={`w-4 h-4 text-${config.color}-500 animate-spin`} />
                      <span className="text-sm text-gray-400">Wells is working...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-800 bg-black/50 backdrop-blur-xl p-4">
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={config.placeholder}
                  disabled={isLoading}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50 transition-all"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className={`bg-gradient-to-r ${config.gradient} text-white px-5 py-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-${config.color}-500/20`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <p className="text-center text-xs text-gray-500 mt-2">
                Your AI negotiates. You approve. 1% on closed deals.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
