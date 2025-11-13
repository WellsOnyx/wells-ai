/**
 * Discord integration for unified inbox
 * Stores Discord messages in the inbox system
 */

import { InboundMessages, MessageThreads } from '@/lib/inbox/db'
import { understandMessage } from '@/lib/inbox/understanding'

export async function handleDiscordMessage(params: {
  userId: string
  message: any
}): Promise<string> {
  const { userId, message } = params

  const senderId = message.author.id
  const senderName = message.author.username
  const channelId = message.channel_id
  const content = message.content
  const messageId = message.id

  const threadId = `discord_${channelId}`

  // Find or create thread
  let thread = await MessageThreads.findByPlatformThreadId(userId, 'discord', threadId)

  if (!thread) {
    thread = await MessageThreads.create({
      userId,
      channel: 'discord',
      platformThreadId: threadId,
      subject: `Discord Channel ${channelId}`,
      participants: [
        { id: senderId, name: senderName },
        { id: 'wells' },
      ],
      messageCount: 0,
      status: 'active',
    })
  }

  // Store message
  const inboundMessage = await InboundMessages.create({
    userId,
    channel: 'discord',
    channelMessageId: messageId,
    senderId,
    senderName,
    senderMetadata: {
      channelId,
      discriminator: message.author.discriminator,
    },
    body: content,
    threadId,
    internalThreadId: thread.id,
    isThreadStart: false,
    urgency: 'normal',
    requiresResponse: true,
    rawPayload: message,
  })

  // Analyze message (async)
  analyzeDiscordMessage(inboundMessage.id, {
    body: content,
    senderName,
    channel: 'discord',
  }).catch(console.error)

  return inboundMessage.id
}

async function analyzeDiscordMessage(
  messageId: string,
  params: {
    body: string
    senderName?: string
    channel: string
  }
) {
  const understanding = await understandMessage(params)

  await InboundMessages.markProcessed(messageId, {
    intent: understanding.intent,
    urgency: understanding.urgency,
    sentiment: understanding.sentiment,
    entities: understanding.entities,
    actionItems: understanding.actionItems,
    requiresResponse: understanding.requiresResponse,
    suggestedResponse: understanding.suggestedResponse,
  })
}
