/**
 * Wells AI Transaction Engine
 *
 * The core infrastructure for B2B commerce transactions.
 * Handles discovery → matching → escrow → completion.
 *
 * Payment Provider: Airwallex (2.8% domestic, 4.3% international)
 */

import { prisma } from '@/lib/db'
import * as airwallex from '@/lib/airwallex'

export type TransactionStatus =
  | 'draft'           // RFQ created, finding matches
  | 'quoted'          // Suppliers sent quotes
  | 'accepted'        // Buyer accepted, escrow pending
  | 'escrowed'        // Funds in escrow
  | 'in_progress'     // Work happening
  | 'completed'       // Work done, awaiting release
  | 'released'        // Funds released, deal complete
  | 'disputed'        // Issue raised
  | 'cancelled'       // Deal cancelled

export interface Transaction {
  id: string
  rfqId: string
  buyerId: string
  sellerId: string
  status: TransactionStatus

  // Financial
  amount: number              // Deal value in cents
  wellsFee: number           // Our platform fee in cents
  wellsFeePercent: number    // Fee percentage (e.g., 2.5)

  // Escrow (Airwallex)
  airwallexPaymentIntentId?: string
  airwallexClientSecret?: string
  escrowedAt?: Date
  releasedAt?: Date

  // Trust
  buyerRating?: number       // 1-5 stars
  sellerRating?: number      // 1-5 stars
  buyerReview?: string
  sellerReview?: string

  // Metadata
  createdAt: Date
  updatedAt: Date
  completedAt?: Date

  // Audit trail
  events: TransactionEvent[]
}

export interface TransactionEvent {
  timestamp: Date
  action: string
  actor: 'buyer' | 'seller' | 'system'
  metadata?: Record<string, any>
}

/**
 * Create a new transaction from an RFQ + accepted quote
 */
export async function createTransaction(params: {
  rfqId: string
  buyerId: string
  sellerId: string
  amount: number
  wellsFeePercent?: number
}): Promise<Transaction> {
  const feePercent = params.wellsFeePercent || 2.5 // Default 2.5%
  const wellsFee = Math.round(params.amount * (feePercent / 100))

  // TODO: Create in database
  const transaction: Transaction = {
    id: `txn_${Date.now()}`,
    rfqId: params.rfqId,
    buyerId: params.buyerId,
    sellerId: params.sellerId,
    status: 'accepted',
    amount: params.amount,
    wellsFee,
    wellsFeePercent: feePercent,
    createdAt: new Date(),
    updatedAt: new Date(),
    events: [{
      timestamp: new Date(),
      action: 'transaction_created',
      actor: 'system',
      metadata: { amount: params.amount }
    }]
  }

  return transaction
}

/**
 * Create Airwallex escrow and hold funds
 *
 * Creates payment intent with automatic split settlement:
 * - Seller receives (amount - wellsFee)
 * - Wells platform receives wellsFee
 */
export async function createEscrow(params: {
  transactionId: string
  amount: number
  wellsFee: number
  sellerId: string
  metadata?: Record<string, string>
}): Promise<{
  success: boolean
  paymentIntentId?: string
  clientSecret?: string
  error?: string
}> {
  try {
    // Create Airwallex payment with split settlement
    const result = await airwallex.createPaymentIntent({
      amount: params.amount,
      wellsFee: params.wellsFee,
      sellerId: params.sellerId,
      metadata: {
        transactionId: params.transactionId,
        ...params.metadata
      }
    })

    if (!result.success) {
      return result
    }

    // TODO: Update transaction in database with payment intent ID
    // await prisma.transaction.update({
    //   where: { id: params.transactionId },
    //   data: {
    //     status: 'escrowed',
    //     airwallexPaymentIntentId: result.paymentIntentId,
    //     airwallexClientSecret: result.clientSecret,
    //     escrowedAt: new Date()
    //   }
    // })

    return result
  } catch (error: any) {
    console.error('[TRANSACTION] Escrow creation failed:', error)
    return {
      success: false,
      error: error.message || 'Failed to create escrow'
    }
  }
}

/**
 * Release escrow funds to seller (automatic with Airwallex)
 *
 * With Airwallex split settlements, funds are automatically distributed
 * when payment is confirmed. This marks the transaction as released.
 */
export async function releaseEscrow(params: {
  transactionId: string
  paymentIntentId: string
}): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // With Airwallex split_settlement, funds auto-distribute on confirmation
    const result = await airwallex.releaseEscrow(params.paymentIntentId)

    if (!result.success) {
      return result
    }

    // TODO: Update transaction status in database
    // await prisma.transaction.update({
    //   where: { id: params.transactionId },
    //   data: {
    //     status: 'released',
    //     releasedAt: new Date()
    //   }
    // })

    return { success: true }
  } catch (error: any) {
    console.error('[TRANSACTION] Escrow release failed:', error)
    return {
      success: false,
      error: error.message || 'Failed to release escrow'
    }
  }
}

/**
 * Complete transaction and update trust scores
 */
export async function completeTransaction(params: {
  transactionId: string
  buyerRating: number
  sellerRating: number
  buyerReview?: string
  sellerReview?: string
}): Promise<Transaction> {
  // TODO:
  // 1. Mark transaction complete
  // 2. Update buyer/seller reputation scores
  // 3. Trigger any post-transaction automations

  throw new Error('Not implemented')
}

/**
 * Calculate seller's trust score based on transaction history
 */
export async function calculateTrustScore(sellerId: string): Promise<{
  score: number              // 0-100
  totalTransactions: number
  averageRating: number      // 1-5 stars
  completionRate: number     // % of deals completed
  averageDealSize: number
}> {
  // TODO: Implement trust algorithm
  // Consider:
  // - Number of completed transactions
  // - Average rating from buyers
  // - Completion rate (accepted → completed)
  // - Dispute rate
  // - Deal size history

  return {
    score: 0,
    totalTransactions: 0,
    averageRating: 0,
    completionRate: 0,
    averageDealSize: 0
  }
}

/**
 * Get recommended platform fee based on deal characteristics
 */
export function calculatePlatformFee(params: {
  amount: number
  category: string
  buyerTrustScore?: number
  sellerTrustScore?: number
}): {
  feePercent: number
  feeAmount: number
  reasoning: string
} {
  let feePercent = 2.5 // Base fee

  // High-value deals = lower percentage
  if (params.amount > 100000000) { // $1M+
    feePercent = 1.5
  } else if (params.amount > 50000000) { // $500k+
    feePercent = 2.0
  }

  // High trust = lower fees (incentive)
  const avgTrust = ((params.buyerTrustScore || 50) + (params.sellerTrustScore || 50)) / 2
  if (avgTrust > 90) {
    feePercent -= 0.5
  }

  const feeAmount = Math.round(params.amount * (feePercent / 100))

  return {
    feePercent,
    feeAmount,
    reasoning: `${feePercent}% platform fee on $${(params.amount / 100).toLocaleString()} transaction`
  }
}
