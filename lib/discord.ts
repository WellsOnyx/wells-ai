import { monitorAPI } from './monitoring'

/**
 * Discord Bot Integration for Wells AI
 * Uses Discord.js for bot functionality
 */

export interface DiscordMessage {
  id: string
  channel_id: string
  guild_id?: string
  author: { id: string; username: string; bot?: boolean }
  content: string
  timestamp: string
  mentions?: any[]
}

/**
 * Discord Embed Builder
 */
export class DiscordEmbedBuilder {
  private embed: any

  constructor() {
    this.embed = {
      title: '',
      description: '',
      color: 0x667eea, // Wells AI purple
      fields: [],
      footer: { text: 'Wells AI' },
      timestamp: new Date().toISOString(),
    }
  }

  title(text: string): this {
    this.embed.title = text
    return this
  }

  description(text: string): this {
    this.embed.description = text
    return this
  }

  color(hex: number): this {
    this.embed.color = hex
    return this
  }

  field(name: string, value: string, inline = false): this {
    this.embed.fields.push({ name, value, inline })
    return this
  }

  footer(text: string): this {
    this.embed.footer.text = text
    return this
  }

  url(url: string): this {
    this.embed.url = url
    return this
  }

  build() {
    return this.embed
  }
}

/**
 * Send Discord message
 */
export async function sendDiscordMessage(params: {
  channelId: string
  content: string
  embeds?: any[]
  components?: any[]
}): Promise<any> {
  const monitor = monitorAPI('send_discord_message', 'POST')

  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${params.channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: params.content,
        embeds: params.embeds,
        components: params.components,
      }),
    })

    const result = await response.json()
    monitor.end(true)
    return result
  } catch (error) {
    monitor.end(false)
    console.error('[DISCORD] Send message error:', error)
    throw error
  }
}

/**
 * Format RFQ as Discord embed
 */
export function formatRFQEmbed(rfq: any): any {
  const embed = new DiscordEmbedBuilder()
    .title(`🔍 New RFQ: ${rfq.productName || 'Unnamed RFQ'}`)
    .description(rfq.description || 'No description')
    .field('Quantity', rfq.quantity?.toString() || 'N/A', true)
    .field('Budget', rfq.budget ? `$${rfq.budget.toLocaleString()}` : 'Not specified', true)
    .field('Deadline', rfq.deadline || 'ASAP', true)
    .field('Status', rfq.status || 'pending', true)
    .url(`${process.env.NEXT_PUBLIC_BASE_URL}/rfqs/${rfq.id}`)
    .footer(`RFQ ID: ${rfq.id}`)

  return embed.build()
}

/**
 * Format quote as Discord embed
 */
export function formatQuoteEmbed(quote: any): any {
  const embed = new DiscordEmbedBuilder()
    .title(`💰 New Quote from ${quote.supplierName}`)
    .description(`Quoted price: **$${quote.price.toLocaleString()}**`)
    .field('Supplier', quote.supplierName, true)
    .field('Price', `$${quote.price.toLocaleString()}`, true)
    .field('Delivery', quote.deliveryTime || 'Not specified', true)
    .field('Status', quote.status || 'pending', true)
    .url(`${process.env.NEXT_PUBLIC_BASE_URL}/quotes/${quote.id}`)
    .footer(`Quote ID: ${quote.id}`)

  if (quote.notes) {
    embed.field('Notes', quote.notes, false)
  }

  return embed.build()
}

/**
 * Format deal as Discord embed
 */
export function formatDealEmbed(deal: any): any {
  const statusEmoji = {
    pending: '⏳',
    paid: '✅',
    completed: '🎉',
    failed: '❌',
  }

  const embed = new DiscordEmbedBuilder()
    .title(
      `${statusEmoji[deal.status as keyof typeof statusEmoji] || '📦'} Deal ${deal.status === 'completed' ? 'Completed' : 'Update'}`
    )
    .description(`Deal amount: **$${deal.amount.toLocaleString()}**`)
    .field('Supplier', deal.supplierName || 'N/A', true)
    .field('Amount', `$${deal.amount.toLocaleString()}`, true)
    .field('Wells Fee', `$${(deal.wellsFee || 0).toFixed(2)} (0.33%)`, true)
    .field('Status', deal.status || 'pending', true)
    .url(`${process.env.NEXT_PUBLIC_BASE_URL}/deals/${deal.id}`)
    .footer(`Deal ID: ${deal.id}`)

  return embed.build()
}

/**
 * Format help message
 */
export function formatHelpEmbed(): any {
  const embed = new DiscordEmbedBuilder()
    .title('📚 Wells AI Bot Commands')
    .description('Use these commands to interact with Wells AI:')
    .field('/rfq', 'Create a new RFQ\nExample: `/rfq 100 office chairs, budget $5000`', false)
    .field('/find', 'Find suppliers\nExample: `/find steel suppliers in Texas`', false)
    .field('/negotiate', 'Start real-time negotiation\nExample: `/negotiate rfq-123`', false)
    .field('/deals', 'View your active deals\nExample: `/deals`', false)
    .field('/help', 'Show this help message', false)
    .footer('Wells AI - Procurement automation powered by AI')

  return embed.build()
}

/**
 * Create Discord button component
 */
export function createButton(label: string, customId: string, style: 1 | 2 | 3 | 4 = 1): any {
  return {
    type: 1, // Action Row
    components: [
      {
        type: 2, // Button
        style, // 1=Primary, 2=Secondary, 3=Success, 4=Danger
        label,
        custom_id: customId,
      },
    ],
  }
}
