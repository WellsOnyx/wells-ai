// @ts-nocheck
/**
 * Unified Chat Service
 * Handles conversation storage and retrieval across Wells AI and Grain & Vault
 */

import { sql } from '@vercel/postgres'
import { ProductType } from './personas'

// ============================================================================
// TYPES
// ============================================================================

export interface UnifiedConversation {
  id: string
  clerkUserId: string
  productOrigin: ProductType
  currentProduct: ProductType
  title?: string
  summary?: string
  journey?: string
  mode?: string
  status: 'active' | 'archived' | 'deleted'
  messageCount: number
  lastMessageAt?: Date
  relatedConversationIds?: string[]
  tags?: string[]
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface UnifiedMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  productContext: ProductType
  toolUse?: Record<string, any>
  toolResults?: Record<string, any>
  actionType?: string
  actionData?: Record<string, any>
  actionStatus?: 'pending' | 'completed' | 'failed' | 'cancelled'
  tokensUsed?: number
  modelUsed?: string
  latencyMs?: number
  metadata?: Record<string, any>
  createdAt: Date
  editedAt?: Date
}

export interface UserContext {
  id: string
  clerkUserId: string
  preferredProduct?: ProductType
  defaultJourney?: string
  wellsaiProfile?: Record<string, any>
  grainvaultProfile?: Record<string, any>
  recentTopics?: string[]
  keyEntities?: Record<string, any>
  preferences?: Record<string, any>
  wellsaiMessageCount: number
  grainvaultMessageCount: number
  totalMessageCount: number
  lastWellsaiActivity?: Date
  lastGrainvaultActivity?: Date
  lastActivity?: Date
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface ConversationSummary {
  id: string
  conversationId: string
  summaryText: string
  keyTopics?: string[]
  entitiesMentioned?: Record<string, any>
  actionItems?: any[]
  messageCountAtSummary: number
  summaryType: 'auto' | 'manual' | 'final'
  createdAt: Date
}

export interface CreateConversationInput {
  userId: string
  product: ProductType
  journey?: string
  mode?: string
  title?: string
  metadata?: Record<string, any>
}

export interface AddMessageInput {
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  productContext: ProductType
  toolUse?: Record<string, any>
  toolResults?: Record<string, any>
  actionType?: string
  actionData?: Record<string, any>
  actionStatus?: 'pending' | 'completed' | 'failed' | 'cancelled'
  tokensUsed?: number
  modelUsed?: string
  latencyMs?: number
  metadata?: Record<string, any>
}

export interface GetConversationHistoryOptions {
  product?: ProductType
  journey?: string
  status?: 'active' | 'archived' | 'deleted'
  limit?: number
  offset?: number
}

// ============================================================================
// CONVERSATION OPERATIONS
// ============================================================================

export async function createConversation(
  input: CreateConversationInput
): Promise<UnifiedConversation> {
  try {
    const result = await sql`
      INSERT INTO unified_conversations (
        clerk_user_id,
        product_origin,
        current_product,
        journey,
        mode,
        title,
        metadata
      ) VALUES (
        ${input.userId},
        ${input.product},
        ${input.product},
        ${input.journey || null},
        ${input.mode || null},
        ${input.title || null},
        ${JSON.stringify(input.metadata || {})}
      )
      RETURNING *
    `

    return mapConversationFromDb(result.rows[0])
  } catch (error) {
    console.error('Error creating unified conversation:', error)
    throw new Error('Failed to create conversation')
  }
}

export async function getConversation(conversationId: string): Promise<UnifiedConversation | null> {
  try {
    const result = await sql`
      SELECT * FROM unified_conversations WHERE id = ${conversationId}
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapConversationFromDb(result.rows[0])
  } catch (error) {
    console.error('Error fetching unified conversation:', error)
    throw new Error('Failed to fetch conversation')
  }
}

export async function getConversationHistory(
  userId: string,
  options: GetConversationHistoryOptions = {}
): Promise<{ conversations: UnifiedConversation[]; total: number }> {
  try {
    const conditions: string[] = [`clerk_user_id = $1`]
    const params: any[] = [userId]

    if (options.product) {
      conditions.push(`(product_origin = $${params.length + 1} OR current_product = $${params.length + 1})`)
      params.push(options.product)
    }

    if (options.journey) {
      conditions.push(`journey = $${params.length + 1}`)
      params.push(options.journey)
    }

    if (options.status) {
      conditions.push(`status = $${params.length + 1}`)
      params.push(options.status)
    } else {
      conditions.push(`status = 'active'`)
    }

    const whereClause = conditions.join(' AND ')
    const limit = options.limit || 50
    const offset = options.offset || 0

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM unified_conversations WHERE ${whereClause}`
    const countResult = await sql.query(countQuery, params)
    const total = parseInt(countResult.rows[0].count)

    // Get conversations
    const conversationsQuery = `
      SELECT * FROM unified_conversations
      WHERE ${whereClause}
      ORDER BY last_message_at DESC NULLS LAST, created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `
    const conversationsResult = await sql.query(conversationsQuery, [...params, limit, offset])

    const conversations = conversationsResult.rows.map(mapConversationFromDb)

    return { conversations, total }
  } catch (error) {
    console.error('Error fetching conversation history:', error)
    throw new Error('Failed to fetch conversation history')
  }
}

export async function switchProduct(
  conversationId: string,
  newProduct: ProductType
): Promise<UnifiedConversation> {
  try {
    const result = await sql`
      UPDATE unified_conversations
      SET
        current_product = ${newProduct},
        updated_at = NOW()
      WHERE id = ${conversationId}
      RETURNING *
    `

    if (result.rows.length === 0) {
      throw new Error('Conversation not found')
    }

    return mapConversationFromDb(result.rows[0])
  } catch (error) {
    console.error('Error switching product context:', error)
    throw new Error('Failed to switch product context')
  }
}

export async function updateConversation(
  conversationId: string,
  updates: Partial<{
    title: string
    summary: string
    status: 'active' | 'archived' | 'deleted'
    tags: string[]
    metadata: Record<string, any>
  }>
): Promise<UnifiedConversation> {
  try {
    const setClauses: string[] = []
    const params: any[] = []

    if (updates.title !== undefined) {
      setClauses.push(`title = $${params.length + 1}`)
      params.push(updates.title)
    }
    if (updates.summary !== undefined) {
      setClauses.push(`summary = $${params.length + 1}`)
      params.push(updates.summary)
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${params.length + 1}`)
      params.push(updates.status)
    }
    if (updates.tags !== undefined) {
      setClauses.push(`tags = $${params.length + 1}`)
      params.push(updates.tags)
    }
    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${params.length + 1}`)
      params.push(JSON.stringify(updates.metadata))
    }

    setClauses.push(`updated_at = NOW()`)

    const updateQuery = `
      UPDATE unified_conversations
      SET ${setClauses.join(', ')}
      WHERE id = $${params.length + 1}
      RETURNING *
    `

    const result = await sql.query(updateQuery, [...params, conversationId])

    if (result.rows.length === 0) {
      throw new Error('Conversation not found')
    }

    return mapConversationFromDb(result.rows[0])
  } catch (error) {
    console.error('Error updating conversation:', error)
    throw new Error('Failed to update conversation')
  }
}

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

export async function addMessage(input: AddMessageInput): Promise<UnifiedMessage> {
  try {
    const result = await sql`
      INSERT INTO unified_messages (
        conversation_id,
        role,
        content,
        product_context,
        tool_use,
        tool_results,
        action_type,
        action_data,
        action_status,
        tokens_used,
        model_used,
        latency_ms,
        metadata
      ) VALUES (
        ${input.conversationId},
        ${input.role},
        ${input.content},
        ${input.productContext},
        ${JSON.stringify(input.toolUse || null)},
        ${JSON.stringify(input.toolResults || null)},
        ${input.actionType || null},
        ${JSON.stringify(input.actionData || null)},
        ${input.actionStatus || null},
        ${input.tokensUsed || null},
        ${input.modelUsed || null},
        ${input.latencyMs || null},
        ${JSON.stringify(input.metadata || {})}
      )
      RETURNING *
    `

    return mapMessageFromDb(result.rows[0])
  } catch (error) {
    console.error('Error adding message:', error)
    throw new Error('Failed to add message')
  }
}

export async function getMessages(
  conversationId: string,
  options?: { limit?: number; offset?: number }
): Promise<UnifiedMessage[]> {
  try {
    const limit = options?.limit || 100
    const offset = options?.offset || 0

    const result = await sql`
      SELECT * FROM unified_messages
      WHERE conversation_id = ${conversationId}
      ORDER BY created_at ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `

    return result.rows.map(mapMessageFromDb)
  } catch (error) {
    console.error('Error fetching messages:', error)
    throw new Error('Failed to fetch messages')
  }
}

export async function getRecentMessages(
  userId: string,
  limit: number = 20
): Promise<UnifiedMessage[]> {
  try {
    const result = await sql`
      SELECT m.* FROM unified_messages m
      JOIN unified_conversations c ON m.conversation_id = c.id
      WHERE c.clerk_user_id = ${userId} AND c.status = 'active'
      ORDER BY m.created_at DESC
      LIMIT ${limit}
    `

    return result.rows.map(mapMessageFromDb)
  } catch (error) {
    console.error('Error fetching recent messages:', error)
    throw new Error('Failed to fetch recent messages')
  }
}

// ============================================================================
// USER CONTEXT OPERATIONS
// ============================================================================

export async function getUserContext(userId: string): Promise<UserContext | null> {
  try {
    const result = await sql`
      SELECT * FROM unified_user_context WHERE clerk_user_id = ${userId}
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapUserContextFromDb(result.rows[0])
  } catch (error) {
    console.error('Error fetching user context:', error)
    throw new Error('Failed to fetch user context')
  }
}

export async function updateUserContext(
  userId: string,
  updates: Partial<{
    preferredProduct: ProductType
    defaultJourney: string
    wellsaiProfile: Record<string, any>
    grainvaultProfile: Record<string, any>
    recentTopics: string[]
    keyEntities: Record<string, any>
    preferences: Record<string, any>
    metadata: Record<string, any>
  }>
): Promise<UserContext> {
  try {
    const setClauses: string[] = []
    const params: any[] = []

    if (updates.preferredProduct !== undefined) {
      setClauses.push(`preferred_product = $${params.length + 1}`)
      params.push(updates.preferredProduct)
    }
    if (updates.defaultJourney !== undefined) {
      setClauses.push(`default_journey = $${params.length + 1}`)
      params.push(updates.defaultJourney)
    }
    if (updates.wellsaiProfile !== undefined) {
      setClauses.push(`wellsai_profile = $${params.length + 1}`)
      params.push(JSON.stringify(updates.wellsaiProfile))
    }
    if (updates.grainvaultProfile !== undefined) {
      setClauses.push(`grainvault_profile = $${params.length + 1}`)
      params.push(JSON.stringify(updates.grainvaultProfile))
    }
    if (updates.recentTopics !== undefined) {
      setClauses.push(`recent_topics = $${params.length + 1}`)
      params.push(updates.recentTopics)
    }
    if (updates.keyEntities !== undefined) {
      setClauses.push(`key_entities = $${params.length + 1}`)
      params.push(JSON.stringify(updates.keyEntities))
    }
    if (updates.preferences !== undefined) {
      setClauses.push(`preferences = $${params.length + 1}`)
      params.push(JSON.stringify(updates.preferences))
    }
    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${params.length + 1}`)
      params.push(JSON.stringify(updates.metadata))
    }

    setClauses.push(`updated_at = NOW()`)

    const updateQuery = `
      UPDATE unified_user_context
      SET ${setClauses.join(', ')}
      WHERE clerk_user_id = $${params.length + 1}
      RETURNING *
    `

    const result = await sql.query(updateQuery, [...params, userId])

    if (result.rows.length === 0) {
      // Create if doesn't exist
      const insertResult = await sql`
        INSERT INTO unified_user_context (clerk_user_id, preferences, metadata)
        VALUES (${userId}, '{}', '{}')
        RETURNING *
      `
      return mapUserContextFromDb(insertResult.rows[0])
    }

    return mapUserContextFromDb(result.rows[0])
  } catch (error) {
    console.error('Error updating user context:', error)
    throw new Error('Failed to update user context')
  }
}

export async function getRecentContext(userId: string): Promise<{
  userContext: UserContext | null
  recentMessages: UnifiedMessage[]
  activeConversations: UnifiedConversation[]
}> {
  try {
    const [userContext, recentMessages, { conversations: activeConversations }] = await Promise.all([
      getUserContext(userId),
      getRecentMessages(userId, 10),
      getConversationHistory(userId, { limit: 5, status: 'active' }),
    ])

    return {
      userContext,
      recentMessages,
      activeConversations,
    }
  } catch (error) {
    console.error('Error fetching recent context:', error)
    throw new Error('Failed to fetch recent context')
  }
}

// ============================================================================
// CONVERSATION SUMMARY OPERATIONS
// ============================================================================

export async function createConversationSummary(
  conversationId: string,
  summaryText: string,
  messageCount: number,
  options?: {
    keyTopics?: string[]
    entitiesMentioned?: Record<string, any>
    actionItems?: any[]
    summaryType?: 'auto' | 'manual' | 'final'
  }
): Promise<ConversationSummary> {
  try {
    const result = await sql`
      INSERT INTO unified_conversation_summaries (
        conversation_id,
        summary_text,
        key_topics,
        entities_mentioned,
        action_items,
        message_count_at_summary,
        summary_type
      ) VALUES (
        ${conversationId},
        ${summaryText},
        ${options?.keyTopics || []},
        ${JSON.stringify(options?.entitiesMentioned || {})},
        ${JSON.stringify(options?.actionItems || [])},
        ${messageCount},
        ${options?.summaryType || 'auto'}
      )
      ON CONFLICT (conversation_id, message_count_at_summary) DO UPDATE
      SET
        summary_text = ${summaryText},
        key_topics = ${options?.keyTopics || []},
        entities_mentioned = ${JSON.stringify(options?.entitiesMentioned || {})},
        action_items = ${JSON.stringify(options?.actionItems || [])}
      RETURNING *
    `

    return mapSummaryFromDb(result.rows[0])
  } catch (error) {
    console.error('Error creating conversation summary:', error)
    throw new Error('Failed to create conversation summary')
  }
}

export async function getConversationSummaries(
  conversationId: string
): Promise<ConversationSummary[]> {
  try {
    const result = await sql`
      SELECT * FROM unified_conversation_summaries
      WHERE conversation_id = ${conversationId}
      ORDER BY message_count_at_summary DESC
    `

    return result.rows.map(mapSummaryFromDb)
  } catch (error) {
    console.error('Error fetching conversation summaries:', error)
    throw new Error('Failed to fetch conversation summaries')
  }
}

// ============================================================================
// MAPPING FUNCTIONS
// ============================================================================

function mapConversationFromDb(row: any): UnifiedConversation {
  return {
    id: row.id,
    clerkUserId: row.clerk_user_id,
    productOrigin: row.product_origin,
    currentProduct: row.current_product,
    title: row.title,
    summary: row.summary,
    journey: row.journey,
    mode: row.mode,
    status: row.status,
    messageCount: row.message_count || 0,
    lastMessageAt: row.last_message_at,
    relatedConversationIds: row.related_conversation_ids,
    tags: row.tags,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapMessageFromDb(row: any): UnifiedMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    productContext: row.product_context,
    toolUse: row.tool_use,
    toolResults: row.tool_results,
    actionType: row.action_type,
    actionData: row.action_data,
    actionStatus: row.action_status,
    tokensUsed: row.tokens_used,
    modelUsed: row.model_used,
    latencyMs: row.latency_ms,
    metadata: row.metadata,
    createdAt: row.created_at,
    editedAt: row.edited_at,
  }
}

function mapUserContextFromDb(row: any): UserContext {
  return {
    id: row.id,
    clerkUserId: row.clerk_user_id,
    preferredProduct: row.preferred_product,
    defaultJourney: row.default_journey,
    wellsaiProfile: row.wellsai_profile,
    grainvaultProfile: row.grainvault_profile,
    recentTopics: row.recent_topics,
    keyEntities: row.key_entities,
    preferences: row.preferences,
    wellsaiMessageCount: row.wellsai_message_count || 0,
    grainvaultMessageCount: row.grainvault_message_count || 0,
    totalMessageCount: row.total_message_count || 0,
    lastWellsaiActivity: row.last_wellsai_activity,
    lastGrainvaultActivity: row.last_grainvault_activity,
    lastActivity: row.last_activity,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapSummaryFromDb(row: any): ConversationSummary {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    summaryText: row.summary_text,
    keyTopics: row.key_topics,
    entitiesMentioned: row.entities_mentioned,
    actionItems: row.action_items,
    messageCountAtSummary: row.message_count_at_summary,
    summaryType: row.summary_type,
    createdAt: row.created_at,
  }
}
