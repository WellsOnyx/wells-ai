'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { DemoProvider, useDemo } from './context/DemoContext'
import { DEMO_SCRIPT } from './data/demoScript'
import SupplierCard from './components/SupplierCard'
import PaymentFlow from './components/PaymentFlow'
import SavingsChart from './components/SavingsChart'
import Link from 'next/link'

// Typing indicator component
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <motion.div
        className="w-2 h-2 bg-[#daa520] rounded-full"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 0.8, delay: 0 }}
      />
      <motion.div
        className="w-2 h-2 bg-[#daa520] rounded-full"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }}
      />
      <motion.div
        className="w-2 h-2 bg-[#daa520] rounded-full"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }}
      />
    </div>
  )
}

// Message bubble component
function MessageBubble({ message, isTyping }: { message: any; isTyping: boolean }) {
  const isAssistant = message.role === 'assistant'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} mb-4`}
    >
      <div className={`flex items-start gap-3 max-w-[80%] ${isAssistant ? 'flex-row' : 'flex-row-reverse'}`}>
        {/* Avatar */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            isAssistant
              ? 'bg-gradient-to-br from-[#daa520] to-[#b8860b]'
              : 'bg-[#f5f5f0]/10 border border-[#f5f5f0]/20'
          }`}
        >
          {isAssistant ? (
            <span className="text-[#0a0a0a] font-bold text-sm">W</span>
          ) : (
            <svg className="w-4 h-4 text-[#f5f5f0]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          )}
        </div>

        {/* Message content */}
        <div>
          <div
            className={`px-4 py-3 rounded-lg ${
              isAssistant
                ? 'bg-[#1a1a1a] border border-[#daa520]/20'
                : 'bg-[#daa520]/10 border border-[#daa520]/30'
            }`}
          >
            {isTyping ? (
              <TypingIndicator />
            ) : (
              <div
                className="text-[#f5f5f0] text-sm leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: message.content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#daa520]">$1</strong>')
                }}
              />
            )}
          </div>

          {/* Render component if present */}
          {message.component && !isTyping && (
            <div className="mt-2">
              {message.component.type === 'supplier-card' && (
                <SupplierCard suppliers={message.component.data.suppliers} />
              )}
              {message.component.type === 'payment-flow' && <PaymentFlow {...message.component.data} />}
              {message.component.type === 'savings-chart' && <SavingsChart {...message.component.data} />}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// CTA Overlay component
function CTAOverlay() {
  const router = useRouter()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-[#0a0a0a]/95 backdrop-blur-xl flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ delay: 0.2, type: 'spring' }}
        className="max-w-lg mx-4 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4, type: 'spring' }}
          className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#daa520] to-[#b8860b] flex items-center justify-center"
        >
          <svg className="w-10 h-10 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="font-serif text-4xl text-[#f5f5f0] mb-4"
        >
          Ready to Transform <br />
          Your Commerce?
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-[#f5f5f0]/70 mb-8 leading-relaxed"
        >
          Create your free account and let Wells handle your first transaction.
          <br />
          33 bps. 0 friction. Instant settlement.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/sign-up"
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#daa520] to-[#b8860b] text-[#0a0a0a] font-medium tracking-wide hover:from-[#b8860b] hover:to-[#daa520] transition-all duration-500 shadow-2xl shadow-[#daa520]/30 hover:scale-105"
          >
            Create Free Account
          </Link>
          <Link
            href="/demo/seller"
            className="w-full sm:w-auto px-8 py-4 bg-[#f5f5f0]/10 border border-[#f5f5f0]/20 text-[#f5f5f0] font-semibold hover:bg-[#f5f5f0]/20 transition-all duration-200"
          >
            See Seller Side
          </Link>
          <Link
            href="/"
            className="w-full sm:w-auto px-8 py-4 border border-[#daa520]/30 text-[#f5f5f0] hover:border-[#daa520]/50 hover:bg-[#daa520]/5 transition-all duration-300"
          >
            Back to Home
          </Link>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

// Main demo content component
function DemoContent() {
  const { state, dispatch, startDemo } = useDemo()
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasStarted = useRef(false)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.messages, typingMessageId])

  // Demo orchestration
  useEffect(() => {
    if (!state.isPlaying || state.isComplete || hasStarted.current) return

    hasStarted.current = true
    let timeoutId: NodeJS.Timeout

    const playDemo = async () => {
      for (const scene of DEMO_SCRIPT) {
        for (const message of scene.messages) {
          // Wait for delay
          await new Promise((resolve) => {
            timeoutId = setTimeout(resolve, message.delay || 0)
          })

          // Show typing indicator if needed
          if (message.typing) {
            setTypingMessageId(message.id)
            await new Promise((resolve) => {
              timeoutId = setTimeout(resolve, 2000)
            })
            setTypingMessageId(null)
          }

          // Add message
          dispatch({ type: 'ADD_MESSAGE', payload: message })
        }

        dispatch({ type: 'NEXT_SCENE' })
      }

      dispatch({ type: 'COMPLETE_DEMO' })
    }

    playDemo()

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [state.isPlaying, state.isComplete, dispatch])

  // Start demo on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      startDemo()
    }, 500)

    return () => clearTimeout(timer)
  }, [startDemo])

  return (
    <div className="relative min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-[#daa520]/10 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#daa520] animate-pulse"></div>
            <span className="text-sm text-[#f5f5f0]/70">Live Demo</span>
          </div>
          <Link
            href="/"
            className="text-sm text-[#f5f5f0]/50 hover:text-[#daa520] transition-colors"
          >
            Exit Demo
          </Link>
        </div>
      </div>

      {/* Chat container */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <AnimatePresence mode="popLayout">
          {state.messages.map((message) => (
            <MessageBubble key={message.id} message={message} isTyping={false} />
          ))}

          {/* Show typing indicator for current message */}
          {typingMessageId && (
            <MessageBubble
              key={`typing-${typingMessageId}`}
              message={{ id: typingMessageId, role: 'assistant', content: '' }}
              isTyping={true}
            />
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* CTA Overlay */}
      <AnimatePresence>
        {state.showCTA && <CTAOverlay />}
      </AnimatePresence>
    </div>
  )
}

// Main page component
export default function DemoPage() {
  return (
    <DemoProvider>
      <DemoContent />
    </DemoProvider>
  )
}
