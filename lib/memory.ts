/**
 * Wells AI Memory & Relationship System
 *
 * Wells remembers EVERYTHING and builds deep companion relationships.
 * Like Ghost from Destiny - always there, always learning, always remembering.
 */

import { PrismaClient } from '@prisma/client'

// Lazy-load Prisma client to avoid build errors when database isn't configured
let prisma: PrismaClient | null = null

function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient()
  }
  return prisma
}

export interface ConversationContext {
  userId: string
  sessionId: string
  device?: string
  source?: string
}

export interface MessageInput {
  role: 'user' | 'assistant'
  content: string
  sentiment?: string
  intent?: string
  entities?: Record<string, any>
  isImportant?: boolean
  importance?: number
}

export interface UserContextData {
  name?: string
  preferredName?: string
  email?: string
  phone?: string
  userType?: string
  company?: string
  role?: string
  industry?: string
  goals?: string[]
  painPoints?: string[]
  preferences?: Record<string, any>
}

export interface MemoryInput {
  category: 'fact' | 'preference' | 'goal' | 'pain_point' | 'relationship' | 'event'
  content: string
  context?: string
  importance?: number
  sourceMessageId?: string
}

/**
 * Get or create user context
 */
export async function getOrCreateUserContext(userId: string): Promise<any> {
  const db = getPrisma()
  let userContext = await db.userContext.findUnique({
    where: { userId },
    include: {
      memories: {
        orderBy: { importance: 'desc' },
        take: 20 // Most important memories
      }
    }
  })

  if (!userContext) {
    userContext = await db.userContext.create({
      data: {
        userId,
        firstSeenAt: new Date(),
        lastSeenAt: new Date()
      },
      include: {
        memories: true
      }
    })
  } else {
    // Update last seen
    await db.userContext.update({
      where: { userId },
      data: { lastSeenAt: new Date() }
    })
  }

  return userContext
}

/**
 * Update user context with learned information
 */
export async function updateUserContext(
  userId: string,
  updates: Partial<UserContextData>
): Promise<void> {
  await getPrisma().userContext.upsert({
    where: { userId },
    create: {
      userId,
      ...updates,
      firstSeenAt: new Date(),
      lastSeenAt: new Date()
    },
    update: {
      ...updates,
      lastSeenAt: new Date()
    }
  })
}

/**
 * Get or create conversation
 */
export async function getOrCreateConversation(
  context: ConversationContext,
  onboardingState?: any
): Promise<any> {
  // CRITICAL: Ensure UserContext exists first (required for Conversation relation)
  await getOrCreateUserContext(context.userId)

  let conversation = await getPrisma().conversation.findUnique({
    where: { sessionId: context.sessionId },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 50 // Last 50 messages for context
      }
    }
  })

  if (!conversation) {
    conversation = await getPrisma().conversation.create({
      data: {
        userId: context.userId,
        sessionId: context.sessionId,
        device: context.device,
        source: context.source,
        onboardingState: onboardingState || undefined,
        lastActivityAt: new Date()
      },
      include: {
        messages: true
      }
    })
  }

  return conversation
}

/**
 * Update conversation metrics
 */
export async function updateConversationMetrics(
  conversationId: string,
  updates: {
    messageCount?: number
    trustScore?: number
    conversationDepth?: number
    lastActivity?: string
    onboardingState?: any
    onboardingCompleted?: boolean
  }
): Promise<void> {
  await getPrisma().conversation.update({
    where: { id: conversationId },
    data: {
      ...updates,
      lastActivityAt: new Date(),
      onboardingCompletedAt: updates.onboardingCompleted
        ? new Date()
        : undefined
    }
  })
}

/**
 * Store a message
 */
export async function storeMessage(
  conversationId: string,
  message: MessageInput
): Promise<any> {
  const stored = await getPrisma().message.create({
    data: {
      conversationId,
      role: message.role,
      content: message.content,
      sentiment: message.sentiment,
      intent: message.intent,
      entities: message.entities || undefined,
      isImportant: message.isImportant || false,
      importance: message.importance || 0
    }
  })

  // Update conversation message count
  await getPrisma().conversation.update({
    where: { id: conversationId },
    data: {
      messageCount: {
        increment: 1
      }
    }
  })

  // Update user context message count
  const conversation = await getPrisma().conversation.findUnique({
    where: { id: conversationId },
    select: { userId: true }
  })

  if (conversation) {
    await getPrisma().userContext.update({
      where: { userId: conversation.userId },
      data: {
        totalMessages: {
          increment: 1
        }
      }
    })
  }

  return stored
}

/**
 * Get conversation history with context
 */
export async function getConversationHistory(
  sessionId: string,
  limit: number = 50
): Promise<any> {
  const conversation = await getPrisma().conversation.findUnique({
    where: { sessionId },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: limit
      },
      userContext: {
        include: {
          memories: {
            where: {
              importance: {
                gte: 7 // Only high-importance memories
              }
            },
            orderBy: { importance: 'desc' },
            take: 10
          }
        }
      }
    }
  })

  if (!conversation) {
    return null
  }

  // Reverse messages to get chronological order
  conversation.messages.reverse()

  return conversation
}

/**
 * Create a memory
 */
export async function createMemory(
  userId: string,
  memory: MemoryInput
): Promise<any> {
  return await getPrisma().memory.create({
    data: {
      userId,
      category: memory.category,
      content: memory.content,
      context: memory.context,
      importance: memory.importance || 5,
      sourceMessageId: memory.sourceMessageId,
      lastUsedAt: new Date()
    }
  })
}

/**
 * Get relevant memories for context
 */
export async function getRelevantMemories(
  userId: string,
  query?: string,
  limit: number = 10
): Promise<any[]> {
  // For now, get high-importance memories
  // TODO: Implement semantic search with embeddings
  return await getPrisma().memory.findMany({
    where: {
      userId,
      importance: {
        gte: 6
      }
    },
    orderBy: [
      { importance: 'desc' },
      { lastUsedAt: 'desc' }
    ],
    take: limit
  })
}

/**
 * Update memory last used timestamp
 */
export async function markMemoryUsed(memoryId: string): Promise<void> {
  await getPrisma().memory.update({
    where: { id: memoryId },
    data: { lastUsedAt: new Date() }
  })
}

/**
 * Build context for Wells to use in conversation
 *
 * This is the key function that gives Wells its memory and personality
 */
export async function buildConversationContext(
  userId: string,
  sessionId: string
): Promise<{
  userContext: any
  recentMessages: any[]
  importantMemories: any[]
  conversationMetrics: {
    messageCount: number
    trustScore: number
    conversationDepth: number
  }
}> {
  // Get user context
  const userContext = await getOrCreateUserContext(userId)

  // Get conversation history
  const conversation = await getConversationHistory(sessionId, 50)

  // Get important memories
  const memories = await getRelevantMemories(userId, undefined, 10)

  return {
    userContext,
    recentMessages: conversation?.messages || [],
    importantMemories: memories,
    conversationMetrics: {
      messageCount: conversation?.messageCount || 0,
      trustScore: conversation?.trustScore || 0,
      conversationDepth: conversation?.conversationDepth || 0
    }
  }
}

/**
 * Extract and store important information from conversation
 *
 * This runs after each message to learn about the user
 */
export async function extractAndStoreContext(
  userId: string,
  conversationId: string,
  userMessage: string,
  assistantMessage: string
): Promise<void> {
  // TODO: Use Claude to extract:
  // - Facts about user (company, role, goals, pain points)
  // - Preferences (communication style, priorities)
  // - Important events or decisions
  // - Relationship indicators (trust, rapport)

  // For now, simple heuristics
  const lower = userMessage.toLowerCase()

  // Extract company mentions
  if (lower.includes('i work at') || lower.includes('i\'m at')) {
    // TODO: Extract company name using NLP
  }

  // Extract goals
  if (lower.includes('i want to') || lower.includes('i need to') || lower.includes('looking for')) {
    await createMemory(userId, {
      category: 'goal',
      content: userMessage,
      importance: 7,
      sourceMessageId: conversationId
    })
  }

  // Extract pain points
  if (lower.includes('struggle') || lower.includes('difficult') || lower.includes('problem')) {
    await createMemory(userId, {
      category: 'pain_point',
      content: userMessage,
      importance: 7,
      sourceMessageId: conversationId
    })
  }
}

/**
 * Format context for Claude system prompt
 */
export function formatContextForPrompt(context: Awaited<ReturnType<typeof buildConversationContext>>): string {
  const parts: string[] = []

  // User info
  if (context.userContext.name) {
    parts.push(`User: ${context.userContext.preferredName || context.userContext.name}`)
  }
  if (context.userContext.company) {
    parts.push(`Company: ${context.userContext.company}`)
  }
  if (context.userContext.role) {
    parts.push(`Role: ${context.userContext.role}`)
  }

  // Important memories
  if (context.importantMemories.length > 0) {
    parts.push('\nWhat you remember about them:')
    context.importantMemories.forEach(memory => {
      parts.push(`- ${memory.content}`)
    })
  }

  // CRITICAL: Include recent conversation history
  if (context.recentMessages.length > 0) {
    parts.push('\nRecent conversation history:')
    context.recentMessages.forEach(msg => {
      const role = msg.role === 'user' ? 'User' : 'Wells'
      parts.push(`${role}: ${msg.content}`)
    })
  }

  // Relationship metrics
  parts.push(`\nRelationship:`)
  parts.push(`- Messages exchanged: ${context.conversationMetrics.messageCount}`)
  parts.push(`- Trust score: ${context.conversationMetrics.trustScore}/100`)
  parts.push(`- Conversation depth: ${context.conversationMetrics.conversationDepth}`)

  return parts.join('\n')
}

export default {
  getOrCreateUserContext,
  updateUserContext,
  getOrCreateConversation,
  updateConversationMetrics,
  storeMessage,
  getConversationHistory,
  createMemory,
  getRelevantMemories,
  markMemoryUsed,
  buildConversationContext,
  extractAndStoreContext,
  formatContextForPrompt
}
