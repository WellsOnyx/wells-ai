/**
 * GET /api/negotiate/[sessionId]
 *
 * Get negotiation session status, messages, and details.
 *
 * @module app/api/negotiate/[sessionId]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSession, runFullNegotiation } from '@/lib/negotiation/ai-router';
import { getEscalationBySession } from '@/lib/negotiation/escalation-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const session = await getSession(sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check for pending escalation
    const escalation = await getEscalationBySession(sessionId);

    // Calculate progress
    const initial = session.initialTerms.totalPrice;
    const current = session.currentTerms?.totalPrice || initial;
    const final = session.finalTerms?.totalPrice;
    const priceChange = initial - (final || current);
    const priceChangePercent = (priceChange / initial) * 100;

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        rfqId: session.rfqId,
        status: session.status,
        subject: session.subject,
        buyer: {
          name: session.buyerAgent.organizationName,
          agentId: session.buyerAgent.agentId,
        },
        seller: {
          name: session.sellerAgent.organizationName,
          agentId: session.sellerAgent.agentId,
        },
        progress: {
          currentRound: session.currentRound,
          maxRounds: session.maxRounds,
          percentComplete: (session.currentRound / session.maxRounds) * 100,
        },
        pricing: {
          initialPrice: initial,
          currentPrice: current,
          finalPrice: final,
          priceChange,
          priceChangePercent,
        },
        terms: {
          initial: session.initialTerms,
          current: session.currentTerms,
          final: session.finalTerms,
        },
        timing: {
          createdAt: session.createdAt,
          lastActivityAt: session.lastActivityAt,
          expiresAt: session.expiresAt,
          completedAt: session.completedAt,
        },
        analytics: session.analytics,
      },
      messages: session.messages.map(m => ({
        id: m.messageId,
        round: m.round,
        timestamp: m.timestamp,
        from: m.sender.agentType,
        fromOrg: m.sender.organizationName,
        type: m.type,
        message: m.message,
        terms: m.terms,
        confidence: m.confidence,
      })),
      escalation: escalation ? {
        id: escalation.id,
        reason: escalation.reason,
        priority: escalation.priority,
        status: escalation.status,
        details: escalation.details,
        suggestedAction: escalation.suggestedAction,
        expiresAt: escalation.expiresAt,
      } : null,
      actions: getAvailableActions(session.status, !!escalation),
    });
  } catch (error) {
    console.error('[API] session GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get session' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/negotiate/[sessionId]
 *
 * Resume or continue a negotiation session
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    const body = await request.json();

    const session = await getSession(sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Handle different actions
    if (body.action === 'resume') {
      if (session.status !== 'awaiting_human') {
        return NextResponse.json(
          { error: 'Session is not awaiting human input' },
          { status: 400 }
        );
      }

      // Resume the negotiation
      const result = await runFullNegotiation(session);

      return NextResponse.json({
        success: true,
        sessionId: session.id,
        status: result.session.status,
        summary: result.summary,
        finalTerms: result.session.finalTerms,
      });
    }

    if (body.action === 'run') {
      if (!['active', 'initializing'].includes(session.status)) {
        return NextResponse.json(
          { error: `Cannot run negotiation in ${session.status} status` },
          { status: 400 }
        );
      }

      const result = await runFullNegotiation(session);

      return NextResponse.json({
        success: true,
        sessionId: session.id,
        status: result.session.status,
        summary: result.summary,
        finalTerms: result.session.finalTerms,
        analytics: result.session.analytics,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "resume" or "run".' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] session POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process action' },
      { status: 500 }
    );
  }
}

function getAvailableActions(status: string, hasEscalation: boolean): string[] {
  const actions: string[] = [];

  if (hasEscalation) {
    actions.push('decide');
  }

  switch (status) {
    case 'active':
    case 'initializing':
      actions.push('run', 'pause', 'cancel');
      break;
    case 'awaiting_human':
      actions.push('resume', 'cancel');
      break;
    case 'agreed':
      actions.push('approve', 'reject');
      break;
    case 'stalemate':
    case 'rejected':
      actions.push('retry');
      break;
  }

  return actions;
}
