// @ts-nocheck
/**
 * Context Builder
 * Builds system prompts and retrieves relevant conversation memory
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  ProductType,
  getProductSystemPrompt,
  getCrossProductContext,
} from './personas'
import {
  getUserContext,
  getRecentMessages,
  getConversationSummaries,
  UnifiedMessage,
  UserContext,
} from './unified-chat-service'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// SYSTEM PROMPT BUILDER
// ============================================================================

export interface BuildSystemPromptOptions {
  product: ProductType
  journey?: string
  userContext?: UserContext | null
  conversationId?: string
  treasuryContext?: {
    accountId?: string
    companyName?: string
    grainBalance?: number
    creditLine?: number
  }
  userProfile?: {
    firstName?: string
    lastName?: string
    company?: string
    role?: string
  }
}

export async function buildSystemPrompt(
  options: BuildSystemPromptOptions
): Promise<string> {
  const { product, journey, userContext, conversationId, treasuryContext, userProfile } = options

  // Start with base product prompt
  let systemPrompt = getProductSystemPrompt(product, journey)

  // Add user profile context if available
  if (userProfile) {
    const fullName = [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ')
    const userContextParts = []

    if (fullName) {
      userContextParts.push(`You are talking to ${fullName}`)
    }

    if (userProfile.company) {
      userContextParts.push(`from ${userProfile.company}`)
    }

    if (userProfile.role) {
      userContextParts.push(`(${userProfile.role})`)
    }

    if (userContextParts.length > 0) {
      systemPrompt += `\n\nUSER CONTEXT:\n${userContextParts.join(' ')}`
      systemPrompt += `\n\nIMPORTANT: Address them by their first name (${userProfile.firstName || 'there'}) in a warm, personal way. You know who they are and what they're working on.`
    }
  }

  // Add treasury context for Grain & Vault
  if (product === 'grainvault' && treasuryContext) {
    systemPrompt += `\n\nCURRENT ACCOUNT CONTEXT:
- Account ID: ${treasuryContext.accountId || 'Unknown'}
- Company: ${treasuryContext.companyName || 'Unknown'}
- GRAIN Balance: ${treasuryContext.grainBalance?.toLocaleString() || 0}
- Credit Line: ${treasuryContext.creditLine?.toLocaleString() || 0}
- Available Credit: ${((treasuryContext.creditLine || 0) - 0).toLocaleString()}`
  }

  // Add cross-product awareness if user has activity on both products
  if (userContext) {
    const hasWellsAI = userContext.wellsaiMessageCount > 0
    const hasGrainVault = userContext.grainvaultMessageCount > 0
    const hasOtherProduct = product === 'wellsai' ? hasGrainVault : hasWellsAI

    if (hasOtherProduct) {
      systemPrompt += getCrossProductContext(product, true)
    }

    // Add recent topics if available
    if (userContext.recentTopics && userContext.recentTopics.length > 0) {
      systemPrompt += `\n\nRECENT TOPICS:
User has recently discussed: ${userContext.recentTopics.slice(0, 5).join(', ')}`
    }

    // Add key entities if available
    if (userContext.keyEntities && Object.keys(userContext.keyEntities).length > 0) {
      const entities = Object.entries(userContext.keyEntities)
        .slice(0, 5)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
      systemPrompt += `\n\nKEY ENTITIES:
${entities}`
    }
  }

  // Add conversation memory if this is a continuing conversation
  if (conversationId) {
    const summaries = await getConversationSummaries(conversationId)
    if (summaries.length > 0) {
      const latestSummary = summaries[0]
      systemPrompt += `\n\nCONVERSATION CONTEXT:
${latestSummary.summaryText}`

      if (latestSummary.keyTopics && latestSummary.keyTopics.length > 0) {
        systemPrompt += `\nKey topics: ${latestSummary.keyTopics.join(', ')}`
      }
    }
  }

  return systemPrompt
}

// ============================================================================
// MEMORY RETRIEVAL
// ============================================================================

export interface RelevantMemory {
  messages: UnifiedMessage[]
  summary: string
  topics: string[]
  entities: Record<string, any>
}

export async function getRelevantMemory(
  userId: string,
  query: string,
  options?: {
    product?: ProductType
    limit?: number
  }
): Promise<RelevantMemory> {
  try {
    // Get recent messages
    const recentMessages = await getRecentMessages(userId, options?.limit || 20)

    // Filter by product if specified
    const filteredMessages = options?.product
      ? recentMessages.filter(m => m.productContext === options.product)
      : recentMessages

    // Extract topics and entities from messages
    const topics = new Set<string>()
    const entities: Record<string, any> = {}

    filteredMessages.forEach(msg => {
      if (msg.metadata?.topics) {
        msg.metadata.topics.forEach((t: string) => topics.add(t))
      }
      if (msg.metadata?.entities) {
        Object.assign(entities, msg.metadata.entities)
      }
    })

    // Generate summary using Claude (simple approach)
    const summary = await summarizeMessages(filteredMessages)

    return {
      messages: filteredMessages,
      summary,
      topics: Array.from(topics),
      entities,
    }
  } catch (error) {
    console.error('Error getting relevant memory:', error)
    return {
      messages: [],
      summary: '',
      topics: [],
      entities: {},
    }
  }
}

// ============================================================================
// SUMMARIZATION
// ============================================================================

export async function summarizeContext(messages: UnifiedMessage[]): Promise<string> {
  if (messages.length === 0) {
    return 'No previous context available.'
  }

  return summarizeMessages(messages)
}

async function summarizeMessages(messages: UnifiedMessage[]): Promise<string> {
  if (messages.length === 0) {
    return ''
  }

  try {
    // Build conversation text
    const conversationText = messages
      .slice(-10) // Last 10 messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n')

    // Use Claude to summarize
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Summarize this conversation in 2-3 sentences, highlighting key points, actions taken, and any pending items:

${conversationText}

Summary:`,
        },
      ],
    })

    const textBlock = response.content.find(block => block.type === 'text')
    return textBlock?.type === 'text' ? textBlock.text : 'Summary unavailable'
  } catch (error) {
    console.error('Error summarizing messages:', error)
    return 'Summary unavailable'
  }
}

// ============================================================================
// TOPIC EXTRACTION
// ============================================================================

export async function extractTopicsAndEntities(
  content: string
): Promise<{ topics: string[]; entities: Record<string, any> }> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Extract key topics and entities from this message. Return as JSON with "topics" (array of strings) and "entities" (object with entity types as keys).

Message: "${content}"

JSON:`,
        },
      ],
    })

    const textBlock = response.content.find(block => block.type === 'text')
    if (textBlock?.type === 'text') {
      try {
        const parsed = JSON.parse(textBlock.text)
        return {
          topics: parsed.topics || [],
          entities: parsed.entities || {},
        }
      } catch {
        return { topics: [], entities: {} }
      }
    }

    return { topics: [], entities: {} }
  } catch (error) {
    console.error('Error extracting topics and entities:', error)
    return { topics: [], entities: {} }
  }
}

// ============================================================================
// CONVERSATION TITLE GENERATION
// ============================================================================

export async function generateConversationTitle(
  messages: UnifiedMessage[]
): Promise<string> {
  if (messages.length === 0) {
    return 'New Conversation'
  }

  try {
    const firstUserMessage = messages.find(m => m.role === 'user')
    if (!firstUserMessage) {
      return 'New Conversation'
    }

    // Use first message as basis for title
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: `Generate a short, descriptive title (3-6 words) for a conversation that starts with: "${firstUserMessage.content.substring(0, 200)}"

Title:`,
        },
      ],
    })

    const textBlock = response.content.find(block => block.type === 'text')
    if (textBlock?.type === 'text') {
      return textBlock.text.trim().replace(/^["']|["']$/g, '')
    }

    return 'New Conversation'
  } catch (error) {
    console.error('Error generating conversation title:', error)
    return 'New Conversation'
  }
}

// ============================================================================
// CONTEXT FORMATTING
// ============================================================================

export function formatMessagesForPrompt(messages: UnifiedMessage[]): string {
  return messages
    .map(m => {
      const prefix = m.role === 'user' ? 'User' : 'Assistant'
      const productTag = m.productContext ? ` [${m.productContext}]` : ''
      return `${prefix}${productTag}: ${m.content}`
    })
    .join('\n\n')
}

export function formatUserContextSummary(userContext: UserContext | null): string {
  if (!userContext) {
    return 'New user'
  }

  const parts = []

  if (userContext.wellsaiMessageCount > 0) {
    parts.push(`${userContext.wellsaiMessageCount} messages on Wells AI`)
  }

  if (userContext.grainvaultMessageCount > 0) {
    parts.push(`${userContext.grainvaultMessageCount} messages on Grain & Vault`)
  }

  if (userContext.recentTopics && userContext.recentTopics.length > 0) {
    parts.push(`Recent topics: ${userContext.recentTopics.slice(0, 3).join(', ')}`)
  }

  return parts.length > 0 ? parts.join('. ') : 'New user'
}
