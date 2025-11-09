import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

/**
 * GET /api/ai-ops/operations
 * Get all AI operations for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Mock operations data (will be replaced with database)
    const operations = [
      {
        id: 'op_sales_1',
        userId,
        name: 'Daily Lead Generation',
        category: 'sales',
        description: 'Find 50 qualified leads in your ICP, enrich with Apollo, personalize outreach',
        status: 'active',
        frequency: 'daily',
        schedule: '09:00',
        lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000),
        nextRun: new Date(Date.now() + 22 * 60 * 60 * 1000),
        metrics: {
          totalRuns: 47,
          successRate: 94,
          timeSavedHours: 188,
          costSavedUSD: 18800,
          leadsGenerated: 2350,
          emailsSent: 8930,
          meetingsBooked: 47
        },
        config: {
          icpCriteria: {
            industry: ['SaaS', 'Fintech'],
            companySize: '50-200',
            revenue: '$1M-$10M',
            location: ['US', 'UK', 'Canada']
          },
          leadsPerDay: 50,
          apolloEnrichment: true,
          personalizedOutreach: true
        }
      },
      {
        id: 'op_sales_2',
        userId,
        name: 'Follow-up Sequence',
        category: 'sales',
        description: 'Send personalized follow-ups to prospects who haven\'t replied in 5 days',
        status: 'active',
        frequency: 'continuous',
        lastRun: new Date(Date.now() - 30 * 60 * 1000),
        nextRun: new Date(Date.now() + 30 * 60 * 1000),
        metrics: {
          totalRuns: 312,
          successRate: 89,
          timeSavedHours: 156,
          costSavedUSD: 15600,
          followUpsSent: 1560,
          repliesReceived: 234
        }
      },
      {
        id: 'op_proc_1',
        userId,
        name: 'Supplier RFQ Management',
        category: 'procurement',
        description: 'Automatically send RFQs to suppliers, collect quotes, compare pricing',
        status: 'active',
        frequency: 'as_needed',
        lastRun: new Date(Date.now() - 6 * 60 * 60 * 1000),
        metrics: {
          totalRuns: 23,
          successRate: 96,
          timeSavedHours: 92,
          costSavedUSD: 45000,
          rfqsSent: 115,
          quotesReceived: 287,
          avgSavings: 18
        }
      }
    ]

    return NextResponse.json({
      operations,
      total: operations.length,
      active: operations.filter(op => op.status === 'active').length,
      stats: {
        totalTimeSaved: operations.reduce((sum, op) => sum + op.metrics.timeSavedHours, 0),
        totalCostSaved: operations.reduce((sum, op) => sum + op.metrics.costSavedUSD, 0),
        avgSuccessRate: Math.round(operations.reduce((sum, op) => sum + op.metrics.successRate, 0) / operations.length)
      }
    })

  } catch (error: any) {
    console.error('[AI OPS OPERATIONS] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load operations' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ai-ops/operations
 * Create a new AI operation
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, category, description, frequency, schedule, config } = await req.json()

    if (!name || !category || !description) {
      return NextResponse.json(
        { error: 'Name, category, and description required' },
        { status: 400 }
      )
    }

    // Create new operation
    const operation = {
      id: `op_${category}_${Date.now()}`,
      userId,
      name,
      category,
      description,
      status: 'active',
      frequency: frequency || 'daily',
      schedule: schedule || '09:00',
      createdAt: new Date(),
      config: config || {},
      metrics: {
        totalRuns: 0,
        successRate: 0,
        timeSavedHours: 0,
        costSavedUSD: 0
      }
    }

    return NextResponse.json({
      success: true,
      operation,
      message: `Operation "${name}" created and activated!`
    })

  } catch (error: any) {
    console.error('[AI OPS CREATE] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create operation' },
      { status: 500 }
    )
  }
}
