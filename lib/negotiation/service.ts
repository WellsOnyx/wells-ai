/**
 * Negotiation Service
 *
 * Database operations for AI-to-AI negotiation rooms
 */

import { sql } from '@/lib/db'
import {
  NegotiationEngine,
  NegotiationRoom,
  BuyerMandate,
  SellerMandate,
  NegotiationRound,
  AgreedTerms,
  getNegotiationEngine,
} from './engine'

// =============================================================================
// ROOM OPERATIONS
// =============================================================================

export async function createNegotiationRoom(params: {
  buyerId: string
  buyerName: string
  buyerCompany?: string
  sellerId: string
  sellerName: string
  sellerCompany?: string
  subject: string
  description?: string
  buyerMandate: BuyerMandate
  sellerMandate: SellerMandate
  maxRounds?: number
  expiresInHours?: number
}): Promise<NegotiationRoom> {
  const expiresAt = new Date(
    Date.now() + (params.expiresInHours || 24) * 60 * 60 * 1000
  )

  const result = await sql`
    INSERT INTO negotiation_rooms (
      buyer_id, buyer_name, buyer_company,
      seller_id, seller_name, seller_company,
      subject, description,
      buyer_mandate, seller_mandate,
      max_rounds, expires_at
    ) VALUES (
      ${params.buyerId}, ${params.buyerName}, ${params.buyerCompany || null},
      ${params.sellerId}, ${params.sellerName}, ${params.sellerCompany || null},
      ${params.subject}, ${params.description || null},
      ${JSON.stringify(params.buyerMandate)}, ${JSON.stringify(params.sellerMandate)},
      ${params.maxRounds || 10}, ${expiresAt.toISOString()}
    )
    RETURNING *
  `

  const room = result[0]

  // Create user_negotiations entries
  await sql`
    INSERT INTO user_negotiations (user_id, room_id, role)
    VALUES
      (${params.buyerId}, ${room.id}, 'buyer'),
      (${params.sellerId}, ${room.id}, 'seller')
    ON CONFLICT DO NOTHING
  `

  return mapRoomFromDb(room)
}

export async function getNegotiationRoom(roomId: string): Promise<NegotiationRoom | null> {
  const rooms = await sql`
    SELECT * FROM negotiation_rooms WHERE id = ${roomId}
  `

  if (rooms.length === 0) return null

  const room = mapRoomFromDb(rooms[0])

  // Get rounds
  const rounds = await sql`
    SELECT * FROM negotiation_rounds
    WHERE room_id = ${roomId}
    ORDER BY round_number ASC
  `

  room.rounds = rounds.map(mapRoundFromDb)

  return room
}

export async function getUserNegotiations(
  userId: string,
  status?: string
): Promise<NegotiationRoom[]> {
  let rooms

  if (status) {
    rooms = await sql`
      SELECT r.* FROM negotiation_rooms r
      JOIN user_negotiations un ON un.room_id = r.id
      WHERE un.user_id = ${userId} AND r.status = ${status}
      ORDER BY r.updated_at DESC
    `
  } else {
    rooms = await sql`
      SELECT r.* FROM negotiation_rooms r
      JOIN user_negotiations un ON un.room_id = r.id
      WHERE un.user_id = ${userId}
      ORDER BY r.updated_at DESC
    `
  }

  return rooms.map(mapRoomFromDb)
}

export async function updateRoomStatus(
  roomId: string,
  status: NegotiationRoom['status'],
  agreedTerms?: AgreedTerms,
  failureReason?: string
): Promise<void> {
  await sql`
    UPDATE negotiation_rooms
    SET
      status = ${status},
      agreed_terms = ${agreedTerms ? JSON.stringify(agreedTerms) : null},
      failure_reason = ${failureReason || null}
    WHERE id = ${roomId}
  `
}

// =============================================================================
// ROUND OPERATIONS
// =============================================================================

export async function saveNegotiationRound(
  roomId: string,
  round: NegotiationRound
): Promise<void> {
  await sql`
    INSERT INTO negotiation_rounds (
      room_id, round_number,
      buyer_message, buyer_proposed_terms, buyer_reasoning, buyer_satisfaction,
      seller_message, seller_counter_terms, seller_reasoning, seller_satisfaction,
      convergence, sticking_points
    ) VALUES (
      ${roomId}, ${round.round},
      ${round.buyerAgent.message}, ${JSON.stringify(round.buyerAgent.proposedTerms)},
      ${round.buyerAgent.reasoning}, ${round.buyerAgent.satisfaction},
      ${round.sellerAgent.message}, ${JSON.stringify(round.sellerAgent.counterTerms)},
      ${round.sellerAgent.reasoning}, ${round.sellerAgent.satisfaction},
      ${round.convergence}, ${round.sticking_points}
    )
    ON CONFLICT (room_id, round_number) DO UPDATE SET
      seller_message = EXCLUDED.seller_message,
      seller_counter_terms = EXCLUDED.seller_counter_terms,
      seller_reasoning = EXCLUDED.seller_reasoning,
      seller_satisfaction = EXCLUDED.seller_satisfaction,
      convergence = EXCLUDED.convergence,
      sticking_points = EXCLUDED.sticking_points
  `

  // Update room's current round
  await sql`
    UPDATE negotiation_rooms
    SET current_round = ${round.round}
    WHERE id = ${roomId}
  `
}

// =============================================================================
// NEGOTIATION EXECUTION
// =============================================================================

/**
 * Start or continue a negotiation
 */
export async function runNegotiation(roomId: string): Promise<NegotiationRoom> {
  const room = await getNegotiationRoom(roomId)
  if (!room) {
    throw new Error('Negotiation room not found')
  }

  if (room.status === 'agreed' || room.status === 'failed' || room.status === 'expired') {
    return room // Already concluded
  }

  // Check expiration
  if (new Date() > room.expiresAt) {
    await updateRoomStatus(roomId, 'expired', undefined, 'Negotiation time limit reached')
    room.status = 'expired'
    room.failureReason = 'Negotiation time limit reached'
    return room
  }

  const engine = getNegotiationEngine()

  // Run the negotiation
  const updatedRoom = await engine.negotiate(room)

  // Save the results
  for (const round of updatedRoom.rounds) {
    if (round.round > room.rounds.length) {
      await saveNegotiationRound(roomId, round)
    }
  }

  // Update final status
  await updateRoomStatus(
    roomId,
    updatedRoom.status,
    updatedRoom.agreedTerms,
    updatedRoom.failureReason
  )

  return updatedRoom
}

/**
 * Run a single round (for step-by-step execution)
 */
export async function runSingleRound(roomId: string): Promise<NegotiationRound | null> {
  const room = await getNegotiationRoom(roomId)
  if (!room) {
    throw new Error('Negotiation room not found')
  }

  if (room.status !== 'preparing' && room.status !== 'negotiating') {
    return null // Can't run more rounds
  }

  if (room.currentRound >= room.maxRounds) {
    await updateRoomStatus(roomId, 'failed', undefined, 'Maximum rounds reached')
    return null
  }

  // Update status if first round
  if (room.status === 'preparing') {
    await sql`UPDATE negotiation_rooms SET status = 'negotiating' WHERE id = ${roomId}`
    room.status = 'negotiating'
  }

  const engine = getNegotiationEngine()
  const round = await engine.runRound(room)

  // Save the round
  await saveNegotiationRound(roomId, round)

  // Check for agreement
  if (round.convergence >= 95 &&
      round.buyerAgent.satisfaction >= 70 &&
      round.sellerAgent.satisfaction >= 70) {
    const agreedTerms = finalizeTermsFromRound(round, room)
    await updateRoomStatus(roomId, 'agreed', agreedTerms)
  }

  // Check for failure
  if (round.buyerAgent.satisfaction < 20 || round.sellerAgent.satisfaction < 20) {
    await updateRoomStatus(roomId, 'failed', undefined, 'Parties too far apart')
  }

  if (round.sticking_points.includes('REJECTED')) {
    await updateRoomStatus(roomId, 'failed', undefined, 'Deal rejected by one party')
  }

  return round
}

// =============================================================================
// HELPERS
// =============================================================================

function mapRoomFromDb(row: any): NegotiationRoom {
  return {
    id: row.id,
    status: row.status,
    buyer: {
      id: row.buyer_id,
      name: row.buyer_name,
      company: row.buyer_company,
    },
    seller: {
      id: row.seller_id,
      name: row.seller_name,
      company: row.seller_company,
    },
    subject: row.subject,
    description: row.description,
    buyerMandate: row.buyer_mandate,
    sellerMandate: row.seller_mandate,
    rounds: [],
    currentRound: row.current_round,
    maxRounds: row.max_rounds,
    agreedTerms: row.agreed_terms,
    failureReason: row.failure_reason,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    expiresAt: new Date(row.expires_at),
  }
}

function mapRoundFromDb(row: any): NegotiationRound {
  return {
    round: row.round_number,
    timestamp: new Date(row.created_at),
    buyerAgent: {
      message: row.buyer_message,
      proposedTerms: row.buyer_proposed_terms,
      reasoning: row.buyer_reasoning,
      satisfaction: row.buyer_satisfaction,
    },
    sellerAgent: {
      message: row.seller_message || '',
      counterTerms: row.seller_counter_terms || {},
      reasoning: row.seller_reasoning || '',
      satisfaction: row.seller_satisfaction || 0,
    },
    convergence: row.convergence,
    sticking_points: row.sticking_points || [],
  }
}

function finalizeTermsFromRound(round: NegotiationRound, room: NegotiationRoom): AgreedTerms {
  const buyerTerms = round.buyerAgent.proposedTerms
  const sellerTerms = round.sellerAgent.counterTerms

  const price = ((buyerTerms.price || 0) + (sellerTerms.price || 0)) / 2
  const quantity = buyerTerms.quantity || sellerTerms.quantity || room.buyerMandate.quantity

  return {
    price,
    quantity,
    unit: room.buyerMandate.unit,
    currency: room.buyerMandate.currency,
    totalValue: price * quantity,
    deliveryDate: sellerTerms.deliveryDate || buyerTerms.deliveryDate || room.buyerMandate.neededBy,
    deliveryTerms: 'Standard',
    paymentTerms: buyerTerms.paymentTerms || sellerTerms.paymentTerms || 'Net 30',
    paymentMethod: 'escrow',
    conditions: [
      ...(buyerTerms.conditions || []),
      ...(sellerTerms.conditions || []),
    ],
    buyerSatisfaction: round.buyerAgent.satisfaction,
    sellerSatisfaction: round.sellerAgent.satisfaction,
    agreedAt: new Date(),
    agreedOnRound: round.round,
  }
}
