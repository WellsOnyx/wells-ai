/**
 * Seller Agent RFQ Handler
 *
 * Called when an RFQ matches a seller's catalog.
 * Uses the SellerAgent to evaluate and respond automatically.
 *
 * POST /api/seller/handle-rfq - Handle an incoming RFQ with the seller agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSellerAgent } from '@/lib/seller/seller-agent';
import { RFQRequest } from '@/lib/seller/quote-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate the RFQ
    const { sellerId, rfq } = body as {
      sellerId: string;
      rfq: RFQRequest;
    };

    if (!sellerId || !rfq) {
      return NextResponse.json(
        { error: 'Missing sellerId or rfq' },
        { status: 400 }
      );
    }

    // Create agent and handle RFQ
    const agent = await createSellerAgent(sellerId);
    const result = await agent.handleRFQ(rfq);

    return NextResponse.json({
      success: true,
      action: result.action,
      quote: result.quote ? {
        id: result.quote.id,
        total: result.quote.total,
        margin: result.quote.calculatedMargin,
        lineItems: result.quote.lineItems,
        validUntil: result.quote.validUntil,
        status: result.quote.status,
        aiReasoning: result.quote.aiReasoning,
      } : undefined,
      reason: result.reason,
      message: result.action === 'auto_quote'
        ? `Quote automatically sent: $${result.quote?.total.toFixed(2)}`
        : result.action === 'pending_approval'
        ? `Quote ready for your approval: $${result.quote?.total.toFixed(2)}`
        : `Could not generate quote: ${result.reason}`,
    });
  } catch (error) {
    console.error('RFQ handling error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'RFQ handling failed' },
      { status: 500 }
    );
  }
}
