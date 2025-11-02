/**
 * Journey Detection System
 *
 * Analyzes conversation to determine which Wells journey the user is on:
 * - Buyer: Procurement, sourcing, finding talent/services
 * - Seller: GTM, sales, invoicing, finding customers
 * - Job Seeker: Career search, specialization discovery
 * - Founder: Multiple needs, holistic business management
 */

export type Journey = 'buyer' | 'seller' | 'job_seeker' | 'founder' | 'unknown'

export interface JourneyDetection {
  journey: Journey
  confidence: number // 0-1
  signals: string[] // What triggered the detection
  context?: any // Journey-specific context
}

export interface ConversationContext {
  messages: Array<{ role: string; content: string }>
  userData?: {
    userType?: string
    userId?: string
    name?: string
    company?: string
  }
}

/**
 * Analyze conversation to detect which journey the user is on
 */
export async function detectJourney(context: ConversationContext): Promise<JourneyDetection> {
  const { messages, userData } = context

  if (!messages || messages.length === 0) {
    return { journey: 'unknown', confidence: 0, signals: [] }
  }

  const lastUserMessage = messages[messages.length - 1]?.content || ''
  const conversationText = messages.map(m => m.content).join(' ').toLowerCase()

  // Calculate signals for each journey
  const buyerSignals = detectBuyerSignals(conversationText, lastUserMessage)
  const sellerSignals = detectSellerSignals(conversationText, lastUserMessage)
  const jobSeekerSignals = detectJobSeekerSignals(conversationText, lastUserMessage)
  const founderSignals = detectFounderSignals(conversationText, lastUserMessage)

  // Factor in explicit user type from userData
  let adjustedBuyerScore = buyerSignals.score
  let adjustedSellerScore = sellerSignals.score

  if (userData?.userType === 'buyer') {
    adjustedBuyerScore += 0.3
  } else if (userData?.userType === 'seller' || userData?.userType === 'both') {
    adjustedSellerScore += 0.3
  }

  // Founder journey takes priority if multiple signals present
  if (founderSignals.score > 0.5) {
    return {
      journey: 'founder',
      confidence: founderSignals.score,
      signals: founderSignals.signals,
      context: founderSignals.context
    }
  }

  // Pick the highest scoring journey
  const scores = [
    { journey: 'buyer' as Journey, score: adjustedBuyerScore, signals: buyerSignals.signals, context: buyerSignals.context },
    { journey: 'seller' as Journey, score: adjustedSellerScore, signals: sellerSignals.signals, context: sellerSignals.context },
    { journey: 'job_seeker' as Journey, score: jobSeekerSignals.score, signals: jobSeekerSignals.signals, context: jobSeekerSignals.context }
  ]

  scores.sort((a, b) => b.score - a.score)
  const topJourney = scores[0]

  // Only return a journey if confidence is high enough
  if (topJourney.score < 0.4) {
    return { journey: 'unknown', confidence: 0, signals: [] }
  }

  return {
    journey: topJourney.journey,
    confidence: topJourney.score,
    signals: topJourney.signals,
    context: topJourney.context
  }
}

/**
 * Detect Buyer Journey signals
 */
function detectBuyerSignals(conversationText: string, lastMessage: string) {
  const signals: string[] = []
  let score = 0

  const buyKeywords = [
    { words: ['need', 'looking for', 'find', 'source'], weight: 0.3 },
    { words: ['buy', 'purchase', 'acquire', 'procure'], weight: 0.4 },
    { words: ['supplier', 'vendor', 'provider'], weight: 0.35 },
    { words: ['hire', 'recruit', 'talent', 'executive'], weight: 0.3 },
    { words: ['rfq', 'quote', 'proposal'], weight: 0.45 }
  ]

  for (const { words, weight } of buyKeywords) {
    for (const word of words) {
      if (conversationText.includes(word)) {
        signals.push(`buyer_keyword:${word}`)
        score += weight
        break
      }
    }
  }

  return {
    score: Math.min(score, 1),
    signals,
    context: {
      type: 'procurement'
    }
  }
}

/**
 * Detect Seller Journey signals
 */
function detectSellerSignals(conversationText: string, lastMessage: string) {
  const signals: string[] = []
  let score = 0

  const sellerKeywords = [
    { words: ['sell', 'selling', 'offer', 'provide'], weight: 0.35 },
    { words: ['customers', 'clients', 'leads', 'prospects'], weight: 0.3 },
    { words: ['sales', 'revenue', 'deals', 'close'], weight: 0.35 },
    { words: ['invoice', 'billing', 'payment', 'get paid'], weight: 0.4 },
    { words: ['proposal', 'pitch', 'deck', 'presentation'], weight: 0.3 },
    { words: ['gtm', 'go-to-market', 'launch', 'outreach'], weight: 0.45 },
    { words: ['marketing', 'campaign', 'email', 'cold outreach'], weight: 0.3 }
  ]

  for (const { words, weight } of sellerKeywords) {
    for (const word of words) {
      if (conversationText.includes(word)) {
        signals.push(`seller_keyword:${word}`)
        score += weight
        break
      }
    }
  }

  // Invoicing is a STRONG signal
  if (conversationText.includes('invoice')) {
    score += 0.3
    signals.push('seller_action:invoicing')
  }

  return {
    score: Math.min(score, 1),
    signals,
    context: {
      type: 'gtm'
    }
  }
}

/**
 * Detect Job Seeker Journey signals
 */
function detectJobSeekerSignals(conversationText: string, lastMessage: string) {
  const signals: string[] = []
  let score = 0

  const jobSeekerKeywords = [
    { words: ['job', 'career', 'employment', 'position'], weight: 0.4 },
    { words: ['resume', 'cv', 'portfolio'], weight: 0.45 },
    { words: ['looking for work', 'find a job', 'job search'], weight: 0.5 },
    { words: ['hired', 'hiring', 'recruit me'], weight: 0.35 },
    { words: ['unemployed', 'laid off', 'eliminated'], weight: 0.45 },
    { words: ['specialization', 'expertise', 'skill'], weight: 0.25 }
  ]

  for (const { words, weight } of jobSeekerKeywords) {
    for (const phrase of words) {
      if (conversationText.includes(phrase)) {
        signals.push(`job_seeker_keyword:${phrase}`)
        score += weight
        break
      }
    }
  }

  // "Role was eliminated" is a VERY strong signal
  if (conversationText.includes('eliminated') || conversationText.includes('laid off')) {
    score += 0.3
    signals.push('job_seeker_event:displacement')
  }

  return {
    score: Math.min(score, 1),
    signals,
    context: {
      type: 'career_search'
    }
  }
}

/**
 * Detect Founder Journey signals
 * Founders have multiple, complex needs across HR, GTM, procurement, finance
 */
function detectFounderSignals(conversationText: string, lastMessage: string) {
  const signals: string[] = []
  let score = 0

  const founderKeywords = [
    { words: ['founder', 'ceo', 'started a company', 'my company'], weight: 0.5 },
    { words: ['startup', 'business', 'venture'], weight: 0.3 },
    { words: ['everything', 'overwhelmed', 'wearing all hats'], weight: 0.4 }
  ]

  for (const { words, weight } of founderKeywords) {
    for (const word of words) {
      if (conversationText.includes(word)) {
        signals.push(`founder_keyword:${word}`)
        score += weight
        break
      }
    }
  }

  // Detect multiple journey signals = probably a founder
  const hasBuyerSignals = conversationText.includes('need') || conversationText.includes('hire')
  const hasSellerSignals = conversationText.includes('customers') || conversationText.includes('sales')

  if (hasBuyerSignals && hasSellerSignals) {
    score += 0.4
    signals.push('founder_pattern:multiple_needs')
  }

  return {
    score: Math.min(score, 1),
    signals,
    context: {
      type: 'holistic'
    }
  }
}

/**
 * Get journey-specific onboarding message
 */
export function getJourneyOnboardingMessage(journey: Journey): string {
  switch (journey) {
    case 'buyer':
      return "I can help you source what you need. Let me set up your procurement assistant - I'll handle matching, negotiation, and transactions for you."

    case 'seller':
      return "I can help you close more deals. Let me set up your sales engine - I'll handle outreach, proposals, invoicing, and follow-ups."

    case 'job_seeker':
      return "I can help you find work that matches your specialization. Let me set up your career profile - I'll connect you with opportunities where you'll thrive."

    case 'founder':
      return "I can help you run your entire company. Let me set up your command center - I'll handle HR, sales, procurement, and finance all in one place."

    default:
      return "I'm here to help. What are you working on?"
  }
}

/**
 * Check if user should be prompted to onboard to a journey
 */
export function shouldPromptOnboarding(detection: JourneyDetection, userHasJourney: boolean): boolean {
  // Don't prompt if confidence is too low
  if (detection.confidence < 0.6) return false

  // Don't prompt if user already has this journey set up
  if (userHasJourney) return false

  // Don't prompt for unknown journey
  if (detection.journey === 'unknown') return false

  return true
}
