/**
 * Wells AI Deal Actions API
 *
 * Endpoints for individual deal operations.
 *
 * GET /api/deals/[id] - Get deal details
 * POST /api/deals/[id] - Perform action on deal (accept, reject, deliver, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  TransactionEngine,
  type Deal,
} from '@/lib/transactions'

// Temporary in-memory store (shared with parent route - in production use DB)
const deals = new Map<string, Deal>()

// ============================================================================
// GET - Get deal details
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    const { id } = await params

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const deal = deals.get(id)

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Verify user is part of this deal
    if (deal.buyer.id !== userId && deal.seller.id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json({ deal })
  } catch (error) {
    console.error('Error fetching deal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================================
// POST - Perform action on deal
// ============================================================================

type DealAction =
  | 'accept'
  | 'reject'
  | 'counter'
  | 'mark_delivered'
  | 'confirm_delivery'
  | 'dispute'

interface DealActionRequest {
  action: DealAction
  counterTerms?: Partial<Deal['terms']>
  message?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    const { id } = await params

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const deal = deals.get(id)

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Verify user is part of this deal
    if (deal.buyer.id !== userId && deal.seller.id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = (await request.json()) as DealActionRequest
    const isBuyer = deal.buyer.id === userId
    const viewerType = isBuyer ? 'buyer' : 'seller'

    switch (body.action) {
      case 'accept': {
        // One-click accept - the magic moment
        const result = await TransactionEngine.oneClickAccept(deal, viewerType)
        deals.set(id, result.deal)

        return NextResponse.json({
          success: true,
          deal: result.deal,
          nextAction: result.nextAction,
          escrowAddress: result.escrowAddress,
          totalRequired: result.totalRequired,
          message:
            result.nextAction === 'deposit_grain'
              ? 'Deal accepted! Complete GRAIN deposit to secure escrow.'
              : result.nextAction === 'await_other_party'
              ? 'Your acceptance recorded. Awaiting other party.'
              : 'Deal already escrowed. Work can begin!',
        })
      }

      case 'reject': {
        const updatedDeal: Deal = {
          ...deal,
          status: 'cancelled',
          updatedAt: new Date(),
          messages: [
            ...deal.messages,
            {
              id: `msg_${Date.now()}`,
              from: isBuyer ? 'buyer_ai' : 'seller_ai',
              content: body.message || 'Deal declined.',
              timestamp: new Date(),
            },
          ],
        }
        deals.set(id, updatedDeal)

        return NextResponse.json({
          success: true,
          deal: updatedDeal,
          message: 'Deal declined.',
        })
      }

      case 'counter': {
        if (!body.counterTerms) {
          return NextResponse.json(
            { error: 'Counter terms required' },
            { status: 400 }
          )
        }

        const updatedDeal = TransactionEngine.counterPropose(
          deal,
          isBuyer ? 'buyer_ai' : 'seller_ai',
          body.counterTerms,
          body.message || 'Counter-proposal submitted.'
        )
        deals.set(id, updatedDeal)

        return NextResponse.json({
          success: true,
          deal: updatedDeal,
          message: 'Counter-proposal sent.',
        })
      }

      case 'mark_delivered': {
        if (!isBuyer && deal.status !== 'escrowed' && deal.status !== 'in_progress') {
          return NextResponse.json(
            { error: 'Deal must be escrowed or in progress' },
            { status: 400 }
          )
        }

        const updatedDeal = TransactionEngine.markDelivered(deal)
        deals.set(id, updatedDeal)

        return NextResponse.json({
          success: true,
          deal: updatedDeal,
          message: 'Delivery marked complete. Awaiting buyer confirmation.',
        })
      }

      case 'confirm_delivery': {
        if (!isBuyer) {
          return NextResponse.json(
            { error: 'Only buyer can confirm delivery' },
            { status: 403 }
          )
        }

        if (deal.status !== 'delivered') {
          return NextResponse.json(
            { error: 'Deal must be marked as delivered first' },
            { status: 400 }
          )
        }

        // Release escrow to seller
        const updatedDeal = await TransactionEngine.releaseEscrow(deal)
        deals.set(id, updatedDeal)

        return NextResponse.json({
          success: true,
          deal: updatedDeal,
          message: 'Delivery confirmed! Funds released to seller.',
        })
      }

      case 'dispute': {
        const updatedDeal: Deal = {
          ...deal,
          status: 'disputed',
          updatedAt: new Date(),
          messages: [
            ...deal.messages,
            {
              id: `msg_${Date.now()}`,
              from: 'system',
              content: `Dispute opened by ${viewerType}: ${body.message || 'No details provided'}`,
              timestamp: new Date(),
            },
          ],
        }
        deals.set(id, updatedDeal)

        return NextResponse.json({
          success: true,
          deal: updatedDeal,
          message: 'Dispute opened. Our team will review and respond within 24 hours.',
        })
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${body.action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error processing deal action:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
