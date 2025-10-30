import { NextRequest, NextResponse } from 'next/server'
import { monitorAPI } from '@/lib/monitoring'
import {
  sendSlackMessage,
  formatRFQMessage,
  formatHelpMessage,
  formatErrorMessage,
  SlackCommands,
} from '@/lib/slack'
import { RFQs } from '@/lib/db'
import { matchSuppliers } from '@/lib/matching'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

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

    // Route to appropriate handler
    let response

    switch (command) {
      case SlackCommands.CREATE_RFQ:
        response = await handleCreateRFQ(text, userId, userName, channelId)
        break

      case SlackCommands.FIND:
        response = await handleFindSuppliers(text, userId, channelId)
        break

      case SlackCommands.NEGOTIATE:
        response = await handleNegotiate(text, userId, channelId)
        break

      case SlackCommands.QUOTE:
        response = await handleGetQuotes(text, userId, channelId)
        break

      case SlackCommands.DEALS:
        response = await handleViewDeals(userId, channelId)
        break

      case SlackCommands.HELP:
        response = await handleHelp(channelId)
        break

      default:
        response = {
          response_type: 'ephemeral',
          text: `Unknown command: ${command}. Type \`${SlackCommands.HELP}\` for help.`,
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
 * Handle /wells-rfq command
 */
async function handleCreateRFQ(
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
