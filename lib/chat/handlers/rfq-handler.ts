// @ts-nocheck
/**
 * RFQ Chat Handler
 *
 * Handles all RFQ-related intents through natural conversation.
 * Users can create, track, compare, negotiate, and manage RFQs
 * entirely through chat without navigating menus.
 *
 * Supported intents:
 * - Create RFQ: "I need 500 motors" / "Source 1000 ball bearings"
 * - Get status: "What's the status of my motor request?"
 * - Compare quotes: "Show me the best options" / "Compare the quotes"
 * - Negotiate: "Can you get a better price?" / "Try for 10% off"
 * - Accept/Reject: "Accept the quote from Acme" / "Reject all quotes"
 * - Track delivery: "Where's my order?" / "When will it arrive?"
 */

import {
  IntentClassification,
  ExtractedEntities,
  RouteResult,
  BuyerIntent,
} from '../intent-router'
import { ConversationContext, addMessage, startFlow, updateFlow, completeFlow } from '../conversation-manager'
import { ActionResult, SuggestedAction } from '../action-executor'
import {
  ConversationalRFQService,
  RFQConversationState,
  QuickAction,
} from '@/lib/rfq/conversational-rfq'

// ============================================================================
// TYPES
// ============================================================================

export interface RFQHandlerResult {
  message: string
  data?: Record<string, unknown>
  quickActions?: QuickAction[]
  suggestions?: string[]
  requiresMoreInfo?: boolean
  missingFields?: string[]
  conversationState?: RFQConversationState
}

export interface RFQIntentContext {
  userId: string
  sessionId: string
  intent: IntentClassification
  entities: ExtractedEntities
  context: ConversationContext
  previousMessages?: Array<{ role: string; content: string }>
}

// ============================================================================
// RFQ HANDLER CLASS
// ============================================================================

export class RFQHandler {
  private rfqService: ConversationalRFQService

  constructor() {
    this.rfqService = new ConversationalRFQService()
  }

  /**
   * Main entry point - route RFQ intent to appropriate handler
   */
  async handleIntent(intentContext: RFQIntentContext): Promise<RFQHandlerResult> {
    const { intent, entities, context, userId } = intentContext
    const buyerIntent = intent.intent as BuyerIntent

    // Track this interaction
    const startTime = Date.now()

    try {
      let result: RFQHandlerResult

      switch (buyerIntent) {
        case 'create_rfq':
          result = await this.handleCreateRFQ(intentContext)
          break

        case 'supplier_search':
          result = await this.handleSupplierSearch(intentContext)
          break

        case 'compare_quotes':
          result = await this.handleCompareQuotes(intentContext)
          break

        case 'approve_quote':
          result = await this.handleAcceptQuote(intentContext)
          break

        case 'reject_quote':
          result = await this.handleRejectQuote(intentContext)
          break

        case 'track_order':
          result = await this.handleTrackDelivery(intentContext)
          break

        default:
          // Handle general RFQ queries
          result = await this.handleGeneralQuery(intentContext)
      }

      // Add processing metadata
      const processingTime = Date.now() - startTime
      console.log(`[RFQHandler] Processed ${buyerIntent} in ${processingTime}ms`)

      return result
    } catch (error) {
      console.error('[RFQHandler] Error handling intent:', error)
      return this.createErrorResponse(error, buyerIntent)
    }
  }

  // ============================================================================
  // CREATE RFQ
  // ============================================================================

  /**
   * Handle RFQ creation through conversation
   * Guides user through providing necessary information naturally
   */
  private async handleCreateRFQ(ctx: RFQIntentContext): Promise<RFQHandlerResult> {
    const { entities, context, userId } = ctx

    // Check what information we have
    const hasProduct = !!entities.productName
    const hasQuantity = !!entities.quantity
    const hasBudget = !!entities.amount

    // If we have minimum required info, create the RFQ
    if (hasProduct) {
      const result = await this.rfqService.createRFQFromConversation(userId, {
        product: entities.productName!,
        quantity: entities.quantity,
        budget: entities.amount,
        deadline: entities.deadline,
        urgency: entities.urgency,
        specifications: entities.specifications as Record<string, string> | undefined,
        deliveryLocation: entities.location,
      })

      if (result.success && result.rfq) {
        // Start a flow for this RFQ
        startFlow(context, 'rfq_creation', { rfqId: result.rfq.id })

        return {
          message: this.buildCreateSuccessMessage(result.rfq, entities),
          data: {
            rfqId: result.rfq.id,
            product: entities.productName,
            quantity: entities.quantity || 'unspecified',
            status: 'matching_suppliers',
          },
          quickActions: [
            { label: 'Add specifications', action: 'add_specs', params: { rfqId: result.rfq.id }, primary: false },
            { label: 'Set budget limits', action: 'set_budget', params: { rfqId: result.rfq.id }, primary: false },
            { label: 'View matched suppliers', action: 'view_suppliers', params: { rfqId: result.rfq.id }, primary: true },
          ],
          suggestions: [
            'Add more specifications',
            'Set a deadline',
            'Enable auto-negotiation',
            'Check supplier matches',
          ],
          conversationState: result.conversationState,
        }
      }

      // Handle creation failure
      return {
        message: result.error || "I couldn't create that RFQ. Could you try rephrasing what you need?",
        suggestions: ['Try again with more details', 'What can you help me buy?'],
      }
    }

    // Need more information - ask conversationally
    return {
      message: "I'd love to help you source that. What product or service do you need?",
      requiresMoreInfo: true,
      missingFields: ['productName'],
      suggestions: [
        'I need ball bearings',
        'Source office supplies',
        'Find a logistics provider',
      ],
    }
  }

  /**
   * Build a natural success message for RFQ creation
   */
  private buildCreateSuccessMessage(
    rfq: { id: string; status: string },
    entities: ExtractedEntities
  ): string {
    const parts: string[] = []

    parts.push(`Got it! I've created an RFQ for ${entities.quantity || 'your order of'} ${entities.productName}.`)

    if (entities.amount) {
      parts.push(`I'll look for options within your $${entities.amount.toLocaleString()} budget.`)
    }

    if (entities.deadline) {
      parts.push(`I'll prioritize suppliers who can meet your ${entities.deadline.toLocaleDateString()} deadline.`)
    }

    parts.push("I'm now matching you with qualified suppliers. You should start receiving quotes within a few hours.")

    return parts.join(' ')
  }

  // ============================================================================
  // SUPPLIER SEARCH
  // ============================================================================

  private async handleSupplierSearch(ctx: RFQIntentContext): Promise<RFQHandlerResult> {
    const { entities, userId } = ctx

    const category = entities.productCategory || entities.productName || 'general'

    const result = await this.rfqService.searchSuppliersConversational(userId, {
      category,
      location: entities.location,
    })

    if (result.suppliers.length === 0) {
      return {
        message: `I couldn't find suppliers for ${category} in our network yet. Would you like me to expand the search or create an RFQ to attract new suppliers?`,
        quickActions: [
          { label: 'Create RFQ', action: 'create_rfq', params: { category }, primary: true },
          { label: 'Expand search', action: 'expand_search', params: { category } },
        ],
        suggestions: ['Create an RFQ', 'Try a different category', 'Search nationally'],
      }
    }

    return {
      message: result.summary,
      data: {
        suppliers: result.suppliers,
        totalFound: result.suppliers.length,
        topRated: result.suppliers[0],
      },
      quickActions: [
        { label: 'Create RFQ with top suppliers', action: 'create_rfq_with_suppliers', primary: true },
        { label: 'See more details', action: 'supplier_details' },
        { label: 'Filter by rating', action: 'filter_suppliers' },
      ],
      suggestions: [
        'Create an RFQ with these suppliers',
        'Show me suppliers with 4.5+ rating',
        'Find cheaper alternatives',
      ],
    }
  }

  // ============================================================================
  // COMPARE QUOTES
  // ============================================================================

  private async handleCompareQuotes(ctx: RFQIntentContext): Promise<RFQHandlerResult> {
    const { entities, userId, context } = ctx

    // Try to find the RFQ they're asking about
    const rfqId = entities.rfqId || this.findRecentRFQFromContext(context)

    if (!rfqId) {
      // Get their active RFQs with quotes
      const activeRFQs = await this.rfqService.getActiveRFQsWithQuotes(userId)

      if (activeRFQs.length === 0) {
        return {
          message: "You don't have any active RFQs with quotes to compare. Would you like to create a new RFQ?",
          quickActions: [
            { label: 'Create new RFQ', action: 'create_rfq', primary: true },
          ],
          suggestions: ['Create a new RFQ', 'What can you help me buy?'],
        }
      }

      if (activeRFQs.length === 1) {
        return this.compareQuotesForRFQ(activeRFQs[0].id, userId)
      }

      // Multiple RFQs - ask which one
      return {
        message: `You have ${activeRFQs.length} active RFQs with quotes. Which one would you like to compare?`,
        data: {
          rfqs: activeRFQs.map(r => ({
            id: r.id,
            product: r.description,
            quoteCount: r.quoteCount,
          })),
        },
        quickActions: activeRFQs.slice(0, 3).map((r, i) => ({
          label: r.description.slice(0, 30),
          action: 'compare_quotes',
          params: { rfqId: r.id },
          primary: i === 0,
        })),
        suggestions: activeRFQs.slice(0, 3).map(r => `Compare quotes for ${r.description.slice(0, 25)}`),
      }
    }

    return this.compareQuotesForRFQ(rfqId, userId)
  }

  private async compareQuotesForRFQ(rfqId: string, userId: string): Promise<RFQHandlerResult> {
    const comparison = await this.rfqService.compareQuotesConversational(rfqId, userId)

    if (!comparison.success) {
      return {
        message: comparison.error || "I couldn't compare the quotes for this RFQ.",
        suggestions: ['Check RFQ status', 'View all my RFQs'],
      }
    }

    return {
      message: comparison.summary!,
      data: {
        rfqId,
        quotes: comparison.quotes,
        recommendation: comparison.recommendation,
        analysis: comparison.analysis,
      },
      quickActions: [
        {
          label: `Accept ${comparison.recommendation?.supplierName || 'best'} quote`,
          action: 'accept_quote',
          params: { quoteId: comparison.recommendation?.quoteId, rfqId },
          primary: true,
        },
        { label: 'Negotiate better price', action: 'negotiate', params: { rfqId } },
        { label: 'See detailed comparison', action: 'detailed_comparison', params: { rfqId } },
      ],
      suggestions: [
        'Accept the recommended quote',
        'Can you negotiate a better price?',
        'What if I need it faster?',
        'Show me the detailed breakdown',
      ],
    }
  }

  // ============================================================================
  // ACCEPT/REJECT QUOTES
  // ============================================================================

  private async handleAcceptQuote(ctx: RFQIntentContext): Promise<RFQHandlerResult> {
    const { entities, userId, context } = ctx

    const quoteId = entities.quoteId
    const supplierName = entities.supplierName || entities.companyName

    // If we have a quote ID, accept it directly
    if (quoteId) {
      const result = await this.rfqService.acceptQuoteConversational(quoteId, userId)

      if (result.success) {
        completeFlow(context, { action: 'accept_quote', quoteId })

        return {
          message: result.message!,
          data: {
            quoteId,
            supplierName: result.supplierName,
            totalAmount: result.totalAmount,
            awardId: result.awardId,
          },
          quickActions: [
            { label: 'Track delivery', action: 'track_delivery', params: { awardId: result.awardId }, primary: true },
            { label: 'Contact supplier', action: 'contact_supplier', params: { supplierId: result.supplierId } },
          ],
          suggestions: [
            'When will it arrive?',
            'Send me delivery updates',
            'Set up payment',
          ],
        }
      }

      return {
        message: result.error || "I couldn't accept that quote. It may have expired or already been processed.",
        suggestions: ['Show me available quotes', 'Check quote status'],
      }
    }

    // If we have a supplier name but no quote ID, find the quote
    if (supplierName) {
      const rfqId = entities.rfqId || this.findRecentRFQFromContext(context)

      if (rfqId) {
        const quoteBySupplier = await this.rfqService.findQuoteBySupplier(rfqId, supplierName)

        if (quoteBySupplier) {
          return this.handleAcceptQuote({
            ...ctx,
            entities: { ...entities, quoteId: quoteBySupplier.id },
          })
        }
      }

      return {
        message: `I couldn't find a quote from ${supplierName}. Would you like me to show you the available quotes?`,
        quickActions: [
          { label: 'Show available quotes', action: 'compare_quotes', primary: true },
        ],
        suggestions: ['Show me all quotes', 'Find quotes from other suppliers'],
      }
    }

    // No quote specified - show options
    return {
      message: "Which quote would you like to accept? I can show you your options if you'd like.",
      quickActions: [
        { label: 'Compare quotes', action: 'compare_quotes', primary: true },
        { label: 'Show best option', action: 'show_recommendation' },
      ],
      suggestions: ['Compare all quotes', 'Show me the best option', 'What quotes do I have?'],
    }
  }

  private async handleRejectQuote(ctx: RFQIntentContext): Promise<RFQHandlerResult> {
    const { entities, userId, context } = ctx

    const quoteId = entities.quoteId
    const supplierName = entities.supplierName || entities.companyName

    if (quoteId) {
      const result = await this.rfqService.rejectQuoteConversational(quoteId, userId)

      if (result.success) {
        return {
          message: result.message!,
          data: { quoteId, rejected: true },
          quickActions: [
            { label: 'View remaining quotes', action: 'compare_quotes', primary: true },
            { label: 'Request new quotes', action: 'request_more_quotes' },
          ],
          suggestions: [
            'Show me other options',
            'Request quotes from more suppliers',
            'Close this RFQ',
          ],
        }
      }

      return {
        message: result.error || "I couldn't reject that quote.",
        suggestions: ['Try again', 'Show quote status'],
      }
    }

    // No specific quote - ask for clarification
    if (supplierName) {
      return {
        message: `I'll reject the quote from ${supplierName}. Do you want me to find a quote from them to reject?`,
        quickActions: [
          { label: 'Yes, find and reject', action: 'find_and_reject', params: { supplierName }, primary: true },
          { label: 'Show all quotes first', action: 'compare_quotes' },
        ],
      }
    }

    return {
      message: 'Which quote would you like to reject? I can show you your options.',
      quickActions: [
        { label: 'Show my quotes', action: 'compare_quotes', primary: true },
      ],
      suggestions: ['Show my quotes', 'Reject all quotes', 'Which supplier should I reject?'],
    }
  }

  // ============================================================================
  // NEGOTIATION
  // ============================================================================

  /**
   * Handle price negotiation requests
   */
  async handleNegotiation(ctx: RFQIntentContext): Promise<RFQHandlerResult> {
    const { entities, userId, context } = ctx

    const rfqId = entities.rfqId || this.findRecentRFQFromContext(context)
    const targetAmount = entities.amount

    if (!rfqId) {
      return {
        message: "Which RFQ would you like me to negotiate? I can try to get better prices on any of your active quotes.",
        quickActions: [
          { label: 'Show my active RFQs', action: 'list_rfqs', primary: true },
        ],
        suggestions: ['Show my RFQs', 'Negotiate my recent order'],
      }
    }

    const result = await this.rfqService.startNegotiationConversational(rfqId, userId, {
      targetPrice: targetAmount,
      targetDiscount: entities.rawValues?.discountPercent
        ? parseFloat(entities.rawValues.discountPercent)
        : undefined,
    })

    if (!result.success) {
      return {
        message: result.error || "I couldn't start the negotiation. The quotes may not be eligible for negotiation.",
        suggestions: ['Check quote status', 'View quote details'],
      }
    }

    // Negotiation started or completed
    if (result.negotiationComplete) {
      return {
        message: result.summary!,
        data: {
          rfqId,
          savingsAchieved: result.savingsAchieved,
          newPrice: result.newPrice,
          originalPrice: result.originalPrice,
        },
        quickActions: [
          { label: 'Accept negotiated price', action: 'accept_quote', params: { quoteId: result.finalQuoteId }, primary: true },
          { label: 'Try for more savings', action: 'continue_negotiation', params: { rfqId } },
          { label: 'View negotiation history', action: 'negotiation_history', params: { rfqId } },
        ],
        suggestions: [
          'Accept this price',
          'Can you push for more?',
          'What was the original price?',
        ],
      }
    }

    // Negotiation in progress
    return {
      message: result.summary || "I've started negotiating on your behalf. I'll update you as suppliers respond.",
      data: {
        rfqId,
        negotiationId: result.negotiationId,
        status: 'in_progress',
      },
      quickActions: [
        { label: 'Check progress', action: 'negotiation_status', params: { negotiationId: result.negotiationId }, primary: true },
        { label: 'Set limits', action: 'set_negotiation_limits', params: { negotiationId: result.negotiationId } },
      ],
      suggestions: [
        'Check negotiation progress',
        'Set my maximum budget',
        'Let me know when done',
      ],
    }
  }

  // ============================================================================
  // TRACK DELIVERY
  // ============================================================================

  private async handleTrackDelivery(ctx: RFQIntentContext): Promise<RFQHandlerResult> {
    const { entities, userId, context } = ctx

    const orderId = entities.orderId
    const rfqId = entities.rfqId || this.findRecentRFQFromContext(context)
    const supplierName = entities.supplierName || entities.companyName

    // Get fulfillment status
    const result = await this.rfqService.trackDeliveryConversational(userId, {
      orderId,
      rfqId,
      supplierName,
    })

    if (!result.success) {
      return {
        message: result.error || "I couldn't find any orders to track. Have you accepted a quote recently?",
        quickActions: [
          { label: 'View my orders', action: 'list_orders', primary: true },
          { label: 'Check my RFQs', action: 'list_rfqs' },
        ],
        suggestions: ['Show my orders', 'Check my RFQs', 'When did I last order?'],
      }
    }

    const fulfillment = result.fulfillment!

    // Build tracking message based on status
    const message = this.buildTrackingMessage(fulfillment)

    return {
      message,
      data: {
        status: fulfillment.status,
        carrier: fulfillment.carrier,
        trackingNumber: fulfillment.trackingNumber,
        trackingUrl: fulfillment.trackingUrl,
        estimatedDelivery: fulfillment.estimatedDeliveryDate,
        actualDelivery: fulfillment.actualDeliveryDate,
      },
      quickActions: this.getTrackingQuickActions(fulfillment),
      suggestions: this.getTrackingSuggestions(fulfillment),
    }
  }

  private buildTrackingMessage(fulfillment: {
    status: string
    carrier?: string
    trackingNumber?: string
    estimatedDeliveryDate?: Date
    actualDeliveryDate?: Date
    supplierName?: string
  }): string {
    const status = fulfillment.status

    switch (status) {
      case 'pending':
        return `Your order is being prepared${fulfillment.supplierName ? ` by ${fulfillment.supplierName}` : ''}. I'll let you know once it ships.`

      case 'processing':
        return `${fulfillment.supplierName || 'The supplier'} is processing your order. It should ship soon.`

      case 'shipped':
        const carrier = fulfillment.carrier ? ` via ${fulfillment.carrier}` : ''
        const tracking = fulfillment.trackingNumber ? ` (tracking: ${fulfillment.trackingNumber})` : ''
        const eta = fulfillment.estimatedDeliveryDate
          ? ` Expected delivery: ${fulfillment.estimatedDeliveryDate.toLocaleDateString()}.`
          : ''
        return `Your order has shipped${carrier}${tracking}.${eta}`

      case 'in_transit':
        const etaTransit = fulfillment.estimatedDeliveryDate
          ? `Expected ${fulfillment.estimatedDeliveryDate.toLocaleDateString()}.`
          : 'Delivery date being calculated.'
        return `Your order is on its way! ${etaTransit}`

      case 'out_for_delivery':
        return "Your order is out for delivery today. It should arrive soon!"

      case 'delivered':
        const deliveredDate = fulfillment.actualDeliveryDate
          ? `on ${fulfillment.actualDeliveryDate.toLocaleDateString()}`
          : 'recently'
        return `Your order was delivered ${deliveredDate}. Everything look good?`

      case 'delayed':
        return "There's been a delay with your shipment. I'm monitoring it and will update you when it's moving again."

      default:
        return `Your order status is: ${status}. I'll keep you updated on any changes.`
    }
  }

  private getTrackingQuickActions(fulfillment: { status: string; trackingUrl?: string; awardId?: string }): QuickAction[] {
    const actions: QuickAction[] = []

    if (fulfillment.trackingUrl) {
      actions.push({
        label: 'Track shipment',
        action: 'open_tracking',
        params: { url: fulfillment.trackingUrl },
        primary: true,
      })
    }

    if (fulfillment.status === 'delivered') {
      actions.push({
        label: 'Confirm delivery',
        action: 'confirm_delivery',
        params: { awardId: fulfillment.awardId },
        primary: !fulfillment.trackingUrl,
      })
      actions.push({
        label: 'Report an issue',
        action: 'report_issue',
        params: { awardId: fulfillment.awardId },
      })
    }

    if (fulfillment.status === 'delayed') {
      actions.push({
        label: 'Contact supplier',
        action: 'contact_supplier',
        primary: true,
      })
    }

    return actions
  }

  private getTrackingSuggestions(fulfillment: { status: string }): string[] {
    const suggestions: string[] = []

    switch (fulfillment.status) {
      case 'pending':
      case 'processing':
        suggestions.push('When will it ship?', 'Contact supplier', 'Check other orders')
        break
      case 'shipped':
      case 'in_transit':
        suggestions.push('Track the package', 'Expected delivery?', 'Check other orders')
        break
      case 'delivered':
        suggestions.push('Confirm delivery', 'Report an issue', 'Leave feedback')
        break
      default:
        suggestions.push('Check status again', 'Contact supplier', 'View order details')
    }

    return suggestions
  }

  // ============================================================================
  // STATUS QUERIES
  // ============================================================================

  /**
   * Handle general RFQ status queries
   */
  async handleStatusQuery(ctx: RFQIntentContext): Promise<RFQHandlerResult> {
    const { entities, userId, context } = ctx

    // Check if asking about specific RFQ
    const rfqId = entities.rfqId || this.findRecentRFQFromContext(context)
    const productName = entities.productName

    if (rfqId) {
      return this.getRFQStatusResponse(rfqId, userId)
    }

    if (productName) {
      // Find RFQ by product name
      const rfq = await this.rfqService.findRFQByProduct(userId, productName)
      if (rfq) {
        return this.getRFQStatusResponse(rfq.id, userId)
      }
    }

    // Get overview of all RFQs
    const summary = await this.rfqService.getRFQSummary(userId)

    return {
      message: this.buildStatusSummaryMessage(summary),
      data: summary,
      quickActions: this.getStatusQuickActions(summary),
      suggestions: [
        'Show me my active RFQs',
        'Any quotes waiting for review?',
        'What needs my attention?',
      ],
    }
  }

  private async getRFQStatusResponse(rfqId: string, userId: string): Promise<RFQHandlerResult> {
    const status = await this.rfqService.getRFQStatusConversational(rfqId, userId)

    if (!status.success) {
      return {
        message: status.error || "I couldn't find that RFQ.",
        suggestions: ['Show my RFQs', 'Create a new RFQ'],
      }
    }

    return {
      message: status.summary!,
      data: status.rfq,
      quickActions: status.suggestedActions || [],
      suggestions: status.suggestions || [],
    }
  }

  private buildStatusSummaryMessage(summary: {
    totalActive: number
    awaitingQuotes: number
    quotesReady: number
    inNegotiation: number
    awaitingDelivery: number
  }): string {
    const parts: string[] = []

    if (summary.totalActive === 0) {
      return "You don't have any active RFQs right now. Would you like to create one?"
    }

    parts.push(`You have ${summary.totalActive} active RFQ${summary.totalActive !== 1 ? 's' : ''}.`)

    if (summary.quotesReady > 0) {
      parts.push(`${summary.quotesReady} ${summary.quotesReady === 1 ? 'has' : 'have'} quotes ready for review.`)
    }

    if (summary.inNegotiation > 0) {
      parts.push(`${summary.inNegotiation} ${summary.inNegotiation === 1 ? 'is' : 'are'} in negotiation.`)
    }

    if (summary.awaitingDelivery > 0) {
      parts.push(`${summary.awaitingDelivery} ${summary.awaitingDelivery === 1 ? 'order is' : 'orders are'} on the way.`)
    }

    return parts.join(' ')
  }

  private getStatusQuickActions(summary: {
    quotesReady: number
    inNegotiation: number
    awaitingDelivery: number
    topRfqId?: string
  }): QuickAction[] {
    const actions: QuickAction[] = []

    if (summary.quotesReady > 0) {
      actions.push({
        label: 'Review quotes',
        action: 'compare_quotes',
        params: { rfqId: summary.topRfqId },
        primary: true,
      })
    }

    if (summary.inNegotiation > 0) {
      actions.push({
        label: 'Check negotiations',
        action: 'negotiation_status',
      })
    }

    if (summary.awaitingDelivery > 0) {
      actions.push({
        label: 'Track deliveries',
        action: 'track_delivery',
      })
    }

    actions.push({
      label: 'Create new RFQ',
      action: 'create_rfq',
    })

    return actions.slice(0, 4)
  }

  // ============================================================================
  // GENERAL QUERY HANDLER
  // ============================================================================

  private async handleGeneralQuery(ctx: RFQIntentContext): Promise<RFQHandlerResult> {
    const { intent, entities, userId } = ctx

    // Try to understand what they're asking about
    const message = ctx.context.messages.slice(-1)[0]?.content || ''

    // Check for common patterns
    if (message.toLowerCase().includes('status') || message.toLowerCase().includes('update')) {
      return this.handleStatusQuery(ctx)
    }

    if (message.toLowerCase().includes('negotiat') || message.toLowerCase().includes('better price')) {
      return this.handleNegotiation(ctx)
    }

    // Default helpful response
    return {
      message: "I can help you with your procurement needs. What would you like to do?",
      quickActions: [
        { label: 'Create RFQ', action: 'create_rfq', primary: true },
        { label: 'Check my RFQs', action: 'list_rfqs' },
        { label: 'Find suppliers', action: 'search_suppliers' },
        { label: 'Track orders', action: 'track_delivery' },
      ],
      suggestions: [
        'I need to order something',
        "What's the status of my requests?",
        'Find me suppliers for...',
        'Track my recent orders',
      ],
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private findRecentRFQFromContext(context: ConversationContext): string | undefined {
    // Check active deals in context
    const rfqDeal = context.activeDeals.find(d => d.type === 'rfq')
    if (rfqDeal) return rfqDeal.id

    // Check current flow
    if (context.currentFlow?.type === 'rfq_creation' || context.currentFlow?.type === 'quote_review') {
      return context.currentFlow.data?.rfqId
    }

    // Check recent messages for RFQ references
    const recentMessages = context.messages.slice(-5)
    for (const msg of recentMessages) {
      if (msg.metadata?.createdIds?.rfqId) {
        return msg.metadata.createdIds.rfqId
      }
    }

    return undefined
  }

  private createErrorResponse(error: unknown, intent: string): RFQHandlerResult {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

    console.error(`[RFQHandler] Error in ${intent}:`, error)

    return {
      message: `I ran into an issue with that request. ${errorMessage}. Would you like to try again?`,
      suggestions: ['Try again', 'Help me with something else', 'Contact support'],
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let handlerInstance: RFQHandler | null = null

export function getRFQHandler(): RFQHandler {
  if (!handlerInstance) {
    handlerInstance = new RFQHandler()
  }
  return handlerInstance
}

export default RFQHandler
