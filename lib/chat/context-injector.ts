// @ts-nocheck
/**
 * Wells AI Context Injector
 *
 * Injects rich user context into every AI call:
 * - User journey (buyer/seller/founder/jobs)
 * - Active deals/negotiations
 * - Recent transactions
 * - Preferences from memory
 * - Trust level / autonomy granted
 */

import { sqlQuery as sql } from '@/lib/db'
import { getWellsMemory, buildMemoryContextForPrompt, WellsMemory } from '@/lib/wells-memory'
import { ConversationContext, getRecentMessages } from './conversation-manager'
import { IntentCategory } from './intent-router'

// ============================================================================
// TYPES
// ============================================================================

export interface UserContext {
  // Identity
  userId: string
  firstName?: string
  lastName?: string
  email?: string
  companyName?: string
  role?: string

  // Journey
  primaryJourney: IntentCategory
  availableJourneys: IntentCategory[]

  // Active Items
  activeDeals: ActiveDealContext[]
  pendingApprovals: PendingApproval[]
  recentTransactions: RecentTransaction[]

  // Preferences
  communicationStyle?: 'formal' | 'casual' | 'direct' | 'detailed'
  autonomyLevel: 'manual' | 'assisted' | 'autonomous'
  autoNegotiate: boolean
  autoApply: boolean
  notificationPreferences: NotificationPrefs

  // Trust & Verification
  trustScore: number
  verificationLevel: 'none' | 'basic' | 'verified' | 'premium'
  spendingLimits?: SpendingLimits

  // Context
  timezone?: string
  currency?: string
  industry?: string

  // Memory
  learnedFacts: string[]
  recentTopics: string[]
  frequentContacts: string[]
}

export interface ActiveDealContext {
  id: string
  type: 'rfq' | 'quote' | 'order' | 'job' | 'application' | 'negotiation'
  status: string
  summary: string
  amount?: number
  counterparty?: string
  lastUpdate: Date
  requiresAction: boolean
  actionDescription?: string
  deadline?: Date
}

export interface PendingApproval {
  id: string
  type: 'quote' | 'payment' | 'application' | 'counter_offer'
  description: string
  amount?: number
  from?: string
  expiresAt?: Date
  priority: 'low' | 'normal' | 'high' | 'urgent'
}

export interface RecentTransaction {
  id: string
  type: 'purchase' | 'sale' | 'payment' | 'receipt'
  amount: number
  description: string
  counterparty: string
  date: Date
}

export interface NotificationPrefs {
  email: boolean
  sms: boolean
  inApp: boolean
  digest: 'immediate' | 'daily' | 'weekly' | 'none'
}

export interface SpendingLimits {
  perTransaction: number
  daily: number
  monthly: number
  requiresApproval: number
}

export interface InjectedContext {
  systemPromptAddition: string
  contextSummary: string
  availableTools: string[]
  suggestedActions: string[]
}

// ============================================================================
// CONTEXT LOADING
// ============================================================================

/**
 * Load complete user context from all sources
 */
export async function loadUserContext(
  userId: string,
  conversationContext?: ConversationContext
): Promise<UserContext> {
  // Load from multiple sources in parallel
  const [
    memory,
    activeDeals,
    pendingApprovals,
    recentTransactions,
    userSettings,
  ] = await Promise.all([
    getWellsMemory(userId),
    loadActiveDeals(userId),
    loadPendingApprovals(userId),
    loadRecentTransactions(userId),
    loadUserSettings(userId),
  ])

  // Determine primary journey
  const primaryJourney = determineJourney(memory, conversationContext)

  // Build the user context
  const context: UserContext = {
    // Identity
    userId,
    firstName: memory?.firstName,
    lastName: memory?.lastName,
    email: memory?.email,
    companyName: memory?.companyName,
    role: memory?.role,

    // Journey
    primaryJourney,
    availableJourneys: determineAvailableJourneys(memory),

    // Active Items
    activeDeals,
    pendingApprovals,
    recentTransactions,

    // Preferences
    communicationStyle: memory?.communicationStyle,
    autonomyLevel: userSettings?.autonomyLevel || 'assisted',
    autoNegotiate: userSettings?.autoNegotiate || false,
    autoApply: userSettings?.autoApply || false,
    notificationPreferences: userSettings?.notifications || {
      email: true,
      sms: false,
      inApp: true,
      digest: 'immediate',
    },

    // Trust & Verification
    trustScore: userSettings?.trustScore || 50,
    verificationLevel: userSettings?.verificationLevel || 'none',
    spendingLimits: userSettings?.spendingLimits,

    // Context
    timezone: memory?.timezone,
    currency: userSettings?.currency || 'USD',
    industry: memory?.industry,

    // Memory
    learnedFacts: memory?.learnedFacts?.map(f => f.fact) || [],
    recentTopics: memory?.recentTopics || [],
    frequentContacts: extractFrequentContacts(memory, recentTransactions),
  }

  return context
}

async function loadActiveDeals(userId: string): Promise<ActiveDealContext[]> {
  const deals: ActiveDealContext[] = []

  try {
    // Load RFQs
    const rfqResult = await sql`
      SELECT id, category, quantity, target_price, status, created_at, updated_at
      FROM rfqs
      WHERE requestor_id = ${userId} AND status NOT IN ('completed', 'cancelled', 'closed')
      ORDER BY updated_at DESC
      LIMIT 10
    `

    rfqResult.rows.forEach((row: { id: string; category: string; quantity: number; target_price: number; status: string; updated_at: string }) => {
      deals.push({
        id: row.id,
        type: 'rfq',
        status: row.status,
        summary: `RFQ for ${row.quantity} ${row.category}`,
        amount: row.target_price,
        lastUpdate: new Date(row.updated_at),
        requiresAction: ['quoted', 'negotiating'].includes(row.status),
        actionDescription: row.status === 'quoted' ? 'Review quotes' : undefined,
      })
    })

    // Load active quotes (as seller)
    const quoteResult = await sql`
      SELECT q.id, q.rfq_id, q.total_price, q.status, r.category, r.quantity, q.updated_at
      FROM rfq_quotes q
      JOIN rfqs r ON q.rfq_id = r.id
      WHERE q.supplier_id = ${userId} AND q.status IN ('pending', 'negotiating')
      ORDER BY q.updated_at DESC
      LIMIT 10
    `

    quoteResult.rows.forEach((row: { id: string; category: string; quantity: number; total_price: number; status: string; updated_at: string }) => {
      deals.push({
        id: row.id,
        type: 'quote',
        status: row.status,
        summary: `Quote for ${row.quantity} ${row.category}`,
        amount: row.total_price,
        lastUpdate: new Date(row.updated_at),
        requiresAction: row.status === 'pending',
        actionDescription: 'Awaiting buyer response',
      })
    })

    // Load job applications
    const appResult = await sql`
      SELECT a.id, a.status, t.title, t.poster_company, a.proposed_rate, a.updated_at
      FROM job_applications a
      JOIN job_tasks t ON a.task_id = t.id
      WHERE a.worker_id = ${userId} AND a.status IN ('pending', 'shortlisted', 'interviewing')
      ORDER BY a.updated_at DESC
      LIMIT 10
    `

    appResult.rows.forEach((row: { id: string; title: string; poster_company: string; proposed_rate: number; status: string; updated_at: string }) => {
      deals.push({
        id: row.id,
        type: 'application',
        status: row.status,
        summary: `${row.title} at ${row.poster_company}`,
        amount: row.proposed_rate,
        counterparty: row.poster_company,
        lastUpdate: new Date(row.updated_at),
        requiresAction: row.status === 'interviewing',
        actionDescription: row.status === 'interviewing' ? 'Interview scheduled' : undefined,
      })
    })

  } catch (error) {
    console.error('[ContextInjector] Error loading active deals:', error)
  }

  return deals.sort((a, b) => b.lastUpdate.getTime() - a.lastUpdate.getTime())
}

async function loadPendingApprovals(userId: string): Promise<PendingApproval[]> {
  const approvals: PendingApproval[] = []

  try {
    // Load quotes awaiting approval
    const quoteResult = await sql`
      SELECT q.id, q.total_price, s.company_name, r.category, q.valid_until
      FROM rfq_quotes q
      JOIN rfqs r ON q.rfq_id = r.id
      JOIN suppliers s ON q.supplier_id = s.id
      WHERE r.requestor_id = ${userId} AND q.status = 'active'
      ORDER BY q.valid_until ASC
      LIMIT 5
    `

    quoteResult.rows.forEach((row: { id: string; total_price: number; company_name: string; category: string; valid_until: string }) => {
      approvals.push({
        id: row.id,
        type: 'quote',
        description: `Quote from ${row.company_name} for ${row.category}`,
        amount: row.total_price,
        from: row.company_name,
        expiresAt: row.valid_until ? new Date(row.valid_until) : undefined,
        priority: 'normal',
      })
    })

    // Load payment approvals
    const paymentResult = await sql`
      SELECT id, amount, vendor_name, bill_number, due_date
      FROM erp_bills
      WHERE company_id = ${userId} AND intercept_proposed = true AND intercept_accepted = false
      ORDER BY due_date ASC
      LIMIT 5
    `

    paymentResult.rows.forEach((row: { id: string; amount: number; vendor_name: string; bill_number: string; due_date: string }) => {
      const daysUntilDue = Math.ceil((new Date(row.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      approvals.push({
        id: row.id,
        type: 'payment',
        description: `Invoice ${row.bill_number} from ${row.vendor_name}`,
        amount: row.amount,
        from: row.vendor_name,
        expiresAt: new Date(row.due_date),
        priority: daysUntilDue <= 3 ? 'urgent' : daysUntilDue <= 7 ? 'high' : 'normal',
      })
    })

  } catch (error) {
    console.error('[ContextInjector] Error loading pending approvals:', error)
  }

  return approvals
}

async function loadRecentTransactions(userId: string): Promise<RecentTransaction[]> {
  const transactions: RecentTransaction[] = []

  try {
    const result = await sql`
      SELECT id, type, amount, description, counterparty_name, created_at
      FROM transactions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 10
    `

    result.rows.forEach((row: { id: string; type: string; amount: number; description: string; counterparty_name: string; created_at: string }) => {
      transactions.push({
        id: row.id,
        type: row.type as RecentTransaction['type'],
        amount: row.amount,
        description: row.description,
        counterparty: row.counterparty_name,
        date: new Date(row.created_at),
      })
    })

  } catch (error) {
    console.error('[ContextInjector] Error loading transactions:', error)
  }

  return transactions
}

async function loadUserSettings(userId: string): Promise<Record<string, unknown>> {
  try {
    const result = await sql`
      SELECT * FROM user_settings WHERE user_id = ${userId}
    `

    if (result.rows.length > 0) {
      const row = result.rows[0]
      return {
        autonomyLevel: row.autonomy_level,
        autoNegotiate: row.auto_negotiate,
        autoApply: row.auto_apply,
        trustScore: row.trust_score,
        verificationLevel: row.verification_level,
        currency: row.default_currency,
        spendingLimits: row.spending_limits,
        notifications: row.notification_preferences,
      }
    }
  } catch (error) {
    console.error('[ContextInjector] Error loading user settings:', error)
  }

  return {}
}

function determineJourney(
  memory: WellsMemory | null,
  conversationContext?: ConversationContext
): IntentCategory {
  // Use conversation context if available
  if (conversationContext?.userJourney && conversationContext.userJourney !== 'unknown') {
    return conversationContext.userJourney as IntentCategory
  }

  // Use memory if available
  if (memory?.wellsaiProfile?.primaryJourney) {
    return memory.wellsaiProfile.primaryJourney as IntentCategory
  }

  return 'unknown'
}

function determineAvailableJourneys(memory: WellsMemory | null): IntentCategory[] {
  const journeys: IntentCategory[] = []

  if (memory?.wellsaiProfile) {
    if (memory.wellsaiProfile.buyerContext) journeys.push('buyer')
    if (memory.wellsaiProfile.sellerContext) journeys.push('seller')
    if (memory.wellsaiProfile.founderContext) journeys.push('founder')
    if (memory.wellsaiProfile.jobsContext) journeys.push('jobs')
  }

  // Default to all if none determined
  if (journeys.length === 0) {
    journeys.push('buyer', 'seller', 'founder', 'jobs')
  }

  return journeys
}

function extractFrequentContacts(
  memory: WellsMemory | null,
  transactions: RecentTransaction[]
): string[] {
  const contacts = new Set<string>()

  // From memory
  if (memory?.grainvaultProfile?.paymentHistory?.frequentRecipients) {
    memory.grainvaultProfile.paymentHistory.frequentRecipients.forEach(r => contacts.add(r))
  }

  // From transactions
  transactions.forEach(t => {
    if (t.counterparty) contacts.add(t.counterparty)
  })

  return Array.from(contacts).slice(0, 10)
}

// ============================================================================
// CONTEXT INJECTION
// ============================================================================

/**
 * Build the injected context for AI prompts
 */
export function buildInjectedContext(
  userContext: UserContext,
  conversationContext?: ConversationContext
): InjectedContext {
  const systemPromptParts: string[] = []

  // User identity
  const userName = userContext.firstName || 'the user'
  systemPromptParts.push(`USER: ${userName}${userContext.companyName ? ` from ${userContext.companyName}` : ''}`)

  if (userContext.role) {
    systemPromptParts.push(`Role: ${userContext.role}`)
  }

  // Journey context
  systemPromptParts.push(`\nPRIMARY JOURNEY: ${userContext.primaryJourney}`)
  if (userContext.availableJourneys.length > 1) {
    systemPromptParts.push(`Also uses: ${userContext.availableJourneys.filter(j => j !== userContext.primaryJourney).join(', ')}`)
  }

  // Communication preferences
  if (userContext.communicationStyle) {
    systemPromptParts.push(`\nCOMMUNICATION STYLE: ${userContext.communicationStyle}`)
  }

  // Autonomy level
  systemPromptParts.push(`\nAUTONOMY: ${userContext.autonomyLevel}`)
  if (userContext.autoNegotiate) {
    systemPromptParts.push('- Auto-negotiate enabled')
  }
  if (userContext.autoApply) {
    systemPromptParts.push('- Auto-apply enabled')
  }

  // Active deals
  if (userContext.activeDeals.length > 0) {
    systemPromptParts.push(`\nACTIVE DEALS (${userContext.activeDeals.length}):`)
    userContext.activeDeals.slice(0, 5).forEach(deal => {
      const requiresAction = deal.requiresAction ? ' [ACTION NEEDED]' : ''
      systemPromptParts.push(`- ${deal.type}: ${deal.summary}${deal.amount ? ` ($${deal.amount})` : ''} - ${deal.status}${requiresAction}`)
    })
  }

  // Pending approvals
  if (userContext.pendingApprovals.length > 0) {
    systemPromptParts.push(`\nPENDING APPROVALS (${userContext.pendingApprovals.length}):`)
    userContext.pendingApprovals.slice(0, 3).forEach(approval => {
      const urgency = approval.priority === 'urgent' ? ' [URGENT]' : approval.priority === 'high' ? ' [HIGH]' : ''
      systemPromptParts.push(`- ${approval.type}: ${approval.description}${approval.amount ? ` ($${approval.amount})` : ''}${urgency}`)
    })
  }

  // Learned facts
  if (userContext.learnedFacts.length > 0) {
    systemPromptParts.push(`\nLEARNED ABOUT USER:`)
    userContext.learnedFacts.slice(0, 5).forEach(fact => {
      systemPromptParts.push(`- ${fact}`)
    })
  }

  // Recent topics
  if (userContext.recentTopics.length > 0) {
    systemPromptParts.push(`\nRECENT TOPICS: ${userContext.recentTopics.slice(0, 5).join(', ')}`)
  }

  // Spending limits
  if (userContext.spendingLimits) {
    systemPromptParts.push(`\nSPENDING LIMITS:`)
    systemPromptParts.push(`- Per transaction: $${userContext.spendingLimits.perTransaction}`)
    systemPromptParts.push(`- Requires approval above: $${userContext.spendingLimits.requiresApproval}`)
  }

  // Build context summary (shorter version for display)
  const contextSummary = buildContextSummary(userContext, conversationContext)

  // Determine available tools based on journey
  const availableTools = determineAvailableTools(userContext)

  // Generate suggested actions
  const suggestedActions = generateSuggestedActions(userContext)

  return {
    systemPromptAddition: systemPromptParts.join('\n'),
    contextSummary,
    availableTools,
    suggestedActions,
  }
}

function buildContextSummary(
  userContext: UserContext,
  conversationContext?: ConversationContext
): string {
  const parts: string[] = []

  const userName = userContext.firstName || 'User'
  parts.push(`${userName} (${userContext.primaryJourney})`)

  if (userContext.activeDeals.length > 0) {
    const actionRequired = userContext.activeDeals.filter(d => d.requiresAction).length
    parts.push(`${userContext.activeDeals.length} active deals${actionRequired > 0 ? ` (${actionRequired} need action)` : ''}`)
  }

  if (userContext.pendingApprovals.length > 0) {
    const urgent = userContext.pendingApprovals.filter(a => a.priority === 'urgent').length
    parts.push(`${userContext.pendingApprovals.length} pending approvals${urgent > 0 ? ` (${urgent} urgent)` : ''}`)
  }

  if (conversationContext?.currentFlow) {
    parts.push(`Working on: ${conversationContext.currentFlow.type.replace(/_/g, ' ')}`)
  }

  return parts.join(' | ')
}

function determineAvailableTools(userContext: UserContext): string[] {
  const tools: string[] = ['universal']

  const journeyTools: Record<IntentCategory, string[]> = {
    buyer: ['rfq', 'erp', 'payments', 'insights'],
    seller: ['rfq', 'payments', 'insights'],
    founder: ['rfq', 'erp', 'jobs', 'insights', 'payments'],
    jobs: ['jobs', 'insights'],
    treasury: ['treasury', 'payments'],
    universal: ['universal'],
    unknown: ['rfq', 'erp', 'jobs', 'payments', 'insights', 'treasury'],
  }

  userContext.availableJourneys.forEach(journey => {
    const journeySpecificTools = journeyTools[journey] || []
    journeySpecificTools.forEach(tool => {
      if (!tools.includes(tool)) tools.push(tool)
    })
  })

  return tools
}

function generateSuggestedActions(userContext: UserContext): string[] {
  const suggestions: string[] = []

  // Based on pending approvals
  if (userContext.pendingApprovals.length > 0) {
    const urgent = userContext.pendingApprovals.find(a => a.priority === 'urgent')
    if (urgent) {
      suggestions.push(`Review urgent ${urgent.type}: ${urgent.description}`)
    }
  }

  // Based on active deals requiring action
  const actionDeals = userContext.activeDeals.filter(d => d.requiresAction)
  if (actionDeals.length > 0) {
    const first = actionDeals[0]
    suggestions.push(`${first.actionDescription || `Check ${first.type}`}`)
  }

  // Journey-specific suggestions
  if (userContext.primaryJourney === 'buyer' && userContext.activeDeals.filter(d => d.type === 'rfq').length === 0) {
    suggestions.push('Create a new RFQ')
  }

  if (userContext.primaryJourney === 'seller') {
    suggestions.push('Check for new RFQs')
  }

  if (userContext.primaryJourney === 'jobs') {
    suggestions.push('Search for new opportunities')
  }

  return suggestions.slice(0, 3)
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ContextInjector = {
  loadUserContext,
  buildInjectedContext,
}

export default ContextInjector
