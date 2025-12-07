/**
 * Wells Onyx Fee Service
 *
 * Handles fee capture, tracking, and invoice generation.
 * Integrates with Circle SDK for actual payment transfers.
 */

import { sql } from '@vercel/postgres'
import { TransactionEngine } from '@/lib/transactions'
import { calculateFee, calculateEscrowSplit, type FeeTier } from './fee-calculator'

export interface FeeRecord {
  id: string
  dealId: string
  userId: string
  dealAmount: number
  tier: FeeTier
  feePercent: number
  feeAmount: number
  status: 'pending' | 'captured' | 'failed' | 'refunded'
  circleTransferId?: string
  invoiceId?: string
  createdAt: Date
  capturedAt?: Date
  metadata?: Record<string, any>
}

export interface FeeHistoryItem {
  id: string
  dealId: string
  dealDescription: string
  dealAmount: number
  feeAmount: number
  tier: FeeTier
  status: string
  capturedAt: Date
  invoiceId?: string
}

/**
 * Capture fee when escrow is released
 *
 * This is called during the escrow release process.
 * The fee is deducted from the escrow wallet before releasing to seller.
 *
 * Flow:
 * 1. Calculate fee split (seller amount + fee amount)
 * 2. Transfer fee to Wells treasury wallet
 * 3. Transfer remaining amount to seller
 * 4. Record fee capture in database
 *
 * @param dealId - The deal ID
 * @param amount - Total escrow amount
 * @param escrowWalletId - Circle wallet ID for escrow
 * @param sellerWalletAddress - Seller's wallet address
 * @param tier - Fee tier for this deal
 * @returns Fee capture result with transfer IDs
 */
export async function captureFee(
  dealId: string,
  amount: number,
  escrowWalletId: string,
  sellerWalletAddress: string,
  tier: FeeTier = 'standard'
): Promise<{
  success: boolean
  feeId: string
  feeAmount: number
  sellerAmount: number
  feeTransferId?: string
  sellerTransferId?: string
  error?: string
}> {
  try {
    // Calculate fee split
    const split = calculateEscrowSplit(amount, tier)
    const calculation = calculateFee(amount, tier)

    // Get Wells treasury wallet address
    const wellsTreasuryWallet = process.env.WELLS_TREASURY_WALLET_ADDRESS

    if (!wellsTreasuryWallet) {
      throw new Error('Wells treasury wallet address not configured')
    }

    // Generate fee ID
    const feeId = `fee_${dealId}_${Date.now()}`

    // Create fee record in database (pending status)
    await sql`
      INSERT INTO fees (
        id,
        deal_id,
        deal_amount,
        tier,
        fee_percent,
        fee_amount,
        status,
        created_at
      ) VALUES (
        ${feeId},
        ${dealId},
        ${amount},
        ${tier},
        ${calculation.feePercent},
        ${split.feeAmount},
        'pending',
        NOW()
      )
    `

    let feeTransferId: string | undefined
    let sellerTransferId: string | undefined

    try {
      // Transfer fee to Wells treasury
      feeTransferId = await TransactionEngine.transferGrain(
        escrowWalletId,
        wellsTreasuryWallet,
        split.feeAmount,
        { dealId, type: 'fee' }
      )

      // Transfer remaining amount to seller
      sellerTransferId = await TransactionEngine.transferGrain(
        escrowWalletId,
        sellerWalletAddress,
        split.sellerAmount,
        { dealId, type: 'release' }
      )

      // Update fee record to captured status
      await sql`
        UPDATE fees
        SET
          status = 'captured',
          circle_transfer_id = ${feeTransferId},
          captured_at = NOW()
        WHERE id = ${feeId}
      `

      // Record treasury transaction for the fee
      await sql`
        INSERT INTO treasury_transactions (
          id,
          user_id,
          circle_transfer_id,
          transaction_type,
          amount,
          currency,
          status,
          recipient_wallet,
          description,
          metadata,
          created_at,
          updated_at
        ) VALUES (
          ${`tx_fee_${dealId}_${Date.now()}`},
          'wells_treasury',
          ${feeTransferId},
          'fee_collection',
          ${split.feeAmount},
          'GRAIN',
          'succeeded',
          ${wellsTreasuryWallet},
          ${`Success fee collected for deal ${dealId}`},
          ${JSON.stringify({ dealId, tier, feePercent: calculation.feePercent })},
          NOW(),
          NOW()
        )
      `

      return {
        success: true,
        feeId,
        feeAmount: split.feeAmount,
        sellerAmount: split.sellerAmount,
        feeTransferId,
        sellerTransferId,
      }
    } catch (transferError) {
      // Mark fee as failed
      await sql`
        UPDATE fees
        SET status = 'failed'
        WHERE id = ${feeId}
      `

      throw transferError
    }
  } catch (error) {
    console.error('Error capturing fee:', error)
    return {
      success: false,
      feeId: '',
      feeAmount: 0,
      sellerAmount: amount,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get fee history for a user
 *
 * @param userId - User ID (can be buyer or seller)
 * @param limit - Maximum number of records to return
 * @returns List of fees paid/collected
 */
export async function getFeeHistory(
  userId: string,
  limit: number = 50
): Promise<FeeHistoryItem[]> {
  try {
    const result = await sql`
      SELECT
        f.id,
        f.deal_id as "dealId",
        d.description as "dealDescription",
        f.deal_amount as "dealAmount",
        f.fee_amount as "feeAmount",
        f.tier,
        f.status,
        f.captured_at as "capturedAt",
        f.invoice_id as "invoiceId"
      FROM fees f
      INNER JOIN deals d ON f.deal_id = d.id
      WHERE d.buyer_id = ${userId} OR d.seller_id = ${userId}
      ORDER BY f.captured_at DESC NULLS LAST, f.created_at DESC
      LIMIT ${limit}
    `

    return result.rows.map(row => ({
      id: row.id,
      dealId: row.dealId,
      dealDescription: row.dealDescription || 'No description',
      dealAmount: parseFloat(row.dealAmount),
      feeAmount: parseFloat(row.feeAmount),
      tier: row.tier,
      status: row.status,
      capturedAt: new Date(row.capturedAt || row.createdAt),
      invoiceId: row.invoiceId,
    }))
  } catch (error) {
    console.error('Error fetching fee history:', error)
    return []
  }
}

/**
 * Get fee record by deal ID
 */
export async function getFeeByDealId(dealId: string): Promise<FeeRecord | null> {
  try {
    const result = await sql`
      SELECT
        id,
        deal_id as "dealId",
        user_id as "userId",
        deal_amount as "dealAmount",
        tier,
        fee_percent as "feePercent",
        fee_amount as "feeAmount",
        status,
        circle_transfer_id as "circleTransferId",
        invoice_id as "invoiceId",
        created_at as "createdAt",
        captured_at as "capturedAt",
        metadata
      FROM fees
      WHERE deal_id = ${dealId}
      LIMIT 1
    `

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    return {
      id: row.id,
      dealId: row.dealId,
      userId: row.userId,
      dealAmount: parseFloat(row.dealAmount),
      tier: row.tier,
      feePercent: parseFloat(row.feePercent),
      feeAmount: parseFloat(row.feeAmount),
      status: row.status,
      circleTransferId: row.circleTransferId,
      invoiceId: row.invoiceId,
      createdAt: new Date(row.createdAt),
      capturedAt: row.capturedAt ? new Date(row.capturedAt) : undefined,
      metadata: row.metadata,
    }
  } catch (error) {
    console.error('Error fetching fee:', error)
    return null
  }
}

/**
 * Generate invoice for a captured fee
 *
 * @param feeId - Fee record ID
 * @returns Invoice details
 */
export async function generateInvoice(feeId: string): Promise<{
  success: boolean
  invoiceId?: string
  invoiceUrl?: string
  error?: string
}> {
  try {
    // Get fee record
    const feeResult = await sql`
      SELECT
        f.id,
        f.deal_id as "dealId",
        f.deal_amount as "dealAmount",
        f.fee_amount as "feeAmount",
        f.tier,
        f.fee_percent as "feePercent",
        f.captured_at as "capturedAt",
        d.buyer_id as "buyerId",
        d.seller_id as "sellerId",
        d.description as "dealDescription"
      FROM fees f
      INNER JOIN deals d ON f.deal_id = d.id
      WHERE f.id = ${feeId}
      LIMIT 1
    `

    if (feeResult.rows.length === 0) {
      return { success: false, error: 'Fee not found' }
    }

    const fee = feeResult.rows[0]

    if (!fee.capturedAt) {
      return { success: false, error: 'Fee not yet captured' }
    }

    // Generate invoice ID
    const invoiceId = `inv_${feeId}_${Date.now()}`

    // Create invoice record
    await sql`
      INSERT INTO fee_invoices (
        id,
        fee_id,
        deal_id,
        amount,
        tier,
        fee_percent,
        issued_date,
        buyer_id,
        seller_id,
        deal_description,
        status,
        created_at
      ) VALUES (
        ${invoiceId},
        ${feeId},
        ${fee.dealId},
        ${fee.feeAmount},
        ${fee.tier},
        ${fee.feePercent},
        ${fee.capturedAt},
        ${fee.buyerId},
        ${fee.sellerId},
        ${fee.dealDescription},
        'issued',
        NOW()
      )
    `

    // Update fee record with invoice ID
    await sql`
      UPDATE fees
      SET invoice_id = ${invoiceId}
      WHERE id = ${feeId}
    `

    // Generate invoice URL (would integrate with PDF generator or invoice service)
    const invoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoiceId}`

    return {
      success: true,
      invoiceId,
      invoiceUrl,
    }
  } catch (error) {
    console.error('Error generating invoice:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get total fees collected
 *
 * @param timeframe - Days to look back (default: 30)
 * @returns Total fees collected and count
 */
export async function getFeeSummary(timeframe: number = 30): Promise<{
  totalFees: number
  feeCount: number
  averageFee: number
  byTier: Record<FeeTier, { count: number; total: number }>
}> {
  try {
    const result = await sql`
      SELECT
        COUNT(*) as count,
        SUM(fee_amount) as total,
        AVG(fee_amount) as average,
        tier
      FROM fees
      WHERE status = 'captured'
        AND captured_at >= NOW() - INTERVAL '${timeframe} days'
      GROUP BY tier
    `

    const byTier: Record<FeeTier, { count: number; total: number }> = {
      'standard': { count: 0, total: 0 },
      'white-glove': { count: 0, total: 0 },
      'complex': { count: 0, total: 0 },
    }

    let totalFees = 0
    let feeCount = 0

    result.rows.forEach(row => {
      const tier = row.tier as FeeTier
      const count = parseInt(row.count)
      const total = parseFloat(row.total)

      byTier[tier] = { count, total }
      totalFees += total
      feeCount += count
    })

    return {
      totalFees: Math.round(totalFees * 100) / 100,
      feeCount,
      averageFee: feeCount > 0 ? Math.round((totalFees / feeCount) * 100) / 100 : 0,
      byTier,
    }
  } catch (error) {
    console.error('Error fetching fee summary:', error)
    return {
      totalFees: 0,
      feeCount: 0,
      averageFee: 0,
      byTier: {
        'standard': { count: 0, total: 0 },
        'white-glove': { count: 0, total: 0 },
        'complex': { count: 0, total: 0 },
      },
    }
  }
}

export const FeeService = {
  captureFee,
  getFeeHistory,
  getFeeByDealId,
  generateInvoice,
  getFeeSummary,
}

export default FeeService
