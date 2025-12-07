// @ts-nocheck
/**
 * MICROSOFT TEAMS WEBHOOK
 *
 * Handle incoming messages from Microsoft Teams.
 * POST /api/chat/teams/webhook
 *
 * Teams Bot Framework webhook endpoint.
 */

import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function POST(request: Request) {
  try {
    const activity = await request.json()

    // Handle different activity types
    switch (activity.type) {
      case 'message':
        return await handleTeamsMessage(activity)

      case 'conversationUpdate':
        return await handleConversationUpdate(activity)

      case 'invoke':
        return await handleInvoke(activity)

      default:
        console.log('Unhandled Teams activity type:', activity.type)
        return NextResponse.json({ ok: true })
    }
  } catch (error) {
    console.error('Teams webhook error:', error)
    return NextResponse.json({ ok: true })
  }
}

// Handle incoming messages
async function handleTeamsMessage(activity: any) {
  const tenantId = activity.channelData?.tenant?.id
  const userId = activity.from?.id
  const userName = activity.from?.name
  const conversationId = activity.conversation?.id
  const message = activity.text || ''
  const serviceUrl = activity.serviceUrl

  // Remove @mention if present
  const cleanMessage = message
    .replace(/<at>.*?<\/at>/g, '')
    .trim()

  // Get workspace
  const workspaceResult = await sql`
    SELECT * FROM chat_workspaces
    WHERE external_workspace_id = ${tenantId}
    AND platform = 'teams'
    AND status = 'active'
  `

  if (workspaceResult.rows.length === 0) {
    // Send welcome message for unknown workspace
    await sendTeamsMessage(serviceUrl, conversationId, activity.conversation?.id, {
      type: 'message',
      text: 'Hi! I\'m Wells AI. To get started, your admin needs to connect this Teams workspace. Visit wellsonyx.io/connect for setup.'
    })
    return NextResponse.json({ ok: true })
  }

  const workspace = workspaceResult.rows[0]

  // Process through NLU
  const result = await sql`
    SELECT * FROM process_chat_message(
      ${workspace.id}::UUID,
      ${userId},
      ${conversationId},
      ${cleanMessage},
      ${activity.conversation?.id || null}
    )
  `

  const processed = result.rows[0]

  // Build response
  let responseCard = null
  const buttons = processed.response_buttons ? JSON.parse(processed.response_buttons) : []

  if (buttons.length > 0) {
    // Build Adaptive Card
    responseCard = {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: processed.response_text,
          wrap: true
        }
      ],
      actions: buttons.map((btn: any) => ({
        type: 'Action.Submit',
        title: btn.text,
        data: {
          action: btn.action,
          conversation_id: processed.conversation_id,
          intent: processed.detected_intent
        }
      }))
    }
  }

  // Send response
  await sendTeamsMessage(serviceUrl, conversationId, activity.conversation?.id, {
    type: 'message',
    text: processed.response_text,
    attachments: responseCard ? [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: responseCard
    }] : undefined
  })

  // Update stats
  await sql`
    UPDATE chat_workspaces
    SET messages_processed = messages_processed + 1,
        last_activity_at = NOW()
    WHERE id = ${workspace.id}::UUID
  `

  return NextResponse.json({ ok: true })
}

// Handle conversation updates (member added/removed)
async function handleConversationUpdate(activity: any) {
  const membersAdded = activity.membersAdded || []
  const botId = activity.recipient?.id

  // Check if bot was added
  const botAdded = membersAdded.some((m: any) => m.id === botId)

  if (botAdded) {
    // Send welcome message
    await sendTeamsMessage(
      activity.serviceUrl,
      activity.conversation?.id,
      activity.conversation?.id,
      {
        type: 'message',
        text: '👋 Hi! I\'m Wells AI, your procurement assistant.\n\n' +
          'Just message me naturally to:\n' +
          '• Search for products\n' +
          '• Place orders\n' +
          '• Check order status\n' +
          '• View your GRAIN rewards\n\n' +
          'Try: "I need to order office supplies"'
      }
    )
  }

  return NextResponse.json({ ok: true })
}

// Handle invoke activities (button clicks, etc.)
async function handleInvoke(activity: any) {
  const data = activity.value?.data || activity.value || {}
  const action = data.action

  // Handle different actions
  switch (action) {
    case 'confirm_order':
      return NextResponse.json({
        type: 'invokeResponse',
        value: {
          status: 200,
          body: {
            type: 'message',
            text: '✅ Order confirmed! Processing...'
          }
        }
      })

    case 'cancel_order':
      return NextResponse.json({
        type: 'invokeResponse',
        value: {
          status: 200,
          body: {
            type: 'message',
            text: '❌ Order cancelled.'
          }
        }
      })

    default:
      return NextResponse.json({
        type: 'invokeResponse',
        value: { status: 200 }
      })
  }
}

// Send message to Teams
async function sendTeamsMessage(
  serviceUrl: string,
  conversationId: string,
  replyToId: string,
  message: any
) {
  const botToken = process.env.TEAMS_BOT_TOKEN

  if (!botToken) {
    console.error('TEAMS_BOT_TOKEN not configured')
    return
  }

  try {
    const url = `${serviceUrl}/v3/conversations/${conversationId}/activities/${replyToId}`

    await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    })
  } catch (error) {
    console.error('Failed to send Teams message:', error)
  }
}
