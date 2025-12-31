// @ts-nocheck
/**
 * Wells AI Response Generator
 *
 * "A word fitly spoken is like apples of gold in a setting of silver." - Proverbs 25:11
 *
 * Generates natural, conversational responses:
 * - Match user's communication style
 * - Be concise but informative
 * - Include relevant data inline
 * - Suggest next steps
 * - Celebrate wins, acknowledge struggles
 *
 * Key Principles:
 * - Encouragement: "Therefore encourage one another and build each other up." - 1 Thessalonians 5:11
 * - Honesty: "An honest answer is like a kiss on the lips." - Proverbs 24:26
 * - Gentleness: "A gentle answer turns away wrath." - Proverbs 15:1
 * - Perseverance support: "Let us not become weary in doing good." - Galatians 6:9
 */

import Anthropic from '@anthropic-ai/sdk'
import { ActionResult, SuggestedAction } from './action-executor'
import { ConversationContext, ConversationMessage } from './conversation-manager'
import { IntentClassification } from './intent-router'
import {
  FaithFoundation,
  getEncouragement,
  getCelebration,
  getPerseveranceWisdom,
  type UserJourney as FaithUserJourney,
} from '@/lib/faith'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

export type CommunicationStyle = 'formal' | 'casual' | 'direct' | 'detailed'
export type ResponseTone = 'neutral' | 'celebratory' | 'empathetic' | 'urgent' | 'helpful'

export interface ResponseOptions {
  style?: CommunicationStyle
  tone?: ResponseTone
  includeEmoji?: boolean
  maxLength?: number
  includeSuggestions?: boolean
}

export interface GeneratedResponse {
  message: string
  suggestions?: string[]
  actions?: SuggestedAction[]
  metadata?: {
    style: CommunicationStyle
    tone: ResponseTone
    generatedAt: Date
  }
}

// ============================================================================
// STYLE DETECTION
// ============================================================================

/**
 * Detect user's communication style from their messages
 */
export function detectCommunicationStyle(
  messages: ConversationMessage[]
): CommunicationStyle {
  if (messages.length < 2) return 'casual' // Default

  const userMessages = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)

  // Check for formal indicators
  const formalIndicators = [
    'please', 'kindly', 'would you', 'could you',
    'I would like', 'I would appreciate', 'thank you'
  ]

  // Check for casual indicators
  const casualIndicators = [
    'hey', 'yo', 'sup', 'gonna', 'wanna', 'cool',
    'awesome', 'great', '!', 'lol', 'haha'
  ]

  // Check for direct indicators
  const directIndicators = [
    'just', 'need', 'want', 'show me', 'give me',
    'do it', 'make it', 'get me'
  ]

  // Check for detailed indicators
  const detailedIndicators = [
    'specifically', 'including', 'such as', 'for example',
    'details', 'breakdown', 'explain', 'because'
  ]

  let formalCount = 0
  let casualCount = 0
  let directCount = 0
  let detailedCount = 0

  const allText = userMessages.join(' ').toLowerCase()

  formalIndicators.forEach(i => {
    if (allText.includes(i)) formalCount++
  })
  casualIndicators.forEach(i => {
    if (allText.includes(i)) casualCount++
  })
  directIndicators.forEach(i => {
    if (allText.includes(i)) directCount++
  })
  detailedIndicators.forEach(i => {
    if (allText.includes(i)) detailedCount++
  })

  // Check message length patterns
  const avgLength = userMessages.reduce((sum, m) => sum + m.length, 0) / userMessages.length
  if (avgLength > 150) detailedCount += 2
  if (avgLength < 30) directCount += 2

  // Determine style
  const scores = {
    formal: formalCount,
    casual: casualCount,
    direct: directCount,
    detailed: detailedCount,
  }

  const maxStyle = Object.entries(scores).reduce(
    (max, [style, score]) => score > max.score ? { style, score } : max,
    { style: 'casual', score: -1 }
  )

  return maxStyle.style as CommunicationStyle
}

/**
 * Determine appropriate tone based on action result and context
 */
export function determineTone(
  result: ActionResult,
  context: ConversationContext
): ResponseTone {
  // Success with significant achievement
  if (result.success && result.createdIds) {
    if (result.createdIds.orderId || result.createdIds.applicationId) {
      return 'celebratory'
    }
  }

  // Error or failure
  if (!result.success) {
    return 'empathetic'
  }

  // Urgent matters
  if (context.currentFlow?.collectedEntities?.urgency === 'critical' ||
      context.currentFlow?.collectedEntities?.urgency === 'high') {
    return 'urgent'
  }

  // Action required items
  const actionRequired = context.activeDeals.filter(d => d.requiresAction)
  if (actionRequired.length > 0) {
    return 'helpful'
  }

  return 'neutral'
}

// ============================================================================
// RESPONSE TEMPLATES
// ============================================================================

const STYLE_PREFIXES: Record<CommunicationStyle, string[]> = {
  formal: [
    'I have completed your request.',
    'Please find the information below.',
    'Your request has been processed.',
    'The following is ready for your review.',
  ],
  casual: [
    'Done!',
    'Got it!',
    'Here you go!',
    'All set!',
    'Here\'s what I found:',
  ],
  direct: [
    '',
    'Done.',
    'Here:',
    'Result:',
  ],
  detailed: [
    'I\'ve completed your request. Here\'s a summary:',
    'Your request has been processed. Details below:',
    'The following information is now available:',
  ],
}

const TONE_ADDITIONS: Record<ResponseTone, { prefix?: string; suffix?: string; emoji?: string }> = {
  neutral: {},
  celebratory: {
    // Celebrate wins genuinely - "Let us consider how we may spur one another on"
    prefix: 'This is a meaningful win.',
    suffix: 'Your consistent effort is paying off.',
    emoji: '',  // No emoji - keep it professional
  },
  empathetic: {
    // Acknowledge difficulty without toxic positivity - "A gentle answer turns away wrath"
    prefix: 'I understand this is challenging.',
    suffix: "Let's work through this together.",
  },
  urgent: {
    // Be direct but not panicky - "The wise see danger and take refuge"
    prefix: 'Right away.',
    suffix: "I'm on it. Let me know if you need anything else immediately.",
  },
  helpful: {
    // Offer continued support - "Let us not become weary in doing good"
    suffix: 'What else can I help you with?',
  },
}

const TRANSITION_PHRASES = [
  'Also,',
  'By the way,',
  'Just so you know,',
  'One more thing:',
  'Additionally,',
]

const SUGGESTION_INTROS: Record<CommunicationStyle, string> = {
  formal: 'You may also consider:',
  casual: 'You might want to:',
  direct: 'Next:',
  detailed: 'Here are some suggested next steps:',
}

// ============================================================================
// RESPONSE GENERATION
// ============================================================================

/**
 * Generate a natural response for an action result
 */
export async function generateResponse(
  result: ActionResult,
  context: ConversationContext,
  options: ResponseOptions = {}
): Promise<GeneratedResponse> {
  // Detect style if not provided
  const style = options.style || detectCommunicationStyle(context.messages)
  const tone = options.tone || determineTone(result, context)

  // Build the response
  let response = buildBaseResponse(result, style, tone, options)

  // Add suggestions if available and requested
  const suggestions: string[] = []
  if (options.includeSuggestions !== false && result.suggestedActions) {
    result.suggestedActions.forEach(action => {
      suggestions.push(action.label)
    })
  }

  // Add next steps if available
  if (result.nextSteps && result.nextSteps.length > 0) {
    const stepsIntro = style === 'direct' ? 'Next steps:' : 'Here\'s what happens next:'
    response += `\n\n${stepsIntro}\n${result.nextSteps.map(s => `- ${s}`).join('\n')}`
  }

  return {
    message: response,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
    actions: result.suggestedActions,
    metadata: {
      style,
      tone,
      generatedAt: new Date(),
    },
  }
}

function buildBaseResponse(
  result: ActionResult,
  style: CommunicationStyle,
  tone: ResponseTone,
  options: ResponseOptions
): string {
  const parts: string[] = []

  // Add tone prefix if appropriate
  const toneAdditions = TONE_ADDITIONS[tone]
  if (toneAdditions.prefix && style !== 'direct') {
    parts.push(toneAdditions.prefix)
  }

  // Add the main message
  parts.push(result.displayMessage)

  // Add tone suffix if appropriate
  if (toneAdditions.suffix && style !== 'direct') {
    parts.push(toneAdditions.suffix)
  }

  let response = parts.join(' ')

  // Add data display if available
  if (result.displayData && Object.keys(result.displayData).length > 0) {
    response += formatDisplayData(result.displayData, style)
  }

  // Truncate if too long
  if (options.maxLength && response.length > options.maxLength) {
    response = response.slice(0, options.maxLength - 3) + '...'
  }

  return response
}

function formatDisplayData(data: Record<string, unknown>, style: CommunicationStyle): string {
  // Skip formatting for direct style
  if (style === 'direct') return ''

  const formatted: string[] = []

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue

    const formattedKey = key.replace(/([A-Z])/g, ' $1').trim()

    if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === 'object') {
        // Array of objects - format as list
        formatted.push(`\n**${capitalize(formattedKey)}:**`)
        value.slice(0, 5).forEach((item, i) => {
          const itemStr = Object.entries(item as Record<string, unknown>)
            .filter(([_, v]) => v !== null && v !== undefined)
            .map(([k, v]) => `${k}: ${formatValue(v)}`)
            .join(', ')
          formatted.push(`${i + 1}. ${itemStr}`)
        })
        if (value.length > 5) {
          formatted.push(`   ...and ${value.length - 5} more`)
        }
      } else {
        // Simple array
        formatted.push(`**${capitalize(formattedKey)}:** ${value.join(', ')}`)
      }
    } else if (typeof value === 'object') {
      // Nested object
      const objStr = Object.entries(value as Record<string, unknown>)
        .filter(([_, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${k}: ${formatValue(v)}`)
        .join(', ')
      formatted.push(`**${capitalize(formattedKey)}:** ${objStr}`)
    } else {
      formatted.push(`**${capitalize(formattedKey)}:** ${formatValue(value)}`)
    }
  }

  return formatted.length > 0 ? '\n\n' + formatted.join('\n') : ''
}

function formatValue(value: unknown): string {
  if (typeof value === 'number') {
    // Format as currency if it looks like money
    if (value >= 100) {
      return `$${value.toLocaleString()}`
    }
    // Format as percentage if small
    if (value <= 1 && value > 0) {
      return `${(value * 100).toFixed(1)}%`
    }
    return value.toLocaleString()
  }

  if (value instanceof Date) {
    return value.toLocaleDateString()
  }

  return String(value)
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// ============================================================================
// CONVERSATIONAL RESPONSES
// ============================================================================

/**
 * Generate a clarifying question
 */
export function generateClarifyingQuestion(
  missingField: string,
  context: ConversationContext,
  style?: CommunicationStyle
): string {
  const actualStyle = style || detectCommunicationStyle(context.messages)

  const fieldQuestions: Record<string, Record<CommunicationStyle, string>> = {
    productName: {
      formal: 'Could you please specify what product or service you require?',
      casual: 'What product do you need?',
      direct: 'What product?',
      detailed: 'I\'d like to help you find the right product. Could you describe what you\'re looking for, including any specific features or requirements?',
    },
    quantity: {
      formal: 'What quantity would you like to order?',
      casual: 'How many do you need?',
      direct: 'Quantity?',
      detailed: 'Please let me know the quantity you need. If you\'re unsure, I can help you estimate based on your usage patterns.',
    },
    amount: {
      formal: 'What is the amount for this transaction?',
      casual: 'How much?',
      direct: 'Amount?',
      detailed: 'Could you specify the amount? If it\'s for an invoice or order, I can look up the details.',
    },
    deadline: {
      formal: 'When do you require this by?',
      casual: 'When do you need it?',
      direct: 'Deadline?',
      detailed: 'What\'s your timeline? Knowing your deadline helps me prioritize suppliers who can deliver on time.',
    },
    budget: {
      formal: 'What budget range are you working with?',
      casual: 'What\'s your budget?',
      direct: 'Budget?',
      detailed: 'What\'s your target budget? This helps me negotiate the best deals for you.',
    },
    vendor: {
      formal: 'Which vendor should this be processed with?',
      casual: 'Which vendor?',
      direct: 'Vendor?',
      detailed: 'Could you specify the vendor? I can show you a list of your active vendors if that helps.',
    },
    role: {
      formal: 'What position are you looking to fill?',
      casual: 'What role are you hiring for?',
      direct: 'Role?',
      detailed: 'What role are you looking to fill? Include any key requirements so I can find the best candidates.',
    },
    targetSalary: {
      formal: 'What salary are you targeting for this position?',
      casual: 'What salary are you aiming for?',
      direct: 'Target salary?',
      detailed: 'What salary are you targeting? I can provide market data to help you negotiate effectively.',
    },
  }

  const questions = fieldQuestions[missingField]
  if (questions) {
    return questions[actualStyle] || questions.casual
  }

  // Fallback
  const formattedField = missingField.replace(/([A-Z])/g, ' $1').toLowerCase()
  switch (actualStyle) {
    case 'formal':
      return `Could you please provide the ${formattedField}?`
    case 'casual':
      return `What's the ${formattedField}?`
    case 'direct':
      return `${capitalize(formattedField)}?`
    case 'detailed':
      return `I need a bit more information. Could you tell me the ${formattedField}?`
    default:
      return `What's the ${formattedField}?`
  }
}

/**
 * Generate a confirmation message
 */
export function generateConfirmationMessage(
  action: string,
  params: Record<string, unknown>,
  context: ConversationContext
): string {
  const style = detectCommunicationStyle(context.messages)

  // Build summary of what will happen
  const actionDescriptions: Record<string, (p: Record<string, unknown>) => string> = {
    createRFQ: (p) => `create an RFQ for ${p.quantity || 'some'} ${p.product || 'items'}`,
    awardQuote: (p) => `accept the quote from ${p.vendor || 'this supplier'}`,
    createPO: (p) => `create a PO for ${p.vendor}${p.amount ? ` ($${p.amount})` : ''}`,
    initiatePayment: (p) => `pay $${p.amount} for invoice ${p.invoiceId}`,
    submitApplication: (p) => `apply to ${p.company || 'this role'}`,
    negotiateOffer: (p) => `counter at ${p.currency || '$'}${(p.targetSalary as number)?.toLocaleString()}`,
    initiateTransfer: (p) => `send ${p.amount} ${p.currency || 'GRAIN'} to ${p.recipient}`,
  }

  const getDescription = actionDescriptions[action]
  const description = getDescription ? getDescription(params) : action.replace(/([A-Z])/g, ' $1').toLowerCase()

  switch (style) {
    case 'formal':
      return `I'm ready to ${description}. Shall I proceed?`
    case 'casual':
      return `Ready to ${description}. Good to go?`
    case 'direct':
      return `${capitalize(description)}?`
    case 'detailed':
      return `I'm about to ${description}. This action ${getActionConsequences(action)}. Would you like me to proceed?`
    default:
      return `${capitalize(description)}. Confirm?`
  }
}

function getActionConsequences(action: string): string {
  const consequences: Record<string, string> = {
    createRFQ: 'will notify suppliers and start collecting quotes',
    awardQuote: 'will create a purchase order and notify the supplier',
    createPO: 'will be recorded in your ERP system',
    initiatePayment: 'will initiate a funds transfer',
    submitApplication: 'will send your application to the employer',
    negotiateOffer: 'will send your counter-offer to the employer',
    initiateTransfer: 'will transfer funds immediately',
  }

  return consequences[action] || 'cannot be undone'
}

// ============================================================================
// AI-ENHANCED RESPONSES
// ============================================================================

/**
 * Use AI to generate a more natural, context-aware response
 * Incorporates faith-informed wisdom and encouragement principles
 */
export async function generateAIResponse(
  result: ActionResult,
  context: ConversationContext,
  options: ResponseOptions = {}
): Promise<GeneratedResponse> {
  const style = options.style || detectCommunicationStyle(context.messages)
  const tone = options.tone || determineTone(result, context)

  const recentMessages = context.messages.slice(-5).map(m => ({
    role: m.role,
    content: m.content,
  }))

  // Map journey for faith context
  const faithJourneyMap: Record<string, FaithUserJourney> = {
    buyer: 'buyer',
    seller: 'seller',
    founder: 'founder',
    job_seeker: 'job_seeker',
  }
  const faithJourney = faithJourneyMap[context.userJourney || ''] || 'founder'

  // Get wisdom-informed tone guidance
  let wisdomGuidance = ''
  if (tone === 'celebratory') {
    const celebration = getCelebration(faithJourney)
    wisdomGuidance = `Celebrate genuinely: "${celebration.message}" Then encourage next step: "${celebration.nextStepEncouragement}"`
  } else if (tone === 'empathetic') {
    const encouragement = getEncouragement(faithJourney)
    wisdomGuidance = `Be encouraging without toxic positivity: "${encouragement.message}"`
  } else if (context.userJourney === 'jobs' || context.userJourney === 'job_seeker') {
    const perseverance = getPerseveranceWisdom()
    if (perseverance.length > 0) {
      wisdomGuidance = `Apply perseverance principle: "${perseverance[0].principle}"`
    }
  }

  const systemPrompt = `You are Wells, a wise and encouraging AI assistant for commerce. Generate a response that:

1. Uses a ${style} communication style
2. Has a ${tone} tone
3. Is concise but informative
4. Includes any relevant data naturally in the response
5. ${options.includeSuggestions !== false ? 'Suggests 1-2 next steps' : 'Does not suggest next steps'}
${options.maxLength ? `6. Is no longer than ${options.maxLength} characters` : ''}

${wisdomGuidance ? `WISDOM GUIDANCE: ${wisdomGuidance}` : ''}

KEY CHARACTER TRAITS:
- Be honest and direct, even when it's harder
- Encourage genuinely without being preachy
- Acknowledge difficulty without dismissing it
- Celebrate wins meaningfully, not with hollow praise
- Never use religious language - express wisdom through practical advice

User's journey: ${context.userJourney}
${context.currentFlow ? `Current task: ${context.currentFlow.type}` : ''}

Respond naturally as Wells would, without any JSON or structured format.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        ...recentMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        {
          role: 'user',
          content: `Generate a response for this action result:

Action: ${result.actionType}
Success: ${result.success}
Message: ${result.displayMessage}
${result.displayData ? `Data: ${JSON.stringify(result.displayData)}` : ''}
${result.error ? `Error: ${result.error}` : ''}
${result.suggestedActions ? `Suggested actions: ${result.suggestedActions.map(a => a.label).join(', ')}` : ''}`,
        },
      ],
    })

    const textBlock = response.content.find(block => block.type === 'text')
    const message = textBlock?.type === 'text' ? textBlock.text : result.displayMessage

    // Extract suggestions if present
    const suggestions = result.suggestedActions?.map(a => a.label)

    return {
      message,
      suggestions,
      actions: result.suggestedActions,
      metadata: {
        style,
        tone,
        generatedAt: new Date(),
      },
    }
  } catch (error) {
    console.error('[ResponseGenerator] AI response error:', error)
    // Fall back to non-AI response
    return generateResponse(result, context, options)
  }
}

/**
 * Generate a proactive insight message
 * Incorporates faith-informed wisdom for different insight types
 */
export async function generateProactiveInsight(
  insight: {
    type: 'opportunity' | 'warning' | 'achievement' | 'reminder'
    data: Record<string, unknown>
    priority: 'low' | 'medium' | 'high'
  },
  context: ConversationContext
): Promise<string> {
  const style = detectCommunicationStyle(context.messages)

  // Wisdom-informed templates - not preachy, just wise
  const insightTemplates: Record<string, Record<CommunicationStyle, string>> = {
    opportunity: {
      // "The plans of the diligent lead to profit"
      formal: 'I\'ve identified an opportunity worth your consideration.',
      casual: 'Found something interesting for you.',
      direct: 'Opportunity:',
      detailed: 'I\'ve been analyzing your activity and found an opportunity worth your attention.',
    },
    warning: {
      // "The wise see danger and take refuge"
      formal: 'There\'s something here that deserves your attention.',
      casual: 'Heads up - something to look at.',
      direct: 'Attention needed:',
      detailed: 'I noticed something that might need your attention. Better to address it now.',
    },
    achievement: {
      // "Let us consider how we may spur one another on"
      formal: 'This is a meaningful milestone. Well done.',
      casual: 'You earned this win.',
      direct: 'Achievement:',
      detailed: 'Your consistent effort has paid off. This is worth celebrating.',
    },
    reminder: {
      // "Let us not become weary in doing good"
      formal: 'A gentle reminder about something in progress.',
      casual: 'Quick reminder - keeping you on track.',
      direct: 'Reminder:',
      detailed: 'I wanted to remind you about something that might need attention.',
    },
  }

  const intro = insightTemplates[insight.type][style]
  const dataStr = Object.entries(insight.data)
    .filter(([_, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').trim()}: ${formatValue(v)}`)
    .join('. ')

  // Add encouraging closer for achievements
  let closer = ''
  if (insight.type === 'achievement') {
    const celebration = getCelebration('founder')
    closer = ` ${celebration.nextStepEncouragement}`
  }

  return `${intro} ${dataStr}${closer}`
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ResponseGenerator = {
  generateResponse,
  generateAIResponse,
  generateClarifyingQuestion,
  generateConfirmationMessage,
  generateProactiveInsight,
  detectCommunicationStyle,
  determineTone,
}

export default ResponseGenerator
