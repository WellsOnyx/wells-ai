/**
 * WhatsApp Business Cloud API Integration
 *
 * Direct integration with Meta's WhatsApp Business Platform API
 * Documentation: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Setup Requirements:
 * 1. Facebook Business Manager account
 * 2. WhatsApp Business Account (verified)
 * 3. Phone number ID
 * 4. Access token (from Meta)
 * 5. Approved message templates
 */

/**
 * WhatsApp Message Template
 *
 * Templates must be pre-approved by Meta (1-2 day approval process)
 */
export interface WhatsAppTemplate {
  name: string
  language: string // e.g., "en_US"
  components: WhatsAppTemplateComponent[]
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'footer' | 'button'
  parameters?: WhatsAppTemplateParameter[]
}

export interface WhatsAppTemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video'
  text?: string
  currency?: {
    fallback_value: string
    code: string
    amount_1000: number
  }
  date_time?: {
    fallback_value: string
  }
  image?: {
    link: string
  }
  document?: {
    link: string
    filename: string
  }
  video?: {
    link: string
  }
}

/**
 * WhatsApp Message (Template or Session)
 */
export interface WhatsAppMessage {
  messaging_product: 'whatsapp'
  recipient_type: 'individual'
  to: string // E.164 format phone number (e.g., "+14155238886")
  type: 'template' | 'text' | 'image' | 'document' | 'video'

  // For template messages (cold outreach)
  template?: {
    name: string
    language: {
      code: string
    }
    components?: WhatsAppTemplateComponent[]
  }

  // For session messages (within 24hr window after user reply)
  text?: {
    preview_url: boolean
    body: string
  }

  // For media messages
  image?: {
    link: string
    caption?: string
  }
  document?: {
    link: string
    caption?: string
    filename: string
  }
  video?: {
    link: string
    caption?: string
  }
}

/**
 * WhatsApp Message Response
 */
export interface WhatsAppMessageResponse {
  messaging_product: 'whatsapp'
  contacts: Array<{
    input: string
    wa_id: string
  }>
  messages: Array<{
    id: string
    message_status?: 'accepted' | 'sent' | 'delivered' | 'read' | 'failed'
  }>
}

/**
 * WhatsApp Webhook Event (Incoming Message)
 */
export interface WhatsAppWebhookEvent {
  object: 'whatsapp_business_account'
  entry: Array<{
    id: string
    changes: Array<{
      value: {
        messaging_product: 'whatsapp'
        metadata: {
          display_phone_number: string
          phone_number_id: string
        }
        contacts?: Array<{
          profile: {
            name: string
          }
          wa_id: string
        }>
        messages?: Array<{
          from: string
          id: string
          timestamp: string
          type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'button'
          text?: {
            body: string
          }
          image?: {
            id: string
            mime_type: string
            sha256: string
          }
          button?: {
            payload: string
            text: string
          }
          context?: {
            from: string
            id: string
          }
        }>
        statuses?: Array<{
          id: string
          status: 'sent' | 'delivered' | 'read' | 'failed'
          timestamp: string
          recipient_id: string
          errors?: Array<{
            code: number
            title: string
          }>
        }>
      }
      field: string
    }>
  }>
}

/**
 * WhatsApp Business API Client
 */
export class WhatsAppBusinessClient {
  private accessToken: string
  private phoneNumberId: string
  private apiVersion: string = 'v21.0' // Latest as of 2025

  constructor(accessToken: string, phoneNumberId: string) {
    this.accessToken = accessToken
    this.phoneNumberId = phoneNumberId
  }

  /**
   * Send template message (for cold outreach)
   *
   * Templates must be pre-approved by Meta
   */
  async sendTemplate(
    to: string,
    templateName: string,
    templateParams: Record<string, string>
  ): Promise<WhatsAppMessageResponse> {
    // Build template components with parameters
    const components: WhatsAppTemplateComponent[] = [
      {
        type: 'body',
        parameters: Object.values(templateParams).map((text) => ({
          type: 'text' as const,
          text
        }))
      }
    ]

    const message: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: 'en_US'
        },
        components
      }
    }

    return await this.sendMessage(message)
  }

  /**
   * Send text message (within 24hr session window)
   *
   * Can only be sent after user replies to a template message
   * 24-hour window from last user message
   */
  async sendText(
    to: string,
    text: string,
    previewUrl: boolean = false
  ): Promise<WhatsAppMessageResponse> {
    const message: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: previewUrl,
        body: text
      }
    }

    return await this.sendMessage(message)
  }

  /**
   * Send message via WhatsApp Cloud API
   */
  private async sendMessage(
    message: WhatsAppMessage
  ): Promise<WhatsAppMessageResponse> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(
        `WhatsApp API error: ${error.error?.message || response.statusText}`
      )
    }

    return await response.json()
  }

  /**
   * Mark message as read
   *
   * Good practice to mark messages as read after processing
   */
  async markAsRead(messageId: string): Promise<{ success: boolean }> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to mark message as read: ${response.statusText}`)
    }

    return await response.json()
  }
}

/**
 * Get WhatsApp client instance
 */
export function getWhatsAppClient(): WhatsAppBusinessClient {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!accessToken || !phoneNumberId) {
    throw new Error(
      'WhatsApp credentials not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID environment variables.'
    )
  }

  return new WhatsAppBusinessClient(accessToken, phoneNumberId)
}

/**
 * Default outreach template
 *
 * This template must be created and approved in Meta Business Manager
 */
export const OUTREACH_TEMPLATE = {
  name: 'wells_outreach_v1',
  language: 'en_US',
  category: 'MARKETING',
  structure: {
    header: null,
    body: `Hi {{1}}, {{2}} here from Wells Onyx.

{{3}}

I found your profile - you have expertise in {{4}} that could contribute to {{5}}.

I assume you're happy where you are but if you're keeping your eyes open to an opportunity, let me know.

Best,
{{2}}`,
    footer: null,
    buttons: null
  },
  // Parameters: firstName, senderName, valueProposition, expertise, contribution
  parameters: ['firstName', 'senderName', 'valueProposition', 'expertise', 'contribution']
}

/**
 * Helper to send Wells outreach template
 */
export async function sendWellsOutreach(
  to: string,
  params: {
    firstName: string
    senderName: string
    valueProposition: string
    expertise: string
    contribution: string
  }
): Promise<WhatsAppMessageResponse> {
  const client = getWhatsAppClient()

  return await client.sendTemplate(
    to,
    OUTREACH_TEMPLATE.name,
    params
  )
}

export default {
  WhatsAppBusinessClient,
  getWhatsAppClient,
  sendWellsOutreach,
  OUTREACH_TEMPLATE
}
