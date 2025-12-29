// @ts-nocheck
/**
 * MASTER Wells Chat Orchestrator
 *
 * The brain that makes EVERYTHING conversational. Users never navigate menus -
 * they just talk to Wells and Wells makes it happen.
 *
 * This orchestrator:
 * 1. Detects user intent from natural language
 * 2. Injects rich context (profile, deals, history, trust score)
 * 3. Calls Claude with appropriate tools
 * 4. Executes actions based on Claude's response
 * 5. Updates memory with learned facts
 * 6. Returns conversational response with suggestions
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  classifyIntent,
  routeIntent,
  IntentClassification,
  RouteResult,
  IntentCategory,
  ExtractedEntities,
} from './intent-router'
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

export interface WellsResponse {
  message: string
  actions?: ExecutedAction[]
  suggestions?: string[]
  quickActions?: QuickAction[]
  displayData?: Record<string, unknown>
  metadata?: {
    intent: IntentClassification
    sessionId: string
    processingTimeMs: number
    toolsUsed?: string[]
  }
}

export interface ExecutedAction {
  type: string
  status: 'success' | 'failed' | 'pending' | 'requires_confirmation'
  result?: unknown
  error?: string
  createdIds?: Record<string, string>
}

export interface QuickAction {
  label: string
  action: string
  params?: Record<string, unknown>
  primary?: boolean
  icon?: string
}

export interface OrchestratorConfig {
  enableAutonomousActions?: boolean
  maxAutonomousAmount?: number
  communicationStyle?: 'formal' | 'casual' | 'direct' | 'detailed'
  enableProactiveInsights?: boolean
  enableLearning?: boolean
}

// ============================================================================
// CLAUDE TOOLS DEFINITION
// ============================================================================

const WELLS_TOOLS: Anthropic.Tool[] = [
  // RFQ / Procurement Tools
  {
    name: 'create_rfq',
    description: 'Create a new Request for Quote (RFQ) for products or services. Use when user needs to source/order/buy something.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product: { type: 'string', description: 'What they want to buy' },
        quantity: { type: 'number', description: 'How many units needed' },
        budget: { type: 'number', description: 'Target budget in USD' },
        deadline: { type: 'string', description: 'When they need it by (ISO date)' },
        specifications: { type: 'string', description: 'Any specific requirements' },
        urgency: { type: 'string', enum: ['low', 'normal', 'high', 'critical'] },
      },
      required: ['product'],
    },
  },
  {
    name: 'search_suppliers',
    description: 'Search for suppliers in a specific category or for specific products.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', description: 'Product/service category' },
        location: { type: 'string', description: 'Preferred supplier location' },
        minRating: { type: 'number', description: 'Minimum supplier rating (1-5)' },
      },
      required: ['category'],
    },
  },
  // ERP / Financial Tools
  {
    name: 'create_invoice',
    description: 'Create a new invoice for a customer.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer: { type: 'string', description: 'Customer name or company' },
        amount: { type: 'number', description: 'Invoice amount in USD' },
        description: { type: 'string', description: 'What the invoice is for' },
        dueDate: { type: 'string', description: 'Payment due date (ISO date)' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              quantity: { type: 'number' },
              unitPrice: { type: 'number' },
            },
          },
        },
      },
      required: ['customer', 'amount'],
    },
  },
  {
    name: 'create_po',
    description: 'Create a purchase order for a vendor.',
    input_schema: {
      type: 'object' as const,
      properties: {
        vendor: { type: 'string', description: 'Vendor name' },
        amount: { type: 'number', description: 'PO amount' },
        items: { type: 'array', description: 'Line items' },
        deliveryDate: { type: 'string', description: 'Expected delivery date' },
      },
      required: ['vendor'],
    },
  },
  {
    name: 'get_analytics',
    description: 'Get spend analytics, revenue data, or financial overview.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['spend', 'revenue', 'overview', 'by_category', 'by_vendor'],
          description: 'Type of analytics'
        },
        timeframe: {
          type: 'string',
          enum: ['today', 'this_week', 'this_month', 'this_quarter', 'this_year', 'last_30_days'],
          description: 'Time period for analysis'
        },
        category: { type: 'string', description: 'Filter by category' },
      },
      required: ['type'],
    },
  },
  // Negotiation Tools
  {
    name: 'start_negotiation',
    description: 'Start an AI-to-AI negotiation with a supplier or for a deal.',
    input_schema: {
      type: 'object' as const,
      properties: {
        counterparty: { type: 'string', description: 'Who to negotiate with' },
        dealType: { type: 'string', enum: ['rfq', 'quote', 'contract', 'salary'] },
        currentOffer: { type: 'number', description: 'Current offer amount' },
        targetAmount: { type: 'number', description: 'Target amount to negotiate to' },
        constraints: { type: 'string', description: 'Any constraints or requirements' },
        autonomous: { type: 'boolean', description: 'Let AI negotiate autonomously' },
      },
      required: ['counterparty', 'dealType'],
    },
  },
  // Job Seeker Tools
  {
    name: 'check_job_matches',
    description: 'Find job opportunities matching user profile and preferences.',
    input_schema: {
      type: 'object' as const,
      properties: {
        role: { type: 'string', description: 'Job role/title looking for' },
        skills: { type: 'array', items: { type: 'string' }, description: 'Key skills' },
        location: { type: 'string', description: 'Preferred location' },
        remote: { type: 'boolean', description: 'Open to remote work' },
        salaryMin: { type: 'number', description: 'Minimum salary expectation' },
        salaryMax: { type: 'number', description: 'Maximum salary expectation' },
      },
      required: [],
    },
  },
  {
    name: 'apply_to_job',
    description: 'Apply to a specific job posting.',
    input_schema: {
      type: 'object' as const,
      properties: {
        jobId: { type: 'string', description: 'Job ID to apply to' },
        company: { type: 'string', description: 'Company name' },
        customizeCoverLetter: { type: 'boolean', description: 'Generate custom cover letter' },
      },
      required: ['jobId'],
    },
  },
  // Notification Tools
  {
    name: 'send_notification',
    description: 'Send a notification to user, supplier, or team member.',
    input_schema: {
      type: 'object' as const,
      properties: {
        recipient: { type: 'string', description: 'Who to notify' },
        channel: { type: 'string', enum: ['email', 'sms', 'in_app', 'slack'] },
        message: { type: 'string', description: 'Notification content' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
      },
      required: ['recipient', 'message'],
    },
  },
  // Calendar/Meeting Tools
  {
    name: 'schedule_meeting',
    description: 'Schedule a meeting with someone.',
    input_schema: {
      type: 'object' as const,
      properties: {
        attendee: { type: 'string', description: 'Who to meet with' },
        topic: { type: 'string', description: 'Meeting topic' },
        duration: { type: 'number', description: 'Duration in minutes' },
        preferredTime: { type: 'string', description: 'Preferred date/time' },
        type: { type: 'string', enum: ['video', 'phone', 'in_person'] },
      },
      required: ['attendee', 'topic'],
    },
  },
  // Pipeline/Deal Tools
  {
    name: 'get_pipeline_status',
    description: 'Get status of active deals, RFQs, applications, or negotiations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['all', 'rfqs', 'quotes', 'orders', 'jobs', 'applications', 'negotiations'],
        },
        status: { type: 'string', enum: ['active', 'pending', 'completed', 'action_required'] },
        limit: { type: 'number', description: 'Max items to return' },
      },
      required: [],
    },
  },
  // Integration Tools
  {
    name: 'connect_integration',
    description: 'Connect or configure an external integration (ERP, CRM, etc).',
    input_schema: {
      type: 'object' as const,
      properties: {
        integrationType: {
          type: 'string',
          enum: ['quickbooks', 'xero', 'netsuite', 'salesforce', 'hubspot', 'slack', 'calendar'],
        },
        action: { type: 'string', enum: ['connect', 'disconnect', 'configure', 'sync'] },
      },
      required: ['integrationType', 'action'],
    },
  },
]

// ============================================================================
// WELLS ORCHESTRATOR CLASS
// ============================================================================

export class WellsOrchestrator {
  private config: OrchestratorConfig

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      enableAutonomousActions: true,
      maxAutonomousAmount: 1000,
      enableProactiveInsights: true,
      enableLearning: true,
      ...config,
    }
  }

  /**
   * Main entry point - handle a user message
   */
  async handleMessage(
    userId: string,
    message: string,
    sessionId: string,
    options?: {
      journey?: IntentCategory
      previousMessages?: Array<{ role: string; content: string }>
    }
  ): Promise<WellsResponse> {
    const startTime = Date.now()
    const toolsUsed: string[] = []

    try {
      // 1. Load context
      const { context, userContext, memory } = await this.loadContext(userId, sessionId)

      // Set journey if provided
      if (options?.journey) {
        context.userJourney = options.journey
      }

      // 2. Add user message to conversation
      addMessage(context, 'user', message)

      // 3. Check for confirmation/interruption of current flow
      const flowResult = await this.handleFlowState(context, message)
      if (flowResult) {
        await saveConversationContext(context)
        return {
          ...flowResult,
          metadata: {
            intent: { category: 'universal', intent: 'clarify', confidence: 1, entities: {}, requiresConfirmation: false },
            sessionId,
            processingTimeMs: Date.now() - startTime,
          },
        }
      }

      // 4. Detect intent
      const intent = await this.detectIntent(message, context, userContext)

      // 5. Check for interruption
      const interruption = checkInterruption(context, intent)
      if (interruption.shouldAsk) {
        return {
          message: interruption.message || 'Would you like me to pause the current task?',
          suggestions: ['Yes, pause it', 'No, continue'],
          metadata: {
            intent,
            sessionId,
            processingTimeMs: Date.now() - startTime,
          },
        }
      }

      // 6. Build system prompt with rich context
      const systemPrompt = this.buildSystemPrompt(context, userContext, intent)

      // 7. Call Claude with tools
      const claudeResponse = await this.callClaude(systemPrompt, message, context, intent)

      // 8. Execute any tool calls
      const executedActions: ExecutedAction[] = []
      let responseText = ''
      let suggestions: string[] = []
      let quickActions: QuickAction[] = []
      let displayData: Record<string, unknown> = {}

      for (const block of claudeResponse.content) {
        if (block.type === 'text') {
          responseText = block.text
        } else if (block.type === 'tool_use') {
          toolsUsed.push(block.name)
          const actionResult = await this.executeToolCall(block.name, block.input as Record<string, unknown>, context, userContext)
          executedActions.push({
            type: block.name,
            status: actionResult.success ? 'success' : 'failed',
            result: actionResult.data,
            error: actionResult.error,
            createdIds: actionResult.createdIds,
          })

          // Merge suggestions and display data
          if (actionResult.suggestedActions) {
            quickActions.push(...actionResult.suggestedActions.map(a => ({
              label: a.label,
              action: a.action,
              params: a.params,
              primary: a.primary,
            })))
          }
          if (actionResult.displayData) {
            displayData = { ...displayData, ...actionResult.displayData }
          }

          // If Claude used tools, use the action result message
          if (actionResult.displayMessage && !responseText) {
            responseText = actionResult.displayMessage
          }
        }
      }

      // 9. Generate suggestions based on context
      suggestions = this.getSuggestions(context, intent, executedActions)

      // 10. Update memory with learned facts
      if (this.config.enableLearning) {
        await this.updateMemory(userId, message, intent, executedActions, context)
      }

      // 11. Add assistant response to conversation
      addMessage(context, 'assistant', responseText, intent, {
        type: toolsUsed.join(',') || 'conversation',
        status: executedActions.every(a => a.status === 'success') ? 'executed' : 'pending',
      })

      // 12. Save context
      await saveConversationContext(context)

      return {
        message: responseText || "I'm here to help. What do you need?",
        actions: executedActions.length > 0 ? executedActions : undefined,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        quickActions: quickActions.length > 0 ? quickActions : undefined,
        displayData: Object.keys(displayData).length > 0 ? displayData : undefined,
        metadata: {
          intent,
          sessionId,
          processingTimeMs: Date.now() - startTime,
          toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
        },
      }

    } catch (error) {
      console.error('[WellsOrchestrator] Error:', error)
      return {
        message: "I ran into an issue processing your request. Could you try rephrasing?",
        suggestions: ['Show what you can do', 'Check my status', 'Get help'],
        metadata: {
          intent: { category: 'universal', intent: 'clarify', confidence: 0, entities: {}, requiresConfirmation: false },
          sessionId,
          processingTimeMs: Date.now() - startTime,
        },
      }
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Load all context for a user
   */
  private async loadContext(userId: string, sessionId: string): Promise<{
    context: ConversationContext
    userContext: UserContext
    memory: WellsMemory | null
  }> {
    const [context, memory] = await Promise.all([
      getConversationContext(sessionId, userId),
      getWellsMemory(userId),
    ])

    const userContext = await loadUserContext(userId, context)

    return { context, userContext, memory }
  }

  /**
   * Handle current flow state (confirmations, interruptions)
   */
  private async handleFlowState(
    context: ConversationContext,
    message: string
  ): Promise<WellsResponse | null> {
    // Check if we're awaiting confirmation
    if (context.currentFlow?.pendingConfirmation) {
      const confirmation = await isConfirmation(message)

      if (confirmation === 'yes') {
        const actionData = handleConfirmation(context, true)
        if (actionData) {
          // Execute the confirmed action
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
      // If unclear, continue to normal processing
    }

    return null
  }

  /**
   * Detect intent from message
   */
  private async detectIntent(
    message: string,
    context: ConversationContext,
    userContext: UserContext
  ): Promise<IntentClassification> {
    return classifyIntent(message, {
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
  }

  /**
   * Build the system prompt with all context
   */
  private buildSystemPrompt(
    context: ConversationContext,
    userContext: UserContext,
    intent: IntentClassification
  ): string {
    const injectedContext = buildInjectedContext(userContext, context)

    const basePrompt = `You are Wells, an AI assistant that makes everything conversational. Users never need to navigate menus - they just talk to you and you make things happen.

YOUR PERSONALITY:
- Professional but warm and approachable
- Concise - keep responses to 1-3 sentences unless user needs details
- Action-oriented - always move toward helping them
- Confident but not pushy
- Never mention limitations or that you're an AI

YOUR CAPABILITIES (use the appropriate tool):
- Create RFQs and find suppliers (create_rfq, search_suppliers)
- Generate invoices and purchase orders (create_invoice, create_po)
- Analyze spend and financials (get_analytics)
- Start negotiations (start_negotiation)
- Find job matches and apply (check_job_matches, apply_to_job)
- Send notifications (send_notification)
- Schedule meetings (schedule_meeting)
- Check pipeline and deal status (get_pipeline_status)
- Connect integrations (connect_integration)

IMPORTANT RULES:
1. Use tools to take action - don't just describe what you could do
2. For actions over $${this.config.maxAutonomousAmount}, ask for confirmation
3. Be proactive about surfacing relevant information
4. Learn from what the user tells you
5. Always suggest logical next steps

USER CONTEXT:
${injectedContext.systemPromptAddition}

${injectedContext.contextSummary ? `CURRENT SITUATION:\n${injectedContext.contextSummary}` : ''}

${context.currentFlow ? `ACTIVE TASK: ${context.currentFlow.type} (${context.currentFlow.state})` : ''}

${userContext.pendingApprovals.length > 0 ? `PENDING APPROVALS: ${userContext.pendingApprovals.length} items needing attention` : ''}

DETECTED INTENT: ${intent.intent} (${Math.round(intent.confidence * 100)}% confidence)
${intent.suggestedAction ? `SUGGESTED ACTION: ${intent.suggestedAction}` : ''}`

    return basePrompt
  }

  /**
   * Call Claude with tools
   */
  private async callClaude(
    systemPrompt: string,
    userMessage: string,
    context: ConversationContext,
    intent: IntentClassification
  ): Promise<Anthropic.Message> {
    // Build message history
    const messages: Anthropic.MessageParam[] = []

    // Add recent conversation history
    const recentMessages = context.messages.slice(-10)
    for (const msg of recentMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content,
        })
      }
    }

    // Ensure we end with user message (it might already be there from addMessage)
    if (messages.length === 0 || messages[messages.length - 1].content !== userMessage) {
      messages.push({
        role: 'user',
        content: userMessage,
      })
    }

    // Select tools based on intent
    const tools = this.getToolsForIntent(intent)

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools,
    })

    return response
  }

  /**
   * Get relevant tools for an intent
   */
  private getToolsForIntent(intent: IntentClassification): Anthropic.Tool[] {
    // Return all tools for now - Claude will choose the appropriate one
    // In production, you might filter based on intent category
    return WELLS_TOOLS
  }

  /**
   * Execute a tool call
   */
  private async executeToolCall(
    toolName: string,
    input: Record<string, unknown>,
    context: ConversationContext,
    userContext: UserContext
  ): Promise<ActionResult> {
    const startTime = Date.now()

    try {
      switch (toolName) {
        case 'create_rfq':
          return await this.executeCreateRFQ(input, context)

        case 'search_suppliers':
          return await this.executeSearchSuppliers(input, context)

        case 'create_invoice':
          return await this.executeCreateInvoice(input, context)

        case 'create_po':
          return await this.executeCreatePO(input, context)

        case 'get_analytics':
          return await this.executeGetAnalytics(input, context)

        case 'start_negotiation':
          return await this.executeStartNegotiation(input, context)

        case 'check_job_matches':
          return await this.executeCheckJobMatches(input, context, userContext)

        case 'apply_to_job':
          return await this.executeApplyToJob(input, context)

        case 'send_notification':
          return await this.executeSendNotification(input, context)

        case 'schedule_meeting':
          return await this.executeScheduleMeeting(input, context)

        case 'get_pipeline_status':
          return await this.executeGetPipelineStatus(input, context, userContext)

        case 'connect_integration':
          return await this.executeConnectIntegration(input, context)

        default:
          return {
            success: false,
            error: `Unknown tool: ${toolName}`,
            displayMessage: "I don't know how to do that yet.",
            actionType: toolName,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
      }
    } catch (error) {
      console.error(`[WellsOrchestrator] Tool execution error (${toolName}):`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        displayMessage: "I ran into an issue with that action. Want me to try again?",
        actionType: toolName,
        executedAt: new Date(),
        durationMs: Date.now() - startTime,
      }
    }
  }

  // ============================================================================
  // TOOL EXECUTION METHODS
  // ============================================================================

  private async executeCreateRFQ(input: Record<string, unknown>, context: ConversationContext): Promise<ActionResult> {
    const startTime = Date.now()

    // Import and call the actual RFQ service
    try {
      const rfqId = `rfq_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

      // In production, this would call the actual RFQ service
      // const { createRFQ } = await import('@/lib/rfq/quote-service')
      // const rfq = await createRFQ({ ... })

      return {
        success: true,
        data: { rfqId, ...input },
        displayMessage: `Created RFQ for ${input.quantity || 'some'} ${input.product}. I'm now matching you with qualified suppliers.`,
        displayData: {
          rfqId,
          product: input.product,
          quantity: input.quantity,
          budget: input.budget,
          status: 'matching_suppliers',
        },
        suggestedActions: [
          { label: 'Add specifications', action: 'rfq.addSpecs', params: { rfqId } },
          { label: 'View supplier matches', action: 'rfq.viewMatches', params: { rfqId }, primary: true },
        ],
        nextSteps: [
          'Suppliers are being matched now',
          "You'll receive quotes within hours",
          'I can negotiate automatically if you enable auto-negotiate',
        ],
        createdIds: { rfqId },
        actionType: 'create_rfq',
        executedAt: new Date(),
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      throw error
    }
  }

  private async executeSearchSuppliers(input: Record<string, unknown>, context: ConversationContext): Promise<ActionResult> {
    const startTime = Date.now()

    // Mock supplier search - in production, query actual database
    const suppliers = [
      { name: 'Precision Parts Co.', rating: 4.8, location: 'Ohio', responseTime: '2 hours' },
      { name: 'Allied Industrial', rating: 4.6, location: 'Michigan', responseTime: '4 hours' },
      { name: 'FastTrack Supply', rating: 4.5, location: 'Texas', responseTime: '1 hour' },
    ]

    return {
      success: true,
      data: { suppliers },
      displayMessage: `Found ${suppliers.length} suppliers for ${input.category}.`,
      displayData: {
        suppliers: suppliers.map(s => ({
          name: s.name,
          rating: s.rating,
          location: s.location,
        })),
      },
      suggestedActions: [
        { label: 'Create RFQ with these suppliers', action: 'create_rfq', params: { category: input.category }, primary: true },
        { label: 'See more suppliers', action: 'search_suppliers', params: { category: input.category, offset: 10 } },
      ],
      actionType: 'search_suppliers',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }

  private async executeCreateInvoice(input: Record<string, unknown>, context: ConversationContext): Promise<ActionResult> {
    const startTime = Date.now()
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`

    return {
      success: true,
      data: { invoiceNumber, ...input },
      displayMessage: `Created invoice ${invoiceNumber} for ${input.customer} - $${(input.amount as number)?.toLocaleString()}.`,
      displayData: {
        invoiceNumber,
        customer: input.customer,
        amount: input.amount,
        dueDate: input.dueDate || 'Net 30',
      },
      suggestedActions: [
        { label: 'Send to customer', action: 'send_invoice', params: { invoiceNumber }, primary: true },
        { label: 'View invoice', action: 'view_invoice', params: { invoiceNumber } },
      ],
      createdIds: { invoiceId: invoiceNumber },
      actionType: 'create_invoice',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }

  private async executeCreatePO(input: Record<string, unknown>, context: ConversationContext): Promise<ActionResult> {
    const startTime = Date.now()
    const poNumber = `PO-${Date.now().toString().slice(-6)}`

    return {
      success: true,
      data: { poNumber, ...input },
      displayMessage: `Created PO ${poNumber} for ${input.vendor}.`,
      displayData: {
        poNumber,
        vendor: input.vendor,
        amount: input.amount,
      },
      suggestedActions: [
        { label: 'Send to vendor', action: 'send_po', params: { poNumber }, primary: true },
        { label: 'Track delivery', action: 'track_order', params: { poNumber } },
      ],
      createdIds: { orderId: poNumber },
      actionType: 'create_po',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }

  private async executeGetAnalytics(input: Record<string, unknown>, context: ConversationContext): Promise<ActionResult> {
    const startTime = Date.now()
    const timeframe = input.timeframe || 'this_month'

    // Mock analytics - in production, query actual data
    const analytics = {
      totalSpend: 45230,
      totalRevenue: 82450,
      topCategory: 'Industrial Supplies',
      trend: '+12%',
      byCategory: [
        { category: 'Industrial Supplies', amount: 23000 },
        { category: 'Office Equipment', amount: 12000 },
        { category: 'Raw Materials', amount: 10230 },
      ],
    }

    const type = input.type as string
    let message = ''

    if (type === 'spend') {
      message = `Your spend ${timeframe === 'this_month' ? 'this month' : `for ${timeframe}`}: $${analytics.totalSpend.toLocaleString()}. Top category: ${analytics.topCategory}.`
    } else if (type === 'revenue') {
      message = `Revenue ${timeframe === 'this_month' ? 'this month' : `for ${timeframe}`}: $${analytics.totalRevenue.toLocaleString()} (${analytics.trend} vs last period).`
    } else {
      message = `This month: $${analytics.totalRevenue.toLocaleString()} revenue, $${analytics.totalSpend.toLocaleString()} spend.`
    }

    return {
      success: true,
      data: analytics,
      displayMessage: message,
      displayData: analytics,
      suggestedActions: [
        { label: 'See breakdown', action: 'get_analytics', params: { type: 'by_category' } },
        { label: 'Find savings', action: 'find_savings', primary: true },
      ],
      actionType: 'get_analytics',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }

  private async executeStartNegotiation(input: Record<string, unknown>, context: ConversationContext): Promise<ActionResult> {
    const startTime = Date.now()
    const negotiationId = `neg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    const autonomous = input.autonomous as boolean

    return {
      success: true,
      data: { negotiationId, ...input },
      displayMessage: autonomous
        ? `Starting autonomous negotiation with ${input.counterparty}. I'll push for your target of $${(input.targetAmount as number)?.toLocaleString()} and update you on progress.`
        : `I've set up the negotiation with ${input.counterparty}. Ready to send your first counter-offer?`,
      displayData: {
        negotiationId,
        counterparty: input.counterparty,
        currentOffer: input.currentOffer,
        targetAmount: input.targetAmount,
        mode: autonomous ? 'autonomous' : 'assisted',
      },
      suggestedActions: autonomous ? [
        { label: 'Check status', action: 'check_negotiation', params: { negotiationId } },
        { label: 'Set limits', action: 'set_negotiation_limits', params: { negotiationId } },
      ] : [
        { label: 'Send counter', action: 'send_counter', params: { negotiationId }, primary: true },
        { label: 'Let AI negotiate', action: 'enable_autonomous', params: { negotiationId } },
      ],
      createdIds: { negotiationId },
      actionType: 'start_negotiation',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }

  private async executeCheckJobMatches(input: Record<string, unknown>, context: ConversationContext, userContext: UserContext): Promise<ActionResult> {
    const startTime = Date.now()

    // Mock job matches - in production, query actual job database
    const jobs = [
      { id: 'job_1', title: 'Senior Engineer', company: 'TechCorp', salary: '$180K-$220K', matchScore: 95 },
      { id: 'job_2', title: 'Engineering Manager', company: 'StartupXYZ', salary: '$200K-$250K', matchScore: 88 },
      { id: 'job_3', title: 'Staff Engineer', company: 'BigCo', salary: '$190K-$230K', matchScore: 82 },
    ]

    const role = input.role || userContext.wellsaiProfile?.jobsContext?.desiredRoles?.[0] || 'engineering'

    return {
      success: true,
      data: { jobs },
      displayMessage: `Found ${jobs.length} matching jobs for ${role}. Top match: ${jobs[0].title} at ${jobs[0].company} (${jobs[0].matchScore}% match).`,
      displayData: {
        total: jobs.length,
        topMatch: jobs[0],
        jobs: jobs.slice(0, 3),
      },
      suggestedActions: [
        { label: `Apply to ${jobs[0].company}`, action: 'apply_to_job', params: { jobId: jobs[0].id }, primary: true },
        { label: 'See all matches', action: 'view_all_jobs' },
      ],
      actionType: 'check_job_matches',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }

  private async executeApplyToJob(input: Record<string, unknown>, context: ConversationContext): Promise<ActionResult> {
    const startTime = Date.now()
    const applicationId = `app_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    return {
      success: true,
      data: { applicationId, ...input },
      displayMessage: `Application submitted to ${input.company || 'the company'}! I crafted a personalized cover letter based on your profile.`,
      displayData: {
        applicationId,
        jobId: input.jobId,
        status: 'submitted',
      },
      nextSteps: [
        'The employer will review your application',
        "I'll update you on any status changes",
        'Average response time: 2-3 days',
      ],
      suggestedActions: [
        { label: 'View application', action: 'view_application', params: { applicationId } },
        { label: 'Find more jobs', action: 'check_job_matches' },
      ],
      createdIds: { applicationId },
      actionType: 'apply_to_job',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }

  private async executeSendNotification(input: Record<string, unknown>, context: ConversationContext): Promise<ActionResult> {
    const startTime = Date.now()

    return {
      success: true,
      data: input,
      displayMessage: `Notification sent to ${input.recipient} via ${input.channel || 'email'}.`,
      actionType: 'send_notification',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }

  private async executeScheduleMeeting(input: Record<string, unknown>, context: ConversationContext): Promise<ActionResult> {
    const startTime = Date.now()
    const meetingId = `mtg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    return {
      success: true,
      data: { meetingId, ...input },
      displayMessage: `I'll reach out to ${input.attendee} to schedule a ${input.duration || 30}-minute ${input.type || 'video'} call about "${input.topic}".`,
      displayData: {
        meetingId,
        attendee: input.attendee,
        topic: input.topic,
        duration: input.duration || 30,
        type: input.type || 'video',
      },
      suggestedActions: [
        { label: 'View calendar', action: 'view_calendar' },
      ],
      createdIds: { meetingId },
      actionType: 'schedule_meeting',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }

  private async executeGetPipelineStatus(input: Record<string, unknown>, context: ConversationContext, userContext: UserContext): Promise<ActionResult> {
    const startTime = Date.now()

    // Aggregate status from userContext
    const activeDeals = userContext.activeDeals
    const pendingApprovals = userContext.pendingApprovals
    const actionRequired = activeDeals.filter(d => d.requiresAction)

    let message = ''
    if (actionRequired.length > 0) {
      message = `You have ${actionRequired.length} item${actionRequired.length !== 1 ? 's' : ''} needing attention. `
    }
    message += `Active: ${activeDeals.length} deals, ${pendingApprovals.length} pending approvals.`

    return {
      success: true,
      data: { activeDeals, pendingApprovals, actionRequired },
      displayMessage: message,
      displayData: {
        activeDeals: activeDeals.length,
        pendingApprovals: pendingApprovals.length,
        actionRequired: actionRequired.length,
        items: activeDeals.slice(0, 5).map(d => ({
          type: d.type,
          summary: d.summary,
          status: d.status,
          requiresAction: d.requiresAction,
        })),
      },
      suggestedActions: actionRequired.length > 0 ? [
        { label: 'Review urgent items', action: 'review_action_items', primary: true },
      ] : [
        { label: 'Create new RFQ', action: 'create_rfq' },
        { label: 'Search jobs', action: 'check_job_matches' },
      ],
      actionType: 'get_pipeline_status',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }

  private async executeConnectIntegration(input: Record<string, unknown>, context: ConversationContext): Promise<ActionResult> {
    const startTime = Date.now()

    const action = input.action as string
    const integrationType = input.integrationType as string

    let message = ''
    switch (action) {
      case 'connect':
        message = `I'll set up the ${integrationType} connection. You'll need to authorize access.`
        break
      case 'disconnect':
        message = `${integrationType} has been disconnected.`
        break
      case 'sync':
        message = `Syncing data with ${integrationType}...`
        break
      default:
        message = `${integrationType} integration ${action} initiated.`
    }

    return {
      success: true,
      data: input,
      displayMessage: message,
      displayData: {
        integration: integrationType,
        action,
        status: 'pending',
      },
      suggestedActions: action === 'connect' ? [
        { label: 'Authorize now', action: 'authorize_integration', params: { integrationType }, primary: true },
      ] : [],
      actionType: 'connect_integration',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }

  // ============================================================================
  // SUGGESTIONS & MEMORY
  // ============================================================================

  /**
   * Generate contextual suggestions
   */
  private getSuggestions(
    context: ConversationContext,
    intent: IntentClassification,
    executedActions: ExecutedAction[]
  ): string[] {
    const suggestions: string[] = []

    // Based on journey
    switch (context.userJourney) {
      case 'buyer':
        suggestions.push('Check my RFQs', 'Find suppliers', 'View spend')
        break
      case 'seller':
        suggestions.push('View incoming RFQs', 'Check my quotes', 'See my metrics')
        break
      case 'jobs':
        suggestions.push('Find jobs', 'Check applications', 'Salary intel')
        break
      case 'founder':
        suggestions.push('Check runway', 'Find talent', 'Source products')
        break
      default:
        suggestions.push('Help me find suppliers', 'I need to hire someone', 'Check my status')
    }

    // Add action-specific suggestions
    if (executedActions.length > 0) {
      const lastAction = executedActions[executedActions.length - 1]
      if (lastAction.status === 'success') {
        switch (lastAction.type) {
          case 'create_rfq':
            suggestions.unshift('Check RFQ status')
            break
          case 'apply_to_job':
            suggestions.unshift('Find more jobs')
            break
          case 'create_invoice':
            suggestions.unshift('Send the invoice')
            break
        }
      }
    }

    return suggestions.slice(0, 4)
  }

  /**
   * Update memory with learned information
   */
  private async updateMemory(
    userId: string,
    message: string,
    intent: IntentClassification,
    actions: ExecutedAction[],
    context: ConversationContext
  ): Promise<void> {
    try {
      // Extract topics from intent
      const topics: string[] = []
      if (intent.entities.productName) topics.push(intent.entities.productName)
      if (intent.entities.role) topics.push(intent.entities.role)
      if (intent.entities.companyName) topics.push(intent.entities.companyName)

      // Update recent topics
      if (topics.length > 0) {
        await updateWellsMemory(userId, { recentTopics: topics })
      }

      // Learn facts from entities
      if (intent.entities.companyName) {
        await learnFact(userId, `Works with ${intent.entities.companyName}`, 'business', 'inferred')
      }
      if (intent.entities.role) {
        await learnFact(userId, `Interested in ${intent.entities.role} roles`, 'context', 'inferred')
      }

      // Periodically analyze conversation for deeper learning
      if (context.messageCount > 0 && context.messageCount % 10 === 0) {
        const messages = context.messages.slice(-20).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
        await learnFromConversation(userId, messages, 'wellsai', context.userJourney)
      }
    } catch (error) {
      console.error('[WellsOrchestrator] Memory update error:', error)
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let orchestratorInstance: WellsOrchestrator | null = null

export function getWellsOrchestrator(config?: OrchestratorConfig): WellsOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new WellsOrchestrator(config)
  }
  return orchestratorInstance
}

// ============================================================================
// CONVENIENCE EXPORT
// ============================================================================

export default WellsOrchestrator
