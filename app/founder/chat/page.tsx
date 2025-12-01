'use client'

/**
 * Founder Chat - Conversational Interface
 *
 * Integrated with:
 * - lib/journeys/founder-detection.ts - Detects founder intent
 * - lib/journeys/founder-flows.ts - Orchestrates flows
 * - /api/chat - Claude-powered conversation
 *
 * Features:
 * - Natural conversation with Wells AI
 * - Quick action buttons that trigger flows
 * - Context-aware responses based on founder profile
 * - Seamless handoff to specialized flows
 */

import { useUser } from '@clerk/nextjs'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Send,
  Loader2,
  Sparkles
} from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function FounderChatPage() {
  const { user } = useUser()
  const searchParams = useSearchParams()
  const initialPrompt = searchParams?.get('prompt')

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Initial greeting
    if (messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: `Hey ${user?.firstName || 'there'}.\n\nI'm Wells. I help founders move fast on the hard stuff.\n\nNeed to hire a CTO? I'll run the search.\nNeed your first 10 customers? I'll launch the campaign.\nNeed to source equipment? I'll find suppliers.\nNeed to raise capital? I'll draft your deck and connect you with investors.\n\nJust tell me what you need. I'll make it happen.`,
          timestamp: new Date()
        }
      ])
    }

    // Handle initial prompt from URL
    if (initialPrompt && messages.length === 1) {
      handleSend(initialPrompt)
    }
  }, [user, initialPrompt])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (text?: string) => {
    const messageText = text || input
    if (!messageText.trim()) return

    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: messageText,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Send to chat API with founder context
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          context: {
            journey: 'founder',
            userId: user?.id
          }
        })
      })

      const data = await response.json()

      // Add AI response
      const aiMessage: Message = {
        role: 'assistant',
        content: data.message || data.response || 'I can help with that. Let me know more details.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, aiMessage])

    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had trouble processing that. Can you try again?',
        timestamp: new Date()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const quickStarters = [
    'I need to hire a CTO',
    'Get me 10 customers',
    'Source manufacturing equipment',
    'Draft my pitch deck',
    'Find me a CFO'
  ]

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 bg-black/40 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-black" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Wells</h1>
                <p className="text-xs text-gray-400">Just tell me what you need</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="space-y-6">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-black" />
                  </div>
                )}
                <div className={`flex flex-col gap-3 max-w-2xl`}>
                  <div
                    className={`rounded-2xl px-6 py-4 ${
                      message.role === 'user'
                        ? 'bg-amber-500 text-black'
                        : 'bg-gray-900 text-white border border-gray-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  </div>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                    {user?.firstName?.charAt(0) || 'F'}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-black" />
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span className="text-gray-400">Wells is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-800 bg-black/40 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4 max-w-4xl">
          {/* Quick Starters (only show if few messages) */}
          {messages.length <= 2 && (
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                {quickStarters.map((starter, index) => (
                  <button
                    key={index}
                    onClick={() => handleSend(starter)}
                    className="px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-amber-500/50 rounded-lg transition-all text-sm text-gray-300 hover:text-white"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex gap-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message Wells AI..."
              className="flex-1 px-6 py-4 bg-gray-900 border border-gray-800 rounded-xl focus:outline-none focus:border-amber-500 text-white placeholder-gray-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-6 py-4 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-800 disabled:text-gray-500 rounded-xl transition-colors flex items-center gap-2 font-medium text-black disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
