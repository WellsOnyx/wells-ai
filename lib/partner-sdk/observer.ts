/**
 * Partner SDK - Observer
 * Watches partner platforms for opportunities, learns patterns
 */

import { PartnerPlatform, PartnerOpportunity, SuggestedAction, SDKMode, ObserverEvent } from './types'

export class Observer {
  private partner: PartnerPlatform
  private mode: SDKMode
  private opportunities: Map<string, PartnerOpportunity> = new Map()
  private actions: Map<string, SuggestedAction> = new Map()
  private patterns: Map<string, number> = new Map()
  private running: boolean = false
  private eventHandlers: Map<string, ((data: any) => void)[]> = new Map()

  constructor(partner: PartnerPlatform, mode: SDKMode) {
    this.partner = partner
    this.mode = mode
  }

  /**
   * Start observing
   */
  async start(): Promise<void> {
    this.running = true
    console.log('[Observer] Started for', this.partner, 'in mode:', this.mode)

    // Start observation loop
    this.observe()
  }

  /**
   * Stop observing
   */
  async stop(): Promise<void> {
    this.running = false
    console.log('[Observer] Stopped')
  }

  /**
   * Register event handler
   */
  on(eventType: string, handler: (data: any) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, [])
    }
    this.eventHandlers.get(eventType)!.push(handler)
  }

  /**
   * Emit event
   */
  private emit(eventType: string, data: any): void {
    const handlers = this.eventHandlers.get(eventType) || []
    handlers.forEach(h => h(data))
  }

  /**
   * Main observation loop
   */
  private async observe(): Promise<void> {
    while (this.running) {
      try {
        // In production: Poll partner API or watch DOM
        // For Phase 0: Simulate discovering opportunities

        // Simulate discovering an opportunity every 10 seconds
        await new Promise(resolve => setTimeout(resolve, 10000))

        if (Math.random() > 0.7) { // 30% chance
          const opp = this.generateSampleOpportunity()
          this.discoverOpportunity(opp)
        }
      } catch (error) {
        console.error('[Observer] Error in observation loop:', error)
        await new Promise(resolve => setTimeout(resolve, 5000)) // Back off on error
      }
    }
  }

  /**
   * Process discovered opportunity
   */
  private discoverOpportunity(opp: PartnerOpportunity): void {
    const existing = this.opportunities.get(opp.id)

    if (existing) {
      // Update existing
      this.opportunities.set(opp.id, { ...existing, ...opp, metadata: { ...existing.metadata, lastSeen: new Date() } })
      this.emit('opportunity_updated', opp)
    } else {
      // New opportunity
      this.opportunities.set(opp.id, opp)
      this.emit('opportunity_discovered', opp)

      console.log('[Observer] Discovered opportunity:', {
        name: opp.name,
        value: `${opp.value.currency} ${opp.value.amount.toLocaleString()}`,
        customer: opp.customer.name,
      })

      // Detect patterns
      this.detectPatterns(opp)
    }
  }

  /**
   * Detect patterns in opportunities
   */
  private detectPatterns(opp: PartnerOpportunity): void {
    // Pattern: Industry frequency
    const industryKey = `industry:${opp.customer.industry}`
    this.patterns.set(industryKey, (this.patterns.get(industryKey) || 0) + 1)

    // Pattern: Deal size range
    const sizeKey = opp.value.amount > 100000 ? 'size:large' : opp.value.amount > 25000 ? 'size:medium' : 'size:small'
    this.patterns.set(sizeKey, (this.patterns.get(sizeKey) || 0) + 1)

    // Pattern: Deal type
    const typeKey = `type:${opp.dealType}`
    this.patterns.set(typeKey, (this.patterns.get(typeKey) || 0) + 1)

    // Emit significant patterns
    const totalOpps = this.opportunities.size
    for (const [pattern, count] of Array.from(this.patterns.entries())) {
      const frequency = count / totalOpps
      if (frequency > 0.5 && count >= 3) {
        this.emit('pattern_detected', {
          pattern,
          confidence: Math.round(frequency * 100),
        })
      }
    }
  }

  /**
   * Add suggested action
   */
  addAction(action: SuggestedAction): void {
    this.actions.set(action.id, action)
  }

  /**
   * Get action by ID
   */
  getAction(actionId: string): SuggestedAction | undefined {
    return this.actions.get(actionId)
  }

  /**
   * Get all pending actions
   */
  getPendingActions(): SuggestedAction[] {
    return Array.from(this.actions.values()).filter(a => a.status === 'pending')
  }

  /**
   * Get all opportunities
   */
  getOpportunities(): PartnerOpportunity[] {
    return Array.from(this.opportunities.values())
  }

  /**
   * Get patterns
   */
  getPatterns(): Map<string, number> {
    return this.patterns
  }

  /**
   * Generate sample opportunity for Phase 0 testing
   */
  private generateSampleOpportunity(): PartnerOpportunity {
    const companies = ['Acme Corp', 'Beta Industries', 'Gamma Systems', 'Delta Tech', 'Epsilon Solutions']
    const industries = ['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail']
    const regions = ['US', 'CA', 'EMEA', 'APAC', 'LATAM']
    const products = ['Cloud', 'AI/ML', 'Security', 'Data Platform', 'Integration']
    const dealTypes = ['new', 'expansion', 'renewal'] as const

    const value = Math.round((Math.random() * 900000 + 100000) / 1000) * 1000 // $100K-$1M, rounded to $1K

    return {
      id: `opp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      externalId: undefined,
      partner: this.partner,

      name: `${companies[Math.floor(Math.random() * companies.length)]} - ${products[Math.floor(Math.random() * products.length)]} Project`,
      description: 'Enterprise cloud transformation initiative',
      customer: {
        name: companies[Math.floor(Math.random() * companies.length)],
        industry: industries[Math.floor(Math.random() * industries.length)],
        region: regions[Math.floor(Math.random() * regions.length)],
        size: value > 500000 ? 'Enterprise' : value > 100000 ? 'Mid-Market' : 'SMB',
      },

      value: {
        amount: value,
        currency: 'USD',
        type: 'acv',
      },

      stage: 'Discovery',
      probability: 0.25,
      closeDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days

      products: [products[Math.floor(Math.random() * products.length)]],
      solutions: undefined,

      dealType: dealTypes[Math.floor(Math.random() * dealTypes.length)],
      sourceType: 'partner_sourced',

      metadata: {
        discoveredAt: new Date(),
        lastSeen: new Date(),
        confidence: Math.round(60 + Math.random() * 35), // 60-95%
        tags: [],
      },
    }
  }
}
