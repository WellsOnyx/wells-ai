'use client'

/**
 * Wells AI - Conversational Interface
 *
 * No forms. No buttons. No cards.
 * Just you and Wells, talking.
 */

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Sparkles, Send } from 'lucide-react'

export default function WellsApp() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'wells', content: string }>>([])

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/sign-in')
    }
  }, [isLoaded, user, router])

  // Initial Wells greeting
  useEffect(() => {
    if (user) {
      setMessages([{
        role: 'wells',
        content: `Hey ${user.firstName || 'there'}, which journey are you on today? Buyer, Seller, Job Seeker, or Founder?`
      }])
    }
  }, [user])

  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = async () => {
    if (!message.trim() || isLoading) return

    // Add user message
    const userMessage = message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setMessage('')
    setIsLoading(true)

    try {
      // Build messages array for context (excluding the greeting)
      const conversationHistory = [...messages, { role: 'user' as const, content: userMessage }]
        .filter(msg => msg.role === 'user' || msg.role === 'wells')
        .map(msg => ({
          role: msg.role === 'wells' ? 'assistant' as const : 'user' as const,
          content: msg.content
        }))

      // Call Wells AI backend with full conversation history
      const response = await fetch('/api/chat/wells-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationHistory,
          userId: user?.id,
          conversationId,
        })
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      // Save conversation ID
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId)
      }

      // Clean response (remove action markers)
      const cleanResponse = data.response.replace(/\[ACTION:[^\]]+\]/g, '').trim()

      // Add Wells response
      setMessages(prev => [...prev, {
        role: 'wells',
        content: cleanResponse
      }])

      // Handle any UI updates from actions
      if (data.actions?.length > 0) {
        console.log('[WELLS ACTIONS]', data.actions)
        // Could show toast notifications for actions taken
      }

    } catch (error: any) {
      console.error('[WELLS CHAT] Error:', error)
      setMessages(prev => [...prev, {
        role: 'wells',
        content: "Sorry, I hit a snag. Can you try that again?"
      }])
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'wells' && (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-black" />
                </div>
              )}
              <div
                className={`max-w-2xl px-6 py-4 rounded-2xl ${
                  msg.role === 'wells'
                    ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white border border-gray-700'
                    : 'bg-gradient-to-br from-amber-600 to-amber-700 text-white'
                }`}
              >
                <p className="text-lg leading-relaxed">{msg.content}</p>
              </div>
              {msg.role === 'user' && (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
                  {user.firstName?.[0] || 'U'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 bg-gray-900/50 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex gap-4">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your message..."
              className="flex-1 bg-gray-800 text-white px-6 py-4 rounded-full border border-gray-700 focus:outline-none focus:border-amber-500 text-lg"
              autoFocus
            />
            <button
              onClick={handleSend}
              className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center hover:scale-105 transition-transform"
            >
              <Send className="w-5 h-5 text-black" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
