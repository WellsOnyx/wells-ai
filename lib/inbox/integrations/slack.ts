/**
 * Slack integration for unified inbox
 * Stores Slack messages in the inbox system
 */

import { InboundMessages, MessageThreads, WebhookEvents } from '@/lib/inbox/db'
import { understandMessage } from '@/lib/inbox/understanding'

export async function handleSlackMessage(params: {
  userId: string
  event: any
  webhookEventId?: string
}): Promise<string> {
  const { userId, event, webhookEventId } = params

  // Extract message details
  const senderId = event.user
  const channelId = event.channel
  const text = event.text
  const threadTs = event.thread_ts || event.ts
  const messageTs = event.ts

  // Determine if DM or channel mention
  const isDM = event.channel_type === 'im'
  const threadId = `slack_${channelId}_${threadTs}`

  // Find or create thread
  let thread = await MessageThreads.findByPlatformThreadId(userId, 'slack', threadId)

  if (!thread) {
    thread = await MessageThreads.create({
      userId,
      channel: 'slack',
      platformThreadId: threadId,
      subject: isDM ? 'Direct Message' : `Channel: ${channelId}`,
      participants: [
        { id: senderId },
        { id: 'wells' },
      ],
      messageCount: 0,
      status: 'active',
    })
  }

  // Get user info from Slack API (you may want to cache this)
  const senderName = await getSlackUserName(senderId)

  // Store message
  const message = await InboundMessages.create({
    userId,
    channel: 'slack',
    channelMessageId: messageTs,
    senderId,
    senderName,
    senderMetadata: {
      channelId,
      isDM,
      eventType: event.type,
    },
    body: text,
    threadId,
    internalThreadId: thread.id,
    isThreadStart: !event.thread_ts,
    urgency: 'normal',
    requiresResponse: isDM, // DMs usually require response
    rawPayload: event,
  })

  // Analyze message (async)
  analyzeSlackMessage(message.id, {
    body: text,
    senderName,
    channel: 'slack',
  }).catch(console.error)

  return message.id
}

async function analyzeSlackMessage(
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

async function getSlackUserName(userId: string): Promise<string> {
  // TODO: Call Slack API to get user info
  // For now, return the user ID
  return `User ${userId}`
}
