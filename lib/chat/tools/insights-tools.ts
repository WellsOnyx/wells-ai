// @ts-nocheck
/**
 * Insights Chat Tools
 *
 * Tools for proactive insights delivery, analytics, and recommendations via conversation.
 */

import { ConversationContext } from '../conversation-manager'

// ============================================================================
// TYPES
// ============================================================================

export interface InsightsToolResult {
  success: boolean
  data?: unknown
  error?: string
  message: string
  suggestedFollowUps?: string[]
  priority?: 'low' | 'medium' | 'high' | 'critical'
}

export interface InsightParams {
  category?: 'spending' | 'savings' | 'performance' | 'opportunities' | 'risks' | 'all'
  timeframe?: 'day' | 'week' | 'month' | 'quarter'
  limit?: number
}

export interface AlertParams {
  type?: 'price' | 'deadline' | 'payment' | 'opportunity' | 'risk'
  status?: 'active' | 'acknowledged' | 'resolved'
}

export interface RecommendationParams {
  area?: 'cost_reduction' | 'revenue' | 'efficiency' | 'growth' | 'risk_mitigation'
  limit?: number
}

// ============================================================================
// PROACTIVE INSIGHTS
// ============================================================================

export async function getInsights(
  params: InsightParams,
  context: ConversationContext
): Promise<InsightsToolResult> {
  try {
    const { category = 'all', timeframe = 'week', limit = 5 } = params

    // Mock insights based on user journey
    const insights = generateInsightsForJourney(context.userJourney, timeframe)

    const filteredInsights = category === 'all'
      ? insights
      : insights.filter(i => i.category === category)

    if (filteredInsights.length === 0) {
      return {
        success: true,
        data: { insights: [] },
        message: 'No new insights right now. I\'m continuously monitoring and will alert you when something needs your attention.',
        suggestedFollowUps: ['Set up alerts', 'View past insights', 'Check status'],
      }
    }

    const topInsight = filteredInsights[0]
    const otherCount = filteredInsights.length - 1

    let message = `${topInsight.icon} ${topInsight.title}: ${topInsight.description}`
    if (topInsight.action) {
      message += ` ${topInsight.action}`
    }
    if (otherCount > 0) {
      message += `\n\n${otherCount} more insight${otherCount > 1 ? 's' : ''} available.`
    }

    return {
      success: true,
      data: { insights: filteredInsights },
      message,
      priority: topInsight.priority,
      suggestedFollowUps: topInsight.suggestedActions || ['Show more insights', 'Take action', 'Dismiss'],
    }
  } catch (error) {
    console.error('[Insights Tools] Get insights error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get insights',
      message: 'I had trouble fetching insights. Let me try again.',
    }
  }
}

function generateInsightsForJourney(journey: string, timeframe: string) {
  const insights = []

  switch (journey) {
    case 'buyer':
      insights.push(
        {
          id: 'ins_1',
          category: 'savings',
          title: 'Savings Opportunity',
          description: 'Steel prices dropped 12% this week.',
          action: 'Lock in rates now before they rebound.',
          icon: '💰',
          priority: 'high' as const,
          suggestedActions: ['Create RFQ', 'View price history', 'Set price alert'],
        },
        {
          id: 'ins_2',
          category: 'spending',
          title: 'Spending Alert',
          description: 'Office supplies spend is 23% over budget.',
          action: 'Review recent purchases.',
          icon: '📊',
          priority: 'medium' as const,
          suggestedActions: ['View breakdown', 'Adjust budget', 'Find alternatives'],
        },
        {
          id: 'ins_3',
          category: 'risks',
          title: 'Vendor Risk',
          description: 'Your main steel supplier has delivery delays.',
          action: 'Consider backup suppliers.',
          icon: '⚠️',
          priority: 'high' as const,
          suggestedActions: ['Find alternatives', 'Contact supplier', 'View impact'],
        }
      )
      break

    case 'seller':
      insights.push(
        {
          id: 'ins_1',
          category: 'opportunities',
          title: 'Hot RFQ',
          description: '3 new RFQs matching your products posted today.',
          action: 'Quote now for best chances.',
          icon: '🎯',
          priority: 'high' as const,
          suggestedActions: ['View RFQs', 'Auto-quote', 'Set preferences'],
        },
        {
          id: 'ins_2',
          category: 'performance',
          title: 'Win Rate',
          description: 'Your win rate is up 15% this month.',
          action: 'Your faster response times are paying off.',
          icon: '📈',
          priority: 'low' as const,
          suggestedActions: ['View stats', 'Share success', 'Optimize more'],
        }
      )
      break

    case 'jobs':
      insights.push(
        {
          id: 'ins_1',
          category: 'opportunities',
          title: 'Perfect Match',
          description: 'A new role at TechCorp matches 95% of your profile.',
          action: 'Apply before 50+ others do.',
          icon: '⭐',
          priority: 'high' as const,
          suggestedActions: ['View job', 'Apply now', 'Save for later'],
        },
        {
          id: 'ins_2',
          category: 'performance',
          title: 'Market Intel',
          description: 'Salaries for your role increased 8% this quarter.',
          action: 'Your target salary is now market-competitive.',
          icon: '📊',
          priority: 'medium' as const,
          suggestedActions: ['Update expectations', 'Negotiate current offers', 'View data'],
        }
      )
      break

    case 'founder':
      insights.push(
        {
          id: 'ins_1',
          category: 'opportunities',
          title: 'Talent Available',
          description: '2 strong CTO candidates just became available.',
          action: 'Reach out before competitors do.',
          icon: '🎯',
          priority: 'high' as const,
          suggestedActions: ['View profiles', 'Start outreach', 'Schedule calls'],
        },
        {
          id: 'ins_2',
          category: 'savings',
          title: 'Cost Optimization',
          description: 'You can save $15K/month by consolidating vendors.',
          action: 'I can help negotiate bulk pricing.',
          icon: '💰',
          priority: 'medium' as const,
          suggestedActions: ['View analysis', 'Start consolidation', 'Talk to vendors'],
        },
        {
          id: 'ins_3',
          category: 'risks',
          title: 'Cash Flow Alert',
          description: '$45K in receivables overdue by 30+ days.',
          action: 'Send payment reminders.',
          icon: '⚠️',
          priority: 'high' as const,
          suggestedActions: ['Send reminders', 'View details', 'Call customers'],
        }
      )
      break

    default:
      insights.push({
        id: 'ins_1',
        category: 'opportunities',
        title: 'Welcome',
        description: 'Tell me about your business and I\'ll find opportunities for you.',
        action: '',
        icon: '👋',
        priority: 'low' as const,
        suggestedActions: ['I\'m buying', 'I\'m selling', 'I\'m hiring', 'I\'m job searching'],
      })
  }

  return insights
}

// ============================================================================
// ALERTS
// ============================================================================

export async function getAlerts(
  params: AlertParams,
  context: ConversationContext
): Promise<InsightsToolResult> {
  try {
    const { type, status = 'active' } = params

    // Mock alerts
    const alerts = [
      {
        id: 'alert_001',
        type: 'deadline',
        title: 'RFQ Deadline',
        message: 'RFQ for ball bearings closes in 2 hours',
        priority: 'critical' as const,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        actionUrl: '/rfq/rfq_001',
      },
      {
        id: 'alert_002',
        type: 'price',
        title: 'Price Drop',
        message: 'Aluminum prices hit 6-month low',
        priority: 'high' as const,
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      },
      {
        id: 'alert_003',
        type: 'payment',
        title: 'Payment Due',
        message: 'Invoice INV-003 is overdue by 5 days',
        priority: 'high' as const,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    ]

    const filteredAlerts = type ? alerts.filter(a => a.type === type) : alerts
    const criticalAlerts = filteredAlerts.filter(a => a.priority === 'critical')

    if (filteredAlerts.length === 0) {
      return {
        success: true,
        data: { alerts: [] },
        message: 'No active alerts. I\'m monitoring everything for you.',
        suggestedFollowUps: ['Set new alert', 'View history', 'Check status'],
      }
    }

    let message = ''
    if (criticalAlerts.length > 0) {
      message = `🚨 ${criticalAlerts[0].title}: ${criticalAlerts[0].message}`
    } else {
      message = `You have ${filteredAlerts.length} active alert${filteredAlerts.length > 1 ? 's' : ''}.`
    }

    return {
      success: true,
      data: { alerts: filteredAlerts },
      message,
      priority: criticalAlerts.length > 0 ? 'critical' : 'medium',
      suggestedFollowUps: ['Take action', 'Dismiss', 'View all alerts'],
    }
  } catch (error) {
    console.error('[Insights Tools] Get alerts error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get alerts',
      message: 'I had trouble fetching alerts. Let me try again.',
    }
  }
}

export async function createAlert(
  params: {
    type: 'price' | 'deadline' | 'threshold' | 'custom'
    condition: string
    threshold?: number
    notifyVia?: ('email' | 'sms' | 'push')[]
  },
  context: ConversationContext
): Promise<InsightsToolResult> {
  try {
    const { type, condition, threshold, notifyVia = ['push'] } = params

    const alertId = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    return {
      success: true,
      data: {
        alertId,
        type,
        condition,
        threshold,
        notifyVia,
        status: 'active',
      },
      message: `Alert created. I'll notify you when ${condition}.`,
      suggestedFollowUps: ['View alerts', 'Create another', 'Edit alert'],
    }
  } catch (error) {
    console.error('[Insights Tools] Create alert error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create alert',
      message: 'I had trouble creating that alert. Want to try again?',
    }
  }
}

// ============================================================================
// RECOMMENDATIONS
// ============================================================================

export async function getRecommendations(
  params: RecommendationParams,
  context: ConversationContext
): Promise<InsightsToolResult> {
  try {
    const { area, limit = 3 } = params

    // Generate recommendations based on context
    const recommendations = generateRecommendations(context, area)

    if (recommendations.length === 0) {
      return {
        success: true,
        data: { recommendations: [] },
        message: 'I\'m analyzing your data to find opportunities. Check back soon.',
        suggestedFollowUps: ['Check status', 'Set preferences'],
      }
    }

    const topRec = recommendations[0]

    return {
      success: true,
      data: { recommendations },
      message: `Top recommendation: ${topRec.title}\n\n${topRec.description}\n\nPotential impact: ${topRec.impact}`,
      suggestedFollowUps: topRec.actions || ['Implement', 'Learn more', 'Skip'],
    }
  } catch (error) {
    console.error('[Insights Tools] Get recommendations error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get recommendations',
      message: 'I had trouble generating recommendations. Let me try again.',
    }
  }
}

function generateRecommendations(context: ConversationContext, area?: string) {
  const recommendations = []

  // Universal recommendations
  recommendations.push(
    {
      id: 'rec_001',
      area: 'cost_reduction',
      title: 'Consolidate Suppliers',
      description: 'You\'re using 12 suppliers for similar products. Consolidating to 3-4 could unlock volume discounts.',
      impact: '$8,500/month savings',
      confidence: 0.85,
      actions: ['Analyze suppliers', 'Start consolidation', 'View details'],
    },
    {
      id: 'rec_002',
      area: 'efficiency',
      title: 'Automate Recurring Orders',
      description: 'You reorder office supplies manually every month. Set up auto-reorder to save time.',
      impact: '4 hours/month saved',
      confidence: 0.92,
      actions: ['Enable auto-reorder', 'Customize schedule', 'Skip'],
    },
    {
      id: 'rec_003',
      area: 'revenue',
      title: 'Expand to New Categories',
      description: 'Based on your success in industrial parts, consider adding complementary product lines.',
      impact: '+15% revenue potential',
      confidence: 0.72,
      actions: ['Explore categories', 'View market data', 'Not now'],
    }
  )

  return area
    ? recommendations.filter(r => r.area === area).slice(0, 3)
    : recommendations.slice(0, 3)
}

// ============================================================================
// ANALYTICS
// ============================================================================

export async function getAnalytics(
  params: {
    metric: 'spend' | 'revenue' | 'savings' | 'efficiency' | 'growth'
    period: 'week' | 'month' | 'quarter' | 'year'
    compareToLast?: boolean
  },
  context: ConversationContext
): Promise<InsightsToolResult> {
  try {
    const { metric, period, compareToLast = true } = params

    // Mock analytics data
    const analytics = {
      spend: { current: 78000, previous: 72000, change: 8.3 },
      revenue: { current: 125000, previous: 118000, change: 5.9 },
      savings: { current: 12500, previous: 8000, change: 56.3 },
      efficiency: { current: 87, previous: 82, change: 6.1 }, // percentage
      growth: { current: 15, previous: 12, change: 25 }, // percentage
    }

    const data = analytics[metric]
    const changeDirection = data.change >= 0 ? 'up' : 'down'
    const changeText = `${changeDirection} ${Math.abs(data.change).toFixed(1)}% from last ${period}`

    const formatValue = (val: number) => {
      if (metric === 'efficiency' || metric === 'growth') return `${val}%`
      return `$${val.toLocaleString()}`
    }

    return {
      success: true,
      data: { metric, period, ...data },
      message: `${metric.charAt(0).toUpperCase() + metric.slice(1)} this ${period}: ${formatValue(data.current)}${compareToLast ? `, ${changeText}` : ''}.`,
      suggestedFollowUps: ['Drill down', 'Compare periods', 'Export data'],
    }
  } catch (error) {
    console.error('[Insights Tools] Get analytics error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get analytics',
      message: 'I had trouble getting analytics. Let me try again.',
    }
  }
}

// ============================================================================
// DAILY DIGEST
// ============================================================================

export async function getDailyDigest(
  params: Record<string, never>,
  context: ConversationContext
): Promise<InsightsToolResult> {
  try {
    // Compile daily summary
    const digest = {
      greeting: getTimeBasedGreeting(),
      keyMetrics: {
        pendingActions: 3,
        newOpportunities: 2,
        alertsNeedingAttention: 1,
      },
      topPriority: {
        title: 'Approve quote for ball bearings',
        reason: 'Deadline in 4 hours',
      },
      quickWins: [
        'Send invoice reminder to Acme Corp',
        'Review 2 new supplier quotes',
      ],
    }

    const message = `${digest.greeting}

📋 Today's Summary:
• ${digest.keyMetrics.pendingActions} actions pending
• ${digest.keyMetrics.newOpportunities} new opportunities
• ${digest.keyMetrics.alertsNeedingAttention} alert needs attention

🎯 Top Priority: ${digest.topPriority.title} (${digest.topPriority.reason})

Quick wins:
${digest.quickWins.map(w => `• ${w}`).join('\n')}`

    return {
      success: true,
      data: digest,
      message,
      suggestedFollowUps: ['Handle top priority', 'View opportunities', 'Clear quick wins'],
    }
  } catch (error) {
    console.error('[Insights Tools] Daily digest error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate digest',
      message: 'I had trouble creating your daily digest. Let me try again.',
    }
  }
}

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning!'
  if (hour < 17) return 'Good afternoon!'
  return 'Good evening!'
}

// ============================================================================
// TOOL REGISTRY
// ============================================================================

export const insightsTools = {
  getInsights,
  getAlerts,
  createAlert,
  getRecommendations,
  getAnalytics,
  getDailyDigest,
}

export default insightsTools
