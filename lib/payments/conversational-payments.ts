// @ts-nocheck
/**
 * Conversational Payments Business Logic
 *
 * Core business logic for processing payment requests from natural language.
 * Integrates with Circle (USDC), Stripe (fiat), and internal GRAIN system.
 *
 * DESIGN PRINCIPLES:
 * 1. Users think in dollars, system handles rails
 * 2. High-value transactions require explicit confirmation
 * 3. All operations are auditable
 * 4. Fail safely with clear error messages
 * 5. Security first - validate everything
 */

import { createClient } from '@supabase/supabase-js'
import * as PaymentService from './service'

// Dynamic import for escrow service to avoid circular dependency issues
const getEscrowService = async () => {
  try {
    return await import('@/lib/escrow/escrow-service')
  } catch {
    // Return mock if not available
    return {
      createEscrow: async (params: any) => ({
        id: `escrow_${Date.now()}`,
        status: 'created',
        ...params,
      }),
    }
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
)

// ============================================================================
// TYPES
// ============================================================================

export type PaymentIntentType =
  | 'check_balance'
  | 'send_money'
  | 'pay_invoice'
  | 'create_escrow'
  | 'view_transactions'
  | 'request_payment'
  | 'financial_insights'
  | 'credit_line'
  | 'confirm_payment'
  | 'cancel_payment'

export interface PaymentIntent {
  intentType: PaymentIntentType
  confidence: number
  rawMessage: string
  extractedEntities: Record<string, unknown>
}

export interface ParsedPaymentRequest {
  amount?: number
  currency?: 'USD' | 'USDC' | 'GRAIN'
  recipientEmail?: string
  recipientUsername?: string
  recipientWalletAddress?: string
  invoiceId?: string
  memo?: string
  period?: 'this week' | 'last week' | 'this month' | 'last month' | 'this quarter' | 'last quarter' | 'this year'
  escrowCondition?: string
  milestones?: Array<{
    title: string
    amount: number
    description?: string
  }>
}

export interface PaymentConfirmation {
  type: PaymentIntentType
  amount: number
  currency: string
  recipient: string
  recipientEmail?: string
  recipientVerified: boolean
  memo?: string
  invoiceId?: string
  invoiceDescription?: string
  invoiceDueDate?: string
  escrowCondition?: string
  estimatedFee: number
  estimatedArrival: string
}

export interface TransactionSummary {
  id: string
  type: 'payment' | 'deposit' | 'withdrawal' | 'escrow' | 'reward' | 'request'
  direction: 'inbound' | 'outbound'
  amount: number
  currency: string
  status: string
  counterparty: string
  description: string
  createdAt: Date
  completedAt?: Date
  metadata?: Record<string, unknown>
}

export interface FinancialInsight {
  totalSpending: number
  totalReceived: number
  netCashFlow: number
  transactionCount: number
  averageTransaction: number
  topCategories: Array<{ name: string; amount: number; count: number }>
  topVendors: Array<{ name: string; amount: number; count: number }>
  alerts: string[]
  comparison?: {
    previousPeriodSpending: number
    percentageChange: number
  }
}

export interface CreditLineStatus {
  hasCredit: boolean
  available: number
  used: number
  limit: number
  apr?: number
  nextPayment?: {
    amount: number
    dueDate: string
  }
  potentialLimit?: number
  eligibilityScore?: number
}

export interface UserBalance {
  grain: {
    available: number
    pending: number
    staked: number
    stakingApy: number
    total: number
  }
  usd: {
    deposited: number
    withdrawn: number
    net: number
  }
  yield: {
    earned: number
    pending: number
  }
  credit: {
    available: number
    used: number
    limit: number
  }
}

export interface RecipientInfo {
  id: string
  name: string
  email?: string
  username?: string
  walletAddress?: string
  verified: boolean
  trustScore?: number
  previousTransactions?: number
}

export interface Invoice {
  id: string
  vendor: string
  vendorEmail: string
  amount: number
  currency: string
  description: string
  dueDate: string
  status: 'pending' | 'paid' | 'overdue' | 'cancelled'
  createdAt: Date
  paidAt?: Date
}

export interface UserSettings {
  confirmationThreshold: number
  preferredCurrency: 'USD' | 'USDC' | 'GRAIN'
  autoStaking: boolean
  emailNotifications: boolean
  smsNotifications: boolean
}

// ============================================================================
// CONVERSATIONAL PAYMENTS CLASS
// ============================================================================

export class ConversationalPayments {
  // ==========================================================================
  // BALANCE OPERATIONS
  // ==========================================================================

  /**
   * Get comprehensive balance for a user
   */
  async getBalance(userId: string): Promise<UserBalance> {
    try {
      // Get unified balance from payment service
      const balance = await PaymentService.getBalance(userId)

      // Get staking info
      const { data: stakingData } = await supabase
        .from('grain_staking')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      const stakedAmount = stakingData?.amount || 0
      const stakingApy = stakingData?.apy || 3.5

      // Get credit line info
      const { data: creditData } = await supabase
        .from('credit_lines')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      return {
        grain: {
          available: balance.usdc.available,
          pending: balance.usdc.pending,
          staked: stakedAmount,
          stakingApy,
          total: balance.usdc.total + stakedAmount,
        },
        usd: {
          deposited: balance.usd.totalDeposited,
          withdrawn: balance.usd.totalWithdrawn,
          net: balance.usd.net,
        },
        yield: {
          earned: balance.yield.earned,
          pending: balance.yield.pending,
        },
        credit: {
          available: creditData?.available || 0,
          used: creditData?.used || 0,
          limit: creditData?.limit || 0,
        },
      }
    } catch (error) {
      console.error('[ConversationalPayments] getBalance error:', error)
      throw new Error('Failed to retrieve balance')
    }
  }

  // ==========================================================================
  // SEND MONEY
  // ==========================================================================

  /**
   * Send money to another user
   */
  async sendMoney(params: {
    fromUserId: string
    toEmail?: string
    toUsername?: string
    toWalletAddress?: string
    amount: number
    currency: string
    memo?: string
  }): Promise<{
    transactionId: string
    status: string
    recipient: string
    amount: number
    fee: number
    completedAt?: Date
  }> {
    const { fromUserId, toEmail, toUsername, toWalletAddress, amount, currency, memo } = params

    // Validate amount
    if (amount <= 0) {
      throw new Error('Amount must be greater than zero')
    }

    if (amount > 1000000) {
      throw new Error('Amount exceeds maximum transfer limit of $1,000,000')
    }

    // Resolve recipient
    let recipientAddress: string | undefined
    let recipientId: string | undefined
    let recipientName: string

    if (toEmail) {
      const recipient = await this.lookupRecipientByEmail(toEmail)
      if (recipient) {
        recipientId = recipient.id
        recipientAddress = recipient.walletAddress
        recipientName = recipient.name || toEmail
      } else {
        // Create pending transfer for non-registered user
        return await this.createPendingTransfer({
          fromUserId,
          toEmail,
          amount,
          currency,
          memo,
        })
      }
    } else if (toUsername) {
      const recipient = await this.lookupRecipientByUsername(toUsername)
      if (!recipient) {
        throw new Error(`User @${toUsername} not found`)
      }
      recipientId = recipient.id
      recipientAddress = recipient.walletAddress
      recipientName = recipient.name || `@${toUsername}`
    } else if (toWalletAddress) {
      recipientAddress = toWalletAddress
      recipientName = `${toWalletAddress.slice(0, 6)}...${toWalletAddress.slice(-4)}`
    } else {
      throw new Error('Recipient email, username, or wallet address required')
    }

    // Check balance
    const balance = await this.getBalance(fromUserId)
    if (balance.grain.available < amount) {
      throw new Error(`Insufficient balance. Available: $${balance.grain.available.toLocaleString()}`)
    }

    // Calculate fee
    const feeRate = 0.001 // 0.1%
    const fee = Math.max(amount * feeRate, 0.01)

    try {
      // Execute payment via payment service
      const result = await PaymentService.createPayment({
        fromUserId,
        toAddress: recipientAddress,
        amount,
        method: 'usdc',
        metadata: {
          paymentType: 'viral_payment',
          description: memo,
          recipientId,
        },
      })

      // Record transaction
      const transactionId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

      await supabase.from('payment_transactions').insert({
        id: transactionId,
        from_user_id: fromUserId,
        to_user_id: recipientId,
        to_email: toEmail,
        to_address: recipientAddress,
        amount,
        fee,
        currency,
        status: 'completed',
        memo,
        circle_payment_id: result.paymentId,
        transaction_hash: result.transactionHash,
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })

      return {
        transactionId,
        status: 'completed',
        recipient: recipientName,
        amount,
        fee,
        completedAt: new Date(),
      }
    } catch (error) {
      console.error('[ConversationalPayments] sendMoney error:', error)
      throw new Error(`Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create a pending transfer for non-registered users
   */
  private async createPendingTransfer(params: {
    fromUserId: string
    toEmail: string
    amount: number
    currency: string
    memo?: string
  }): Promise<{
    transactionId: string
    status: string
    recipient: string
    amount: number
    fee: number
  }> {
    const transactionId = `pending_tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    // Hold funds in escrow until recipient registers
    await supabase.from('pending_transfers').insert({
      id: transactionId,
      from_user_id: params.fromUserId,
      to_email: params.toEmail,
      amount: params.amount,
      currency: params.currency,
      memo: params.memo,
      status: 'pending_registration',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      created_at: new Date().toISOString(),
    })

    // TODO: Send email invitation to recipient

    return {
      transactionId,
      status: 'pending_registration',
      recipient: params.toEmail,
      amount: params.amount,
      fee: 0, // No fee for pending transfers
    }
  }

  // ==========================================================================
  // PAY INVOICE
  // ==========================================================================

  /**
   * Pay an invoice
   */
  async payInvoice(params: {
    userId: string
    invoiceId: string
  }): Promise<{
    transactionId: string
    invoiceId: string
    vendor: string
    amount: number
    status: string
  }> {
    const { userId, invoiceId } = params

    // Get invoice
    const invoice = await this.getInvoice(invoiceId)
    if (!invoice) {
      throw new Error(`Invoice #${invoiceId} not found`)
    }

    if (invoice.status === 'paid') {
      throw new Error(`Invoice #${invoiceId} has already been paid`)
    }

    // Check balance
    const balance = await this.getBalance(userId)
    if (balance.grain.available < invoice.amount) {
      throw new Error(`Insufficient balance for invoice. Need $${invoice.amount.toLocaleString()}, have $${balance.grain.available.toLocaleString()}`)
    }

    try {
      // Get vendor's wallet
      const { data: vendor } = await supabase
        .from('vendors')
        .select('wallet_address, user_id')
        .eq('email', invoice.vendorEmail)
        .single()

      // Execute payment
      const result = await PaymentService.createPayment({
        fromUserId: userId,
        toAddress: vendor?.wallet_address,
        amount: invoice.amount,
        method: 'usdc',
        metadata: {
          paymentType: 'erp_intercept',
          sourceId: invoiceId,
          description: `Payment for Invoice #${invoiceId}`,
        },
      })

      // Update invoice status
      await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_id: result.paymentId,
        })
        .eq('id', invoiceId)

      const transactionId = `inv_tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

      return {
        transactionId,
        invoiceId,
        vendor: invoice.vendor,
        amount: invoice.amount,
        status: 'paid',
      }
    } catch (error) {
      console.error('[ConversationalPayments] payInvoice error:', error)
      throw new Error(`Failed to pay invoice: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (error || !data) {
      return null
    }

    return {
      id: data.id,
      vendor: data.vendor_name,
      vendorEmail: data.vendor_email,
      amount: parseFloat(data.amount),
      currency: data.currency || 'USD',
      description: data.description,
      dueDate: data.due_date,
      status: data.status,
      createdAt: new Date(data.created_at),
      paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
    }
  }

  /**
   * Get unpaid invoices for a user
   */
  async getUnpaidInvoices(userId: string): Promise<Invoice[]> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('payer_user_id', userId)
      .in('status', ['pending', 'overdue'])
      .order('due_date', { ascending: true })
      .limit(20)

    if (error || !data) {
      return []
    }

    return data.map(inv => ({
      id: inv.id,
      vendor: inv.vendor_name,
      vendorEmail: inv.vendor_email,
      amount: parseFloat(inv.amount),
      currency: inv.currency || 'USD',
      description: inv.description,
      dueDate: inv.due_date,
      status: inv.status,
      createdAt: new Date(inv.created_at),
    }))
  }

  // ==========================================================================
  // ESCROW OPERATIONS
  // ==========================================================================

  /**
   * Create an escrow
   */
  async createEscrow(params: {
    buyerId: string
    sellerEmail?: string
    sellerUsername?: string
    amount: number
    condition: string
    description?: string
    milestones?: Array<{
      title: string
      amount: number
      description?: string
    }>
  }): Promise<{
    escrowId: string
    status: string
    amount: number
    fee: number
  }> {
    const { buyerId, sellerEmail, sellerUsername, amount, condition, description, milestones } = params

    // Resolve seller
    let sellerId: string | undefined
    let resolvedSellerEmail: string | undefined

    if (sellerEmail) {
      resolvedSellerEmail = sellerEmail
      const seller = await this.lookupRecipientByEmail(sellerEmail)
      if (seller) {
        sellerId = seller.id
      }
    } else if (sellerUsername) {
      const seller = await this.lookupRecipientByUsername(sellerUsername)
      if (!seller) {
        throw new Error(`User @${sellerUsername} not found`)
      }
      sellerId = seller.id
      resolvedSellerEmail = seller.email
    } else {
      throw new Error('Seller email or username required')
    }

    // Check balance
    const balance = await this.getBalance(buyerId)
    const fee = amount * 0.01 // 1% escrow fee
    const totalRequired = amount + fee

    if (balance.grain.available < totalRequired) {
      throw new Error(`Insufficient balance. Need $${totalRequired.toLocaleString()} (including 1% fee), have $${balance.grain.available.toLocaleString()}`)
    }

    // Get buyer info
    const { data: buyer } = await supabase
      .from('users')
      .select('email')
      .eq('id', buyerId)
      .single()

    try {
      // Create escrow via escrow service (dynamic import)
      const EscrowService = await getEscrowService()
      const escrow = await EscrowService.createEscrow({
        dealId: `deal_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        buyerId,
        buyerEmail: buyer?.email || '',
        sellerId: sellerId || '',
        sellerEmail: resolvedSellerEmail || '',
        amount,
        platformFee: fee,
        description: description || condition,
        milestones: milestones?.map((m, i) => ({
          title: m.title,
          amount: m.amount,
          description: m.description || '',
          dueDate: undefined,
          deliverables: [],
        })),
        metadata: {
          condition,
          createdViaChat: true,
        },
      })

      return {
        escrowId: escrow.id,
        status: escrow.status,
        amount,
        fee,
      }
    } catch (error) {
      console.error('[ConversationalPayments] createEscrow error:', error)
      throw new Error(`Failed to create escrow: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ==========================================================================
  // TRANSACTION HISTORY
  // ==========================================================================

  /**
   * Get transaction history
   */
  async getTransactionHistory(params: {
    userId: string
    period?: string
    type?: string
    limit?: number
    offset?: number
  }): Promise<TransactionSummary[]> {
    const { userId, period, type, limit = 10, offset = 0 } = params

    // Calculate date range based on period
    const now = new Date()
    let startDate: Date | undefined

    if (period) {
      switch (period) {
        case 'this week':
          startDate = new Date(now)
          startDate.setDate(now.getDate() - now.getDay())
          startDate.setHours(0, 0, 0, 0)
          break
        case 'last week':
          startDate = new Date(now)
          startDate.setDate(now.getDate() - now.getDay() - 7)
          const endOfLastWeek = new Date(startDate)
          endOfLastWeek.setDate(startDate.getDate() + 6)
          break
        case 'this month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'last month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          break
        case 'this quarter':
          const quarter = Math.floor(now.getMonth() / 3)
          startDate = new Date(now.getFullYear(), quarter * 3, 1)
          break
        case 'this year':
          startDate = new Date(now.getFullYear(), 0, 1)
          break
      }
    }

    // Get unified payment history
    const history = await PaymentService.getPaymentHistory(userId, limit + offset)

    // Transform to summary format
    const transactions: TransactionSummary[] = history
      .slice(offset, offset + limit)
      .map(tx => ({
        id: tx.id,
        type: tx.type as TransactionSummary['type'],
        direction: tx.type === 'deposit' || tx.type === 'reward' ? 'inbound' : 'outbound',
        amount: tx.amount,
        currency: tx.currency,
        status: tx.status,
        counterparty: tx.metadata?.recipient || tx.metadata?.vendor || 'Unknown',
        description: tx.description || `${tx.type} transaction`,
        createdAt: new Date(tx.createdAt),
        metadata: tx.metadata,
      }))

    // Filter by date range if specified
    if (startDate) {
      return transactions.filter(tx => tx.createdAt >= startDate!)
    }

    return transactions
  }

  // ==========================================================================
  // PAYMENT REQUESTS
  // ==========================================================================

  /**
   * Request payment from another user
   */
  async requestPayment(params: {
    fromUserId: string
    toEmail?: string
    toUsername?: string
    amount: number
    memo?: string
    dueDate?: string
  }): Promise<{
    requestId: string
    status: string
    amount: number
  }> {
    const { fromUserId, toEmail, toUsername, amount, memo, dueDate } = params

    if (!toEmail && !toUsername) {
      throw new Error('Recipient email or username required')
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    // Create payment request
    await supabase.from('payment_requests').insert({
      id: requestId,
      requester_user_id: fromUserId,
      payer_email: toEmail,
      payer_username: toUsername,
      amount,
      currency: 'GRAIN',
      memo,
      due_date: dueDate,
      status: 'pending',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    })

    // TODO: Send notification to payer (email/push)

    return {
      requestId,
      status: 'pending',
      amount,
    }
  }

  // ==========================================================================
  // FINANCIAL INSIGHTS
  // ==========================================================================

  /**
   * Get financial insights for a period
   */
  async getFinancialInsights(params: {
    userId: string
    period?: string
  }): Promise<FinancialInsight> {
    const { userId, period } = params

    // Get transaction history
    const transactions = await this.getTransactionHistory({
      userId,
      period,
      limit: 1000,
    })

    // Calculate totals
    const outbound = transactions.filter(tx => tx.direction === 'outbound')
    const inbound = transactions.filter(tx => tx.direction === 'inbound')

    const totalSpending = outbound.reduce((sum, tx) => sum + tx.amount, 0)
    const totalReceived = inbound.reduce((sum, tx) => sum + tx.amount, 0)

    // Group by category (using counterparty as proxy)
    const categoryMap = new Map<string, { amount: number; count: number }>()
    for (const tx of outbound) {
      const category = tx.metadata?.category as string || 'Uncategorized'
      const existing = categoryMap.get(category) || { amount: 0, count: 0 }
      categoryMap.set(category, {
        amount: existing.amount + tx.amount,
        count: existing.count + 1,
      })
    }

    // Group by vendor
    const vendorMap = new Map<string, { amount: number; count: number }>()
    for (const tx of outbound) {
      const vendor = tx.counterparty
      const existing = vendorMap.get(vendor) || { amount: 0, count: 0 }
      vendorMap.set(vendor, {
        amount: existing.amount + tx.amount,
        count: existing.count + 1,
      })
    }

    // Sort and convert to arrays
    const topCategories = Array.from(categoryMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)

    const topVendors = Array.from(vendorMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)

    // Generate alerts
    const alerts: string[] = []

    if (totalSpending > totalReceived * 1.5) {
      alerts.push('Spending is significantly higher than income this period.')
    }

    const largeTransactions = outbound.filter(tx => tx.amount > 1000)
    if (largeTransactions.length > 0) {
      alerts.push(`${largeTransactions.length} transaction(s) over $1,000 this period.`)
    }

    return {
      totalSpending,
      totalReceived,
      netCashFlow: totalReceived - totalSpending,
      transactionCount: transactions.length,
      averageTransaction: transactions.length > 0 ? totalSpending / outbound.length : 0,
      topCategories,
      topVendors,
      alerts,
    }
  }

  // ==========================================================================
  // CREDIT LINE
  // ==========================================================================

  /**
   * Get credit line status
   */
  async getCreditLineStatus(userId: string): Promise<CreditLineStatus> {
    const { data: creditLine } = await supabase
      .from('credit_lines')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    if (!creditLine) {
      // Check eligibility
      const eligibility = await this.calculateCreditEligibility(userId)

      return {
        hasCredit: false,
        available: 0,
        used: 0,
        limit: 0,
        potentialLimit: eligibility.potentialLimit,
        eligibilityScore: eligibility.score,
      }
    }

    // Get next payment info
    const { data: nextPayment } = await supabase
      .from('credit_payments')
      .select('amount, due_date')
      .eq('credit_line_id', creditLine.id)
      .eq('status', 'scheduled')
      .order('due_date', { ascending: true })
      .limit(1)
      .single()

    return {
      hasCredit: true,
      available: creditLine.available,
      used: creditLine.used,
      limit: creditLine.limit,
      apr: creditLine.apr,
      nextPayment: nextPayment
        ? {
            amount: nextPayment.amount,
            dueDate: nextPayment.due_date,
          }
        : undefined,
    }
  }

  private async calculateCreditEligibility(userId: string): Promise<{
    score: number
    potentialLimit: number
  }> {
    // Get user's transaction history
    const transactions = await this.getTransactionHistory({ userId, limit: 100 })

    // Calculate simple eligibility score (0-100)
    let score = 50 // Base score

    // More transactions = higher score
    score += Math.min(transactions.length / 10, 20)

    // Get account age
    const { data: user } = await supabase
      .from('users')
      .select('created_at')
      .eq('id', userId)
      .single()

    if (user) {
      const accountAgeMonths = (Date.now() - new Date(user.created_at).getTime()) / (30 * 24 * 60 * 60 * 1000)
      score += Math.min(accountAgeMonths * 2, 15)
    }

    // Check balance
    const balance = await this.getBalance(userId)
    if (balance.grain.total > 1000) {
      score += 15
    }

    // Calculate potential limit
    const potentialLimit = Math.min(score * 100, 50000)

    return { score: Math.min(score, 100), potentialLimit }
  }

  // ==========================================================================
  // RECIPIENT LOOKUP
  // ==========================================================================

  /**
   * Look up recipient by email or username
   */
  async lookupRecipient(identifier: string): Promise<RecipientInfo | null> {
    if (identifier.includes('@')) {
      return this.lookupRecipientByEmail(identifier)
    }
    return this.lookupRecipientByUsername(identifier.replace('@', ''))
  }

  async lookupRecipientByEmail(email: string): Promise<RecipientInfo | null> {
    const { data } = await supabase
      .from('users')
      .select('id, full_name, email, username, wallet_address, verified, trust_score')
      .eq('email', email)
      .single()

    if (!data) return null

    // Get previous transaction count
    const { count } = await supabase
      .from('payment_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('to_email', email)

    return {
      id: data.id,
      name: data.full_name || email,
      email: data.email,
      username: data.username,
      walletAddress: data.wallet_address,
      verified: data.verified || false,
      trustScore: data.trust_score,
      previousTransactions: count || 0,
    }
  }

  async lookupRecipientByUsername(username: string): Promise<RecipientInfo | null> {
    const { data } = await supabase
      .from('users')
      .select('id, full_name, email, username, wallet_address, verified, trust_score')
      .eq('username', username)
      .single()

    if (!data) return null

    return {
      id: data.id,
      name: data.full_name || `@${username}`,
      email: data.email,
      username: data.username,
      walletAddress: data.wallet_address,
      verified: data.verified || false,
      trustScore: data.trust_score,
    }
  }

  // ==========================================================================
  // USER SETTINGS
  // ==========================================================================

  /**
   * Get user settings
   */
  async getUserSettings(userId: string): Promise<UserSettings | null> {
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!data) {
      // Return defaults
      return {
        confirmationThreshold: 500,
        preferredCurrency: 'GRAIN',
        autoStaking: false,
        emailNotifications: true,
        smsNotifications: false,
      }
    }

    return {
      confirmationThreshold: data.confirmation_threshold || 500,
      preferredCurrency: data.preferred_currency || 'GRAIN',
      autoStaking: data.auto_staking || false,
      emailNotifications: data.email_notifications ?? true,
      smsNotifications: data.sms_notifications ?? false,
    }
  }

  /**
   * Update user settings
   */
  async updateUserSettings(
    userId: string,
    settings: Partial<UserSettings>
  ): Promise<UserSettings> {
    const updates: Record<string, unknown> = {}

    if (settings.confirmationThreshold !== undefined) {
      updates.confirmation_threshold = settings.confirmationThreshold
    }
    if (settings.preferredCurrency !== undefined) {
      updates.preferred_currency = settings.preferredCurrency
    }
    if (settings.autoStaking !== undefined) {
      updates.auto_staking = settings.autoStaking
    }
    if (settings.emailNotifications !== undefined) {
      updates.email_notifications = settings.emailNotifications
    }
    if (settings.smsNotifications !== undefined) {
      updates.sms_notifications = settings.smsNotifications
    }

    await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        ...updates,
        updated_at: new Date().toISOString(),
      })

    return (await this.getUserSettings(userId))!
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ConversationalPayments
