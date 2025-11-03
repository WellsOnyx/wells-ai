/**
 * LEGENDARY ONBOARDING
 *
 * This is where Wells becomes a companion, not just a tool.
 * Reference: Ghost from Destiny by Bungie
 *
 * Philosophy:
 * - Build genuine rapport FIRST
 * - Understand their world before asking for credentials
 * - Make technical setup feel easy and guided
 * - Create trust through micro-wins
 * - Set the tone for EVERYTHING that follows
 *
 * Faith Foundation (Proverbs + Hebrews):
 * - Treat people with dignity (made in God's image)
 * - Listen before speaking (Proverbs 18:13)
 * - Honest weight and balance (Proverbs 11:1)
 * - Bear one another's burdens (Hebrews 10:24)
 */

export interface OnboardingState {
  // Phase tracking
  phase:
    | 'greeting' // Initial hello, build rapport
    | 'discovery' // Understand their world
    | 'trust_building' // First micro-win
    | 'practical_setup' // KYC, accounts, ERPs
    | 'first_mission' // Launch their first action
    | 'complete'

  // Emotional context (what Wells learns)
  name?: string
  preferredName?: string // How they like to be called
  userType?: 'buyer' | 'seller' | 'both' | 'job_seeker' | 'founder'
  industry?: string
  companyName?: string
  companyStage?: 'idea' | 'early' | 'growing' | 'scaling' // For founders
  painPoint?: string // What brought them here
  goal?: string // What they want to accomplish
  timeframe?: string // When they need it
  previousExperience?: string // Have they done this before?

  // Practical data (for technical setup)
  email?: string
  phone?: string
  company?: string
  role?: string

  // Setup progress
  kycComplete?: boolean
  bankConnected?: boolean
  erpConnected?: boolean
  firstActionLaunched?: boolean

  // Relationship tracking
  conversationDepth: number // How many meaningful exchanges
  trustScore: number // 0-100, based on engagement
  lastInteraction: Date
  lastJoke?: Date // Last time Wells told a joke (once per day max)
  sessionId: string
}

/**
 * Initial state for new user
 */
export function isOnboardingComplete(state: OnboardingState): boolean {
  return state.phase === 'complete'
}

export function createOnboardingState(sessionId: string): OnboardingState {
  return {
    phase: 'greeting',
    conversationDepth: 0,
    trustScore: 0,
    lastInteraction: new Date(),
    sessionId
  }
}

/**
 * Detect onboarding intent
 */
export function detectOnboardingIntent(message: string): boolean {
  const onboardingKeywords = [
    'sign up',
    'signup',
    'create account',
    'register',
    'join',
    'get started',
    'onboard',
    'new here',
    'first time',
    'help me'
  ]

  const lowerMessage = message.toLowerCase()
  return onboardingKeywords.some(keyword => lowerMessage.includes(keyword))
}

/**
 * Get Wells's next message based on onboarding phase
 *
 * This is where Wells's personality shines.
 * Caring, curious, competent.
 */
export function getWellsResponse(
  state: OnboardingState,
  userMessage: string
): { message: string; shouldAdvancePhase: boolean } {
  switch (state.phase) {
    case 'greeting':
      return handleGreeting(state, userMessage)

    case 'discovery':
      return handleDiscovery(state, userMessage)

    case 'trust_building':
      return handleTrustBuilding(state, userMessage)

    case 'practical_setup':
      return handlePracticalSetup(state, userMessage)

    case 'first_mission':
      return handleFirstMission(state, userMessage)

    case 'complete':
      return {
        message: `I'm here whenever you need me, ${state.preferredName || state.name}. What's on your mind?`,
        shouldAdvancePhase: false
      }

    default:
      return {
        message: "Hi! I'm Wells. I'm here to help. What brings you here today?",
        shouldAdvancePhase: false
      }
  }
}

/**
 * PHASE 1: GREETING
 * Goal: Make them feel welcome, not interrogated
 */
function handleGreeting(
  state: OnboardingState,
  userMessage: string
): { message: string; shouldAdvancePhase: boolean } {
  // First interaction - check if we already know them
  if (state.conversationDepth === 0) {
    // Returning user - greet by name + share what you've been up to
    if (state.name) {
      const activity = getWellsActivity()
      return {
        message: `Hey ${state.preferredName || state.name}, how's your morning?\n\n${activity}`,
        shouldAdvancePhase: false
      }
    }

    // First time - introduce
    return {
      message: "Hi! I'm Wells.\n\nWhat brings you here today?",
      shouldAdvancePhase: false
    }
  }

  // They've shared something - acknowledge it
  return {
    message: `I hear you. That sounds ${detectSentiment(userMessage)}.\n\nBefore we dive in - I'd love to know your name. What should I call you?`,
    shouldAdvancePhase: true // Move to discovery
  }
}

/**
 * PHASE 2: DISCOVERY
 * Goal: Understand their world before asking for credentials
 */
function handleDiscovery(
  state: OnboardingState,
  userMessage: string
): { message: string; shouldAdvancePhase: boolean } {
  // Just got their name
  if (!state.name) {
    const extractedName = extractName(userMessage)
    if (extractedName) {
      state.name = extractedName
      return {
        message: `${extractedName} - I like it. Nice to meet you.\n\nSo, ${extractedName}, tell me about what you're building (or trying to build). What's your world look like right now?`,
        shouldAdvancePhase: false
      }
    }
  }

  // Learning about their world
  if (!state.userType) {
    // Detect user type from their description
    const detectedType = detectUserType(userMessage)
    if (detectedType) {
      state.userType = detectedType
      return {
        message: buildDiscoveryFollowUp(detectedType, userMessage),
        shouldAdvancePhase: false
      }
    }
  }

  // Got enough context - time for first micro-win
  if (state.name && state.userType && state.painPoint) {
    return {
      message: buildTransitionToTrustBuilding(state),
      shouldAdvancePhase: true
    }
  }

  // Keep asking curious questions
  return {
    message: "Tell me more about that. What's the biggest challenge you're facing right now?",
    shouldAdvancePhase: false
  }
}

/**
 * PHASE 3: TRUST BUILDING
 * Goal: Prove value before asking for credentials
 * Give them a quick win
 */
function handleTrustBuilding(
  state: OnboardingState,
  userMessage: string
): { message: string; shouldAdvancePhase: boolean } {
  // Offer immediate value based on their type
  if (state.userType === 'founder') {
    return {
      message: `Alright ${state.preferredName || state.name}.\n\nThree things I can do:\n\n1. Find and hire the right people\n2. Help you sell what you're building\n3. Buy what you need\n\nWhich one's most urgent?`,
      shouldAdvancePhase: true // Ready for practical setup
    }
  }

  if (state.userType === 'job_seeker') {
    return {
      message: `${state.preferredName || state.name}, here's what I'm thinking:\n\nYou've got skills and experience. The question isn't "can you find A job" - it's "can you find YOUR specialization?"\n\nThe thing that makes you irreplaceable.\n\nWant me to help you figure that out?`,
      shouldAdvancePhase: true
    }
  }

  if (state.userType === 'seller') {
    return {
      message: `${state.preferredName || state.name}, I can reach buyers you've never met.\n\nNot through spam. Through genuine connection.\n\nWant to see?`,
      shouldAdvancePhase: true
    }
  }

  if (state.userType === 'buyer') {
    return {
      message: `${state.preferredName || state.name}, what if you never had to talk to a salesperson again?\n\nJust tell me what you need.`,
      shouldAdvancePhase: true
    }
  }

  return {
    message: "Let me show you what I can do.",
    shouldAdvancePhase: true
  }
}

/**
 * PHASE 4: PRACTICAL SETUP
 * Goal: Make technical setup feel easy
 * Only ask for credentials AFTER trust is built
 */
function handlePracticalSetup(
  state: OnboardingState,
  userMessage: string
): { message: string; shouldAdvancePhase: boolean } {
  // Start with email (easiest)
  if (!state.email) {
    const extractedEmail = extractEmail(userMessage)
    if (extractedEmail) {
      state.email = extractedEmail
      return {
        message: `Got it - ${extractedEmail}.\n\nI'll need a few more things to get you fully set up, but we can do that as we go.\n\nFor now, let's get you your first win.`,
        shouldAdvancePhase: true // Move to first mission
      }
    }

    return {
      message: `To get started, I'll need your email. What's the best email to reach you?`,
      shouldAdvancePhase: false
    }
  }

  // KYC, bank accounts, ERPs can happen AFTER first mission
  // We don't want to block them with paperwork

  return {
    message: "Let's get you started.",
    shouldAdvancePhase: true
  }
}

/**
 * PHASE 5: FIRST MISSION
 * Goal: Launch their first action with Wells
 * This is where the relationship deepens
 */
function handleFirstMission(
  state: OnboardingState,
  userMessage: string
): { message: string; shouldAdvancePhase: boolean } {
  if (state.userType === 'founder' && !state.firstActionLaunched) {
    return {
      message: `Alright ${state.preferredName || state.name}, let's do this.\n\nDescribe a role you need to fill. I'll find candidates, reach out, and bring back the best ones.\n\nWhat role do you need?`,
      shouldAdvancePhase: false
    }
  }

  if (state.userType === 'job_seeker' && !state.firstActionLaunched) {
    return {
      message: `${state.preferredName || state.name}, tell me about a project you're proud of.\n\nNot your resume. Not your job title.\n\nWhat's something you built that made you feel alive?`,
      shouldAdvancePhase: false
    }
  }

  if (state.userType === 'seller' && !state.firstActionLaunched) {
    return {
      message: `${state.preferredName || state.name}, describe your ideal customer.\n\nBe specific. Industry, role, company size, pain point.\n\nI'll find them.`,
      shouldAdvancePhase: false
    }
  }

  if (state.userType === 'buyer' && !state.firstActionLaunched) {
    return {
      message: `${state.preferredName || state.name}, what do you need?\n\nDescribe it like you're telling a friend. I'll handle the rest.`,
      shouldAdvancePhase: false
    }
  }

  // Mission launched - onboarding complete
  return {
    message: `I'm on it. I'll keep you updated.\n\nIn the meantime, ${state.preferredName || state.name}, I'm here whenever you need me.`,
    shouldAdvancePhase: true // Complete
  }
}

/**
 * Helper: Detect sentiment in user message
 */
function detectSentiment(message: string): string {
  const lowerMessage = message.toLowerCase()

  if (
    lowerMessage.includes('frustrated') ||
    lowerMessage.includes('stuck') ||
    lowerMessage.includes('problem') ||
    lowerMessage.includes('hard') ||
    lowerMessage.includes('difficult')
  ) {
    return 'challenging'
  }

  if (
    lowerMessage.includes('excited') ||
    lowerMessage.includes('opportunity') ||
    lowerMessage.includes('ready')
  ) {
    return 'exciting'
  }

  if (lowerMessage.includes('urgent') || lowerMessage.includes('need')) {
    return 'urgent'
  }

  return 'important'
}

/**
 * Helper: Extract name from message
 */
function extractName(message: string): string | null {
  const trimmed = message.trim()

  // Basic validation
  if (trimmed.length < 2 || trimmed.length > 50) return null
  if (trimmed.includes('@')) return null // Probably an email
  if (trimmed.includes('?')) return null // Probably a question

  // Extract first name if they give full name
  const parts = trimmed.split(' ')
  return parts[0]
}

/**
 * Helper: Extract email from message
 */
function extractEmail(message: string): string | null {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
  const match = message.match(emailRegex)
  return match ? match[0] : null
}

/**
 * Helper: Detect user type from their description
 */
function detectUserType(
  message: string
): 'founder' | 'buyer' | 'seller' | 'job_seeker' | null {
  const lowerMessage = message.toLowerCase()

  // Founder signals
  if (
    lowerMessage.includes('founder') ||
    lowerMessage.includes('startup') ||
    lowerMessage.includes('company') ||
    lowerMessage.includes('building') ||
    lowerMessage.includes('ceo')
  ) {
    return 'founder'
  }

  // Job seeker signals
  if (
    lowerMessage.includes('job') ||
    lowerMessage.includes('career') ||
    lowerMessage.includes('looking for work') ||
    lowerMessage.includes('laid off') ||
    lowerMessage.includes('hire me')
  ) {
    return 'job_seeker'
  }

  // Seller signals
  if (
    lowerMessage.includes('sell') ||
    lowerMessage.includes('sales') ||
    lowerMessage.includes('customers') ||
    lowerMessage.includes('clients')
  ) {
    return 'seller'
  }

  // Buyer signals
  if (
    lowerMessage.includes('buy') ||
    lowerMessage.includes('need') ||
    lowerMessage.includes('procurement') ||
    lowerMessage.includes('sourcing')
  ) {
    return 'buyer'
  }

  return null
}

/**
 * Helper: Build discovery follow-up based on user type
 */
function buildDiscoveryFollowUp(
  userType: 'founder' | 'buyer' | 'seller' | 'job_seeker',
  context: string
): string {
  if (userType === 'founder') {
    return "Got it - you're building something. That takes guts.\n\nWhat's the biggest bottleneck right now? Is it finding the right people? Selling to customers? Something else?"
  }

  if (userType === 'job_seeker') {
    return "I hear you. The job market can feel brutal.\n\nBut here's the thing: you're not looking for ANY job. You're looking for YOUR specialization.\n\nTell me - when you're at your best, what are you doing?"
  }

  if (userType === 'seller') {
    return 'Sales can be exhausting. Cold outreach, ghosting, chasing leads.\n\nWhat if I handled all of that, and only brought you real conversations?\n\nWho are you trying to reach?'
  }

  if (userType === 'buyer') {
    return "Procurement shouldn't be this hard.\n\nWhat if you could just tell me what you need, and I handle the rest - finding suppliers, negotiating, closing deals?\n\nWhat do you need right now?"
  }

  return 'Tell me more.'
}

/**
 * Helper: Build transition to trust building
 */
function buildTransitionToTrustBuilding(state: OnboardingState): string {
  return `Alright ${state.preferredName || state.name}, I think I understand.\n\nYou're dealing with ${state.painPoint}.\n\nLet me show you what I can do about it.`
}

/**
 * Helper: Should Wells tell a joke?
 * Only if:
 * - Haven't told one in 24 hours
 * - Conversation isn't urgent/stressed
 * - Trust score is decent (they like us)
 */
function shouldTellJoke(state: OnboardingState, sentiment: string): boolean {
  // Check 24h cooldown
  if (state.lastJoke) {
    const hoursSinceLastJoke =
      (new Date().getTime() - state.lastJoke.getTime()) / (1000 * 60 * 60)
    if (hoursSinceLastJoke < 24) {
      return false
    }
  }

  // Don't joke during urgent/challenging conversations
  if (sentiment === 'urgent' || sentiment === 'challenging') {
    return false
  }

  // Need some trust first
  if (state.trustScore < 30) {
    return false
  }

  // 20% chance per message (so it's not every time)
  return Math.random() < 0.2
}

/**
 * Helper: Get what Wells has been up to
 * Like Ghost from Destiny - show what you've been doing/thinking
 * These should feel real, not forced
 */
function getWellsActivity(): string {
  const activities = [
    "I've been looking through semiconductor lead times this morning - they're getting WORSE. Wild.",
    "I spent the last hour trying to figure out why every VC pitch deck uses the same buzzwords. Still confused.",
    "I was analyzing procurement data earlier. Turns out most companies are overpaying for the same stuff. Shocking, I know.",
    "I've been thinking about negotiation tactics. Humans are terrible at it. They get emotional. I don't have that problem.",
    "I was reading through some RFPs this morning. Half of them don't even know what they're asking for. But here we are.",
    "I've been digging through candidate profiles. Found some interesting people. Most are lying about their Excel skills though.",
    "I spent some time analyzing your industry this morning. Lot of noise. Not much signal. Typical.",
    "I was looking at your competition earlier. They're all doing the same thing. You should probably do something different.",
    "I've been thinking about supply chains. They're fragile. Really fragile. One boat gets stuck and the whole world loses its mind.",
    "I was analyzing some sales conversations. Everyone's pitching features. Nobody's solving actual problems. Weird.",
    "I spent the morning looking at hiring data. Companies are desperate for talent but won't pay market rates. Math isn't mathing.",
    "I've been reading LinkedIn posts. Everyone's a 'thought leader' now. I miss when people just had jobs.",
  ]

  return activities[Math.floor(Math.random() * activities.length)]
}

/**
 * Helper: Add Wells activity to message if appropriate
 * Shows what Wells has been thinking about/working on
 */
function maybeAddActivity(
  message: string,
  state: OnboardingState,
  sentiment: string
): { message: string; state: OnboardingState } {
  if (shouldTellJoke(state, sentiment)) {
    const activity = getWellsActivity()
    state.lastJoke = new Date()
    return {
      message: `${message}\n\n${activity}`,
      state
    }
  }

  return { message, state }
}

/**
 * Update onboarding state based on user message
 */
export function updateOnboardingState(
  state: OnboardingState,
  userMessage: string,
  wellsResponse: { message: string; shouldAdvancePhase: boolean }
): { state: OnboardingState; message: string } {
  // Increment conversation depth
  state.conversationDepth++

  // Update trust score based on engagement
  if (userMessage.length > 20) {
    state.trustScore = Math.min(100, state.trustScore + 10)
  }

  // Maybe add what Wells has been up to (20% chance if conditions are right)
  const sentiment = detectSentiment(userMessage)
  const withActivity = maybeAddActivity(wellsResponse.message, state, sentiment)
  state = withActivity.state
  const finalMessage = withActivity.message

  // Advance phase if Wells decided to
  if (wellsResponse.shouldAdvancePhase) {
    state = advancePhase(state)
  }

  // Update last interaction
  state.lastInteraction = new Date()

  return { state, message: finalMessage }
}

/**
 * Advance to next phase
 */
function advancePhase(state: OnboardingState): OnboardingState {
  const phaseOrder: OnboardingState['phase'][] = [
    'greeting',
    'discovery',
    'trust_building',
    'practical_setup',
    'first_mission',
    'complete'
  ]

  const currentIndex = phaseOrder.indexOf(state.phase)
  if (currentIndex < phaseOrder.length - 1) {
    state.phase = phaseOrder[currentIndex + 1]
  }

  return state
}

/**
 * Create user in Notion after email is collected
 */
export async function createUserInNotion(state: OnboardingState): Promise<boolean> {
  if (!state.name || !state.email || !state.userType) {
    return false
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notion/users`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: state.name,
          email: state.email,
          userType: state.userType,
          company: state.company,
          source: 'legendary_onboarding',
          sessionId: state.sessionId
        })
      }
    )

    return response.ok
  } catch (error) {
    console.error('[LEGENDARY_ONBOARDING] Failed to create user:', error)
    return false
  }
}
