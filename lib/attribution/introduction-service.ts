// Attribution Introduction Service
// Manages offer introductions through the network with chain tracking

import { sqlQuery as sql } from '@/lib/db'
import {
  AttrIntroduction,
  IntroductionStatus,
  IntroductionChain,
  MAX_LEVELS,
} from './types'
import { getOfferById } from './offer-service'
import { areUsersConnected } from './connection-service'

// ============================================================================
// HELPERS
// ============================================================================

function rowToIntroduction(row: Record<string, unknown>): AttrIntroduction {
  return {
    id: row.id as string,
    offerId: row.offer_id as string,
    introducerId: row.introducer_id as string,
    recipientId: row.recipient_id as string,
    introducerName: row.introducer_name as string | undefined,
    recipientName: row.recipient_name as string | undefined,
    level: row.level as 1 | 2 | 3 | 4,
    parentIntroductionId: row.parent_introduction_id as string | undefined,
    l1UserId: row.l1_user_id as string | undefined,
    l2UserId: row.l2_user_id as string | undefined,
    l3UserId: row.l3_user_id as string | undefined,
    l4UserId: row.l4_user_id as string | undefined,
    status: row.status as IntroductionStatus,
    createdAt: new Date(row.created_at as string),
    viewedAt: row.viewed_at ? new Date(row.viewed_at as string) : undefined,
    updatedAt: new Date(row.updated_at as string),
  }
}

// ============================================================================
// QUERIES
// ============================================================================

export async function getIntroductionById(introId: string): Promise<AttrIntroduction | null> {
  const result = await sql`
    SELECT * FROM attr_introductions WHERE id = ${introId}
  `
  if (result.rows.length === 0) return null
  return rowToIntroduction(result.rows[0])
}

export async function getOfferIntroductions(offerId: string): Promise<AttrIntroduction[]> {
  const result = await sql`
    SELECT * FROM attr_introductions
    WHERE offer_id = ${offerId}
    ORDER BY level ASC, created_at ASC
  `
  return result.rows.map(rowToIntroduction)
}

export async function getUserIntroductionsMade(userId: string): Promise<AttrIntroduction[]> {
  const result = await sql`
    SELECT * FROM attr_introductions
    WHERE introducer_id = ${userId}
    ORDER BY created_at DESC
  `
  return result.rows.map(rowToIntroduction)
}

export async function getUserIntroductionsReceived(userId: string): Promise<AttrIntroduction[]> {
  const result = await sql`
    SELECT * FROM attr_introductions
    WHERE recipient_id = ${userId}
    ORDER BY created_at DESC
  `
  return result.rows.map(rowToIntroduction)
}

export async function getIntroductionChain(offerId: string, userId: string): Promise<IntroductionChain | null> {
  // Find the introduction that brought this user into the offer
  const result = await sql`
    SELECT * FROM attr_introductions
    WHERE offer_id = ${offerId} AND recipient_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 1
  `

  if (result.rows.length === 0) return null

  const intro = rowToIntroduction(result.rows[0])
  return {
    l1: intro.l1UserId ? { userId: intro.l1UserId } : undefined,
    l2: intro.l2UserId ? { userId: intro.l2UserId } : undefined,
    l3: intro.l3UserId ? { userId: intro.l3UserId } : undefined,
    l4: intro.l4UserId ? { userId: intro.l4UserId } : undefined,
  }
}

export async function hasUserSeenOffer(userId: string, offerId: string): Promise<boolean> {
  const result = await sql`
    SELECT 1 FROM attr_introductions
    WHERE offer_id = ${offerId} AND recipient_id = ${userId}
    LIMIT 1
  `
  return result.rows.length > 0
}

export async function getUserIntroductionForOffer(
  userId: string,
  offerId: string
): Promise<AttrIntroduction | null> {
  const result = await sql`
    SELECT * FROM attr_introductions
    WHERE offer_id = ${offerId} AND recipient_id = ${userId}
    LIMIT 1
  `
  if (result.rows.length === 0) return null
  return rowToIntroduction(result.rows[0])
}

// ============================================================================
// MUTATIONS
// ============================================================================

export async function createIntroduction(
  introducerId: string,
  recipientId: string,
  offerId: string,
  introducerName?: string,
  recipientName?: string
): Promise<AttrIntroduction> {
  // Get the offer
  const offer = await getOfferById(offerId)
  if (!offer) {
    throw new Error('Offer not found')
  }
  if (offer.status !== 'active') {
    throw new Error('Offer is not active')
  }

  // Check if they're connected
  const connected = await areUsersConnected(introducerId, recipientId)
  if (!connected) {
    throw new Error('You must be connected to introduce an offer')
  }

  // Check if recipient already has this offer
  const alreadyHas = await hasUserSeenOffer(recipientId, offerId)
  if (alreadyHas) {
    throw new Error('User has already received this offer')
  }

  // Determine the level and chain
  let level: 1 | 2 | 3 | 4
  let parentIntroductionId: string | undefined
  let l1UserId: string | undefined
  let l2UserId: string | undefined
  let l3UserId: string | undefined
  let l4UserId: string | undefined

  if (introducerId === offer.ownerId) {
    // Direct from owner - this is L1
    level = 1
    l1UserId = recipientId
  } else {
    // Find how the introducer got this offer
    const introducerIntro = await getUserIntroductionForOffer(introducerId, offerId)
    if (!introducerIntro) {
      throw new Error('Introducer does not have access to this offer')
    }

    const newLevel = introducerIntro.level + 1
    if (newLevel > MAX_LEVELS) {
      throw new Error(`Maximum attribution depth (${MAX_LEVELS} levels) reached`)
    }

    level = newLevel as 1 | 2 | 3 | 4
    parentIntroductionId = introducerIntro.id

    // Copy chain from parent and add new level
    l1UserId = introducerIntro.l1UserId
    l2UserId = introducerIntro.l2UserId
    l3UserId = introducerIntro.l3UserId
    l4UserId = introducerIntro.l4UserId

    // Set the current recipient at their level
    switch (level) {
      case 2:
        l2UserId = recipientId
        break
      case 3:
        l3UserId = recipientId
        break
      case 4:
        l4UserId = recipientId
        break
    }
  }

  const result = await sql`
    INSERT INTO attr_introductions (
      offer_id, introducer_id, recipient_id,
      introducer_name, recipient_name,
      level, parent_introduction_id,
      l1_user_id, l2_user_id, l3_user_id, l4_user_id,
      status
    )
    VALUES (
      ${offerId}, ${introducerId}, ${recipientId},
      ${introducerName || null}, ${recipientName || null},
      ${level}, ${parentIntroductionId || null},
      ${l1UserId || null}, ${l2UserId || null}, ${l3UserId || null}, ${l4UserId || null},
      'pending'
    )
    RETURNING *
  `

  return rowToIntroduction(result.rows[0])
}

export async function updateIntroductionStatus(
  introId: string,
  userId: string,
  status: IntroductionStatus
): Promise<AttrIntroduction> {
  const intro = await getIntroductionById(introId)
  if (!intro) {
    throw new Error('Introduction not found')
  }
  if (intro.recipientId !== userId) {
    throw new Error('Not authorized to update this introduction')
  }

  const viewedAt = status === 'viewed' ? 'NOW()' : 'viewed_at'

  const result = await sql`
    UPDATE attr_introductions
    SET status = ${status},
        viewed_at = CASE WHEN ${status} = 'viewed' THEN NOW() ELSE viewed_at END,
        updated_at = NOW()
    WHERE id = ${introId}
    RETURNING *
  `

  return rowToIntroduction(result.rows[0])
}

export async function markIntroductionViewed(
  introId: string,
  userId: string
): Promise<AttrIntroduction> {
  return updateIntroductionStatus(introId, userId, 'viewed')
}

export async function markIntroductionInterested(
  introId: string,
  userId: string
): Promise<AttrIntroduction> {
  return updateIntroductionStatus(introId, userId, 'interested')
}

export async function markIntroductionPassed(
  introId: string,
  userId: string
): Promise<AttrIntroduction> {
  return updateIntroductionStatus(introId, userId, 'passed')
}

export async function markIntroductionConverted(
  introId: string
): Promise<AttrIntroduction> {
  const result = await sql`
    UPDATE attr_introductions
    SET status = 'converted',
        updated_at = NOW()
    WHERE id = ${introId}
    RETURNING *
  `
  return rowToIntroduction(result.rows[0])
}
