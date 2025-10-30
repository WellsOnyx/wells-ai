import { NextRequest, NextResponse } from 'next/server'
import { monitorAPI } from '@/lib/monitoring'
import { sendSlackMessage, formatErrorMessage } from '@/lib/slack'

/**
 * Slack Events API Handler
 * POST /api/slack/events
 *
 * Handles Slack Events API (mentions, DMs, reactions, etc.)
 */
export async function POST(req: NextRequest) {
  const monitor = monitorAPI('/api/slack/events', 'POST')

  try {
    const body = await req.json()

    // Handle URL verification challenge
    if (body.type === 'url_verification') {
      monitor.end(true)
      return NextResponse.json({ challenge: body.challenge })
    }

    // Handle events
    if (body.type === 'event_callback') {
      const event = body.event

      console.log('[SLACK] Event received:', event.type, event)

      switch (event.type) {
        case 'app_mention':
          await handleAppMention(event)
          break

        case 'message':
          if (event.channel_type === 'im' && !event.bot_id) {
            await handleDirectMessage(event)
          }
          break

        case 'app_home_opened':
          await handleAppHomeOpened(event)
          break

        default:
          console.log('[SLACK] Unhandled event type:', event.type)
      }

      monitor.end(true)
      return NextResponse.json({ ok: true })
    }

    monitor.end(false)
    return NextResponse.json({ error: 'Unknown event type' }, { status: 400 })
  } catch (error) {
    monitor.end(false)
    console.error('[SLACK] Events error:', error)

    return NextResponse.json(
      {
        error: 'Event processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Handle app mention (@wellsai)
 */
async function handleAppMention(event: any) {
  try {
    const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim()

    if (!text) {
      await sendSlackMessage({
        channel: event.channel,
        text: `Hi! I'm Wells AI, your procurement assistant. Type \`/wells-help\` to see what I can do.`,
        threadTs: event.ts,
      })
      return
    }

    // Echo response (in production, use Claude for intelligent responses)
    await sendSlackMessage({
      channel: event.channel,
      text: `You said: "${text}"\n\nI'm currently learning to respond to mentions. For now, please use slash commands like \`/wells-rfq\` or \`/wells-find\`.`,
      threadTs: event.ts,
    })
  } catch (error) {
    console.error('[SLACK] App mention error:', error)
  }
}

/**
 * Handle direct message
 */
async function handleDirectMessage(event: any) {
  try {
    await sendSlackMessage({
      channel: event.channel,
      text: `Thanks for messaging me! I work best with slash commands.\n\nTry:\n• \`/wells-rfq\` to create a request\n• \`/wells-find\` to search suppliers\n• \`/wells-help\` for full command list`,
    })
  } catch (error) {
    console.error('[SLACK] Direct message error:', error)
  }
}

/**
 * Handle app home opened
 */
async function handleAppHomeOpened(event: any) {
  // In production, publish custom home tab view
  console.log('[SLACK] App home opened by user:', event.user)
}
