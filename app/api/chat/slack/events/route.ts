// @ts-nocheck
/**
 * SLACK EVENTS API
 *
 * Handles Slack Events API webhooks.
 * POST /api/chat/slack/events
 *
 * Supported events:
 * - message: New message in channel/DM
 * - app_mention: Bot mentioned
 * - app_home_opened: User opened app home
 */

import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Handle Slack URL verification challenge
    if (body.type === 'url_verification') {
      return NextResponse.json({ challenge: body.challenge })
    }

    // Handle events
    if (body.type === 'event_callback') {
      const event = body.event
      const teamId = body.team_id

      // Verify workspace exists
      const workspaceResult = await sql`
        SELECT * FROM chat_workspaces
        WHERE external_workspace_id = ${teamId}
        AND platform = 'slack'
        AND status = 'active'
      `

      if (workspaceResult.rows.length === 0) {
        console.log('Unknown Slack workspace:', teamId)
        return NextResponse.json({ ok: true })
      }

      const workspace = workspaceResult.rows[0]

      // Handle different event types
      switch (event.type) {
        case 'message':
          // Ignore bot messages
          if (event.bot_id || event.subtype === 'bot_message') {
            return NextResponse.json({ ok: true })
          }

          // Process user message
          return await handleSlackMessage(event, workspace)

        case 'app_mention':
          return await handleSlackMention(event, workspace)

        case 'app_home_opened':
          return await handleAppHomeOpened(event, workspace)

        default:
          console.log('Unhandled Slack event type:', event.type)
          return NextResponse.json({ ok: true })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Slack events error:', error)
    // Slack requires 200 response within 3 seconds
    return NextResponse.json({ ok: true })
  }
}

// Handle direct messages and channel messages
async function handleSlackMessage(event: any, workspace: any) {
  const userId = event.user
  const channelId = event.channel
  const threadTs = event.thread_ts || event.ts
  const message = event.text

  // Process through our NLU
  const result = await sql`
    SELECT * FROM process_chat_message(
      ${workspace.id}::UUID,
      ${userId},
      ${channelId},
      ${message},
      ${threadTs}
    )
  `

  const processed = result.rows[0]

  // Get response
  let response = processed.response_text
  let blocks = null

  // Build Slack blocks for rich response
  if (processed.response_buttons && JSON.parse(processed.response_buttons).length > 0) {
    const buttons = JSON.parse(processed.response_buttons)
    blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: response
        }
      },
      {
        type: 'actions',
        elements: buttons.map((btn: any) => ({
          type: 'button',
          text: {
            type: 'plain_text',
            text: btn.text,
            emoji: true
          },
          action_id: btn.action,
          value: JSON.stringify({
            conversation_id: processed.conversation_id,
            intent: processed.detected_intent
          })
        }))
      }
    ]
  }

  // Send response via Slack API
  if (workspace.access_token) {
    try {
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${workspace.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: channelId,
          thread_ts: threadTs,
          text: response,
          blocks: blocks
        })
      })
    } catch (slackError) {
      console.error('Slack API error:', slackError)
    }
  }

  // Update stats
  await sql`
    UPDATE chat_workspaces
    SET messages_processed = messages_processed + 1,
        last_activity_at = NOW()
    WHERE id = ${workspace.id}::UUID
  `

  return NextResponse.json({
    ok: true,
    intent: processed.detected_intent,
    confidence: processed.confidence
  })
}

// Handle @mentions
async function handleSlackMention(event: any, workspace: any) {
  // Remove the @mention from the text
  const botId = workspace.bot_user_id
  const message = event.text.replace(`<@${botId}>`, '').trim()

  // Process as regular message
  return await handleSlackMessage({ ...event, text: message }, workspace)
}

// Handle app home tab opened
async function handleAppHomeOpened(event: any, workspace: any) {
  const userId = event.user

  // Get user's stats
  const userStats = await sql`
    SELECT
      cu.*,
      (SELECT COUNT(*) FROM chat_orders WHERE user_id = cu.id) as total_orders,
      (SELECT SUM(total) FROM chat_orders WHERE user_id = cu.id AND status = 'completed') as total_spend
    FROM chat_users cu
    WHERE cu.workspace_id = ${workspace.id}::UUID
    AND cu.external_user_id = ${userId}
  `

  const user = userStats.rows[0] || {}

  // Build home view
  const homeBlocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🛒 Wells AI Procurement',
        emoji: true
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Welcome back! Just type naturally to:\n• Search for products\n• Place orders\n• Check order status\n• View your GRAIN rewards`
      }
    },
    {
      type: 'divider'
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Your Stats*\n📦 Orders: ${user.total_orders || 0}\n💰 Total Spend: $${parseFloat(user.total_spend || 0).toFixed(2)}\n🌾 GRAIN Balance: Coming soon`
      }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🔍 Search Products',
            emoji: true
          },
          action_id: 'search_products'
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '📦 My Orders',
            emoji: true
          },
          action_id: 'my_orders'
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🌾 GRAIN Balance',
            emoji: true
          },
          action_id: 'grain_balance'
        }
      ]
    }
  ]

  // Publish home view
  if (workspace.access_token) {
    try {
      await fetch('https://slack.com/api/views.publish', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${workspace.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          view: {
            type: 'home',
            blocks: homeBlocks
          }
        })
      })
    } catch (err) {
      console.error('Failed to publish home view:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
