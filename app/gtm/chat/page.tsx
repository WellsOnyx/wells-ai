'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Message {
  role: 'assistant' | 'user'
  content: string
  options?: string[]
  quickReplies?: { label: string; value: string }[]
}

export default function GTMChat() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [campaignData, setCampaignData] = useState<any>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Start conversation
    setMessages([
      {
        role: 'assistant',
        content: "Hi! I'm your GTM assistant. I'll help you find and reach out to potential customers.\n\nWhat service are you selling?",
        quickReplies: [
          { label: 'Life Insurance', value: 'Life Insurance' },
          { label: 'Executive Search', value: 'Executive Search' },
          { label: 'Technology Consulting', value: 'Technology Consulting' },
          { label: 'Something else...', value: 'OTHER' }
        ]
      }
    ])
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (userInput?: string) => {
    const messageText = userInput || input
    if (!messageText.trim()) return

    // Add user message
    const userMessage: Message = { role: 'user', content: messageText }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Process the conversation
      const response = await fetch('/api/gtm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          campaignData
        })
      })

      const data = await response.json()

      if (data.success) {
        // Add assistant response
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.message,
          quickReplies: data.quickReplies
        }
        setMessages(prev => [...prev, assistantMessage])

        // Update campaign data
        if (data.campaignData) {
          setCampaignData(data.campaignData)
        }

        // If campaign is ready to launch
        if (data.readyToLaunch) {
          // Show launch confirmation
          setTimeout(() => {
            router.push(`/gtm/dashboard?launched=${data.campaignId}`)
          }, 2000)
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had trouble processing that. Could you try again?'
      }])
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

  const handleQuickReply = (value: string) => {
    sendMessage(value)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[#9ea1a7]/20 sticky top-0 bg-white z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-serif text-[#183b6d]">Start a Campaign</h1>
              <div className="text-sm text-[#575757]">I'll ask a few simple questions</div>
            </div>
            <button
              onClick={() => router.push('/gtm/dashboard')}
              className="text-[#9ea1a7] hover:text-[#183b6d] text-sm"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="max-w-4xl mx-auto px-6 py-8 pb-32">
        <div className="space-y-6">
          {messages.map((message, index) => (
            <div key={index}>
              {message.role === 'assistant' ? (
                <div className="flex justify-start">
                  <div className="max-w-[80%]">
                    {/* Assistant Avatar */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-[#183b6d] flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                      </div>
                      <span className="text-sm text-[#9ea1a7]">Wells AI</span>
                    </div>

                    {/* Message */}
                    <div className="bg-[#183b6d]/5 rounded-lg p-4 mb-3">
                      <div className="text-[#183b6d] whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </div>
                    </div>

                    {/* Quick Replies */}
                    {message.quickReplies && message.quickReplies.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {message.quickReplies.map((reply, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleQuickReply(reply.value)}
                            className="px-4 py-2 bg-white border-2 border-[#183b6d] text-[#183b6d] rounded-full hover:bg-[#183b6d] hover:text-white transition-all text-sm font-medium"
                          >
                            {reply.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <div className="max-w-[80%] bg-[#dba63f] rounded-lg p-4">
                    <div className="text-white whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[#183b6d]/5 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#183b6d] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-[#183b6d] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-[#183b6d] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#9ea1a7]/20 z-10">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your answer..."
              className="flex-1 px-6 py-4 text-lg border-2 border-[#9ea1a7]/30 rounded-full focus:outline-none focus:border-[#183b6d] transition-colors"
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={isLoading || !input.trim()}
              className="px-8 py-4 bg-[#183b6d] text-white rounded-full hover:bg-[#0d2545] transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Send
            </button>
          </div>

          <div className="text-center mt-3 text-xs text-[#9ea1a7]">
            Or click the buttons above to answer quickly
          </div>
        </div>
      </div>
    </div>
  )
}
