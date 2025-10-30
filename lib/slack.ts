import { WebClient } from '@slack/web-api'
import { monitorAPI } from './monitoring'

/**
 * Slack Integration for Wells AI
 * Enables negotiation and deal management directly in Slack
 */

// Slack Web API client
export function getSlackClient(token: string): WebClient {
  return new WebClient(token)
}

// Bot OAuth token (from environment)
export const slackBot = new WebClient(process.env.SLACK_BOT_TOKEN!)

/**
 * Slack Command Types
 */
export const SlackCommands = {
  // Create new RFQ
  CREATE_RFQ: '/wells-rfq',

  // Start negotiation
  NEGOTIATE: '/wells-negotiate',

  // Get quote
  QUOTE: '/wells-quote',

  // View deals
  DEALS: '/wells-deals',

  // Find supplier
  FIND: '/wells-find',

  // Help
  HELP: '/wells-help',
}

/**
 * Slack Block Kit Message Builder
 */
export class SlackMessageBuilder {
  private blocks: any[] = []

  header(text: string): this {
    this.blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: text,
        emoji: true,
      },
    })
    return this
  }

  section(text: string, markdown = true): this {
    this.blocks.push({
      type: 'section',
      text: {
        type: markdown ? 'mrkdwn' : 'plain_text',
        text: text,
      },
    })
    return this
  }

  divider(): this {
    this.blocks.push({
      type: 'divider',
    })
    return this
  }

  button(text: string, actionId: string, value: string, style?: 'primary' | 'danger'): this {
    const lastBlock = this.blocks[this.blocks.length - 1]

    const button = {
      type: 'button',
      text: {
        type: 'plain_text',
        text: text,
        emoji: true,
      },
      action_id: actionId,
      value: value,
      ...(style && { style }),
    }

    if (lastBlock && lastBlock.type === 'actions') {
      lastBlock.elements.push(button)
    } else {
      this.blocks.push({
        type: 'actions',
        elements: [button],
      })
    }

    return this
  }

  fields(...fields: { title: string; value: string; short?: boolean }[]): this {
    this.blocks.push({
      type: 'section',
      fields: fields.map((field) => ({
        type: 'mrkdwn',
        text: `*${field.title}*\n${field.value}`,
      })),
    })
    return this
  }

  context(...elements: string[]): this {
    this.blocks.push({
      type: 'context',
      elements: elements.map((text) => ({
        type: 'mrkdwn',
        text: text,
      })),
    })
    return this
  }

  build() {
    return this.blocks
  }
}

/**
 * Send message to Slack channel
 */
export async function sendSlackMessage(params: {
  channel: string
  text: string
  blocks?: any[]
  threadTs?: string
}): Promise<any> {
  const monitor = monitorAPI('send_slack_message', 'POST')

  try {
    const result = await slackBot.chat.postMessage({
      channel: params.channel,
      text: params.text,
      blocks: params.blocks,
      thread_ts: params.threadTs,
    })

    monitor.end(true)
    return result
  } catch (error) {
    monitor.end(false)
    console.error('[SLACK] Send message error:', error)
    throw error
  }
}

/**
 * Update existing Slack message
 */
export async function updateSlackMessage(params: {
  channel: string
  ts: string
  text: string
  blocks?: any[]
}): Promise<any> {
  const monitor = monitorAPI('update_slack_message', 'POST')

  try {
    const result = await slackBot.chat.update({
      channel: params.channel,
      ts: params.ts,
      text: params.text,
      blocks: params.blocks,
    })

    monitor.end(true)
    return result
  } catch (error) {
    monitor.end(false)
    console.error('[SLACK] Update message error:', error)
    throw error
  }
}

/**
 * Send ephemeral message (only visible to one user)
 */
export async function sendEphemeralMessage(params: {
  channel: string
  user: string
  text: string
  blocks?: any[]
}): Promise<any> {
  try {
    return await slackBot.chat.postEphemeral({
      channel: params.channel,
      user: params.user,
      text: params.text,
      blocks: params.blocks,
    })
  } catch (error) {
    console.error('[SLACK] Send ephemeral error:', error)
    throw error
  }
}

/**
 * Open Slack modal dialog
 */
export async function openSlackModal(params: {
  triggerId: string
  title: string
  blocks: any[]
  callbackId: string
  submitText?: string
}): Promise<any> {
  try {
    return await slackBot.views.open({
      trigger_id: params.triggerId,
      view: {
        type: 'modal',
        callback_id: params.callbackId,
        title: {
          type: 'plain_text',
          text: params.title,
        },
        submit: {
          type: 'plain_text',
          text: params.submitText || 'Submit',
        },
        blocks: params.blocks,
      },
    })
  } catch (error) {
    console.error('[SLACK] Open modal error:', error)
    throw error
  }
}

/**
 * Get Slack user info
 */
export async function getSlackUser(userId: string): Promise<any> {
  try {
    const result = await slackBot.users.info({ user: userId })
    return result.user
  } catch (error) {
    console.error('[SLACK] Get user error:', error)
    return null
  }
}

/**
 * Get Slack channel info
 */
export async function getSlackChannel(channelId: string): Promise<any> {
  try {
    const result = await slackBot.conversations.info({ channel: channelId })
    return result.channel
  } catch (error) {
    console.error('[SLACK] Get channel error:', error)
    return null
  }
}

/**
 * Format RFQ as Slack message
 */
export function formatRFQMessage(rfq: any): any {
  const builder = new SlackMessageBuilder()

  builder
    .header(`🔍 New RFQ: ${rfq.productName || 'Unnamed RFQ'}`)
    .section(`*Description:* ${rfq.description || 'No description'}`)
    .divider()
    .fields(
      { title: 'Quantity', value: rfq.quantity?.toString() || 'N/A' },
      { title: 'Budget', value: rfq.budget ? `$${rfq.budget.toLocaleString()}` : 'Not specified' },
      { title: 'Deadline', value: rfq.deadline || 'ASAP' },
      { title: 'Status', value: rfq.status || 'pending' }
    )
    .divider()
    .button('View RFQ', 'view_rfq', rfq.id, 'primary')
    .button('Find Suppliers', 'find_suppliers', rfq.id)
    .button('Start Negotiation', 'start_negotiation', rfq.id)
    .context(`RFQ ID: ${rfq.id}`, `Created: ${new Date(rfq.createdAt).toLocaleString()}`)

  return builder.build()
}

/**
 * Format quote as Slack message
 */
export function formatQuoteMessage(quote: any): any {
  const builder = new SlackMessageBuilder()

  builder
    .header(`💰 New Quote from ${quote.supplierName}`)
    .section(`Quoted price: *$${quote.price.toLocaleString()}*`)
    .divider()
    .fields(
      { title: 'Supplier', value: quote.supplierName },
      { title: 'Price', value: `$${quote.price.toLocaleString()}` },
      { title: 'Delivery', value: quote.deliveryTime || 'Not specified' },
      { title: 'Status', value: quote.status || 'pending' }
    )

  if (quote.notes) {
    builder.section(`*Notes:* ${quote.notes}`)
  }

  builder
    .divider()
    .button('Accept Quote', 'accept_quote', quote.id, 'primary')
    .button('Counter Offer', 'counter_offer', quote.id)
    .button('Reject', 'reject_quote', quote.id, 'danger')
    .context(`Quote ID: ${quote.id}`, `Received: ${new Date(quote.createdAt).toLocaleString()}`)

  return builder.build()
}

/**
 * Format deal as Slack message
 */
export function formatDealMessage(deal: any): any {
  const builder = new SlackMessageBuilder()

  const statusEmoji = {
    pending: '⏳',
    paid: '✅',
    completed: '🎉',
    failed: '❌',
  }

  builder
    .header(
      `${statusEmoji[deal.status as keyof typeof statusEmoji] || '📦'} Deal ${deal.status === 'completed' ? 'Completed' : 'Update'}`
    )
    .section(`Deal amount: *$${deal.amount.toLocaleString()}*`)
    .divider()
    .fields(
      { title: 'Supplier', value: deal.supplierName || 'N/A' },
      { title: 'Amount', value: `$${deal.amount.toLocaleString()}` },
      { title: 'Wells Fee', value: `$${(deal.wellsFee || 0).toFixed(2)} (0.33%)` },
      { title: 'Status', value: deal.status || 'pending' }
    )
    .divider()

  if (deal.status === 'pending') {
    builder.button('View Details', 'view_deal', deal.id, 'primary')
  } else if (deal.status === 'paid') {
    builder.button('View Contract', 'view_contract', deal.id, 'primary')
  }

  builder.context(`Deal ID: ${deal.id}`, `Created: ${new Date(deal.createdAt).toLocaleString()}`)

  return builder.build()
}

/**
 * Format supplier match as Slack message
 */
export function formatSupplierMatchMessage(supplier: any, matchScore: number): any {
  const builder = new SlackMessageBuilder()

  const stars = '⭐'.repeat(Math.round(matchScore / 20))
  const scoreColor = matchScore >= 80 ? '🟢' : matchScore >= 60 ? '🟡' : '🔴'

  builder
    .header(`${scoreColor} Supplier Match: ${supplier.name}`)
    .section(`Match Score: ${stars} ${matchScore}/100`)
    .divider()
    .fields(
      { title: 'Company', value: supplier.name },
      { title: 'Industry', value: supplier.industry || 'N/A' },
      { title: 'Location', value: supplier.location || 'N/A' },
      { title: 'Rating', value: supplier.rating ? `${supplier.rating}/5.0` : 'Not rated' }
    )

  if (supplier.specialties) {
    builder.section(`*Specialties:* ${supplier.specialties.join(', ')}`)
  }

  builder
    .divider()
    .button('Request Quote', 'request_quote', supplier.id, 'primary')
    .button('View Profile', 'view_supplier', supplier.id)
    .button('Start Negotiation', 'negotiate_supplier', supplier.id)
    .context(`Supplier ID: ${supplier.id}`, `Match score: ${matchScore}%`)

  return builder.build()
}

/**
 * Format negotiation invite as Slack message
 */
export function formatNegotiationInvite(params: {
  roomCode: string
  rfqTitle: string
  buyerName: string
  supplierCount: number
}): any {
  const builder = new SlackMessageBuilder()

  builder
    .header(`🤝 Negotiation Room Created`)
    .section(`*${params.buyerName}* started a negotiation for: *${params.rfqTitle}*`)
    .section(`${params.supplierCount} supplier(s) invited to negotiate in real-time.`)
    .divider()
    .fields(
      { title: 'Room Code', value: params.roomCode },
      { title: 'Suppliers', value: params.supplierCount.toString() }
    )
    .button('Join Negotiation', 'join_negotiation', params.roomCode, 'primary')
    .button('View Details', 'view_negotiation', params.roomCode)
    .context(
      `Room: ${params.roomCode}`,
      `Negotiate in real-time until best price is reached.`
    )

  return builder.build()
}

/**
 * Format error message for Slack
 */
export function formatErrorMessage(error: string, details?: string): any {
  const builder = new SlackMessageBuilder()

  builder
    .header('❌ Error')
    .section(`*${error}*`)

  if (details) {
    builder.section(`\`\`\`${details}\`\`\``)
  }

  builder.context('If this persists, contact support@wellsai.com')

  return builder.build()
}

/**
 * Format help message for Slack
 */
export function formatHelpMessage(): any {
  const builder = new SlackMessageBuilder()

  builder
    .header('📚 Wells AI Bot Commands')
    .section('Use these commands to interact with Wells AI:')
    .divider()
    .section(
      `*${SlackCommands.CREATE_RFQ}* - Create a new RFQ (Request for Quote)\n` +
        `Example: \`${SlackCommands.CREATE_RFQ} 100 office chairs, budget $5000, needed by Dec 1\``
    )
    .section(
      `*${SlackCommands.FIND}* - Find suppliers\n` +
        `Example: \`${SlackCommands.FIND} steel suppliers in Texas\``
    )
    .section(
      `*${SlackCommands.NEGOTIATE}* - Start real-time negotiation\n` +
        `Example: \`${SlackCommands.NEGOTIATE} rfq-abc123\``
    )
    .section(
      `*${SlackCommands.QUOTE}* - Get quotes for RFQ\n` +
        `Example: \`${SlackCommands.QUOTE} rfq-abc123\``
    )
    .section(
      `*${SlackCommands.DEALS}* - View your active deals\n` +
        `Example: \`${SlackCommands.DEALS}\``
    )
    .divider()
    .button('View Documentation', 'view_docs', 'docs', 'primary')
    .button('Get Support', 'get_support', 'support')
    .context('Wells AI - Procurement automation powered by AI')

  return builder.build()
}
