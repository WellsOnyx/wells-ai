/**
 * GRAIN Payment Integration for Jobs Marketplace
 *
 * Complete payment service handling:
 * - Task Escrow (lock GRAIN when task awarded)
 * - Tiered Fee Structure (based on task type)
 * - Attribution Payouts (from Wells fee, not worker earnings)
 * - Worker Payouts & Off-ramp
 * - Escrow Status & History
 *
 * Fee Structure:
 * - Micro tasks: 15%
 * - Projects: 10%
 * - Contracts: 7%
 * - Placements: 5%
 *
 * Attribution Distribution (from Wells fee):
 * - Worker referrer: 20% of fee
 * - Task sourcer: 20% of fee
 * - Introducer: 10% of fee
 * - Wells keeps: 50% of fee
 */

import { sqlQuery as sql } from '@/lib/db'
import {
  getAccountByClerkId,
  getAccountById,
  transfer,
  WellsAccount,
} from '@/lib/wells-payments'
import crypto from 'crypto'

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================

/** Task type determines fee percentage */
export type TaskType = 'micro' | 'project' | 'contract' | 'placement'

/** Fee rates by task type */
export const FEE_RATES: Record<TaskType, number> = {
  micro: 0.15,      // 15% - quick gigs
  project: 0.10,    // 10% - standard projects
  contract: 0.07,   // 7% - ongoing contracts
  placement: 0.05,  // 5% - high-value placements
}

/** Attribution distribution from Wells fee */
export const ATTRIBUTION_DISTRIBUTION = {
  workerReferrer: 0.20,  // 20% of fee to person who referred the worker
  taskSourcer: 0.20,     // 20% of fee to person who sourced the task/client
  introducer: 0.10,      // 10% of fee to introducer (connected worker to task)
  wellsKeeps: 0.50,      // 50% of fee stays with Wells
} as const

export type EscrowStatus = 'pending' | 'held' | 'partial_released' | 'released' | 'refunded' | 'disputed'
export type TransactionType =
  | 'escrow_create'
  | 'escrow_fund'
  | 'milestone_release'
  | 'full_release'
  | 'refund'
  | 'fee_deduction'
  | 'attribution_payout'
  | 'worker_payout'
  | 'withdrawal'

export interface TaskEscrow {
  id: string
  taskId: string
  posterId: string
  posterEmail?: string
  workerId?: string
  workerEmail?: string

  // Amounts
  totalAmount: number
  amountHeld: number
  amountReleased: number
  feeAmount: number
  feeDeducted: number

  // Task details
  taskType: TaskType
  taskTitle?: string

  // Status
  status: EscrowStatus

  // Attribution tracking
  workerReferrerId?: string
  taskSourcerId?: string
  introducerId?: string

  // Timestamps
  createdAt: Date
  fundedAt?: Date
  releasedAt?: Date
  refundedAt?: Date

  // Milestones
  milestones?: EscrowMilestone[]
}

export interface EscrowMilestone {
  id: string
  escrowId: string
  title: string
  amount: number
  order: number
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'released' | 'rejected'
  releasedAt?: Date
  approvedBy?: string
  approvedAt?: Date
}

export interface EscrowTransaction {
  id: string
  escrowId: string
  type: TransactionType
  amount: number
  fromAccountId?: string
  toAccountId?: string
  milestoneId?: string
  description: string
  status: 'pending' | 'completed' | 'failed'
  createdAt: Date
  completedAt?: Date
  metadata?: Record<string, unknown>
}

export interface AttributionPayout {
  id: string
  escrowId: string
  taskId: string
  recipientId: string
  recipientType: 'worker_referrer' | 'task_sourcer' | 'introducer'
  amount: number
  percentage: number
  status: 'pending' | 'completed' | 'failed'
  paidAt?: Date
  createdAt: Date
}

export interface WorkerBalance {
  workerId: string
  availableBalance: number
  pendingBalance: number
  totalEarned: number
  totalWithdrawn: number
  lastEarningAt?: Date
  lastWithdrawalAt?: Date
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return crypto.randomUUID()
}

function formatGrain(amount: number): string {
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GRAIN`
}

function rowToEscrow(row: Record<string, unknown>): TaskEscrow {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    posterId: row.poster_id as string,
    posterEmail: row.poster_email as string | undefined,
    workerId: row.worker_id as string | undefined,
    workerEmail: row.worker_email as string | undefined,
    totalAmount: parseFloat(row.total_amount as string),
    amountHeld: parseFloat(row.amount_held as string),
    amountReleased: parseFloat(row.amount_released as string || '0'),
    feeAmount: parseFloat(row.fee_amount as string),
    feeDeducted: parseFloat(row.fee_deducted as string || '0'),
    taskType: row.task_type as TaskType,
    taskTitle: row.task_title as string | undefined,
    status: row.status as EscrowStatus,
    workerReferrerId: row.worker_referrer_id as string | undefined,
    taskSourcerId: row.task_sourcer_id as string | undefined,
    introducerId: row.introducer_id as string | undefined,
    createdAt: new Date(row.created_at as string),
    fundedAt: row.funded_at ? new Date(row.funded_at as string) : undefined,
    releasedAt: row.released_at ? new Date(row.released_at as string) : undefined,
    refundedAt: row.refunded_at ? new Date(row.refunded_at as string) : undefined,
  }
}

function rowToTransaction(row: Record<string, unknown>): EscrowTransaction {
  return {
    id: row.id as string,
    escrowId: row.escrow_id as string,
    type: row.type as TransactionType,
    amount: parseFloat(row.amount as string),
    fromAccountId: row.from_account_id as string | undefined,
    toAccountId: row.to_account_id as string | undefined,
    milestoneId: row.milestone_id as string | undefined,
    description: row.description as string,
    status: row.status as 'pending' | 'completed' | 'failed',
    createdAt: new Date(row.created_at as string),
    completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
  }
}

// ============================================================================
// 1. TASK ESCROW
// ============================================================================

/**
 * Lock GRAIN when task is awarded to a worker
 * Debits poster's account and holds funds in escrow
 */
export async function escrowForTask(
  posterId: string,
  taskId: string,
  amount: number,
  options?: {
    taskType?: TaskType
    taskTitle?: string
    workerId?: string
    workerReferrerId?: string
    taskSourcerId?: string
    introducerId?: string
    milestones?: Array<{ title: string; amount: number }>
  }
): Promise<{ success: boolean; escrowId?: string; message: string; error?: string }> {
  try {
    const taskType = options?.taskType || 'project'
    const feeRate = FEE_RATES[taskType]
    const feeAmount = Math.round(amount * feeRate * 100) / 100
    const totalRequired = amount + feeAmount

    // Get poster's account
    const posterAccount = await getAccountByClerkId(posterId)
    if (!posterAccount) {
      return {
        success: false,
        message: "I couldn't find your payment account. Please make sure you're set up in the system.",
        error: 'Poster account not found',
      }
    }

    // Check balance
    if (posterAccount.grainBalance < totalRequired) {
      const shortfall = totalRequired - posterAccount.grainBalance
      return {
        success: false,
        message: `You need ${formatGrain(totalRequired)} to fund this task (${formatGrain(amount)} + ${formatGrain(feeAmount)} fee), but you only have ${formatGrain(posterAccount.grainBalance)}. You're short ${formatGrain(shortfall)}.`,
        error: 'Insufficient balance',
      }
    }

    const escrowId = generateId()

    // Debit poster's account
    await sql`
      UPDATE treasury_accounts
      SET grain_balance = grain_balance - ${totalRequired}
      WHERE clerk_user_id = ${posterId}
    `

    // Create escrow record
    await sql`
      INSERT INTO job_task_escrows (
        id, task_id, poster_id, poster_email,
        worker_id, worker_email,
        total_amount, amount_held, amount_released,
        fee_amount, fee_deducted,
        task_type, task_title, status,
        worker_referrer_id, task_sourcer_id, introducer_id,
        created_at, funded_at
      ) VALUES (
        ${escrowId}, ${taskId}, ${posterId}, ${posterAccount.email},
        ${options?.workerId || null}, ${null},
        ${amount}, ${amount}, ${0},
        ${feeAmount}, ${0},
        ${taskType}, ${options?.taskTitle || null}, 'held',
        ${options?.workerReferrerId || null}, ${options?.taskSourcerId || null}, ${options?.introducerId || null},
        NOW(), NOW()
      )
    `

    // Create milestones if provided
    if (options?.milestones && options.milestones.length > 0) {
      for (let i = 0; i < options.milestones.length; i++) {
        const milestone = options.milestones[i]
        await sql`
          INSERT INTO job_escrow_milestones (
            id, escrow_id, title, amount, order_index, status, created_at
          ) VALUES (
            ${generateId()}, ${escrowId}, ${milestone.title}, ${milestone.amount}, ${i + 1}, 'pending', NOW()
          )
        `
      }
    }

    // Record transaction
    await sql`
      INSERT INTO job_escrow_transactions (
        id, escrow_id, type, amount,
        from_account_id, description, status, created_at, completed_at
      ) VALUES (
        ${generateId()}, ${escrowId}, 'escrow_fund', ${totalRequired},
        ${posterAccount.id}, 'Funds locked in escrow for task', 'completed', NOW(), NOW()
      )
    `

    // Record in grain_transactions for poster
    await sql`
      INSERT INTO grain_transactions (
        id, account_id, type, status,
        grain_amount, fee_amount,
        description, created_at
      ) VALUES (
        ${generateId()}, ${posterAccount.id}, 'task_escrow_hold', 'held',
        ${amount}, ${feeAmount},
        ${`Escrow for task: ${options?.taskTitle || taskId}`}, NOW()
      )
    `

    const feePercent = (feeRate * 100).toFixed(0)
    return {
      success: true,
      escrowId,
      message: `I've locked ${formatGrain(amount)} in escrow for this ${taskType} task, plus a ${feePercent}% fee (${formatGrain(feeAmount)}). Total held: ${formatGrain(totalRequired)}. The worker will receive payment when you approve their work.`,
    }
  } catch (error) {
    console.error('Error creating task escrow:', error)
    return {
      success: false,
      message: "Something went wrong while setting up the escrow. Please try again.",
      error: error instanceof Error ? error.message : 'Failed to create escrow',
    }
  }
}

/**
 * Release escrow to worker on milestone approval
 * Handles partial releases for milestone-based tasks
 */
export async function releaseEscrow(
  taskId: string,
  milestoneId: string | null,
  workerId: string,
  options?: {
    approvedBy?: string
    notes?: string
  }
): Promise<{ success: boolean; releasedAmount?: number; message: string; error?: string }> {
  try {
    // Get escrow
    const escrowResult = await sql`
      SELECT * FROM job_task_escrows
      WHERE task_id = ${taskId} AND status IN ('held', 'partial_released')
      LIMIT 1
    `

    if (escrowResult.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find an active escrow for this task. It may have already been released or refunded.",
        error: 'Escrow not found',
      }
    }

    const escrow = rowToEscrow(escrowResult.rows[0])

    // Get worker's account
    const workerAccount = await getAccountByClerkId(workerId)
    if (!workerAccount) {
      return {
        success: false,
        message: "The worker doesn't have a payment account set up yet. They'll need to register before receiving payment.",
        error: 'Worker account not found',
      }
    }

    let releaseAmount: number
    let isFinalRelease = false

    if (milestoneId) {
      // Milestone-based release
      const milestoneResult = await sql`
        SELECT * FROM job_escrow_milestones
        WHERE id = ${milestoneId} AND escrow_id = ${escrow.id}
      `

      if (milestoneResult.rows.length === 0) {
        return {
          success: false,
          message: "I couldn't find that milestone. Please check and try again.",
          error: 'Milestone not found',
        }
      }

      const milestone = milestoneResult.rows[0]
      if (milestone.status === 'released') {
        return {
          success: false,
          message: "This milestone has already been paid out.",
          error: 'Milestone already released',
        }
      }

      releaseAmount = parseFloat(milestone.amount as string)

      // Update milestone
      await sql`
        UPDATE job_escrow_milestones
        SET status = 'released',
            released_at = NOW(),
            approved_by = ${options?.approvedBy || null},
            approved_at = NOW()
        WHERE id = ${milestoneId}
      `

      // Check if this is the final milestone
      const remainingResult = await sql`
        SELECT COUNT(*) as remaining
        FROM job_escrow_milestones
        WHERE escrow_id = ${escrow.id} AND status != 'released'
      `
      isFinalRelease = parseInt(remainingResult.rows[0].remaining as string) === 0

    } else {
      // Full release
      releaseAmount = escrow.amountHeld - escrow.amountReleased
      isFinalRelease = true
    }

    // Calculate fee portion for this release
    const releaseRatio = releaseAmount / escrow.totalAmount
    const feeForRelease = Math.round(escrow.feeAmount * releaseRatio * 100) / 100

    // Credit worker (full release amount - worker gets 100%, fee comes from poster)
    await sql`
      UPDATE treasury_accounts
      SET grain_balance = grain_balance + ${releaseAmount}
      WHERE clerk_user_id = ${workerId}
    `

    // Update escrow
    const newStatus: EscrowStatus = isFinalRelease ? 'released' : 'partial_released'
    await sql`
      UPDATE job_task_escrows
      SET amount_released = amount_released + ${releaseAmount},
          fee_deducted = fee_deducted + ${feeForRelease},
          worker_id = ${workerId},
          worker_email = ${workerAccount.email},
          status = ${newStatus},
          released_at = ${isFinalRelease ? 'NOW()' : null}
      WHERE id = ${escrow.id}
    `

    // Record transaction
    await sql`
      INSERT INTO job_escrow_transactions (
        id, escrow_id, type, amount,
        to_account_id, milestone_id,
        description, status, created_at, completed_at
      ) VALUES (
        ${generateId()}, ${escrow.id}, ${milestoneId ? 'milestone_release' : 'full_release'}, ${releaseAmount},
        ${workerAccount.id}, ${milestoneId || null},
        ${milestoneId ? 'Milestone payment released' : 'Full task payment released'}, 'completed', NOW(), NOW()
      )
    `

    // Record worker earnings
    await sql`
      INSERT INTO grain_transactions (
        id, account_id, type, status,
        grain_amount, description, created_at
      ) VALUES (
        ${generateId()}, ${workerAccount.id}, 'task_payment', 'completed',
        ${releaseAmount}, ${`Payment for task: ${escrow.taskTitle || escrow.taskId}`}, NOW()
      )
    `

    // Process attribution payouts if final release
    if (isFinalRelease) {
      await processAttributionPayouts(escrow.id, escrow.feeAmount)
    }

    const message = milestoneId
      ? `I've released ${formatGrain(releaseAmount)} to the worker for this milestone. ${isFinalRelease ? 'This was the final milestone - task complete!' : 'The remaining milestones are still in escrow.'}`
      : `I've released ${formatGrain(releaseAmount)} to the worker. The task payment is now complete.`

    return {
      success: true,
      releasedAmount: releaseAmount,
      message,
    }
  } catch (error) {
    console.error('Error releasing escrow:', error)
    return {
      success: false,
      message: "Something went wrong while releasing the payment. Please try again.",
      error: error instanceof Error ? error.message : 'Failed to release escrow',
    }
  }
}

/**
 * Refund escrow to poster if task is cancelled
 */
export async function refundEscrow(
  taskId: string,
  reason: string,
  options?: {
    refundedBy?: string
    partialAmount?: number
  }
): Promise<{ success: boolean; refundedAmount?: number; message: string; error?: string }> {
  try {
    // Get escrow
    const escrowResult = await sql`
      SELECT * FROM job_task_escrows
      WHERE task_id = ${taskId} AND status IN ('held', 'partial_released')
      LIMIT 1
    `

    if (escrowResult.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find an active escrow for this task to refund.",
        error: 'Escrow not found',
      }
    }

    const escrow = rowToEscrow(escrowResult.rows[0])

    // Calculate refundable amount
    const remainingHeld = escrow.amountHeld - escrow.amountReleased
    const remainingFee = escrow.feeAmount - escrow.feeDeducted

    const refundAmount = options?.partialAmount
      ? Math.min(options.partialAmount, remainingHeld)
      : remainingHeld

    const feeRefund = options?.partialAmount
      ? (refundAmount / remainingHeld) * remainingFee
      : remainingFee

    const totalRefund = refundAmount + feeRefund

    if (totalRefund <= 0) {
      return {
        success: false,
        message: "There are no funds left to refund - all payments have already been released.",
        error: 'No funds to refund',
      }
    }

    // Get poster's account
    const posterAccount = await getAccountByClerkId(escrow.posterId)
    if (!posterAccount) {
      return {
        success: false,
        message: "I couldn't find the poster's account. Please contact support.",
        error: 'Poster account not found',
      }
    }

    // Credit poster
    await sql`
      UPDATE treasury_accounts
      SET grain_balance = grain_balance + ${totalRefund}
      WHERE clerk_user_id = ${escrow.posterId}
    `

    // Update escrow
    const isFullRefund = refundAmount >= remainingHeld
    await sql`
      UPDATE job_task_escrows
      SET status = ${isFullRefund ? 'refunded' : 'partial_released'},
          refunded_at = ${isFullRefund ? 'NOW()' : null},
          amount_held = amount_held - ${refundAmount},
          fee_amount = fee_amount - ${feeRefund}
      WHERE id = ${escrow.id}
    `

    // Record transaction
    await sql`
      INSERT INTO job_escrow_transactions (
        id, escrow_id, type, amount,
        to_account_id, description, status, created_at, completed_at,
        metadata
      ) VALUES (
        ${generateId()}, ${escrow.id}, 'refund', ${totalRefund},
        ${posterAccount.id}, ${`Refund: ${reason}`}, 'completed', NOW(), NOW(),
        ${JSON.stringify({ reason, refundedBy: options?.refundedBy })}
      )
    `

    // Record in grain_transactions
    await sql`
      INSERT INTO grain_transactions (
        id, account_id, type, status,
        grain_amount, description, created_at
      ) VALUES (
        ${generateId()}, ${posterAccount.id}, 'task_escrow_refund', 'completed',
        ${totalRefund}, ${`Refund: ${reason}`}, NOW()
      )
    `

    return {
      success: true,
      refundedAmount: totalRefund,
      message: `I've refunded ${formatGrain(totalRefund)} to your account (${formatGrain(refundAmount)} task amount + ${formatGrain(feeRefund)} fee). Reason: ${reason}`,
    }
  } catch (error) {
    console.error('Error refunding escrow:', error)
    return {
      success: false,
      message: "Something went wrong while processing the refund. Please try again.",
      error: error instanceof Error ? error.message : 'Failed to refund escrow',
    }
  }
}

// ============================================================================
// 2. FEE STRUCTURE
// ============================================================================

/**
 * Calculate Wells fee based on task type
 */
export function calculateFees(
  amount: number,
  taskType: TaskType
): { feeRate: number; feeAmount: number; netToWorker: number; message: string } {
  const feeRate = FEE_RATES[taskType]
  const feeAmount = Math.round(amount * feeRate * 100) / 100
  const netToWorker = amount // Worker gets full amount, fee is additional

  const taskTypeLabels: Record<TaskType, string> = {
    micro: 'micro task (15% fee)',
    project: 'project (10% fee)',
    contract: 'contract (7% fee)',
    placement: 'placement (5% fee)',
  }

  return {
    feeRate,
    feeAmount,
    netToWorker,
    message: `For this ${taskTypeLabels[taskType]}, the fee is ${formatGrain(feeAmount)}. The worker receives the full ${formatGrain(amount)}. Total cost to you: ${formatGrain(amount + feeAmount)}.`,
  }
}

/**
 * Deduct fees from a completed payment
 * Typically called automatically during escrow release
 */
export async function deductFees(
  paymentId: string
): Promise<{ success: boolean; feeAmount?: number; message: string; error?: string }> {
  try {
    // Get the transaction
    const txResult = await sql`
      SELECT * FROM job_escrow_transactions WHERE id = ${paymentId}
    `

    if (txResult.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find that payment to deduct fees from.",
        error: 'Payment not found',
      }
    }

    const tx = rowToTransaction(txResult.rows[0])

    // Get associated escrow to determine fee
    const escrowResult = await sql`
      SELECT * FROM job_task_escrows WHERE id = ${tx.escrowId}
    `

    if (escrowResult.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find the escrow associated with this payment.",
        error: 'Escrow not found',
      }
    }

    const escrow = rowToEscrow(escrowResult.rows[0])

    // Calculate fee for this specific transaction
    const releaseRatio = tx.amount / escrow.totalAmount
    const feeAmount = Math.round(escrow.feeAmount * releaseRatio * 100) / 100

    // Record fee deduction
    await sql`
      INSERT INTO job_escrow_transactions (
        id, escrow_id, type, amount,
        description, status, created_at, completed_at
      ) VALUES (
        ${generateId()}, ${escrow.id}, 'fee_deduction', ${feeAmount},
        'Platform fee deducted', 'completed', NOW(), NOW()
      )
    `

    // Update escrow fee tracking
    await sql`
      UPDATE job_task_escrows
      SET fee_deducted = fee_deducted + ${feeAmount}
      WHERE id = ${escrow.id}
    `

    return {
      success: true,
      feeAmount,
      message: `Platform fee of ${formatGrain(feeAmount)} has been deducted.`,
    }
  } catch (error) {
    console.error('Error deducting fees:', error)
    return {
      success: false,
      message: "Something went wrong while processing the fee deduction.",
      error: error instanceof Error ? error.message : 'Failed to deduct fees',
    }
  }
}

// ============================================================================
// 3. ATTRIBUTION PAYOUTS
// ============================================================================

/**
 * Process attribution payouts from the Wells fee
 * Distribution:
 * - Worker referrer: 20% of fee
 * - Task sourcer: 20% of fee
 * - Introducer: 10% of fee
 * - Wells keeps: 50% of fee
 */
export async function processAttributionPayouts(
  taskId: string,
  feeAmount: number
): Promise<{ success: boolean; payouts: AttributionPayout[]; message: string; error?: string }> {
  try {
    // Get escrow to find attribution recipients
    const escrowResult = await sql`
      SELECT * FROM job_task_escrows
      WHERE id = ${taskId} OR task_id = ${taskId}
      LIMIT 1
    `

    if (escrowResult.rows.length === 0) {
      return {
        success: true,
        payouts: [],
        message: 'No escrow found - no attributions to process.',
      }
    }

    const escrow = rowToEscrow(escrowResult.rows[0])
    const payouts: AttributionPayout[] = []
    let totalPaid = 0

    // Calculate payout amounts
    const workerReferrerAmount = Math.round(feeAmount * ATTRIBUTION_DISTRIBUTION.workerReferrer * 100) / 100
    const taskSourcerAmount = Math.round(feeAmount * ATTRIBUTION_DISTRIBUTION.taskSourcer * 100) / 100
    const introducerAmount = Math.round(feeAmount * ATTRIBUTION_DISTRIBUTION.introducer * 100) / 100

    // Pay worker referrer (20%)
    if (escrow.workerReferrerId && workerReferrerAmount > 0) {
      const result = await payAttributionRecipient(
        escrow.id,
        escrow.taskId,
        escrow.workerReferrerId,
        'worker_referrer',
        workerReferrerAmount,
        ATTRIBUTION_DISTRIBUTION.workerReferrer * 100
      )
      if (result.payout) {
        payouts.push(result.payout)
        totalPaid += workerReferrerAmount
      }
    }

    // Pay task sourcer (20%)
    if (escrow.taskSourcerId && taskSourcerAmount > 0) {
      const result = await payAttributionRecipient(
        escrow.id,
        escrow.taskId,
        escrow.taskSourcerId,
        'task_sourcer',
        taskSourcerAmount,
        ATTRIBUTION_DISTRIBUTION.taskSourcer * 100
      )
      if (result.payout) {
        payouts.push(result.payout)
        totalPaid += taskSourcerAmount
      }
    }

    // Pay introducer (10%)
    if (escrow.introducerId && introducerAmount > 0) {
      const result = await payAttributionRecipient(
        escrow.id,
        escrow.taskId,
        escrow.introducerId,
        'introducer',
        introducerAmount,
        ATTRIBUTION_DISTRIBUTION.introducer * 100
      )
      if (result.payout) {
        payouts.push(result.payout)
        totalPaid += introducerAmount
      }
    }

    const wellsKeeps = feeAmount - totalPaid
    const message = payouts.length > 0
      ? `Attribution payouts processed: ${formatGrain(totalPaid)} distributed to ${payouts.length} referrer(s). Wells retained ${formatGrain(wellsKeeps)}.`
      : `No attribution recipients found. Wells retained the full fee of ${formatGrain(feeAmount)}.`

    return {
      success: true,
      payouts,
      message,
    }
  } catch (error) {
    console.error('Error processing attribution payouts:', error)
    return {
      success: false,
      payouts: [],
      message: "Something went wrong processing attribution payouts.",
      error: error instanceof Error ? error.message : 'Failed to process attributions',
    }
  }
}

/**
 * Pay an individual attribution recipient
 */
async function payAttributionRecipient(
  escrowId: string,
  taskId: string,
  recipientId: string,
  recipientType: 'worker_referrer' | 'task_sourcer' | 'introducer',
  amount: number,
  percentage: number
): Promise<{ success: boolean; payout?: AttributionPayout }> {
  try {
    const recipientAccount = await getAccountByClerkId(recipientId)
    if (!recipientAccount) {
      console.warn(`Attribution recipient ${recipientId} not found`)
      return { success: false }
    }

    const payoutId = generateId()

    // Credit recipient
    await sql`
      UPDATE treasury_accounts
      SET grain_balance = grain_balance + ${amount}
      WHERE clerk_user_id = ${recipientId}
    `

    // Record payout
    await sql`
      INSERT INTO job_attribution_payouts (
        id, escrow_id, task_id, recipient_id, recipient_type,
        amount, percentage, status, paid_at, created_at
      ) VALUES (
        ${payoutId}, ${escrowId}, ${taskId}, ${recipientId}, ${recipientType},
        ${amount}, ${percentage}, 'completed', NOW(), NOW()
      )
    `

    // Record transaction
    await sql`
      INSERT INTO job_escrow_transactions (
        id, escrow_id, type, amount,
        to_account_id, description, status, created_at, completed_at
      ) VALUES (
        ${generateId()}, ${escrowId}, 'attribution_payout', ${amount},
        ${recipientAccount.id}, ${`${recipientType} attribution (${percentage}% of fee)`}, 'completed', NOW(), NOW()
      )
    `

    // Record in grain_transactions
    await sql`
      INSERT INTO grain_transactions (
        id, account_id, type, status,
        grain_amount, description, created_at
      ) VALUES (
        ${generateId()}, ${recipientAccount.id}, 'attribution_payout', 'completed',
        ${amount}, ${`${recipientType} attribution payout`}, NOW()
      )
    `

    const payout: AttributionPayout = {
      id: payoutId,
      escrowId,
      taskId,
      recipientId,
      recipientType,
      amount,
      percentage,
      status: 'completed',
      paidAt: new Date(),
      createdAt: new Date(),
    }

    return { success: true, payout }
  } catch (error) {
    console.error(`Error paying attribution to ${recipientId}:`, error)
    return { success: false }
  }
}

// ============================================================================
// 4. WORKER PAYOUTS
// ============================================================================

/**
 * Get worker's current GRAIN balance
 */
export async function getWorkerBalance(
  workerId: string
): Promise<{ balance: WorkerBalance | null; message: string }> {
  try {
    const account = await getAccountByClerkId(workerId)
    if (!account) {
      return {
        balance: null,
        message: "I couldn't find your payment account. You may need to complete setup first.",
      }
    }

    // Get earnings stats
    const statsResult = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'task_payment' AND status = 'completed' THEN grain_amount ELSE 0 END), 0) as total_earned,
        COALESCE(SUM(CASE WHEN type = 'withdraw' AND status = 'completed' THEN grain_amount ELSE 0 END), 0) as total_withdrawn,
        MAX(CASE WHEN type = 'task_payment' THEN created_at END) as last_earning,
        MAX(CASE WHEN type = 'withdraw' THEN created_at END) as last_withdrawal
      FROM grain_transactions
      WHERE account_id = ${account.id}
    `

    const stats = statsResult.rows[0]

    // Get pending balance (in escrow but approved)
    const pendingResult = await sql`
      SELECT COALESCE(SUM(amount_held - amount_released), 0) as pending
      FROM job_task_escrows
      WHERE worker_id = ${workerId} AND status IN ('held', 'partial_released')
    `

    const balance: WorkerBalance = {
      workerId,
      availableBalance: account.grainBalance,
      pendingBalance: parseFloat(pendingResult.rows[0].pending as string),
      totalEarned: parseFloat(stats.total_earned as string),
      totalWithdrawn: parseFloat(stats.total_withdrawn as string),
      lastEarningAt: stats.last_earning ? new Date(stats.last_earning as string) : undefined,
      lastWithdrawalAt: stats.last_withdrawal ? new Date(stats.last_withdrawal as string) : undefined,
    }

    let message = `Your current balance is ${formatGrain(balance.availableBalance)}.`
    if (balance.pendingBalance > 0) {
      message += ` You have ${formatGrain(balance.pendingBalance)} pending in escrow.`
    }
    message += ` Total earned: ${formatGrain(balance.totalEarned)}.`

    return { balance, message }
  } catch (error) {
    console.error('Error getting worker balance:', error)
    return {
      balance: null,
      message: "Something went wrong while fetching your balance. Please try again.",
    }
  }
}

/**
 * Withdraw GRAIN to external destination (off-ramp)
 */
export async function withdrawToExternal(
  workerId: string,
  amount: number,
  destination: {
    type: 'bank' | 'crypto' | 'paypal'
    details: Record<string, string>
  }
): Promise<{ success: boolean; withdrawalId?: string; message: string; error?: string }> {
  try {
    const account = await getAccountByClerkId(workerId)
    if (!account) {
      return {
        success: false,
        message: "I couldn't find your payment account.",
        error: 'Account not found',
      }
    }

    if (account.grainBalance < amount) {
      return {
        success: false,
        message: `You don't have enough GRAIN. Available: ${formatGrain(account.grainBalance)}, requested: ${formatGrain(amount)}.`,
        error: 'Insufficient balance',
      }
    }

    // Calculate withdrawal fee
    const feeRate = 0.001 // 0.1%
    const minFee = 1
    const fee = Math.max(amount * feeRate, minFee)
    const netAmount = amount - fee

    const withdrawalId = generateId()

    // Debit account
    await sql`
      UPDATE treasury_accounts
      SET grain_balance = grain_balance - ${amount}
      WHERE clerk_user_id = ${workerId}
    `

    // Create withdrawal request
    await sql`
      INSERT INTO withdrawal_requests (
        id, account_id, amount, fee, net_amount, currency,
        destination_type, destination_details,
        status, created_at, estimated_arrival
      ) VALUES (
        ${withdrawalId}, ${account.id}, ${amount}, ${fee}, ${netAmount}, 'USD',
        ${destination.type}, ${JSON.stringify(destination.details)},
        'pending', NOW(), NOW() + INTERVAL '3 days'
      )
    `

    // Record transaction
    await sql`
      INSERT INTO grain_transactions (
        id, account_id, type, status,
        grain_amount, fee_amount,
        description, created_at
      ) VALUES (
        ${generateId()}, ${account.id}, 'withdraw', 'processing',
        ${netAmount}, ${fee},
        ${`Withdrawal to ${destination.type}`}, NOW()
      )
    `

    const arrivalDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    return {
      success: true,
      withdrawalId,
      message: `Withdrawal of ${formatGrain(netAmount)} initiated (${formatGrain(fee)} fee). Expected arrival: ${arrivalDate.toLocaleDateString()}. We'll notify you when it's complete.`,
    }
  } catch (error) {
    console.error('Error processing withdrawal:', error)
    return {
      success: false,
      message: "Something went wrong processing your withdrawal. Please try again.",
      error: error instanceof Error ? error.message : 'Failed to process withdrawal',
    }
  }
}

/**
 * Transfer GRAIN to main GRAIN account (internal transfer)
 */
export async function transferToGrainAccount(
  workerId: string,
  amount: number,
  targetAccountId?: string
): Promise<{ success: boolean; transferId?: string; message: string; error?: string }> {
  try {
    const account = await getAccountByClerkId(workerId)
    if (!account) {
      return {
        success: false,
        message: "I couldn't find your payment account.",
        error: 'Account not found',
      }
    }

    if (account.grainBalance < amount) {
      return {
        success: false,
        message: `Insufficient balance. You have ${formatGrain(account.grainBalance)} available.`,
        error: 'Insufficient balance',
      }
    }

    // If transferring to another account
    if (targetAccountId) {
      const result = await transfer(account.id, targetAccountId, amount, 'Transfer to GRAIN account')
      if (result.success) {
        return {
          success: true,
          transferId: result.transferId,
          message: `Successfully transferred ${formatGrain(amount)} to your main GRAIN account.`,
        }
      } else {
        return {
          success: false,
          message: result.error || "Transfer failed",
          error: result.error,
        }
      }
    }

    // Otherwise, this is just a balance check/consolidation
    return {
      success: true,
      message: `Your current GRAIN balance is ${formatGrain(account.grainBalance)}. All funds are already consolidated.`,
    }
  } catch (error) {
    console.error('Error transferring to GRAIN account:', error)
    return {
      success: false,
      message: "Something went wrong with the transfer. Please try again.",
      error: error instanceof Error ? error.message : 'Failed to transfer',
    }
  }
}

// ============================================================================
// 5. ESCROW STATUS & HISTORY
// ============================================================================

/**
 * Get current escrow status for a task
 */
export async function getEscrowStatus(
  taskId: string
): Promise<{ escrow: TaskEscrow | null; milestones: EscrowMilestone[]; message: string }> {
  try {
    const escrowResult = await sql`
      SELECT * FROM job_task_escrows
      WHERE task_id = ${taskId}
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (escrowResult.rows.length === 0) {
      return {
        escrow: null,
        milestones: [],
        message: "No escrow found for this task. Payment may not have been set up yet.",
      }
    }

    const escrow = rowToEscrow(escrowResult.rows[0])

    // Get milestones
    const milestonesResult = await sql`
      SELECT * FROM job_escrow_milestones
      WHERE escrow_id = ${escrow.id}
      ORDER BY order_index ASC
    `

    const milestones: EscrowMilestone[] = milestonesResult.rows.map(row => ({
      id: row.id as string,
      escrowId: row.escrow_id as string,
      title: row.title as string,
      amount: parseFloat(row.amount as string),
      order: row.order_index as number,
      status: row.status as EscrowMilestone['status'],
      releasedAt: row.released_at ? new Date(row.released_at as string) : undefined,
      approvedBy: row.approved_by as string | undefined,
      approvedAt: row.approved_at ? new Date(row.approved_at as string) : undefined,
    }))

    // Build status message
    let message = ''
    switch (escrow.status) {
      case 'held':
        message = `${formatGrain(escrow.amountHeld)} is held in escrow. `;
        break
      case 'partial_released':
        message = `${formatGrain(escrow.amountReleased)} released, ${formatGrain(escrow.amountHeld - escrow.amountReleased)} still held. `;
        break
      case 'released':
        message = `All ${formatGrain(escrow.totalAmount)} has been released. `;
        break
      case 'refunded':
        message = `This escrow was refunded. `;
        break
      case 'disputed':
        message = `This escrow is in dispute. `;
        break
    }

    if (milestones.length > 0) {
      const completed = milestones.filter(m => m.status === 'released').length
      message += `Milestones: ${completed}/${milestones.length} completed.`
    }

    return { escrow, milestones, message }
  } catch (error) {
    console.error('Error getting escrow status:', error)
    return {
      escrow: null,
      milestones: [],
      message: "Something went wrong fetching the escrow status. Please try again.",
    }
  }
}

/**
 * Get full transaction history for an escrow
 */
export async function getEscrowHistory(
  taskId: string
): Promise<{ transactions: EscrowTransaction[]; message: string }> {
  try {
    // First get escrow ID
    const escrowResult = await sql`
      SELECT id FROM job_task_escrows WHERE task_id = ${taskId} LIMIT 1
    `

    if (escrowResult.rows.length === 0) {
      return {
        transactions: [],
        message: "No escrow found for this task.",
      }
    }

    const escrowId = escrowResult.rows[0].id

    // Get all transactions
    const txResult = await sql`
      SELECT * FROM job_escrow_transactions
      WHERE escrow_id = ${escrowId}
      ORDER BY created_at DESC
    `

    const transactions = txResult.rows.map(rowToTransaction)

    if (transactions.length === 0) {
      return {
        transactions: [],
        message: "No transactions found for this escrow yet.",
      }
    }

    // Build summary message
    const totalIn = transactions
      .filter(t => ['escrow_fund'].includes(t.type))
      .reduce((sum, t) => sum + t.amount, 0)

    const totalOut = transactions
      .filter(t => ['milestone_release', 'full_release', 'refund'].includes(t.type))
      .reduce((sum, t) => sum + t.amount, 0)

    const message = `${transactions.length} transactions found. Total funded: ${formatGrain(totalIn)}. Total released/refunded: ${formatGrain(totalOut)}.`

    return { transactions, message }
  } catch (error) {
    console.error('Error getting escrow history:', error)
    return {
      transactions: [],
      message: "Something went wrong fetching the transaction history.",
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const JobPaymentService = {
  // Constants
  FEE_RATES,
  ATTRIBUTION_DISTRIBUTION,

  // Task Escrow
  escrowForTask,
  releaseEscrow,
  refundEscrow,

  // Fee Structure
  calculateFees,
  deductFees,

  // Attribution Payouts
  processAttributionPayouts,

  // Worker Payouts
  getWorkerBalance,
  withdrawToExternal,
  transferToGrainAccount,

  // Escrow Status
  getEscrowStatus,
  getEscrowHistory,
}

export default JobPaymentService
