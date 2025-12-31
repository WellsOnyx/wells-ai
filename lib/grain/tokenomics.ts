/**
 * GRAIN Tokenomics Engine
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * THE GRAIN VALUE MODEL
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Core Concept:
 * - Users deposit USD and receive GRAIN at current rate
 * - Treasury invests deposits in REAL ASSETS (commercial real estate, etc.)
 * - As assets appreciate, GRAIN's purchasing power increases
 * - Users see increased GRAIN value on their ledger
 *
 * The Key Insight:
 * - Because treasury holds ILLIQUID assets (real estate), we cannot promise
 *   immediate liquidity on appreciation gains
 * - Cash-out value is ALWAYS 1:1 with original deposit (USD in = USD out max)
 * - The APPRECIATION is reflected as increased purchasing power WITHIN the ecosystem
 *
 * Example:
 * - User deposits $1,000 → Gets 1,000 GRAIN
 * - Treasury invests in commercial real estate
 * - Real estate appreciates 20%
 * - User's ledger shows: 1,200 GRAIN purchasing power
 * - If user cashes out: They get $1,000 (their original deposit)
 * - If user SPENDS within GRAIN: They can spend the full 1,200 GRAIN
 *
 * Why Users Stay:
 * - Cashing out means "losing" your appreciation gains
 * - Spending within ecosystem lets you USE those gains
 * - Creates natural incentive to keep money in GRAIN
 *
 * Settlement Model:
 * - Transactions appear instant to users
 * - Actual fund release has 24-72hr escrow hold
 * - Escrow protects against disputes/fraud
 * - NO CHARGEBACKS - escrow period handles all disputes
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { query } from '../db'

// Types
export interface GrainBalance {
  userId: string
  totalGrain: number              // Total GRAIN balance (purchasing power)
  principalUsd: number            // Original USD deposited (max withdrawable)
  appreciationGrain: number       // Gains from treasury growth (spend-only)
  withdrawableUsd: number         // Max USD you can cash out (= principalUsd)
  spendableGrain: number          // Full purchasing power in ecosystem
  availableGrain: number          // Available after escrow holds
  heldGrain: number               // Currently in escrow
  grainRate: number               // Current GRAIN/USD rate
  appreciationPercent: number     // Your gain percentage
  lastUpdated: Date
}

export interface GrainTransaction {
  id: string
  userId: string
  type: 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out' | 'payment' | 'escrow_release' | 'escrow_refund'
  amount: number
  amountUsd: number
  grainRate: number         // GRAIN/USD rate at time of transaction
  principalPortion: number  // How much was principal
  equityPortion: number     // How much was equity
  status: 'pending' | 'escrowed' | 'completed' | 'disputed' | 'refunded' | 'cancelled'
  escrowReleaseAt?: Date
  counterpartyId?: string
  orderId?: string
  metadata: Record<string, any>
  createdAt: Date
  completedAt?: Date
}

export interface EscrowHold {
  id: string
  transactionId: string
  senderId: string
  receiverId: string
  amount: number
  principalPortion: number
  equityPortion: number
  status: 'held' | 'released' | 'refunded' | 'disputed'
  holdStartedAt: Date
  releaseAt: Date           // 24-72hrs from start
  releasedAt?: Date
  disputeId?: string
  reason?: string
}

export interface Dispute {
  id: string
  escrowId: string
  initiatorId: string       // Who opened the dispute
  respondentId: string      // Other party
  amount: number
  reason: string
  evidence: Record<string, any>[]
  status: 'open' | 'under_review' | 'resolved_sender' | 'resolved_receiver' | 'split' | 'escalated'
  resolution?: string
  resolvedBy?: string
  createdAt: Date
  resolvedAt?: Date
}

// Constants
export const ESCROW_DURATION_HOURS = {
  standard: 24,             // Regular transactions
  high_value: 48,           // Transactions > $10,000
  new_user: 72,             // User's first 30 days
  flagged: 72               // Risk-flagged transactions
}

export const DISPUTE_WINDOW_HOURS = 24  // Time after escrow to open dispute

// Current GRAIN rate (would come from treasury in production)
let currentGrainRate = 1.0  // 1 GRAIN = 1 USD initially

export function setGrainRate(rate: number) {
  currentGrainRate = rate
}

export function getGrainRate(): number {
  return currentGrainRate
}

/**
 * Calculate a user's GRAIN balance breakdown
 *
 * Key distinction:
 * - totalGrain: Your full purchasing power within GRAIN ecosystem
 * - withdrawableUsd: Max you can cash out (original deposits only)
 * - appreciationGrain: The "bonus" you get by staying in ecosystem
 */
export async function getGrainBalance(userId: string): Promise<GrainBalance> {
  // Get user's deposit history to calculate principal (what they put IN)
  const deposits = await query<{ total_usd: string }>(
    `SELECT COALESCE(SUM(amount_usd), 0) as total_usd
     FROM grain_transactions
     WHERE user_id = $1 AND type = 'deposit' AND status = 'completed'`,
    [userId]
  )

  // Get user's withdrawal history (what they took OUT)
  const withdrawals = await query<{ total_usd: string }>(
    `SELECT COALESCE(SUM(amount_usd), 0) as total_usd
     FROM grain_transactions
     WHERE user_id = $1 AND type = 'withdrawal' AND status = 'completed'`,
    [userId]
  )

  // Get current GRAIN balance (at current rate, this is purchasing power)
  const balance = await query<{ balance: string }>(
    `SELECT COALESCE(balance, 0) as balance FROM grain_balances WHERE user_id = $1`,
    [userId]
  )

  // Get held amounts in escrow
  const held = await query<{ held: string }>(
    `SELECT COALESCE(SUM(amount), 0) as held
     FROM grain_escrow
     WHERE sender_id = $1 AND status = 'held'`,
    [userId]
  )

  const totalGrain = parseFloat(balance.rows[0]?.balance || '0')
  const totalDepositsUsd = parseFloat(deposits.rows[0]?.total_usd || '0')
  const totalWithdrawalsUsd = parseFloat(withdrawals.rows[0]?.total_usd || '0')
  const heldGrain = parseFloat(held.rows[0]?.held || '0')

  // Principal = what they deposited minus what they withdrew
  // This is the MAX they can ever cash out
  const principalUsd = totalDepositsUsd - totalWithdrawalsUsd

  // Current purchasing power in USD terms
  const currentValueUsd = totalGrain * currentGrainRate

  // Appreciation = the difference between current value and principal
  // This can ONLY be spent within ecosystem, never withdrawn
  const appreciationUsd = Math.max(0, currentValueUsd - principalUsd)
  const appreciationGrain = appreciationUsd / currentGrainRate

  // Appreciation percentage
  const appreciationPercent = principalUsd > 0
    ? ((currentValueUsd / principalUsd) - 1) * 100
    : 0

  return {
    userId,
    totalGrain,                              // Full balance
    principalUsd,                            // Original deposits (max cashout)
    appreciationGrain,                       // Ecosystem-only gains
    withdrawableUsd: principalUsd,           // Same as principal - max cashout
    spendableGrain: totalGrain,              // Full purchasing power in ecosystem
    availableGrain: totalGrain - heldGrain,  // After escrow holds
    heldGrain,                               // In escrow
    grainRate: currentGrainRate,             // Current rate
    appreciationPercent,                     // % gain
    lastUpdated: new Date()
  }
}

/**
 * Deposit USD and receive GRAIN
 */
export async function depositGrain(
  userId: string,
  amountUsd: number,
  source: 'card' | 'bank' | 'crypto'
): Promise<GrainTransaction> {
  const grainAmount = amountUsd / currentGrainRate

  const result = await query<GrainTransaction>(
    `INSERT INTO grain_transactions (
      user_id, type, amount, amount_usd, grain_rate,
      principal_portion, equity_portion, status, metadata
    ) VALUES ($1, 'deposit', $2, $3, $4, $5, 0, 'completed', $6)
    RETURNING *`,
    [
      userId,
      grainAmount,
      amountUsd,
      currentGrainRate,
      amountUsd, // All deposits are principal
      { source }
    ]
  )

  // Update balance
  await query(
    `INSERT INTO grain_balances (user_id, balance)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       balance = grain_balances.balance + $2,
       updated_at = NOW()`,
    [userId, grainAmount]
  )

  return result.rows[0]
}

/**
 * Withdraw GRAIN to USD
 *
 * CRITICAL: Withdrawals are ALWAYS 1:1 with original deposits
 * - You can only withdraw up to what you deposited
 * - Appreciation gains CANNOT be withdrawn
 * - This is by design: treasury holds illiquid assets
 *
 * The "loss" of appreciation on withdrawal is the incentive to stay
 */
export async function withdrawGrain(
  userId: string,
  amountUsd: number, // User specifies USD amount they want
  destination: 'bank' | 'card'
): Promise<{
  success: boolean
  transaction?: GrainTransaction
  warning?: string
  error?: string
}> {
  const balance = await getGrainBalance(userId)

  // Check if they're trying to withdraw more than their principal
  if (amountUsd > balance.withdrawableUsd) {
    return {
      success: false,
      error: `Maximum withdrawal: $${balance.withdrawableUsd.toFixed(2)} (your original deposits). Your ${balance.appreciationGrain.toFixed(2)} GRAIN appreciation can only be spent within the GRAIN ecosystem.`
    }
  }

  // Calculate GRAIN amount being removed
  // When withdrawing, we remove GRAIN at current rate but pay out 1:1 USD
  const grainToRemove = amountUsd / currentGrainRate

  if (grainToRemove > balance.availableGrain) {
    return {
      success: false,
      error: `Insufficient available balance. ${balance.heldGrain.toFixed(2)} GRAIN is currently in escrow.`
    }
  }

  // Calculate what they're "giving up" by withdrawing
  const appreciationBeingForfeited = balance.appreciationPercent > 0
    ? amountUsd * (balance.appreciationPercent / 100)
    : 0

  const result = await query<GrainTransaction>(
    `INSERT INTO grain_transactions (
      user_id, type, amount, amount_usd, grain_rate,
      principal_portion, equity_portion, status, metadata
    ) VALUES ($1, 'withdrawal', $2, $3, $4, $5, 0, 'completed', $6)
    RETURNING *`,
    [
      userId,
      grainToRemove,
      amountUsd,
      currentGrainRate,
      amountUsd, // Full amount is from principal
      {
        destination,
        appreciation_forfeited: appreciationBeingForfeited,
        note: 'Withdrawal is 1:1 with original deposit. Appreciation remains in ecosystem.'
      }
    ]
  )

  // Update balance - remove the GRAIN
  await query(
    `UPDATE grain_balances SET balance = balance - $2, updated_at = NOW()
     WHERE user_id = $1`,
    [userId, grainToRemove]
  )

  // Generate warning if they're forfeiting appreciation
  let warning: string | undefined
  if (appreciationBeingForfeited > 0) {
    warning = `Note: By withdrawing $${amountUsd.toFixed(2)}, you're forfeiting $${appreciationBeingForfeited.toFixed(2)} in appreciation that could have been spent within GRAIN.`
  }

  return { success: true, transaction: result.rows[0], warning }
}

/**
 * Transfer GRAIN to another user
 * Can use both principal AND equity for internal transfers
 */
export async function transferGrain(
  senderId: string,
  receiverId: string,
  amountGrain: number,
  orderId?: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; escrow?: EscrowHold; error?: string }> {
  const senderBalance = await getGrainBalance(senderId)

  if (amountGrain > senderBalance.availableGrain) {
    return {
      success: false,
      error: `Insufficient available balance. You have ${senderBalance.availableGrain.toFixed(2)} GRAIN available.`
    }
  }

  // Determine escrow duration based on risk factors
  const escrowHours = await determineEscrowDuration(senderId, receiverId, amountGrain)
  const releaseAt = new Date(Date.now() + escrowHours * 60 * 60 * 1000)

  // Calculate principal vs equity portions
  const senderEquityRatio = senderBalance.equityGrain / senderBalance.totalGrain
  const equityPortion = amountGrain * senderEquityRatio
  const principalPortion = amountGrain - equityPortion

  // Create escrow hold
  const escrow = await query<EscrowHold>(
    `INSERT INTO grain_escrow (
      sender_id, receiver_id, amount, principal_portion, equity_portion,
      status, hold_started_at, release_at, order_id, metadata
    ) VALUES ($1, $2, $3, $4, $5, 'held', NOW(), $6, $7, $8)
    RETURNING *`,
    [
      senderId,
      receiverId,
      amountGrain,
      principalPortion,
      equityPortion,
      releaseAt,
      orderId,
      metadata || {}
    ]
  )

  // Create pending transaction for sender
  await query(
    `INSERT INTO grain_transactions (
      user_id, type, amount, amount_usd, grain_rate,
      principal_portion, equity_portion, status, escrow_release_at,
      counterparty_id, order_id, metadata
    ) VALUES ($1, 'transfer_out', $2, $3, $4, $5, $6, 'escrowed', $7, $8, $9, $10)`,
    [
      senderId,
      amountGrain,
      amountGrain * currentGrainRate,
      currentGrainRate,
      principalPortion,
      equityPortion,
      releaseAt,
      receiverId,
      orderId,
      metadata || {}
    ]
  )

  // Deduct from sender's available balance (move to held)
  await query(
    `UPDATE grain_balances SET balance = balance - $2, updated_at = NOW()
     WHERE user_id = $1`,
    [senderId, amountGrain]
  )

  return { success: true, escrow: escrow.rows[0] }
}

/**
 * Determine escrow duration based on risk factors
 */
async function determineEscrowDuration(
  senderId: string,
  receiverId: string,
  amount: number
): Promise<number> {
  // Check if new user (less than 30 days)
  const senderAge = await query<{ days: string }>(
    `SELECT EXTRACT(DAY FROM NOW() - created_at) as days
     FROM grain_balances WHERE user_id = $1`,
    [senderId]
  )

  const daysSinceCreation = parseInt(senderAge.rows[0]?.days || '0')

  if (daysSinceCreation < 30) {
    return ESCROW_DURATION_HOURS.new_user // 72 hours for new users
  }

  if (amount > 10000) {
    return ESCROW_DURATION_HOURS.high_value // 48 hours for high value
  }

  // Check for flags/risk indicators
  const flags = await query<{ flagged: boolean }>(
    `SELECT risk_flagged as flagged FROM grain_balances WHERE user_id = $1`,
    [senderId]
  )

  if (flags.rows[0]?.flagged) {
    return ESCROW_DURATION_HOURS.flagged // 72 hours if flagged
  }

  return ESCROW_DURATION_HOURS.standard // 24 hours standard
}

/**
 * Release escrow after hold period (called by cron job)
 */
export async function releaseEscrow(escrowId: string): Promise<{ success: boolean; error?: string }> {
  const escrow = await query<EscrowHold>(
    `SELECT * FROM grain_escrow WHERE id = $1 AND status = 'held'`,
    [escrowId]
  )

  if (!escrow.rows[0]) {
    return { success: false, error: 'Escrow not found or already processed' }
  }

  const hold = escrow.rows[0]

  // Check if release time has passed
  if (new Date() < new Date(hold.releaseAt)) {
    return { success: false, error: 'Escrow hold period not yet complete' }
  }

  // Check for open disputes
  const disputes = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM grain_disputes
     WHERE escrow_id = $1 AND status IN ('open', 'under_review')`,
    [escrowId]
  )

  if (parseInt(disputes.rows[0]?.count || '0') > 0) {
    return { success: false, error: 'Cannot release - active dispute exists' }
  }

  // Release to receiver
  await query(
    `UPDATE grain_balances SET balance = balance + $2, updated_at = NOW()
     WHERE user_id = $1`,
    [hold.receiverId, hold.amount]
  )

  // Update escrow status
  await query(
    `UPDATE grain_escrow SET status = 'released', released_at = NOW()
     WHERE id = $1`,
    [escrowId]
  )

  // Create completion transaction for receiver
  await query(
    `INSERT INTO grain_transactions (
      user_id, type, amount, amount_usd, grain_rate,
      principal_portion, equity_portion, status,
      counterparty_id, metadata
    ) VALUES ($1, 'transfer_in', $2, $3, $4, $5, $6, 'completed', $7, $8)`,
    [
      hold.receiverId,
      hold.amount,
      hold.amount * currentGrainRate,
      currentGrainRate,
      hold.principalPortion,
      hold.equityPortion,
      hold.senderId,
      { escrow_id: escrowId }
    ]
  )

  return { success: true }
}

/**
 * Open a dispute during escrow period
 */
export async function openDispute(
  escrowId: string,
  initiatorId: string,
  reason: string,
  evidence?: Record<string, any>[]
): Promise<{ success: boolean; dispute?: Dispute; error?: string }> {
  const escrow = await query<EscrowHold>(
    `SELECT * FROM grain_escrow WHERE id = $1`,
    [escrowId]
  )

  if (!escrow.rows[0]) {
    return { success: false, error: 'Escrow not found' }
  }

  const hold = escrow.rows[0]

  // Verify initiator is involved in this transaction
  if (initiatorId !== hold.senderId && initiatorId !== hold.receiverId) {
    return { success: false, error: 'You are not a party to this transaction' }
  }

  // Check if still within dispute window
  const disputeDeadline = new Date(hold.releaseAt.getTime() + DISPUTE_WINDOW_HOURS * 60 * 60 * 1000)
  if (new Date() > disputeDeadline && hold.status === 'released') {
    return { success: false, error: 'Dispute window has closed' }
  }

  // Check for existing dispute
  const existing = await query<{ id: string }>(
    `SELECT id FROM grain_disputes WHERE escrow_id = $1 AND status IN ('open', 'under_review')`,
    [escrowId]
  )

  if (existing.rows[0]) {
    return { success: false, error: 'A dispute is already open for this transaction' }
  }

  const respondentId = initiatorId === hold.senderId ? hold.receiverId : hold.senderId

  // Create dispute
  const dispute = await query<Dispute>(
    `INSERT INTO grain_disputes (
      escrow_id, initiator_id, respondent_id, amount, reason, evidence, status
    ) VALUES ($1, $2, $3, $4, $5, $6, 'open')
    RETURNING *`,
    [
      escrowId,
      initiatorId,
      respondentId,
      hold.amount,
      reason,
      evidence || []
    ]
  )

  // Update escrow status
  await query(
    `UPDATE grain_escrow SET status = 'disputed', dispute_id = $2 WHERE id = $1`,
    [escrowId, dispute.rows[0].id]
  )

  return { success: true, dispute: dispute.rows[0] }
}

/**
 * Resolve a dispute
 */
export async function resolveDispute(
  disputeId: string,
  resolution: 'sender' | 'receiver' | 'split',
  splitRatio?: number, // 0-1, portion going to sender
  resolvedBy?: string,
  resolutionNotes?: string
): Promise<{ success: boolean; error?: string }> {
  const dispute = await query<Dispute & { escrow: EscrowHold }>(
    `SELECT d.*, row_to_json(e.*) as escrow
     FROM grain_disputes d
     JOIN grain_escrow e ON d.escrow_id = e.id
     WHERE d.id = $1`,
    [disputeId]
  )

  if (!dispute.rows[0]) {
    return { success: false, error: 'Dispute not found' }
  }

  const d = dispute.rows[0]
  const escrow = d.escrow as unknown as EscrowHold

  let senderAmount = 0
  let receiverAmount = 0

  switch (resolution) {
    case 'sender':
      senderAmount = escrow.amount
      break
    case 'receiver':
      receiverAmount = escrow.amount
      break
    case 'split':
      const ratio = splitRatio ?? 0.5
      senderAmount = escrow.amount * ratio
      receiverAmount = escrow.amount * (1 - ratio)
      break
  }

  // Return funds to sender if applicable
  if (senderAmount > 0) {
    await query(
      `UPDATE grain_balances SET balance = balance + $2, updated_at = NOW()
       WHERE user_id = $1`,
      [escrow.senderId, senderAmount]
    )

    await query(
      `INSERT INTO grain_transactions (
        user_id, type, amount, amount_usd, grain_rate,
        principal_portion, equity_portion, status, metadata
      ) VALUES ($1, 'escrow_refund', $2, $3, $4, $5, $6, 'completed', $7)`,
      [
        escrow.senderId,
        senderAmount,
        senderAmount * currentGrainRate,
        currentGrainRate,
        senderAmount * (escrow.principalPortion / escrow.amount),
        senderAmount * (escrow.equityPortion / escrow.amount),
        { dispute_id: disputeId, resolution }
      ]
    )
  }

  // Credit receiver if applicable
  if (receiverAmount > 0) {
    await query(
      `UPDATE grain_balances SET balance = balance + $2, updated_at = NOW()
       WHERE user_id = $1`,
      [escrow.receiverId, receiverAmount]
    )

    await query(
      `INSERT INTO grain_transactions (
        user_id, type, amount, amount_usd, grain_rate,
        principal_portion, equity_portion, status, metadata
      ) VALUES ($1, 'escrow_release', $2, $3, $4, $5, $6, 'completed', $7)`,
      [
        escrow.receiverId,
        receiverAmount,
        receiverAmount * currentGrainRate,
        currentGrainRate,
        receiverAmount * (escrow.principalPortion / escrow.amount),
        receiverAmount * (escrow.equityPortion / escrow.amount),
        { dispute_id: disputeId, resolution }
      ]
    )
  }

  // Update dispute
  await query(
    `UPDATE grain_disputes SET
      status = $2,
      resolution = $3,
      resolved_by = $4,
      resolved_at = NOW()
     WHERE id = $1`,
    [disputeId, `resolved_${resolution}`, resolutionNotes, resolvedBy]
  )

  // Update escrow
  await query(
    `UPDATE grain_escrow SET status = $2 WHERE id = $1`,
    [escrow.id, resolution === 'sender' ? 'refunded' : 'released']
  )

  return { success: true }
}

/**
 * Get user's transaction history
 */
export async function getTransactionHistory(
  userId: string,
  options: { limit?: number; offset?: number; type?: string } = {}
): Promise<GrainTransaction[]> {
  const { limit = 50, offset = 0, type } = options

  let whereClause = 'WHERE user_id = $1'
  const params: any[] = [userId]

  if (type) {
    whereClause += ` AND type = $2`
    params.push(type)
  }

  params.push(limit, offset)

  const result = await query<GrainTransaction>(
    `SELECT * FROM grain_transactions
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  return result.rows
}

/**
 * Get pending escrows for a user
 */
export async function getPendingEscrows(userId: string): Promise<EscrowHold[]> {
  const result = await query<EscrowHold>(
    `SELECT * FROM grain_escrow
     WHERE (sender_id = $1 OR receiver_id = $1) AND status = 'held'
     ORDER BY release_at ASC`,
    [userId]
  )

  return result.rows
}

/**
 * Get user's disputes
 */
export async function getUserDisputes(userId: string): Promise<Dispute[]> {
  const result = await query<Dispute>(
    `SELECT * FROM grain_disputes
     WHERE initiator_id = $1 OR respondent_id = $1
     ORDER BY created_at DESC`,
    [userId]
  )

  return result.rows
}
