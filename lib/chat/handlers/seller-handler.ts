// @ts-nocheck
/**
 * Seller Intent Handler
 *
 * Handles all seller/GTM intents through natural conversation.
 * This is the bridge between user messages and the ConversationalSeller engine.
 *
 * Supported intents:
 * - lead_discovery: Find new prospects
 * - lead_recommendation: Get prioritized leads
 * - outreach_generation: Create personalized messages
 * - pipeline_update: Manage deal stages
 * - opportunity_tracking: Monitor deals
 * - sales_insights: Performance analytics
 * - rfq_matching: Match incoming requests
 * - quote_generation: Create quotes
 * - campaign_launch: Run outreach campaigns
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  ConversationalSeller,
  Lead,
  Opportunity,
  Quote,
  Campaign,
  RFQMatch,
  SalesInsights,
  PipelineStage,
} from '@/lib/seller/conversational-seller'
import type { IntentClassification, ExtractedEntities } from '../intent-router'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

export type SellerIntent =
  | 'lead_discovery'
  | 'lead_recommendation'
  | 'outreach_generation'
  | 'pipeline_update'
  | 'opportunity_tracking'
  | 'sales_insights'
  | 'rfq_matching'
  | 'quote_generation'
  | 'campaign_launch'
  | 'catalog_management'
  | 'competitor_analysis'
  | 'forecast_review'

export interface SellerHandlerContext {
  sellerId: string
  conversationId?: string
  recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }>
  activeLeads?: Lead[]
  lastMentionedLead?: Lead
  lastMentionedOpportunity?: Opportunity
  lastMentionedQuote?: Quote
  userPreferences?: {
    defaultIndustry?: string
    preferredOutreachStyle?: 'formal' | 'casual' | 'professional'
    autoFollowUp?: boolean
  }
}

export interface SellerHandlerResult {
  intent: SellerIntent
  action: string
  data: any
  response: string
  suggestions?: string[]
  requiresConfirmation?: boolean
  confirmationMessage?: string
  followUpActions?: Array<{
    action: string
    label: string
    params?: Record<string, any>
  }>
}

// ============================================================================
// INTENT PATTERNS
// ============================================================================

const SELLER_INTENT_PATTERNS: Record<SellerIntent, string[]> = {
  lead_discovery: [
    'find companies', 'find leads', 'discover', 'search for', 'looking for companies',
    'who needs', 'find prospects', 'companies that', 'businesses that',
    'identify leads', 'prospect for', 'lead generation',
  ],
  lead_recommendation: [
    'who should i', 'reach out to', 'prioritize', 'top leads', 'best leads',
    'recommend', 'who to contact', 'next outreach', 'priority leads',
    'hot leads', 'warm leads', 'who first',
  ],
  outreach_generation: [
    'draft an email', 'write a message', 'compose', 'create outreach',
    'linkedin message', 'cold email', 'follow up email', 'introduction email',
    'call script', 'email to', 'message to', 'write to',
  ],
  pipeline_update: [
    'move', 'update stage', 'change status', 'mark as', 'advance',
    'close deal', 'won deal', 'lost deal', 'push to', 'move to',
    'update pipeline', 'change to', 'set status',
  ],
  opportunity_tracking: [
    'deals closing', 'pipeline', 'opportunities', 'active deals',
    'what deals', 'track deal', 'deal status', 'my pipeline',
    'closing this', 'expected to close', 'deal progress',
  ],
  sales_insights: [
    'win rate', 'conversion', 'performance', 'metrics', 'analytics',
    'how am i doing', 'stats', 'sales data', 'kpis', 'quota',
    'forecast', 'revenue', 'numbers',
  ],
  rfq_matching: [
    'incoming rfq', 'rfqs matching', 'new requests', 'buyer requests',
    'matching my catalog', 'rfqs for me', 'opportunities', 'inbound rfqs',
    'show me rfqs', 'any rfqs',
  ],
  quote_generation: [
    'create quote', 'generate quote', 'price this', 'send quote',
    'quote for', 'pricing for', 'prepare quote', 'quote request',
    'quote them', 'make a quote',
  ],
  campaign_launch: [
    'launch campaign', 'start campaign', 'run campaign', 'outreach campaign',
    'email campaign', 'targeting', 'blast', 'mass outreach',
    'sequence', 'drip campaign',
  ],
  catalog_management: [
    'update catalog', 'add product', 'my products', 'pricing',
    'catalog', 'inventory', 'offerings', 'services',
  ],
  competitor_analysis: [
    'competitor', 'competition', 'who else', 'alternatives',
    'market', 'competing', 'against who',
  ],
  forecast_review: [
    'forecast', 'projection', 'expected', 'predicted',
    'revenue forecast', 'sales forecast', 'outlook',
  ],
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Main entry point for handling seller intents
 */
export async function handleSellerIntent(
  message: string,
  context: SellerHandlerContext
): Promise<SellerHandlerResult> {
  // Classify the intent
  const intent = await classifySellerIntent(message, context)

  // Route to appropriate handler
  switch (intent) {
    case 'lead_discovery':
      return handleLeadDiscovery(message, context)

    case 'lead_recommendation':
      return handleLeadRecommendation(message, context)

    case 'outreach_generation':
      return handleOutreachGeneration(message, context)

    case 'pipeline_update':
      return handlePipelineUpdate(message, context)

    case 'opportunity_tracking':
      return handleOpportunityTracking(message, context)

    case 'sales_insights':
      return handleSalesInsights(message, context)

    case 'rfq_matching':
      return handleRFQMatching(message, context)

    case 'quote_generation':
      return handleQuoteGeneration(message, context)

    case 'campaign_launch':
      return handleCampaignLaunch(message, context)

    case 'catalog_management':
      return handleCatalogManagement(message, context)

    case 'competitor_analysis':
      return handleCompetitorAnalysis(message, context)

    case 'forecast_review':
      return handleForecastReview(message, context)

    default:
      return handleGeneralSellerRequest(message, context)
  }
}

/**
 * Classify seller intent from message
 */
async function classifySellerIntent(
  message: string,
  context: SellerHandlerContext
): Promise<SellerIntent> {
  const lowerMessage = message.toLowerCase()

  // Quick pattern matching first
  for (const [intent, patterns] of Object.entries(SELLER_INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerMessage.includes(pattern)) {
        return intent as SellerIntent
      }
    }
  }

  // AI classification for ambiguous messages
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Classify this seller message into one intent:
- lead_discovery: Finding new prospects
- lead_recommendation: Getting lead priorities
- outreach_generation: Creating messages
- pipeline_update: Managing deal stages
- opportunity_tracking: Monitoring deals
- sales_insights: Performance metrics
- rfq_matching: Matching RFQs
- quote_generation: Creating quotes
- campaign_launch: Running campaigns

Message: "${message}"

Return just the intent name, nothing else.`,
        },
      ],
    })

    const textBlock = response.content.find(block => block.type === 'text')
    const intent = textBlock?.type === 'text' ? textBlock.text.trim().toLowerCase() : 'sales_insights'

    if (Object.keys(SELLER_INTENT_PATTERNS).includes(intent)) {
      return intent as SellerIntent
    }
  } catch (error) {
    console.error('[SellerHandler] Intent classification error:', error)
  }

  return 'sales_insights' // Default fallback
}

// ============================================================================
// INTENT HANDLERS
// ============================================================================

/**
 * Handle lead discovery requests
 * "Find companies that need industrial motors"
 */
async function handleLeadDiscovery(
  message: string,
  context: SellerHandlerContext
): Promise<SellerHandlerResult> {
  const { leads, searchCriteria, suggestions } = await ConversationalSeller.discoverLeads(
    context.sellerId,
    message
  )

  // Format response
  let response: string

  if (leads.length === 0) {
    response = `I couldn't find any leads matching "${message}". Try broadening your search criteria.`
  } else if (leads.length <= 5) {
    response = formatLeadList(leads, 'discovery')
  } else {
    response = `Found ${leads.length} companies matching your criteria.\n\n**Top 5 matches:**\n${formatLeadList(leads.slice(0, 5), 'discovery')}`
  }

  // Build follow-up actions
  const followUpActions = leads.length > 0 ? [
    { action: 'outreach_generation', label: 'Draft outreach to top lead', params: { leadId: leads[0]?.id } },
    { action: 'campaign_launch', label: 'Launch campaign for this audience' },
    { action: 'lead_discovery', label: 'Refine search' },
  ] : [
    { action: 'lead_discovery', label: 'Try different criteria' },
    { action: 'rfq_matching', label: 'Check incoming RFQs instead' },
  ]

  return {
    intent: 'lead_discovery',
    action: 'search_leads',
    data: { leads, searchCriteria },
    response,
    suggestions,
    followUpActions,
  }
}

/**
 * Handle lead recommendation requests
 * "Who should I reach out to?"
 */
async function handleLeadRecommendation(
  message: string,
  context: SellerHandlerContext
): Promise<SellerHandlerResult> {
  const { recommended, reasoning, nextActions } = await ConversationalSeller.getLeadRecommendations(
    context.sellerId,
    message
  )

  let response: string

  if (recommended.length === 0) {
    response = "You don't have any leads to prioritize right now. Let's find some prospects!"
  } else {
    response = `**Here's who to prioritize:**\n\n${reasoning}\n\n${formatLeadList(recommended, 'recommendation')}`

    if (nextActions.length > 0) {
      response += `\n\n**Recommended next steps:**\n${nextActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`
    }
  }

  const followUpActions = recommended.length > 0 ? [
    { action: 'outreach_generation', label: `Draft email to ${recommended[0]?.companyName}`, params: { leadId: recommended[0]?.id } },
    { action: 'pipeline_update', label: 'Update lead status' },
  ] : [
    { action: 'lead_discovery', label: 'Find new leads' },
    { action: 'campaign_launch', label: 'Launch outreach campaign' },
  ]

  return {
    intent: 'lead_recommendation',
    action: 'get_recommendations',
    data: { recommended, reasoning, nextActions },
    response,
    followUpActions,
  }
}

/**
 * Handle outreach generation requests
 * "Draft an email to that prospect"
 */
async function handleOutreachGeneration(
  message: string,
  context: SellerHandlerContext
): Promise<SellerHandlerResult> {
  // Determine outreach type
  const outreachType = message.toLowerCase().includes('linkedin') ? 'linkedin'
    : message.toLowerCase().includes('call') ? 'call_script'
    : 'email'

  // Get lead ID from context or message
  const leadId = context.lastMentionedLead?.id || extractLeadReference(message, context)

  if (!leadId) {
    return {
      intent: 'outreach_generation',
      action: 'missing_lead',
      data: {},
      response: "Which company would you like me to draft outreach for? You can say the company name or ask me to recommend leads.",
      requiresConfirmation: true,
      followUpActions: [
        { action: 'lead_recommendation', label: 'Show recommended leads' },
        { action: 'lead_discovery', label: 'Find new leads' },
      ],
    }
  }

  const { content, subject, suggestions } = await ConversationalSeller.generateOutreach(
    context.sellerId,
    leadId,
    outreachType,
    message
  )

  let response = ''

  if (outreachType === 'email' && subject) {
    response = `**Subject:** ${subject}\n\n---\n\n${content}`
  } else if (outreachType === 'linkedin') {
    response = `**LinkedIn Message:**\n\n${content}`
  } else {
    response = `**Call Script:**\n\n${content}`
  }

  if (suggestions.length > 0) {
    response += `\n\n**Tips:**\n${suggestions.map(s => `- ${s}`).join('\n')}`
  }

  return {
    intent: 'outreach_generation',
    action: 'generate_outreach',
    data: { content, subject, type: outreachType, leadId },
    response,
    suggestions,
    followUpActions: [
      { action: 'outreach_generation', label: 'Generate alternative', params: { leadId } },
      { action: 'pipeline_update', label: 'Mark as contacted', params: { leadId, stage: 'qualification' } },
    ],
  }
}

/**
 * Handle pipeline update requests
 * "Move Acme to proposal stage"
 */
async function handlePipelineUpdate(
  message: string,
  context: SellerHandlerContext
): Promise<SellerHandlerResult> {
  try {
    const { updated, action, summary } = await ConversationalSeller.updatePipeline(
      context.sellerId,
      message
    )

    const response = `Done! ${summary}\n\n${formatLeadSummary(updated as Lead)}`

    return {
      intent: 'pipeline_update',
      action: 'update_stage',
      data: { updated },
      response,
      followUpActions: [
        { action: 'outreach_generation', label: 'Draft follow-up message', params: { leadId: (updated as Lead).id } },
        { action: 'opportunity_tracking', label: 'View pipeline' },
      ],
    }
  } catch (error) {
    return {
      intent: 'pipeline_update',
      action: 'update_failed',
      data: { error: (error as Error).message },
      response: `I couldn't update the pipeline: ${(error as Error).message}. Try specifying the company name and target stage.`,
      requiresConfirmation: true,
      suggestions: [
        'Try "Move [company name] to [stage]"',
        'Valid stages: discovery, qualification, proposal, negotiation, closed_won, closed_lost',
      ],
    }
  }
}

/**
 * Handle opportunity tracking requests
 * "What deals are closing this month?"
 */
async function handleOpportunityTracking(
  message: string,
  context: SellerHandlerContext
): Promise<SellerHandlerResult> {
  const { opportunities, summary, insights } = await ConversationalSeller.trackOpportunities(
    context.sellerId,
    message
  )

  let response = summary

  if (opportunities.length > 0) {
    response += '\n\n**Opportunities:**\n'
    response += opportunities.slice(0, 5).map(opp =>
      `- **${opp.name}**: $${opp.value.toLocaleString()} (${opp.probability}% probability) - ${opp.stage}`
    ).join('\n')
  }

  if (insights.length > 0) {
    response += `\n\n**Insights:**\n${insights.map(i => `- ${i}`).join('\n')}`
  }

  return {
    intent: 'opportunity_tracking',
    action: 'track_opportunities',
    data: { opportunities, summary, insights },
    response,
    followUpActions: [
      { action: 'sales_insights', label: 'View detailed analytics' },
      { action: 'pipeline_update', label: 'Update deal status' },
    ],
  }
}

/**
 * Handle sales insights requests
 * "What's my win rate?"
 */
async function handleSalesInsights(
  message: string,
  context: SellerHandlerContext
): Promise<SellerHandlerResult> {
  const insights = await ConversationalSeller.getSalesInsights(context.sellerId, message)

  // Format response based on what was asked
  const lowerMessage = message.toLowerCase()

  let response = ''

  if (lowerMessage.includes('win rate') || lowerMessage.includes('conversion')) {
    response = `**Your win rate is ${insights.performance.winRate}%**\n\n`
    response += `- Quotes to close: ${insights.performance.quotesToClose} on average\n`
    response += `- Activity score: ${insights.performance.activityScore}/100`
  } else if (lowerMessage.includes('forecast') || lowerMessage.includes('pipeline')) {
    response = `**Pipeline Overview:**\n\n`
    response += `- Total pipeline: $${insights.pipeline.totalValue.toLocaleString()}\n`
    response += `- Average deal: $${insights.pipeline.averageDealSize.toLocaleString()}\n\n`
    response += `**Forecast:**\n`
    response += `- This month: $${insights.forecasting.thisMonth.toLocaleString()}\n`
    response += `- This quarter: $${insights.forecasting.thisQuarter.toLocaleString()}\n`
    response += `- Weighted forecast: $${insights.forecasting.weighted.toLocaleString()}`
  } else {
    // Full overview
    response = `**Sales Performance Dashboard**\n\n`
    response += `**Pipeline:** $${insights.pipeline.totalValue.toLocaleString()} total\n`
    response += `**Win Rate:** ${insights.performance.winRate}%\n`
    response += `**This Month Forecast:** $${insights.forecasting.thisMonth.toLocaleString()}\n\n`

    if (insights.recommendations.length > 0) {
      response += `**Recommendations:**\n${insights.recommendations.map(r => `- ${r}`).join('\n')}`
    }
  }

  return {
    intent: 'sales_insights',
    action: 'get_insights',
    data: insights,
    response,
    followUpActions: [
      { action: 'opportunity_tracking', label: 'View deals' },
      { action: 'lead_recommendation', label: 'Get lead priorities' },
    ],
  }
}

/**
 * Handle RFQ matching requests
 * "Show me incoming RFQs matching my catalog"
 */
async function handleRFQMatching(
  message: string,
  context: SellerHandlerContext
): Promise<SellerHandlerResult> {
  const { matches, summary, recommendations } = await ConversationalSeller.matchRFQs(
    context.sellerId
  )

  let response = summary

  if (matches.length > 0) {
    response += '\n\n**Top Matches:**\n'
    response += matches.slice(0, 5).map(match =>
      `- **${match.buyerName}** - ${match.category} (${match.quantity} units)${match.budget ? ` - Budget: $${match.budget.toLocaleString()}` : ''}\n  Match: ${match.matchScore}% - ${match.urgency} priority`
    ).join('\n')
  }

  if (recommendations.length > 0) {
    response += `\n\n**Actions:**\n${recommendations.map(r => `- ${r}`).join('\n')}`
  }

  return {
    intent: 'rfq_matching',
    action: 'match_rfqs',
    data: { matches },
    response,
    suggestions: recommendations,
    followUpActions: matches.length > 0 ? [
      { action: 'quote_generation', label: `Quote for ${matches[0]?.buyerName}`, params: { rfqId: matches[0]?.rfqId } },
      { action: 'outreach_generation', label: 'Draft response' },
    ] : [
      { action: 'catalog_management', label: 'Update my catalog' },
    ],
  }
}

/**
 * Handle quote generation requests
 * "Create a quote for their request"
 */
async function handleQuoteGeneration(
  message: string,
  context: SellerHandlerContext
): Promise<SellerHandlerResult> {
  // Get RFQ ID from context or message
  const rfqId = extractRFQReference(message, context)

  if (!rfqId) {
    return {
      intent: 'quote_generation',
      action: 'missing_rfq',
      data: {},
      response: "Which RFQ would you like me to quote? You can check matching RFQs first.",
      requiresConfirmation: true,
      followUpActions: [
        { action: 'rfq_matching', label: 'Show matching RFQs' },
      ],
    }
  }

  // Parse any customizations from message
  const customizations = parseQuoteCustomizations(message)

  const { quote, preview, suggestions } = await ConversationalSeller.generateQuote(
    context.sellerId,
    rfqId,
    customizations
  )

  let response = `**Quote Generated:**\n\n\`\`\`\n${preview}\n\`\`\``

  if (suggestions.length > 0) {
    response += `\n\n**Suggestions:**\n${suggestions.map(s => `- ${s}`).join('\n')}`
  }

  return {
    intent: 'quote_generation',
    action: 'generate_quote',
    data: { quote },
    response,
    suggestions,
    requiresConfirmation: true,
    confirmationMessage: 'Ready to send this quote?',
    followUpActions: [
      { action: 'quote_generation', label: 'Adjust pricing', params: { quoteId: quote.id } },
      { action: 'outreach_generation', label: 'Add cover message' },
    ],
  }
}

/**
 * Handle campaign launch requests
 * "Launch a campaign targeting manufacturers"
 */
async function handleCampaignLaunch(
  message: string,
  context: SellerHandlerContext
): Promise<SellerHandlerResult> {
  const { campaign, targetCount, preview } = await ConversationalSeller.launchCampaign(
    context.sellerId,
    message
  )

  const response = `**Campaign Created: ${campaign.name}**

**Target audience:** ${targetCount} prospects
**Type:** ${campaign.type}

**Preview message:**
\`\`\`
${preview}
\`\`\`

${campaign.followUpSequence ? `\n**Follow-up sequence:**\n${campaign.followUpSequence.map(s => `- Day ${s.day}: ${s.type}`).join('\n')}` : ''}`

  return {
    intent: 'campaign_launch',
    action: 'create_campaign',
    data: { campaign, targetCount },
    response,
    requiresConfirmation: true,
    confirmationMessage: `Ready to launch this campaign to ${targetCount} prospects?`,
    followUpActions: [
      { action: 'campaign_launch', label: 'Edit targeting' },
      { action: 'outreach_generation', label: 'Customize message' },
    ],
  }
}

/**
 * Handle catalog management requests
 */
async function handleCatalogManagement(
  message: string,
  context: SellerHandlerContext
): Promise<SellerHandlerResult> {
  return {
    intent: 'catalog_management',
    action: 'manage_catalog',
    data: {},
    response: "I can help you manage your product catalog. What would you like to do?\n\n- Add new products\n- Update pricing\n- Remove items\n- View current catalog",
    followUpActions: [
      { action: 'catalog_management', label: 'Add product' },
      { action: 'catalog_management', label: 'Update pricing' },
    ],
  }
}

/**
 * Handle competitor analysis requests
 */
async function handleCompetitorAnalysis(
  message: string,
  context: SellerHandlerContext
): Promise<SellerHandlerResult> {
  return {
    intent: 'competitor_analysis',
    action: 'analyze_competitors',
    data: {},
    response: "Competitor analysis is coming soon. For now, I can help you differentiate your outreach based on your unique value props. Would you like me to draft competitive positioning?",
    followUpActions: [
      { action: 'outreach_generation', label: 'Draft competitive email' },
    ],
  }
}

/**
 * Handle forecast review requests
 */
async function handleForecastReview(
  message: string,
  context: SellerHandlerContext
): Promise<SellerHandlerResult> {
  // Delegate to sales insights
  return handleSalesInsights(message, context)
}

/**
 * Handle general seller requests
 */
async function handleGeneralSellerRequest(
  message: string,
  context: SellerHandlerContext
): Promise<SellerHandlerResult> {
  return {
    intent: 'sales_insights',
    action: 'general_help',
    data: {},
    response: `I can help you with:

**Lead Management:**
- Find new prospects ("Find companies that need industrial motors")
- Get lead recommendations ("Who should I reach out to?")
- Update pipeline ("Move Acme to proposal")

**Outreach:**
- Generate emails ("Draft an email to that prospect")
- Launch campaigns ("Launch a campaign targeting manufacturers")

**Sales Tracking:**
- Track opportunities ("What deals are closing this month?")
- View insights ("What's my win rate?")
- Match RFQs ("Show incoming RFQs matching my catalog")

What would you like to do?`,
    followUpActions: [
      { action: 'lead_recommendation', label: 'Get lead priorities' },
      { action: 'opportunity_tracking', label: 'View pipeline' },
      { action: 'sales_insights', label: 'See my stats' },
    ],
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatLeadList(leads: Lead[], context: 'discovery' | 'recommendation'): string {
  return leads.map((lead, index) => {
    let entry = `**${index + 1}. ${lead.companyName}**`

    if (lead.industry) entry += ` - ${lead.industry}`
    if (lead.location) entry += ` (${lead.location})`

    entry += '\n'

    if (lead.score) entry += `   Score: ${lead.score}/100`
    if (lead.budget) entry += ` | Budget: $${lead.budget.toLocaleString()}`
    if (lead.requirements) entry += `\n   Need: ${lead.requirements.substring(0, 100)}${lead.requirements.length > 100 ? '...' : ''}`

    if (context === 'recommendation') {
      if (lead.lastContactAt) {
        const daysSince = Math.floor((Date.now() - new Date(lead.lastContactAt).getTime()) / (1000 * 60 * 60 * 24))
        entry += `\n   Last contact: ${daysSince} days ago`
      }
      if (lead.nextFollowUp) {
        entry += ` | Follow-up: ${new Date(lead.nextFollowUp).toLocaleDateString()}`
      }
    }

    return entry
  }).join('\n\n')
}

function formatLeadSummary(lead: Lead): string {
  return `**${lead.companyName}**
- Stage: ${lead.stage}
- Status: ${lead.status}
- Score: ${lead.score}/100
${lead.budget ? `- Budget: $${lead.budget.toLocaleString()}` : ''}
${lead.requirements ? `- Needs: ${lead.requirements.substring(0, 150)}...` : ''}`
}

function extractLeadReference(message: string, context: SellerHandlerContext): string | null {
  // Check if "that" or "the" refers to last mentioned lead
  const pronouns = ['that prospect', 'that lead', 'that company', 'them', 'their', 'the prospect', 'the lead']
  for (const pronoun of pronouns) {
    if (message.toLowerCase().includes(pronoun) && context.lastMentionedLead) {
      return context.lastMentionedLead.id
    }
  }

  // Check active leads for company name match
  if (context.activeLeads) {
    for (const lead of context.activeLeads) {
      if (message.toLowerCase().includes(lead.companyName.toLowerCase())) {
        return lead.id
      }
    }
  }

  return null
}

function extractRFQReference(message: string, context: SellerHandlerContext): string | null {
  // Check for "that request", "the RFQ", etc
  const pronouns = ['that request', 'that rfq', 'their request', 'the rfq', 'this rfq']
  for (const pronoun of pronouns) {
    if (message.toLowerCase().includes(pronoun)) {
      // Would return last mentioned RFQ from context
      return null // Placeholder
    }
  }

  // Extract RFQ ID if mentioned directly
  const rfqMatch = message.match(/rfq[_-]?(\w+)/i)
  if (rfqMatch) {
    return rfqMatch[1]
  }

  return null
}

function parseQuoteCustomizations(message: string): {
  discount?: number
  notes?: string
  validDays?: number
} {
  const customizations: any = {}

  // Look for discount mentions
  const discountMatch = message.match(/(\d+)%?\s*(off|discount)/i)
  if (discountMatch) {
    customizations.discount = parseInt(discountMatch[1])
  }

  // Look for validity period
  const validMatch = message.match(/valid\s+for\s+(\d+)\s*(day|week)/i)
  if (validMatch) {
    const amount = parseInt(validMatch[1])
    customizations.validDays = validMatch[2].toLowerCase() === 'week' ? amount * 7 : amount
  }

  return customizations
}

// ============================================================================
// EXPORTS
// ============================================================================

export const SellerHandler = {
  handleSellerIntent,
  classifySellerIntent,
}

export default SellerHandler
