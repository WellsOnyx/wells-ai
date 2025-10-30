import { NextRequest, NextResponse } from 'next/server'
import { getRoomById, addRoomMessage, addDealHistoryEvent } from '@/lib/negotiation-db'
import { monitorAPI } from '@/lib/monitoring'
import { sendRoomMessage } from '@/lib/pusher'

/**
 * Send Message to Negotiation Room
 * POST /api/negotiation/[roomId]/message
 *
 * Sends a message to the negotiation room and broadcasts via WebSocket
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const monitor = monitorAPI('/api/negotiation/[roomId]/message', 'POST')

  try {
    const roomId = params.roomId
    const {
      senderId,
      senderName,
      senderType,
      content,
      messageType,
      metadata,
    } = await req.json()

    // Validation
    if (!senderId || !senderName || !senderType || !content) {
      monitor.end(false)
      return NextResponse.json(
        { error: 'Missing required fields: senderId, senderName, senderType, content' },
        { status: 400 }
      )
    }

    // Validate senderType
    if (!['buyer', 'supplier', 'ai'].includes(senderType)) {
      monitor.end(false)
      return NextResponse.json(
        { error: 'Invalid senderType, must be: buyer, supplier, or ai' },
        { status: 400 }
      )
    }

    // Get room
    const room = await getRoomById(roomId)
    if (!room) {
      monitor.end(false)
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Check if room is active
    if (room.status !== 'active') {
      monitor.end(false)
      return NextResponse.json(
        { error: `Room is ${room.status}, cannot send messages` },
        { status: 400 }
      )
    }

    // Add message to database
    const message = await addRoomMessage({
      roomId: room.id,
      senderId,
      senderName,
      senderType,
      content,
      messageType: messageType || 'text',
      metadata,
    })

    // Broadcast message via WebSocket
    await sendRoomMessage(room.id, {
      id: message.id,
      roomId: message.roomId,
      senderId: message.senderId,
      senderName: message.senderName,
      senderType: message.senderType,
      content: message.content,
      timestamp: message.timestamp,
      metadata: message.metadata,
    })

    // Add to deal history if it's an important message
    if (messageType && messageType !== 'text') {
      await addDealHistoryEvent({
        roomId: room.id,
        eventType: `message_${messageType}`,
        eventData: {
          messageId: message.id,
          senderId,
          senderName,
          senderType,
          content: content.substring(0, 100), // Truncate
          metadata,
        },
        actorId: senderId,
        actorType: senderType === 'buyer' ? 'buyer' : 'supplier',
      })
    }

    monitor.end(true, { roomId: room.id, messageId: message.id })

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        roomId: message.roomId,
        senderId: message.senderId,
        senderName: message.senderName,
        senderType: message.senderType,
        content: message.content,
        messageType: message.messageType,
        timestamp: message.timestamp,
      },
    })
  } catch (error) {
    monitor.end(false)
    console.error('[API] Send message error:', error)

    return NextResponse.json(
      {
        error: 'Failed to send message',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
