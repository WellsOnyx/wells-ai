import { monitorAPI } from './monitoring'

/**
 * Google Chat Integration for Wells AI
 * Uses Google Chat API for bot functionality
 */

export interface GChatMessage {
  type: string
  eventTime: string
  space: { name: string; type: string }
  message?: {
    name: string
    sender: { name: string; displayName: string; type: string }
    text: string
    thread: { name: string }
  }
  user: { name: string; displayName: string; type: string }
}

/**
 * Google Chat Card Builder
 */
export class GChatCardBuilder {
  private cards: any[] = []
  private currentCard: any = { sections: [] }

  header(title: string, subtitle?: string): this {
    this.currentCard.header = {
      title,
      ...(subtitle && { subtitle }),
    }
    return this
  }

  section(): this {
    if (this.currentCard.sections.length > 0) {
      this.currentCard.sections.push({ widgets: [] })
    } else {
      this.currentCard.sections.push({ widgets: [] })
    }
    return this
  }

  textParagraph(text: string): this {
    const currentSection = this.currentCard.sections[this.currentCard.sections.length - 1]
    if (!currentSection) {
      this.section()
    }
    this.currentCard.sections[this.currentCard.sections.length - 1].widgets.push({
      textParagraph: { text },
    })
    return this
  }

  keyValue(topLabel: string, content: string): this {
    const currentSection = this.currentCard.sections[this.currentCard.sections.length - 1]
    if (!currentSection) {
      this.section()
    }
    this.currentCard.sections[this.currentCard.sections.length - 1].widgets.push({
      keyValue: { topLabel, content },
    })
    return this
  }

  button(text: string, url?: string, onClick?: { action: { actionMethodName: string; parameters?: any[] } }): this {
    const currentSection = this.currentCard.sections[this.currentCard.sections.length - 1]
    if (!currentSection) {
      this.section()
    }
    this.currentCard.sections[this.currentCard.sections.length - 1].widgets.push({
      buttons: [
        {
          textButton: {
            text,
            ...(url && { onClick: { openLink: { url } } }),
            ...(onClick && { onClick }),
          },
        },
      ],
    })
    return this
  }

  build() {
    this.cards.push(this.currentCard)
    return { cards: this.cards }
  }
}

/**
 * Send Google Chat message
 */
export async function sendGChatMessage(params: {
  spaceName: string
  text: string
  cards?: any
  threadName?: string
}): Promise<any> {
  const monitor = monitorAPI('send_gchat_message', 'POST')

  try {
    const accessToken = await getGChatToken()

    const url = `https://chat.googleapis.com/v1/${params.spaceName}/messages`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: params.text,
        ...(params.cards && { cards: params.cards.cards }),
        ...(params.threadName && { thread: { name: params.threadName } }),
      }),
    })

    const result = await response.json()
    monitor.end(true)
    return result
  } catch (error) {
    monitor.end(false)
    console.error('[GCHAT] Send message error:', error)
    throw error
  }
}

/**
 * Get Google Chat access token
 */
let cachedGChatToken: { token: string; expiresAt: number } | null = null

async function getGChatToken(): Promise<string> {
  if (cachedGChatToken && cachedGChatToken.expiresAt > Date.now()) {
    return cachedGChatToken.token
  }

  // In production, use Google Auth library to get JWT token
  // For now, return service account token from env
  const token = process.env.GOOGLE_CHAT_BOT_TOKEN || ''

  cachedGChatToken = {
    token,
    expiresAt: Date.now() + 55 * 60 * 1000,
  }

  return token
}

/**
 * Format RFQ as Google Chat card
 */
export function formatRFQCard(rfq: any): any {
  const builder = new GChatCardBuilder()

  builder
    .header(`🔍 New RFQ: ${rfq.productName || 'Unnamed RFQ'}`)
    .section()
    .textParagraph(rfq.description || 'No description')
    .keyValue('Quantity', rfq.quantity?.toString() || 'N/A')
    .keyValue('Budget', rfq.budget ? `$${rfq.budget.toLocaleString()}` : 'Not specified')
    .keyValue('Deadline', rfq.deadline || 'ASAP')
    .keyValue('Status', rfq.status || 'pending')
    .button('View RFQ', `${process.env.NEXT_PUBLIC_BASE_URL}/rfqs/${rfq.id}`)
    .button('Find Suppliers', undefined, {
      action: { actionMethodName: 'findSuppliers', parameters: [{ key: 'rfqId', value: rfq.id }] },
    })

  return builder.build()
}

/**
 * Format quote as Google Chat card
 */
export function formatQuoteCard(quote: any): any {
  const builder = new GChatCardBuilder()

  builder
    .header(`💰 New Quote from ${quote.supplierName}`)
    .section()
    .textParagraph(`Quoted price: **$${quote.price.toLocaleString()}**`)
    .keyValue('Supplier', quote.supplierName)
    .keyValue('Price', `$${quote.price.toLocaleString()}`)
    .keyValue('Delivery', quote.deliveryTime || 'Not specified')
    .keyValue('Status', quote.status || 'pending')
    .button('Accept Quote', undefined, {
      action: { actionMethodName: 'acceptQuote', parameters: [{ key: 'quoteId', value: quote.id }] },
    })
    .button('View Quote', `${process.env.NEXT_PUBLIC_BASE_URL}/quotes/${quote.id}`)

  return builder.build()
}

/**
 * Format help message
 */
export function formatHelpCard(): any {
  const builder = new GChatCardBuilder()

  builder
    .header('📚 Wells AI Bot Commands')
    .section()
    .textParagraph('**@Wells AI create rfq** - Create a new RFQ')
    .textParagraph('**@Wells AI find suppliers** - Find suppliers')
    .textParagraph('**@Wells AI negotiate** - Start negotiation')
    .textParagraph('**@Wells AI my deals** - View your deals')
    .button('View Documentation', `${process.env.NEXT_PUBLIC_BASE_URL}/docs`)
    .button('Get Support', 'mailto:support@wellsai.com')

  return builder.build()
}
