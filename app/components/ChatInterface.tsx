'use client'

/**
 * Wells AI Chat Interface
 *
 * Reusable chat component for all journeys.
 * Powers the "Talk to Wells" experience.
 */

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatInterfaceProps {
  journey: 'founder' | 'buyer' | 'seller' | 'jobs'
  title: string
  subtitle: string
  placeholder?: string
  initialMessage?: string
  accentColor?: string
}

export default function ChatInterface({
  journey,
  title,
  subtitle,
  placeholder = 'Tell Wells what you need...',
  initialMessage,
  accentColor = 'amber',
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(
    initialMessage
      ? [{ role: 'assistant', content: initialMessage }]
      : []
  )
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)

    // Add user message
    const updatedMessages: Message[] = [
      ...messages,
      { role: 'user', content: userMessage },
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

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const data = await response.json()

      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: data.message },
      ])
    } catch {
      setMessages([
        ...updatedMessages,
        {
          role: 'assistant',
          content: "I'm having trouble connecting right now. Please try again in a moment.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const colorClasses = {
    amber: {
      accent: 'bg-amber-500',
      accentHover: 'hover:bg-amber-600',
      accentText: 'text-amber-500',
      accentBg: 'bg-amber-500/10',
      gradient: 'from-amber-500 to-orange-600',
    },
    blue: {
      accent: 'bg-blue-500',
      accentHover: 'hover:bg-blue-600',
      accentText: 'text-blue-500',
      accentBg: 'bg-blue-500/10',
      gradient: 'from-blue-500 to-cyan-600',
    },
    green: {
      accent: 'bg-green-500',
      accentHover: 'hover:bg-green-600',
      accentText: 'text-green-500',
      accentBg: 'bg-green-500/10',
      gradient: 'from-green-500 to-emerald-600',
    },
    purple: {
      accent: 'bg-purple-500',
      accentHover: 'hover:bg-purple-600',
      accentText: 'text-purple-500',
      accentBg: 'bg-purple-500/10',
      gradient: 'from-purple-500 to-pink-600',
    },
  }

  const colors = colorClasses[accentColor as keyof typeof colorClasses] || colorClasses.amber

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back</span>
              </Link>
              <div className="h-6 w-px bg-gray-700" />
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${colors.gradient}`} />
                <div>
                  <span className="text-lg font-bold">{title}</span>
                  <p className="text-xs text-gray-400 hidden sm:block">{subtitle}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${colors.accent} animate-pulse`} />
              <span className="text-sm text-gray-400">Wells is online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-hidden">
        <div className="container mx-auto px-4 h-full max-w-3xl">
          <div className="h-full flex flex-col py-4">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 pb-4">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${colors.gradient} flex items-center justify-center mx-auto mb-4`}>
                    <span className="text-2xl font-bold">W</span>
                  </div>
                  <h2 className="text-xl font-semibold mb-2">{title}</h2>
                  <p className="text-gray-400 max-w-md mx-auto">{subtitle}</p>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? `${colors.accent} text-black`
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
                    <Loader2 className={`w-5 h-5 ${colors.accentText} animate-spin`} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-800 pt-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={placeholder}
                  disabled={isLoading}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  className={`${colors.accent} ${colors.accentHover} text-black px-4 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <p className="text-center text-xs text-gray-500 mt-2">
                Wells AI takes action on your behalf. 1% fee on closed deals only.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
