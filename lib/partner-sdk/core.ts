/**
 * Partner SDK - Core Class
 * Drop-in automation for partner ecosystems
 */

import {
  PartnerPlatform,
  PartnerSDKConfig,
  PartnerOpportunity,
  SuggestedAction,
  PartnerRules,
  SDKEvent,
  PlaybookContext,
  PlaybookResult,
} from './types'

import { AuthManager } from './auth'
import { Observer } from './observer'
import { PlaybookEngine } from './playbooks'
import { LearningSystem } from './learning'

export class WellsPartnerSDK {
  private config: PartnerSDKConfig
  private auth: AuthManager
  private observer: Observer
  private playbooks: PlaybookEngine
  private learning: LearningSystem
  private eventHandlers: Map<string, ((event: SDKEvent) => void)[]> = new Map()

  constructor(config: PartnerSDKConfig) {
    this.config = config

    // Initialize subsystems
    this.auth = new AuthManager(config.partner, config.auth)
    this.observer = new Observer(config.partner, config.mode)
    this.playbooks = new PlaybookEngine(config.partner)
    this.learning = new LearningSystem(config.partner, config.learning)

    // Wire up event flows
    this.setupEventHandlers()

    console.log('[Wells Partner SDK] Initialized:', {
      partner: config.partner,
      mode: config.mode,
      playbooks: config.playbooks.length,
      consent: config.consent.required ? 'required' : 'optional',
    })
  }

  /**
   * Start the SDK
   */
  async start(): Promise<void> {
    console.log('[SDK] Starting...')

    // Authenticate
    const authResult = await this.auth.authenticate()
    if (!authResult.success) {
      this.emit({
        type: 'auth_failure',
        data: {
          partner: this.config.partner,
          error: authResult.error || 'Unknown error',
        },
      })
      throw new Error(`Authentication failed: ${authResult.error}`)
    }

    this.emit({
      type: 'auth_success',
      data: { partner: this.config.partner },
    })

    // Load partner rules
    const rules = await this.loadPartnerRules()
    this.playbooks.setRules(rules)

    // Start observing
    await this.observer.start()

    console.log('[SDK] Started successfully')
  }

  /**
   * Stop the SDK
   */
  async stop(): Promise<void> {
    await this.observer.stop()
    await this.auth.disconnect()
    console.log('[SDK] Stopped')
  }

  /**
   * Register event handler
   */
  on(eventType: SDKEvent['type'] | '*', handler: (event: SDKEvent) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, [])
    }
    this.eventHandlers.get(eventType)!.push(handler)
  }

  /**
   * Emit event
   */
  private emit(event: SDKEvent): void {
    // Type-specific handlers
    const handlers = this.eventHandlers.get(event.type) || []
    handlers.forEach(h => h(event))

    // Wildcard handlers
    const wildcardHandlers = this.eventHandlers.get('*') || []
    wildcardHandlers.forEach(h => h(event))
  }

  /**
   * Approve suggested action
   */
  async approve(actionId: string, approver: {
    userId: string
    name: string
    email: string
  }): Promise<PlaybookResult> {
    const action = this.observer.getAction(actionId)
    if (!action) {
      throw new Error(`Action ${actionId} not found`)
    }

    if (action.status !== 'pending') {
      throw new Error(`Action ${actionId} is not pending (status: ${action.status})`)
    }

    // Mark as approved
    action.status = 'approved'
    action.human.approvedBy = approver.userId
    action.human.approvedAt = new Date()

    this.emit({
      type: 'approval_received',
      data: { actionId, approved: true },
    })

    // Execute playbook
    const context: PlaybookContext = {
      partner: this.config.partner,
      opportunity: action.opportunity,
      action,
      rules: this.playbooks.getRules()!,
      user: approver,
      session: {
        startedAt: new Date(),
        authenticated: true,
        permissions: [],
      },
    }

    this.emit({
      type: 'playbook_started',
      data: { playbook: action.action.playbook, context },
    })

    action.status = 'executing'
    action.execution.startedAt = new Date()

    try {
      const result = await this.playbooks.execute(action.action.playbook, context)

      action.status = 'completed'
      action.execution.completedAt = new Date()
      action.execution.result = result.data

      this.emit({
        type: 'playbook_completed',
        data: { playbook: action.action.playbook, result },
      })

      // Learn from this execution
      await this.learning.recordExecution(action, result)

      return result
    } catch (error: any) {
      action.status = 'failed'
      action.execution.completedAt = new Date()
      action.execution.error = error.message

      this.emit({
        type: 'error',
        data: { message: error.message, code: 'PLAYBOOK_FAILED' },
      })

      throw error
    }
  }

  /**
   * Reject suggested action
   */
  async reject(actionId: string, reason: string): Promise<void> {
    const action = this.observer.getAction(actionId)
    if (!action) {
      throw new Error(`Action ${actionId} not found`)
    }

    action.status = 'rejected'
    action.human.rejectedReason = reason

    this.emit({
      type: 'approval_received',
      data: { actionId, approved: false },
    })

    // Learn from rejection
    await this.learning.recordRejection(action, reason)
  }

  /**
   * Get pending actions
   */
  getPendingActions(): SuggestedAction[] {
    return this.observer.getPendingActions()
  }

  /**
   * Get all opportunities
   */
  getOpportunities(): PartnerOpportunity[] {
    return this.observer.getOpportunities()
  }

  /**
   * Get learning stats
   */
  getLearningStats(): {
    totalActions: number
    approved: number
    rejected: number
    executed: number
    successRate: number
    avgConfidence: number
  } {
    return this.learning.getStats()
  }

  /**
   * Setup internal event handlers
   */
  private setupEventHandlers(): void {
    // When observer discovers opportunity, analyze and suggest actions
    this.observer.on('opportunity_discovered', async (opp) => {
      this.emit({
        type: 'opportunity_discovered',
        data: opp,
      })

      // Only suggest actions in suggest/autopilot/autonomous modes
      if (this.config.mode === 'observe') {
        return
      }

      const actions = await this.analyzeOpportunity(opp)
      actions.forEach(action => {
        this.observer.addAction(action)
        this.emit({
          type: 'action_suggested',
          data: action,
        })

        // Auto-request approval if threshold met
        if (action.confidence >= this.config.notifications.threshold) {
          this.emit({
            type: 'approval_requested',
            data: action,
          })
        }
      })
    })

    // When observer detects pattern, emit
    this.observer.on('pattern_detected', (pattern) => {
      this.emit({
        type: 'pattern_detected',
        data: pattern,
      })
    })
  }

  /**
   * Analyze opportunity and generate suggested actions
   */
  private async analyzeOpportunity(opp: PartnerOpportunity): Promise<SuggestedAction[]> {
    const rules = this.playbooks.getRules()
    if (!rules) {
      return []
    }

    const suggestions: SuggestedAction[] = []

    // Check deal registration
    if (rules.dealRegistration.required) {
      const compliant = this.checkDealRegCompliance(opp, rules)

      if (compliant.eligible) {
        const confidence = await this.learning.predictConfidence('deal_reg', opp)

        suggestions.push({
          id: `action_${Date.now()}_dealreg`,
          type: 'deal_reg',
          opportunity: opp,
          confidence,
          reasoning: [
            'Opportunity matches partner deal registration criteria',
            ...compliant.reasons,
          ],
          action: {
            playbook: 'deal_registration',
            params: { opportunityId: opp.id },
            estimated_time: 300, // 5 minutes
          },
          rules: {
            compliant: true,
            violations: [],
            requirements: compliant.requirements,
          },
          outcome: {
            estimated_value: opp.value.amount,
            probability: 0.65,
            timeframe: '30-60 days',
          },
          status: 'pending',
          human: {},
          execution: {},
        })
      }
    }

    // Check co-sell opportunities
    if (rules.coSell.enabled) {
      const confidence = await this.learning.predictConfidence('co_sell', opp)

      if (confidence > 60) {
        suggestions.push({
          id: `action_${Date.now()}_cosell`,
          type: 'co_sell',
          opportunity: opp,
          confidence,
          reasoning: [
            'Strong fit for partner co-sell program',
            `Deal size ${opp.value.amount} aligns with partner focus`,
          ],
          action: {
            playbook: 'co_sell_request',
            params: { opportunityId: opp.id },
            estimated_time: 600, // 10 minutes
          },
          rules: {
            compliant: true,
            violations: [],
            requirements: rules.coSell.requirements || [],
          },
          outcome: {
            estimated_value: opp.value.amount * 1.3, // Co-sell typically increases deal size
            probability: 0.55,
            timeframe: '60-90 days',
          },
          status: 'pending',
          human: {},
          execution: {},
        })
      }
    }

    return suggestions
  }

  /**
   * Check if opportunity complies with deal registration rules
   */
  private checkDealRegCompliance(opp: PartnerOpportunity, rules: PartnerRules): {
    eligible: boolean
    reasons: string[]
    requirements: string[]
  } {
    const reasons: string[] = []
    const requirements: string[] = []
    let eligible = true

    // Check deal size
    if (rules.dealRegistration.minDealSize && opp.value.amount < rules.dealRegistration.minDealSize) {
      eligible = false
      reasons.push(`Deal size below minimum ($${rules.dealRegistration.minDealSize})`)
    }

    if (rules.dealRegistration.maxDealSize && opp.value.amount > rules.dealRegistration.maxDealSize) {
      eligible = false
      reasons.push(`Deal size above maximum ($${rules.dealRegistration.maxDealSize})`)
    }

    // Check geography
    if (rules.dealRegistration.geography && rules.dealRegistration.geography.length > 0) {
      if (opp.customer.region && !rules.dealRegistration.geography.includes(opp.customer.region)) {
        eligible = false
        reasons.push(`Region ${opp.customer.region} not eligible`)
      }
    }

    // Check industry
    if (rules.dealRegistration.industries && rules.dealRegistration.industries.length > 0) {
      if (opp.customer.industry && !rules.dealRegistration.industries.includes(opp.customer.industry)) {
        eligible = false
        reasons.push(`Industry ${opp.customer.industry} not eligible`)
      }
    }

    if (eligible) {
      reasons.push('Meets all deal registration criteria')
      requirements.push(`Submit within ${rules.dealRegistration.timeframe || '48 hours'}`)
      requirements.push('Provide customer contact information')
      requirements.push('Include solution overview')
    }

    return { eligible, reasons, requirements }
  }

  /**
   * Load partner rules (from docs, API, or cached)
   */
  private async loadPartnerRules(): Promise<PartnerRules> {
    // In production: Fetch from partner portal docs or API
    // For Phase 0: Return sensible defaults

    const defaultRules: Record<PartnerPlatform, Partial<PartnerRules>> = {
      ibm: {
        dealRegistration: {
          required: true,
          timeframe: '48 hours',
          geography: ['US', 'CA', 'EMEA', 'APAC'],
          minDealSize: 50000,
          exclusions: ['Existing IBM customers without partner intro'],
        },
        coSell: {
          enabled: true,
          requirements: ['Joint value prop', 'Customer approval'],
        },
        mdf: {
          available: true,
          maxRequest: 10000,
          approvalTime: '2-4 weeks',
        },
        branding: {
          voice: 'Professional, technical',
          tone: 'Consultative',
          doNot: ['Oversell', 'Promise features not available'],
        },
      },
      cisco: {
        dealRegistration: {
          required: true,
          timeframe: '24 hours',
          minDealSize: 25000,
        },
        coSell: {
          enabled: true,
        },
        mdf: {
          available: true,
          maxRequest: 5000,
        },
      },
      snowflake: {
        dealRegistration: {
          required: true,
          minDealSize: 100000,
        },
        coSell: {
          enabled: true,
        },
      },
    }

    const rules = defaultRules[this.config.partner] || {}

    return {
      partner: this.config.partner,
      dealRegistration: {
        required: false,
        ...rules.dealRegistration,
      },
      coSell: {
        enabled: false,
        ...rules.coSell,
      },
      mdf: {
        available: false,
        ...rules.mdf,
      },
      branding: {
        voice: 'Professional',
        tone: 'Neutral',
        doNot: [],
        ...rules.branding,
      },
      compliance: {
        mustRead: [],
        ...rules.compliance,
      },
    }
  }
}
