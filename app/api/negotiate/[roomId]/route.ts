/**
 * Negotiation Room API
 *
 * GET - Get room details and round history
 * POST - Run negotiation (full or single round)
 *
 * Buyer ↔ Wells (Buyer) ↔ Wells (Supplier) ↔ Supplier
 * Humans never meet. AIs handle everything.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getNegotiationRoom,
  runNegotiation,
  runSingleRound,
} from '@/lib/negotiation/service'

// GET - Get room details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = await params
    const room = await getNegotiationRoom(roomId)

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Verify user is part of this negotiation
    if (room.buyer.id !== userId && room.seller.id !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Determine user's role
    const role = room.buyer.id === userId ? 'buyer' : 'seller'

    // Filter out internal reasoning from the other party's rounds
    const sanitizedRounds = room.rounds.map(round => ({
      ...round,
      buyerAgent: {
        ...round.buyerAgent,
        reasoning: role === 'buyer' ? round.buyerAgent.reasoning : '[hidden]',
      },
      sellerAgent: {
        ...round.sellerAgent,
        reasoning: role === 'seller' ? round.sellerAgent.reasoning : '[hidden]',
      },
    }))

    return NextResponse.json({
      room: {
        ...room,
        rounds: sanitizedRounds,
        // Hide the other party's mandate details
        buyerMandate: role === 'buyer' ? room.buyerMandate : {
          requirement: room.buyerMandate.requirement,
          quantity: room.buyerMandate.quantity,
          unit: room.buyerMandate.unit,
          // Hide: idealPrice, maxPrice, dealBreakers
        },
        sellerMandate: role === 'seller' ? room.sellerMandate : {
          offering: room.sellerMandate.offering,
          capacity: room.sellerMandate.capacity,
          unit: room.sellerMandate.unit,
          // Hide: floorPrice, marginPressure
        },
      },
      role,
      canWatch: true,
      isComplete: ['agreed', 'failed', 'expired'].includes(room.status),
    })
  } catch (error) {
    console.error('Get negotiation room error:', error)
    return NextResponse.json(
      { error: 'Failed to get room' },
      { status: 500 }
    )
  }
}

// POST - Run negotiation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = await params
    const body = await request.json()
    const { mode = 'full' } = body // 'full' or 'step'

    const room = await getNegotiationRoom(roomId)

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Verify user is part of this negotiation
    if (room.buyer.id !== userId && room.seller.id !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Check if already concluded
    if (['agreed', 'failed', 'expired'].includes(room.status)) {
      return NextResponse.json({
        success: false,
        message: 'Negotiation already concluded',
        status: room.status,
        agreedTerms: room.agreedTerms,
        failureReason: room.failureReason,
      })
    }

    if (mode === 'step') {
      // Run single round
      const round = await runSingleRound(roomId)

      if (!round) {
        return NextResponse.json({
          success: false,
          message: 'Cannot run more rounds',
        })
      }

      // Get updated room
      const updatedRoom = await getNegotiationRoom(roomId)

      return NextResponse.json({
        success: true,
        round: {
          round: round.round,
          buyerMessage: round.buyerAgent.message,
          sellerMessage: round.sellerAgent.message,
          convergence: round.convergence,
          stickingPoints: round.sticking_points,
        },
        status: updatedRoom?.status,
        agreedTerms: updatedRoom?.agreedTerms,
        currentRound: updatedRoom?.currentRound,
        maxRounds: updatedRoom?.maxRounds,
      })
    } else {
      // Run full negotiation
      const updatedRoom = await runNegotiation(roomId)

      return NextResponse.json({
        success: updatedRoom.status === 'agreed',
        status: updatedRoom.status,
        totalRounds: updatedRoom.currentRound,
        agreedTerms: updatedRoom.agreedTerms,
        failureReason: updatedRoom.failureReason,
        summary: updatedRoom.status === 'agreed'
          ? `Deal reached in ${updatedRoom.currentRound} rounds at $${updatedRoom.agreedTerms?.price.toLocaleString()}`
          : `Negotiation ${updatedRoom.status}: ${updatedRoom.failureReason}`,
      })
    }
  } catch (error) {
    console.error('Run negotiation error:', error)
    return NextResponse.json(
      { error: 'Failed to run negotiation' },
      { status: 500 }
    )
  }
}
