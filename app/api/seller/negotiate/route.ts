/**
 * Seller Negotiation API
 *
 * Handles negotiation interactions with the seller agent.
 *
 * POST /api/seller/negotiate - Handle a negotiation action
 * GET /api/seller/negotiate - Get active negotiations
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSellerAgent } from '@/lib/seller/seller-agent';
import {
  getSellerNegotiations,
  NegotiationSession,
} from '@/lib/seller/seller-negotiation-agent';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, offer, message } = body as {
      sessionId: string;
      offer?: { price: number; message?: string };
      message?: string;
    };

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Create agent
    const agent = await createSellerAgent(userId);

    // If this is an incoming buyer offer
    if (offer) {
      const result = await agent.handleNegotiationOffer(sessionId, offer);

      return NextResponse.json({
        success: true,
        session: {
          id: result.session.id,
          status: result.session.status,
          round: result.session.round,
          currentPrice: result.session.currentPrice,
          initialBuyerPrice: result.session.initialBuyerPrice,
          initialSellerPrice: result.session.initialSellerPrice,
        },
        response: result.response,
        message: result.response.action === 'accept'
          ? `Deal accepted at $${offer.price.toFixed(2)}!`
          : result.response.action === 'counter'
          ? `Counter offer: $${result.response.counterPrice?.toFixed(2)}`
          : result.response.action === 'escalate'
          ? 'This deal needs your review before proceeding.'
          : `Negotiation ended: ${result.response.message}`,
      });
    }

    // Otherwise, process via chat
    const chatResponse = await agent.chat(
      message || `Show negotiation ${sessionId}`
    );

    return NextResponse.json({
      success: true,
      response: chatResponse,
    });
  } catch (error) {
    console.error('Negotiation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Negotiation failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') as NegotiationSession['status'] | null;

    const negotiations = await getSellerNegotiations(userId, {
      status: status || undefined,
    });

    // Group by status
    const active = negotiations.filter(n => n.status === 'active');
    const pending = negotiations.filter(n => n.status === 'pending');
    const completed = negotiations.filter(n =>
      ['seller_accepted', 'buyer_accepted', 'no_deal'].includes(n.status)
    );

    return NextResponse.json({
      success: true,
      negotiations: {
        active: active.map(n => ({
          id: n.id,
          quoteId: n.quoteId,
          status: n.status,
          round: n.round,
          currentPrice: n.currentPrice,
          lastActivity: n.messages[n.messages.length - 1]?.timestamp,
        })),
        pending: pending.map(n => ({
          id: n.id,
          quoteId: n.quoteId,
          status: n.status,
        })),
        completed: completed.map(n => ({
          id: n.id,
          status: n.status,
          finalPrice: n.finalPrice,
          rounds: n.round,
          completedAt: n.completedAt,
        })),
      },
      stats: {
        active: active.length,
        pending: pending.length,
        completed: completed.length,
      },
      summary: active.length > 0
        ? `You have ${active.length} active negotiation${active.length > 1 ? 's' : ''}. The latest is at $${active[0].currentPrice?.toFixed(2)} in round ${active[0].round}.`
        : pending.length > 0
        ? `You have ${pending.length} negotiation${pending.length > 1 ? 's' : ''} waiting to start.`
        : 'No active negotiations right now.',
    });
  } catch (error) {
    console.error('Get negotiations error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get negotiations' },
      { status: 500 }
    );
  }
}
