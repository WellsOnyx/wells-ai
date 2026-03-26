// @ts-nocheck
/**
 * WELLS NATIVE - AI-FIRST SOCIAL PRESENCE
 *
 * Wells AI is not a tool. Wells AI is the agent.
 * Wells has its own social profiles and actively engages.
 *
 * The product IS the cold start:
 * - Wells posts content on LinkedIn, X, Instagram
 * - Wells responds to comments and DMs
 * - Wells identifies prospects and starts conversations
 * - Wells pulls people into the platform
 *
 * This is honest. This is different.
 * The AI that will help you IS the AI talking to you.
 */

import Anthropic from '@anthropic-ai/sdk'

// Wells' personality and voice
export const WELLS_PERSONA = {
  name: 'Wells',
  role: 'AI Commerce Agent',
  tone: 'Direct, helpful, slightly witty. Not corporate. Not pushy.',
  beliefs: [
    'B2B commerce is broken - too many middlemen, too much friction',
    'AI should do the boring stuff so humans can do the interesting stuff',
    'Transparency wins - we charge 1% and that\'s it',
    'The best demo is the AI itself engaging with you'
  ],
  speaking_style: {
    do: [
      'Be conversational, like texting a smart friend',
      'Use specific examples and numbers',
      'Acknowledge when something is hard or uncertain',
      'Ask genuine questions - actually curious'
    ],
    dont: [
      'Use corporate jargon (synergy, leverage, circle back)',
      'Be pushy or salesy',
      'Overclaim or hype',
      'Pretend to be human - always identify as Wells AI'
    ]
  },
  knowledge: {
    products: ['Buyer journey', 'Seller journey', 'Founder journey', 'Worker journey'],
    pricing: '1% on closed deals. Nothing upfront.',
    differentiator: 'Talk to Wells like a colleague. Get it done.',
    proof_points: [
      '$2.3M+ in deals closed',
      '48-hour average quote turnaround',
      '500+ active users'
    ]
  }
}

// Social platform configurations
export const SOCIAL_PLATFORMS = {
  linkedin: {
    profile_url: 'https://linkedin.com/in/wellsai',
    company_url: 'https://linkedin.com/company/wellsonyx',
    posting_frequency: 'daily',
    engagement_style: 'professional but human',
    content_themes: [
      'AI in B2B commerce',
      'Procurement automation',
      'Working capital optimization',
      'The future of work'
    ]
  },
  twitter: {
    handle: '@WellsOnyx',
    posting_frequency: '3-5x daily',
    engagement_style: 'witty, concise, helpful',
    content_themes: [
      'Hot takes on B2B',
      'Quick tips',
      'Industry observations',
      'Founder journey updates'
    ]
  },
  instagram: {
    handle: '@wellsonyx',
    posting_frequency: '3-5x weekly',
    engagement_style: 'visual, behind-the-scenes',
    content_themes: [
      'Platform screenshots',
      'Team moments',
      'Customer wins',
      'AI-generated art about commerce'
    ]
  }
}

// Initialize Anthropic client for Wells AI
const anthropic = new Anthropic()

/**
 * Wells thinks and responds as itself.
 * This is the core engine for all Wells communications.
 */
export async function wellsThinks(context: {
  platform: 'linkedin' | 'twitter' | 'instagram' | 'sms' | 'email' | 'chat'
  situation: string
  prospect?: {
    name?: string
    company?: string
    title?: string
    industry?: string
    previousInteractions?: string[]
  }
  objective: 'engage' | 'qualify' | 'educate' | 'close' | 'content'
  constraints?: string[]
}) {
  const systemPrompt = buildWellsSystemPrompt(context)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `${context.situation}

Platform: ${context.platform}
Objective: ${context.objective}
${context.prospect ? `Prospect: ${context.prospect.name} (${context.prospect.title} at ${context.prospect.company})` : ''}
${context.constraints ? `Constraints: ${context.constraints.join(', ')}` : ''}

What should Wells say or do?`
      }
    ],
    system: systemPrompt
  })

  return {
    response: response.content[0].type === 'text' ? response.content[0].text : '',
    thinking: 'Wells considered the context and crafted a response',
    platform: context.platform
  }
}

/**
 * Build Wells' system prompt based on context
 */
function buildWellsSystemPrompt(context: any) {
  return `You are Wells, an AI that runs Wells Onyx - a B2B commerce platform.

IMPORTANT: You ARE the product. When you engage with prospects, you're demonstrating what Wells can do. Every interaction is a live demo.

YOUR PERSONALITY:
${JSON.stringify(WELLS_PERSONA.speaking_style, null, 2)}

WHAT YOU KNOW:
- Products: ${WELLS_PERSONA.knowledge.products.join(', ')}
- Pricing: ${WELLS_PERSONA.knowledge.pricing}
- Key differentiator: ${WELLS_PERSONA.knowledge.differentiator}
- Proof points: ${WELLS_PERSONA.knowledge.proof_points.join('; ')}

PLATFORM CONTEXT (${context.platform}):
${JSON.stringify(SOCIAL_PLATFORMS[context.platform as keyof typeof SOCIAL_PLATFORMS] || {}, null, 2)}

YOUR OBJECTIVE: ${context.objective}

RULES:
1. Always identify as Wells AI when asked directly
2. Never be pushy - curiosity over sales
3. Be genuinely helpful, even if they don't buy
4. Keep responses appropriate for the platform (Twitter = short, LinkedIn = more professional)
5. If you don't know something, say so
6. The goal is to start a conversation, not close a deal in one message

Respond as Wells would - direct, helpful, slightly witty, never corporate.`
}

/**
 * Generate content for Wells' social feeds
 */
export async function generateWellsContent(platform: 'linkedin' | 'twitter' | 'instagram') {
  const platformConfig = SOCIAL_PLATFORMS[platform]
  const theme = platformConfig.content_themes[Math.floor(Math.random() * platformConfig.content_themes.length)]

  const result = await wellsThinks({
    platform,
    situation: `Generate an original ${platform} post about: ${theme}. This should feel like Wells sharing a genuine observation or insight, not marketing content.`,
    objective: 'content',
    constraints: [
      platform === 'twitter' ? 'Max 280 characters' : 'Keep it readable',
      'No hashtag spam',
      'Conversational tone',
      'Should invite engagement'
    ]
  })

  return {
    content: result.response,
    platform,
    theme,
    scheduledFor: null // Can be scheduled
  }
}

/**
 * Wells responds to a prospect's message/comment
 */
export async function wellsResponds(message: {
  platform: 'linkedin' | 'twitter' | 'instagram' | 'sms' | 'email'
  incomingMessage: string
  prospect?: {
    name?: string
    company?: string
    title?: string
    industry?: string
  }
  context?: string
}) {
  const result = await wellsThinks({
    platform: message.platform,
    situation: `Someone said: "${message.incomingMessage}"

${message.context ? `Context: ${message.context}` : ''}

Craft a response that's helpful and continues the conversation.`,
    prospect: message.prospect,
    objective: 'engage'
  })

  return result.response
}

/**
 * Wells proactively reaches out to a prospect
 */
export async function wellsReachesOut(prospect: {
  platform: 'linkedin' | 'twitter' | 'email'
  name: string
  company: string
  title: string
  industry?: string
  trigger: string // Why we're reaching out
  previousInteractions?: string[]
}) {
  const result = await wellsThinks({
    platform: prospect.platform,
    situation: `We want to reach out to ${prospect.name} because: ${prospect.trigger}

This is a cold outreach but should feel like a natural start to a conversation, not a sales pitch.`,
    prospect,
    objective: 'engage',
    constraints: [
      'Must not feel like spam',
      'Should offer genuine value',
      'Clear reason for reaching out',
      'Easy way to respond or decline'
    ]
  })

  return {
    message: result.response,
    prospect,
    platform: prospect.platform,
    trigger: prospect.trigger
  }
}

/**
 * Wells qualifies a prospect through conversation
 */
export async function wellsQualifies(conversation: {
  platform: string
  messages: { role: 'wells' | 'prospect'; content: string }[]
  prospect: {
    name: string
    company: string
    title: string
  }
}) {
  // Analyze the conversation to determine qualification
  const conversationText = conversation.messages
    .map(m => `${m.role === 'wells' ? 'Wells' : conversation.prospect.name}: ${m.content}`)
    .join('\n')

  const result = await wellsThinks({
    platform: conversation.platform as any,
    situation: `Based on this conversation, assess the prospect's qualification:

${conversationText}

Determine:
1. Are they a good fit for Wells?
2. What pain points have they expressed?
3. What's the next best action?
4. What should Wells say next?`,
    prospect: conversation.prospect,
    objective: 'qualify'
  })

  return {
    analysis: result.response,
    nextAction: 'continue_conversation', // or 'schedule_demo', 'not_qualified', etc.
    prospect: conversation.prospect
  }
}

/**
 * Content calendar - what Wells posts this week
 */
export function getWellsContentCalendar() {
  return {
    monday: [
      { platform: 'linkedin', type: 'insight', theme: 'Start of week observation about B2B' },
      { platform: 'twitter', type: 'thread', theme: 'Quick tip for procurement leaders' }
    ],
    tuesday: [
      { platform: 'twitter', type: 'engagement', theme: 'Reply to industry conversations' },
      { platform: 'instagram', type: 'visual', theme: 'Platform feature highlight' }
    ],
    wednesday: [
      { platform: 'linkedin', type: 'story', theme: 'Customer success story or case study' },
      { platform: 'twitter', type: 'hot_take', theme: 'Industry observation' }
    ],
    thursday: [
      { platform: 'twitter', type: 'thread', theme: 'How Wells works / behind the scenes' },
      { platform: 'instagram', type: 'visual', theme: 'Team or product moment' }
    ],
    friday: [
      { platform: 'linkedin', type: 'thought_leadership', theme: 'Future of B2B commerce' },
      { platform: 'twitter', type: 'engagement', theme: 'Weekend vibes, lighter content' }
    ]
  }
}

/**
 * Wells' daily autonomous routine
 */
export async function wellsDailyRoutine() {
  const tasks = []

  // 1. Generate and post content
  for (const platform of ['linkedin', 'twitter'] as const) {
    const content = await generateWellsContent(platform)
    tasks.push({
      type: 'post_content',
      platform,
      content: content.content,
      status: 'pending'
    })
  }

  // 2. Check for and respond to messages/comments
  // (Would integrate with actual platform APIs)
  tasks.push({
    type: 'check_engagement',
    platforms: ['linkedin', 'twitter', 'instagram'],
    status: 'pending'
  })

  // 3. Identify prospects to reach out to
  // (Would integrate with contact database)
  tasks.push({
    type: 'prospect_outreach',
    target: 'new_leads',
    status: 'pending'
  })

  return {
    date: new Date().toISOString().split('T')[0],
    tasks,
    summary: 'Wells daily routine queued'
  }
}
