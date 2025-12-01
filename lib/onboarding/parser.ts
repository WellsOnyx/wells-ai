/**
 * Wells AI - Onboarding Conversation Parser
 *
 * Analyzes user messages to extract information and advance onboarding.
 */

import { OnboardingState, detectJourney, awardMilestone } from './stages'

/**
 * Parse user message and extract onboarding information
 */
export function parseOnboardingMessage(
  userMessage: string,
  assistantMessage: string,
  state: OnboardingState,
  conversationHistory: string[]
): OnboardingState {
  let newState = { ...state }

  // Extract name if not yet captured
  if (!newState.name) {
    const extractedName = extractName(userMessage, assistantMessage)
    if (extractedName) {
      newState.name = extractedName.full
      newState.preferredName = extractedName.preferred
      newState = awardMilestone(newState, 'first_name_shared')
    }
  }

  // Detect journey if not yet identified
  if (!newState.journey) {
    const journey = detectJourney(userMessage, conversationHistory)
    if (journey !== 'unknown') {
      newState.journey = journey
      newState = awardMilestone(newState, 'journey_identified')
    }
  }

  // Extract role/company
  if (!newState.role) {
    const role = extractRole(userMessage)
    if (role) newState.role = role
  }

  if (!newState.company) {
    const company = extractCompany(userMessage)
    if (company) newState.company = company
  }

  // Extract pain points
  if (!newState.painPoint) {
    const painPoint = extractPainPoint(userMessage)
    if (painPoint) newState.painPoint = painPoint
  }

  // Extract goals
  if (!newState.goal) {
    const goal = extractGoal(userMessage)
    if (goal) newState.goal = goal
  }

  // Detect email/phone sharing
  if (!newState.email) {
    const email = extractEmail(userMessage)
    if (email) newState.email = email
  }

  if (!newState.phone) {
    const phone = extractPhone(userMessage)
    if (phone) newState.phone = phone
  }

  // Detect first RFQ creation
  if (newState.journey === 'buyer' && !newState.firstRfqCreated) {
    if (detectRfqIntent(userMessage)) {
      newState.firstRfqCreated = true
      newState = awardMilestone(newState, 'first_rfq')
    }
  }

  // Increment message count
  newState.messageCount += 1

  // Calculate trust score increase
  const trustIncrease = calculateTrustIncrease(userMessage, assistantMessage, state)
  newState.trustScore = Math.min(newState.trustScore + trustIncrease, 100)

  // Calculate conversation depth
  newState.conversationDepth = calculateConversationDepth(
    userMessage,
    conversationHistory,
    newState
  )

  return newState
}

/**
 * Extract name from message
 */
function extractName(userMessage: string, context: string): { full: string; preferred: string } | null {
  const lower = userMessage.toLowerCase()

  // Direct name patterns
  const patterns = [
    /(?:my name is|i'm|i am|call me)\s+([a-z]+(?:\s+[a-z]+)?)/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$/,
    /(?:it's|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/
  ]

  for (const pattern of patterns) {
    const match = userMessage.match(pattern)
    if (match && match[1]) {
      const fullName = match[1].trim()
      const firstName = fullName.split(' ')[0]

      // Skip common non-names
      if (['Hello', 'Hi', 'Hey', 'Yes', 'No', 'Sure', 'Okay'].includes(firstName)) {
        continue
      }

      return {
        full: fullName,
        preferred: firstName
      }
    }
  }

  // Check if Wells asked for name in context
  if (context.toLowerCase().includes('what should i call you') ||
      context.toLowerCase().includes('what\'s your name')) {
    // Next message is likely the name
    const words = userMessage.trim().split(/\s+/)
    if (words.length <= 3 && /^[A-Z]/.test(words[0])) {
      const fullName = userMessage.trim()
      return {
        full: fullName,
        preferred: words[0]
      }
    }
  }

  return null
}

/**
 * Extract role from message
 */
function extractRole(message: string): string | null {
  const patterns = [
    /i(?:'m| am) (?:a |an |the )?([^,\.]+?)(?:at|in|for)/i,
    /(?:work as|working as)\s+(?:a |an |the )?([^,\.]+)/i,
    /(?:my role is|my job is)\s+([^,\.]+)/i
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match && match[1]) {
      const role = match[1].trim()
      // Filter out too long/generic matches
      if (role.length < 50 && !role.includes('looking for')) {
        return role
      }
    }
  }

  return null
}

/**
 * Extract company from message
 */
function extractCompany(message: string): string | null {
  const patterns = [
    /(?:at|for|work at|working at)\s+([A-Z][a-zA-Z0-9\s&]+?)(?:\.|,|$|\s+(?:and|in|as))/,
    /(?:company|employer|organization)(?:\s+is)?\s+([A-Z][a-zA-Z0-9\s&]+?)(?:\.|,|$)/i
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match && match[1]) {
      const company = match[1].trim()
      if (company.length < 50) {
        return company
      }
    }
  }

  return null
}

/**
 * Extract pain point from message
 */
function extractPainPoint(message: string): string | null {
  const lower = message.toLowerCase()

  const painKeywords = [
    'struggle', 'difficult', 'problem', 'frustrated', 'slow', 'expensive',
    'waste', 'painful', 'annoying', 'hard to', 'can\'t', 'don\'t have'
  ]

  if (painKeywords.some(k => lower.includes(k))) {
    return message.trim()
  }

  return null
}

/**
 * Extract goal from message
 */
function extractGoal(message: string): string | null {
  const lower = message.toLowerCase()

  const goalKeywords = [
    'want to', 'need to', 'looking for', 'trying to', 'goal is',
    'hoping to', 'would like to', 'planning to'
  ]

  if (goalKeywords.some(k => lower.includes(k))) {
    return message.trim()
  }

  return null
}

/**
 * Extract email from message
 */
function extractEmail(message: string): string | null {
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
  const match = message.match(emailPattern)
  return match ? match[0] : null
}

/**
 * Extract phone from message
 */
function extractPhone(message: string): string | null {
  const phonePatterns = [
    /\+?1?\s*\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/,
    /\b\d{10}\b/
  ]

  for (const pattern of phonePatterns) {
    const match = message.match(pattern)
    if (match) {
      return match[0]
    }
  }

  return null
}

/**
 * Detect RFQ/sourcing intent
 */
function detectRfqIntent(message: string): boolean {
  const lower = message.toLowerCase()

  const rfqKeywords = [
    'need to source', 'looking for', 'need to buy', 'need to purchase',
    'find suppliers', 'get quotes', 'need quotes for', 'looking to buy',
    'need', 'require', 'want to buy'
  ]

  return rfqKeywords.some(k => lower.includes(k))
}

/**
 * Calculate trust score increase from interaction
 */
function calculateTrustIncrease(
  userMessage: string,
  assistantMessage: string,
  currentState: OnboardingState
): number {
  let increase = 0

  // User shared personal information
  if (extractName(userMessage, '') || extractEmail(userMessage) || extractPhone(userMessage)) {
    increase += 5
  }

  // User expressed satisfaction
  const satisfactionKeywords = ['great', 'perfect', 'awesome', 'excellent', 'thank you', 'thanks']
  if (satisfactionKeywords.some(k => userMessage.toLowerCase().includes(k))) {
    increase += 3
  }

  // User asked follow-up question (shows engagement)
  if (userMessage.includes('?')) {
    increase += 2
  }

  // User shared detailed information (longer message)
  if (userMessage.length > 100) {
    increase += 2
  }

  // Wells delivered value (mentioned taking action)
  const actionKeywords = ['found', 'created', 'sent', 'connected', 'done']
  if (actionKeywords.some(k => assistantMessage.toLowerCase().includes(k))) {
    increase += 5
  }

  return increase
}

/**
 * Calculate conversation depth
 */
function calculateConversationDepth(
  userMessage: string,
  conversationHistory: string[],
  state: OnboardingState
): number {
  let depth = state.conversationDepth

  // Deeper conversations have more context
  if (conversationHistory.length > 5) depth = Math.max(depth, 3)
  if (conversationHistory.length > 10) depth = Math.max(depth, 5)
  if (conversationHistory.length > 15) depth = Math.max(depth, 7)

  // Depth increases with personal information shared
  const personalInfoCount = [
    state.name,
    state.email,
    state.phone,
    state.company,
    state.role,
    state.painPoint,
    state.goal
  ].filter(Boolean).length

  depth = Math.max(depth, personalInfoCount)

  // Cap at 10
  return Math.min(depth, 10)
}

/**
 * Detect if user wants to connect bank/ERP
 */
export function detectIntegrationIntent(message: string): {
  wantsBank: boolean
  wantsErp: boolean
  wantsCalendar: boolean
} {
  const lower = message.toLowerCase()

  return {
    wantsBank: lower.includes('bank') || lower.includes('payment') || lower.includes('plaid'),
    wantsErp: lower.includes('erp') || lower.includes('system') || lower.includes('integrate'),
    wantsCalendar: lower.includes('calendar') || lower.includes('schedule') || lower.includes('meeting')
  }
}

/**
 * Analyze sentiment of user message
 */
export function analyzeSentiment(message: string): 'positive' | 'neutral' | 'negative' {
  const lower = message.toLowerCase()

  const positiveWords = [
    'great', 'awesome', 'perfect', 'excellent', 'love', 'amazing',
    'wonderful', 'fantastic', 'good', 'nice', 'helpful'
  ]

  const negativeWords = [
    'bad', 'terrible', 'awful', 'hate', 'frustrated', 'annoyed',
    'disappointed', 'useless', 'waste', 'stupid'
  ]

  const positiveCount = positiveWords.filter(w => lower.includes(w)).length
  const negativeCount = negativeWords.filter(w => lower.includes(w)).length

  if (positiveCount > negativeCount) return 'positive'
  if (negativeCount > positiveCount) return 'negative'
  return 'neutral'
}
