// Attribution Offer Service
// Manages enterprise deals/opportunities with custom commission terms

import { sqlQuery as sql } from '@/lib/db'
import {
  AttrOffer,
  CreateOfferInput,
  UpdateOfferInput,
  OfferStatus,
  CommissionStructure,
} from './types'

// ============================================================================
// HELPERS
// ============================================================================

function rowToOffer(row: Record<string, unknown>): AttrOffer {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    ownerName: row.owner_name as string | undefined,
    title: row.title as string,
    description: row.description as string | undefined,
    value: parseFloat(row.value as string),
    currency: row.currency as string,
    commissions: {
      l1: parseFloat(row.l1_commission_pct as string),
      l2: parseFloat(row.l2_commission_pct as string),
      l3: parseFloat(row.l3_commission_pct as string),
      l4: parseFloat(row.l4_commission_pct as string),
    },
    status: row.status as OfferStatus,
    category: row.category as string | undefined,
    tags: row.tags as string[] | undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

// ============================================================================
// QUERIES
// ============================================================================

export async function getOfferById(offerId: string): Promise<AttrOffer | null> {
  const result = await sql`
    SELECT * FROM attr_offers WHERE id = ${offerId}
  `
  if (result.rows.length === 0) return null
  return rowToOffer(result.rows[0])
}

export async function getUserOffers(
  userId: string,
  status?: OfferStatus
): Promise<AttrOffer[]> {
  let result
  if (status) {
    result = await sql`
      SELECT * FROM attr_offers
      WHERE owner_id = ${userId} AND status = ${status}
      ORDER BY created_at DESC
    `
  } else {
    result = await sql`
      SELECT * FROM attr_offers
      WHERE owner_id = ${userId}
      ORDER BY created_at DESC
    `
  }
  return result.rows.map(rowToOffer)
}

export async function getActiveOffers(limit: number = 50): Promise<AttrOffer[]> {
  const result = await sql`
    SELECT * FROM attr_offers
    WHERE status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return result.rows.map(rowToOffer)
}

export async function getOffersIntroducedToUser(userId: string): Promise<AttrOffer[]> {
  const result = await sql`
    SELECT DISTINCT o.*
    FROM attr_offers o
    JOIN attr_introductions i ON i.offer_id = o.id
    WHERE i.recipient_id = ${userId}
      AND o.status = 'active'
    ORDER BY o.created_at DESC
  `
  return result.rows.map(rowToOffer)
}

export async function getOfferStats(offerId: string): Promise<{
  introductions: number
  conversions: number
  totalValue: number
}> {
  const [introResult, closureResult] = await Promise.all([
    sql`
      SELECT COUNT(*) as count FROM attr_introductions WHERE offer_id = ${offerId}
    `,
    sql`
      SELECT COUNT(*) as count, COALESCE(SUM(actual_value), 0) as total_value
      FROM attr_closures
      WHERE offer_id = ${offerId} AND status IN ('verified', 'paid')
    `,
  ])

  return {
    introductions: parseInt(introResult.rows[0]?.count || '0', 10),
    conversions: parseInt(closureResult.rows[0]?.count || '0', 10),
    totalValue: parseFloat(closureResult.rows[0]?.total_value || '0'),
  }
}

// ============================================================================
// MUTATIONS
// ============================================================================

export async function createOffer(
  ownerId: string,
  input: CreateOfferInput,
  ownerName?: string
): Promise<AttrOffer> {
  // Validate commissions (total shouldn't exceed 100%)
  const totalCommission = input.commissions.l1 + input.commissions.l2 +
    input.commissions.l3 + input.commissions.l4
  if (totalCommission > 100) {
    throw new Error('Total commission cannot exceed 100%')
  }

  // Validate each level is non-negative
  if (input.commissions.l1 < 0 || input.commissions.l2 < 0 ||
      input.commissions.l3 < 0 || input.commissions.l4 < 0) {
    throw new Error('Commission percentages cannot be negative')
  }

  const result = await sql`
    INSERT INTO attr_offers (
      owner_id, owner_name,
      title, description, value, currency,
      l1_commission_pct, l2_commission_pct, l3_commission_pct, l4_commission_pct,
      status, category, tags, expires_at
    )
    VALUES (
      ${ownerId}, ${ownerName || null},
      ${input.title}, ${input.description || null}, ${input.value}, ${input.currency || 'USD'},
      ${input.commissions.l1}, ${input.commissions.l2}, ${input.commissions.l3}, ${input.commissions.l4},
      'draft', ${input.category || null}, ${input.tags || null}, ${input.expiresAt?.toISOString() || null}
    )
    RETURNING *
  `

  return rowToOffer(result.rows[0])
}

export async function updateOffer(
  offerId: string,
  userId: string,
  input: UpdateOfferInput
): Promise<AttrOffer> {
  const offer = await getOfferById(offerId)
  if (!offer) {
    throw new Error('Offer not found')
  }
  if (offer.ownerId !== userId) {
    throw new Error('Not authorized to update this offer')
  }
  if (offer.status === 'closed') {
    throw new Error('Cannot update a closed offer')
  }

  // Build update query dynamically
  const updates: string[] = []
  const values: unknown[] = []

  if (input.title !== undefined) {
    updates.push('title = $' + (values.length + 1))
    values.push(input.title)
  }
  if (input.description !== undefined) {
    updates.push('description = $' + (values.length + 1))
    values.push(input.description)
  }
  if (input.value !== undefined) {
    updates.push('value = $' + (values.length + 1))
    values.push(input.value)
  }
  if (input.commissions) {
    if (input.commissions.l1 !== undefined) {
      updates.push('l1_commission_pct = $' + (values.length + 1))
      values.push(input.commissions.l1)
    }
    if (input.commissions.l2 !== undefined) {
      updates.push('l2_commission_pct = $' + (values.length + 1))
      values.push(input.commissions.l2)
    }
    if (input.commissions.l3 !== undefined) {
      updates.push('l3_commission_pct = $' + (values.length + 1))
      values.push(input.commissions.l3)
    }
    if (input.commissions.l4 !== undefined) {
      updates.push('l4_commission_pct = $' + (values.length + 1))
      values.push(input.commissions.l4)
    }
  }
  if (input.status !== undefined) {
    updates.push('status = $' + (values.length + 1))
    values.push(input.status)
  }
  if (input.category !== undefined) {
    updates.push('category = $' + (values.length + 1))
    values.push(input.category)
  }
  if (input.tags !== undefined) {
    updates.push('tags = $' + (values.length + 1))
    values.push(input.tags)
  }
  if (input.expiresAt !== undefined) {
    updates.push('expires_at = $' + (values.length + 1))
    values.push(input.expiresAt?.toISOString() || null)
  }

  if (updates.length === 0) {
    return offer
  }

  updates.push('updated_at = NOW()')

  // Use raw query for dynamic update
  const result = await sql`
    UPDATE attr_offers
    SET ${sql.unsafe(updates.join(', '))}
    WHERE id = ${offerId}
    RETURNING *
  `

  return rowToOffer(result.rows[0])
}

export async function activateOffer(offerId: string, userId: string): Promise<AttrOffer> {
  return updateOffer(offerId, userId, { status: 'active' })
}

export async function cancelOffer(offerId: string, userId: string): Promise<AttrOffer> {
  return updateOffer(offerId, userId, { status: 'cancelled' })
}

export async function closeOffer(offerId: string, userId: string): Promise<AttrOffer> {
  return updateOffer(offerId, userId, { status: 'closed' })
}
