'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ParticleField,
  WellsAvatar,
  TypewriterText,
  ChatBubble,
  ThinkingBubble,
  QuickActions,
  FloatingChatInput,
} from '@/components/onboarding/cinematic'

// ============================================================================
// TYPES
// ============================================================================

type OnboardingPhase =
  | 'cinematic-intro'      // Dark fade in, particles, logo
  | 'wells-awakens'        // "Initializing..." then intro
  | 'the-hook'             // Explains how Wells is different
  | 'journey-detection'    // Asks what brings them here
  | 'context-gathering'    // Gets name, company, goal
  | 'the-promise'          // Explains how Wells works
  | 'first-action'         // Journey-specific first action
  | 'complete'             // Redirect to dashboard

type UserJourney = 'buyer' | 'seller' | 'founder' | 'jobs' | null

interface Message {
  id: string
  role: 'wells' | 'user'
  content: string
  isTyping?: boolean
  quickActions?: Array<{ label: string; value: string; primary?: boolean }>
}

interface UserData {
  name: string | null
  company: string | null
  journey: UserJourney
  goal: string | null
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PHASE_DELAYS = {
  'cinematic-intro': 3500,
  'wells-awakens': 0,
  'the-hook': 0,
  'journey-detection': 0,
  'context-gathering': 0,
  'the-promise': 0,
  'first-action': 0,
  'complete': 2000,
}

const JOURNEY_KEYWORDS: Record<UserJourney & string, string[]> = {
  buyer: ['buy', 'buying', 'source', 'sourcing', 'procurement', 'supplier', 'suppliers', 'vendor', 'vendors', 'purchase', 'purchasing', 'need', 'looking for'],
  seller: ['sell', 'selling', 'sales', 'customers', 'clients', 'buyers', 'grow', 'revenue', 'leads'],
  founder: ['founder', 'startup', 'ceo', 'building', 'company', 'business', 'entrepreneur', 'starting'],
  jobs: ['job', 'jobs', 'work', 'role', 'position', 'career', 'hire', 'hiring', 'employment', 'looking for work', 'job search'],
}

const JOURNEY_CONFIRMATIONS: Record<UserJourney & string, string> = {
  buyer: "Ah, you're here to source products and find suppliers. Perfect.",
  seller: "Got it - you're here to find customers and grow your sales. I love it.",
  founder: "A founder! You're building something. I'm here to help you move fast.",
  jobs: "Looking for your next opportunity. Let's find you the perfect role.",
}

const JOURNEY_FIRST_ACTIONS: Record<UserJourney & string, { question: string; placeholder: string }> = {
  buyer: {
    question: "What do you need to source first? I'll start hunting for the best suppliers.",
    placeholder: "e.g., Steel coils, 1000 tons, delivered to Houston..."
  },
  seller: {
    question: "Tell me about what you sell. I'll match you with buyers who need exactly that.",
    placeholder: "e.g., Industrial bearings, custom manufacturing, nationwide delivery..."
  },
  founder: {
    question: "What's your most urgent priority right now? Hiring, sourcing, or finding customers?",
    placeholder: "e.g., Need a senior engineer, looking for manufacturing partners..."
  },
  jobs: {
    question: "What kind of role are you looking for? I'll start scanning for perfect matches.",
    placeholder: "e.g., Product Manager, remote, B2B SaaS, $150-180k..."
  },
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CinematicOnboardingPage() {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Core state
  const [phase, setPhase] = useState<OnboardingPhase>('cinematic-intro')
  const [messages, setMessages] = useState<Message[]>([])
  const [isWellsThinking, setIsWellsThinking] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [inputPlaceholder, setInputPlaceholder] = useState("Type your message...")

  // User data we're collecting
  const [userData, setUserData] = useState<UserData>({
    name: null,
    company: null,
    journey: null,
    goal: null,
  })

  // UI state
  const [showLogo, setShowLogo] = useState(false)
  const [showParticles, setShowParticles] = useState(false)
  const [cinematicComplete, setCinematicComplete] = useState(false)
  const [awakeningStep, setAwakeningStep] = useState(0)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isWellsThinking])

  // ============================================================================
  // PHASE MANAGEMENT
  // ============================================================================

  // Cinematic intro sequence
  useEffect(() => {
    if (phase !== 'cinematic-intro') return

    // Check for returning user
    const existingData = localStorage.getItem('wells-onboarding')
    if (existingData) {
      const parsed = JSON.parse(existingData)
      if (parsed.completed) {
        router.push('/dashboard')
        return
      }
    }

    // Start the cinematic sequence
    const timers: NodeJS.Timeout[] = []

    // Show particles first (0.5s)
    timers.push(setTimeout(() => setShowParticles(true), 500))

    // Show logo (1.5s)
    timers.push(setTimeout(() => setShowLogo(true), 1500))

    // Transition to awakening (3.5s)
    timers.push(setTimeout(() => {
      setCinematicComplete(true)
      setPhase('wells-awakens')
    }, PHASE_DELAYS['cinematic-intro']))

    return () => timers.forEach(clearTimeout)
  }, [phase, router])

  // Wells awakening sequence
  useEffect(() => {
    if (phase !== 'wells-awakens') return

    const timers: NodeJS.Timeout[] = []

    // Step 0: "Initializing..."
    timers.push(setTimeout(() => setAwakeningStep(1), 800))

    // Step 1: "I'm Wells."
    timers.push(setTimeout(() => setAwakeningStep(2), 3000))

    // Step 2: "I've been waiting for you."
    timers.push(setTimeout(() => setAwakeningStep(3), 5500))

    // Transition to the hook
    timers.push(setTimeout(() => {
      setPhase('the-hook')
    }, 8000))

    return () => timers.forEach(clearTimeout)
  }, [phase])

  // The hook sequence
  useEffect(() => {
    if (phase !== 'the-hook') return

    const hookMessages = [
      "Most platforms make you fill out forms. Click buttons. Wait.",
      "I'm different.",
      "Just tell me what you need. I'll handle the rest."
    ]

    let delay = 500

    hookMessages.forEach((msg, idx) => {
      setTimeout(() => {
        addWellsMessage(msg, idx === hookMessages.length - 1)
      }, delay)
      delay += 2500
    })

    // Transition to journey detection
    setTimeout(() => {
      setPhase('journey-detection')
    }, delay + 1000)
  }, [phase])

  // Journey detection
  useEffect(() => {
    if (phase !== 'journey-detection') return

    setTimeout(() => {
      addWellsMessage("So... what brings you here today?", true, [
        { label: "I need to buy something", value: "buyer", primary: true },
        { label: "I want to sell", value: "seller" },
        { label: "I'm a founder", value: "founder" },
        { label: "Looking for a job", value: "jobs" },
      ])
      setShowInput(true)
      setInputPlaceholder("Just tell me naturally...")
    }, 500)
  }, [phase])

  // Context gathering
  useEffect(() => {
    if (phase !== 'context-gathering') return

    if (!userData.name) {
      setTimeout(() => {
        addWellsMessage("I'm excited to help. What should I call you?", true)
        setInputPlaceholder("Your name...")
      }, 500)
    }
  }, [phase, userData.name])

  // The promise
  useEffect(() => {
    if (phase !== 'the-promise') return

    const name = userData.name || 'friend'
    const promiseMessages = [
      `${name}, here's how this works:`,
      "You tell me what you want. I make it happen.",
      "I negotiate for you. I find opportunities. I protect your interests.",
      "You'll never have to talk to the other side directly. That's my job."
    ]

    let delay = 500

    promiseMessages.forEach((msg, idx) => {
      setTimeout(() => {
        addWellsMessage(msg, idx === promiseMessages.length - 1)
      }, delay)
      delay += 2200
    })

    setTimeout(() => {
      setPhase('first-action')
    }, delay + 500)
  }, [phase, userData.name])

  // First action
  useEffect(() => {
    if (phase !== 'first-action') return
    if (!userData.journey) return

    const action = JOURNEY_FIRST_ACTIONS[userData.journey]
    setTimeout(() => {
      addWellsMessage(action.question, true)
      setInputPlaceholder(action.placeholder)
      setShowInput(true)
    }, 800)
  }, [phase, userData.journey])

  // ============================================================================
  // MESSAGE HELPERS
  // ============================================================================

  const addWellsMessage = useCallback((
    content: string,
    withTyping = false,
    quickActions?: Message['quickActions']
  ) => {
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    setMessages(prev => [...prev, {
      id,
      role: 'wells',
      content,
      isTyping: withTyping,
      quickActions,
    }])
  }, [])

  const addUserMessage = useCallback((content: string) => {
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    setMessages(prev => [...prev, { id, role: 'user', content }])
  }, [])

  // ============================================================================
  // USER INPUT HANDLING
  // ============================================================================

  const detectJourney = useCallback((input: string): UserJourney => {
    const lower = input.toLowerCase()

    for (const [journey, keywords] of Object.entries(JOURNEY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          return journey as UserJourney
        }
      }
    }
    return null
  }, [])

  const handleUserInput = useCallback(async (input: string) => {
    addUserMessage(input)
    setShowInput(false)
    setIsWellsThinking(true)

    // Simulate thinking
    await new Promise(resolve => setTimeout(resolve, 800))
    setIsWellsThinking(false)

    // Handle based on current phase
    switch (phase) {
      case 'journey-detection': {
        const detectedJourney = detectJourney(input)
        if (detectedJourney) {
          setUserData(prev => ({ ...prev, journey: detectedJourney }))
          addWellsMessage(JOURNEY_CONFIRMATIONS[detectedJourney], true)

          setTimeout(() => {
            setPhase('context-gathering')
          }, 2000)
        } else {
          // Ask for clarification
          addWellsMessage("I want to make sure I understand. Are you looking to buy products, sell something, build a company, or find a job?", true, [
            { label: "Buy/Source", value: "buyer", primary: true },
            { label: "Sell", value: "seller" },
            { label: "Build (Founder)", value: "founder" },
            { label: "Find a job", value: "jobs" },
          ])
          setShowInput(true)
        }
        break
      }

      case 'context-gathering': {
        if (!userData.name) {
          // They just told us their name
          const name = extractName(input)
          setUserData(prev => ({ ...prev, name }))

          addWellsMessage(`Great to meet you, ${name}!`, true)

          setTimeout(() => {
            setPhase('the-promise')
          }, 1500)
        }
        break
      }

      case 'first-action': {
        // They've given us their first goal
        setUserData(prev => ({ ...prev, goal: input }))

        addWellsMessage("Perfect. I'm on it.", true)

        // Save to localStorage
        const onboardingData = {
          ...userData,
          goal: input,
          completedAt: new Date().toISOString(),
          completed: true,
        }
        localStorage.setItem('wells-onboarding', JSON.stringify(onboardingData))

        setTimeout(() => {
          addWellsMessage("Let me take you to your command center. From there, you can watch me work.", true)

          setTimeout(() => {
            setPhase('complete')
          }, 2500)
        }, 1500)
        break
      }
    }
  }, [phase, userData, addUserMessage, addWellsMessage, detectJourney])

  const handleQuickAction = useCallback((value: string) => {
    if (phase === 'journey-detection') {
      const journey = value as UserJourney
      setUserData(prev => ({ ...prev, journey }))
      addUserMessage(value === 'buyer' ? "I need to buy something" :
                     value === 'seller' ? "I want to sell" :
                     value === 'founder' ? "I'm a founder" : "Looking for a job")

      setShowInput(false)
      setIsWellsThinking(true)

      setTimeout(() => {
        setIsWellsThinking(false)
        addWellsMessage(JOURNEY_CONFIRMATIONS[journey], true)

        setTimeout(() => {
          setPhase('context-gathering')
        }, 2000)
      }, 600)
    }
  }, [phase, addUserMessage, addWellsMessage])

  // Complete phase - redirect
  useEffect(() => {
    if (phase !== 'complete') return

    const timer = setTimeout(() => {
      router.push('/command')
    }, PHASE_DELAYS.complete)

    return () => clearTimeout(timer)
  }, [phase, router])

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] overflow-hidden">
      {/* Particle field background */}
      <AnimatePresence>
        {showParticles && (
          <ParticleField particleCount={80} interactive={cinematicComplete} />
        )}
      </AnimatePresence>

      {/* Ambient gradient overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 100% 80% at 50% 20%, rgba(245, 158, 11, 0.08) 0%, transparent 50%)',
        }}
      />

      {/* Skip button (subtle) */}
      <AnimatePresence>
        {!cinematicComplete && showParticles && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            whileHover={{ opacity: 0.8 }}
            onClick={() => {
              setCinematicComplete(true)
              setShowLogo(true)
              setPhase('wells-awakens')
            }}
            className="fixed bottom-6 right-6 text-xs text-gray-500 hover:text-gray-300 z-50 transition-colors"
          >
            Skip intro
          </motion.button>
        )}
      </AnimatePresence>

      {/* Main content container */}
      <div className="relative h-full flex flex-col items-center justify-center z-10">
        {/* Cinematic intro - centered logo */}
        <AnimatePresence mode="wait">
          {!cinematicComplete && (
            <motion.div
              key="cinematic"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ duration: 0.8 }}
              className="flex flex-col items-center justify-center"
            >
              <AnimatePresence>
                {showLogo && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <WellsAvatar size="xl" animate pulse />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wells awakening phase */}
        <AnimatePresence>
          {phase === 'wells-awakens' && (
            <motion.div
              key="awakening"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-8"
            >
              <WellsAvatar size="lg" animate pulse />

              <div className="text-center space-y-4 max-w-lg">
                <AnimatePresence mode="wait">
                  {awakeningStep >= 1 && awakeningStep < 2 && (
                    <motion.div
                      key="init"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-amber-500/80 text-lg font-mono"
                    >
                      <TypewriterText text="Initializing..." speed={50} />
                    </motion.div>
                  )}

                  {awakeningStep >= 2 && awakeningStep < 3 && (
                    <motion.div
                      key="name"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-4xl md:text-5xl font-bold text-white"
                    >
                      <TypewriterText text="I'm Wells." speed={80} />
                    </motion.div>
                  )}

                  {awakeningStep >= 3 && (
                    <motion.div
                      key="waiting"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-2xl md:text-3xl text-gray-300"
                    >
                      <TypewriterText text="I've been waiting for you." speed={50} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Conversation UI */}
        <AnimatePresence>
          {phase !== 'cinematic-intro' && phase !== 'wells-awakens' && (
            <motion.div
              key="conversation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-2xl h-full flex flex-col px-4"
            >
              {/* Small avatar header */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 pt-6 pb-4"
              >
                <WellsAvatar size="sm" animate={false} pulse={false} />
                <div>
                  <h1 className="text-white font-semibold">Wells</h1>
                  <p className="text-xs text-amber-500/70">AI Commerce Agent</p>
                </div>
              </motion.div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4 scrollbar-thin scrollbar-thumb-amber-500/20 scrollbar-track-transparent">
                {messages.map((message) => (
                  <ChatBubble
                    key={message.id}
                    message={message.content}
                    isWells={message.role === 'wells'}
                    isTyping={message.isTyping}
                    showAvatar={false}
                    onTypingComplete={() => {
                      // Mark as complete
                      setMessages(prev =>
                        prev.map(m =>
                          m.id === message.id ? { ...m, isTyping: false } : m
                        )
                      )
                    }}
                  />
                ))}

                {/* Quick actions */}
                {messages.length > 0 &&
                  messages[messages.length - 1].quickActions &&
                  !isWellsThinking && (
                    <QuickActions
                      actions={messages[messages.length - 1].quickActions!}
                      onSelect={handleQuickAction}
                    />
                  )}

                {/* Thinking indicator */}
                <AnimatePresence>
                  {isWellsThinking && <ThinkingBubble />}
                </AnimatePresence>

                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="pb-6 pt-4">
                <AnimatePresence>
                  {showInput && (
                    <FloatingChatInput
                      onSubmit={handleUserInput}
                      placeholder={inputPlaceholder}
                      disabled={isWellsThinking}
                    />
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Completion animation */}
        <AnimatePresence>
          {phase === 'complete' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 flex items-center justify-center z-50"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.1) 0%, transparent 50%)',
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="text-center"
              >
                <WellsAvatar size="lg" pulse />
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-6 text-xl text-white"
                >
                  Entering command center...
                </motion.p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress indicator (subtle dots at bottom) */}
      <AnimatePresence>
        {cinematicComplete && phase !== 'complete' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20"
          >
            {['the-hook', 'journey-detection', 'context-gathering', 'the-promise', 'first-action'].map((p, idx) => (
              <motion.div
                key={p}
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  getPhaseIndex(phase) >= idx
                    ? 'bg-amber-500'
                    : 'bg-white/20'
                }`}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio hook placeholder - for future sound implementation */}
      <div id="audio-container" className="hidden" />
    </div>
  )
}

// ============================================================================
// HELPERS
// ============================================================================

function extractName(input: string): string {
  // Simple name extraction - get first capitalized word or first word
  const words = input.trim().split(/\s+/)

  // Look for patterns like "I'm X" or "My name is X" or "Call me X"
  const patterns = [
    /(?:i'?m|my name is|call me|i am)\s+(\w+)/i,
    /^(\w+)$/i,
  ]

  for (const pattern of patterns) {
    const match = input.match(pattern)
    if (match) {
      return capitalizeFirst(match[1])
    }
  }

  // Default to first word
  return capitalizeFirst(words[0].replace(/[^a-zA-Z]/g, ''))
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function getPhaseIndex(phase: OnboardingPhase): number {
  const phases: OnboardingPhase[] = ['the-hook', 'journey-detection', 'context-gathering', 'the-promise', 'first-action']
  return phases.indexOf(phase)
}
