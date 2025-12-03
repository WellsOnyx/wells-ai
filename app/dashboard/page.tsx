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
    <div className="min-h-screen bg-black text-white relative">
      {/* Ambient background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-amber-500/3 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="border-b border-white/10 glass sticky top-0 z-50 shadow-xl">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/40 transition-all group-hover:scale-105">
                <Sparkles className="w-4 h-4 text-black m-2" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Wells Onyx</span>
            </Link>

            <div className="flex items-center gap-3">
              {/* Journey Indicator */}
              <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${config.gradient} bg-opacity-10 border border-white/20 backdrop-blur-sm shadow-lg`}>
                <Icon className="w-4 h-4" />
                <span className="text-sm font-semibold">{config.title}</span>
              </div>

              {/* Admin Link - Only show for admin users */}
              <Link
                href="/admin/leads"
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-amber-500 hover:bg-white/5 transition-all"
                title="Admin Dashboard"
              >
                <Settings className="w-4 h-4" />
                <span>Admin</span>
              </Link>

              <button className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                <Bell className="w-5 h-5" />
              </button>
              <Link href="/settings" className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                <Settings className="w-5 h-5" />
              </Link>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-9 h-9 ring-2 ring-white/10 hover:ring-amber-500/50 transition-all",
                  }
                }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)] relative z-10">
        {/* Sidebar - Quick Stats & Actions */}
        <aside className="hidden lg:flex flex-col w-72 border-r border-white/10 bg-gradient-to-b from-white/5 to-transparent backdrop-blur-sm">
          {/* User Profile Summary */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">{firstName}</h3>
                <div className="flex items-center gap-1.5">
                  <div className="online-indicator" />
                  <p className="text-xs text-gray-400">{config.title}</p>
                </div>
              </div>
            </div>
            {/* First Mover Badge */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
              <span className="text-lg">🏆</span>
              <div>
                <p className="text-xs font-semibold text-amber-400">First Mover</p>
                <p className="text-[10px] text-gray-400">Pioneer Status Unlocked</p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="p-4 border-b border-white/10">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Activity</h4>
            <div className="space-y-2">
              <div className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 transition-all cursor-pointer">
                <div className="flex items-center gap-2 text-sm text-gray-400 group-hover:text-white transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                  </div>
                  <span>Active Deals</span>
                </div>
                <span className="font-bold text-white">0</span>
              </div>
              <div className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 transition-all cursor-pointer">
                <div className="flex items-center gap-2 text-sm text-gray-400 group-hover:text-white transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <span>Completed</span>
                </div>
                <span className="font-bold text-white">0</span>
              </div>
              <div className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 transition-all cursor-pointer">
                <div className="flex items-center gap-2 text-sm text-gray-400 group-hover:text-white transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                    <Clock className="w-4 h-4 text-blue-500" />
                  </div>
                  <span>Pending</span>
                </div>
                <span className="font-bold text-white">0</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-4 flex-1">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h4>
            <div className="space-y-2">
              {config.quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(action.prompt)}
                  className="group w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all text-sm text-left shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95"
                >
                  <span className="text-gray-300 group-hover:text-white transition-colors">{action.label}</span>
                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          </div>

          {/* Switch Journey */}
          <div className="p-4 border-t border-white/10">
            <Link
              href="/onboarding"
              className="group flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <Sparkles className="w-4 h-4 group-hover:text-amber-500 transition-colors" />
              <span>Switch Journey</span>
            </Link>
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col relative">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Welcome Banner - Only show when no messages */}
              {messages.length <= 1 && (
                <div className={`rounded-2xl p-6 bg-gradient-to-br ${config.gradient}/10 border border-white/20 mb-6 shadow-xl backdrop-blur-sm hover:border-white/30 transition-all group`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform`}>
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Wells is ready to work</h2>
                      <p className="text-gray-400 leading-relaxed">
                        Just type what you need. I'll find matches, negotiate deals, and only charge 1% when something closes.
                      </p>
                    </div>
                  </div>

                  {/* Mobile Quick Actions */}
                  <div className="lg:hidden flex flex-wrap gap-2 mt-6">
                    {config.quickActions.map((action, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(action.prompt)}
                        className={`px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm hover:bg-white/20 hover:border-white/30 transition-all backdrop-blur-sm shadow-lg hover:scale-105 active:scale-95`}
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
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mr-3 flex-shrink-0 shadow-lg">
                      <Sparkles className="w-4 h-4 text-black" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-5 py-3.5 shadow-xl ${
                      message.role === 'user'
                        ? `bg-gradient-to-r ${config.gradient} text-white shadow-${config.color}-500/20 hover:shadow-${config.color}-500/30 transition-shadow`
                        : 'bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/[0.07] hover:border-white/20 transition-all'
                    }`}
                  >
                    <p className={`whitespace-pre-wrap leading-relaxed ${message.role === 'assistant' ? 'text-gray-100' : ''}`}>
                      {message.content}
                    </p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mr-3 flex-shrink-0 shadow-lg">
                    <Sparkles className="w-4 h-4 text-black" />
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 backdrop-blur-sm shadow-xl">
                    <div className="flex items-center gap-3">
                      <Loader2 className={`w-5 h-5 text-amber-500 animate-spin`} />
                      <span className="text-sm text-gray-300">Wells is working...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t border-white/10 glass p-4 sm:p-6 shadow-2xl">
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-3 items-end">
                <div className="flex-1 relative group">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={config.placeholder}
                    disabled={isLoading}
                    className="w-full input-premium disabled:opacity-50 disabled:cursor-not-allowed text-base shadow-lg"
                  />
                  {/* Subtle glow on focus */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity pointer-events-none -z-10" />
                </div>
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className={`bg-gradient-to-r ${config.gradient} text-white px-6 py-3.5 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl hover:shadow-amber-500/30 relative overflow-hidden group`}
                >
                  {/* Shimmer effect on hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  <Send className="w-5 h-5 relative z-10" />
                </button>
              </div>
              <div className="flex items-center justify-center gap-2 mt-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <p className="text-xs text-gray-500 px-3">
                  Your AI negotiates. You approve. 1% on closed deals.
                </p>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
