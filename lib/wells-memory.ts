// @ts-nocheck
/**
 * Wells Memory System
 *
 * Unified user context and memory management across WellsAI and Grain & Vault.
 * This module provides a high-level interface for:
 * - Reading and writing user context
 * - Managing conversation memory
 * - Learning user preferences over time
 * - Cross-product context sharing
 *
 * The goal: A user should have the SAME Wells AI experience regardless of
 * which product they're using. Wells remembers their preferences, conversation
 * history, and learns about them over time.
 */

import { sqlQuery as sql, query } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

// ============================================================================
// TYPES
// ============================================================================

export type ProductType = 'wellsai' | 'grainvault'

export interface WellsMemory {
  // Core identity
  clerkUserId: string
  firstName?: string
  lastName?: string
  email?: string

  // Learned preferences
  communicationStyle?: 'formal' | 'casual' | 'direct' | 'detailed'
  preferredName?: string
  timezone?: string
  industry?: string
  companyName?: string
  role?: string

  // Cross-product context
  lastProduct: ProductType
  wellsaiProfile: WellsAIProfile
  grainvaultProfile: GrainVaultProfile

  // Conversation memory
  recentTopics: string[]
  keyEntities: Record<string, any>
  learnedFacts: LearnedFact[]
  conversationSummaries: ConversationSummaryItem[]

  // Activity stats
  wellsaiMessageCount: number
  grainvaultMessageCount: number
  totalMessageCount: number
  lastActivity?: Date

  // Metadata
  createdAt: Date
  updatedAt: Date
}

export interface WellsAIProfile {
  // Journey preferences
  primaryJourney?: 'founder' | 'buyer' | 'seller' | 'jobs'

  // Founder context
  founderContext?: {
    companyName?: string
    companyStage?: string
    lookingFor?: string[]
    teamSize?: number
  }

  // Buyer context
  buyerContext?: {
    categories?: string[]
    typicalBudget?: number
    preferredPaymentTerms?: string
  }

  // Seller context
  sellerContext?: {
    productsServices?: string[]
    targetCustomers?: string[]
  }

  // Jobs context
  jobsContext?: {
    currentRole?: string
    desiredRoles?: string[]
    skills?: string[]
    salary?: {
      min?: number
      max?: number
      currency?: string
    }
  }
}

export interface GrainVaultProfile {
  // Treasury context
  grainBalance?: number
  creditLine?: number
  paymentHistory?: {
    totalSent?: number
    totalReceived?: number
    frequentRecipients?: string[]
  }

  // Preferences
  defaultPaymentMemo?: string
  preferredPaymentMethod?: 'grain' | 'usdc'
}

export interface LearnedFact {
  fact: string
  confidence: number
  source: 'explicit' | 'inferred'
  learnedAt: Date
  category: 'preference' | 'business' | 'personal' | 'context'
}

export interface ConversationSummaryItem {
  conversationId: string
  summary: string
  keyTopics: string[]
  product: ProductType
  createdAt: Date
}

export interface MemoryContextForPrompt {
  systemContextAddition: string
  recentConversationContext: string
  learnedPreferences: Record<string, any>
}

// ============================================================================
// MEMORY RETRIEVAL
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

/**
 * Get the complete memory context for a user
 */
export async function getWellsMemory(clerkUserId: string): Promise<WellsMemory | null> {
  try {
    // Get base user context
    const contextResult = await sql`
      SELECT * FROM unified_user_context WHERE clerk_user_id = ${clerkUserId}
    `

    if (contextResult.rows.length === 0) {
      return null
    }

    const row = contextResult.rows[0]

    // Get user profile data if available
    const profileResult = await sql`
      SELECT * FROM user_profiles WHERE user_id = ${clerkUserId}
    `
    const profile = profileResult.rows[0]

    // Get recent conversation summaries
    const summariesResult = await sql`
      SELECT
        cs.conversation_id,
        cs.summary_text,
        cs.key_topics,
        c.product_origin,
        cs.created_at
      FROM unified_conversation_summaries cs
      JOIN unified_conversations c ON cs.conversation_id = c.id
      WHERE c.clerk_user_id = ${clerkUserId}
      ORDER BY cs.created_at DESC
      LIMIT 5
    `

    const conversationSummaries = summariesResult.rows.map(s => ({
      conversationId: s.conversation_id,
      summary: s.summary_text,
      keyTopics: s.key_topics || [],
      product: s.product_origin as ProductType,
      createdAt: new Date(s.created_at),
    }))

    // Build the memory object
    const memory: WellsMemory = {
      clerkUserId,
      firstName: profile?.first_name,
      lastName: profile?.last_name,
      email: profile?.email,

      // Learned preferences from metadata
      communicationStyle: row.preferences?.communicationStyle,
      preferredName: row.preferences?.preferredName,
      timezone: profile?.timezone || row.preferences?.timezone,
      industry: profile?.industry,
      companyName: profile?.company,
      role: profile?.role,

      // Cross-product context
      lastProduct: row.last_wellsai_activity > row.last_grainvault_activity ? 'wellsai' : 'grainvault',
      wellsaiProfile: row.wellsai_profile || {},
      grainvaultProfile: row.grainvault_profile || {},

      // Conversation memory
      recentTopics: row.recent_topics || [],
      keyEntities: row.key_entities || {},
      learnedFacts: row.metadata?.learnedFacts || [],
      conversationSummaries,

      // Activity stats
      wellsaiMessageCount: row.wellsai_message_count || 0,
      grainvaultMessageCount: row.grainvault_message_count || 0,
      totalMessageCount: row.total_message_count || 0,
      lastActivity: row.last_activity ? new Date(row.last_activity) : undefined,

      // Metadata
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }

    return memory
  } catch (error) {
    console.error('[WellsMemory] Error getting memory:', error)
    return null
  }
}

/**
 * Get or create memory for a user
 */
export async function getOrCreateWellsMemory(
  clerkUserId: string,
  initialData?: Partial<WellsMemory>
): Promise<WellsMemory> {
  const existing = await getWellsMemory(clerkUserId)
  if (existing) {
    return existing
  }

  // Create new memory entry
  try {
    await sql`
      INSERT INTO unified_user_context (
        clerk_user_id,
        wellsai_profile,
        grainvault_profile,
        recent_topics,
        key_entities,
        preferences,
        metadata
      ) VALUES (
        ${clerkUserId},
        ${JSON.stringify(initialData?.wellsaiProfile || {})},
        ${JSON.stringify(initialData?.grainvaultProfile || {})},
        ${initialData?.recentTopics || []},
        ${JSON.stringify(initialData?.keyEntities || {})},
        ${JSON.stringify({
          communicationStyle: initialData?.communicationStyle,
          preferredName: initialData?.preferredName,
          timezone: initialData?.timezone,
        })},
        ${JSON.stringify({ learnedFacts: [] })}
      )
      ON CONFLICT (clerk_user_id) DO NOTHING
    `

    return await getWellsMemory(clerkUserId) || {
      clerkUserId,
      lastProduct: 'wellsai',
      wellsaiProfile: {},
      grainvaultProfile: {},
      recentTopics: [],
      keyEntities: {},
      learnedFacts: [],
      conversationSummaries: [],
      wellsaiMessageCount: 0,
      grainvaultMessageCount: 0,
      totalMessageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  } catch (error) {
    console.error('[WellsMemory] Error creating memory:', error)
    throw error
  }
}

// ============================================================================
// MEMORY UPDATES
// ============================================================================

/**
 * Update user memory with new information
 */
export async function updateWellsMemory(
  clerkUserId: string,
  updates: Partial<{
    wellsaiProfile: Partial<WellsAIProfile>
    grainvaultProfile: Partial<GrainVaultProfile>
    recentTopics: string[]
    keyEntities: Record<string, any>
    preferences: Record<string, any>
    learnedFacts: LearnedFact[]
  }>
): Promise<void> {
  try {
    const existing = await getWellsMemory(clerkUserId)
    if (!existing) {
      await getOrCreateWellsMemory(clerkUserId)
    }

    const setClauses: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (updates.wellsaiProfile) {
      const merged = { ...existing?.wellsaiProfile, ...updates.wellsaiProfile }
      setClauses.push(`wellsai_profile = $${paramIndex++}`)
      params.push(JSON.stringify(merged))
    }

    if (updates.grainvaultProfile) {
      const merged = { ...existing?.grainvaultProfile, ...updates.grainvaultProfile }
      setClauses.push(`grainvault_profile = $${paramIndex++}`)
      params.push(JSON.stringify(merged))
    }

    if (updates.recentTopics) {
      // Merge and dedupe topics, keeping most recent
      const existingTopics = existing?.recentTopics || []
      const mergedTopics = [...new Set([...updates.recentTopics, ...existingTopics])].slice(0, 20)
      setClauses.push(`recent_topics = $${paramIndex++}`)
      params.push(mergedTopics)
    }

    if (updates.keyEntities) {
      const merged = { ...existing?.keyEntities, ...updates.keyEntities }
      setClauses.push(`key_entities = $${paramIndex++}`)
      params.push(JSON.stringify(merged))
    }

    if (updates.preferences) {
      const existingPrefs = existing?.communicationStyle
        ? {
            communicationStyle: existing.communicationStyle,
            preferredName: existing.preferredName,
            timezone: existing.timezone,
          }
        : {}
      const merged = { ...existingPrefs, ...updates.preferences }
      setClauses.push(`preferences = $${paramIndex++}`)
      params.push(JSON.stringify(merged))
    }

    if (updates.learnedFacts) {
      const existingFacts = existing?.learnedFacts || []
      const mergedFacts = [...updates.learnedFacts, ...existingFacts].slice(0, 50)
      const existingMetadata = { learnedFacts: existingFacts }
      setClauses.push(`metadata = $${paramIndex++}`)
      params.push(JSON.stringify({ ...existingMetadata, learnedFacts: mergedFacts }))
    }

    if (setClauses.length > 0) {
      setClauses.push(`updated_at = NOW()`)
      params.push(clerkUserId)

      const updateQuery = `
        UPDATE unified_user_context
        SET ${setClauses.join(', ')}
        WHERE clerk_user_id = $${paramIndex}
      `
      await query(updateQuery, params)
    }
  } catch (error) {
    console.error('[WellsMemory] Error updating memory:', error)
  }
}

/**
 * Record a new learned fact about the user
 */
export async function learnFact(
  clerkUserId: string,
  fact: string,
  category: LearnedFact['category'],
  source: LearnedFact['source'] = 'inferred',
  confidence: number = 0.8
): Promise<void> {
  const newFact: LearnedFact = {
    fact,
    confidence,
    source,
    learnedAt: new Date(),
    category,
  }

  await updateWellsMemory(clerkUserId, {
    learnedFacts: [newFact],
  })
}

/**
 * Update recent topics based on conversation
 */
export async function updateRecentTopics(
  clerkUserId: string,
  topics: string[]
): Promise<void> {
  await updateWellsMemory(clerkUserId, {
    recentTopics: topics,
  })
}

// ============================================================================
// CONTEXT BUILDING FOR PROMPTS
// ============================================================================

/**
 * Build memory context to inject into system prompt
 */
export async function buildMemoryContextForPrompt(
  clerkUserId: string,
  currentProduct: ProductType,
  journey?: string
): Promise<MemoryContextForPrompt> {
  const memory = await getWellsMemory(clerkUserId)

  if (!memory) {
    return {
      systemContextAddition: '',
      recentConversationContext: '',
      learnedPreferences: {},
    }
  }

  // Build system context addition
  const contextParts: string[] = []

  // Add user identity context
  const userName = memory.preferredName || memory.firstName
  if (userName) {
    contextParts.push(`USER IDENTITY:`)
    contextParts.push(`- Name: ${userName}${memory.lastName ? ' ' + memory.lastName : ''}`)
    if (memory.companyName) contextParts.push(`- Company: ${memory.companyName}`)
    if (memory.role) contextParts.push(`- Role: ${memory.role}`)
    if (memory.industry) contextParts.push(`- Industry: ${memory.industry}`)
  }

  // Add communication preferences
  if (memory.communicationStyle) {
    contextParts.push(`\nCOMMUNICATION STYLE: ${memory.communicationStyle}`)
  }

  // Add cross-product context
  const hasOtherProduct =
    currentProduct === 'wellsai'
      ? memory.grainvaultMessageCount > 0
      : memory.wellsaiMessageCount > 0

  if (hasOtherProduct) {
    contextParts.push(`\nCROSS-PRODUCT CONTEXT:`)
    if (currentProduct === 'wellsai') {
      contextParts.push(`- User also uses Grain & Vault (${memory.grainvaultMessageCount} messages)`)
      if (memory.grainvaultProfile.grainBalance !== undefined) {
        contextParts.push(`- GRAIN Balance: ${memory.grainvaultProfile.grainBalance?.toLocaleString()}`)
      }
    } else {
      contextParts.push(`- User also uses Wells AI (${memory.wellsaiMessageCount} messages)`)
      if (memory.wellsaiProfile.primaryJourney) {
        contextParts.push(`- Primary journey: ${memory.wellsaiProfile.primaryJourney}`)
      }
    }
  }

  // Add learned facts
  const relevantFacts = memory.learnedFacts
    .filter(f => f.confidence >= 0.7)
    .slice(0, 5)

  if (relevantFacts.length > 0) {
    contextParts.push(`\nLEARNED ABOUT USER:`)
    relevantFacts.forEach(f => {
      contextParts.push(`- ${f.fact}`)
    })
  }

  // Add recent topics if relevant
  if (memory.recentTopics.length > 0) {
    contextParts.push(`\nRECENT TOPICS: ${memory.recentTopics.slice(0, 5).join(', ')}`)
  }

  // Add key entities
  const entityKeys = Object.keys(memory.keyEntities)
  if (entityKeys.length > 0) {
    contextParts.push(`\nKEY ENTITIES:`)
    entityKeys.slice(0, 5).forEach(key => {
      contextParts.push(`- ${key}: ${memory.keyEntities[key]}`)
    })
  }

  // Build recent conversation context
  let recentConversationContext = ''
  if (memory.conversationSummaries.length > 0) {
    const relevantSummaries = memory.conversationSummaries
      .filter(s => s.product === currentProduct)
      .slice(0, 3)

    if (relevantSummaries.length > 0) {
      recentConversationContext = `\nRECENT CONVERSATION HISTORY:\n${relevantSummaries
        .map(s => `- ${s.summary}`)
        .join('\n')}`
    }
  }

  // Add journey-specific context
  if (currentProduct === 'wellsai' && journey) {
    const wellsProfile = memory.wellsaiProfile

    if (journey === 'founder' && wellsProfile.founderContext) {
      const ctx = wellsProfile.founderContext
      if (ctx.companyName || ctx.companyStage || ctx.lookingFor?.length) {
        contextParts.push(`\nFOUNDER CONTEXT:`)
        if (ctx.companyName) contextParts.push(`- Company: ${ctx.companyName}`)
        if (ctx.companyStage) contextParts.push(`- Stage: ${ctx.companyStage}`)
        if (ctx.lookingFor?.length) contextParts.push(`- Looking for: ${ctx.lookingFor.join(', ')}`)
      }
    }

    if (journey === 'buyer' && wellsProfile.buyerContext) {
      const ctx = wellsProfile.buyerContext
      if (ctx.categories?.length || ctx.typicalBudget) {
        contextParts.push(`\nBUYER CONTEXT:`)
        if (ctx.categories?.length) contextParts.push(`- Categories: ${ctx.categories.join(', ')}`)
        if (ctx.typicalBudget) contextParts.push(`- Typical budget: $${ctx.typicalBudget.toLocaleString()}`)
      }
    }

    if (journey === 'seller' && wellsProfile.sellerContext) {
      const ctx = wellsProfile.sellerContext
      if (ctx.productsServices?.length) {
        contextParts.push(`\nSELLER CONTEXT:`)
        contextParts.push(`- Products/Services: ${ctx.productsServices.join(', ')}`)
      }
    }

    if (journey === 'jobs' && wellsProfile.jobsContext) {
      const ctx = wellsProfile.jobsContext
      if (ctx.skills?.length || ctx.desiredRoles?.length) {
        contextParts.push(`\nJOBS CONTEXT:`)
        if (ctx.skills?.length) contextParts.push(`- Skills: ${ctx.skills.join(', ')}`)
        if (ctx.desiredRoles?.length) contextParts.push(`- Looking for: ${ctx.desiredRoles.join(', ')}`)
      }
    }
  }

  // Add treasury context for Grain & Vault
  if (currentProduct === 'grainvault' && memory.grainvaultProfile) {
    const profile = memory.grainvaultProfile
    if (profile.paymentHistory?.frequentRecipients?.length) {
      contextParts.push(`\nFREQUENT RECIPIENTS: ${profile.paymentHistory.frequentRecipients.slice(0, 5).join(', ')}`)
    }
  }

  return {
    systemContextAddition: contextParts.length > 0 ? '\n\n' + contextParts.join('\n') : '',
    recentConversationContext,
    learnedPreferences: {
      communicationStyle: memory.communicationStyle,
      preferredName: memory.preferredName,
      timezone: memory.timezone,
    },
  }
}

// ============================================================================
// POST-CONVERSATION LEARNING
// ============================================================================

/**
 * Analyze a conversation to extract learnings about the user
 */
export async function learnFromConversation(
  clerkUserId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  product: ProductType,
  journey?: string
): Promise<void> {
  try {
    // Only analyze if there's meaningful conversation
    if (messages.length < 2) return

    // Extract user messages
    const userMessages = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n')

    if (userMessages.length < 50) return

    // Use Claude to extract learnings
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Analyze these user messages and extract key information about them. Return JSON with:
- topics: array of topics discussed
- entities: object with key entities (company names, amounts, dates, people)
- facts: array of facts learned about the user (preferences, context, needs)
- communicationStyle: 'formal' | 'casual' | 'direct' | 'detailed' or null

User messages:
${userMessages}

Return ONLY valid JSON, no explanation:`,
        },
      ],
    })

    const textBlock = response.content.find(block => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return

    try {
      const analysis = JSON.parse(textBlock.text)

      // Update memory with learnings
      const updates: Parameters<typeof updateWellsMemory>[1] = {}

      if (analysis.topics?.length) {
        updates.recentTopics = analysis.topics
      }

      if (analysis.entities && Object.keys(analysis.entities).length) {
        updates.keyEntities = analysis.entities
      }

      if (analysis.communicationStyle) {
        updates.preferences = { communicationStyle: analysis.communicationStyle }
      }

      if (analysis.facts?.length) {
        updates.learnedFacts = analysis.facts.map((fact: string) => ({
          fact,
          confidence: 0.7,
          source: 'inferred' as const,
          learnedAt: new Date(),
          category: 'context' as const,
        }))
      }

      // Update journey-specific profile
      if (product === 'wellsai' && journey) {
        const journeyUpdates: Partial<WellsAIProfile> = {
          primaryJourney: journey as any,
        }

        if (journey === 'buyer' && analysis.entities) {
          const categories = analysis.topics?.filter((t: string) =>
            ['motors', 'supplies', 'equipment', 'materials', 'parts'].some(cat =>
              t.toLowerCase().includes(cat)
            )
          )
          if (categories?.length) {
            journeyUpdates.buyerContext = { categories }
          }
        }

        updates.wellsaiProfile = journeyUpdates
      }

      if (Object.keys(updates).length > 0) {
        await updateWellsMemory(clerkUserId, updates)
      }
    } catch (parseError) {
      // JSON parsing failed, skip learning
      console.log('[WellsMemory] Could not parse learning response')
    }
  } catch (error) {
    console.error('[WellsMemory] Error learning from conversation:', error)
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export {
  getUserContext,
  updateUserContext,
  getRecentContext,
} from '@/lib/chat/unified-chat-service'

export { ProductType as ChatProductType } from '@/lib/chat/personas'
