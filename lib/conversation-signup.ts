/**
 * In-Conversation Signup - Collect user info through chat
 *
 * Wells asks for name, email, userType conversationally
 * Data is stored in session/cookies, then created in Notion
 */

export interface ConversationState {
  step: 'idle' | 'collecting_name' | 'collecting_email' | 'collecting_type' | 'complete'
  name?: string
  email?: string
  userType?: 'buyer' | 'seller' | 'both' | 'job_seeker' | 'founder'
  company?: string
  sessionId: string
}

/**
 * Detect signup intent in user message
 */
export function detectSignupIntent(message: string): boolean {
  const signupKeywords = [
    'sign up',
    'signup',
    'create account',
    'register',
    'join',
    'get started',
    'i want to start',
    'onboard'
  ]

  const lowerMessage = message.toLowerCase()
  return signupKeywords.some(keyword => lowerMessage.includes(keyword))
}

/**
 * Extract user info from conversation message
 */
export function extractUserInfo(
  message: string,
  currentState: ConversationState
): Partial<ConversationState> {
  const updates: Partial<ConversationState> = {}

  // Extract email
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
  const emailMatch = message.match(emailRegex)
  if (emailMatch && currentState.step === 'collecting_email') {
    updates.email = emailMatch[0]
    updates.step = 'collecting_type'
  }

  // Extract user type
  if (currentState.step === 'collecting_type') {
    const lowerMessage = message.toLowerCase()
    if (lowerMessage.includes('buy')) {
      updates.userType = 'buyer'
      updates.step = 'complete'
    } else if (lowerMessage.includes('sell')) {
      updates.userType = 'seller'
      updates.step = 'complete'
    } else if (lowerMessage.includes('both')) {
      updates.userType = 'both'
      updates.step = 'complete'
    } else if (lowerMessage.includes('job') || lowerMessage.includes('career')) {
      updates.userType = 'job_seeker'
      updates.step = 'complete'
    } else if (lowerMessage.includes('founder') || lowerMessage.includes('company')) {
      updates.userType = 'founder'
      updates.step = 'complete'
    }
  }

  // Extract name (when collecting name, assume entire message is name)
  if (currentState.step === 'collecting_name' && message.length > 0 && message.length < 100) {
    // Basic validation: not a question, not too long
    if (!message.includes('?') && !emailMatch) {
      updates.name = message.trim()
      updates.step = 'collecting_email'
    }
  }

  return updates
}

/**
 * Get next prompt based on conversation state
 */
export function getNextPrompt(state: ConversationState): string {
  switch (state.step) {
    case 'collecting_name':
      return "Perfect! What's your name?"

    case 'collecting_email':
      return `Great to meet you, ${state.name}! What's your email?`

    case 'collecting_type':
      return "Are you looking to buy, sell, or both?"

    case 'complete':
      if (state.userType === 'buyer') {
        return `You're all set, ${state.name}! Account created. What are you looking to buy?`
      } else if (state.userType === 'seller') {
        return `You're all set, ${state.name}! Account created. What do you sell?`
      } else if (state.userType === 'job_seeker') {
        return `You're all set, ${state.name}! Account created. What kind of role are you looking for?`
      } else if (state.userType === 'founder') {
        return `You're all set, ${state.name}! Account created. Tell me about your company?`
      } else {
        return `You're all set, ${state.name}! Account created. How can I help you today?`
      }

    default:
      return "How can I help you today?"
  }
}

/**
 * Create user in Notion CRM
 */
export async function createUserInNotion(state: ConversationState): Promise<boolean> {
  if (!state.name || !state.email || !state.userType) {
    return false
  }

  try {
    // Create user in Notion CRM
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notion/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: state.name,
        email: state.email,
        userType: state.userType,
        company: state.company,
        source: 'chat_signup',
        sessionId: state.sessionId
      })
    })

    return response.ok
  } catch (error) {
    console.error('[CONVERSATION_SIGNUP] Failed to create user:', error)
    return false
  }
}
