import { NextRequest, NextResponse } from 'next/server'
import {
  getRoomById,
  getRoomByCode,
  getRoomParticipants,
  getRoomMessages,
  getRoomCounterOffers,
  getRoomStats,
} from '@/lib/negotiation-db'
import { monitorAPI } from '@/lib/monitoring'

/**
 * Get Negotiation Room Details
 * GET /api/negotiation/[roomId]
 *
 * Returns complete room state including participants, messages, and offers
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const monitor = monitorAPI('/api/negotiation/[roomId]', 'GET')

  try {
    const roomId = params.roomId

    // Check if it's a room code (NEG-XXXXX) or UUID
    const isCode = roomId.startsWith('NEG-')
    const room = isCode
      ? await getRoomByCode(roomId)
      : await getRoomById(roomId)

    if (!room) {
      monitor.end(false)
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Get room data
    const [participants, messages, counterOffers, stats] = await Promise.all([
      getRoomParticipants(room.id),
      getRoomMessages(room.id, 100),
      getRoomCounterOffers(room.id),
      getRoomStats(room.id),
    ])

    monitor.end(true, { roomId: room.id, participantCount: participants.length })

    return NextResponse.json({
      room: {
        id: room.id,
        rfqId: room.rfqId,
        buyerId: room.buyerId,
        buyerEmail: room.buyerEmail,
        status: room.status,
        roomCode: room.roomCode,
        startedAt: room.startedAt,
        closedAt: room.closedAt,
        dealId: room.dealId,
        metadata: room.metadata,
      },
      participants: participants.map(p => ({
        id: p.id,
        participantId: p.participantId,
        type: p.participantType,
        name: p.participantName,
        email: p.participantEmail,
        supplierId: p.supplierId,
        joinedAt: p.joinedAt,
        isActive: p.isActive,
      })),
      messages: messages.map(m => ({
        id: m.id,
        senderId: m.senderId,
        senderName: m.senderName,
        senderType: m.senderType,
        content: m.content,
        messageType: m.messageType,
        metadata: m.metadata,
        timestamp: m.timestamp,
      })),
      counterOffers: counterOffers.map(co => ({
        id: co.id,
        supplierId: co.supplierId,
        supplierName: co.supplierName,
        originalPrice: co.originalPrice,
        offeredPrice: co.offeredPrice,
        deliveryTime: co.deliveryTime,
        terms: co.terms,
        status: co.status,
        validUntil: co.validUntil,
        createdAt: co.createdAt,
      })),
      stats: {
        supplierCount: stats.supplierCount || 0,
        messageCount: stats.messageCount || 0,
        counterOfferCount: stats.counterOfferCount || 0,
        avgResponseTimeMinutes: stats.avgResponseTimeMinutes || 0,
        lastActivity: stats.lastActivity,
      },
    })
  } catch (error) {
    monitor.end(false)
    console.error('[API] Get negotiation room error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch room details',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
