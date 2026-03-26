// @ts-nocheck
/**
 * Cold Start Chat Handler
 *
 * FULLY CONVERSATIONAL - no forms, no pages, no buttons.
 * Everything happens through chat with Wells.
 *
 * Handles:
 * - "upload my contacts"
 * - "I have a CSV of leads"
 * - "cold start my outreach"
 * - "find me customers"
 * - "who should I reach out to"
 * - "send outreach to [segment]"
 * - "how's my campaign doing"
 */

import Anthropic from '@anthropic-ai/sdk'
import { query } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

// Import our cold start modules
import {
  parseCSV,
  processCSVUpload,
  getContacts,
  parseSegmentDescription,
  segmentContacts,
  getSegmentStats,
  generateUploadSummary,
  describeContacts,
  Contact,
  SegmentCriteria,
} from '@/lib/coldstart/contact-ingestion'

import {
  createCampaign,
  previewCampaign,
  generateCampaignMessages,
  sendMessage,
  getCampaignStats,
  getUserOutreachStats,
  getPendingApprovals,
  approveMessage,
  rejectMessage,
  regenerateMessage,
  Campaign,
  MessageContext,
} from '@/lib/coldstart/outreach-engine'

import {
  getWellsPhrase,
  setHonestExpectations,
  celebrateWin,
  PersonalityMode,
  WELLS_VOICE_PRINCIPLES,
} from '@/lib/coldstart/wells-voice'

import {
  getNewMatchesForSeller,
  approveMatch,
  dismissMatch,
  getProspectingSummary,
} from '@/lib/seller/proactive-prospecting'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

export type ColdStartIntent =
  | 'upload_contacts'      // User wants to upload a CSV
  | 'parse_csv'            // Actually processing CSV content
  | 'segment_contacts'     // Define who to reach out to
  | 'preview_outreach'     // See sample messages before sending
  | 'start_campaign'       // Launch outreach
  | 'check_campaign_status'// How's it going?
  | 'check_results'        // Opens, replies, wins
  | 'approve_messages'     // Review pending messages
  | 'find_customers'       // Proactive prospecting
  | 'review_signals'       // Review buying signals
  | 'help_outreach'        // General help with outreach
  | 'unknown'              // Need clarification

export interface ColdStartContext {
  userId: string
  sessionId: string
  flowState: 'initial' | 'uploading' | 'parsing' | 'segmenting' | 'crafting' | 'reviewing' | 'sending' | 'monitoring'
  activeUploadId?: string
  activeCampaignId?: string
  selectedSegment?: string
  senderContext?: MessageContext
  pendingConfirmation?: {
    type: string
    data: Record<string, unknown>
  }
}

export interface ColdStartResponse {
  message: string
  suggestions?: string[]
  quickActions?: Array<{
    label: string
    action: string
    params?: Record<string, unknown>
  }>
  displayData?: Record<string, unknown>
  requiresInput?: 'csv_upload' | 'confirmation' | 'text'
  updatedContext?: Partial<ColdStartContext>
}

// ============================================================================
// INTENT CLASSIFICATION
// ============================================================================

const COLDSTART_PATTERNS: Record<ColdStartIntent, string[]> = {
  upload_contacts: [
    'upload', 'csv', 'contacts', 'import', 'leads', 'list',
    'have a file', 'got a spreadsheet', 'excel', 'bring in',
  ],
  parse_csv: [], // Internal - triggered when we receive CSV content
  segment_contacts: [
    'segment', 'target', 'reach out to', 'message', 'email',
    'who should', 'which contacts', 'filter', 'narrow down',
  ],
  preview_outreach: [
    'preview', 'show me', 'what would', 'sample', 'draft',
    'before sending', 'look like',
  ],
  start_campaign: [
    'start', 'launch', 'send', 'begin', 'go', 'do it',
    'let\'s roll', 'fire away', 'cold start',
  ],
  check_campaign_status: [
    'status', 'how\'s', 'progress', 'where are', 'update',
    'running', 'active',
  ],
  check_results: [
    'results', 'replies', 'responses', 'opens', 'clicks',
    'how did', 'performance', 'metrics', 'working',
  ],
  approve_messages: [
    'approve', 'review', 'pending', 'check messages',
    'waiting', 'need approval',
  ],
  find_customers: [
    'find customers', 'find leads', 'prospect', 'get me leads',
    'who needs', 'potential', 'opportunities',
  ],
  review_signals: [
    'signals', 'buying signals', 'opportunities', 'matches',
    'who\'s looking',
  ],
  help_outreach: [
    'help', 'how do', 'what can', 'outreach', 'cold email',
    'stuck', 'not sure',
  ],
  unknown: [],
}

/**
 * Classify the user's cold start intent
 */
export function classifyColdStartIntent(message: string): ColdStartIntent {
  const lowerMessage = message.toLowerCase()

  for (const [intent, patterns] of Object.entries(COLDSTART_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerMessage.includes(pattern)) {
        return intent as ColdStartIntent
      }
    }
  }

  return 'unknown'
}

// ============================================================================
// CONTEXT MANAGEMENT
// ============================================================================

/**
 * Get or create cold start conversation context
 */
export async function getColdStartContext(
  userId: string,
  sessionId: string
): Promise<ColdStartContext> {
  const result = await query<{ context: Record<string, unknown> }>(
    'SELECT context FROM coldstart_conversations WHERE user_id = $1 AND session_id = $2',
    [userId, sessionId]
  )

  if (result.rows.length > 0) {
    return {
      userId,
      sessionId,
      ...result.rows[0].context,
    } as ColdStartContext
  }

  // Create new context
  const newContext: ColdStartContext = {
    userId,
    sessionId,
    flowState: 'initial',
  }

  await query(
    `INSERT INTO coldstart_conversations (user_id, session_id, flow_state, context)
     VALUES ($1, $2, 'initial', $3)
     ON CONFLICT (user_id, session_id) DO UPDATE SET context = $3, updated_at = NOW()`,
    [userId, sessionId, JSON.stringify(newContext)]
  )

  return newContext
}

/**
 * Update cold start context
 */
async function updateContext(
  context: ColdStartContext,
  updates: Partial<ColdStartContext>
): Promise<ColdStartContext> {
  const newContext = { ...context, ...updates }

  await query(
    `UPDATE coldstart_conversations
     SET context = $3, flow_state = $4, updated_at = NOW()
     WHERE user_id = $1 AND session_id = $2`,
    [context.userId, context.sessionId, JSON.stringify(newContext), newContext.flowState]
  )

  return newContext
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Handle a cold start related message
 */
export async function handleColdStartMessage(
  userId: string,
  sessionId: string,
  message: string,
  attachedFile?: { filename: string; content: string }
): Promise<ColdStartResponse> {
  // Get context
  let context = await getColdStartContext(userId, sessionId)

  // Check if we're receiving a CSV file
  if (attachedFile && (attachedFile.filename.endsWith('.csv') || attachedFile.content.includes(','))) {
    return handleCSVUpload(context, attachedFile.filename, attachedFile.content)
  }

  // Check for pending confirmation
  if (context.pendingConfirmation) {
    return handleConfirmation(context, message)
  }

  // Classify intent
  const intent = classifyColdStartIntent(message)

  // Route to appropriate handler
  switch (intent) {
    case 'upload_contacts':
      return handleUploadRequest(context)

    case 'segment_contacts':
      return handleSegmentRequest(context, message)

    case 'preview_outreach':
      return handlePreviewRequest(context)

    case 'start_campaign':
      return handleStartCampaign(context, message)

    case 'check_campaign_status':
      return handleStatusCheck(context)

    case 'check_results':
      return handleResultsCheck(context)

    case 'approve_messages':
      return handleApprovalRequest(context)

    case 'find_customers':
      return handleFindCustomers(context)

    case 'review_signals':
      return handleReviewSignals(context)

    case 'help_outreach':
      return handleOutreachHelp(context)

    default:
      return handleUnknown(context, message)
  }
}

// ============================================================================
// INTENT HANDLERS
// ============================================================================

/**
 * User wants to upload contacts
 */
async function handleUploadRequest(context: ColdStartContext): Promise<ColdStartResponse> {
  context = await updateContext(context, { flowState: 'uploading' })

  return {
    message: getWellsPhrase('onUpload'),
    suggestions: [
      'I have a CSV file',
      'Import from Apollo',
      'Paste contacts directly',
    ],
    requiresInput: 'csv_upload',
    updatedContext: { flowState: 'uploading' },
  }
}

/**
 * Process uploaded CSV
 */
async function handleCSVUpload(
  context: ColdStartContext,
  filename: string,
  content: string
): Promise<ColdStartResponse> {
  try {
    // Process the CSV
    const result = await processCSVUpload(context.userId, filename, content)

    // Update context
    context = await updateContext(context, {
      flowState: 'segmenting',
      activeUploadId: result.uploadId,
    })

    // Generate summary
    const summary = generateUploadSummary(result)
    const sampleDescription = describeContacts(result.sampleContacts)

    return {
      message: `${summary}\n\nHere's a sample:\n${sampleDescription}\n\nNow, who do you want to reach out to? Tell me in plain English - like "VPs at manufacturing companies" or "anyone with procurement in their title."`,
      suggestions: [
        'All contacts',
        'VPs and Directors',
        'People at enterprise companies',
        'Show me segments',
      ],
      displayData: {
        uploadId: result.uploadId,
        stats: {
          total: result.totalProcessed,
          valid: result.validContacts,
          duplicates: result.duplicates,
        },
      },
      updatedContext: {
        flowState: 'segmenting',
        activeUploadId: result.uploadId,
      },
    }
  } catch (error) {
    return {
      message: `Hmm, had trouble with that file. ${error instanceof Error ? error.message : 'Unknown error'}. Try again?`,
      suggestions: ['Upload a different file', 'Help with CSV format'],
    }
  }
}

/**
 * User wants to define a segment
 */
async function handleSegmentRequest(
  context: ColdStartContext,
  message: string
): Promise<ColdStartResponse> {
  // Check if we have contacts
  const stats = await getSegmentStats(context.userId)

  if (stats.length === 0 || stats.every(s => s.count === 0)) {
    return {
      message: "You don't have any contacts yet. Want to upload a CSV or have me find some prospects?",
      suggestions: ['Upload contacts', 'Find me prospects'],
    }
  }

  // Parse the segment description
  const criteria = await parseSegmentDescription(message)

  // If no criteria extracted, ask for clarification
  if (Object.keys(criteria).filter(k => criteria[k as keyof SegmentCriteria]).length === 0) {
    return {
      message: getWellsPhrase('onSegmenting'),
      suggestions: [
        'VPs and C-level',
        'Manufacturing industry',
        'Enterprise companies',
        'Everyone',
      ],
    }
  }

  // Create segment
  const segmentName = `Segment_${Date.now()}`
  const segmentResult = await segmentContacts(context.userId, segmentName, criteria)

  // Update context
  context = await updateContext(context, {
    flowState: 'crafting',
    selectedSegment: segmentName,
  })

  const sampleDescription = describeContacts(segmentResult.sample)

  return {
    message: `Found ${segmentResult.count.toLocaleString()} contacts matching that.\n\nSample:\n${sampleDescription}\n\nBefore I write messages, tell me about yourself:\n- What's your company name?\n- What do you offer?\n- What's the goal? (meeting, demo, intro call?)`,
    suggestions: [
      'Show more contacts',
      'Change criteria',
      'Just send - use my profile',
    ],
    displayData: {
      segmentCount: segmentResult.count,
      criteria,
    },
    updatedContext: {
      flowState: 'crafting',
      selectedSegment: segmentName,
    },
  }
}

/**
 * User wants to preview messages
 */
async function handlePreviewRequest(context: ColdStartContext): Promise<ColdStartResponse> {
  if (!context.activeCampaignId) {
    return {
      message: "No campaign set up yet. Tell me who you want to reach and I'll craft some messages.",
      suggestions: ['Upload contacts', 'Define my target segment'],
    }
  }

  // Get sender context or use defaults
  const senderContext: MessageContext = context.senderContext || {
    senderName: 'Your Name',
    senderCompany: 'Your Company',
    senderValue: 'What you offer',
    targetIcp: 'Your target customer',
    campaignGoal: 'Start a conversation',
  }

  const preview = await previewCampaign(context.userId, context.activeCampaignId, senderContext, 3)

  // Format preview messages
  const messagePreview = preview.sampleMessages.map((sm, i) => {
    const name = [sm.contact.firstName, sm.contact.lastName].filter(Boolean).join(' ')
    const company = sm.contact.companyName || 'Unknown Company'
    return `**To: ${name} at ${company}**\n${sm.message.subject ? `Subject: ${sm.message.subject}\n` : ''}${sm.message.body}\n---`
  }).join('\n')

  return {
    message: `Here's what I'd send:\n\n${messagePreview}\n\n${preview.expectations.honestMessage}`,
    suggestions: [
      'Looks good, send it',
      'Rewrite these',
      'Change my tone',
      'Edit the first one',
    ],
    displayData: {
      previewMessages: preview.sampleMessages,
      expectations: preview.expectations,
    },
    quickActions: [
      { label: 'Approve All', action: 'approve_all_messages' },
      { label: 'Edit First', action: 'edit_message', params: { index: 0 } },
    ],
  }
}

/**
 * User wants to start the campaign
 */
async function handleStartCampaign(
  context: ColdStartContext,
  message: string
): Promise<ColdStartResponse> {
  // Check if we have a segment
  if (!context.selectedSegment && context.flowState !== 'crafting') {
    return {
      message: "Who should I reach out to? Tell me in plain English.",
      suggestions: ['Everyone in my list', 'VPs and Directors only', 'Help me decide'],
    }
  }

  // Check if this is a confirmation
  if (context.pendingConfirmation?.type === 'start_campaign') {
    return executeCampaignStart(context)
  }

  // Get segment count
  const { contacts, total } = await getContacts(context.userId, {
    segment: context.selectedSegment,
    status: 'new',
    limit: 1,
  })

  if (total === 0) {
    return {
      message: "No contacts to send to in that segment. Try a different one?",
      suggestions: ['Show my segments', 'Upload more contacts'],
    }
  }

  // Set expectations and ask for confirmation
  const expectations = setHonestExpectations(total, 'cold')

  // Update context with pending confirmation
  context = await updateContext(context, {
    pendingConfirmation: {
      type: 'start_campaign',
      data: { segment: context.selectedSegment, count: total },
    },
  })

  return {
    message: `Ready to send to ${total.toLocaleString()} contacts.\n\n${expectations.honestMessage}\n\nSay "go" to start, or "wait" if you want to review first.`,
    suggestions: ['Go', 'Wait, let me review', 'Change who I\'m targeting'],
    updatedContext: {
      pendingConfirmation: {
        type: 'start_campaign',
        data: { segment: context.selectedSegment, count: total },
      },
    },
  }
}

/**
 * Execute campaign start after confirmation
 */
async function executeCampaignStart(context: ColdStartContext): Promise<ColdStartResponse> {
  const { segment, count } = context.pendingConfirmation?.data || {}

  // Create campaign
  const campaign = await createCampaign(
    context.userId,
    `Campaign ${new Date().toLocaleDateString()}`,
    { segment } as SegmentCriteria,
    { personality: 'default', channels: ['email'], dailyLimit: 50 }
  )

  // Generate messages
  const senderContext: MessageContext = context.senderContext || {
    senderName: 'Wells',
    senderCompany: 'WellsAI',
    senderValue: 'Helping you find the right partners',
    targetIcp: segment || 'professionals',
    campaignGoal: 'Start a conversation',
  }

  const result = await generateCampaignMessages(context.userId, campaign.id, senderContext, {
    requireApproval: false,
    scheduleAt: new Date(),
  })

  // Clear confirmation and update context
  context = await updateContext(context, {
    flowState: 'monitoring',
    activeCampaignId: campaign.id,
    pendingConfirmation: undefined,
  })

  return {
    message: getWellsPhrase('onCrafting') + `\n\nGenerated ${result.generated} personalized messages. They're going out now. I'll let you know when responses come in.`,
    suggestions: [
      'Check status',
      'Pause campaign',
      'Start another segment',
    ],
    displayData: {
      campaignId: campaign.id,
      messagesGenerated: result.generated,
    },
    updatedContext: {
      flowState: 'monitoring',
      activeCampaignId: campaign.id,
    },
  }
}

/**
 * User wants to check campaign status
 */
async function handleStatusCheck(context: ColdStartContext): Promise<ColdStartResponse> {
  if (!context.activeCampaignId) {
    // Show overall stats
    const stats = await getUserOutreachStats(context.userId)

    if (stats.totalSent === 0) {
      return {
        message: "No campaigns running yet. Want to start one?",
        suggestions: ['Upload contacts', 'Find me prospects', 'Help me get started'],
      }
    }

    const winsText = stats.recentWins.length > 0
      ? `\n\nRecent wins:\n${stats.recentWins.map(w => `- ${w.type}: ${w.contactName}`).join('\n')}`
      : ''

    return {
      message: `Here's where you stand:\n\n- ${stats.totalContacts.toLocaleString()} contacts\n- ${stats.totalSent.toLocaleString()} messages sent\n- ${stats.totalReplies} replies (${stats.overallReplyRate}% rate)\n- ${stats.activeCompaigns} active campaigns${winsText}`,
      suggestions: ['Start new campaign', 'Show me who replied', 'Find more prospects'],
      displayData: stats,
    }
  }

  // Show specific campaign stats
  const stats = await getCampaignStats(context.userId, context.activeCampaignId)

  return {
    message: getWellsPhrase('onResults', stats.stats.sent, stats.stats.opened, stats.stats.replied),
    suggestions: ['Show who replied', 'Send to more people', 'Pause campaign'],
    displayData: stats,
  }
}

/**
 * User wants to check results/replies
 */
async function handleResultsCheck(context: ColdStartContext): Promise<ColdStartResponse> {
  const stats = await getUserOutreachStats(context.userId)

  if (stats.totalReplies === 0) {
    return {
      message: "No replies yet. Cold outreach takes time - most responses come in 2-7 days. Keep at it.",
      suggestions: ['Check status', 'Send to more people', 'Improve my messages'],
    }
  }

  // Get recent replies
  const repliesResult = await query<Record<string, unknown>>(
    `SELECT c.first_name, c.last_name, c.company_name, e.reply_content, e.reply_sentiment, e.created_at
     FROM outreach_events e
     JOIN outreach_messages m ON e.message_id = m.id
     JOIN outreach_contacts c ON m.contact_id = c.id
     WHERE m.user_id = $1 AND e.event_type = 'replied'
     ORDER BY e.created_at DESC
     LIMIT 5`,
    [context.userId]
  )

  const repliesText = repliesResult.rows.map(r => {
    const name = [r.first_name, r.last_name].filter(Boolean).join(' ')
    const sentiment = r.reply_sentiment === 'positive' ? '+' : r.reply_sentiment === 'negative' ? '-' : '~'
    return `${sentiment} **${name}** (${r.company_name}): "${(r.reply_content as string)?.slice(0, 100)}..."`
  }).join('\n')

  return {
    message: `${stats.totalReplies} replies so far:\n\n${repliesText}`,
    suggestions: ['Reply to someone', 'Show all replies', 'Export to CRM'],
    displayData: { replies: repliesResult.rows },
  }
}

/**
 * User wants to approve pending messages
 */
async function handleApprovalRequest(context: ColdStartContext): Promise<ColdStartResponse> {
  const pending = await getPendingApprovals(context.userId)

  if (pending.length === 0) {
    return {
      message: "No messages waiting for approval. All clear!",
      suggestions: ['Check status', 'Start new campaign'],
    }
  }

  const previewText = pending.slice(0, 3).map((p, i) => {
    const name = [p.contact.firstName, p.contact.lastName].filter(Boolean).join(' ')
    return `${i + 1}. To ${name} at ${p.contact.companyName}:\n"${p.message.body.slice(0, 150)}..."`
  }).join('\n\n')

  return {
    message: `${pending.length} messages waiting for approval:\n\n${previewText}\n\nApprove all, or tell me which ones to change.`,
    suggestions: ['Approve all', 'Reject #1', 'Rewrite #2'],
    quickActions: [
      { label: 'Approve All', action: 'approve_all' },
      { label: 'Reject All', action: 'reject_all' },
    ],
    displayData: { pending: pending.slice(0, 10) },
  }
}

/**
 * User wants Wells to find prospects
 */
async function handleFindCustomers(context: ColdStartContext): Promise<ColdStartResponse> {
  const summary = await getProspectingSummary(context.userId)

  if (summary.newMatches > 0) {
    const opportunityText = summary.topOpportunities.map((o, i) => {
      return `${i + 1}. **${o.signal.companyName}** - ${o.signal.title}\n   Match score: ${o.match.matchScore}/100 | Action: ${o.match.recommendedAction}`
    }).join('\n')

    return {
      message: `Found ${summary.newMatches} new opportunities:\n\n${opportunityText}\n\nWant me to draft outreach for any of these?`,
      suggestions: [
        'Reach out to #1',
        'Show more opportunities',
        'Dismiss all',
      ],
      displayData: { opportunities: summary.topOpportunities },
    }
  }

  return {
    message: "I'm monitoring for buying signals - job postings, funding news, competitor complaints. No new matches yet, but I'll let you know when I find something.",
    suggestions: ['Set up my ICP', 'Add keywords to monitor', 'Check back later'],
  }
}

/**
 * User wants to review buying signals
 */
async function handleReviewSignals(context: ColdStartContext): Promise<ColdStartResponse> {
  const matches = await getNewMatchesForSeller(context.userId)

  if (matches.length === 0) {
    return {
      message: "No new buying signals matching your ICP. I'm watching for job posts, funding announcements, and competitor complaints. Check back later!",
      suggestions: ['Update my ICP', 'Find customers manually', 'Show past signals'],
    }
  }

  const signalText = matches.slice(0, 5).map((m, i) => {
    return `${i + 1}. **${m.signal.companyName}** - ${m.signal.signalType}\n   ${m.signal.description}\n   Strength: ${m.signal.strength}/100 | ${m.match.recommendedAction}`
  }).join('\n\n')

  return {
    message: `${matches.length} buying signals detected:\n\n${signalText}`,
    suggestions: [
      'Reach out to #1',
      'Dismiss #1',
      'Approve all high-strength',
    ],
    displayData: { signals: matches },
  }
}

/**
 * Help with outreach
 */
async function handleOutreachHelp(context: ColdStartContext): Promise<ColdStartResponse> {
  return {
    message: `I can help you with cold start outreach. Here's what I do:

1. **Upload contacts** - Bring in your CSV and I'll parse it
2. **Segment** - Tell me who to target in plain English
3. **Personalize** - I write each message specifically for them
4. **Send** - Email, LinkedIn, or Twitter
5. **Track** - I watch for replies and celebrate wins

No forms. No sequences. Just conversation.

What do you want to do?`,
    suggestions: [
      'Upload my contacts',
      'Find me prospects',
      'Check my stats',
      'How do I write better cold emails?',
    ],
  }
}

/**
 * Handle unknown intent
 */
async function handleUnknown(
  context: ColdStartContext,
  message: string
): Promise<ColdStartResponse> {
  // Use Claude to figure out what they want
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 500,
    system: `You are Wells, helping with cold start outreach. The user said something unclear.

Your capabilities:
- Upload and parse contact CSVs
- Segment contacts by criteria
- Generate personalized outreach messages
- Send via email, LinkedIn, Twitter
- Track results and celebrate wins
- Find prospects via buying signals

Respond helpfully and suggest next steps. Be direct, not salesy.`,
    messages: [
      { role: 'user', content: message },
    ],
  })

  const text = response.content.find(b => b.type === 'text')?.text || "Not sure what you need. Try 'upload contacts' or 'find me customers'."

  return {
    message: text,
    suggestions: [
      'Upload contacts',
      'Find customers',
      'Check my status',
      'Help',
    ],
  }
}

/**
 * Handle confirmation responses
 */
async function handleConfirmation(
  context: ColdStartContext,
  message: string
): Promise<ColdStartResponse> {
  const lowerMessage = message.toLowerCase()
  const confirmType = context.pendingConfirmation?.type

  if (!confirmType) {
    return handleUnknown(context, message)
  }

  const isYes = /^(yes|yeah|yep|go|do it|confirm|proceed|ok|sure|let's go|send)/i.test(lowerMessage)
  const isNo = /^(no|nope|wait|stop|cancel|hold|pause|don't)/i.test(lowerMessage)

  if (isYes) {
    switch (confirmType) {
      case 'start_campaign':
        return executeCampaignStart(context)

      case 'approve_message':
        const messageId = context.pendingConfirmation?.data?.messageId as string
        await approveMessage(messageId, context.userId)
        context = await updateContext(context, { pendingConfirmation: undefined })
        return {
          message: "Message approved and scheduled to send.",
          suggestions: ['Check more messages', 'View status'],
        }

      case 'approve_signal':
        const matchId = context.pendingConfirmation?.data?.matchId as string
        await approveMatch(matchId, context.userId)
        context = await updateContext(context, { pendingConfirmation: undefined })
        return {
          message: "Outreach approved! Sending now.",
          suggestions: ['Check more signals', 'View status'],
        }

      default:
        context = await updateContext(context, { pendingConfirmation: undefined })
        return handleUnknown(context, message)
    }
  }

  if (isNo) {
    context = await updateContext(context, { pendingConfirmation: undefined })
    return {
      message: "No problem. What would you like to do instead?",
      suggestions: ['Change my targeting', 'Edit the messages', 'Start over'],
    }
  }

  return {
    message: "Just say 'yes' to confirm or 'no' to cancel.",
    suggestions: ['Yes', 'No'],
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  handleColdStartMessage,
  classifyColdStartIntent,
  getColdStartContext,
}
