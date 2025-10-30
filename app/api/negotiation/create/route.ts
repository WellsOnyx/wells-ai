import { NextRequest, NextResponse } from 'next/server'
import { createNegotiationRoom, addDealHistoryEvent } from '@/lib/negotiation-db'
import { Suppliers } from '@/lib/db'
import { monitorAPI } from '@/lib/monitoring'
import { notifySupplierJoined } from '@/lib/pusher'

/**
 * Create Negotiation Room
 * POST /api/negotiation/create
 *
 * Creates a new real-time negotiation room and invites matched suppliers
 */
export async function POST(req: NextRequest) {
  const monitor = monitorAPI('/api/negotiation/create', 'POST')

  try {
    const { rfqId, buyerId, buyerEmail, buyerName, supplierIds, metadata } = await req.json()

    // Validation
    if (!rfqId || !buyerId || !buyerEmail) {
      monitor.end(false)
      return NextResponse.json(
        { error: 'Missing required fields: rfqId, buyerId, buyerEmail' },
        { status: 400 }
      )
    }

    // Create negotiation room
    const room = await createNegotiationRoom({
      rfqId,
      buyerId,
      buyerEmail,
      metadata: {
        ...metadata,
        buyerName,
        createdVia: 'api',
      },
    })

    // Add deal history event
    await addDealHistoryEvent({
      roomId: room.id,
      eventType: 'room_created',
      eventData: {
        buyerId,
        buyerEmail,
        rfqId,
        supplierIds: supplierIds || [],
      },
      actorId: buyerId,
      actorType: 'buyer',
    })

    // If supplier IDs provided, send them invitations
    if (supplierIds && supplierIds.length > 0) {
      const invitations = []

      for (const supplierId of supplierIds) {
        try {
          // Get supplier details
          const supplier = await Suppliers.findById(supplierId)

          if (supplier) {
            // Send SMS invitation
            // TODO: Integrate with Twilio to send SMS
            const inviteMessage = `
New negotiation opportunity!

Room Code: ${room.roomCode}
Join now: ${process.env.NEXT_PUBLIC_BASE_URL}/negotiate/${room.roomCode}

Wells AI - Real-Time Procurement
            `.trim()

            // Log invitation
            console.log(`[NEGOTIATION] Invite sent to ${supplier.name}: ${inviteMessage}`)

            invitations.push({
              supplierId: supplier.id,
              supplierName: supplier.name,
              supplierEmail: supplier.email,
              supplierPhone: supplier.phone,
              status: 'sent',
            })
          }
        } catch (error) {
          console.error(`[NEGOTIATION] Failed to invite supplier ${supplierId}:`, error)
        }
      }

      // Add invitation event to history
      await addDealHistoryEvent({
        roomId: room.id,
        eventType: 'invitations_sent',
        eventData: {
          invitations,
          invitedCount: invitations.length,
        },
        actorId: buyerId,
        actorType: 'buyer',
      })
    }

    monitor.end(true, { roomId: room.id, roomCode: room.roomCode })

    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        roomCode: room.roomCode,
        rfqId: room.rfqId,
        status: room.status,
        startedAt: room.startedAt,
        joinUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/negotiate/${room.roomCode}`,
      },
    })
  } catch (error) {
    monitor.end(false)
    console.error('[API] Create negotiation error:', error)

    return NextResponse.json(
      {
        error: 'Failed to create negotiation room',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
