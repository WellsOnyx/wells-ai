// @ts-nocheck
/**
 * Deals Database Service
 * Proper persistence for Wells AI transaction engine
 */

import { query } from './db'
import type { Deal, Party, DealTerms, DealStatus, NegotiationMessage } from './transactions'

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Create a new deal in the database
 */
export async function createDeal(deal: Deal): Promise<Deal> {
  await query(
    `INSERT INTO deals_v2 (
      id, buyer_id, buyer_name, buyer_email, buyer_wallet_id, buyer_wallet_address, buyer_trust_score,
      seller_id, seller_name, seller_email, seller_wallet_id, seller_wallet_address, seller_trust_score,
      amount, currency, description, deliverables, timeline, metadata,
      status, platform_fee, platform_fee_percent,
      escrow_wallet_id, escrow_wallet_address, escrow_balance, transfer_ids,
      messages, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13,
      $14, $15, $16, $17, $18, $19,
      $20, $21, $22,
      $23, $24, $25, $26,
      $27, $28, $29
    )`,
    [
      deal.id,
      deal.buyer.id, deal.buyer.name, deal.buyer.email, deal.buyer.walletId, deal.buyer.walletAddress, JSON.stringify(deal.buyer.trustScore || {}),
      deal.seller.id, deal.seller.name, deal.seller.email, deal.seller.walletId, deal.seller.walletAddress, JSON.stringify(deal.seller.trustScore || {}),
      deal.terms.amount, deal.terms.currency, deal.terms.description, JSON.stringify(deal.terms.deliverables), JSON.stringify(deal.terms.timeline || null), JSON.stringify(deal.terms.metadata || {}),
      deal.status, deal.platformFee, deal.platformFeePercent,
      deal.escrowWalletId, deal.escrowWalletAddress, deal.escrowBalance, JSON.stringify(deal.transferIds),
      JSON.stringify(deal.messages), deal.createdAt.toISOString(), deal.updatedAt.toISOString()
    ]
  )

  // Log event
  await logDealEvent(deal.id, 'created', deal.buyer.id, 'buyer', { status: deal.status })

  return deal
}

/**
 * Get a deal by ID
 */
export async function getDeal(dealId: string): Promise<Deal | null> {
  const result = await query<any>(
    `SELECT * FROM deals_v2 WHERE id = $1`,
    [dealId]
  )

  if (result.rows.length === 0) {
    return null
  }

  return rowToDeal(result.rows[0])
}

/**
 * Update a deal
 */
export async function updateDeal(deal: Deal): Promise<Deal> {
  await query(
    `UPDATE deals_v2 SET
      buyer_wallet_id = $1, buyer_wallet_address = $2, buyer_trust_score = $3,
      seller_wallet_id = $4, seller_wallet_address = $5, seller_trust_score = $6,
      amount = $7, description = $8, deliverables = $9, timeline = $10,
      status = $11, platform_fee = $12, platform_fee_percent = $13,
      escrow_wallet_id = $14, escrow_wallet_address = $15, escrow_balance = $16, transfer_ids = $17,
      messages = $18, updated_at = $19
    WHERE id = $20`,
    [
      deal.buyer.walletId, deal.buyer.walletAddress, JSON.stringify(deal.buyer.trustScore || {}),
      deal.seller.walletId, deal.seller.walletAddress, JSON.stringify(deal.seller.trustScore || {}),
      deal.terms.amount, deal.terms.description, JSON.stringify(deal.terms.deliverables), JSON.stringify(deal.terms.timeline || null),
      deal.status, deal.platformFee, deal.platformFeePercent,
      deal.escrowWalletId, deal.escrowWalletAddress, deal.escrowBalance, JSON.stringify(deal.transferIds),
      JSON.stringify(deal.messages), deal.updatedAt.toISOString(),
      deal.id
    ]
  )

  return deal
}

/**
 * Get all deals for a user (as buyer or seller)
 */
export async function getUserDeals(userId: string): Promise<Deal[]> {
  const result = await query<any>(
    `SELECT * FROM deals_v2
     WHERE buyer_id = $1 OR seller_id = $1
     ORDER BY created_at DESC`,
    [userId]
  )

  return result.rows.map(rowToDeal)
}

/**
 * Get deals by status
 */
export async function getDealsByStatus(status: DealStatus): Promise<Deal[]> {
  const result = await query<any>(
    `SELECT * FROM deals_v2 WHERE status = $1 ORDER BY created_at DESC`,
    [status]
  )

  return result.rows.map(rowToDeal)
}

/**
 * Log a deal event for audit trail
 */
export async function logDealEvent(
  dealId: string,
  eventType: string,
  actorId: string,
  actorType: 'buyer' | 'seller' | 'system',
  data: Record<string, any> = {}
): Promise<void> {
  await query(
    `INSERT INTO deal_events (deal_id, event_type, actor_id, actor_type, data)
     VALUES ($1, $2, $3, $4, $5)`,
    [dealId, eventType, actorId, actorType, JSON.stringify(data)]
  )
}

/**
 * Get events for a deal
 */
export async function getDealEvents(dealId: string): Promise<any[]> {
  const result = await query(
    `SELECT * FROM deal_events WHERE deal_id = $1 ORDER BY created_at ASC`,
    [dealId]
  )
  return result.rows
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert a database row to a Deal object
 */
function rowToDeal(row: any): Deal {
  return {
    id: row.id,
    buyer: {
      id: row.buyer_id,
      type: 'buyer',
      name: row.buyer_name || '',
      email: row.buyer_email || '',
      walletId: row.buyer_wallet_id,
      walletAddress: row.buyer_wallet_address,
      trustScore: parseJson(row.buyer_trust_score),
    },
    seller: {
      id: row.seller_id,
      type: 'seller',
      name: row.seller_name || '',
      email: row.seller_email || '',
      walletId: row.seller_wallet_id,
      walletAddress: row.seller_wallet_address,
      trustScore: parseJson(row.seller_trust_score),
    },
    terms: {
      amount: parseFloat(row.amount),
      currency: row.currency || 'GRAIN',
      description: row.description || '',
      deliverables: parseJson(row.deliverables) || [],
      timeline: parseJson(row.timeline),
      metadata: parseJson(row.metadata),
    },
    status: row.status as DealStatus,
    platformFee: parseFloat(row.platform_fee || 0),
    platformFeePercent: parseFloat(row.platform_fee_percent || 0),
    escrowWalletId: row.escrow_wallet_id,
    escrowWalletAddress: row.escrow_wallet_address,
    escrowBalance: parseFloat(row.escrow_balance || 0),
    transferIds: parseJson(row.transfer_ids) || [],
    messages: parseJson(row.messages) || [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function parseJson(value: any): any {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export default {
  createDeal,
  getDeal,
  updateDeal,
  getUserDeals,
  getDealsByStatus,
  logDealEvent,
  getDealEvents,
}
