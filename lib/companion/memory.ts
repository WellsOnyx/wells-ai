// @ts-nocheck
/**
 * Wells AI Deep Memory System
 *
 * "I will remember my covenant between me and you and all living creatures."
 * - Genesis 9:15
 *
 * Wells remembers everything important about you - your communication style,
 * your past deals, your preferences, your relationships, your goals.
 * Like a trusted friend who never forgets.
 */

import Anthropic from '@anthropic-ai/sdk'
import { query } from '@/lib/db'
import { getWellsMemory, updateWellsMemory, learnFact, WellsMemory } from '@/lib/wells-memory'

// ============================================================================
// TYPES
// ============================================================================

export interface DeepMemory {
  userId: string

  // Communication Style
  communicationStyle: CommunicationStyle

  // Deal History
  dealHistory: DealMemory[]

  // Preferences
  preferences: UserPreferences

  // Relationships
  relationships: RelationshipMemory[]

  // Important Dates
  importantDates: DateMemory[]

  // Goals & Progress
  goals: GoalMemory[]

  // Conversation Context
  conversationContext: ConversationContext[]

  // Learning & Adaptation
  learnings: WellsLearning[]

  // Last updated
  lastUpdated: Date
}

export interface CommunicationStyle {
  formality: 'very_formal' | 'formal' | 'professional' | 'casual' | 'very_casual'
  verbosity: 'very_concise' | 'concise' | 'balanced' | 'detailed' | 'very_detailed'
  tone: 'analytical' | 'direct' | 'encouraging' | 'friendly' | 'professional'
  preferredGreeting?: string
  signatureStyle?: string
  humorAppreciation: number // 0-100
  emojiUsage: 'never' | 'rare' | 'sometimes' | 'often'
  responseTimePreference: 'immediate' | 'thoughtful' | 'no_preference'
  languageComplexity: 'simple' | 'moderate' | 'sophisticated'

  // Learned patterns
  commonPhrases: string[]
  topicPreferences: string[]
  avoidTopics: string[]
}

export interface DealMemory {
  id: string
  title: string
  type: 'purchase' | 'sale' | 'negotiation' | 'contract' | 'job'
  counterparty: string
  value: number
  outcome: 'won' | 'lost' | 'pending' | 'cancelled'
  startDate: Date
  endDate?: Date
  keyLessons: string[]
  userSatisfaction?: number // 1-5
  wellsContribution: string
  tags: string[]
}

export interface UserPreferences {
  // Business preferences
  preferredSupplierTypes: string[]
  avoidedSupplierTypes: string[]
  priceVsQuality: number // 0 = price focused, 100 = quality focused
  riskTolerance: 'conservative' | 'moderate' | 'aggressive'
  decisionStyle: 'data_driven' | 'gut_instinct' | 'collaborative' | 'deliberate'

  // Notification preferences
  bestTimeToReach: string[] // e.g., ['morning', 'afternoon']
  urgentContactMethod: 'sms' | 'email' | 'slack' | 'in_app'
  digestFrequency: 'realtime' | 'daily' | 'weekly'

  // Interaction preferences
  likesDetailedExplanations: boolean
  wantsAlternatives: boolean
  appreciatesProactivity: number // 0-100
  valuesCelebrations: boolean

  // Work style
  busyDays: string[] // e.g., ['Monday', 'Wednesday']
  preferredMeetingTimes: string[]
  timezone: string
}

export interface RelationshipMemory {
  id: string
  name: string
  company?: string
  role?: string
  type: 'customer' | 'supplier' | 'partner' | 'colleague' | 'investor' | 'mentor' | 'friend'

  // Relationship history
  firstContact: Date
  lastContact: Date
  contactCount: number

  // Context
  howMet?: string
  sharedDeals: string[] // deal IDs
  notes: string[]

  // Relationship health
  health: 'excellent' | 'good' | 'needs_attention' | 'at_risk'
  lastHealthCheck: Date
  healthFactors: string[]

  // Important details
  importantFacts: string[]
  preferences?: {
    communicationStyle?: string
    interests?: string[]
    avoidTopics?: string[]
  }
}

export interface DateMemory {
  id: string
  date: Date
  title: string
  type: 'contract_renewal' | 'deadline' | 'birthday' | 'anniversary' | 'milestone' | 'follow_up' | 'custom'
  recurring: boolean
  recurringPattern?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  reminderDays: number[]
  relatedTo?: {
    type: 'deal' | 'relationship' | 'goal'
    id: string
    name: string
  }
  notes?: string
  importance: 'critical' | 'high' | 'medium' | 'low'
}

export interface GoalMemory {
  id: string
  title: string
  description: string
  category: 'revenue' | 'savings' | 'efficiency' | 'growth' | 'personal' | 'learning'

  // Target
  targetValue?: number
  targetUnit?: string
  deadline?: Date

  // Progress
  currentValue: number
  progress: number // 0-100
  milestones: GoalMilestone[]

  // Wells involvement
  wellsContributions: string[]
  blockers: string[]
  nextSteps: string[]

  // Status
  status: 'active' | 'completed' | 'abandoned' | 'paused'
  createdAt: Date
  completedAt?: Date

  // Reflection
  lessonsLearned?: string[]
  userReflection?: string
}

export interface GoalMilestone {
  id: string
  title: string
  targetDate?: Date
  completed: boolean
  completedAt?: Date
  celebrationMessage?: string
}

export interface ConversationContext {
  id: string
  date: Date
  topic: string
  summary: string

  // Key points
  userIntent: string
  outcome?: string
  decisions: string[]

  // Follow-up
  openQuestions: string[]
  actionItems: string[]
  followUpDate?: Date

  // Sentiment
  userSentiment: 'positive' | 'neutral' | 'frustrated' | 'confused'
  resolutionStatus: 'resolved' | 'ongoing' | 'needs_attention'

  // Learning
  learnedPreferences: string[]
  learnedFacts: string[]
}

export interface WellsLearning {
  id: string
  category: 'preference' | 'behavior' | 'feedback' | 'outcome'
  description: string
  confidence: number // 0-100
  source: 'explicit' | 'inferred' | 'observed'
  learnedAt: Date
  validatedAt?: Date
  appliedCount: number
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// MEMORY RETRIEVAL
// ============================================================================

/**
 * Get complete deep memory for a user
 */
export async function getDeepMemory(userId: string): Promise<DeepMemory | null> {
  try {
    const [
      communicationStyle,
      dealHistory,
      preferences,
      relationships,
      importantDates,
      goals,
      conversationContext,
      learnings,
    ] = await Promise.all([
      getCommunicationStyle(userId),
      getDealHistory(userId),
      getPreferences(userId),
      getRelationships(userId),
      getImportantDates(userId),
      getGoals(userId),
      getConversationContext(userId),
      getLearnings(userId),
    ])

    return {
      userId,
      communicationStyle,
      dealHistory,
      preferences,
      relationships,
      importantDates,
      goals,
      conversationContext,
      learnings,
      lastUpdated: new Date(),
    }
  } catch (error) {
    console.error('[DeepMemory] Error getting deep memory:', error)
    return null
  }
}

/**
 * Get communication style
 */
export async function getCommunicationStyle(userId: string): Promise<CommunicationStyle> {
  const defaultStyle: CommunicationStyle = {
    formality: 'professional',
    verbosity: 'balanced',
    tone: 'friendly',
    humorAppreciation: 50,
    emojiUsage: 'rare',
    responseTimePreference: 'no_preference',
    languageComplexity: 'moderate',
    commonPhrases: [],
    topicPreferences: [],
    avoidTopics: [],
  }

  try {
    const result = await query(
      `SELECT communication_style FROM user_deep_memory WHERE user_id = $1`,
      [userId]
    )

    if (result.rows.length === 0) return defaultStyle
    return { ...defaultStyle, ...result.rows[0].communication_style }
  } catch (error) {
    console.error('[DeepMemory] Error getting communication style:', error)
    return defaultStyle
  }
}

/**
 * Get deal history
 */
export async function getDealHistory(userId: string): Promise<DealMemory[]> {
  try {
    const result = await query(
      `SELECT * FROM deal_memories
       WHERE user_id = $1
       ORDER BY end_date DESC NULLS FIRST, start_date DESC
       LIMIT 100`,
      [userId]
    )

    return result.rows.map(rowToDealMemory)
  } catch (error) {
    console.error('[DeepMemory] Error getting deal history:', error)
    return []
  }
}

/**
 * Get user preferences
 */
export async function getPreferences(userId: string): Promise<UserPreferences> {
  const defaultPrefs: UserPreferences = {
    preferredSupplierTypes: [],
    avoidedSupplierTypes: [],
    priceVsQuality: 50,
    riskTolerance: 'moderate',
    decisionStyle: 'data_driven',
    bestTimeToReach: ['morning'],
    urgentContactMethod: 'in_app',
    digestFrequency: 'daily',
    likesDetailedExplanations: true,
    wantsAlternatives: true,
    appreciatesProactivity: 70,
    valuesCelebrations: true,
    busyDays: [],
    preferredMeetingTimes: [],
    timezone: 'America/New_York',
  }

  try {
    const result = await query(
      `SELECT preferences FROM user_deep_memory WHERE user_id = $1`,
      [userId]
    )

    if (result.rows.length === 0) return defaultPrefs
    return { ...defaultPrefs, ...result.rows[0].preferences }
  } catch (error) {
    console.error('[DeepMemory] Error getting preferences:', error)
    return defaultPrefs
  }
}

/**
 * Get relationships
 */
export async function getRelationships(userId: string): Promise<RelationshipMemory[]> {
  try {
    const result = await query(
      `SELECT * FROM relationship_memories
       WHERE user_id = $1
       ORDER BY last_contact DESC
       LIMIT 100`,
      [userId]
    )

    return result.rows.map(rowToRelationshipMemory)
  } catch (error) {
    console.error('[DeepMemory] Error getting relationships:', error)
    return []
  }
}

/**
 * Get important dates
 */
export async function getImportantDates(userId: string): Promise<DateMemory[]> {
  try {
    const result = await query(
      `SELECT * FROM date_memories
       WHERE user_id = $1
       ORDER BY date ASC`,
      [userId]
    )

    return result.rows.map(rowToDateMemory)
  } catch (error) {
    console.error('[DeepMemory] Error getting important dates:', error)
    return []
  }
}

/**
 * Get goals
 */
export async function getGoals(userId: string): Promise<GoalMemory[]> {
  try {
    const result = await query(
      `SELECT * FROM goal_memories
       WHERE user_id = $1
       ORDER BY
         CASE status
           WHEN 'active' THEN 0
           WHEN 'paused' THEN 1
           ELSE 2
         END,
         deadline ASC NULLS LAST`,
      [userId]
    )

    return result.rows.map(rowToGoalMemory)
  } catch (error) {
    console.error('[DeepMemory] Error getting goals:', error)
    return []
  }
}

/**
 * Get conversation context
 */
export async function getConversationContext(userId: string, limit: number = 20): Promise<ConversationContext[]> {
  try {
    const result = await query(
      `SELECT * FROM conversation_contexts
       WHERE user_id = $1
       ORDER BY date DESC
       LIMIT $2`,
      [userId, limit]
    )

    return result.rows.map(rowToConversationContext)
  } catch (error) {
    console.error('[DeepMemory] Error getting conversation context:', error)
    return []
  }
}

/**
 * Get learnings
 */
export async function getLearnings(userId: string): Promise<WellsLearning[]> {
  try {
    const result = await query(
      `SELECT * FROM wells_learnings
       WHERE user_id = $1
       ORDER BY confidence DESC, learned_at DESC
       LIMIT 50`,
      [userId]
    )

    return result.rows.map(rowToLearning)
  } catch (error) {
    console.error('[DeepMemory] Error getting learnings:', error)
    return []
  }
}

// ============================================================================
// MEMORY STORAGE
// ============================================================================

/**
 * Learn from a conversation and update memory
 */
export async function learnFromConversation(
  userId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  topic?: string
): Promise<void> {
  try {
    const userMessages = messages.filter((m) => m.role === 'user').map((m) => m.content)

    if (userMessages.length < 2) return

    // Use AI to extract learnings
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Analyze this conversation and extract learnings about the user. Return JSON with:
{
  "communicationInsights": {
    "formality": "formal" | "professional" | "casual",
    "verbosity": "concise" | "balanced" | "detailed",
    "tone": "analytical" | "direct" | "friendly",
    "usesEmoji": boolean,
    "commonPhrases": string[]
  },
  "preferencesLearned": string[],
  "factsLearned": string[],
  "topicsCovered": string[],
  "userSentiment": "positive" | "neutral" | "frustrated",
  "followUpNeeded": boolean,
  "openQuestions": string[],
  "summary": string
}

Conversation:
${userMessages.join('\n---\n')}

Return ONLY valid JSON:`,
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return

    const analysis = JSON.parse(textBlock.text)

    // Update communication style
    if (analysis.communicationInsights) {
      await updateCommunicationStyle(userId, analysis.communicationInsights)
    }

    // Store conversation context
    await storeConversationContext(userId, {
      topic: topic || analysis.topicsCovered?.[0] || 'General',
      summary: analysis.summary,
      userSentiment: analysis.userSentiment,
      openQuestions: analysis.openQuestions || [],
      followUpNeeded: analysis.followUpNeeded,
    })

    // Store learned facts
    for (const fact of analysis.factsLearned || []) {
      await recordLearning(userId, {
        category: 'behavior',
        description: fact,
        confidence: 70,
        source: 'inferred',
      })
    }

    // Store preferences
    for (const pref of analysis.preferencesLearned || []) {
      await recordLearning(userId, {
        category: 'preference',
        description: pref,
        confidence: 60,
        source: 'inferred',
      })
    }
  } catch (error) {
    console.error('[DeepMemory] Error learning from conversation:', error)
  }
}

/**
 * Update communication style
 */
export async function updateCommunicationStyle(
  userId: string,
  updates: Partial<CommunicationStyle>
): Promise<void> {
  try {
    const current = await getCommunicationStyle(userId)
    const updated = { ...current, ...updates }

    await query(
      `INSERT INTO user_deep_memory (user_id, communication_style, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         communication_style = $2,
         updated_at = NOW()`,
      [userId, JSON.stringify(updated)]
    )
  } catch (error) {
    console.error('[DeepMemory] Error updating communication style:', error)
  }
}

/**
 * Store a deal memory
 */
export async function storeDealMemory(
  userId: string,
  deal: Omit<DealMemory, 'id'>
): Promise<string> {
  const dealId = `deal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    await query(
      `INSERT INTO deal_memories (
        id, user_id, title, type, counterparty, value, outcome,
        start_date, end_date, key_lessons, user_satisfaction, wells_contribution, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        dealId,
        userId,
        deal.title,
        deal.type,
        deal.counterparty,
        deal.value,
        deal.outcome,
        deal.startDate,
        deal.endDate,
        deal.keyLessons,
        deal.userSatisfaction,
        deal.wellsContribution,
        deal.tags,
      ]
    )

    return dealId
  } catch (error) {
    console.error('[DeepMemory] Error storing deal memory:', error)
    return dealId
  }
}

/**
 * Store or update a relationship
 */
export async function storeRelationship(
  userId: string,
  relationship: Omit<RelationshipMemory, 'id'>
): Promise<string> {
  const relId = `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    await query(
      `INSERT INTO relationship_memories (
        id, user_id, name, company, role, type, first_contact, last_contact,
        contact_count, how_met, shared_deals, notes, health, last_health_check,
        health_factors, important_facts, preferences
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (user_id, name) DO UPDATE SET
        company = EXCLUDED.company,
        role = EXCLUDED.role,
        last_contact = EXCLUDED.last_contact,
        contact_count = relationship_memories.contact_count + 1,
        notes = EXCLUDED.notes,
        health = EXCLUDED.health,
        last_health_check = NOW()`,
      [
        relId,
        userId,
        relationship.name,
        relationship.company,
        relationship.role,
        relationship.type,
        relationship.firstContact,
        relationship.lastContact,
        relationship.contactCount,
        relationship.howMet,
        relationship.sharedDeals,
        relationship.notes,
        relationship.health,
        new Date(),
        relationship.healthFactors,
        relationship.importantFacts,
        relationship.preferences ? JSON.stringify(relationship.preferences) : null,
      ]
    )

    return relId
  } catch (error) {
    console.error('[DeepMemory] Error storing relationship:', error)
    return relId
  }
}

/**
 * Store an important date
 */
export async function storeImportantDate(
  userId: string,
  date: Omit<DateMemory, 'id'>
): Promise<string> {
  const dateId = `date_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    await query(
      `INSERT INTO date_memories (
        id, user_id, date, title, type, recurring, recurring_pattern,
        reminder_days, related_to, notes, importance
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        dateId,
        userId,
        date.date,
        date.title,
        date.type,
        date.recurring,
        date.recurringPattern,
        date.reminderDays,
        date.relatedTo ? JSON.stringify(date.relatedTo) : null,
        date.notes,
        date.importance,
      ]
    )

    return dateId
  } catch (error) {
    console.error('[DeepMemory] Error storing important date:', error)
    return dateId
  }
}

/**
 * Store a goal
 */
export async function storeGoal(
  userId: string,
  goal: Omit<GoalMemory, 'id' | 'createdAt'>
): Promise<string> {
  const goalId = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    await query(
      `INSERT INTO goal_memories (
        id, user_id, title, description, category, target_value, target_unit,
        deadline, current_value, progress, milestones, wells_contributions,
        blockers, next_steps, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())`,
      [
        goalId,
        userId,
        goal.title,
        goal.description,
        goal.category,
        goal.targetValue,
        goal.targetUnit,
        goal.deadline,
        goal.currentValue,
        goal.progress,
        JSON.stringify(goal.milestones),
        goal.wellsContributions,
        goal.blockers,
        goal.nextSteps,
        goal.status,
      ]
    )

    return goalId
  } catch (error) {
    console.error('[DeepMemory] Error storing goal:', error)
    return goalId
  }
}

/**
 * Store conversation context
 */
export async function storeConversationContext(
  userId: string,
  context: Partial<ConversationContext>
): Promise<void> {
  const contextId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    await query(
      `INSERT INTO conversation_contexts (
        id, user_id, date, topic, summary, user_intent, outcome,
        decisions, open_questions, action_items, follow_up_date,
        user_sentiment, resolution_status, learned_preferences, learned_facts
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        contextId,
        userId,
        context.topic,
        context.summary,
        context.userIntent,
        context.outcome,
        context.decisions || [],
        context.openQuestions || [],
        context.actionItems || [],
        context.followUpDate,
        context.userSentiment || 'neutral',
        context.resolutionStatus || 'resolved',
        context.learnedPreferences || [],
        context.learnedFacts || [],
      ]
    )
  } catch (error) {
    console.error('[DeepMemory] Error storing conversation context:', error)
  }
}

/**
 * Record a learning
 */
export async function recordLearning(
  userId: string,
  learning: Omit<WellsLearning, 'id' | 'learnedAt' | 'appliedCount'>
): Promise<void> {
  const learningId = `learn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    await query(
      `INSERT INTO wells_learnings (
        id, user_id, category, description, confidence, source, learned_at, applied_count
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 0)
      ON CONFLICT (user_id, description) DO UPDATE SET
        confidence = GREATEST(wells_learnings.confidence, EXCLUDED.confidence),
        validated_at = CASE WHEN EXCLUDED.confidence > 80 THEN NOW() ELSE wells_learnings.validated_at END`,
      [
        learningId,
        userId,
        learning.category,
        learning.description,
        learning.confidence,
        learning.source,
      ]
    )
  } catch (error) {
    console.error('[DeepMemory] Error recording learning:', error)
  }
}

// ============================================================================
// MEMORY RECALL
// ============================================================================

/**
 * Recall relevant memories for a given context
 */
export async function recallRelevantMemories(
  userId: string,
  context: {
    topic?: string
    entity?: string
    timeframe?: 'recent' | 'all'
    type?: 'deals' | 'relationships' | 'goals' | 'conversations'
  }
): Promise<{
  relevantDeals: DealMemory[]
  relevantRelationships: RelationshipMemory[]
  relevantGoals: GoalMemory[]
  relevantConversations: ConversationContext[]
  relevantLearnings: WellsLearning[]
}> {
  const timeLimit = context.timeframe === 'recent' ? 90 : 365 // days

  try {
    const results = await Promise.all([
      context.type === 'deals' || !context.type
        ? query(
            `SELECT * FROM deal_memories
             WHERE user_id = $1
               AND ($2::text IS NULL OR title ILIKE '%' || $2 || '%' OR counterparty ILIKE '%' || $2 || '%')
               AND start_date > NOW() - INTERVAL '${timeLimit} days'
             ORDER BY start_date DESC
             LIMIT 10`,
            [userId, context.topic]
          )
        : Promise.resolve({ rows: [] }),

      context.type === 'relationships' || !context.type
        ? query(
            `SELECT * FROM relationship_memories
             WHERE user_id = $1
               AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%' OR company ILIKE '%' || $2 || '%')
             ORDER BY last_contact DESC
             LIMIT 10`,
            [userId, context.entity]
          )
        : Promise.resolve({ rows: [] }),

      context.type === 'goals' || !context.type
        ? query(
            `SELECT * FROM goal_memories
             WHERE user_id = $1 AND status = 'active'
               AND ($2::text IS NULL OR title ILIKE '%' || $2 || '%')
             ORDER BY deadline ASC NULLS LAST
             LIMIT 5`,
            [userId, context.topic]
          )
        : Promise.resolve({ rows: [] }),

      context.type === 'conversations' || !context.type
        ? query(
            `SELECT * FROM conversation_contexts
             WHERE user_id = $1
               AND ($2::text IS NULL OR topic ILIKE '%' || $2 || '%' OR summary ILIKE '%' || $2 || '%')
               AND date > NOW() - INTERVAL '${timeLimit} days'
             ORDER BY date DESC
             LIMIT 10`,
            [userId, context.topic]
          )
        : Promise.resolve({ rows: [] }),

      query(
        `SELECT * FROM wells_learnings
         WHERE user_id = $1 AND confidence >= 60
         ORDER BY confidence DESC, applied_count DESC
         LIMIT 20`,
        [userId]
      ),
    ])

    return {
      relevantDeals: results[0].rows.map(rowToDealMemory),
      relevantRelationships: results[1].rows.map(rowToRelationshipMemory),
      relevantGoals: results[2].rows.map(rowToGoalMemory),
      relevantConversations: results[3].rows.map(rowToConversationContext),
      relevantLearnings: results[4].rows.map(rowToLearning),
    }
  } catch (error) {
    console.error('[DeepMemory] Error recalling memories:', error)
    return {
      relevantDeals: [],
      relevantRelationships: [],
      relevantGoals: [],
      relevantConversations: [],
      relevantLearnings: [],
    }
  }
}

/**
 * Get memory summary for chat context
 */
export async function getMemorySummaryForChat(userId: string): Promise<string> {
  try {
    const memory = await getDeepMemory(userId)
    if (!memory) return ''

    const lines: string[] = []

    // Communication style
    lines.push(`=== USER COMMUNICATION STYLE ===`)
    lines.push(`Formality: ${memory.communicationStyle.formality}`)
    lines.push(`Tone preference: ${memory.communicationStyle.tone}`)
    lines.push(`Detail level: ${memory.communicationStyle.verbosity}`)
    if (memory.communicationStyle.commonPhrases.length > 0) {
      lines.push(`Common phrases: ${memory.communicationStyle.commonPhrases.slice(0, 3).join(', ')}`)
    }

    // Active goals
    const activeGoals = memory.goals.filter((g) => g.status === 'active')
    if (activeGoals.length > 0) {
      lines.push('')
      lines.push(`=== ACTIVE GOALS ===`)
      activeGoals.slice(0, 3).forEach((goal) => {
        lines.push(`- ${goal.title} (${goal.progress}% complete)`)
      })
    }

    // Recent deals
    const recentDeals = memory.dealHistory.slice(0, 3)
    if (recentDeals.length > 0) {
      lines.push('')
      lines.push(`=== RECENT DEAL HISTORY ===`)
      recentDeals.forEach((deal) => {
        lines.push(`- ${deal.title} with ${deal.counterparty}: ${deal.outcome} ($${deal.value.toLocaleString()})`)
      })
    }

    // Key relationships
    const keyRelationships = memory.relationships.filter((r) => r.health !== 'at_risk').slice(0, 5)
    if (keyRelationships.length > 0) {
      lines.push('')
      lines.push(`=== KEY RELATIONSHIPS ===`)
      keyRelationships.forEach((rel) => {
        lines.push(`- ${rel.name} (${rel.type}${rel.company ? ` at ${rel.company}` : ''})`)
      })
    }

    // Upcoming dates
    const upcomingDates = memory.importantDates
      .filter((d) => d.date > new Date())
      .slice(0, 3)
    if (upcomingDates.length > 0) {
      lines.push('')
      lines.push(`=== UPCOMING DATES ===`)
      upcomingDates.forEach((date) => {
        lines.push(`- ${date.date.toLocaleDateString()}: ${date.title}`)
      })
    }

    // Learnings to apply
    const highConfidenceLearnings = memory.learnings.filter((l) => l.confidence >= 80).slice(0, 5)
    if (highConfidenceLearnings.length > 0) {
      lines.push('')
      lines.push(`=== WHAT I KNOW ABOUT THIS USER ===`)
      highConfidenceLearnings.forEach((learning) => {
        lines.push(`- ${learning.description}`)
      })
    }

    return lines.join('\n')
  } catch (error) {
    console.error('[DeepMemory] Error getting memory summary:', error)
    return ''
  }
}

/**
 * Find past conversation about a topic
 */
export async function findPastConversation(
  userId: string,
  topic: string
): Promise<ConversationContext | null> {
  try {
    const result = await query(
      `SELECT * FROM conversation_contexts
       WHERE user_id = $1
         AND (topic ILIKE '%' || $2 || '%' OR summary ILIKE '%' || $2 || '%')
       ORDER BY date DESC
       LIMIT 1`,
      [userId, topic]
    )

    if (result.rows.length === 0) return null
    return rowToConversationContext(result.rows[0])
  } catch (error) {
    console.error('[DeepMemory] Error finding past conversation:', error)
    return null
  }
}

// ============================================================================
// ROW CONVERTERS
// ============================================================================

function rowToDealMemory(row: any): DealMemory {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    counterparty: row.counterparty,
    value: parseFloat(row.value),
    outcome: row.outcome,
    startDate: new Date(row.start_date),
    endDate: row.end_date ? new Date(row.end_date) : undefined,
    keyLessons: row.key_lessons || [],
    userSatisfaction: row.user_satisfaction,
    wellsContribution: row.wells_contribution,
    tags: row.tags || [],
  }
}

function rowToRelationshipMemory(row: any): RelationshipMemory {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    role: row.role,
    type: row.type,
    firstContact: new Date(row.first_contact),
    lastContact: new Date(row.last_contact),
    contactCount: row.contact_count,
    howMet: row.how_met,
    sharedDeals: row.shared_deals || [],
    notes: row.notes || [],
    health: row.health,
    lastHealthCheck: new Date(row.last_health_check),
    healthFactors: row.health_factors || [],
    importantFacts: row.important_facts || [],
    preferences: row.preferences,
  }
}

function rowToDateMemory(row: any): DateMemory {
  return {
    id: row.id,
    date: new Date(row.date),
    title: row.title,
    type: row.type,
    recurring: row.recurring,
    recurringPattern: row.recurring_pattern,
    reminderDays: row.reminder_days || [],
    relatedTo: row.related_to,
    notes: row.notes,
    importance: row.importance,
  }
}

function rowToGoalMemory(row: any): GoalMemory {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    targetValue: row.target_value,
    targetUnit: row.target_unit,
    deadline: row.deadline ? new Date(row.deadline) : undefined,
    currentValue: row.current_value || 0,
    progress: row.progress || 0,
    milestones: row.milestones || [],
    wellsContributions: row.wells_contributions || [],
    blockers: row.blockers || [],
    nextSteps: row.next_steps || [],
    status: row.status,
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    lessonsLearned: row.lessons_learned,
    userReflection: row.user_reflection,
  }
}

function rowToConversationContext(row: any): ConversationContext {
  return {
    id: row.id,
    date: new Date(row.date),
    topic: row.topic,
    summary: row.summary,
    userIntent: row.user_intent,
    outcome: row.outcome,
    decisions: row.decisions || [],
    openQuestions: row.open_questions || [],
    actionItems: row.action_items || [],
    followUpDate: row.follow_up_date ? new Date(row.follow_up_date) : undefined,
    userSentiment: row.user_sentiment,
    resolutionStatus: row.resolution_status,
    learnedPreferences: row.learned_preferences || [],
    learnedFacts: row.learned_facts || [],
  }
}

function rowToLearning(row: any): WellsLearning {
  return {
    id: row.id,
    category: row.category,
    description: row.description,
    confidence: row.confidence,
    source: row.source,
    learnedAt: new Date(row.learned_at),
    validatedAt: row.validated_at ? new Date(row.validated_at) : undefined,
    appliedCount: row.applied_count,
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const DeepMemoryService = {
  getDeepMemory,
  getCommunicationStyle,
  getDealHistory,
  getPreferences,
  getRelationships,
  getImportantDates,
  getGoals,
  getConversationContext,
  getLearnings,
  learnFromConversation,
  updateCommunicationStyle,
  storeDealMemory,
  storeRelationship,
  storeImportantDate,
  storeGoal,
  storeConversationContext,
  recordLearning,
  recallRelevantMemories,
  getMemorySummaryForChat,
  findPastConversation,
}

export default DeepMemoryService
