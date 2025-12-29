// @ts-nocheck
/**
 * Wells AI Chat Module
 *
 * Central exports for the unified conversational chat router.
 * This is the brain that understands user intent and routes to the right service.
 */

// ============================================================================
// CORE ROUTER COMPONENTS
// ============================================================================

// Intent Router - Classifies user messages and routes to handlers
export {
  classifyIntent,
  routeIntent,
  type IntentClassification,
  type RouteResult,
  type IntentCategory,
  type BuyerIntent,
  type SellerIntent,
  type FounderIntent,
  type JobSeekerIntent,
  type TreasuryIntent,
  type UniversalIntent,
  type Intent,
  type ExtractedEntities,
} from './intent-router'

// Conversation Manager - Multi-turn state management
export {
  getConversationContext,
  saveConversationContext,
  addMessage,
  startFlow,
  updateFlow,
  completeFlow,
  cancelFlow,
  checkInterruption,
  setPendingConfirmation,
  isConfirmation,
  handleConfirmation,
  buildContextSummary,
  type ConversationContext,
  type ConversationMessage,
  type ConversationFlow,
  type ConversationState,
  type ActiveDeal,
} from './conversation-manager'

// Action Executor - Execute actions from intents
export {
  executeAction,
  getHandlerMetadata,
  type ActionResult,
  type SuggestedAction,
  type ActionHandler,
} from './action-executor'

// Response Generator - Natural language responses
export {
  generateResponse,
  generateClarifyingQuestion,
  generateConfirmationMessage,
  detectCommunicationStyle,
  type GeneratedResponse,
  type CommunicationStyle,
  type ResponseTone,
} from './response-generator'

// Context Injector - Rich context for AI calls
export {
  loadUserContext,
  buildInjectedContext,
  type UserContext,
  type ActiveDealContext,
  type PendingApproval,
  type RecentTransaction,
} from './context-injector'

// ============================================================================
// CHAT TOOLS
// ============================================================================

// All tools
export {
  allTools,
  toolMetadata,
  getTool,
  getToolNames,
  getToolsHelp,
  findToolForIntent,
} from './tools'

// RFQ Tools
export {
  rfqTools,
  createRFQ,
  getRFQStatus,
  negotiateRFQ,
  acceptQuote,
  findSuppliers,
} from './tools/rfq-tools'

// ERP Tools
export {
  erpTools,
  getInvoices,
  createInvoice,
  sendInvoiceReminder,
  getPurchaseOrders,
  createPurchaseOrder,
  getVendors,
  getFinancialOverview,
  getSpendAnalysis,
} from './tools/erp-tools'

// Jobs Tools
export {
  jobsTools,
  searchJobs,
  getJobDetails,
  getApplications,
  applyToJob,
  getOffers,
  negotiateOffer,
  acceptOffer,
  getSalaryIntel,
} from './tools/jobs-tools'

// Insights Tools
export {
  insightsTools,
  getInsights,
  getAlerts,
  createAlert,
  getRecommendations,
  getAnalytics,
  getDailyDigest,
} from './tools/insights-tools'

// Payment Tools
export {
  paymentTools,
  initiatePayment,
  initiateTransfer,
  getPaymentStatus,
  getTreasuryStatus,
  getGrainStatus,
  getPaymentHistory,
} from './tools/payment-tools'

// ============================================================================
// SUPPORTING MODULES
// ============================================================================

// Context Builder (legacy, for reference)
export { buildSystemPrompt, buildPersonaContext } from './context-builder'

// Unified Chat Service (conversation storage)
export {
  getConversation,
  saveConversation,
  clearConversation,
} from './unified-chat-service'

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Process a user message through the full pipeline.
 * This is a convenience function that chains all the core components.
 */
export async function processUserMessage(
  message: string,
  userId: string,
  sessionId: string,
  options?: {
    journey?: 'buyer' | 'seller' | 'founder' | 'jobs'
    previousMessages?: Array<{ role: string; content: string }>
  }
) {
  const { journey, previousMessages } = options || {}

  // 1. Get conversation context
  const { getConversationContext, saveConversationContext, addMessage } = await import('./conversation-manager')
  const context = await getConversationContext(sessionId, userId)

  // Set journey if provided
  if (journey) {
    context.userJourney = journey
  }

  // 2. Load user context
  const { loadUserContext } = await import('./context-injector')
  const userContext = await loadUserContext(userId, context)

  // 3. Add message to context
  addMessage(context, 'user', message)

  // 4. Classify intent
  const { classifyIntent, routeIntent } = await import('./intent-router')
  const intent = await classifyIntent(message, {
    userJourney: context.userJourney as 'buyer' | 'seller' | 'founder' | 'jobs' | undefined,
    recentMessages: context.messages.slice(-5).map(m => ({
      role: m.role,
      content: m.content,
    })),
  })

  // 5. Route to handler
  const route = routeIntent(intent)

  // 6. Execute action
  const { executeAction } = await import('./action-executor')
  const actionResult = await executeAction(route, context)

  // 7. Generate response
  const { generateResponse } = await import('./response-generator')
  const response = await generateResponse(actionResult, context)

  // 8. Add response to context and save
  addMessage(context, 'assistant', response.message, intent, {
    type: route.action,
    status: actionResult.success ? 'executed' : 'failed',
  })
  await saveConversationContext(context)

  return {
    response: response.message,
    actions: response.actions,
    suggestions: response.suggestions,
    intent,
    actionResult,
    sessionId,
  }
}

/**
 * Get a quick status summary for a user.
 */
export async function getUserStatus(userId: string) {
  const { loadUserContext } = await import('./context-injector')
  const { getConversationContext } = await import('./conversation-manager')

  // Create a temporary context
  const context = await getConversationContext(`status_${Date.now()}`, userId)
  const userContext = await loadUserContext(userId, context)

  return {
    journey: userContext.primaryJourney,
    activeDeals: userContext.activeDeals.length,
    pendingApprovals: userContext.pendingApprovals.length,
    trustLevel: userContext.trustScore,
    autonomyLevel: userContext.autonomyLevel,
  }
}

/**
 * Get help text for available capabilities.
 */
export function getCapabilitiesHelp() {
  const { getToolsHelp } = require('./tools')
  return getToolsHelp()
}
