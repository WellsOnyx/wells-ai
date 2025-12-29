/**
 * Negotiation Chat API Route
 *
 * Handles all conversational negotiation requests.
 * This is the main entry point for chat-based negotiations.
 *
 * Endpoints:
 * - POST /api/chat/negotiation - Process a negotiation chat message
 * - GET /api/chat/negotiation - Get active negotiations for user
 *
 * Example requests:
 * - "Negotiate with Acme for better pricing"
 * - "Don't go below $45 per unit"
 * - "How's the negotiation going?"
 * - "What did they counter with?"
 * - "Accept their last offer"
 * - "Negotiate automatically within my limits"
 * - "What's a good counter to their offer?"
 *
 * @module app/api/chat/negotiation/route
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getConversationalNegotiationEngine,
  ConversationalNegotiationSession,
  NegotiationChatResult,
} from '@/lib/negotiation/conversational-negotiation';
import {
  getConversationContext,
  saveConversationContext,
  addMessage,
} from '@/lib/chat/conversation-manager';

// ============================================================================
// REQUEST TYPES
// ============================================================================

interface NegotiationChatRequest {
  /** The user's message */
  message: string;

  /** Session ID for existing negotiation (optional) */
  sessionId?: string;

  /** Conversation session ID for context (optional) */
  conversationId?: string;

  /** User ID (required) */
  userId: string;

  /** Organization ID (optional) */
  organizationId?: string;

  /** Organization name (optional) */
  organizationName?: string;

  /** Additional context (optional) */
  context?: {
    journey?: 'buyer' | 'seller' | 'founder';
    previousMessages?: Array<{ role: string; content: string }>;
  };
}

interface NegotiationListRequest {
  userId: string;
  status?: 'active' | 'paused' | 'completed' | 'all';
}

// ============================================================================
// POST - Process negotiation message
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as NegotiationChatRequest;

    // Validate required fields
    if (!body.message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!body.userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get the negotiation engine
    const engine = getConversationalNegotiationEngine();

    // Get or create conversation context
    const conversationId = body.conversationId || `neg_conv_${Date.now()}`;
    const conversationContext = await getConversationContext(conversationId, body.userId);

    // Set journey if provided
    if (body.context?.journey) {
      conversationContext.userJourney = body.context.journey;
    }

    // Set organization info in preferences
    if (body.organizationId) {
      conversationContext.userPreferences.organizationId = body.organizationId;
    }
    if (body.organizationName) {
      conversationContext.userPreferences.organizationName = body.organizationName;
    }

    // Add user message to conversation
    addMessage(conversationContext, 'user', body.message);

    // Process through the negotiation engine
    const result = await engine.processMessage(
      body.userId,
      body.organizationId || body.userId,
      body.organizationName || 'Your Organization',
      body.message,
      body.sessionId
    );

    // Add assistant response to conversation
    addMessage(conversationContext, 'assistant', result.response);

    // Track negotiation as active deal if we have a session
    if (result.session && result.session.id) {
      conversationContext.activeDeals = conversationContext.activeDeals.filter(
        d => d.id !== result.session.id
      );
      conversationContext.activeDeals.unshift({
        id: result.session.id,
        type: 'negotiation',
        status: result.session.status,
        lastUpdate: new Date(),
        summary: `Negotiation with ${result.session.counterpartyName}`,
        requiresAction: result.session.status === 'awaiting_approval' || !!result.session.pendingAction,
        counterparty: result.session.counterpartyName,
      });
    }

    // Save conversation context
    await saveConversationContext(conversationContext);

    // Format response
    const response = {
      success: true,
      message: result.response,
      session: formatSessionForResponse(result.session),
      complete: result.complete,
      outcome: result.outcome,
      quickActions: result.quickActions,
      suggestedActions: result.suggestedActions,
      conversationId,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Negotiation API] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        message: "I had trouble processing your request. Please try again.",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - List negotiations
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status') || 'active';

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const engine = getConversationalNegotiationEngine();

    // Get user's negotiation sessions
    const sessions = await engine.getUserActiveSessions(userId);

    // Filter by status if not 'all'
    const filteredSessions = status === 'all'
      ? sessions
      : sessions.filter(s => {
          if (status === 'active') {
            return ['active', 'paused', 'awaiting_approval'].includes(s.status);
          }
          return s.status === status;
        });

    // Format sessions for response
    const formattedSessions = filteredSessions.map(formatSessionForResponse);

    return NextResponse.json({
      success: true,
      negotiations: formattedSessions,
      total: formattedSessions.length,
    });

  } catch (error) {
    console.error('[Negotiation API] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format session for API response (remove sensitive/internal data)
 */
function formatSessionForResponse(session: ConversationalNegotiationSession): Record<string, unknown> {
  return {
    id: session.id,
    counterpartyName: session.counterpartyName,
    subject: session.subject,
    mode: session.mode,
    status: session.status,
    round: session.round,
    maxRounds: session.maxRounds,

    // Constraints (without internal details)
    constraints: {
      targetPrice: session.constraints.targetPrice,
      priceLimit: session.constraints.priceLimit,
      quantity: session.constraints.quantity,
      maxLeadTime: session.constraints.maxLeadTime,
    },

    // Current offer details
    currentOffer: session.currentOffer ? {
      from: session.currentOffer.from,
      unitPrice: session.currentOffer.unitPrice,
      totalPrice: session.currentOffer.totalPrice,
      quantity: session.currentOffer.quantity,
      leadTimeDays: session.currentOffer.leadTimeDays,
      paymentTerms: session.currentOffer.paymentTerms,
      round: session.currentOffer.round,
    } : null,

    // Best offer so far
    bestOffer: session.bestOffer ? {
      from: session.bestOffer.from,
      totalPrice: session.bestOffer.totalPrice,
      round: session.bestOffer.round,
    } : null,

    // Strategy summary (not full details)
    strategy: session.strategy ? {
      approach: session.strategy.approach,
      riskLevel: session.strategy.riskLevel,
      recommendedNextMove: session.strategy.recommendedNextMove,
    } : null,

    // Pending action
    pendingAction: session.pendingAction ? {
      type: session.pendingAction.type,
      reasoning: session.pendingAction.reasoning,
      confidence: session.pendingAction.confidence,
    } : null,

    // Final terms if completed
    finalTerms: session.finalTerms,

    // Savings if achieved
    savings: session.savings,

    // Timestamps
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
    expiresAt: session.expiresAt,
    completedAt: session.completedAt,

    // Offer history count (not full history)
    offerCount: session.offerHistory.length,

    // Recent chat messages (last 5)
    recentMessages: session.chatHistory.slice(-5).map(m => ({
      role: m.role,
      content: m.content.substring(0, 500), // Truncate long messages
      timestamp: m.timestamp,
    })),
  };
}

// ============================================================================
// OPTIONS - CORS support
// ============================================================================

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
