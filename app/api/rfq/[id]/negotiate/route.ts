/**
 * RFQ Negotiation API
 * GET: Get negotiation status
 * POST: Start or control negotiation
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  startNegotiation,
  runNegotiation,
  getNegotiationsByRFQ,
  getNegotiationById,
  manualAccept,
  manualReject,
  pauseNegotiation,
  resumeNegotiation,
} from '@/lib/rfq/negotiation-engine';
import { getConstraintsByRFQ } from '@/lib/rfq/constraint-service';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rfqId } = await params;

    const negotiations = await getNegotiationsByRFQ(rfqId);

    // Get active negotiation details
    const activeNegotiation = negotiations.find(n => n.status === 'active');

    return NextResponse.json({
      success: true,
      negotiations,
      activeNegotiation,
      summary: {
        total: negotiations.length,
        active: negotiations.filter(n => n.status === 'active').length,
        completed: negotiations.filter(n => n.status === 'completed').length,
        agreements: negotiations.filter(n => n.outcome === 'agreement').length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching negotiations:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch negotiations' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rfqId } = await params;
    const body = await req.json();
    const { action, quoteId, negotiationId, ...options } = body;

    switch (action) {
      case 'start': {
        // Start new negotiation
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

        const negotiation = await startNegotiation({
          rfqId,
          quoteId,
          maxRounds: options.maxRounds,
        });

        return NextResponse.json({
          success: true,
          negotiation,
          message: 'Negotiation started. Use action=run to begin AI negotiation.',
        });
      }

      case 'run': {
        // Run negotiation to completion
        if (!negotiationId) {
          return NextResponse.json(
            { error: 'negotiationId is required' },
            { status: 400 }
          );
        }

        const result = await runNegotiation(negotiationId);

        return NextResponse.json({
          success: true,
          ...result,
        });
      }

      case 'start_and_run': {
        // Start and run in one call
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

        const negotiation = await startNegotiation({
          rfqId,
          quoteId,
          maxRounds: options.maxRounds,
        });

        const result = await runNegotiation(negotiation.id);

        return NextResponse.json({
          success: true,
          ...result,
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
          options.acceptedBy || 'buyer'
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
          options.rejectedBy || 'buyer',
          options.reason || 'Manually rejected'
        );

        return NextResponse.json({
          success: true,
          negotiation,
          message: 'Negotiation rejected',
        });
      }

      case 'pause': {
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
          { error: `Unknown action: ${action}. Valid actions: start, run, start_and_run, accept, reject, pause, resume` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Error in negotiation:', error);
    return NextResponse.json(
      { error: error.message || 'Negotiation failed' },
      { status: 500 }
    );
  }
}
