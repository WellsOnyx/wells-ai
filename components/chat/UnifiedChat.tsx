// @ts-nocheck
'use client'

/**
 * Unified Chat Component
 * Shared chat interface that works on both Wells AI and Grain & Vault
 */

import { useState, useEffect, useRef } from 'react'
import { Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { ProductType } from '@/lib/chat/personas'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface UnifiedChatProps {
  product: ProductType
  journey?: string
  conversationId?: string
  onConversationCreated?: (conversationId: string) => void
  treasuryContext?: {
    accountId?: string
    companyName?: string
    grainBalance?: number
    creditLine?: number
  }
  className?: string
  placeholder?: string
  welcomeMessage?: string
}

export default function UnifiedChat({
  product,
  journey,
  conversationId: initialConversationId,
  onConversationCreated,
  treasuryContext,
  className = '',
  placeholder,
  welcomeMessage,
}: UnifiedChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load conversation history if conversationId provided
  useEffect(() => {
    if (initialConversationId) {
      loadConversation(initialConversationId)
    }
  }, [initialConversationId])

  // Add welcome message if provided and no messages
  useEffect(() => {
    if (welcomeMessage && messages.length === 0) {
      setMessages([{ role: 'assistant', content: welcomeMessage }])
    }
  }, [welcomeMessage])

  const loadConversation = async (convId: string) => {
    try {
      const response = await fetch(`/api/chat/unified?conversationId=${convId}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(
          data.messages.map((m: any) => ({
            role: m.role,
            content: m.content,
          }))
        )
      }
    } catch (error) {
      console.error('Error loading conversation:', error)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setError(null)

    // Add user message to UI
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }]
    setMessages(newMessages)

    setIsLoading(true)

    try {
      const response = await fetch('/api/chat/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          product,
          journey,
          conversationId,
          treasuryContext,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send message')
      }

      const data = await response.json()

      // Update conversation ID if this is a new conversation
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId)
        onConversationCreated?.(data.conversationId)
      }

      // Add assistant response
      setMessages([...newMessages, { role: 'assistant', content: data.message }])
    } catch (error) {
      console.error('Error sending message:', error)
      setError(error instanceof Error ? error.message : 'Failed to send message')
      // Remove the optimistically added user message on error
      setMessages(messages)
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

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm px-4">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-white p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              placeholder ||
              (product === 'grainvault'
                ? 'Ask about your balance, send a payment, or view transactions...'
                : 'What can I help you with today?')
            }
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              !input.trim() || isLoading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Product indicator */}
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <div
            className={`w-2 h-2 rounded-full ${
              product === 'grainvault' ? 'bg-green-500' : 'bg-blue-500'
            }`}
          />
          <span>
            {product === 'grainvault' ? 'Grain & Vault' : 'Wells AI'}
            {journey && ` • ${journey}`}
          </span>
          {conversationId && (
            <>
              <span>•</span>
              <CheckCircle className="w-3 h-3 text-green-500" />
              <span>Conversation saved</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
