// @ts-nocheck
/**
 * Conversational RFQ Service
 *
 * Business logic layer for managing RFQs through natural conversation.
 * Handles the translation between conversational inputs and RFQ operations,
 * maintaining conversation state and generating natural language responses.
 *
 * Key responsibilities:
 * - Parse natural language into RFQ operations
 * - Maintain conversation state for multi-turn flows
 * - Generate natural, helpful responses
 * - Track user preferences and history
 * - Coordinate with negotiation and fulfillment services
 */

import { sql } from '@vercel/postgres'
import {
  RFQ,
  RFQQuote,
  RFQStatus,
  QuoteStatus,
  RFQConstraints,
  QuoteComparison,
  RFQFulfillment,
} from './types'
import { createRFQ as createRFQFromService, getRFQById, getRFQsByUser, updateRFQStatus } from './rfq-service'
import {
  getQuotesByRFQ,
  compareQuotes,
  acceptQuote,
  rejectQuote,
  getActiveQuotesByRFQ,
} from './quote-service'
import {
  startNegotiation,
  runFullNegotiation,
  getNegotiationsByRFQ,
  getNegotiationById,
} from './negotiation-engine'
import {
  getFulfillmentByRFQ,
  getFulfillmentByAward,
  confirmDelivery,
} from './fulfillment-tracker'
import { requestQuotesFromSuppliers, findMatchingCatalogItems } from './supplier-ai'

// ============================================================================
// TYPES
// ============================================================================

export interface QuickAction {
  label: string
  action: string
  params?: Record<string, unknown>
  primary?: boolean
}

export interface RFQConversationState {
  stage: 'initial' | 'gathering_info' | 'confirming' | 'complete'
  rfqId?: string
  collectedData: {
    product?: string
    quantity?: number
    budget?: number
    deadline?: Date
    urgency?: string
    specifications?: Record<string, string>
    deliveryLocation?: string
  }
  missingFields: string[]
  lastPrompt?: string
}

export interface ConversationalRFQInput {
  product?: string
  quantity?: number
  budget?: number
  deadline?: Date | string
  urgency?: string
  specifications?: Record<string, string>
  deliveryLocation?: string
}

export interface ConversationalResult<T = unknown> {
  success: boolean
  message?: string
  summary?: string
  error?: string
  data?: T
  conversationState?: RFQConversationState
  suggestedActions?: QuickAction[]
  suggestions?: string[]
}

export interface RFQCreateResult extends ConversationalResult {
  rfq?: RFQ
}

export interface QuoteCompareResult extends ConversationalResult {
  quotes?: RFQQuote[]
  recommendation?: {
    quoteId: string
    supplierName: string
    reason: string
    confidence: number
  }
  analysis?: {
    lowestPrice: { quoteId: string; totalPrice: number }
    fastestDelivery: { quoteId: string; leadTimeDays: number }
    bestValue: { quoteId: string; score: number; reason: string }
  }
}

export interface NegotiationResult extends ConversationalResult {
  negotiationId?: string
  negotiationComplete?: boolean
  savingsAchieved?: number
  savingsPercent?: number
  newPrice?: number
  originalPrice?: number
  finalQuoteId?: string
}

export interface DeliveryTrackingResult extends ConversationalResult {
  fulfillment?: RFQFulfillment & {
    supplierName?: string
  }
}

export interface RFQSummary {
  totalActive: number
  awaitingQuotes: number
  quotesReady: number
  inNegotiation: number
  awaitingDelivery: number
  topRfqId?: string
  rfqs: Array<{
    id: string
    description: string
    status: RFQStatus
    quoteCount: number
    createdAt: Date
  }>
}

// ============================================================================
// CONVERSATIONAL RFQ SERVICE CLASS
// ============================================================================

export class ConversationalRFQService {
  // ============================================================================
  // RFQ CREATION
  // ============================================================================

  /**
   * Create an RFQ from conversational input
   */
  async createRFQFromConversation(
    userId: string,
    input: ConversationalRFQInput
  ): Promise<RFQCreateResult> {
    try {
      // Validate minimum requirements
      if (!input.product) {
        return {
          success: false,
          error: 'Product or service name is required',
          conversationState: {
            stage: 'gathering_info',
            collectedData: { ...input },
            missingFields: ['product'],
            lastPrompt: 'What product or service do you need?',
          },
        }
      }

      // Parse deadline if string
      let deadline: Date | undefined
      if (input.deadline) {
        deadline = typeof input.deadline === 'string'
          ? this.parseDeadline(input.deadline)
          : input.deadline
      }

      // Create the RFQ
      const rfq = await createRFQFromService({
        userId,
        category: this.inferCategory(input.product),
        description: this.buildDescription(input),
        quantity: input.quantity || 1,
        targetPrice: input.budget,
        urgency: input.urgency || 'standard',
        deliveryLocation: input.deliveryLocation || 'To be confirmed',
        specifications: input.specifications,
        requiredDeliveryDate: deadline,
      })

      // Start supplier matching
      this.startSupplierMatching(rfq.id).catch(console.error)

      return {
        success: true,
        rfq,
        message: `RFQ created successfully for ${input.product}`,
        conversationState: {
          stage: 'complete',
          rfqId: rfq.id,
          collectedData: { ...input },
          missingFields: [],
        },
        suggestedActions: [
          { label: 'Add specifications', action: 'add_specs', params: { rfqId: rfq.id } },
          { label: 'Set budget limits', action: 'set_budget', params: { rfqId: rfq.id } },
          { label: 'Enable auto-negotiation', action: 'enable_auto_negotiate', params: { rfqId: rfq.id }, primary: true },
        ],
      }
    } catch (error) {
      console.error('[ConversationalRFQ] Create error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create RFQ',
      }
    }
  }

  /**
   * Start supplier matching asynchronously
   */
  private async startSupplierMatching(rfqId: string): Promise<void> {
    try {
      const rfq = await getRFQById(rfqId)
      if (!rfq) return

      // Find matching catalog items and request quotes from suppliers
      const catalogItems = await findMatchingCatalogItems(
        rfq.category,
        rfq.description
      )

      if (catalogItems.length > 0) {
        // Request quotes from suppliers with matching catalog items
        await requestQuotesFromSuppliers(rfqId, catalogItems)
      }

      await updateRFQStatus(rfqId, 'matching')
    } catch (error) {
      console.error('[ConversationalRFQ] Supplier matching error:', error)
    }
  }

  // ============================================================================
  // QUOTE COMPARISON
  // ============================================================================

  /**
   * Compare quotes and generate natural language summary
   */
  async compareQuotesConversational(
    rfqId: string,
    userId: string
  ): Promise<QuoteCompareResult> {
    try {
      // Verify user owns this RFQ
      const rfq = await getRFQById(rfqId)
      if (!rfq || rfq.userId !== userId) {
        return {
          success: false,
          error: "I couldn't find that RFQ or you don't have access to it.",
        }
      }

      // Get quotes and comparison
      const quotes = await getActiveQuotesByRFQ(rfqId)

      if (quotes.length === 0) {
        return {
          success: false,
          error: "No quotes available yet. Suppliers are still reviewing your request.",
          suggestions: ['Check back later', 'Invite more suppliers'],
        }
      }

      // Get comparison analysis
      const comparison = await compareQuotes(rfqId)

      // Build recommendation
      const recommendation = this.buildRecommendation(quotes, comparison)

      // Generate summary
      const summary = this.generateComparisonSummary(quotes, comparison, recommendation)

      return {
        success: true,
        summary,
        quotes,
        recommendation,
        analysis: comparison.analysis,
        suggestedActions: [
          {
            label: `Accept ${recommendation.supplierName}'s quote`,
            action: 'accept_quote',
            params: { quoteId: recommendation.quoteId },
            primary: true,
          },
          { label: 'Negotiate prices', action: 'negotiate', params: { rfqId } },
          { label: 'View detailed breakdown', action: 'quote_details', params: { rfqId } },
        ],
      }
    } catch (error) {
      console.error('[ConversationalRFQ] Compare error:', error)
      return {
        success: false,
        error: 'Failed to compare quotes',
      }
    }
  }

  private buildRecommendation(
    quotes: RFQQuote[],
    comparison: QuoteComparison
  ): {
    quoteId: string
    supplierName: string
    reason: string
    confidence: number
  } {
    const bestValueQuote = quotes.find(q => q.id === comparison.analysis.bestValue.quoteId)
      || quotes[0]

    return {
      quoteId: bestValueQuote.id,
      supplierName: bestValueQuote.supplier?.companyName || 'Recommended Supplier',
      reason: comparison.analysis.bestValue.reason || 'Best overall value',
      confidence: comparison.analysis.bestValue.score / 100,
    }
  }

  private generateComparisonSummary(
    quotes: RFQQuote[],
    comparison: QuoteComparison,
    recommendation: { supplierName: string; reason: string }
  ): string {
    const parts: string[] = []

    parts.push(`I found ${quotes.length} quote${quotes.length > 1 ? 's' : ''} for you.`)

    // Mention price range
    const prices = quotes.map(q => q.totalPrice).sort((a, b) => a - b)
    if (prices.length > 1) {
      const lowest = prices[0]
      const highest = prices[prices.length - 1]
      if (lowest !== highest) {
        parts.push(`Prices range from $${lowest.toLocaleString()} to $${highest.toLocaleString()}.`)
      }
    }

    // Lead time info
    const leadTimes = quotes.map(q => q.leadTimeDays).sort((a, b) => a - b)
    const fastestDelivery = leadTimes[0]
    parts.push(`Fastest delivery is ${fastestDelivery} day${fastestDelivery !== 1 ? 's' : ''}.`)

    // Recommendation
    parts.push(`My recommendation: ${recommendation.supplierName} - ${recommendation.reason.toLowerCase()}.`)

    return parts.join(' ')
  }

  // ============================================================================
  // QUOTE ACCEPTANCE/REJECTION
  // ============================================================================

  /**
   * Accept a quote conversationally
   */
  async acceptQuoteConversational(
    quoteId: string,
    userId: string
  ): Promise<ConversationalResult & {
    supplierName?: string
    totalAmount?: number
    awardId?: string
    supplierId?: string
  }> {
    try {
      // Verify access
      const quote = await this.getQuoteWithAccess(quoteId, userId)
      if (!quote) {
        return {
          success: false,
          error: "I couldn't find that quote or you don't have access to it.",
        }
      }

      // Accept the quote
      const acceptedQuote = await acceptQuote(quoteId)

      // Get award info
      const awardResult = await sql`
        SELECT id FROM rfq_awards WHERE quote_id = ${quoteId} LIMIT 1
      `
      const awardId = awardResult.rows[0]?.id

      return {
        success: true,
        message: this.buildAcceptanceMessage(acceptedQuote),
        supplierName: acceptedQuote.supplier?.companyName,
        totalAmount: acceptedQuote.totalPrice,
        awardId,
        supplierId: acceptedQuote.supplierId,
        suggestedActions: [
          { label: 'Track delivery', action: 'track_delivery', params: { awardId }, primary: true },
          { label: 'Contact supplier', action: 'contact_supplier', params: { supplierId: acceptedQuote.supplierId } },
          { label: 'View order details', action: 'order_details', params: { quoteId } },
        ],
      }
    } catch (error) {
      console.error('[ConversationalRFQ] Accept error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to accept quote',
      }
    }
  }

  private buildAcceptanceMessage(quote: RFQQuote): string {
    const parts: string[] = []

    const supplierName = quote.supplier?.companyName || 'the supplier'
    parts.push(`Done! I've accepted the quote from ${supplierName}.`)

    parts.push(`Total: $${quote.totalPrice.toLocaleString()}.`)

    if (quote.leadTimeDays) {
      parts.push(`Expected delivery in ${quote.leadTimeDays} days.`)
    }

    parts.push("I'll keep you updated on fulfillment progress.")

    return parts.join(' ')
  }

  /**
   * Reject a quote conversationally
   */
  async rejectQuoteConversational(
    quoteId: string,
    userId: string,
    reason?: string
  ): Promise<ConversationalResult> {
    try {
      const quote = await this.getQuoteWithAccess(quoteId, userId)
      if (!quote) {
        return {
          success: false,
          error: "I couldn't find that quote or you don't have access to it.",
        }
      }

      await rejectQuote(quoteId, reason)

      const supplierName = quote.supplier?.companyName || 'the supplier'

      return {
        success: true,
        message: `I've rejected the quote from ${supplierName}. ${
          reason ? `Reason: ${reason}.` : ''
        } Would you like to see other options?`,
        suggestedActions: [
          { label: 'View other quotes', action: 'compare_quotes', params: { rfqId: quote.rfqId }, primary: true },
          { label: 'Request more quotes', action: 'request_quotes', params: { rfqId: quote.rfqId } },
        ],
      }
    } catch (error) {
      console.error('[ConversationalRFQ] Reject error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reject quote',
      }
    }
  }

  // ============================================================================
  // NEGOTIATION
  // ============================================================================

  /**
   * Start or continue negotiation conversationally
   */
  async startNegotiationConversational(
    rfqId: string,
    userId: string,
    options?: {
      targetPrice?: number
      targetDiscount?: number
      quoteId?: string
    }
  ): Promise<NegotiationResult> {
    try {
      // Verify access
      const rfq = await getRFQById(rfqId)
      if (!rfq || rfq.userId !== userId) {
        return {
          success: false,
          error: "I couldn't find that RFQ or you don't have access to it.",
        }
      }

      // Get quotes to negotiate
      const quotes = await getActiveQuotesByRFQ(rfqId)
      if (quotes.length === 0) {
        return {
          success: false,
          error: 'No quotes available to negotiate. Wait for suppliers to respond.',
        }
      }

      // Pick the best quote to negotiate (or specified one)
      const quoteToNegotiate = options?.quoteId
        ? quotes.find(q => q.id === options.quoteId)
        : quotes[0]

      if (!quoteToNegotiate) {
        return {
          success: false,
          error: "Couldn't find a quote to negotiate.",
        }
      }

      const originalPrice = quoteToNegotiate.totalPrice

      // Calculate target based on options
      let targetPrice = options?.targetPrice
      if (!targetPrice && options?.targetDiscount) {
        targetPrice = originalPrice * (1 - options.targetDiscount / 100)
      }

      // Set up constraints for negotiation
      const constraints: Partial<RFQConstraints> = {
        maxTotalBudget: targetPrice || originalPrice * 0.9, // Default 10% off
        targetTotalPrice: targetPrice || originalPrice * 0.85, // Aim for 15% off
        autoNegotiate: true,
        negotiationAggression: 'balanced',
        maxNegotiationRounds: 5,
      }

      // Start negotiation
      const negotiation = await runFullNegotiation({
        rfqId,
        quoteId: quoteToNegotiate.id,
        constraints: constraints as RFQConstraints,
      })

      if (!negotiation.success) {
        return {
          success: false,
          error: 'Negotiation did not reach agreement. The supplier may not be able to lower the price further.',
          summary: negotiation.summary,
        }
      }

      const savings = originalPrice - (negotiation.finalQuote?.totalPrice || originalPrice)
      const savingsPercent = (savings / originalPrice) * 100

      return {
        success: true,
        negotiationComplete: true,
        summary: this.buildNegotiationSummary(
          negotiation,
          originalPrice,
          savings,
          savingsPercent
        ),
        negotiationId: negotiation.negotiation.id,
        savingsAchieved: savings,
        savingsPercent,
        newPrice: negotiation.finalQuote?.totalPrice,
        originalPrice,
        finalQuoteId: negotiation.finalQuote?.id,
        suggestedActions: [
          {
            label: 'Accept negotiated price',
            action: 'accept_quote',
            params: { quoteId: negotiation.finalQuote?.id },
            primary: true,
          },
          { label: 'Try different supplier', action: 'negotiate_next', params: { rfqId } },
        ],
      }
    } catch (error) {
      console.error('[ConversationalRFQ] Negotiation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Negotiation failed',
      }
    }
  }

  private buildNegotiationSummary(
    negotiation: { summary: string },
    originalPrice: number,
    savings: number,
    savingsPercent: number
  ): string {
    if (savings <= 0) {
      return `I negotiated with the supplier, but they couldn't lower the price. The current offer of $${originalPrice.toLocaleString()} is their best.`
    }

    return `Great news! I negotiated the price down by ${savingsPercent.toFixed(1)}%. ` +
      `You save $${savings.toLocaleString()}, bringing the total to $${(originalPrice - savings).toLocaleString()}. ` +
      `Would you like to accept this price?`
  }

  // ============================================================================
  // DELIVERY TRACKING
  // ============================================================================

  /**
   * Get delivery status conversationally
   */
  async trackDeliveryConversational(
    userId: string,
    options?: {
      orderId?: string
      rfqId?: string
      supplierName?: string
    }
  ): Promise<DeliveryTrackingResult> {
    try {
      let fulfillment: RFQFulfillment | null = null
      let supplierName: string | undefined

      // Try to find fulfillment by various methods
      if (options?.rfqId) {
        fulfillment = await getFulfillmentByRFQ(options.rfqId)
      } else if (options?.orderId) {
        fulfillment = await getFulfillmentByAward(options.orderId)
      } else {
        // Get user's most recent fulfillment
        const result = await sql`
          SELECT f.*, s.company_name as supplier_name
          FROM rfq_fulfillment f
          JOIN rfq_awards a ON f.award_id = a.id
          JOIN rfqs r ON a.rfq_id = r.id
          LEFT JOIN suppliers s ON a.supplier_id = s.id
          WHERE r.user_id = ${userId}
          ORDER BY f.created_at DESC
          LIMIT 1
        `

        if (result.rows[0]) {
          fulfillment = this.mapFulfillmentRow(result.rows[0])
          supplierName = result.rows[0].supplier_name
        }
      }

      if (!fulfillment) {
        return {
          success: false,
          error: "I couldn't find any active orders to track. Have you accepted a quote recently?",
        }
      }

      return {
        success: true,
        fulfillment: {
          ...fulfillment,
          supplierName,
        },
      }
    } catch (error) {
      console.error('[ConversationalRFQ] Track delivery error:', error)
      return {
        success: false,
        error: 'Failed to get delivery status',
      }
    }
  }

  // ============================================================================
  // STATUS & QUERIES
  // ============================================================================

  /**
   * Get RFQ status with conversational summary
   */
  async getRFQStatusConversational(
    rfqId: string,
    userId: string
  ): Promise<ConversationalResult & { rfq?: RFQ }> {
    try {
      const rfq = await getRFQById(rfqId)
      if (!rfq || rfq.userId !== userId) {
        return {
          success: false,
          error: "I couldn't find that RFQ.",
        }
      }

      const quotes = await getActiveQuotesByRFQ(rfqId)
      const negotiations = await getNegotiationsByRFQ(rfqId)
      const activeNegotiation = negotiations.find(n => n.status === 'active')

      const summary = this.buildStatusSummary(rfq, quotes, activeNegotiation)
      const suggestedActions = this.getStatusActions(rfq, quotes, activeNegotiation)

      return {
        success: true,
        summary,
        rfq,
        suggestedActions,
        suggestions: this.getStatusSuggestions(rfq, quotes),
      }
    } catch (error) {
      console.error('[ConversationalRFQ] Status error:', error)
      return {
        success: false,
        error: 'Failed to get RFQ status',
      }
    }
  }

  private buildStatusSummary(
    rfq: RFQ,
    quotes: RFQQuote[],
    activeNegotiation?: { currentRound: number; maxRounds: number }
  ): string {
    const parts: string[] = []

    parts.push(`Your RFQ for ${rfq.description} is currently ${this.getStatusDescription(rfq.status)}.`)

    if (quotes.length > 0) {
      const prices = quotes.map(q => q.totalPrice).sort((a, b) => a - b)
      parts.push(`You have ${quotes.length} quote${quotes.length > 1 ? 's' : ''}, ranging from $${prices[0].toLocaleString()}${prices.length > 1 ? ` to $${prices[prices.length - 1].toLocaleString()}` : ''}.`)
    } else if (rfq.status === 'matching' || rfq.status === 'open') {
      parts.push("I'm still waiting for suppliers to respond with quotes.")
    }

    if (activeNegotiation) {
      parts.push(`Active negotiation in progress (round ${activeNegotiation.currentRound}/${activeNegotiation.maxRounds}).`)
    }

    return parts.join(' ')
  }

  private getStatusDescription(status: RFQStatus): string {
    const descriptions: Record<RFQStatus, string> = {
      draft: 'in draft mode',
      open: 'open and accepting quotes',
      matching: 'being matched with suppliers',
      quoting: 'receiving quotes from suppliers',
      negotiating: 'in negotiation',
      quoted: 'has accepted quotes',
      awarded: 'awarded to a supplier',
      fulfilling: 'being fulfilled',
      delivered: 'delivered',
      completed: 'completed',
      cancelled: 'cancelled',
    }
    return descriptions[status] || status
  }

  private getStatusActions(
    rfq: RFQ,
    quotes: RFQQuote[],
    activeNegotiation?: unknown
  ): QuickAction[] {
    const actions: QuickAction[] = []

    if (quotes.length > 0) {
      actions.push({
        label: 'Compare quotes',
        action: 'compare_quotes',
        params: { rfqId: rfq.id },
        primary: true,
      })
      actions.push({
        label: 'Start negotiation',
        action: 'negotiate',
        params: { rfqId: rfq.id },
      })
    }

    if (rfq.status === 'fulfilling' || rfq.status === 'awarded') {
      actions.push({
        label: 'Track delivery',
        action: 'track_delivery',
        params: { rfqId: rfq.id },
        primary: quotes.length === 0,
      })
    }

    if (!activeNegotiation && ['open', 'matching', 'quoting'].includes(rfq.status)) {
      actions.push({
        label: 'Edit RFQ',
        action: 'edit_rfq',
        params: { rfqId: rfq.id },
      })
    }

    return actions
  }

  private getStatusSuggestions(rfq: RFQ, quotes: RFQQuote[]): string[] {
    if (quotes.length > 0) {
      return [
        'Show me the quotes',
        'What do you recommend?',
        'Can you negotiate a better price?',
      ]
    }

    return [
      'When will I get quotes?',
      'Add more suppliers',
      'Update my requirements',
    ]
  }

  /**
   * Get summary of all user's RFQs
   */
  async getRFQSummary(userId: string): Promise<RFQSummary> {
    try {
      const rfqs = await getRFQsByUser(userId)

      const activeRfqs = rfqs.filter(r =>
        !['completed', 'cancelled'].includes(r.status)
      )

      // Get quote counts for active RFQs
      const rfqsWithQuotes = await Promise.all(
        activeRfqs.map(async rfq => {
          const quotes = await getActiveQuotesByRFQ(rfq.id)
          return {
            ...rfq,
            quoteCount: quotes.length,
          }
        })
      )

      const awaitingQuotes = rfqsWithQuotes.filter(
        r => ['open', 'matching'].includes(r.status) && r.quoteCount === 0
      ).length

      const quotesReady = rfqsWithQuotes.filter(
        r => r.quoteCount > 0 && ['open', 'matching', 'quoting'].includes(r.status)
      ).length

      const inNegotiation = rfqsWithQuotes.filter(
        r => r.status === 'negotiating'
      ).length

      const awaitingDelivery = rfqsWithQuotes.filter(
        r => ['awarded', 'fulfilling'].includes(r.status)
      ).length

      // Find top priority RFQ
      const topRfq = rfqsWithQuotes
        .filter(r => r.quoteCount > 0)
        .sort((a, b) => b.quoteCount - a.quoteCount)[0]

      return {
        totalActive: activeRfqs.length,
        awaitingQuotes,
        quotesReady,
        inNegotiation,
        awaitingDelivery,
        topRfqId: topRfq?.id,
        rfqs: rfqsWithQuotes.map(r => ({
          id: r.id,
          description: r.description,
          status: r.status,
          quoteCount: r.quoteCount,
          createdAt: r.createdAt,
        })),
      }
    } catch (error) {
      console.error('[ConversationalRFQ] Summary error:', error)
      return {
        totalActive: 0,
        awaitingQuotes: 0,
        quotesReady: 0,
        inNegotiation: 0,
        awaitingDelivery: 0,
        rfqs: [],
      }
    }
  }

  /**
   * Get active RFQs with quotes
   */
  async getActiveRFQsWithQuotes(userId: string): Promise<Array<{
    id: string
    description: string
    quoteCount: number
    status: RFQStatus
  }>> {
    const summary = await this.getRFQSummary(userId)
    return summary.rfqs.filter(r => r.quoteCount > 0)
  }

  // ============================================================================
  // SUPPLIER SEARCH
  // ============================================================================

  /**
   * Search for suppliers conversationally
   */
  async searchSuppliersConversational(
    userId: string,
    options: {
      category?: string
      location?: string
      minRating?: number
    }
  ): Promise<{
    suppliers: Array<{
      id: string
      companyName: string
      rating: number
      responseRate: number
      location?: string
    }>
    summary: string
  }> {
    try {
      const result = await sql`
        SELECT
          id,
          company_name,
          rating,
          response_rate,
          location
        FROM suppliers
        WHERE active = true
        ${options.category ? sql`AND categories @> ARRAY[${options.category}]::text[]` : sql``}
        ${options.minRating ? sql`AND rating >= ${options.minRating}` : sql``}
        ORDER BY rating DESC, response_rate DESC
        LIMIT 10
      `

      const suppliers = result.rows.map(r => ({
        id: r.id,
        companyName: r.company_name,
        rating: parseFloat(r.rating),
        responseRate: parseFloat(r.response_rate),
        location: r.location,
      }))

      const summary = suppliers.length > 0
        ? `Found ${suppliers.length} supplier${suppliers.length > 1 ? 's' : ''} for ${options.category || 'your needs'}. Top rated: ${suppliers[0].companyName} (${suppliers[0].rating} stars).`
        : `No suppliers found for ${options.category || 'your criteria'}. Try broadening your search.`

      return { suppliers, summary }
    } catch (error) {
      console.error('[ConversationalRFQ] Supplier search error:', error)
      return {
        suppliers: [],
        summary: "I couldn't search suppliers right now. Please try again.",
      }
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Find RFQ by product name
   */
  async findRFQByProduct(userId: string, productName: string): Promise<RFQ | null> {
    try {
      const result = await sql`
        SELECT * FROM rfqs
        WHERE user_id = ${userId}
        AND (
          LOWER(description) LIKE ${`%${productName.toLowerCase()}%`}
          OR LOWER(category) LIKE ${`%${productName.toLowerCase()}%`}
        )
        ORDER BY created_at DESC
        LIMIT 1
      `

      if (result.rows.length === 0) return null
      return this.mapRFQRow(result.rows[0])
    } catch (error) {
      console.error('[ConversationalRFQ] Find RFQ error:', error)
      return null
    }
  }

  /**
   * Find quote by supplier name
   */
  async findQuoteBySupplier(rfqId: string, supplierName: string): Promise<RFQQuote | null> {
    try {
      const result = await sql`
        SELECT q.*
        FROM rfq_quotes q
        JOIN suppliers s ON q.supplier_id = s.id
        WHERE q.rfq_id = ${rfqId}
        AND LOWER(s.company_name) LIKE ${`%${supplierName.toLowerCase()}%`}
        AND q.status NOT IN ('rejected', 'expired', 'withdrawn')
        ORDER BY q.created_at DESC
        LIMIT 1
      `

      if (result.rows.length === 0) return null
      return this.mapQuoteRow(result.rows[0])
    } catch (error) {
      console.error('[ConversationalRFQ] Find quote error:', error)
      return null
    }
  }

  private async getQuoteWithAccess(quoteId: string, userId: string): Promise<RFQQuote | null> {
    try {
      const result = await sql`
        SELECT q.*
        FROM rfq_quotes q
        JOIN rfqs r ON q.rfq_id = r.id
        WHERE q.id = ${quoteId}
        AND r.user_id = ${userId}
      `

      if (result.rows.length === 0) return null
      return this.mapQuoteRow(result.rows[0])
    } catch (error) {
      return null
    }
  }

  private inferCategory(product: string): string {
    const categories: Record<string, string[]> = {
      electronics: ['motor', 'sensor', 'circuit', 'board', 'chip', 'electronic', 'battery'],
      mechanical: ['bearing', 'gear', 'shaft', 'valve', 'pump', 'fastener', 'screw', 'bolt'],
      materials: ['steel', 'aluminum', 'plastic', 'rubber', 'copper', 'metal'],
      office: ['paper', 'supplies', 'furniture', 'desk', 'chair'],
      logistics: ['shipping', 'freight', 'transport', 'delivery', 'warehouse'],
    }

    const lowerProduct = product.toLowerCase()

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(k => lowerProduct.includes(k))) {
        return category
      }
    }

    return 'general'
  }

  private buildDescription(input: ConversationalRFQInput): string {
    const parts: string[] = []

    if (input.quantity) {
      parts.push(input.quantity.toString())
    }

    parts.push(input.product || 'items')

    if (input.specifications) {
      const specs = Object.entries(input.specifications)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
      if (specs) parts.push(`(${specs})`)
    }

    return parts.join(' ')
  }

  private parseDeadline(deadline: string): Date {
    // Try to parse natural language dates
    const now = new Date()

    const lowerDeadline = deadline.toLowerCase()

    if (lowerDeadline.includes('asap') || lowerDeadline.includes('urgent')) {
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 1 week
    }

    if (lowerDeadline.includes('week')) {
      const weeks = parseInt(deadline) || 1
      return new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000)
    }

    if (lowerDeadline.includes('month')) {
      const months = parseInt(deadline) || 1
      const date = new Date(now)
      date.setMonth(date.getMonth() + months)
      return date
    }

    // Try standard date parsing
    const parsed = new Date(deadline)
    return isNaN(parsed.getTime()) ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) : parsed
  }

  // ============================================================================
  // ROW MAPPERS
  // ============================================================================

  private mapRFQRow(row: Record<string, unknown>): RFQ {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      category: row.category as string,
      description: row.description as string,
      quantity: row.quantity as number,
      targetPrice: row.target_price ? parseFloat(row.target_price as string) : undefined,
      urgency: row.urgency as string,
      deliveryLocation: row.delivery_location as string,
      specifications: row.specifications as Record<string, string> | undefined,
      requiredDeliveryDate: row.required_delivery_date
        ? new Date(row.required_delivery_date as string)
        : undefined,
      status: row.status as RFQStatus,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }
  }

  private mapQuoteRow(row: Record<string, unknown>): RFQQuote {
    return {
      id: row.id as string,
      rfqId: row.rfq_id as string,
      supplierId: row.supplier_id as string,
      unitPrice: parseFloat(row.unit_price as string),
      quantity: row.quantity as number,
      totalPrice: parseFloat(row.total_price as string),
      currency: (row.currency as string) || 'USD',
      leadTimeDays: row.lead_time_days as number,
      paymentTerms: row.payment_terms as string | undefined,
      warrantyMonths: row.warranty_months as number | undefined,
      shippingCost: parseFloat((row.shipping_cost as string) || '0'),
      shippingMethod: row.shipping_method as string | undefined,
      validUntil: row.valid_until ? new Date(row.valid_until as string) : undefined,
      notes: row.notes as string | undefined,
      lineItems: (row.line_items as RFQQuote['lineItems']) || [],
      aiGenerated: row.ai_generated as boolean,
      isInitialQuote: row.is_initial_quote as boolean,
      parentQuoteId: row.parent_quote_id as string | undefined,
      negotiationRound: row.negotiation_round as number,
      status: row.status as QuoteStatus,
      supplierConfirmed: row.supplier_confirmed as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }
  }

  private mapFulfillmentRow(row: Record<string, unknown>): RFQFulfillment {
    return {
      id: row.id as string,
      awardId: row.award_id as string,
      rfqId: row.rfq_id as string,
      status: row.status as RFQFulfillment['status'],
      carrier: row.carrier as string | undefined,
      trackingNumber: row.tracking_number as string | undefined,
      trackingUrl: row.tracking_url as string | undefined,
      estimatedShipDate: row.estimated_ship_date
        ? new Date(row.estimated_ship_date as string)
        : undefined,
      actualShipDate: row.actual_ship_date
        ? new Date(row.actual_ship_date as string)
        : undefined,
      estimatedDeliveryDate: row.estimated_delivery_date
        ? new Date(row.estimated_delivery_date as string)
        : undefined,
      actualDeliveryDate: row.actual_delivery_date
        ? new Date(row.actual_delivery_date as string)
        : undefined,
      deliveryConfirmed: row.delivery_confirmed as boolean,
      deliveryConfirmedBy: row.delivery_confirmed_by as string | undefined,
      deliveryConfirmedAt: row.delivery_confirmed_at
        ? new Date(row.delivery_confirmed_at as string)
        : undefined,
      hasIssues: row.has_issues as boolean,
      issueDescription: row.issue_description as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let serviceInstance: ConversationalRFQService | null = null

export function getConversationalRFQService(): ConversationalRFQService {
  if (!serviceInstance) {
    serviceInstance = new ConversationalRFQService()
  }
  return serviceInstance
}

export default ConversationalRFQService
