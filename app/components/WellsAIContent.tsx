'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useUser, useOrganization } from '@clerk/nextjs'
import Onboarding, { UserData } from './Onboarding'
import PartnershipPitch from './PartnershipPitch'
import PartnershipTiers from './PartnershipTiers'
import PartnershipBooking from './PartnershipBooking'
import { CategoryPioneerOpportunity } from '@/lib/categories'
import ChatMessageRenderer from './chat/ChatMessageRenderer'
import { ChatMessage } from '@/types/chat'
import OrganizationSelector from './OrganizationSelector'
import Link from 'next/link'

interface Message {
  role: string
  content: string
  type?: ChatMessage['type'] // Support new message types
  data?: any // Component data
  procurementData?: {
    detected: boolean
    requestId?: string
    suppliersNotified?: number
    category?: string
  }
  pioneerOpportunity?: {
    detected: boolean
    category: CategoryPioneerOpportunity
    userRequest: string
  }
  partnershipPath?: 'standard' | 'partnership'
  selectedTier?: 1 | 2 | 3
}

export default function WellsAIContent() {
  const searchParams = useSearchParams()
  const isEmbedded = searchParams.get('embed') === 'true'
  const { user, isLoaded } = useUser()
  const { organization } = useOrganization()

  const [userData, setUserData] = useState<UserData | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load user data from Clerk metadata
  useEffect(() => {
    if (isLoaded && user?.publicMetadata) {
      const metadata = user.publicMetadata as Partial<UserData>
      if (metadata.userType && metadata.name && metadata.email) {
        setUserData(metadata as UserData)
      }
    }
  }, [isLoaded, user])

  const handleOnboardingComplete = async (data: UserData) => {
    // Save to Clerk user metadata
    try {
      await user?.update({
        unsafeMetadata: data as Record<string, any>
      })
      setUserData(data)
    } catch (error) {
      console.error('Failed to save user data:', error)
    }
  }

  // Constellation animation - Wells Onyx brand element
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    interface Particle {
      x: number
      y: number
      vx: number
      vy: number
    }

    const particles: Particle[] = []
    const particleCount = 50 // Subtle constellation
    const connectionDistance = 120

    // Create particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
      })
    }

    const animate = () => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      particles.forEach((particle, i) => {
        particle.x += particle.vx
        particle.y += particle.vy

        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1

        // Draw particle - Deep Blue with more presence
        ctx.fillStyle = 'rgba(24, 59, 109, 0.6)'
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2)
        ctx.fill()

        // Draw connections with more visibility
        particles.slice(i + 1).forEach(otherParticle => {
          const dx = particle.x - otherParticle.x
          const dy = particle.y - otherParticle.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < connectionDistance) {
            ctx.strokeStyle = `rgba(24, 59, 109, ${0.3 * (1 - distance / connectionDistance)})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(particle.x, particle.y)
            ctx.lineTo(otherParticle.x, otherParticle.y)
            ctx.stroke()
          }
        })
      })

      requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim()) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    if (!showChat) setShowChat(true)

    try {
      // Clean messages to only send role and content (strip UI-only fields)
      // Filter out component messages (they don't have content)
      const cleanMessages = [...messages, userMessage]
        .filter(msg => msg.content) // Only include messages with content
        .map(({ role, content }) => ({
          role,
          content
        }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: cleanMessages,
          userData: userData,
          organizationId: organization?.id || null
        }),
      })

      const data = await response.json()

      // Check if API returned an error
      if (!response.ok || data.error) {
        console.error('API error:', data.error || data.details || 'Unknown error')
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `I apologize, but I encountered an error: ${data.error || 'Failed to process your request'}. Please try again.`
        }])
        return
      }

      // Check if we have a valid message
      if (!data.message) {
        console.error('No message in response:', data)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'I apologize, but I received an invalid response. Please try again.'
        }])
        return
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        procurementData: data.procurementData,
        pioneerOpportunity: data.pioneerOpportunity
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.'
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

  // Partnership flow handlers
  const handlePartnershipPathSelect = (messageIndex: number, path: 'standard' | 'partnership') => {
    setMessages(prev => prev.map((msg, idx) =>
      idx === messageIndex ? { ...msg, partnershipPath: path } : msg
    ))
  }

  const handleTierSelect = (messageIndex: number, tier: 1 | 2 | 3) => {
    setMessages(prev => prev.map((msg, idx) =>
      idx === messageIndex ? { ...msg, selectedTier: tier } : msg
    ))
  }

  // Show loading while Clerk initializes
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#183b6d] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-[#575757]">Loading...</p>
        </div>
      </div>
    )
  }

  // Show onboarding if no user data
  if (!userData) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  return (
    <div className="relative min-h-screen bg-white text-[#000000] overflow-hidden">
      {/* Subtle constellation background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 1 }}
      />

      <div className="relative z-10">
        {!showChat ? (
          // Landing page - Wells Onyx minimalist approach
          <div className="min-h-screen flex flex-col items-center justify-center px-6">
            <div className="max-w-5xl w-full text-center">

              {/* Wells AI Logo - constellation + text */}
              <div className="mb-12">
                <svg width="200" height="80" viewBox="0 0 200 80" fill="none" className="mx-auto">
                  {/* Constellation icon */}
                  <g transform="translate(5, 10)">
                    <path d="M20 5 L19 10 L21 10 Z" fill="#183b6d"/>
                    <circle cx="20" cy="10" r="2.5" fill="#183b6d"/>
                    <line x1="20" y1="12.5" x2="12" y2="28" stroke="#183b6d" strokeWidth="0.8"/>
                    <line x1="20" y1="12.5" x2="20" y2="32" stroke="#183b6d" strokeWidth="0.8"/>
                    <line x1="20" y1="12.5" x2="28" y2="28" stroke="#183b6d" strokeWidth="0.8"/>
                    <circle cx="12" cy="28" r="2" fill="#183b6d"/>
                    <circle cx="28" cy="28" r="2" fill="#183b6d"/>
                    <circle cx="20" cy="32" r="2" fill="#183b6d"/>
                    <circle cx="20" cy="10" r="1.2" fill="#dba63f" opacity="0.9"/>
                  </g>

                  {/* WELLS AI text */}
                  <text x="50" y="32" fontFamily="Montserrat, sans-serif" fontSize="24" fontWeight="700" fill="#183b6d" letterSpacing="-0.5">
                    WELLS AI
                  </text>

                  {/* Tagline */}
                  <text x="50" y="45" fontFamily="Montserrat, sans-serif" fontSize="7" fontWeight="400" fill="#9ea1a7" letterSpacing="2">
                    CONVERSATIONAL COMMERCE
                  </text>
                </svg>
              </div>

              {/* Hero - Massive, bold, confident */}
              <h1 className="text-7xl md:text-8xl font-serif text-[#183b6d] leading-[0.95] mb-8 tracking-tight">
                Talk.<br />
                <span className="text-[#dba63f]">Transact.</span><br />
                Done.
              </h1>

              <p className="text-lg md:text-xl text-[#575757] max-w-2xl mx-auto mb-16 font-light leading-relaxed">
                The conversational marketplace for everything—from semiconductors to executive talent.
              </p>

              {/* Single prominent input */}
              <div className="max-w-2xl mx-auto">
                <div className="relative group">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="I need..."
                    className="w-full px-8 py-6 text-lg bg-white border-2 border-[#9ea1a7]/20 rounded-sm focus:outline-none focus:border-[#dba63f] transition-all placeholder:text-[#9ea1a7] shadow-sm"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isLoading || !input.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-8 py-3 bg-[#dba63f] text-white font-medium text-sm tracking-wide rounded-sm hover:bg-[#c89430] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                  >
                    {isLoading ? '...' : 'Go'}
                  </button>
                </div>
              </div>

              {/* Trust signal */}
              <div className="mt-24 flex items-center justify-center gap-3 text-[#9ea1a7]">
                <div className="h-px w-12 bg-[#9ea1a7]/30"></div>
                <p className="text-xs tracking-[0.2em] uppercase">
                  Trust + Outcomes
                </p>
                <div className="h-px w-12 bg-[#9ea1a7]/30"></div>
              </div>
            </div>
          </div>
        ) : (
          // Chat interface
          <div className="min-h-screen flex flex-col">
            {/* Header - minimal (hidden when embedded) */}
            {!isEmbedded && (
              <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-[#9ea1a7]/20">
                <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                        <circle cx="16" cy="8" r="2" fill="#183b6d" />
                        <line x1="16" y1="10" x2="10" y2="20" stroke="#183b6d" strokeWidth="0.5" />
                        <line x1="16" y1="10" x2="22" y2="20" stroke="#183b6d" strokeWidth="0.5" />
                        <circle cx="10" cy="20" r="1.5" fill="#183b6d" />
                        <circle cx="22" cy="20" r="1.5" fill="#183b6d" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-[#183b6d] text-sm tracking-wide">Wells AI</div>
                      <div className="text-xs text-[#575757]">Conversational Commerce Platform</div>
                    </div>
                  </div>

                  {/* Organization Selector + Dashboard Link */}
                  <div className="flex items-center gap-3">
                    {organization && (
                      <Link
                        href={`/org/${organization.id}/dashboard`}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#183b6d] hover:bg-gray-50 rounded-sm transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                        Dashboard
                      </Link>
                    )}
                    <OrganizationSelector />
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className={`flex-1 overflow-y-auto px-6 ${isEmbedded ? 'py-6' : 'py-12'}`}>
              <div className="max-w-4xl mx-auto space-y-8">
                {messages.map((message, index) => (
                  <div key={index}>
                    {/* New component-based messages (email, consent, partners, etc.) */}
                    {message.type && message.type !== 'text' ? (
                      <ChatMessageRenderer
                        message={{
                          id: `msg_${index}`,
                          role: message.role as any,
                          type: message.type,
                          data: message.data,
                          timestamp: new Date().toISOString()
                        } as ChatMessage}
                      />
                    ) : (
                      /* Traditional text messages */
                      <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[75%] rounded-sm px-6 py-4 ${
                            message.role === 'user'
                              ? 'bg-[#183b6d] text-white'
                              : 'bg-white border border-[#9ea1a7]/20'
                          }`}
                        >
                          <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
                        </div>
                      </div>
                    )}

                    {/* Procurement notification - gold accent */}
                    {message.procurementData?.detected && (
                      <div className="mt-4 max-w-[75%]">
                        <div className="border-l-4 border-[#dba63f] bg-[#dba63f]/5 rounded-sm px-5 py-4">
                          <div className="flex items-center gap-3 mb-2">
                            <svg className="w-4 h-4 text-[#dba63f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <h3 className="text-sm font-medium text-[#183b6d]">
                              Marketplace Match Complete
                            </h3>
                          </div>
                          <p className="text-sm text-[#575757] mb-3 leading-relaxed">
                            AI matched your request with {message.procurementData.suppliersNotified} qualified sellers.
                            Both sides notified—expect responses within 24 hours via SMS.
                          </p>
                          <div className="flex gap-3 text-xs text-[#9ea1a7]">
                            <span>ID: {message.procurementData.requestId?.slice(-8)}</span>
                            <span>•</span>
                            <span>{message.procurementData.category}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Category Pioneer Opportunity */}
                    {message.pioneerOpportunity?.detected && message.pioneerOpportunity.category && (
                      <div className="mt-4">
                        {/* Step 1: Partnership Pitch (choose path) */}
                        {!message.partnershipPath && (
                          <PartnershipPitch
                            category={message.pioneerOpportunity.category}
                            userRequest={message.pioneerOpportunity.userRequest}
                            onSelectPath={(path) => handlePartnershipPathSelect(index, path)}
                          />
                        )}

                        {/* Step 2: Tier Selection (if partnership path chosen) */}
                        {message.partnershipPath === 'partnership' && !message.selectedTier && (
                          <PartnershipTiers
                            category={message.pioneerOpportunity.category}
                            onSelectTier={(tier) => handleTierSelect(index, tier)}
                          />
                        )}

                        {/* Step 3: Booking (if tier selected) */}
                        {message.partnershipPath === 'partnership' && message.selectedTier && (
                          <PartnershipBooking
                            category={message.pioneerOpportunity.category}
                            tier={message.selectedTier}
                            companyName={userData?.company}
                            contactName={userData?.name}
                            contactEmail={userData?.email}
                          />
                        )}

                        {/* Standard path confirmation */}
                        {message.partnershipPath === 'standard' && (
                          <div className="border border-[#9ea1a7]/30 rounded-sm p-5 bg-white">
                            <h3 className="text-lg font-medium text-[#183b6d] mb-2">
                              Standard Path Selected
                            </h3>
                            <p className="text-sm text-[#575757] mb-4">
                              We'll learn {message.pioneerOpportunity.category.name} and get back to you within 2-4 weeks
                              with qualified suppliers. You'll pay our standard 33bps transaction fee on your deals.
                            </p>
                            <p className="text-xs text-[#9ea1a7]">
                              Note: The Category Pioneer opportunity for {message.pioneerOpportunity.category.name} remains
                              open to other companies during this time.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-[#9ea1a7]/20 rounded-sm px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-[#183b6d] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-[#183b6d] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-[#183b6d] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input - fixed bottom */}
            <div className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-sm border-t border-[#9ea1a7]/20">
              <div className="max-w-4xl mx-auto px-6 py-6">
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-3 text-sm bg-white border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d] transition-colors placeholder:text-[#9ea1a7]"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isLoading || !input.trim()}
                    className="px-8 py-3 bg-[#183b6d] text-white font-normal text-xs tracking-wider uppercase rounded-sm hover:bg-[#0d2545] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
