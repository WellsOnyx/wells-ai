'use client'

/**
 * JourneyStep - Conversational Journey Selection
 *
 * Instead of clicking buttons, users tell Wells why they're here.
 * Wells understands naturally and routes them to the right journey.
 * Pure chat - no forms, no buttons.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, Sparkles } from 'lucide-react'
import { UserJourney, JOURNEY_CONFIG } from '@/lib/onboarding/types'

interface JourneyStepProps {
  onSelect: (journey: UserJourney) => void
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const WELLS_GREETING = `Hey, I'm Wells. I can help you with a lot of things:

**Looking to buy?** I'll find you verified suppliers and negotiate deals.

**Looking to sell?** I'll connect you with qualified buyers who need what you offer.

**Building a company?** I'll help you hire, source, and raise capital.

**Looking for work?** I'll get you direct intros to hiring managers.

So, what brings you here today?`

const JOURNEY_KEYWORDS: Record<UserJourney, string[]> = {
  buyer: ['buy', 'purchase', 'source', 'procurement', 'need', 'supplier', 'vendor', 'quote', 'order', 'material', 'equipment', 'parts'],
  seller: ['sell', 'sales', 'customer', 'client', 'buyer', 'revenue', 'offer', 'provide', 'manufacture', 'supply', 'distribute'],
  founder: ['hire', 'hiring', 'startup', 'founder', 'company', 'build', 'grow', 'scale', 'investor', 'raise', 'funding', 'team', 'cto', 'cfo', 'executive'],
  jobs: ['job', 'work', 'career', 'role', 'position', 'opportunity', 'employ', 'salary', 'remote', 'looking for work', 'job search']
}

function detectJourney(message: string): UserJourney | null {
  const lowerMessage = message.toLowerCase()

  // Check for direct matches first
  if (lowerMessage.includes("i'm a founder") || lowerMessage.includes("i'm founding") || lowerMessage.includes("my startup") || lowerMessage.includes("my company")) {
    return 'founder'
  }
  if (lowerMessage.includes("looking for a job") || lowerMessage.includes("job search") || lowerMessage.includes("find work") || lowerMessage.includes("need a role")) {
    return 'jobs'
  }
  if (lowerMessage.includes("i sell") || lowerMessage.includes("we sell") || lowerMessage.includes("find buyers") || lowerMessage.includes("find customers")) {
    return 'seller'
  }
  if (lowerMessage.includes("i need to buy") || lowerMessage.includes("looking to buy") || lowerMessage.includes("purchase") || lowerMessage.includes("find suppliers")) {
    return 'buyer'
  }

  // Score-based detection
  const scores: Record<UserJourney, number> = {
    buyer: 0,
    seller: 0,
    founder: 0,
    jobs: 0
  }

  for (const [journey, keywords] of Object.entries(JOURNEY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        scores[journey as UserJourney] += 1
      }
    }
  }

  const maxScore = Math.max(...Object.values(scores))
  if (maxScore === 0) return null

  const topJourney = (Object.entries(scores).find(([_, score]) => score === maxScore)?.[0]) as UserJourney
  return topJourney
}

function getJourneyConfirmation(journey: UserJourney): string {
  const config = JOURNEY_CONFIG[journey]
  switch (journey) {
    case 'buyer':
      return `Got it! You're looking to buy and source products. I'll help you find verified suppliers, get competitive quotes, and negotiate the best deals.\n\nLet me set up your buyer profile...`
    case 'seller':
      return `Perfect! You're here to find qualified buyers. I'll match you with companies actively looking for what you offer - no cold outreach needed.\n\nLet me set up your seller profile...`
    case 'founder':
      return `Awesome! You're building a company. I can help you hire talent, source suppliers, find customers, and even make investor intros. Whatever you need.\n\nLet me set up your founder profile...`
    case 'jobs':
      return `I've got you! You're looking for your next role. Forget job boards - I'll get you direct intros to hiring managers at companies that are actually hiring for what you do.\n\nLet me set up your profile...`
  }
}

function getClarificationQuestion(): string {
  return `I want to make sure I help you the right way. Are you here to:\n\n- **Buy** products or services\n- **Sell** what you offer\n- **Build** a company (hiring, sourcing, fundraising)\n- Find a **job**\n\nJust tell me in your own words.`
}

export function JourneyStep({ onSelect }: JourneyStepProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: WELLS_GREETING,
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [detectedJourney, setDetectedJourney] = useState<UserJourney | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll and focus
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }, [])

  const processMessage = async (userMessage: string) => {
    // Add user message
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    // Detect journey from message
    const journey = detectJourney(userMessage)

    // Simulate processing delay for natural feel
    await new Promise(resolve => setTimeout(resolve, 800))

    if (journey) {
      // Journey detected - confirm and proceed
      setDetectedJourney(journey)
      const confirmationMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: getJourneyConfirmation(journey),
        timestamp: new Date()
      }
      setMessages(prev => [...prev, confirmationMsg])
      setIsLoading(false)

      // Trigger onSelect after short delay for user to read
      setTimeout(() => {
        onSelect(journey)
      }, 2000)
    } else {
      // Could not detect - ask for clarification
      const clarifyMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: getClarificationQuestion(),
        timestamp: new Date()
      }
      setMessages(prev => [...prev, clarifyMsg])
      setIsLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading || detectedJourney) return
    const message = input.trim()
    setInput('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
    await processMessage(message)
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
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
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
                ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg'
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
                className={`inline-block px-5 py-4 rounded-2xl text-[15px] leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-white/10 text-white border border-white/10 rounded-br-md'
                    : 'bg-white/[0.03] text-white/90 border border-white/[0.06] rounded-bl-md'
                }`}
              >
                <div
                  className="whitespace-pre-wrap prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: message.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\n/g, '<br />')
                  }}
                />
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
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold">W</span>
            </div>
            <div className="flex items-center gap-2 px-5 py-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl rounded-bl-md">
              <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {/* Journey detected indicator */}
        {detectedJourney && (
          <div className="flex items-center justify-center gap-2 py-4 text-emerald-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Setting up your {JOURNEY_CONFIG[detectedJourney].title.toLowerCase()} profile...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts for first message */}
      {messages.length === 1 && !isLoading && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-400/60" />
            <span className="text-sm text-white/40">Try saying...</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              "I'm looking to buy equipment for my business",
              "I want to find new customers for my products",
              "I'm building a startup and need to hire",
              "I'm looking for my next role"
            ].map((prompt, i) => (
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
      {!detectedJourney && (
        <div className="border-t border-white/5 bg-black/20 backdrop-blur-sm p-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Just tell me why you're here..."
                disabled={isLoading}
                rows={1}
                className="w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-xl text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] transition-all resize-none disabled:opacity-50"
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>

            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                input.trim() && !isLoading
                  ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg hover:opacity-90 active:scale-95'
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
        </div>
      )}

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
