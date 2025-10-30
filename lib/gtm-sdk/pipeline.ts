/**
 * @wells/gtm-sdk - Pipeline Tracker
 * Track deals through the sales pipeline
 */

import { Prospect, Opportunity, GTMMetrics } from './types'

export class PipelineTracker {
  private crm?: string
  private prospects: Prospect[] = []
  private opportunities: Opportunity[] = []

  constructor(crm?: string) {
    this.crm = crm
  }

  async storeProspects(prospects: Prospect[]): Promise<void> {
    this.prospects.push(...prospects)
    console.log(`[Pipeline] Stored ${prospects.length} prospects`)
  }

  async getProspectsForOutreach(options: {
    limit: number
    minICPScore: number
  }): Promise<Prospect[]> {
    const qualified = this.prospects.filter(
      p => p.icpScore >= options.minICPScore && p.status === 'discovered'
    )

    return qualified.slice(0, options.limit)
  }

  async getProspects(filters?: {
    status?: Prospect['status']
    minICPScore?: number
    limit?: number
  }): Promise<Prospect[]> {
    let filtered = this.prospects

    if (filters?.status) {
      filtered = filtered.filter(p => p.status === filters.status)
    }

    if (filters?.minICPScore) {
      filtered = filtered.filter(p => p.icpScore >= filters.minICPScore!)
    }

    if (filters?.limit) {
      filtered = filtered.slice(0, filters.limit)
    }

    return filtered
  }

  async createOpportunity(
    prospectId: string,
    amount: number,
    stage: Opportunity['stage']
  ): Promise<Opportunity> {
    const prospect = this.prospects.find(p => p.id === prospectId)

    const opportunity: Opportunity = {
      id: `opp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      prospectId,
      name: prospect ? `${prospect.company.name} - ${prospect.role}` : 'Opportunity',
      stage,
      amount,
      probability: this.getStageProbability(stage),
      expectedCloseDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      owner: 'sales_rep',
      activities: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.opportunities.push(opportunity)

    console.log(`[Pipeline] Created opportunity ${opportunity.id} for $${amount.toLocaleString()}`)

    return opportunity
  }

  async updateOpportunityStage(opportunityId: string, stage: Opportunity['stage']): Promise<void> {
    const opp = this.opportunities.find(o => o.id === opportunityId)
    if (opp) {
      opp.stage = stage
      opp.probability = this.getStageProbability(stage)
      opp.updatedAt = new Date()

      console.log(`[Pipeline] Updated opportunity ${opportunityId} to ${stage}`)
    }
  }

  async getOpportunities(filters?: {
    stage?: Opportunity['stage']
    minAmount?: number
  }): Promise<Opportunity[]> {
    let filtered = this.opportunities

    if (filters?.stage) {
      filtered = filtered.filter(o => o.stage === filters.stage)
    }

    if (filters?.minAmount) {
      filtered = filtered.filter(o => o.amount >= filters.minAmount!)
    }

    return filtered
  }

  async getMetrics(): Promise<GTMMetrics> {
    const totalProspects = this.prospects.length
    const qualifiedProspects = this.prospects.filter(p => p.icpScore >= 70).length
    const avgICPScore =
      this.prospects.reduce((sum, p) => sum + p.icpScore, 0) / totalProspects || 0

    const totalOpportunities = this.opportunities.length
    const totalPipelineValue = this.opportunities.reduce((sum, o) => sum + o.amount, 0)
    const closedWonOpps = this.opportunities.filter(o => o.stage === 'closed_won')
    const closedWonACV = closedWonOpps.reduce((sum, o) => sum + o.amount, 0)

    return {
      prospecting: {
        totalProspects,
        qualifiedProspects,
        averageICPScore: Math.round(avgICPScore),
        prospectsByStage: this.groupBy(this.prospects, 'status'),
        prospectsBySource: {},
      },
      outreach: {
        totalOutreach: 0,
        deliveryRate: 95,
        openRate: 40,
        replyRate: 12,
        positiveReplyRate: 8,
        averageResponseTime: 48,
      },
      meetings: {
        totalMeetings: 0,
        showRate: 85,
        conversionToOpportunity: 60,
        averageMeetingValue: 0,
        meetingsByType: {} as any,
      },
      pipeline: {
        totalOpportunities,
        totalPipelineValue,
        averageDealSize: totalOpportunities > 0 ? totalPipelineValue / totalOpportunities : 0,
        winRate: 0,
        averageSalesCycle: 90,
        opportunitiesByStage: this.groupBy(this.opportunities, 'stage'),
        forecastedRevenue: totalPipelineValue * 0.3,
      },
      revenue: {
        closedWonACV,
        wellsFee: closedWonACV * 0.0033, // 33bps
        totalInvoiced: 0,
        totalPaid: 0,
        outstandingAR: 0,
        averagePaymentTime: 30,
      },
    }
  }

  async syncWithCRM(): Promise<number> {
    // In production: sync with Salesforce, HubSpot, etc.
    console.log('[Pipeline] CRM sync not configured (demo mode)')
    return 0
  }

  private getStageProbability(stage: Opportunity['stage']): number {
    const probabilities: Record<Opportunity['stage'], number> = {
      discovery: 10,
      qualification: 20,
      demo: 40,
      proposal: 60,
      negotiation: 75,
      contract_review: 90,
      closed_won: 100,
      closed_lost: 0,
    }

    return probabilities[stage] || 0
  }

  private groupBy<T extends Record<string, any>>(arr: T[], key: keyof T): Record<string, number> {
    return arr.reduce((acc, item) => {
      const value = item[key]
      acc[value] = (acc[value] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }
}
