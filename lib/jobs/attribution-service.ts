/**
 * Individual Attribution Service - Wells AI Job Marketplace
 *
 * Tracks attribution at the INDIVIDUAL level for the gig economy:
 * - Worker referrals: Who referred a worker to the platform
 * - Task sourcing: Who identified/created a task opportunity
 * - Match making: Who introduced a worker to a task poster
 * - Successful placement: Task completed successfully
 *
 * Commission flow from Wells Fee (10% of task payment):
 * - Referrer: 2% (who referred the worker)
 * - Sourcer: 2% (who sourced/identified the task)
 * - Introducer: 1% (who made the match/introduction)
 *
 * Supports 4-level attribution chains like the existing Attribution Network.
 */

import { sqlQuery as sql } from '@/lib/db'
import { getAccountByClerkId } from '@/lib/wells-payments'
import crypto from 'crypto'
import { GRAIN_RATE, usdToGrain, grainToUsd, formatGrain, formatUsd } from '@/lib/attribution/types'

// ============================================================================
// TYPES
// ============================================================================

export type AttributionDuration = 'first_task' | '3_months' | '1_year' | 'lifetime'
export type AttributionType = 'worker_referral' | 'task_source' | 'introduction' | 'placement'
export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface AttributionTerms {
  commissionPercent: number // Percentage of Wells fee (e.g., 20 = 20% of 10% fee = 2% of total)
  duration: AttributionDuration
  expiresAt?: Date
  maxPayouts?: number // Optional cap on number of payouts
}

export interface WorkerReferral {
  id: string
  referrerId: string
  referrerName?: string
  workerId: string
  workerName?: string
  terms: AttributionTerms
  tasksCompleted: number
  totalEarned: number
  isActive: boolean
  createdAt: Date
  expiresAt?: Date
}

export interface TaskSource {
  id: string
  sourcerId: string
  sourcerName?: string
  taskId: string
  taskTitle?: string
  terms: AttributionTerms
  wasCompleted: boolean
  amountEarned: number
  createdAt: Date
}

export interface Introduction {
  id: string
  introducerId: string
  introducerName?: string
  workerId: string
  workerName?: string
  taskId: string
  taskTitle?: string
  wasSuccessful: boolean
  amountEarned: number
  createdAt: Date
}

export interface AttributionPayout {
  id: string
  taskId: string
  attributionType: AttributionType
  recipientId: string
  recipientName?: string
  amount: number
  grainAmount: number
  level: number // 1-4 for chain depth
  status: PayoutStatus
  createdAt: Date
  paidAt?: Date
}

export interface AttributionBreakdown {
  referrals: Array<{ userId: string; userName?: string; amount: number; level: number }>
  sources: Array<{ userId: string; userName?: string; amount: number }>
  introductions: Array<{ userId: string; userName?: string; amount: number }>
  totalPayout: number
  wellsRetained: number
}

export interface AttributionHistory {
  payouts: AttributionPayout[]
  totalEarned: number
  byType: Record<AttributionType, number>
  byLevel: Record<number, number>
}

export interface AttributionStats {
  totalEarned: number
  totalGrainEarned: number
  byType: {
    workerReferral: number
    taskSource: number
    introduction: number
    placement: number
  }
  topReferrals: Array<{
    workerId: string
    workerName?: string
    earned: number
    tasksCompleted: number
  }>
  thisMonth: number
  lastMonth: number
  growth: number | null
  activeReferrals: number
  totalReferrals: number
}

export interface NetworkEarnings {
  l1: { users: number; earned: number }
  l2: { users: number; earned: number }
  l3: { users: number; earned: number }
  l4: { users: number; earned: number }
  total: number
  totalGrain: number
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Default commission rates (as percentage of Wells 10% fee)
export const DEFAULT_COMMISSION_RATES = {
  referrer: 20, // 20% of 10% = 2% of task total
  sourcer: 20,  // 20% of 10% = 2% of task total
  introducer: 10, // 10% of 10% = 1% of task total
} as const

// Platform fee rate
export const WELLS_FEE_RATE = 0.10 // 10%

// Duration mappings
const DURATION_DAYS: Record<AttributionDuration, number | null> = {
  'first_task': 1, // Special: only first task
  '3_months': 90,
  '1_year': 365,
  'lifetime': null, // No expiration
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return crypto.randomUUID()
}

function calculateExpiresAt(duration: AttributionDuration): Date | null {
  const days = DURATION_DAYS[duration]
  if (days === null) return null
  if (duration === 'first_task') return null // Special handling

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + days)
  return expiresAt
}

function isTermsExpired(terms: AttributionTerms, tasksCompleted: number): boolean {
  // Check first_task duration
  if (terms.duration === 'first_task' && tasksCompleted > 0) {
    return true
  }

  // Check date expiration
  if (terms.expiresAt && new Date() > terms.expiresAt) {
    return true
  }

  // Check max payouts
  if (terms.maxPayouts !== undefined && tasksCompleted >= terms.maxPayouts) {
    return true
  }

  return false
}

// ============================================================================
// 1. WORKER REFERRAL
// ============================================================================

/**
 * Record a worker referral - tracks who referred a worker to the platform.
 * The referrer earns commission on the worker's completed tasks.
 */
export async function recordWorkerReferral(
  referrerId: string,
  workerId: string,
  terms: AttributionTerms
): Promise<{ success: boolean; referral?: WorkerReferral; message: string }> {
  try {
    // Validate referrer exists
    const referrerResult = await sql`
      SELECT clerk_user_id, display_name FROM treasury_accounts
      WHERE clerk_user_id = ${referrerId}
    `
    const referrerName = referrerResult.rows[0]?.display_name as string | undefined

    // Check if referral already exists
    const existingResult = await sql`
      SELECT id FROM job_worker_referrals
      WHERE referrer_id = ${referrerId} AND worker_id = ${workerId}
    `

    if (existingResult.rows.length > 0) {
      return {
        success: false,
        message: `You've already referred this worker. Your existing referral terms apply.`,
      }
    }

    // Calculate expiration
    const expiresAt = calculateExpiresAt(terms.duration)

    // Create referral record
    const referralId = generateId()
    await sql`
      INSERT INTO job_worker_referrals (
        id, referrer_id, worker_id,
        commission_percent, duration, expires_at, max_payouts,
        tasks_completed, total_earned, is_active,
        created_at
      ) VALUES (
        ${referralId}, ${referrerId}, ${workerId},
        ${terms.commissionPercent}, ${terms.duration}, ${expiresAt}, ${terms.maxPayouts || null},
        0, 0, true,
        NOW()
      )
    `

    // Also update the 4-level attribution chain
    await updateAttributionChain(workerId, referrerId)

    const referral: WorkerReferral = {
      id: referralId,
      referrerId,
      referrerName,
      workerId,
      terms: {
        ...terms,
        expiresAt: expiresAt || undefined,
      },
      tasksCompleted: 0,
      totalEarned: 0,
      isActive: true,
      createdAt: new Date(),
      expiresAt: expiresAt || undefined,
    }

    const durationText = terms.duration === 'lifetime'
      ? 'for life'
      : terms.duration === 'first_task'
        ? 'for their first task'
        : `for ${terms.duration.replace('_', ' ')}`

    return {
      success: true,
      referral,
      message: `Referral recorded! You'll earn ${terms.commissionPercent}% of the platform fee when this worker completes tasks ${durationText}. Share your referral code with more workers to grow your network.`,
    }
  } catch (error) {
    console.error('Error recording worker referral:', error)
    return {
      success: false,
      message: `Failed to record referral: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Update the 4-level attribution chain for a worker
 */
async function updateAttributionChain(workerId: string, directReferrerId: string): Promise<void> {
  // Get the referrer's chain to build ours
  const referrerChainResult = await sql`
    SELECT l1_user_id, l2_user_id, l3_user_id
    FROM job_worker_attribution_chain
    WHERE worker_id = ${directReferrerId}
    LIMIT 1
  `

  let l1 = directReferrerId
  let l2: string | null = null
  let l3: string | null = null
  let l4: string | null = null

  if (referrerChainResult.rows.length > 0) {
    const chain = referrerChainResult.rows[0]
    // Shift everyone down one level
    l2 = chain.l1_user_id as string | null
    l3 = chain.l2_user_id as string | null
    l4 = chain.l3_user_id as string | null
  }

  // Insert or update the chain
  await sql`
    INSERT INTO job_worker_attribution_chain (
      id, worker_id, l1_user_id, l2_user_id, l3_user_id, l4_user_id, created_at
    ) VALUES (
      ${generateId()}, ${workerId}, ${l1}, ${l2}, ${l3}, ${l4}, NOW()
    )
    ON CONFLICT (worker_id) DO UPDATE SET
      l1_user_id = ${l1},
      l2_user_id = ${l2},
      l3_user_id = ${l3},
      l4_user_id = ${l4}
  `
}

// ============================================================================
// 2. TASK SOURCING
// ============================================================================

/**
 * Record a task source - tracks who identified/created a task opportunity.
 * The sourcer earns commission when the task is completed.
 */
export async function recordTaskSource(
  sourcerId: string,
  taskId: string,
  terms: AttributionTerms
): Promise<{ success: boolean; source?: TaskSource; message: string }> {
  try {
    // Get task info
    const taskResult = await sql`
      SELECT title FROM job_tasks WHERE id = ${taskId}
    `
    const taskTitle = taskResult.rows[0]?.title as string | undefined

    // Check if source already exists
    const existingResult = await sql`
      SELECT id FROM job_task_sources WHERE task_id = ${taskId}
    `

    if (existingResult.rows.length > 0) {
      return {
        success: false,
        message: `This task already has a sourcer attributed. Each task can only have one source.`,
      }
    }

    // Get sourcer name
    const sourcerResult = await sql`
      SELECT display_name FROM treasury_accounts WHERE clerk_user_id = ${sourcerId}
    `
    const sourcerName = sourcerResult.rows[0]?.display_name as string | undefined

    const sourceId = generateId()
    await sql`
      INSERT INTO job_task_sources (
        id, sourcer_id, task_id,
        commission_percent, was_completed, amount_earned,
        created_at
      ) VALUES (
        ${sourceId}, ${sourcerId}, ${taskId},
        ${terms.commissionPercent}, false, 0,
        NOW()
      )
    `

    const source: TaskSource = {
      id: sourceId,
      sourcerId,
      sourcerName,
      taskId,
      taskTitle,
      terms,
      wasCompleted: false,
      amountEarned: 0,
      createdAt: new Date(),
    }

    return {
      success: true,
      source,
      message: `Task source recorded! You'll earn ${terms.commissionPercent}% of the platform fee when "${taskTitle || 'this task'}" is completed. Good sourcing pays off!`,
    }
  } catch (error) {
    console.error('Error recording task source:', error)
    return {
      success: false,
      message: `Failed to record task source: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

// ============================================================================
// 3. INTRODUCTIONS
// ============================================================================

/**
 * Record an introduction - tracks who introduced a worker to a task poster.
 * The introducer earns commission if the task is completed successfully.
 */
export async function recordIntroduction(
  introducerId: string,
  workerId: string,
  taskId: string
): Promise<{ success: boolean; introduction?: Introduction; message: string }> {
  try {
    // Get task and worker info
    const taskResult = await sql`
      SELECT title FROM job_tasks WHERE id = ${taskId}
    `
    const taskTitle = taskResult.rows[0]?.title as string | undefined

    const workerResult = await sql`
      SELECT display_name FROM treasury_accounts WHERE clerk_user_id = ${workerId}
    `
    const workerName = workerResult.rows[0]?.display_name as string | undefined

    const introducerResult = await sql`
      SELECT display_name FROM treasury_accounts WHERE clerk_user_id = ${introducerId}
    `
    const introducerName = introducerResult.rows[0]?.display_name as string | undefined

    // Check if introduction already exists
    const existingResult = await sql`
      SELECT id FROM job_introductions
      WHERE introducer_id = ${introducerId}
        AND worker_id = ${workerId}
        AND task_id = ${taskId}
    `

    if (existingResult.rows.length > 0) {
      return {
        success: false,
        message: `You've already made this introduction. If the task is completed, you'll earn your commission.`,
      }
    }

    const introId = generateId()
    await sql`
      INSERT INTO job_introductions (
        id, introducer_id, worker_id, task_id,
        was_successful, amount_earned,
        created_at
      ) VALUES (
        ${introId}, ${introducerId}, ${workerId}, ${taskId},
        false, 0,
        NOW()
      )
    `

    const introduction: Introduction = {
      id: introId,
      introducerId,
      introducerName,
      workerId,
      workerName,
      taskId,
      taskTitle,
      wasSuccessful: false,
      amountEarned: 0,
      createdAt: new Date(),
    }

    return {
      success: true,
      introduction,
      message: `Introduction recorded! You've connected ${workerName || 'this worker'} with "${taskTitle || 'this task'}". If they complete it successfully, you'll earn ${DEFAULT_COMMISSION_RATES.introducer}% of the platform fee.`,
    }
  } catch (error) {
    console.error('Error recording introduction:', error)
    return {
      success: false,
      message: `Failed to record introduction: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

// ============================================================================
// 4. CALCULATE ATTRIBUTION PAYOUTS
// ============================================================================

/**
 * Calculate all attribution payouts for a completed task.
 * Returns breakdown of who gets what from the Wells fee.
 */
export async function calculateAttributionPayouts(
  taskId: string,
  paymentAmount: number
): Promise<{ success: boolean; breakdown?: AttributionBreakdown; message: string }> {
  try {
    // Get task assignment to find the worker
    const assignmentResult = await sql`
      SELECT worker_id, task_id FROM job_task_assignments
      WHERE task_id = ${taskId} AND status = 'completed'
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (assignmentResult.rows.length === 0) {
      return {
        success: false,
        message: `No completed assignment found for task ${taskId}`,
      }
    }

    const workerId = assignmentResult.rows[0].worker_id as string
    const wellsFee = paymentAmount * WELLS_FEE_RATE

    const breakdown: AttributionBreakdown = {
      referrals: [],
      sources: [],
      introductions: [],
      totalPayout: 0,
      wellsRetained: wellsFee,
    }

    // 1. Calculate referral payouts (4-level chain)
    const chainResult = await sql`
      SELECT l1_user_id, l2_user_id, l3_user_id, l4_user_id
      FROM job_worker_attribution_chain
      WHERE worker_id = ${workerId}
    `

    if (chainResult.rows.length > 0) {
      const chain = chainResult.rows[0]
      const levels = [
        { userId: chain.l1_user_id, level: 1, percent: 20 }, // 20% of fee = 2% of total
        { userId: chain.l2_user_id, level: 2, percent: 10 }, // 10% of fee = 1% of total
        { userId: chain.l3_user_id, level: 3, percent: 5 },  // 5% of fee = 0.5% of total
        { userId: chain.l4_user_id, level: 4, percent: 2 },  // 2% of fee = 0.2% of total
      ]

      for (const { userId, level, percent } of levels) {
        if (userId) {
          // Check if referral is still active
          const referralResult = await sql`
            SELECT is_active, tasks_completed, commission_percent, duration, expires_at
            FROM job_worker_referrals
            WHERE referrer_id = ${userId} AND worker_id = ${workerId}
          `

          let effectivePercent = percent
          if (referralResult.rows.length > 0) {
            const ref = referralResult.rows[0]
            if (!ref.is_active) continue

            // Check expiration
            const terms: AttributionTerms = {
              commissionPercent: parseFloat(ref.commission_percent as string),
              duration: ref.duration as AttributionDuration,
              expiresAt: ref.expires_at ? new Date(ref.expires_at as string) : undefined,
            }
            if (isTermsExpired(terms, parseInt(ref.tasks_completed as string, 10))) {
              continue
            }
            effectivePercent = terms.commissionPercent
          }

          const amount = (wellsFee * effectivePercent) / 100
          const userName = await getUserName(userId as string)
          breakdown.referrals.push({
            userId: userId as string,
            userName,
            amount,
            level,
          })
          breakdown.totalPayout += amount
        }
      }
    }

    // 2. Calculate task source payout
    const sourceResult = await sql`
      SELECT sourcer_id, commission_percent
      FROM job_task_sources
      WHERE task_id = ${taskId}
    `

    if (sourceResult.rows.length > 0) {
      const source = sourceResult.rows[0]
      const percent = parseFloat(source.commission_percent as string) || DEFAULT_COMMISSION_RATES.sourcer
      const amount = (wellsFee * percent) / 100
      const userName = await getUserName(source.sourcer_id as string)
      breakdown.sources.push({
        userId: source.sourcer_id as string,
        userName,
        amount,
      })
      breakdown.totalPayout += amount
    }

    // 3. Calculate introduction payout
    const introResult = await sql`
      SELECT introducer_id
      FROM job_introductions
      WHERE task_id = ${taskId} AND worker_id = ${workerId}
    `

    if (introResult.rows.length > 0) {
      const intro = introResult.rows[0]
      const amount = (wellsFee * DEFAULT_COMMISSION_RATES.introducer) / 100
      const userName = await getUserName(intro.introducer_id as string)
      breakdown.introductions.push({
        userId: intro.introducer_id as string,
        userName,
        amount,
      })
      breakdown.totalPayout += amount
    }

    breakdown.wellsRetained = wellsFee - breakdown.totalPayout

    const totalPayoutFormatted = formatUsd(breakdown.totalPayout)
    const wellsRetainedFormatted = formatUsd(breakdown.wellsRetained)

    return {
      success: true,
      breakdown,
      message: `Attribution calculated for $${paymentAmount} task. Payouts: ${totalPayoutFormatted} (${breakdown.referrals.length} referrers, ${breakdown.sources.length} sourcers, ${breakdown.introductions.length} introducers). Wells retains: ${wellsRetainedFormatted}.`,
    }
  } catch (error) {
    console.error('Error calculating attribution payouts:', error)
    return {
      success: false,
      message: `Failed to calculate attribution: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

async function getUserName(userId: string): Promise<string | undefined> {
  try {
    const result = await sql`
      SELECT display_name FROM treasury_accounts WHERE clerk_user_id = ${userId}
    `
    return result.rows[0]?.display_name as string | undefined
  } catch {
    return undefined
  }
}

// ============================================================================
// 5. PROCESS ATTRIBUTION PAYOUTS
// ============================================================================

/**
 * Execute GRAIN transfers for all attribution payouts on a completed task.
 * This is called after task payment is released.
 */
export async function processAttributionPayouts(
  taskId: string
): Promise<{ success: boolean; payouts: AttributionPayout[]; message: string }> {
  try {
    // First calculate what's owed
    const paymentResult = await sql`
      SELECT amount FROM job_task_escrows
      WHERE task_id = ${taskId} AND status = 'released'
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (paymentResult.rows.length === 0) {
      return {
        success: false,
        payouts: [],
        message: `No released payment found for task ${taskId}. Attribution can only be processed after payment is released.`,
      }
    }

    const paymentAmount = parseFloat(paymentResult.rows[0].amount as string)
    const calcResult = await calculateAttributionPayouts(taskId, paymentAmount)

    if (!calcResult.success || !calcResult.breakdown) {
      return {
        success: false,
        payouts: [],
        message: calcResult.message,
      }
    }

    const breakdown = calcResult.breakdown
    const payouts: AttributionPayout[] = []
    let totalPaid = 0

    // Process referral payouts
    for (const ref of breakdown.referrals) {
      const payout = await executeGrainPayout(
        taskId,
        'worker_referral',
        ref.userId,
        ref.userName,
        ref.amount,
        ref.level
      )
      if (payout) {
        payouts.push(payout)
        totalPaid += ref.amount

        // Update referral stats
        await sql`
          UPDATE job_worker_referrals
          SET tasks_completed = tasks_completed + 1,
              total_earned = total_earned + ${ref.amount}
          WHERE referrer_id = ${ref.userId}
        `
      }
    }

    // Process source payouts
    for (const source of breakdown.sources) {
      const payout = await executeGrainPayout(
        taskId,
        'task_source',
        source.userId,
        source.userName,
        source.amount,
        1
      )
      if (payout) {
        payouts.push(payout)
        totalPaid += source.amount

        // Update source record
        await sql`
          UPDATE job_task_sources
          SET was_completed = true, amount_earned = ${source.amount}
          WHERE task_id = ${taskId} AND sourcer_id = ${source.userId}
        `
      }
    }

    // Process introduction payouts
    for (const intro of breakdown.introductions) {
      const payout = await executeGrainPayout(
        taskId,
        'introduction',
        intro.userId,
        intro.userName,
        intro.amount,
        1
      )
      if (payout) {
        payouts.push(payout)
        totalPaid += intro.amount

        // Update introduction record
        await sql`
          UPDATE job_introductions
          SET was_successful = true, amount_earned = ${intro.amount}
          WHERE task_id = ${taskId} AND introducer_id = ${intro.userId}
        `
      }
    }

    return {
      success: true,
      payouts,
      message: `Attribution payouts complete! ${payouts.length} payments totaling ${formatUsd(totalPaid)} (${formatGrain(usdToGrain(totalPaid))} GRAIN) have been distributed to your network.`,
    }
  } catch (error) {
    console.error('Error processing attribution payouts:', error)
    return {
      success: false,
      payouts: [],
      message: `Failed to process payouts: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

async function executeGrainPayout(
  taskId: string,
  attributionType: AttributionType,
  recipientId: string,
  recipientName: string | undefined,
  amount: number,
  level: number
): Promise<AttributionPayout | null> {
  try {
    const grainAmount = usdToGrain(amount)
    const payoutId = generateId()

    // Credit recipient's GRAIN balance
    await sql`
      UPDATE treasury_accounts
      SET grain_balance = grain_balance + ${grainAmount},
          updated_at = NOW()
      WHERE clerk_user_id = ${recipientId}
    `

    // Record the payout
    await sql`
      INSERT INTO job_attribution_payouts (
        id, task_id, attribution_type, recipient_id, recipient_name,
        amount, grain_amount, level, status, created_at, paid_at
      ) VALUES (
        ${payoutId}, ${taskId}, ${attributionType}, ${recipientId}, ${recipientName || null},
        ${amount}, ${grainAmount}, ${level}, 'completed', NOW(), NOW()
      )
    `

    // Record GRAIN transaction
    const account = await getAccountByClerkId(recipientId)
    if (account) {
      await sql`
        INSERT INTO grain_transactions (
          id, account_id, type, status,
          grain_amount, description, created_at
        ) VALUES (
          ${generateId()}, ${account.id}, 'attribution_payout', 'completed',
          ${grainAmount}, ${`${attributionType.replace('_', ' ')} payout (L${level})`}, NOW()
        )
      `
    }

    return {
      id: payoutId,
      taskId,
      attributionType,
      recipientId,
      recipientName,
      amount,
      grainAmount,
      level,
      status: 'completed',
      createdAt: new Date(),
      paidAt: new Date(),
    }
  } catch (error) {
    console.error(`Error executing payout to ${recipientId}:`, error)
    return null
  }
}

// ============================================================================
// 6. GET ATTRIBUTION HISTORY
// ============================================================================

/**
 * Get all attribution earnings for a user.
 */
export async function getAttributionHistory(
  userId: string
): Promise<{ success: boolean; history?: AttributionHistory; message: string }> {
  try {
    const result = await sql`
      SELECT
        id, task_id, attribution_type, recipient_id, recipient_name,
        amount, grain_amount, level, status, created_at, paid_at
      FROM job_attribution_payouts
      WHERE recipient_id = ${userId}
      ORDER BY created_at DESC
    `

    const payouts: AttributionPayout[] = result.rows.map(row => ({
      id: row.id as string,
      taskId: row.task_id as string,
      attributionType: row.attribution_type as AttributionType,
      recipientId: row.recipient_id as string,
      recipientName: row.recipient_name as string | undefined,
      amount: parseFloat(row.amount as string),
      grainAmount: parseInt(row.grain_amount as string, 10),
      level: parseInt(row.level as string, 10),
      status: row.status as PayoutStatus,
      createdAt: new Date(row.created_at as string),
      paidAt: row.paid_at ? new Date(row.paid_at as string) : undefined,
    }))

    const history: AttributionHistory = {
      payouts,
      totalEarned: payouts.reduce((sum, p) => sum + p.amount, 0),
      byType: {
        worker_referral: 0,
        task_source: 0,
        introduction: 0,
        placement: 0,
      },
      byLevel: { 1: 0, 2: 0, 3: 0, 4: 0 },
    }

    for (const payout of payouts) {
      history.byType[payout.attributionType] += payout.amount
      if (payout.level >= 1 && payout.level <= 4) {
        history.byLevel[payout.level] += payout.amount
      }
    }

    const totalFormatted = formatUsd(history.totalEarned)

    return {
      success: true,
      history,
      message: `You've earned ${totalFormatted} in attribution across ${payouts.length} payouts. Keep building your network to earn more!`,
    }
  } catch (error) {
    console.error('Error getting attribution history:', error)
    return {
      success: false,
      message: `Failed to get attribution history: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

// ============================================================================
// 7. GET ATTRIBUTION STATS
// ============================================================================

/**
 * Get comprehensive attribution statistics for a user.
 */
export async function getAttributionStats(
  userId: string
): Promise<{ success: boolean; stats?: AttributionStats; message: string }> {
  try {
    // Get totals by type
    const typeResult = await sql`
      SELECT
        attribution_type,
        SUM(amount) as total,
        SUM(grain_amount) as total_grain
      FROM job_attribution_payouts
      WHERE recipient_id = ${userId} AND status = 'completed'
      GROUP BY attribution_type
    `

    const byType = {
      workerReferral: 0,
      taskSource: 0,
      introduction: 0,
      placement: 0,
    }

    let totalEarned = 0
    let totalGrainEarned = 0

    for (const row of typeResult.rows) {
      const amount = parseFloat(row.total as string)
      const grain = parseInt(row.total_grain as string, 10)
      totalEarned += amount
      totalGrainEarned += grain

      switch (row.attribution_type) {
        case 'worker_referral':
          byType.workerReferral = amount
          break
        case 'task_source':
          byType.taskSource = amount
          break
        case 'introduction':
          byType.introduction = amount
          break
        case 'placement':
          byType.placement = amount
          break
      }
    }

    // Get monthly stats
    const monthlyResult = await sql`
      SELECT
        SUM(CASE WHEN created_at >= DATE_TRUNC('month', NOW()) THEN amount ELSE 0 END) as this_month,
        SUM(CASE WHEN created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
                 AND created_at < DATE_TRUNC('month', NOW()) THEN amount ELSE 0 END) as last_month
      FROM job_attribution_payouts
      WHERE recipient_id = ${userId} AND status = 'completed'
    `

    const thisMonth = parseFloat(monthlyResult.rows[0]?.this_month || '0')
    const lastMonth = parseFloat(monthlyResult.rows[0]?.last_month || '0')
    const growth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : null

    // Get top referrals
    const topResult = await sql`
      SELECT
        worker_id,
        total_earned,
        tasks_completed
      FROM job_worker_referrals
      WHERE referrer_id = ${userId}
      ORDER BY total_earned DESC
      LIMIT 5
    `

    const topReferrals = await Promise.all(
      topResult.rows.map(async (row) => ({
        workerId: row.worker_id as string,
        workerName: await getUserName(row.worker_id as string),
        earned: parseFloat(row.total_earned as string),
        tasksCompleted: parseInt(row.tasks_completed as string, 10),
      }))
    )

    // Get referral counts
    const countResult = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN is_active THEN 1 END) as active
      FROM job_worker_referrals
      WHERE referrer_id = ${userId}
    `

    const stats: AttributionStats = {
      totalEarned,
      totalGrainEarned,
      byType,
      topReferrals,
      thisMonth,
      lastMonth,
      growth,
      activeReferrals: parseInt(countResult.rows[0]?.active || '0', 10),
      totalReferrals: parseInt(countResult.rows[0]?.total || '0', 10),
    }

    return {
      success: true,
      stats,
      message: `You've earned ${formatUsd(totalEarned)} (${formatGrain(totalGrainEarned)} GRAIN) from ${stats.totalReferrals} referrals. ${stats.activeReferrals} are actively earning. ${growth !== null && growth > 0 ? `Nice! You're up ${growth.toFixed(1)}% this month!` : 'Keep growing your network!'}`,
    }
  } catch (error) {
    console.error('Error getting attribution stats:', error)
    return {
      success: false,
      message: `Failed to get stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

// ============================================================================
// 8. GET NETWORK EARNINGS
// ============================================================================

/**
 * Get earnings from the entire referral network (4 levels deep).
 */
export async function getNetworkEarnings(
  userId: string
): Promise<{ success: boolean; earnings?: NetworkEarnings; message: string }> {
  try {
    const result = await sql`
      SELECT
        level,
        COUNT(DISTINCT recipient_id) as users,
        SUM(amount) as earned,
        SUM(grain_amount) as grain_earned
      FROM job_attribution_payouts
      WHERE recipient_id = ${userId}
        AND attribution_type = 'worker_referral'
        AND status = 'completed'
      GROUP BY level
      ORDER BY level
    `

    const earnings: NetworkEarnings = {
      l1: { users: 0, earned: 0 },
      l2: { users: 0, earned: 0 },
      l3: { users: 0, earned: 0 },
      l4: { users: 0, earned: 0 },
      total: 0,
      totalGrain: 0,
    }

    for (const row of result.rows) {
      const level = parseInt(row.level as string, 10)
      const users = parseInt(row.users as string, 10)
      const earned = parseFloat(row.earned as string)
      const grain = parseInt(row.grain_earned as string, 10)

      earnings.total += earned
      earnings.totalGrain += grain

      switch (level) {
        case 1:
          earnings.l1 = { users, earned }
          break
        case 2:
          earnings.l2 = { users, earned }
          break
        case 3:
          earnings.l3 = { users, earned }
          break
        case 4:
          earnings.l4 = { users, earned }
          break
      }
    }

    const totalUsers = earnings.l1.users + earnings.l2.users + earnings.l3.users + earnings.l4.users

    return {
      success: true,
      earnings,
      message: `Your network spans ${totalUsers} users across 4 levels, generating ${formatUsd(earnings.total)} (${formatGrain(earnings.totalGrain)} GRAIN). L1 direct referrals earn you the most at ${formatUsd(earnings.l1.earned)}.`,
    }
  } catch (error) {
    console.error('Error getting network earnings:', error)
    return {
      success: false,
      message: `Failed to get network earnings: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

// ============================================================================
// 9. PARSE ATTRIBUTION TERMS FROM TEXT
// ============================================================================

/**
 * Parse attribution terms from natural language.
 * Examples:
 * - "Give them 5% of my first 3 tasks"
 * - "10% for lifetime"
 * - "2% for 1 year"
 * - "5% for 3 months, max 10 payouts"
 */
export async function parseAttributionTermsFromText(
  text: string
): Promise<{ success: boolean; terms?: AttributionTerms; message: string }> {
  try {
    const lowerText = text.toLowerCase()

    // Extract percentage
    const percentMatch = lowerText.match(/(\d+(?:\.\d+)?)\s*%/)
    if (!percentMatch) {
      return {
        success: false,
        message: `I couldn't find a percentage in "${text}". Try something like "5% for 3 months" or "10% lifetime".`,
      }
    }
    const commissionPercent = parseFloat(percentMatch[1])

    // Validate percentage
    if (commissionPercent <= 0 || commissionPercent > 50) {
      return {
        success: false,
        message: `${commissionPercent}% seems off. Commission rates should be between 0.1% and 50%.`,
      }
    }

    // Extract duration
    let duration: AttributionDuration = '1_year' // default

    if (lowerText.includes('lifetime') || lowerText.includes('forever') || lowerText.includes('always')) {
      duration = 'lifetime'
    } else if (lowerText.includes('first task') || lowerText.includes('first 1 task')) {
      duration = 'first_task'
    } else if (lowerText.includes('3 month') || lowerText.includes('three month')) {
      duration = '3_months'
    } else if (lowerText.includes('1 year') || lowerText.includes('one year') || lowerText.includes('year')) {
      duration = '1_year'
    } else if (lowerText.match(/first\s+(\d+)\s+task/)) {
      // "first 3 tasks" etc - use maxPayouts
      const taskMatch = lowerText.match(/first\s+(\d+)\s+task/)
      const maxPayouts = parseInt(taskMatch![1], 10)
      return {
        success: true,
        terms: {
          commissionPercent,
          duration: 'lifetime',
          maxPayouts,
        },
        message: `Got it! ${commissionPercent}% commission for the first ${maxPayouts} completed tasks.`,
      }
    }

    // Extract max payouts if mentioned
    let maxPayouts: number | undefined
    const maxMatch = lowerText.match(/max(?:imum)?\s*(\d+)/)
    if (maxMatch) {
      maxPayouts = parseInt(maxMatch[1], 10)
    }

    const terms: AttributionTerms = {
      commissionPercent,
      duration,
      maxPayouts,
      expiresAt: calculateExpiresAt(duration) || undefined,
    }

    const durationText = duration === 'lifetime'
      ? 'for lifetime'
      : duration === 'first_task'
        ? 'for their first task only'
        : `for ${duration.replace('_', ' ')}`

    return {
      success: true,
      terms,
      message: `Understood! ${commissionPercent}% commission ${durationText}${maxPayouts ? `, up to ${maxPayouts} payouts` : ''}.`,
    }
  } catch (error) {
    console.error('Error parsing attribution terms:', error)
    return {
      success: false,
      message: `I had trouble understanding "${text}". Try "5% for 3 months" or "10% lifetime".`,
    }
  }
}

// ============================================================================
// 10. SET DEFAULT ATTRIBUTION TERMS
// ============================================================================

/**
 * Set a user's default referral terms for new referrals.
 */
export async function setDefaultAttributionTerms(
  userId: string,
  terms: AttributionTerms
): Promise<{ success: boolean; message: string }> {
  try {
    await sql`
      INSERT INTO job_user_attribution_defaults (
        id, user_id, commission_percent, duration, max_payouts, created_at, updated_at
      ) VALUES (
        ${generateId()}, ${userId}, ${terms.commissionPercent}, ${terms.duration},
        ${terms.maxPayouts || null}, NOW(), NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        commission_percent = ${terms.commissionPercent},
        duration = ${terms.duration},
        max_payouts = ${terms.maxPayouts || null},
        updated_at = NOW()
    `

    const durationText = terms.duration === 'lifetime'
      ? 'for lifetime'
      : terms.duration === 'first_task'
        ? 'for first task only'
        : `for ${terms.duration.replace('_', ' ')}`

    return {
      success: true,
      message: `Default referral terms set: ${terms.commissionPercent}% commission ${durationText}${terms.maxPayouts ? `, up to ${terms.maxPayouts} payouts` : ''}. New referrals will use these terms automatically.`,
    }
  } catch (error) {
    console.error('Error setting default terms:', error)
    return {
      success: false,
      message: `Failed to set default terms: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Get a user's default attribution terms.
 */
export async function getDefaultAttributionTerms(
  userId: string
): Promise<{ success: boolean; terms?: AttributionTerms; message: string }> {
  try {
    const result = await sql`
      SELECT commission_percent, duration, max_payouts
      FROM job_user_attribution_defaults
      WHERE user_id = ${userId}
    `

    if (result.rows.length === 0) {
      return {
        success: true,
        terms: {
          commissionPercent: DEFAULT_COMMISSION_RATES.referrer,
          duration: '1_year',
        },
        message: `No custom defaults set. Using platform default: ${DEFAULT_COMMISSION_RATES.referrer}% for 1 year.`,
      }
    }

    const row = result.rows[0]
    const terms: AttributionTerms = {
      commissionPercent: parseFloat(row.commission_percent as string),
      duration: row.duration as AttributionDuration,
      maxPayouts: row.max_payouts ? parseInt(row.max_payouts as string, 10) : undefined,
    }

    return {
      success: true,
      terms,
      message: `Your default terms: ${terms.commissionPercent}% for ${terms.duration.replace('_', ' ')}${terms.maxPayouts ? `, max ${terms.maxPayouts} payouts` : ''}.`,
    }
  } catch (error) {
    console.error('Error getting default terms:', error)
    return {
      success: false,
      message: `Failed to get default terms: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

// ============================================================================
// EXPORTED SERVICE
// ============================================================================

export const AttributionService = {
  // Constants
  DEFAULT_COMMISSION_RATES,
  WELLS_FEE_RATE,

  // Core Functions
  recordWorkerReferral,
  recordTaskSource,
  recordIntroduction,
  calculateAttributionPayouts,
  processAttributionPayouts,

  // Query Functions
  getAttributionHistory,
  getAttributionStats,
  getNetworkEarnings,

  // Configuration
  parseAttributionTermsFromText,
  setDefaultAttributionTerms,
  getDefaultAttributionTerms,
}

export default AttributionService
