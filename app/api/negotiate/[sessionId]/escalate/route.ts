/**
 * POST /api/negotiate/[sessionId]/escalate
 *
 * Manually escalate a negotiation session to human review.
 *
 * @module app/api/negotiate/[sessionId]/escalate/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSession } from '@/lib/negotiation/ai-router';
import {
  createEscalation,
  getEscalationBySession,
  EscalationResult,
} from '@/lib/negotiation/escalation-service';
import { sql } from '@vercel/postgres';

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

    // Check if already escalated
    const existingEscalation = await getEscalationBySession(sessionId);
    if (existingEscalation) {
      return NextResponse.json({
        success: true,
        message: 'Session already has a pending escalation',
        escalation: {
          id: existingEscalation.id,
          reason: existingEscalation.reason,
          priority: existingEscalation.priority,
          status: existingEscalation.status,
          details: existingEscalation.details,
          createdAt: existingEscalation.createdAt,
        },
      });
    }

    // Validate reason
    const reason = body.reason || 'manual_request';
    const details = body.details || 'Manual escalation requested';
    const priority = body.priority || 'medium';

    // Create escalation
    const escalationResult: EscalationResult = {
      shouldEscalate: true,
      reason,
      reasons: [reason],
      priority,
      details,
      suggestedAction: body.suggestedAction || 'Review negotiation and provide guidance',
      reviewData: {
        requestedBy: userId,
        currentTerms: session.currentTerms,
        initialTerms: session.initialTerms,
        currentRound: session.currentRound,
        maxRounds: session.maxRounds,
      },
    };

    const escalation = await createEscalation({
      sessionId,
      rfqId: session.rfqId,
      organizationId: session.buyerAgent.organizationId,
      escalationResult,
      termsUnderReview: session.currentTerms,
      expirationMinutes: 60,
    });

    // Update session status
    await sql`
      UPDATE negotiation_sessions
      SET
        status = 'awaiting_human',
        last_activity_at = NOW()
      WHERE id = ${sessionId}
    `;

    return NextResponse.json({
      success: true,
      message: 'Negotiation escalated for human review',
      escalation: {
        id: escalation.id,
        reason: escalation.reason,
        priority: escalation.priority,
        status: escalation.status,
        details: escalation.details,
        suggestedAction: escalation.suggestedAction,
        expiresAt: escalation.expiresAt,
      },
      session: {
        id: session.id,
        status: 'awaiting_human',
        currentRound: session.currentRound,
        currentTerms: session.currentTerms,
      },
    });
  } catch (error) {
    console.error('[API] escalate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to escalate' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/negotiate/[sessionId]/escalate
 *
 * Get escalation status for a session
 */
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

    const session = await getSession(sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const escalation = await getEscalationBySession(sessionId);

    if (!escalation) {
      return NextResponse.json({
        success: true,
        hasEscalation: false,
        message: 'No pending escalation for this session',
      });
    }

    return NextResponse.json({
      success: true,
      hasEscalation: true,
      escalation: {
        id: escalation.id,
        reason: escalation.reason,
        reasons: escalation.reasons,
        priority: escalation.priority,
        status: escalation.status,
        details: escalation.details,
        suggestedAction: escalation.suggestedAction,
        termsUnderReview: escalation.termsUnderReview,
        assignedTo: escalation.assignedTo,
        createdAt: escalation.createdAt,
        expiresAt: escalation.expiresAt,
      },
    });
  } catch (error) {
    console.error('[API] escalation GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get escalation' },
      { status: 500 }
    );
  }
}
