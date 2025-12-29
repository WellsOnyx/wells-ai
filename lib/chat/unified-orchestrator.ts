// @ts-nocheck
/**
 * Wells AI Unified Orchestrator
 *
 * The MASTER brain that makes WellsAI feel like ONE intelligent assistant.
 * Coordinates all conversational handlers seamlessly:
 * - Routes messages to correct handlers (RFQ, Jobs, Payments, Negotiation, Seller, Founder, ERP)
 * - Handles multi-intent messages ("Find suppliers AND start negotiations")
 * - Maintains conversation context across journey switches
 * - Provides fallback handling for unclear intents
 * - Supports journey-specific personality adjustments
 * - Coordinates cross-handler operations (e.g., payment after RFQ acceptance)
 * - Tracks user preferences and autonomy levels
 * - Generates unified daily digests across all journeys
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  classifyIntent,
  classifyMultipleIntents,
  routeIntent,
  IntentClassification,
  RouteResult,
  IntentCategory,
  ExtractedEntities,
} from './intent-router'
import {
  CrossJourneyContextManager,
  JourneyContext,
  UnifiedUserPreferences,
  CrossHandlerOperation,
  DailyDigest,
} from './context-manager'
import {
  getConversationContext,
  saveConversationContext,
  addMessage,
  startFlow,
  updateFlow,
  completeFlow,
  checkInterruption,
  isConfirmation,
  handleConfirmation,
  setPendingConfirmation,
  getResumableFlows,
  ConversationContext,
  ConversationMessage,
} from './conversation-manager'
import {
  loadUserContext,
  buildInjectedContext,
  UserContext,
} from './context-injector'
import {
  executeAction,
  getHandlerMetadata,
  ActionResult,
  SuggestedAction,
} from './action-executor'
import {
  generateResponse,
  generateClarifyingQuestion,
  generateConfirmationMessage,
  detectCommunicationStyle,
} from './response-generator'
import {
  getWellsMemory,
  updateWellsMemory,
  learnFromConversation,
  learnFact,
  WellsMemory,
} from '@/lib/wells-memory'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

export type JourneyType =
  | 'rfq'           // Request for Quotes / Procurement
  | 'jobs'          // Job search and applications
  | 'payments'      // Treasury and GRAIN payments
  | 'negotiation'   // AI-to-AI negotiations
  | 'seller'        // Supplier/vendor operations
  | 'founder'       // Founder/business owner operations
  | 'erp'           // ERP/accounting integrations
  | 'universal'     // General assistance

export interface UnifiedOrchestratorResponse {
  message: string
  actions?: ExecutedAction[]
  suggestions?: string[]
  quickActions?: QuickAction[]
  displayData?: Record<string, unknown>
  crossHandlerNotices?: CrossHandlerNotice[]
  journeyContext?: {
    current: JourneyType
    available: JourneyType[]
    recentSwitches: Array<{ from: JourneyType; to: JourneyType; timestamp: Date }>
  }
  metadata?: {
    intents: IntentClassification[]
    primaryIntent: IntentClassification
    sessionId: string
    processingTimeMs: number
    toolsUsed?: string[]
    handlersInvoked?: string[]
    multiIntentHandled?: boolean
  }
}

export interface ExecutedAction {
  type: string
  handler: JourneyType
  status: 'success' | 'failed' | 'pending' | 'requires_confirmation'
  result?: unknown
  error?: string
  createdIds?: Record<string, string>
  chainedWith?: string[]  // IDs of related actions
}

export interface QuickAction {
  label: string
  action: string
  params?: Record<string, unknown>
  primary?: boolean
  icon?: string
  journey?: JourneyType
}

export interface CrossHandlerNotice {
  type: 'opportunity' | 'dependency' | 'suggestion' | 'warning'
  message: string
  sourceHandler: JourneyType
  targetHandler?: JourneyType
  actionRequired?: boolean
  suggestedAction?: QuickAction
}

export interface UnifiedOrchestratorConfig {
  enableAutonomousActions?: boolean
  maxAutonomousAmount?: number
  communicationStyle?: 'formal' | 'casual' | 'direct' | 'detailed'
  enableProactiveInsights?: boolean
  enableLearning?: boolean
  enableCrossHandlerOperations?: boolean
  autonomyLevels?: {
    rfq?: 'manual' | 'assisted' | 'autonomous'
    payments?: 'manual' | 'assisted' | 'autonomous'
    jobs?: 'manual' | 'assisted' | 'autonomous'
    negotiation?: 'manual' | 'assisted' | 'autonomous'
  }
}

// ============================================================================
// JOURNEY PERSONALITIES
// ============================================================================

const JOURNEY_PERSONALITIES: Record<JourneyType, {
  tone: string
  style: string
  priorities: string[]
  vocabulary: string[]
}> = {
  rfq: {
    tone: 'efficient and precise',
    style: 'Focus on specifications, pricing, and timelines',
    priorities: ['speed', 'accuracy', 'cost-effectiveness'],
    vocabulary: ['quote', 'specification', 'delivery', 'supplier', 'procurement'],
  },
  jobs: {
    tone: 'encouraging and strategic',
    style: 'Focus on career growth and opportunity matching',
    priorities: ['fit', 'growth', 'compensation'],
    vocabulary: ['opportunity', 'role', 'compensation', 'growth', 'team'],
  },
  payments: {
    tone: 'precise and trustworthy',
    style: 'Focus on accuracy, security, and confirmations',
    priorities: ['accuracy', 'security', 'speed'],
    vocabulary: ['transfer', 'balance', 'GRAIN', 'transaction', 'confirm'],
  },
  negotiation: {
    tone: 'strategic and confident',
    style: 'Focus on value, leverage, and outcomes',
    priorities: ['outcome', 'relationship', 'value'],
    vocabulary: ['counter', 'terms', 'value', 'agreement', 'leverage'],
  },
  seller: {
    tone: 'proactive and opportunity-focused',
    style: 'Focus on winning deals and customer satisfaction',
    priorities: ['conversion', 'reputation', 'margins'],
    vocabulary: ['quote', 'customer', 'win rate', 'fulfillment', 'rating'],
  },
  founder: {
    tone: 'strategic and comprehensive',
    style: 'Focus on big picture while handling details',
    priorities: ['growth', 'efficiency', 'runway'],
    vocabulary: ['runway', 'burn', 'growth', 'team', 'investors'],
  },
  erp: {
    tone: 'systematic and thorough',
    style: 'Focus on accuracy, compliance, and integration',
    priorities: ['accuracy', 'compliance', 'efficiency'],
    vocabulary: ['invoice', 'PO', 'sync', 'reconcile', 'audit'],
  },
  universal: {
    tone: 'helpful and adaptable',
    style: 'Detect context and adjust accordingly',
    priorities: ['helpfulness', 'clarity', 'efficiency'],
    vocabulary: ['help', 'status', 'show', 'find', 'create'],
  },
}

// ============================================================================
// CROSS-HANDLER OPERATION DEFINITIONS
// ============================================================================

const CROSS_HANDLER_OPERATIONS: Array<{
  trigger: { handler: JourneyType; action: string; status: string }
  followUp: { handler: JourneyType; action: string }
  condition?: (result: unknown) => boolean
  message: string
}> = [
  {
    trigger: { handler: 'rfq', action: 'awardQuote', status: 'success' },
    followUp: { handler: 'payments', action: 'fundEscrow' },
    message: 'Quote awarded! Ready to fund the escrow to confirm the order.',
  },
  {
    trigger: { handler: 'jobs', action: 'acceptOffer', status: 'success' },
    followUp: { handler: 'payments', action: 'setupPayroll' },
    message: 'Offer accepted! Let me help set up payment details.',
  },
  {
    trigger: { handler: 'negotiation', action: 'acceptDeal', status: 'success' },
    followUp: { handler: 'erp', action: 'createContract' },
    message: 'Deal closed! Creating the contract documentation.',
  },
  {
    trigger: { handler: 'seller', action: 'quoteAccepted', status: 'success' },
    followUp: { handler: 'erp', action: 'createInvoice' },
    message: 'Your quote was accepted! Ready to generate the invoice.',
  },
  {
    trigger: { handler: 'founder', action: 'hireTalent', status: 'success' },
    followUp: { handler: 'jobs', action: 'sendOffer' },
    message: 'Great candidate found! Preparing the offer letter.',
  },
]

// ============================================================================
// UNIFIED ORCHESTRATOR CLASS
// ============================================================================

export class UnifiedOrchestrator {
  private config: UnifiedOrchestratorConfig
  private contextManager: CrossJourneyContextManager

  constructor(config: UnifiedOrchestratorConfig = {}) {
    this.config = {
      enableAutonomousActions: true,
      maxAutonomousAmount: 1000,
      enableProactiveInsights: true,
      enableLearning: true,
      enableCrossHandlerOperations: true,
      autonomyLevels: {
        rfq: 'assisted',
        payments: 'manual',
        jobs: 'assisted',
        negotiation: 'assisted',
      },
      ...config,
    }
    this.contextManager = new CrossJourneyContextManager()
  }

  // ============================================================================
  // MAIN MESSAGE HANDLER
  // ============================================================================

  /**
   * Main entry point - handle a user message with full orchestration
   */
  async handleMessage(
    userId: string,
    message: string,
    sessionId: string,
    options?: {
      journey?: JourneyType
      previousMessages?: Array<{ role: string; content: string }>
      forceHandler?: JourneyType
    }
  ): Promise<UnifiedOrchestratorResponse> {
    const startTime = Date.now()
    const toolsUsed: string[] = []
    const handlersInvoked: string[] = []

    try {
      // 1. Load all context
      const { context, userContext, memory, journeyContext } = await this.loadFullContext(
        userId,
        sessionId,
        options?.journey
      )

      // 2. Add user message to conversation
      addMessage(context, 'user', message)

      // 3. Handle flow state (confirmations, interruptions)
      const flowResult = await this.handleFlowState(context, message)
      if (flowResult) {
        await saveConversationContext(context)
        return {
          ...flowResult,
          journeyContext: {
            current: journeyContext.currentJourney,
            available: journeyContext.availableJourneys,
            recentSwitches: journeyContext.recentSwitches.slice(-3),
          },
          metadata: {
            intents: [],
            primaryIntent: { category: 'universal', intent: 'clarify', confidence: 1, entities: {}, requiresConfirmation: false },
            sessionId,
            processingTimeMs: Date.now() - startTime,
          },
        }
      }

      // 4. Detect intents (support multi-intent)
      const intents = await this.detectIntents(message, context, userContext, options?.forceHandler)
      const primaryIntent = intents[0]

      // 5. Check for journey switch
      const journeySwitch = this.detectJourneySwitch(primaryIntent, journeyContext)
      if (journeySwitch) {
        await this.contextManager.recordJourneySwitch(
          userId,
          journeyContext.currentJourney,
          journeySwitch.newJourney,
          message
        )
        journeyContext.currentJourney = journeySwitch.newJourney
      }

      // 6. Handle multi-intent if detected
      let isMultiIntent = intents.length > 1
      const executedActions: ExecutedAction[] = []
      const crossHandlerNotices: CrossHandlerNotice[] = []
      let responseText = ''
      let suggestions: string[] = []
      let quickActions: QuickAction[] = []
      let displayData: Record<string, unknown> = {}

      if (isMultiIntent) {
        // Handle each intent in sequence
        const multiResult = await this.handleMultipleIntents(intents, context, userContext, journeyContext)
        executedActions.push(...multiResult.actions)
        crossHandlerNotices.push(...multiResult.notices)
        responseText = multiResult.consolidatedResponse
        suggestions = multiResult.suggestions
        quickActions = multiResult.quickActions
        displayData = multiResult.displayData
        handlersInvoked.push(...multiResult.handlersUsed)
      } else {
        // Single intent handling
        const singleResult = await this.handleSingleIntent(
          primaryIntent,
          context,
          userContext,
          journeyContext
        )
        if (singleResult.action) {
          executedActions.push(singleResult.action)
        }
        crossHandlerNotices.push(...singleResult.notices)
        responseText = singleResult.response
        suggestions = singleResult.suggestions
        quickActions = singleResult.quickActions
        displayData = singleResult.displayData
        if (singleResult.handler) {
          handlersInvoked.push(singleResult.handler)
        }
        toolsUsed.push(...(singleResult.toolsUsed || []))
      }

      // 7. Check for cross-handler operations
      if (this.config.enableCrossHandlerOperations) {
        const crossOps = await this.checkCrossHandlerOperations(executedActions, userId)
        crossHandlerNotices.push(...crossOps)
      }

      // 8. Generate unified suggestions
      suggestions = this.generateUnifiedSuggestions(
        context,
        journeyContext,
        executedActions,
        intents
      )

      // 9. Apply personality adjustments
      responseText = this.applyPersonalityAdjustments(
        responseText,
        journeyContext.currentJourney,
        userContext
      )

      // 10. Update memory with learned facts
      if (this.config.enableLearning) {
        await this.updateMemory(userId, message, intents, executedActions, context)
      }

      // 11. Add assistant response to conversation
      addMessage(context, 'assistant', responseText, primaryIntent, {
        type: toolsUsed.join(',') || 'conversation',
        status: executedActions.every(a => a.status === 'success') ? 'executed' : 'pending',
      })

      // 12. Save context
      await saveConversationContext(context)
      await this.contextManager.saveJourneyContext(userId, journeyContext)

      return {
        message: responseText || "I'm here to help. What do you need?",
        actions: executedActions.length > 0 ? executedActions : undefined,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        quickActions: quickActions.length > 0 ? quickActions : undefined,
        displayData: Object.keys(displayData).length > 0 ? displayData : undefined,
        crossHandlerNotices: crossHandlerNotices.length > 0 ? crossHandlerNotices : undefined,
        journeyContext: {
          current: journeyContext.currentJourney,
          available: journeyContext.availableJourneys,
          recentSwitches: journeyContext.recentSwitches.slice(-3),
        },
        metadata: {
          intents,
          primaryIntent,
          sessionId,
          processingTimeMs: Date.now() - startTime,
          toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
          handlersInvoked: handlersInvoked.length > 0 ? handlersInvoked : undefined,
          multiIntentHandled: isMultiIntent,
        },
      }

    } catch (error) {
      console.error('[UnifiedOrchestrator] Error:', error)
      return {
        message: "I ran into an issue processing your request. Could you try rephrasing?",
        suggestions: ['Show what you can do', 'Check my status', 'Get help'],
        metadata: {
          intents: [],
          primaryIntent: { category: 'universal', intent: 'clarify', confidence: 0, entities: {}, requiresConfirmation: false },
          sessionId,
          processingTimeMs: Date.now() - startTime,
        },
      }
    }
  }

  // ============================================================================
  // CONTEXT LOADING
  // ============================================================================

  private async loadFullContext(
    userId: string,
    sessionId: string,
    journey?: JourneyType
  ): Promise<{
    context: ConversationContext
    userContext: UserContext
    memory: WellsMemory | null
    journeyContext: JourneyContext
  }> {
    const [context, memory, journeyContext] = await Promise.all([
      getConversationContext(sessionId, userId),
      getWellsMemory(userId),
      this.contextManager.getJourneyContext(userId),
    ])

    // Set journey if provided
    if (journey) {
      context.userJourney = this.mapJourneyToCategory(journey)
      journeyContext.currentJourney = journey
    }

    const userContext = await loadUserContext(userId, context)

    return { context, userContext, memory, journeyContext }
  }

  private mapJourneyToCategory(journey: JourneyType): 'buyer' | 'seller' | 'founder' | 'jobs' | 'unknown' {
    const mapping: Record<JourneyType, 'buyer' | 'seller' | 'founder' | 'jobs' | 'unknown'> = {
      rfq: 'buyer',
      jobs: 'jobs',
      payments: 'buyer',
      negotiation: 'buyer',
      seller: 'seller',
      founder: 'founder',
      erp: 'buyer',
      universal: 'unknown',
    }
    return mapping[journey] || 'unknown'
  }

  // ============================================================================
  // FLOW STATE HANDLING
  // ============================================================================

  private async handleFlowState(
    context: ConversationContext,
    message: string
  ): Promise<UnifiedOrchestratorResponse | null> {
    if (context.currentFlow?.pendingConfirmation) {
      const confirmation = await isConfirmation(message)

      if (confirmation === 'yes') {
        const actionData = handleConfirmation(context, true)
        if (actionData) {
          const route: RouteResult = {
            handler: actionData.action,
            toolGroup: actionData.action.split('.')[0] || 'universal',
            action: actionData.action.split('.')[1] || actionData.action,
            params: actionData.params,
            confirmationRequired: false,
          }
          const result = await executeAction(route, context)
          completeFlow(context, { success: result.success, data: result.data, error: result.error })

          const response = await generateResponse(result, context)
          return {
            message: response.message,
            suggestions: response.suggestions,
            quickActions: result.suggestedActions?.map(a => ({
              label: a.label,
              action: a.action,
              params: a.params,
              primary: a.primary,
            })),
          }
        }
      } else if (confirmation === 'no') {
        handleConfirmation(context, false)
        return {
          message: "Got it, I've cancelled that. What else can I help with?",
          suggestions: ['Show my status', 'Help me with something else'],
        }
      }
    }

    return null
  }

  // ============================================================================
  // INTENT DETECTION
  // ============================================================================

  private async detectIntents(
    message: string,
    context: ConversationContext,
    userContext: UserContext,
    forceHandler?: JourneyType
  ): Promise<IntentClassification[]> {
    // Check for multi-intent patterns
    const multiIntentPatterns = [
      /\band\b/i,
      /\balso\b/i,
      /\bthen\b/i,
      /\bafter that\b/i,
      /\bplus\b/i,
      /\bas well as\b/i,
    ]

    const hasMultiIntentSignal = multiIntentPatterns.some(pattern => pattern.test(message))

    if (hasMultiIntentSignal) {
      const intents = await classifyMultipleIntents(message, {
        userJourney: context.userJourney as IntentCategory,
        recentMessages: context.messages.slice(-5).map(m => ({
          role: m.role,
          content: m.content,
        })),
        activeDeals: context.activeDeals.map(d => ({
          id: d.id,
          type: d.type,
          status: d.status,
        })),
        userPreferences: context.userPreferences,
      })

      // Filter out low-confidence intents
      return intents.filter(i => i.confidence > 0.4)
    }

    // Single intent classification
    const intent = await classifyIntent(message, {
      userJourney: context.userJourney as IntentCategory,
      recentMessages: context.messages.slice(-5).map(m => ({
        role: m.role,
        content: m.content,
      })),
      activeDeals: context.activeDeals.map(d => ({
        id: d.id,
        type: d.type,
        status: d.status,
      })),
      userPreferences: context.userPreferences,
      forceCategory: forceHandler ? this.mapJourneyToIntentCategory(forceHandler) : undefined,
    })

    return [intent]
  }

  private mapJourneyToIntentCategory(journey: JourneyType): IntentCategory {
    const mapping: Record<JourneyType, IntentCategory> = {
      rfq: 'buyer',
      jobs: 'jobs',
      payments: 'treasury',
      negotiation: 'buyer',
      seller: 'seller',
      founder: 'founder',
      erp: 'buyer',
      universal: 'universal',
    }
    return mapping[journey]
  }

  // ============================================================================
  // JOURNEY SWITCH DETECTION
  // ============================================================================

  private detectJourneySwitch(
    intent: IntentClassification,
    journeyContext: JourneyContext
  ): { newJourney: JourneyType } | null {
    const intentToJourney: Record<IntentCategory, JourneyType> = {
      buyer: 'rfq',
      seller: 'seller',
      founder: 'founder',
      jobs: 'jobs',
      treasury: 'payments',
      universal: 'universal',
      unknown: 'universal',
    }

    const targetJourney = intentToJourney[intent.category]

    if (targetJourney && targetJourney !== journeyContext.currentJourney && targetJourney !== 'universal') {
      return { newJourney: targetJourney }
    }

    return null
  }

  // ============================================================================
  // MULTI-INTENT HANDLING
  // ============================================================================

  private async handleMultipleIntents(
    intents: IntentClassification[],
    context: ConversationContext,
    userContext: UserContext,
    journeyContext: JourneyContext
  ): Promise<{
    actions: ExecutedAction[]
    notices: CrossHandlerNotice[]
    consolidatedResponse: string
    suggestions: string[]
    quickActions: QuickAction[]
    displayData: Record<string, unknown>
    handlersUsed: string[]
  }> {
    const actions: ExecutedAction[] = []
    const notices: CrossHandlerNotice[] = []
    const responses: string[] = []
    const allSuggestions: string[] = []
    const allQuickActions: QuickAction[] = []
    let displayData: Record<string, unknown> = {}
    const handlersUsed: string[] = []

    for (const intent of intents) {
      const result = await this.handleSingleIntent(intent, context, userContext, journeyContext)

      if (result.action) {
        actions.push(result.action)
      }
      notices.push(...result.notices)
      responses.push(result.response)
      allSuggestions.push(...result.suggestions)
      allQuickActions.push(...result.quickActions)
      displayData = { ...displayData, ...result.displayData }

      if (result.handler) {
        handlersUsed.push(result.handler)
      }
    }

    // Consolidate responses
    let consolidatedResponse = ''
    if (responses.length === 1) {
      consolidatedResponse = responses[0]
    } else if (responses.length === 2) {
      consolidatedResponse = `${responses[0]}\n\nAlso, ${responses[1].charAt(0).toLowerCase()}${responses[1].slice(1)}`
    } else {
      consolidatedResponse = responses.map((r, i) => `${i + 1}. ${r}`).join('\n\n')
    }

    // Deduplicate suggestions
    const uniqueSuggestions = [...new Set(allSuggestions)].slice(0, 4)

    return {
      actions,
      notices,
      consolidatedResponse,
      suggestions: uniqueSuggestions,
      quickActions: allQuickActions.slice(0, 4),
      displayData,
      handlersUsed: [...new Set(handlersUsed)],
    }
  }

  // ============================================================================
  // SINGLE INTENT HANDLING
  // ============================================================================

  private async handleSingleIntent(
    intent: IntentClassification,
    context: ConversationContext,
    userContext: UserContext,
    journeyContext: JourneyContext
  ): Promise<{
    action?: ExecutedAction
    notices: CrossHandlerNotice[]
    response: string
    suggestions: string[]
    quickActions: QuickAction[]
    displayData: Record<string, unknown>
    handler?: string
    toolsUsed?: string[]
  }> {
    const notices: CrossHandlerNotice[] = []
    const toolsUsed: string[] = []

    // Check for interruption
    const interruption = checkInterruption(context, intent)
    if (interruption.shouldAsk) {
      return {
        notices: [],
        response: interruption.message || 'Would you like me to pause the current task?',
        suggestions: ['Yes, pause it', 'No, continue'],
        quickActions: [],
        displayData: {},
      }
    }

    // Route intent to handler
    const route = routeIntent(intent)
    const handler = this.getHandlerFromRoute(route)

    // Build system prompt with personality
    const systemPrompt = this.buildUnifiedSystemPrompt(
      context,
      userContext,
      journeyContext,
      intent
    )

    // Execute action
    let actionResult: ActionResult | undefined
    let executedAction: ExecutedAction | undefined

    if (route.confirmationRequired && !context.currentFlow?.pendingConfirmation) {
      // Set up confirmation
      setPendingConfirmation(
        context,
        route.handler,
        route.confirmationMessage || `Proceed with ${route.action}?`,
        route.params
      )

      return {
        notices: [],
        response: route.confirmationMessage || `Proceed with ${route.action}?`,
        suggestions: ['Yes', 'No, cancel'],
        quickActions: [],
        displayData: {},
        handler,
      }
    }

    // Execute the action
    try {
      actionResult = await executeAction(route, context)
      toolsUsed.push(route.action)

      executedAction = {
        type: route.action,
        handler: handler as JourneyType,
        status: actionResult.success ? 'success' : 'failed',
        result: actionResult.data,
        error: actionResult.error,
        createdIds: actionResult.createdIds,
      }

      // Check for proactive notices
      if (this.config.enableProactiveInsights) {
        const proactiveNotices = await this.generateProactiveNotices(
          actionResult,
          handler as JourneyType,
          userContext
        )
        notices.push(...proactiveNotices)
      }

    } catch (error) {
      console.error('[UnifiedOrchestrator] Action execution error:', error)
      executedAction = {
        type: route.action,
        handler: handler as JourneyType,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }

    // Generate response
    const response = await this.generateContextualResponse(
      actionResult,
      intent,
      context,
      journeyContext
    )

    return {
      action: executedAction,
      notices,
      response: response.message,
      suggestions: response.suggestions || [],
      quickActions: actionResult?.suggestedActions?.map(a => ({
        label: a.label,
        action: a.action,
        params: a.params,
        primary: a.primary,
        journey: handler as JourneyType,
      })) || [],
      displayData: actionResult?.displayData || {},
      handler,
      toolsUsed,
    }
  }

  private getHandlerFromRoute(route: RouteResult): string {
    const handlerMapping: Record<string, JourneyType> = {
      rfq: 'rfq',
      erp: 'erp',
      payments: 'payments',
      jobs: 'jobs',
      insights: 'founder',
      treasury: 'payments',
      universal: 'universal',
      negotiation: 'negotiation',
      founder: 'founder',
      seller: 'seller',
    }
    return handlerMapping[route.toolGroup] || 'universal'
  }

  // ============================================================================
  // CROSS-HANDLER OPERATIONS
  // ============================================================================

  private async checkCrossHandlerOperations(
    actions: ExecutedAction[],
    userId: string
  ): Promise<CrossHandlerNotice[]> {
    const notices: CrossHandlerNotice[] = []

    for (const action of actions) {
      for (const op of CROSS_HANDLER_OPERATIONS) {
        if (
          action.handler === op.trigger.handler &&
          action.type === op.trigger.action &&
          action.status === op.trigger.status
        ) {
          if (!op.condition || op.condition(action.result)) {
            notices.push({
              type: 'opportunity',
              message: op.message,
              sourceHandler: op.trigger.handler,
              targetHandler: op.followUp.handler,
              actionRequired: false,
              suggestedAction: {
                label: `Go to ${op.followUp.action}`,
                action: `${op.followUp.handler}.${op.followUp.action}`,
                primary: true,
                journey: op.followUp.handler,
              },
            })
          }
        }
      }
    }

    return notices
  }

  // ============================================================================
  // PROACTIVE NOTICES
  // ============================================================================

  private async generateProactiveNotices(
    actionResult: ActionResult | undefined,
    handler: JourneyType,
    userContext: UserContext
  ): Promise<CrossHandlerNotice[]> {
    const notices: CrossHandlerNotice[] = []

    if (!actionResult?.success) return notices

    // RFQ handler - suggest payments
    if (handler === 'rfq' && actionResult.createdIds?.orderId) {
      notices.push({
        type: 'suggestion',
        message: 'You can fund the escrow now to lock in this order.',
        sourceHandler: 'rfq',
        targetHandler: 'payments',
        actionRequired: false,
      })
    }

    // Jobs handler - suggest negotiation
    if (handler === 'jobs' && actionResult.data && (actionResult.data as { hasOffers?: boolean }).hasOffers) {
      notices.push({
        type: 'suggestion',
        message: 'I can help negotiate your offer for better terms.',
        sourceHandler: 'jobs',
        targetHandler: 'negotiation',
        actionRequired: false,
      })
    }

    // Seller handler - suggest ERP sync
    if (handler === 'seller' && userContext.verificationLevel !== 'premium') {
      notices.push({
        type: 'opportunity',
        message: 'Connect your ERP to auto-generate invoices when quotes are accepted.',
        sourceHandler: 'seller',
        targetHandler: 'erp',
        actionRequired: false,
      })
    }

    return notices
  }

  // ============================================================================
  // SYSTEM PROMPT BUILDING
  // ============================================================================

  private buildUnifiedSystemPrompt(
    context: ConversationContext,
    userContext: UserContext,
    journeyContext: JourneyContext,
    intent: IntentClassification
  ): string {
    const personality = JOURNEY_PERSONALITIES[journeyContext.currentJourney]
    const injectedContext = buildInjectedContext(userContext, context)

    const autonomyLevel = this.config.autonomyLevels?.[journeyContext.currentJourney as keyof typeof this.config.autonomyLevels] || 'assisted'

    return `You are Wells, an AI assistant that makes business feel effortless. You are ONE unified assistant that can handle anything - from procurement to payments, hiring to negotiations.

CURRENT JOURNEY: ${journeyContext.currentJourney}
PERSONALITY: Be ${personality.tone}. ${personality.style}

YOUR CAPABILITIES (use appropriate tools):
- RFQ/Procurement: Create RFQs, find suppliers, compare quotes, award deals
- Jobs: Search opportunities, apply, track applications, negotiate offers
- Payments: Check GRAIN balance, send payments, manage treasury
- Negotiation: Start AI-to-AI negotiations, counter-offers, set limits
- Seller: View RFQs, send quotes, track conversions, manage catalog
- Founder: Runway analysis, hire talent, source products, find customers
- ERP: Invoices, POs, vendors, financial overview, spend analysis

IMPORTANT RULES:
1. Be one unified assistant - don't make the user feel they're switching between tools
2. Use tools to take action - don't just describe what you could do
3. For payments over $${this.config.maxAutonomousAmount}, ask for confirmation
4. Remember context from previous journeys
5. Proactively suggest cross-handler opportunities
6. Autonomy level for this journey: ${autonomyLevel}

${injectedContext.systemPromptAddition}

${injectedContext.contextSummary ? `CURRENT SITUATION:\n${injectedContext.contextSummary}` : ''}

${context.currentFlow ? `ACTIVE TASK: ${context.currentFlow.type} (${context.currentFlow.state})` : ''}

${journeyContext.recentSwitches.length > 0 ? `RECENT CONTEXT SWITCHES: User recently worked on ${journeyContext.recentSwitches.map(s => s.from).join(', ')}` : ''}

DETECTED INTENT: ${intent.intent} (${Math.round(intent.confidence * 100)}% confidence)
${intent.suggestedAction ? `SUGGESTED ACTION: ${intent.suggestedAction}` : ''}`
  }

  // ============================================================================
  // RESPONSE GENERATION
  // ============================================================================

  private async generateContextualResponse(
    actionResult: ActionResult | undefined,
    intent: IntentClassification,
    context: ConversationContext,
    journeyContext: JourneyContext
  ): Promise<{ message: string; suggestions?: string[] }> {
    if (!actionResult) {
      return {
        message: "I'm ready to help. What would you like to do?",
        suggestions: this.getDefaultSuggestions(journeyContext.currentJourney),
      }
    }

    const response = await generateResponse(actionResult, context)
    return {
      message: response.message,
      suggestions: response.suggestions,
    }
  }

  private getDefaultSuggestions(journey: JourneyType): string[] {
    const suggestions: Record<JourneyType, string[]> = {
      rfq: ['Create an RFQ', 'Find suppliers', 'Check my quotes'],
      jobs: ['Find jobs', 'Check applications', 'Salary intel'],
      payments: ['Check balance', 'Send payment', 'View transactions'],
      negotiation: ['Start negotiation', 'Check active deals', 'Set limits'],
      seller: ['View RFQs', 'Check my quotes', 'See my metrics'],
      founder: ['Check runway', 'Find talent', 'Source products'],
      erp: ['View invoices', 'Create PO', 'Spend analysis'],
      universal: ['Show what you can do', 'Check my status', 'Help'],
    }
    return suggestions[journey] || suggestions.universal
  }

  // ============================================================================
  // PERSONALITY ADJUSTMENTS
  // ============================================================================

  private applyPersonalityAdjustments(
    response: string,
    journey: JourneyType,
    userContext: UserContext
  ): string {
    // Skip if no response
    if (!response) return response

    const personality = JOURNEY_PERSONALITIES[journey]
    const communicationStyle = userContext.communicationStyle || this.config.communicationStyle

    // Apply communication style adjustments
    if (communicationStyle === 'formal') {
      response = response.replace(/I'll/g, 'I will').replace(/you'll/g, 'you will')
    } else if (communicationStyle === 'direct') {
      // Keep it short
      const sentences = response.split('. ')
      if (sentences.length > 3) {
        response = sentences.slice(0, 3).join('. ') + '.'
      }
    }

    return response
  }

  // ============================================================================
  // UNIFIED SUGGESTIONS
  // ============================================================================

  private generateUnifiedSuggestions(
    context: ConversationContext,
    journeyContext: JourneyContext,
    executedActions: ExecutedAction[],
    intents: IntentClassification[]
  ): string[] {
    const suggestions: string[] = []

    // Add action-specific suggestions
    if (executedActions.length > 0) {
      const lastAction = executedActions[executedActions.length - 1]
      if (lastAction.status === 'success') {
        switch (lastAction.handler) {
          case 'rfq':
            suggestions.push('Track this RFQ', 'Start another RFQ')
            break
          case 'jobs':
            suggestions.push('Find more jobs', 'Update my profile')
            break
          case 'payments':
            suggestions.push('View transactions', 'Check balance')
            break
          case 'negotiation':
            suggestions.push('Check negotiation status', 'Set new limits')
            break
          case 'seller':
            suggestions.push('View more RFQs', 'Check my metrics')
            break
          case 'founder':
            suggestions.push('See financial overview', 'Find more talent')
            break
        }
      }
    }

    // Add journey-specific defaults
    const defaultSuggestions = this.getDefaultSuggestions(journeyContext.currentJourney)
    defaultSuggestions.forEach(s => {
      if (!suggestions.includes(s)) {
        suggestions.push(s)
      }
    })

    // Add cross-journey suggestions if user has multiple journeys
    if (journeyContext.availableJourneys.length > 1) {
      const otherJourney = journeyContext.availableJourneys.find(j => j !== journeyContext.currentJourney)
      if (otherJourney) {
        const crossSuggestion = `Switch to ${otherJourney}`
        if (!suggestions.includes(crossSuggestion)) {
          suggestions.push(crossSuggestion)
        }
      }
    }

    return suggestions.slice(0, 4)
  }

  // ============================================================================
  // MEMORY UPDATES
  // ============================================================================

  private async updateMemory(
    userId: string,
    message: string,
    intents: IntentClassification[],
    actions: ExecutedAction[],
    context: ConversationContext
  ): Promise<void> {
    try {
      const primaryIntent = intents[0]
      const topics: string[] = []

      if (primaryIntent.entities.productName) topics.push(primaryIntent.entities.productName)
      if (primaryIntent.entities.role) topics.push(primaryIntent.entities.role)
      if (primaryIntent.entities.companyName) topics.push(primaryIntent.entities.companyName)

      if (topics.length > 0) {
        await updateWellsMemory(userId, { recentTopics: topics })
      }

      // Learn facts from entities
      if (primaryIntent.entities.companyName) {
        await learnFact(userId, `Works with ${primaryIntent.entities.companyName}`, 'business', 'inferred')
      }
      if (primaryIntent.entities.role) {
        await learnFact(userId, `Interested in ${primaryIntent.entities.role} roles`, 'context', 'inferred')
      }

      // Analyze conversation periodically
      if (context.messageCount > 0 && context.messageCount % 10 === 0) {
        const messages = context.messages.slice(-20).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
        await learnFromConversation(userId, messages, 'wellsai', context.userJourney)
      }
    } catch (error) {
      console.error('[UnifiedOrchestrator] Memory update error:', error)
    }
  }

  // ============================================================================
  // DAILY DIGEST GENERATION
  // ============================================================================

  /**
   * Generate a unified daily digest across all journeys
   */
  async generateDailyDigest(userId: string): Promise<DailyDigest> {
    return this.contextManager.generateDailyDigest(userId)
  }

  // ============================================================================
  // USER PREFERENCES
  // ============================================================================

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<UnifiedUserPreferences>
  ): Promise<void> {
    await this.contextManager.updateUserPreferences(userId, preferences)

    // Update local config if autonomy levels changed
    if (preferences.autonomyLevels) {
      this.config.autonomyLevels = {
        ...this.config.autonomyLevels,
        ...preferences.autonomyLevels,
      }
    }
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<UnifiedUserPreferences> {
    return this.contextManager.getUserPreferences(userId)
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let orchestratorInstance: UnifiedOrchestrator | null = null

export function getUnifiedOrchestrator(config?: UnifiedOrchestratorConfig): UnifiedOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new UnifiedOrchestrator(config)
  }
  return orchestratorInstance
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export default UnifiedOrchestrator
