'use client'

/**
 * Treasury Chat Widget for Grain & Vault
 *
 * Floating chat interface that allows users to:
 * - Check balances via conversation
 * - Initiate payments by talking to Wells
 * - Get help with SDK integration
 * - Authorize transactions conversationally
 */

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Send, Loader2, Wallet, CreditCard, Zap, Check } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  action?: TreasuryAction
}

interface TreasuryAction {
  type: 'payment' | 'deposit' | 'transfer' | 'balance_check' | 'api_help'
  status: 'pending' | 'authorized' | 'completed' | 'cancelled'
  details?: Record<string, unknown>
}

interface TreasuryChatProps {
  accountId: string
  companyName: string
  grainBalance: number
  creditLine: number
}

export default function TreasuryChat({
  accountId,
  companyName,
  grainBalance,
  creditLine
}: TreasuryChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hi! I'm Wells, your treasury assistant. I can help you with payments, check your GRAIN balance, or answer questions about the SDK. What would you like to do?`
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<TreasuryAction | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
          journey: 'treasury',
          context: {
            accountId,
            companyName,
            grainBalance,
            creditLine
          }
        })
      })

      if (!response.ok) throw new Error('Failed to send message')

      const data = await response.json()

      setMessages([
        ...updatedMessages,
        {
          role: 'assistant',
          content: data.message,
          action: data.treasuryAction || undefined
        }
      ])

      if (data.treasuryAction) {
        setPendingAction(data.treasuryAction)
      }
    } catch {
      setMessages([
        ...updatedMessages,
        {
          role: 'assistant',
          content: "I'm having trouble connecting. Please try again."
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const authorizeAction = async () => {
    if (!pendingAction) return

    setIsLoading(true)

    // Simulate authorization
    await new Promise(resolve => setTimeout(resolve, 1500))

    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: `Transaction authorized and submitted. You'll receive a confirmation shortly.`,
        action: { ...pendingAction, status: 'completed' }
      }
    ])

    setPendingAction(null)
    setIsLoading(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center z-50"
        >
          <MessageSquare className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-black border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-green-500/10 to-blue-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <span className="text-white font-bold">W</span>
              </div>
              <div>
                <h3 className="font-semibold text-white">Wells</h3>
                <p className="text-xs text-gray-400">Treasury Assistant</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 p-3 border-b border-white/10 overflow-x-auto">
            <button
              onClick={() => setInput('What\'s my GRAIN balance?')}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/5 rounded-full text-xs text-gray-300 hover:bg-white/10 whitespace-nowrap"
            >
              <Wallet className="w-3 h-3" />
              Balance
            </button>
            <button
              onClick={() => setInput('I want to send a payment')}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/5 rounded-full text-xs text-gray-300 hover:bg-white/10 whitespace-nowrap"
            >
              <Zap className="w-3 h-3" />
              Send Payment
            </button>
            <button
              onClick={() => setInput('How do I integrate the SDK?')}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/5 rounded-full text-xs text-gray-300 hover:bg-white/10 whitespace-nowrap"
            >
              <CreditCard className="w-3 h-3" />
              SDK Help
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div key={index} className="space-y-2">
                <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-green-500 text-black'
                        : 'bg-white/5 border border-white/10 text-white'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>

                {/* Action Card */}
                {message.action && message.action.status === 'pending' && (
                  <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-white">
                        {message.action.type === 'payment' ? 'Payment Request' : 'Action Required'}
                      </span>
                      <span className="text-xs text-yellow-400">Awaiting authorization</span>
                    </div>
                    <button
                      onClick={authorizeAction}
                      disabled={isLoading}
                      className="w-full py-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg text-white font-semibold text-sm hover:from-green-600 hover:to-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Authorize
                        </>
                      )}
                    </button>
                  </div>
                )}

                {message.action && message.action.status === 'completed' && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-green-400">Transaction completed</span>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2">
                  <Loader2 className="w-5 h-5 text-green-400 animate-spin" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask Wells anything..."
                disabled={isLoading}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 text-sm disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="px-4 py-2.5 bg-green-500 hover:bg-green-600 text-black rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
