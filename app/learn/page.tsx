'use client'

import { useState } from 'react'

interface TrainingMessage {
  role: 'user' | 'assistant'
  content: string
  questions?: string[]
  progress?: number
}

export default function CategoryLearningPage() {
  const [messages, setMessages] = useState<TrainingMessage[]>([
    {
      role: 'assistant',
      content: "Hi! I'm Wells AI. Tell me about a product or service you need, and I'll either find suppliers or learn about it from you!",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [learningMode, setLearningMode] = useState(false)
  const [currentCategory, setCurrentCategory] = useState<string>('')
  const [conversationId] = useState(`conv-${Date.now()}`)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])

    try {
      if (!learningMode) {
        // Detection mode - check if we know this category
        const response = await fetch('/api/categories/learn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessage,
            mode: 'detect',
            conversationId,
          }),
        })

        const data = await response.json()

        if (data.known) {
          // We know this category - continue to matching
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: data.message,
            },
          ])

          // Trigger supplier matching
          setTimeout(() => {
            window.location.href = '/quotes'
          }, 2000)
        } else {
          // Start learning mode
          setLearningMode(true)
          setCurrentCategory(data.category)

          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: data.message,
              questions: data.questions,
              progress: 0,
            },
          ])
        }
      } else {
        // Training mode - learn from user
        const response = await fetch('/api/categories/learn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessage,
            category: currentCategory,
            mode: 'train',
            conversationId,
          }),
        })

        const data = await response.json()

        if (data.complete) {
          // Learning complete!
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: data.message,
              progress: 100,
            },
          ])

          setLearningMode(false)

          // Show success and transition
          setTimeout(() => {
            window.location.href = '/quotes'
          }, 3000)
        } else {
          // Need more information
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: `Great! I learned: ${data.learned?.join(', ')}. ${data.message}`,
              progress: data.progress,
            },
          ])
        }
      }
    } catch (error) {
      console.error('Error:', error)
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Can you try again?',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-white shadow-sm mb-4">
            {learningMode ? (
              <>
                <div className="animate-pulse h-2 w-2 bg-orange-500 rounded-full mr-2"></div>
                <span className="text-sm font-medium text-gray-700">Learning Mode</span>
              </>
            ) : (
              <>
                <div className="h-2 w-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm font-medium text-gray-700">Ready</span>
              </>
            )}
          </div>

          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {learningMode ? `Teaching: ${currentCategory}` : 'Wells AI Learning Center'}
          </h1>
          <p className="text-lg text-gray-600">
            {learningMode
              ? 'Help me understand this category'
              : 'I learn from you to find better suppliers'}
          </p>
        </div>

        {/* Chat Container */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Messages */}
          <div className="h-[600px] overflow-y-auto p-6 space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-6 py-4 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Progress bar for learning */}
                  {msg.progress !== undefined && (
                    <div className="mt-4">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Learning Progress</span>
                        <span>{msg.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${msg.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Questions list */}
                  {msg.questions && msg.questions.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {msg.questions.map((q, qIdx) => (
                        <div key={qIdx} className="flex items-start">
                          <span className="text-blue-600 font-bold mr-2">{qIdx + 1}.</span>
                          <span className="text-sm">{q}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-6 py-4">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.1s' }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="border-t border-gray-200 p-6">
            <div className="flex space-x-4">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={
                  learningMode
                    ? 'Tell me about specs, pricing, lead times...'
                    : 'I need custom injection molded plastic parts...'
                }
                className="flex-1 px-6 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Processing...' : 'Send'}
              </button>
            </div>

            {learningMode && (
              <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800">
                  <strong>💡 Tip:</strong> Be specific! Include specs, typical price ranges, lead
                  times, and any quality requirements you know about.
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="text-3xl mb-2">🎯</div>
            <h3 className="font-semibold text-gray-900 mb-2">Smart Detection</h3>
            <p className="text-sm text-gray-600">
              I instantly check if I already know about your category
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="text-3xl mb-2">🧠</div>
            <h3 className="font-semibold text-gray-900 mb-2">Quick Learning</h3>
            <p className="text-sm text-gray-600">
              Takes less than 5 minutes to master a new category
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="text-3xl mb-2">🚀</div>
            <h3 className="font-semibold text-gray-900 mb-2">Instant Matching</h3>
            <p className="text-sm text-gray-600">
              Once trained, I find suppliers in seconds
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 text-center">
          <div className="inline-block bg-white rounded-lg shadow-sm px-6 py-3">
            <span className="text-gray-600">Categories Mastered: </span>
            <span className="font-bold text-blue-600">10</span>
            <span className="mx-4 text-gray-300">|</span>
            <span className="text-gray-600">Suppliers Connected: </span>
            <span className="font-bold text-blue-600">150K+</span>
          </div>
        </div>
      </div>
    </div>
  )
}
