// @ts-nocheck
/**
 * Wells Memory System
 *
 * "I will remember my covenant between me and you and all living creatures."
 * - Genesis 9:15
 *
 * A comprehensive memory system that makes Wells feel like it truly KNOWS you.
 * After just a few interactions, Wells remembers your preferences, your history,
 * your communication style, and everything that makes you unique.
 */

// Core Schema & Types
export * from './schema'

// Memory Service (CRUD operations)
export { default as MemoryService } from './service'
export {
  getMemory,
  getOrCreateMemory,
  createMemory,
  updateMemory,
  saveMemory,
  recordInteraction,
  extractFromConversation,
  getPersonalizationContext,
} from './service'

// Personalized Greetings
export { default as GreetingService } from './greetings'
export {
  generateGreeting,
  generateQuickGreeting,
  generateReturnGreeting,
} from './greetings'

// Contextual Awareness
export { default as ContextService } from './context'
export {
  buildConversationContext,
  getContextualPhrases,
  getFollowUpQuestions,
  getOpeningLines,
} from './context'

// Preference Learning
export { default as LearningService } from './learning'
export {
  processLearningEvent,
  getQuoteBehavior,
} from './learning'

// Memory-Powered Prompts
export { default as PromptService } from './prompts'
export {
  getPersonalizedSystemPrompt,
  getRFQPrompt,
  getNegotiationPrompt,
  getOnboardingPrompt,
} from './prompts'

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

import { getMemory, getOrCreateMemory, updateMemory, extractFromConversation } from './service'
import { generateGreeting } from './greetings'
import { buildConversationContext } from './context'
import { processLearningEvent } from './learning'
import { getPersonalizedSystemPrompt } from './prompts'

/**
 * Initialize Wells for a user session
 * Returns everything needed to start a personalized conversation
 */
export async function initializeWellsSession(userId: string) {
  const [memory, greeting, context, prompt] = await Promise.all([
    getOrCreateMemory(userId),
    generateGreeting(userId),
    buildConversationContext(userId),
    getPersonalizedSystemPrompt(userId),
  ])

  return {
    memory,
    greeting,
    context,
    prompt,
    isNewUser: memory.history.totalInteractions === 0,
    trustLevel: memory.history.trustTier,
  }
}

/**
 * Process a completed conversation and learn from it
 */
export async function processConversation(
  userId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  topic?: string
) {
  // Extract facts from the conversation
  const extracted = await extractFromConversation(userId, messages, topic)

  // Record the interaction
  await updateMemory(userId, {
    history: {
      totalMessages: messages.filter(m => m.role === 'user').length,
      lastInteraction: new Date(),
    },
    recentContext: {
      lastTopic: topic || extracted.topics[0],
      lastTopicTimestamp: new Date(),
    },
  })

  return extracted
}

/**
 * Record a business event for learning
 */
export async function recordBusinessEvent(
  userId: string,
  eventType: 'quote_accepted' | 'quote_rejected' | 'deal_won' | 'deal_lost' | 'supplier_selected',
  data: Record<string, any>
) {
  return processLearningEvent({
    userId,
    eventType,
    data,
    timestamp: new Date(),
  })
}

/**
 * Quick helper to get a greeting message
 */
export async function getWelcomeMessage(userId: string): Promise<string> {
  const greeting = await generateGreeting(userId)
  return greeting.subtext
    ? `${greeting.greeting} ${greeting.subtext}`
    : greeting.greeting
}

/**
 * Get a personalized system prompt for any AI interaction
 */
export async function getSystemPromptForUser(
  userId: string,
  options?: {
    journey?: 'buyer' | 'seller' | 'founder' | 'jobs' | 'general'
    feature?: string
    isNewConversation?: boolean
  }
): Promise<string> {
  const result = await getPersonalizedSystemPrompt(userId, options)
  return result.systemPrompt
}
