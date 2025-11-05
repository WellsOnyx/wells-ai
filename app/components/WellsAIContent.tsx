'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Onboarding, { UserData } from './Onboarding'
import PartnershipPitch from './PartnershipPitch'
import PartnershipTiers from './PartnershipTiers'
import PartnershipBooking from './PartnershipBooking'
import { CategoryPioneerOpportunity } from '@/lib/categories'
import ChatMessageRenderer from './chat/ChatMessageRenderer'
import { ChatMessage } from '@/types/chat'
import GTMConversionCard from './chat/cards/GTMConversionCard'
import ProcurementStatusCard from './chat/cards/ProcurementStatusCard'
import SupplierMatchCard from './chat/cards/SupplierMatchCard'
import Link from 'next/link'

interface Message {
  role: string
  content: string
  type?: ChatMessage['type'] // Support new message types
  data?: any // Component data
  procurementData?: {
    detected: boolean
    requestId?: string
    sourcing?: boolean
    category?: string
    description?: string
    suppliersContacted?: number
    status?: string
    showSupplierMatches?: boolean
    suppliers?: any[]
  }
  pioneerOpportunity?: {
    detected: boolean
    category: CategoryPioneerOpportunity
    userRequest: string
  }
  gtmData?: {
    detected: boolean
    intent?: {
      isGTMRequest: boolean
      confidence: number
      whatTheySell?: string
      whoTheyTarget?: string
      goal?: string
    }
    onboardingComplete?: boolean
    needsLogin?: boolean
    missingSteps?: string[]
  }
  partnershipPath?: 'standard' | 'partnership'
  selectedTier?: 1 | 2 | 3
}

export default function WellsAIContent() {
  const searchParams = useSearchParams()
  const isEmbedded = searchParams.get('embed') === 'true'
  const { user, isLoaded } = useUser()

  const [userData, setUserData] = useState<UserData | null>(null)
  const [onboardingState, setOnboardingState] = useState<any | null>(null) // Onboarding state for legendary flow
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showChat, setShowChat] = useState(true) // Always show chat - discovery through conversation
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Generate or load anonymous userId for memory system
  const [anonymousUserId, setAnonymousUserId] = useState<string | null>(null)

  // Load messages from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('wells_chat_messages')
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages)
        setMessages(parsed)
      } catch (error) {
        console.error('Failed to parse saved messages:', error)
      }
    }
  }, [])

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('wells_chat_messages', JSON.stringify(messages))
    }
  }, [messages])

  useEffect(() => {
    // Check URL for userId parameter first (for cross-device continuity)
    const urlUserId = searchParams.get('userId')

    let userId: string
    if (urlUserId) {
      // Use userId from URL and save to localStorage
      userId = urlUserId
      localStorage.setItem('wells_anonymous_user_id', userId)
    } else {
      // Get or create anonymous userId from localStorage
      const storedUserId = localStorage.getItem('wells_anonymous_user_id')
      if (storedUserId) {
        userId = storedUserId
      } else {
        userId = `anon-${Date.now()}-${Math.random().toString(36).substring(7)}`
        localStorage.setItem('wells_anonymous_user_id', userId)
      }
    }

    // Update URL with userId (without page reload)
    if (!urlUserId && typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('userId', userId)
      window.history.replaceState({}, '', url.toString())
    }

    setAnonymousUserId(userId)
  }, [])

  // Load user data from Clerk metadata
  useEffect(() => {
    if (isLoaded && user?.unsafeMetadata) {
      const metadata = user.unsafeMetadata as Partial<UserData>
      if (metadata.userType && metadata.name && metadata.email) {
        setUserData(metadata as UserData)
      }
    }
  }, [isLoaded, user])

  // Wells' magical welcome for new users
  useEffect(() => {
    if (isLoaded && !userData && messages.length === 0) {
      // Wells introduces itself warmly
      setMessages([{
        role: 'assistant',
        content: "Hi, I'm Wells.\n\nI'm here to help you with whatever you need—whether it's finding the right people, closing deals, or sourcing what your business needs.\n\nWhat brings you here today?"
      }])
    }
  }, [isLoaded, userData, messages.length])

  // Auto-migrate anonymous conversations when user signs in
  useEffect(() => {
    const migrateConversations = async () => {
      if (isLoaded && user && anonymousUserId && user.id !== anonymousUserId) {
        // User just signed in - migrate their anonymous conversations
        try {
          console.log(`[AUTH] User signed in: ${user.id}, migrating from ${anonymousUserId}`)

          const response = await fetch('/api/auth/migrate-conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              anonymousUserId,
              authenticatedUserId: user.id
            })
          })

          const data = await response.json()

          if (response.ok && data.migratedCount > 0) {
            console.log(`[AUTH] Successfully migrated ${data.migratedCount} conversations`)

            // Update local storage to use authenticated user ID
            localStorage.setItem('wells_anonymous_user_id', user.id)
            setAnonymousUserId(user.id)

            // Show success message to user
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `Welcome back! I've synced your conversation history across all your devices. 🔐`
            }])
          }
        } catch (error) {
          console.error('[AUTH] Migration failed:', error)
        }
      }
    }

    migrateConversations()
  }, [isLoaded, user, anonymousUserId])

  const handleOnboardingComplete = async (data: UserData) => {
    // Save to Clerk user metadata
    try {
      await user?.update({
        unsafeMetadata: data as Record<string, any>
      })
      setUserData(data)
      setShowChat(true) // Show chat after onboarding
    } catch (error) {
      console.error('Failed to save user data:', error)
    }
  }

  // Wells Ghost animation - floating AI companion
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

    // Blueprint grid
    const drawGrid = () => {
      const gridSize = 40
      ctx.strokeStyle = 'rgba(24, 59, 109, 0.05)'
      ctx.lineWidth = 0.5

      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }

      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }
    }

    // Wells Ghost - smaller for chat interface
    interface GhostVertex {
      x: number
      y: number
      baseY: number
      angle: number
    }

    const ghostSize = 60  // Smaller for chat
    const ghostX = canvas.width - 100  // Top right corner
    const ghostY = 100
    let rotation = 0
    let pulsePhase = 0

    const createGhostVertices = (): GhostVertex[] => {
      const vertices: GhostVertex[] = []
      const segments = 6

      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2
        vertices.push({
          x: ghostX + Math.cos(angle) * ghostSize,
          y: ghostY + Math.sin(angle) * ghostSize,
          baseY: ghostY + Math.sin(angle) * ghostSize,
          angle: angle
        })
      }

      return vertices
    }

    const ghostVertices = createGhostVertices()

    const animate = () => {
      // Clear with blueprint paper color
      ctx.fillStyle = '#fafbfc'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw subtle grid
      drawGrid()

      // Animate Wells Ghost
      rotation += 0.003
      pulsePhase += 0.02
      const pulse = Math.sin(pulsePhase) * 4

      // Ghost outer shell
      ctx.strokeStyle = '#183b6d'
      ctx.lineWidth = 2
      ctx.beginPath()
      ghostVertices.forEach((vertex, i) => {
        const nextVertex = ghostVertices[(i + 1) % ghostVertices.length]
        const x1 = vertex.x + Math.cos(rotation) * pulse
        const y1 = vertex.y + Math.sin(rotation) * pulse + Math.sin(vertex.angle + pulsePhase) * 3
        const x2 = nextVertex.x + Math.cos(rotation) * pulse
        const y2 = nextVertex.y + Math.sin(rotation) * pulse + Math.sin(nextVertex.angle + pulsePhase) * 3

        if (i === 0) {
          ctx.moveTo(x1, y1)
        }
        ctx.lineTo(x2, y2)
      })
      ctx.closePath()
      ctx.stroke()

      // Ghost core - glowing center
      const coreRadius = 12 + pulse * 0.5
      const gradient = ctx.createRadialGradient(ghostX, ghostY, 0, ghostX, ghostY, coreRadius)
      gradient.addColorStop(0, 'rgba(219, 166, 63, 1)')
      gradient.addColorStop(0.3, 'rgba(219, 166, 63, 0.8)')
      gradient.addColorStop(0.6, 'rgba(219, 166, 63, 0.4)')
      gradient.addColorStop(1, 'rgba(219, 166, 63, 0)')

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(ghostX, ghostY, coreRadius, 0, Math.PI * 2)
      ctx.fill()

      // Core dot
      ctx.fillStyle = '#dba63f'
      ctx.shadowColor = 'rgba(219, 166, 63, 0.6)'
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(ghostX, ghostY, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0

      // Ghost vertices
      ghostVertices.forEach((vertex) => {
        const x = vertex.x + Math.cos(rotation) * pulse
        const y = vertex.y + Math.sin(rotation) * pulse + Math.sin(vertex.angle + pulsePhase) * 3

        ctx.fillStyle = '#183b6d'
        ctx.beginPath()
        ctx.arc(x, y, 2.5, 0, Math.PI * 2)
        ctx.fill()

        // Vertex to core lines
        ctx.strokeStyle = 'rgba(24, 59, 109, 0.25)'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(ghostX, ghostY)
        ctx.stroke()
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

  // Helper function to send programmatic messages (not from input field)
  const sendProgrammaticMessage = async (messageContent: string) => {
    const userMessage: Message = { role: 'user', content: messageContent }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    if (!showChat) setShowChat(true)

    try {
      // Clean messages to only send role and content (strip UI-only fields)
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
          userData: {
            ...userData,
            userId: user?.id || anonymousUserId, // Use Clerk ID or anonymous ID
            onboardingState: onboardingState
          },
          organizationId: null
        }),
      })

      const data = await response.json()

      if (!response.ok || data.error) {
        console.error('API error:', data.error || data.details)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `I apologize, but I encountered an error: ${data.error || 'Failed to process your request'}. Please try again.`
        }])
        return
      }

      if (!data.message) {
        console.error('No message in response:', data)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'I apologize, but I received an invalid response. Please try again.'
        }])
        return
      }

      // Update onboarding state if we're in onboarding
      if (data.isOnboarding && data.onboardingState) {
        console.log('[ONBOARDING] Updating state:', data.onboardingState.phase)
        setOnboardingState(data.onboardingState)

        // If onboarding completed, update userData
        if (data.onboardingComplete && data.onboardingState.name) {
          const newUserData: UserData = {
            name: data.onboardingState.name,
            email: data.onboardingState.email || '',
            userType: data.onboardingState.userType || 'buyer'
          }
          setUserData(newUserData)
          console.log('[ONBOARDING] Complete! User data:', newUserData)
        }
      }

      // Check for auth prompt (inline email collection)
      if (data.authPrompt) {
        console.log('[AUTH] Auth prompt received from API')
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: data.message
          },
          {
            role: 'assistant',
            type: data.authPrompt.type,
            data: data.authPrompt.data,
            content: '' // Required but not used for component messages
          }
        ])
        return
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        procurementData: data.procurementData,
        pioneerOpportunity: data.pioneerOpportunity,
        gtmData: data.gtmData
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
          userData: {
            ...userData,
            userId: user?.id || anonymousUserId, // CRITICAL: Include userId for memory system
            onboardingState: onboardingState
          },
          organizationId: null // Organizations not required for basic chat
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

      // Update onboarding state if we're in onboarding
      if (data.isOnboarding && data.onboardingState) {
        console.log('[ONBOARDING] Updating state:', data.onboardingState.phase)
        setOnboardingState(data.onboardingState)

        // If onboarding completed, update userData
        if (data.onboardingComplete && data.onboardingState.name) {
          const newUserData: UserData = {
            name: data.onboardingState.name,
            email: data.onboardingState.email || '',
            userType: data.onboardingState.userType || 'buyer'
          }
          setUserData(newUserData)
          console.log('[ONBOARDING] Complete! User data:', newUserData)
        }
      }

      // Check for auth prompt (inline email collection)
      if (data.authPrompt) {
        console.log('[AUTH] Auth prompt received from API')
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: data.message
          },
          {
            role: 'assistant',
            type: data.authPrompt.type,
            data: data.authPrompt.data,
            content: '' // Required but not used for component messages
          }
        ])
        return
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        procurementData: data.procurementData,
        pioneerOpportunity: data.pioneerOpportunity,
        gtmData: data.gtmData
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

  // Skip onboarding - go straight to chat with Wells introducing itself
  // Wells will discover the user's journey through conversation
  const needsWelcome = !userData && messages.length === 0

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
                    placeholder="What are you looking for?"
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
                      <div className="font-medium text-[#183b6d] text-sm tracking-wide">Wells</div>
                      <div className="text-xs text-[#575757]">Your AI Companion</div>
                    </div>
                  </div>

                  {/* OrganizationSelector and Dashboard removed - chat works immediately without setup
                      Organizations are for team features (coming later) */}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className={`flex-1 overflow-y-auto px-6 ${isEmbedded ? 'py-6' : 'py-12'}`}>
              <div className="max-w-4xl mx-auto space-y-8">
                {/* Empty state explainer - only show when no messages */}
                {messages.length === 0 && (
                  <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center max-w-2xl">
                      <div className="mb-8">
                        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mx-auto opacity-20">
                          <circle cx="40" cy="24" r="6" fill="#183b6d" />
                          <line x1="40" y1="30" x2="24" y2="56" stroke="#183b6d" strokeWidth="2" />
                          <line x1="40" y1="30" x2="40" y2="64" stroke="#183b6d" strokeWidth="2" />
                          <line x1="40" y1="30" x2="56" y2="56" stroke="#183b6d" strokeWidth="2" />
                          <circle cx="24" cy="56" r="5" fill="#183b6d" />
                          <circle cx="56" cy="56" r="5" fill="#183b6d" />
                          <circle cx="40" cy="64" r="5" fill="#183b6d" />
                          <circle cx="40" cy="24" r="3" fill="#dba63f" opacity="0.9" />
                        </svg>
                      </div>
                      <h2 className="text-3xl font-serif text-[#183b6d] mb-4">
                        Start a conversation
                      </h2>
                      <p className="text-[#575757] mb-8 leading-relaxed">
                        Tell Wells what you need. We handle procurement, executive search, partnerships,
                        and enterprise transactions across any industry.
                      </p>
                      <div className="grid md:grid-cols-3 gap-4 text-sm">
                        <div className="p-4 bg-[#183b6d]/5 rounded-sm cursor-pointer hover:bg-[#183b6d]/10 transition" onClick={() => setInput('I need to source materials')}>
                          <div className="font-semibold text-[#183b6d] mb-1">Procurement</div>
                          <div className="text-xs text-[#575757]">Source suppliers & materials</div>
                        </div>
                        <div className="p-4 bg-[#183b6d]/5 rounded-sm cursor-pointer hover:bg-[#183b6d]/10 transition" onClick={() => setInput('I am looking for a job')}>
                          <div className="font-semibold text-[#183b6d] mb-1">Job Search</div>
                          <div className="text-xs text-[#575757]">Find your next opportunity</div>
                        </div>
                        <div className="p-4 bg-[#183b6d]/5 rounded-sm cursor-pointer hover:bg-[#183b6d]/10 transition" onClick={() => setInput('I need professional services')}>
                          <div className="font-semibold text-[#183b6d] mb-1">Services</div>
                          <div className="text-xs text-[#575757]">Connect with professionals</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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

                    {/* Procurement Flow - Real-time Status or Supplier Matches */}
                    {message.procurementData?.detected && (
                      <div className="mt-4">
                        {message.procurementData.sourcing && message.procurementData.requestId ? (
                          /* Show real-time procurement status card */
                          <ProcurementStatusCard
                            data={{
                              requestId: message.procurementData.requestId,
                              category: message.procurementData.category || '',
                              description: message.procurementData.description || '',
                              onQuotesUpdate: (quotes: any[]) => {
                                // When quotes come in, Wells can provide conversational updates
                                console.log('[PROCUREMENT] Quotes updated:', quotes)

                                // Add conversational message about new quotes
                                if (quotes.length > 0) {
                                  const latestQuote = quotes[0]
                                  setMessages(prev => [...prev, {
                                    role: 'assistant',
                                    content: `Just heard from ${latestQuote.supplier}! They quoted $${latestQuote.price}/unit${latestQuote.leadTime ? ` with a ${latestQuote.leadTime} lead time` : ''}. ${quotes.length > 1 ? `We now have ${quotes.length} quotes total.` : 'Still waiting on the others...'}`
                                  }])
                                }
                              }
                            }}
                          />
                        ) : message.procurementData.showSupplierMatches ? (
                          /* Show supplier match card with results */
                          <SupplierMatchCard
                            data={{
                              suppliers: message.procurementData.suppliers || [],
                              category: message.procurementData.category,
                              description: message.procurementData.description,
                              onSelect: (supplier: any) => {
                                console.log('[PROCUREMENT] Supplier selected:', supplier)
                                setMessages(prev => [...prev, {
                                  role: 'assistant',
                                  content: `Perfect! I'll prepare a purchase order with ${supplier.name}.\n\nTotal: $${supplier.pricing?.totalAmount?.toLocaleString() || 'TBD'}\nDelivery: ${supplier.timeline?.deliveryDate ? new Date(supplier.timeline.deliveryDate).toLocaleDateString() : 'TBD'}\n\nWould you like me to send this to your email for review?`
                                }])
                              }
                            }}
                          />
                        ) : (
                          /* Show success notification for completed procurement */
                          <div className="max-w-[75%]">
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
                                AI matched your request with {message.procurementData.suppliersContacted} qualified sellers.
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
                      </div>
                    )}

                    {/* GTM Journey Detection - Early Conversion Card */}
                    {message.gtmData?.detected && message.gtmData.intent && (
                      <div className="mt-4">
                        <GTMConversionCard
                          intent={{
                            whatTheySell: message.gtmData.intent.whatTheySell,
                            whoTheyTarget: message.gtmData.intent.whoTheyTarget,
                            goal: message.gtmData.intent.goal,
                            confidence: message.gtmData.intent.confidence
                          }}
                          onStart={() => {
                            // User clicked "Start GTM Journey" - trigger qualification conversation
                            console.log('[GTM] User started GTM Journey')
                            sendProgrammaticMessage('[START_GTM_JOURNEY]')
                          }}
                          onDismiss={() => {
                            console.log('[GTM] User dismissed GTM card')
                          }}
                        />
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
                    placeholder="Continue the conversation..."
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
