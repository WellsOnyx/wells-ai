import { NextRequest, NextResponse } from 'next/server'
import { monitorAPI } from '@/lib/monitoring'
import { GChatMessage, formatRFQCard, formatQuoteCard, formatHelpCard } from '@/lib/gchat'
import { RFQs } from '@/lib/db'
import { matchSuppliers } from '@/lib/matching'

/**
 * Google Chat Bot Message Handler
 * POST /api/gchat/messages
 *
 * Handles all incoming messages from Google Chat
 */
export async function POST(req: NextRequest) {
  const monitor = monitorAPI('/api/gchat/messages', 'POST')

  try {
    const event: GChatMessage = await req.json()

    console.log('[GCHAT] Event received:', event.type, event)

    // Handle different event types
    let response

    switch (event.type) {
      case 'MESSAGE':
        response = await handleMessage(event)
        break

      case 'ADDED_TO_SPACE':
        response = await handleAddedToSpace(event)
        break

      case 'REMOVED_FROM_SPACE':
        response = await handleRemovedFromSpace(event)
        break

      case 'CARD_CLICKED':
        response = await handleCardClicked(event)
        break

      default:
        console.log('[GCHAT] Unhandled event type:', event.type)
        response = {}
    }

    monitor.end(true)
    return NextResponse.json(response)
  } catch (error) {
    monitor.end(false)
    console.error('[GCHAT] Message handler error:', error)

    return NextResponse.json({
      text: '❌ Something went wrong. Please try again.',
    })
  }
}

/**
 * Handle incoming message
 */
async function handleMessage(event: GChatMessage) {
  const text = event.message?.text?.trim() || ''

  if (!text) {
    return {}
  }

  // Remove bot mention
  const cleanText = text.replace(/@Wells AI/gi, '').trim().toLowerCase()

  if (!cleanText) {
    // Just mentioned
    return formatHelpCard()
  }

  // Parse command
  if (cleanText.startsWith('create rfq') || cleanText.startsWith('new rfq')) {
    return await handleCreateRFQ(event, cleanText)
  } else if (cleanText.startsWith('find') || cleanText.startsWith('search')) {
    return await handleFindSuppliers(event, cleanText)
  } else if (cleanText.includes('help')) {
    return formatHelpCard()
  } else {
    return {
      text: `You said: "${cleanText}"\n\nI can help with:\n• Creating RFQs\n• Finding suppliers\n• Negotiating deals\n\nTry: **@Wells AI create rfq 100 office chairs**`,
    }
  }
}

/**
 * Handle bot added to space
 */
async function handleAddedToSpace(event: GChatMessage) {
  return {
    text: '👋 Hi! I\'m Wells AI, your procurement assistant.',
    ...formatHelpCard(),
  }
}

/**
 * Handle bot removed from space
 */
async function handleRemovedFromSpace(event: GChatMessage) {
  console.log('[GCHAT] Bot removed from space:', event.space.name)
  return {}
}

/**
 * Handle card button clicked
 */
async function handleCardClicked(event: any) {
  const action = event.action?.actionMethodName
  const parameters = event.action?.parameters || []

  console.log('[GCHAT] Card clicked:', action, parameters)

  switch (action) {
    case 'findSuppliers':
      const rfqId = parameters.find((p: any) => p.key === 'rfqId')?.value
      return {
        text: `🔍 Finding suppliers for RFQ ${rfqId}...`,
      }

    case 'acceptQuote':
      const quoteId = parameters.find((p: any) => p.key === 'quoteId')?.value
      return {
        text: `✅ Accepting quote ${quoteId}...\n\nCreating deal and generating contract.`,
      }

    default:
      return { text: 'Action not implemented yet.' }
  }
}

// Command handlers

async function handleCreateRFQ(event: GChatMessage, text: string) {
  const rfqText = text.replace(/create rfq/i, '').replace(/new rfq/i, '').trim()

  if (!rfqText) {
    return {
      text: '❌ Please specify what you need.\n\nExample: **@Wells AI create rfq 100 office chairs, budget $5000**',
    }
  }

  try {
    // Simple parsing for demo
    const rfq = await RFQs.create({
      buyerEmail: `gchat_${event.user.name}@wellsai.com`,
      productName: rfqText.split(',')[0],
      description: rfqText,
      status: 'pending',
      source: 'gchat',
      metadata: {
        gchatUserName: event.user.name,
        gchatDisplayName: event.user.displayName,
        gchatSpaceName: event.space.name,
      },
    })

    return {
      text: `✅ RFQ created: ${rfq.productName}`,
      ...formatRFQCard(rfq),
    }
  } catch (error) {
    console.error('[GCHAT] Create RFQ error:', error)
    return {
      text: '❌ Failed to create RFQ. Please try again.',
    }
  }
}

async function handleFindSuppliers(event: GChatMessage, text: string) {
  const searchText = text.replace(/find|search/i, '').trim()

  if (!searchText) {
    return {
      text: '❌ Please specify what to search for.\n\nExample: **@Wells AI find steel suppliers**',
    }
  }

  try {
    const matches = await matchSuppliers({
      productName: searchText,
      description: searchText,
    })

    if (matches.length === 0) {
      return {
        text: `❌ No suppliers found for: "${searchText}"`,
      }
    }

    const supplierList = matches
      .slice(0, 5)
      .map(
        (match, i) =>
          `${i + 1}. **${match.supplier.name}** (${match.score}/100)\n   ${match.supplier.industry || 'N/A'} | ${match.supplier.location || 'N/A'}`
      )
      .join('\n\n')

    return {
      text: `🔍 Found ${matches.length} suppliers:\n\n${supplierList}`,
    }
  } catch (error) {
    console.error('[GCHAT] Find suppliers error:', error)
    return {
      text: '❌ Failed to search suppliers.',
    }
  }
}
