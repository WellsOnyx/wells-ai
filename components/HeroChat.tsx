'use client'

/**
 * HeroChat - Embeddable Mini Wells Chat Widget for Homepage Hero
 *
 * Features:
 * - Compact glassmorphic design (dark bg, gold accents)
 * - Pre-written demo messages showing Wells in action
 * - Animated typing indicators
 * - Wells avatar with gold gradient
 * - Text input redirects to /join when focused/typed into
 */

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Sparkles } from 'lucide-react'

interface DemoMessage {
  role: 'user' | 'wells'
  content: string
  delay: number // ms before showing this message
}

// Demo conversation showcasing Wells capabilities
const DEMO_CONVERSATION: DemoMessage[] = [
  {
    role: 'user',
    content: 'I need to hire a Head of Engineering in Miami, under $250k',
    delay: 0
  },
  {
    role: 'wells',
    content: 'Found 847 candidates matching your criteria. I\'ve already reached out to the top 12 with >15 years experience. 3 have responded - scheduling interviews for this week.',
    delay: 1500
  },
  {
    role: 'user',
    content: 'Also need industrial pumps for our manufacturing plant',
    delay: 4500
  },
  {
    role: 'wells',
    content: 'RFQ sent to 23 verified suppliers. Best quote so far: $127k (18% below market). Deadline in 48hrs. Want me to negotiate further?',
    delay: 6000
  }
]

// Typing indicator component
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 bg-amber-500/60 rounded-full"
            style={{
              animation: 'typing-bounce 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.15}s`
            }}
          />
        ))}
      </div>
    </div>
  )
}

// Wells Avatar with gold gradient
function WellsAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base'
  }

  return (
    <div className={`${sizeClasses[size]} relative flex-shrink-0`}>
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl blur-md opacity-40" />
      {/* Avatar */}
      <div className="relative w-full h-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
        <span className="font-bold text-black/80">W</span>
      </div>
      {/* Online indicator */}
      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-gray-900">
        <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-50" />
      </div>
    </div>
  )
}

export default function HeroChat() {
  const router = useRouter()
  const [visibleMessages, setVisibleMessages] = useState<DemoMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const chatRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Animate demo messages appearing
  useEffect(() => {
    let currentIndex = 0
    const timers: NodeJS.Timeout[] = []

    const showNextMessage = () => {
      if (currentIndex >= DEMO_CONVERSATION.length) {
        // Loop the demo after a pause
        const resetTimer = setTimeout(() => {
          setVisibleMessages([])
          setIsTyping(false)
          currentIndex = 0
          showNextMessage()
        }, 8000)
        timers.push(resetTimer)
        return
      }

      const message = DEMO_CONVERSATION[currentIndex]

      // If it's Wells' turn, show typing first
      if (message.role === 'wells') {
        setIsTyping(true)
        const typingTimer = setTimeout(() => {
          setIsTyping(false)
          setVisibleMessages(prev => [...prev, message])
          currentIndex++
          showNextMessage()
        }, 1200)
        timers.push(typingTimer)
      } else {
        setVisibleMessages(prev => [...prev, message])
        currentIndex++
        const nextTimer = setTimeout(showNextMessage, DEMO_CONVERSATION[currentIndex]?.delay || 1500)
        timers.push(nextTimer)
      }
    }

    // Start after initial delay
    const startTimer = setTimeout(showNextMessage, 500)
    timers.push(startTimer)

    return () => timers.forEach(t => clearTimeout(t))
  }, [])

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [visibleMessages, isTyping])

  // Handle input interaction - redirect to /join
  const handleInputFocus = () => {
    setInputFocused(true)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    // Redirect after a brief moment of typing
    if (e.target.value.length >= 2) {
      router.push('/join')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    router.push('/join')
  }

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Ambient glow */}
      <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/20 via-amber-600/10 to-violet-500/20 rounded-3xl blur-2xl opacity-60 pointer-events-none" />

      {/* Main chat container - glassmorphic */}
      <div className="relative bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/40">

        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <WellsAvatar size="md" />
            <div>
              <h4 className="text-white text-sm font-semibold flex items-center gap-1.5">
                Wells
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              </h4>
              <span className="text-gray-400 text-xs">
                Enterprise AI that executes
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Live Demo
          </div>
        </div>

        {/* Chat messages */}
        <div
          ref={chatRef}
          className="h-[240px] overflow-y-auto p-4 flex flex-col gap-3 scroll-smooth"
          style={{
            background: 'linear-gradient(180deg, rgba(17,24,39,0.95) 0%, rgba(10,15,26,0.98) 100%)'
          }}
        >
          {/* Initial Wells greeting */}
          <div className="flex gap-2.5 items-start chat-message-animate">
            <WellsAvatar size="sm" />
            <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%]">
              <p className="text-white/90 text-sm leading-relaxed">
                Hi, I'm Wells. Tell me what you need - hiring, sourcing, sales, or deals. I'll execute immediately.
              </p>
            </div>
          </div>

          {/* Demo messages */}
          {visibleMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2.5 items-start chat-message-animate ${
                msg.role === 'user' ? 'flex-row-reverse' : ''
              }`}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              {msg.role === 'wells' && <WellsAvatar size="sm" />}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-tr-md text-white'
                    : 'bg-white/5 border border-white/10 rounded-tl-md'
                }`}
              >
                <p className={`text-sm leading-relaxed ${
                  msg.role === 'user' ? 'text-amber-100' : 'text-white/90'
                }`}>
                  {msg.content}
                </p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-2.5 items-start chat-message-animate">
              <WellsAvatar size="sm" />
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-md">
                <TypingIndicator />
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <form
          onSubmit={handleSubmit}
          className="px-4 py-3 bg-gray-900/80 border-t border-white/10"
        >
          <div className={`relative flex items-center gap-2 bg-white/5 border rounded-xl px-3 py-2.5 transition-all duration-300 ${
            inputFocused
              ? 'border-amber-500/50 ring-2 ring-amber-500/20 bg-white/10'
              : 'border-white/10 hover:border-white/20'
          }`}>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              placeholder="Tell Wells what you need..."
              className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-500 focus:outline-none"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-black text-xs font-semibold rounded-lg hover:from-amber-400 hover:to-amber-500 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-500/20"
            >
              Try Wells
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Subtle hint */}
          <p className="text-center text-gray-500 text-[11px] mt-2">
            Click to start a real conversation with Wells
          </p>
        </form>
      </div>

      {/* Animation styles */}
      <style jsx global>{`
        @keyframes typing-bounce {
          0%, 60%, 100% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-4px);
          }
        }

        .chat-message-animate {
          opacity: 0;
          transform: translateY(10px);
          animation: chat-appear 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @keyframes chat-appear {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
