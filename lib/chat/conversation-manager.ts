// @ts-nocheck
/**
 * Wells AI Conversation Manager
 *
 * Manages multi-turn conversations with context persistence:
 * - Track conversation state across messages
 * - Remember context within a session
 * - Handle interruptions gracefully
 * - Resume abandoned conversations
 * - Clarify ambiguous requests
 */

import { sqlQuery as sql, query } from '@/lib/db'
import { IntentClassification, ExtractedEntities } from './intent-router'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

export type ConversationState =
  | 'idle'              // No active flow
  | 'gathering_info'    // Collecting required information
  | 'awaiting_confirmation' // Waiting for user to confirm action
  | 'processing'        // Executing an action
  | 'awaiting_response' // Waiting for external response (quote, payment, etc.)
  | 'completed'         // Flow completed
  | 'interrupted'       // User changed topic mid-flow
  | 'error'             // Error occurred

export interface ConversationFlow {
  id: string
  type: string // e.g., 'create_rfq', 'negotiate_offer', 'job_search'
  state: ConversationState
  startedAt: Date
  lastActivityAt: Date

  // Collected data
  collectedEntities: ExtractedEntities
  missingFields: string[]

  // Confirmation tracking
  pendingConfirmation?: {
    action: string
    message: string
    params: Record<string, unknown>
  }

  // External references
  externalIds?: {
    rfqId?: string
    quoteId?: string
    orderId?: string
    jobId?: string
    applicationId?: string
    transactionId?: string
  }

  // Results
  result?: {
    success: boolean
    data?: unknown
    error?: string
  }
}

export interface ConversationContext {
  sessionId: string
  userId: string

  // Current state
  currentFlow?: ConversationFlow
  previousFlows: ConversationFlow[]

  // Message history
  messages: ConversationMessage[]

  // User context
  userJourney: 'buyer' | 'seller' | 'founder' | 'jobs' | 'unknown'
  userPreferences: Record<string, unknown>

  // Active items
  activeDeals: ActiveDeal[]
  recentEntities: Record<string, unknown>

  // Session metadata
  createdAt: Date
  lastActivityAt: Date
  messageCount: number
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date

  // Intent tracking
  intent?: IntentClassification

  // Action tracking
  action?: {
    type: string
    status: 'pending' | 'executed' | 'failed' | 'cancelled'
    result?: unknown
  }

  // Metadata
  metadata?: Record<string, unknown>
}

export interface ActiveDeal {
  id: string
  type: 'rfq' | 'quote' | 'order' | 'job' | 'application' | 'negotiation'
  status: string
  lastUpdate: Date
  summary: string
  requiresAction: boolean
  counterparty?: string
}

// ============================================================================
// REQUIRED FIELDS BY FLOW TYPE
// ============================================================================

const REQUIRED_FIELDS: Record<string, string[]> = {
  create_rfq: ['productName', 'quantity'],
  pay_invoice: ['invoiceId', 'amount'],
  send_payment: ['recipient', 'amount'],
  create_quote: ['rfqId', 'amount'],
  apply_job: ['jobId'],
  negotiate_offer: ['targetSalary'],
  hire_talent: ['role'],
  create_po: ['vendor'],
}

const FIELD_PROMPTS: Record<string, string> = {
  productName: 'What product or service do you need?',
  quantity: 'How many do you need?',
  amount: 'What amount?',
  invoiceId: 'Which invoice?',
  recipient: 'Who should I send it to?',
  rfqId: 'Which RFQ is this for?',
  jobId: 'Which job would you like to apply to?',
  targetSalary: 'What salary are you targeting?',
  role: 'What role are you looking to fill?',
  vendor: 'Which vendor?',
  deadline: 'When do you need this by?',
  budget: 'What\'s your budget?',
}

// ============================================================================
// CONVERSATION CONTEXT MANAGEMENT
// ============================================================================

const contextCache = new Map<string, ConversationContext>()

/**
 * Get or create a conversation context
 */
export async function getConversationContext(
  sessionId: string,
  userId: string
): Promise<ConversationContext> {
  // Check cache first
  const cacheKey = `${sessionId}:${userId}`
  if (contextCache.has(cacheKey)) {
    const cached = contextCache.get(cacheKey)!
    cached.lastActivityAt = new Date()
    return cached
  }

  // Try to load from database
  try {
    const result = await sql`
      SELECT * FROM conversation_sessions
      WHERE session_id = ${sessionId} AND user_id = ${userId}
    `

    if (result.rows.length > 0) {
      const row = result.rows[0]
      const context: ConversationContext = {
        sessionId,
        userId,
        currentFlow: row.current_flow,
        previousFlows: row.previous_flows || [],
        messages: row.messages || [],
        userJourney: row.user_journey || 'unknown',
        userPreferences: row.user_preferences || {},
        activeDeals: row.active_deals || [],
        recentEntities: row.recent_entities || {},
        createdAt: new Date(row.created_at),
        lastActivityAt: new Date(),
        messageCount: row.message_count || 0,
      }
      contextCache.set(cacheKey, context)
      return context
    }
  } catch (error) {
    console.error('[ConversationManager] Error loading context:', error)
  }

  // Create new context
  const context: ConversationContext = {
    sessionId,
    userId,
    previousFlows: [],
    messages: [],
    userJourney: 'unknown',
    userPreferences: {},
    activeDeals: [],
    recentEntities: {},
    createdAt: new Date(),
    lastActivityAt: new Date(),
    messageCount: 0,
  }

  contextCache.set(cacheKey, context)
  return context
}

/**
 * Save conversation context to database
 */
export async function saveConversationContext(context: ConversationContext): Promise<void> {
  try {
    await sql`
      INSERT INTO conversation_sessions (
        session_id,
        user_id,
        current_flow,
        previous_flows,
        messages,
        user_journey,
        user_preferences,
        active_deals,
        recent_entities,
        message_count,
        created_at,
        updated_at
      ) VALUES (
        ${context.sessionId},
        ${context.userId},
        ${JSON.stringify(context.currentFlow || null)},
        ${JSON.stringify(context.previousFlows)},
        ${JSON.stringify(context.messages.slice(-50))},
        ${context.userJourney},
        ${JSON.stringify(context.userPreferences)},
        ${JSON.stringify(context.activeDeals)},
        ${JSON.stringify(context.recentEntities)},
        ${context.messageCount},
        ${context.createdAt.toISOString()},
        NOW()
      )
      ON CONFLICT (session_id, user_id) DO UPDATE SET
        current_flow = ${JSON.stringify(context.currentFlow || null)},
        previous_flows = ${JSON.stringify(context.previousFlows)},
        messages = ${JSON.stringify(context.messages.slice(-50))},
        user_journey = ${context.userJourney},
        user_preferences = ${JSON.stringify(context.userPreferences)},
        active_deals = ${JSON.stringify(context.activeDeals)},
        recent_entities = ${JSON.stringify(context.recentEntities)},
        message_count = ${context.messageCount},
        updated_at = NOW()
    `
  } catch (error) {
    console.error('[ConversationManager] Error saving context:', error)
  }
}

// ============================================================================
// FLOW MANAGEMENT
// ============================================================================

/**
 * Start a new conversation flow
 */
export function startFlow(
  context: ConversationContext,
  flowType: string,
  initialEntities: ExtractedEntities = {}
): ConversationFlow {
  // Archive current flow if exists
  if (context.currentFlow && context.currentFlow.state !== 'completed') {
    context.currentFlow.state = 'interrupted'
    context.previousFlows.push(context.currentFlow)
  }

  const requiredFields = REQUIRED_FIELDS[flowType] || []
  const missingFields = requiredFields.filter(
    field => !initialEntities[field as keyof ExtractedEntities]
  )

  const flow: ConversationFlow = {
    id: `flow_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    type: flowType,
    state: missingFields.length > 0 ? 'gathering_info' : 'awaiting_confirmation',
    startedAt: new Date(),
    lastActivityAt: new Date(),
    collectedEntities: initialEntities,
    missingFields,
  }

  context.currentFlow = flow
  return flow
}

/**
 * Update the current flow with new information
 */
export function updateFlow(
  context: ConversationContext,
  entities: ExtractedEntities
): { complete: boolean; nextPrompt?: string } {
  if (!context.currentFlow) {
    return { complete: true }
  }

  const flow = context.currentFlow

  // Merge entities
  flow.collectedEntities = {
    ...flow.collectedEntities,
    ...entities,
  }
  flow.lastActivityAt = new Date()

  // Update recent entities in context
  context.recentEntities = {
    ...context.recentEntities,
    ...entities,
  }

  // Check for missing fields
  const requiredFields = REQUIRED_FIELDS[flow.type] || []
  flow.missingFields = requiredFields.filter(
    field => !flow.collectedEntities[field as keyof ExtractedEntities]
  )

  if (flow.missingFields.length > 0) {
    const nextField = flow.missingFields[0]
    return {
      complete: false,
      nextPrompt: FIELD_PROMPTS[nextField] || `What's the ${nextField}?`,
    }
  }

  // All fields collected, ready for confirmation
  flow.state = 'awaiting_confirmation'
  return { complete: true }
}

/**
 * Complete the current flow
 */
export function completeFlow(
  context: ConversationContext,
  result: { success: boolean; data?: unknown; error?: string }
): void {
  if (!context.currentFlow) return

  context.currentFlow.state = result.success ? 'completed' : 'error'
  context.currentFlow.result = result

  // Archive the flow
  context.previousFlows.push(context.currentFlow)
  context.currentFlow = undefined
}

/**
 * Cancel the current flow
 */
export function cancelFlow(context: ConversationContext): void {
  if (!context.currentFlow) return

  context.currentFlow.state = 'completed'
  context.currentFlow.result = { success: false, error: 'Cancelled by user' }
  context.previousFlows.push(context.currentFlow)
  context.currentFlow = undefined
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

/**
 * Add a message to the conversation
 */
export function addMessage(
  context: ConversationContext,
  role: 'user' | 'assistant' | 'system',
  content: string,
  intent?: IntentClassification,
  action?: ConversationMessage['action']
): ConversationMessage {
  const message: ConversationMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    role,
    content,
    timestamp: new Date(),
    intent,
    action,
  }

  context.messages.push(message)
  context.messageCount++
  context.lastActivityAt = new Date()

  // Keep only last 100 messages in memory
  if (context.messages.length > 100) {
    context.messages = context.messages.slice(-100)
  }

  return message
}

/**
 * Get recent messages for context
 */
export function getRecentMessages(
  context: ConversationContext,
  count: number = 10
): ConversationMessage[] {
  return context.messages.slice(-count)
}

// ============================================================================
// INTERRUPTION & RESUMPTION
// ============================================================================

/**
 * Check if a new intent interrupts the current flow
 */
export function checkInterruption(
  context: ConversationContext,
  newIntent: IntentClassification
): {
  isInterruption: boolean
  shouldAsk: boolean
  message?: string
} {
  if (!context.currentFlow) {
    return { isInterruption: false, shouldAsk: false }
  }

  const currentFlow = context.currentFlow

  // Same intent type - not an interruption
  if (newIntent.intent === currentFlow.type) {
    return { isInterruption: false, shouldAsk: false }
  }

  // Check if it's a confirmation/cancellation
  if (newIntent.intent === 'undo_action' ||
      newIntent.intent === 'help' ||
      newIntent.intent === 'clarify') {
    return { isInterruption: false, shouldAsk: false }
  }

  // High-priority interruptions (urgent needs)
  if (newIntent.entities.urgency === 'critical' ||
      newIntent.entities.urgency === 'high') {
    return {
      isInterruption: true,
      shouldAsk: false,
      message: `I'll pause what we were working on to handle this urgent matter.`,
    }
  }

  // Ask about lower-priority interruptions if we're mid-flow
  if (currentFlow.state === 'gathering_info' ||
      currentFlow.state === 'awaiting_confirmation') {
    return {
      isInterruption: true,
      shouldAsk: true,
      message: `I notice you're asking about something different. Should I pause our current task (${formatFlowType(currentFlow.type)}) to help with this?`,
    }
  }

  return { isInterruption: true, shouldAsk: false }
}

function formatFlowType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}

/**
 * Get resumable flows for a user
 */
export function getResumableFlows(context: ConversationContext): ConversationFlow[] {
  return context.previousFlows.filter(
    flow => flow.state === 'interrupted' &&
    Date.now() - flow.lastActivityAt.getTime() < 24 * 60 * 60 * 1000 // Within 24 hours
  )
}

/**
 * Resume a previous flow
 */
export function resumeFlow(
  context: ConversationContext,
  flowId: string
): ConversationFlow | null {
  const flowIndex = context.previousFlows.findIndex(f => f.id === flowId)
  if (flowIndex === -1) return null

  const flow = context.previousFlows[flowIndex]

  // Archive current flow if exists
  if (context.currentFlow) {
    context.currentFlow.state = 'interrupted'
    context.previousFlows.push(context.currentFlow)
  }

  // Remove from previous flows and set as current
  context.previousFlows.splice(flowIndex, 1)
  flow.state = flow.missingFields.length > 0 ? 'gathering_info' : 'awaiting_confirmation'
  flow.lastActivityAt = new Date()
  context.currentFlow = flow

  return flow
}

// ============================================================================
// CONFIRMATION HANDLING
// ============================================================================

/**
 * Set a pending confirmation
 */
export function setPendingConfirmation(
  context: ConversationContext,
  action: string,
  message: string,
  params: Record<string, unknown>
): void {
  if (!context.currentFlow) return

  context.currentFlow.pendingConfirmation = {
    action,
    message,
    params,
  }
  context.currentFlow.state = 'awaiting_confirmation'
}

/**
 * Check if user message is a confirmation
 */
export async function isConfirmation(message: string): Promise<'yes' | 'no' | 'unclear'> {
  const lowerMessage = message.toLowerCase().trim()

  // Quick pattern matching
  const yesPatterns = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'proceed', 'go ahead', 'do it', 'confirm', 'approved', 'sounds good', 'perfect', 'let\'s do it']
  const noPatterns = ['no', 'nope', 'cancel', 'stop', 'don\'t', 'never mind', 'wait', 'hold on', 'not yet']

  for (const pattern of yesPatterns) {
    if (lowerMessage.includes(pattern)) return 'yes'
  }

  for (const pattern of noPatterns) {
    if (lowerMessage.includes(pattern)) return 'no'
  }

  // Use AI for ambiguous cases
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: `Is this a confirmation (yes/proceed), rejection (no/cancel), or unclear? Message: "${message}"\n\nRespond with only: YES, NO, or UNCLEAR`,
        },
      ],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    if (text.includes('YES')) return 'yes'
    if (text.includes('NO')) return 'no'
    return 'unclear'
  } catch {
    return 'unclear'
  }
}

/**
 * Handle user confirmation/rejection
 */
export function handleConfirmation(
  context: ConversationContext,
  confirmed: boolean
): { action: string; params: Record<string, unknown> } | null {
  if (!context.currentFlow?.pendingConfirmation) return null

  const { action, params } = context.currentFlow.pendingConfirmation
  context.currentFlow.pendingConfirmation = undefined

  if (confirmed) {
    context.currentFlow.state = 'processing'
    return { action, params }
  } else {
    context.currentFlow.state = 'idle'
    return null
  }
}

// ============================================================================
// CLARIFICATION HANDLING
// ============================================================================

/**
 * Generate a clarifying question for ambiguous input
 */
export async function generateClarification(
  context: ConversationContext,
  userMessage: string,
  possibleIntents: Array<{ intent: string; confidence: number }>
): Promise<string> {
  if (possibleIntents.length === 0) {
    return "I'm not quite sure what you need. Could you tell me more specifically what you're trying to do?"
  }

  if (possibleIntents.length === 1) {
    // Low confidence single intent
    const intent = possibleIntents[0].intent
    return `Just to confirm - are you trying to ${formatFlowType(intent).toLowerCase()}?`
  }

  // Multiple possible intents
  const options = possibleIntents.slice(0, 3).map(
    (i, idx) => `${idx + 1}. ${formatFlowType(i.intent)}`
  ).join('\n')

  return `I want to make sure I help you correctly. Did you mean:\n\n${options}\n\nOr something else?`
}

// ============================================================================
// ACTIVE DEALS TRACKING
// ============================================================================

/**
 * Add an active deal to the context
 */
export function addActiveDeal(
  context: ConversationContext,
  deal: ActiveDeal
): void {
  // Remove if already exists
  context.activeDeals = context.activeDeals.filter(d => d.id !== deal.id)
  context.activeDeals.unshift(deal)

  // Keep only recent 20 deals
  if (context.activeDeals.length > 20) {
    context.activeDeals = context.activeDeals.slice(0, 20)
  }
}

/**
 * Update an active deal's status
 */
export function updateActiveDeal(
  context: ConversationContext,
  dealId: string,
  updates: Partial<ActiveDeal>
): void {
  const deal = context.activeDeals.find(d => d.id === dealId)
  if (deal) {
    Object.assign(deal, updates, { lastUpdate: new Date() })
  }
}

/**
 * Get deals requiring user action
 */
export function getActionRequiredDeals(context: ConversationContext): ActiveDeal[] {
  return context.activeDeals.filter(d => d.requiresAction)
}

// ============================================================================
// CONTEXT SUMMARY FOR AI
// ============================================================================

/**
 * Build a summary of the conversation context for AI prompts
 */
export function buildContextSummary(context: ConversationContext): string {
  const parts: string[] = []

  // User journey
  parts.push(`User Journey: ${context.userJourney}`)

  // Current flow
  if (context.currentFlow) {
    const flow = context.currentFlow
    parts.push(`\nCurrent Task: ${formatFlowType(flow.type)}`)
    parts.push(`State: ${flow.state}`)

    if (Object.keys(flow.collectedEntities).length > 0) {
      parts.push(`Collected Info: ${JSON.stringify(flow.collectedEntities)}`)
    }

    if (flow.missingFields.length > 0) {
      parts.push(`Still Need: ${flow.missingFields.join(', ')}`)
    }

    if (flow.pendingConfirmation) {
      parts.push(`Awaiting Confirmation: ${flow.pendingConfirmation.message}`)
    }
  }

  // Active deals requiring action
  const actionDeals = getActionRequiredDeals(context)
  if (actionDeals.length > 0) {
    parts.push(`\nNeeds Attention:`)
    actionDeals.slice(0, 3).forEach(deal => {
      parts.push(`- ${deal.type}: ${deal.summary}`)
    })
  }

  // Recent conversation summary
  const recentMessages = getRecentMessages(context, 5)
  if (recentMessages.length > 0) {
    parts.push(`\nRecent Context:`)
    recentMessages.forEach(msg => {
      parts.push(`${msg.role}: ${msg.content.slice(0, 100)}${msg.content.length > 100 ? '...' : ''}`)
    })
  }

  // Resumable flows
  const resumable = getResumableFlows(context)
  if (resumable.length > 0) {
    parts.push(`\nPaused Tasks: ${resumable.map(f => formatFlowType(f.type)).join(', ')}`)
  }

  return parts.join('\n')
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ConversationManager = {
  getConversationContext,
  saveConversationContext,
  startFlow,
  updateFlow,
  completeFlow,
  cancelFlow,
  addMessage,
  getRecentMessages,
  checkInterruption,
  getResumableFlows,
  resumeFlow,
  setPendingConfirmation,
  isConfirmation,
  handleConfirmation,
  generateClarification,
  addActiveDeal,
  updateActiveDeal,
  getActionRequiredDeals,
  buildContextSummary,
}

export default ConversationManager
