/**
 * AI-to-AI Negotiation Router API
 *
 * REST API for managing AI-to-AI negotiations between Buyer Wells agents
 * and Seller Wells agents.
 *
 * Endpoints:
 * - POST /api/negotiation/ai-router - Initiate a new multi-seller negotiation
 * - GET /api/negotiation/ai-router - Get session status
 * - PATCH /api/negotiation/ai-router - Send counter-offer or accept/reject
 *
 * @module app/api/negotiation/ai-router/route
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAIToAIRouter,
  type BuyerNegotiationContext,
  type NegotiationMessage,
  type MultiSellerNegotiationSession,
  type SellerNegotiationState,
  type OfferRanking,
} from '../../../../lib/negotiation/ai-router';

// ============================================================================
// TYPES
// ============================================================================

interface InitiateNegotiationRequest {
  rfqId: string;
  sellerIds: string[];
  buyerContext: BuyerNegotiationContext;
}

interface SendCounterOfferRequest {
  sessionId: string;
  sellerId?: string;
  action: 'counter' | 'accept' | 'reject' | 'evaluate';
  counterOffer?: {
    totalAmount: number;
    terms?: {
      paymentTerms?: string;
      leadTimeDays?: number;
    };
    reasoning?: string;
  };
}

interface GetStatusRequest {
  sessionId: string;
  includeOffers?: boolean;
  includeRankings?: boolean;
}

// ============================================================================
// POST - Initiate Negotiation
// ============================================================================

/**
 * POST /api/negotiation/ai-router
 *
 * Initiates a new multi-seller negotiation session.
 *
 * Request Body:
 * ```json
 * {
 *   "rfqId": "rfq_123",
 *   "sellerIds": ["seller_1", "seller_2", "seller_3"],
 *   "buyerContext": {
 *     "maxBudget": 10000,
 *     "targetPrice": 8000,
 *     "maxLeadTime": 14,
 *     "requiredSpecs": ["ISO 9001"],
 *     "preferredPaymentTerms": ["Net 30", "Net 45"],
 *     "negotiationStyle": "balanced",
 *     "priorityFactors": {
 *       "price": 40,
 *       "leadTime": 25,
 *       "quality": 20,
 *       "reliability": 15
 *     }
 *   }
 * }
 * ```
 *
 * Response:
 * ```json
 * {
 *   "success": true,
 *   "sessionId": "msn_123456_abc",
 *   "session": { ... },
 *   "strategy": { ... }
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    const body: InitiateNegotiationRequest = await request.json();

    // Validate required fields
    if (!body.rfqId) {
      return NextResponse.json(
        { success: false, error: 'rfqId is required' },
        { status: 400 }
      );
    }

    if (!body.sellerIds || !Array.isArray(body.sellerIds) || body.sellerIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'sellerIds array is required with at least one seller' },
        { status: 400 }
      );
    }

    if (!body.buyerContext) {
      return NextResponse.json(
        { success: false, error: 'buyerContext is required' },
        { status: 400 }
      );
    }

    // Validate buyer context
    const ctx = body.buyerContext;
    if (!ctx.maxBudget || ctx.maxBudget <= 0) {
      return NextResponse.json(
        { success: false, error: 'buyerContext.maxBudget must be a positive number' },
        { status: 400 }
      );
    }

    if (!ctx.targetPrice || ctx.targetPrice <= 0) {
      return NextResponse.json(
        { success: false, error: 'buyerContext.targetPrice must be a positive number' },
        { status: 400 }
      );
    }

    if (ctx.targetPrice > ctx.maxBudget) {
      return NextResponse.json(
        { success: false, error: 'targetPrice cannot exceed maxBudget' },
        { status: 400 }
      );
    }

    // Set defaults for optional fields
    const buyerContext: BuyerNegotiationContext = {
      maxBudget: ctx.maxBudget,
      targetPrice: ctx.targetPrice,
      maxLeadTime: ctx.maxLeadTime || 30,
      requiredSpecs: ctx.requiredSpecs || [],
      preferredPaymentTerms: ctx.preferredPaymentTerms || ['Net 30'],
      negotiationStyle: ctx.negotiationStyle || 'balanced',
      priorityFactors: ctx.priorityFactors || {
        price: 40,
        leadTime: 25,
        quality: 20,
        reliability: 15,
      },
    };

    // Validate priority factors sum to 100
    const factors = buyerContext.priorityFactors;
    const factorSum = factors.price + factors.leadTime + factors.quality + factors.reliability;
    if (factorSum !== 100) {
      return NextResponse.json(
        { success: false, error: `priorityFactors must sum to 100 (got ${factorSum})` },
        { status: 400 }
      );
    }

    // Get router and initiate negotiation
    const router = getAIToAIRouter();

    const session = await router.initiateNegotiation(
      body.rfqId,
      buyerContext,
      body.sellerIds
    );

    // Generate negotiation strategy
    const strategy = await router.generateNegotiationStrategy(buyerContext);

    // Convert Map to object for JSON response
    const sessionResponse = serializeSession(session);

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      session: sessionResponse,
      strategy,
      meta: {
        sellerCount: session.sellerSessions.size,
        expiresAt: session.expiresAt,
        negotiationStyle: buyerContext.negotiationStyle,
      },
    });
  } catch (error) {
    console.error('[AI Router API] POST error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate negotiation',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Get Session Status
// ============================================================================

/**
 * GET /api/negotiation/ai-router?sessionId=xxx
 *
 * Gets the current status of a negotiation session.
 *
 * Query Parameters:
 * - sessionId: The session ID (required)
 * - includeOffers: Include current offers from all sellers (optional, default: true)
 * - includeRankings: Include offer rankings (optional, default: false)
 *
 * Response:
 * ```json
 * {
 *   "success": true,
 *   "status": {
 *     "sessionId": "msn_123456_abc",
 *     "state": "active",
 *     "sellerCount": 3,
 *     "activeSellerCount": 2,
 *     "currentBestOffer": { ... },
 *     "roundsCompleted": 2,
 *     "expiresAt": "2024-01-15T12:00:00Z"
 *   },
 *   "offers": [ ... ],
 *   "rankings": [ ... ]
 * }
 * ```
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const includeOffers = searchParams.get('includeOffers') !== 'false';
    const includeRankings = searchParams.get('includeRankings') === 'true';

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId query parameter is required' },
        { status: 400 }
      );
    }

    const router = getAIToAIRouter();

    // Get session status
    const status = await router.getSessionStatus(sessionId);
    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    const response: {
      success: boolean;
      status: typeof status;
      session?: ReturnType<typeof serializeSession>;
      offers?: Array<{
        sellerId: string;
        sellerName: string;
        totalAmount: number;
        leadTimeDays: number;
        terms: unknown;
        round: number;
      }>;
      rankings?: OfferRanking[];
    } = {
      success: true,
      status,
    };

    // Include full session if requested or by default
    if (includeOffers) {
      const session = await router.getMultiSellerSession(sessionId);
      if (session) {
        response.session = serializeSession(session);

        // Extract current offers
        response.offers = [];
        for (const [sellerId, sellerState] of session.sellerSessions) {
          if (sellerState.currentOffer) {
            response.offers.push({
              sellerId,
              sellerName: sellerState.sellerOrgName,
              totalAmount: sellerState.currentOffer.totalAmount,
              leadTimeDays: sellerState.currentOffer.leadTimeDays,
              terms: sellerState.currentOffer.terms,
              round: sellerState.currentOffer.round,
            });
          }
        }
      }
    }

    // Include rankings if requested
    if (includeRankings) {
      const rankings = await router.evaluateOffers(sessionId);
      response.rankings = rankings;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[AI Router API] GET error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get session status',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Send Counter-Offer or Accept/Reject
// ============================================================================

/**
 * PATCH /api/negotiation/ai-router
 *
 * Sends a counter-offer, accepts an offer, or rejects a negotiation.
 *
 * Request Body:
 * ```json
 * {
 *   "sessionId": "msn_123456_abc",
 *   "sellerId": "seller_1",
 *   "action": "counter" | "accept" | "reject" | "evaluate",
 *   "counterOffer": {
 *     "totalAmount": 8500,
 *     "terms": {
 *       "paymentTerms": "Net 30",
 *       "leadTimeDays": 10
 *     },
 *     "reasoning": "Looking for better pricing given volume commitment."
 *   }
 * }
 * ```
 *
 * Response for "counter":
 * ```json
 * {
 *   "success": true,
 *   "action": "counter",
 *   "responses": {
 *     "seller_1": { ... },
 *     "seller_2": { ... }
 *   },
 *   "session": { ... }
 * }
 * ```
 *
 * Response for "accept":
 * ```json
 * {
 *   "success": true,
 *   "action": "accept",
 *   "awardId": "award_123456_xyz",
 *   "award": {
 *     "sellerId": "seller_1",
 *     "sellerName": "Acme Supplies",
 *     "amount": 8500,
 *     "terms": { ... },
 *     "leadTimeDays": 10
 *   },
 *   "erpSyncTriggered": true
 * }
 * ```
 *
 * Response for "evaluate":
 * ```json
 * {
 *   "success": true,
 *   "action": "evaluate",
 *   "rankings": [ ... ],
 *   "recommendation": {
 *     "sellerId": "seller_1",
 *     "action": "accept",
 *     "reasoning": "Best price within budget."
 *   }
 * }
 * ```
 */
export async function PATCH(request: NextRequest) {
  try {
    const body: SendCounterOfferRequest = await request.json();

    // Validate required fields
    if (!body.sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!body.action) {
      return NextResponse.json(
        { success: false, error: 'action is required (counter, accept, reject, or evaluate)' },
        { status: 400 }
      );
    }

    const validActions = ['counter', 'accept', 'reject', 'evaluate'];
    if (!validActions.includes(body.action)) {
      return NextResponse.json(
        { success: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    const router = getAIToAIRouter();

    // Handle different actions
    switch (body.action) {
      case 'counter': {
        // Validate counter-offer
        if (!body.counterOffer || typeof body.counterOffer.totalAmount !== 'number') {
          return NextResponse.json(
            { success: false, error: 'counterOffer.totalAmount is required for counter action' },
            { status: 400 }
          );
        }

        // Create counter message
        const counterMessage: NegotiationMessage = {
          type: 'counter',
          fromAgent: 'buyer_wells',
          payload: {
            totalAmount: body.counterOffer.totalAmount,
            terms: body.counterOffer.terms ? {
              paymentTerms: body.counterOffer.terms.paymentTerms || 'Net 30',
              currency: 'USD',
              shippingCost: 0,
            } : undefined,
            reasoning: body.counterOffer.reasoning || 'Counter-offer from buyer.',
          },
          timestamp: new Date().toISOString(),
          sessionId: body.sessionId,
          messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        };

        // Route the counter-offer to all active sellers
        const { session, responses } = await router.routeBuyerMessage(
          body.sessionId,
          counterMessage
        );

        // Convert responses Map to object
        const responsesObj: Record<string, NegotiationMessage> = {};
        for (const [sellerId, response] of responses) {
          responsesObj[sellerId] = response;
        }

        return NextResponse.json({
          success: true,
          action: 'counter',
          responses: responsesObj,
          session: serializeSession(session),
          meta: {
            responseCount: responses.size,
            currentRound: Math.max(
              ...Array.from(session.sellerSessions.values()).map((s: SellerNegotiationState) => s.round)
            ),
          },
        });
      }

      case 'accept': {
        // Validate seller ID for accept
        if (!body.sellerId) {
          return NextResponse.json(
            { success: false, error: 'sellerId is required for accept action' },
            { status: 400 }
          );
        }

        // Accept the offer
        const result = await router.acceptOffer(body.sessionId, body.sellerId);

        return NextResponse.json({
          success: true,
          action: 'accept',
          awardId: result.awardId,
          award: result.award,
          erpSyncTriggered: result.erpSyncTriggered,
          session: serializeSession(result.session),
        });
      }

      case 'reject': {
        // Get session and mark as cancelled
        const session = await router.getMultiSellerSession(body.sessionId);
        if (!session) {
          return NextResponse.json(
            { success: false, error: 'Session not found' },
            { status: 404 }
          );
        }

        // Mark all seller sessions as rejected
        for (const [, sellerState] of session.sellerSessions) {
          sellerState.state = 'rejected';
          sellerState.messages.push({
            type: 'reject',
            fromAgent: 'buyer_wells',
            payload: {
              reasoning: body.counterOffer?.reasoning || 'Negotiation cancelled by buyer.',
            },
            timestamp: new Date().toISOString(),
            sessionId: body.sessionId,
            messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          });
        }

        // Update session state
        session.state = 'cancelled';
        session.updatedAt = new Date().toISOString();

        return NextResponse.json({
          success: true,
          action: 'reject',
          session: serializeSession(session),
          message: 'Negotiation has been cancelled.',
        });
      }

      case 'evaluate': {
        // Evaluate all current offers
        const rankings = await router.evaluateOffers(body.sessionId);

        if (rankings.length === 0) {
          return NextResponse.json({
            success: true,
            action: 'evaluate',
            rankings: [],
            recommendation: null,
            message: 'No offers available to evaluate.',
          });
        }

        // Generate recommendation based on best offer
        const best = rankings[0];
        const recommendation = {
          sellerId: best.sellerId,
          sellerName: best.sellerName,
          action: best.recommendation,
          score: best.score,
          reasoning: best.reasoning,
          offer: {
            totalAmount: best.offer.totalAmount,
            leadTimeDays: best.offer.leadTimeDays,
            terms: best.offer.terms,
          },
        };

        return NextResponse.json({
          success: true,
          action: 'evaluate',
          rankings,
          recommendation,
          meta: {
            offerCount: rankings.length,
            acceptableOffers: rankings.filter(r => r.recommendation === 'accept').length,
            negotiableOffers: rankings.filter(r => r.recommendation === 'negotiate').length,
          },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[AI Router API] PATCH error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process action',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Serialize a MultiSellerNegotiationSession for JSON response
 * (converts Maps to plain objects)
 */
function serializeSession(session: MultiSellerNegotiationSession) {
  const sellerSessionsObj: Record<string, unknown> = {};
  for (const [key, value] of session.sellerSessions) {
    sellerSessionsObj[key] = {
      ...value,
      // Ensure messages array is included
      messages: value.messages.map(m => ({
        type: m.type,
        fromAgent: m.fromAgent,
        payload: m.payload,
        timestamp: m.timestamp,
        messageId: m.messageId,
      })),
    };
  }

  return {
    id: session.id,
    rfqId: session.rfqId,
    buyerWellsId: session.buyerWellsId,
    buyerOrgId: session.buyerOrgId,
    buyerOrgName: session.buyerOrgName,
    sellerSessions: sellerSessionsObj,
    currentBestOffer: session.currentBestOffer,
    offerHistory: session.offerHistory,
    state: session.state,
    buyerContext: session.buyerContext,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    expiresAt: session.expiresAt,
    decidedAt: session.decidedAt,
    selectedSellerId: session.selectedSellerId,
  };
}
