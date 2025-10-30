/**
 * Partner SDK - Playbook Engine
 * Executes workflows: deal-reg, co-sell, MDF requests
 */

import { PartnerPlatform, PartnerRules, PlaybookContext, PlaybookResult } from './types'

export class PlaybookEngine {
  private partner: PartnerPlatform
  private rules?: PartnerRules
  private playbooks: Map<string, (context: PlaybookContext) => Promise<PlaybookResult>> = new Map()

  constructor(partner: PartnerPlatform) {
    this.partner = partner

    // Register built-in playbooks
    this.registerPlaybook('deal_registration', this.dealRegistrationPlaybook.bind(this))
    this.registerPlaybook('co_sell_request', this.coSellPlaybook.bind(this))
    this.registerPlaybook('mdf_request', this.mdfRequestPlaybook.bind(this))
  }

  /**
   * Set partner rules
   */
  setRules(rules: PartnerRules): void {
    this.rules = rules
    console.log('[Playbooks] Rules set for', this.partner)
  }

  /**
   * Get partner rules
   */
  getRules(): PartnerRules | undefined {
    return this.rules
  }

  /**
   * Register custom playbook
   */
  registerPlaybook(name: string, handler: (context: PlaybookContext) => Promise<PlaybookResult>): void {
    this.playbooks.set(name, handler)
    console.log('[Playbooks] Registered:', name)
  }

  /**
   * Execute playbook
   */
  async execute(playbookName: string, context: PlaybookContext): Promise<PlaybookResult> {
    const playbook = this.playbooks.get(playbookName)
    if (!playbook) {
      throw new Error(`Playbook '${playbookName}' not found`)
    }

    console.log('[Playbooks] Executing:', playbookName, 'for opportunity:', context.opportunity.name)

    const startTime = Date.now()

    try {
      const result = await playbook(context)
      const duration = Date.now() - startTime

      result.duration = duration

      console.log('[Playbooks] Completed:', playbookName, 'in', duration, 'ms')

      return result
    } catch (error: any) {
      const duration = Date.now() - startTime

      console.error('[Playbooks] Failed:', playbookName, error.message)

      return {
        success: false,
        action: playbookName,
        error: error.message,
        logs: [`Error: ${error.message}`],
        duration,
      }
    }
  }

  /**
   * PLAYBOOK: Deal Registration
   */
  private async dealRegistrationPlaybook(context: PlaybookContext): Promise<PlaybookResult> {
    const logs: string[] = []
    const { opportunity, rules, user } = context

    logs.push(`Starting deal registration for ${opportunity.name}`)

    // Validate compliance
    if (!rules.dealRegistration.required) {
      logs.push('Deal registration not required for this partner')
      return {
        success: false,
        action: 'deal_registration',
        error: 'Deal registration not required',
        logs,
        duration: 0,
      }
    }

    // Check geography
    if (rules.dealRegistration.geography && rules.dealRegistration.geography.length > 0) {
      if (!opportunity.customer.region || !rules.dealRegistration.geography.includes(opportunity.customer.region)) {
        logs.push(`Geography check failed: ${opportunity.customer.region}`)
        return {
          success: false,
          action: 'deal_registration',
          error: 'Opportunity not in eligible geography',
          logs,
          duration: 0,
        }
      }
      logs.push(`Geography check passed: ${opportunity.customer.region}`)
    }

    // Check deal size
    if (rules.dealRegistration.minDealSize) {
      if (opportunity.value.amount < rules.dealRegistration.minDealSize) {
        logs.push(`Deal size below minimum: $${opportunity.value.amount} < $${rules.dealRegistration.minDealSize}`)
        return {
          success: false,
          action: 'deal_registration',
          error: 'Deal size below minimum',
          logs,
          duration: 0,
        }
      }
      logs.push(`Deal size check passed: $${opportunity.value.amount.toLocaleString()}`)
    }

    // Prepare deal registration payload
    const dealRegPayload = {
      partner: this.partner,
      opportunity: {
        externalId: opportunity.externalId,
        name: opportunity.name,
        description: opportunity.description,
        value: opportunity.value.amount,
        currency: opportunity.value.currency,
        closeDate: opportunity.closeDate,
        products: opportunity.products,
      },
      customer: {
        name: opportunity.customer.name,
        industry: opportunity.customer.industry,
        region: opportunity.customer.region,
        size: opportunity.customer.size,
      },
      submitter: {
        userId: user.id,
        name: user.name,
        email: user.email,
      },
      timestamp: new Date().toISOString(),
    }

    logs.push('Payload prepared')

    // Submit to partner API
    // In production: Real API call
    // For Phase 0: Simulate success
    await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate API latency

    const dealRegId = `${this.partner}_dealreg_${Date.now()}`

    logs.push(`Deal registration submitted: ${dealRegId}`)
    logs.push(`Status: Pending approval`)
    logs.push(`Estimated approval time: ${rules.dealRegistration.timeframe || '24-48 hours'}`)

    return {
      success: true,
      action: 'deal_registration',
      data: {
        dealRegId,
        status: 'pending',
        payload: dealRegPayload,
        submittedAt: new Date(),
      },
      logs,
      duration: 0,
      nextSteps: [
        'Monitor deal registration status',
        'Partner will review within ' + (rules.dealRegistration.timeframe || '24-48 hours'),
        'Await approval notification',
      ],
    }
  }

  /**
   * PLAYBOOK: Co-Sell Request
   */
  private async coSellPlaybook(context: PlaybookContext): Promise<PlaybookResult> {
    const logs: string[] = []
    const { opportunity, rules, user } = context

    logs.push(`Starting co-sell request for ${opportunity.name}`)

    // Validate co-sell availability
    if (!rules.coSell.enabled) {
      logs.push('Co-sell not enabled for this partner')
      return {
        success: false,
        action: 'co_sell_request',
        error: 'Co-sell not enabled',
        logs,
        duration: 0,
      }
    }

    // Check requirements
    if (rules.coSell.requirements && rules.coSell.requirements.length > 0) {
      logs.push(`Requirements: ${rules.coSell.requirements.join(', ')}`)
    }

    // Prepare co-sell payload
    const coSellPayload = {
      partner: this.partner,
      opportunity: {
        externalId: opportunity.externalId,
        name: opportunity.name,
        description: opportunity.description,
        value: opportunity.value.amount,
        closeDate: opportunity.closeDate,
        stage: opportunity.stage,
        products: opportunity.products,
      },
      customer: {
        name: opportunity.customer.name,
        industry: opportunity.customer.industry,
        region: opportunity.customer.region,
      },
      engagement: {
        type: 'co_sell',
        partnerRole: 'Lead partner',
        vendorRole: 'Technical support',
        joinReason: 'Customer requires vendor technical validation',
      },
      submitter: {
        userId: user.id,
        name: user.name,
        email: user.email,
      },
      timestamp: new Date().toISOString(),
    }

    logs.push('Payload prepared')

    // Submit co-sell request
    await new Promise(resolve => setTimeout(resolve, 1500))

    const coSellId = `${this.partner}_cosell_${Date.now()}`

    logs.push(`Co-sell request submitted: ${coSellId}`)
    logs.push(`Status: Under review`)

    return {
      success: true,
      action: 'co_sell_request',
      data: {
        coSellId,
        status: 'under_review',
        payload: coSellPayload,
        submittedAt: new Date(),
      },
      logs,
      duration: 0,
      nextSteps: [
        'Partner team will review',
        'Expect response within 3-5 business days',
        'Schedule intro call if approved',
      ],
    }
  }

  /**
   * PLAYBOOK: MDF Request
   */
  private async mdfRequestPlaybook(context: PlaybookContext): Promise<PlaybookResult> {
    const logs: string[] = []
    const { opportunity, rules, user } = context

    logs.push(`Starting MDF request for ${opportunity.name}`)

    // Validate MDF availability
    if (!rules.mdf.available) {
      logs.push('MDF not available for this partner')
      return {
        success: false,
        action: 'mdf_request',
        error: 'MDF not available',
        logs,
        duration: 0,
      }
    }

    // Calculate MDF amount (typically 5-10% of deal value, capped)
    const mdfAmount = Math.min(
      opportunity.value.amount * 0.05, // 5% of deal
      rules.mdf.maxRequest || 10000
    )

    logs.push(`Requesting MDF: $${mdfAmount.toLocaleString()}`)

    // Prepare MDF payload
    const mdfPayload = {
      partner: this.partner,
      activity: {
        type: 'Joint webinar',
        description: `Customer engagement event for ${opportunity.customer.name}`,
        date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        expectedAttendees: 50,
      },
      opportunity: {
        name: opportunity.name,
        value: opportunity.value.amount,
        customer: opportunity.customer.name,
      },
      budget: {
        requested: mdfAmount,
        currency: 'USD',
        breakdown: [
          { item: 'Venue/platform', amount: mdfAmount * 0.3 },
          { item: 'Marketing promotion', amount: mdfAmount * 0.4 },
          { item: 'Content creation', amount: mdfAmount * 0.3 },
        ],
      },
      submitter: {
        userId: user.id,
        name: user.name,
        email: user.email,
      },
      timestamp: new Date().toISOString(),
    }

    logs.push('Payload prepared')

    // Submit MDF request
    await new Promise(resolve => setTimeout(resolve, 1000))

    const mdfId = `${this.partner}_mdf_${Date.now()}`

    logs.push(`MDF request submitted: ${mdfId}`)
    logs.push(`Status: Pending approval`)
    logs.push(`Approval timeframe: ${rules.mdf.approvalTime || '2-4 weeks'}`)

    return {
      success: true,
      action: 'mdf_request',
      data: {
        mdfId,
        amount: mdfAmount,
        status: 'pending',
        payload: mdfPayload,
        submittedAt: new Date(),
      },
      logs,
      duration: 0,
      nextSteps: [
        'Partner will review MDF request',
        `Approval typically takes ${rules.mdf.approvalTime || '2-4 weeks'}`,
        'Prepare activity execution plan',
      ],
    }
  }
}
