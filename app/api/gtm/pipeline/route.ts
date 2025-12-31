import { NextResponse } from 'next/server'

/**
 * GTM Pipeline API - Get pipeline stats
 *
 * GET /api/gtm/pipeline
 *
 * Returns pipeline metrics, funnel stats, and summary data
 */

export interface PipelineMetrics {
  // Funnel counts
  totalLeads: number
  cold: number
  contacted: number
  replied: number
  demosScheduled: number
  demosCompleted: number
  proposals: number
  won: number
  lost: number

  // Value metrics
  pipelineValue: number
  weightedPipelineValue: number
  averageDealSize: number

  // Conversion rates
  contactToReply: number
  replyToDemo: number
  demoToProposal: number
  proposalToWon: number
  overallConversion: number

  // Activity metrics
  totalActivities: number
  activitiesThisWeek: number
  emailsSent: number
  linkedInConnections: number
  callsMade: number
  demosThisWeek: number

  // Performance metrics
  responseRate: number
  demoShowRate: number
  avgDaysInPipeline: number
  estimatedCAC: number
}

export interface WeeklyMetrics {
  week: string
  startDate: string
  endDate: string
  emailsSent: number
  linkedInConnections: number
  linkedInMessages: number
  callsMade: number
  loomsSent: number
  replies: number
  demosBooked: number
  demosCompleted: number
  proposals: number
  wins: number
}

// Stage probability weights for weighted pipeline
const STAGE_PROBABILITIES: Record<string, number> = {
  cold: 0.02,
  contacted: 0.05,
  replied: 0.15,
  demo_scheduled: 0.25,
  demo_complete: 0.40,
  proposal: 0.60,
  won: 1.0,
  lost: 0,
}

// Mock data for demo (in production, this would come from database)
const MOCK_LEADS = [
  { id: '1', company: 'Acme Manufacturing', status: 'demo_scheduled', estimatedValue: 75000, createdAt: '2025-01-05' },
  { id: '2', company: 'Global Distributors', status: 'replied', estimatedValue: 120000, createdAt: '2025-01-08' },
  { id: '3', company: 'Midwest Industrial', status: 'demo_complete', estimatedValue: 50000, createdAt: '2025-01-02' },
  { id: '4', company: 'Pacific Foods', status: 'contacted', estimatedValue: 80000, createdAt: '2025-01-15' },
  { id: '5', company: 'Southern Supply', status: 'proposal', estimatedValue: 150000, createdAt: '2025-01-01' },
  { id: '6', company: 'Eastern Metals', status: 'cold', estimatedValue: 60000, createdAt: '2025-01-16' },
  { id: '7', company: 'Western Plastics', status: 'contacted', estimatedValue: 90000, createdAt: '2025-01-14' },
  { id: '8', company: 'Northern Equipment', status: 'demo_scheduled', estimatedValue: 110000, createdAt: '2025-01-10' },
]

const MOCK_WEEKLY_METRICS: WeeklyMetrics[] = [
  {
    week: 'Week 1',
    startDate: '2025-01-01',
    endDate: '2025-01-07',
    emailsSent: 22,
    linkedInConnections: 12,
    linkedInMessages: 8,
    callsMade: 3,
    loomsSent: 2,
    replies: 3,
    demosBooked: 2,
    demosCompleted: 0,
    proposals: 0,
    wins: 0,
  },
  {
    week: 'Week 2',
    startDate: '2025-01-08',
    endDate: '2025-01-14',
    emailsSent: 45,
    linkedInConnections: 18,
    linkedInMessages: 15,
    callsMade: 5,
    loomsSent: 4,
    replies: 6,
    demosBooked: 3,
    demosCompleted: 2,
    proposals: 1,
    wins: 0,
  },
  {
    week: 'Week 3',
    startDate: '2025-01-15',
    endDate: '2025-01-21',
    emailsSent: 38,
    linkedInConnections: 15,
    linkedInMessages: 12,
    callsMade: 4,
    loomsSent: 3,
    replies: 5,
    demosBooked: 2,
    demosCompleted: 3,
    proposals: 1,
    wins: 0,
  },
]

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const detailed = searchParams.get('detailed') === 'true'
    const weeklyOnly = searchParams.get('weekly') === 'true'

    // Calculate funnel counts
    const statusCounts: Record<string, number> = {
      cold: 0,
      contacted: 0,
      replied: 0,
      demo_scheduled: 0,
      demo_complete: 0,
      proposal: 0,
      won: 0,
      lost: 0,
    }

    let pipelineValue = 0
    let weightedPipelineValue = 0
    let totalDealValue = 0

    MOCK_LEADS.forEach(lead => {
      statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1
      totalDealValue += lead.estimatedValue

      // Only count active pipeline (not won/lost)
      if (!['won', 'lost'].includes(lead.status)) {
        pipelineValue += lead.estimatedValue
        weightedPipelineValue += lead.estimatedValue * (STAGE_PROBABILITIES[lead.status] || 0)
      }
    })

    // Calculate totals from weekly metrics
    const totalEmails = MOCK_WEEKLY_METRICS.reduce((sum, w) => sum + w.emailsSent, 0)
    const totalLinkedIn = MOCK_WEEKLY_METRICS.reduce((sum, w) => sum + w.linkedInConnections, 0)
    const totalReplies = MOCK_WEEKLY_METRICS.reduce((sum, w) => sum + w.replies, 0)
    const totalDemos = MOCK_WEEKLY_METRICS.reduce((sum, w) => sum + w.demosCompleted, 0)
    const totalActivities = MOCK_WEEKLY_METRICS.reduce((sum, w) =>
      sum + w.emailsSent + w.linkedInConnections + w.linkedInMessages + w.callsMade + w.loomsSent, 0)

    // Calculate conversion rates
    const contactToReply = statusCounts.contacted > 0
      ? (statusCounts.replied / (statusCounts.contacted + statusCounts.replied)) * 100 : 0
    const replyToDemo = statusCounts.replied > 0
      ? ((statusCounts.demo_scheduled + statusCounts.demo_complete) / statusCounts.replied) * 100 : 0
    const demoToProposal = (statusCounts.demo_scheduled + statusCounts.demo_complete) > 0
      ? (statusCounts.proposal / (statusCounts.demo_scheduled + statusCounts.demo_complete)) * 100 : 0
    const proposalToWon = statusCounts.proposal > 0
      ? (statusCounts.won / statusCounts.proposal) * 100 : 0
    const overallConversion = MOCK_LEADS.length > 0
      ? (statusCounts.won / MOCK_LEADS.length) * 100 : 0

    // Response rate
    const responseRate = totalEmails > 0
      ? (totalReplies / totalEmails) * 100 : 0

    // Demo show rate (mock: assume 70%)
    const demoShowRate = 70

    // Estimated CAC (tools + time)
    const monthlyToolCost = 300 // LinkedIn SN + Apollo
    const hoursSpent = 80 // ~20 hours/week
    const hourlyRate = 50 // Opportunity cost
    const dealsWon = Math.max(1, statusCounts.won)
    const estimatedCAC = (monthlyToolCost + (hoursSpent * hourlyRate)) / dealsWon

    // Build metrics object
    const metrics: PipelineMetrics = {
      totalLeads: MOCK_LEADS.length,
      cold: statusCounts.cold,
      contacted: statusCounts.contacted,
      replied: statusCounts.replied,
      demosScheduled: statusCounts.demo_scheduled,
      demosCompleted: statusCounts.demo_complete,
      proposals: statusCounts.proposal,
      won: statusCounts.won,
      lost: statusCounts.lost,

      pipelineValue,
      weightedPipelineValue: Math.round(weightedPipelineValue),
      averageDealSize: Math.round(totalDealValue / MOCK_LEADS.length),

      contactToReply: Math.round(contactToReply * 10) / 10,
      replyToDemo: Math.round(replyToDemo * 10) / 10,
      demoToProposal: Math.round(demoToProposal * 10) / 10,
      proposalToWon: Math.round(proposalToWon * 10) / 10,
      overallConversion: Math.round(overallConversion * 10) / 10,

      totalActivities,
      activitiesThisWeek: MOCK_WEEKLY_METRICS.length > 0
        ? MOCK_WEEKLY_METRICS[MOCK_WEEKLY_METRICS.length - 1].emailsSent +
          MOCK_WEEKLY_METRICS[MOCK_WEEKLY_METRICS.length - 1].linkedInConnections +
          MOCK_WEEKLY_METRICS[MOCK_WEEKLY_METRICS.length - 1].callsMade
        : 0,
      emailsSent: totalEmails,
      linkedInConnections: totalLinkedIn,
      callsMade: MOCK_WEEKLY_METRICS.reduce((sum, w) => sum + w.callsMade, 0),
      demosThisWeek: MOCK_WEEKLY_METRICS.length > 0
        ? MOCK_WEEKLY_METRICS[MOCK_WEEKLY_METRICS.length - 1].demosCompleted
        : 0,

      responseRate: Math.round(responseRate * 10) / 10,
      demoShowRate,
      avgDaysInPipeline: 14, // Mock average
      estimatedCAC: Math.round(estimatedCAC),
    }

    // Return weekly metrics only if requested
    if (weeklyOnly) {
      return NextResponse.json({
        weeklyMetrics: MOCK_WEEKLY_METRICS,
      })
    }

    // Return detailed response with leads
    if (detailed) {
      return NextResponse.json({
        metrics,
        weeklyMetrics: MOCK_WEEKLY_METRICS,
        leads: MOCK_LEADS,
        goals: {
          demosBooked: { current: statusCounts.demo_scheduled + statusCounts.demo_complete, target: 10 },
          responseRate: { current: responseRate, target: 15 },
          pipelineValue: { current: pipelineValue, target: 500000 },
        },
      })
    }

    // Return summary only
    return NextResponse.json({
      metrics,
      weeklyMetrics: MOCK_WEEKLY_METRICS,
    })
  } catch (error) {
    console.error('Error fetching pipeline:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pipeline data' },
      { status: 500 }
    )
  }
}
