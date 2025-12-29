// @ts-nocheck
/**
 * Insights Chat API
 *
 * Business intelligence through natural conversation.
 * No dashboards needed - just ask Wells.
 *
 * Example queries:
 * - "How's my pipeline looking?"
 * - "What's my conversion rate this quarter?"
 * - "Alert me if any deal over $10k stalls"
 * - "Give me my morning briefing"
 * - "How does this month compare to last?"
 * - "What should I focus on today?"
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  InsightsHandler,
  isInsightsQuery,
  getSuggestedQuestions
} from '@/lib/chat/handlers/insights-handler'
import {
  addMessage,
  createConversation,
  getConversation,
  getMessages
} from '@/lib/chat/unified-chat-service'
import { ConversationalInsights } from '@/lib/insights/conversational-insights'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

interface InsightsChatRequest {
  message: string
  conversationId?: string
  context?: {
    previousMessages?: Array<{ role: 'user' | 'assistant'; content: string }>
    currentPage?: string
    selectedEntity?: { type: string; id: string }
  }
}

interface InsightsChatResponse {
  message: string
  data?: any
  visualizations?: Array<{
    type: 'metric' | 'trend' | 'comparison' | 'breakdown' | 'table'
    title: string
    data: any
  }>
  actions?: Array<{
    label: string
    action: string
    params?: Record<string, any>
  }>
  suggestedQuestions?: string[]
  conversationId?: string
  confidence?: number
}

// ============================================================================
// POST - Process insights chat message
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json() as InsightsChatRequest
    const { message, conversationId, context } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Get user profile for personalization
    const user = await currentUser()
    const userProfile = {
      firstName: user?.firstName || undefined,
      lastName: user?.lastName || undefined,
      company: user?.publicMetadata?.company as string || undefined
    }

    // Check if this is an insights query
    if (!isInsightsQuery(message)) {
      // Route to general chat or return helpful response
      return NextResponse.json({
        message: "I'm your business insights assistant. Try asking me things like:\n\n" +
          "- \"How's my pipeline looking?\"\n" +
          "- \"What's my conversion rate?\"\n" +
          "- \"Any urgent issues I should know about?\"\n" +
          "- \"Give me my morning briefing\"\n\n" +
          "What would you like to know?",
        suggestedQuestions: getSuggestedQuestions()
      })
    }

    // Get or create conversation
    let conversation
    if (conversationId) {
      conversation = await getConversation(conversationId)
    }

    if (!conversation) {
      conversation = await createConversation({
        userId,
        product: 'wellsai',
        journey: 'insights',
        title: message.substring(0, 50),
        metadata: {
          type: 'insights',
          startedAt: new Date().toISOString()
        }
      })
    }

    // Get conversation history for context
    let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
    if (conversation) {
      const messages = await getMessages(conversation.id, { limit: 10 })
      conversationHistory = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    }

    // Process the insights query
    const startTime = Date.now()
    const result = await InsightsHandler.handleInsightsQuery({
      userId,
      query: message,
      conversationHistory,
      userProfile
    })
    const latencyMs = Date.now() - startTime

    // Save messages to conversation
    if (conversation) {
      // Save user message
      await addMessage({
        conversationId: conversation.id,
        role: 'user',
        content: message,
        productContext: 'wellsai',
        metadata: {
          type: 'insights_query',
          latencyMs
        }
      })

      // Save assistant response
      await addMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: result.response,
        productContext: 'wellsai',
        metadata: {
          type: 'insights_response',
          hasData: !!result.data,
          hasActions: !!(result.actions && result.actions.length > 0)
        }
      })
    }

    // Build visualizations from data if available
    const visualizations = buildVisualizations(result.data)

    // Build response
    const response: InsightsChatResponse = {
      message: result.response,
      data: result.data,
      visualizations,
      actions: result.actions,
      suggestedQuestions: result.followUp || getSuggestedQuestions(),
      conversationId: conversation?.id
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Insights chat error:', error)

    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { error: 'AI service not configured' },
          { status: 503 }
        )
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again in a moment.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to process your question',
        message: "I had trouble answering that. Try asking in a different way, like \"How's my pipeline?\" or \"What should I focus on?\"",
        suggestedQuestions: getSuggestedQuestions()
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Get insights summary or check alerts
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'summary'
    const timeRange = (searchParams.get('timeRange') || 'month') as any

    switch (action) {
      case 'summary': {
        // Get a quick summary of key metrics
        const [pipeline, revenue, leads, urgent] = await Promise.all([
          ConversationalInsights.getPipelineMetrics(userId, timeRange),
          ConversationalInsights.getRevenueMetrics(userId, timeRange),
          ConversationalInsights.getLeadMetrics(userId, timeRange),
          ConversationalInsights.getUrgentIssues(userId)
        ])

        return NextResponse.json({
          pipeline: {
            totalDeals: pipeline.totalDeals,
            totalValue: pipeline.totalValue,
            healthScore: pipeline.healthScore
          },
          revenue: {
            total: revenue.totalRevenue,
            closedDeals: revenue.closedDeals,
            growthRate: revenue.growthRate
          },
          leads: {
            total: leads.totalLeads,
            active: leads.activeLeads,
            hot: leads.hotLeads.length
          },
          urgent: {
            count: urgent.issues.length,
            critical: urgent.issues.filter(i => i.severity === 'critical').length
          },
          suggestedQuestions: getSuggestedQuestions()
        })
      }

      case 'alerts': {
        // Check triggered alerts
        const alerts = await ConversationalInsights.checkAlerts(userId)
        const triggeredAlerts = alerts.filter(a => a.triggered)

        return NextResponse.json({
          total: alerts.length,
          triggered: triggeredAlerts.length,
          alerts: triggeredAlerts.map(a => ({
            id: a.alert.id,
            name: a.alert.name,
            message: a.message,
            data: a.data
          }))
        })
      }

      case 'digest': {
        // Get morning/daily digest
        const digestType = searchParams.get('type') as 'morning' | 'evening' | 'weekly' || 'morning'
        const digest = await ConversationalInsights.generateDigest(userId, digestType)

        return NextResponse.json(digest)
      }

      case 'recommendations': {
        // Get AI recommendations
        const recommendations = await ConversationalInsights.getRecommendations(userId)

        return NextResponse.json(recommendations)
      }

      case 'trends': {
        // Get trend analysis
        const metric = searchParams.get('metric') as 'revenue' | 'deals' | 'leads' | 'conversion' || 'revenue'
        const trends = await ConversationalInsights.analyzeTrends(userId, metric, timeRange)

        return NextResponse.json(trends)
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Insights GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    )
  }
}

// ============================================================================
// VISUALIZATION BUILDER
// ============================================================================

function buildVisualizations(data: any): InsightsChatResponse['visualizations'] {
  if (!data) return undefined

  const visualizations: InsightsChatResponse['visualizations'] = []

  // Pipeline metrics
  if (data.totalDeals !== undefined && data.byStage) {
    visualizations.push({
      type: 'breakdown',
      title: 'Pipeline by Stage',
      data: {
        stages: Object.entries(data.byStage).map(([stage, info]: [string, any]) => ({
          stage,
          count: info.count,
          value: info.value
        })),
        total: data.totalDeals,
        totalValue: data.totalValue
      }
    })

    visualizations.push({
      type: 'metric',
      title: 'Pipeline Health',
      data: {
        value: data.healthScore,
        max: 100,
        label: 'Health Score'
      }
    })
  }

  // Revenue metrics
  if (data.totalRevenue !== undefined && data.revenueByPeriod) {
    visualizations.push({
      type: 'metric',
      title: 'Total Revenue',
      data: {
        value: data.totalRevenue,
        format: 'currency',
        change: data.growthRate,
        changeLabel: 'vs previous period'
      }
    })

    if (data.revenueByPeriod.length > 1) {
      visualizations.push({
        type: 'trend',
        title: 'Revenue Trend',
        data: {
          points: data.revenueByPeriod,
          projected: data.projectedRevenue
        }
      })
    }
  }

  // Conversion funnel
  if (data.funnel && data.funnel.length > 0) {
    visualizations.push({
      type: 'breakdown',
      title: 'Conversion Funnel',
      data: {
        stages: data.funnel,
        overall: data.overallConversion
      }
    })
  }

  // Lead metrics
  if (data.totalLeads !== undefined && data.byStatus) {
    visualizations.push({
      type: 'breakdown',
      title: 'Leads by Status',
      data: {
        breakdown: data.byStatus,
        total: data.totalLeads,
        active: data.activeLeads
      }
    })
  }

  // Comparison
  if (data.current && data.previous && data.changes) {
    visualizations.push({
      type: 'comparison',
      title: 'Period Comparison',
      data: {
        current: data.current,
        previous: data.previous,
        changes: data.changes,
        highlights: data.highlights
      }
    })
  }

  // Trends
  if (data.dataPoints && data.forecast) {
    visualizations.push({
      type: 'trend',
      title: 'Trend Analysis',
      data: {
        historical: data.dataPoints,
        forecast: data.forecast,
        trend: data.trend,
        change: data.percentChange
      }
    })
  }

  // Urgent issues
  if (data.issues && Array.isArray(data.issues)) {
    visualizations.push({
      type: 'table',
      title: 'Items Needing Attention',
      data: {
        items: data.issues.map((issue: any) => ({
          severity: issue.severity,
          title: issue.title,
          action: issue.actionRequired
        })),
        summary: data.summary
      }
    })
  }

  return visualizations.length > 0 ? visualizations : undefined
}

// ============================================================================
// OPTIONS - CORS
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}
