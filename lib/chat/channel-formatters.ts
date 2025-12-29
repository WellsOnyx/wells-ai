// @ts-nocheck
/**
 * Channel Formatters for WellsAI Multi-Channel Chat
 *
 * Formats responses appropriately for each channel:
 * - Rich responses where available (Slack blocks, Teams cards, Discord embeds)
 * - Graceful fallbacks for limited channels (SMS, plain text)
 * - Consistent experience across all channels
 */

// ============================================================================
// TYPES
// ============================================================================

export type ChannelType =
  | 'web'
  | 'slack'
  | 'discord'
  | 'sms'
  | 'whatsapp'
  | 'teams'
  | 'email'
  | 'imessage'
  | 'api'

export interface SuggestedAction {
  id: string
  label: string
  action: string
  data?: Record<string, any>
  style?: 'primary' | 'secondary' | 'danger'
}

export interface FormattingOptions {
  conversationId?: string
  messageId?: string
  suggestedActions?: SuggestedAction[]
  channelContext?: any
  metadata?: Record<string, any>
}

export interface FormattedResponse {
  text: string
  richContent?: any
  buttons?: any[]
  attachments?: any[]
  metadata?: Record<string, any>
}

// ============================================================================
// MAIN FORMATTER
// ============================================================================

/**
 * Format a response for the appropriate channel
 */
export function formatResponseForChannel(
  channel: ChannelType,
  message: string,
  options: FormattingOptions = {}
): FormattedResponse {
  switch (channel) {
    case 'web':
      return formatWebResponse(message, options)
    case 'slack':
      return formatSlackResponse(message, options)
    case 'discord':
      return formatDiscordResponse(message, options)
    case 'sms':
      return formatSmsResponse(message, options)
    case 'whatsapp':
      return formatWhatsAppResponse(message, options)
    case 'teams':
      return formatTeamsResponse(message, options)
    case 'email':
      return formatEmailResponse(message, options)
    case 'imessage':
      return formatIMessageResponse(message, options)
    case 'api':
      return formatApiResponse(message, options)
    default:
      return { text: message }
  }
}

// ============================================================================
// WEB FORMATTER
// ============================================================================

function formatWebResponse(message: string, options: FormattingOptions): FormattedResponse {
  const response: FormattedResponse = {
    text: message,
    richContent: {
      type: 'web',
      markdown: message,
      html: markdownToHtml(message),
    },
    metadata: {
      conversationId: options.conversationId,
      messageId: options.messageId,
    },
  }

  // Add action buttons for web
  if (options.suggestedActions && options.suggestedActions.length > 0) {
    response.buttons = options.suggestedActions.map(action => ({
      id: action.id,
      label: action.label,
      action: action.action,
      data: action.data,
      variant: action.style === 'primary' ? 'default' : action.style === 'danger' ? 'destructive' : 'outline',
    }))
  }

  return response
}

// ============================================================================
// SLACK FORMATTER
// ============================================================================

function formatSlackResponse(message: string, options: FormattingOptions): FormattedResponse {
  // Convert markdown to Slack's mrkdwn format
  const slackText = convertToSlackMarkdown(message)

  const blocks: any[] = []

  // Main message section
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: slackText,
    },
  })

  // Add action buttons if available
  if (options.suggestedActions && options.suggestedActions.length > 0) {
    blocks.push({
      type: 'actions',
      elements: options.suggestedActions.map(action => ({
        type: 'button',
        text: {
          type: 'plain_text',
          text: action.label,
          emoji: true,
        },
        action_id: action.action,
        value: JSON.stringify({
          action: action.action,
          conversationId: options.conversationId,
          ...action.data,
        }),
        style: action.style === 'primary' ? 'primary' : action.style === 'danger' ? 'danger' : undefined,
      })),
    })
  }

  // Add context footer with conversation ID
  if (options.conversationId) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `_Conversation ID: ${options.conversationId.slice(0, 8)}..._`,
        },
      ],
    })
  }

  return {
    text: slackText,
    richContent: {
      blocks,
      response_type: 'in_channel',
    },
    metadata: {
      conversationId: options.conversationId,
      messageId: options.messageId,
    },
  }
}

function convertToSlackMarkdown(text: string): string {
  return text
    // Bold: **text** -> *text*
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    // Italic: _text_ stays the same
    // Strikethrough: ~~text~~ -> ~text~
    .replace(/~~(.+?)~~/g, '~$1~')
    // Code blocks: ```code``` stays the same
    // Inline code: `code` stays the same
    // Links: [text](url) -> <url|text>
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>')
    // Headers: remove # markers
    .replace(/^#+\s+/gm, '*')
    // Bullet points: - or * -> bullet
    .replace(/^[-*]\s+/gm, '\u2022 ')
}

// ============================================================================
// DISCORD FORMATTER
// ============================================================================

function formatDiscordResponse(message: string, options: FormattingOptions): FormattedResponse {
  // Discord supports standard markdown
  const embed: any = {
    description: message,
    color: 0x5865f2, // Discord blurple
    footer: {
      text: `WellsAI`,
    },
  }

  // Add timestamp
  if (options.messageId) {
    embed.footer.text += ` | ${options.conversationId?.slice(0, 8) || ''}`
  }

  const components: any[] = []

  // Add action buttons
  if (options.suggestedActions && options.suggestedActions.length > 0) {
    components.push({
      type: 1, // Action Row
      components: options.suggestedActions.slice(0, 5).map(action => ({
        type: 2, // Button
        style: action.style === 'primary' ? 1 : action.style === 'danger' ? 4 : 2,
        label: action.label,
        custom_id: JSON.stringify({
          action: action.action,
          conversationId: options.conversationId,
          ...action.data,
        }),
      })),
    })
  }

  return {
    text: message,
    richContent: {
      embeds: [embed],
      components: components.length > 0 ? components : undefined,
    },
    metadata: {
      conversationId: options.conversationId,
      messageId: options.messageId,
    },
  }
}

// ============================================================================
// SMS FORMATTER
// ============================================================================

function formatSmsResponse(message: string, options: FormattingOptions): FormattedResponse {
  // SMS needs to be concise and plain text
  let smsText = stripMarkdown(message)

  // Truncate if too long (SMS limit is 160 characters for single segment)
  const MAX_SMS_LENGTH = 1500 // Allow multi-part SMS, but be reasonable
  if (smsText.length > MAX_SMS_LENGTH) {
    smsText = smsText.substring(0, MAX_SMS_LENGTH - 3) + '...'
  }

  // Add action hints as text (no buttons on SMS)
  if (options.suggestedActions && options.suggestedActions.length > 0) {
    const actionHints = options.suggestedActions
      .slice(0, 2) // Limit to 2 actions for brevity
      .map((a, i) => `Reply ${i + 1} to ${a.label.toLowerCase()}`)
      .join('. ')

    if (smsText.length + actionHints.length + 2 <= MAX_SMS_LENGTH) {
      smsText += '\n\n' + actionHints
    }
  }

  return {
    text: smsText,
    richContent: null, // No rich content for SMS
    metadata: {
      conversationId: options.conversationId,
      messageId: options.messageId,
      isMultipart: smsText.length > 160,
    },
  }
}

// ============================================================================
// WHATSAPP FORMATTER
// ============================================================================

function formatWhatsAppResponse(message: string, options: FormattingOptions): FormattedResponse {
  // WhatsApp supports limited formatting
  const whatsappText = convertToWhatsAppMarkdown(message)

  const response: FormattedResponse = {
    text: whatsappText,
    metadata: {
      conversationId: options.conversationId,
      messageId: options.messageId,
    },
  }

  // WhatsApp Business API supports interactive messages
  if (options.suggestedActions && options.suggestedActions.length > 0) {
    response.richContent = {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: whatsappText,
        },
        action: {
          buttons: options.suggestedActions.slice(0, 3).map((action, index) => ({
            type: 'reply',
            reply: {
              id: action.action,
              title: action.label.substring(0, 20), // WhatsApp button title limit
            },
          })),
        },
      },
    }
  }

  return response
}

function convertToWhatsAppMarkdown(text: string): string {
  return text
    // Bold: **text** -> *text*
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    // Italic: _text_ stays the same
    // Strikethrough: ~~text~~ -> ~text~
    .replace(/~~(.+?)~~/g, '~$1~')
    // Code: `text` -> ```text```
    .replace(/`([^`]+)`/g, '```$1```')
    // Remove links, keep text: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove headers
    .replace(/^#+\s+/gm, '')
}

// ============================================================================
// MICROSOFT TEAMS FORMATTER
// ============================================================================

function formatTeamsResponse(message: string, options: FormattingOptions): FormattedResponse {
  // Build Adaptive Card
  const adaptiveCard: any = {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: message,
        wrap: true,
        markdown: true,
      },
    ],
    actions: [],
  }

  // Add action buttons
  if (options.suggestedActions && options.suggestedActions.length > 0) {
    adaptiveCard.actions = options.suggestedActions.map(action => ({
      type: 'Action.Submit',
      title: action.label,
      data: {
        action: action.action,
        conversationId: options.conversationId,
        ...action.data,
      },
      style: action.style === 'primary' ? 'positive' : action.style === 'danger' ? 'destructive' : undefined,
    }))
  }

  return {
    text: message,
    richContent: {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: adaptiveCard,
        },
      ],
    },
    metadata: {
      conversationId: options.conversationId,
      messageId: options.messageId,
    },
  }
}

// ============================================================================
// EMAIL FORMATTER
// ============================================================================

function formatEmailResponse(message: string, options: FormattingOptions): FormattedResponse {
  // Generate both plain text and HTML versions
  const plainText = stripMarkdown(message)
  const html = generateEmailHtml(message, options)

  return {
    text: plainText,
    richContent: {
      html,
      subject: options.metadata?.subject || 'Re: Your inquiry',
    },
    metadata: {
      conversationId: options.conversationId,
      messageId: options.messageId,
    },
  }
}

function generateEmailHtml(message: string, options: FormattingOptions): string {
  const htmlBody = markdownToHtml(message)

  let buttonsHtml = ''
  if (options.suggestedActions && options.suggestedActions.length > 0) {
    buttonsHtml = `
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e5e5;">
        <p style="color: #666; font-size: 14px; margin-bottom: 12px;">Quick Actions:</p>
        ${options.suggestedActions.map(action => `
          <a href="${process.env.NEXT_PUBLIC_URL || 'https://wellsonyx.io'}/action/${action.action}?cid=${options.conversationId}"
             style="display: inline-block; padding: 10px 20px; margin-right: 10px; margin-bottom: 10px;
                    background-color: ${action.style === 'primary' ? '#2563eb' : action.style === 'danger' ? '#dc2626' : '#f3f4f6'};
                    color: ${action.style === 'primary' || action.style === 'danger' ? '#ffffff' : '#374151'};
                    text-decoration: none; border-radius: 6px; font-size: 14px;">
            ${action.label}
          </a>
        `).join('')}
      </div>
    `
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8fafc; border-radius: 8px; padding: 24px;">
        ${htmlBody}
        ${buttonsHtml}
      </div>
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666;">
        <p>This message was sent by WellsAI. Reply to this email to continue the conversation.</p>
        <p>
          <a href="${process.env.NEXT_PUBLIC_URL || 'https://wellsonyx.io'}" style="color: #2563eb;">Wells Onyx</a>
          ${options.conversationId ? ` | Ref: ${options.conversationId.slice(0, 8)}` : ''}
        </p>
      </div>
    </body>
    </html>
  `
}

// ============================================================================
// IMESSAGE FORMATTER
// ============================================================================

function formatIMessageResponse(message: string, options: FormattingOptions): FormattedResponse {
  // iMessage via Sendblue - similar to SMS but can be slightly longer
  let imessageText = stripMarkdown(message)

  // iMessage has higher character limit than SMS
  const MAX_IMESSAGE_LENGTH = 8000
  if (imessageText.length > MAX_IMESSAGE_LENGTH) {
    imessageText = imessageText.substring(0, MAX_IMESSAGE_LENGTH - 3) + '...'
  }

  // Add action hints as text (Sendblue doesn't support buttons)
  if (options.suggestedActions && options.suggestedActions.length > 0) {
    const actionHints = options.suggestedActions
      .slice(0, 2)
      .map((a, i) => `Reply "${i + 1}" for ${a.label.toLowerCase()}`)
      .join('\n')

    imessageText += '\n\n' + actionHints
  }

  return {
    text: imessageText,
    richContent: null, // Sendblue basic API doesn't support rich content
    metadata: {
      conversationId: options.conversationId,
      messageId: options.messageId,
    },
  }
}

// ============================================================================
// API FORMATTER
// ============================================================================

function formatApiResponse(message: string, options: FormattingOptions): FormattedResponse {
  // Full structured response for API consumers
  return {
    text: message,
    richContent: {
      markdown: message,
      html: markdownToHtml(message),
      plainText: stripMarkdown(message),
    },
    buttons: options.suggestedActions?.map(action => ({
      id: action.id,
      label: action.label,
      action: action.action,
      data: action.data,
      style: action.style,
    })),
    metadata: {
      conversationId: options.conversationId,
      messageId: options.messageId,
      timestamp: new Date().toISOString(),
    },
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Strip all markdown formatting from text
 */
function stripMarkdown(text: string): string {
  return text
    // Remove bold
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    // Remove italic
    .replace(/_(.+?)_/g, '$1')
    // Remove strikethrough
    .replace(/~~(.+?)~~/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Convert links to text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove headers
    .replace(/^#+\s+/gm, '')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Normalize whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Convert markdown to basic HTML
 */
function markdownToHtml(text: string): string {
  return text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks (before other formatting to preserve content)
    .replace(/```([\s\S]*?)```/g, '<pre style="background: #f3f4f6; padding: 12px; border-radius: 6px; overflow-x: auto;"><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #2563eb;">$1</a>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 style="margin-top: 16px; margin-bottom: 8px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="margin-top: 20px; margin-bottom: 10px;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="margin-top: 24px; margin-bottom: 12px;">$1</h1>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote style="border-left: 4px solid #e5e7eb; padding-left: 16px; margin: 16px 0; color: #666;">$1</blockquote>')
    // Bullet lists
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Wrap lists
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul style="margin: 12px 0; padding-left: 20px;">$&</ul>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Horizontal rules
    .replace(/^[-*_]{3,}$/gm, '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">')
    // Line breaks to paragraphs
    .replace(/\n\n/g, '</p><p style="margin: 12px 0;">')
    .replace(/\n/g, '<br>')
    // Wrap in paragraphs
    .replace(/^(.+)$/gm, '<p style="margin: 12px 0;">$1</p>')
    // Clean up empty paragraphs
    .replace(/<p style="margin: 12px 0;"><\/p>/g, '')
}

// ============================================================================
// CHANNEL-SPECIFIC BUILDERS
// ============================================================================

/**
 * Build Slack blocks for rich message
 */
export function buildSlackBlocks(config: {
  header?: string
  text: string
  fields?: Array<{ label: string; value: string }>
  actions?: SuggestedAction[]
  imageUrl?: string
  footer?: string
}): any[] {
  const blocks: any[] = []

  // Header
  if (config.header) {
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: config.header,
        emoji: true,
      },
    })
  }

  // Main text
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: convertToSlackMarkdown(config.text),
    },
  })

  // Fields (two-column layout)
  if (config.fields && config.fields.length > 0) {
    blocks.push({
      type: 'section',
      fields: config.fields.map(field => ({
        type: 'mrkdwn',
        text: `*${field.label}*\n${field.value}`,
      })),
    })
  }

  // Image
  if (config.imageUrl) {
    blocks.push({
      type: 'image',
      image_url: config.imageUrl,
      alt_text: 'Image',
    })
  }

  // Divider before actions
  if (config.actions && config.actions.length > 0) {
    blocks.push({ type: 'divider' })

    blocks.push({
      type: 'actions',
      elements: config.actions.map(action => ({
        type: 'button',
        text: {
          type: 'plain_text',
          text: action.label,
          emoji: true,
        },
        action_id: action.action,
        value: JSON.stringify(action.data || {}),
        style: action.style === 'primary' ? 'primary' : action.style === 'danger' ? 'danger' : undefined,
      })),
    })
  }

  // Footer
  if (config.footer) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: config.footer,
        },
      ],
    })
  }

  return blocks
}

/**
 * Build Discord embed for rich message
 */
export function buildDiscordEmbed(config: {
  title?: string
  description: string
  color?: number
  fields?: Array<{ name: string; value: string; inline?: boolean }>
  thumbnail?: string
  image?: string
  footer?: string
  timestamp?: boolean
}): any {
  const embed: any = {
    description: config.description,
    color: config.color || 0x5865f2,
  }

  if (config.title) embed.title = config.title

  if (config.fields && config.fields.length > 0) {
    embed.fields = config.fields.map(f => ({
      name: f.name,
      value: f.value,
      inline: f.inline ?? false,
    }))
  }

  if (config.thumbnail) {
    embed.thumbnail = { url: config.thumbnail }
  }

  if (config.image) {
    embed.image = { url: config.image }
  }

  if (config.footer) {
    embed.footer = { text: config.footer }
  }

  if (config.timestamp) {
    embed.timestamp = new Date().toISOString()
  }

  return embed
}

/**
 * Build Teams Adaptive Card for rich message
 */
export function buildTeamsAdaptiveCard(config: {
  title?: string
  text: string
  facts?: Array<{ title: string; value: string }>
  actions?: SuggestedAction[]
  imageUrl?: string
}): any {
  const body: any[] = []

  // Title
  if (config.title) {
    body.push({
      type: 'TextBlock',
      text: config.title,
      weight: 'bolder',
      size: 'large',
    })
  }

  // Main text
  body.push({
    type: 'TextBlock',
    text: config.text,
    wrap: true,
    markdown: true,
  })

  // Facts (key-value pairs)
  if (config.facts && config.facts.length > 0) {
    body.push({
      type: 'FactSet',
      facts: config.facts.map(f => ({
        title: f.title,
        value: f.value,
      })),
    })
  }

  // Image
  if (config.imageUrl) {
    body.push({
      type: 'Image',
      url: config.imageUrl,
      size: 'large',
    })
  }

  const card: any = {
    type: 'AdaptiveCard',
    version: '1.4',
    body,
    actions: [],
  }

  // Actions
  if (config.actions && config.actions.length > 0) {
    card.actions = config.actions.map(action => ({
      type: 'Action.Submit',
      title: action.label,
      data: {
        action: action.action,
        ...action.data,
      },
      style: action.style === 'primary' ? 'positive' : action.style === 'danger' ? 'destructive' : undefined,
    }))
  }

  return card
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  formatResponseForChannel,
  buildSlackBlocks,
  buildDiscordEmbed,
  buildTeamsAdaptiveCard,
  stripMarkdown,
  markdownToHtml,
  convertToSlackMarkdown,
  convertToWhatsAppMarkdown,
}
