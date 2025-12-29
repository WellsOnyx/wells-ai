// @ts-nocheck
/**
 * Conversational Insights Engine
 *
 * Business intelligence through natural language.
 * No dashboards needed - just ask Wells.
 *
 * "How's my pipeline looking?" -> Instant, contextual answer
 * "What should I focus on today?" -> AI-powered recommendations
 * "Alert me if any deal over $10k stalls" -> Custom alert setup
 */

import { sql } from '@vercel/postgres'
import { query } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

export type InsightCategory =
  | 'pipeline'
  | 'revenue'
  | 'conversion'
  | 'leads'
  | 'deals'
  | 'performance'
  | 'trends'
  | 'alerts'
  | 'digest'
  | 'recommendations'
  | 'comparison'
  | 'export'

export type TimeRange = 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom'

export type AlertCondition =
  | 'deal_stalled'
  | 'deal_over_threshold'
  | 'conversion_drop'
  | 'lead_spike'
  | 'revenue_milestone'
  | 'inactive_lead'
  | 'custom'

export interface InsightQuery {
  userId: string
  query: string
  category?: InsightCategory
  timeRange?: TimeRange
  customDateRange?: { start: Date; end: Date }
  entities?: string[]
  compareWith?: TimeRange
  format?: 'conversational' | 'detailed' | 'summary' | 'export'
}

export interface InsightResponse {
  message: string
  data?: Record<string, any>
  visualizations?: Visualization[]
  followUpQuestions?: string[]
  actions?: InsightAction[]
  alerts?: AlertSuggestion[]
  confidence: number
}

export interface Visualization {
  type: 'metric' | 'trend' | 'comparison' | 'breakdown' | 'table'
  title: string
  data: any
  format?: string
}

export interface InsightAction {
  id: string
  label: string
  action: string
  params?: Record<string, any>
  priority: 'high' | 'medium' | 'low'
}

export interface AlertSuggestion {
  condition: AlertCondition
  description: string
  threshold?: number
  entity?: string
}

export interface CustomAlert {
  id: string
  userId: string
  name: string
  condition: AlertCondition
  threshold?: number
  entity?: string
  customQuery?: string
  channels: ('chat' | 'email' | 'slack' | 'sms')[]
  frequency: 'realtime' | 'hourly' | 'daily' | 'weekly'
  enabled: boolean
  lastTriggered?: Date
  createdAt: Date
  metadata?: Record<string, any>
}

export interface DigestConfig {
  userId: string
  type: 'morning' | 'evening' | 'weekly' | 'custom'
  sections: DigestSection[]
  schedule?: string
  enabled: boolean
}

export type DigestSection =
  | 'pipeline_summary'
  | 'urgent_items'
  | 'wins'
  | 'at_risk'
  | 'recommendations'
  | 'metrics_snapshot'
  | 'upcoming_tasks'
  | 'trend_highlights'

// ============================================================================
// CORE METRICS ENGINE
// ============================================================================

/**
 * Get comprehensive pipeline metrics
 */
export async function getPipelineMetrics(
  userId: string,
  timeRange: TimeRange = 'month'
): Promise<{
  totalDeals: number
  totalValue: number
  byStage: Record<string, { count: number; value: number }>
  avgDealSize: number
  avgTimeInPipeline: number
  velocity: number
  healthScore: number
}> {
  const dateFilter = getDateFilter(timeRange)

  try {
    // Get deals by stage
    const stageResult = await sql`
      SELECT
        status,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_value,
        AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400) as avg_days
      FROM deals_v2
      WHERE (buyer_id = ${userId} OR seller_id = ${userId})
        AND created_at >= ${dateFilter}
      GROUP BY status
    `

    const byStage: Record<string, { count: number; value: number }> = {}
    let totalDeals = 0
    let totalValue = 0
    let totalDays = 0

    stageResult.rows.forEach(row => {
      byStage[row.status] = {
        count: parseInt(row.count),
        value: parseFloat(row.total_value) || 0
      }
      totalDeals += parseInt(row.count)
      totalValue += parseFloat(row.total_value) || 0
      totalDays += (parseFloat(row.avg_days) || 0) * parseInt(row.count)
    })

    // Calculate velocity (deals closed per week)
    const closedResult = await sql`
      SELECT COUNT(*) as closed_count
      FROM deals_v2
      WHERE (buyer_id = ${userId} OR seller_id = ${userId})
        AND status = 'released'
        AND updated_at >= NOW() - INTERVAL '30 days'
    `
    const closedCount = parseInt(closedResult.rows[0]?.closed_count || '0')
    const velocity = closedCount / 4 // Per week over last month

    // Calculate health score (0-100)
    const healthScore = calculatePipelineHealth(byStage, velocity)

    return {
      totalDeals,
      totalValue,
      byStage,
      avgDealSize: totalDeals > 0 ? totalValue / totalDeals : 0,
      avgTimeInPipeline: totalDeals > 0 ? totalDays / totalDeals : 0,
      velocity,
      healthScore
    }
  } catch (error) {
    console.error('Error getting pipeline metrics:', error)
    return {
      totalDeals: 0,
      totalValue: 0,
      byStage: {},
      avgDealSize: 0,
      avgTimeInPipeline: 0,
      velocity: 0,
      healthScore: 50
    }
  }
}

/**
 * Get revenue metrics
 */
export async function getRevenueMetrics(
  userId: string,
  timeRange: TimeRange = 'month'
): Promise<{
  totalRevenue: number
  closedDeals: number
  avgDealValue: number
  revenueByPeriod: Array<{ period: string; revenue: number; deals: number }>
  projectedRevenue: number
  growthRate: number
}> {
  const dateFilter = getDateFilter(timeRange)

  try {
    // Get closed deals with revenue
    const revenueResult = await sql`
      SELECT
        COUNT(*) as deal_count,
        COALESCE(SUM(amount), 0) as total_revenue,
        DATE_TRUNC('week', updated_at) as period
      FROM deals_v2
      WHERE (buyer_id = ${userId} OR seller_id = ${userId})
        AND status = 'released'
        AND updated_at >= ${dateFilter}
      GROUP BY DATE_TRUNC('week', updated_at)
      ORDER BY period DESC
    `

    let totalRevenue = 0
    let closedDeals = 0
    const revenueByPeriod: Array<{ period: string; revenue: number; deals: number }> = []

    revenueResult.rows.forEach(row => {
      totalRevenue += parseFloat(row.total_revenue)
      closedDeals += parseInt(row.deal_count)
      revenueByPeriod.push({
        period: new Date(row.period).toISOString().split('T')[0],
        revenue: parseFloat(row.total_revenue),
        deals: parseInt(row.deal_count)
      })
    })

    // Get previous period for growth calculation
    const previousDateFilter = getDateFilter(timeRange, true)
    const previousResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_revenue
      FROM deals_v2
      WHERE (buyer_id = ${userId} OR seller_id = ${userId})
        AND status = 'released'
        AND updated_at >= ${previousDateFilter}
        AND updated_at < ${dateFilter}
    `
    const previousRevenue = parseFloat(previousResult.rows[0]?.total_revenue || '0')
    const growthRate = previousRevenue > 0
      ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
      : 0

    // Calculate projected revenue based on pipeline
    const pipelineResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as pipeline_value
      FROM deals_v2
      WHERE (buyer_id = ${userId} OR seller_id = ${userId})
        AND status IN ('agreed', 'escrowed', 'in_progress', 'delivered')
    `
    const pipelineValue = parseFloat(pipelineResult.rows[0]?.pipeline_value || '0')
    const projectedRevenue = totalRevenue + (pipelineValue * 0.7) // 70% weighted pipeline

    return {
      totalRevenue,
      closedDeals,
      avgDealValue: closedDeals > 0 ? totalRevenue / closedDeals : 0,
      revenueByPeriod,
      projectedRevenue,
      growthRate
    }
  } catch (error) {
    console.error('Error getting revenue metrics:', error)
    return {
      totalRevenue: 0,
      closedDeals: 0,
      avgDealValue: 0,
      revenueByPeriod: [],
      projectedRevenue: 0,
      growthRate: 0
    }
  }
}

/**
 * Get conversion metrics
 */
export async function getConversionMetrics(
  userId: string,
  timeRange: TimeRange = 'month'
): Promise<{
  leadToOpportunity: number
  opportunityToWin: number
  overallConversion: number
  conversionBySource: Record<string, number>
  conversionByJourney: Record<string, number>
  funnel: Array<{ stage: string; count: number; conversionRate: number }>
}> {
  const dateFilter = getDateFilter(timeRange)

  try {
    // Get leads count
    const leadsResult = await sql`
      SELECT COUNT(*) as total
      FROM leads
      WHERE user_id = ${userId}
        AND created_at >= ${dateFilter}
    `
    const totalLeads = parseInt(leadsResult.rows[0]?.total || '0')

    // Get leads by status
    const leadsStatusResult = await sql`
      SELECT status, COUNT(*) as count
      FROM leads
      WHERE user_id = ${userId}
        AND created_at >= ${dateFilter}
      GROUP BY status
    `

    let inProgress = 0
    let won = 0
    leadsStatusResult.rows.forEach(row => {
      if (row.status === 'in_progress' || row.status === 'contacted') {
        inProgress += parseInt(row.count)
      }
      if (row.status === 'won') {
        won += parseInt(row.count)
      }
    })

    // Get conversion by source
    const sourceResult = await sql`
      SELECT
        source,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'won') as won
      FROM leads
      WHERE user_id = ${userId}
        AND created_at >= ${dateFilter}
      GROUP BY source
    `

    const conversionBySource: Record<string, number> = {}
    sourceResult.rows.forEach(row => {
      const total = parseInt(row.total)
      const wonCount = parseInt(row.won)
      conversionBySource[row.source || 'direct'] = total > 0 ? (wonCount / total) * 100 : 0
    })

    // Get conversion by journey
    const journeyResult = await sql`
      SELECT
        journey,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'won') as won
      FROM leads
      WHERE user_id = ${userId}
        AND created_at >= ${dateFilter}
      GROUP BY journey
    `

    const conversionByJourney: Record<string, number> = {}
    journeyResult.rows.forEach(row => {
      const total = parseInt(row.total)
      const wonCount = parseInt(row.won)
      conversionByJourney[row.journey] = total > 0 ? (wonCount / total) * 100 : 0
    })

    // Build funnel
    const funnel = [
      {
        stage: 'Leads',
        count: totalLeads,
        conversionRate: 100
      },
      {
        stage: 'Qualified',
        count: inProgress + won,
        conversionRate: totalLeads > 0 ? ((inProgress + won) / totalLeads) * 100 : 0
      },
      {
        stage: 'Won',
        count: won,
        conversionRate: totalLeads > 0 ? (won / totalLeads) * 100 : 0
      }
    ]

    return {
      leadToOpportunity: totalLeads > 0 ? ((inProgress + won) / totalLeads) * 100 : 0,
      opportunityToWin: (inProgress + won) > 0 ? (won / (inProgress + won)) * 100 : 0,
      overallConversion: totalLeads > 0 ? (won / totalLeads) * 100 : 0,
      conversionBySource,
      conversionByJourney,
      funnel
    }
  } catch (error) {
    console.error('Error getting conversion metrics:', error)
    return {
      leadToOpportunity: 0,
      opportunityToWin: 0,
      overallConversion: 0,
      conversionBySource: {},
      conversionByJourney: {},
      funnel: []
    }
  }
}

/**
 * Get lead metrics
 */
export async function getLeadMetrics(
  userId: string,
  timeRange: TimeRange = 'month'
): Promise<{
  totalLeads: number
  newLeads: number
  activeLeads: number
  byStatus: Record<string, number>
  byJourney: Record<string, number>
  byPriority: Record<string, number>
  avgResponseTime: number
  hotLeads: Array<{ id: string; name: string; company?: string; requirements: string; priority: string; createdAt: Date }>
}> {
  const dateFilter = getDateFilter(timeRange)

  try {
    // Get leads by status
    const statusResult = await sql`
      SELECT
        status,
        COUNT(*) as count
      FROM leads
      WHERE user_id = ${userId}
        AND created_at >= ${dateFilter}
      GROUP BY status
    `

    const byStatus: Record<string, number> = {}
    let totalLeads = 0
    let activeLeads = 0

    statusResult.rows.forEach(row => {
      byStatus[row.status] = parseInt(row.count)
      totalLeads += parseInt(row.count)
      if (row.status === 'new' || row.status === 'contacted' || row.status === 'in_progress') {
        activeLeads += parseInt(row.count)
      }
    })

    // Get new leads (last 7 days)
    const newLeadsResult = await sql`
      SELECT COUNT(*) as count
      FROM leads
      WHERE user_id = ${userId}
        AND created_at >= NOW() - INTERVAL '7 days'
    `
    const newLeads = parseInt(newLeadsResult.rows[0]?.count || '0')

    // Get by journey
    const journeyResult = await sql`
      SELECT journey, COUNT(*) as count
      FROM leads
      WHERE user_id = ${userId}
        AND created_at >= ${dateFilter}
      GROUP BY journey
    `
    const byJourney: Record<string, number> = {}
    journeyResult.rows.forEach(row => {
      byJourney[row.journey] = parseInt(row.count)
    })

    // Get by priority
    const priorityResult = await sql`
      SELECT priority, COUNT(*) as count
      FROM leads
      WHERE user_id = ${userId}
        AND created_at >= ${dateFilter}
      GROUP BY priority
    `
    const byPriority: Record<string, number> = {}
    priorityResult.rows.forEach(row => {
      byPriority[row.priority || 'medium'] = parseInt(row.count)
    })

    // Get hot leads (high priority, recent)
    const hotLeadsResult = await sql`
      SELECT id, user_name, user_company, requirements, priority, created_at
      FROM leads
      WHERE user_id = ${userId}
        AND status IN ('new', 'contacted')
        AND (priority = 'high' OR priority = 'urgent')
      ORDER BY
        CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
        created_at DESC
      LIMIT 5
    `

    const hotLeads = hotLeadsResult.rows.map(row => ({
      id: row.id,
      name: row.user_name,
      company: row.user_company,
      requirements: row.requirements,
      priority: row.priority,
      createdAt: new Date(row.created_at)
    }))

    // Calculate avg response time
    const responseTimeResult = await sql`
      SELECT AVG(EXTRACT(EPOCH FROM (contacted_at - created_at)) / 3600) as avg_hours
      FROM leads
      WHERE user_id = ${userId}
        AND contacted_at IS NOT NULL
        AND created_at >= ${dateFilter}
    `
    const avgResponseTime = parseFloat(responseTimeResult.rows[0]?.avg_hours || '0')

    return {
      totalLeads,
      newLeads,
      activeLeads,
      byStatus,
      byJourney,
      byPriority,
      avgResponseTime,
      hotLeads
    }
  } catch (error) {
    console.error('Error getting lead metrics:', error)
    return {
      totalLeads: 0,
      newLeads: 0,
      activeLeads: 0,
      byStatus: {},
      byJourney: {},
      byPriority: {},
      avgResponseTime: 0,
      hotLeads: []
    }
  }
}

// ============================================================================
// TREND ANALYSIS
// ============================================================================

/**
 * Analyze trends over time
 */
export async function analyzeTrends(
  userId: string,
  metric: 'revenue' | 'deals' | 'leads' | 'conversion',
  timeRange: TimeRange = 'quarter'
): Promise<{
  trend: 'up' | 'down' | 'stable'
  percentChange: number
  dataPoints: Array<{ date: string; value: number }>
  forecast: Array<{ date: string; value: number; confidence: number }>
  insights: string[]
}> {
  const dateFilter = getDateFilter(timeRange)

  try {
    let dataPoints: Array<{ date: string; value: number }> = []

    if (metric === 'revenue' || metric === 'deals') {
      const result = await sql`
        SELECT
          DATE_TRUNC('week', updated_at) as period,
          ${metric === 'revenue' ? sql`COALESCE(SUM(amount), 0)` : sql`COUNT(*)`} as value
        FROM deals_v2
        WHERE (buyer_id = ${userId} OR seller_id = ${userId})
          AND status = 'released'
          AND updated_at >= ${dateFilter}
        GROUP BY DATE_TRUNC('week', updated_at)
        ORDER BY period ASC
      `

      dataPoints = result.rows.map(row => ({
        date: new Date(row.period).toISOString().split('T')[0],
        value: parseFloat(row.value)
      }))
    } else if (metric === 'leads') {
      const result = await sql`
        SELECT
          DATE_TRUNC('week', created_at) as period,
          COUNT(*) as value
        FROM leads
        WHERE user_id = ${userId}
          AND created_at >= ${dateFilter}
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY period ASC
      `

      dataPoints = result.rows.map(row => ({
        date: new Date(row.period).toISOString().split('T')[0],
        value: parseInt(row.value)
      }))
    }

    // Calculate trend
    const { trend, percentChange } = calculateTrend(dataPoints)

    // Generate simple forecast (linear extrapolation)
    const forecast = generateForecast(dataPoints)

    // Generate insights
    const insights = generateTrendInsights(metric, trend, percentChange, dataPoints)

    return {
      trend,
      percentChange,
      dataPoints,
      forecast,
      insights
    }
  } catch (error) {
    console.error('Error analyzing trends:', error)
    return {
      trend: 'stable',
      percentChange: 0,
      dataPoints: [],
      forecast: [],
      insights: []
    }
  }
}

/**
 * Compare two time periods
 */
export async function comparePerformance(
  userId: string,
  currentPeriod: TimeRange,
  previousPeriod: TimeRange
): Promise<{
  current: { revenue: number; deals: number; leads: number; conversion: number }
  previous: { revenue: number; deals: number; leads: number; conversion: number }
  changes: { revenue: number; deals: number; leads: number; conversion: number }
  highlights: string[]
}> {
  const [currentRevenue, previousRevenue] = await Promise.all([
    getRevenueMetrics(userId, currentPeriod),
    getRevenueMetrics(userId, previousPeriod)
  ])

  const [currentLeads, previousLeads] = await Promise.all([
    getLeadMetrics(userId, currentPeriod),
    getLeadMetrics(userId, previousPeriod)
  ])

  const [currentConversion, previousConversion] = await Promise.all([
    getConversionMetrics(userId, currentPeriod),
    getConversionMetrics(userId, previousPeriod)
  ])

  const current = {
    revenue: currentRevenue.totalRevenue,
    deals: currentRevenue.closedDeals,
    leads: currentLeads.totalLeads,
    conversion: currentConversion.overallConversion
  }

  const previous = {
    revenue: previousRevenue.totalRevenue,
    deals: previousRevenue.closedDeals,
    leads: previousLeads.totalLeads,
    conversion: previousConversion.overallConversion
  }

  const changes = {
    revenue: previous.revenue > 0 ? ((current.revenue - previous.revenue) / previous.revenue) * 100 : 0,
    deals: previous.deals > 0 ? ((current.deals - previous.deals) / previous.deals) * 100 : 0,
    leads: previous.leads > 0 ? ((current.leads - previous.leads) / previous.leads) * 100 : 0,
    conversion: previous.conversion > 0 ? ((current.conversion - previous.conversion) / previous.conversion) * 100 : 0
  }

  // Generate highlights
  const highlights: string[] = []

  if (changes.revenue > 10) {
    highlights.push(`Revenue is up ${changes.revenue.toFixed(1)}% - great momentum!`)
  } else if (changes.revenue < -10) {
    highlights.push(`Revenue is down ${Math.abs(changes.revenue).toFixed(1)}% - may need attention`)
  }

  if (changes.leads > 20) {
    highlights.push(`Lead volume increased by ${changes.leads.toFixed(1)}%`)
  }

  if (changes.conversion > 5) {
    highlights.push(`Conversion rate improved by ${changes.conversion.toFixed(1)} points`)
  } else if (changes.conversion < -5) {
    highlights.push(`Conversion rate dropped ${Math.abs(changes.conversion).toFixed(1)} points - review your process`)
  }

  return { current, previous, changes, highlights }
}

// ============================================================================
// PROACTIVE INSIGHTS & ALERTS
// ============================================================================

/**
 * Get proactive alerts and urgent issues
 */
export async function getUrgentIssues(
  userId: string
): Promise<{
  issues: Array<{
    type: 'stalled_deal' | 'inactive_lead' | 'expiring_deal' | 'conversion_drop' | 'missed_followup'
    severity: 'critical' | 'warning' | 'info'
    title: string
    description: string
    actionRequired: string
    entityId?: string
    entityType?: string
  }>
  summary: string
}> {
  const issues: Array<any> = []

  try {
    // Check for stalled deals (no activity in 7+ days)
    const stalledDealsResult = await sql`
      SELECT id, description, amount, status, updated_at
      FROM deals_v2
      WHERE (buyer_id = ${userId} OR seller_id = ${userId})
        AND status IN ('negotiating', 'agreed', 'in_progress')
        AND updated_at < NOW() - INTERVAL '7 days'
      ORDER BY amount DESC
      LIMIT 5
    `

    stalledDealsResult.rows.forEach(row => {
      const daysSinceUpdate = Math.floor((Date.now() - new Date(row.updated_at).getTime()) / (1000 * 60 * 60 * 24))
      issues.push({
        type: 'stalled_deal',
        severity: parseFloat(row.amount) > 10000 ? 'critical' : 'warning',
        title: `Deal stalled: ${row.description?.substring(0, 50) || 'Untitled deal'}`,
        description: `This $${parseFloat(row.amount).toLocaleString()} deal hasn't had activity in ${daysSinceUpdate} days.`,
        actionRequired: 'Follow up with the other party or update the deal status.',
        entityId: row.id,
        entityType: 'deal'
      })
    })

    // Check for inactive leads (new leads not contacted in 48+ hours)
    const inactiveLeadsResult = await sql`
      SELECT id, user_name, user_company, priority, created_at
      FROM leads
      WHERE user_id = ${userId}
        AND status = 'new'
        AND contacted_at IS NULL
        AND created_at < NOW() - INTERVAL '48 hours'
      ORDER BY
        CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
        created_at ASC
      LIMIT 5
    `

    inactiveLeadsResult.rows.forEach(row => {
      const hoursSinceCreation = Math.floor((Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60))
      issues.push({
        type: 'inactive_lead',
        severity: row.priority === 'urgent' || row.priority === 'high' ? 'critical' : 'warning',
        title: `Lead needs contact: ${row.user_name}`,
        description: `${row.user_company ? row.user_company + ' - ' : ''}Waiting ${hoursSinceCreation} hours without contact.`,
        actionRequired: 'Reach out to this lead as soon as possible.',
        entityId: row.id,
        entityType: 'lead'
      })
    })

    // Check for high-value deals at risk
    const atRiskDealsResult = await sql`
      SELECT id, description, amount, status
      FROM deals_v2
      WHERE (buyer_id = ${userId} OR seller_id = ${userId})
        AND status = 'disputed'
        AND amount > 5000
      LIMIT 3
    `

    atRiskDealsResult.rows.forEach(row => {
      issues.push({
        type: 'expiring_deal',
        severity: 'critical',
        title: `Disputed deal: $${parseFloat(row.amount).toLocaleString()}`,
        description: `Deal "${row.description?.substring(0, 40) || 'Untitled'}" is in dispute and needs resolution.`,
        actionRequired: 'Review the dispute and work toward resolution.',
        entityId: row.id,
        entityType: 'deal'
      })
    })

    // Sort by severity
    issues.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })

    // Generate summary
    const criticalCount = issues.filter(i => i.severity === 'critical').length
    const warningCount = issues.filter(i => i.severity === 'warning').length

    let summary = ''
    if (issues.length === 0) {
      summary = "All clear! No urgent issues that need your attention right now."
    } else if (criticalCount > 0) {
      summary = `You have ${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} that need${criticalCount === 1 ? 's' : ''} immediate attention.`
    } else {
      summary = `You have ${warningCount} item${warningCount > 1 ? 's' : ''} to review when you have time.`
    }

    return { issues, summary }
  } catch (error) {
    console.error('Error getting urgent issues:', error)
    return {
      issues: [],
      summary: "I couldn't check for issues right now. Please try again later."
    }
  }
}

/**
 * Generate AI-powered recommendations
 */
export async function getRecommendations(
  userId: string
): Promise<{
  recommendations: Array<{
    title: string
    description: string
    impact: 'high' | 'medium' | 'low'
    effort: 'low' | 'medium' | 'high'
    category: 'growth' | 'efficiency' | 'risk' | 'opportunity'
    action: string
  }>
  focusArea: string
}> {
  try {
    // Gather context for AI recommendations
    const [pipeline, revenue, leads, urgent] = await Promise.all([
      getPipelineMetrics(userId, 'month'),
      getRevenueMetrics(userId, 'month'),
      getLeadMetrics(userId, 'month'),
      getUrgentIssues(userId)
    ])

    const recommendations: Array<any> = []

    // Generate data-driven recommendations

    // If conversion is low
    if (leads.totalLeads > 5) {
      const conversionRate = leads.byStatus['won']
        ? (leads.byStatus['won'] / leads.totalLeads) * 100
        : 0

      if (conversionRate < 20) {
        recommendations.push({
          title: 'Improve lead qualification',
          description: `Your conversion rate is ${conversionRate.toFixed(1)}%. Consider adding better qualification questions to your intake process.`,
          impact: 'high',
          effort: 'medium',
          category: 'efficiency',
          action: 'Review your lead qualification criteria and update your intake process.'
        })
      }
    }

    // If response time is slow
    if (leads.avgResponseTime > 24) {
      recommendations.push({
        title: 'Speed up lead response time',
        description: `Your average response time is ${leads.avgResponseTime.toFixed(1)} hours. Faster responses convert at higher rates.`,
        impact: 'high',
        effort: 'low',
        category: 'growth',
        action: 'Set up notifications and aim to respond within 4 hours.'
      })
    }

    // If there are hot leads
    if (leads.hotLeads.length > 0) {
      recommendations.push({
        title: 'Prioritize your hot leads',
        description: `You have ${leads.hotLeads.length} high-priority leads waiting for attention.`,
        impact: 'high',
        effort: 'low',
        category: 'opportunity',
        action: `Focus on ${leads.hotLeads[0].name} first - they seem ready to move forward.`
      })
    }

    // If pipeline is thin
    if (pipeline.totalDeals < 3) {
      recommendations.push({
        title: 'Build your pipeline',
        description: 'Your active pipeline is thin. Consider ramping up lead generation activities.',
        impact: 'high',
        effort: 'high',
        category: 'growth',
        action: 'Increase outreach efforts or explore new lead sources.'
      })
    }

    // If there are stalled deals
    if (urgent.issues.some(i => i.type === 'stalled_deal')) {
      const stalledCount = urgent.issues.filter(i => i.type === 'stalled_deal').length
      recommendations.push({
        title: 'Unstick your stalled deals',
        description: `${stalledCount} deal${stalledCount > 1 ? 's have' : ' has'} been inactive for over a week.`,
        impact: 'medium',
        effort: 'low',
        category: 'risk',
        action: 'Send a check-in message to re-engage the other party.'
      })
    }

    // If revenue is growing
    if (revenue.growthRate > 20) {
      recommendations.push({
        title: 'Capitalize on your momentum',
        description: `Revenue is up ${revenue.growthRate.toFixed(1)}% - now is a great time to scale.`,
        impact: 'high',
        effort: 'medium',
        category: 'opportunity',
        action: 'Consider increasing your capacity or raising prices.'
      })
    }

    // Determine focus area
    let focusArea = 'general business development'
    if (urgent.issues.filter(i => i.severity === 'critical').length > 0) {
      focusArea = 'addressing critical issues'
    } else if (leads.hotLeads.length > 2) {
      focusArea = 'converting your hot leads'
    } else if (pipeline.totalDeals < 3) {
      focusArea = 'building your pipeline'
    } else if (revenue.growthRate > 10) {
      focusArea = 'sustaining your growth momentum'
    }

    // Sort by impact
    recommendations.sort((a, b) => {
      const impactOrder = { high: 0, medium: 1, low: 2 }
      return impactOrder[a.impact] - impactOrder[b.impact]
    })

    return {
      recommendations: recommendations.slice(0, 5),
      focusArea
    }
  } catch (error) {
    console.error('Error generating recommendations:', error)
    return {
      recommendations: [{
        title: 'Start your day with a review',
        description: 'Check your leads and deals to see what needs attention.',
        impact: 'medium',
        effort: 'low',
        category: 'efficiency',
        action: 'Ask me "How\'s my pipeline looking?" to get started.'
      }],
      focusArea: 'getting organized'
    }
  }
}

// ============================================================================
// DIGEST GENERATION
// ============================================================================

/**
 * Generate a morning/daily briefing
 */
export async function generateDigest(
  userId: string,
  type: 'morning' | 'evening' | 'weekly' = 'morning'
): Promise<{
  greeting: string
  sections: Array<{
    title: string
    content: string
    data?: any
  }>
  callToAction: string
}> {
  try {
    const [pipeline, revenue, leads, urgent, recommendations] = await Promise.all([
      getPipelineMetrics(userId, type === 'weekly' ? 'week' : 'today'),
      getRevenueMetrics(userId, type === 'weekly' ? 'week' : 'month'),
      getLeadMetrics(userId, type === 'weekly' ? 'week' : 'today'),
      getUrgentIssues(userId),
      getRecommendations(userId)
    ])

    const now = new Date()
    const hour = now.getHours()
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' })

    // Generate greeting
    let greeting = ''
    if (type === 'morning') {
      if (hour < 12) {
        greeting = `Good morning! Here's your ${dayOfWeek} briefing.`
      } else {
        greeting = `Good afternoon! Here's what you need to know.`
      }
    } else if (type === 'evening') {
      greeting = `Wrapping up ${dayOfWeek}. Here's how today went.`
    } else {
      greeting = `Here's your weekly summary.`
    }

    const sections: Array<{ title: string; content: string; data?: any }> = []

    // Pipeline Summary
    sections.push({
      title: 'Pipeline Snapshot',
      content: `You have ${pipeline.totalDeals} active deal${pipeline.totalDeals !== 1 ? 's' : ''} worth $${pipeline.totalValue.toLocaleString()}. ` +
        `Pipeline health score: ${pipeline.healthScore}/100.`,
      data: {
        totalDeals: pipeline.totalDeals,
        totalValue: pipeline.totalValue,
        healthScore: pipeline.healthScore
      }
    })

    // Urgent Items
    if (urgent.issues.length > 0) {
      const criticalIssues = urgent.issues.filter(i => i.severity === 'critical')
      sections.push({
        title: 'Needs Attention',
        content: criticalIssues.length > 0
          ? `${criticalIssues.length} critical item${criticalIssues.length !== 1 ? 's' : ''}: ${criticalIssues[0].title}${criticalIssues.length > 1 ? ` and ${criticalIssues.length - 1} more` : ''}.`
          : `${urgent.issues.length} item${urgent.issues.length !== 1 ? 's' : ''} to review when you have time.`,
        data: { issues: urgent.issues.slice(0, 3) }
      })
    } else {
      sections.push({
        title: 'Status',
        content: 'All clear - no urgent issues requiring immediate attention.'
      })
    }

    // Hot Leads
    if (leads.hotLeads.length > 0) {
      sections.push({
        title: 'Hot Leads',
        content: `${leads.hotLeads.length} high-priority lead${leads.hotLeads.length !== 1 ? 's' : ''} waiting. ` +
          `Top priority: ${leads.hotLeads[0].name}${leads.hotLeads[0].company ? ` from ${leads.hotLeads[0].company}` : ''}.`,
        data: { hotLeads: leads.hotLeads }
      })
    }

    // Revenue (for weekly)
    if (type === 'weekly') {
      sections.push({
        title: 'Revenue Update',
        content: `This week: $${revenue.totalRevenue.toLocaleString()} from ${revenue.closedDeals} deal${revenue.closedDeals !== 1 ? 's' : ''}. ` +
          `${revenue.growthRate >= 0 ? '+' : ''}${revenue.growthRate.toFixed(1)}% vs last week.`,
        data: {
          revenue: revenue.totalRevenue,
          deals: revenue.closedDeals,
          growth: revenue.growthRate
        }
      })
    }

    // Top Recommendation
    if (recommendations.recommendations.length > 0) {
      const topRec = recommendations.recommendations[0]
      sections.push({
        title: 'Today\'s Focus',
        content: `${topRec.title}: ${topRec.description}`,
        data: { recommendation: topRec }
      })
    }

    // Generate call to action
    let callToAction = 'Let me know if you want to dive deeper into any of these areas.'
    if (urgent.issues.filter(i => i.severity === 'critical').length > 0) {
      callToAction = 'I\'d recommend starting with your critical items. Want me to walk you through them?'
    } else if (leads.hotLeads.length > 0) {
      callToAction = 'Ready to reach out to your hot leads? I can help draft messages.'
    } else {
      callToAction = 'Ask me anything - "What should I focus on?" or "How\'s my conversion rate?"'
    }

    return {
      greeting,
      sections,
      callToAction
    }
  } catch (error) {
    console.error('Error generating digest:', error)
    return {
      greeting: 'Here\'s your briefing.',
      sections: [{
        title: 'Status',
        content: 'I had trouble pulling together your full briefing. Try asking me specific questions like "How\'s my pipeline?" or "Any urgent issues?"'
      }],
      callToAction: 'What would you like to know about?'
    }
  }
}

// ============================================================================
// CUSTOM ALERTS
// ============================================================================

/**
 * Create a custom alert
 */
export async function createCustomAlert(
  userId: string,
  alert: Omit<CustomAlert, 'id' | 'createdAt' | 'enabled'>
): Promise<CustomAlert> {
  try {
    const id = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    const result = await sql`
      INSERT INTO custom_alerts (
        id,
        user_id,
        name,
        condition_type,
        threshold,
        entity,
        custom_query,
        channels,
        frequency,
        enabled,
        created_at,
        metadata
      ) VALUES (
        ${id},
        ${userId},
        ${alert.name},
        ${alert.condition},
        ${alert.threshold || null},
        ${alert.entity || null},
        ${alert.customQuery || null},
        ${alert.channels},
        ${alert.frequency},
        true,
        NOW(),
        ${JSON.stringify(alert.metadata || {})}
      )
      RETURNING *
    `

    return {
      id,
      userId,
      name: alert.name,
      condition: alert.condition,
      threshold: alert.threshold,
      entity: alert.entity,
      customQuery: alert.customQuery,
      channels: alert.channels,
      frequency: alert.frequency,
      enabled: true,
      createdAt: new Date(),
      metadata: alert.metadata
    }
  } catch (error) {
    console.error('Error creating custom alert:', error)
    throw new Error('Failed to create alert')
  }
}

/**
 * Get user's custom alerts
 */
export async function getUserAlerts(userId: string): Promise<CustomAlert[]> {
  try {
    const result = await sql`
      SELECT *
      FROM custom_alerts
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      condition: row.condition_type,
      threshold: row.threshold ? parseFloat(row.threshold) : undefined,
      entity: row.entity,
      customQuery: row.custom_query,
      channels: row.channels,
      frequency: row.frequency,
      enabled: row.enabled,
      lastTriggered: row.last_triggered ? new Date(row.last_triggered) : undefined,
      createdAt: new Date(row.created_at),
      metadata: row.metadata
    }))
  } catch (error) {
    console.error('Error getting user alerts:', error)
    return []
  }
}

/**
 * Check alerts and return triggered ones
 */
export async function checkAlerts(userId: string): Promise<Array<{
  alert: CustomAlert
  triggered: boolean
  message: string
  data?: any
}>> {
  const alerts = await getUserAlerts(userId)
  const results: Array<any> = []

  for (const alert of alerts.filter(a => a.enabled)) {
    let triggered = false
    let message = ''
    let data: any = undefined

    switch (alert.condition) {
      case 'deal_stalled': {
        const daysThreshold = alert.threshold || 7
        const stalledResult = await sql`
          SELECT id, description, amount
          FROM deals_v2
          WHERE (buyer_id = ${userId} OR seller_id = ${userId})
            AND status IN ('negotiating', 'agreed', 'in_progress')
            AND updated_at < NOW() - INTERVAL '${daysThreshold} days'
          LIMIT 1
        `
        if (stalledResult.rows.length > 0) {
          triggered = true
          message = `Deal "${stalledResult.rows[0].description?.substring(0, 30) || 'Untitled'}" has been inactive for ${daysThreshold}+ days.`
          data = stalledResult.rows[0]
        }
        break
      }

      case 'deal_over_threshold': {
        const valueThreshold = alert.threshold || 10000
        const bigDealResult = await sql`
          SELECT id, description, amount, status
          FROM deals_v2
          WHERE (buyer_id = ${userId} OR seller_id = ${userId})
            AND amount >= ${valueThreshold}
            AND status IN ('negotiating', 'agreed')
            AND updated_at < NOW() - INTERVAL '3 days'
          LIMIT 1
        `
        if (bigDealResult.rows.length > 0) {
          triggered = true
          message = `Your $${parseFloat(bigDealResult.rows[0].amount).toLocaleString()} deal needs attention.`
          data = bigDealResult.rows[0]
        }
        break
      }

      case 'lead_spike': {
        const leadsResult = await sql`
          SELECT COUNT(*) as count
          FROM leads
          WHERE user_id = ${userId}
            AND created_at >= NOW() - INTERVAL '24 hours'
        `
        const recentLeads = parseInt(leadsResult.rows[0]?.count || '0')
        const threshold = alert.threshold || 5
        if (recentLeads >= threshold) {
          triggered = true
          message = `You've received ${recentLeads} new leads in the last 24 hours!`
          data = { leadCount: recentLeads }
        }
        break
      }

      case 'inactive_lead': {
        const hoursThreshold = alert.threshold || 48
        const inactiveResult = await sql`
          SELECT id, user_name
          FROM leads
          WHERE user_id = ${userId}
            AND status = 'new'
            AND contacted_at IS NULL
            AND created_at < NOW() - INTERVAL '${hoursThreshold} hours'
          LIMIT 1
        `
        if (inactiveResult.rows.length > 0) {
          triggered = true
          message = `Lead "${inactiveResult.rows[0].user_name}" has been waiting ${hoursThreshold}+ hours without contact.`
          data = inactiveResult.rows[0]
        }
        break
      }
    }

    results.push({ alert, triggered, message, data })
  }

  return results
}

// ============================================================================
// EXPORT GENERATION
// ============================================================================

/**
 * Generate export data for reports
 */
export async function generateExport(
  userId: string,
  exportType: 'pipeline' | 'revenue' | 'leads' | 'full',
  timeRange: TimeRange = 'month',
  format: 'json' | 'csv' | 'summary' = 'summary'
): Promise<{
  title: string
  generatedAt: Date
  timeRange: string
  data: any
  summary?: string
}> {
  const dateFilter = getDateFilter(timeRange)
  const title = `${exportType.charAt(0).toUpperCase() + exportType.slice(1)} Report`

  try {
    let data: any = {}
    let summary = ''

    if (exportType === 'pipeline' || exportType === 'full') {
      data.pipeline = await getPipelineMetrics(userId, timeRange)
      summary += `Pipeline: ${data.pipeline.totalDeals} deals worth $${data.pipeline.totalValue.toLocaleString()}. `
    }

    if (exportType === 'revenue' || exportType === 'full') {
      data.revenue = await getRevenueMetrics(userId, timeRange)
      summary += `Revenue: $${data.revenue.totalRevenue.toLocaleString()} (${data.revenue.growthRate >= 0 ? '+' : ''}${data.revenue.growthRate.toFixed(1)}% growth). `
    }

    if (exportType === 'leads' || exportType === 'full') {
      data.leads = await getLeadMetrics(userId, timeRange)
      summary += `Leads: ${data.leads.totalLeads} total, ${data.leads.newLeads} new this week. `
    }

    if (exportType === 'full') {
      data.conversion = await getConversionMetrics(userId, timeRange)
      data.recommendations = await getRecommendations(userId)
      summary += `Conversion: ${data.conversion.overallConversion.toFixed(1)}%.`
    }

    // For CSV format, flatten the data
    if (format === 'csv') {
      data = flattenForCSV(data)
    }

    return {
      title,
      generatedAt: new Date(),
      timeRange: timeRange,
      data,
      summary: format === 'summary' ? summary : undefined
    }
  } catch (error) {
    console.error('Error generating export:', error)
    throw new Error('Failed to generate export')
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDateFilter(timeRange: TimeRange, previous: boolean = false): Date {
  const now = new Date()
  let date: Date

  switch (timeRange) {
    case 'today':
      date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      if (previous) date.setDate(date.getDate() - 1)
      break
    case 'yesterday':
      date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      if (previous) date.setDate(date.getDate() - 1)
      break
    case 'week':
      date = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      if (previous) date = new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case 'month':
      date = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
      if (previous) date = new Date(date.getFullYear(), date.getMonth() - 1, date.getDate())
      break
    case 'quarter':
      date = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
      if (previous) date = new Date(date.getFullYear(), date.getMonth() - 3, date.getDate())
      break
    case 'year':
      date = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      if (previous) date = new Date(date.getFullYear() - 1, date.getMonth(), date.getDate())
      break
    default:
      date = new Date(0) // All time
  }

  return date
}

function calculatePipelineHealth(
  byStage: Record<string, { count: number; value: number }>,
  velocity: number
): number {
  let score = 50 // Base score

  // Bonus for deals in escrow or in_progress
  const activeStages = ['escrowed', 'in_progress', 'delivered']
  const activeDeals = activeStages.reduce((sum, stage) => sum + (byStage[stage]?.count || 0), 0)
  score += Math.min(activeDeals * 5, 20)

  // Bonus for velocity
  score += Math.min(velocity * 10, 20)

  // Penalty for disputed deals
  const disputedDeals = byStage['disputed']?.count || 0
  score -= disputedDeals * 10

  // Bonus for agreed/moving deals
  const agreedDeals = byStage['agreed']?.count || 0
  score += Math.min(agreedDeals * 3, 10)

  return Math.max(0, Math.min(100, score))
}

function calculateTrend(dataPoints: Array<{ date: string; value: number }>): {
  trend: 'up' | 'down' | 'stable'
  percentChange: number
} {
  if (dataPoints.length < 2) {
    return { trend: 'stable', percentChange: 0 }
  }

  const recentHalf = dataPoints.slice(-Math.ceil(dataPoints.length / 2))
  const olderHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2))

  const recentAvg = recentHalf.reduce((sum, d) => sum + d.value, 0) / recentHalf.length
  const olderAvg = olderHalf.reduce((sum, d) => sum + d.value, 0) / olderHalf.length

  const percentChange = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0

  let trend: 'up' | 'down' | 'stable' = 'stable'
  if (percentChange > 5) trend = 'up'
  else if (percentChange < -5) trend = 'down'

  return { trend, percentChange }
}

function generateForecast(
  dataPoints: Array<{ date: string; value: number }>
): Array<{ date: string; value: number; confidence: number }> {
  if (dataPoints.length < 3) return []

  // Simple linear extrapolation
  const values = dataPoints.map(d => d.value)
  const avgChange = values.length > 1
    ? (values[values.length - 1] - values[0]) / (values.length - 1)
    : 0

  const lastValue = values[values.length - 1]
  const lastDate = new Date(dataPoints[dataPoints.length - 1].date)

  const forecast: Array<{ date: string; value: number; confidence: number }> = []

  for (let i = 1; i <= 4; i++) {
    const forecastDate = new Date(lastDate.getTime() + i * 7 * 24 * 60 * 60 * 1000)
    const forecastValue = Math.max(0, lastValue + (avgChange * i))
    const confidence = Math.max(30, 90 - (i * 15)) // Decreasing confidence

    forecast.push({
      date: forecastDate.toISOString().split('T')[0],
      value: Math.round(forecastValue * 100) / 100,
      confidence
    })
  }

  return forecast
}

function generateTrendInsights(
  metric: string,
  trend: 'up' | 'down' | 'stable',
  percentChange: number,
  dataPoints: Array<{ date: string; value: number }>
): string[] {
  const insights: string[] = []

  if (trend === 'up') {
    insights.push(`${metric.charAt(0).toUpperCase() + metric.slice(1)} is trending up ${percentChange.toFixed(1)}%.`)
  } else if (trend === 'down') {
    insights.push(`${metric.charAt(0).toUpperCase() + metric.slice(1)} has declined ${Math.abs(percentChange).toFixed(1)}%.`)
  } else {
    insights.push(`${metric.charAt(0).toUpperCase() + metric.slice(1)} has been relatively stable.`)
  }

  // Find peak
  if (dataPoints.length > 2) {
    const max = Math.max(...dataPoints.map(d => d.value))
    const maxPoint = dataPoints.find(d => d.value === max)
    if (maxPoint) {
      insights.push(`Peak was ${max.toLocaleString()} on ${new Date(maxPoint.date).toLocaleDateString()}.`)
    }
  }

  return insights
}

function flattenForCSV(data: any): any[] {
  const rows: any[] = []

  // Flatten nested objects into rows
  const flatten = (obj: any, prefix = '') => {
    Object.entries(obj).forEach(([key, value]) => {
      const newKey = prefix ? `${prefix}_${key}` : key
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        flatten(value, newKey)
      } else {
        rows.push({ metric: newKey, value: String(value) })
      }
    })
  }

  flatten(data)
  return rows
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ConversationalInsights = {
  // Core metrics
  getPipelineMetrics,
  getRevenueMetrics,
  getConversionMetrics,
  getLeadMetrics,

  // Trends & analysis
  analyzeTrends,
  comparePerformance,

  // Proactive insights
  getUrgentIssues,
  getRecommendations,

  // Digests
  generateDigest,

  // Alerts
  createCustomAlert,
  getUserAlerts,
  checkAlerts,

  // Exports
  generateExport
}

export default ConversationalInsights
