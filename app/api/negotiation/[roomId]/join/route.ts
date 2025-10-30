import { NextRequest, NextResponse } from 'next/server'
import { getRoomById, getRoomByCode, addRoomParticipant, addDealHistoryEvent } from '@/lib/negotiation-db'
import { Suppliers } from '@/lib/db'
import { monitorAPI } from '@/lib/monitoring'
import { notifySupplierJoined } from '@/lib/pusher'

/**
 * Join Negotiation Room
 * POST /api/negotiation/[roomId]/join
 *
 * Allows a supplier to join an active negotiation room
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const monitor = monitorAPI('/api/negotiation/[roomId]/join', 'POST')

  try {
    const roomId = params.roomId
    const { supplierId, supplierName, supplierEmail } = await req.json()

    // Validation
    if (!supplierId) {
      monitor.end(false)
      return NextResponse.json(
        { error: 'Missing required field: supplierId' },
        { status: 400 }
      )
    }

    // Get room
    const isCode = roomId.startsWith('NEG-')
    const room = isCode
      ? await getRoomByCode(roomId)
      : await getRoomById(roomId)

    if (!room) {
      monitor.end(false)
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Check if room is active
    if (room.status !== 'active') {
      monitor.end(false)
      return NextResponse.json(
        { error: `Room is ${room.status}, cannot join` },
        { status: 400 }
      )
    }

    // Get supplier details
    const supplier = await Suppliers.findById(supplierId)
    if (!supplier) {
      monitor.end(false)
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Add participant
    const participant = await addRoomParticipant({
      roomId: room.id,
      participantId: supplierId,
      participantType: 'supplier',
      participantName: supplierName || supplier.name,
      participantEmail: supplierEmail || supplier.email,
      supplierId: supplierId,
    })

    // Notify room via WebSocket
    await notifySupplierJoined(room.id, {
      id: supplierId,
      name: supplier.name,
      timestamp: new Date(),
    })

    // Add to deal history
    await addDealHistoryEvent({
      roomId: room.id,
      eventType: 'supplier_joined',
      eventData: {
        supplierId,
        supplierName: supplier.name,
        supplierEmail: supplier.email,
      },
      actorId: supplierId,
      actorType: 'supplier',
    })

    monitor.end(true, { roomId: room.id, supplierId })

    return NextResponse.json({
      success: true,
      participant: {
        id: participant.id,
        participantId: participant.participantId,
        participantType: participant.participantType,
        participantName: participant.participantName,
        joinedAt: participant.joinedAt,
      },
      room: {
        id: room.id,
        roomCode: room.roomCode,
        status: room.status,
        buyerId: room.buyerId,
      },
    })
  } catch (error) {
    monitor.end(false)
    console.error('[API] Join negotiation error:', error)

    return NextResponse.json(
      {
        error: 'Failed to join negotiation room',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
