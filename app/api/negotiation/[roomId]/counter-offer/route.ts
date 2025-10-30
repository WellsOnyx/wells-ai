import { NextRequest, NextResponse } from 'next/server'
import {
  getRoomById,
  createCounterOffer,
  acceptCounterOffer,
  rejectCounterOffer,
  addDealHistoryEvent,
  closeNegotiationRoom,
} from '@/lib/negotiation-db'
import { Suppliers, Deals } from '@/lib/db'
import { monitorAPI } from '@/lib/monitoring'
import { broadcastCounterOffer, notifyOfferAccepted } from '@/lib/pusher'

/**
 * Submit Counter Offer
 * POST /api/negotiation/[roomId]/counter-offer
 *
 * Supplier submits a counter-offer or buyer accepts/rejects
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const monitor = monitorAPI('/api/negotiation/[roomId]/counter-offer', 'POST')

  try {
    const roomId = params.roomId
    const {
      action, // 'submit', 'accept', 'reject'
      supplierId,
      supplierName,
      originalPrice,
      offeredPrice,
      deliveryTime,
      terms,
      validHours,
      offerId,
      buyerId,
      responseMessage,
    } = await req.json()

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
        { error: `Room is ${room.status}, cannot process counter-offers` },
        { status: 400 }
      )
    }

    // Handle different actions
    if (action === 'submit') {
      // Supplier submitting counter-offer
      if (!supplierId || !offeredPrice || !deliveryTime) {
        monitor.end(false)
        return NextResponse.json(
          { error: 'Missing required fields for submit: supplierId, offeredPrice, deliveryTime' },
          { status: 400 }
        )
      }

      // Get supplier details
      const supplier = await Suppliers.findById(supplierId)
      if (!supplier) {
        monitor.end(false)
        return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
      }

      // Calculate valid until (default 24 hours)
      const hours = validHours || 24
      const validUntil = new Date(Date.now() + hours * 60 * 60 * 1000)

      // Create counter offer
      const counterOffer = await createCounterOffer({
        roomId: room.id,
        supplierId,
        supplierName: supplierName || supplier.name,
        originalPrice,
        offeredPrice,
        deliveryTime,
        terms,
        validUntil,
      })

      // Broadcast via WebSocket
      await broadcastCounterOffer(room.id, {
        id: counterOffer.id,
        roomId: counterOffer.roomId,
        supplierId: counterOffer.supplierId,
        supplierName: counterOffer.supplierName,
        price: counterOffer.offeredPrice,
        originalPrice: counterOffer.originalPrice,
        deliveryTime: counterOffer.deliveryTime,
        terms: counterOffer.terms,
        validUntil: counterOffer.validUntil,
        timestamp: counterOffer.createdAt,
      })

      // Add to deal history
      await addDealHistoryEvent({
        roomId: room.id,
        eventType: 'counter_offer_submitted',
        eventData: {
          offerId: counterOffer.id,
          supplierId,
          supplierName: supplier.name,
          offeredPrice,
          deliveryTime,
          originalPrice,
        },
        actorId: supplierId,
        actorType: 'supplier',
      })

      monitor.end(true, { roomId: room.id, offerId: counterOffer.id })

      return NextResponse.json({
        success: true,
        counterOffer: {
          id: counterOffer.id,
          supplierId: counterOffer.supplierId,
          supplierName: counterOffer.supplierName,
          offeredPrice: counterOffer.offeredPrice,
          deliveryTime: counterOffer.deliveryTime,
          terms: counterOffer.terms,
          validUntil: counterOffer.validUntil,
          status: counterOffer.status,
        },
      })
    } else if (action === 'accept') {
      // Buyer accepting counter-offer
      if (!offerId || !buyerId) {
        monitor.end(false)
        return NextResponse.json(
          { error: 'Missing required fields for accept: offerId, buyerId' },
          { status: 400 }
        )
      }

      // Accept the counter offer
      await acceptCounterOffer(offerId, responseMessage)

      // Get the accepted offer details
      const counterOffers = await (await import('@/lib/negotiation-db')).getRoomCounterOffers(room.id)
      const acceptedOffer = counterOffers.find(co => co.id === offerId)

      if (!acceptedOffer) {
        monitor.end(false)
        return NextResponse.json({ error: 'Counter offer not found' }, { status: 404 })
      }

      // Create quote from accepted counter-offer
      const quote = await (await import('@/lib/db')).Quotes.create({
        supplierId: acceptedOffer.supplierId,
        rfqId: room.rfqId,
        price: acceptedOffer.offeredPrice,
        deliveryTime: acceptedOffer.deliveryTime,
        terms: acceptedOffer.terms || '',
        status: 'accepted',
      })

      // Create deal
      const deal = await Deals.create({
        supplierId: acceptedOffer.supplierId,
        buyerId,
        quoteId: quote.id,
        amount: acceptedOffer.offeredPrice,
        wellsFee: acceptedOffer.offeredPrice * 0.0033, // 33 basis points
        status: 'pending',
      })

      // Close negotiation room
      await closeNegotiationRoom(room.id, 'completed', deal.id)

      // Notify room via WebSocket
      await notifyOfferAccepted(room.id, {
        buyerId,
        supplierId: acceptedOffer.supplierId,
        supplierName: acceptedOffer.supplierName,
        finalPrice: acceptedOffer.offeredPrice,
        deliveryTime: acceptedOffer.deliveryTime,
        timestamp: new Date(),
      })

      // Generate purchase order/contract
      const { generatePurchaseOrder } = await import('@/lib/contract-generator')
      const supplier = await Suppliers.findById(acceptedOffer.supplierId)

      const purchaseOrder = await generatePurchaseOrder({
        dealId: deal.id,
        buyerId,
        buyerEmail: room.buyerEmail,
        supplierId: acceptedOffer.supplierId,
        supplierName: acceptedOffer.supplierName,
        supplierEmail: supplier?.email || '',
        amount: acceptedOffer.offeredPrice,
        deliveryTime: acceptedOffer.deliveryTime,
        terms: acceptedOffer.terms,
        acceptedAt: new Date(),
      })

      // Add to deal history
      await addDealHistoryEvent({
        roomId: room.id,
        dealId: deal.id,
        eventType: 'offer_accepted',
        eventData: {
          offerId,
          dealId: deal.id,
          supplierId: acceptedOffer.supplierId,
          supplierName: acceptedOffer.supplierName,
          finalPrice: acceptedOffer.offeredPrice,
          deliveryTime: acceptedOffer.deliveryTime,
          responseMessage,
          contractGenerated: true,
        },
        actorId: buyerId,
        actorType: 'buyer',
      })

      // Add contract generation event
      await addDealHistoryEvent({
        roomId: room.id,
        dealId: deal.id,
        eventType: 'contract_generated',
        eventData: {
          contractType: 'purchase_order',
          contractLength: purchaseOrder.length,
        },
        actorId: 'system',
        actorType: 'buyer',
      })

      monitor.end(true, { roomId: room.id, offerId, dealId: deal.id })

      return NextResponse.json({
        success: true,
        deal: {
          id: deal.id,
          supplierId: deal.supplierId,
          amount: deal.amount,
          wellsFee: deal.wellsFee,
          status: deal.status,
        },
        purchaseOrder,
        message: 'Counter offer accepted! Purchase order generated. Proceeding to payment.',
      })
    } else if (action === 'reject') {
      // Buyer rejecting counter-offer
      if (!offerId) {
        monitor.end(false)
        return NextResponse.json(
          { error: 'Missing required field for reject: offerId' },
          { status: 400 }
        )
      }

      // Reject the counter offer
      await rejectCounterOffer(offerId, responseMessage)

      // Add to deal history
      await addDealHistoryEvent({
        roomId: room.id,
        eventType: 'offer_rejected',
        eventData: {
          offerId,
          responseMessage,
        },
        actorId: buyerId || 'unknown',
        actorType: 'buyer',
      })

      monitor.end(true, { roomId: room.id, offerId })

      return NextResponse.json({
        success: true,
        message: 'Counter offer rejected',
      })
    } else {
      monitor.end(false)
      return NextResponse.json(
        { error: 'Invalid action, must be: submit, accept, or reject' },
        { status: 400 }
      )
    }
  } catch (error) {
    monitor.end(false)
    console.error('[API] Counter offer error:', error)

    return NextResponse.json(
      {
        error: 'Failed to process counter offer',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
