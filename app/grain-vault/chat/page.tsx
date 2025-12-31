'use client'

/**
 * Grain & Vault Chat Page
 *
 * Treasury assistant chat - dark theme, glassmorphic design.
 * Pure conversation for managing GRAIN balance, payments, and treasury ops.
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Send, Loader2, Wallet, Sparkles } from 'lucide-react'
import Link from 'next/link'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface TreasuryContext {
  accountId?: string
  companyName?: string
  grainBalance: number
  creditLine: number
}

export default function GrainVaultChatPage() {
  const { userId, isLoaded } = useAuth()
  const [treasuryContext, setTreasuryContext] = useState<TreasuryContext | null>(null)
  const [isLoadingContext, setIsLoadingContext] = useState(true)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load treasury context
  useEffect(() => {
    if (isLoaded && userId) {
      loadTreasuryContext()
    } else if (isLoaded && !userId) {
      setIsLoadingContext(false)
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: "Hey, I'm Wells - your treasury assistant for Grain & Vault. Sign in to access your GRAIN balance, send payments, and manage your treasury. What brings you here today?",
        timestamp: new Date()
      }])
    }
  }, [isLoaded, userId])

  const loadTreasuryContext = async () => {
    try {
      const response = await fetch('/api/grain-vault/account')
      if (response.ok) {
        const data = await response.json()
        const context = {
          accountId: data.account?.id,
          companyName: data.account?.companyName,
          grainBalance: data.wallet?.balance || 0,
          creditLine: data.creditLine?.limitAmount || 0,
        }
        setTreasuryContext(context)

        // Set welcome message with balance
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: `Hey${context.companyName ? ` ${context.companyName}` : ''}! Your current GRAIN balance is ${context.grainBalance.toLocaleString()}${context.creditLine > 0 ? ` with ${context.creditLine.toLocaleString()} in available credit` : ''}. I can help you check balances, send payments, view transactions, or manage your credit line. What would you like to do?`,
          timestamp: new Date()
        }])
      } else {
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: "Welcome to Grain & Vault! I'm Wells, your treasury assistant. I can help you set up your account, check balances, send payments, and more. Would you like to get started?",
          timestamp: new Date()
        }])
      }
    } catch (error) {
      console.error('Error loading treasury context:', error)
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: "Hey, I'm Wells - your treasury assistant. I can help you manage your GRAIN balance and payments. What can I do for you?",
        timestamp: new Date()
      }])
    } finally {
      setIsLoadingContext(false)
    }
  }

  // Auto-scroll and focus
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!isLoadingContext) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isLoadingContext])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }, [])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setInput('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat/unified?orchestrated=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          journey: 'treasury',
          previousMessages: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
          })),
          treasuryContext,
        })
      })

      if (!response.ok) throw new Error('Failed to get response')

      const data = await response.json()

      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.message || "I can help with that. What specifically would you like to do?",
        timestamp: new Date()
      }])

      // Refresh balance if a transaction was made
      if (data.balanceChanged) {
        loadTreasuryContext()
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: "I'd be happy to help with that. Could you give me a bit more detail?",
        timestamp: new Date()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  if (!isLoaded || isLoadingContext) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60">Loading treasury assistant...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f]">
      {/* Ambient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),transparent)] pointer-events-none" />

      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`
      }} />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-xl bg-black/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/grain-vault" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">Grain & Vault</h1>
                <p className="text-xs text-white/40">Treasury Assistant</p>
              </div>
            </Link>

            {treasuryContext && (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-white/40">GRAIN Balance</p>
                  <p className="text-lg font-semibold text-emerald-400">
                    {treasuryContext.grainBalance.toLocaleString()}
                  </p>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="relative flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`mb-6 flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              style={{
                animation: `fadeSlideIn 0.3s ease-out ${index * 50}ms both`
              }}
            >
              {/* Avatar */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                message.role === 'assistant'
                  ? 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg'
                  : 'bg-white/10 border border-white/10'
              }`}>
                {message.role === 'assistant' ? (
                  <Wallet className="w-5 h-5 text-white" />
                ) : (
                  <span className="text-white/70 text-sm font-medium">You</span>
                )}
              </div>

              {/* Message Content */}
              <div className={`flex-1 max-w-[85%] ${message.role === 'user' ? 'text-right' : ''}`}>
                <div
                  className={`inline-block px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-white/10 text-white border border-white/10 rounded-br-md backdrop-blur-sm'
                      : 'bg-white/[0.03] text-white/90 border border-white/[0.06] rounded-bl-md backdrop-blur-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
                <p className={`text-[11px] text-white/30 mt-2 ${message.role === 'user' ? 'text-right' : ''}`}>
                  {formatTime(message.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="mb-6 flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div className="flex items-center gap-2 px-5 py-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl rounded-bl-md backdrop-blur-sm">
                <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggested prompts */}
      {messages.length === 1 && (
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-emerald-400/60" />
            <span className="text-sm text-white/40">Quick actions...</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              "Check my balance",
              "Send 1,000 GRAIN to a vendor",
              "Show recent transactions",
              "What's my credit limit?"
            ].map((prompt, i) => (
              <button
                key={i}
                onClick={() => {
                  setInput(prompt)
                  inputRef.current?.focus()
                }}
                className="px-4 py-2 text-sm text-white/70 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 hover:border-emerald-500/30 transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="relative border-t border-white/5 backdrop-blur-xl bg-black/40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask about balance, send payment, or view transactions..."
                disabled={isLoading}
                rows={1}
                className="w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-xl text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.07] transition-all resize-none disabled:opacity-50"
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>

            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                input.trim() && !isLoading
                  ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg hover:opacity-90 active:scale-95'
                  : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>

          <p className="text-center text-xs text-white/20 mt-3">
            Just talk naturally. I'll handle your treasury operations.
          </p>
        </div>
      </div>

      {/* Animation styles */}
      <style jsx global>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
