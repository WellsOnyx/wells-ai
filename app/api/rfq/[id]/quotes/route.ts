/**
 * RFQ Quotes API
 * GET: List quotes for an RFQ
 * POST: Submit a new quote
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getQuotesByRFQ,
  createQuote,
  compareQuotes,
} from '@/lib/rfq/quote-service';
import { getConstraintsByRFQ } from '@/lib/rfq/constraint-service';
import { requestQuotesFromSuppliers } from '@/lib/rfq/supplier-ai';
import { sqlQuery as sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rfqId } = await params;

    // Get quotes
    const quotes = await getQuotesByRFQ(rfqId);

    // Get constraints for comparison
    const constraints = await getConstraintsByRFQ(rfqId);

    // Get comparison analysis
    const comparison = await compareQuotes(rfqId, constraints || undefined);

    return NextResponse.json({
      success: true,
      quotes,
      comparison,
      constraints,
    });
  } catch (error: any) {
    console.error('Error fetching quotes:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch quotes' },
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

    // Check if this is a request to auto-generate quotes
    if (body.action === 'request_quotes') {
      // Get RFQ details
      const rfqResult = await sql`
        SELECT * FROM rfqs WHERE id = ${rfqId}
      `;
      const rfq = rfqResult.rows[0];

      if (!rfq) {
        return NextResponse.json(
          { error: 'RFQ not found' },
          { status: 404 }
        );
      }

      // Request quotes from matched suppliers
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
        autoQuotes: result.autoQuotes.length,
        manualRequests: result.manualRequests.length,
        quotes: result.autoQuotes,
        message: `Generated ${result.autoQuotes.length} auto-quotes. ${result.manualRequests.length} suppliers need manual quotes.`,
      });
    }

    // Manual quote submission
    const { supplierId, unitPrice, quantity, leadTimeDays, ...rest } = body;

    if (!supplierId || !unitPrice || !quantity || !leadTimeDays) {
      return NextResponse.json(
        { error: 'Missing required fields: supplierId, unitPrice, quantity, leadTimeDays' },
        { status: 400 }
      );
    }

    const quote = await createQuote({
      rfqId,
      supplierId,
      unitPrice,
      quantity,
      leadTimeDays,
      ...rest,
    });

    return NextResponse.json({
      success: true,
      quote,
    });
  } catch (error: any) {
    console.error('Error creating quote:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create quote' },
      { status: 500 }
    );
  }
}
