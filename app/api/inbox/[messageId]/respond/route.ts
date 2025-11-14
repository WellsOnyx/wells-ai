/**
 * Message Response API
 * POST /api/inbox/[messageId]/respond - Wells responds to a message
 */

import { NextRequest, NextResponse } from 'next/server'
import { InboundMessages, OutboundMessages, MessageThreads } from '@/lib/inbox/db'
import { draftResponse } from '@/lib/inbox/understanding'
import { monitorAPI } from '@/lib/monitoring'
import { sendEmail } from '@/lib/inbox/channels/email'
import { sendSMS } from '@/lib/inbox/channels/sms'
import { sendSlackMessage as sendSlackDM } from '@/lib/slack'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const monitor = monitorAPI('/api/inbox/[messageId]/respond', 'POST')

  try {
    const { messageId } = await params
    const body = await req.json()

    // Get original message
    const originalMessage = await InboundMessages.findById(messageId)

    if (!originalMessage) {
      monitor.end(false)
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Get user ID from auth
    const userId = req.headers.get('x-user-id') || originalMessage.userId

    // Get response body (user can provide custom response or use AI-suggested)
    let responseBody = body.responseBody

    if (!responseBody) {
      // Use AI-suggested response or generate one
      if (originalMessage.suggestedResponse) {
        responseBody = originalMessage.suggestedResponse
      } else {
        // Generate response
        const threadContext = originalMessage.internalThreadId
          ? await getThreadContext(originalMessage.internalThreadId)
          : undefined

        responseBody = await draftResponse({
          incomingMessage: originalMessage.body,
          intent: originalMessage.intent || 'unknown',
          senderName: originalMessage.senderName,
          threadContext,
        })
      }
    }

    // Create outbound message
    const outboundMessage = await OutboundMessages.create({
      userId,
      inReplyTo: messageId,
      threadId: originalMessage.internalThreadId,
      channel: originalMessage.channel,
      recipientId: originalMessage.senderId,
      recipientEmail: originalMessage.senderEmail,
      recipientPhone: originalMessage.senderPhone,
      subject: originalMessage.subject
        ? `Re: ${originalMessage.subject}`
        : undefined,
      body: responseBody,
      status: body.requireApproval ? 'pending_approval' : 'approved',
      metadata: {
        generatedBy: body.responseBody ? 'user' : 'ai',
      },
    })

    // If auto-approved, send immediately
    if (!body.requireApproval) {
      const sendResult = await sendMessage(outboundMessage)

      if (sendResult.success) {
        await OutboundMessages.markSent(
          outboundMessage.id,
          sendResult.platformMessageId!,
          sendResult.response
        )

        await InboundMessages.markResponded(messageId, outboundMessage.id)
      } else {
        await OutboundMessages.markFailed(outboundMessage.id, sendResult.error!)
      }

      monitor.end(true)
      return NextResponse.json({
        success: true,
        message: 'Response sent',
        outboundMessageId: outboundMessage.id,
        sent: true,
        platformMessageId: sendResult.platformMessageId,
      })
    } else {
      // Pending approval
      monitor.end(true)
      return NextResponse.json({
        success: true,
        message: 'Response created and pending approval',
        outboundMessageId: outboundMessage.id,
        sent: false,
      })
    }
  } catch (error) {
    monitor.end(false)
    console.error('[RESPOND API] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to send response',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Send message via appropriate channel
 */
async function sendMessage(message: any): Promise<{
  success: boolean
  platformMessageId?: string
  response?: any
  error?: string
}> {
  try {
    switch (message.channel) {
      case 'email':
        return await sendEmail({
          to: message.recipientEmail!,
          subject: message.subject!,
          text: message.body,
          html: message.htmlBody,
          inReplyTo: message.metadata?.originalMessageId,
        })

      case 'sms':
        return await sendSMS({
          to: message.recipientPhone!,
          body: message.body,
        })

      case 'slack':
        return await sendSlackDM({
          channel: message.recipientId!,
          text: message.body,
        })

      default:
        return {
          success: false,
          error: `Unsupported channel: ${message.channel}`,
        }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get thread context
 */
async function getThreadContext(threadId: string): Promise<string[]> {
  const messages = await InboundMessages.findByThread(threadId)
  return messages.slice(-5).map((msg) => {
    const sender = msg.senderName || msg.senderEmail || 'Unknown'
    return `${sender}: ${msg.body.substring(0, 200)}`
  })
}
