// @ts-nocheck
/**
 * Wells Contextual Awareness Module
 *
 * "I know the plans I have for you." - Jeremiah 29:11
 *
 * Wells references past interactions naturally, showing awareness of history
 * without being creepy about it. Like a good friend who remembers what's
 * important to you.
 */

import { WellsMemory, daysSince, hoursSince } from './schema'
import { getMemory } from './service'

// ============================================================================
// TYPES
// ============================================================================

export interface ContextualReference {
  type: 'topic' | 'project' | 'preference' | 'relationship' | 'timeline' | 'milestone'
  content: string
  confidence: number  // 0-1, how sure we are this is relevant
  source: string      // where we learned this
  age: 'recent' | 'moderate' | 'old'  // how fresh is this info
}

export interface ContextualSuggestion {
  id: string
  trigger: string          // what triggered this suggestion
  suggestion: string       // what Wells might say
  priority: number         // 1-10, higher = more relevant
  category: 'follow_up' | 'reminder' | 'insight' | 'offer' | 'question'
}

export interface ConversationContext {
  // References Wells can make
  availableReferences: ContextualReference[]

  // Suggested openers/transitions
  suggestions: ContextualSuggestion[]

  // Things Wells should avoid mentioning
  avoidTopics: string[]

  // Current user state
  userState: {
    seemsBusy: boolean
    seemsStressed: boolean
    lookingForHelp: boolean
    justBrowsing: boolean
  }
}

// ============================================================================
// MAIN CONTEXT BUILDER
// ============================================================================

/**
 * Build conversational context for Wells
 */
export async function buildConversationContext(userId: string): Promise<ConversationContext> {
  const defaultContext: ConversationContext = {
    availableReferences: [],
    suggestions: [],
    avoidTopics: [],
    userState: {
      seemsBusy: false,
      seemsStressed: false,
      lookingForHelp: false,
      justBrowsing: false,
    },
  }

  try {
    const memory = await getMemory(userId)
    if (!memory) return defaultContext

    const references = buildAvailableReferences(memory)
    const suggestions = buildContextualSuggestions(memory)
    const avoidTopics = identifyAvoidTopics(memory)
    const userState = inferUserState(memory)

    return {
      availableReferences: references,
      suggestions,
      avoidTopics,
      userState,
    }
  } catch (error) {
    console.error('[Context] Error building context:', error)
    return defaultContext
  }
}

// ============================================================================
// REFERENCE BUILDERS
// ============================================================================

/**
 * Build references Wells can make to past interactions
 */
function buildAvailableReferences(memory: WellsMemory): ContextualReference[] {
  const references: ContextualReference[] = []

  // Last topic reference
  if (memory.recentContext.lastTopic) {
    const hoursSinceTopic = memory.recentContext.lastTopicTimestamp
      ? hoursSince(memory.recentContext.lastTopicTimestamp)
      : 1000

    references.push({
      type: 'topic',
      content: `Last time you mentioned ${memory.recentContext.lastTopic.toLowerCase()}`,
      confidence: hoursSinceTopic < 48 ? 0.9 : hoursSinceTopic < 168 ? 0.7 : 0.5,
      source: 'conversation',
      age: hoursSinceTopic < 48 ? 'recent' : hoursSinceTopic < 168 ? 'moderate' : 'old',
    })
  }

  // Ongoing project references
  for (const project of memory.recentContext.ongoingProjects) {
    if (project.status === 'active') {
      references.push({
        type: 'project',
        content: `You're working on ${project.name}`,
        confidence: 0.9,
        source: 'project_tracking',
        age: 'recent',
      })

      if (project.nextSteps?.length) {
        references.push({
          type: 'project',
          content: `Next step on ${project.name}: ${project.nextSteps[0]}`,
          confidence: 0.85,
          source: 'project_tracking',
          age: 'recent',
        })
      }
    }
  }

  // Preference references
  if (memory.learnedPreferences.priceSensitivity === 'very_high' || memory.learnedPreferences.priceSensitivity === 'high') {
    references.push({
      type: 'preference',
      content: 'You usually prefer competitive pricing',
      confidence: 0.8,
      source: 'learned_preference',
      age: 'moderate',
    })
  }

  if (memory.learnedPreferences.qualityPriority === 'critical' || memory.learnedPreferences.qualityPriority === 'high') {
    references.push({
      type: 'preference',
      content: 'Quality is a top priority for you',
      confidence: 0.8,
      source: 'learned_preference',
      age: 'moderate',
    })
  }

  if (memory.learnedPreferences.speedPriority === 'critical' || memory.learnedPreferences.speedPriority === 'high') {
    references.push({
      type: 'preference',
      content: 'You typically need things fast',
      confidence: 0.8,
      source: 'learned_preference',
      age: 'moderate',
    })
  }

  // Supplier preference references
  if (memory.learnedPreferences.preferredSuppliers?.length) {
    const supplier = memory.learnedPreferences.preferredSuppliers[0]
    references.push({
      type: 'preference',
      content: `You've had good experiences with ${supplier.name}`,
      confidence: 0.85,
      source: 'deal_history',
      age: 'moderate',
    })
  }

  // Location preference
  if (memory.facts.location || memory.facts.state) {
    const location = memory.facts.city || memory.facts.state || memory.facts.location
    references.push({
      type: 'preference',
      content: `You're based in ${location}`,
      confidence: 0.95,
      source: 'user_facts',
      age: 'moderate',
    })
  }

  // Relationship references (people mentioned)
  for (const person of memory.recentContext.mentionedPeople.slice(0, 3)) {
    if (person.mentionCount > 1) {
      references.push({
        type: 'relationship',
        content: `You've mentioned ${person.name} ${person.mentionCount} times`,
        confidence: 0.75,
        source: 'conversation_analysis',
        age: hoursSince(person.lastMentioned) < 168 ? 'recent' : 'moderate',
      })
    }
  }

  // Company references
  for (const company of memory.recentContext.mentionedCompanies.slice(0, 3)) {
    if (company.mentionCount > 1) {
      references.push({
        type: 'relationship',
        content: `You've been discussing ${company.name}`,
        confidence: 0.8,
        source: 'conversation_analysis',
        age: hoursSince(company.lastMentioned) < 168 ? 'recent' : 'moderate',
      })
    }
  }

  // Timeline references
  if (memory.history.totalInteractions > 10) {
    references.push({
      type: 'timeline',
      content: `We've been working together for ${daysSince(memory.history.firstContact)} days`,
      confidence: 1.0,
      source: 'relationship_history',
      age: 'moderate',
    })
  }

  if (memory.history.successfulDeals > 0) {
    references.push({
      type: 'milestone',
      content: `We've closed ${memory.history.successfulDeals} deal${memory.history.successfulDeals > 1 ? 's' : ''} together`,
      confidence: 1.0,
      source: 'deal_history',
      age: 'moderate',
    })
  }

  if (memory.history.totalValueTransacted > 0) {
    references.push({
      type: 'milestone',
      content: `You've transacted $${memory.history.totalValueTransacted.toLocaleString()} through Wells`,
      confidence: 1.0,
      source: 'transaction_history',
      age: 'moderate',
    })
  }

  // Sort by confidence and recency
  return references.sort((a, b) => {
    const ageScore = { recent: 3, moderate: 2, old: 1 }
    return (b.confidence + ageScore[b.age] * 0.1) - (a.confidence + ageScore[a.age] * 0.1)
  })
}

// ============================================================================
// SUGGESTION BUILDERS
// ============================================================================

/**
 * Build contextual suggestions for Wells to offer
 */
function buildContextualSuggestions(memory: WellsMemory): ContextualSuggestion[] {
  const suggestions: ContextualSuggestion[] = []
  let suggestionId = 0

  // Follow up on last topic
  if (memory.recentContext.lastTopic) {
    const hoursSinceTopic = memory.recentContext.lastTopicTimestamp
      ? hoursSince(memory.recentContext.lastTopicTimestamp)
      : 1000

    if (hoursSinceTopic > 24 && hoursSinceTopic < 168) {
      suggestions.push({
        id: `s_${++suggestionId}`,
        trigger: 'topic_follow_up',
        suggestion: `Last time you mentioned needing ${memory.recentContext.lastTopic.toLowerCase()} - did that work out?`,
        priority: 7,
        category: 'follow_up',
      })
    }
  }

  // Remind about pending actions
  for (const action of memory.recentContext.pendingActions.slice(0, 3)) {
    suggestions.push({
      id: `s_${++suggestionId}`,
      trigger: 'pending_action',
      suggestion: `Just checking in - ${action.action}`,
      priority: action.priority === 'critical' ? 10 : action.priority === 'high' ? 8 : 5,
      category: 'reminder',
    })
  }

  // Open questions to follow up on
  for (const question of memory.recentContext.openQuestions.slice(0, 2)) {
    suggestions.push({
      id: `s_${++suggestionId}`,
      trigger: 'open_question',
      suggestion: question,
      priority: 6,
      category: 'question',
    })
  }

  // Location-based preference
  if (memory.facts.state || memory.facts.location) {
    const location = memory.facts.state || memory.facts.location
    suggestions.push({
      id: `s_${++suggestionId}`,
      trigger: 'location_preference',
      suggestion: `You usually prefer suppliers on the ${getRegion(location)} - should I prioritize that?`,
      priority: 4,
      category: 'offer',
    })
  }

  // Timeline-based suggestion
  if (memory.history.successfulDeals > 0) {
    const avgDealCycle = memory.history.averageDealValue
      ? Math.round((Date.now() - memory.history.firstContact.getTime()) / (1000 * 60 * 60 * 24) / memory.history.successfulDeals)
      : 30

    suggestions.push({
      id: `s_${++suggestionId}`,
      trigger: 'deal_cycle',
      suggestion: `Based on your pattern, you usually need new suppliers every ${avgDealCycle} days. Shall I start looking?`,
      priority: 3,
      category: 'insight',
    })
  }

  // Deadline reference
  const urgentActions = memory.recentContext.pendingActions.filter(a => a.priority === 'critical' || a.priority === 'high')
  if (urgentActions.length > 0) {
    suggestions.push({
      id: `s_${++suggestionId}`,
      trigger: 'deadline',
      suggestion: `I remember you had a tight deadline last month. How's the timeline this time?`,
      priority: 6,
      category: 'question',
    })
  }

  // Sort by priority
  return suggestions.sort((a, b) => b.priority - a.priority)
}

// ============================================================================
// CONTEXT ANALYSIS
// ============================================================================

/**
 * Identify topics Wells should avoid mentioning
 */
function identifyAvoidTopics(memory: WellsMemory): string[] {
  const avoidTopics: string[] = []

  // Add explicit concerns
  for (const concern of memory.recentContext.concerns) {
    if (concern.toLowerCase().includes('avoid') || concern.toLowerCase().includes("don't mention")) {
      avoidTopics.push(concern)
    }
  }

  // Avoid suppliers they've had bad experiences with
  for (const supplier of memory.learnedPreferences.avoidSuppliers || []) {
    avoidTopics.push(supplier.name)
  }

  return avoidTopics
}

/**
 * Infer current user state from patterns
 */
function inferUserState(memory: WellsMemory): ConversationContext['userState'] {
  const now = new Date()
  const hour = now.getHours()
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'lowercase' }) as any

  // Check if they're working outside normal hours
  const outsideNormalHours = hour < 7 || hour > 19

  // Check if it's typically a busy day for them
  const isBusyDay = memory.patterns.activeDays?.includes(dayOfWeek)

  // Check for urgent pending items
  const hasUrgent = memory.recentContext.pendingActions.some(a => a.priority === 'critical')

  // Check sentiment trend
  const isStressed = memory.recentContext.sentimentTrend === 'declining' ||
    memory.recentContext.concerns.length > 2

  return {
    seemsBusy: isBusyDay || hasUrgent,
    seemsStressed: isStressed,
    lookingForHelp: memory.recentContext.openQuestions.length > 0,
    justBrowsing: memory.history.totalInteractions < 3 && memory.recentContext.ongoingProjects.length === 0,
  }
}

// ============================================================================
// CONTEXTUAL RESPONSE ENHANCERS
// ============================================================================

/**
 * Get contextual phrases Wells can use
 */
export function getContextualPhrases(memory: WellsMemory): string[] {
  const phrases: string[] = []

  // Industry-specific
  if (memory.facts.industry) {
    phrases.push(`In the ${memory.facts.industry.toLowerCase()} space`)
    phrases.push(`For ${memory.facts.industry.toLowerCase()} businesses like yours`)
  }

  // Company-specific
  if (memory.facts.company) {
    phrases.push(`For ${memory.facts.company}`)
    phrases.push(`At your scale at ${memory.facts.company}`)
  }

  // Role-specific
  if (memory.facts.role) {
    phrases.push(`As a ${memory.facts.role.toLowerCase()}`)
    phrases.push(`From your perspective as ${memory.facts.role.toLowerCase()}`)
  }

  // Experience-based
  if (memory.history.successfulDeals > 5) {
    phrases.push('Based on our history together')
    phrases.push('Given what I know about your preferences')
  }

  // Preference-based
  if (memory.learnedPreferences.priceSensitivity === 'very_high') {
    phrases.push('Keeping your budget in mind')
  }
  if (memory.learnedPreferences.qualityPriority === 'critical') {
    phrases.push('Given your quality standards')
  }
  if (memory.learnedPreferences.speedPriority === 'critical') {
    phrases.push('Since speed is crucial for you')
  }

  return phrases
}

/**
 * Get natural follow-up questions based on context
 */
export function getFollowUpQuestions(memory: WellsMemory): string[] {
  const questions: string[] = []

  // Last topic follow-up
  if (memory.recentContext.lastTopic) {
    questions.push(`How did things go with ${memory.recentContext.lastTopic.toLowerCase()}?`)
    questions.push(`Did ${memory.recentContext.lastTopic.toLowerCase()} work out?`)
  }

  // Project follow-ups
  for (const project of memory.recentContext.ongoingProjects.filter(p => p.status === 'active')) {
    questions.push(`Any updates on ${project.name}?`)
    if (project.blockers?.length) {
      questions.push(`Did you resolve the ${project.blockers[0].toLowerCase()} issue?`)
    }
  }

  // Promise follow-ups
  for (const promise of memory.recentContext.promises.filter(p => !p.fulfilled)) {
    questions.push(`I said I'd ${promise.promise.toLowerCase()} - want me to do that now?`)
  }

  return questions.slice(0, 3)  // Max 3 questions
}

/**
 * Get personalized opening lines for different scenarios
 */
export function getOpeningLines(memory: WellsMemory, scenario: 'rfq' | 'chat' | 'deal' | 'support'): string[] {
  const name = memory.facts.preferredName || memory.facts.name?.split(' ')[0]
  const lines: string[] = []

  switch (scenario) {
    case 'rfq':
      if (memory.history.quotesRequested > 0) {
        lines.push(`Based on your previous requests, I have some ideas.`)
        lines.push(`I remember what you liked last time.`)
      }
      if (memory.learnedPreferences.preferredSuppliers?.length) {
        lines.push(`Should I start with your usual suppliers?`)
      }
      break

    case 'chat':
      if (memory.recentContext.lastTopic) {
        lines.push(`Still thinking about ${memory.recentContext.lastTopic.toLowerCase()}?`)
      }
      if (memory.recentContext.openQuestions.length > 0) {
        lines.push(`Want to pick up where we left off?`)
      }
      break

    case 'deal':
      if (memory.history.successfulDeals > 0) {
        lines.push(`Ready for deal number ${memory.history.successfulDeals + 1}?`)
      }
      if (memory.learnedPreferences.negotiationStyle) {
        lines.push(`I'll keep your ${memory.learnedPreferences.negotiationStyle} approach in mind.`)
      }
      break

    case 'support':
      lines.push(`What's going on?`)
      if (memory.recentContext.concerns.length > 0) {
        lines.push(`I noticed some concerns lately. Let's address them.`)
      }
      break
  }

  return lines
}

// ============================================================================
// HELPERS
// ============================================================================

function getRegion(location: string): string {
  const eastCoast = ['NY', 'NJ', 'CT', 'MA', 'PA', 'MD', 'VA', 'NC', 'SC', 'GA', 'FL', 'New York', 'New Jersey', 'Connecticut', 'Massachusetts', 'Pennsylvania', 'Maryland', 'Virginia', 'North Carolina', 'South Carolina', 'Georgia', 'Florida']
  const westCoast = ['CA', 'OR', 'WA', 'California', 'Oregon', 'Washington']
  const midwest = ['IL', 'OH', 'MI', 'IN', 'WI', 'MN', 'IA', 'MO', 'Illinois', 'Ohio', 'Michigan', 'Indiana', 'Wisconsin', 'Minnesota', 'Iowa', 'Missouri']

  if (eastCoast.some(s => location.includes(s))) return 'East Coast'
  if (westCoast.some(s => location.includes(s))) return 'West Coast'
  if (midwest.some(s => location.includes(s))) return 'Midwest'
  return 'your region'
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ContextService = {
  buildConversationContext,
  getContextualPhrases,
  getFollowUpQuestions,
  getOpeningLines,
}

export default ContextService
