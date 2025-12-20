/**
 * RFQ Award API
 * GET: Get award status for an RFQ
 * POST: Award the RFQ to a supplier (accept quote)
 * PUT: Update award status (acknowledge, payment, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  awardQuote,
  getAwardByRFQ,
  getAwardStatus,
  acknowledgeAward,
  initiatePayment,
  completePayment,
  cancelAward,
  markFulfilled,
  completeAward,
  disputeAward,
  retryERPSync,
  linkAwardToERP,
} from '@/lib/rfq/award-service';
import { RFQAward } from '@/lib/rfq/types';
import { getQuoteById } from '@/lib/rfq/quote-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rfq/[id]/award
 * Get award status for an RFQ
 */
export async function GET(
  req: NextRequest,
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

    const award = await getAwardByRFQ(rfqId);

    if (!award) {
      return NextResponse.json({
        success: true,
        award: null,
        message: 'No award for this RFQ yet',
      });
    }

    // Get full award status with related data
    const status = await getAwardStatus(award.id);

    return NextResponse.json({
      success: true,
      award: status.award,
      rfq: status.rfq,
      fulfillment: status.fulfillment,
      deal: status.deal,
      escrow: status.escrow,
    });
  } catch (error: unknown) {
    console.error('Error fetching award:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch award';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rfq/[id]/award
 * Award the RFQ to a supplier (accept quote)
 */
export async function POST(
  req: NextRequest,
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
    const body = await req.json();
    const { quoteId, negotiationId } = body;

    // Validate required fields
    if (!quoteId) {
      return NextResponse.json(
        { error: 'quoteId is required to create an award' },
        { status: 400 }
      );
    }

    // Get quote to validate and get supplier ID
    const quote = await getQuoteById(quoteId);
    if (!quote) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      );
    }

    if (quote.rfqId !== rfqId) {
      return NextResponse.json(
        { error: 'Quote does not belong to this RFQ' },
        { status: 400 }
      );
    }

    // Check if there's already an active award for this RFQ
    const existingAward = await getAwardByRFQ(rfqId);
    if (existingAward && existingAward.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'This RFQ already has an active award' },
        { status: 409 }
      );
    }

    // Create the award
    const result = await awardQuote({
      rfqId,
      quoteId,
      supplierId: quote.supplierId,
      negotiationId,
    });

    return NextResponse.json({
      success: true,
      award: result.award,
      deal: result.deal,
      escrow: result.escrow,
      message: `Quote awarded to ${quote.supplier?.companyName || 'supplier'}. Deal and escrow created.`,
    });
  } catch (error: unknown) {
    console.error('Error creating award:', error);
    const message = error instanceof Error ? error.message : 'Failed to create award';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/rfq/[id]/award
 * Update award status (acknowledge, payment, fulfill, complete, etc.)
 */
export async function PUT(
  req: NextRequest,
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
    const body = await req.json();
    const { action, awardId, reason, erpData } = body;

    // Get the award for this RFQ if awardId not provided
    let targetAwardId = awardId;
    if (!targetAwardId) {
      const award = await getAwardByRFQ(rfqId);
      if (!award) {
        return NextResponse.json(
          { error: 'No award found for this RFQ' },
          { status: 404 }
        );
      }
      targetAwardId = award.id;
    }

    // Validate action
    if (!action) {
      return NextResponse.json(
        { error: 'action is required. Valid actions: acknowledge, initiate_payment, complete_payment, fulfill, complete, cancel, dispute, retry_erp_sync, link_erp' },
        { status: 400 }
      );
    }

    let updatedAward: RFQAward;
    let responseMessage: string;

    switch (action) {
      case 'acknowledge': {
        // Supplier acknowledges the award
        updatedAward = await acknowledgeAward(targetAwardId);
        responseMessage = 'Award acknowledged by supplier';
        break;
      }

      case 'initiate_payment': {
        // Start payment process
        updatedAward = await initiatePayment(targetAwardId);
        responseMessage = 'Payment initiated. Fund the escrow to complete.';
        break;
      }

      case 'complete_payment': {
        // Mark payment as received
        updatedAward = await completePayment(targetAwardId);
        responseMessage = 'Payment completed. Awaiting fulfillment.';
        break;
      }

      case 'fulfill': {
        // Mark as fulfilled (delivery complete)
        updatedAward = await markFulfilled(targetAwardId);
        responseMessage = 'Award marked as fulfilled. Delivery complete.';
        break;
      }

      case 'complete': {
        // Complete the award (final state)
        updatedAward = await completeAward(targetAwardId);
        responseMessage = 'Award completed successfully.';
        break;
      }

      case 'cancel': {
        // Cancel the award
        if (!reason) {
          return NextResponse.json(
            { error: 'reason is required for cancellation' },
            { status: 400 }
          );
        }
        updatedAward = await cancelAward(targetAwardId, reason);
        responseMessage = 'Award cancelled';
        break;
      }

      case 'dispute': {
        // Mark award as disputed
        if (!reason) {
          return NextResponse.json(
            { error: 'reason is required for dispute' },
            { status: 400 }
          );
        }
        updatedAward = await disputeAward(targetAwardId, reason);
        responseMessage = 'Award marked as disputed';
        break;
      }

      case 'retry_erp_sync': {
        // Retry ERP synchronization
        updatedAward = await retryERPSync(targetAwardId);
        responseMessage = `ERP sync ${updatedAward.erpSyncStatus === 'synced' ? 'completed' : 'attempted'}`;
        break;
      }

      case 'link_erp': {
        // Manually link to ERP
        if (!erpData || !erpData.poId || !erpData.poNumber) {
          return NextResponse.json(
            { error: 'erpData with poId and poNumber is required' },
            { status: 400 }
          );
        }
        updatedAward = await linkAwardToERP(targetAwardId, erpData);
        responseMessage = `Award linked to ERP PO ${erpData.poNumber}`;
        break;
      }

      default:
        return NextResponse.json(
          {
            error: `Unknown action: ${action}. Valid actions: acknowledge, initiate_payment, complete_payment, fulfill, complete, cancel, dispute, retry_erp_sync, link_erp`
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      award: updatedAward,
      message: responseMessage,
    });
  } catch (error: unknown) {
    console.error('Error updating award:', error);
    const message = error instanceof Error ? error.message : 'Failed to update award';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
