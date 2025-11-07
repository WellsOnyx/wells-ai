'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { SELLER_DEMO_SCRIPT } from './data/sellerDemoScript'
import RFQDetails from './components/RFQDetails'
import AIToAINegotiation from './components/AIToAINegotiation'
import DealComparison from './components/DealComparison'
import DealSummary from './components/DealSummary'
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
              {message.component.type === 'rfq-details' && (
                <RFQDetails {...message.component.data} />
              )}
              {message.component.type === 'ai-to-ai-negotiation' && (
                <AIToAINegotiation {...message.component.data} />
              )}
              {message.component.type === 'deal-comparison' && (
                <DealComparison {...message.component.data} />
              )}
              {message.component.type === 'deal-summary' && (
                <DealSummary {...message.component.data} />
              )}
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
          This is How <br />
          Sellers Win
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-[#f5f5f0]/70 mb-8 leading-relaxed"
        >
          Wells handles negotiations, contracts, and payments while you focus on what you do best: delivering quality work.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link
            href="/sign-up"
            className="px-8 py-4 bg-gradient-to-r from-[#daa520] to-[#b8860b] text-[#0a0a0a] font-semibold rounded-lg hover:scale-105 transition-transform duration-200 shadow-lg hover:shadow-[#daa520]/50"
          >
            Get Started
          </Link>
          <Link
            href="/demo"
            className="px-8 py-4 bg-[#f5f5f0]/10 border border-[#f5f5f0]/20 text-[#f5f5f0] font-semibold rounded-lg hover:bg-[#f5f5f0]/20 transition-all duration-200"
          >
            See Buyer Side
          </Link>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

// Main Demo Component
function SellerDemoContent() {
  const [messages, setMessages] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const [showCTA, setShowCTA] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Advance through demo script
  useEffect(() => {
    if (currentIndex >= SELLER_DEMO_SCRIPT.length) {
      // Demo complete, show CTA
      setTimeout(() => setShowCTA(true), 1000)
      return
    }

    const currentMessage = SELLER_DEMO_SCRIPT[currentIndex]

    // Show typing indicator for assistant messages
    if (currentMessage.role === 'assistant') {
      setIsTyping(true)
      setTimeout(() => {
        setIsTyping(false)
        setMessages((prev) => [...prev, currentMessage])
        setTimeout(() => setCurrentIndex(currentIndex + 1), currentMessage.delay || 800)
      }, 1000)
    } else {
      // User messages appear immediately
      setMessages((prev) => [...prev, currentMessage])
      setTimeout(() => setCurrentIndex(currentIndex + 1), currentMessage.delay || 800)
    }
  }, [currentIndex])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#0a0a0a] text-[#f5f5f0] overflow-hidden">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-[#f5f5f0]/10 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#daa520] to-[#b8860b] flex items-center justify-center">
              <span className="text-[#0a0a0a] font-bold text-sm">W</span>
            </div>
            <span className="font-serif text-xl text-[#f5f5f0]">Wells</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 rounded-full bg-[#daa520]/20 border border-[#daa520]/40">
              <span className="text-[#daa520] text-xs font-medium">Seller Demo</span>
            </div>
            <Link href="/demo" className="text-[#f5f5f0]/60 hover:text-[#f5f5f0] text-sm">
              See Buyer Side →
            </Link>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="pt-20 pb-8 px-4">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} isTyping={false} />
            ))}
            {isTyping && (
              <MessageBubble
                message={{ role: 'assistant', content: '' }}
                isTyping={true}
              />
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* CTA Overlay */}
      {showCTA && <CTAOverlay />}
    </div>
  )
}

export default function SellerDemoPage() {
  return <SellerDemoContent />
}
