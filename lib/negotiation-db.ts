import { query } from './db'
import { monitorDB } from './monitoring'

/**
 * Database operations for real-time negotiation
 */

export interface NegotiationRoom {
  id: string
  rfqId: string
  buyerId: string
  buyerEmail: string
  status: 'active' | 'completed' | 'cancelled' | 'expired'
  startedAt: Date
  closedAt?: Date
  dealId?: string
  roomCode: string
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface RoomParticipant {
  id: string
  roomId: string
  participantId: string
  participantType: 'buyer' | 'supplier'
  participantName: string
  participantEmail?: string
  supplierId?: string
  joinedAt: Date
  lastSeenAt: Date
  isActive: boolean
  metadata?: Record<string, any>
}

export interface RoomMessage {
  id: string
  roomId: string
  senderId: string
  senderName: string
  senderType: 'buyer' | 'supplier' | 'ai'
  content: string
  messageType: 'text' | 'offer' | 'counter_offer' | 'acceptance' | 'rejection'
  metadata?: Record<string, any>
  timestamp: Date
}

export interface CounterOffer {
  id: string
  roomId: string
  supplierId: string
  supplierName: string
  originalPrice?: number
  offeredPrice: number
  deliveryTime: string
  terms?: string
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  validUntil: Date
  respondedAt?: Date
  responseMessage?: string
  createdAt: Date
}

/**
 * Generate unique room code
 */
function generateRoomCode(): string {
  return `NEG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
}

/**
 * Create new negotiation room
 */
export async function createNegotiationRoom(params: {
  rfqId: string
  buyerId: string
  buyerEmail: string
  metadata?: Record<string, any>
}): Promise<NegotiationRoom> {
  const monitor = monitorDB('create_negotiation_room')

  try {
    const roomCode = generateRoomCode()

    const result = await query<NegotiationRoom>(
      `INSERT INTO negotiation_rooms (rfq_id, buyer_id, buyer_email, room_code, metadata, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING
         id,
         rfq_id as "rfqId",
         buyer_id as "buyerId",
         buyer_email as "buyerEmail",
         status,
         started_at as "startedAt",
         closed_at as "closedAt",
         deal_id as "dealId",
         room_code as "roomCode",
         metadata,
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      [params.rfqId, params.buyerId, params.buyerEmail, roomCode, JSON.stringify(params.metadata || {})]
    )

    // Add buyer as participant
    await addRoomParticipant({
      roomId: result.rows[0].id,
      participantId: params.buyerId,
      participantType: 'buyer',
      participantName: 'Buyer', // Will be updated with real name
      participantEmail: params.buyerEmail,
    })

    monitor.end(true)
    return result.rows[0]
  } catch (error) {
    monitor.end(false)
    console.error('[NEGOTIATION_DB] Create room error:', error)
    throw error
  }
}

/**
 * Get room by ID
 */
export async function getRoomById(roomId: string): Promise<NegotiationRoom | null> {
  const monitor = monitorDB('get_room')

  try {
    const result = await query<NegotiationRoom>(
      `SELECT
         id,
         rfq_id as "rfqId",
         buyer_id as "buyerId",
         buyer_email as "buyerEmail",
         status,
         started_at as "startedAt",
         closed_at as "closedAt",
         deal_id as "dealId",
         room_code as "roomCode",
         metadata,
         created_at as "createdAt",
         updated_at as "updatedAt"
       FROM negotiation_rooms
       WHERE id = $1`,
      [roomId]
    )

    monitor.end(true)
    return result.rows[0] || null
  } catch (error) {
    monitor.end(false)
    throw error
  }
}

/**
 * Get room by code
 */
export async function getRoomByCode(roomCode: string): Promise<NegotiationRoom | null> {
  const monitor = monitorDB('get_room_by_code')

  try {
    const result = await query<NegotiationRoom>(
      `SELECT
         id,
         rfq_id as "rfqId",
         buyer_id as "buyerId",
         buyer_email as "buyerEmail",
         status,
         started_at as "startedAt",
         closed_at as "closedAt",
         deal_id as "dealId",
         room_code as "roomCode",
         metadata,
         created_at as "createdAt",
         updated_at as "updatedAt"
       FROM negotiation_rooms
       WHERE room_code = $1`,
      [roomCode]
    )

    monitor.end(true)
    return result.rows[0] || null
  } catch (error) {
    monitor.end(false)
    throw error
  }
}

/**
 * Add participant to room
 */
export async function addRoomParticipant(params: {
  roomId: string
  participantId: string
  participantType: 'buyer' | 'supplier'
  participantName: string
  participantEmail?: string
  supplierId?: string
  metadata?: Record<string, any>
}): Promise<RoomParticipant> {
  const monitor = monitorDB('add_room_participant')

  try {
    const result = await query<RoomParticipant>(
      `INSERT INTO room_participants
         (room_id, participant_id, participant_type, participant_name, participant_email, supplier_id, metadata, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       ON CONFLICT (room_id, participant_id) DO UPDATE
       SET
         last_seen_at = NOW(),
         is_active = true
       RETURNING
         id,
         room_id as "roomId",
         participant_id as "participantId",
         participant_type as "participantType",
         participant_name as "participantName",
         participant_email as "participantEmail",
         supplier_id as "supplierId",
         joined_at as "joinedAt",
         last_seen_at as "lastSeenAt",
         is_active as "isActive",
         metadata`,
      [
        params.roomId,
        params.participantId,
        params.participantType,
        params.participantName,
        params.participantEmail,
        params.supplierId,
        JSON.stringify(params.metadata || {}),
      ]
    )

    monitor.end(true)
    return result.rows[0]
  } catch (error) {
    monitor.end(false)
    throw error
  }
}

/**
 * Get room participants
 */
export async function getRoomParticipants(roomId: string): Promise<RoomParticipant[]> {
  const monitor = monitorDB('get_room_participants')

  try {
    const result = await query<RoomParticipant>(
      `SELECT
         id,
         room_id as "roomId",
         participant_id as "participantId",
         participant_type as "participantType",
         participant_name as "participantName",
         participant_email as "participantEmail",
         supplier_id as "supplierId",
         joined_at as "joinedAt",
         last_seen_at as "lastSeenAt",
         is_active as "isActive",
         metadata
       FROM room_participants
       WHERE room_id = $1
       ORDER BY joined_at ASC`,
      [roomId]
    )

    monitor.end(true)
    return result.rows
  } catch (error) {
    monitor.end(false)
    return []
  }
}

/**
 * Add message to room
 */
export async function addRoomMessage(params: {
  roomId: string
  senderId: string
  senderName: string
  senderType: 'buyer' | 'supplier' | 'ai'
  content: string
  messageType?: 'text' | 'offer' | 'counter_offer' | 'acceptance' | 'rejection'
  metadata?: Record<string, any>
}): Promise<RoomMessage> {
  const monitor = monitorDB('add_room_message')

  try {
    const result = await query<RoomMessage>(
      `INSERT INTO room_messages
         (room_id, sender_id, sender_name, sender_type, content, message_type, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING
         id,
         room_id as "roomId",
         sender_id as "senderId",
         sender_name as "senderName",
         sender_type as "senderType",
         content,
         message_type as "messageType",
         metadata,
         timestamp`,
      [
        params.roomId,
        params.senderId,
        params.senderName,
        params.senderType,
        params.content,
        params.messageType || 'text',
        JSON.stringify(params.metadata || {}),
      ]
    )

    monitor.end(true)
    return result.rows[0]
  } catch (error) {
    monitor.end(false)
    throw error
  }
}

/**
 * Get room messages
 */
export async function getRoomMessages(
  roomId: string,
  limit: number = 100
): Promise<RoomMessage[]> {
  const monitor = monitorDB('get_room_messages')

  try {
    const result = await query<RoomMessage>(
      `SELECT
         id,
         room_id as "roomId",
         sender_id as "senderId",
         sender_name as "senderName",
         sender_type as "senderType",
         content,
         message_type as "messageType",
         metadata,
         timestamp
       FROM room_messages
       WHERE room_id = $1
       ORDER BY timestamp ASC
       LIMIT $2`,
      [roomId, limit]
    )

    monitor.end(true)
    return result.rows
  } catch (error) {
    monitor.end(false)
    return []
  }
}

/**
 * Create counter offer
 */
export async function createCounterOffer(params: {
  roomId: string
  supplierId: string
  supplierName: string
  originalPrice?: number
  offeredPrice: number
  deliveryTime: string
  terms?: string
  validUntil: Date
}): Promise<CounterOffer> {
  const monitor = monitorDB('create_counter_offer')

  try {
    const result = await query<CounterOffer>(
      `INSERT INTO counter_offers
         (room_id, supplier_id, supplier_name, original_price, offered_price, delivery_time, terms, valid_until, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING
         id,
         room_id as "roomId",
         supplier_id as "supplierId",
         supplier_name as "supplierName",
         original_price as "originalPrice",
         offered_price as "offeredPrice",
         delivery_time as "deliveryTime",
         terms,
         status,
         valid_until as "validUntil",
         responded_at as "respondedAt",
         response_message as "responseMessage",
         created_at as "createdAt"`,
      [
        params.roomId,
        params.supplierId,
        params.supplierName,
        params.originalPrice,
        params.offeredPrice,
        params.deliveryTime,
        params.terms,
        params.validUntil,
      ]
    )

    monitor.end(true)
    return result.rows[0]
  } catch (error) {
    monitor.end(false)
    throw error
  }
}

/**
 * Get room counter offers
 */
export async function getRoomCounterOffers(roomId: string): Promise<CounterOffer[]> {
  const monitor = monitorDB('get_room_counter_offers')

  try {
    const result = await query<CounterOffer>(
      `SELECT
         id,
         room_id as "roomId",
         supplier_id as "supplierId",
         supplier_name as "supplierName",
         original_price as "originalPrice",
         offered_price as "offeredPrice",
         delivery_time as "deliveryTime",
         terms,
         status,
         valid_until as "validUntil",
         responded_at as "respondedAt",
         response_message as "responseMessage",
         created_at as "createdAt"
       FROM counter_offers
       WHERE room_id = $1
       ORDER BY created_at DESC`,
      [roomId]
    )

    monitor.end(true)
    return result.rows
  } catch (error) {
    monitor.end(false)
    return []
  }
}

/**
 * Accept counter offer
 */
export async function acceptCounterOffer(
  offerId: string,
  responseMessage?: string
): Promise<void> {
  const monitor = monitorDB('accept_counter_offer')

  try {
    await query(
      `UPDATE counter_offers
       SET
         status = 'accepted',
         responded_at = NOW(),
         response_message = $2
       WHERE id = $1`,
      [offerId, responseMessage]
    )

    monitor.end(true)
  } catch (error) {
    monitor.end(false)
    throw error
  }
}

/**
 * Reject counter offer
 */
export async function rejectCounterOffer(
  offerId: string,
  responseMessage?: string
): Promise<void> {
  const monitor = monitorDB('reject_counter_offer')

  try {
    await query(
      `UPDATE counter_offers
       SET
         status = 'rejected',
         responded_at = NOW(),
         response_message = $2
       WHERE id = $1`,
      [offerId, responseMessage]
    )

    monitor.end(true)
  } catch (error) {
    monitor.end(false)
    throw error
  }
}

/**
 * Close negotiation room
 */
export async function closeNegotiationRoom(
  roomId: string,
  status: 'completed' | 'cancelled' | 'expired',
  dealId?: string
): Promise<void> {
  const monitor = monitorDB('close_negotiation_room')

  try {
    await query(
      `UPDATE negotiation_rooms
       SET
         status = $2,
         closed_at = NOW(),
         deal_id = $3
       WHERE id = $1`,
      [roomId, status, dealId]
    )

    monitor.end(true)
  } catch (error) {
    monitor.end(false)
    throw error
  }
}

/**
 * Get active negotiations
 */
export async function getActiveNegotiations(): Promise<any[]> {
  const monitor = monitorDB('get_active_negotiations')

  try {
    const result = await query(
      `SELECT * FROM active_negotiations
       ORDER BY last_activity DESC
       LIMIT 50`
    )

    monitor.end(true)
    return result.rows
  } catch (error) {
    monitor.end(false)
    return []
  }
}

/**
 * Get room statistics
 */
export async function getRoomStats(roomId: string): Promise<{
  supplierCount: number
  messageCount: number
  counterOfferCount: number
  avgResponseTimeMinutes: number
  lastActivity: Date
}> {
  const monitor = monitorDB('get_room_stats')

  try {
    const result = await query<any>(
      `SELECT * FROM get_room_stats($1)`,
      [roomId]
    )

    monitor.end(true)
    return result.rows[0] || {
      supplierCount: 0,
      messageCount: 0,
      counterOfferCount: 0,
      avgResponseTimeMinutes: 0,
      lastActivity: new Date(),
    }
  } catch (error) {
    monitor.end(false)
    return {
      supplierCount: 0,
      messageCount: 0,
      counterOfferCount: 0,
      avgResponseTimeMinutes: 0,
      lastActivity: new Date(),
    }
  }
}

/**
 * Add deal history event
 */
export async function addDealHistoryEvent(params: {
  roomId: string
  dealId?: string
  eventType: string
  eventData: Record<string, any>
  actorId: string
  actorType: 'buyer' | 'supplier'
}): Promise<void> {
  const monitor = monitorDB('add_deal_history')

  try {
    await query(
      `INSERT INTO deal_history (room_id, deal_id, event_type, event_data, actor_id, actor_type)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        params.roomId,
        params.dealId,
        params.eventType,
        JSON.stringify(params.eventData),
        params.actorId,
        params.actorType,
      ]
    )

    monitor.end(true)
  } catch (error) {
    monitor.end(false)
    console.error('[NEGOTIATION_DB] Add history error:', error)
  }
}

/**
 * Get deal history
 */
export async function getDealHistory(roomId: string): Promise<any[]> {
  const monitor = monitorDB('get_deal_history')

  try {
    const result = await query(
      `SELECT
         id,
         room_id as "roomId",
         deal_id as "dealId",
         event_type as "eventType",
         event_data as "eventData",
         actor_id as "actorId",
         actor_type as "actorType",
         timestamp
       FROM deal_history
       WHERE room_id = $1
       ORDER BY timestamp ASC`,
      [roomId]
    )

    monitor.end(true)
    return result.rows
  } catch (error) {
    monitor.end(false)
    return []
  }
}
