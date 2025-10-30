import { NextRequest, NextResponse } from 'next/server'
import {
  getRoomById,
  getRoomMessages,
  getRoomCounterOffers,
  getRoomParticipants,
} from '@/lib/negotiation-db'
import { monitorAPI } from '@/lib/monitoring'
import { sendAISuggestion } from '@/lib/pusher'

/**
 * AI Negotiation Assistant
 * POST /api/negotiation/[roomId]/ai-assist
 *
 * Provides real-time negotiation suggestions
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const monitor = monitorAPI('/api/negotiation/[roomId]/ai-assist', 'POST')

  try {
    const roomId = params.roomId
    const { type, userType, currentContext } = await req.json()

    // Get room
    const room = await getRoomById(roomId)
    if (!room) {
      monitor.end(false)
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Get room context
    const [messages, counterOffers, participants] = await Promise.all([
      getRoomMessages(room.id, 50),
      getRoomCounterOffers(room.id),
      getRoomParticipants(room.id),
    ])

    // Build context for Claude
    const conversationContext = messages
      .map(m => `[${m.senderType}] ${m.senderName}: ${m.content}`)
      .join('\n')

    const offersContext = counterOffers
      .map(
        co =>
          `${co.supplierName}: $${co.offeredPrice} (${co.deliveryTime}) - Status: ${co.status}`
      )
      .join('\n')

    const participantsContext = participants
      .filter(p => p.participantType === 'supplier')
      .map(p => p.participantName)
      .join(', ')

    // Generate AI suggestion based on type
    let suggestionType: 'pricing' | 'timing' | 'terms' | 'general' = 'general'
    let suggestion = ''

    // Simplified AI suggestions (can be enhanced with actual Claude calls later)
    if (type === 'pricing') {
      suggestionType = 'pricing'
      if (userType === 'buyer') {
        const avgPrice =
          counterOffers.length > 0
            ? counterOffers.reduce((sum, co) => sum + co.offeredPrice, 0) / counterOffers.length
            : 0
        suggestion = `Based on the ${counterOffers.length} offers received, the average price is $${avgPrice.toLocaleString()}. Consider negotiating ${counterOffers.length > 2 ? 'the middle-range offers' : 'with the most competitive supplier'} to get the best value. Look for opportunities to reduce costs through volume commitments or extended payment terms.`
      } else {
        suggestion = `Position your pricing competitively by highlighting your unique value propositions. If other suppliers are present, focus on quality, reliability, and service rather than competing solely on price. Consider offering volume discounts or flexible payment terms to close the deal.`
      }
    } else if (type === 'timing') {
      suggestionType = 'timing'
      if (userType === 'buyer') {
        suggestion = `Review the delivery timelines offered and assess your actual urgency. If you can be flexible on timing, use this as a negotiation point to secure better pricing or terms. Consider asking suppliers about rush options if you need faster delivery.`
      } else {
        suggestion = `Be realistic about your lead times - overpromising on delivery can damage your reputation. If you can offer faster delivery, highlight this as a competitive advantage. Consider tiered pricing for standard vs. expedited delivery.`
      }
    } else if (type === 'terms') {
      suggestionType = 'terms'
      if (userType === 'buyer') {
        suggestion = `Focus on securing favorable payment terms (net 30 or net 60), quality guarantees, and clear acceptance criteria. Don't forget to discuss warranty terms, return policies, and dispute resolution. These terms can add significant value beyond just price.`
      } else {
        suggestion = `Offer competitive yet protective terms. Standard payment terms (net 30), clear quality specifications, and reasonable warranty periods build trust. Be transparent about minimum order quantities and any customization fees upfront.`
      }
    } else {
      // General suggestion
      const hasOffers = counterOffers.length > 0
      const hasMessages = messages.length > 3

      if (hasOffers && hasMessages) {
        suggestion = `The negotiation is progressing well with ${counterOffers.length} offers and active dialogue. ${userType === 'buyer' ? 'Focus on narrowing down to your top 2-3 suppliers and request final best offers. Look for trade-offs between price, quality, and delivery time.' : 'Stay engaged and responsive. If you haven\'t submitted an offer yet, consider doing so now. Highlight your competitive advantages in the conversation.'}`
      } else if (hasOffers) {
        suggestion = `You have ${counterOffers.length} offers to review. ${userType === 'buyer' ? 'Engage in dialogue with suppliers to understand their capabilities better before making a decision. Ask clarifying questions about delivery, quality standards, and support.' : 'The buyer is reviewing offers. Use this time to proactively answer questions and reinforce your value proposition.'}`
      } else {
        suggestion = `The negotiation is just getting started. ${userType === 'buyer' ? 'Clearly communicate your requirements and timeline. Encourage suppliers to ask questions and submit their best offers.' : 'Engage actively by asking clarifying questions about requirements. Submit a competitive offer when you have enough information.'}`
      }
    }

    // Send suggestion to room via WebSocket
    await sendAISuggestion(room.id, {
      type: suggestionType,
      message: suggestion,
      data: {
        userType,
        offersCount: counterOffers.length,
        participantsCount: participants.length,
      },
    })

    monitor.end(true, { roomId: room.id, type: suggestionType })

    return NextResponse.json({
      success: true,
      suggestion: {
        type: suggestionType,
        message: suggestion,
        timestamp: new Date(),
      },
    })
  } catch (error) {
    monitor.end(false)
    console.error('[API] AI assist error:', error)

    return NextResponse.json(
      {
        error: 'Failed to generate AI suggestion',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
