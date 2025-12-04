// @ts-nocheck
/**
 * Cold Start Protocol - Orchestration Engine
 *
 * The brain of the autonomous demand generation system.
 * Coordinates all services, manages campaigns, handles escalations,
 * and ensures continuous progress toward goals.
 *
 * Key responsibilities:
 * - Parse natural language commands into campaign specifications
 * - Coordinate Apollo, LinkedIn, RFP, and Partnership services
 * - Manage action queues with priority scheduling
 * - Track campaign state and progress
 * - Handle escalations and owner notifications
 * - Autonomous decision-making within defined boundaries
 */

import type {
  ColdStartRequest,
  ColdStartResponse,
  ColdStartCampaign,
  CampaignType,
  CampaignStatus,
  CampaignAction,
  ActionType,
  ActionStatus,
  ActionResult,
  IcpDefinition,
  Prospect,
  Channel,
  EscalationRule,
  Escalation,
  CampaignStats,
  ColdStartConfig,
  OutreachSequence,
  FollowUpSequence,
} from '../types'

import { ApolloService, executeApolloSearch, executeApolloEnrich } from './apollo-service'
import { LinkedInService, executeLinkedInSearch, executeLinkedInConnection, executeLinkedInMessage } from './linkedin-service'
import { RfpHunterService, executeRfpDiscovery, executeRfpResponse, executeRfpSubmission } from './rfp-service'
import { PartnershipService, executePortalDiscovery, executePortalRegistration } from './partnership-service'

// ============================================================================
// ORCHESTRATOR
// ============================================================================

export class ColdStartOrchestrator {
  private config: ColdStartConfig

  // Services
  private apolloService?: ApolloService
  private linkedInService?: LinkedInService
  private rfpService?: RfpHunterService
  private partnershipService?: PartnershipService

  // State
  private campaigns: Map<string, ColdStartCampaign> = new Map()
  private actionQueue: CampaignAction[] = []
  private escalations: Map<string, Escalation> = new Map()
  private prospects: Map<string, Prospect> = new Map()

  // Execution state
  private isRunning: boolean = false
  private dailyActionsExecuted: number = 0
  private lastResetDate: string = ''

  constructor(config: ColdStartConfig) {
    this.config = config
    this.initializeServices()
  }

  private initializeServices(): void {
    // Initialize services based on available credentials
    const { credentials } = this.config

    if (credentials.apollo?.apiKey) {
      this.apolloService = new ApolloService(credentials.apollo.apiKey)
    }

    if (credentials.linkedin?.sessionCookie) {
      this.linkedInService = new LinkedInService(
        credentials.linkedin.sessionCookie,
        credentials.linkedinRecruiter?.sessionCookie
      )
    }

    this.rfpService = new RfpHunterService(this.config)
    this.partnershipService = new PartnershipService(this.config)
  }

  // --------------------------------------------------------------------------
  // COMMAND PARSING - Natural language to campaign spec
  // --------------------------------------------------------------------------

  async parseCommand(request: ColdStartRequest): Promise<ColdStartResponse> {
    const { command, campaignType, targetDescription, icp } = request

    // If structured request, use it directly
    if (campaignType && icp) {
      return this.createCampaignFromSpec({
        type: campaignType,
        icp: icp as IcpDefinition,
        channels: request.channels || ['apollo', 'linkedin'],
      })
    }

    // Parse natural language command
    const parsed = this.parseNaturalLanguage(command)

    if (parsed.clarificationNeeded) {
      return {
        success: false,
        clarificationNeeded: true,
        questions: parsed.questions,
      }
    }

    return this.createCampaignFromSpec(parsed)
  }

  private parseNaturalLanguage(command: string): ParsedCommand {
    const lower = command.toLowerCase()
    const parsed: ParsedCommand = {
      type: 'full_blitz',
      icp: this.createDefaultIcp(),
      channels: [],
      clarificationNeeded: false,
      questions: [],
    }

    // Detect campaign type
    if (lower.includes('supplier') || lower.includes('vendor')) {
      parsed.type = 'supplier_acquisition'
    } else if (lower.includes('buyer') || lower.includes('customer') || lower.includes('client')) {
      parsed.type = 'buyer_acquisition'
    } else if (lower.includes('founder') || lower.includes('startup')) {
      parsed.type = 'founder_outreach'
    } else if (lower.includes('talent') || lower.includes('hire') || lower.includes('recruit')) {
      parsed.type = 'talent_sourcing'
    } else if (lower.includes('rfp') || lower.includes('bid') || lower.includes('proposal')) {
      parsed.type = 'rfp_response'
    } else if (lower.includes('partner') || lower.includes('integration')) {
      parsed.type = 'partnership_registration'
    }

    // Extract industry/vertical
    const industries = this.extractIndustries(command)
    if (industries.length > 0) {
      parsed.icp.industries = industries
    }

    // Extract locations
    const locations = this.extractLocations(command)
    if (locations.length > 0) {
      parsed.icp.locations = locations
    }

    // Extract titles
    const titles = this.extractTitles(command)
    if (titles.length > 0) {
      parsed.icp.titles = titles
    }

    // Extract company size signals
    const sizeSignals = this.extractSizeSignals(command)
    if (sizeSignals.min) parsed.icp.companySizeMin = sizeSignals.min
    if (sizeSignals.max) parsed.icp.companySizeMax = sizeSignals.max

    // Extract keywords
    parsed.icp.keywords = this.extractKeywords(command)

    // Determine channels
    if (lower.includes('linkedin')) {
      parsed.channels.push('linkedin')
      if (lower.includes('recruiter')) {
        parsed.channels.push('linkedin_recruiter')
      }
    }
    if (lower.includes('apollo') || lower.includes('email')) {
      parsed.channels.push('apollo')
      parsed.channels.push('email')
    }
    if (lower.includes('rfp')) {
      parsed.channels.push('rfp_portal')
    }
    if (lower.includes('partner')) {
      parsed.channels.push('partnership_form')
    }

    // Default channels if none specified
    if (parsed.channels.length === 0) {
      parsed.channels = ['apollo', 'linkedin', 'email']
    }

    // Generate name from command
    parsed.name = this.generateCampaignName(command, parsed.type)

    return parsed
  }

  private extractIndustries(command: string): string[] {
    const industries: string[] = []
    const lower = command.toLowerCase()

    const industryKeywords: Record<string, string> = {
      'law firm': 'legal',
      'legal': 'legal',
      'attorney': 'legal',
      'lawyer': 'legal',
      'tort': 'legal',
      'litigation': 'legal',
      'tech': 'technology',
      'software': 'technology',
      'saas': 'technology',
      'fintech': 'financial_services',
      'finance': 'financial_services',
      'bank': 'financial_services',
      'healthcare': 'healthcare',
      'hospital': 'healthcare',
      'medical': 'healthcare',
      'manufacturing': 'manufacturing',
      'factory': 'manufacturing',
      'construction': 'construction',
      'real estate': 'real_estate',
      'property': 'real_estate',
      'retail': 'retail',
      'ecommerce': 'retail',
      'restaurant': 'hospitality',
      'hotel': 'hospitality',
      'education': 'education',
      'school': 'education',
      'university': 'education',
    }

    for (const [keyword, industry] of Object.entries(industryKeywords)) {
      if (lower.includes(keyword) && !industries.includes(industry)) {
        industries.push(industry)
      }
    }

    return industries
  }

  private extractLocations(command: string): string[] {
    const locations: string[] = []
    const lower = command.toLowerCase()

    // US States
    const states = [
      'california', 'texas', 'florida', 'new york', 'illinois',
      'pennsylvania', 'ohio', 'georgia', 'north carolina', 'michigan'
    ]

    // Major cities
    const cities = [
      'miami', 'new york', 'los angeles', 'chicago', 'houston',
      'phoenix', 'philadelphia', 'san antonio', 'san diego', 'dallas',
      'san francisco', 'seattle', 'boston', 'denver', 'austin'
    ]

    for (const state of states) {
      if (lower.includes(state)) {
        locations.push(state)
      }
    }

    for (const city of cities) {
      if (lower.includes(city)) {
        locations.push(city)
      }
    }

    // Check for national/US-wide
    if (lower.includes('nationwide') || lower.includes('national') || lower.includes('us-wide')) {
      locations.push('United States')
    }

    return locations
  }

  private extractTitles(command: string): string[] {
    const titles: string[] = []
    const lower = command.toLowerCase()

    const titleKeywords: Record<string, string[]> = {
      'ceo': ['CEO', 'Chief Executive Officer'],
      'cfo': ['CFO', 'Chief Financial Officer'],
      'cto': ['CTO', 'Chief Technology Officer'],
      'coo': ['COO', 'Chief Operating Officer'],
      'cio': ['CIO', 'Chief Information Officer'],
      'founder': ['Founder', 'Co-Founder'],
      'partner': ['Partner', 'Managing Partner'],
      'director': ['Director'],
      'vp': ['VP', 'Vice President'],
      'head of': ['Head of'],
      'manager': ['Manager'],
      'procurement': ['Procurement Director', 'Procurement Manager', 'Head of Procurement'],
      'purchasing': ['Purchasing Manager', 'Purchasing Director'],
      'hr': ['HR Director', 'HR Manager', 'Head of HR', 'CHRO'],
    }

    for (const [keyword, matchedTitles] of Object.entries(titleKeywords)) {
      if (lower.includes(keyword)) {
        titles.push(...matchedTitles)
      }
    }

    // Remove duplicates
    return [...new Set(titles)]
  }

  private extractSizeSignals(command: string): { min?: number; max?: number } {
    const lower = command.toLowerCase()

    if (lower.includes('enterprise') || lower.includes('large')) {
      return { min: 1000 }
    }
    if (lower.includes('mid-market') || lower.includes('midsize')) {
      return { min: 100, max: 1000 }
    }
    if (lower.includes('smb') || lower.includes('small')) {
      return { min: 10, max: 100 }
    }
    if (lower.includes('startup')) {
      return { min: 1, max: 50 }
    }

    return {}
  }

  private extractKeywords(command: string): string[] {
    // Extract meaningful keywords, excluding common words
    const stopWords = new Set([
      'cold', 'start', 'protocol', 'for', 'the', 'and', 'or', 'a', 'an',
      'need', 'want', 'find', 'get', 'reach', 'out', 'to', 'with', 'in',
      'at', 'on', 'by', 'from', 'i', 'we', 'me', 'wells', 'campaign'
    ])

    return command
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 5)
  }

  private generateCampaignName(command: string, type: CampaignType): string {
    const typeNames: Record<CampaignType, string> = {
      supplier_acquisition: 'Supplier',
      buyer_acquisition: 'Buyer',
      founder_outreach: 'Founder',
      talent_sourcing: 'Talent',
      partnership_registration: 'Partnership',
      rfp_response: 'RFP',
      full_blitz: 'Blitz',
    }

    // Extract first industry keyword
    const industries = this.extractIndustries(command)
    const industry = industries[0] || 'General'

    const date = new Date().toISOString().slice(0, 10)

    return `${typeNames[type]} - ${this.capitalize(industry)} - ${date}`
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  private createDefaultIcp(): IcpDefinition {
    return {
      id: `icp_${Date.now()}`,
      name: 'Default ICP',
      description: '',
      industries: [],
      titles: [],
      seniorities: ['c_suite', 'vp', 'director'],
    }
  }

  // --------------------------------------------------------------------------
  // CAMPAIGN CREATION
  // --------------------------------------------------------------------------

  private async createCampaignFromSpec(spec: ParsedCommand): Promise<ColdStartResponse> {
    const campaignId = `campaign_${Date.now()}`

    const campaign: ColdStartCampaign = {
      id: campaignId,
      name: spec.name || `Cold Start - ${new Date().toISOString()}`,
      description: `Autonomous ${spec.type} campaign`,
      type: spec.type,
      status: 'draft',

      icp: spec.icp,
      channels: spec.channels,

      targetProspects: 100,
      dailyLimit: this.config.dailyActionLimit || 50,

      startDate: new Date().toISOString(),
      scheduleHours: { start: 9, end: 17 },
      timezone: 'America/New_York',

      outreachSequence: this.createDefaultOutreachSequence(spec.type),
      followUpSequence: {
        maxFollowUps: 3,
        followUpDelayDays: 3,
        stopOnReply: true,
        stopOnMeeting: true,
      },

      stats: this.createEmptyStats(),
      escalationRules: this.createDefaultEscalationRules(),

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    this.campaigns.set(campaignId, campaign)

    // Estimate results
    const estimates = await this.estimateCampaignResults(campaign)

    return {
      success: true,
      campaignId,
      campaign,
      estimatedProspects: estimates.prospects,
      estimatedActions: estimates.actions,
      estimatedDuration: estimates.duration,
    }
  }

  private createDefaultOutreachSequence(type: CampaignType): OutreachSequence {
    const sequences: Record<CampaignType, OutreachSequence> = {
      supplier_acquisition: {
        id: 'seq_supplier',
        name: 'Supplier Outreach',
        steps: [
          { stepNumber: 1, channel: 'linkedin', action: 'send_connection', delayDays: 0 },
          { stepNumber: 2, channel: 'email', action: 'send_email', delayDays: 1 },
          { stepNumber: 3, channel: 'linkedin', action: 'send_inmail', delayDays: 3 },
        ],
      },
      buyer_acquisition: {
        id: 'seq_buyer',
        name: 'Buyer Outreach',
        steps: [
          { stepNumber: 1, channel: 'apollo', action: 'enrich_prospect', delayDays: 0 },
          { stepNumber: 2, channel: 'linkedin', action: 'send_connection', delayDays: 0 },
          { stepNumber: 3, channel: 'email', action: 'send_email', delayDays: 1 },
          { stepNumber: 4, channel: 'linkedin', action: 'send_inmail', delayDays: 4 },
        ],
      },
      founder_outreach: {
        id: 'seq_founder',
        name: 'Founder Outreach',
        steps: [
          { stepNumber: 1, channel: 'linkedin', action: 'send_connection', delayDays: 0 },
          { stepNumber: 2, channel: 'linkedin', action: 'send_inmail', delayDays: 2 },
        ],
      },
      talent_sourcing: {
        id: 'seq_talent',
        name: 'Talent Sourcing',
        steps: [
          { stepNumber: 1, channel: 'linkedin_recruiter', action: 'send_inmail', delayDays: 0 },
          { stepNumber: 2, channel: 'email', action: 'send_email', delayDays: 2 },
        ],
      },
      partnership_registration: {
        id: 'seq_partnership',
        name: 'Partnership Registration',
        steps: [
          { stepNumber: 1, channel: 'partnership_form', action: 'submit_form', delayDays: 0 },
        ],
      },
      rfp_response: {
        id: 'seq_rfp',
        name: 'RFP Response',
        steps: [
          { stepNumber: 1, channel: 'rfp_portal', action: 'respond_to_rfp', delayDays: 0 },
        ],
      },
      full_blitz: {
        id: 'seq_blitz',
        name: 'Full Blitz',
        steps: [
          { stepNumber: 1, channel: 'apollo', action: 'search_prospects', delayDays: 0 },
          { stepNumber: 2, channel: 'linkedin', action: 'send_connection', delayDays: 0 },
          { stepNumber: 3, channel: 'email', action: 'send_email', delayDays: 1 },
          { stepNumber: 4, channel: 'partnership_form', action: 'submit_form', delayDays: 0 },
          { stepNumber: 5, channel: 'rfp_portal', action: 'respond_to_rfp', delayDays: 0 },
        ],
      },
    }

    return sequences[type]
  }

  private createEmptyStats(): CampaignStats {
    return {
      prospectsFound: 0,
      prospectsContacted: 0,
      prospectsEnriched: 0,
      emailsSent: 0,
      emailsOpened: 0,
      emailsClicked: 0,
      connectionsSent: 0,
      connectionsAccepted: 0,
      inmailsSent: 0,
      totalResponses: 0,
      positiveResponses: 0,
      negativeResponses: 0,
      meetingsBooked: 0,
      conversions: 0,
      conversionRate: 0,
      rfpsFound: 0,
      rfpsSubmitted: 0,
      rfpsWon: 0,
      formsSubmitted: 0,
      partnershipsApproved: 0,
      escalations: 0,
      escalationsResolved: 0,
      actionsPerDay: 0,
      successRate: 0,
      avgResponseTime: 0,
    }
  }

  private createDefaultEscalationRules(): EscalationRule[] {
    return [
      {
        condition: { type: 'response_sentiment', value: 'negative' },
        action: 'notify',
        priority: 'medium',
        notificationChannel: 'email',
      },
      {
        condition: { type: 'high_value_prospect', scoreThreshold: 80 },
        action: 'require_approval',
        priority: 'high',
        notificationChannel: 'email',
      },
      {
        condition: { type: 'meeting_request' },
        action: 'notify',
        priority: 'critical',
        notificationChannel: 'email',
      },
      {
        condition: { type: 'multiple_failures', threshold: 5 },
        action: 'pause_campaign',
        priority: 'high',
        notificationChannel: 'email',
      },
      {
        condition: { type: 'legal_concern', keywords: ['lawsuit', 'attorney', 'legal action'] },
        action: 'pause_prospect',
        priority: 'critical',
        notificationChannel: 'email',
      },
    ]
  }

  private async estimateCampaignResults(campaign: ColdStartCampaign): Promise<{
    prospects: number
    actions: number
    duration: string
  }> {
    // Rough estimates based on ICP and channels
    const baseProspects = campaign.targetProspects

    // Estimate actions needed
    const actionsPerProspect = campaign.outreachSequence.steps.length
    const totalActions = baseProspects * actionsPerProspect

    // Duration based on daily limit
    const daysNeeded = Math.ceil(totalActions / campaign.dailyLimit)
    const duration = daysNeeded > 7 ? `${Math.ceil(daysNeeded / 7)} weeks` : `${daysNeeded} days`

    return {
      prospects: baseProspects,
      actions: totalActions,
      duration,
    }
  }

  // --------------------------------------------------------------------------
  // CAMPAIGN EXECUTION
  // --------------------------------------------------------------------------

  async startCampaign(campaignId: string): Promise<ActionResult> {
    const campaign = this.campaigns.get(campaignId)
    if (!campaign) {
      return { success: false, error: 'Campaign not found' }
    }

    campaign.status = 'active'
    campaign.updatedAt = new Date().toISOString()
    this.campaigns.set(campaignId, campaign)

    // Queue initial actions
    await this.queueInitialActions(campaign)

    // Start execution loop if not already running
    if (!this.isRunning) {
      this.startExecutionLoop()
    }

    return { success: true }
  }

  async pauseCampaign(campaignId: string): Promise<ActionResult> {
    const campaign = this.campaigns.get(campaignId)
    if (!campaign) {
      return { success: false, error: 'Campaign not found' }
    }

    campaign.status = 'paused'
    campaign.updatedAt = new Date().toISOString()
    this.campaigns.set(campaignId, campaign)

    return { success: true }
  }

  private async queueInitialActions(campaign: ColdStartCampaign): Promise<void> {
    // Based on campaign type, queue different initial actions
    switch (campaign.type) {
      case 'supplier_acquisition':
      case 'buyer_acquisition':
      case 'founder_outreach':
      case 'talent_sourcing':
        await this.queueProspectingActions(campaign)
        break

      case 'rfp_response':
        await this.queueRfpActions(campaign)
        break

      case 'partnership_registration':
        await this.queuePartnershipActions(campaign)
        break

      case 'full_blitz':
        await this.queueProspectingActions(campaign)
        await this.queueRfpActions(campaign)
        await this.queuePartnershipActions(campaign)
        break
    }
  }

  private async queueProspectingActions(campaign: ColdStartCampaign): Promise<void> {
    // Queue Apollo search
    if (campaign.channels.includes('apollo') && this.apolloService) {
      this.actionQueue.push({
        id: `action_${Date.now()}_apollo_search`,
        campaignId: campaign.id,
        type: 'search_prospects',
        channel: 'apollo',
        status: 'pending',
        payload: { icp: campaign.icp, page: 1, perPage: 25 },
        attempts: 0,
        maxAttempts: 3,
        scheduledAt: new Date().toISOString(),
      })
    }

    // Queue LinkedIn search
    if (campaign.channels.includes('linkedin') && this.linkedInService) {
      this.actionQueue.push({
        id: `action_${Date.now()}_linkedin_search`,
        campaignId: campaign.id,
        type: 'search_prospects',
        channel: 'linkedin',
        status: 'pending',
        payload: { icp: campaign.icp },
        attempts: 0,
        maxAttempts: 3,
        scheduledAt: new Date().toISOString(),
      })
    }
  }

  private async queueRfpActions(campaign: ColdStartCampaign): Promise<void> {
    if (!this.rfpService) return

    this.actionQueue.push({
      id: `action_${Date.now()}_rfp_discover`,
      campaignId: campaign.id,
      type: 'search_prospects', // Search for RFPs
      channel: 'rfp_portal',
      status: 'pending',
      payload: {
        keywords: campaign.icp.keywords,
        industries: campaign.icp.industries,
      },
      attempts: 0,
      maxAttempts: 3,
      scheduledAt: new Date().toISOString(),
    })
  }

  private async queuePartnershipActions(campaign: ColdStartCampaign): Promise<void> {
    if (!this.partnershipService) return

    this.actionQueue.push({
      id: `action_${Date.now()}_partnership_discover`,
      campaignId: campaign.id,
      type: 'submit_form',
      channel: 'partnership_form',
      status: 'pending',
      payload: {
        industries: campaign.icp.industries,
        webSearch: true,
      },
      attempts: 0,
      maxAttempts: 3,
      scheduledAt: new Date().toISOString(),
    })
  }

  // --------------------------------------------------------------------------
  // EXECUTION LOOP
  // --------------------------------------------------------------------------

  private async startExecutionLoop(): Promise<void> {
    this.isRunning = true

    while (this.isRunning) {
      // Reset daily counters if new day
      this.checkDailyReset()

      // Check if we've hit daily limit
      if (this.dailyActionsExecuted >= this.config.dailyActionLimit) {
        console.log('Daily action limit reached, waiting...')
        await this.sleep(60 * 60 * 1000) // Wait 1 hour
        continue
      }

      // Check if within business hours
      if (!this.isWithinBusinessHours()) {
        console.log('Outside business hours, waiting...')
        await this.sleep(30 * 60 * 1000) // Wait 30 minutes
        continue
      }

      // Get next action
      const action = this.getNextAction()
      if (!action) {
        console.log('No pending actions, waiting...')
        await this.sleep(5 * 60 * 1000) // Wait 5 minutes
        continue
      }

      // Execute action
      const result = await this.executeAction(action)

      // Update action status
      action.result = result
      action.completedAt = new Date().toISOString()
      action.status = result.success ? 'completed' : 'failed'

      // Handle result
      await this.handleActionResult(action, result)

      this.dailyActionsExecuted++

      // Rate limiting between actions
      await this.sleep(this.getActionDelay(action.channel))
    }
  }

  private checkDailyReset(): void {
    const today = new Date().toISOString().slice(0, 10)
    if (today !== this.lastResetDate) {
      this.dailyActionsExecuted = 0
      this.lastResetDate = today
      console.log('Daily action counter reset')
    }
  }

  private isWithinBusinessHours(): boolean {
    const now = new Date()
    const hour = now.getHours()
    return hour >= 9 && hour < 17
  }

  private getNextAction(): CampaignAction | undefined {
    // Sort by priority (scheduled time)
    this.actionQueue.sort((a, b) =>
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    )

    // Find first pending action that's due
    const now = new Date()
    return this.actionQueue.find(action =>
      action.status === 'pending' &&
      new Date(action.scheduledAt) <= now
    )
  }

  private async executeAction(action: CampaignAction): Promise<ActionResult> {
    action.status = 'in_progress'
    action.startedAt = new Date().toISOString()
    action.attempts++

    try {
      switch (action.channel) {
        case 'apollo':
          return await this.executeApolloAction(action)

        case 'linkedin':
        case 'linkedin_recruiter':
          return await this.executeLinkedInAction(action)

        case 'rfp_portal':
          return await this.executeRfpAction(action)

        case 'partnership_form':
          return await this.executePartnershipAction(action)

        case 'email':
          return await this.executeEmailAction(action)

        default:
          return { success: false, error: `Unknown channel: ${action.channel}` }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Action execution failed',
      }
    }
  }

  private async executeApolloAction(action: CampaignAction): Promise<ActionResult> {
    if (!this.apolloService) {
      return { success: false, error: 'Apollo service not configured' }
    }

    switch (action.type) {
      case 'search_prospects':
        return executeApolloSearch(this.apolloService, action)

      case 'enrich_prospect':
        return executeApolloEnrich(this.apolloService, action)

      default:
        return { success: false, error: `Unknown Apollo action: ${action.type}` }
    }
  }

  private async executeLinkedInAction(action: CampaignAction): Promise<ActionResult> {
    if (!this.linkedInService) {
      return { success: false, error: 'LinkedIn service not configured' }
    }

    switch (action.type) {
      case 'search_prospects':
        return executeLinkedInSearch(this.linkedInService, action)

      case 'send_connection':
        return executeLinkedInConnection(this.linkedInService, action)

      case 'send_inmail':
        return executeLinkedInMessage(this.linkedInService, action)

      default:
        return { success: false, error: `Unknown LinkedIn action: ${action.type}` }
    }
  }

  private async executeRfpAction(action: CampaignAction): Promise<ActionResult> {
    if (!this.rfpService) {
      return { success: false, error: 'RFP service not configured' }
    }

    switch (action.type) {
      case 'search_prospects':
        return executeRfpDiscovery(this.rfpService, action)

      case 'respond_to_rfp':
        return executeRfpResponse(this.rfpService, action)

      default:
        return { success: false, error: `Unknown RFP action: ${action.type}` }
    }
  }

  private async executePartnershipAction(action: CampaignAction): Promise<ActionResult> {
    if (!this.partnershipService) {
      return { success: false, error: 'Partnership service not configured' }
    }

    switch (action.type) {
      case 'search_prospects':
        return executePortalDiscovery(this.partnershipService, action)

      case 'submit_form':
        return executePortalRegistration(this.partnershipService, action)

      default:
        return { success: false, error: `Unknown partnership action: ${action.type}` }
    }
  }

  private async executeEmailAction(action: CampaignAction): Promise<ActionResult> {
    // Would integrate with email service (SendGrid, etc.)
    console.log('Would send email:', action.payload)
    return {
      success: true,
      data: { method: 'email', messageId: `email_${Date.now()}` },
    }
  }

  private getActionDelay(channel: Channel): number {
    // Delays between actions per channel (in ms)
    const delays: Record<Channel, number> = {
      apollo: 5000,
      linkedin: 30000,
      linkedin_recruiter: 30000,
      email: 2000,
      rfp_portal: 60000,
      partnership_form: 60000,
      internal_database: 1000,
      web_scrape: 10000,
    }
    return delays[channel] || 5000
  }

  // --------------------------------------------------------------------------
  // RESULT HANDLING
  // --------------------------------------------------------------------------

  private async handleActionResult(action: CampaignAction, result: ActionResult): Promise<void> {
    const campaign = this.campaigns.get(action.campaignId)
    if (!campaign) return

    if (result.success) {
      // Update campaign stats
      this.updateCampaignStats(campaign, action, result)

      // Queue follow-up actions
      await this.queueFollowUpActions(campaign, action, result)
    } else {
      // Handle failure
      if (action.attempts < action.maxAttempts) {
        // Retry later
        action.status = 'pending'
        action.scheduledAt = new Date(
          Date.now() + 15 * 60 * 1000 // Retry in 15 minutes
        ).toISOString()
      } else {
        // Max retries reached - escalate
        action.status = 'escalated'
        action.escalationReason = result.error || 'Max retries exceeded'
        await this.createEscalation(campaign, action, 'Action failed after max retries')
      }
    }

    // Check escalation rules
    await this.checkEscalationRules(campaign, action, result)
  }

  private updateCampaignStats(
    campaign: ColdStartCampaign,
    action: CampaignAction,
    result: ActionResult
  ): void {
    const stats = campaign.stats

    switch (action.type) {
      case 'search_prospects':
        stats.prospectsFound += (result.data?.prospects?.length || 0)
        break

      case 'enrich_prospect':
        stats.prospectsEnriched += (result.data?.enrichedCount || 0)
        break

      case 'send_connection':
        stats.connectionsSent++
        stats.prospectsContacted++
        break

      case 'send_inmail':
        stats.inmailsSent++
        break

      case 'send_email':
        stats.emailsSent++
        break

      case 'submit_form':
        stats.formsSubmitted++
        break

      case 'respond_to_rfp':
        stats.rfpsSubmitted++
        break
    }

    // Update conversion rate
    if (stats.prospectsContacted > 0) {
      stats.conversionRate = (stats.conversions / stats.prospectsContacted) * 100
    }

    campaign.updatedAt = new Date().toISOString()
    this.campaigns.set(campaign.id, campaign)
  }

  private async queueFollowUpActions(
    campaign: ColdStartCampaign,
    action: CampaignAction,
    result: ActionResult
  ): Promise<void> {
    // If search returned prospects, queue connection/email actions
    if (action.type === 'search_prospects' && result.data?.prospects) {
      const prospects = result.data.prospects as Partial<Prospect>[]

      for (const prospect of prospects.slice(0, 10)) {
        // Queue connection request
        if (prospect.linkedinUrl && campaign.channels.includes('linkedin')) {
          this.actionQueue.push({
            id: `action_${Date.now()}_connection_${prospect.linkedinUrl}`,
            campaignId: campaign.id,
            prospectId: prospect.id,
            type: 'send_connection',
            channel: 'linkedin',
            status: 'pending',
            payload: { prospect },
            attempts: 0,
            maxAttempts: 2,
            scheduledAt: new Date(Date.now() + Math.random() * 60000).toISOString(),
          })
        }

        // Queue email
        if (prospect.email && campaign.channels.includes('email')) {
          this.actionQueue.push({
            id: `action_${Date.now()}_email_${prospect.email}`,
            campaignId: campaign.id,
            prospectId: prospect.id,
            type: 'send_email',
            channel: 'email',
            status: 'pending',
            payload: { prospect },
            attempts: 0,
            maxAttempts: 2,
            scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
          })
        }
      }
    }

    // If RFP discovery, queue responses
    if (action.channel === 'rfp_portal' && result.data?.rfps) {
      const rfps = result.data.rfps as any[]

      for (const rfp of rfps.filter((r: any) => r.matchScore >= 70)) {
        this.actionQueue.push({
          id: `action_${Date.now()}_rfp_${rfp.id}`,
          campaignId: campaign.id,
          type: 'respond_to_rfp',
          channel: 'rfp_portal',
          status: 'pending',
          payload: { rfpId: rfp.id },
          attempts: 0,
          maxAttempts: 2,
          scheduledAt: new Date().toISOString(),
        })
      }
    }

    // If partnership discovery, queue registrations
    if (action.channel === 'partnership_form' && result.data?.portals) {
      const portals = result.data.portals as any[]

      for (const portal of portals) {
        this.actionQueue.push({
          id: `action_${Date.now()}_partnership_${portal.id}`,
          campaignId: campaign.id,
          type: 'submit_form',
          channel: 'partnership_form',
          status: 'pending',
          payload: { portalId: portal.id },
          attempts: 0,
          maxAttempts: 2,
          scheduledAt: new Date(Date.now() + Math.random() * 300000).toISOString(),
        })
      }
    }
  }

  // --------------------------------------------------------------------------
  // ESCALATION HANDLING
  // --------------------------------------------------------------------------

  private async checkEscalationRules(
    campaign: ColdStartCampaign,
    action: CampaignAction,
    result: ActionResult
  ): Promise<void> {
    for (const rule of campaign.escalationRules) {
      const shouldEscalate = this.evaluateEscalationCondition(rule.condition, action, result)

      if (shouldEscalate) {
        await this.executeEscalationAction(campaign, action, rule)
      }
    }
  }

  private evaluateEscalationCondition(
    condition: any,
    action: CampaignAction,
    result: ActionResult
  ): boolean {
    switch (condition.type) {
      case 'response_sentiment':
        return result.data?.sentiment === condition.value

      case 'multiple_failures':
        return action.attempts >= condition.threshold

      case 'high_value_prospect':
        return (result.data?.score || 0) >= condition.scoreThreshold

      case 'meeting_request':
        return result.meetingBooked === true

      case 'legal_concern':
        const content = JSON.stringify(result.data).toLowerCase()
        return condition.keywords.some((k: string) => content.includes(k.toLowerCase()))

      case 'pricing_question':
        const text = JSON.stringify(result.data).toLowerCase()
        return text.includes('price') || text.includes('cost') || text.includes('quote')

      default:
        return false
    }
  }

  private async executeEscalationAction(
    campaign: ColdStartCampaign,
    action: CampaignAction,
    rule: EscalationRule
  ): Promise<void> {
    const escalation = await this.createEscalation(
      campaign,
      action,
      `Rule triggered: ${rule.condition.type}`
    )

    switch (rule.action) {
      case 'notify':
        await this.sendEscalationNotification(escalation, rule.notificationChannel || 'email')
        break

      case 'pause_campaign':
        campaign.status = 'paused'
        this.campaigns.set(campaign.id, campaign)
        await this.sendEscalationNotification(escalation, rule.notificationChannel || 'email')
        break

      case 'pause_prospect':
        // Mark prospect actions as paused
        this.actionQueue
          .filter(a => a.prospectId === action.prospectId)
          .forEach(a => { a.status = 'escalated' })
        break

      case 'require_approval':
        action.status = 'escalated'
        escalation.status = 'open'
        this.escalations.set(escalation.id, escalation)
        await this.sendEscalationNotification(escalation, rule.notificationChannel || 'email')
        break
    }
  }

  private async createEscalation(
    campaign: ColdStartCampaign,
    action: CampaignAction,
    reason: string
  ): Promise<Escalation> {
    const escalation: Escalation = {
      id: `esc_${Date.now()}`,
      campaignId: campaign.id,
      prospectId: action.prospectId,
      actionId: action.id,
      type: action.type,
      reason,
      priority: 'medium',
      context: {
        actionPayload: action.payload,
        actionResult: action.result,
      },
      status: 'open',
      createdAt: new Date().toISOString(),
    }

    this.escalations.set(escalation.id, escalation)
    campaign.stats.escalations++
    this.campaigns.set(campaign.id, campaign)

    return escalation
  }

  private async sendEscalationNotification(
    escalation: Escalation,
    channel: string
  ): Promise<void> {
    const message = `
🚨 COLD START ESCALATION

Campaign: ${escalation.campaignId}
Type: ${escalation.type}
Priority: ${escalation.priority}
Reason: ${escalation.reason}

Please review and take action.
    `.trim()

    switch (channel) {
      case 'email':
        console.log(`Would send escalation email to ${this.config.escalationEmail}:`, message)
        break

      case 'sms':
        console.log(`Would send escalation SMS to ${this.config.escalationPhone}:`, message)
        break

      case 'slack':
        console.log(`Would send escalation to Slack:`, message)
        break

      default:
        console.log('Escalation:', message)
    }
  }

  // --------------------------------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------------------------------

  getCampaign(campaignId: string): ColdStartCampaign | undefined {
    return this.campaigns.get(campaignId)
  }

  getCampaigns(): ColdStartCampaign[] {
    return Array.from(this.campaigns.values())
  }

  getActiveCampaigns(): ColdStartCampaign[] {
    return Array.from(this.campaigns.values()).filter(c => c.status === 'active')
  }

  getEscalations(): Escalation[] {
    return Array.from(this.escalations.values()).filter(e => e.status === 'open')
  }

  async resolveEscalation(escalationId: string, resolution: string): Promise<ActionResult> {
    const escalation = this.escalations.get(escalationId)
    if (!escalation) {
      return { success: false, error: 'Escalation not found' }
    }

    escalation.status = 'resolved'
    escalation.resolution = resolution
    escalation.resolvedAt = new Date().toISOString()
    this.escalations.set(escalationId, escalation)

    // Update campaign stats
    const campaign = this.campaigns.get(escalation.campaignId)
    if (campaign) {
      campaign.stats.escalationsResolved++
      this.campaigns.set(campaign.id, campaign)
    }

    return { success: true }
  }

  getQueueStatus(): { pending: number; inProgress: number; completed: number; failed: number } {
    return {
      pending: this.actionQueue.filter(a => a.status === 'pending').length,
      inProgress: this.actionQueue.filter(a => a.status === 'in_progress').length,
      completed: this.actionQueue.filter(a => a.status === 'completed').length,
      failed: this.actionQueue.filter(a => a.status === 'failed').length,
    }
  }

  stop(): void {
    this.isRunning = false
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

interface ParsedCommand {
  type: CampaignType
  icp: IcpDefinition
  channels: Channel[]
  name?: string
  clarificationNeeded: boolean
  questions: string[]
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createOrchestrator(config: ColdStartConfig): ColdStartOrchestrator {
  return new ColdStartOrchestrator(config)
}
