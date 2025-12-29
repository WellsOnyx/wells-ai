/**
 * POST /api/negotiate
 *
 * Start a new AI-to-AI negotiation session.
 * Can be triggered conversationally ("find me a supplier for 1000 ball bearings")
 * or programmatically with structured data.
 *
 * @module app/api/negotiate/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  processConversationalRequest,
  findMatchingSellerAgents,
  createNegotiationSession,
  runFullNegotiation,
  getSessionsByRFQ,
} from '@/lib/negotiation/ai-router';
import { NegotiationTerms } from '@/lib/negotiation/protocol';
import { runNegotiation, quickMatch, type PartyProfile, type NegotiationRequest } from '@/lib/ai-negotiation';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // NEW: Conversational mode for AI-to-AI router
    if (body.conversational && body.message) {
      return handleConversationalRequest(body, userId);
    }

    // NEW: RFQ-based negotiation
    if (body.rfqId && body.buyerOrgId) {
      return handleRFQNegotiation(body);
    }

    // LEGACY: Original quick match/direct negotiation mode
    if (body.type && body.subject && body.initiator) {
      return handleLegacyNegotiation(body, userId);
    }

    return NextResponse.json(
      { error: 'Invalid request. Provide conversational message, rfqId, or legacy negotiation params.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] negotiate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start negotiation' },
      { status: 500 }
    );
  }
}

/**
 * Handle conversational requests like "find me a supplier for 1000 ball bearings"
 */
async function handleConversationalRequest(
  body: {
    message: string;
    organizationId?: string;
    organizationName?: string;
    autoRun?: boolean;
  },
  userId: string
) {
  const {
    message,
    organizationId = userId,
    organizationName = 'Your Organization',
    autoRun = true,
  } = body;

  if (!message) {
    return NextResponse.json(
      { error: 'Missing required field: message' },
      { status: 400 }
    );
  }

  // Process the conversational request
  const result = await processConversationalRequest(
    userId,
    organizationId,
    organizationName,
    message
  );

  // If autoRun is true, start the negotiations immediately
  if (autoRun && result.sessions.length > 0) {
    const negotiationResults = await Promise.all(
      result.sessions.map(session => runFullNegotiation(session))
    );

    // Find best result
    const completedSessions = negotiationResults.filter(r => r.success);
    let bestOffer = null;

    if (completedSessions.length > 0) {
      // Sort by final price
      completedSessions.sort((a, b) => {
        const priceA = a.session.finalTerms?.totalPrice || Infinity;
        const priceB = b.session.finalTerms?.totalPrice || Infinity;
        return priceA - priceB;
      });

      const best = completedSessions[0];
      bestOffer = {
        sessionId: best.session.id,
        supplierName: best.session.sellerAgent.organizationName,
        unitPrice: best.session.finalTerms?.unitPrice,
        totalPrice: best.session.finalTerms?.totalPrice,
        leadTimeDays: best.session.finalTerms?.leadTimeDays,
        savings: best.session.analytics.reductionPercentage,
      };
    }

    // Generate status update for chat
    let statusMessage = result.statusMessage;
    if (bestOffer) {
      statusMessage = `I negotiated with ${result.sessions.length} suppliers. Best offer: $${bestOffer.unitPrice?.toFixed(2)}/unit from ${bestOffer.supplierName}. `;
      if (bestOffer.savings && bestOffer.savings > 0) {
        statusMessage += `I saved you ${bestOffer.savings.toFixed(1)}% off the initial quote. `;
      }
      statusMessage += `Say "go with ${bestOffer.supplierName}" to proceed.`;
    } else if (result.sessions.length > 0) {
      statusMessage = `I contacted ${result.sessions.length} suppliers but couldn't reach agreement. Would you like me to adjust the requirements?`;
    }

    return NextResponse.json({
      success: true,
      mode: 'ai_to_ai',
      rfqId: result.rfqId,
      sessionsStarted: result.sessions.length,
      sessionsCompleted: negotiationResults.length,
      agreementsReached: completedSessions.length,
      bestOffer,
      statusMessage,
      sessions: negotiationResults.map(r => ({
        sessionId: r.session.id,
        supplierName: r.session.sellerAgent.organizationName,
        status: r.session.status,
        success: r.success,
        summary: r.summary,
        finalPrice: r.session.finalTerms?.totalPrice,
        rounds: r.session.currentRound,
      })),
    });
  }

  // Return without running negotiations
  return NextResponse.json({
    success: true,
    mode: 'ai_to_ai',
    rfqId: result.rfqId,
    sessionsCreated: result.sessions.length,
    statusMessage: result.statusMessage,
    sessions: result.sessions.map(s => ({
      sessionId: s.id,
      supplierName: s.sellerAgent.organizationName,
      status: s.status,
    })),
  });
}

/**
 * Handle programmatic negotiation requests for existing RFQ
 */
async function handleRFQNegotiation(body: {
  rfqId: string;
  buyerOrgId: string;
  buyerOrgName?: string;
  maxSellers?: number;
  autoRun?: boolean;
}) {
  const {
    rfqId,
    buyerOrgId,
    buyerOrgName = 'Buyer',
    maxSellers = 3,
    autoRun = true,
  } = body;

  // Check for existing sessions
  const existingSessions = await getSessionsByRFQ(rfqId);
  const activeSessions = existingSessions.filter(
    s => ['active', 'awaiting_human'].includes(s.status)
  );

  if (activeSessions.length > 0) {
    return NextResponse.json({
      success: true,
      mode: 'ai_to_ai',
      rfqId,
      message: 'Active negotiation sessions already exist for this RFQ',
      sessions: activeSessions.map(s => ({
        sessionId: s.id,
        supplierName: s.sellerAgent.organizationName,
        status: s.status,
        currentRound: s.currentRound,
        currentPrice: s.currentTerms?.totalPrice,
      })),
    });
  }

  return NextResponse.json(
    {
      error: 'Programmatic RFQ negotiation requires full RFQ details. Use conversational mode.',
    },
    { status: 400 }
  );
}

/**
 * Handle legacy negotiation mode (original implementation)
 */
async function handleLegacyNegotiation(
  body: {
    type: 'procurement' | 'hiring' | 'partnership' | 'investment';
    subject: string;
    initiator: Partial<PartyProfile>;
    responders?: Partial<PartyProfile>[];
    responder?: Partial<PartyProfile>;
  },
  userId: string
) {
  const { type, subject, initiator, responders, responder } = body;

  // Build initiator profile
  const initiatorProfile: PartyProfile = {
    id: userId,
    type: initiator.type || 'buyer',
    name: initiator.name || 'You',
    preferences: initiator.preferences || {},
    context: initiator.context || subject,
  };

  // Quick match mode - find and rank potential matches
  if (responders && responders.length > 0) {
    const responderProfiles: PartyProfile[] = responders.map((r, i) => ({
      id: r.id || `responder_${i}`,
      type: r.type || 'seller',
      name: r.name || `Supplier ${i + 1}`,
      preferences: r.preferences || {},
      context: r.context || '',
    }));

    const matchResult = await quickMatch(initiatorProfile, responderProfiles);

    return NextResponse.json({
      mode: 'quick_match',
      matches: matchResult.matches.map(m => ({
        seller: {
          id: m.seller.id,
          name: m.seller.name,
          type: m.seller.type,
        },
        compatibility: m.compatibility,
        suggestedTerms: m.suggestedTerms,
      })),
      message: matchResult.matches.length > 0
        ? `Found ${matchResult.matches.length} potential matches. Your AI can negotiate with any of them.`
        : 'No strong matches found. Try adjusting your requirements.',
    });
  }

  // Direct negotiation mode
  if (responder) {
    const responderProfile: PartyProfile = {
      id: responder.id || 'responder',
      type: responder.type || 'seller',
      name: responder.name || 'Other Party',
      preferences: responder.preferences || {},
      context: responder.context || '',
    };

    const negotiationRequest: NegotiationRequest = {
      id: `req_${Date.now()}`,
      type,
      initiator: initiatorProfile,
      responder: responderProfile,
      subject,
    };

    const result = await runNegotiation(negotiationRequest);

    return NextResponse.json({
      mode: 'negotiation',
      negotiationId: result.id,
      status: result.status,
      rounds: result.rounds,
      finalTerms: result.finalTerms,
      summary: result.initiatorSummary,
      conversation: result.conversation.map(m => ({
        round: m.round,
        from: m.from === 'initiator_ai' ? 'Your AI' : `${responderProfile.name}'s AI`,
        message: m.message,
        proposal: m.proposal,
      })),
      nextAction: result.status === 'agreed'
        ? 'Review and approve the terms below'
        : result.status === 'no_deal'
          ? 'No agreement reached. Consider adjusting your requirements.'
          : 'Human input needed to continue negotiation.',
    });
  }

  return NextResponse.json(
    { error: 'Must provide either responders (for quick match) or responder (for direct negotiation)' },
    { status: 400 }
  );
}

/**
 * GET /api/negotiate
 *
 * List active negotiation sessions or get status
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rfqId = searchParams.get('rfqId');
    const negotiationId = searchParams.get('id');

    if (rfqId) {
      const sessions = await getSessionsByRFQ(rfqId);
      return NextResponse.json({
        success: true,
        rfqId,
        sessions: sessions.map(s => ({
          sessionId: s.id,
          supplierName: s.sellerAgent.organizationName,
          status: s.status,
          currentRound: s.currentRound,
          maxRounds: s.maxRounds,
          initialPrice: s.initialTerms.totalPrice,
          currentPrice: s.currentTerms?.totalPrice,
          finalPrice: s.finalTerms?.totalPrice,
          savings: s.analytics.reductionPercentage,
          createdAt: s.createdAt,
          lastActivityAt: s.lastActivityAt,
        })),
      });
    }

    if (negotiationId) {
      return NextResponse.json({
        error: 'Use /api/negotiate/[sessionId] to get session details',
        negotiationId,
      });
    }

    return NextResponse.json({
      status: 'ok',
      service: 'Wells AI-to-AI Negotiation Router',
      description: 'AI negotiates on your behalf. You just approve.',
      modes: [
        'conversational - "find me a supplier for 1000 ball bearings"',
        'ai_to_ai - Full autonomous negotiation with protocol',
        'quick_match - Find and rank potential matches',
        'negotiation - Direct AI-to-AI negotiation',
      ],
    });
  } catch (error) {
    console.error('[API] negotiate GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list sessions' },
      { status: 500 }
    );
  }
}
