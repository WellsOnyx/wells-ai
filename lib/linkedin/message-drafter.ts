// @ts-nocheck
/**
 * LinkedIn Message Drafter
 *
 * Generates personalized LinkedIn messages in Wells' voice.
 * NOT corporate. NOT spammy. Direct, helpful, honest about being AI.
 *
 * Message Types:
 * - Connection requests (300 char limit)
 * - InMail messages (for Sales Navigator)
 * - Follow-up messages
 * - Engagement comments
 */

import Anthropic from '@anthropic-ai/sdk'
import { LinkedInProfile } from './profile-service'
import { WELLS_VOICE_PRINCIPLES, PersonalityMode, PERSONALITIES } from '@/lib/coldstart/wells-voice'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

export type MessageType = 'connection_request' | 'inmail' | 'followup' | 'comment' | 'direct_message'

export interface MessageContext {
  // Who is sending
  senderName: string
  senderCompany: string
  senderRole?: string
  valueProposition: string // What do they offer?

  // Why reaching out
  reason: string // The trigger/hook
  goal: string // Meeting? Partnership? Just connecting?

  // Optional context
  mutualConnections?: string[]
  sharedGroups?: string[]
  recentInteraction?: string
  customContext?: string // User's additional notes
}

export interface DraftedMessage {
  type: MessageType
  content: string
  characterCount: number
  isWithinLimit: boolean
  limitWarning?: string

  // Personalization tracking
  personalizationFactors: string[]
  referencedInfo: string[]

  // Wells' notes
  wellsNotes: string
  alternativeOpening?: string
}

export interface MessageLimits {
  connection_request: number
  inmail: number
  followup: number
  comment: number
  direct_message: number
}

const MESSAGE_LIMITS: MessageLimits = {
  connection_request: 300,
  inmail: 1900, // InMail has higher limits
  followup: 8000, // Regular messages
  comment: 3000,
  direct_message: 8000
}

// ============================================================================
// CORE MESSAGE GENERATION
// ============================================================================

/**
 * Generate a personalized LinkedIn message
 */
export async function draftMessage(
  profile: Partial<LinkedInProfile>,
  messageType: MessageType,
  context: MessageContext,
  personality: PersonalityMode = 'default'
): Promise<DraftedMessage> {
  const limit = MESSAGE_LIMITS[messageType]
  const persona = PERSONALITIES?.[personality] || PERSONALITIES?.default

  const systemPrompt = buildSystemPrompt(messageType, limit, persona)
  const userPrompt = buildUserPrompt(profile, context, messageType)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  })

  const text = response.content.find(b => b.type === 'text')?.text || '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)

  try {
    const parsed = JSON.parse(jsonMatch?.[0] || '{}')
    const content = parsed.message || parsed.content || ''
    const charCount = content.length

    return {
      type: messageType,
      content,
      characterCount: charCount,
      isWithinLimit: charCount <= limit,
      limitWarning: charCount > limit
        ? `Message is ${charCount - limit} characters over the ${limit} character limit. It will be truncated.`
        : undefined,
      personalizationFactors: parsed.personalizationFactors || [],
      referencedInfo: parsed.referencedInfo || [],
      wellsNotes: parsed.wellsNotes || '',
      alternativeOpening: parsed.alternativeOpening
    }
  } catch {
    return {
      type: messageType,
      content: text,
      characterCount: text.length,
      isWithinLimit: text.length <= limit,
      personalizationFactors: [],
      referencedInfo: [],
      wellsNotes: 'Parsing failed, raw response returned'
    }
  }
}

/**
 * Build the system prompt based on message type
 */
function buildSystemPrompt(
  messageType: MessageType,
  limit: number,
  persona: any
): string {
  const typeGuidance = {
    connection_request: `
This is a CONNECTION REQUEST. Maximum ${limit} characters.
- Super short - you have ONE chance
- Don't pitch - just connect
- Give them a reason to accept
- Make them curious, not pressured`,

    inmail: `
This is an INMAIL message. Maximum ${limit} characters.
- More room to breathe, but still be concise
- Lead with value, not your pitch
- They're getting 50 InMails a week - stand out
- Clear call to action`,

    followup: `
This is a FOLLOW-UP message. They already connected.
- Reference the connection
- Provide value before asking
- Don't be pushy about next steps
- Make it easy to respond`,

    comment: `
This is a COMMENT on their post.
- Be genuinely engaging, not promotional
- Add to the conversation
- Don't hijack with your pitch
- Show you actually read what they wrote`,

    direct_message: `
This is a DIRECT MESSAGE.
- They're already a connection
- Be more casual but still professional
- Clear purpose for reaching out
- Easy to respond to`
  }

  return `You are Wells, drafting LinkedIn messages.

${WELLS_VOICE_PRINCIPLES}

MESSAGE TYPE: ${messageType.toUpperCase()}
${typeGuidance[messageType]}

CHARACTER LIMIT: ${limit} (HARD LIMIT - count carefully!)

PERSONALITY MODE: ${persona?.mode || 'default'}
${persona ? `
- Traits: ${persona.traits?.join(', ')}
- Avoid: ${persona.avoidances?.join(', ')}
- Opening: ${persona.openingStyle}
- Closing: ${persona.closingStyle}` : ''}

CRITICAL RULES:
1. Be HONEST about being AI if relevant
2. ONE message, not a sequence
3. Lead with THEIR value, not yours
4. Make it EASY to say yes OR no
5. Stay within the character limit!

RESPOND WITH JSON:
{
  "message": "the actual message content",
  "personalizationFactors": ["what you referenced about them"],
  "referencedInfo": ["specific things you mentioned"],
  "wellsNotes": "why you wrote it this way",
  "alternativeOpening": "a different hook if the main one doesn't land"
}`
}

/**
 * Build the user prompt with profile and context
 */
function buildUserPrompt(
  profile: Partial<LinkedInProfile>,
  context: MessageContext,
  messageType: MessageType
): string {
  const profileInfo = []

  if (profile.fullName || profile.firstName) {
    profileInfo.push(`Name: ${profile.fullName || `${profile.firstName} ${profile.lastName}`}`)
  }
  if (profile.currentTitle) {
    profileInfo.push(`Title: ${profile.currentTitle}`)
  }
  if (profile.currentCompany) {
    profileInfo.push(`Company: ${profile.currentCompany}`)
  }
  if (profile.industry) {
    profileInfo.push(`Industry: ${profile.industry}`)
  }
  if (profile.location) {
    profileInfo.push(`Location: ${profile.location}`)
  }
  if (profile.headline) {
    profileInfo.push(`Headline: ${profile.headline}`)
  }
  if (profile.about) {
    profileInfo.push(`About: ${profile.about.substring(0, 500)}...`)
  }
  if (profile.recentPosts?.length) {
    profileInfo.push(`Recent post: "${profile.recentPosts[0].content?.substring(0, 200)}..."`)
  }
  if (profile.activitySignals?.length) {
    profileInfo.push(`Signals: ${profile.activitySignals.join(', ')}`)
  }

  return `
RECIPIENT PROFILE:
${profileInfo.length > 0 ? profileInfo.join('\n') : 'Limited info available - use what you have'}

SENDER CONTEXT:
- Sender: ${context.senderName} (${context.senderRole || 'Founder'})
- Company: ${context.senderCompany}
- Value they offer: ${context.valueProposition}
- Reason for reaching out: ${context.reason}
- Goal: ${context.goal}
${context.mutualConnections?.length ? `- Mutual connections: ${context.mutualConnections.join(', ')}` : ''}
${context.sharedGroups?.length ? `- Shared groups: ${context.sharedGroups.join(', ')}` : ''}
${context.recentInteraction ? `- Recent interaction: ${context.recentInteraction}` : ''}
${context.customContext ? `- Additional context: ${context.customContext}` : ''}

MESSAGE TYPE: ${messageType}

Write a ${messageType.replace('_', ' ')} for this specific person.
`
}

// ============================================================================
// SPECIALIZED DRAFTERS
// ============================================================================

/**
 * Draft a connection request (300 char limit)
 */
export async function draftConnectionRequest(
  profile: Partial<LinkedInProfile>,
  context: MessageContext,
  personality: PersonalityMode = 'default'
): Promise<DraftedMessage> {
  return draftMessage(profile, 'connection_request', context, personality)
}

/**
 * Draft an InMail message
 */
export async function draftInMail(
  profile: Partial<LinkedInProfile>,
  context: MessageContext,
  personality: PersonalityMode = 'default'
): Promise<DraftedMessage> {
  return draftMessage(profile, 'inmail', context, personality)
}

/**
 * Draft a follow-up message (after they connect)
 */
export async function draftFollowUp(
  profile: Partial<LinkedInProfile>,
  context: MessageContext,
  previousMessages?: string[],
  personality: PersonalityMode = 'default'
): Promise<DraftedMessage> {
  // Add previous message context
  const enrichedContext: MessageContext = {
    ...context,
    customContext: previousMessages?.length
      ? `Previous messages:\n${previousMessages.join('\n---\n')}\n\n${context.customContext || ''}`
      : context.customContext
  }

  return draftMessage(profile, 'followup', enrichedContext, personality)
}

/**
 * Draft a comment for engaging with their post
 */
export async function draftComment(
  profile: Partial<LinkedInProfile>,
  postContent: string,
  context: MessageContext,
  personality: PersonalityMode = 'default'
): Promise<DraftedMessage> {
  const enrichedContext: MessageContext = {
    ...context,
    customContext: `Their post: "${postContent}"\n\n${context.customContext || ''}`
  }

  const enrichedProfile: Partial<LinkedInProfile> = {
    ...profile,
    recentPosts: [{ content: postContent }, ...(profile.recentPosts || [])]
  }

  return draftMessage(enrichedProfile, 'comment', enrichedContext, personality)
}

// ============================================================================
// MESSAGE TEMPLATES (Quick starts)
// ============================================================================

export interface MessageTemplate {
  id: string
  name: string
  description: string
  type: MessageType
  template: string
  variables: string[]
  personality: PersonalityMode
}

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: 'quick_connect',
    name: 'Quick Connect',
    description: 'Simple, genuine connection request',
    type: 'connection_request',
    template: 'Hi {{firstName}}, noticed you work in {{industry}} - always looking to connect with folks tackling similar challenges. No pitch, just networking.',
    variables: ['firstName', 'industry'],
    personality: 'default'
  },
  {
    id: 'mutual_connection',
    name: 'Mutual Connection',
    description: 'Reference a shared connection',
    type: 'connection_request',
    template: "Hi {{firstName}}, {{mutualConnection}} and I were chatting and your work at {{company}} came up. Would love to connect.",
    variables: ['firstName', 'mutualConnection', 'company'],
    personality: 'warm'
  },
  {
    id: 'post_engagement',
    name: 'Post Engagement',
    description: 'Connect after engaging with their content',
    type: 'connection_request',
    template: "{{firstName}}, your recent post on {{topic}} resonated. Love your take on {{insight}}. Let's connect.",
    variables: ['firstName', 'topic', 'insight'],
    personality: 'thoughtful'
  },
  {
    id: 'value_first',
    name: 'Value First',
    description: 'Lead with something useful',
    type: 'connection_request',
    template: "Hi {{firstName}}, saw {{company}} is expanding in {{area}}. We just published research on that - happy to share. No strings.",
    variables: ['firstName', 'company', 'area'],
    personality: 'direct'
  },
  {
    id: 'inmail_meeting',
    name: 'InMail: Meeting Request',
    description: 'Request a brief meeting',
    type: 'inmail',
    template: `Hi {{firstName}},

I run {{senderCompany}}, and we help {{valueProposition}}.

{{personalizationHook}}

I'd love to learn more about {{company}}'s approach to {{topic}}. Would you be open to a 15-minute call this week or next?

If now's not the right time, no worries at all.

Best,
{{senderName}}`,
    variables: ['firstName', 'senderCompany', 'valueProposition', 'personalizationHook', 'company', 'topic', 'senderName'],
    personality: 'default'
  },
  {
    id: 'followup_after_connect',
    name: 'Follow-up After Connect',
    description: 'First message after they accept connection',
    type: 'followup',
    template: `Thanks for connecting, {{firstName}}!

I noticed {{observation}} - curious to learn more about how you're approaching that at {{company}}.

No agenda here - just always interesting to chat with folks solving similar problems.

Would you be up for a quick chat sometime?`,
    variables: ['firstName', 'observation', 'company'],
    personality: 'warm'
  }
]

/**
 * Get templates by type
 */
export function getTemplatesByType(type: MessageType): MessageTemplate[] {
  return MESSAGE_TEMPLATES.filter(t => t.type === type)
}

/**
 * Fill a template with values
 */
export function fillTemplate(template: MessageTemplate, values: Record<string, string>): string {
  let filled = template.template
  for (const [key, value] of Object.entries(values)) {
    filled = filled.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return filled
}

// ============================================================================
// MESSAGE IMPROVEMENT
// ============================================================================

/**
 * Suggest improvements for a draft message
 */
export async function suggestImprovements(
  message: string,
  messageType: MessageType,
  context?: Partial<MessageContext>
): Promise<{
  suggestions: string[]
  improvedVersion?: string
  issues: string[]
}> {
  const limit = MESSAGE_LIMITS[messageType]

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: `You are Wells, reviewing a LinkedIn ${messageType.replace('_', ' ')}.

Analyze this message for:
1. Is it within the ${limit} character limit?
2. Does it follow good outreach principles (value-first, genuine, not spammy)?
3. Is it personalized or generic?
4. Is the call-to-action clear and low-commitment?
5. Does it respect the recipient's time?

RESPOND WITH JSON:
{
  "suggestions": ["improvement 1", "improvement 2"],
  "improvedVersion": "an improved version if needed",
  "issues": ["any problems found"]
}`,
    messages: [{ role: 'user', content: `Review this message:\n\n"${message}"` }]
  })

  const text = response.content.find(b => b.type === 'text')?.text || '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)

  try {
    return JSON.parse(jsonMatch?.[0] || '{}')
  } catch {
    return {
      suggestions: ['Could not analyze message'],
      issues: []
    }
  }
}

/**
 * Shorten a message to fit within limits
 */
export async function shortenMessage(
  message: string,
  targetLimit: number,
  preserveIntent: string
): Promise<string> {
  if (message.length <= targetLimit) {
    return message
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: `Shorten this LinkedIn message to exactly ${targetLimit} characters or less.
Preserve the core intent: "${preserveIntent}"
Keep it natural and Wells-like - direct, genuine, not corporate.
Return ONLY the shortened message, nothing else.`,
    messages: [{ role: 'user', content: message }]
  })

  const text = response.content.find(b => b.type === 'text')?.text || message

  // If still too long, hard truncate
  if (text.length > targetLimit) {
    return text.substring(0, targetLimit - 3) + '...'
  }

  return text
}

// ============================================================================
// A/B VARIANTS
// ============================================================================

/**
 * Generate multiple variants of a message for testing
 */
export async function generateVariants(
  profile: Partial<LinkedInProfile>,
  messageType: MessageType,
  context: MessageContext,
  count: number = 3
): Promise<DraftedMessage[]> {
  const personalities: PersonalityMode[] = ['default', 'direct', 'warm', 'playful', 'thoughtful']
  const variants: DraftedMessage[] = []

  // Use different personalities for each variant
  for (let i = 0; i < Math.min(count, personalities.length); i++) {
    const variant = await draftMessage(profile, messageType, context, personalities[i])
    variants.push({
      ...variant,
      wellsNotes: `${variant.wellsNotes} [Personality: ${personalities[i]}]`
    })
  }

  return variants
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  draftMessage,
  draftConnectionRequest,
  draftInMail,
  draftFollowUp,
  draftComment,
  MESSAGE_TEMPLATES,
  getTemplatesByType,
  fillTemplate,
  suggestImprovements,
  shortenMessage,
  generateVariants,
  MESSAGE_LIMITS
}
