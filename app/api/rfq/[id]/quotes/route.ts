/**
 * RFQ Quotes API
 * GET: Get all quotes for an RFQ with comparison data
 * POST: Submit a new quote (manual or trigger AI quote generation)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getQuotesByRFQ,
  createQuote,
  compareQuotes,
  createAIQuote,
  QuoteServiceError,
} from '@/lib/rfq/quote-service';
import { getConstraintsByRFQ } from '@/lib/rfq/constraint-service';
import { requestQuotesFromSuppliers } from '@/lib/rfq/supplier-ai';
import {
  CreateQuoteInput,
  QuoteComparison,
  RFQQuote,
  RFQConstraints,
} from '@/lib/rfq/types';
import { sqlQuery as sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rfq/[id]/quotes
 * Returns all quotes for an RFQ with comparison analysis
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: rfqId } = await params;

    // Validate RFQ exists
    const rfqResult = await sql`
      SELECT id, status FROM rfqs WHERE id = ${rfqId}
    `;

    if (rfqResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'RFQ not found' },
        { status: 404 }
      );
    }

    // Get all quotes for this RFQ
    const quotes: RFQQuote[] = await getQuotesByRFQ(rfqId);

    // Get buyer constraints for comparison scoring
    const constraints: RFQConstraints | null = await getConstraintsByRFQ(rfqId);

    // Generate comparison analysis with scoring
    const comparison: QuoteComparison = await compareQuotes(
      rfqId,
      constraints || undefined
    );

    return NextResponse.json({
      success: true,
      quotes,
      comparison,
      constraints,
      meta: {
        rfqId,
        rfqStatus: rfqResult.rows[0].status,
        quoteCount: quotes.length,
        hasConstraints: !!constraints,
      },
    });
  } catch (error) {
    console.error('[RFQ Quotes API] Error fetching quotes:', error);

    if (error instanceof QuoteServiceError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch quotes',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rfq/[id]/quotes
 * Submit a new quote or trigger AI quote generation
 *
 * Actions:
 * - request_quotes: Trigger AI to request quotes from matched suppliers
 * - generate_ai_quote: Generate a single AI quote from catalog
 * - (default): Submit a manual quote
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: rfqId } = await params;
    const body = await req.json();

    // Validate RFQ exists and is in a valid state for quotes
    const rfqResult = await sql`
      SELECT * FROM rfqs WHERE id = ${rfqId}
    `;

    if (rfqResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'RFQ not found' },
        { status: 404 }
      );
    }

    const rfq = rfqResult.rows[0];

    // Check if RFQ is in a state that accepts quotes
    const validStatuses = ['open', 'matched', 'quoting', 'negotiating'];
    if (!validStatuses.includes(rfq.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot add quotes to RFQ with status '${rfq.status}'`,
          validStatuses,
        },
        { status: 400 }
      );
    }

    const { action } = body;

    // Handle different quote actions
    switch (action) {
      case 'request_quotes': {
        // Request quotes from matched suppliers (AI-generated)
        const result = await requestQuotesFromSuppliers(rfqId, {
          category: rfq.category,
          description: rfq.description,
          quantity: rfq.quantity,
          targetPrice: rfq.target_price ? parseFloat(rfq.target_price) : undefined,
          urgency: rfq.urgency || 'standard',
          deliveryLocation: rfq.delivery_location,
        });

        return NextResponse.json({
          success: true,
          action: 'request_quotes',
          autoQuotes: result.autoQuotes.length,
          manualRequests: result.manualRequests.length,
          quotes: result.autoQuotes,
          pendingSuppliers: result.manualRequests,
          message: `Generated ${result.autoQuotes.length} AI quote(s). ${result.manualRequests.length} supplier(s) require manual quotes.`,
        });
      }

      case 'generate_ai_quote': {
        // Generate a single AI quote from supplier catalog
        const { supplierId, catalogId, quantity, confidenceScore, overrides } = body;

        if (!supplierId || !catalogId) {
          return NextResponse.json(
            {
              success: false,
              error: 'Missing required fields: supplierId, catalogId',
            },
            { status: 400 }
          );
        }

        const aiQuote = await createAIQuote(
          rfqId,
          supplierId,
          catalogId,
          quantity || rfq.quantity,
          confidenceScore || 85,
          overrides
        );

        return NextResponse.json({
          success: true,
          action: 'generate_ai_quote',
          quote: aiQuote,
          message: `AI quote generated with ${aiQuote.aiConfidenceScore}% confidence`,
        });
      }

      default: {
        // Manual quote submission
        const {
          supplierId,
          unitPrice,
          quantity,
          leadTimeDays,
          paymentTerms,
          warrantyMonths,
          shippingCost,
          shippingMethod,
          validUntil,
          notes,
          lineItems,
        } = body;

        // Validate required fields for manual quote
        if (!supplierId) {
          return NextResponse.json(
            { success: false, error: 'Missing required field: supplierId' },
            { status: 400 }
          );
        }

        if (unitPrice === undefined || unitPrice <= 0) {
          return NextResponse.json(
            { success: false, error: 'unitPrice must be a positive number' },
            { status: 400 }
          );
        }

        if (!quantity || quantity <= 0) {
          return NextResponse.json(
            { success: false, error: 'quantity must be a positive number' },
            { status: 400 }
          );
        }

        if (!leadTimeDays || leadTimeDays <= 0) {
          return NextResponse.json(
            { success: false, error: 'leadTimeDays must be a positive number' },
            { status: 400 }
          );
        }

        // Create the quote input
        const quoteInput: CreateQuoteInput = {
          rfqId,
          supplierId,
          unitPrice,
          quantity,
          leadTimeDays,
          paymentTerms,
          warrantyMonths,
          shippingCost,
          shippingMethod,
          validUntil,
          notes,
          lineItems,
          aiGenerated: false,
        };

        const quote = await createQuote(quoteInput);

        // Get updated quote count
        const countResult = await sql`
          SELECT COUNT(*) as count FROM rfq_quotes WHERE rfq_id = ${rfqId}
        `;
        const quoteCount = parseInt(countResult.rows[0]?.count || '0');

        return NextResponse.json({
          success: true,
          action: 'create',
          quote,
          message: `Quote submitted successfully. Total ${quoteCount} quote(s) for this RFQ.`,
          meta: {
            rfqId,
            quoteId: quote.id,
            totalPrice: quote.totalPrice,
            quoteCount,
          },
        });
      }
    }
  } catch (error) {
    console.error('[RFQ Quotes API] Error creating quote:', error);

    if (error instanceof QuoteServiceError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create quote',
      },
      { status: 500 }
    );
  }
}
