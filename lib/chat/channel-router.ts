// @ts-nocheck
/**
 * Multi-Channel Chat Router for WellsAI
 *
 * Enables the same conversational experience across all channels:
 * - Web chat widget
 * - Slack (commands, DMs, mentions)
 * - Discord (bot commands)
 * - SMS/WhatsApp (Twilio)
 * - Microsoft Teams
 * - Email responses
 * - iMessage (Sendblue)
 * - API (for integrations)
 *
 * Features:
 * - Normalizes incoming messages from all channels
 * - Routes to unified orchestrator
 * - Maintains conversation context across channel switches
 * - Handles channel-specific features gracefully
 */

import { sql } from '@vercel/postgres'
import Anthropic from '@anthropic-ai/sdk'
import { ProductType } from './personas'
import {
  createConversation,
  getConversation,
  addMessage,
  getMessages,
  getUserContext,
  updateUserContext,
} from './unified-chat-service'
import { buildSystemPrompt, extractTopicsAndEntities } from './context-builder'
import { formatResponseForChannel, ChannelType } from './channel-formatters'

// ============================================================================
// TYPES
// ============================================================================

export type { ChannelType } from './channel-formatters'

export interface NormalizedMessage {
  id: string
  channel: ChannelType
  channelMessageId?: string
  userId?: string // Clerk user ID if authenticated
  externalUserId: string // Channel-specific user ID
  externalUserName?: string
  externalUserEmail?: string
  externalUserPhone?: string
  conversationId?: string // WellsAI conversation ID
  channelConversationId?: string // Channel-specific thread/conversation ID
  content: string
  attachments?: MessageAttachment[]
  replyToMessageId?: string
  metadata?: Record<string, any>
  timestamp: Date
}

export interface MessageAttachment {
  type: 'image' | 'file' | 'audio' | 'video' | 'link'
  url?: string
  name?: string
  mimeType?: string
  size?: number
  data?: string // Base64 for inline attachments
}

export interface ChannelContext {
  channel: ChannelType
  workspaceId?: string // Slack team ID, Discord guild ID, etc.
  channelId?: string // Slack channel, Discord channel, etc.
  threadId?: string // Thread timestamp for threaded conversations
  accessToken?: string // Channel-specific auth token
  botUserId?: string
  metadata?: Record<string, any>
}

export interface RouterResponse {
  success: boolean
  message: string
  formattedResponse: any // Channel-specific formatted response
  conversationId?: string
  messageId?: string
  toolUse?: {
    name: string
    input: any
    result?: any
  }
  suggestedActions?: SuggestedAction[]
  error?: string
}

export interface SuggestedAction {
  id: string
  label: string
  action: string
  data?: Record<string, any>
  style?: 'primary' | 'secondary' | 'danger'
}

export interface UserIdentity {
  clerkUserId?: string
  email?: string
  phone?: string
  slackUserId?: string
  discordUserId?: string
  teamsUserId?: string
  imessageId?: string
  externalId?: string
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// USER IDENTITY RESOLUTION
// ============================================================================

/**
 * Resolve user identity across channels
 * Links channel-specific identifiers to WellsAI user accounts
 */
export async function resolveUserIdentity(
  identity: UserIdentity
): Promise<{ clerkUserId?: string; isNewUser: boolean }> {
  try {
    // Try to find existing user mapping
    const result = await sql`
      SELECT clerk_user_id FROM channel_user_mappings
      WHERE (email = ${identity.email} AND email IS NOT NULL)
         OR (phone = ${identity.phone} AND phone IS NOT NULL)
         OR (slack_user_id = ${identity.slackUserId} AND slack_user_id IS NOT NULL)
         OR (discord_user_id = ${identity.discordUserId} AND discord_user_id IS NOT NULL)
         OR (teams_user_id = ${identity.teamsUserId} AND teams_user_id IS NOT NULL)
         OR (imessage_id = ${identity.imessageId} AND imessage_id IS NOT NULL)
         OR (external_id = ${identity.externalId} AND external_id IS NOT NULL)
      LIMIT 1
    `

    if (result.rows.length > 0) {
      return { clerkUserId: result.rows[0].clerk_user_id, isNewUser: false }
    }

    // If Clerk user ID is provided, create mapping
    if (identity.clerkUserId) {
      await sql`
        INSERT INTO channel_user_mappings (
          clerk_user_id, email, phone, slack_user_id, discord_user_id,
          teams_user_id, imessage_id, external_id
        ) VALUES (
          ${identity.clerkUserId}, ${identity.email}, ${identity.phone},
          ${identity.slackUserId}, ${identity.discordUserId}, ${identity.teamsUserId},
          ${identity.imessageId}, ${identity.externalId}
        )
        ON CONFLICT (clerk_user_id) DO UPDATE SET
          email = COALESCE(EXCLUDED.email, channel_user_mappings.email),
          phone = COALESCE(EXCLUDED.phone, channel_user_mappings.phone),
          slack_user_id = COALESCE(EXCLUDED.slack_user_id, channel_user_mappings.slack_user_id),
          discord_user_id = COALESCE(EXCLUDED.discord_user_id, channel_user_mappings.discord_user_id),
          teams_user_id = COALESCE(EXCLUDED.teams_user_id, channel_user_mappings.teams_user_id),
          imessage_id = COALESCE(EXCLUDED.imessage_id, channel_user_mappings.imessage_id),
          external_id = COALESCE(EXCLUDED.external_id, channel_user_mappings.external_id),
          updated_at = NOW()
      `
      return { clerkUserId: identity.clerkUserId, isNewUser: false }
    }

    return { clerkUserId: undefined, isNewUser: true }
  } catch (error) {
    console.error('Error resolving user identity:', error)
    return { clerkUserId: undefined, isNewUser: true }
  }
}

/**
 * Link a channel identity to an existing user
 */
export async function linkChannelIdentity(
  clerkUserId: string,
  identity: Partial<UserIdentity>
): Promise<void> {
  try {
    await sql`
      INSERT INTO channel_user_mappings (
        clerk_user_id, email, phone, slack_user_id, discord_user_id,
        teams_user_id, imessage_id, external_id
      ) VALUES (
        ${clerkUserId}, ${identity.email}, ${identity.phone},
        ${identity.slackUserId}, ${identity.discordUserId}, ${identity.teamsUserId},
        ${identity.imessageId}, ${identity.externalId}
      )
      ON CONFLICT (clerk_user_id) DO UPDATE SET
        email = COALESCE(EXCLUDED.email, channel_user_mappings.email),
        phone = COALESCE(EXCLUDED.phone, channel_user_mappings.phone),
        slack_user_id = COALESCE(EXCLUDED.slack_user_id, channel_user_mappings.slack_user_id),
        discord_user_id = COALESCE(EXCLUDED.discord_user_id, channel_user_mappings.discord_user_id),
        teams_user_id = COALESCE(EXCLUDED.teams_user_id, channel_user_mappings.teams_user_id),
        imessage_id = COALESCE(EXCLUDED.imessage_id, channel_user_mappings.imessage_id),
        external_id = COALESCE(EXCLUDED.external_id, channel_user_mappings.external_id),
        updated_at = NOW()
    `
  } catch (error) {
    console.error('Error linking channel identity:', error)
  }
}

// ============================================================================
// CONVERSATION CONTINUITY
// ============================================================================

/**
 * Find or create a conversation that can span multiple channels
 */
export async function findOrCreateConversation(
  normalizedMessage: NormalizedMessage,
  channelContext: ChannelContext,
  product: ProductType = 'wellsai'
): Promise<{ conversationId: string; isNew: boolean; previousChannel?: ChannelType }> {
  try {
    // First, check if there's an existing conversation mapping for this channel thread
    const existingMapping = await sql`
      SELECT conversation_id, channel FROM channel_conversation_mappings
      WHERE channel = ${normalizedMessage.channel}
        AND channel_conversation_id = ${normalizedMessage.channelConversationId || channelContext.threadId || normalizedMessage.externalUserId}
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY updated_at DESC
      LIMIT 1
    `

    if (existingMapping.rows.length > 0) {
      const mapping = existingMapping.rows[0]

      // Update the mapping timestamp
      await sql`
        UPDATE channel_conversation_mappings
        SET updated_at = NOW()
        WHERE conversation_id = ${mapping.conversation_id}
          AND channel = ${normalizedMessage.channel}
      `

      return {
        conversationId: mapping.conversation_id,
        isNew: false,
        previousChannel: mapping.channel,
      }
    }

    // Check if user has a recent conversation on another channel (for continuity)
    if (normalizedMessage.userId) {
      const recentConversation = await sql`
        SELECT c.id, ccm.channel FROM unified_conversations c
        JOIN channel_conversation_mappings ccm ON c.id = ccm.conversation_id
        WHERE c.clerk_user_id = ${normalizedMessage.userId}
          AND c.status = 'active'
          AND c.updated_at > NOW() - INTERVAL '24 hours'
        ORDER BY c.updated_at DESC
        LIMIT 1
      `

      if (recentConversation.rows.length > 0) {
        const recent = recentConversation.rows[0]

        // Create mapping for this channel to existing conversation
        await sql`
          INSERT INTO channel_conversation_mappings (
            conversation_id, channel, channel_conversation_id, channel_workspace_id
          ) VALUES (
            ${recent.id}, ${normalizedMessage.channel},
            ${normalizedMessage.channelConversationId || channelContext.threadId || normalizedMessage.externalUserId},
            ${channelContext.workspaceId}
          )
          ON CONFLICT (conversation_id, channel) DO UPDATE SET
            channel_conversation_id = EXCLUDED.channel_conversation_id,
            updated_at = NOW()
        `

        return {
          conversationId: recent.id,
          isNew: false,
          previousChannel: recent.channel as ChannelType,
        }
      }
    }

    // Create new conversation
    const userId = normalizedMessage.userId || `anonymous_${normalizedMessage.externalUserId}`
    const conversation = await createConversation({
      userId,
      product,
      metadata: {
        originChannel: normalizedMessage.channel,
        externalUserId: normalizedMessage.externalUserId,
        externalUserName: normalizedMessage.externalUserName,
      },
    })

    // Create channel mapping
    await sql`
      INSERT INTO channel_conversation_mappings (
        conversation_id, channel, channel_conversation_id, channel_workspace_id
      ) VALUES (
        ${conversation.id}, ${normalizedMessage.channel},
        ${normalizedMessage.channelConversationId || channelContext.threadId || normalizedMessage.externalUserId},
        ${channelContext.workspaceId}
      )
    `

    return { conversationId: conversation.id, isNew: true }
  } catch (error) {
    console.error('Error finding/creating conversation:', error)
    throw error
  }
}

// ============================================================================
// MESSAGE NORMALIZATION
// ============================================================================

/**
 * Normalize incoming messages from various channels into a standard format
 */
export function normalizeMessage(
  channel: ChannelType,
  rawMessage: any,
  channelContext: ChannelContext
): NormalizedMessage {
  switch (channel) {
    case 'web':
      return normalizeWebMessage(rawMessage, channelContext)
    case 'slack':
      return normalizeSlackMessage(rawMessage, channelContext)
    case 'discord':
      return normalizeDiscordMessage(rawMessage, channelContext)
    case 'sms':
    case 'whatsapp':
      return normalizeTwilioMessage(rawMessage, channelContext, channel)
    case 'teams':
      return normalizeTeamsMessage(rawMessage, channelContext)
    case 'email':
      return normalizeEmailMessage(rawMessage, channelContext)
    case 'imessage':
      return normalizeIMessageMessage(rawMessage, channelContext)
    case 'api':
      return normalizeApiMessage(rawMessage, channelContext)
    default:
      throw new Error(`Unsupported channel: ${channel}`)
  }
}

function normalizeWebMessage(raw: any, ctx: ChannelContext): NormalizedMessage {
  return {
    id: raw.id || crypto.randomUUID(),
    channel: 'web',
    channelMessageId: raw.id,
    userId: raw.userId,
    externalUserId: raw.userId || raw.sessionId || 'anonymous',
    externalUserName: raw.userName,
    externalUserEmail: raw.userEmail,
    conversationId: raw.conversationId,
    content: raw.message || raw.content,
    attachments: raw.attachments?.map(normalizeAttachment),
    metadata: raw.metadata,
    timestamp: new Date(raw.timestamp || Date.now()),
  }
}

function normalizeSlackMessage(raw: any, ctx: ChannelContext): NormalizedMessage {
  // Remove @mentions from the message
  let content = raw.text || ''
  if (ctx.botUserId) {
    content = content.replace(new RegExp(`<@${ctx.botUserId}>`, 'g'), '').trim()
  }

  return {
    id: raw.client_msg_id || raw.ts || crypto.randomUUID(),
    channel: 'slack',
    channelMessageId: raw.ts,
    externalUserId: raw.user,
    externalUserName: raw.user_profile?.real_name || raw.user_profile?.display_name,
    channelConversationId: raw.thread_ts || raw.channel,
    content,
    attachments: raw.files?.map((f: any) => ({
      type: getFileType(f.mimetype),
      url: f.url_private,
      name: f.name,
      mimeType: f.mimetype,
      size: f.size,
    })),
    replyToMessageId: raw.thread_ts,
    metadata: {
      channelId: raw.channel,
      channelType: raw.channel_type,
      teamId: ctx.workspaceId,
    },
    timestamp: new Date(parseFloat(raw.ts) * 1000),
  }
}

function normalizeDiscordMessage(raw: any, ctx: ChannelContext): NormalizedMessage {
  // Remove @mentions
  let content = raw.content || ''
  if (ctx.botUserId) {
    content = content.replace(new RegExp(`<@!?${ctx.botUserId}>`, 'g'), '').trim()
  }

  return {
    id: raw.id || crypto.randomUUID(),
    channel: 'discord',
    channelMessageId: raw.id,
    externalUserId: raw.author?.id,
    externalUserName: raw.author?.username,
    channelConversationId: raw.channel_id,
    content,
    attachments: raw.attachments?.map((a: any) => ({
      type: getFileType(a.content_type),
      url: a.url,
      name: a.filename,
      mimeType: a.content_type,
      size: a.size,
    })),
    replyToMessageId: raw.message_reference?.message_id,
    metadata: {
      guildId: raw.guild_id,
      channelId: raw.channel_id,
    },
    timestamp: new Date(raw.timestamp),
  }
}

function normalizeTwilioMessage(raw: any, ctx: ChannelContext, channel: 'sms' | 'whatsapp'): NormalizedMessage {
  const mediaUrls: MessageAttachment[] = []
  const numMedia = parseInt(raw.NumMedia || '0')
  for (let i = 0; i < numMedia; i++) {
    const url = raw[`MediaUrl${i}`]
    const contentType = raw[`MediaContentType${i}`]
    if (url) {
      mediaUrls.push({
        type: getFileType(contentType),
        url,
        mimeType: contentType,
      })
    }
  }

  return {
    id: raw.MessageSid || crypto.randomUUID(),
    channel,
    channelMessageId: raw.MessageSid,
    externalUserId: raw.From,
    externalUserPhone: raw.From,
    channelConversationId: raw.From, // Use phone number as conversation ID
    content: raw.Body || '',
    attachments: mediaUrls,
    metadata: {
      to: raw.To,
      accountSid: raw.AccountSid,
      status: raw.SmsStatus,
    },
    timestamp: new Date(),
  }
}

function normalizeTeamsMessage(raw: any, ctx: ChannelContext): NormalizedMessage {
  // Remove @mentions
  let content = raw.text || ''
  content = content.replace(/<at>.*?<\/at>/g, '').trim()

  return {
    id: raw.id || crypto.randomUUID(),
    channel: 'teams',
    channelMessageId: raw.id,
    externalUserId: raw.from?.id,
    externalUserName: raw.from?.name,
    externalUserEmail: raw.from?.aadObjectId,
    channelConversationId: raw.conversation?.id,
    content,
    attachments: raw.attachments?.map((a: any) => ({
      type: a.contentType?.includes('image') ? 'image' : 'file',
      url: a.contentUrl,
      name: a.name,
      mimeType: a.contentType,
    })),
    metadata: {
      tenantId: raw.channelData?.tenant?.id,
      serviceUrl: raw.serviceUrl,
      conversationType: raw.conversation?.conversationType,
    },
    timestamp: new Date(raw.timestamp),
  }
}

function normalizeEmailMessage(raw: any, ctx: ChannelContext): NormalizedMessage {
  return {
    id: raw.messageId || raw.id || crypto.randomUUID(),
    channel: 'email',
    channelMessageId: raw.messageId,
    externalUserId: raw.from?.email || raw.from,
    externalUserName: raw.from?.name,
    externalUserEmail: raw.from?.email || raw.from,
    channelConversationId: raw.threadId || raw.inReplyTo,
    content: raw.textBody || raw.text || raw.body || '',
    attachments: raw.attachments?.map((a: any) => ({
      type: getFileType(a.mimeType || a.contentType),
      url: a.url,
      name: a.filename || a.name,
      mimeType: a.mimeType || a.contentType,
      size: a.size,
    })),
    replyToMessageId: raw.inReplyTo,
    metadata: {
      subject: raw.subject,
      to: raw.to,
      cc: raw.cc,
      headers: raw.headers,
    },
    timestamp: new Date(raw.date || raw.timestamp || Date.now()),
  }
}

function normalizeIMessageMessage(raw: any, ctx: ChannelContext): NormalizedMessage {
  return {
    id: raw.message_id || raw.id || crypto.randomUUID(),
    channel: 'imessage',
    channelMessageId: raw.message_id,
    externalUserId: raw.from_number,
    externalUserPhone: raw.from_number,
    channelConversationId: raw.from_number,
    content: raw.content || raw.text || '',
    attachments: raw.media_url ? [{
      type: 'image',
      url: raw.media_url,
    }] : undefined,
    metadata: {
      to: raw.to_number,
      isFromMe: raw.is_from_me,
      accountId: raw.account_id,
    },
    timestamp: new Date(raw.date_sent || Date.now()),
  }
}

function normalizeApiMessage(raw: any, ctx: ChannelContext): NormalizedMessage {
  return {
    id: raw.id || crypto.randomUUID(),
    channel: 'api',
    channelMessageId: raw.id,
    userId: raw.userId,
    externalUserId: raw.externalUserId || raw.userId || 'api-client',
    externalUserName: raw.userName,
    externalUserEmail: raw.userEmail,
    conversationId: raw.conversationId,
    channelConversationId: raw.threadId || raw.conversationId,
    content: raw.message || raw.content,
    attachments: raw.attachments?.map(normalizeAttachment),
    metadata: raw.metadata,
    timestamp: new Date(raw.timestamp || Date.now()),
  }
}

function normalizeAttachment(raw: any): MessageAttachment {
  return {
    type: raw.type || getFileType(raw.mimeType),
    url: raw.url,
    name: raw.name || raw.filename,
    mimeType: raw.mimeType || raw.contentType,
    size: raw.size,
    data: raw.data,
  }
}

function getFileType(mimeType?: string): MessageAttachment['type'] {
  if (!mimeType) return 'file'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'file'
}

// ============================================================================
// MAIN ROUTER
// ============================================================================

/**
 * Route a message through the multi-channel system
 */
export async function routeMessage(
  normalizedMessage: NormalizedMessage,
  channelContext: ChannelContext,
  options: {
    product?: ProductType
    journey?: string
    includeHistory?: boolean
  } = {}
): Promise<RouterResponse> {
  const { product = 'wellsai', journey, includeHistory = true } = options

  try {
    // Resolve user identity
    const identity = await resolveUserIdentity({
      clerkUserId: normalizedMessage.userId,
      email: normalizedMessage.externalUserEmail,
      phone: normalizedMessage.externalUserPhone,
      slackUserId: normalizedMessage.channel === 'slack' ? normalizedMessage.externalUserId : undefined,
      discordUserId: normalizedMessage.channel === 'discord' ? normalizedMessage.externalUserId : undefined,
      teamsUserId: normalizedMessage.channel === 'teams' ? normalizedMessage.externalUserId : undefined,
      imessageId: normalizedMessage.channel === 'imessage' ? normalizedMessage.externalUserId : undefined,
    })

    // Update normalized message with resolved user ID
    if (identity.clerkUserId) {
      normalizedMessage.userId = identity.clerkUserId
    }

    // Find or create conversation
    const { conversationId, isNew, previousChannel } = await findOrCreateConversation(
      normalizedMessage,
      channelContext,
      product
    )

    // Get conversation history if needed
    let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
    if (includeHistory && !isNew) {
      const messages = await getMessages(conversationId, { limit: 20 })
      conversationHistory = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
    }

    // Build context with channel awareness
    const userContext = normalizedMessage.userId
      ? await getUserContext(normalizedMessage.userId)
      : null

    let systemPrompt = await buildSystemPrompt({
      product,
      journey,
      userContext,
      conversationId,
    })

    // Add channel-specific context to system prompt
    systemPrompt += buildChannelContext(normalizedMessage.channel, previousChannel)

    // Add attachment context if present
    if (normalizedMessage.attachments && normalizedMessage.attachments.length > 0) {
      systemPrompt += `\n\nThe user has attached ${normalizedMessage.attachments.length} file(s): ${normalizedMessage.attachments.map(a => a.name || a.type).join(', ')}`
    }

    // Prepare messages for Claude
    const claudeMessages = [
      ...conversationHistory,
      { role: 'user' as const, content: normalizedMessage.content },
    ]

    // Get tools for context
    const tools = getToolsForChannel(product, journey, normalizedMessage.channel)

    // Call Claude
    const startTime = Date.now()
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages: claudeMessages,
    })
    const latencyMs = Date.now() - startTime

    // Extract response
    const textBlock = response.content.find(block => block.type === 'text')
    const toolUse = response.content.find(block => block.type === 'tool_use')
    const assistantMessage = textBlock?.type === 'text' ? textBlock.text : ''

    // Save messages to database
    await addMessage({
      conversationId,
      role: 'user',
      content: normalizedMessage.content,
      productContext: product,
      metadata: {
        channel: normalizedMessage.channel,
        channelMessageId: normalizedMessage.channelMessageId,
        externalUserId: normalizedMessage.externalUserId,
        attachments: normalizedMessage.attachments,
      },
    })

    const savedMessage = await addMessage({
      conversationId,
      role: 'assistant',
      content: assistantMessage,
      productContext: product,
      toolUse: toolUse ? { name: toolUse.name, input: toolUse.input } : undefined,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      modelUsed: 'claude-sonnet-4-20250514',
      latencyMs,
      metadata: {
        channel: normalizedMessage.channel,
      },
    })

    // Extract and update topics
    if (normalizedMessage.userId) {
      const { topics, entities } = await extractTopicsAndEntities(normalizedMessage.content)
      if (topics.length > 0) {
        const existingTopics = userContext?.recentTopics || []
        await updateUserContext(normalizedMessage.userId, {
          recentTopics: [...new Set([...topics, ...existingTopics])].slice(0, 10),
          keyEntities: {
            ...(userContext?.keyEntities || {}),
            ...entities,
          },
        })
      }
    }

    // Generate suggested actions based on response
    const suggestedActions = generateSuggestedActions(assistantMessage, product, journey)

    // Format response for channel
    const formattedResponse = formatResponseForChannel(
      normalizedMessage.channel,
      assistantMessage,
      {
        conversationId,
        messageId: savedMessage.id,
        suggestedActions,
        channelContext,
      }
    )

    return {
      success: true,
      message: assistantMessage,
      formattedResponse,
      conversationId,
      messageId: savedMessage.id,
      toolUse: toolUse ? {
        name: toolUse.name,
        input: toolUse.input,
      } : undefined,
      suggestedActions,
    }
  } catch (error) {
    console.error('Error routing message:', error)

    const errorMessage = 'I apologize, but I encountered an error processing your message. Please try again.'

    return {
      success: false,
      message: errorMessage,
      formattedResponse: formatResponseForChannel(normalizedMessage.channel, errorMessage, {}),
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function buildChannelContext(currentChannel: ChannelType, previousChannel?: ChannelType): string {
  let context = `\n\nCHANNEL CONTEXT:\nUser is communicating via ${getChannelDisplayName(currentChannel)}.`

  if (previousChannel && previousChannel !== currentChannel) {
    context += `\nThey previously messaged via ${getChannelDisplayName(previousChannel)}. Maintain continuity of the conversation.`
  }

  // Add channel-specific formatting hints
  context += getChannelFormattingHints(currentChannel)

  return context
}

function getChannelDisplayName(channel: ChannelType): string {
  const names: Record<ChannelType, string> = {
    web: 'Web Chat',
    slack: 'Slack',
    discord: 'Discord',
    sms: 'SMS',
    whatsapp: 'WhatsApp',
    teams: 'Microsoft Teams',
    email: 'Email',
    imessage: 'iMessage',
    api: 'API',
  }
  return names[channel] || channel
}

function getChannelFormattingHints(channel: ChannelType): string {
  switch (channel) {
    case 'sms':
      return `\nKeep responses concise (under 160 characters when possible). Avoid markdown formatting. Use plain text.`
    case 'email':
      return `\nResponses can be more detailed. Use proper email formatting. Include a greeting and sign-off when appropriate.`
    case 'slack':
      return `\nYou can use Slack's mrkdwn formatting: *bold*, _italic_, ~strikethrough~, \`code\`, \`\`\`code blocks\`\`\`, and links <url|text>.`
    case 'discord':
      return `\nYou can use Discord's markdown: **bold**, *italic*, ~~strikethrough~~, \`code\`, \`\`\`code blocks\`\`\`, and links.`
    case 'teams':
      return `\nYou can use basic markdown formatting and Adaptive Cards for rich content.`
    case 'whatsapp':
      return `\nYou can use WhatsApp formatting: *bold*, _italic_, ~strikethrough~, \`\`\`code\`\`\`.`
    default:
      return ''
  }
}

function getToolsForChannel(
  product: ProductType,
  journey?: string,
  channel?: ChannelType
): Anthropic.Tool[] {
  // Base tools
  const tools: Anthropic.Tool[] = [
    {
      name: 'capture_lead',
      description: 'Capture user requirements and notify the team',
      input_schema: {
        type: 'object' as const,
        properties: {
          requirements: { type: 'string', description: 'Detailed summary of what the user needs' },
          journey: { type: 'string', enum: ['founder', 'buyer', 'seller', 'jobs'] },
          intent: { type: 'string', description: 'Specific intent' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        },
        required: ['requirements', 'journey'],
      },
    },
  ]

  // Add Grain & Vault tools
  if (product === 'grainvault') {
    tools.push(
      {
        name: 'get_balance',
        description: 'Get the current GRAIN balance',
        input_schema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'prepare_payment',
        description: 'Prepare a GRAIN payment for authorization',
        input_schema: {
          type: 'object' as const,
          properties: {
            recipient: { type: 'string', description: 'Recipient wallet address or email' },
            amount: { type: 'number', description: 'Amount of GRAIN to send' },
            memo: { type: 'string', description: 'Optional payment memo' },
          },
          required: ['recipient', 'amount'],
        },
      }
    )
  }

  return tools
}

function generateSuggestedActions(
  response: string,
  product: ProductType,
  journey?: string
): SuggestedAction[] {
  const actions: SuggestedAction[] = []

  // Analyze response for potential actions
  const lowerResponse = response.toLowerCase()

  if (lowerResponse.includes('schedule') || lowerResponse.includes('meeting') || lowerResponse.includes('call')) {
    actions.push({
      id: 'schedule_call',
      label: 'Schedule a Call',
      action: 'schedule_call',
      style: 'primary',
    })
  }

  if (lowerResponse.includes('learn more') || lowerResponse.includes('details')) {
    actions.push({
      id: 'learn_more',
      label: 'Learn More',
      action: 'learn_more',
      style: 'secondary',
    })
  }

  if (product === 'grainvault' && (lowerResponse.includes('balance') || lowerResponse.includes('grain'))) {
    actions.push({
      id: 'view_balance',
      label: 'View Balance',
      action: 'view_balance',
      style: 'primary',
    })
  }

  if (lowerResponse.includes('help') || lowerResponse.includes('support')) {
    actions.push({
      id: 'contact_support',
      label: 'Contact Support',
      action: 'contact_support',
      style: 'secondary',
    })
  }

  return actions.slice(0, 3) // Limit to 3 actions
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  normalizeMessage,
  routeMessage,
  resolveUserIdentity,
  linkChannelIdentity,
  findOrCreateConversation,
}
