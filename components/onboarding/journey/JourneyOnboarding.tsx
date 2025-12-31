'use client'

/**
 * JourneyOnboarding - The legendary welcome flow component
 *
 * Each journey gets a tailored, cinematic experience that shows
 * users exactly what Wells can do for them.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader2, ArrowRight, Check, Sparkles } from 'lucide-react'
import { UserJourney } from '@/lib/onboarding/types'

// ============================================================================
// TYPES
// ============================================================================

export interface JourneyPhase {
  id: string
  type: 'promise' | 'demo' | 'action' | 'transition'
  messages: WellsMessage[]
  showInput?: boolean
  inputPlaceholder?: string
  suggestedPrompts?: string[]
  onUserInput?: (input: string) => Promise<WellsMessage[] | null>
  autoAdvanceAfter?: number // ms
}

export interface WellsMessage {
  id: string
  content: string
  delay?: number // ms before showing
  typing?: boolean
  highlight?: boolean
  action?: {
    type: 'button' | 'demo-result' | 'match-preview'
    label?: string
    data?: any
  }
}

export interface JourneyConfig {
  journey: UserJourney
  accentColor: string
  glowColor: string
  bgGradient: string
  phases: JourneyPhase[]
}

interface JourneyOnboardingProps {
  config: JourneyConfig
  onComplete: (data: Record<string, any>) => void
}

// ============================================================================
// WELLS AVATAR COMPONENT
// ============================================================================

function WellsAvatar({
  color,
  size = 'md',
  animate = false
}: {
  color: string
  size?: 'sm' | 'md' | 'lg'
  animate?: boolean
}) {
  const sizes = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg'
  }

  return (
    <div className={`
      ${sizes[size]}
      rounded-xl
      bg-gradient-to-br ${color}
      flex items-center justify-center
      shadow-lg
      ${animate ? 'animate-pulse' : ''}
    `}>
      <span className="text-white font-bold">W</span>
    </div>
  )
}

// ============================================================================
// MESSAGE COMPONENT
// ============================================================================

function Message({
  message,
  config,
  onActionClick
}: {
  message: WellsMessage
  config: JourneyConfig
  onActionClick?: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [typingComplete, setTypingComplete] = useState(false)

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), message.delay || 0)
    const typeTimer = setTimeout(() => setTypingComplete(true), (message.delay || 0) + 800)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(typeTimer)
    }
  }, [message.delay])

  if (!visible) return null

  return (
    <div className="mb-6 flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <WellsAvatar color={config.accentColor} />

      <div className="flex-1 max-w-[85%]">
        <div className={`
          inline-block px-5 py-4 rounded-2xl rounded-bl-md text-[15px] leading-relaxed
          bg-white/[0.03] border backdrop-blur-sm
          ${message.highlight
            ? `border-${config.journey === 'buyer' ? 'cyan' : config.journey === 'seller' ? 'emerald' : config.journey === 'founder' ? 'amber' : 'purple'}-500/30`
            : 'border-white/[0.06]'
          }
        `}>
          {message.typing && !typingComplete ? (
            <div className="flex items-center gap-2 py-1">
              <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <>
              <div
                className="whitespace-pre-wrap text-white/90 prose prose-invert prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: message.content
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                    .replace(/\n/g, '<br />')
                }}
              />

              {message.action && (
                <div className="mt-4">
                  {message.action.type === 'button' && (
                    <button
                      onClick={onActionClick}
                      className={`
                        px-5 py-2.5 rounded-xl font-medium text-sm
                        bg-gradient-to-r ${config.accentColor}
                        text-white shadow-lg
                        hover:opacity-90 active:scale-95 transition-all
                        flex items-center gap-2
                      `}
                    >
                      {message.action.label}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}

                  {message.action.type === 'demo-result' && (
                    <DemoResult data={message.action.data} config={config} />
                  )}

                  {message.action.type === 'match-preview' && (
                    <MatchPreview data={message.action.data} config={config} />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// DEMO RESULT COMPONENT (for buyer flow)
// ============================================================================

function DemoResult({ data, config }: { data: any; config: JourneyConfig }) {
  return (
    <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="flex items-center gap-2 mb-3">
        <Check className="w-5 h-5 text-emerald-400" />
        <span className="text-sm font-medium text-white/90">Found in 2.3 seconds</span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-white/60 text-sm">Verified Suppliers</span>
          <span className="text-white font-medium">{data?.suppliers || 12}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/60 text-sm">Best Quote</span>
          <span className={`font-bold bg-gradient-to-r ${config.accentColor} bg-clip-text text-transparent`}>
            {data?.bestQuote || '$4,200'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/60 text-sm">Avg. Savings</span>
          <span className="text-emerald-400 font-medium">{data?.savings || '23%'}</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <p className="text-xs text-white/40">
          Wells can negotiate on your behalf to get even better pricing.
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// MATCH PREVIEW COMPONENT (for seller flow)
// ============================================================================

function MatchPreview({ data, config }: { data: any; config: JourneyConfig }) {
  const buyers = data?.buyers || [
    { industry: 'Manufacturing', size: 'Enterprise', urgency: 'High' },
    { industry: 'Healthcare', size: 'Mid-Market', urgency: 'Medium' },
    { industry: 'Retail', size: 'Enterprise', urgency: 'High' },
  ]

  return (
    <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-amber-400" />
        <span className="text-sm font-medium text-white/90">Active Buyers Looking Now</span>
      </div>

      <div className="space-y-2">
        {buyers.map((buyer: any, i: number) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
            <div className={`w-2 h-2 rounded-full ${buyer.urgency === 'High' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <div className="flex-1">
              <div className="text-sm text-white/80">{buyer.industry}</div>
              <div className="text-xs text-white/40">{buyer.size}</div>
            </div>
            <div className={`text-xs px-2 py-0.5 rounded-full ${
              buyer.urgency === 'High'
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-white/10 text-white/60'
            }`}>
              {buyer.urgency} Priority
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-white/40">
        Names hidden until you're matched. Wells handles the intro.
      </p>
    </div>
  )
}

// ============================================================================
// PROGRESS INDICATOR
// ============================================================================

function ProgressIndicator({
  currentPhase,
  totalPhases,
  config
}: {
  currentPhase: number
  totalPhases: number
  config: JourneyConfig
}) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalPhases }).map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-500 ${
            i < currentPhase
              ? `w-8 bg-gradient-to-r ${config.accentColor}`
              : i === currentPhase
                ? `w-8 bg-gradient-to-r ${config.accentColor} animate-pulse`
                : 'w-2 bg-white/20'
          }`}
        />
      ))}
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function JourneyOnboarding({ config, onComplete }: JourneyOnboardingProps) {
  const router = useRouter()
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0)
  const [displayedMessages, setDisplayedMessages] = useState<WellsMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [collectedData, setCollectedData] = useState<Record<string, any>>({})

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const currentPhase = config.phases[currentPhaseIndex]

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayedMessages])

  // Display phase messages sequentially
  useEffect(() => {
    if (!currentPhase) return

    const showMessages = async () => {
      for (let i = 0; i < currentPhase.messages.length; i++) {
        const msg = currentPhase.messages[i]
        await new Promise(resolve => setTimeout(resolve, msg.delay || (i * 1000)))
        setDisplayedMessages(prev => [...prev, { ...msg, typing: true }])
      }

      // Auto-advance if configured
      if (currentPhase.autoAdvanceAfter) {
        setTimeout(() => {
          advancePhase()
        }, currentPhase.autoAdvanceAfter)
      }
    }

    showMessages()
  }, [currentPhaseIndex])

  // Focus input when phase allows input
  useEffect(() => {
    if (currentPhase?.showInput) {
      setTimeout(() => inputRef.current?.focus(), 500)
    }
  }, [currentPhase])

  const advancePhase = useCallback(() => {
    if (currentPhaseIndex < config.phases.length - 1) {
      setCurrentPhaseIndex(prev => prev + 1)
    } else {
      // Onboarding complete - transition to chat
      onComplete(collectedData)
    }
  }, [currentPhaseIndex, config.phases.length, collectedData, onComplete])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }, [])

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !currentPhase?.onUserInput) return

    const userInput = input.trim()
    setInput('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    // Add user message
    setDisplayedMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      content: userInput,
    }])

    setIsLoading(true)

    try {
      const responseMessages = await currentPhase.onUserInput(userInput)

      if (responseMessages) {
        // Store collected data
        setCollectedData(prev => ({ ...prev, [`phase_${currentPhaseIndex}`]: userInput }))

        // Show response messages
        for (const msg of responseMessages) {
          await new Promise(resolve => setTimeout(resolve, msg.delay || 800))
          setDisplayedMessages(prev => [...prev, msg])
        }
      }

      // Advance to next phase after response
      setTimeout(() => advancePhase(), 2000)
    } catch (error) {
      console.error('Error processing input:', error)
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

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f]">
      {/* Ambient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${config.bgGradient} pointer-events-none`} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.1),transparent)] pointer-events-none" />

      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`
      }} />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-xl bg-black/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <WellsAvatar color={config.accentColor} size="lg" />
              <div>
                <h1 className="text-lg font-semibold text-white">Wells AI</h1>
                <p className="text-xs text-white/40 capitalize">{config.journey} Experience</p>
              </div>
            </div>

            <ProgressIndicator
              currentPhase={currentPhaseIndex}
              totalPhases={config.phases.length}
              config={config}
            />
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="relative flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          {displayedMessages.map((message) => (
            <Message
              key={message.id}
              message={message}
              config={config}
              onActionClick={advancePhase}
            />
          ))}

          {isLoading && (
            <div className="mb-6 flex gap-4">
              <WellsAvatar color={config.accentColor} animate />
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

      {/* Suggested Prompts */}
      {currentPhase?.suggestedPrompts && currentPhase.showInput && !isLoading && (
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-white/40" />
            <span className="text-sm text-white/40">Try saying...</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {currentPhase.suggestedPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSuggestedPrompt(prompt)}
                className="px-4 py-2 text-sm text-white/70 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 hover:border-white/20 transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      {currentPhase?.showInput && (
        <div className="relative border-t border-white/5 backdrop-blur-xl bg-black/40">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={currentPhase.inputPlaceholder || "Type your message..."}
                  disabled={isLoading}
                  rows={1}
                  className="w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-xl text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:bg-white/[0.07] transition-all resize-none disabled:opacity-50"
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                />
              </div>

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
          </div>
        </div>
      )}

      {/* Styles */}
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
          animation: fade-in 0.5s ease-out, slide-in-from-bottom-2 0.5s ease-out;
        }
      `}</style>
    </div>
  )
}
