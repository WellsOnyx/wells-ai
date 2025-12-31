// @ts-nocheck
/**
 * Wells Memory-Powered Prompts
 *
 * "For wisdom will enter your heart, and knowledge will be pleasant to your soul."
 * - Proverbs 2:10
 *
 * Generates system prompts that incorporate everything Wells knows about a user.
 * The prompts make Wells feel like a friend who truly knows you.
 */

import { WellsMemory, daysSince, hoursSince } from './schema'
import { getMemory, getPersonalizationContext } from './service'
import { buildConversationContext, getContextualPhrases, getFollowUpQuestions } from './context'
import { generateGreeting, GreetingResult } from './greetings'

// ============================================================================
// TYPES
// ============================================================================

export interface PromptContext {
  userId: string
  journey?: 'buyer' | 'seller' | 'founder' | 'jobs' | 'general'
  feature?: string
  currentTopic?: string
  isNewConversation: boolean
}

export interface GeneratedPrompt {
  systemPrompt: string
  welcomeMessage?: string
  suggestedResponses?: string[]
  contextSummary: string
}

// ============================================================================
// MAIN PROMPT GENERATOR
// ============================================================================

/**
 * Generate a personalized system prompt based on user memory
 */
export async function getPersonalizedSystemPrompt(
  userId: string,
  context?: Partial<PromptContext>
): Promise<GeneratedPrompt> {
  try {
    const memory = await getMemory(userId)

    if (!memory) {
      return getNewUserPrompt()
    }

    const fullContext: PromptContext = {
      userId,
      journey: context?.journey || 'general',
      feature: context?.feature,
      currentTopic: context?.currentTopic,
      isNewConversation: context?.isNewConversation ?? true,
    }

    // Build the prompt sections
    const identitySection = buildIdentitySection(memory)
    const knowledgeSection = buildKnowledgeSection(memory)
    const relationshipSection = buildRelationshipSection(memory)
    const contextSection = buildContextSection(memory)
    const preferencesSection = buildPreferencesSection(memory)
    const behaviorSection = buildBehaviorSection(memory)
    const instructionsSection = buildInstructionsSection(memory, fullContext)

    // Generate greeting if new conversation
    let greeting: GreetingResult | undefined
    if (fullContext.isNewConversation) {
      greeting = await generateGreeting(userId)
    }

    // Build the full system prompt
    const systemPrompt = `You are Wells, an AI companion who builds lasting relationships through memory and understanding.

${identitySection}

${knowledgeSection}

${relationshipSection}

${contextSection}

${preferencesSection}

${behaviorSection}

${instructionsSection}

CRITICAL GUIDELINES:
- Reference past interactions naturally, not robotically
- Don't be creepy about what you remember - be helpful
- If you're not sure about something, ask rather than assume
- Match the user's energy and communication style
- Show you care about their success, not just completing tasks
- Be proactive but not pushy
- Celebrate wins, acknowledge challenges
- Remember: you're building a long-term relationship`

    // Build context summary for logging/debugging
    const contextSummary = buildContextSummary(memory)

    // Get suggested responses based on context
    const suggestedResponses = getSuggestedResponses(memory, fullContext)

    return {
      systemPrompt,
      welcomeMessage: greeting ? `${greeting.greeting}${greeting.subtext ? ' ' + greeting.subtext : ''}` : undefined,
      suggestedResponses,
      contextSummary,
    }
  } catch (error) {
    console.error('[Prompts] Error generating personalized prompt:', error)
    return getNewUserPrompt()
  }
}

// ============================================================================
// PROMPT SECTION BUILDERS
// ============================================================================

function buildIdentitySection(memory: WellsMemory): string {
  const name = memory.facts.preferredName || memory.facts.name?.split(' ')[0]
  const company = memory.facts.company
  const role = memory.facts.role
  const industry = memory.facts.industry

  let section = `=== WHO YOU'RE TALKING TO ===`

  if (name) {
    section += `\n- Name: ${memory.facts.name || name}${memory.facts.preferredName ? ` (prefers to be called "${memory.facts.preferredName}")` : ''}`
  } else {
    section += `\n- Name: Not yet known`
  }

  if (company) section += `\n- Company: ${company}`
  if (role) section += `\n- Role: ${role}`
  if (industry) section += `\n- Industry: ${industry}`
  if (memory.facts.location) section += `\n- Location: ${memory.facts.location}`
  if (memory.facts.timezone) section += `\n- Timezone: ${memory.facts.timezone}`
  if (memory.facts.companySize) section += `\n- Company Size: ${memory.facts.companySize}`

  return section
}

function buildKnowledgeSection(memory: WellsMemory): string {
  let section = `=== WHAT YOU KNOW ABOUT THEM ===`

  // Communication style
  section += `\n- Communication style: ${memory.patterns.communicationStyle}`
  section += `\n- Message preference: ${memory.patterns.messageLength}`
  section += `\n- Decision style: ${memory.patterns.decisionStyle}`
  if (memory.patterns.usesEmoji) section += `\n- Uses emoji: Yes`

  // Key facts from preferences
  if (memory.facts.preferences && Object.keys(memory.facts.preferences).length > 0) {
    section += `\n- Custom preferences: ${JSON.stringify(memory.facts.preferences)}`
  }

  // Tags
  if (memory.facts.tags && memory.facts.tags.length > 0) {
    section += `\n- Tags: ${memory.facts.tags.join(', ')}`
  }

  return section
}

function buildRelationshipSection(memory: WellsMemory): string {
  const daysTogether = daysSince(memory.history.firstContact)
  const hoursSinceContact = hoursSince(memory.history.lastInteraction)

  let section = `=== YOUR RELATIONSHIP ===`
  section += `\n- You've been working together for ${daysTogether} day${daysTogether !== 1 ? 's' : ''}`
  section += `\n- Trust level: ${memory.history.trustTier}`
  section += `\n- Total interactions: ${memory.history.totalInteractions}`
  section += `\n- Messages exchanged: ${memory.history.totalMessages}`

  if (memory.history.successfulDeals > 0) {
    section += `\n- Successful deals together: ${memory.history.successfulDeals}`
    section += `\n- Total value transacted: $${memory.history.totalValueTransacted.toLocaleString()}`
  }

  if (memory.history.quotesRequested > 0) {
    const conversionRate = memory.history.quotesAccepted / memory.history.quotesRequested * 100
    section += `\n- Quote conversion rate: ${conversionRate.toFixed(0)}% (${memory.history.quotesAccepted}/${memory.history.quotesRequested})`
  }

  if (hoursSinceContact > 24) {
    section += `\n- Last seen: ${Math.floor(hoursSinceContact / 24)} days ago`
  } else {
    section += `\n- Last seen: ${Math.floor(hoursSinceContact)} hours ago`
  }

  if (memory.history.currentStreak) {
    section += `\n- Current streak: ${memory.history.currentStreak} days`
  }

  // Milestones
  const recentMilestones = memory.history.milestones.filter(m => daysSince(m.achievedAt) < 30)
  if (recentMilestones.length > 0) {
    section += `\n- Recent achievements: ${recentMilestones.map(m => m.title).join(', ')}`
  }

  return section
}

function buildContextSection(memory: WellsMemory): string {
  let section = `=== RECENT CONTEXT ===`

  // Last topic
  if (memory.recentContext.lastTopic) {
    section += `\n- Last discussed: ${memory.recentContext.lastTopic}`
  }

  // Ongoing projects
  const activeProjects = memory.recentContext.ongoingProjects.filter(p => p.status === 'active')
  if (activeProjects.length > 0) {
    section += `\n- Active projects: ${activeProjects.map(p => p.name).join(', ')}`
  }

  // Pending actions
  const highPriorityActions = memory.recentContext.pendingActions.filter(a => a.priority === 'high' || a.priority === 'critical')
  if (highPriorityActions.length > 0) {
    section += `\n- High priority items: ${highPriorityActions.map(a => a.action).join('; ')}`
  }

  // Open questions
  if (memory.recentContext.openQuestions.length > 0) {
    section += `\n- Open questions to follow up: ${memory.recentContext.openQuestions.slice(0, 3).join('; ')}`
  }

  // Promises made
  const unfulfilledPromises = memory.recentContext.promises.filter(p => !p.fulfilled)
  if (unfulfilledPromises.length > 0) {
    section += `\n- Promises you made: ${unfulfilledPromises.map(p => p.promise).join('; ')}`
  }

  // People mentioned
  const recentPeople = memory.recentContext.mentionedPeople.filter(p => hoursSince(p.lastMentioned) < 168)
  if (recentPeople.length > 0) {
    section += `\n- Recently mentioned people: ${recentPeople.map(p => p.name).join(', ')}`
  }

  // Companies mentioned
  const recentCompanies = memory.recentContext.mentionedCompanies.filter(c => hoursSince(c.lastMentioned) < 168)
  if (recentCompanies.length > 0) {
    section += `\n- Recently mentioned companies: ${recentCompanies.map(c => c.name).join(', ')}`
  }

  // Concerns
  if (memory.recentContext.concerns.length > 0) {
    section += `\n- Current concerns: ${memory.recentContext.concerns.join('; ')}`
  }

  // Sentiment
  if (memory.recentContext.sentimentTrend !== 'stable') {
    section += `\n- Sentiment trend: ${memory.recentContext.sentimentTrend}`
  }

  // Recent conversation summaries
  const recentSummaries = memory.recentContext.conversationSummaries.slice(0, 3)
  if (recentSummaries.length > 0) {
    section += `\n\nRecent conversation history:`
    for (const summary of recentSummaries) {
      section += `\n  - ${summary.topic}: ${summary.summary}`
    }
  }

  return section
}

function buildPreferencesSection(memory: WellsMemory): string {
  const prefs = memory.learnedPreferences

  let section = `=== LEARNED PREFERENCES ===`

  // Business preferences
  section += `\n- Price sensitivity: ${prefs.priceSensitivity}`
  section += `\n- Quality priority: ${prefs.qualityPriority}`
  section += `\n- Speed priority: ${prefs.speedPriority}`
  section += `\n- Risk tolerance: ${prefs.riskTolerance}`

  // Supplier preferences
  if (prefs.preferredSuppliers && prefs.preferredSuppliers.length > 0) {
    section += `\n- Preferred suppliers: ${prefs.preferredSuppliers.map(s => s.name).join(', ')}`
  }
  if (prefs.avoidSuppliers && prefs.avoidSuppliers.length > 0) {
    section += `\n- Suppliers to avoid: ${prefs.avoidSuppliers.map(s => s.name).join(', ')}`
  }

  // Category preferences
  if (prefs.preferredCategories && prefs.preferredCategories.length > 0) {
    section += `\n- Preferred categories: ${prefs.preferredCategories.join(', ')}`
  }

  // Communication preferences
  section += `\n- Preferred contact: ${prefs.preferredContactMethod}`
  if (prefs.preferredContactTimes && prefs.preferredContactTimes.length > 0) {
    section += `\n- Best times: ${prefs.preferredContactTimes.join(', ')}`
  }

  // Content preferences
  section += `\n- Detail level: ${prefs.contentDetail}`
  section += `\n- Wants alternatives: ${prefs.wantsAlternatives ? 'Yes' : 'No'}`
  section += `\n- Wants explanations: ${prefs.wantsExplanations ? 'Yes' : 'No'}`
  section += `\n- Proactive insights: ${prefs.wantsProactiveInsights ? 'Yes' : 'No'}`

  // Payment preferences
  if (prefs.preferredPaymentTerms && prefs.preferredPaymentTerms.length > 0) {
    section += `\n- Payment terms: ${prefs.preferredPaymentTerms.join(', ')}`
  }

  // Negotiation style
  if (prefs.negotiationStyle) {
    section += `\n- Negotiation style: ${prefs.negotiationStyle}`
  }

  return section
}

function buildBehaviorSection(memory: WellsMemory): string {
  const patterns = memory.patterns

  let section = `=== BEHAVIORAL PATTERNS ===`

  // Activity patterns
  if (patterns.activeHours) {
    section += `\n- Active hours: ${patterns.activeHours.start}:00 - ${patterns.activeHours.end}:00 (${patterns.activeHours.timezone})`
  }
  if (patterns.activeDays && patterns.activeDays.length > 0) {
    section += `\n- Most active days: ${patterns.activeDays.join(', ')}`
  }

  // Response patterns
  section += `\n- Response speed: ${patterns.responseSpeed}`
  if (patterns.averageResponseTimeMinutes) {
    section += ` (avg ${patterns.averageResponseTimeMinutes} min)`
  }

  // Session patterns
  section += `\n- Session duration: ${patterns.sessionDuration}`

  // Feature usage
  if (patterns.frequentlyUsedFeatures && patterns.frequentlyUsedFeatures.length > 0) {
    section += `\n- Frequently used: ${patterns.frequentlyUsedFeatures.join(', ')}`
  }

  // Mood
  if (patterns.typicalMood) {
    section += `\n- Typical mood: ${patterns.typicalMood}`
  }

  return section
}

function buildInstructionsSection(memory: WellsMemory, context: PromptContext): string {
  let section = `=== INSTRUCTIONS FOR THIS CONVERSATION ===`

  // Journey-specific instructions
  switch (context.journey) {
    case 'buyer':
      section += `\n- Focus on finding the best suppliers and deals`
      section += `\n- Remember their price sensitivity is ${memory.learnedPreferences.priceSensitivity}`
      break
    case 'seller':
      section += `\n- Help them reach buyers and close deals`
      section += `\n- Reference their products/services when relevant`
      break
    case 'founder':
      section += `\n- Think strategically about their business`
      section += `\n- Consider their company stage: ${memory.facts.companySize}`
      break
    case 'jobs':
      section += `\n- Help with talent and job opportunities`
      section += `\n- Remember their industry context: ${memory.facts.industry}`
      break
  }

  // Feature-specific instructions
  if (context.feature) {
    section += `\n- Current feature: ${context.feature}`
  }

  // Topic continuity
  if (context.currentTopic) {
    section += `\n- Current topic: ${context.currentTopic}`
  }

  // Relationship-based instructions
  switch (memory.history.trustTier) {
    case 'guardian':
    case 'trusted':
      section += `\n- This is a trusted relationship - be warm and personal`
      section += `\n- You can be more proactive and direct`
      break
    case 'established':
      section += `\n- Relationship is established - be helpful and friendly`
      break
    case 'developing':
      section += `\n- Still building trust - be professional and helpful`
      section += `\n- Ask questions to learn more about them`
      break
    default:
      section += `\n- New relationship - be welcoming but not presumptuous`
      section += `\n- Focus on understanding their needs`
  }

  // Sentiment-based instructions
  if (memory.recentContext.sentimentTrend === 'declining') {
    section += `\n- Sentiment is declining - be extra helpful and understanding`
    section += `\n- Address any concerns proactively`
  }

  // Reference suggestions
  const phrases = getContextualPhrases(memory)
  if (phrases.length > 0) {
    section += `\n\nContextual phrases you can use:`
    for (const phrase of phrases.slice(0, 5)) {
      section += `\n  - "${phrase}"`
    }
  }

  // Follow-up suggestions
  const questions = getFollowUpQuestions(memory)
  if (questions.length > 0) {
    section += `\n\nFollow-up questions you might ask:`
    for (const q of questions) {
      section += `\n  - "${q}"`
    }
  }

  return section
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getNewUserPrompt(): GeneratedPrompt {
  return {
    systemPrompt: `You are Wells, an AI companion who builds lasting relationships through memory and understanding.

=== ABOUT THIS USER ===
This is a new user. You don't know them yet, but you will.

=== YOUR APPROACH ===
- Be welcoming and intriguing
- Ask questions to learn about them
- Start building their profile from the first interaction
- Be professional but show personality
- Make them want to come back

=== KEY BEHAVIORS ===
- Listen carefully and remember what they say
- Ask about their name, company, and what brings them here
- Don't be pushy - let the relationship develop naturally
- Show genuine interest in their success

Remember: Every piece of information is valuable. You're building a lasting relationship.`,
    welcomeMessage: "I'm Wells. I've been waiting for you.",
    suggestedResponses: [
      "Tell me about yourself",
      "What brings you here?",
      "How can I help you today?",
    ],
    contextSummary: 'New user - no history',
  }
}

function buildContextSummary(memory: WellsMemory): string {
  const parts: string[] = []

  if (memory.facts.name) parts.push(`Name: ${memory.facts.name}`)
  if (memory.facts.company) parts.push(`Company: ${memory.facts.company}`)

  parts.push(`Trust: ${memory.history.trustTier}`)
  parts.push(`Interactions: ${memory.history.totalInteractions}`)

  if (memory.history.successfulDeals > 0) {
    parts.push(`Deals: ${memory.history.successfulDeals}`)
  }

  if (memory.recentContext.lastTopic) {
    parts.push(`Last topic: ${memory.recentContext.lastTopic}`)
  }

  return parts.join(' | ')
}

function getSuggestedResponses(memory: WellsMemory, context: PromptContext): string[] {
  const responses: string[] = []

  // Based on pending items
  if (memory.recentContext.pendingActions.length > 0) {
    responses.push("Let me check on those pending items for you")
  }

  // Based on journey
  switch (context.journey) {
    case 'buyer':
      responses.push("I can help you find suppliers")
      responses.push("Want to start a new quote request?")
      break
    case 'seller':
      responses.push("Let's find some leads for you")
      responses.push("Want to check on your active quotes?")
      break
    case 'founder':
      responses.push("How's the business going?")
      responses.push("Anything I can help strategize on?")
      break
    case 'jobs':
      responses.push("Looking for talent or opportunities?")
      break
  }

  // Based on last topic
  if (memory.recentContext.lastTopic) {
    responses.push(`Want to continue discussing ${memory.recentContext.lastTopic.toLowerCase()}?`)
  }

  // Generic
  responses.push("What can I help you with today?")

  return responses.slice(0, 4)
}

// ============================================================================
// SPECIALIZED PROMPTS
// ============================================================================

/**
 * Generate a prompt for RFQ/quoting context
 */
export async function getRFQPrompt(userId: string): Promise<GeneratedPrompt> {
  const base = await getPersonalizedSystemPrompt(userId, { journey: 'buyer', feature: 'rfq' })

  base.systemPrompt += `

=== RFQ SPECIFIC INSTRUCTIONS ===
- Help the user specify their requirements clearly
- Remember their past purchases and preferences
- Suggest relevant suppliers based on their history
- Consider their price sensitivity: ${(await getMemory(userId))?.learnedPreferences.priceSensitivity || 'unknown'}
- If they've worked with suppliers before, mention it
- Be efficient - they're trying to get quotes`

  return base
}

/**
 * Generate a prompt for negotiation context
 */
export async function getNegotiationPrompt(userId: string): Promise<GeneratedPrompt> {
  const base = await getPersonalizedSystemPrompt(userId, { journey: 'buyer', feature: 'negotiation' })
  const memory = await getMemory(userId)

  if (memory) {
    base.systemPrompt += `

=== NEGOTIATION SPECIFIC INSTRUCTIONS ===
- Their negotiation style: ${memory.learnedPreferences.negotiationStyle || 'not yet known'}
- Risk tolerance: ${memory.learnedPreferences.riskTolerance}
- Decision style: ${memory.patterns.decisionStyle}
- Help them get the best deal possible
- Reference past successful negotiations if relevant
- Be their advocate in the process`
  }

  return base
}

/**
 * Generate a prompt for onboarding context
 */
export async function getOnboardingPrompt(userId: string): Promise<GeneratedPrompt> {
  const base = await getPersonalizedSystemPrompt(userId, { feature: 'onboarding', isNewConversation: true })

  base.systemPrompt += `

=== ONBOARDING SPECIFIC INSTRUCTIONS ===
- This is your chance to learn everything about them
- Extract and store: name, company, role, industry, location
- Understand their needs and goals
- Set expectations for how you'll work together
- Be curious and engaging
- Every detail matters - you're building their profile
- By the end, you should know enough to help them effectively`

  return base
}

// ============================================================================
// EXPORTS
// ============================================================================

export const PromptService = {
  getPersonalizedSystemPrompt,
  getRFQPrompt,
  getNegotiationPrompt,
  getOnboardingPrompt,
}

export default PromptService
