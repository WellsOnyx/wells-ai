/**
 * RFQ Negotiation API
 *
 * GET /api/rfq/[id]/negotiate - Get current negotiation status
 * POST /api/rfq/[id]/negotiate - Start or continue AI-to-AI negotiation
 *
 * @module app/api/rfq/[id]/negotiate/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  startNegotiation,
  runNegotiationRound,
  runFullNegotiation,
  getNegotiationsByRFQ,
  getNegotiationById,
  manualAccept,
  manualReject,
  pauseNegotiation,
  resumeNegotiation,
} from '@/lib/rfq/negotiation-engine';
import {
  RFQNegotiation,
  NegotiationResult,
  StartNegotiationInput,
} from '@/lib/rfq/types';
import { getConstraintsByRFQ } from '@/lib/rfq/constraint-service';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET - Get current negotiation status
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: rfqId } = await params;

    if (!rfqId) {
      return NextResponse.json(
        { error: 'RFQ ID is required' },
        { status: 400 }
      );
    }

    const negotiations = await getNegotiationsByRFQ(rfqId);

    // Get active negotiation details
    const activeNegotiation = negotiations.find(
      (n: RFQNegotiation) => n.status === 'active'
    );

    return NextResponse.json({
      success: true,
      negotiations,
      activeNegotiation,
      summary: {
        total: negotiations.length,
        active: negotiations.filter((n: RFQNegotiation) => n.status === 'active').length,
        completed: negotiations.filter((n: RFQNegotiation) => n.status === 'completed').length,
        agreements: negotiations.filter((n: RFQNegotiation) => n.outcome === 'agreement').length,
      },
    });
  } catch (error) {
    console.error('Error fetching negotiations:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch negotiations',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Start or continue AI-to-AI negotiation
// ============================================================================

/**
 * Negotiation action types
 */
type NegotiationAction =
  | 'start'           // Start new negotiation session
  | 'run'             // Run single negotiation round
  | 'start_and_run'   // Start and run full negotiation
  | 'accept'          // Manually accept current offer
  | 'reject'          // Manually reject negotiation
  | 'pause'           // Pause active negotiation
  | 'resume';         // Resume paused negotiation

/**
 * Request body for negotiation actions
 */
interface NegotiationActionRequest {
  action: NegotiationAction;
  quoteId?: string;
  negotiationId?: string;
  maxRounds?: number;
  acceptedBy?: string;
  rejectedBy?: string;
  reason?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: rfqId } = await params;

    if (!rfqId) {
      return NextResponse.json(
        { error: 'RFQ ID is required' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as NegotiationActionRequest;
    const { action, quoteId, negotiationId, ...options } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required. Valid actions: start, run, start_and_run, accept, reject, pause, resume' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'start': {
        // Start new negotiation session
        if (!quoteId) {
          return NextResponse.json(
            { error: 'quoteId is required to start negotiation' },
            { status: 400 }
          );
        }

        // Check constraints exist
        const constraints = await getConstraintsByRFQ(rfqId);
        if (!constraints) {
          return NextResponse.json(
            { error: 'Please set budget constraints before starting negotiation' },
            { status: 400 }
          );
        }

        const negotiationInput: StartNegotiationInput = {
          rfqId,
          quoteId,
          maxRounds: options.maxRounds,
        };

        const negotiation = await startNegotiation(negotiationInput);

        return NextResponse.json({
          success: true,
          negotiation,
          message: 'Negotiation started. Use action=run to begin AI negotiation.',
        });
      }

      case 'run': {
        // Run single negotiation round
        if (!negotiationId) {
          return NextResponse.json(
            { error: 'negotiationId is required' },
            { status: 400 }
          );
        }

        const roundResult = await runNegotiationRound(negotiationId);

        return NextResponse.json({
          success: true,
          negotiation: roundResult.negotiation,
          roundComplete: roundResult.roundComplete,
          reachedAgreement: roundResult.reachedAgreement,
          walkedAway: roundResult.walkedAway,
        });
      }

      case 'start_and_run': {
        // Start and run full negotiation in one call
        if (!quoteId) {
          return NextResponse.json(
            { error: 'quoteId is required' },
            { status: 400 }
          );
        }

        const constraints = await getConstraintsByRFQ(rfqId);
        if (!constraints) {
          return NextResponse.json(
            { error: 'Please set budget constraints before starting negotiation' },
            { status: 400 }
          );
        }

        const negotiationInput: StartNegotiationInput = {
          rfqId,
          quoteId,
          maxRounds: options.maxRounds,
        };

        const result: NegotiationResult = await runFullNegotiation(negotiationInput);

        return NextResponse.json({
          success: true,
          negotiation: result.negotiation,
          finalQuote: result.finalQuote,
          negotiationSuccess: result.success,
          summary: result.summary,
        });
      }

      case 'accept': {
        // Manually accept current offer
        if (!negotiationId) {
          return NextResponse.json(
            { error: 'negotiationId is required' },
            { status: 400 }
          );
        }

        const negotiation = await manualAccept(
          negotiationId,
          options.acceptedBy || userId
        );

        return NextResponse.json({
          success: true,
          negotiation,
          message: 'Offer accepted manually',
        });
      }

      case 'reject': {
        // Manually reject negotiation
        if (!negotiationId) {
          return NextResponse.json(
            { error: 'negotiationId is required' },
            { status: 400 }
          );
        }

        const negotiation = await manualReject(
          negotiationId,
          options.rejectedBy || userId,
          options.reason || 'Manually rejected'
        );

        return NextResponse.json({
          success: true,
          negotiation,
          message: 'Negotiation rejected',
        });
      }

      case 'pause': {
        // Pause active negotiation
        if (!negotiationId) {
          return NextResponse.json(
            { error: 'negotiationId is required' },
            { status: 400 }
          );
        }

        const negotiation = await pauseNegotiation(negotiationId);

        return NextResponse.json({
          success: true,
          negotiation,
          message: 'Negotiation paused',
        });
      }

      case 'resume': {
        // Resume paused negotiation
        if (!negotiationId) {
          return NextResponse.json(
            { error: 'negotiationId is required' },
            { status: 400 }
          );
        }

        const negotiation = await resumeNegotiation(negotiationId);

        return NextResponse.json({
          success: true,
          negotiation,
          message: 'Negotiation resumed',
        });
      }

      default:
        return NextResponse.json(
          {
            error: `Unknown action: ${action}`,
            validActions: ['start', 'run', 'start_and_run', 'accept', 'reject', 'pause', 'resume'],
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in negotiation:', error);

    // Handle specific error types
    if (error instanceof Error) {
      // Check for known error codes
      const knownErrors: Record<string, number> = {
        NEGOTIATION_NOT_FOUND: 404,
        QUOTE_NOT_FOUND: 404,
        CONSTRAINTS_NOT_SET: 400,
        AUTO_NEGOTIATE_DISABLED: 400,
        NEGOTIATION_TIMEOUT: 408,
        NEGOTIATION_STALEMATE: 409,
      };

      // Check if error message contains any known error codes
      for (const [code, statusCode] of Object.entries(knownErrors)) {
        if (error.message.includes(code)) {
          return NextResponse.json(
            { error: error.message, code },
            { status: statusCode }
          );
        }
      }
    }

    return NextResponse.json(
      {
        error: 'Negotiation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
