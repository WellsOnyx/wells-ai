// @ts-nocheck
/**
 * Insights Intent Handler
 *
 * Handles all insights/analytics related intents from user messages.
 * Routes natural language questions to the appropriate insights functions.
 *
 * "How's my pipeline looking?" -> Pipeline metrics
 * "What's my conversion rate?" -> Conversion metrics
 * "Give me my morning briefing" -> Digest generation
 * "Alert me if any deal over $10k stalls" -> Custom alert creation
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  ConversationalInsights,
  InsightQuery,
  InsightResponse,
  TimeRange,
  InsightCategory,
  AlertCondition,
  CustomAlert
} from '@/lib/insights/conversational-insights'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

export interface ParsedIntent {
  category: InsightCategory
  action: 'query' | 'compare' | 'alert' | 'digest' | 'export' | 'recommendation'
  timeRange: TimeRange
  compareWith?: TimeRange
  threshold?: number
  entity?: string
  customQuery?: string
  confidence: number
}

export interface InsightHandlerOptions {
  userId: string
  query: string
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  userProfile?: {
    firstName?: string
    company?: string
  }
}

export interface InsightHandlerResult {
  response: string
  data?: any
  actions?: Array<{
    label: string
    action: string
    params?: Record<string, any>
  }>
  followUp?: string[]
  shouldPersist?: boolean
}

// ============================================================================
// INTENT PATTERNS
// ============================================================================

const INTENT_PATTERNS: Record<string, {
  patterns: RegExp[]
  category: InsightCategory
  action: 'query' | 'compare' | 'alert' | 'digest' | 'export' | 'recommendation'
}> = {
  pipeline: {
    patterns: [
      /pipeline/i,
      /deals?\s*(status|health|overview)/i,
      /how('s|s|\s+is)?\s+(my\s+)?pipeline/i,
      /active\s+deals?/i,
      /deal\s+flow/i,
      /sales\s+pipeline/i
    ],
    category: 'pipeline',
    action: 'query'
  },
  revenue: {
    patterns: [
      /revenue/i,
      /sales\s+(numbers?|figures?|total)/i,
      /how\s+much\s+(have\s+I\s+)?(made|earned|closed)/i,
      /total\s+(sales|earnings)/i,
      /money\s+(made|earned)/i,
      /closed\s+deals?(\s+value)?/i
    ],
    category: 'revenue',
    action: 'query'
  },
  conversion: {
    patterns: [
      /conversion\s*(rate|ratio)?/i,
      /win\s*rate/i,
      /close\s*rate/i,
      /how\s+(many|often)\s+(do\s+)?(I\s+)?(win|close|convert)/i,
      /lead.*convert/i,
      /funnel/i
    ],
    category: 'conversion',
    action: 'query'
  },
  leads: {
    patterns: [
      /leads?/i,
      /prospects?/i,
      /inquir(y|ies)/i,
      /new\s+(business|opportunities)/i,
      /incoming\s+(requests?|leads?)/i
    ],
    category: 'leads',
    action: 'query'
  },
  urgent: {
    patterns: [
      /urgent/i,
      /critical/i,
      /attention/i,
      /issues?/i,
      /problems?/i,
      /what('s|\s+is)\s+wrong/i,
      /anything\s+(I\s+)?(should|need\s+to)\s+know/i,
      /red\s+flags?/i,
      /at\s+risk/i,
      /stalled/i
    ],
    category: 'alerts',
    action: 'query'
  },
  recommendation: {
    patterns: [
      /recommend/i,
      /suggest/i,
      /should\s+I\s+(focus|do|prioritize)/i,
      /what('s|\s+is)\s+(next|important)/i,
      /priorities?/i,
      /focus\s+on/i,
      /advice/i,
      /help\s+me\s+decide/i
    ],
    category: 'recommendations',
    action: 'recommendation'
  },
  digest: {
    patterns: [
      /briefing/i,
      /digest/i,
      /summary/i,
      /morning\s+(update|report)/i,
      /daily\s+(update|report)/i,
      /weekly\s+(update|report)/i,
      /catch\s*me\s*up/i,
      /what('s|\s+have\s+I)\s+missed/i,
      /give\s+me\s+(the\s+)?rundown/i
    ],
    category: 'digest',
    action: 'digest'
  },
  compare: {
    patterns: [
      /compare/i,
      /vs\.?/i,
      /versus/i,
      /compared\s+to/i,
      /difference\s+between/i,
      /(this|last)\s+(week|month|quarter|year)/i,
      /year\s*over\s*year/i,
      /month\s*over\s*month/i,
      /growth/i,
      /change/i
    ],
    category: 'comparison',
    action: 'compare'
  },
  trend: {
    patterns: [
      /trend/i,
      /trending/i,
      /over\s+time/i,
      /history/i,
      /historical/i,
      /pattern/i,
      /trajectory/i,
      /direction/i
    ],
    category: 'trends',
    action: 'query'
  },
  alert: {
    patterns: [
      /alert\s+me/i,
      /notify\s+me/i,
      /let\s+me\s+know/i,
      /tell\s+me\s+(when|if)/i,
      /watch\s+for/i,
      /monitor/i,
      /keep\s+(an\s+)?eye\s+on/i,
      /set\s+(up\s+)?(an?\s+)?alert/i
    ],
    category: 'alerts',
    action: 'alert'
  },
  export: {
    patterns: [
      /export/i,
      /download/i,
      /send\s+me/i,
      /generate\s+(a\s+)?report/i,
      /pdf/i,
      /spreadsheet/i,
      /csv/i,
      /email\s+me/i
    ],
    category: 'export',
    action: 'export'
  }
}

// Time range patterns
const TIME_PATTERNS: Array<{ pattern: RegExp; range: TimeRange }> = [
  { pattern: /today/i, range: 'today' },
  { pattern: /yesterday/i, range: 'yesterday' },
  { pattern: /this\s+week/i, range: 'week' },
  { pattern: /last\s+week/i, range: 'week' },
  { pattern: /this\s+month/i, range: 'month' },
  { pattern: /last\s+month/i, range: 'month' },
  { pattern: /this\s+quarter/i, range: 'quarter' },
  { pattern: /last\s+quarter/i, range: 'quarter' },
  { pattern: /this\s+year/i, range: 'year' },
  { pattern: /last\s+year/i, range: 'year' },
  { pattern: /ytd|year\s*to\s*date/i, range: 'year' },
  { pattern: /all\s*time/i, range: 'all' },
  { pattern: /ever/i, range: 'all' }
]

// ============================================================================
// INTENT PARSING
// ============================================================================

/**
 * Parse user query to determine intent
 */
export function parseIntent(query: string): ParsedIntent {
  const normalizedQuery = query.toLowerCase().trim()

  // Find matching category
  let matchedCategory: InsightCategory = 'pipeline'
  let matchedAction: ParsedIntent['action'] = 'query'
  let maxMatches = 0
  let confidence = 0.5

  for (const [key, config] of Object.entries(INTENT_PATTERNS)) {
    const matches = config.patterns.filter(p => p.test(normalizedQuery)).length
    if (matches > maxMatches) {
      maxMatches = matches
      matchedCategory = config.category
      matchedAction = config.action
      confidence = Math.min(0.5 + (matches * 0.15), 0.95)
    }
  }

  // Extract time range
  let timeRange: TimeRange = 'month' // Default
  for (const { pattern, range } of TIME_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      timeRange = range
      confidence += 0.05
      break
    }
  }

  // Check for comparison intent
  let compareWith: TimeRange | undefined
  if (/vs\.?|versus|compared?\s+to|last\s+(week|month|quarter|year)/i.test(normalizedQuery)) {
    matchedAction = 'compare'
    // Extract the comparison period
    if (/last\s+week/i.test(normalizedQuery)) compareWith = 'week'
    else if (/last\s+month/i.test(normalizedQuery)) compareWith = 'month'
    else if (/last\s+quarter/i.test(normalizedQuery)) compareWith = 'quarter'
    else if (/last\s+year/i.test(normalizedQuery)) compareWith = 'year'
  }

  // Extract threshold for alerts
  let threshold: number | undefined
  const thresholdMatch = normalizedQuery.match(/\$?([\d,]+)k?/i)
  if (thresholdMatch) {
    let value = parseFloat(thresholdMatch[1].replace(/,/g, ''))
    if (normalizedQuery.includes('k')) value *= 1000
    threshold = value
  }

  // Extract entity references
  let entity: string | undefined
  const entityMatch = normalizedQuery.match(/deal\s+(?:called\s+)?["']?([^"']+)["']?/i)
  if (entityMatch) {
    entity = entityMatch[1].trim()
  }

  return {
    category: matchedCategory,
    action: matchedAction,
    timeRange,
    compareWith,
    threshold,
    entity,
    confidence
  }
}

// ============================================================================
// RESPONSE GENERATION
// ============================================================================

/**
 * Generate a natural language response for insights data
 */
async function generateNaturalResponse(
  intent: ParsedIntent,
  data: any,
  userProfile?: { firstName?: string; company?: string }
): Promise<string> {
  const greeting = userProfile?.firstName ? `${userProfile.firstName}, ` : ''

  try {
    // Use Claude to generate a natural response
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are Wells, a helpful business AI assistant. Generate a conversational, helpful response based on this data.

User asked about: ${intent.category}
Time period: ${intent.timeRange}
Data: ${JSON.stringify(data, null, 2)}

Requirements:
- Be conversational and warm, not robotic
- Lead with the most important insight
- Use natural language for numbers ($15k not $15000)
- Include 1-2 actionable suggestions if relevant
- Keep it concise (2-4 sentences max)
- ${greeting ? `Address the user as "${greeting.trim()}"` : 'No need to use a name'}

Response:`
      }]
    })

    const textBlock = response.content.find(block => block.type === 'text')
    return textBlock?.type === 'text' ? textBlock.text : generateFallbackResponse(intent, data, greeting)
  } catch (error) {
    console.error('Error generating natural response:', error)
    return generateFallbackResponse(intent, data, greeting)
  }
}

/**
 * Generate fallback response without AI
 */
function generateFallbackResponse(
  intent: ParsedIntent,
  data: any,
  greeting: string = ''
): string {
  switch (intent.category) {
    case 'pipeline':
      return `${greeting}Your pipeline has ${data.totalDeals || 0} active deals worth $${(data.totalValue || 0).toLocaleString()}. Health score: ${data.healthScore || 50}/100.`

    case 'revenue':
      return `${greeting}You've closed $${(data.totalRevenue || 0).toLocaleString()} in revenue from ${data.closedDeals || 0} deals. ${data.growthRate >= 0 ? 'Up' : 'Down'} ${Math.abs(data.growthRate || 0).toFixed(1)}% vs last period.`

    case 'conversion':
      return `${greeting}Your overall conversion rate is ${(data.overallConversion || 0).toFixed(1)}%. Lead to opportunity: ${(data.leadToOpportunity || 0).toFixed(1)}%, opportunity to win: ${(data.opportunityToWin || 0).toFixed(1)}%.`

    case 'leads':
      return `${greeting}You have ${data.totalLeads || 0} leads total, with ${data.activeLeads || 0} active and ${data.newLeads || 0} new this week.`

    case 'alerts':
      if (data.issues && data.issues.length > 0) {
        return `${greeting}${data.summary || `You have ${data.issues.length} items needing attention.`}`
      }
      return `${greeting}All clear! No urgent issues right now.`

    case 'recommendations':
      if (data.recommendations && data.recommendations.length > 0) {
        return `${greeting}I'd focus on: ${data.recommendations[0].title}. ${data.recommendations[0].description}`
      }
      return `${greeting}Things are looking good. Keep up the momentum!`

    default:
      return `${greeting}Here's what I found: ${JSON.stringify(data).substring(0, 200)}...`
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Handle an insights query
 */
export async function handleInsightsQuery(
  options: InsightHandlerOptions
): Promise<InsightHandlerResult> {
  const { userId, query, userProfile } = options

  // Parse the intent
  const intent = parseIntent(query)

  let data: any
  let response: string
  let actions: InsightHandlerResult['actions'] = []
  let followUp: string[] = []

  try {
    switch (intent.action) {
      case 'query':
        const queryResult = await handleMetricQuery(userId, intent)
        data = queryResult.data
        response = await generateNaturalResponse(intent, data, userProfile)
        actions = queryResult.actions
        followUp = queryResult.followUp
        break

      case 'compare':
        const compareResult = await handleComparison(userId, intent)
        data = compareResult.data
        response = await generateNaturalResponse(
          { ...intent, category: 'comparison' },
          data,
          userProfile
        )
        followUp = compareResult.followUp
        break

      case 'alert':
        const alertResult = await handleAlertCreation(userId, intent, query)
        data = alertResult.data
        response = alertResult.response
        actions = alertResult.actions
        break

      case 'digest':
        const digestResult = await handleDigestRequest(userId, intent)
        data = digestResult.data
        response = digestResult.response
        followUp = digestResult.followUp
        break

      case 'export':
        const exportResult = await handleExportRequest(userId, intent)
        data = exportResult.data
        response = exportResult.response
        actions = exportResult.actions
        break

      case 'recommendation':
        const recResult = await handleRecommendationRequest(userId)
        data = recResult.data
        response = await generateNaturalResponse(
          { ...intent, category: 'recommendations' },
          data,
          userProfile
        )
        actions = recResult.actions
        followUp = recResult.followUp
        break

      default:
        // Fallback to pipeline overview
        const fallbackResult = await handleMetricQuery(userId, { ...intent, category: 'pipeline' })
        data = fallbackResult.data
        response = await generateNaturalResponse({ ...intent, category: 'pipeline' }, data, userProfile)
        actions = fallbackResult.actions
        followUp = fallbackResult.followUp
    }

    return {
      response,
      data,
      actions,
      followUp
    }
  } catch (error) {
    console.error('Error handling insights query:', error)
    return {
      response: "I had trouble pulling that information together. Could you try asking in a different way, or let me know specifically what you'd like to see?",
      followUp: [
        "How's my pipeline looking?",
        "What should I focus on today?",
        "Any urgent issues?"
      ]
    }
  }
}

// ============================================================================
// SPECIFIC HANDLERS
// ============================================================================

async function handleMetricQuery(
  userId: string,
  intent: ParsedIntent
): Promise<{ data: any; actions: InsightHandlerResult['actions']; followUp: string[] }> {
  let data: any
  let actions: InsightHandlerResult['actions'] = []
  let followUp: string[] = []

  switch (intent.category) {
    case 'pipeline':
      data = await ConversationalInsights.getPipelineMetrics(userId, intent.timeRange)
      followUp = [
        'Show me my revenue trend',
        'Any deals at risk?',
        'What should I focus on?'
      ]
      break

    case 'revenue':
      data = await ConversationalInsights.getRevenueMetrics(userId, intent.timeRange)
      followUp = [
        'How does this compare to last month?',
        'What\'s my projected revenue?',
        'Show me the trend'
      ]
      break

    case 'conversion':
      data = await ConversationalInsights.getConversionMetrics(userId, intent.timeRange)
      followUp = [
        'How can I improve conversion?',
        'Which source converts best?',
        'Show me my funnel'
      ]
      break

    case 'leads':
      data = await ConversationalInsights.getLeadMetrics(userId, intent.timeRange)
      if (data.hotLeads && data.hotLeads.length > 0) {
        actions = data.hotLeads.slice(0, 3).map((lead: any) => ({
          label: `View ${lead.name}`,
          action: 'view_lead',
          params: { leadId: lead.id }
        }))
      }
      followUp = [
        'Show me my hot leads',
        'What\'s my response time?',
        'Any leads I should prioritize?'
      ]
      break

    case 'alerts':
      data = await ConversationalInsights.getUrgentIssues(userId)
      if (data.issues && data.issues.length > 0) {
        actions = data.issues.slice(0, 3).map((issue: any) => ({
          label: issue.actionRequired.substring(0, 30) + '...',
          action: `view_${issue.entityType}`,
          params: { id: issue.entityId }
        }))
      }
      followUp = [
        'What should I focus on?',
        'Set up alerts for me',
        'Give me my briefing'
      ]
      break

    case 'trends':
      data = await ConversationalInsights.analyzeTrends(userId, 'revenue', intent.timeRange)
      followUp = [
        'Show me deal trends',
        'How\'s my lead flow trending?',
        'What\'s the forecast?'
      ]
      break

    default:
      data = await ConversationalInsights.getPipelineMetrics(userId, intent.timeRange)
      followUp = [
        'Show me my revenue',
        'What\'s my conversion rate?',
        'Any urgent issues?'
      ]
  }

  return { data, actions, followUp }
}

async function handleComparison(
  userId: string,
  intent: ParsedIntent
): Promise<{ data: any; followUp: string[] }> {
  const currentPeriod = intent.timeRange
  const previousPeriod = intent.compareWith || getPreviousPeriod(intent.timeRange)

  const data = await ConversationalInsights.comparePerformance(
    userId,
    currentPeriod,
    previousPeriod
  )

  return {
    data,
    followUp: [
      'What\'s driving this change?',
      'Show me the trend over time',
      'What should I do about this?'
    ]
  }
}

async function handleAlertCreation(
  userId: string,
  intent: ParsedIntent,
  originalQuery: string
): Promise<{ data: any; response: string; actions: InsightHandlerResult['actions'] }> {
  // Parse alert parameters from the query
  let condition: AlertCondition = 'deal_stalled'
  let threshold = intent.threshold

  const query = originalQuery.toLowerCase()

  if (/stall|inactive|stuck/i.test(query)) {
    condition = 'deal_stalled'
    threshold = threshold || 7 // Default 7 days
  } else if (/over|above|more than/i.test(query) && threshold) {
    condition = 'deal_over_threshold'
  } else if (/lead.*spike|new\s+leads?/i.test(query)) {
    condition = 'lead_spike'
    threshold = threshold || 5
  } else if (/no\s+contact|haven't\s+reached/i.test(query)) {
    condition = 'inactive_lead'
    threshold = threshold || 48 // Default 48 hours
  }

  // Create a descriptive name
  let alertName = 'Custom Alert'
  if (condition === 'deal_stalled') {
    alertName = `Deal stalled for ${threshold}+ days`
  } else if (condition === 'deal_over_threshold') {
    alertName = `High-value deal ($${(threshold || 10000).toLocaleString()}+) needs attention`
  } else if (condition === 'lead_spike') {
    alertName = `${threshold}+ new leads in 24 hours`
  } else if (condition === 'inactive_lead') {
    alertName = `Lead inactive for ${threshold}+ hours`
  }

  try {
    const alert = await ConversationalInsights.createCustomAlert(userId, {
      userId,
      name: alertName,
      condition,
      threshold,
      channels: ['chat'],
      frequency: 'daily',
      metadata: { originalQuery }
    })

    return {
      data: { alert },
      response: `I've set up an alert for you: "${alertName}". I'll let you know through chat when this happens. Want me to also send you an email or Slack notification?`,
      actions: [
        { label: 'Add email notifications', action: 'update_alert', params: { alertId: alert.id, addChannel: 'email' } },
        { label: 'Add Slack notifications', action: 'update_alert', params: { alertId: alert.id, addChannel: 'slack' } },
        { label: 'View all alerts', action: 'list_alerts', params: {} }
      ]
    }
  } catch (error) {
    return {
      data: null,
      response: "I couldn't set up that alert right now. Could you try again or describe what you'd like to be notified about?",
      actions: []
    }
  }
}

async function handleDigestRequest(
  userId: string,
  intent: ParsedIntent
): Promise<{ data: any; response: string; followUp: string[] }> {
  // Determine digest type from time context
  const now = new Date()
  const hour = now.getHours()
  let digestType: 'morning' | 'evening' | 'weekly' = 'morning'

  if (hour >= 17) {
    digestType = 'evening'
  }

  if (intent.timeRange === 'week' || /weekly/i.test(intent.category)) {
    digestType = 'weekly'
  }

  const digest = await ConversationalInsights.generateDigest(userId, digestType)

  // Format the digest into a conversational response
  let response = digest.greeting + '\n\n'

  for (const section of digest.sections) {
    response += `**${section.title}**\n${section.content}\n\n`
  }

  response += digest.callToAction

  return {
    data: { digest },
    response,
    followUp: [
      'Tell me more about the urgent items',
      'What should I focus on first?',
      'Show me my hot leads'
    ]
  }
}

async function handleExportRequest(
  userId: string,
  intent: ParsedIntent
): Promise<{ data: any; response: string; actions: InsightHandlerResult['actions'] }> {
  // Determine export type
  let exportType: 'pipeline' | 'revenue' | 'leads' | 'full' = 'full'

  if (intent.category === 'pipeline') exportType = 'pipeline'
  else if (intent.category === 'revenue') exportType = 'revenue'
  else if (intent.category === 'leads') exportType = 'leads'

  const exportData = await ConversationalInsights.generateExport(
    userId,
    exportType,
    intent.timeRange,
    'summary'
  )

  return {
    data: exportData,
    response: `Here's your ${exportData.title}:\n\n${exportData.summary}\n\nWould you like me to email this to you as a PDF or download it as a spreadsheet?`,
    actions: [
      { label: 'Email as PDF', action: 'email_export', params: { exportType, format: 'pdf' } },
      { label: 'Download CSV', action: 'download_export', params: { exportType, format: 'csv' } },
      { label: 'View detailed report', action: 'view_export', params: { exportType, format: 'detailed' } }
    ]
  }
}

async function handleRecommendationRequest(
  userId: string
): Promise<{ data: any; actions: InsightHandlerResult['actions']; followUp: string[] }> {
  const data = await ConversationalInsights.getRecommendations(userId)

  const actions: InsightHandlerResult['actions'] = data.recommendations.slice(0, 3).map((rec: any) => ({
    label: rec.title,
    action: 'apply_recommendation',
    params: { recommendation: rec }
  }))

  return {
    data,
    actions,
    followUp: [
      'Tell me more about the first recommendation',
      'What else should I know?',
      'Any urgent issues?'
    ]
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function getPreviousPeriod(current: TimeRange): TimeRange {
  switch (current) {
    case 'today':
      return 'yesterday'
    case 'week':
      return 'week'
    case 'month':
      return 'month'
    case 'quarter':
      return 'quarter'
    case 'year':
      return 'year'
    default:
      return 'month'
  }
}

/**
 * Check if a query is insights-related
 */
export function isInsightsQuery(query: string): boolean {
  const normalizedQuery = query.toLowerCase()

  // Check against all patterns
  for (const config of Object.values(INTENT_PATTERNS)) {
    if (config.patterns.some(p => p.test(normalizedQuery))) {
      return true
    }
  }

  // Additional checks for common analytics phrases
  const analyticsKeywords = [
    /how('s|s|\s+is|\s+are)/i,
    /what('s|s|\s+is)/i,
    /show\s+me/i,
    /tell\s+me/i,
    /give\s+me/i,
    /report/i,
    /metrics?/i,
    /numbers?/i,
    /stats?/i,
    /statistics?/i,
    /analytics?/i,
    /insights?/i,
    /performance/i,
    /overview/i,
    /snapshot/i
  ]

  return analyticsKeywords.some(p => p.test(normalizedQuery))
}

/**
 * Get suggested follow-up questions based on context
 */
export function getSuggestedQuestions(category?: InsightCategory): string[] {
  const suggestions: Record<InsightCategory | 'default', string[]> = {
    pipeline: [
      "What's my conversion rate?",
      "Any deals at risk?",
      "Show me my revenue trend"
    ],
    revenue: [
      "How does this compare to last month?",
      "What's driving my revenue?",
      "Show me my pipeline"
    ],
    conversion: [
      "How can I improve this?",
      "Which source converts best?",
      "Show me my leads"
    ],
    leads: [
      "Show me my hot leads",
      "What's my response time?",
      "Any leads to prioritize?"
    ],
    deals: [
      "Which deals need attention?",
      "What's my pipeline worth?",
      "Any stalled deals?"
    ],
    performance: [
      "How am I doing vs last month?",
      "What should I focus on?",
      "Show me trends"
    ],
    trends: [
      "What's the forecast?",
      "Show me revenue trend",
      "How are leads trending?"
    ],
    alerts: [
      "Set up alerts for me",
      "What needs attention?",
      "Show me critical issues"
    ],
    digest: [
      "What's next?",
      "Show me details",
      "Any recommendations?"
    ],
    recommendations: [
      "Tell me more about this",
      "What else should I know?",
      "Show me my pipeline"
    ],
    comparison: [
      "What's driving the change?",
      "Show me the trend",
      "What should I do?"
    ],
    export: [
      "Email me the report",
      "Show me details",
      "Generate another report"
    ],
    default: [
      "How's my pipeline looking?",
      "What should I focus on today?",
      "Any urgent issues?"
    ]
  }

  return suggestions[category || 'default'] || suggestions.default
}

// ============================================================================
// EXPORTS
// ============================================================================

export const InsightsHandler = {
  parseIntent,
  handleInsightsQuery,
  isInsightsQuery,
  getSuggestedQuestions
}

export default InsightsHandler
