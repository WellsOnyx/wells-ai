'use client'

/**
 * HeroChat - Interactive Wells AI Chat for Landing Page
 * Real AI conversation directly on the homepage
 */

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// Initial greeting from Wells
const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: "Hi, I'm Wells. Tell me what you need — hiring, sourcing, finding customers, or closing deals. I'll handle the rest."
}

export default function HeroChat() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll chat container to bottom (without affecting page scroll)
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const response = await fetch('/api/wells-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMessage }],
          isHeroChat: true
        })
      })

      if (!response.ok) throw new Error('Failed to get response')

      const data = await response.json()

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message || "I'm here to help. Can you tell me more about what you need?"
      }])
    } catch (error) {
      console.error('Chat error:', error)
      // Fallback response if API fails
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'd love to help with that. To get started, would you like to hire talent, source suppliers, find customers, or close a deal?"
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative bg-white border border-gray-200 rounded-[20px] overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.02),0_12px_24px_rgba(0,0,0,0.06),0_24px_48px_rgba(0,0,0,0.04)]">
      {/* Chat Header */}
      <div className="px-5 py-4 bg-gray-900 flex items-center gap-3">
        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-500 rounded-[10px] flex items-center justify-center text-white font-semibold text-sm">
          W
        </div>
        <div>
          <h4 className="text-white text-sm font-semibold">Wells</h4>
          <span className="text-white/50 text-xs flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Online now
          </span>
        </div>
      </div>

      {/* Chat Body */}
      <div
        ref={chatContainerRef}
        className="p-4 h-[320px] overflow-y-auto flex flex-col gap-3 bg-gray-50 scroll-smooth"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed animate-fade-in ${
              msg.role === 'user'
                ? 'bg-white text-gray-900 self-end border border-gray-200 rounded-br-md shadow-sm'
                : 'bg-gray-900 text-white self-start rounded-bl-md shadow-md'
            }`}
          >
            {msg.content}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-1.5 px-4 py-3.5 bg-gray-900 rounded-2xl rounded-bl-md self-start w-16">
            <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>

      {/* Chat Input */}
      <form onSubmit={handleSubmit} className="px-4 py-4 bg-white border-t border-gray-200 flex gap-3">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tell Wells what you need..."
          disabled={isLoading}
          className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-[10px] text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-5 py-3 bg-gray-900 text-white text-sm font-medium rounded-[10px] hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Send
              <Send className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Animation styles */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
