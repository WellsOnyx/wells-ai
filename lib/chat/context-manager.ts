// @ts-nocheck
/**
 * Cross-Journey Context Manager
 *
 * Manages context that persists across journey switches in WellsAI:
 * - Tracks which journeys a user has active
 * - Maintains context when switching between RFQ, Jobs, Payments, etc.
 * - Stores user preferences and autonomy levels
 * - Generates unified daily digests
 * - Handles cross-handler data sharing
 */

import { sqlQuery as sql } from '@/lib/db'
import { getWellsMemory, updateWellsMemory, WellsMemory } from '@/lib/wells-memory'

// ============================================================================
// TYPES
// ============================================================================

export type JourneyType =
  | 'rfq'
  | 'jobs'
  | 'payments'
  | 'negotiation'
  | 'seller'
  | 'founder'
  | 'erp'
  | 'universal'

export interface JourneyContext {
  userId: string
  currentJourney: JourneyType
  availableJourneys: JourneyType[]
  recentSwitches: JourneySwitch[]
  journeyStates: Record<JourneyType, JourneyState>
  sharedContext: SharedContext
  lastUpdated: Date
}

export interface JourneySwitch {
  from: JourneyType
  to: JourneyType
  timestamp: Date
  reason?: string
  preservedData?: Record<string, unknown>
}

export interface JourneyState {
  active: boolean
  lastActivity?: Date
  pendingActions: number
  activeFlowId?: string
  recentEntities: Record<string, unknown>
  quickAccessItems: QuickAccessItem[]
}

export interface QuickAccessItem {
  id: string
  type: string
  label: string
  lastAccessed: Date
  accessCount: number
}

export interface SharedContext {
  // Entities that are shared across journeys
  recentCompanies: string[]
  recentContacts: string[]
  recentProducts: string[]
  recentAmounts: number[]

  // Cross-journey references
  activeRFQs: string[]
  activeJobs: string[]
  activeNegotiations: string[]
  pendingPayments: string[]

  // User context
  preferredCommunicationStyle?: 'formal' | 'casual' | 'direct' | 'detailed'
  timezone?: string
  currency?: string
}

export interface UnifiedUserPreferences {
  // Global preferences
  defaultJourney: JourneyType
  communicationStyle: 'formal' | 'casual' | 'direct' | 'detailed'
  notificationLevel: 'all' | 'important' | 'minimal' | 'none'

  // Autonomy levels per journey
  autonomyLevels: {
    rfq: 'manual' | 'assisted' | 'autonomous'
    payments: 'manual' | 'assisted' | 'autonomous'
    jobs: 'manual' | 'assisted' | 'autonomous'
    negotiation: 'manual' | 'assisted' | 'autonomous'
    seller: 'manual' | 'assisted' | 'autonomous'
    founder: 'manual' | 'assisted' | 'autonomous'
  }

  // Spending limits
  spendingLimits: {
    perTransaction: number
    daily: number
    requiresApproval: number
  }

  // Auto-actions
  autoNegotiate: boolean
  autoApplyToJobs: boolean
  autoQuote: boolean
  autoPayInvoices: boolean

  // Digest preferences
  dailyDigest: {
    enabled: boolean
    time: string  // e.g., "09:00"
    channels: ('email' | 'sms' | 'in_app')[]
    sections: JourneyType[]
  }
}

export interface CrossHandlerOperation {
  id: string
  sourceHandler: JourneyType
  targetHandler: JourneyType
  sourceActionId: string
  targetActionId?: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  data: Record<string, unknown>
  createdAt: Date
  completedAt?: Date
}

export interface DailyDigest {
  userId: string
  generatedAt: Date
  period: {
    start: Date
    end: Date
  }
  summary: string
  sections: DailyDigestSection[]
  actionItems: DigestActionItem[]
  highlights: DigestHighlight[]
}

export interface DailyDigestSection {
  journey: JourneyType
  title: string
  summary: string
  metrics: Record<string, number | string>
  items: Array<{
    id: string
    title: string
    status: string
    priority: 'low' | 'normal' | 'high' | 'urgent'
    actionRequired: boolean
  }>
}

export interface DigestActionItem {
  id: string
  journey: JourneyType
  title: string
  description: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  dueDate?: Date
  suggestedAction: {
    label: string
    action: string
  }
}

export interface DigestHighlight {
  type: 'success' | 'opportunity' | 'warning' | 'milestone'
  journey: JourneyType
  title: string
  description: string
  value?: number | string
}

// ============================================================================
// CONTEXT CACHE
// ============================================================================

const contextCache = new Map<string, { context: JourneyContext; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// ============================================================================
// CROSS-JOURNEY CONTEXT MANAGER CLASS
// ============================================================================

export class CrossJourneyContextManager {
  // ============================================================================
  // JOURNEY CONTEXT MANAGEMENT
  // ============================================================================

  /**
   * Get the complete journey context for a user
   */
  async getJourneyContext(userId: string): Promise<JourneyContext> {
    // Check cache
    const cached = contextCache.get(userId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.context
    }

    // Try to load from database
    try {
      const result = await sql`
        SELECT * FROM journey_contexts WHERE user_id = ${userId}
      `

      if (result.rows.length > 0) {
        const row = result.rows[0]
        const context: JourneyContext = {
          userId,
          currentJourney: row.current_journey || 'universal',
          availableJourneys: row.available_journeys || ['universal'],
          recentSwitches: row.recent_switches || [],
          journeyStates: row.journey_states || this.getDefaultJourneyStates(),
          sharedContext: row.shared_context || this.getDefaultSharedContext(),
          lastUpdated: new Date(row.updated_at),
        }
        contextCache.set(userId, { context, timestamp: Date.now() })
        return context
      }
    } catch (error) {
      console.error('[CrossJourneyContextManager] Error loading context:', error)
    }

    // Create default context
    const defaultContext = this.createDefaultContext(userId)
    contextCache.set(userId, { context: defaultContext, timestamp: Date.now() })
    return defaultContext
  }

  /**
   * Save journey context to database
   */
  async saveJourneyContext(userId: string, context: JourneyContext): Promise<void> {
    try {
      await sql`
        INSERT INTO journey_contexts (
          user_id,
          current_journey,
          available_journeys,
          recent_switches,
          journey_states,
          shared_context,
          updated_at
        ) VALUES (
          ${userId},
          ${context.currentJourney},
          ${JSON.stringify(context.availableJourneys)},
          ${JSON.stringify(context.recentSwitches.slice(-20))},
          ${JSON.stringify(context.journeyStates)},
          ${JSON.stringify(context.sharedContext)},
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          current_journey = ${context.currentJourney},
          available_journeys = ${JSON.stringify(context.availableJourneys)},
          recent_switches = ${JSON.stringify(context.recentSwitches.slice(-20))},
          journey_states = ${JSON.stringify(context.journeyStates)},
          shared_context = ${JSON.stringify(context.sharedContext)},
          updated_at = NOW()
      `

      // Update cache
      contextCache.set(userId, { context, timestamp: Date.now() })
    } catch (error) {
      console.error('[CrossJourneyContextManager] Error saving context:', error)
    }
  }

  /**
   * Record a journey switch
   */
  async recordJourneySwitch(
    userId: string,
    fromJourney: JourneyType,
    toJourney: JourneyType,
    reason?: string
  ): Promise<void> {
    const context = await this.getJourneyContext(userId)

    // Preserve relevant data from current journey
    const preservedData = await this.extractPreservedData(userId, fromJourney)

    const switchRecord: JourneySwitch = {
      from: fromJourney,
      to: toJourney,
      timestamp: new Date(),
      reason,
      preservedData,
    }

    context.recentSwitches.push(switchRecord)
    context.currentJourney = toJourney

    // Update journey states
    if (context.journeyStates[fromJourney]) {
      context.journeyStates[fromJourney].lastActivity = new Date()
    }
    if (!context.journeyStates[toJourney]) {
      context.journeyStates[toJourney] = this.createDefaultJourneyState()
    }
    context.journeyStates[toJourney].active = true
    context.journeyStates[toJourney].lastActivity = new Date()

    // Add to available journeys if not already there
    if (!context.availableJourneys.includes(toJourney)) {
      context.availableJourneys.push(toJourney)
    }

    await this.saveJourneyContext(userId, context)
  }

  /**
   * Extract data to preserve when switching journeys
   */
  private async extractPreservedData(
    userId: string,
    journey: JourneyType
  ): Promise<Record<string, unknown>> {
    const preserved: Record<string, unknown> = {}

    try {
      const context = await this.getJourneyContext(userId)
      const journeyState = context.journeyStates[journey]

      if (journeyState) {
        preserved.recentEntities = journeyState.recentEntities
        preserved.activeFlowId = journeyState.activeFlowId
      }

      // Journey-specific preservation
      switch (journey) {
        case 'rfq':
          const rfqResult = await sql`
            SELECT id, category, status FROM rfqs
            WHERE requestor_id = ${userId} AND status IN ('open', 'quoted')
            ORDER BY updated_at DESC LIMIT 5
          `
          preserved.activeRFQs = rfqResult.rows.map(r => ({ id: r.id, category: r.category, status: r.status }))
          break

        case 'jobs':
          const jobsResult = await sql`
            SELECT a.id, t.title, a.status FROM job_applications a
            JOIN job_tasks t ON a.task_id = t.id
            WHERE a.worker_id = ${userId} AND a.status IN ('pending', 'interviewing')
            ORDER BY a.updated_at DESC LIMIT 5
          `
          preserved.activeApplications = jobsResult.rows.map(r => ({ id: r.id, title: r.title, status: r.status }))
          break

        case 'negotiation':
          const negResult = await sql`
            SELECT id, deal_type, status FROM negotiations
            WHERE (buyer_id = ${userId} OR seller_id = ${userId})
            AND status IN ('active', 'countered')
            ORDER BY updated_at DESC LIMIT 5
          `
          preserved.activeNegotiations = negResult.rows.map(r => ({ id: r.id, type: r.deal_type, status: r.status }))
          break
      }
    } catch (error) {
      console.error('[CrossJourneyContextManager] Error extracting preserved data:', error)
    }

    return preserved
  }

  // ============================================================================
  // USER PREFERENCES
  // ============================================================================

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string): Promise<UnifiedUserPreferences> {
    try {
      const result = await sql`
        SELECT * FROM user_preferences WHERE user_id = ${userId}
      `

      if (result.rows.length > 0) {
        const row = result.rows[0]
        return {
          defaultJourney: row.default_journey || 'universal',
          communicationStyle: row.communication_style || 'casual',
          notificationLevel: row.notification_level || 'important',
          autonomyLevels: row.autonomy_levels || this.getDefaultAutonomyLevels(),
          spendingLimits: row.spending_limits || { perTransaction: 1000, daily: 5000, requiresApproval: 500 },
          autoNegotiate: row.auto_negotiate || false,
          autoApplyToJobs: row.auto_apply_jobs || false,
          autoQuote: row.auto_quote || false,
          autoPayInvoices: row.auto_pay_invoices || false,
          dailyDigest: row.daily_digest || {
            enabled: true,
            time: '09:00',
            channels: ['email', 'in_app'],
            sections: ['rfq', 'jobs', 'payments'],
          },
        }
      }
    } catch (error) {
      console.error('[CrossJourneyContextManager] Error loading preferences:', error)
    }

    return this.getDefaultPreferences()
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    userId: string,
    updates: Partial<UnifiedUserPreferences>
  ): Promise<void> {
    const current = await this.getUserPreferences(userId)
    const merged = { ...current, ...updates }

    try {
      await sql`
        INSERT INTO user_preferences (
          user_id,
          default_journey,
          communication_style,
          notification_level,
          autonomy_levels,
          spending_limits,
          auto_negotiate,
          auto_apply_jobs,
          auto_quote,
          auto_pay_invoices,
          daily_digest,
          updated_at
        ) VALUES (
          ${userId},
          ${merged.defaultJourney},
          ${merged.communicationStyle},
          ${merged.notificationLevel},
          ${JSON.stringify(merged.autonomyLevels)},
          ${JSON.stringify(merged.spendingLimits)},
          ${merged.autoNegotiate},
          ${merged.autoApplyToJobs},
          ${merged.autoQuote},
          ${merged.autoPayInvoices},
          ${JSON.stringify(merged.dailyDigest)},
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          default_journey = ${merged.defaultJourney},
          communication_style = ${merged.communicationStyle},
          notification_level = ${merged.notificationLevel},
          autonomy_levels = ${JSON.stringify(merged.autonomyLevels)},
          spending_limits = ${JSON.stringify(merged.spendingLimits)},
          auto_negotiate = ${merged.autoNegotiate},
          auto_apply_jobs = ${merged.autoApplyToJobs},
          auto_quote = ${merged.autoQuote},
          auto_pay_invoices = ${merged.autoPayInvoices},
          daily_digest = ${JSON.stringify(merged.dailyDigest)},
          updated_at = NOW()
      `
    } catch (error) {
      console.error('[CrossJourneyContextManager] Error updating preferences:', error)
    }
  }

  // ============================================================================
  // CROSS-HANDLER OPERATIONS
  // ============================================================================

  /**
   * Create a cross-handler operation
   */
  async createCrossHandlerOperation(
    userId: string,
    operation: Omit<CrossHandlerOperation, 'id' | 'createdAt'>
  ): Promise<CrossHandlerOperation> {
    const id = `xop_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const createdAt = new Date()

    try {
      await sql`
        INSERT INTO cross_handler_operations (
          id,
          user_id,
          source_handler,
          target_handler,
          source_action_id,
          target_action_id,
          status,
          data,
          created_at
        ) VALUES (
          ${id},
          ${userId},
          ${operation.sourceHandler},
          ${operation.targetHandler},
          ${operation.sourceActionId},
          ${operation.targetActionId || null},
          ${operation.status},
          ${JSON.stringify(operation.data)},
          ${createdAt.toISOString()}
        )
      `
    } catch (error) {
      console.error('[CrossJourneyContextManager] Error creating cross-handler operation:', error)
    }

    return {
      id,
      ...operation,
      createdAt,
    }
  }

  /**
   * Complete a cross-handler operation
   */
  async completeCrossHandlerOperation(
    operationId: string,
    targetActionId: string,
    success: boolean
  ): Promise<void> {
    try {
      await sql`
        UPDATE cross_handler_operations SET
          target_action_id = ${targetActionId},
          status = ${success ? 'completed' : 'failed'},
          completed_at = NOW()
        WHERE id = ${operationId}
      `
    } catch (error) {
      console.error('[CrossJourneyContextManager] Error completing cross-handler operation:', error)
    }
  }

  /**
   * Get pending cross-handler operations
   */
  async getPendingOperations(userId: string): Promise<CrossHandlerOperation[]> {
    try {
      const result = await sql`
        SELECT * FROM cross_handler_operations
        WHERE user_id = ${userId} AND status IN ('pending', 'in_progress')
        ORDER BY created_at DESC
      `

      return result.rows.map(row => ({
        id: row.id,
        sourceHandler: row.source_handler,
        targetHandler: row.target_handler,
        sourceActionId: row.source_action_id,
        targetActionId: row.target_action_id,
        status: row.status,
        data: row.data,
        createdAt: new Date(row.created_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      }))
    } catch (error) {
      console.error('[CrossJourneyContextManager] Error getting pending operations:', error)
      return []
    }
  }

  // ============================================================================
  // DAILY DIGEST GENERATION
  // ============================================================================

  /**
   * Generate a unified daily digest across all journeys
   */
  async generateDailyDigest(userId: string): Promise<DailyDigest> {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const sections: DailyDigestSection[] = []
    const actionItems: DigestActionItem[] = []
    const highlights: DigestHighlight[] = []

    // Get user preferences to know which sections to include
    const preferences = await this.getUserPreferences(userId)
    const enabledSections = preferences.dailyDigest.sections

    // RFQ Section
    if (enabledSections.includes('rfq')) {
      const rfqSection = await this.generateRFQDigestSection(userId, yesterday, now)
      if (rfqSection) {
        sections.push(rfqSection)
        actionItems.push(...rfqSection.items
          .filter(i => i.actionRequired)
          .map(i => ({
            id: i.id,
            journey: 'rfq' as JourneyType,
            title: i.title,
            description: `Status: ${i.status}`,
            priority: i.priority,
            suggestedAction: { label: 'Review', action: `rfq.view.${i.id}` },
          }))
        )
      }
    }

    // Jobs Section
    if (enabledSections.includes('jobs')) {
      const jobsSection = await this.generateJobsDigestSection(userId, yesterday, now)
      if (jobsSection) {
        sections.push(jobsSection)
        actionItems.push(...jobsSection.items
          .filter(i => i.actionRequired)
          .map(i => ({
            id: i.id,
            journey: 'jobs' as JourneyType,
            title: i.title,
            description: `Status: ${i.status}`,
            priority: i.priority,
            suggestedAction: { label: 'View', action: `jobs.view.${i.id}` },
          }))
        )
      }
    }

    // Payments Section
    if (enabledSections.includes('payments')) {
      const paymentsSection = await this.generatePaymentsDigestSection(userId, yesterday, now)
      if (paymentsSection) {
        sections.push(paymentsSection)
      }
    }

    // Seller Section
    if (enabledSections.includes('seller')) {
      const sellerSection = await this.generateSellerDigestSection(userId, yesterday, now)
      if (sellerSection) {
        sections.push(sellerSection)
        actionItems.push(...sellerSection.items
          .filter(i => i.actionRequired)
          .map(i => ({
            id: i.id,
            journey: 'seller' as JourneyType,
            title: i.title,
            description: `Status: ${i.status}`,
            priority: i.priority,
            suggestedAction: { label: 'Quote', action: `seller.quote.${i.id}` },
          }))
        )
      }
    }

    // Negotiation Section
    if (enabledSections.includes('negotiation')) {
      const negotiationSection = await this.generateNegotiationDigestSection(userId, yesterday, now)
      if (negotiationSection) {
        sections.push(negotiationSection)
      }
    }

    // Generate summary
    const summary = this.generateDigestSummary(sections, actionItems, highlights)

    return {
      userId,
      generatedAt: now,
      period: { start: yesterday, end: now },
      summary,
      sections,
      actionItems: actionItems.sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      }),
      highlights,
    }
  }

  private async generateRFQDigestSection(
    userId: string,
    start: Date,
    end: Date
  ): Promise<DailyDigestSection | null> {
    try {
      const result = await sql`
        SELECT id, category, status, target_price, updated_at
        FROM rfqs
        WHERE requestor_id = ${userId}
        AND updated_at >= ${start.toISOString()}
        ORDER BY updated_at DESC
        LIMIT 10
      `

      if (result.rows.length === 0) return null

      const quoted = result.rows.filter(r => r.status === 'quoted').length
      const open = result.rows.filter(r => r.status === 'open').length
      const awarded = result.rows.filter(r => r.status === 'awarded').length

      return {
        journey: 'rfq',
        title: 'Procurement',
        summary: `${quoted} quotes received, ${open} RFQs open, ${awarded} deals awarded`,
        metrics: {
          'Quotes Received': quoted,
          'Open RFQs': open,
          'Deals Awarded': awarded,
        },
        items: result.rows.slice(0, 5).map(r => ({
          id: r.id,
          title: `RFQ: ${r.category}`,
          status: r.status,
          priority: r.status === 'quoted' ? 'high' as const : 'normal' as const,
          actionRequired: r.status === 'quoted',
        })),
      }
    } catch (error) {
      console.error('[CrossJourneyContextManager] Error generating RFQ digest:', error)
      return null
    }
  }

  private async generateJobsDigestSection(
    userId: string,
    start: Date,
    end: Date
  ): Promise<DailyDigestSection | null> {
    try {
      const result = await sql`
        SELECT a.id, t.title, a.status, a.updated_at
        FROM job_applications a
        JOIN job_tasks t ON a.task_id = t.id
        WHERE a.worker_id = ${userId}
        AND a.updated_at >= ${start.toISOString()}
        ORDER BY a.updated_at DESC
        LIMIT 10
      `

      if (result.rows.length === 0) return null

      const pending = result.rows.filter(r => r.status === 'pending').length
      const interviewing = result.rows.filter(r => r.status === 'interviewing').length
      const offers = result.rows.filter(r => r.status === 'offered').length

      return {
        journey: 'jobs',
        title: 'Job Search',
        summary: `${pending} pending, ${interviewing} interviewing, ${offers} offers`,
        metrics: {
          'Pending': pending,
          'Interviewing': interviewing,
          'Offers': offers,
        },
        items: result.rows.slice(0, 5).map(r => ({
          id: r.id,
          title: r.title,
          status: r.status,
          priority: r.status === 'offered' ? 'urgent' as const : r.status === 'interviewing' ? 'high' as const : 'normal' as const,
          actionRequired: ['offered', 'interviewing'].includes(r.status),
        })),
      }
    } catch (error) {
      console.error('[CrossJourneyContextManager] Error generating jobs digest:', error)
      return null
    }
  }

  private async generatePaymentsDigestSection(
    userId: string,
    start: Date,
    end: Date
  ): Promise<DailyDigestSection | null> {
    try {
      const result = await sql`
        SELECT id, type, amount, status, created_at
        FROM transactions
        WHERE user_id = ${userId}
        AND created_at >= ${start.toISOString()}
        ORDER BY created_at DESC
        LIMIT 10
      `

      if (result.rows.length === 0) return null

      const totalIn = result.rows.filter(r => r.type === 'credit').reduce((sum, r) => sum + r.amount, 0)
      const totalOut = result.rows.filter(r => r.type === 'debit').reduce((sum, r) => sum + r.amount, 0)

      return {
        journey: 'payments',
        title: 'Treasury',
        summary: `$${totalIn.toLocaleString()} received, $${totalOut.toLocaleString()} sent`,
        metrics: {
          'Received': `$${totalIn.toLocaleString()}`,
          'Sent': `$${totalOut.toLocaleString()}`,
          'Transactions': result.rows.length,
        },
        items: result.rows.slice(0, 5).map(r => ({
          id: r.id,
          title: `${r.type === 'credit' ? 'Received' : 'Sent'} $${r.amount.toLocaleString()}`,
          status: r.status,
          priority: 'normal' as const,
          actionRequired: false,
        })),
      }
    } catch (error) {
      console.error('[CrossJourneyContextManager] Error generating payments digest:', error)
      return null
    }
  }

  private async generateSellerDigestSection(
    userId: string,
    start: Date,
    end: Date
  ): Promise<DailyDigestSection | null> {
    try {
      const result = await sql`
        SELECT r.id, r.category, r.quantity, r.status, r.updated_at
        FROM rfqs r
        JOIN supplier_rfq_matches m ON r.id = m.rfq_id
        WHERE m.supplier_id = ${userId}
        AND r.updated_at >= ${start.toISOString()}
        ORDER BY r.updated_at DESC
        LIMIT 10
      `

      if (result.rows.length === 0) return null

      const newRFQs = result.rows.filter(r => r.status === 'open').length
      const quoted = result.rows.filter(r => r.status === 'quoted').length
      const won = result.rows.filter(r => r.status === 'awarded').length

      return {
        journey: 'seller',
        title: 'Sales',
        summary: `${newRFQs} new RFQs, ${quoted} quoted, ${won} won`,
        metrics: {
          'New RFQs': newRFQs,
          'Quoted': quoted,
          'Won': won,
        },
        items: result.rows.slice(0, 5).map(r => ({
          id: r.id,
          title: `RFQ: ${r.quantity} ${r.category}`,
          status: r.status,
          priority: r.status === 'open' ? 'high' as const : 'normal' as const,
          actionRequired: r.status === 'open',
        })),
      }
    } catch (error) {
      console.error('[CrossJourneyContextManager] Error generating seller digest:', error)
      return null
    }
  }

  private async generateNegotiationDigestSection(
    userId: string,
    start: Date,
    end: Date
  ): Promise<DailyDigestSection | null> {
    try {
      const result = await sql`
        SELECT id, deal_type, status, current_value, updated_at
        FROM negotiations
        WHERE (buyer_id = ${userId} OR seller_id = ${userId})
        AND updated_at >= ${start.toISOString()}
        ORDER BY updated_at DESC
        LIMIT 10
      `

      if (result.rows.length === 0) return null

      const active = result.rows.filter(r => r.status === 'active').length
      const countered = result.rows.filter(r => r.status === 'countered').length
      const closed = result.rows.filter(r => r.status === 'accepted').length

      return {
        journey: 'negotiation',
        title: 'Negotiations',
        summary: `${active} active, ${countered} awaiting response, ${closed} closed`,
        metrics: {
          'Active': active,
          'Awaiting Response': countered,
          'Closed': closed,
        },
        items: result.rows.slice(0, 5).map(r => ({
          id: r.id,
          title: `${r.deal_type} negotiation`,
          status: r.status,
          priority: r.status === 'countered' ? 'high' as const : 'normal' as const,
          actionRequired: r.status === 'countered',
        })),
      }
    } catch (error) {
      console.error('[CrossJourneyContextManager] Error generating negotiation digest:', error)
      return null
    }
  }

  private generateDigestSummary(
    sections: DailyDigestSection[],
    actionItems: DigestActionItem[],
    highlights: DigestHighlight[]
  ): string {
    const parts: string[] = []

    if (actionItems.length > 0) {
      const urgent = actionItems.filter(i => i.priority === 'urgent').length
      const high = actionItems.filter(i => i.priority === 'high').length

      if (urgent > 0) {
        parts.push(`${urgent} urgent item${urgent !== 1 ? 's' : ''} need attention`)
      } else if (high > 0) {
        parts.push(`${high} high-priority item${high !== 1 ? 's' : ''} to review`)
      } else {
        parts.push(`${actionItems.length} item${actionItems.length !== 1 ? 's' : ''} to review`)
      }
    }

    sections.forEach(section => {
      parts.push(section.summary)
    })

    if (parts.length === 0) {
      return 'All caught up! No new activity in the past 24 hours.'
    }

    return parts.join('. ') + '.'
  }

  // ============================================================================
  // SHARED CONTEXT HELPERS
  // ============================================================================

  /**
   * Update shared context with new entity
   */
  async addToSharedContext(
    userId: string,
    type: 'company' | 'contact' | 'product' | 'amount',
    value: string | number
  ): Promise<void> {
    const context = await this.getJourneyContext(userId)

    switch (type) {
      case 'company':
        context.sharedContext.recentCompanies.unshift(value as string)
        context.sharedContext.recentCompanies = [...new Set(context.sharedContext.recentCompanies)].slice(0, 10)
        break
      case 'contact':
        context.sharedContext.recentContacts.unshift(value as string)
        context.sharedContext.recentContacts = [...new Set(context.sharedContext.recentContacts)].slice(0, 10)
        break
      case 'product':
        context.sharedContext.recentProducts.unshift(value as string)
        context.sharedContext.recentProducts = [...new Set(context.sharedContext.recentProducts)].slice(0, 10)
        break
      case 'amount':
        context.sharedContext.recentAmounts.unshift(value as number)
        context.sharedContext.recentAmounts = context.sharedContext.recentAmounts.slice(0, 10)
        break
    }

    await this.saveJourneyContext(userId, context)
  }

  // ============================================================================
  // DEFAULT FACTORIES
  // ============================================================================

  private createDefaultContext(userId: string): JourneyContext {
    return {
      userId,
      currentJourney: 'universal',
      availableJourneys: ['universal'],
      recentSwitches: [],
      journeyStates: this.getDefaultJourneyStates(),
      sharedContext: this.getDefaultSharedContext(),
      lastUpdated: new Date(),
    }
  }

  private getDefaultJourneyStates(): Record<JourneyType, JourneyState> {
    const defaultState: JourneyState = {
      active: false,
      pendingActions: 0,
      recentEntities: {},
      quickAccessItems: [],
    }

    return {
      rfq: { ...defaultState },
      jobs: { ...defaultState },
      payments: { ...defaultState },
      negotiation: { ...defaultState },
      seller: { ...defaultState },
      founder: { ...defaultState },
      erp: { ...defaultState },
      universal: { ...defaultState, active: true },
    }
  }

  private getDefaultSharedContext(): SharedContext {
    return {
      recentCompanies: [],
      recentContacts: [],
      recentProducts: [],
      recentAmounts: [],
      activeRFQs: [],
      activeJobs: [],
      activeNegotiations: [],
      pendingPayments: [],
    }
  }

  private getDefaultAutonomyLevels(): UnifiedUserPreferences['autonomyLevels'] {
    return {
      rfq: 'assisted',
      payments: 'manual',
      jobs: 'assisted',
      negotiation: 'assisted',
      seller: 'assisted',
      founder: 'assisted',
    }
  }

  private getDefaultPreferences(): UnifiedUserPreferences {
    return {
      defaultJourney: 'universal',
      communicationStyle: 'casual',
      notificationLevel: 'important',
      autonomyLevels: this.getDefaultAutonomyLevels(),
      spendingLimits: {
        perTransaction: 1000,
        daily: 5000,
        requiresApproval: 500,
      },
      autoNegotiate: false,
      autoApplyToJobs: false,
      autoQuote: false,
      autoPayInvoices: false,
      dailyDigest: {
        enabled: true,
        time: '09:00',
        channels: ['email', 'in_app'],
        sections: ['rfq', 'jobs', 'payments', 'seller', 'negotiation'],
      },
    }
  }

  private createDefaultJourneyState(): JourneyState {
    return {
      active: false,
      pendingActions: 0,
      recentEntities: {},
      quickAccessItems: [],
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let contextManagerInstance: CrossJourneyContextManager | null = null

export function getCrossJourneyContextManager(): CrossJourneyContextManager {
  if (!contextManagerInstance) {
    contextManagerInstance = new CrossJourneyContextManager()
  }
  return contextManagerInstance
}

// ============================================================================
// EXPORTS
// ============================================================================

export default CrossJourneyContextManager
