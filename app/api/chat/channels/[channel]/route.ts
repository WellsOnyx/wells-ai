// @ts-nocheck
/**
 * Dynamic Multi-Channel Chat Route
 *
 * Unified API endpoint for all chat channels:
 * - /api/chat/channels/web
 * - /api/chat/channels/slack
 * - /api/chat/channels/discord
 * - /api/chat/channels/sms
 * - /api/chat/channels/whatsapp
 * - /api/chat/channels/teams
 * - /api/chat/channels/email
 * - /api/chat/channels/imessage
 * - /api/chat/channels/api
 *
 * Each channel can POST messages and receive appropriately formatted responses.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  normalizeMessage,
  routeMessage,
  resolveUserIdentity,
  ChannelType,
  ChannelContext,
  NormalizedMessage,
} from '@/lib/chat/channel-router'
import { formatResponseForChannel } from '@/lib/chat/channel-formatters'
import { ProductType } from '@/lib/chat/personas'

// ============================================================================
// TYPES
// ============================================================================

interface ChannelRequestBody {
  // Common fields
  message?: string
  content?: string
  conversationId?: string
  product?: ProductType
  journey?: string
  metadata?: Record<string, any>

  // User identification
  userId?: string
  sessionId?: string
  userEmail?: string
  userName?: string
  userPhone?: string

  // Channel-specific fields
  raw?: any // Raw channel payload for webhooks

  // Slack-specific
  user?: string
  channel?: string
  text?: string
  ts?: string
  thread_ts?: string
  team_id?: string

  // Discord-specific
  author?: { id: string; username: string }
  channel_id?: string
  guild_id?: string

  // Twilio-specific
  From?: string
  To?: string
  Body?: string
  MessageSid?: string

  // Teams-specific
  from?: { id: string; name: string }
  conversation?: { id: string }
  serviceUrl?: string

  // Email-specific
  from_email?: string
  subject?: string
  body?: string
  inReplyTo?: string

  // iMessage-specific
  from_number?: string
  to_number?: string
}

// Supported channels
const SUPPORTED_CHANNELS: ChannelType[] = [
  'web',
  'slack',
  'discord',
  'sms',
  'whatsapp',
  'teams',
  'email',
  'imessage',
  'api',
]

// ============================================================================
// POST - Handle incoming messages
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { channel: string } }
) {
  try {
    const channel = params.channel as ChannelType

    // Validate channel
    if (!SUPPORTED_CHANNELS.includes(channel)) {
      return NextResponse.json(
        { error: `Unsupported channel: ${channel}. Supported: ${SUPPORTED_CHANNELS.join(', ')}` },
        { status: 400 }
      )
    }

    // Get authenticated user if available (for web/api channels)
    const { userId: clerkUserId } = await auth().catch(() => ({ userId: null }))

    // Parse request body
    const body: ChannelRequestBody = await request.json()

    // Build channel context
    const channelContext = buildChannelContext(channel, body, request)

    // Normalize the message
    const normalizedMessage = normalizeChannelMessage(channel, body, channelContext, clerkUserId)

    // Validate message content
    if (!normalizedMessage.content || normalizedMessage.content.trim() === '') {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      )
    }

    // Route the message
    const result = await routeMessage(normalizedMessage, channelContext, {
      product: body.product || 'wellsai',
      journey: body.journey,
      includeHistory: true,
    })

    // Return channel-appropriate response
    return formatChannelResponse(channel, result, channelContext)
  } catch (error) {
    console.error(`Error handling ${params.channel} message:`, error)

    return NextResponse.json(
      {
        error: 'Failed to process message',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Get conversation history or status
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { channel: string } }
) {
  try {
    const channel = params.channel as ChannelType
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')

    // Validate channel
    if (!SUPPORTED_CHANNELS.includes(channel)) {
      return NextResponse.json(
        { error: `Unsupported channel: ${channel}` },
        { status: 400 }
      )
    }

    // Get authenticated user
    const { userId: clerkUserId } = await auth().catch(() => ({ userId: null }))

    // Return channel info
    return NextResponse.json({
      channel,
      status: 'active',
      supported: true,
      features: getChannelFeatures(channel),
      conversationId,
      userId: clerkUserId,
    })
  } catch (error) {
    console.error(`Error getting ${params.channel} status:`, error)

    return NextResponse.json(
      { error: 'Failed to get channel status' },
      { status: 500 }
    )
  }
}

// ============================================================================
// OPTIONS - CORS
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Channel-Token',
      'Access-Control-Max-Age': '86400',
    },
  })
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildChannelContext(
  channel: ChannelType,
  body: ChannelRequestBody,
  request: NextRequest
): ChannelContext {
  const context: ChannelContext = {
    channel,
    metadata: body.metadata || {},
  }

  switch (channel) {
    case 'slack':
      context.workspaceId = body.team_id
      context.channelId = body.channel
      context.threadId = body.thread_ts || body.ts
      context.accessToken = request.headers.get('X-Slack-Token') || undefined
      context.botUserId = request.headers.get('X-Slack-Bot-User-Id') || undefined
      break

    case 'discord':
      context.workspaceId = body.guild_id
      context.channelId = body.channel_id
      context.botUserId = request.headers.get('X-Discord-Bot-User-Id') || undefined
      break

    case 'sms':
    case 'whatsapp':
      context.channelId = body.To
      context.metadata = {
        ...context.metadata,
        accountSid: body.raw?.AccountSid,
      }
      break

    case 'teams':
      context.workspaceId = body.raw?.channelData?.tenant?.id
      context.channelId = body.conversation?.id
      context.metadata = {
        ...context.metadata,
        serviceUrl: body.serviceUrl || body.raw?.serviceUrl,
      }
      break

    case 'email':
      context.threadId = body.inReplyTo
      context.metadata = {
        ...context.metadata,
        subject: body.subject,
      }
      break

    case 'imessage':
      context.channelId = body.to_number
      break

    case 'web':
    case 'api':
      context.metadata = {
        ...context.metadata,
        sessionId: body.sessionId,
      }
      break
  }

  return context
}

function normalizeChannelMessage(
  channel: ChannelType,
  body: ChannelRequestBody,
  context: ChannelContext,
  clerkUserId?: string | null
): NormalizedMessage {
  // Build raw message object based on channel
  const rawMessage = buildRawMessage(channel, body)

  // Use the normalizer from channel-router
  const normalized = normalizeMessage(channel, rawMessage, context)

  // Override with Clerk user ID if authenticated
  if (clerkUserId) {
    normalized.userId = clerkUserId
  }

  // Set conversation ID if provided
  if (body.conversationId) {
    normalized.conversationId = body.conversationId
  }

  return normalized
}

function buildRawMessage(channel: ChannelType, body: ChannelRequestBody): any {
  switch (channel) {
    case 'web':
      return {
        id: body.metadata?.messageId,
        userId: body.userId,
        sessionId: body.sessionId,
        userName: body.userName,
        userEmail: body.userEmail,
        message: body.message || body.content,
        conversationId: body.conversationId,
        attachments: body.metadata?.attachments,
        metadata: body.metadata,
        timestamp: Date.now(),
      }

    case 'slack':
      return {
        user: body.user,
        channel: body.channel,
        text: body.text || body.message || body.content,
        ts: body.ts,
        thread_ts: body.thread_ts,
        client_msg_id: body.metadata?.messageId,
        user_profile: {
          real_name: body.userName,
        },
        files: body.metadata?.files,
      }

    case 'discord':
      return {
        id: body.metadata?.messageId,
        author: body.author || { id: body.userId, username: body.userName },
        channel_id: body.channel_id,
        guild_id: body.guild_id,
        content: body.content || body.message,
        attachments: body.metadata?.attachments,
        message_reference: body.metadata?.replyTo ? { message_id: body.metadata.replyTo } : undefined,
        timestamp: new Date().toISOString(),
      }

    case 'sms':
    case 'whatsapp':
      return {
        From: body.From || body.userPhone || body.from_number,
        To: body.To || body.to_number,
        Body: body.Body || body.content || body.message,
        MessageSid: body.MessageSid || body.metadata?.messageId,
        NumMedia: body.metadata?.numMedia || '0',
        ...body.raw,
      }

    case 'teams':
      return {
        id: body.metadata?.messageId,
        from: body.from || { id: body.userId, name: body.userName },
        text: body.content || body.message,
        conversation: body.conversation || { id: body.conversationId },
        serviceUrl: body.serviceUrl,
        timestamp: new Date().toISOString(),
        channelData: {
          tenant: { id: body.metadata?.tenantId },
        },
        ...body.raw,
      }

    case 'email':
      return {
        messageId: body.metadata?.messageId,
        from: body.from_email || body.userEmail
          ? { email: body.from_email || body.userEmail, name: body.userName }
          : body.userEmail,
        subject: body.subject,
        textBody: body.body || body.content || body.message,
        inReplyTo: body.inReplyTo,
        threadId: body.metadata?.threadId,
        attachments: body.metadata?.attachments,
        date: new Date().toISOString(),
      }

    case 'imessage':
      return {
        message_id: body.metadata?.messageId,
        from_number: body.from_number || body.userPhone,
        to_number: body.to_number,
        content: body.content || body.message,
        media_url: body.metadata?.mediaUrl,
        date_sent: new Date().toISOString(),
      }

    case 'api':
      return {
        id: body.metadata?.messageId,
        userId: body.userId,
        externalUserId: body.metadata?.externalUserId,
        userName: body.userName,
        userEmail: body.userEmail,
        message: body.message || body.content,
        conversationId: body.conversationId,
        threadId: body.metadata?.threadId,
        attachments: body.metadata?.attachments,
        metadata: body.metadata,
        timestamp: Date.now(),
      }

    default:
      return body
  }
}

function formatChannelResponse(
  channel: ChannelType,
  result: any,
  context: ChannelContext
): NextResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'X-Conversation-Id': result.conversationId || '',
  }

  // Channel-specific response formats
  switch (channel) {
    case 'slack':
      return NextResponse.json(
        {
          response_type: 'in_channel',
          text: result.message,
          blocks: result.formattedResponse?.richContent?.blocks,
          conversation_id: result.conversationId,
        },
        { headers }
      )

    case 'discord':
      return NextResponse.json(
        {
          content: result.message,
          embeds: result.formattedResponse?.richContent?.embeds,
          components: result.formattedResponse?.richContent?.components,
          conversation_id: result.conversationId,
        },
        { headers }
      )

    case 'sms':
    case 'imessage':
      // Twilio TwiML-style response
      return NextResponse.json(
        {
          message: result.formattedResponse?.text || result.message,
          conversation_id: result.conversationId,
        },
        { headers }
      )

    case 'whatsapp':
      return NextResponse.json(
        {
          messaging_product: 'whatsapp',
          type: result.formattedResponse?.richContent?.type || 'text',
          text: result.formattedResponse?.richContent ? undefined : { body: result.message },
          interactive: result.formattedResponse?.richContent?.interactive,
          conversation_id: result.conversationId,
        },
        { headers }
      )

    case 'teams':
      return NextResponse.json(
        {
          type: 'message',
          text: result.message,
          attachments: result.formattedResponse?.richContent?.attachments,
          conversation_id: result.conversationId,
        },
        { headers }
      )

    case 'email':
      return NextResponse.json(
        {
          text: result.formattedResponse?.text,
          html: result.formattedResponse?.richContent?.html,
          subject: result.formattedResponse?.richContent?.subject,
          conversation_id: result.conversationId,
        },
        { headers }
      )

    case 'web':
    case 'api':
    default:
      return NextResponse.json(
        {
          success: result.success,
          message: result.message,
          conversationId: result.conversationId,
          messageId: result.messageId,
          formattedResponse: result.formattedResponse,
          suggestedActions: result.suggestedActions,
          toolUse: result.toolUse,
          error: result.error,
        },
        { headers }
      )
  }
}

function getChannelFeatures(channel: ChannelType): Record<string, boolean> {
  const features: Record<ChannelType, Record<string, boolean>> = {
    web: {
      markdown: true,
      html: true,
      buttons: true,
      images: true,
      attachments: true,
      threading: true,
      typing: true,
    },
    slack: {
      markdown: true,
      blocks: true,
      buttons: true,
      images: true,
      attachments: true,
      threading: true,
      reactions: true,
      modals: true,
    },
    discord: {
      markdown: true,
      embeds: true,
      buttons: true,
      images: true,
      attachments: true,
      threading: true,
      reactions: true,
    },
    sms: {
      markdown: false,
      buttons: false,
      images: true, // MMS
      attachments: false,
      threading: false,
      charLimit: true,
    },
    whatsapp: {
      markdown: true,
      buttons: true, // Interactive messages
      images: true,
      attachments: true,
      threading: false,
      templates: true,
    },
    teams: {
      markdown: true,
      adaptiveCards: true,
      buttons: true,
      images: true,
      attachments: true,
      threading: true,
    },
    email: {
      markdown: true,
      html: true,
      buttons: true, // As links
      images: true,
      attachments: true,
      threading: true,
    },
    imessage: {
      markdown: false,
      buttons: false,
      images: true,
      attachments: false,
      threading: false,
    },
    api: {
      markdown: true,
      html: true,
      buttons: true,
      images: true,
      attachments: true,
      threading: true,
      fullResponse: true,
    },
  }

  return features[channel] || {}
}
