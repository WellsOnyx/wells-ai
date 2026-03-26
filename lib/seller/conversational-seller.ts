// @ts-nocheck
/**
 * Conversational Seller - Business Logic
 *
 * The engine powering Wells AI's conversational GTM system.
 * Sellers talk naturally. Wells handles the complexity.
 *
 * Core capabilities:
 * - Lead discovery and qualification
 * - Pipeline management through conversation
 * - Outreach generation and campaigns
 * - RFQ matching and quote generation
 * - Sales analytics and insights
 */

import { sql } from '@vercel/postgres'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

export interface Lead {
  id: string
  companyName: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  industry: string
  companySize?: string
  location?: string
  source: 'discovery' | 'inbound' | 'referral' | 'campaign' | 'rfq'
  score: number // 0-100 lead score
  status: LeadStatus
  stage: PipelineStage
  tags: string[]
  requirements?: string
  budget?: number
  timeline?: string
  lastContactAt?: Date
  nextFollowUp?: Date
  notes: LeadNote[]
  activities: LeadActivity[]
  assignedTo?: string
  createdAt: Date
  updatedAt: Date
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost' | 'nurture'
export type PipelineStage = 'discovery' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'

export interface LeadNote {
  id: string
  content: string
  createdBy: string
  createdAt: Date
}

export interface LeadActivity {
  id: string
  type: 'email' | 'call' | 'meeting' | 'note' | 'status_change' | 'quote_sent'
  description: string
  metadata?: Record<string, any>
  createdAt: Date
}

export interface Opportunity {
  id: string
  leadId: string
  name: string
  value: number
  probability: number // 0-100
  stage: PipelineStage
  expectedCloseDate?: Date
  products: string[]
  competitors?: string[]
  decisionMakers: string[]
  nextSteps?: string
  createdAt: Date
  updatedAt: Date
}

export interface Quote {
  id: string
  leadId: string
  opportunityId?: string
  rfqId?: string
  items: QuoteItem[]
  subtotal: number
  discount?: number
  tax?: number
  total: number
  validUntil: Date
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'
  terms?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface QuoteItem {
  name: string
  description?: string
  quantity: number
  unitPrice: number
  total: number
}

export interface Campaign {
  id: string
  name: string
  type: 'email' | 'linkedin' | 'multi_channel'
  targetCriteria: TargetCriteria
  status: 'draft' | 'active' | 'paused' | 'completed'
  messageTemplate: string
  followUpSequence?: CampaignStep[]
  stats: CampaignStats
  createdAt: Date
  updatedAt: Date
}

export interface TargetCriteria {
  industries?: string[]
  companySizes?: string[]
  locations?: string[]
  titles?: string[]
  keywords?: string[]
  excludeCompanies?: string[]
}

export interface CampaignStep {
  day: number
  type: 'email' | 'linkedin' | 'call'
  template: string
}

export interface CampaignStats {
  sent: number
  opened: number
  replied: number
  meetings: number
  conversions: number
}

export interface RFQMatch {
  rfqId: string
  buyerName: string
  category: string
  description: string
  quantity: number
  budget?: number
  urgency: 'standard' | 'urgent' | 'critical'
  matchScore: number
  matchReason: string
  receivedAt: Date
}

export interface SalesInsights {
  pipeline: PipelineMetrics
  performance: PerformanceMetrics
  forecasting: ForecastMetrics
  recommendations: string[]
}

export interface PipelineMetrics {
  totalValue: number
  byStage: Record<PipelineStage, { count: number; value: number }>
  averageDealSize: number
  averageCycleTime: number
}

export interface PerformanceMetrics {
  winRate: number
  quotesToClose: number
  responseTime: number
  activityScore: number
}

export interface ForecastMetrics {
  thisMonth: number
  nextMonth: number
  thisQuarter: number
  weighted: number
}

// ============================================================================
// LEAD DISCOVERY
// ============================================================================

/**
 * Discover leads based on natural language criteria
 * "Find companies that need industrial motors in Texas"
 */
export async function discoverLeads(
  sellerId: string,
  criteria: string
): Promise<{ leads: Lead[]; searchCriteria: TargetCriteria; suggestions: string[] }> {
  // Use AI to parse the natural language criteria
  const parsedCriteria = await parseSearchCriteria(criteria)

  // Search for matching leads
  const leads = await searchLeads(sellerId, parsedCriteria)

  // Generate suggestions for refining search
  const suggestions = await generateSearchSuggestions(criteria, leads.length)

  return {
    leads,
    searchCriteria: parsedCriteria,
    suggestions,
  }
}

async function parseSearchCriteria(criteria: string): Promise<TargetCriteria> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Parse this lead search criteria into structured format. Return JSON only.

Criteria: "${criteria}"

Return:
{
  "industries": ["array of industries"],
  "companySizes": ["startup", "smb", "mid-market", "enterprise"],
  "locations": ["cities, states, or regions"],
  "titles": ["decision maker titles"],
  "keywords": ["product/service keywords"],
  "excludeCompanies": []
}

Only include fields that are clearly specified or implied.`,
        },
      ],
    })

    const textBlock = response.content.find(block => block.type === 'text')
    const text = textBlock?.type === 'text' ? textBlock.text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    return JSON.parse(jsonMatch?.[0] || '{}')
  } catch (error) {
    console.error('[ConversationalSeller] Error parsing criteria:', error)
    return { keywords: [criteria] }
  }
}

async function searchLeads(
  sellerId: string,
  criteria: TargetCriteria
): Promise<Lead[]> {
  try {
    // Build search query
    const conditions: string[] = ['seller_id = $1']
    const params: any[] = [sellerId]

    if (criteria.industries?.length) {
      conditions.push(`industry = ANY($${params.length + 1})`)
      params.push(criteria.industries)
    }

    if (criteria.locations?.length) {
      conditions.push(`location = ANY($${params.length + 1})`)
      params.push(criteria.locations)
    }

    if (criteria.companySizes?.length) {
      conditions.push(`company_size = ANY($${params.length + 1})`)
      params.push(criteria.companySizes)
    }

    if (criteria.keywords?.length) {
      // Full-text search on requirements and company name
      conditions.push(`(
        requirements ILIKE ANY($${params.length + 1})
        OR company_name ILIKE ANY($${params.length + 1})
        OR industry ILIKE ANY($${params.length + 1})
      )`)
      params.push(criteria.keywords.map(k => `%${k}%`))
    }

    const result = await sql.query(
      `SELECT * FROM seller_leads
       WHERE ${conditions.join(' AND ')}
       ORDER BY score DESC, created_at DESC
       LIMIT 50`,
      params
    )

    return result.rows.map(mapLeadFromDb)
  } catch (error) {
    console.error('[ConversationalSeller] Error searching leads:', error)
    return []
  }
}

async function generateSearchSuggestions(
  criteria: string,
  resultCount: number
): Promise<string[]> {
  if (resultCount > 10) {
    return [
      'Try narrowing by company size',
      'Add location filter',
      'Specify decision maker titles',
    ]
  }

  if (resultCount === 0) {
    return [
      'Try broader industry terms',
      'Expand location search',
      'Remove specific keywords',
    ]
  }

  return []
}

// ============================================================================
// LEAD RECOMMENDATIONS
// ============================================================================

/**
 * Get AI-powered lead recommendations
 * "Who should I reach out to?"
 */
export async function getLeadRecommendations(
  sellerId: string,
  context?: string
): Promise<{ recommended: Lead[]; reasoning: string; nextActions: string[] }> {
  // Get seller's leads with recent activity
  const leads = await getSellerLeads(sellerId, { status: 'new,contacted,qualified' })

  // Score and rank leads
  const scoredLeads = await scoreLeads(leads)

  // Get top recommendations with AI reasoning
  const topLeads = scoredLeads.slice(0, 5)

  const reasoning = await generateRecommendationReasoning(topLeads, context)
  const nextActions = generateNextActions(topLeads)

  return {
    recommended: topLeads,
    reasoning,
    nextActions,
  }
}

async function scoreLeads(leads: Lead[]): Promise<Lead[]> {
  // Score based on multiple factors
  return leads.map(lead => {
    let score = lead.score || 50

    // Recency bonus
    const daysSinceContact = lead.lastContactAt
      ? (Date.now() - new Date(lead.lastContactAt).getTime()) / (1000 * 60 * 60 * 24)
      : 999

    if (daysSinceContact > 7) score += 10 // Needs attention
    if (lead.budget && lead.budget > 10000) score += 15
    if (lead.timeline === 'urgent' || lead.timeline === 'this_month') score += 20
    if (lead.stage === 'qualification') score += 10
    if (lead.nextFollowUp && new Date(lead.nextFollowUp) <= new Date()) score += 25

    return { ...lead, score: Math.min(100, score) }
  }).sort((a, b) => b.score - a.score)
}

async function generateRecommendationReasoning(
  leads: Lead[],
  context?: string
): Promise<string> {
  if (leads.length === 0) {
    return 'No leads to prioritize right now. Consider running a discovery campaign.'
  }

  const leadSummary = leads.slice(0, 3).map(l =>
    `${l.companyName} (${l.industry}, score: ${l.score})`
  ).join(', ')

  return `Top priorities: ${leadSummary}. These leads score highest based on engagement timing, deal potential, and follow-up urgency.`
}

function generateNextActions(leads: Lead[]): string[] {
  const actions: string[] = []

  for (const lead of leads.slice(0, 3)) {
    if (!lead.lastContactAt) {
      actions.push(`Send initial outreach to ${lead.companyName}`)
    } else if (lead.nextFollowUp && new Date(lead.nextFollowUp) <= new Date()) {
      actions.push(`Follow up with ${lead.companyName} (overdue)`)
    } else if (lead.stage === 'qualification') {
      actions.push(`Schedule discovery call with ${lead.companyName}`)
    }
  }

  return actions
}

// ============================================================================
// OUTREACH GENERATION
// ============================================================================

/**
 * Generate personalized outreach
 * "Draft an email to that prospect"
 */
export async function generateOutreach(
  sellerId: string,
  leadId: string,
  type: 'email' | 'linkedin' | 'call_script',
  context?: string
): Promise<{ content: string; subject?: string; suggestions: string[] }> {
  // Get lead details
  const lead = await getLead(leadId)
  if (!lead) {
    throw new Error('Lead not found')
  }

  // Get seller profile for personalization
  const sellerProfile = await getSellerProfile(sellerId)

  // Generate personalized outreach
  const outreach = await generatePersonalizedMessage(lead, sellerProfile, type, context)

  return outreach
}

async function generatePersonalizedMessage(
  lead: Lead,
  sellerProfile: any,
  type: 'email' | 'linkedin' | 'call_script',
  context?: string
): Promise<{ content: string; subject?: string; suggestions: string[] }> {
  const typeInstructions = {
    email: 'Write a professional but personable cold email. Keep it under 150 words. No fluff.',
    linkedin: 'Write a LinkedIn connection request or message. Keep it under 300 characters.',
    call_script: 'Write a brief call script with an opener, value prop, and qualifying questions.',
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: `Generate ${type} outreach for this prospect.

PROSPECT:
- Company: ${lead.companyName}
- Industry: ${lead.industry}
- Location: ${lead.location || 'Unknown'}
- Requirements: ${lead.requirements || 'General interest'}
${lead.contactName ? `- Contact: ${lead.contactName}` : ''}

SELLER:
- Company: ${sellerProfile?.companyName || 'Our company'}
- Products: ${sellerProfile?.products?.join(', ') || 'Industrial solutions'}

${context ? `ADDITIONAL CONTEXT: ${context}` : ''}

INSTRUCTIONS: ${typeInstructions[type]}

Return JSON:
{
  "subject": "email subject if applicable",
  "content": "the message content",
  "suggestions": ["alternative approach 1", "follow-up timing suggestion"]
}`,
        },
      ],
    })

    const textBlock = response.content.find(block => block.type === 'text')
    const text = textBlock?.type === 'text' ? textBlock.text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const result = JSON.parse(jsonMatch?.[0] || '{}')

    return {
      content: result.content || 'Unable to generate message',
      subject: result.subject,
      suggestions: result.suggestions || [],
    }
  } catch (error) {
    console.error('[ConversationalSeller] Error generating outreach:', error)
    return {
      content: `Hi ${lead.contactName || 'there'},\n\nI noticed ${lead.companyName} works in ${lead.industry}. We help companies like yours with industrial solutions.\n\nWould you be open to a quick call this week?\n\nBest`,
      suggestions: ['Personalize the opener', 'Add specific value proposition'],
    }
  }
}

// ============================================================================
// PIPELINE MANAGEMENT
// ============================================================================

/**
 * Update pipeline through conversation
 * "Move Acme to proposal stage"
 */
export async function updatePipeline(
  sellerId: string,
  command: string
): Promise<{ updated: Lead | Opportunity; action: string; summary: string }> {
  // Parse the command
  const parsed = await parsePipelineCommand(command)

  if (parsed.type === 'lead') {
    const lead = await updateLeadStage(sellerId, parsed.identifier, parsed.newStage, parsed.notes)
    return {
      updated: lead,
      action: `Moved to ${parsed.newStage}`,
      summary: `${lead.companyName} is now in ${parsed.newStage} stage.`,
    }
  } else {
    const opportunity = await updateOpportunityStage(sellerId, parsed.identifier, parsed.newStage)
    return {
      updated: opportunity,
      action: `Moved to ${parsed.newStage}`,
      summary: `Opportunity updated to ${parsed.newStage}.`,
    }
  }
}

async function parsePipelineCommand(command: string): Promise<{
  type: 'lead' | 'opportunity'
  identifier: string
  newStage: PipelineStage
  notes?: string
}> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Parse this pipeline update command.

Command: "${command}"

Valid stages: discovery, qualification, proposal, negotiation, closed_won, closed_lost

Return JSON:
{
  "type": "lead or opportunity",
  "identifier": "company name or ID mentioned",
  "newStage": "the target stage",
  "notes": "any additional notes mentioned"
}`,
        },
      ],
    })

    const textBlock = response.content.find(block => block.type === 'text')
    const text = textBlock?.type === 'text' ? textBlock.text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    return JSON.parse(jsonMatch?.[0] || '{}')
  } catch (error) {
    console.error('[ConversationalSeller] Error parsing command:', error)
    throw new Error('Could not understand pipeline command')
  }
}

async function updateLeadStage(
  sellerId: string,
  identifier: string,
  newStage: PipelineStage,
  notes?: string
): Promise<Lead> {
  try {
    // Find lead by name or ID
    const result = await sql`
      UPDATE seller_leads
      SET
        stage = ${newStage},
        status = ${stageToStatus(newStage)},
        updated_at = NOW()
      WHERE seller_id = ${sellerId}
        AND (company_name ILIKE ${`%${identifier}%`} OR id = ${identifier})
      RETURNING *
    `

    if (result.rows.length === 0) {
      throw new Error(`Lead "${identifier}" not found`)
    }

    // Log activity
    await logLeadActivity(result.rows[0].id, 'status_change', `Moved to ${newStage}`, { notes })

    return mapLeadFromDb(result.rows[0])
  } catch (error) {
    console.error('[ConversationalSeller] Error updating lead:', error)
    throw error
  }
}

async function updateOpportunityStage(
  sellerId: string,
  identifier: string,
  newStage: PipelineStage
): Promise<Opportunity> {
  try {
    const result = await sql`
      UPDATE seller_opportunities
      SET
        stage = ${newStage},
        updated_at = NOW()
      WHERE seller_id = ${sellerId}
        AND (name ILIKE ${`%${identifier}%`} OR id = ${identifier})
      RETURNING *
    `

    if (result.rows.length === 0) {
      throw new Error(`Opportunity "${identifier}" not found`)
    }

    return mapOpportunityFromDb(result.rows[0])
  } catch (error) {
    console.error('[ConversationalSeller] Error updating opportunity:', error)
    throw error
  }
}

function stageToStatus(stage: PipelineStage): LeadStatus {
  const mapping: Record<PipelineStage, LeadStatus> = {
    discovery: 'new',
    qualification: 'qualified',
    proposal: 'proposal',
    negotiation: 'negotiation',
    closed_won: 'won',
    closed_lost: 'lost',
  }
  return mapping[stage]
}

// ============================================================================
// OPPORTUNITY TRACKING
// ============================================================================

/**
 * Track opportunities through conversation
 * "What deals are closing this month?"
 */
export async function trackOpportunities(
  sellerId: string,
  query: string
): Promise<{ opportunities: Opportunity[]; summary: string; insights: string[] }> {
  // Parse the query to understand timeframe and filters
  const filters = await parseOpportunityQuery(query)

  // Get matching opportunities
  const opportunities = await getOpportunities(sellerId, filters)

  // Generate summary and insights
  const summary = generateOpportunitySummary(opportunities, filters)
  const insights = generateOpportunityInsights(opportunities)

  return {
    opportunities,
    summary,
    insights,
  }
}

async function parseOpportunityQuery(query: string): Promise<{
  timeframe?: string
  stage?: PipelineStage
  minValue?: number
}> {
  const lowerQuery = query.toLowerCase()

  const filters: any = {}

  // Parse timeframe
  if (lowerQuery.includes('this month')) {
    filters.timeframe = 'this_month'
  } else if (lowerQuery.includes('this week')) {
    filters.timeframe = 'this_week'
  } else if (lowerQuery.includes('this quarter')) {
    filters.timeframe = 'this_quarter'
  } else if (lowerQuery.includes('next month')) {
    filters.timeframe = 'next_month'
  }

  // Parse stage
  if (lowerQuery.includes('closing') || lowerQuery.includes('close')) {
    filters.stage = 'negotiation'
  } else if (lowerQuery.includes('proposal')) {
    filters.stage = 'proposal'
  }

  return filters
}

async function getOpportunities(
  sellerId: string,
  filters: { timeframe?: string; stage?: PipelineStage; minValue?: number }
): Promise<Opportunity[]> {
  try {
    const conditions: string[] = ['seller_id = $1']
    const params: any[] = [sellerId]

    if (filters.stage) {
      conditions.push(`stage = $${params.length + 1}`)
      params.push(filters.stage)
    }

    if (filters.minValue) {
      conditions.push(`value >= $${params.length + 1}`)
      params.push(filters.minValue)
    }

    if (filters.timeframe) {
      const dateCondition = getDateCondition(filters.timeframe)
      if (dateCondition) {
        conditions.push(dateCondition)
      }
    }

    const result = await sql.query(
      `SELECT * FROM seller_opportunities
       WHERE ${conditions.join(' AND ')}
       ORDER BY expected_close_date ASC, value DESC`,
      params
    )

    return result.rows.map(mapOpportunityFromDb)
  } catch (error) {
    console.error('[ConversationalSeller] Error getting opportunities:', error)
    return []
  }
}

function getDateCondition(timeframe: string): string | null {
  switch (timeframe) {
    case 'this_week':
      return `expected_close_date <= NOW() + INTERVAL '7 days'`
    case 'this_month':
      return `expected_close_date <= DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day'`
    case 'next_month':
      return `expected_close_date BETWEEN DATE_TRUNC('month', NOW()) + INTERVAL '1 month' AND DATE_TRUNC('month', NOW()) + INTERVAL '2 months' - INTERVAL '1 day'`
    case 'this_quarter':
      return `expected_close_date <= DATE_TRUNC('quarter', NOW()) + INTERVAL '3 months' - INTERVAL '1 day'`
    default:
      return null
  }
}

function generateOpportunitySummary(
  opportunities: Opportunity[],
  filters: any
): string {
  if (opportunities.length === 0) {
    return `No opportunities found for ${filters.timeframe || 'the specified criteria'}.`
  }

  const totalValue = opportunities.reduce((sum, o) => sum + o.value, 0)
  const weightedValue = opportunities.reduce((sum, o) => sum + (o.value * o.probability / 100), 0)

  return `Found ${opportunities.length} opportunities totaling $${totalValue.toLocaleString()} (weighted: $${weightedValue.toLocaleString()}).`
}

function generateOpportunityInsights(opportunities: Opportunity[]): string[] {
  const insights: string[] = []

  const highProbability = opportunities.filter(o => o.probability >= 70)
  if (highProbability.length > 0) {
    insights.push(`${highProbability.length} deals with 70%+ probability to close`)
  }

  const atRisk = opportunities.filter(o =>
    o.expectedCloseDate && new Date(o.expectedCloseDate) < new Date()
  )
  if (atRisk.length > 0) {
    insights.push(`${atRisk.length} deals past expected close date - need attention`)
  }

  const bigDeals = opportunities.filter(o => o.value >= 50000)
  if (bigDeals.length > 0) {
    insights.push(`${bigDeals.length} deals over $50K in pipeline`)
  }

  return insights
}

// ============================================================================
// SALES INSIGHTS
// ============================================================================

/**
 * Get sales insights through conversation
 * "What's my win rate?"
 */
export async function getSalesInsights(
  sellerId: string,
  question?: string
): Promise<SalesInsights> {
  const [pipeline, performance, forecast] = await Promise.all([
    getPipelineMetrics(sellerId),
    getPerformanceMetrics(sellerId),
    getForecastMetrics(sellerId),
  ])

  const recommendations = generateRecommendations(pipeline, performance)

  return {
    pipeline,
    performance,
    forecasting: forecast,
    recommendations,
  }
}

async function getPipelineMetrics(sellerId: string): Promise<PipelineMetrics> {
  try {
    const result = await sql`
      SELECT
        stage,
        COUNT(*) as count,
        SUM(COALESCE(budget, 0)) as value
      FROM seller_leads
      WHERE seller_id = ${sellerId}
        AND status NOT IN ('lost', 'won')
      GROUP BY stage
    `

    const byStage: Record<PipelineStage, { count: number; value: number }> = {
      discovery: { count: 0, value: 0 },
      qualification: { count: 0, value: 0 },
      proposal: { count: 0, value: 0 },
      negotiation: { count: 0, value: 0 },
      closed_won: { count: 0, value: 0 },
      closed_lost: { count: 0, value: 0 },
    }

    let totalValue = 0
    let totalCount = 0

    for (const row of result.rows) {
      const stage = row.stage as PipelineStage
      if (byStage[stage]) {
        byStage[stage] = {
          count: parseInt(row.count),
          value: parseFloat(row.value) || 0,
        }
        totalValue += parseFloat(row.value) || 0
        totalCount += parseInt(row.count)
      }
    }

    return {
      totalValue,
      byStage,
      averageDealSize: totalCount > 0 ? totalValue / totalCount : 0,
      averageCycleTime: 30, // Would calculate from historical data
    }
  } catch (error) {
    console.error('[ConversationalSeller] Error getting pipeline metrics:', error)
    return {
      totalValue: 0,
      byStage: {} as any,
      averageDealSize: 0,
      averageCycleTime: 0,
    }
  }
}

async function getPerformanceMetrics(sellerId: string): Promise<PerformanceMetrics> {
  try {
    // Get win/loss data
    const result = await sql`
      SELECT
        status,
        COUNT(*) as count
      FROM seller_leads
      WHERE seller_id = ${sellerId}
        AND status IN ('won', 'lost')
        AND updated_at >= NOW() - INTERVAL '90 days'
      GROUP BY status
    `

    let won = 0
    let lost = 0

    for (const row of result.rows) {
      if (row.status === 'won') won = parseInt(row.count)
      if (row.status === 'lost') lost = parseInt(row.count)
    }

    const total = won + lost
    const winRate = total > 0 ? (won / total) * 100 : 0

    // Get quote conversion
    const quoteResult = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
        COUNT(*) as total
      FROM seller_quotes
      WHERE seller_id = ${sellerId}
        AND created_at >= NOW() - INTERVAL '90 days'
    `

    const quotesTotal = parseInt(quoteResult.rows[0]?.total || 0)
    const quotesAccepted = parseInt(quoteResult.rows[0]?.accepted || 0)
    const quotesToClose = quotesTotal > 0 ? quotesTotal / Math.max(quotesAccepted, 1) : 0

    return {
      winRate: Math.round(winRate * 10) / 10,
      quotesToClose: Math.round(quotesToClose * 10) / 10,
      responseTime: 4.2, // Would calculate from activity logs
      activityScore: 75, // Would calculate from engagement
    }
  } catch (error) {
    console.error('[ConversationalSeller] Error getting performance metrics:', error)
    return {
      winRate: 0,
      quotesToClose: 0,
      responseTime: 0,
      activityScore: 0,
    }
  }
}

async function getForecastMetrics(sellerId: string): Promise<ForecastMetrics> {
  try {
    const result = await sql`
      SELECT
        value,
        probability,
        expected_close_date
      FROM seller_opportunities
      WHERE seller_id = ${sellerId}
        AND stage NOT IN ('closed_won', 'closed_lost')
    `

    const now = new Date()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0)
    const endOfQuarter = new Date(now.getFullYear(), Math.ceil((now.getMonth() + 1) / 3) * 3, 0)

    let thisMonth = 0
    let nextMonth = 0
    let thisQuarter = 0
    let weighted = 0

    for (const row of result.rows) {
      const value = parseFloat(row.value)
      const probability = parseFloat(row.probability) / 100
      const closeDate = new Date(row.expected_close_date)

      weighted += value * probability

      if (closeDate <= endOfMonth) {
        thisMonth += value
      } else if (closeDate <= endOfNextMonth) {
        nextMonth += value
      }

      if (closeDate <= endOfQuarter) {
        thisQuarter += value
      }
    }

    return {
      thisMonth,
      nextMonth,
      thisQuarter,
      weighted,
    }
  } catch (error) {
    console.error('[ConversationalSeller] Error getting forecast metrics:', error)
    return {
      thisMonth: 0,
      nextMonth: 0,
      thisQuarter: 0,
      weighted: 0,
    }
  }
}

function generateRecommendations(
  pipeline: PipelineMetrics,
  performance: PerformanceMetrics
): string[] {
  const recommendations: string[] = []

  if (performance.winRate < 20) {
    recommendations.push('Win rate is below benchmark. Consider improving qualification criteria.')
  }

  if (pipeline.byStage?.qualification?.count > pipeline.byStage?.proposal?.count * 3) {
    recommendations.push('Pipeline is heavy in qualification. Focus on moving deals to proposal.')
  }

  if (performance.responseTime > 24) {
    recommendations.push('Response time is slow. Faster follow-up typically improves conversion.')
  }

  if (recommendations.length === 0) {
    recommendations.push('Pipeline health looks good. Keep up the momentum!')
  }

  return recommendations
}

// ============================================================================
// RFQ MATCHING
// ============================================================================

/**
 * Match incoming RFQs to seller catalog
 * "Show me incoming RFQs matching my catalog"
 */
export async function matchRFQs(
  sellerId: string,
  filters?: { category?: string; minBudget?: number; urgency?: string }
): Promise<{ matches: RFQMatch[]; summary: string; recommendations: string[] }> {
  // Get seller's product catalog
  const catalog = await getSellerCatalog(sellerId)

  // Find matching RFQs
  const matches = await findMatchingRFQs(sellerId, catalog, filters)

  // Generate summary
  const summary = `Found ${matches.length} RFQs matching your catalog.`

  // Generate recommendations
  const recommendations: string[] = []
  if (matches.length > 0) {
    const urgent = matches.filter(m => m.urgency === 'critical' || m.urgency === 'urgent')
    if (urgent.length > 0) {
      recommendations.push(`${urgent.length} urgent RFQs need quick response`)
    }

    const highValue = matches.filter(m => m.budget && m.budget >= 10000)
    if (highValue.length > 0) {
      recommendations.push(`${highValue.length} high-value opportunities ($10K+)`)
    }
  }

  return {
    matches,
    summary,
    recommendations,
  }
}

async function getSellerCatalog(sellerId: string): Promise<string[]> {
  try {
    const result = await sql`
      SELECT products FROM seller_profiles WHERE id = ${sellerId}
    `
    return result.rows[0]?.products || []
  } catch (error) {
    console.error('[ConversationalSeller] Error getting catalog:', error)
    return []
  }
}

async function findMatchingRFQs(
  sellerId: string,
  catalog: string[],
  filters?: { category?: string; minBudget?: number; urgency?: string }
): Promise<RFQMatch[]> {
  try {
    const conditions: string[] = ['status = $1']
    const params: any[] = ['open']

    if (catalog.length > 0) {
      conditions.push(`category = ANY($${params.length + 1})`)
      params.push(catalog)
    }

    if (filters?.category) {
      conditions.push(`category ILIKE $${params.length + 1}`)
      params.push(`%${filters.category}%`)
    }

    if (filters?.minBudget) {
      conditions.push(`budget >= $${params.length + 1}`)
      params.push(filters.minBudget)
    }

    if (filters?.urgency) {
      conditions.push(`urgency = $${params.length + 1}`)
      params.push(filters.urgency)
    }

    const result = await sql.query(
      `SELECT * FROM rfqs
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT 20`,
      params
    )

    return result.rows.map(row => ({
      rfqId: row.id,
      buyerName: row.buyer_name || 'Anonymous',
      category: row.category,
      description: row.description,
      quantity: row.quantity,
      budget: row.budget ? parseFloat(row.budget) : undefined,
      urgency: row.urgency,
      matchScore: calculateMatchScore(row, catalog),
      matchReason: `Matches your ${row.category} catalog`,
      receivedAt: new Date(row.created_at),
    }))
  } catch (error) {
    console.error('[ConversationalSeller] Error finding RFQs:', error)
    return []
  }
}

function calculateMatchScore(rfq: any, catalog: string[]): number {
  let score = 50 // Base score

  // Category match
  if (catalog.includes(rfq.category)) score += 30

  // Budget presence
  if (rfq.budget) score += 10

  // Urgency bonus (urgent buyers are more likely to convert)
  if (rfq.urgency === 'critical') score += 10
  if (rfq.urgency === 'urgent') score += 5

  return Math.min(100, score)
}

// ============================================================================
// QUOTE GENERATION
// ============================================================================

/**
 * Generate quote through conversation
 * "Create a quote for their request"
 */
export async function generateQuote(
  sellerId: string,
  rfqId: string,
  customizations?: { discount?: number; notes?: string; validDays?: number }
): Promise<{ quote: Quote; preview: string; suggestions: string[] }> {
  // Get RFQ details
  const rfq = await getRFQ(rfqId)
  if (!rfq) {
    throw new Error('RFQ not found')
  }

  // Get seller pricing
  const pricing = await getSellerPricing(sellerId, rfq.category)

  // Calculate quote
  const quote = await calculateQuote(sellerId, rfq, pricing, customizations)

  // Generate preview text
  const preview = formatQuotePreview(quote)

  // Suggestions for the quote
  const suggestions: string[] = []
  if (!customizations?.discount && quote.subtotal > 10000) {
    suggestions.push('Consider adding a volume discount for this order size')
  }
  if (rfq.urgency === 'urgent' || rfq.urgency === 'critical') {
    suggestions.push('Rush pricing may apply - verify availability')
  }

  return {
    quote,
    preview,
    suggestions,
  }
}

async function getRFQ(rfqId: string): Promise<any | null> {
  try {
    const result = await sql`SELECT * FROM rfqs WHERE id = ${rfqId}`
    return result.rows[0] || null
  } catch (error) {
    console.error('[ConversationalSeller] Error getting RFQ:', error)
    return null
  }
}

async function getSellerPricing(sellerId: string, category: string): Promise<any> {
  try {
    const result = await sql`
      SELECT pricing FROM seller_profiles WHERE id = ${sellerId}
    `
    return result.rows[0]?.pricing || { basePrice: 100, currency: 'USD' }
  } catch (error) {
    console.error('[ConversationalSeller] Error getting pricing:', error)
    return { basePrice: 100, currency: 'USD' }
  }
}

async function calculateQuote(
  sellerId: string,
  rfq: any,
  pricing: any,
  customizations?: { discount?: number; notes?: string; validDays?: number }
): Promise<Quote> {
  const quantity = rfq.quantity || 1
  const unitPrice = pricing.basePrice || 100
  const subtotal = quantity * unitPrice
  const discount = customizations?.discount ? (subtotal * customizations.discount / 100) : 0
  const tax = (subtotal - discount) * 0.08 // Assume 8% tax
  const total = subtotal - discount + tax

  const validDays = customizations?.validDays || 30
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + validDays)

  return {
    id: `quote_${Date.now()}`,
    leadId: rfq.buyer_id || '',
    rfqId: rfq.id,
    items: [
      {
        name: rfq.description || rfq.category,
        description: rfq.specifications,
        quantity,
        unitPrice,
        total: subtotal,
      },
    ],
    subtotal,
    discount,
    tax,
    total,
    validUntil,
    status: 'draft',
    terms: pricing.paymentTerms || 'NET30',
    notes: customizations?.notes,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function formatQuotePreview(quote: Quote): string {
  return `
Quote #${quote.id}
-----------------
${quote.items.map(item => `${item.name}: ${item.quantity} x $${item.unitPrice.toFixed(2)} = $${item.total.toFixed(2)}`).join('\n')}

Subtotal: $${quote.subtotal.toFixed(2)}
${quote.discount ? `Discount: -$${quote.discount.toFixed(2)}` : ''}
Tax: $${(quote.tax || 0).toFixed(2)}
Total: $${quote.total.toFixed(2)}

Valid until: ${quote.validUntil.toLocaleDateString()}
Terms: ${quote.terms}
  `.trim()
}

// ============================================================================
// CAMPAIGN MANAGEMENT
// ============================================================================

/**
 * Launch campaign through conversation
 * "Launch a campaign targeting manufacturers"
 */
export async function launchCampaign(
  sellerId: string,
  description: string
): Promise<{ campaign: Campaign; targetCount: number; preview: string }> {
  // Parse campaign description
  const criteria = await parseCampaignDescription(description)

  // Count potential targets
  const targetCount = await countTargets(criteria)

  // Generate campaign
  const campaign = await createCampaign(sellerId, criteria, description)

  // Preview first message
  const preview = campaign.messageTemplate

  return {
    campaign,
    targetCount,
    preview,
  }
}

async function parseCampaignDescription(description: string): Promise<TargetCriteria> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Parse this campaign description into targeting criteria.

Description: "${description}"

Return JSON:
{
  "industries": ["array"],
  "companySizes": ["startup", "smb", "mid-market", "enterprise"],
  "locations": ["array"],
  "titles": ["decision maker titles"],
  "keywords": ["product/service keywords"]
}`,
        },
      ],
    })

    const textBlock = response.content.find(block => block.type === 'text')
    const text = textBlock?.type === 'text' ? textBlock.text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    return JSON.parse(jsonMatch?.[0] || '{}')
  } catch (error) {
    console.error('[ConversationalSeller] Error parsing campaign:', error)
    return {}
  }
}

async function countTargets(criteria: TargetCriteria): Promise<number> {
  // Simulated - would query actual lead database
  return Math.floor(Math.random() * 500) + 100
}

async function createCampaign(
  sellerId: string,
  criteria: TargetCriteria,
  description: string
): Promise<Campaign> {
  const template = await generateCampaignTemplate(criteria, description)

  const campaign: Campaign = {
    id: `campaign_${Date.now()}`,
    name: `Campaign: ${criteria.industries?.[0] || 'General'} outreach`,
    type: 'email',
    targetCriteria: criteria,
    status: 'draft',
    messageTemplate: template,
    followUpSequence: [
      { day: 3, type: 'email', template: 'Following up on my previous message...' },
      { day: 7, type: 'linkedin', template: 'Quick LinkedIn follow-up' },
    ],
    stats: {
      sent: 0,
      opened: 0,
      replied: 0,
      meetings: 0,
      conversions: 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  return campaign
}

async function generateCampaignTemplate(
  criteria: TargetCriteria,
  description: string
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: `Generate a cold outreach email template for this campaign.

Target: ${JSON.stringify(criteria)}
Campaign goal: ${description}

Write a professional, personable cold email under 150 words. Use {{firstName}} and {{companyName}} as placeholders. No fluff.`,
        },
      ],
    })

    const textBlock = response.content.find(block => block.type === 'text')
    return textBlock?.type === 'text' ? textBlock.text : 'Unable to generate template'
  } catch (error) {
    console.error('[ConversationalSeller] Error generating template:', error)
    return 'Hi {{firstName}},\n\nI noticed {{companyName}} is in the manufacturing space...'
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getLead(leadId: string): Promise<Lead | null> {
  try {
    const result = await sql`SELECT * FROM seller_leads WHERE id = ${leadId}`
    return result.rows[0] ? mapLeadFromDb(result.rows[0]) : null
  } catch (error) {
    console.error('[ConversationalSeller] Error getting lead:', error)
    return null
  }
}

async function getSellerLeads(
  sellerId: string,
  filters?: { status?: string }
): Promise<Lead[]> {
  try {
    const conditions: string[] = ['seller_id = $1']
    const params: any[] = [sellerId]

    if (filters?.status) {
      const statuses = filters.status.split(',')
      conditions.push(`status = ANY($${params.length + 1})`)
      params.push(statuses)
    }

    const result = await sql.query(
      `SELECT * FROM seller_leads
       WHERE ${conditions.join(' AND ')}
       ORDER BY score DESC, updated_at DESC`,
      params
    )

    return result.rows.map(mapLeadFromDb)
  } catch (error) {
    console.error('[ConversationalSeller] Error getting seller leads:', error)
    return []
  }
}

async function getSellerProfile(sellerId: string): Promise<any> {
  try {
    const result = await sql`SELECT * FROM seller_profiles WHERE id = ${sellerId}`
    return result.rows[0] || null
  } catch (error) {
    console.error('[ConversationalSeller] Error getting seller profile:', error)
    return null
  }
}

async function logLeadActivity(
  leadId: string,
  type: string,
  description: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await sql`
      INSERT INTO seller_lead_activities (lead_id, type, description, metadata)
      VALUES (${leadId}, ${type}, ${description}, ${JSON.stringify(metadata || {})})
    `
  } catch (error) {
    console.error('[ConversationalSeller] Error logging activity:', error)
  }
}

function mapLeadFromDb(row: any): Lead {
  return {
    id: row.id,
    companyName: row.company_name,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    industry: row.industry,
    companySize: row.company_size,
    location: row.location,
    source: row.source,
    score: row.score || 50,
    status: row.status,
    stage: row.stage,
    tags: row.tags || [],
    requirements: row.requirements,
    budget: row.budget ? parseFloat(row.budget) : undefined,
    timeline: row.timeline,
    lastContactAt: row.last_contact_at,
    nextFollowUp: row.next_follow_up,
    notes: [],
    activities: [],
    assignedTo: row.assigned_to,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapOpportunityFromDb(row: any): Opportunity {
  return {
    id: row.id,
    leadId: row.lead_id,
    name: row.name,
    value: parseFloat(row.value),
    probability: row.probability,
    stage: row.stage,
    expectedCloseDate: row.expected_close_date,
    products: row.products || [],
    competitors: row.competitors,
    decisionMakers: row.decision_makers || [],
    nextSteps: row.next_steps,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ConversationalSeller = {
  // Discovery
  discoverLeads,
  getLeadRecommendations,

  // Outreach
  generateOutreach,
  launchCampaign,

  // Pipeline
  updatePipeline,
  trackOpportunities,

  // RFQ & Quotes
  matchRFQs,
  generateQuote,

  // Insights
  getSalesInsights,
}

export default ConversationalSeller
