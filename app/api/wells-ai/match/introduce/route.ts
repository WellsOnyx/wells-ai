/**
 * Wells AI Introduction API
 *
 * POST /api/wells-ai/match/introduce - Create introduction between buyer and supplier
 * GET /api/wells-ai/match/introduce - Get introduction details
 * PATCH /api/wells-ai/match/introduce - Update introduction (respond, view, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createIntroduction,
  sendIntroduction,
  recordBuyerView,
  recordSupplierView,
  recordBuyerResponse,
  recordSupplierResponse,
  getBuyerIntroductions,
  getSupplierIntroductions,
  getIntroductionStats,
} from '@/lib/wells-ai/matching';
import { sql } from '@vercel/postgres';

// ============================================================================
// POST - Create Introduction
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchId, customBuyerMessage, customSupplierMessage, sendImmediately } = body;

    if (!matchId) {
      return NextResponse.json(
        {
          error: 'matchId is required',
          example: {
            matchId: 'match_123',
            sendImmediately: true,
          },
        },
        { status: 400 }
      );
    }

    // Create the introduction
    const intro = await createIntroduction(matchId, {
      customBuyerMessage,
      customSupplierMessage,
      sendImmediately: sendImmediately !== false, // Default to true
    });

    return NextResponse.json({
      success: true,
      data: formatIntroduction(intro),
      message: sendImmediately !== false
        ? 'Introduction sent to buyer and supplier'
        : 'Introduction created as draft',
    });
  } catch (error) {
    console.error('[Introduction API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create introduction',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Get Introduction Details
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const introductionId = searchParams.get('id');
    const buyerId = searchParams.get('buyerId');
    const supplierId = searchParams.get('supplierId');
    const stats = searchParams.get('stats');

    // Get stats
    if (stats === 'true') {
      const introStats = await getIntroductionStats();
      return NextResponse.json({
        success: true,
        data: introStats,
      });
    }

    // Get specific introduction
    if (introductionId) {
      const intro = await getIntroductionById(introductionId);
      if (!intro) {
        return NextResponse.json(
          { error: 'Introduction not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: formatIntroduction(intro),
      });
    }

    // Get buyer's introductions
    if (buyerId) {
      const intros = await getBuyerIntroductions(buyerId);
      return NextResponse.json({
        success: true,
        data: {
          buyerId,
          introductions: intros.map(formatIntroduction),
          total: intros.length,
        },
      });
    }

    // Get supplier's introductions
    if (supplierId) {
      const intros = await getSupplierIntroductions(supplierId);
      return NextResponse.json({
        success: true,
        data: {
          supplierId,
          introductions: intros.map(formatIntroduction),
          total: intros.length,
        },
      });
    }

    // No params - return API info
    return NextResponse.json({
      success: true,
      message: 'Wells AI Introduction API',
      endpoints: {
        'POST /api/wells-ai/match/introduce': {
          description: 'Create introduction between buyer and supplier',
          body: {
            matchId: 'required - ID of the match',
            customBuyerMessage: 'optional - Custom message for buyer',
            customSupplierMessage: 'optional - Custom message for supplier',
            sendImmediately: 'optional - Send immediately (default: true)',
          },
        },
        'GET /api/wells-ai/match/introduce?id=xxx': 'Get introduction details',
        'GET /api/wells-ai/match/introduce?buyerId=xxx': 'Get buyer introductions',
        'GET /api/wells-ai/match/introduce?supplierId=xxx': 'Get supplier introductions',
        'GET /api/wells-ai/match/introduce?stats=true': 'Get introduction statistics',
        'PATCH /api/wells-ai/match/introduce': 'Update introduction status',
      },
    });
  } catch (error) {
    console.error('[Introduction API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get introduction' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update Introduction (Response, View, etc.)
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { introductionId, action, party, response } = body;

    if (!introductionId) {
      return NextResponse.json(
        { error: 'introductionId is required' },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        {
          error: 'action is required',
          validActions: ['send', 'view', 'respond'],
        },
        { status: 400 }
      );
    }

    let intro;

    switch (action) {
      case 'send':
        // Send a draft introduction
        intro = await sendIntroduction(introductionId);
        return NextResponse.json({
          success: true,
          data: formatIntroduction(intro),
          message: 'Introduction sent',
        });

      case 'view':
        // Record that party viewed the introduction
        if (!party || !['buyer', 'supplier'].includes(party)) {
          return NextResponse.json(
            { error: 'party must be "buyer" or "supplier"' },
            { status: 400 }
          );
        }

        intro = party === 'buyer'
          ? await recordBuyerView(introductionId)
          : await recordSupplierView(introductionId);

        return NextResponse.json({
          success: true,
          data: formatIntroduction(intro),
          message: `${party} view recorded`,
        });

      case 'respond':
        // Record party's response
        if (!party || !['buyer', 'supplier'].includes(party)) {
          return NextResponse.json(
            { error: 'party must be "buyer" or "supplier"' },
            { status: 400 }
          );
        }

        if (!response || !['interested', 'passed', 'need_more_info'].includes(response)) {
          return NextResponse.json(
            { error: 'response must be "interested", "passed", or "need_more_info"' },
            { status: 400 }
          );
        }

        intro = party === 'buyer'
          ? await recordBuyerResponse(introductionId, response)
          : await recordSupplierResponse(introductionId, response);

        const message = intro.status === 'mutual_interest' || intro.status === 'deal_room_created'
          ? 'Mutual interest! Deal room created.'
          : `${party} response recorded: ${response}`;

        return NextResponse.json({
          success: true,
          data: formatIntroduction(intro),
          message,
          dealRoomCreated: intro.status === 'deal_room_created',
          dealRoomId: intro.dealRoomId,
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Introduction API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update introduction',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getIntroductionById(id: string) {
  try {
    const result = await sql`
      SELECT
        i.*,
        r.title as request_title,
        r.category as request_category,
        r.buyer_name,
        s.company_name as supplier_name
      FROM introductions i
      LEFT JOIN sourcing_requests r ON i.request_id = r.id
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      WHERE i.id = ${id}
    `;

    if (result.rows.length === 0) return null;
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching introduction:', error);
    return null;
  }
}

interface FormattedIntroduction {
  id: string;
  matchId: string;
  status: string;
  buyer: {
    id: string;
    name?: string;
    message: string;
    viewed: boolean;
    viewedAt?: string;
    responded: boolean;
    respondedAt?: string;
    response?: string;
  };
  supplier: {
    id: string;
    name?: string;
    message: string;
    viewed: boolean;
    viewedAt?: string;
    responded: boolean;
    respondedAt?: string;
    response?: string;
  };
  request?: {
    id: string;
    title: string;
    category: string;
    summary: string;
  };
  dealRoom?: {
    id: string;
    createdAt: string;
  };
  sentAt?: string;
  createdAt: string;
}

function formatIntroduction(intro: Record<string, unknown>): FormattedIntroduction {
  return {
    id: intro.id as string,
    matchId: (intro.matchId || intro.match_id) as string,
    status: intro.status as string,
    buyer: {
      id: (intro.buyerId || intro.buyer_id) as string,
      name: (intro.buyer_name) as string | undefined,
      message: (intro.buyerIntroMessage || intro.buyer_intro_message) as string,
      viewed: !!(intro.buyerOpenedAt || intro.buyer_opened_at),
      viewedAt: (intro.buyerOpenedAt || intro.buyer_opened_at) as string | undefined,
      responded: !!(intro.buyerRespondedAt || intro.buyer_responded_at),
      respondedAt: (intro.buyerRespondedAt || intro.buyer_responded_at) as string | undefined,
      response: (intro.buyerResponse || intro.buyer_response) as string | undefined,
    },
    supplier: {
      id: (intro.supplierId || intro.supplier_id) as string,
      name: intro.supplier_name as string | undefined,
      message: (intro.supplierIntroMessage || intro.supplier_intro_message) as string,
      viewed: !!(intro.supplierOpenedAt || intro.supplier_opened_at),
      viewedAt: (intro.supplierOpenedAt || intro.supplier_opened_at) as string | undefined,
      responded: !!(intro.supplierRespondedAt || intro.supplier_responded_at),
      respondedAt: (intro.supplierRespondedAt || intro.supplier_responded_at) as string | undefined,
      response: (intro.supplierResponse || intro.supplier_response) as string | undefined,
    },
    request: intro.request_title
      ? {
          id: (intro.requestId || intro.request_id) as string,
          title: intro.request_title as string,
          category: intro.request_category as string,
          summary: (intro.requestSummary || intro.request_summary) as string,
        }
      : undefined,
    dealRoom: (intro.dealRoomId || intro.deal_room_id)
      ? {
          id: (intro.dealRoomId || intro.deal_room_id) as string,
          createdAt: (intro.dealRoomCreatedAt || intro.deal_room_created_at) as string,
        }
      : undefined,
    sentAt: (intro.sentAt || intro.sent_at) as string | undefined,
    createdAt: (intro.createdAt || intro.created_at) as string,
  };
}
