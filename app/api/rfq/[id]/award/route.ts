/**
 * RFQ Award API
 * GET: Get award details
 * POST: Award a quote to a supplier
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  awardQuote,
  getAwardByRFQ,
  acknowledgeAward,
  initiatePayment,
  completePayment,
  cancelAward,
} from '@/lib/rfq/award-service';
import { getQuoteById } from '@/lib/rfq/quote-service';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rfqId } = await params;

    const award = await getAwardByRFQ(rfqId);

    if (!award) {
      return NextResponse.json({
        success: true,
        award: null,
        message: 'No award for this RFQ yet',
      });
    }

    return NextResponse.json({
      success: true,
      award,
    });
  } catch (error: any) {
    console.error('Error fetching award:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch award' },
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
    const { action, quoteId, awardId, negotiationId, ...options } = body;

    switch (action || 'create') {
      case 'create': {
        // Award a quote
        if (!quoteId) {
          return NextResponse.json(
            { error: 'quoteId is required to create an award' },
            { status: 400 }
          );
        }

        // Get quote to get supplier ID
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

        const result = await awardQuote({
          rfqId,
          quoteId,
          supplierId: quote.supplierId,
          negotiationId,
        });

        return NextResponse.json({
          success: true,
          ...result,
          message: `Quote awarded to ${quote.supplier?.companyName || 'supplier'}. Deal and escrow created.`,
        });
      }

      case 'acknowledge': {
        // Supplier acknowledges the award
        if (!awardId) {
          return NextResponse.json(
            { error: 'awardId is required' },
            { status: 400 }
          );
        }

        const award = await acknowledgeAward(awardId);

        return NextResponse.json({
          success: true,
          award,
          message: 'Award acknowledged by supplier',
        });
      }

      case 'initiate_payment': {
        // Start payment process
        if (!awardId) {
          return NextResponse.json(
            { error: 'awardId is required' },
            { status: 400 }
          );
        }

        const award = await initiatePayment(awardId);

        return NextResponse.json({
          success: true,
          award,
          message: 'Payment initiated. Fund the escrow to complete.',
        });
      }

      case 'complete_payment': {
        // Mark payment as received
        if (!awardId) {
          return NextResponse.json(
            { error: 'awardId is required' },
            { status: 400 }
          );
        }

        const award = await completePayment(awardId);

        return NextResponse.json({
          success: true,
          award,
          message: 'Payment completed. Awaiting fulfillment.',
        });
      }

      case 'cancel': {
        // Cancel the award
        if (!awardId) {
          return NextResponse.json(
            { error: 'awardId is required' },
            { status: 400 }
          );
        }

        const award = await cancelAward(
          awardId,
          options.reason || 'Cancelled by buyer'
        );

        return NextResponse.json({
          success: true,
          award,
          message: 'Award cancelled',
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid actions: create, acknowledge, initiate_payment, complete_payment, cancel` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Error in award operation:', error);
    return NextResponse.json(
      { error: error.message || 'Award operation failed' },
      { status: 500 }
    );
  }
}
