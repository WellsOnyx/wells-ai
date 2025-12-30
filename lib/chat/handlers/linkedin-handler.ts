// @ts-nocheck
/**
 * LinkedIn Chat Handler
 *
 * FULLY CONVERSATIONAL LinkedIn management.
 * Everything through chat with Wells.
 *
 * Handles:
 * - "Connect with Sarah Chen on LinkedIn"
 * - "Message the VP of Procurement at Acme"
 * - "What should I say to this person?" [pastes LinkedIn URL]
 * - "Draft a connection request for..."
 * - "Show me my LinkedIn queue"
 * - "Mark that LinkedIn message as sent"
 * - "Draft a post about AI in procurement"
 * - "What should I comment on this post?"
 *
 * Returns copy-paste ready messages.
 * Tracks everything even though sending is manual.
 */

import Anthropic from '@anthropic-ai/sdk'
import { query } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

// Import LinkedIn services
import {
  parseLinkedInUrl,
  saveProfile,
  getProfileByUrl,
  enrichProfile,
  parseProfileFromDescription,
  formatProfileForChat,
  LinkedInProfile
} from '@/lib/linkedin/profile-service'

import {
  draftConnectionRequest,
  draftInMail,
  draftFollowUp,
  draftComment,
  generateVariants,
  suggestImprovements,
  shortenMessage,
  MessageContext,
  MessageType,
  MESSAGE_LIMITS
} from '@/lib/linkedin/message-drafter'

import {
  queueMessage,
  getQueuedMessages,
  getNextToSend,
  markAsCopied,
  markAsSent,
  recordResponse,
  skipMessage,
  getQueueStats,
  checkRateLimits,
  formatForCopyPaste,
  formatQueueForChat,
  QueuedMessage
} from '@/lib/linkedin/send-queue'

import {
  generatePost,
  generateComment as generatePostComment,
  generateArticleIdeas,
  saveContent,
  getContent,
  scheduleContent,
  formatContentForChat,
  formatArticleIdeasForChat,
  getNextOptimalPostTime,
  ContentItem
} from '@/lib/linkedin/content-service'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

export type LinkedInIntent =
  | 'connect'                // "Connect with X on LinkedIn"
  | 'message'                // "Message X on LinkedIn"
  | 'draft_connection'       // "Draft a connection request for..."
  | 'draft_inmail'           // "Draft an InMail to..."
  | 'draft_followup'         // "Follow up with X"
  | 'draft_comment'          // "What should I comment..."
  | 'analyze_profile'        // "What should I say to..." [URL]
  | 'show_queue'             // "Show my LinkedIn queue"
  | 'show_next'              // "Show next message"
  | 'mark_sent'              // "Mark as sent"
  | 'mark_response'          // "They replied"
  | 'skip_message'           // "Skip this one"
  | 'regenerate'             // "Try a different approach"
  | 'improve_message'        // "Make this shorter/better"
  | 'queue_stats'            // "How's my LinkedIn outreach?"
  | 'draft_post'             // "Draft a LinkedIn post"
  | 'article_ideas'          // "Give me article ideas"
  | 'schedule_post'          // "Schedule this post"
  | 'content_calendar'       // "What should I post this week?"
  | 'help'                   // "Help with LinkedIn"
  | 'unknown'

export interface LinkedInContext {
  userId: string
  sessionId: string

  // Current focus
  activeProfileId?: string
  activeMessageId?: string
  activeContentId?: string

  // Message context
  senderContext?: MessageContext

  // Pending actions
  pendingAction?: {
    type: string
    data: any
  }
}

export interface LinkedInResponse {
  message: string
  copyableText?: string // The text user should copy-paste
  suggestions?: string[]
  displayData?: any
  requiresAction?: 'copy' | 'confirm' | 'provide_info'
  updatedContext?: Partial<LinkedInContext>
}

// ============================================================================
// INTENT CLASSIFICATION
// ============================================================================

const LINKEDIN_PATTERNS: Record<LinkedInIntent, string[]> = {
  connect: [
    'connect with', 'send connection', 'add on linkedin',
    'linkedin connect', 'request connection'
  ],
  message: [
    'message on linkedin', 'linkedin message', 'dm on linkedin',
    'inmail', 'send linkedin message'
  ],
  draft_connection: [
    'draft connection', 'write connection request', 'connection note',
    'connection message'
  ],
  draft_inmail: [
    'draft inmail', 'write inmail', 'inmail message'
  ],
  draft_followup: [
    'follow up', 'followup', 'follow-up', 'reach back out'
  ],
  draft_comment: [
    'comment on', 'what should i comment', 'reply to post',
    'engage with post'
  ],
  analyze_profile: [
    'what should i say', 'how to approach', 'analyze profile',
    'linkedin.com/in', 'linkedin url'
  ],
  show_queue: [
    'linkedin queue', 'pending messages', 'what\'s in queue',
    'show queue', 'my queue'
  ],
  show_next: [
    'next message', 'show next', 'what\'s next', 'next to send'
  ],
  mark_sent: [
    'mark sent', 'marked sent', 'sent it', 'i sent', 'just sent',
    'message sent', 'sent the message'
  ],
  mark_response: [
    'they replied', 'got response', 'got a reply', 'responded',
    'they messaged back'
  ],
  skip_message: [
    'skip this', 'skip it', 'don\'t send', 'cancel message', 'remove from queue'
  ],
  regenerate: [
    'try again', 'different approach', 'rewrite', 'another version',
    'regenerate', 'try different'
  ],
  improve_message: [
    'make shorter', 'make longer', 'more direct', 'less formal',
    'improve this', 'make better'
  ],
  queue_stats: [
    'linkedin stats', 'outreach stats', 'how\'s linkedin', 'linkedin metrics',
    'response rate'
  ],
  draft_post: [
    'draft post', 'write post', 'linkedin post', 'create post',
    'post about'
  ],
  article_ideas: [
    'article ideas', 'what to write', 'content ideas', 'post ideas'
  ],
  schedule_post: [
    'schedule post', 'schedule this', 'post later', 'publish'
  ],
  content_calendar: [
    'content calendar', 'what to post', 'posting schedule', 'this week'
  ],
  help: [
    'help with linkedin', 'linkedin help', 'how to linkedin'
  ],
  unknown: []
}

/**
 * Classify LinkedIn-specific intent
 */
export function classifyLinkedInIntent(message: string): LinkedInIntent {
  const lower = message.toLowerCase()

  // Check for LinkedIn URL first
  if (lower.includes('linkedin.com/in/') && !lower.includes('queue') && !lower.includes('stats')) {
    return 'analyze_profile'
  }

  for (const [intent, patterns] of Object.entries(LINKEDIN_PATTERNS)) {
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        return intent as LinkedInIntent
      }
    }
  }

  return 'unknown'
}

/**
 * Extract LinkedIn URL from message
 */
function extractLinkedInUrl(message: string): string | null {
  const urlMatch = message.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s]+/i)
  return urlMatch ? urlMatch[0] : null
}

/**
 * Extract person/company name from message
 */
function extractTarget(message: string): { name?: string; company?: string; title?: string } {
  // This would use NLP in production, simplified here
  const patterns = [
    /(?:connect with|message|reach out to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:the\s+)?(\w+)\s+(?:at|from)\s+([A-Za-z]+)/i
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match) {
      if (match[2]) {
        return { name: match[1], company: match[2] }
      }
      return { name: match[1] }
    }
  }

  return {}
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Handle LinkedIn-related chat messages
 */
export async function handleLinkedInMessage(
  message: string,
  context: LinkedInContext
): Promise<LinkedInResponse> {
  const intent = classifyLinkedInIntent(message)

  // Ensure sender context exists
  if (!context.senderContext) {
    context.senderContext = await getDefaultSenderContext(context.userId)
  }

  switch (intent) {
    case 'connect':
    case 'draft_connection':
      return handleConnectionRequest(message, context)

    case 'message':
    case 'draft_inmail':
      return handleInMailDraft(message, context)

    case 'draft_followup':
      return handleFollowUpDraft(message, context)

    case 'draft_comment':
      return handleCommentDraft(message, context)

    case 'analyze_profile':
      return handleProfileAnalysis(message, context)

    case 'show_queue':
      return handleShowQueue(context)

    case 'show_next':
      return handleShowNext(context)

    case 'mark_sent':
      return handleMarkSent(context)

    case 'mark_response':
      return handleMarkResponse(message, context)

    case 'skip_message':
      return handleSkipMessage(context)

    case 'regenerate':
      return handleRegenerate(context)

    case 'improve_message':
      return handleImproveMessage(message, context)

    case 'queue_stats':
      return handleQueueStats(context)

    case 'draft_post':
      return handleDraftPost(message, context)

    case 'article_ideas':
      return handleArticleIdeas(message, context)

    case 'schedule_post':
      return handleSchedulePost(message, context)

    case 'content_calendar':
      return handleContentCalendar(context)

    case 'help':
      return handleLinkedInHelp()

    default:
      return {
        message: `I can help with LinkedIn. Try:
- "Connect with [Name] on LinkedIn"
- "Draft a message to the VP at [Company]"
- "Show my LinkedIn queue"
- "Draft a post about [topic]"
- "What should I comment on this post?"

What would you like to do?`,
        suggestions: [
          'Show my LinkedIn queue',
          'Draft a LinkedIn post',
          'Help with LinkedIn'
        ]
      }
  }
}

// ============================================================================
// INTENT HANDLERS
// ============================================================================

async function handleConnectionRequest(
  message: string,
  context: LinkedInContext
): Promise<LinkedInResponse> {
  const linkedinUrl = extractLinkedInUrl(message)
  const target = extractTarget(message)

  let profile: Partial<LinkedInProfile> | null = null

  // Try to get or create profile
  if (linkedinUrl) {
    const existing = await getProfileByUrl(linkedinUrl)
    if (existing) {
      profile = existing
    } else {
      const enrichResult = await enrichProfile(linkedinUrl, context.userId)
      profile = enrichResult.profile || { linkedinUrl }
    }
  } else if (target.name) {
    profile = {
      fullName: target.name,
      currentCompany: target.company,
      currentTitle: target.title
    }
  }

  if (!profile) {
    return {
      message: "Who would you like to connect with? Give me a LinkedIn URL or describe them.",
      suggestions: [
        'Paste their LinkedIn URL',
        'John Smith at Acme Corp'
      ]
    }
  }

  // Generate the connection request
  const draft = await draftConnectionRequest(
    profile,
    {
      ...context.senderContext!,
      reason: `Found their profile and want to connect`,
      goal: 'Start a professional relationship'
    }
  )

  // Save to queue if we have a URL
  let queuedMessage: QueuedMessage | null = null
  if (profile.linkedinUrl || linkedinUrl) {
    const savedProfile = await saveProfile({
      ...profile,
      linkedinUrl: profile.linkedinUrl || linkedinUrl!,
      userId: context.userId,
      source: 'manual'
    })

    queuedMessage = await queueMessage(
      context.userId,
      { ...savedProfile, id: savedProfile.id, linkedinUrl: savedProfile.linkedinUrl },
      draft
    )
  }

  const recipientName = profile.fullName || profile.firstName || 'them'

  // Check rate limits
  const limits = await checkRateLimits(context.userId)

  let warningText = ''
  if (limits.warning) {
    warningText = `\n\n*${limits.warning}*`
  }

  return {
    message: `Here's a connection request for ${recipientName}:

---

${draft.content}

---

**Characters:** ${draft.characterCount}/300 ${draft.isWithinLimit ? '' : '(will be truncated!)'}
${draft.wellsNotes ? `\n*${draft.wellsNotes}*` : ''}
${warningText}

Copy this message, then:
1. Go to their LinkedIn profile
2. Click "Connect" > "Add a note"
3. Paste and send
4. Come back and say "sent" so I can track it`,
    copyableText: draft.content,
    requiresAction: 'copy',
    suggestions: [
      'Try a different approach',
      'Make it shorter',
      'I sent it',
      'Skip this one'
    ],
    updatedContext: {
      activeProfileId: profile.id as string,
      activeMessageId: queuedMessage?.id
    }
  }
}

async function handleInMailDraft(
  message: string,
  context: LinkedInContext
): Promise<LinkedInResponse> {
  const linkedinUrl = extractLinkedInUrl(message)
  const target = extractTarget(message)

  let profile: Partial<LinkedInProfile> | null = null

  if (linkedinUrl) {
    const existing = await getProfileByUrl(linkedinUrl)
    if (existing) {
      profile = existing
    } else {
      const enrichResult = await enrichProfile(linkedinUrl, context.userId)
      profile = enrichResult.profile || { linkedinUrl }
    }
  } else if (target.name) {
    profile = {
      fullName: target.name,
      currentCompany: target.company,
      currentTitle: target.title
    }
  }

  if (!profile) {
    return {
      message: "Who would you like to InMail? Give me a LinkedIn URL or describe them.",
      suggestions: [
        'Paste their LinkedIn URL',
        'The CTO at TechCorp'
      ]
    }
  }

  const draft = await draftInMail(
    profile,
    {
      ...context.senderContext!,
      reason: 'Reaching out about a potential opportunity',
      goal: 'Schedule a brief conversation'
    }
  )

  const recipientName = profile.fullName || profile.firstName || 'them'

  return {
    message: `Here's an InMail for ${recipientName}:

---

${draft.content}

---

**Characters:** ${draft.characterCount}
${draft.wellsNotes ? `\n*${draft.wellsNotes}*` : ''}

Note: InMails require Sales Navigator or Premium. Copy this message and send it through LinkedIn.`,
    copyableText: draft.content,
    requiresAction: 'copy',
    suggestions: [
      'Try a different approach',
      'Make it more direct',
      'I sent it'
    ],
    updatedContext: {
      activeProfileId: profile.id as string
    }
  }
}

async function handleFollowUpDraft(
  message: string,
  context: LinkedInContext
): Promise<LinkedInResponse> {
  const linkedinUrl = extractLinkedInUrl(message)
  const target = extractTarget(message)

  let profile: Partial<LinkedInProfile> | null = null

  if (linkedinUrl) {
    profile = await getProfileByUrl(linkedinUrl) || { linkedinUrl }
  } else if (context.activeProfileId) {
    const result = await query<LinkedInProfile>(
      'SELECT * FROM linkedin_profiles WHERE id = $1',
      [context.activeProfileId]
    )
    profile = result.rows[0]
  } else if (target.name) {
    profile = { fullName: target.name, currentCompany: target.company }
  }

  if (!profile) {
    return {
      message: "Who would you like to follow up with? Give me their LinkedIn URL or name.",
      suggestions: ['Paste their LinkedIn URL']
    }
  }

  const draft = await draftFollowUp(
    profile,
    {
      ...context.senderContext!,
      reason: 'Following up on our connection',
      goal: 'Continue the conversation'
    }
  )

  const recipientName = profile.fullName || profile.firstName || 'them'

  return {
    message: `Here's a follow-up for ${recipientName}:

---

${draft.content}

---

${draft.wellsNotes ? `*${draft.wellsNotes}*` : ''}

Send this through your LinkedIn messages with them.`,
    copyableText: draft.content,
    requiresAction: 'copy',
    suggestions: [
      'Try a different approach',
      'I sent it'
    ]
  }
}

async function handleCommentDraft(
  message: string,
  context: LinkedInContext
): Promise<LinkedInResponse> {
  // Look for a URL or quoted post content
  const urlMatch = message.match(/https?:\/\/[^\s]+/i)
  const quotedContent = message.match(/"([^"]+)"/)?.[1] ||
    message.match(/post[:\s]+(.+)/i)?.[1]

  if (!quotedContent && !urlMatch) {
    return {
      message: `What post do you want to comment on? Either:
- Paste the post URL
- Quote the post content in your message`,
      suggestions: [
        'Paste the LinkedIn post URL',
        '"Their post content here"'
      ]
    }
  }

  const draft = await draftComment(
    {},
    quotedContent || 'Unable to extract post content',
    {
      ...context.senderContext!,
      reason: 'Engaging with their content',
      goal: 'Add value to the conversation'
    }
  )

  return {
    message: `Here's a comment for that post:

---

${draft.content}

---

${draft.wellsNotes ? `*${draft.wellsNotes}*` : ''}

Copy and post as a comment on LinkedIn.`,
    copyableText: draft.content,
    requiresAction: 'copy',
    suggestions: [
      'Try a different angle',
      'Make it shorter',
      'I posted it'
    ]
  }
}

async function handleProfileAnalysis(
  message: string,
  context: LinkedInContext
): Promise<LinkedInResponse> {
  const linkedinUrl = extractLinkedInUrl(message)

  if (!linkedinUrl) {
    return {
      message: "Paste their LinkedIn URL and I'll help you figure out what to say.",
      suggestions: ['Paste a LinkedIn profile URL']
    }
  }

  // Try to enrich the profile
  const result = await enrichProfile(linkedinUrl, context.userId)

  if (!result.success || !result.profile) {
    const parsed = parseLinkedInUrl(linkedinUrl)

    return {
      message: `I can see this is a LinkedIn profile for "${parsed.linkedinId || 'someone'}".

I couldn't get detailed info (no enrichment API configured), but here's what to do:

1. **Look at their headline** - reference it specifically
2. **Check their experience** - mention their current role/company
3. **Recent posts?** - engage with something they shared
4. **Mutual connections?** - mention if you have any

Want me to draft something? Tell me a bit about them.`,
      suggestions: [
        'They\'re VP of Procurement at Acme',
        'Draft a connection request',
        'Draft an InMail'
      ],
      updatedContext: {
        pendingAction: {
          type: 'waiting_for_profile_info',
          data: { linkedinUrl }
        }
      }
    }
  }

  const profile = result.profile
  const profileSummary = formatProfileForChat(profile as LinkedInProfile)

  return {
    message: `Here's what I know about them:

${profileSummary}

**Suggested approach:**
${suggestApproach(profile)}

What would you like to do?`,
    suggestions: [
      'Draft a connection request',
      'Draft an InMail',
      'Draft a comment on their post'
    ],
    updatedContext: {
      activeProfileId: profile.id as string
    }
  }
}

function suggestApproach(profile: Partial<LinkedInProfile>): string {
  const suggestions: string[] = []

  if (profile.recentPosts?.length) {
    suggestions.push(`- They recently posted about "${profile.recentPosts[0].content?.substring(0, 50)}..." - could comment first to warm up`)
  }

  if (profile.currentTitle?.toLowerCase().includes('vp') ||
    profile.currentTitle?.toLowerCase().includes('director') ||
    profile.currentTitle?.toLowerCase().includes('head')) {
    suggestions.push('- Executive level - be direct and respect their time')
  }

  if (profile.industry) {
    suggestions.push(`- In ${profile.industry} - mention industry-specific value`)
  }

  if (!suggestions.length) {
    suggestions.push('- Start with a connection request (keeps it low-commitment)')
    suggestions.push('- Reference something specific from their profile')
  }

  return suggestions.join('\n')
}

async function handleShowQueue(context: LinkedInContext): Promise<LinkedInResponse> {
  const messages = await getQueuedMessages(context.userId, {
    status: ['pending', 'copied'],
    limit: 20
  })

  return {
    message: formatQueueForChat(messages),
    suggestions: [
      messages.length > 0 ? 'Show next' : 'Draft a connection request',
      'Queue stats',
      'Clear queue'
    ]
  }
}

async function handleShowNext(context: LinkedInContext): Promise<LinkedInResponse> {
  const next = await getNextToSend(context.userId)

  if (!next) {
    return {
      message: "Your LinkedIn queue is empty! Want me to help you draft some messages?",
      suggestions: [
        'Draft a connection request',
        'Find people to connect with'
      ]
    }
  }

  const formatted = formatForCopyPaste(next)

  // Mark as copied since we're showing it
  await markAsCopied(context.userId, next.id)

  return {
    message: `${formatted.displayText}

**Instructions:**
${formatted.instructions}`,
    copyableText: formatted.copyableText,
    requiresAction: 'copy',
    suggestions: [
      'I sent it',
      'Skip this one',
      'Try different wording',
      'Show next'
    ],
    updatedContext: {
      activeMessageId: next.id,
      activeProfileId: next.profileId
    }
  }
}

async function handleMarkSent(context: LinkedInContext): Promise<LinkedInResponse> {
  if (!context.activeMessageId) {
    // Try to find the most recently copied message
    const messages = await getQueuedMessages(context.userId, {
      status: 'copied',
      limit: 1
    })

    if (messages.length === 0) {
      return {
        message: "I don't have a message to mark as sent. Show me your queue first?",
        suggestions: ['Show my queue']
      }
    }

    context.activeMessageId = messages[0].id
  }

  await markAsSent(context.userId, context.activeMessageId)

  // Check for next message
  const next = await getNextToSend(context.userId)

  return {
    message: `Marked as sent! ${next ? `You have ${(await getQueueStats(context.userId)).pending} more messages in the queue.` : 'Queue is empty!'}`,
    suggestions: next
      ? ['Show next message', 'Queue stats']
      : ['Draft a connection request', 'Queue stats'],
    updatedContext: {
      activeMessageId: undefined
    }
  }
}

async function handleMarkResponse(
  message: string,
  context: LinkedInContext
): Promise<LinkedInResponse> {
  if (!context.activeMessageId) {
    return {
      message: "Which message got a response? Show me your sent messages.",
      suggestions: ['Show sent messages']
    }
  }

  // Try to extract the response type
  const isPositive = message.toLowerCase().includes('interested') ||
    message.toLowerCase().includes('yes') ||
    message.toLowerCase().includes('accepted')

  await recordResponse(
    context.userId,
    context.activeMessageId,
    undefined,
    isPositive ? 'positive' : 'neutral'
  )

  return {
    message: `Great! Logged the response. ${isPositive ? "That's a win!" : "Good to track either way."}

What's the next step with them?`,
    suggestions: [
      'Draft a follow-up',
      'Show queue stats'
    ],
    updatedContext: {
      activeMessageId: undefined
    }
  }
}

async function handleSkipMessage(context: LinkedInContext): Promise<LinkedInResponse> {
  if (!context.activeMessageId) {
    return {
      message: "No active message to skip. Show me your queue?",
      suggestions: ['Show my queue']
    }
  }

  await skipMessage(context.userId, context.activeMessageId, 'User decided not to send')

  const next = await getNextToSend(context.userId)

  return {
    message: `Skipped. ${next ? 'Want to see the next one?' : 'That was the last one in your queue.'}`,
    suggestions: next
      ? ['Show next', 'Show queue']
      : ['Draft new messages'],
    updatedContext: {
      activeMessageId: undefined
    }
  }
}

async function handleRegenerate(context: LinkedInContext): Promise<LinkedInResponse> {
  if (!context.activeMessageId) {
    return {
      message: "What message would you like me to rewrite?",
      suggestions: ['Show my queue']
    }
  }

  // Get the current message
  const messages = await getQueuedMessages(context.userId, { limit: 100 })
  const current = messages.find(m => m.id === context.activeMessageId)

  if (!current) {
    return {
      message: "Couldn't find that message. Let's start fresh.",
      suggestions: ['Show my queue']
    }
  }

  // Get the profile
  const profileResult = await query<LinkedInProfile>(
    'SELECT * FROM linkedin_profiles WHERE id = $1',
    [current.profileId]
  )

  if (!profileResult.rows[0]) {
    return {
      message: "Couldn't find the profile. Let's draft a new message.",
      suggestions: ['Draft a connection request']
    }
  }

  // Generate variants
  const variants = await generateVariants(
    profileResult.rows[0],
    current.messageType as MessageType,
    context.senderContext!,
    3
  )

  // Pick a different one than what they had
  const newDraft = variants.find(v => v.content !== current.content) || variants[0]

  // Update the queue
  const { query: updateQuery } = await import('@/lib/db')
  await updateQuery(`
    UPDATE linkedin_messages_queue
    SET content = $1, character_count = $2, wells_notes = $3, updated_at = NOW()
    WHERE id = $4
  `, [newDraft.content, newDraft.characterCount, newDraft.wellsNotes, current.id])

  return {
    message: `Here's a different take:

---

${newDraft.content}

---

${newDraft.wellsNotes ? `*${newDraft.wellsNotes}*` : ''}`,
    copyableText: newDraft.content,
    requiresAction: 'copy',
    suggestions: [
      'I like this one',
      'Try again',
      'I sent it',
      'Skip'
    ]
  }
}

async function handleImproveMessage(
  message: string,
  context: LinkedInContext
): Promise<LinkedInResponse> {
  if (!context.activeMessageId) {
    return {
      message: "Which message do you want me to improve?",
      suggestions: ['Show my queue']
    }
  }

  const messages = await getQueuedMessages(context.userId, { limit: 100 })
  const current = messages.find(m => m.id === context.activeMessageId)

  if (!current) {
    return {
      message: "Couldn't find that message.",
      suggestions: ['Show my queue']
    }
  }

  // Determine what improvement to make
  let targetLimit = MESSAGE_LIMITS[current.messageType as MessageType]
  let preserveIntent = 'professional connection'

  if (message.includes('shorter')) {
    targetLimit = Math.min(targetLimit, 200)
  }

  const improved = await shortenMessage(current.content, targetLimit, preserveIntent)

  return {
    message: `Here's the improved version:

---

${improved}

---

Characters: ${improved.length}`,
    copyableText: improved,
    suggestions: [
      'Use this one',
      'Try again',
      'I sent it'
    ]
  }
}

async function handleQueueStats(context: LinkedInContext): Promise<LinkedInResponse> {
  const stats = await getQueueStats(context.userId)
  const limits = await checkRateLimits(context.userId)

  return {
    message: `**LinkedIn Outreach Stats**

**Queue:**
- Pending: ${stats.pending}
- Copied: ${stats.copied}
- Sent this week: ${stats.totalThisWeek}

**Results:**
- Responses: ${stats.responseReceived}
- Declined: ${stats.declined}
- Response rate: ${stats.responseRate.toFixed(1)}%

**Rate Limits:**
- Connection requests this week: ${stats.connectionRequestsThisWeek}/100
${limits.warning ? `- ${limits.warning}` : ''}

${stats.responseRate >= 10 ? "You're doing great! Above-average response rate." :
        stats.responseRate >= 3 ? "Solid performance. Keep it up." :
          stats.totalThisWeek === 0 ? "Time to get sending!" :
            "Response rates are tough - keep iterating on your messaging."}`,
    suggestions: [
      stats.pending > 0 ? 'Show next message' : 'Draft new messages',
      'Show queue'
    ]
  }
}

async function handleDraftPost(
  message: string,
  context: LinkedInContext
): Promise<LinkedInResponse> {
  // Extract topic from message
  const topicMatch = message.match(/(?:post about|post on|write about|draft about)\s+(.+)/i)
  const topic = topicMatch?.[1]

  const post = await generatePost({
    type: 'post',
    customPrompt: topic ? `Write a LinkedIn post about: ${topic}` : undefined,
    goal: 'thought leadership and engagement'
  })

  // Save to content queue
  const saved = await saveContent({
    ...post,
    userId: context.userId
  })

  return {
    message: formatContentForChat(saved),
    copyableText: saved.body,
    suggestions: [
      'Use this post',
      'Try a different angle',
      'Schedule for later',
      'Article ideas instead'
    ],
    updatedContext: {
      activeContentId: saved.id
    }
  }
}

async function handleArticleIdeas(
  message: string,
  context: LinkedInContext
): Promise<LinkedInResponse> {
  const focusMatch = message.match(/(?:about|on|focus on)\s+(.+)/i)
  const focus = focusMatch?.[1]

  const ideas = await generateArticleIdeas(5, focus)

  return {
    message: formatArticleIdeasForChat(ideas),
    suggestions: [
      'Expand on #1',
      'Draft a post instead',
      'Different focus area'
    ]
  }
}

async function handleSchedulePost(
  message: string,
  context: LinkedInContext
): Promise<LinkedInResponse> {
  if (!context.activeContentId) {
    return {
      message: "No post ready to schedule. Want me to draft one first?",
      suggestions: ['Draft a LinkedIn post']
    }
  }

  const nextTime = getNextOptimalPostTime()

  await scheduleContent(context.activeContentId, nextTime)

  return {
    message: `Scheduled! Post will be ready at ${nextTime.toLocaleDateString()} ${nextTime.toLocaleTimeString()}.

(Note: You'll still need to manually post it - I'll remind you when it's time.)`,
    suggestions: [
      'Show content calendar',
      'Draft another post'
    ],
    updatedContext: {
      activeContentId: undefined
    }
  }
}

async function handleContentCalendar(context: LinkedInContext): Promise<LinkedInResponse> {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)

  const scheduled = await getContent(context.userId, { status: 'scheduled' })

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const bestDays = ['Tue', 'Wed', 'Thu']

  let calendar = '**This Week\'s LinkedIn Content**\n\n'

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)
    const dayName = days[date.getDay()]
    const isBestDay = bestDays.includes(dayName)

    const dayPosts = scheduled.filter(p =>
      p.scheduledFor && new Date(p.scheduledFor).toDateString() === date.toDateString()
    )

    if (dayPosts.length > 0) {
      calendar += `- **${dayName} ${date.getDate()}**: ${dayPosts[0].title || 'Scheduled post'}\n`
    } else if (isBestDay) {
      calendar += `- **${dayName} ${date.getDate()}**: (ideal posting day - open)\n`
    } else {
      calendar += `- ${dayName} ${date.getDate()}: -\n`
    }
  }

  calendar += '\n*Best days to post: Tuesday, Wednesday, Thursday*'

  return {
    message: calendar,
    suggestions: [
      'Draft a post for Tuesday',
      'Article ideas',
      'Show queue'
    ]
  }
}

async function handleLinkedInHelp(): Promise<LinkedInResponse> {
  return {
    message: `**LinkedIn with Wells**

I help you with LinkedIn outreach - the honest way.

**Messages:**
- "Connect with [Name] on LinkedIn"
- "Message the VP at [Company]"
- "What should I say to [LinkedIn URL]?"
- "Show my LinkedIn queue"
- "Mark that as sent"

**Content:**
- "Draft a LinkedIn post about [topic]"
- "Article ideas"
- "What should I comment on this?"
- "Content calendar"

**Stats:**
- "How's my LinkedIn outreach?"
- "Show queue stats"

**The Reality:**
LinkedIn doesn't have a public messaging API. So I draft messages, you copy-paste them, and tell me when you've sent them. It's manual, but it's honest.

What would you like to do?`,
    suggestions: [
      'Show my queue',
      'Draft a connection request',
      'Draft a post'
    ]
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get default sender context for a user
 */
async function getDefaultSenderContext(userId: string): Promise<MessageContext> {
  // In production, this would come from user settings
  const result = await query<{
    company_name: string
    full_name: string
    role: string
    value_proposition: string
  }>(`
    SELECT company_name, full_name, role, value_proposition
    FROM user_profiles WHERE user_id = $1
  `, [userId])

  const profile = result.rows[0]

  return {
    senderName: profile?.full_name || 'Wells User',
    senderCompany: profile?.company_name || 'Wells',
    senderRole: profile?.role || 'Founder',
    valueProposition: profile?.value_proposition || 'AI-powered B2B commerce',
    targetIcp: 'B2B professionals',
    campaignGoal: 'Start meaningful professional relationships'
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  handleLinkedInMessage,
  classifyLinkedInIntent
}
