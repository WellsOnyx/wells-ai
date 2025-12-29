/**
 * Seller Quotes API
 *
 * GET /api/seller/quotes - List quotes
 * POST /api/seller/quotes - Generate quote for RFQ
 * PUT /api/seller/quotes - Approve/reject/counter quote
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  GeneratedQuote,
  RFQRequest,
  generateQuoteForRFQ,
  getSellerQuotes,
  getQuote,
  approveQuote,
  rejectQuote,
  counterQuote,
} from '@/lib/seller/quote-generator';
import {
  startNegotiation,
  processBuyerOffer,
  sellerManualResponse,
  getSellerNegotiations,
} from '@/lib/seller/seller-negotiation-agent';

// ============================================================================
// GET - List quotes and negotiations
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const view = url.searchParams.get('view') || 'quotes';
    const status = url.searchParams.get('status') as GeneratedQuote['status'] | null;
    const quoteId = url.searchParams.get('quoteId');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // Get single quote
    if (quoteId) {
      const quote = await getQuote(quoteId);

      if (!quote) {
        return NextResponse.json(
          { error: 'Quote not found' },
          { status: 404 }
        );
      }

      if (quote.sellerId !== userId) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        );
      }

      return NextResponse.json({ quote });
    }

    // Get negotiations view
    if (view === 'negotiations') {
      const negotiations = await getSellerNegotiations(userId, { limit });

      return NextResponse.json({
        negotiations,
        count: negotiations.length,
      });
    }

    // Get pending quotes (need approval)
    if (view === 'pending') {
      const quotes = await getSellerQuotes(userId, {
        status: 'pending_approval',
        limit,
      });

      return NextResponse.json({
        quotes,
        count: quotes.length,
        message: quotes.length > 0
          ? `${quotes.length} quote(s) waiting for your approval`
          : 'No pending quotes',
      });
    }

    // Get all quotes with optional status filter
    const quotes = await getSellerQuotes(userId, {
      status: status || undefined,
      limit,
    });

    // Calculate summary stats
    const stats = {
      total: quotes.length,
      pending: quotes.filter(q => q.status === 'pending_approval').length,
      sent: quotes.filter(q => q.status === 'sent').length,
      accepted: quotes.filter(q => q.status === 'accepted').length,
      rejected: quotes.filter(q => q.status === 'rejected').length,
      negotiating: quotes.filter(q => q.status === 'negotiating').length,
      autoApproved: quotes.filter(q => q.isAutoApproved).length,
      averageMargin: quotes.length > 0
        ? quotes.reduce((sum, q) => sum + q.calculatedMargin, 0) / quotes.length
        : 0,
    };

    return NextResponse.json({
      quotes,
      stats,
    });
  } catch (error) {
    console.error('Error getting quotes:', error);
    return NextResponse.json(
      { error: 'Failed to get quotes' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Generate quote for RFQ or handle negotiation
// ============================================================================

interface PostRequest {
  action: 'generate_quote' | 'start_negotiation' | 'buyer_offer';

  // For generate_quote
  rfq?: {
    id: string;
    buyerId: string;
    buyerName: string;
    buyerCompany?: string;
    productDescription: string;
    category?: string;
    quantity: number;
    targetPrice?: number;
    currency?: string;
    urgency?: 'standard' | 'urgent' | 'critical';
    requiredByDate?: string;
    deliveryLocation: string;
    additionalNotes?: string;
  };

  // For start_negotiation
  quoteId?: string;
  initialOffer?: {
    price: number;
    message?: string;
    justification?: string;
  };

  // For buyer_offer
  negotiationId?: string;
  offer?: {
    price: number;
    message?: string;
    justification?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as PostRequest;

    switch (body.action) {
      case 'generate_quote': {
        if (!body.rfq) {
          return NextResponse.json(
            { error: 'Missing RFQ data' },
            { status: 400 }
          );
        }

        const rfq: RFQRequest = {
          id: body.rfq.id,
          buyerId: body.rfq.buyerId,
          buyerName: body.rfq.buyerName,
          buyerCompany: body.rfq.buyerCompany,
          productDescription: body.rfq.productDescription,
          category: body.rfq.category,
          quantity: body.rfq.quantity,
          targetPrice: body.rfq.targetPrice,
          currency: body.rfq.currency || 'USD',
          urgency: body.rfq.urgency || 'standard',
          requiredByDate: body.rfq.requiredByDate
            ? new Date(body.rfq.requiredByDate)
            : undefined,
          deliveryLocation: body.rfq.deliveryLocation,
          additionalNotes: body.rfq.additionalNotes,
          createdAt: new Date(),
        };

        const result = await generateQuoteForRFQ(userId, rfq);

        return NextResponse.json({
          success: true,
          quote: result.quote,
          autoSent: result.autoSent,
          notificationSent: result.notificationSent,
          message: result.message,
        });
      }

      case 'start_negotiation': {
        if (!body.quoteId) {
          return NextResponse.json(
            { error: 'Missing quoteId' },
            { status: 400 }
          );
        }

        const session = await startNegotiation(
          body.quoteId,
          body.initialOffer
        );

        return NextResponse.json({
          success: true,
          session,
          message: body.initialOffer
            ? 'Negotiation started with buyer offer'
            : 'Negotiation session created',
        });
      }

      case 'buyer_offer': {
        if (!body.negotiationId || !body.offer) {
          return NextResponse.json(
            { error: 'Missing negotiationId or offer' },
            { status: 400 }
          );
        }

        const { session, response } = await processBuyerOffer(
          body.negotiationId,
          body.offer
        );

        return NextResponse.json({
          success: true,
          session,
          sellerResponse: response,
          message: `AI responded: ${response.action}`,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing quote action:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Seller actions on quotes
// ============================================================================

interface PutRequest {
  action: 'approve' | 'reject' | 'counter' | 'manual_negotiate';
  quoteId?: string;
  negotiationId?: string;

  // For counter
  counterPrice?: number;
  counterMessage?: string;

  // For modifications on approve
  modifications?: Partial<GeneratedQuote>;

  // For reject
  reason?: string;

  // For manual_negotiate (seller overrides AI)
  manualAction?: 'accept' | 'counter' | 'reject';
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as PutRequest;

    switch (body.action) {
      case 'approve': {
        if (!body.quoteId) {
          return NextResponse.json(
            { error: 'Missing quoteId' },
            { status: 400 }
          );
        }

        const quote = await approveQuote(
          body.quoteId,
          userId,
          body.modifications
        );

        return NextResponse.json({
          success: true,
          quote,
          message: `Quote approved and sent! Total: $${quote.total.toFixed(2)}`,
        });
      }

      case 'reject': {
        if (!body.quoteId) {
          return NextResponse.json(
            { error: 'Missing quoteId' },
            { status: 400 }
          );
        }

        await rejectQuote(body.quoteId, userId, body.reason);

        return NextResponse.json({
          success: true,
          message: 'Quote rejected',
        });
      }

      case 'counter': {
        if (!body.quoteId || !body.counterPrice) {
          return NextResponse.json(
            { error: 'Missing quoteId or counterPrice' },
            { status: 400 }
          );
        }

        const quote = await counterQuote(
          body.quoteId,
          userId,
          body.counterPrice
        );

        return NextResponse.json({
          success: true,
          quote,
          message: `Counter-offer sent: $${quote.total.toFixed(2)}`,
        });
      }

      case 'manual_negotiate': {
        if (!body.negotiationId || !body.manualAction) {
          return NextResponse.json(
            { error: 'Missing negotiationId or manualAction' },
            { status: 400 }
          );
        }

        const session = await sellerManualResponse(
          body.negotiationId,
          userId,
          {
            action: body.manualAction,
            counterPrice: body.counterPrice,
            message: body.counterMessage,
          }
        );

        return NextResponse.json({
          success: true,
          session,
          message: body.manualAction === 'accept'
            ? 'Deal accepted!'
            : body.manualAction === 'counter'
            ? `Counter-offer sent: $${body.counterPrice?.toFixed(2)}`
            : 'Deal rejected',
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing quote action:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}
