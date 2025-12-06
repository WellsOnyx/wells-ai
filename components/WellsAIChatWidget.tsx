'use client'

/**
 * WellsAI Chat Widget
 *
 * A floating chat widget that can be embedded on any page.
 * Connects to the WellsAI backend for AI-powered conversations.
 */

import { useState, useRef, useEffect } from 'react'
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Sparkles,
  Minimize2,
  Maximize2
} from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface WellsAIChatWidgetProps {
  // Branding
  brandColor?: string
  accentColor?: string
  brandName?: string

  // Context for the AI
  context?: string
  journey?: 'founder' | 'buyer' | 'seller' | 'jobs' | 'support'

  // Behavior
  defaultOpen?: boolean
  greeting?: string
  placeholder?: string

  // Position
  position?: 'bottom-right' | 'bottom-left'
}

export default function WellsAIChatWidget({
  brandColor = '#22C55E',
  accentColor = '#10B981',
  brandName = 'Assistant',
  context = '',
  journey = 'support',
  defaultOpen = false,
  greeting = "Hi! How can I help you today?",
  placeholder = "Type a message...",
  position = 'bottom-right'
}: WellsAIChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Add initial greeting when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ role: 'assistant', content: greeting }])
    }
  }, [isOpen, greeting, messages.length])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, isMinimized])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)

    const updatedMessages: Message[] = [
      ...messages,
      { role: 'user', content: userMessage }
    ]
    setMessages(updatedMessages)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          journey,
          context: context || undefined
        })
      })

      if (!response.ok) throw new Error('Failed to send message')

      const data = await response.json()
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: data.message }
      ])
    } catch {
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: "I'm having trouble connecting. Please try again." }
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

  const positionClasses = position === 'bottom-right'
    ? 'right-4 sm:right-6'
    : 'left-4 sm:left-6'

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-4 sm:bottom-6 ${positionClasses} z-50 w-14 h-14 rounded-full shadow-lg hover:scale-110 transition-all flex items-center justify-center group`}
        style={{ background: `linear-gradient(135deg, ${brandColor}, ${accentColor})` }}
      >
        <MessageSquare className="w-6 h-6 text-white" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-bold">
          1
        </span>
        {/* Tooltip */}
        <div className="absolute bottom-full mb-2 right-0 px-3 py-1.5 bg-black text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
          Chat with {brandName}
        </div>
      </button>
    )
  }

  return (
    <div
      className={`fixed bottom-4 sm:bottom-6 ${positionClasses} z-50 ${
        isMinimized ? 'w-72' : 'w-[360px] sm:w-[400px]'
      } transition-all duration-300`}
    >
      <div className="bg-black/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-white/10 cursor-pointer"
          style={{ background: `linear-gradient(135deg, ${brandColor}20, ${accentColor}10)` }}
          onClick={() => setIsMinimized(!isMinimized)}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${brandColor}, ${accentColor})` }}
            >
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{brandName}</div>
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                Online
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsMinimized(!isMinimized)
              }}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              {isMinimized ? (
                <Maximize2 className="w-4 h-4" />
              ) : (
                <Minimize2 className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsOpen(false)
              }}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="flex-1 h-[350px] overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center mr-2 flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${brandColor}, ${accentColor})` }}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      message.role === 'user'
                        ? 'text-white'
                        : 'bg-white/5 border border-white/10 text-gray-100'
                    }`}
                    style={message.role === 'user' ? {
                      background: `linear-gradient(135deg, ${brandColor}, ${accentColor})`
                    } : {}}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center mr-2 flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${brandColor}, ${accentColor})` }}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5">
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: brandColor }} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={placeholder}
                  disabled={isLoading}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30 disabled:opacity-50 transition-all"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  className="px-4 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                  style={{
                    background: `linear-gradient(135deg, ${brandColor}, ${accentColor})`,
                    color: 'white'
                  }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-gray-500 text-center mt-2">
                Powered by Wells AI
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
