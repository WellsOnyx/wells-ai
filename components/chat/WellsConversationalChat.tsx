'use client'

/**
 * Wells Conversational Chat Component
 *
 * The chat IS the interface - no forms, no buttons, just pure conversation.
 * Dark theme with purple/indigo accents, glassmorphic design.
 * Wells speaks first and guides the conversation.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, Mic, MicOff, Sparkles } from 'lucide-react'
import Link from 'next/link'

// ============================================================================
// TYPES
// ============================================================================

export type JourneyType = 'buyer' | 'seller' | 'founder' | 'jobs' | 'general'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  metadata?: {
    intent?: string
    extractedData?: Record<string, any>
    suggestedActions?: string[]
  }
}

interface WellsConversationalChatProps {
  journey: JourneyType
  onDataExtracted?: (data: Record<string, any>) => void
  onJourneyDetected?: (journey: JourneyType) => void
  className?: string
  showHeader?: boolean
  fullScreen?: boolean
}

// ============================================================================
// JOURNEY CONFIGURATIONS
// ============================================================================

const JOURNEY_CONFIG: Record<JourneyType, {
  welcomeMessage: string
  placeholder: string
  accentColor: string
  bgGradient: string
  personality: string
}> = {
  buyer: {
    welcomeMessage: "Hey there. I'm Wells. Tell me what you need to buy - materials, equipment, services, anything. I'll find you verified suppliers, get quotes, and handle the negotiation. What are you looking for?",
    placeholder: "Tell me what you need to purchase...",
    accentColor: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-500/10 via-transparent to-transparent',
    personality: 'procurement-focused, efficient, knows supply chains'
  },
  seller: {
    welcomeMessage: "I'm Wells. I connect sellers with qualified buyers who are actively looking to purchase. Tell me about what you sell - products, services, your specialties. I'll match you with the right opportunities.",
    placeholder: "Tell me about what you sell...",
    accentColor: 'from-emerald-500 to-green-500',
    bgGradient: 'from-emerald-500/10 via-transparent to-transparent',
    personality: 'sales-focused, understands B2B dynamics, relationship builder'
  },
  founder: {
    welcomeMessage: "I'm Wells. Founders come to me when they need to move fast - hiring a CTO, finding suppliers for 10,000 units, getting investor intros. What's your biggest priority right now?",
    placeholder: "What do you need to make happen?",
    accentColor: 'from-amber-500 to-orange-500',
    bgGradient: 'from-amber-500/10 via-transparent to-transparent',
    personality: 'startup-savvy, urgent, understands founder struggles'
  },
  jobs: {
    welcomeMessage: "I'm Wells. I don't do job boards - I get you direct intros to hiring managers. Tell me about yourself and what you're looking for. What kind of role would be perfect for you?",
    placeholder: "Tell me about your ideal role...",
    accentColor: 'from-purple-500 to-pink-500',
    bgGradient: 'from-purple-500/10 via-transparent to-transparent',
    personality: 'career coach, knows what companies actually want, direct'
  },
  general: {
    welcomeMessage: "I'm Wells. I help people hire talent, source suppliers, find customers, and close deals. What brings you here today?",
    placeholder: "What can I help you with?",
    accentColor: 'from-indigo-500 to-violet-500',
    bgGradient: 'from-indigo-500/10 via-transparent to-transparent',
    personality: 'versatile, helpful, action-oriented'
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WellsConversationalChat({
  journey,
  onDataExtracted,
  onJourneyDetected,
  className = '',
  showHeader = true,
  fullScreen = true
}: WellsConversationalChatProps) {
  const config = JOURNEY_CONFIG[journey]

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: config.welcomeMessage,
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [extractedData, setExtractedData] = useState<Record<string, any>>({})

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  // Auto-resize textarea
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
      const response = await fetch('/api/wells-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          journey,
          extractedData
        })
      })

      if (!response.ok) throw new Error('Failed to get response')

      const data = await response.json()

      // Handle extracted data from AI
      if (data.extractedData) {
        const newData = { ...extractedData, ...data.extractedData }
        setExtractedData(newData)
        onDataExtracted?.(newData)
      }

      // Handle journey detection
      if (data.detectedJourney && data.detectedJourney !== journey) {
        onJourneyDetected?.(data.detectedJourney)
      }

      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.message || "I'm here to help. Tell me more about what you need.",
        timestamp: new Date(),
        metadata: {
          intent: data.intent,
          extractedData: data.extractedData,
          suggestedActions: data.suggestedActions
        }
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: "I'd love to help with that. Could you tell me a bit more?",
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

  return (
    <div className={`flex flex-col ${fullScreen ? 'h-screen' : 'h-full'} bg-[#0a0a0f] ${className}`}>
      {/* Ambient background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${config.bgGradient} pointer-events-none`} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),transparent)] pointer-events-none" />

      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`
      }} />

      {/* Header */}
      {showHeader && (
        <header className="relative z-10 border-b border-white/5 backdrop-blur-xl bg-black/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3 group">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.accentColor} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform`}>
                  <span className="text-white font-bold text-lg">W</span>
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-white">Wells AI</h1>
                  <p className="text-xs text-white/40 capitalize">{journey} Journey</p>
                </div>
              </Link>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-white/60">Online</span>
                </div>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Messages Area */}
      <div className="relative flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`mb-6 flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Avatar */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                message.role === 'assistant'
                  ? `bg-gradient-to-br ${config.accentColor} shadow-lg`
                  : 'bg-white/10 border border-white/10'
              }`}>
                {message.role === 'assistant' ? (
                  <span className="text-white font-bold">W</span>
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
            <div className="mb-6 flex gap-4 animate-in fade-in duration-200">
              <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${config.accentColor} flex items-center justify-center shadow-lg`}>
                <span className="text-white font-bold">W</span>
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

      {/* Suggested prompts for first message */}
      {messages.length === 1 && (
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-white/40" />
            <span className="text-sm text-white/40">Try saying...</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {getSuggestedPrompts(journey).map((prompt, i) => (
              <button
                key={i}
                onClick={() => {
                  setInput(prompt)
                  inputRef.current?.focus()
                }}
                className="px-4 py-2 text-sm text-white/70 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 hover:border-white/20 transition-all"
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
            {/* Voice input button */}
            <button
              onClick={() => setIsListening(!isListening)}
              className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                isListening
                  ? `bg-gradient-to-br ${config.accentColor} text-white shadow-lg`
                  : 'bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10'
              }`}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Text input */}
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={config.placeholder}
                disabled={isLoading}
                rows={1}
                className="w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-xl text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:bg-white/[0.07] transition-all resize-none disabled:opacity-50"
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>

            {/* Send button */}
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                input.trim() && !isLoading
                  ? `bg-gradient-to-br ${config.accentColor} text-white shadow-lg hover:opacity-90 active:scale-95`
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

          {/* Footer hint */}
          <p className="text-center text-xs text-white/20 mt-3">
            Just talk naturally. I'll handle the rest.
          </p>
        </div>
      </div>

      {/* Custom styles */}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-in-from-bottom-2 {
          from { transform: translateY(8px); }
          to { transform: translateY(0); }
        }
        .animate-in {
          animation: fade-in 0.3s ease-out, slide-in-from-bottom-2 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getSuggestedPrompts(journey: JourneyType): string[] {
  switch (journey) {
    case 'buyer':
      return [
        "I need 500 units of packaging materials",
        "Looking for a manufacturer in the US",
        "Need quotes for industrial equipment"
      ]
    case 'seller':
      return [
        "I manufacture custom metal parts",
        "We provide logistics services",
        "Looking for buyers in the healthcare space"
      ]
    case 'founder':
      return [
        "I need to hire a CTO",
        "Looking for Series A investors",
        "Need a supplier for 10,000 units"
      ]
    case 'jobs':
      return [
        "I'm a senior product manager",
        "Looking for remote engineering roles",
        "Want to transition into tech"
      ]
    default:
      return [
        "I need to hire someone",
        "Looking for suppliers",
        "I want to sell my products"
      ]
  }
}
