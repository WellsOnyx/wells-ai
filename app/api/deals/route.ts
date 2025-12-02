/**
 * Wells AI Deals API
 *
 * Endpoints for creating deals, accepting offers, and managing escrow.
 *
 * POST /api/deals - Create a new deal proposal
 * GET /api/deals - List deals for current user
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { TransactionEngine, proposeDeal, type Party, type DealTerms } from '@/lib/transactions'
import { calculateTrustScore, type TrustMetrics } from '@/lib/trust'

// Temporary in-memory store (replace with database)
const deals = new Map<string, ReturnType<typeof proposeDeal>>()
const users = new Map<string, { metrics: TrustMetrics; stripeAccountId?: string }>()

// ============================================================================
// GET - List deals
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Filter deals where user is buyer or seller
    const userDeals = Array.from(deals.values()).filter(
      (deal) => deal.buyer.id === userId || deal.seller.id === userId
    )

    return NextResponse.json({
      deals: userDeals,
      count: userDeals.length,
    })
  } catch (error) {
    console.error('Error fetching deals:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================================
// POST - Create deal proposal
// ============================================================================

interface CreateDealRequest {
  seller: {
    id: string
    name: string
    email: string
  }
  terms: {
    amount: number // In cents
    currency?: string
    description: string
    deliverables: string[]
    timeline?: {
      startDate: string
      endDate: string
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as CreateDealRequest

    // Validate required fields
    if (!body.seller?.id || !body.terms?.amount || !body.terms?.description) {
      return NextResponse.json(
        { error: 'Missing required fields: seller, terms.amount, terms.description' },
        { status: 400 }
      )
    }

    // Get or create buyer trust metrics
    let buyerData = users.get(userId)
    if (!buyerData) {
      buyerData = {
        metrics: getDefaultMetrics(new Date()),
      }
      users.set(userId, buyerData)
    }

    // Get or create seller trust metrics
    let sellerData = users.get(body.seller.id)
    if (!sellerData) {
      sellerData = {
        metrics: getDefaultMetrics(new Date()),
      }
      users.set(body.seller.id, sellerData)
    }

    // Calculate trust scores
    const buyerTrust = calculateTrustScore(buyerData.metrics)
    const sellerTrust = calculateTrustScore(sellerData.metrics)

    // Create parties
    const buyer: Party = {
      id: userId,
      type: 'buyer',
      name: 'Current User', // TODO: Get from Clerk user profile
      email: 'user@example.com', // TODO: Get from Clerk user profile
      stripeAccountId: buyerData.stripeAccountId,
      trustScore: buyerTrust,
    }

    const seller: Party = {
      id: body.seller.id,
      type: 'seller',
      name: body.seller.name,
      email: body.seller.email,
      stripeAccountId: sellerData.stripeAccountId,
      trustScore: sellerTrust,
    }

    // Create deal terms
    const terms: DealTerms = {
      amount: body.terms.amount,
      currency: body.terms.currency || 'usd',
      description: body.terms.description,
      deliverables: body.terms.deliverables || [],
      timeline: body.terms.timeline
        ? {
            startDate: new Date(body.terms.timeline.startDate),
            endDate: new Date(body.terms.timeline.endDate),
          }
        : undefined,
    }

    // Create the deal proposal
    const deal = proposeDeal(buyer, seller, terms)

    // Store the deal
    deals.set(deal.id, deal)

    return NextResponse.json({
      success: true,
      deal,
      message: 'Deal proposal created. Awaiting seller response.',
    })
  } catch (error) {
    console.error('Error creating deal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function getDefaultMetrics(createdAt: Date): TrustMetrics {
  return {
    totalDeals: 0,
    completedDeals: 0,
    cancelledDeals: 0,
    disputedDeals: 0,
    disputesLost: 0,
    onTimeDeliveries: 0,
    lateDeliveries: 0,
    totalVolume: 0,
    accountCreatedAt: createdAt,
    verificationLevel: 'email',
    averageResponseMinutes: 120,
    missedPayments: 0,
    totalPayments: 0,
  }
}
