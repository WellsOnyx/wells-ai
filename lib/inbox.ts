// Unified Inbox Library for Wells AI
// Aggregates messages from all channels into a single thread view

import { sql } from '@vercel/postgres'
import Anthropic from '@anthropic-ai/sdk'

// All supported communication channels
export type Channel =
  | 'sms'           // Twilio SMS
  | 'imessage'      // Apple iMessage (via Sendblue or similar)
  | 'gmail'         // Google Gmail
  | 'outlook'       // Microsoft Outlook
  | 'email'         // Generic email (Resend)
  | 'slack'         // Slack
  | 'discord'       // Discord
  | 'twitter'       // X (formerly Twitter)
  | 'instagram'     // Instagram DMs
  | 'linkedin'      // LinkedIn Messages
  | 'whatsapp'      // WhatsApp Business
  | 'chat'          // Website chat widget
  | 'teams'         // Microsoft Teams
  | 'telegram'      // Telegram

// Channel display info
export const CHANNEL_INFO: Record<Channel, { name: string; color: string; icon: string }> = {
  sms: { name: 'SMS', color: '#22C55E', icon: '💬' },
  imessage: { name: 'iMessage', color: '#34D399', icon: '🍎' },
  gmail: { name: 'Gmail', color: '#EA4335', icon: '📧' },
  outlook: { name: 'Outlook', color: '#0078D4', icon: '📨' },
  email: { name: 'Email', color: '#6366F1', icon: '✉️' },
  slack: { name: 'Slack', color: '#4A154B', icon: '💼' },
  discord: { name: 'Discord', color: '#5865F2', icon: '🎮' },
  twitter: { name: 'X', color: '#000000', icon: '𝕏' },
  instagram: { name: 'Instagram', color: '#E4405F', icon: '📷' },
  linkedin: { name: 'LinkedIn', color: '#0A66C2', icon: '💼' },
  whatsapp: { name: 'WhatsApp', color: '#25D366', icon: '📱' },
  chat: { name: 'Website', color: '#8B5CF6', icon: '💻' },
  teams: { name: 'Teams', color: '#6264A7', icon: '👥' },
  telegram: { name: 'Telegram', color: '#0088CC', icon: '✈️' },
}

// Auto-migrate flag to ensure we only try once per cold start
let tablesInitialized = false

// Ensure inbox tables exist (auto-migration)
async function ensureTablesExist(): Promise<void> {
  if (tablesInitialized) return

  try {
    // Check if tables exist
    const check = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'inbox_conversations'
      ) as exists
    `

    if (check.rows[0].exists) {
      tablesInitialized = true
      return
    }

    console.log('[Inbox] Creating tables...')

    // Create inbox_conversations table
    await sql`
      CREATE TABLE IF NOT EXISTS inbox_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id TEXT NOT NULL,
        contact_name TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        contact_company TEXT,
        subject TEXT,
        channel TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT DEFAULT 'normal',
        intent TEXT,
        sentiment TEXT,
        category TEXT,
        assigned_to TEXT,
        unread_count INTEGER DEFAULT 1,
        last_message_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_message_preview TEXT,
        lead_id UUID,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `

    // Create inbox_messages table
    await sql`
      CREATE TABLE IF NOT EXISTS inbox_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL,
        content TEXT NOT NULL,
        content_html TEXT,
        direction TEXT NOT NULL,
        sender_type TEXT NOT NULL,
        sender_id TEXT,
        sender_name TEXT,
        channel TEXT NOT NULL,
        channel_message_id TEXT,
        email_subject TEXT,
        email_from TEXT,
        email_to TEXT,
        email_cc TEXT,
        email_attachments JSONB DEFAULT '[]',
        sms_from TEXT,
        sms_to TEXT,
        ai_generated BOOLEAN DEFAULT FALSE,
        ai_approved BOOLEAN,
        ai_approved_by TEXT,
        ai_approved_at TIMESTAMP,
        status TEXT DEFAULT 'sent',
        error_message TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        sent_at TIMESTAMP,
        delivered_at TIMESTAMP,
        read_at TIMESTAMP
      )
    `

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_inbox_conversations_contact ON inbox_conversations(contact_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_inbox_conversations_status ON inbox_conversations(status)`
    await sql`CREATE INDEX IF NOT EXISTS idx_inbox_conversations_channel ON inbox_conversations(channel)`
    await sql`CREATE INDEX IF NOT EXISTS idx_inbox_messages_conversation ON inbox_messages(conversation_id)`

    console.log('[Inbox] Tables created successfully')
    tablesInitialized = true
  } catch (error) {
    console.error('[Inbox] Error creating tables:', error)
    // Mark as initialized to avoid repeated failures
    tablesInitialized = true
    throw error
  }
}
export type MessageDirection = 'inbound' | 'outbound'
export type SenderType = 'contact' | 'user' | 'ai' | 'system'
export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'archived'

export interface Conversation {
  id: string
  contact_id: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  contact_company?: string
  subject?: string
  channel: Channel
  status: ConversationStatus
  priority: 'low' | 'normal' | 'high' | 'urgent'
  intent?: string
  sentiment?: 'positive' | 'neutral' | 'negative'
  category?: string
  assigned_to?: string
  unread_count: number
  last_message_at: Date
  last_message_preview?: string
  lead_id?: string
  created_at: Date
  updated_at: Date
}

export interface Message {
  id: string
  conversation_id: string
  content: string
  content_html?: string
  direction: MessageDirection
  sender_type: SenderType
  sender_id?: string
  sender_name?: string
  channel: Channel
  channel_message_id?: string
  ai_generated: boolean
  ai_approved?: boolean
  status: string
  created_at: Date
  sent_at?: Date
}

// Get all conversations (inbox list)
export async function getConversations(options: {
  status?: ConversationStatus
  channel?: Channel
  limit?: number
  offset?: number
  search?: string
} = {}): Promise<Conversation[]> {
  await ensureTablesExist()
  const { status, channel, limit = 50, offset = 0, search } = options

  let query = `
    SELECT * FROM inbox_conversations
    WHERE 1=1
  `
  const params: any[] = []
  let paramIndex = 1

  if (status) {
    query += ` AND status = $${paramIndex++}`
    params.push(status)
  }

  if (channel) {
    query += ` AND channel = $${paramIndex++}`
    params.push(channel)
  }

  if (search) {
    query += ` AND (
      contact_name ILIKE $${paramIndex} OR
      contact_email ILIKE $${paramIndex} OR
      contact_company ILIKE $${paramIndex} OR
      last_message_preview ILIKE $${paramIndex}
    )`
    params.push(`%${search}%`)
    paramIndex++
  }

  query += ` ORDER BY last_message_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
  params.push(limit, offset)

  const result = await sql.query(query, params)
  return result.rows as Conversation[]
}

// Get single conversation with messages
export async function getConversation(id: string): Promise<{
  conversation: Conversation
  messages: Message[]
} | null> {
  const convResult = await sql`
    SELECT * FROM inbox_conversations WHERE id = ${id}
  `

  if (convResult.rows.length === 0) return null

  const messagesResult = await sql`
    SELECT * FROM inbox_messages
    WHERE conversation_id = ${id}
    ORDER BY created_at ASC
  `

  // Mark as read
  await sql`
    UPDATE inbox_conversations
    SET unread_count = 0, updated_at = NOW()
    WHERE id = ${id}
  `

  return {
    conversation: convResult.rows[0] as Conversation,
    messages: messagesResult.rows as Message[]
  }
}

// Find or create conversation for a contact
export async function findOrCreateConversation(contact: {
  id: string
  name?: string
  email?: string
  phone?: string
  company?: string
  channel: Channel
}): Promise<Conversation> {
  await ensureTablesExist()
  // Try to find existing open conversation
  const existing = await sql`
    SELECT * FROM inbox_conversations
    WHERE contact_id = ${contact.id}
      AND channel = ${contact.channel}
      AND status IN ('open', 'pending')
    ORDER BY last_message_at DESC
    LIMIT 1
  `

  if (existing.rows.length > 0) {
    return existing.rows[0] as Conversation
  }

  // Create new conversation
  const result = await sql`
    INSERT INTO inbox_conversations (
      contact_id, contact_name, contact_email, contact_phone,
      contact_company, channel, status, priority
    ) VALUES (
      ${contact.id},
      ${contact.name || null},
      ${contact.email || null},
      ${contact.phone || null},
      ${contact.company || null},
      ${contact.channel},
      'open',
      'normal'
    )
    RETURNING *
  `

  return result.rows[0] as Conversation
}

// Add message to conversation
export async function addMessage(params: {
  conversation_id: string
  content: string
  direction: MessageDirection
  sender_type: SenderType
  sender_id?: string
  sender_name?: string
  channel: Channel
  channel_message_id?: string
  ai_generated?: boolean
  content_html?: string
}): Promise<Message> {
  const {
    conversation_id,
    content,
    direction,
    sender_type,
    sender_id,
    sender_name,
    channel,
    channel_message_id,
    ai_generated = false,
    content_html
  } = params

  // Insert message
  const result = await sql`
    INSERT INTO inbox_messages (
      conversation_id, content, content_html, direction, sender_type,
      sender_id, sender_name, channel, channel_message_id,
      ai_generated, status, sent_at
    ) VALUES (
      ${conversation_id},
      ${content},
      ${content_html || null},
      ${direction},
      ${sender_type},
      ${sender_id || null},
      ${sender_name || null},
      ${channel},
      ${channel_message_id || null},
      ${ai_generated},
      'sent',
      NOW()
    )
    RETURNING *
  `

  // Update conversation
  const unreadIncrement = direction === 'inbound' ? 1 : 0
  await sql`
    UPDATE inbox_conversations
    SET
      last_message_at = NOW(),
      last_message_preview = ${content.substring(0, 200)},
      unread_count = unread_count + ${unreadIncrement},
      updated_at = NOW()
    WHERE id = ${conversation_id}
  `

  return result.rows[0] as Message
}

// Generate AI response for a conversation
export async function generateAIResponse(
  conversationId: string,
  customPrompt?: string
): Promise<{ content: string; messageId: string }> {
  // Get conversation and messages
  const data = await getConversation(conversationId)
  if (!data) throw new Error('Conversation not found')

  const { conversation, messages } = data

  // Build conversation history for Claude
  const messageHistory = messages.map(m => ({
    role: m.direction === 'inbound' ? 'user' : 'assistant' as const,
    content: m.content
  }))

  // System prompt based on channel and context
  const systemPrompt = customPrompt || `You are Wells, an AI assistant for Wells Onyx, a B2B commerce platform.

You're responding to a ${conversation.channel} message from ${conversation.contact_name || 'a contact'}${conversation.contact_company ? ` at ${conversation.contact_company}` : ''}.

Context:
- Channel: ${conversation.channel}
- Contact: ${conversation.contact_name || 'Unknown'}
- Company: ${conversation.contact_company || 'Unknown'}
- Intent: ${conversation.intent || 'General inquiry'}

Guidelines:
- Be professional, helpful, and concise
- For SMS, keep responses under 160 characters when possible
- For email, use proper formatting
- Always aim to move the conversation forward
- If they need a quote, offer to connect them with suppliers
- If they're a supplier, explain our marketplace benefits

Respond naturally as if continuing the conversation.`

  const anthropic = new Anthropic()

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: messageHistory
  })

  const aiContent = response.content[0].type === 'text'
    ? response.content[0].text
    : ''

  // Save AI response as pending approval
  const message = await sql`
    INSERT INTO inbox_messages (
      conversation_id, content, direction, sender_type,
      channel, ai_generated, status
    ) VALUES (
      ${conversationId},
      ${aiContent},
      'outbound',
      'ai',
      ${conversation.channel},
      true,
      'pending_approval'
    )
    RETURNING *
  `

  return {
    content: aiContent,
    messageId: message.rows[0].id
  }
}

// Approve and send AI message
export async function approveAndSendMessage(
  messageId: string,
  userId: string,
  editedContent?: string
): Promise<Message> {
  const result = await sql`
    UPDATE inbox_messages
    SET
      content = COALESCE(${editedContent || null}, content),
      ai_approved = true,
      ai_approved_by = ${userId},
      ai_approved_at = NOW(),
      status = 'sending',
      sent_at = NOW()
    WHERE id = ${messageId}
    RETURNING *
  `

  if (result.rows.length === 0) {
    throw new Error('Message not found')
  }

  const message = result.rows[0] as Message

  // Actually send via the appropriate channel
  await sendViaChannel(message)

  // Update status to sent
  await sql`
    UPDATE inbox_messages SET status = 'sent' WHERE id = ${messageId}
  `

  return message
}

// Send message via the appropriate channel
async function sendViaChannel(message: Message): Promise<void> {
  // Get conversation for contact info
  const convResult = await sql`
    SELECT * FROM inbox_conversations WHERE id = ${message.conversation_id}
  `
  const conversation = convResult.rows[0] as Conversation

  switch (message.channel) {
    case 'sms':
      await sendSMS(conversation.contact_phone!, message.content)
      break
    case 'imessage':
      await sendIMessage(conversation.contact_phone!, message.content)
      break
    case 'gmail':
    case 'outlook':
    case 'email':
      await sendEmail(conversation.contact_email!, message.content, conversation.subject)
      break
    case 'slack':
      await sendSlack(conversation.contact_id, message.content)
      break
    case 'discord':
      await sendDiscord(conversation.contact_id, message.content)
      break
    case 'twitter':
      await sendTwitterDM(conversation.contact_id, message.content)
      break
    case 'instagram':
      await sendInstagramDM(conversation.contact_id, message.content)
      break
    case 'linkedin':
      await sendLinkedInMessage(conversation.contact_id, message.content)
      break
    case 'whatsapp':
      await sendWhatsApp(conversation.contact_phone!, message.content)
      break
    case 'teams':
      await sendTeamsMessage(conversation.contact_id, message.content)
      break
    case 'telegram':
      await sendTelegram(conversation.contact_id, message.content)
      break
    case 'chat':
      // Website chat - typically handled via websocket/realtime
      console.log('[Inbox] Website chat response queued:', message.content.slice(0, 50))
      break
    default:
      console.log(`[Inbox] Channel ${message.channel} send not implemented`)
  }
}

// Send SMS via Twilio
async function sendSMS(to: string, body: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !from) {
    throw new Error('Twilio credentials not configured')
  }

  const twilio = require('twilio')(accountSid, authToken)

  await twilio.messages.create({
    body,
    from,
    to
  })
}

// Send email via Resend
async function sendEmail(to: string, body: string, subject?: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('Resend API key not configured')
  }

  const { Resend } = require('resend')
  const resend = new Resend(apiKey)

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'wells@wellsonyx.com',
    to,
    subject: subject || 'Re: Your inquiry',
    text: body
  })
}

// Send iMessage via Sendblue or similar
async function sendIMessage(to: string, body: string): Promise<void> {
  const apiKey = process.env.SENDBLUE_API_KEY
  if (!apiKey) {
    console.log('[Inbox] iMessage not configured - SENDBLUE_API_KEY required')
    return
  }

  const response = await fetch('https://api.sendblue.co/api/send-message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'sb-api-key-id': process.env.SENDBLUE_API_KEY_ID || '',
      'sb-api-secret-key': apiKey
    },
    body: JSON.stringify({
      number: to,
      content: body
    })
  })

  if (!response.ok) {
    throw new Error(`Sendblue error: ${response.status}`)
  }
}

// Send Slack message via Webhook or API
async function sendSlack(channelOrUserId: string, body: string): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) {
    console.log('[Inbox] Slack not configured - SLACK_BOT_TOKEN required')
    return
  }

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel: channelOrUserId,
      text: body
    })
  })

  const result = await response.json()
  if (!result.ok) {
    throw new Error(`Slack error: ${result.error}`)
  }
}

// Send Discord message via Webhook
async function sendDiscord(channelId: string, body: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) {
    console.log('[Inbox] Discord not configured - DISCORD_WEBHOOK_URL required')
    return
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: body
    })
  })

  if (!response.ok) {
    throw new Error(`Discord error: ${response.status}`)
  }
}

// Send Twitter/X DM
async function sendTwitterDM(userId: string, body: string): Promise<void> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN
  if (!bearerToken) {
    console.log('[Inbox] Twitter/X not configured - TWITTER_BEARER_TOKEN required')
    return
  }

  const response = await fetch(`https://api.twitter.com/2/dm_conversations/with/${userId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: body
    })
  })

  if (!response.ok) {
    throw new Error(`Twitter error: ${response.status}`)
  }
}

// Send Instagram DM via Meta Graph API
async function sendInstagramDM(userId: string, body: string): Promise<void> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
  const pageId = process.env.INSTAGRAM_PAGE_ID
  if (!accessToken || !pageId) {
    console.log('[Inbox] Instagram not configured - INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_PAGE_ID required')
    return
  }

  const response = await fetch(`https://graph.facebook.com/v18.0/${pageId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      recipient: { id: userId },
      message: { text: body }
    })
  })

  if (!response.ok) {
    throw new Error(`Instagram error: ${response.status}`)
  }
}

// Send LinkedIn message
async function sendLinkedInMessage(userId: string, body: string): Promise<void> {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN
  if (!accessToken) {
    console.log('[Inbox] LinkedIn not configured - LINKEDIN_ACCESS_TOKEN required')
    return
  }

  // LinkedIn messaging API requires approved access
  const response = await fetch('https://api.linkedin.com/v2/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify({
      recipients: [userId],
      body: body
    })
  })

  if (!response.ok) {
    console.log('[Inbox] LinkedIn API error - this requires approved partner access')
  }
}

// Send WhatsApp message via Twilio
async function sendWhatsApp(to: string, body: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_NUMBER

  if (!accountSid || !authToken || !from) {
    console.log('[Inbox] WhatsApp not configured - Twilio credentials required')
    return
  }

  const twilio = require('twilio')(accountSid, authToken)

  await twilio.messages.create({
    body,
    from: `whatsapp:${from}`,
    to: `whatsapp:${to}`
  })
}

// Send Microsoft Teams message
async function sendTeamsMessage(conversationId: string, body: string): Promise<void> {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL
  if (!webhookUrl) {
    console.log('[Inbox] Teams not configured - TEAMS_WEBHOOK_URL required')
    return
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: body
    })
  })

  if (!response.ok) {
    throw new Error(`Teams error: ${response.status}`)
  }
}

// Send Telegram message
async function sendTelegram(chatId: string, body: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    console.log('[Inbox] Telegram not configured - TELEGRAM_BOT_TOKEN required')
    return
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: body
    })
  })

  if (!response.ok) {
    throw new Error(`Telegram error: ${response.status}`)
  }
}

// Update conversation status
export async function updateConversationStatus(
  id: string,
  status: ConversationStatus
): Promise<Conversation> {
  const result = await sql`
    UPDATE inbox_conversations
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return result.rows[0] as Conversation
}

// Classify message intent using AI
export async function classifyMessage(content: string): Promise<{
  intent: string
  sentiment: 'positive' | 'neutral' | 'negative'
  category: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
}> {
  const anthropic = new Anthropic()

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    system: `Analyze this message and return JSON with:
- intent: What does the sender want? (quote_request, support, sales_inquiry, partnership, complaint, general)
- sentiment: positive, neutral, or negative
- category: Business category (procurement, technology, food_service, etc.)
- priority: low, normal, high, or urgent

Return only valid JSON.`,
    messages: [{ role: 'user', content }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'

  try {
    return JSON.parse(text)
  } catch {
    return {
      intent: 'general',
      sentiment: 'neutral',
      category: 'unknown',
      priority: 'normal'
    }
  }
}

// Get inbox stats
export async function getInboxStats(): Promise<{
  total: number
  unread: number
  open: number
  pending: number
  byChannel: Record<string, number>
}> {
  const result = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE unread_count > 0) as unread,
      COUNT(*) FILTER (WHERE status = 'open') as open,
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      channel,
      COUNT(*) as channel_count
    FROM inbox_conversations
    GROUP BY channel
  `

  const stats = {
    total: 0,
    unread: 0,
    open: 0,
    pending: 0,
    byChannel: {} as Record<string, number>
  }

  for (const row of result.rows) {
    stats.total = Number(row.total)
    stats.unread = Number(row.unread)
    stats.open = Number(row.open)
    stats.pending = Number(row.pending)
    stats.byChannel[row.channel] = Number(row.channel_count)
  }

  return stats
}
