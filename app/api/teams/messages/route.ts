import { NextRequest, NextResponse } from 'next/server'
import { monitorAPI } from '@/lib/monitoring'
import {
  sendTeamsMessage,
  formatRFQCard,
  formatQuoteCard,
  formatDealCard,
  formatHelpCard,
  TeamsMessage,
} from '@/lib/teams'
import { RFQs } from '@/lib/db'
import { matchSuppliers } from '@/lib/matching'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

/**
 * Microsoft Teams Bot Message Handler
 * POST /api/teams/messages
 *
 * Handles all incoming messages from Teams
 */
export async function POST(req: NextRequest) {
  const monitor = monitorAPI('/api/teams/messages', 'POST')

  try {
    const activity: TeamsMessage = await req.json()

    console.log('[TEAMS] Activity received:', activity.type, activity)

    // Handle different activity types
    let response

    switch (activity.type) {
      case 'message':
        response = await handleMessage(activity)
        break

      case 'invoke':
        response = await handleInvoke(activity)
        break

      case 'conversationUpdate':
        response = await handleConversationUpdate(activity)
        break

      default:
        console.log('[TEAMS] Unhandled activity type:', activity.type)
        response = { status: 200 }
    }

    monitor.end(true)
    return NextResponse.json(response)
  } catch (error) {
    monitor.end(false)
    console.error('[TEAMS] Message handler error:', error)

    return NextResponse.json(
      {
        error: 'Message processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Handle incoming message
 */
async function handleMessage(activity: TeamsMessage) {
  const text = activity.text?.trim() || ''

  // Ignore messages from the bot itself
  if (!text || activity.from.name === 'Wells AI Bot') {
    return { status: 200 }
  }

  // Check if bot was mentioned
  const isMention = text.includes('@Wells AI Bot') || text.includes('@wellsai')
  const cleanText = text
    .replace(/@Wells AI Bot/gi, '')
    .replace(/@wellsai/gi, '')
    .trim()

  if (!cleanText && isMention) {
    // Just mentioned, send help
    await sendTeamsMessage({
      serviceUrl: activity.serviceUrl,
      conversationId: activity.conversation.id,
      botId: activity.recipient.id,
      message: 'Hi! I\'m Wells AI. How can I help?',
      card: formatHelpCard(),
    })
    return { status: 200 }
  }

  // Parse command
  const command = cleanText.toLowerCase()

  if (command.startsWith('create rfq') || command.startsWith('new rfq')) {
    await handleCreateRFQ(activity, cleanText)
  } else if (command.startsWith('find') || command.startsWith('search')) {
    await handleFindSuppliers(activity, cleanText)
  } else if (command.startsWith('negotiate')) {
    await handleNegotiate(activity, cleanText)
  } else if (command.includes('help')) {
    await sendTeamsMessage({
      serviceUrl: activity.serviceUrl,
      conversationId: activity.conversation.id,
      botId: activity.recipient.id,
      message: 'Here\'s what I can do:',
      card: formatHelpCard(),
    })
  } else if (isMention) {
    // Generic response to mentions
    await sendTeamsMessage({
      serviceUrl: activity.serviceUrl,
      conversationId: activity.conversation.id,
      botId: activity.recipient.id,
      message: `You said: "${cleanText}"\n\nI can help with:\n• Creating RFQs\n• Finding suppliers\n• Negotiating deals\n\nTry: **@wellsai create rfq 100 office chairs**`,
    })
  }

  return { status: 200 }
}

/**
 * Handle adaptive card action (button clicks)
 */
async function handleInvoke(activity: any) {
  const action = activity.value?.action
  const data = activity.value

  console.log('[TEAMS] Invoke action:', action, data)

  switch (action) {
    case 'find_suppliers':
      await sendTeamsMessage({
        serviceUrl: activity.serviceUrl,
        conversationId: activity.conversation.id,
        botId: activity.recipient.id,
        message: `🔍 Finding suppliers for RFQ ${data.rfqId}...`,
      })
      break

    case 'start_negotiation':
      await sendTeamsMessage({
        serviceUrl: activity.serviceUrl,
        conversationId: activity.conversation.id,
        botId: activity.recipient.id,
        message: `🤝 Starting negotiation for RFQ ${data.rfqId}...\n\nVisit: ${process.env.NEXT_PUBLIC_BASE_URL}/negotiate/${data.rfqId}`,
      })
      break

    case 'accept_quote':
      await sendTeamsMessage({
        serviceUrl: activity.serviceUrl,
        conversationId: activity.conversation.id,
        botId: activity.recipient.id,
        message: `✅ Accepting quote ${data.quoteId}...\n\nCreating deal and generating contract.`,
      })
      break

    case 'counter_offer':
      await sendTeamsMessage({
        serviceUrl: activity.serviceUrl,
        conversationId: activity.conversation.id,
        botId: activity.recipient.id,
        message: `💬 Counter offer for quote ${data.quoteId}\n\nWhat's your counter-offer price?`,
      })
      break

    case 'reject_quote':
      await sendTeamsMessage({
        serviceUrl: activity.serviceUrl,
        conversationId: activity.conversation.id,
        botId: activity.recipient.id,
        message: `❌ Quote ${data.quoteId} rejected.`,
      })
      break
  }

  return { status: 200 }
}

/**
 * Handle conversation update (bot added/removed)
 */
async function handleConversationUpdate(activity: any) {
  // Bot was added to conversation
  if (activity.membersAdded) {
    for (const member of activity.membersAdded) {
      if (member.id === activity.recipient.id) {
        // Bot was added
        await sendTeamsMessage({
          serviceUrl: activity.serviceUrl,
          conversationId: activity.conversation.id,
          botId: activity.recipient.id,
          message: '👋 Hi! I\'m Wells AI, your procurement assistant.',
          card: formatHelpCard(),
        })
        break
      }
    }
  }

  return { status: 200 }
}

/**
 * Create RFQ from Teams message
 */
async function handleCreateRFQ(activity: TeamsMessage, text: string) {
  try {
    // Remove "create rfq" from text
    const rfqText = text.replace(/create rfq/i, '').replace(/new rfq/i, '').trim()

    if (!rfqText) {
      await sendTeamsMessage({
        serviceUrl: activity.serviceUrl,
        conversationId: activity.conversation.id,
        botId: activity.recipient.id,
        message: '❌ Please specify what you need.\n\nExample: **@wellsai create rfq 100 office chairs, budget $5000**',
      })
      return
    }

    // Simple parsing (avoid Claude API TypeScript issues)
    const parsed = {
      description: rfqText,
      quantity: undefined,
      budget: undefined,
      deadline: undefined,
    }

    // Create RFQ
    const rfq = await RFQs.create({
      buyerEmail: `teams_${activity.from.id}@wellsai.com`,
      productName: parsed.description?.split(',')[0] || 'Unnamed Product',
      description: parsed.description || rfqText,
      quantity: parsed.quantity,
      budget: parsed.budget,
      deadline: parsed.deadline,
      status: 'pending',
      source: 'teams',
      metadata: {
        teamsUserId: activity.from.id,
        teamsUserName: activity.from.name,
        teamsConversationId: activity.conversation.id,
      },
    })

    // Send success message with card
    await sendTeamsMessage({
      serviceUrl: activity.serviceUrl,
      conversationId: activity.conversation.id,
      botId: activity.recipient.id,
      message: `✅ RFQ created: ${rfq.productName}`,
      card: formatRFQCard(rfq),
    })
  } catch (error) {
    console.error('[TEAMS] Create RFQ error:', error)
    await sendTeamsMessage({
      serviceUrl: activity.serviceUrl,
      conversationId: activity.conversation.id,
      botId: activity.recipient.id,
      message: '❌ Failed to create RFQ. Please try again.',
    })
  }
}

/**
 * Find suppliers from Teams
 */
async function handleFindSuppliers(activity: TeamsMessage, text: string) {
  try {
    const searchText = text.replace(/find|search/i, '').trim()

    if (!searchText) {
      await sendTeamsMessage({
        serviceUrl: activity.serviceUrl,
        conversationId: activity.conversation.id,
        botId: activity.recipient.id,
        message: '❌ Please specify what to search for.\n\nExample: **@wellsai find steel suppliers in Texas**',
      })
      return
    }

    // Match suppliers
    const matches = await matchSuppliers({
      productName: searchText,
      description: searchText,
    })

    if (matches.length === 0) {
      await sendTeamsMessage({
        serviceUrl: activity.serviceUrl,
        conversationId: activity.conversation.id,
        botId: activity.recipient.id,
        message: `❌ No suppliers found for: "${searchText}"`,
      })
      return
    }

    const supplierList = matches
      .slice(0, 5)
      .map(
        (match, i) =>
          `${i + 1}. **${match.supplier.name}** (${match.score}/100 match)\n   ${match.supplier.industry || 'N/A'} | ${match.supplier.location || 'N/A'}`
      )
      .join('\n\n')

    await sendTeamsMessage({
      serviceUrl: activity.serviceUrl,
      conversationId: activity.conversation.id,
      botId: activity.recipient.id,
      message: `🔍 Found ${matches.length} suppliers:\n\n${supplierList}`,
    })
  } catch (error) {
    console.error('[TEAMS] Find suppliers error:', error)
    await sendTeamsMessage({
      serviceUrl: activity.serviceUrl,
      conversationId: activity.conversation.id,
      botId: activity.recipient.id,
      message: '❌ Failed to search suppliers. Please try again.',
    })
  }
}

/**
 * Start negotiation from Teams
 */
async function handleNegotiate(activity: TeamsMessage, text: string) {
  await sendTeamsMessage({
    serviceUrl: activity.serviceUrl,
    conversationId: activity.conversation.id,
    botId: activity.recipient.id,
    message: `🤝 **Real-time Negotiation**\n\nVisit the web interface to start negotiations:\n${process.env.NEXT_PUBLIC_BASE_URL}/negotiate\n\n_Direct Teams negotiation coming soon._`,
  })
}
