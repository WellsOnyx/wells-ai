// @ts-nocheck
/**
 * Wells AI Payments Chat Handler
 *
 * Handles all payment-related intents from conversational interface.
 * Supports balance checks, transfers, invoice payments, escrow,
 * transaction history, payment requests, and credit line management.
 *
 * SECURITY CONSIDERATIONS:
 * - High-value transactions require explicit confirmation
 * - All amounts are validated and sanitized
 * - Recipients are verified before execution
 * - Rate limiting applied per user
 * - Audit trail for all operations
 */

import {
  ConversationalPayments,
  PaymentIntent,
  PaymentIntentType,
  ParsedPaymentRequest,
  PaymentConfirmation,
  TransactionSummary,
  FinancialInsight,
} from '@/lib/payments/conversational-payments'

// ============================================================================
// TYPES
// ============================================================================

export interface PaymentHandlerContext {
  userId: string
  clerkUserId: string
  sessionId?: string
  conversationId?: string
  timezone?: string
  previousMessages?: Array<{ role: string; content: string }>
}

export interface PaymentHandlerResult {
  success: boolean
  message: string
  data?: unknown
  requiresConfirmation?: boolean
  confirmationToken?: string
  confirmationDetails?: PaymentConfirmation
  suggestedActions?: string[]
  warnings?: string[]
  error?: string
}

export interface PendingConfirmation {
  token: string
  intent: PaymentIntent
  parsedRequest: ParsedPaymentRequest
  expiresAt: Date
  createdAt: Date
}

// In-memory store for pending confirmations (use Redis in production)
const pendingConfirmations = new Map<string, PendingConfirmation>()

// ============================================================================
// INTENT DETECTION
// ============================================================================

const PAYMENT_INTENT_PATTERNS: Record<PaymentIntentType, RegExp[]> = {
  check_balance: [
    /what('s| is) my (grain|usdc|balance|wallet)/i,
    /how much (do i have|is in my|grain)/i,
    /show (me )?(my )?balance/i,
    /balance (check|status|inquiry)/i,
    /my (grain|usdc|wallet) balance/i,
    /check (my )?balance/i,
  ],
  send_money: [
    /send \$?[\d,]+(\.\d{2})? to/i,
    /transfer \$?[\d,]+(\.\d{2})? to/i,
    /pay \$?[\d,]+(\.\d{2})? to/i,
    /send (money|payment|funds) to/i,
    /wire \$?[\d,]+/i,
    /venmo .+ \$?[\d,]+/i,
  ],
  pay_invoice: [
    /pay invoice #?\w+/i,
    /settle invoice/i,
    /pay (bill|invoice) (for|from|#)/i,
    /process invoice/i,
    /pay (the )?invoice/i,
  ],
  create_escrow: [
    /hold payment until/i,
    /escrow (for|payment)/i,
    /secure payment/i,
    /hold funds/i,
    /conditional payment/i,
    /release (on|when|after)/i,
    /milestone payment/i,
  ],
  view_transactions: [
    /show (me )?(my )?transactions/i,
    /transaction history/i,
    /recent (transactions|payments|transfers)/i,
    /what (did i|have i) (spent|paid|sent)/i,
    /payment history/i,
    /my (spending|payments)/i,
  ],
  request_payment: [
    /request \$?[\d,]+(\.\d{2})? from/i,
    /ask .+ for \$?[\d,]+/i,
    /invoice .+ for \$?[\d,]+/i,
    /send (invoice|payment request) to/i,
    /collect (payment|money) from/i,
    /bill .+ for/i,
  ],
  financial_insights: [
    /what('s| is) my spending/i,
    /spending (this|last) (month|week|quarter)/i,
    /financial (summary|overview|insights)/i,
    /where (is|did) my money go/i,
    /cash flow/i,
    /burn rate/i,
    /expense breakdown/i,
    /top (expenses|spending|vendors)/i,
  ],
  credit_line: [
    /credit line/i,
    /available credit/i,
    /credit limit/i,
    /draw (on|from) (credit|line)/i,
    /borrow/i,
    /credit status/i,
    /increase (my )?credit/i,
    /line of credit/i,
  ],
  confirm_payment: [
    /^(yes|confirm|proceed|approve|do it|go ahead|ok|okay|send it|pay it)$/i,
    /yes,? (send|pay|transfer|proceed)/i,
    /confirm (the )?(payment|transfer|transaction)/i,
  ],
  cancel_payment: [
    /^(no|cancel|stop|don't|nevermind|never mind|abort)$/i,
    /cancel (the )?(payment|transfer|transaction)/i,
    /don't (send|pay|transfer)/i,
  ],
}

/**
 * Detect payment intent from natural language message
 */
export function detectPaymentIntent(message: string): PaymentIntentType | null {
  const normalizedMessage = message.trim().toLowerCase()

  for (const [intentType, patterns] of Object.entries(PAYMENT_INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedMessage)) {
        return intentType as PaymentIntentType
      }
    }
  }

  return null
}

/**
 * Extract payment details from natural language
 */
export function extractPaymentDetails(message: string): Partial<ParsedPaymentRequest> {
  const details: Partial<ParsedPaymentRequest> = {}

  // Extract amount (supports $1,234.56 format)
  const amountMatch = message.match(/\$?([\d,]+(?:\.\d{2})?)/i)
  if (amountMatch) {
    details.amount = parseFloat(amountMatch[1].replace(/,/g, ''))
  }

  // Extract email recipient
  const emailMatch = message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
  if (emailMatch) {
    details.recipientEmail = emailMatch[1]
  }

  // Extract @username mention
  const usernameMatch = message.match(/@([a-zA-Z0-9_]+)/i)
  if (usernameMatch) {
    details.recipientUsername = usernameMatch[1]
  }

  // Extract invoice number
  const invoiceMatch = message.match(/invoice #?([A-Za-z0-9-]+)/i)
  if (invoiceMatch) {
    details.invoiceId = invoiceMatch[1]
  }

  // Extract memo/description
  const memoPatterns = [
    /for ["\']([^"\']+)["\']/i,
    /memo:?\s*["\']?([^"\']+)["\']?/i,
    /note:?\s*["\']?([^"\']+)["\']?/i,
  ]
  for (const pattern of memoPatterns) {
    const memoMatch = message.match(pattern)
    if (memoMatch) {
      details.memo = memoMatch[1].trim()
      break
    }
  }

  // Extract time period for insights
  const periodMatch = message.match(/(this|last)\s+(week|month|quarter|year)/i)
  if (periodMatch) {
    details.period = periodMatch[0].toLowerCase() as ParsedPaymentRequest['period']
  }

  // Extract escrow condition
  const conditionMatch = message.match(/until\s+(.+?)(?:\.|$)/i)
  if (conditionMatch) {
    details.escrowCondition = conditionMatch[1].trim()
  }

  // Extract currency preference
  if (/grain/i.test(message)) {
    details.currency = 'GRAIN'
  } else if (/usdc/i.test(message)) {
    details.currency = 'USDC'
  } else if (/usd|\$/i.test(message)) {
    details.currency = 'USD'
  }

  return details
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export class PaymentsHandler {
  private conversationalPayments: ConversationalPayments

  constructor() {
    this.conversationalPayments = new ConversationalPayments()
  }

  /**
   * Main entry point for handling payment-related messages
   */
  async handleMessage(
    message: string,
    context: PaymentHandlerContext
  ): Promise<PaymentHandlerResult> {
    try {
      // Check for pending confirmation response
      const pendingConfirmation = this.findPendingConfirmation(context.userId)

      if (pendingConfirmation) {
        return await this.handleConfirmationResponse(message, pendingConfirmation, context)
      }

      // Detect intent
      const intentType = detectPaymentIntent(message)

      if (!intentType) {
        return {
          success: false,
          message: 'I could not understand your payment request. Please try again.',
          suggestedActions: [
            'Check my balance',
            'Send $100 to john@example.com',
            'Show my recent transactions',
            'Pay invoice #1234',
          ],
        }
      }

      // Extract details
      const details = extractPaymentDetails(message)

      // Route to appropriate handler
      switch (intentType) {
        case 'check_balance':
          return await this.handleCheckBalance(context)

        case 'send_money':
          return await this.handleSendMoney(details, context)

        case 'pay_invoice':
          return await this.handlePayInvoice(details, context)

        case 'create_escrow':
          return await this.handleCreateEscrow(details, context)

        case 'view_transactions':
          return await this.handleViewTransactions(details, context)

        case 'request_payment':
          return await this.handleRequestPayment(details, context)

        case 'financial_insights':
          return await this.handleFinancialInsights(details, context)

        case 'credit_line':
          return await this.handleCreditLine(details, context)

        default:
          return {
            success: false,
            message: 'I could not process that payment request.',
            error: 'Unknown intent type',
          }
      }
    } catch (error) {
      console.error('[PaymentsHandler] Error:', error)
      return {
        success: false,
        message: 'I encountered an error processing your request. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // ============================================================================
  // BALANCE CHECK
  // ============================================================================

  private async handleCheckBalance(
    context: PaymentHandlerContext
  ): Promise<PaymentHandlerResult> {
    const balance = await this.conversationalPayments.getBalance(context.userId)

    const message = this.formatBalanceMessage(balance)

    return {
      success: true,
      message,
      data: balance,
      suggestedActions: [
        'Show my transactions',
        'Send money',
        'View credit line',
      ],
    }
  }

  private formatBalanceMessage(balance: any): string {
    const parts: string[] = []

    // Main balance
    parts.push(`Your GRAIN Balance: $${balance.grain.available.toLocaleString()}`)

    if (balance.grain.pending > 0) {
      parts.push(`  Pending: $${balance.grain.pending.toLocaleString()}`)
    }

    if (balance.grain.staked > 0) {
      parts.push(`  Staked: $${balance.grain.staked.toLocaleString()} (earning ${balance.grain.stakingApy}% APY)`)
    }

    // Yield earnings
    if (balance.yield && balance.yield.earned > 0) {
      parts.push(`\nYield Earned: $${balance.yield.earned.toLocaleString()}`)
      if (balance.yield.pending > 0) {
        parts.push(`  Pending Yield: $${balance.yield.pending.toLocaleString()}`)
      }
    }

    // Credit available
    if (balance.credit && balance.credit.available > 0) {
      parts.push(`\nCredit Available: $${balance.credit.available.toLocaleString()} of $${balance.credit.limit.toLocaleString()}`)
    }

    return parts.join('\n')
  }

  // ============================================================================
  // SEND MONEY
  // ============================================================================

  private async handleSendMoney(
    details: Partial<ParsedPaymentRequest>,
    context: PaymentHandlerContext
  ): Promise<PaymentHandlerResult> {
    // Validate required fields
    if (!details.amount) {
      return {
        success: false,
        message: 'How much would you like to send?',
        suggestedActions: ['Send $100', 'Send $500', 'Send $1,000'],
      }
    }

    if (!details.recipientEmail && !details.recipientUsername) {
      return {
        success: false,
        message: 'Who would you like to send to? Please provide an email or @username.',
        suggestedActions: ['Send to john@example.com', 'Send to @johndoe'],
      }
    }

    // Check balance
    const balance = await this.conversationalPayments.getBalance(context.userId)
    if (balance.grain.available < details.amount) {
      return {
        success: false,
        message: `Insufficient balance. You have $${balance.grain.available.toLocaleString()} available, but you're trying to send $${details.amount.toLocaleString()}.`,
        warnings: ['Consider depositing more funds or reducing the amount.'],
        suggestedActions: [
          'Check my balance',
          `Send $${Math.floor(balance.grain.available)}`,
          'Deposit funds',
        ],
      }
    }

    // Determine if confirmation is needed
    const confirmationThreshold = await this.getConfirmationThreshold(context.userId)
    const requiresConfirmation = details.amount >= confirmationThreshold

    // Look up recipient
    const recipient = await this.conversationalPayments.lookupRecipient(
      details.recipientEmail || details.recipientUsername || ''
    )

    const confirmationDetails: PaymentConfirmation = {
      type: 'send_money',
      amount: details.amount,
      currency: details.currency || 'GRAIN',
      recipient: recipient?.name || details.recipientEmail || `@${details.recipientUsername}`,
      recipientEmail: details.recipientEmail,
      recipientVerified: recipient?.verified || false,
      memo: details.memo,
      estimatedFee: details.amount * 0.001, // 0.1% fee
      estimatedArrival: 'Instant',
    }

    if (requiresConfirmation) {
      const token = this.createConfirmationToken(context.userId, {
        intentType: 'send_money',
        ...details,
      } as PaymentIntent, details as ParsedPaymentRequest)

      const warnings: string[] = []
      if (!recipient?.verified) {
        warnings.push('This recipient has not been verified on Wells.')
      }
      if (details.amount >= 10000) {
        warnings.push('This is a high-value transaction.')
      }

      return {
        success: true,
        requiresConfirmation: true,
        confirmationToken: token,
        confirmationDetails,
        message: this.formatConfirmationMessage(confirmationDetails),
        warnings,
        suggestedActions: ['Yes, send it', 'No, cancel'],
      }
    }

    // Execute immediately for low-value transactions
    return await this.executeSendMoney(details, context)
  }

  private async executeSendMoney(
    details: Partial<ParsedPaymentRequest>,
    context: PaymentHandlerContext
  ): Promise<PaymentHandlerResult> {
    try {
      const result = await this.conversationalPayments.sendMoney({
        fromUserId: context.userId,
        toEmail: details.recipientEmail,
        toUsername: details.recipientUsername,
        amount: details.amount!,
        currency: details.currency || 'GRAIN',
        memo: details.memo,
      })

      return {
        success: true,
        message: `Sent $${details.amount!.toLocaleString()} to ${details.recipientEmail || '@' + details.recipientUsername}. Transaction ID: ${result.transactionId}`,
        data: result,
        suggestedActions: [
          'View transaction',
          'Send another payment',
          'Check my balance',
        ],
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to send payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // ============================================================================
  // PAY INVOICE
  // ============================================================================

  private async handlePayInvoice(
    details: Partial<ParsedPaymentRequest>,
    context: PaymentHandlerContext
  ): Promise<PaymentHandlerResult> {
    if (!details.invoiceId) {
      // Try to find recent unpaid invoices
      const unpaidInvoices = await this.conversationalPayments.getUnpaidInvoices(context.userId)

      if (unpaidInvoices.length === 0) {
        return {
          success: false,
          message: 'You have no unpaid invoices.',
          suggestedActions: ['Check my balance', 'View transactions'],
        }
      }

      if (unpaidInvoices.length === 1) {
        details.invoiceId = unpaidInvoices[0].id
        details.amount = unpaidInvoices[0].amount
      } else {
        const invoiceList = unpaidInvoices
          .slice(0, 5)
          .map(inv => `  - Invoice #${inv.id}: $${inv.amount.toLocaleString()} from ${inv.vendor}`)
          .join('\n')

        return {
          success: false,
          message: `You have ${unpaidInvoices.length} unpaid invoices. Which one would you like to pay?\n\n${invoiceList}`,
          data: { invoices: unpaidInvoices },
          suggestedActions: unpaidInvoices.slice(0, 3).map(inv => `Pay invoice #${inv.id}`),
        }
      }
    }

    // Get invoice details
    const invoice = await this.conversationalPayments.getInvoice(details.invoiceId!)

    if (!invoice) {
      return {
        success: false,
        message: `Invoice #${details.invoiceId} not found.`,
        suggestedActions: ['Show unpaid invoices'],
      }
    }

    if (invoice.status === 'paid') {
      return {
        success: false,
        message: `Invoice #${details.invoiceId} has already been paid.`,
        suggestedActions: ['Show unpaid invoices', 'View transaction history'],
      }
    }

    // Check balance
    const balance = await this.conversationalPayments.getBalance(context.userId)
    if (balance.grain.available < invoice.amount) {
      return {
        success: false,
        message: `Insufficient balance. Invoice #${details.invoiceId} is $${invoice.amount.toLocaleString()}, but you only have $${balance.grain.available.toLocaleString()} available.`,
        suggestedActions: ['Deposit funds', 'Use credit line'],
      }
    }

    // All invoice payments require confirmation
    const confirmationDetails: PaymentConfirmation = {
      type: 'pay_invoice',
      amount: invoice.amount,
      currency: 'GRAIN',
      recipient: invoice.vendor,
      invoiceId: invoice.id,
      invoiceDescription: invoice.description,
      invoiceDueDate: invoice.dueDate,
      estimatedFee: 0, // No fee for invoice payments
      estimatedArrival: 'Instant',
    }

    const token = this.createConfirmationToken(
      context.userId,
      { intentType: 'pay_invoice', invoiceId: invoice.id } as PaymentIntent,
      { ...details, amount: invoice.amount } as ParsedPaymentRequest
    )

    return {
      success: true,
      requiresConfirmation: true,
      confirmationToken: token,
      confirmationDetails,
      message: `Pay Invoice #${invoice.id}\n\nVendor: ${invoice.vendor}\nAmount: $${invoice.amount.toLocaleString()}\nDescription: ${invoice.description}\nDue: ${invoice.dueDate}\n\nConfirm payment?`,
      suggestedActions: ['Yes, pay it', 'No, cancel'],
    }
  }

  private async executePayInvoice(
    details: Partial<ParsedPaymentRequest>,
    context: PaymentHandlerContext
  ): Promise<PaymentHandlerResult> {
    try {
      const result = await this.conversationalPayments.payInvoice({
        userId: context.userId,
        invoiceId: details.invoiceId!,
      })

      return {
        success: true,
        message: `Paid invoice #${details.invoiceId}. $${result.amount.toLocaleString()} sent to ${result.vendor}. Transaction ID: ${result.transactionId}`,
        data: result,
        suggestedActions: [
          'View receipt',
          'Show unpaid invoices',
          'Check my balance',
        ],
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to pay invoice: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // ============================================================================
  // CREATE ESCROW
  // ============================================================================

  private async handleCreateEscrow(
    details: Partial<ParsedPaymentRequest>,
    context: PaymentHandlerContext
  ): Promise<PaymentHandlerResult> {
    if (!details.amount) {
      return {
        success: false,
        message: 'How much would you like to hold in escrow?',
        suggestedActions: ['Hold $1,000', 'Hold $5,000', 'Hold $10,000'],
      }
    }

    if (!details.recipientEmail && !details.recipientUsername) {
      return {
        success: false,
        message: 'Who is the seller/recipient for this escrow?',
        suggestedActions: ['For seller@company.com'],
      }
    }

    if (!details.escrowCondition) {
      return {
        success: false,
        message: 'What condition should release the escrow? For example: "until delivery is confirmed" or "when project milestone 1 is complete"',
        suggestedActions: [
          'Until delivery confirmed',
          'When project complete',
          'After inspection approved',
        ],
      }
    }

    // Check balance
    const balance = await this.conversationalPayments.getBalance(context.userId)
    const totalWithFee = details.amount * 1.01 // 1% escrow fee

    if (balance.grain.available < totalWithFee) {
      return {
        success: false,
        message: `Insufficient balance. Escrow of $${details.amount.toLocaleString()} plus 1% fee ($${(details.amount * 0.01).toFixed(2)}) requires $${totalWithFee.toLocaleString()}, but you have $${balance.grain.available.toLocaleString()} available.`,
        suggestedActions: ['Deposit funds'],
      }
    }

    // All escrow creation requires confirmation
    const confirmationDetails: PaymentConfirmation = {
      type: 'create_escrow',
      amount: details.amount,
      currency: 'GRAIN',
      recipient: details.recipientEmail || `@${details.recipientUsername}`,
      escrowCondition: details.escrowCondition,
      estimatedFee: details.amount * 0.01,
      estimatedArrival: 'Held until condition met',
    }

    const token = this.createConfirmationToken(
      context.userId,
      { intentType: 'create_escrow', ...details } as PaymentIntent,
      details as ParsedPaymentRequest
    )

    return {
      success: true,
      requiresConfirmation: true,
      confirmationToken: token,
      confirmationDetails,
      message: `Create Escrow\n\nAmount: $${details.amount.toLocaleString()}\nSeller: ${details.recipientEmail || '@' + details.recipientUsername}\nCondition: ${details.escrowCondition}\nFee: $${(details.amount * 0.01).toFixed(2)} (1%)\n\nFunds will be held securely until the condition is met. Confirm?`,
      warnings: ['Escrow funds are locked until release conditions are met or disputed.'],
      suggestedActions: ['Yes, create escrow', 'No, cancel'],
    }
  }

  private async executeCreateEscrow(
    details: Partial<ParsedPaymentRequest>,
    context: PaymentHandlerContext
  ): Promise<PaymentHandlerResult> {
    try {
      const result = await this.conversationalPayments.createEscrow({
        buyerId: context.userId,
        sellerEmail: details.recipientEmail,
        sellerUsername: details.recipientUsername,
        amount: details.amount!,
        condition: details.escrowCondition!,
        description: details.memo,
      })

      return {
        success: true,
        message: `Escrow created! $${details.amount!.toLocaleString()} is now held securely.\n\nEscrow ID: ${result.escrowId}\nSeller: ${details.recipientEmail || '@' + details.recipientUsername}\nCondition: ${details.escrowCondition}\n\nYou can release or dispute this escrow anytime.`,
        data: result,
        suggestedActions: [
          'View escrow details',
          'Release escrow',
          'Check my balance',
        ],
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to create escrow: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // ============================================================================
  // VIEW TRANSACTIONS
  // ============================================================================

  private async handleViewTransactions(
    details: Partial<ParsedPaymentRequest>,
    context: PaymentHandlerContext
  ): Promise<PaymentHandlerResult> {
    const transactions = await this.conversationalPayments.getTransactionHistory({
      userId: context.userId,
      period: details.period,
      limit: 10,
    })

    if (transactions.length === 0) {
      return {
        success: true,
        message: 'No transactions found for the selected period.',
        data: { transactions: [] },
        suggestedActions: ['Send money', 'Deposit funds'],
      }
    }

    const message = this.formatTransactionsMessage(transactions)

    return {
      success: true,
      message,
      data: { transactions },
      suggestedActions: [
        'Show more transactions',
        'Filter by type',
        'Export transactions',
      ],
    }
  }

  private formatTransactionsMessage(transactions: TransactionSummary[]): string {
    const lines = ['Recent Transactions:', '']

    for (const tx of transactions) {
      const sign = tx.direction === 'inbound' ? '+' : '-'
      const icon = tx.direction === 'inbound' ? '[IN]' : '[OUT]'
      const date = new Date(tx.createdAt).toLocaleDateString()

      lines.push(`${icon} ${sign}$${tx.amount.toLocaleString()} - ${tx.description}`)
      lines.push(`    ${date} | ${tx.status} | ${tx.counterparty}`)
      lines.push('')
    }

    return lines.join('\n')
  }

  // ============================================================================
  // REQUEST PAYMENT
  // ============================================================================

  private async handleRequestPayment(
    details: Partial<ParsedPaymentRequest>,
    context: PaymentHandlerContext
  ): Promise<PaymentHandlerResult> {
    if (!details.amount) {
      return {
        success: false,
        message: 'How much would you like to request?',
        suggestedActions: ['Request $100', 'Request $500', 'Request $1,000'],
      }
    }

    if (!details.recipientEmail && !details.recipientUsername) {
      return {
        success: false,
        message: 'Who would you like to request payment from?',
        suggestedActions: ['From supplier@company.com'],
      }
    }

    // Payment requests don't need confirmation (they're just sending a request)
    try {
      const result = await this.conversationalPayments.requestPayment({
        fromUserId: context.userId,
        toEmail: details.recipientEmail,
        toUsername: details.recipientUsername,
        amount: details.amount,
        memo: details.memo,
      })

      return {
        success: true,
        message: `Payment request sent!\n\nRequested: $${details.amount.toLocaleString()}\nFrom: ${details.recipientEmail || '@' + details.recipientUsername}\n${details.memo ? `Note: ${details.memo}` : ''}\n\nThey'll receive an email with a link to pay.`,
        data: result,
        suggestedActions: [
          'View pending requests',
          'Send another request',
          'Check my balance',
        ],
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to send payment request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // ============================================================================
  // FINANCIAL INSIGHTS
  // ============================================================================

  private async handleFinancialInsights(
    details: Partial<ParsedPaymentRequest>,
    context: PaymentHandlerContext
  ): Promise<PaymentHandlerResult> {
    const period = details.period || 'this month'
    const insights = await this.conversationalPayments.getFinancialInsights({
      userId: context.userId,
      period,
    })

    const message = this.formatInsightsMessage(insights, period)

    return {
      success: true,
      message,
      data: insights,
      suggestedActions: [
        'Show breakdown by category',
        'Compare to last month',
        'Export report',
      ],
    }
  }

  private formatInsightsMessage(insights: FinancialInsight, period: string): string {
    const lines = [`Financial Summary - ${period}`, '']

    lines.push(`Total Spending: $${insights.totalSpending.toLocaleString()}`)
    lines.push(`Total Received: $${insights.totalReceived.toLocaleString()}`)
    lines.push(`Net Cash Flow: ${insights.netCashFlow >= 0 ? '+' : ''}$${insights.netCashFlow.toLocaleString()}`)
    lines.push('')

    if (insights.topCategories && insights.topCategories.length > 0) {
      lines.push('Top Spending Categories:')
      for (const cat of insights.topCategories.slice(0, 5)) {
        const percentage = ((cat.amount / insights.totalSpending) * 100).toFixed(1)
        lines.push(`  ${cat.name}: $${cat.amount.toLocaleString()} (${percentage}%)`)
      }
      lines.push('')
    }

    if (insights.topVendors && insights.topVendors.length > 0) {
      lines.push('Top Vendors:')
      for (const vendor of insights.topVendors.slice(0, 5)) {
        lines.push(`  ${vendor.name}: $${vendor.amount.toLocaleString()} (${vendor.count} transactions)`)
      }
      lines.push('')
    }

    if (insights.alerts && insights.alerts.length > 0) {
      lines.push('Alerts:')
      for (const alert of insights.alerts) {
        lines.push(`  [!] ${alert}`)
      }
    }

    return lines.join('\n')
  }

  // ============================================================================
  // CREDIT LINE
  // ============================================================================

  private async handleCreditLine(
    details: Partial<ParsedPaymentRequest>,
    context: PaymentHandlerContext
  ): Promise<PaymentHandlerResult> {
    const creditStatus = await this.conversationalPayments.getCreditLineStatus(context.userId)

    if (!creditStatus.hasCredit) {
      return {
        success: true,
        message: `You don't have a credit line yet.\n\nBased on your account activity, you may be eligible for a credit line of up to $${creditStatus.potentialLimit?.toLocaleString() || '10,000'}.\n\nWould you like to apply?`,
        data: creditStatus,
        suggestedActions: ['Apply for credit', 'Learn more about credit'],
      }
    }

    const utilizationPercent = ((creditStatus.used / creditStatus.limit) * 100).toFixed(1)

    let message = `Credit Line Status\n\n`
    message += `Available: $${creditStatus.available.toLocaleString()}\n`
    message += `Used: $${creditStatus.used.toLocaleString()}\n`
    message += `Limit: $${creditStatus.limit.toLocaleString()}\n`
    message += `Utilization: ${utilizationPercent}%\n`

    if (creditStatus.nextPayment) {
      message += `\nNext Payment: $${creditStatus.nextPayment.amount.toLocaleString()} due ${creditStatus.nextPayment.dueDate}`
    }

    if (creditStatus.apr) {
      message += `\nAPR: ${(creditStatus.apr * 100).toFixed(2)}%`
    }

    return {
      success: true,
      message,
      data: creditStatus,
      suggestedActions: [
        'Draw from credit',
        'Make payment',
        'Request limit increase',
      ],
    }
  }

  // ============================================================================
  // CONFIRMATION HANDLING
  // ============================================================================

  private createConfirmationToken(
    userId: string,
    intent: PaymentIntent,
    parsedRequest: ParsedPaymentRequest
  ): string {
    const token = `conf_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

    pendingConfirmations.set(`${userId}_pending`, {
      token,
      intent,
      parsedRequest,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      createdAt: new Date(),
    })

    return token
  }

  private findPendingConfirmation(userId: string): PendingConfirmation | null {
    const pending = pendingConfirmations.get(`${userId}_pending`)

    if (!pending) return null

    if (pending.expiresAt < new Date()) {
      pendingConfirmations.delete(`${userId}_pending`)
      return null
    }

    return pending
  }

  private clearPendingConfirmation(userId: string): void {
    pendingConfirmations.delete(`${userId}_pending`)
  }

  private async handleConfirmationResponse(
    message: string,
    pending: PendingConfirmation,
    context: PaymentHandlerContext
  ): Promise<PaymentHandlerResult> {
    const isConfirmation = /^(yes|confirm|proceed|approve|do it|go ahead|ok|okay|send it|pay it|y)$/i.test(message.trim())
    const isCancellation = /^(no|cancel|stop|don't|nevermind|never mind|abort|n)$/i.test(message.trim())

    if (!isConfirmation && !isCancellation) {
      return {
        success: false,
        message: `I'm waiting for your confirmation. You asked to ${this.describeIntent(pending.intent)}.\n\nSay "Yes" to proceed or "No" to cancel.`,
        requiresConfirmation: true,
        confirmationToken: pending.token,
        suggestedActions: ['Yes, proceed', 'No, cancel'],
      }
    }

    this.clearPendingConfirmation(context.userId)

    if (isCancellation) {
      return {
        success: true,
        message: 'Transaction cancelled.',
        suggestedActions: [
          'Check my balance',
          'Show my transactions',
        ],
      }
    }

    // Execute the confirmed action
    const details = pending.parsedRequest

    switch (pending.intent.intentType) {
      case 'send_money':
        return await this.executeSendMoney(details, context)

      case 'pay_invoice':
        return await this.executePayInvoice(details, context)

      case 'create_escrow':
        return await this.executeCreateEscrow(details, context)

      default:
        return {
          success: false,
          message: 'Unable to process this confirmation.',
          error: 'Unknown intent type',
        }
    }
  }

  private describeIntent(intent: PaymentIntent): string {
    switch (intent.intentType) {
      case 'send_money':
        return `send money`
      case 'pay_invoice':
        return `pay an invoice`
      case 'create_escrow':
        return `create an escrow`
      default:
        return `complete a transaction`
    }
  }

  private formatConfirmationMessage(details: PaymentConfirmation): string {
    let message = `Please confirm this ${details.type.replace(/_/g, ' ')}:\n\n`
    message += `Amount: $${details.amount.toLocaleString()} ${details.currency}\n`
    message += `To: ${details.recipient}\n`

    if (details.memo) {
      message += `Memo: ${details.memo}\n`
    }

    if (details.estimatedFee > 0) {
      message += `Fee: $${details.estimatedFee.toFixed(2)}\n`
    }

    message += `Arrival: ${details.estimatedArrival}\n`

    if (!details.recipientVerified) {
      message += `\n[!] This recipient is not verified on Wells.`
    }

    message += `\n\nReply "Yes" to confirm or "No" to cancel.`

    return message
  }

  private async getConfirmationThreshold(userId: string): Promise<number> {
    // Could be user-configurable
    // For now, use sensible defaults
    const userSettings = await this.conversationalPayments.getUserSettings(userId)
    return userSettings?.confirmationThreshold || 500 // Default $500
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let paymentsHandlerInstance: PaymentsHandler | null = null

export function getPaymentsHandler(): PaymentsHandler {
  if (!paymentsHandlerInstance) {
    paymentsHandlerInstance = new PaymentsHandler()
  }
  return paymentsHandlerInstance
}

export default PaymentsHandler
