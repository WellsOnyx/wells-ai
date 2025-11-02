/**
 * Wells AI Transaction Engine
 *
 * The core infrastructure for B2B commerce transactions.
 * Handles discovery → matching → escrow → completion.
 *
 * Payment Provider: Airwallex (2.8% domestic, 4.3% international)
 */

import { prisma } from '@/lib/prisma'
import * as airwallex from '@/lib/airwallex'
import { TransactionStatus as PrismaTransactionStatus } from '@prisma/client'

// Map lowercase status to Prisma enum
const statusToPrisma = (status: string): PrismaTransactionStatus => {
  return status.toUpperCase().replace(/-/g, '_') as PrismaTransactionStatus
}

// Map Prisma enum to lowercase status
const statusFromPrisma = (status: PrismaTransactionStatus): string => {
  return status.toLowerCase().replace(/_/g, '-')
}

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

  // Create transaction in database
  const dbTransaction = await prisma.transaction.create({
    data: {
      rfqId: params.rfqId,
      buyerId: params.buyerId,
      sellerId: params.sellerId,
      status: statusToPrisma('accepted'),
      amount: params.amount,
      wellsFee,
      wellsFeePercent: feePercent,
      events: {
        create: {
          action: 'transaction_created',
          actor: 'system',
          metadata: { amount: params.amount }
        }
      }
    },
    include: {
      events: true
    }
  })

  // Convert to Transaction interface
  return {
    id: dbTransaction.id,
    rfqId: dbTransaction.rfqId,
    buyerId: dbTransaction.buyerId,
    sellerId: dbTransaction.sellerId,
    status: statusFromPrisma(dbTransaction.status) as TransactionStatus,
    amount: dbTransaction.amount,
    wellsFee: dbTransaction.wellsFee,
    wellsFeePercent: dbTransaction.wellsFeePercent,
    airwallexPaymentIntentId: dbTransaction.airwallexPaymentIntentId || undefined,
    airwallexClientSecret: dbTransaction.airwallexClientSecret || undefined,
    escrowedAt: dbTransaction.escrowedAt || undefined,
    releasedAt: dbTransaction.releasedAt || undefined,
    buyerRating: dbTransaction.buyerRating || undefined,
    sellerRating: dbTransaction.sellerRating || undefined,
    buyerReview: dbTransaction.buyerReview || undefined,
    sellerReview: dbTransaction.sellerReview || undefined,
    createdAt: dbTransaction.createdAt,
    updatedAt: dbTransaction.updatedAt,
    completedAt: dbTransaction.completedAt || undefined,
    events: dbTransaction.events.map(e => ({
      timestamp: e.createdAt,
      action: e.action,
      actor: e.actor as 'buyer' | 'seller' | 'system',
      metadata: e.metadata as Record<string, any> || undefined
    }))
  }
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

    // Update transaction in database with payment intent ID
    await prisma.transaction.update({
      where: { id: params.transactionId },
      data: {
        status: statusToPrisma('escrowed'),
        airwallexPaymentIntentId: result.paymentIntentId,
        airwallexClientSecret: result.clientSecret,
        escrowedAt: new Date(),
        events: {
          create: {
            action: 'payment_escrowed',
            actor: 'system',
            metadata: {
              paymentIntentId: result.paymentIntentId,
              amount: params.amount
            }
          }
        }
      }
    })

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

    // Update transaction status in database
    await prisma.transaction.update({
      where: { id: params.transactionId },
      data: {
        status: statusToPrisma('released'),
        releasedAt: new Date(),
        completedAt: new Date(),
        events: {
          create: {
            action: 'funds_released',
            actor: 'system',
            metadata: {
              paymentIntentId: params.paymentIntentId
            }
          }
        }
      }
    })

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
  // 1. Update transaction with ratings
  const dbTransaction = await prisma.transaction.update({
    where: { id: params.transactionId },
    data: {
      status: statusToPrisma('completed'),
      completedAt: new Date(),
      buyerRating: params.buyerRating,
      sellerRating: params.sellerRating,
      buyerReview: params.buyerReview,
      sellerReview: params.sellerReview,
      events: {
        create: {
          action: 'transaction_completed',
          actor: 'system',
          metadata: {
            buyerRating: params.buyerRating,
            sellerRating: params.sellerRating
          }
        }
      }
    },
    include: {
      events: true
    }
  })

  // 2. Update trust scores for both parties
  const transaction = await prisma.transaction.findUnique({
    where: { id: params.transactionId }
  })

  if (transaction) {
    // Update buyer trust score
    await updateUserTrustScore(transaction.buyerId, params.sellerRating)

    // Update seller trust score
    await updateUserTrustScore(transaction.sellerId, params.buyerRating)
  }

  // 3. Convert and return
  return {
    id: dbTransaction.id,
    rfqId: dbTransaction.rfqId,
    buyerId: dbTransaction.buyerId,
    sellerId: dbTransaction.sellerId,
    status: statusFromPrisma(dbTransaction.status) as TransactionStatus,
    amount: dbTransaction.amount,
    wellsFee: dbTransaction.wellsFee,
    wellsFeePercent: dbTransaction.wellsFeePercent,
    airwallexPaymentIntentId: dbTransaction.airwallexPaymentIntentId || undefined,
    airwallexClientSecret: dbTransaction.airwallexClientSecret || undefined,
    escrowedAt: dbTransaction.escrowedAt || undefined,
    releasedAt: dbTransaction.releasedAt || undefined,
    buyerRating: dbTransaction.buyerRating || undefined,
    sellerRating: dbTransaction.sellerRating || undefined,
    buyerReview: dbTransaction.buyerReview || undefined,
    sellerReview: dbTransaction.sellerReview || undefined,
    createdAt: dbTransaction.createdAt,
    updatedAt: dbTransaction.updatedAt,
    completedAt: dbTransaction.completedAt || undefined,
    events: dbTransaction.events.map(e => ({
      timestamp: e.createdAt,
      action: e.action,
      actor: e.actor as 'buyer' | 'seller' | 'system',
      metadata: e.metadata as Record<string, any> || undefined
    }))
  }
}

/**
 * Update user trust score based on new rating
 */
async function updateUserTrustScore(userId: string, newRating: number): Promise<void> {
  const trustScore = await prisma.userTrustScore.upsert({
    where: { userId },
    create: {
      userId,
      score: 50, // Default score
      totalRatings: 1,
      averageRating: newRating
    },
    update: {
      totalRatings: { increment: 1 }
    }
  })

  // Recalculate average rating
  const allTransactions = await prisma.transaction.findMany({
    where: {
      OR: [
        { buyerId: userId, sellerRating: { not: null } },
        { sellerId: userId, buyerRating: { not: null } }
      ]
    }
  })

  const ratings = allTransactions.map(t =>
    t.buyerId === userId ? t.sellerRating! : t.buyerRating!
  ).filter(r => r !== null)

  const avgRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
    : 0

  const completedDeals = allTransactions.filter(t =>
    t.status === statusToPrisma('completed') ||
    t.status === statusToPrisma('released')
  ).length

  const cancelledDeals = allTransactions.filter(t =>
    t.status === statusToPrisma('cancelled')
  ).length

  const disputedDeals = allTransactions.filter(t =>
    t.status === statusToPrisma('disputed')
  ).length

  const totalTransactions = allTransactions.length
  const completionRate = totalTransactions > 0
    ? (completedDeals / totalTransactions) * 100
    : 0

  // Calculate trust score (0-100)
  // Factors: avg rating (40%), completion rate (30%), volume (20%), dispute rate (10%)
  const ratingScore = (avgRating / 5) * 40
  const completionScore = (completionRate / 100) * 30
  const volumeScore = Math.min(completedDeals / 50, 1) * 20 // 50 deals = max volume score
  const disputeScore = Math.max(0, (1 - (disputedDeals / Math.max(totalTransactions, 1))) * 10)

  const calculatedScore = Math.round(ratingScore + completionScore + volumeScore + disputeScore)

  // Update trust score
  await prisma.userTrustScore.update({
    where: { userId },
    data: {
      score: calculatedScore,
      averageRating: avgRating,
      totalRatings: ratings.length,
      totalTransactions,
      completedDeals,
      cancelledDeals,
      disputedDeals,
      completionRate
    }
  })
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
  // Get or create trust score record
  const trustScore = await prisma.userTrustScore.findUnique({
    where: { userId: sellerId }
  })

  if (!trustScore) {
    // No trust score yet, return defaults
    return {
      score: 50,
      totalTransactions: 0,
      averageRating: 0,
      completionRate: 0,
      averageDealSize: 0
    }
  }

  // Calculate average deal size
  const transactions = await prisma.transaction.findMany({
    where: {
      OR: [
        { sellerId },
        { buyerId: sellerId }
      ]
    }
  })

  const totalGMV = transactions.reduce((sum, t) => sum + t.amount, 0)
  const averageDealSize = transactions.length > 0
    ? Math.round(totalGMV / transactions.length)
    : 0

  return {
    score: trustScore.score,
    totalTransactions: trustScore.totalTransactions,
    averageRating: trustScore.averageRating,
    completionRate: trustScore.completionRate,
    averageDealSize
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
