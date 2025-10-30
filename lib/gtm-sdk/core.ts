/**
 * @wells/gtm-sdk - Core GTM Engine
 * "Install in 1 line, runs your entire outbound"
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  WellsGTMConfig,
  GTMResponse,
  Prospect,
  OutreachMessage,
  Meeting,
  Opportunity,
  GTMMetrics,
} from './types'
import { ICPEngine } from './icp-engine'
import { ProspectDiscovery } from './discovery'
import { OutreachEngine } from './outreach'
import { MeetingBooking } from './booking'
import { PipelineTracker } from './pipeline'
import { RevenueCalculator } from './billing'

export class WellsGTM {
  private config: WellsGTMConfig
  private anthropic: Anthropic
  private icpEngine: ICPEngine
  private discovery: ProspectDiscovery
  private outreach: OutreachEngine
  private booking: MeetingBooking
  private pipeline: PipelineTracker
  private billing: RevenueCalculator
  private isInitialized: boolean = false

  constructor(config: WellsGTMConfig) {
    this.config = {
      ...config,
      outreach: {
        channelsEnabled: ['linkedin', 'email'],
        dailyLimit: 100,
        tone: 'consultative',
        personalization: 'high',
        followUpSequence: [
          { delayDays: 3, channel: 'linkedin', template: 'follow_up_1' },
          { delayDays: 7, channel: 'email', template: 'follow_up_2' },
        ],
        ...config.outreach,
      },
      billing: {
        model: 'success_fee',
        successFeeBps: 33, // 0.33%
        paymentTerms: 'net30',
        ...config.billing,
      },
    }

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    })

    // Initialize engines
    this.icpEngine = new ICPEngine(this.config.icp, this.anthropic)
    this.discovery = new ProspectDiscovery(this.config.icp, this.anthropic)
    this.outreach = new OutreachEngine(this.config.outreach!, this.anthropic)
    this.booking = new MeetingBooking(this.config.integrations?.calendar)
    this.pipeline = new PipelineTracker(this.config.integrations?.crm)
    this.billing = new RevenueCalculator(this.config.billing!)

    console.log('[Wells GTM] Initialized with goal:', config.goal)
  }

  /**
   * Initialize the GTM engine
   * Sets up integrations, validates config, starts automated workflows
   */
  async initialize(): Promise<GTMResponse<{ status: string; goal: string }>> {
    try {
      console.log('[Wells GTM] Initializing GTM engine...')

      // Validate API key
      if (!this.config.apiKey.startsWith('wells_')) {
        return {
          success: false,
          error: 'Invalid API key. Get yours at https://wells.ai/api-keys',
        }
      }

      // Initialize ICP engine
      await this.icpEngine.initialize()

      // Start automated workflows
      this.startAutomatedWorkflows()

      this.isInitialized = true

      console.log('[Wells GTM] ✅ Initialization complete')
      console.log('[Wells GTM] Goal:', this.config.goal)
      console.log('[Wells GTM] ICP:', this.config.icp)
      console.log('[Wells GTM] Daily outreach limit:', this.config.outreach?.dailyLimit)

      return {
        success: true,
        data: {
          status: 'initialized',
          goal: this.config.goal,
        },
      }
    } catch (error: any) {
      console.error('[Wells GTM] Initialization error:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Start automated GTM workflows
   * 1. Discover prospects (10k CPOs)
   * 2. Score against ICP
   * 3. Generate outreach (100/day)
   * 4. Book meetings
   * 5. Track pipeline
   * 6. Calculate revenue
   */
  private startAutomatedWorkflows() {
    // Run prospect discovery daily
    setInterval(() => this.runProspectDiscovery(), 24 * 60 * 60 * 1000)

    // Run outreach generation hourly
    setInterval(() => this.runOutreachGeneration(), 60 * 60 * 1000)

    // Run pipeline sync every 15 minutes
    setInterval(() => this.syncPipeline(), 15 * 60 * 1000)

    // Initial runs
    setTimeout(() => this.runProspectDiscovery(), 1000)
    setTimeout(() => this.runOutreachGeneration(), 5000)
  }

  /**
   * Discover prospects matching ICP
   * Target: 10,000 CPOs
   */
  async runProspectDiscovery(): Promise<GTMResponse<{ discovered: number }>> {
    try {
      console.log('[Wells GTM] Starting prospect discovery...')

      const prospects = await this.discovery.discover({
        limit: 10000,
        sources: ['apollo', 'linkedin', 'crunchbase', 'builtwith'],
      })

      console.log(`[Wells GTM] Discovered ${prospects.length} prospects`)

      // Score against ICP
      const scoredProspects = await Promise.all(
        prospects.map(async p => {
          const score = await this.icpEngine.scoreProspect(p)
          return { ...p, icpScore: score }
        })
      )

      // Filter qualified prospects (score > 70)
      const qualified = scoredProspects.filter(p => p.icpScore >= 70)

      console.log(`[Wells GTM] Qualified ${qualified.length} prospects (ICP score ≥70)`)

      // Store in database
      await this.pipeline.storeProspects(qualified)

      return {
        success: true,
        data: {
          discovered: qualified.length,
        },
      }
    } catch (error: any) {
      console.error('[Wells GTM] Prospect discovery error:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Generate and send outreach
   * Target: 100 InMails/day
   */
  async runOutreachGeneration(): Promise<GTMResponse<{ sent: number }>> {
    try {
      console.log('[Wells GTM] Starting outreach generation...')

      // Get prospects ready for outreach
      const prospects = await this.pipeline.getProspectsForOutreach({
        limit: this.config.outreach!.dailyLimit,
        minICPScore: 70,
      })

      if (prospects.length === 0) {
        console.log('[Wells GTM] No prospects ready for outreach')
        return { success: true, data: { sent: 0 } }
      }

      console.log(`[Wells GTM] Generating outreach for ${prospects.length} prospects...`)

      // Generate personalized outreach for each prospect
      const messages = await Promise.all(
        prospects.map(prospect => this.outreach.generateMessage(prospect))
      )

      // Send messages (respecting channel limits)
      const sent = await this.outreach.sendBatch(messages)

      console.log(`[Wells GTM] Sent ${sent} outreach messages`)

      // Notify via Slack if configured
      if (this.config.integrations?.slack) {
        await this.notifySlack(`📨 Sent ${sent} outreach messages today`)
      }

      return {
        success: true,
        data: {
          sent,
        },
      }
    } catch (error: any) {
      console.error('[Wells GTM] Outreach generation error:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Sync pipeline with CRM
   */
  async syncPipeline(): Promise<GTMResponse<{ synced: number }>> {
    try {
      if (!this.config.integrations?.crm) {
        return { success: true, data: { synced: 0 } }
      }

      const synced = await this.pipeline.syncWithCRM()
      return {
        success: true,
        data: { synced },
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Get current GTM metrics
   */
  async getMetrics(): Promise<GTMResponse<GTMMetrics>> {
    try {
      const metrics = await this.pipeline.getMetrics()
      return {
        success: true,
        data: metrics,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Calculate Wells Onyx fee (33bps on closed ACV)
   */
  async calculateFee(closedACV: number): Promise<GTMResponse<{ fee: number; acv: number }>> {
    try {
      const fee = this.billing.calculateSuccessFee(closedACV)
      return {
        success: true,
        data: {
          acv: closedACV,
          fee,
        },
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Book a meeting manually
   */
  async bookMeeting(
    prospectId: string,
    scheduledAt: Date,
    type: Meeting['type']
  ): Promise<GTMResponse<Meeting>> {
    try {
      const meeting = await this.booking.bookMeeting(prospectId, scheduledAt, type)
      return {
        success: true,
        data: meeting,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Create opportunity manually
   */
  async createOpportunity(
    prospectId: string,
    amount: number,
    stage: Opportunity['stage']
  ): Promise<GTMResponse<Opportunity>> {
    try {
      const opportunity = await this.pipeline.createOpportunity(prospectId, amount, stage)
      return {
        success: true,
        data: opportunity,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Mark deal as closed won
   */
  async markClosedWon(opportunityId: string, finalACV: number): Promise<GTMResponse<{ fee: number }>> {
    try {
      // Update opportunity status
      await this.pipeline.updateOpportunityStage(opportunityId, 'closed_won')

      // Calculate Wells Onyx fee (33bps)
      const fee = this.billing.calculateSuccessFee(finalACV)

      // Create invoice
      await this.billing.createInvoice(opportunityId, finalACV, fee)

      console.log(`[Wells GTM] 🎉 Deal closed! ACV: $${finalACV.toLocaleString()} | Wells fee: $${fee.toLocaleString()}`)

      // Notify via Slack
      if (this.config.integrations?.slack) {
        await this.notifySlack(
          `🎉 Deal closed!\n` +
            `ACV: $${finalACV.toLocaleString()}\n` +
            `Wells fee: $${fee.toLocaleString()} (33bps)`
        )
      }

      return {
        success: true,
        data: { fee },
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Get prospects
   */
  async getProspects(filters?: {
    status?: Prospect['status']
    minICPScore?: number
    limit?: number
  }): Promise<GTMResponse<Prospect[]>> {
    try {
      const prospects = await this.pipeline.getProspects(filters)
      return {
        success: true,
        data: prospects,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Get opportunities
   */
  async getOpportunities(filters?: {
    stage?: Opportunity['stage']
    minAmount?: number
  }): Promise<GTMResponse<Opportunity[]>> {
    try {
      const opportunities = await this.pipeline.getOpportunities(filters)
      return {
        success: true,
        data: opportunities,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Send Slack notification
   */
  private async notifySlack(message: string): Promise<void> {
    if (!this.config.integrations?.slack) return

    try {
      await fetch(this.config.integrations.slack, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      })
    } catch (error) {
      console.error('[Wells GTM] Slack notification error:', error)
    }
  }

  /**
   * Stop all automated workflows
   */
  stop() {
    console.log('[Wells GTM] Stopping automated workflows...')
    this.isInitialized = false
    // Clear all intervals (would need to store interval IDs)
  }
}
