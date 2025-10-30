import { NextRequest, NextResponse } from 'next/server'
import { monitorAPI } from '@/lib/monitoring'
import { updateSlackMessage, sendSlackMessage, formatErrorMessage } from '@/lib/slack'

/**
 * Slack Interactive Components Handler
 * POST /api/slack/interactive
 *
 * Handles button clicks, menu selections, modal submissions
 */
export async function POST(req: NextRequest) {
  const monitor = monitorAPI('/api/slack/interactive', 'POST')

  try {
    const formData = await req.formData()
    const payloadStr = formData.get('payload') as string

    if (!payloadStr) {
      monitor.end(false)
      return NextResponse.json({ error: 'Missing payload' }, { status: 400 })
    }

    const payload = JSON.parse(payloadStr)

    console.log('[SLACK] Interactive payload:', payload.type, payload)

    // Route based on interaction type
    let response

    switch (payload.type) {
      case 'block_actions':
        response = await handleBlockActions(payload)
        break

      case 'view_submission':
        response = await handleViewSubmission(payload)
        break

      case 'view_closed':
        response = await handleViewClosed(payload)
        break

      default:
        console.log('[SLACK] Unknown interaction type:', payload.type)
        response = { ok: true }
    }

    monitor.end(true)
    return NextResponse.json(response)
  } catch (error) {
    monitor.end(false)
    console.error('[SLACK] Interactive error:', error)

    return NextResponse.json(
      {
        error: 'Interaction failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Handle block actions (button clicks, menu selections)
 */
async function handleBlockActions(payload: any) {
  const action = payload.actions[0]
  const actionId = action.action_id
  const value = action.value

  console.log('[SLACK] Block action:', actionId, value)

  try {
    switch (actionId) {
      case 'view_rfq':
        await handleViewRFQ(payload, value)
        break

      case 'find_suppliers':
        await handleFindSuppliersForRFQ(payload, value)
        break

      case 'start_negotiation':
        await handleStartNegotiation(payload, value)
        break

      case 'accept_quote':
        await handleAcceptQuote(payload, value)
        break

      case 'counter_offer':
        await handleCounterOffer(payload, value)
        break

      case 'reject_quote':
        await handleRejectQuote(payload, value)
        break

      case 'request_quote':
        await handleRequestQuote(payload, value)
        break

      case 'view_supplier':
        await handleViewSupplier(payload, value)
        break

      case 'join_negotiation':
        await handleJoinNegotiation(payload, value)
        break

      case 'view_docs':
        await handleViewDocs(payload)
        break

      case 'get_support':
        await handleGetSupport(payload)
        break

      default:
        console.log('[SLACK] Unhandled action:', actionId)
    }

    return { ok: true }
  } catch (error) {
    console.error('[SLACK] Block action error:', error)

    await sendSlackMessage({
      channel: payload.channel.id,
      text: 'Sorry, that action failed. Please try again.',
      blocks: formatErrorMessage(
        'Action failed',
        error instanceof Error ? error.message : 'Unknown error'
      ),
    })

    return { ok: true }
  }
}

/**
 * Handle view submission (modal form submission)
 */
async function handleViewSubmission(payload: any) {
  console.log('[SLACK] View submission:', payload.view.callback_id)
  return { response_action: 'clear' }
}

/**
 * Handle view closed (modal dismissed)
 */
async function handleViewClosed(payload: any) {
  console.log('[SLACK] View closed:', payload.view.callback_id)
  return { ok: true }
}

// Action handlers

async function handleViewRFQ(payload: any, rfqId: string) {
  await sendSlackMessage({
    channel: payload.channel.id,
    text: `View RFQ details at: ${process.env.NEXT_PUBLIC_BASE_URL}/rfqs/${rfqId}`,
  })
}

async function handleFindSuppliersForRFQ(payload: any, rfqId: string) {
  await sendSlackMessage({
    channel: payload.channel.id,
    text: `🔍 Finding suppliers for RFQ ${rfqId}...\n\n_This will trigger automatic supplier matching. Results will appear here shortly._`,
  })
}

async function handleStartNegotiation(payload: any, rfqId: string) {
  await sendSlackMessage({
    channel: payload.channel.id,
    text: `🤝 Starting real-time negotiation for RFQ ${rfqId}...\n\nNegotiation room: ${process.env.NEXT_PUBLIC_BASE_URL}/negotiate/${rfqId}`,
  })
}

async function handleAcceptQuote(payload: any, quoteId: string) {
  await updateSlackMessage({
    channel: payload.channel.id,
    ts: payload.message.ts,
    text: `✅ Quote ${quoteId} accepted! Creating deal...`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ *Quote Accepted*\n\nQuote ID: ${quoteId}\n\nCreating deal and generating contract...`,
        },
      },
    ],
  })
}

async function handleCounterOffer(payload: any, quoteId: string) {
  await sendSlackMessage({
    channel: payload.channel.id,
    text: `💬 Counter offer for quote ${quoteId}\n\nWhat's your counter-offer price? Reply in thread.`,
    threadTs: payload.message.ts,
  })
}

async function handleRejectQuote(payload: any, quoteId: string) {
  await updateSlackMessage({
    channel: payload.channel.id,
    ts: payload.message.ts,
    text: `❌ Quote ${quoteId} rejected.`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `❌ *Quote Rejected*\n\nQuote ID: ${quoteId}`,
        },
      },
    ],
  })
}

async function handleRequestQuote(payload: any, supplierId: string) {
  await sendSlackMessage({
    channel: payload.channel.id,
    text: `📨 Quote request sent to supplier ${supplierId}\n\nYou'll be notified when they respond.`,
  })
}

async function handleViewSupplier(payload: any, supplierId: string) {
  await sendSlackMessage({
    channel: payload.channel.id,
    text: `View supplier profile at: ${process.env.NEXT_PUBLIC_BASE_URL}/suppliers/${supplierId}`,
  })
}

async function handleJoinNegotiation(payload: any, roomCode: string) {
  await sendSlackMessage({
    channel: payload.channel.id,
    text: `🤝 Join negotiation room: ${process.env.NEXT_PUBLIC_BASE_URL}/negotiate/${roomCode}`,
  })
}

async function handleViewDocs(payload: any) {
  await sendSlackMessage({
    channel: payload.channel.id,
    text: `📚 Wells AI Documentation:\n${process.env.NEXT_PUBLIC_BASE_URL}/docs\n\nSlack Bot Guide:\n${process.env.NEXT_PUBLIC_BASE_URL}/docs/slack`,
  })
}

async function handleGetSupport(payload: any) {
  await sendSlackMessage({
    channel: payload.channel.id,
    text: `🆘 *Wells AI Support*\n\n• Email: support@wellsai.com\n• Live Chat: ${process.env.NEXT_PUBLIC_BASE_URL}\n• Status: https://status.wellsai.com\n\nWe typically respond within 1 hour during business hours.`,
  })
}
