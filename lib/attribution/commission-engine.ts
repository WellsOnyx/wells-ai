// Attribution Commission Engine
// Calculates and distributes commissions when deals close

import { sqlQuery as sql } from '@/lib/db'
import {
  AttrClosure,
  AttrCommission,
  CommissionCalculation,
  CreateClosureInput,
  ClosureStatus,
  CommissionStatus,
  GRAIN_RATE,
  usdToGrain,
} from './types'
import { getOfferById, closeOffer } from './offer-service'
import { getIntroductionById, markIntroductionConverted } from './introduction-service'

// ============================================================================
// HELPERS
// ============================================================================

function rowToClosure(row: Record<string, unknown>): AttrClosure {
  return {
    id: row.id as string,
    offerId: row.offer_id as string,
    introductionId: row.introduction_id as string | undefined,
    closerId: row.closer_id as string,
    closerName: row.closer_name as string | undefined,
    actualValue: parseFloat(row.actual_value as string),
    currency: row.currency as string,
    l1UserId: row.l1_user_id as string | undefined,
    l2UserId: row.l2_user_id as string | undefined,
    l3UserId: row.l3_user_id as string | undefined,
    l4UserId: row.l4_user_id as string | undefined,
    l1Pct: row.l1_pct ? parseFloat(row.l1_pct as string) : undefined,
    l2Pct: row.l2_pct ? parseFloat(row.l2_pct as string) : undefined,
    l3Pct: row.l3_pct ? parseFloat(row.l3_pct as string) : undefined,
    l4Pct: row.l4_pct ? parseFloat(row.l4_pct as string) : undefined,
    status: row.status as ClosureStatus,
    externalDealId: row.external_deal_id as string | undefined,
    proofUrl: row.proof_url as string | undefined,
    notes: row.notes as string | undefined,
    createdAt: new Date(row.created_at as string),
    verifiedAt: row.verified_at ? new Date(row.verified_at as string) : undefined,
    paidAt: row.paid_at ? new Date(row.paid_at as string) : undefined,
    updatedAt: new Date(row.updated_at as string),
  }
}

function rowToCommission(row: Record<string, unknown>): AttrCommission {
  return {
    id: row.id as string,
    closureId: row.closure_id as string,
    offerId: row.offer_id as string,
    recipientId: row.recipient_id as string,
    recipientName: row.recipient_name as string | undefined,
    level: row.level as 1 | 2 | 3 | 4,
    dealValue: parseFloat(row.deal_value as string),
    commissionPct: parseFloat(row.commission_pct as string),
    commissionUsd: parseFloat(row.commission_usd as string),
    grainAmount: parseInt(row.grain_amount as string, 10),
    grainRate: parseFloat(row.grain_rate as string),
    status: row.status as CommissionStatus,
    grainTxId: row.grain_tx_id as string | undefined,
    createdAt: new Date(row.created_at as string),
    creditedAt: row.credited_at ? new Date(row.credited_at as string) : undefined,
  }
}

// ============================================================================
// COMMISSION CALCULATION
// ============================================================================

/**
 * Calculate commissions for a deal closure
 *
 * Flow: Deal closes → Commission flows UP the chain
 *
 * Example: $100,000 deal, L1=10%, L2=5%, L3=3%, L4=2%
 * Chain: Alice(owner) → Bob(L1) → Carol(L2) → David(L3) → [Contact closes]
 *
 * David (L3): $3,000 → 3,000,000 GRAIN
 * Carol (L2): $5,000 → 5,000,000 GRAIN
 * Bob (L1): $10,000 → 10,000,000 GRAIN
 * Alice: Gets the deal (no commission - she's the owner)
 */
export function calculateCommissions(
  dealValue: number,
  commissionPcts: {
    l1?: number
    l2?: number
    l3?: number
    l4?: number
  },
  chain: {
    l1UserId?: string
    l2UserId?: string
    l3UserId?: string
    l4UserId?: string
  },
  userNames?: {
    l1Name?: string
    l2Name?: string
    l3Name?: string
    l4Name?: string
  }
): CommissionCalculation[] {
  const commissions: CommissionCalculation[] = []

  // L1 commission
  if (chain.l1UserId && commissionPcts.l1 && commissionPcts.l1 > 0) {
    const usd = dealValue * (commissionPcts.l1 / 100)
    commissions.push({
      recipientId: chain.l1UserId,
      recipientName: userNames?.l1Name,
      level: 1,
      commissionPct: commissionPcts.l1,
      commissionUsd: usd,
      grainAmount: usdToGrain(usd),
    })
  }

  // L2 commission
  if (chain.l2UserId && commissionPcts.l2 && commissionPcts.l2 > 0) {
    const usd = dealValue * (commissionPcts.l2 / 100)
    commissions.push({
      recipientId: chain.l2UserId,
      recipientName: userNames?.l2Name,
      level: 2,
      commissionPct: commissionPcts.l2,
      commissionUsd: usd,
      grainAmount: usdToGrain(usd),
    })
  }

  // L3 commission
  if (chain.l3UserId && commissionPcts.l3 && commissionPcts.l3 > 0) {
    const usd = dealValue * (commissionPcts.l3 / 100)
    commissions.push({
      recipientId: chain.l3UserId,
      recipientName: userNames?.l3Name,
      level: 3,
      commissionPct: commissionPcts.l3,
      commissionUsd: usd,
      grainAmount: usdToGrain(usd),
    })
  }

  // L4 commission
  if (chain.l4UserId && commissionPcts.l4 && commissionPcts.l4 > 0) {
    const usd = dealValue * (commissionPcts.l4 / 100)
    commissions.push({
      recipientId: chain.l4UserId,
      recipientName: userNames?.l4Name,
      level: 4,
      commissionPct: commissionPcts.l4,
      commissionUsd: usd,
      grainAmount: usdToGrain(usd),
    })
  }

  return commissions
}

// ============================================================================
// QUERIES
// ============================================================================

export async function getClosureById(closureId: string): Promise<AttrClosure | null> {
  const result = await sql`
    SELECT * FROM attr_closures WHERE id = ${closureId}
  `
  if (result.rows.length === 0) return null
  return rowToClosure(result.rows[0])
}

export async function getOfferClosures(offerId: string): Promise<AttrClosure[]> {
  const result = await sql`
    SELECT * FROM attr_closures
    WHERE offer_id = ${offerId}
    ORDER BY created_at DESC
  `
  return result.rows.map(rowToClosure)
}

export async function getUserClosures(userId: string): Promise<AttrClosure[]> {
  const result = await sql`
    SELECT * FROM attr_closures
    WHERE closer_id = ${userId}
    ORDER BY created_at DESC
  `
  return result.rows.map(rowToClosure)
}

export async function getCommissionsByClosureId(closureId: string): Promise<AttrCommission[]> {
  const result = await sql`
    SELECT * FROM attr_commissions
    WHERE closure_id = ${closureId}
    ORDER BY level ASC
  `
  return result.rows.map(rowToCommission)
}

export async function getUserCommissions(userId: string): Promise<AttrCommission[]> {
  const result = await sql`
    SELECT * FROM attr_commissions
    WHERE recipient_id = ${userId}
    ORDER BY created_at DESC
  `
  return result.rows.map(rowToCommission)
}

export async function getUserEarnings(userId: string): Promise<{
  total: number
  totalGrain: number
  byLevel: { l1: number; l2: number; l3: number; l4: number }
  pending: number
  credited: number
}> {
  const result = await sql`
    SELECT
      COALESCE(SUM(commission_usd), 0) as total,
      COALESCE(SUM(grain_amount), 0) as total_grain,
      COALESCE(SUM(CASE WHEN level = 1 THEN commission_usd ELSE 0 END), 0) as l1,
      COALESCE(SUM(CASE WHEN level = 2 THEN commission_usd ELSE 0 END), 0) as l2,
      COALESCE(SUM(CASE WHEN level = 3 THEN commission_usd ELSE 0 END), 0) as l3,
      COALESCE(SUM(CASE WHEN level = 4 THEN commission_usd ELSE 0 END), 0) as l4,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_usd ELSE 0 END), 0) as pending,
      COALESCE(SUM(CASE WHEN status = 'credited' THEN commission_usd ELSE 0 END), 0) as credited
    FROM attr_commissions
    WHERE recipient_id = ${userId}
  `

  const row = result.rows[0] || {}
  return {
    total: parseFloat(row.total || '0'),
    totalGrain: parseInt(row.total_grain || '0', 10),
    byLevel: {
      l1: parseFloat(row.l1 || '0'),
      l2: parseFloat(row.l2 || '0'),
      l3: parseFloat(row.l3 || '0'),
      l4: parseFloat(row.l4 || '0'),
    },
    pending: parseFloat(row.pending || '0'),
    credited: parseFloat(row.credited || '0'),
  }
}

// ============================================================================
// MUTATIONS
// ============================================================================

export async function createClosure(
  userId: string,
  input: CreateClosureInput,
  closerName?: string
): Promise<{
  closure: AttrClosure
  commissions: CommissionCalculation[]
}> {
  const offer = await getOfferById(input.offerId)
  if (!offer) {
    throw new Error('Offer not found')
  }

  // Only owner can close a deal
  if (offer.ownerId !== userId) {
    throw new Error('Only the offer owner can close a deal')
  }

  // Get the introduction chain if provided
  let intro = null
  let chain = {
    l1UserId: undefined as string | undefined,
    l2UserId: undefined as string | undefined,
    l3UserId: undefined as string | undefined,
    l4UserId: undefined as string | undefined,
  }

  if (input.introductionId) {
    intro = await getIntroductionById(input.introductionId)
    if (intro) {
      chain = {
        l1UserId: intro.l1UserId,
        l2UserId: intro.l2UserId,
        l3UserId: intro.l3UserId,
        l4UserId: intro.l4UserId,
      }
    }
  }

  // Create the closure
  const closureResult = await sql`
    INSERT INTO attr_closures (
      offer_id, introduction_id, closer_id, closer_name,
      actual_value, currency,
      l1_user_id, l2_user_id, l3_user_id, l4_user_id,
      l1_pct, l2_pct, l3_pct, l4_pct,
      status, external_deal_id, proof_url, notes
    )
    VALUES (
      ${input.offerId}, ${input.introductionId || null}, ${input.closerId}, ${closerName || null},
      ${input.actualValue}, 'USD',
      ${chain.l1UserId || null}, ${chain.l2UserId || null}, ${chain.l3UserId || null}, ${chain.l4UserId || null},
      ${offer.commissions.l1}, ${offer.commissions.l2}, ${offer.commissions.l3}, ${offer.commissions.l4},
      'pending', ${input.externalDealId || null}, ${input.proofUrl || null}, ${input.notes || null}
    )
    RETURNING *
  `

  const closure = rowToClosure(closureResult.rows[0])

  // Calculate commissions
  const commissions = calculateCommissions(
    input.actualValue,
    {
      l1: offer.commissions.l1,
      l2: offer.commissions.l2,
      l3: offer.commissions.l3,
      l4: offer.commissions.l4,
    },
    chain
  )

  // Insert commission records
  for (const comm of commissions) {
    await sql`
      INSERT INTO attr_commissions (
        closure_id, offer_id, recipient_id, recipient_name,
        level, deal_value, commission_pct, commission_usd,
        grain_amount, grain_rate, status
      )
      VALUES (
        ${closure.id}, ${input.offerId}, ${comm.recipientId}, ${comm.recipientName || null},
        ${comm.level}, ${input.actualValue}, ${comm.commissionPct}, ${comm.commissionUsd},
        ${comm.grainAmount}, ${GRAIN_RATE}, 'pending'
      )
    `
  }

  // Mark introduction as converted if applicable
  if (intro) {
    await markIntroductionConverted(intro.id)
  }

  return { closure, commissions }
}

export async function verifyClosure(closureId: string, userId: string): Promise<AttrClosure> {
  const closure = await getClosureById(closureId)
  if (!closure) {
    throw new Error('Closure not found')
  }

  const offer = await getOfferById(closure.offerId)
  if (!offer || offer.ownerId !== userId) {
    throw new Error('Not authorized to verify this closure')
  }

  if (closure.status !== 'pending') {
    throw new Error('Closure is not pending')
  }

  const result = await sql`
    UPDATE attr_closures
    SET status = 'verified',
        verified_at = NOW(),
        updated_at = NOW()
    WHERE id = ${closureId}
    RETURNING *
  `

  return rowToClosure(result.rows[0])
}

export async function payCommissions(closureId: string): Promise<AttrCommission[]> {
  const closure = await getClosureById(closureId)
  if (!closure) {
    throw new Error('Closure not found')
  }

  if (closure.status !== 'verified') {
    throw new Error('Closure must be verified before paying commissions')
  }

  // Get pending commissions
  const commissions = await getCommissionsByClosureId(closureId)
  const pendingCommissions = commissions.filter(c => c.status === 'pending')

  // Credit each commission
  for (const commission of pendingCommissions) {
    // Generate a transaction ID
    const txId = `attr_${commission.id}_${Date.now()}`

    // Credit GRAIN to the recipient's treasury account
    // This assumes treasury_accounts table exists from grain-vault
    try {
      await sql`
        UPDATE treasury_accounts
        SET grain_balance = grain_balance + ${commission.grainAmount},
            updated_at = NOW()
        WHERE user_id = ${commission.recipientId}
      `
    } catch {
      // If no treasury account, create one with the balance
      await sql`
        INSERT INTO treasury_accounts (user_id, grain_balance, created_at, updated_at)
        VALUES (${commission.recipientId}, ${commission.grainAmount}, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET grain_balance = treasury_accounts.grain_balance + ${commission.grainAmount},
            updated_at = NOW()
      `
    }

    // Update commission status
    await sql`
      UPDATE attr_commissions
      SET status = 'credited',
          grain_tx_id = ${txId},
          credited_at = NOW()
      WHERE id = ${commission.id}
    `
  }

  // Update closure status to paid
  await sql`
    UPDATE attr_closures
    SET status = 'paid',
        paid_at = NOW(),
        updated_at = NOW()
    WHERE id = ${closureId}
  `

  // Close the offer
  const offer = await getOfferById(closure.offerId)
  if (offer) {
    await closeOffer(offer.id, offer.ownerId)
  }

  // Return updated commissions
  return getCommissionsByClosureId(closureId)
}

export async function updateUserNetworkStats(userId: string): Promise<void> {
  await sql`
    INSERT INTO attr_network_stats (user_id, direct_connections, updated_at)
    VALUES (${userId}, 0, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      direct_connections = (
        SELECT COUNT(*) FROM attr_connections
        WHERE (requester_id = ${userId} OR accepter_id = ${userId}) AND status = 'active'
      ),
      total_offers_created = (
        SELECT COUNT(*) FROM attr_offers WHERE owner_id = ${userId}
      ),
      total_introductions_made = (
        SELECT COUNT(*) FROM attr_introductions WHERE introducer_id = ${userId}
      ),
      total_introductions_received = (
        SELECT COUNT(*) FROM attr_introductions WHERE recipient_id = ${userId}
      ),
      total_earned = (
        SELECT COALESCE(SUM(commission_usd), 0) FROM attr_commissions
        WHERE recipient_id = ${userId} AND status = 'credited'
      ),
      total_grain_earned = (
        SELECT COALESCE(SUM(grain_amount), 0) FROM attr_commissions
        WHERE recipient_id = ${userId} AND status = 'credited'
      ),
      updated_at = NOW()
  `
}
