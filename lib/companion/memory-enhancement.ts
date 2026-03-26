// @ts-nocheck
/**
 * Wells AI Memory Enhancement System
 *
 * "A friend loves at all times, and a brother is born for adversity." - Proverbs 17:17
 *
 * This module extends the existing wells-memory.ts to create deep user memory
 * that enables Wells to act as a true companion - remembering past conversations,
 * learning preferences, adapting personality, and building trust over time.
 */

import Anthropic from '@anthropic-ai/sdk'
import { query } from '@/lib/db'
import {
  getWellsMemory,
  updateWellsMemory,
  learnFact,
  WellsMemory,
  LearnedFact,
  ProductType,
} from '@/lib/wells-memory'

// ============================================================================
// TYPES
// ============================================================================

export type CommunicationPreference = {
  formality: 'formal' | 'casual' | 'professional'
  verbosity: 'concise' | 'moderate' | 'detailed'
  tone: 'encouraging' | 'direct' | 'analytical' | 'friendly'
  preferredGreeting?: string
  avoidTopics?: string[]
  preferredChannels: ('chat' | 'email' | 'sms' | 'slack')[]
}

export type UserGoal = {
  id: string
  description: string
  category: 'revenue' | 'cost_savings' | 'efficiency' | 'growth' | 'career' | 'personal'
  targetValue?: number
  targetUnit?: string
  deadline?: Date
  progress: number
  milestones: GoalMilestone[]
  createdAt: Date
  updatedAt: Date
  completed: boolean
  completedAt?: Date
}

export type GoalMilestone = {
  id: string
  description: string
  targetDate?: Date
  completed: boolean
  completedAt?: Date
}

export type ConversationReference = {
  id: string
  date: Date
  topic: string
  summary: string
  outcome?: string
  followUpNeeded: boolean
  followUpDate?: Date
  relatedGoals?: string[]
}

export type TrustLevel = {
  score: number // 0-100
  tier: 'new' | 'developing' | 'trusted' | 'partner'
  factors: {
    interactionCount: number
    successfulDeals: number
    moneySaved: number
    moneyEarned: number
    insightsActedUpon: number
    insightsDismissed: number
    autonomyGranted: AutonomyLevel
    daysSinceFirstInteraction: number
  }
  lastUpdated: Date
}

export type AutonomyLevel = {
  autoNegotiate: boolean
  autoApproveThreshold: number // Auto-approve deals under this amount
  autoRespondToRfqs: boolean
  autoApplyToJobs: boolean
  proactiveOutreach: boolean
  approvalRequiredFor: string[]
}

export type EnhancedMemory = WellsMemory & {
  communicationPreference: CommunicationPreference
  goals: UserGoal[]
  conversationReferences: ConversationReference[]
  trustLevel: TrustLevel
  personalityAdaptation: PersonalityAdaptation
  importantDates: ImportantDate[]
  relationships: UserRelationship[]
}

export type PersonalityAdaptation = {
  mirrorsUserStyle: boolean
  humorLevel: 'none' | 'light' | 'moderate'
  emojiUsage: 'never' | 'minimal' | 'moderate'
  responseLength: 'brief' | 'standard' | 'thorough'
  proactivityLevel: 'low' | 'medium' | 'high'
  celebrateSuccesses: boolean
  offerEncouragement: boolean
}

export type ImportantDate = {
  id: string
  date: Date
  description: string
  type: 'birthday' | 'anniversary' | 'deadline' | 'renewal' | 'custom'
  reminderDays: number[]
  recurring: boolean
  lastNotified?: Date
}

export type UserRelationship = {
  id: string
  name: string
  type: 'customer' | 'supplier' | 'partner' | 'colleague' | 'investor' | 'other'
  company?: string
  notes: string
  lastInteraction?: Date
  interactionCount: number
  sentiment: 'positive' | 'neutral' | 'needs_attention'
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// COMMUNICATION PREFERENCES
// ============================================================================

/**
 * Analyze user messages to learn communication preferences
 */
export async function learnCommunicationStyle(
  userId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<CommunicationPreference | null> {
  try {
    const userMessages = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join('\n---\n')

    if (userMessages.length < 100) {
      return null
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Analyze these user messages and determine their communication preferences. Return JSON with:
- formality: "formal" | "casual" | "professional"
- verbosity: "concise" | "moderate" | "detailed"
- tone: "encouraging" | "direct" | "analytical" | "friendly"
- preferredGreeting: string or null (if they use a specific greeting)
- humorAppreciated: boolean
- emojiUsage: "never" | "minimal" | "moderate"

User messages:
${userMessages}

Return ONLY valid JSON, no explanation:`,
        },
      ],
    })

    const textBlock = response.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return null

    const analysis = JSON.parse(textBlock.text)

    const preference: CommunicationPreference = {
      formality: analysis.formality || 'professional',
      verbosity: analysis.verbosity || 'moderate',
      tone: analysis.tone || 'friendly',
      preferredGreeting: analysis.preferredGreeting,
      preferredChannels: ['chat'],
    }

    // Store the learned preference
    await storeCommunicationPreference(userId, preference)

    return preference
  } catch (error) {
    console.error('[MemoryEnhancement] Error learning communication style:', error)
    return null
  }
}

/**
 * Store communication preference
 */
async function storeCommunicationPreference(
  userId: string,
  preference: CommunicationPreference
): Promise<void> {
  try {
    await query(
      `INSERT INTO user_communication_preferences (user_id, preferences, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         preferences = $2,
         updated_at = NOW()`,
      [userId, JSON.stringify(preference)]
    )
  } catch (error) {
    console.error('[MemoryEnhancement] Error storing communication preference:', error)
  }
}

/**
 * Get communication preference
 */
export async function getCommunicationPreference(
  userId: string
): Promise<CommunicationPreference | null> {
  try {
    const result = await query(
      'SELECT preferences FROM user_communication_preferences WHERE user_id = $1',
      [userId]
    )

    if (result.rows.length === 0) return null
    return result.rows[0].preferences
  } catch (error) {
    console.error('[MemoryEnhancement] Error getting communication preference:', error)
    return null
  }
}

// ============================================================================
// GOALS AND TIMELINE TRACKING
// ============================================================================

/**
 * Create a new user goal
 */
export async function createGoal(userId: string, goal: Omit<UserGoal, 'id' | 'createdAt' | 'updatedAt' | 'completed' | 'completedAt'>): Promise<UserGoal> {
  const goalId = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date()

  const fullGoal: UserGoal = {
    ...goal,
    id: goalId,
    createdAt: now,
    updatedAt: now,
    completed: false,
  }

  try {
    await query(
      `INSERT INTO user_goals (id, user_id, description, category, target_value, target_unit, deadline, progress, milestones, created_at, updated_at, completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        goalId,
        userId,
        goal.description,
        goal.category,
        goal.targetValue,
        goal.targetUnit,
        goal.deadline,
        goal.progress,
        JSON.stringify(goal.milestones),
        now,
        now,
        false,
      ]
    )

    // Learn fact about the goal
    await learnFact(
      userId,
      `Has a ${goal.category} goal: ${goal.description}`,
      'business',
      'explicit',
      1.0
    )

    return fullGoal
  } catch (error) {
    console.error('[MemoryEnhancement] Error creating goal:', error)
    throw error
  }
}

/**
 * Update goal progress
 */
export async function updateGoalProgress(
  goalId: string,
  progress: number,
  milestoneId?: string
): Promise<void> {
  try {
    const now = new Date()

    if (milestoneId) {
      // Mark milestone as completed
      await query(
        `UPDATE user_goals
         SET milestones = (
           SELECT jsonb_agg(
             CASE
               WHEN m->>'id' = $2
               THEN m || jsonb_build_object('completed', true, 'completedAt', $3)
               ELSE m
             END
           )
           FROM jsonb_array_elements(milestones) AS m
         ),
         progress = $4,
         updated_at = $3
         WHERE id = $1`,
        [goalId, milestoneId, now.toISOString(), progress]
      )
    } else {
      await query(
        `UPDATE user_goals
         SET progress = $2,
             updated_at = $3,
             completed = CASE WHEN $2 >= 100 THEN true ELSE false END,
             completed_at = CASE WHEN $2 >= 100 THEN $3 ELSE null END
         WHERE id = $1`,
        [goalId, progress, now]
      )
    }
  } catch (error) {
    console.error('[MemoryEnhancement] Error updating goal progress:', error)
  }
}

/**
 * Get user's active goals
 */
export async function getActiveGoals(userId: string): Promise<UserGoal[]> {
  try {
    const result = await query(
      `SELECT * FROM user_goals
       WHERE user_id = $1 AND completed = false
       ORDER BY deadline ASC NULLS LAST, created_at DESC`,
      [userId]
    )

    return result.rows.map((row) => ({
      id: row.id,
      description: row.description,
      category: row.category,
      targetValue: row.target_value,
      targetUnit: row.target_unit,
      deadline: row.deadline ? new Date(row.deadline) : undefined,
      progress: row.progress,
      milestones: row.milestones || [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completed: row.completed,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    }))
  } catch (error) {
    console.error('[MemoryEnhancement] Error getting active goals:', error)
    return []
  }
}

// ============================================================================
// CONVERSATION MEMORY
// ============================================================================

/**
 * Store a conversation reference for future recall
 */
export async function storeConversationReference(
  userId: string,
  reference: Omit<ConversationReference, 'id'>
): Promise<void> {
  const refId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    await query(
      `INSERT INTO conversation_references (
        id, user_id, conversation_date, topic, summary, outcome,
        follow_up_needed, follow_up_date, related_goals
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        refId,
        userId,
        reference.date,
        reference.topic,
        reference.summary,
        reference.outcome,
        reference.followUpNeeded,
        reference.followUpDate,
        reference.relatedGoals,
      ]
    )
  } catch (error) {
    console.error('[MemoryEnhancement] Error storing conversation reference:', error)
  }
}

/**
 * Get relevant past conversations for context
 */
export async function getRelevantConversations(
  userId: string,
  currentTopic?: string,
  limit: number = 5
): Promise<ConversationReference[]> {
  try {
    let queryText = `
      SELECT * FROM conversation_references
      WHERE user_id = $1
    `
    const params: any[] = [userId]

    if (currentTopic) {
      queryText += ` AND (topic ILIKE $2 OR summary ILIKE $2)`
      params.push(`%${currentTopic}%`)
    }

    queryText += ` ORDER BY conversation_date DESC LIMIT $${params.length + 1}`
    params.push(limit)

    const result = await query(queryText, params)

    return result.rows.map((row) => ({
      id: row.id,
      date: new Date(row.conversation_date),
      topic: row.topic,
      summary: row.summary,
      outcome: row.outcome,
      followUpNeeded: row.follow_up_needed,
      followUpDate: row.follow_up_date ? new Date(row.follow_up_date) : undefined,
      relatedGoals: row.related_goals,
    }))
  } catch (error) {
    console.error('[MemoryEnhancement] Error getting relevant conversations:', error)
    return []
  }
}

/**
 * Get follow-ups that are due
 */
export async function getDueFollowUps(userId: string): Promise<ConversationReference[]> {
  try {
    const result = await query(
      `SELECT * FROM conversation_references
       WHERE user_id = $1
         AND follow_up_needed = true
         AND follow_up_date <= NOW()
       ORDER BY follow_up_date ASC`,
      [userId]
    )

    return result.rows.map((row) => ({
      id: row.id,
      date: new Date(row.conversation_date),
      topic: row.topic,
      summary: row.summary,
      outcome: row.outcome,
      followUpNeeded: row.follow_up_needed,
      followUpDate: row.follow_up_date ? new Date(row.follow_up_date) : undefined,
      relatedGoals: row.related_goals,
    }))
  } catch (error) {
    console.error('[MemoryEnhancement] Error getting due follow-ups:', error)
    return []
  }
}

// ============================================================================
// PERSONALITY ADAPTATION
// ============================================================================

/**
 * Get or create personality adaptation settings
 */
export async function getPersonalityAdaptation(
  userId: string
): Promise<PersonalityAdaptation> {
  const defaultAdaptation: PersonalityAdaptation = {
    mirrorsUserStyle: true,
    humorLevel: 'light',
    emojiUsage: 'minimal',
    responseLength: 'standard',
    proactivityLevel: 'medium',
    celebrateSuccesses: true,
    offerEncouragement: true,
  }

  try {
    const result = await query(
      'SELECT adaptation FROM personality_adaptations WHERE user_id = $1',
      [userId]
    )

    if (result.rows.length === 0) {
      // Create default
      await query(
        `INSERT INTO personality_adaptations (user_id, adaptation, updated_at)
         VALUES ($1, $2, NOW())`,
        [userId, JSON.stringify(defaultAdaptation)]
      )
      return defaultAdaptation
    }

    return { ...defaultAdaptation, ...result.rows[0].adaptation }
  } catch (error) {
    console.error('[MemoryEnhancement] Error getting personality adaptation:', error)
    return defaultAdaptation
  }
}

/**
 * Update personality adaptation based on user feedback
 */
export async function updatePersonalityAdaptation(
  userId: string,
  updates: Partial<PersonalityAdaptation>
): Promise<void> {
  try {
    const current = await getPersonalityAdaptation(userId)
    const updated = { ...current, ...updates }

    await query(
      `UPDATE personality_adaptations
       SET adaptation = $2, updated_at = NOW()
       WHERE user_id = $1`,
      [userId, JSON.stringify(updated)]
    )
  } catch (error) {
    console.error('[MemoryEnhancement] Error updating personality adaptation:', error)
  }
}

// ============================================================================
// IMPORTANT DATES
// ============================================================================

/**
 * Store an important date for the user
 */
export async function addImportantDate(
  userId: string,
  date: Omit<ImportantDate, 'id'>
): Promise<void> {
  const dateId = `date_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    await query(
      `INSERT INTO important_dates (
        id, user_id, date, description, type, reminder_days, recurring
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        dateId,
        userId,
        date.date,
        date.description,
        date.type,
        date.reminderDays,
        date.recurring,
      ]
    )

    // Learn fact
    await learnFact(
      userId,
      `Important date: ${date.description} on ${date.date.toLocaleDateString()}`,
      'personal',
      'explicit',
      1.0
    )
  } catch (error) {
    console.error('[MemoryEnhancement] Error adding important date:', error)
  }
}

/**
 * Get upcoming important dates
 */
export async function getUpcomingDates(
  userId: string,
  daysAhead: number = 30
): Promise<ImportantDate[]> {
  try {
    const result = await query(
      `SELECT * FROM important_dates
       WHERE user_id = $1
         AND (
           date BETWEEN NOW() AND NOW() + INTERVAL '${daysAhead} days'
           OR (recurring = true AND EXTRACT(DOY FROM date) BETWEEN EXTRACT(DOY FROM NOW()) AND EXTRACT(DOY FROM NOW() + INTERVAL '${daysAhead} days'))
         )
       ORDER BY date ASC`,
      [userId]
    )

    return result.rows.map((row) => ({
      id: row.id,
      date: new Date(row.date),
      description: row.description,
      type: row.type,
      reminderDays: row.reminder_days || [],
      recurring: row.recurring,
      lastNotified: row.last_notified ? new Date(row.last_notified) : undefined,
    }))
  } catch (error) {
    console.error('[MemoryEnhancement] Error getting upcoming dates:', error)
    return []
  }
}

// ============================================================================
// RELATIONSHIP TRACKING
// ============================================================================

/**
 * Store or update a user relationship
 */
export async function upsertRelationship(
  userId: string,
  relationship: Omit<UserRelationship, 'id'>
): Promise<void> {
  const relId = `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    await query(
      `INSERT INTO user_relationships (
        id, user_id, name, type, company, notes, last_interaction, interaction_count, sentiment
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id, name) DO UPDATE SET
        type = EXCLUDED.type,
        company = EXCLUDED.company,
        notes = EXCLUDED.notes,
        last_interaction = EXCLUDED.last_interaction,
        interaction_count = user_relationships.interaction_count + 1,
        sentiment = EXCLUDED.sentiment`,
      [
        relId,
        userId,
        relationship.name,
        relationship.type,
        relationship.company,
        relationship.notes,
        relationship.lastInteraction,
        relationship.interactionCount,
        relationship.sentiment,
      ]
    )
  } catch (error) {
    console.error('[MemoryEnhancement] Error upserting relationship:', error)
  }
}

/**
 * Get relationships that need attention
 */
export async function getRelationshipsNeedingAttention(
  userId: string,
  daysSinceContact: number = 30
): Promise<UserRelationship[]> {
  try {
    const result = await query(
      `SELECT * FROM user_relationships
       WHERE user_id = $1
         AND (
           last_interaction < NOW() - INTERVAL '${daysSinceContact} days'
           OR sentiment = 'needs_attention'
         )
       ORDER BY last_interaction ASC`,
      [userId]
    )

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      company: row.company,
      notes: row.notes,
      lastInteraction: row.last_interaction ? new Date(row.last_interaction) : undefined,
      interactionCount: row.interaction_count,
      sentiment: row.sentiment,
    }))
  } catch (error) {
    console.error('[MemoryEnhancement] Error getting relationships needing attention:', error)
    return []
  }
}

// ============================================================================
// ENHANCED MEMORY RETRIEVAL
// ============================================================================

/**
 * Get complete enhanced memory for a user
 */
export async function getEnhancedMemory(userId: string): Promise<EnhancedMemory | null> {
  try {
    const baseMemory = await getWellsMemory(userId)
    if (!baseMemory) return null

    const [
      communicationPreference,
      goals,
      conversationReferences,
      trustLevel,
      personalityAdaptation,
      importantDates,
      relationships,
    ] = await Promise.all([
      getCommunicationPreference(userId),
      getActiveGoals(userId),
      getRelevantConversations(userId, undefined, 10),
      getTrustLevel(userId),
      getPersonalityAdaptation(userId),
      getUpcomingDates(userId),
      getRelationshipsNeedingAttention(userId, 60),
    ])

    return {
      ...baseMemory,
      communicationPreference: communicationPreference || getDefaultCommunicationPreference(),
      goals,
      conversationReferences,
      trustLevel: trustLevel || getDefaultTrustLevel(),
      personalityAdaptation,
      importantDates,
      relationships,
    }
  } catch (error) {
    console.error('[MemoryEnhancement] Error getting enhanced memory:', error)
    return null
  }
}

/**
 * Get trust level (imported from trust-builder, but also available here)
 */
async function getTrustLevel(userId: string): Promise<TrustLevel | null> {
  try {
    const result = await query(
      'SELECT * FROM user_trust_scores WHERE user_id = $1',
      [userId]
    )

    if (result.rows.length === 0) return null

    const row = result.rows[0]
    return {
      score: row.score,
      tier: row.tier,
      factors: row.factors,
      lastUpdated: new Date(row.last_updated),
    }
  } catch (error) {
    console.error('[MemoryEnhancement] Error getting trust level:', error)
    return null
  }
}

function getDefaultCommunicationPreference(): CommunicationPreference {
  return {
    formality: 'professional',
    verbosity: 'moderate',
    tone: 'friendly',
    preferredChannels: ['chat'],
  }
}

function getDefaultTrustLevel(): TrustLevel {
  return {
    score: 0,
    tier: 'new',
    factors: {
      interactionCount: 0,
      successfulDeals: 0,
      moneySaved: 0,
      moneyEarned: 0,
      insightsActedUpon: 0,
      insightsDismissed: 0,
      autonomyGranted: {
        autoNegotiate: false,
        autoApproveThreshold: 0,
        autoRespondToRfqs: false,
        autoApplyToJobs: false,
        proactiveOutreach: false,
        approvalRequiredFor: ['all'],
      },
      daysSinceFirstInteraction: 0,
    },
    lastUpdated: new Date(),
  }
}

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

/**
 * Build enhanced context for AI prompts
 */
export async function buildEnhancedContext(
  userId: string,
  currentTopic?: string
): Promise<string> {
  const memory = await getEnhancedMemory(userId)
  if (!memory) return ''

  const contextParts: string[] = []

  // Communication style
  contextParts.push(`COMMUNICATION PREFERENCES:`)
  contextParts.push(`- Style: ${memory.communicationPreference.formality}, ${memory.communicationPreference.tone}`)
  contextParts.push(`- Verbosity: ${memory.communicationPreference.verbosity}`)
  if (memory.communicationPreference.preferredGreeting) {
    contextParts.push(`- Preferred greeting: "${memory.communicationPreference.preferredGreeting}"`)
  }

  // Active goals
  if (memory.goals.length > 0) {
    contextParts.push(`\nACTIVE GOALS:`)
    memory.goals.slice(0, 3).forEach((goal) => {
      contextParts.push(`- ${goal.description} (${goal.progress}% complete)`)
    })
  }

  // Relevant past conversations
  if (memory.conversationReferences.length > 0) {
    contextParts.push(`\nRECENT CONVERSATION CONTEXT:`)
    memory.conversationReferences.slice(0, 3).forEach((ref) => {
      contextParts.push(`- ${ref.date.toLocaleDateString()}: ${ref.topic} - ${ref.summary}`)
    })
  }

  // Trust and autonomy
  contextParts.push(`\nTRUST LEVEL: ${memory.trustLevel.tier} (score: ${memory.trustLevel.score})`)
  if (memory.trustLevel.factors.autonomyGranted.autoNegotiate) {
    contextParts.push(`- User has granted auto-negotiation permission`)
  }
  if (memory.trustLevel.factors.autonomyGranted.autoApproveThreshold > 0) {
    contextParts.push(`- Auto-approve threshold: $${memory.trustLevel.factors.autonomyGranted.autoApproveThreshold}`)
  }

  // Personality adaptation
  contextParts.push(`\nPERSONALITY SETTINGS:`)
  contextParts.push(`- Humor: ${memory.personalityAdaptation.humorLevel}`)
  contextParts.push(`- Response length: ${memory.personalityAdaptation.responseLength}`)
  contextParts.push(`- Celebrate successes: ${memory.personalityAdaptation.celebrateSuccesses ? 'yes' : 'no'}`)

  // Upcoming dates
  if (memory.importantDates.length > 0) {
    contextParts.push(`\nUPCOMING IMPORTANT DATES:`)
    memory.importantDates.slice(0, 3).forEach((date) => {
      contextParts.push(`- ${date.date.toLocaleDateString()}: ${date.description}`)
    })
  }

  // Relationships needing attention
  if (memory.relationships.length > 0) {
    contextParts.push(`\nRELATIONSHIPS NEEDING ATTENTION:`)
    memory.relationships.slice(0, 3).forEach((rel) => {
      contextParts.push(`- ${rel.name} (${rel.type}): ${rel.notes}`)
    })
  }

  return contextParts.join('\n')
}

// ============================================================================
// CHAT CONTEXT INJECTION - RICH CONTEXT FOR EVERY CHAT
// ============================================================================

export interface ChatContext {
  userProfile: {
    name: string
    company?: string
    role?: string
    journey: ProductType
    communicationStyle: CommunicationPreference
  }
  activeDeals: Array<{
    id: string
    title: string
    value: number
    stage: string
    lastActivity: Date
  }>
  pendingInsights: Array<{
    id: string
    type: string
    urgency: string
    title: string
    potentialValue?: number
  }>
  conversationHistory: Array<{
    topic: string
    summary: string
    date: Date
    followUpNeeded: boolean
  }>
  trustLevel: {
    tier: string
    score: number
    autonomyConfig: AutonomyLevel
  }
  recentActivity: {
    lastLogin: Date | null
    hoursSinceLastInteraction: number
    isReturningUser: boolean
  }
}

/**
 * Get complete context for injecting into chat
 * This provides Wells with everything needed to feel like a true companion
 */
export async function getContextForChat(userId: string): Promise<ChatContext> {
  try {
    const memory = await getEnhancedMemory(userId)

    // Get active deals/negotiations
    let activeDeals: ChatContext['activeDeals'] = []
    try {
      const dealsResult = await query(
        `SELECT id, title, value, stage, updated_at as last_activity
         FROM deals
         WHERE user_id = $1 AND status NOT IN ('closed', 'cancelled')
         ORDER BY updated_at DESC
         LIMIT 5`,
        [userId]
      )
      activeDeals = dealsResult.rows.map((row) => ({
        id: row.id,
        title: row.title,
        value: parseFloat(row.value || '0'),
        stage: row.stage,
        lastActivity: new Date(row.last_activity),
      }))
    } catch (e) {
      // Tables may not exist
    }

    // Get pending insights
    let pendingInsights: ChatContext['pendingInsights'] = []
    try {
      const insightsResult = await query(
        `SELECT id, category as type, urgency, title, potential_value
         FROM proactive_insights
         WHERE user_id = $1 AND acted_upon = false AND dismissed = false
         ORDER BY
           CASE urgency
             WHEN 'critical' THEN 0
             WHEN 'high' THEN 1
             WHEN 'medium' THEN 2
             ELSE 3
           END,
           created_at DESC
         LIMIT 5`,
        [userId]
      )
      pendingInsights = insightsResult.rows.map((row) => ({
        id: row.id,
        type: row.type,
        urgency: row.urgency,
        title: row.title,
        potentialValue: row.potential_value ? parseFloat(row.potential_value) : undefined,
      }))
    } catch (e) {
      // Tables may not exist
    }

    // Calculate time since last interaction
    let lastLogin: Date | null = null
    let hoursSinceLastInteraction = 0
    try {
      const loginResult = await query(
        `SELECT last_login FROM user_sessions WHERE user_id = $1 ORDER BY last_login DESC LIMIT 1`,
        [userId]
      )
      if (loginResult.rows.length > 0 && loginResult.rows[0].last_login) {
        lastLogin = new Date(loginResult.rows[0].last_login)
        hoursSinceLastInteraction = (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60)
      }
    } catch (e) {
      // Tables may not exist
    }

    const isReturningUser = hoursSinceLastInteraction > 4 // More than 4 hours

    return {
      userProfile: {
        name: memory?.firstName || memory?.preferredName || 'User',
        company: memory?.companyName,
        role: memory?.role,
        journey: memory?.journey || 'buyer',
        communicationStyle: memory?.communicationPreference || getDefaultCommunicationPreference(),
      },
      activeDeals,
      pendingInsights,
      conversationHistory: (memory?.conversationReferences || []).slice(0, 5).map((ref) => ({
        topic: ref.topic,
        summary: ref.summary,
        date: ref.date,
        followUpNeeded: ref.followUpNeeded,
      })),
      trustLevel: {
        tier: memory?.trustLevel?.tier || 'new',
        score: memory?.trustLevel?.score || 0,
        autonomyConfig: memory?.trustLevel?.factors?.autonomyGranted || {
          autoNegotiate: false,
          autoApproveThreshold: 0,
          autoRespondToRfqs: false,
          autoApplyToJobs: false,
          proactiveOutreach: false,
          approvalRequiredFor: ['all'],
        },
      },
      recentActivity: {
        lastLogin,
        hoursSinceLastInteraction,
        isReturningUser,
      },
    }
  } catch (error) {
    console.error('[MemoryEnhancement] Error getting chat context:', error)
    // Return minimal context
    return {
      userProfile: {
        name: 'User',
        journey: 'buyer',
        communicationStyle: getDefaultCommunicationPreference(),
      },
      activeDeals: [],
      pendingInsights: [],
      conversationHistory: [],
      trustLevel: {
        tier: 'new',
        score: 0,
        autonomyConfig: {
          autoNegotiate: false,
          autoApproveThreshold: 0,
          autoRespondToRfqs: false,
          autoApplyToJobs: false,
          proactiveOutreach: false,
          approvalRequiredFor: ['all'],
        },
      },
      recentActivity: {
        lastLogin: null,
        hoursSinceLastInteraction: 0,
        isReturningUser: false,
      },
    }
  }
}

/**
 * Generate a contextual greeting based on user state
 */
export async function generateContextualGreeting(userId: string): Promise<{
  greeting: string
  context: ChatContext
  proactiveMessages: string[]
}> {
  const context = await getContextForChat(userId)
  const proactiveMessages: string[] = []

  // Build time-based greeting
  const hour = new Date().getHours()
  let timeGreeting = 'Hello'
  if (hour < 12) timeGreeting = 'Good morning'
  else if (hour < 17) timeGreeting = 'Good afternoon'
  else timeGreeting = 'Good evening'

  // Personalize with name
  const name = context.userProfile.name !== 'User' ? `, ${context.userProfile.name}` : ''
  let greeting = `${timeGreeting}${name}!`

  // If returning user, acknowledge time away
  if (context.recentActivity.isReturningUser && context.recentActivity.hoursSinceLastInteraction > 24) {
    greeting += ' Great to see you back.'
  }

  // Add proactive insights
  if (context.pendingInsights.length > 0) {
    proactiveMessages.push('While you were away, I was busy:')

    const criticalInsights = context.pendingInsights.filter((i) => i.urgency === 'critical')
    const highInsights = context.pendingInsights.filter((i) => i.urgency === 'high')

    for (const insight of criticalInsights.slice(0, 2)) {
      proactiveMessages.push(`**[Warning] Heads up:** ${insight.title}${insight.potentialValue ? ` ($${insight.potentialValue.toLocaleString()} at stake)` : ''}`)
    }

    for (const insight of highInsights.slice(0, 2)) {
      proactiveMessages.push(`**[Search] Found something:** ${insight.title}`)
    }
  }

  // Mention active deals if any need attention
  const urgentDeals = context.activeDeals.filter(
    (d) => Date.now() - d.lastActivity.getTime() > 24 * 60 * 60 * 1000
  )
  if (urgentDeals.length > 0) {
    proactiveMessages.push(
      `**[Clock] Deal update:** ${urgentDeals.length} deal${urgentDeals.length > 1 ? 's' : ''} ${urgentDeals.length > 1 ? 'need' : 'needs'} your attention.`
    )
  }

  // If no proactive messages, offer help
  if (proactiveMessages.length === 0) {
    proactiveMessages.push("I've been monitoring things and all looks good. How can I help you today?")
  }

  return {
    greeting,
    context,
    proactiveMessages,
  }
}

/**
 * Build system prompt context for AI
 */
export async function buildSystemPromptContext(userId: string): Promise<string> {
  const context = await getContextForChat(userId)
  const lines: string[] = []

  lines.push('=== USER CONTEXT ===')
  lines.push(`Name: ${context.userProfile.name}`)
  if (context.userProfile.company) lines.push(`Company: ${context.userProfile.company}`)
  if (context.userProfile.role) lines.push(`Role: ${context.userProfile.role}`)
  lines.push(`Journey Type: ${context.userProfile.journey}`)
  lines.push(`Trust Level: ${context.userProfile.name} (${context.trustLevel.score}/100)`)
  lines.push('')

  lines.push('=== COMMUNICATION STYLE ===')
  lines.push(`Formality: ${context.userProfile.communicationStyle.formality}`)
  lines.push(`Tone: ${context.userProfile.communicationStyle.tone}`)
  lines.push(`Verbosity: ${context.userProfile.communicationStyle.verbosity}`)
  lines.push('')

  if (context.activeDeals.length > 0) {
    lines.push('=== ACTIVE DEALS ===')
    context.activeDeals.forEach((deal) => {
      lines.push(`- ${deal.title}: $${deal.value.toLocaleString()} (${deal.stage})`)
    })
    lines.push('')
  }

  if (context.pendingInsights.length > 0) {
    lines.push('=== PENDING INSIGHTS ===')
    context.pendingInsights.forEach((insight) => {
      lines.push(`- [${insight.urgency.toUpperCase()}] ${insight.title}`)
    })
    lines.push('')
  }

  if (context.conversationHistory.length > 0) {
    lines.push('=== RECENT CONVERSATION TOPICS ===')
    context.conversationHistory.slice(0, 3).forEach((conv) => {
      lines.push(`- ${conv.date.toLocaleDateString()}: ${conv.topic}`)
    })
    lines.push('')
  }

  lines.push('=== AUTONOMY PERMISSIONS ===')
  const autonomy = context.trustLevel.autonomyConfig
  if (autonomy.autoNegotiate) lines.push('- Can auto-negotiate deals')
  if (autonomy.autoApproveThreshold > 0) {
    lines.push(`- Can auto-approve below $${autonomy.autoApproveThreshold.toLocaleString()}`)
  }
  if (autonomy.proactiveOutreach) lines.push('- Can proactively reach out')
  if (!autonomy.autoNegotiate && !autonomy.proactiveOutreach) {
    lines.push('- Requires approval for all actions')
  }

  return lines.join('\n')
}

/**
 * Store rich context from a conversation
 */
export async function storeRichContext(
  userId: string,
  context: {
    topic: string
    summary: string
    entities?: Array<{ type: string; name: string; id?: string }>
    decisions?: string[]
    followUpItems?: Array<{ description: string; dueDate?: Date }>
    sentiment?: 'positive' | 'neutral' | 'negative'
  }
): Promise<void> {
  try {
    // Store conversation reference
    await storeConversationReference(userId, {
      date: new Date(),
      topic: context.topic,
      summary: context.summary,
      outcome: context.decisions?.join('; '),
      followUpNeeded: (context.followUpItems?.length || 0) > 0,
      followUpDate: context.followUpItems?.[0]?.dueDate,
    })

    // Extract and store entities as relationships
    for (const entity of context.entities || []) {
      if (entity.type === 'person' || entity.type === 'company') {
        await upsertRelationship(userId, {
          name: entity.name,
          type: entity.type === 'company' ? 'partner' : 'colleague',
          company: entity.type === 'company' ? entity.name : undefined,
          notes: `Mentioned in conversation about: ${context.topic}`,
          lastInteraction: new Date(),
          interactionCount: 1,
          sentiment: context.sentiment === 'positive' ? 'positive' : 'neutral',
        })
      }
    }
  } catch (error) {
    console.error('[MemoryEnhancement] Error storing rich context:', error)
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const MemoryEnhancement = {
  learnCommunicationStyle,
  getCommunicationPreference,
  createGoal,
  updateGoalProgress,
  getActiveGoals,
  storeConversationReference,
  getRelevantConversations,
  getDueFollowUps,
  getPersonalityAdaptation,
  updatePersonalityAdaptation,
  addImportantDate,
  getUpcomingDates,
  upsertRelationship,
  getRelationshipsNeedingAttention,
  getEnhancedMemory,
  buildEnhancedContext,
  // Chat context functions
  getContextForChat,
  generateContextualGreeting,
  buildSystemPromptContext,
  storeRichContext,
}

export default MemoryEnhancement
