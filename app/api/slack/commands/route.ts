import { NextRequest, NextResponse } from 'next/server'
import { monitorAPI } from '@/lib/monitoring'
import {
  sendSlackMessage,
  formatRFQMessage,
  formatHelpMessage,
  formatErrorMessage,
  SlackCommands,
} from '@/lib/slack'
import {
  parseIntent,
  executeIntent,
  generateResponse,
  getConversationContext,
  updateConversationContext,
  generateConversationId,
} from '@/lib/conversational-engine'

/**
 * Slack Slash Commands Handler
 * POST /api/slack/commands
 *
 * Handles all Wells AI slash commands in Slack
 */
export async function POST(req: NextRequest) {
  const monitor = monitorAPI('/api/slack/commands', 'POST')

  try {
    const formData = await req.formData()
    const command = formData.get('command') as string
    const text = formData.get('text') as string
    const userId = formData.get('user_id') as string
    const userName = formData.get('user_name') as string
    const channelId = formData.get('channel_id') as string
    const responseUrl = formData.get('response_url') as string

    // Verify Slack request (in production, verify the signing secret)
    // const slackSignature = req.headers.get('x-slack-signature')
    // const timestamp = req.headers.get('x-slack-request-timestamp')
    // if (!verifySlackRequest(slackSignature, timestamp, body)) {
    //   return NextResponse.json({ error: 'Invalid request' }, { status: 401 })
    // }

    console.log('[SLACK] Command received:', { command, text, userId, userName })

    // Route to conversational engine (Phase 4)
    let response

    // For help command, use formatted blocks
    if (command === SlackCommands.HELP || text === 'help') {
      response = {
        response_type: 'ephemeral',
        blocks: formatHelpMessage(),
      }
      monitor.end(true)
      return NextResponse.json(response)
    }

    // All other commands go through conversational engine
    try {
      // Generate conversation ID for this Slack user
      const conversationId = generateConversationId(userId, 'slack')

      // Load conversation context
      const context = await getConversationContext(conversationId, userId, 'slack')

      // Parse the command text as a natural language request
      const fullMessage = text || command.replace('/wells-', '')
      const parsedIntent = await parseIntent(fullMessage, context)

      console.log('[SLACK] Intent parsed:', {
        command,
        text,
        intent: parsedIntent.intent,
        confidence: parsedIntent.confidence,
      })

      // Handle clarification
      if (parsedIntent.needsClarification) {
        await updateConversationContext(conversationId, {
          currentIntent: parsedIntent.intent,
          entities: parsedIntent.entities,
          history: [
            ...context.history,
            { role: 'user', content: fullMessage },
            { role: 'assistant', content: parsedIntent.clarificationQuestion || '' },
          ],
        })

        response = {
          response_type: 'ephemeral',
          text: parsedIntent.clarificationQuestion || 'Could you provide more details?',
        }
        monitor.end(true)
        return NextResponse.json(response)
      }

      // Execute intent
      const executionResult = await executeIntent(parsedIntent, userId)

      // Generate Slack-friendly response
      const aiResponse = await generateResponse(parsedIntent, executionResult, {
        ...context,
        platform: 'slack',
      })

      // Update conversation context
      await updateConversationContext(conversationId, {
        currentIntent: parsedIntent.intent,
        entities: parsedIntent.entities,
        history: [
          ...context.history,
          { role: 'user', content: fullMessage },
          { role: 'assistant', content: aiResponse },
        ],
        metadata: {
          ...context.metadata,
          slackUserId: userId,
          slackChannelId: channelId,
          lastCommand: command,
        },
      })

      // Format response for Slack
      response = {
        response_type: executionResult.success ? 'in_channel' : 'ephemeral',
        text: aiResponse,
        blocks: executionResult.success
          ? formatSuccessBlocks(parsedIntent.intent, executionResult.data, aiResponse)
          : undefined,
      }
    } catch (error) {
      console.error('[SLACK] Conversational engine error:', error)
      response = {
        response_type: 'ephemeral',
        text: 'Sorry, something went wrong processing your request.',
        blocks: formatErrorMessage(
          'Processing Error',
          error instanceof Error ? error.message : 'Unknown error'
        ),
      }
    }

    monitor.end(true)
    return NextResponse.json(response)
  } catch (error) {
    monitor.end(false)
    console.error('[SLACK] Command error:', error)

    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'Sorry, something went wrong. Please try again.',
      blocks: formatErrorMessage(
        'Command failed',
        error instanceof Error ? error.message : 'Unknown error'
      ),
    })
  }
}

/**
 * Format success blocks for Slack
 */
function formatSuccessBlocks(intent: string, data: any, message: string): any[] {
  const blocks: any[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: message,
      },
    },
  ]

  // Add intent-specific formatting
  if (intent === 'create_po' && data?.poNumber) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `PO Number: *${data.poNumber}* | Supplier: *${data.supplier}* | Amount: *$${data.totalAmount?.toLocaleString()}*`,
        },
      ],
    })
  } else if (intent === 'check_inventory' && data?.items) {
    const itemList = data.items
      .slice(0, 5)
      .map((item: any) => `• ${item.productName}: ${item.quantity} ${item.unit}`)
      .join('\n')
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: itemList,
      },
    })
  } else if (intent === 'find_supplier' && data?.suppliers) {
    const supplierList = data.suppliers
      .slice(0, 5)
      .map(
        (s: any, i: number) =>
          `${i + 1}. *${s.name}* - ${s.industry || 'N/A'} (${s.rating || 0}/5.0)`
      )
      .join('\n')
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: supplierList,
      },
    })
  }

  return blocks
}

// ============================================
// Legacy Handlers (Deprecated - kept for reference)
// ============================================

/**
 * Handle /wells-rfq command
 * @deprecated Use conversational engine instead
 */
async function handleCreateRFQ_DEPRECATED(
  text: string,
  userId: string,
  userName: string,
  channelId: string
) {
  if (!text || text.trim() === '') {
    return {
      response_type: 'ephemeral',
      text: `Usage: \`${SlackCommands.CREATE_RFQ} <description>, quantity: X, budget: $Y, deadline: Z\`\n\nExample: \`${SlackCommands.CREATE_RFQ} 100 office chairs, quantity: 100, budget: $5000, deadline: Dec 1\``,
    }
  }

  try {
    // Simple parsing (avoid Claude API TypeScript issues)
    const parsed = {
      description: text,
      quantity: undefined,
      budget: undefined,
      deadline: undefined,
    }

    // Create RFQ in database
    const rfq = await RFQs.create({
      buyerEmail: `slack_${userId}@wellsai.com`, // Slack user mapping
      productName: parsed.description?.split(',')[0] || 'Unnamed Product',
      description: parsed.description || text,
      quantity: parsed.quantity,
      budget: parsed.budget,
      deadline: parsed.deadline,
      status: 'pending',
      source: 'slack',
      metadata: {
        slackUserId: userId,
        slackUserName: userName,
        slackChannelId: channelId,
      },
    })

    // Send success message to channel
    await sendSlackMessage({
      channel: channelId,
      text: `✅ RFQ created: ${rfq.productName}`,
      blocks: formatRFQMessage(rfq),
    })

    return {
      response_type: 'in_channel',
      text: `✅ RFQ created successfully! ID: ${rfq.id}`,
    }
  } catch (error) {
    console.error('[SLACK] Create RFQ error:', error)
    return {
      response_type: 'ephemeral',
      text: 'Failed to create RFQ. Please check your format and try again.',
      blocks: formatErrorMessage(
        'RFQ creation failed',
        error instanceof Error ? error.message : 'Unknown error'
      ),
    }
  }
}

/**
 * Handle /wells-find command
 */
async function handleFindSuppliers(text: string, userId: string, channelId: string) {
  if (!text || text.trim() === '') {
    return {
      response_type: 'ephemeral',
      text: `Usage: \`${SlackCommands.FIND} <search query>\`\n\nExample: \`${SlackCommands.FIND} steel suppliers in Texas\``,
    }
  }

  try {
    // Simple criteria extraction
    const criteria = { keywords: [text], industry: undefined, location: undefined }

    // Match suppliers
    const matches = await matchSuppliers({
      productName: criteria.keywords?.[0] || text,
      description: text,
      industry: criteria.industry,
      location: criteria.location,
    })

    if (matches.length === 0) {
      return {
        response_type: 'ephemeral',
        text: `No suppliers found matching: "${text}"\n\nTry a different search or contact support@wellsai.com`,
      }
    }

    // Format supplier results
    const supplierList = matches
      .slice(0, 5)
      .map(
        (match, i) =>
          `${i + 1}. *${match.supplier.name}* (${match.score}/100 match)\n   ${match.supplier.industry || 'N/A'} | ${match.supplier.location || 'N/A'}`
      )
      .join('\n\n')

    return {
      response_type: 'in_channel',
      text: `Found ${matches.length} supplier(s) for: "${text}"`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🔍 Found ${matches.length} Suppliers`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: supplierList,
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Use \`${SlackCommands.CREATE_RFQ}\` to request quotes from these suppliers.`,
            },
          ],
        },
      ],
    }
  } catch (error) {
    console.error('[SLACK] Find suppliers error:', error)
    return {
      response_type: 'ephemeral',
      text: 'Failed to find suppliers. Please try again.',
    }
  }
}

/**
 * Handle /wells-negotiate command
 */
async function handleNegotiate(text: string, userId: string, channelId: string) {
  return {
    response_type: 'ephemeral',
    text: `🤝 *Real-time Negotiation*\n\nUsage: \`${SlackCommands.NEGOTIATE} <rfq-id>\`\n\nThis will create a negotiation room and invite suppliers to bid in real-time.\n\n_Feature coming soon in this Slack integration. For now, use the web interface at https://wellsai.vercel.app/negotiate_`,
  }
}

/**
 * Handle /wells-quote command
 */
async function handleGetQuotes(text: string, userId: string, channelId: string) {
  return {
    response_type: 'ephemeral',
    text: `💰 *Get Quotes*\n\nUsage: \`${SlackCommands.QUOTE} <rfq-id>\`\n\nThis will fetch all quotes for your RFQ.\n\n_Feature coming soon. For now, view quotes at https://wellsai.vercel.app/quotes_`,
  }
}

/**
 * Handle /wells-deals command
 */
async function handleViewDeals(userId: string, channelId: string) {
  return {
    response_type: 'ephemeral',
    text: `📦 *Your Deals*\n\nView all your active and completed deals at:\nhttps://wellsai.vercel.app/deals\n\n_Direct Slack viewing coming soon._`,
  }
}

/**
 * Handle /wells-help command
 */
async function handleHelp(channelId: string) {
  return {
    response_type: 'ephemeral',
    blocks: formatHelpMessage(),
  }
}

/**
 * Verify Slack request signature
 */
function verifySlackRequest(
  signature: string | null,
  timestamp: string | null,
  body: string
): boolean {
  if (!signature || !timestamp) return false

  // In production, verify using HMAC SHA256
  // const slackSigningSecret = process.env.SLACK_SIGNING_SECRET
  // const sig_basestring = `v0:${timestamp}:${body}`
  // const my_signature = 'v0=' + crypto.createHmac('sha256', slackSigningSecret).update(sig_basestring).digest('hex')
  // return crypto.timingSafeEqual(Buffer.from(my_signature), Buffer.from(signature))

  return true // For demo
}
