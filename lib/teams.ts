import { monitorAPI } from './monitoring'

/**
 * Microsoft Teams Integration for Wells AI
 * Bot Framework integration for Teams
 */

// Teams Bot Framework client
export interface TeamsMessage {
  type: string
  id: string
  timestamp: string
  serviceUrl: string
  channelId: string
  from: { id: string; name: string }
  conversation: { id: string; name?: string }
  recipient: { id: string; name: string }
  text?: string
  value?: any
  replyToId?: string
}

export interface TeamsActivity extends TeamsMessage {
  action?: string
  data?: any
}

/**
 * Teams Card Builder
 */
export class TeamsCardBuilder {
  private card: any

  constructor(type: 'AdaptiveCard' | 'HeroCard' = 'AdaptiveCard') {
    if (type === 'AdaptiveCard') {
      this.card = {
        type: 'AdaptiveCard',
        version: '1.5',
        body: [],
        actions: [],
      }
    } else {
      this.card = {
        contentType: 'application/vnd.microsoft.card.hero',
        content: {
          title: '',
          text: '',
          buttons: [],
        },
      }
    }
  }

  title(text: string): this {
    this.card.body.push({
      type: 'TextBlock',
      text: text,
      size: 'large',
      weight: 'bolder',
    })
    return this
  }

  text(text: string): this {
    this.card.body.push({
      type: 'TextBlock',
      text: text,
      wrap: true,
    })
    return this
  }

  facts(...facts: { title: string; value: string }[]): this {
    this.card.body.push({
      type: 'FactSet',
      facts: facts.map((f) => ({ title: f.title, value: f.value })),
    })
    return this
  }

  button(title: string, actionType: 'Action.Submit' | 'Action.OpenUrl', data: any): this {
    this.card.actions.push({
      type: actionType,
      title: title,
      ...(actionType === 'Action.Submit' ? { data } : { url: data }),
    })
    return this
  }

  separator(): this {
    this.card.body.push({
      type: 'Container',
      separator: true,
      items: [],
    })
    return this
  }

  build() {
    return {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: this.card,
        },
      ],
    }
  }
}

/**
 * Send message to Teams
 */
export async function sendTeamsMessage(params: {
  serviceUrl: string
  conversationId: string
  botId: string
  message: string
  card?: any
}): Promise<any> {
  const monitor = monitorAPI('send_teams_message', 'POST')

  try {
    const accessToken = await getTeamsBotToken()

    const response = await fetch(
      `${params.serviceUrl}/v3/conversations/${params.conversationId}/activities`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'message',
          from: { id: params.botId },
          text: params.message,
          ...(params.card && { attachments: [params.card] }),
        }),
      }
    )

    const result = await response.json()
    monitor.end(true)
    return result
  } catch (error) {
    monitor.end(false)
    console.error('[TEAMS] Send message error:', error)
    throw error
  }
}

/**
 * Update Teams message
 */
export async function updateTeamsMessage(params: {
  serviceUrl: string
  conversationId: string
  activityId: string
  botId: string
  message: string
  card?: any
}): Promise<any> {
  try {
    const accessToken = await getTeamsBotToken()

    const response = await fetch(
      `${params.serviceUrl}/v3/conversations/${params.conversationId}/activities/${params.activityId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'message',
          id: params.activityId,
          from: { id: params.botId },
          text: params.message,
          ...(params.card && { attachments: [params.card] }),
        }),
      }
    )

    return await response.json()
  } catch (error) {
    console.error('[TEAMS] Update message error:', error)
    throw error
  }
}

/**
 * Get Bot Framework access token
 */
let cachedToken: { token: string; expiresAt: number } | null = null

async function getTeamsBotToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token
  }

  try {
    const response = await fetch('https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.TEAMS_APP_ID!,
        client_secret: process.env.TEAMS_APP_PASSWORD!,
        scope: 'https://api.botframework.com/.default',
      }),
    })

    const data = await response.json()

    // Cache token (expires in 3600s, cache for 55 minutes)
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + 55 * 60 * 1000,
    }

    return data.access_token
  } catch (error) {
    console.error('[TEAMS] Get token error:', error)
    throw new Error('Failed to get Teams bot token')
  }
}

/**
 * Format RFQ as Teams card
 */
export function formatRFQCard(rfq: any): any {
  const builder = new TeamsCardBuilder()

  builder
    .title(`🔍 New RFQ: ${rfq.productName || 'Unnamed RFQ'}`)
    .text(rfq.description || 'No description')
    .separator()
    .facts(
      { title: 'Quantity', value: rfq.quantity?.toString() || 'N/A' },
      { title: 'Budget', value: rfq.budget ? `$${rfq.budget.toLocaleString()}` : 'Not specified' },
      { title: 'Deadline', value: rfq.deadline || 'ASAP' },
      { title: 'Status', value: rfq.status || 'pending' }
    )
    .button('View RFQ', 'Action.OpenUrl', `${process.env.NEXT_PUBLIC_BASE_URL}/rfqs/${rfq.id}`)
    .button('Find Suppliers', 'Action.Submit', { action: 'find_suppliers', rfqId: rfq.id })
    .button('Start Negotiation', 'Action.Submit', { action: 'start_negotiation', rfqId: rfq.id })

  return builder.build()
}

/**
 * Format quote as Teams card
 */
export function formatQuoteCard(quote: any): any {
  const builder = new TeamsCardBuilder()

  builder
    .title(`💰 New Quote from ${quote.supplierName}`)
    .text(`Quoted price: **$${quote.price.toLocaleString()}**`)
    .separator()
    .facts(
      { title: 'Supplier', value: quote.supplierName },
      { title: 'Price', value: `$${quote.price.toLocaleString()}` },
      { title: 'Delivery', value: quote.deliveryTime || 'Not specified' },
      { title: 'Status', value: quote.status || 'pending' }
    )
    .button('Accept Quote', 'Action.Submit', { action: 'accept_quote', quoteId: quote.id })
    .button('Counter Offer', 'Action.Submit', { action: 'counter_offer', quoteId: quote.id })
    .button('Reject', 'Action.Submit', { action: 'reject_quote', quoteId: quote.id })

  return builder.build()
}

/**
 * Format deal as Teams card
 */
export function formatDealCard(deal: any): any {
  const builder = new TeamsCardBuilder()

  const statusEmoji = {
    pending: '⏳',
    paid: '✅',
    completed: '🎉',
    failed: '❌',
  }

  builder
    .title(
      `${statusEmoji[deal.status as keyof typeof statusEmoji] || '📦'} Deal ${deal.status === 'completed' ? 'Completed' : 'Update'}`
    )
    .text(`Deal amount: **$${deal.amount.toLocaleString()}**`)
    .separator()
    .facts(
      { title: 'Supplier', value: deal.supplierName || 'N/A' },
      { title: 'Amount', value: `$${deal.amount.toLocaleString()}` },
      { title: 'Wells Fee', value: `$${(deal.wellsFee || 0).toFixed(2)} (0.33%)` },
      { title: 'Status', value: deal.status || 'pending' }
    )

  if (deal.status === 'pending') {
    builder.button('View Details', 'Action.OpenUrl', `${process.env.NEXT_PUBLIC_BASE_URL}/deals/${deal.id}`)
  } else if (deal.status === 'paid') {
    builder.button(
      'View Contract',
      'Action.OpenUrl',
      `${process.env.NEXT_PUBLIC_BASE_URL}/deals/${deal.id}/contract`
    )
  }

  return builder.build()
}

/**
 * Format help message for Teams
 */
export function formatHelpCard(): any {
  const builder = new TeamsCardBuilder()

  builder
    .title('📚 Wells AI Bot Commands')
    .text('**@wellsai create rfq** - Create a new RFQ')
    .text('**@wellsai find suppliers** - Find suppliers')
    .text('**@wellsai negotiate** - Start negotiation')
    .text('**@wellsai my deals** - View your deals')
    .separator()
    .button('View Documentation', 'Action.OpenUrl', `${process.env.NEXT_PUBLIC_BASE_URL}/docs`)
    .button('Get Support', 'Action.OpenUrl', 'mailto:support@wellsai.com')

  return builder.build()
}
