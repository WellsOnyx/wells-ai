/**
 * Wells AI Match Execution API
 *
 * POST /api/wells-ai/match - Run matching for a request (returns ranked suppliers)
 * GET /api/wells-ai/match - Get match details with score breakdown
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  processMatchRequest,
  findMatchesForRequest,
  findOpportunitiesForSupplier,
  getMatchQuality,
  MatchRequest,
} from '@/lib/wells-ai/matching';
import { sql } from '@vercel/postgres';

// ============================================================================
// POST - Run Matching
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Determine the type of matching request
    const { type } = body;

    if (type === 'supplier_opportunities') {
      // Find opportunities for a supplier
      const { supplierId, categories, maxResults, minScore } = body;

      if (!supplierId) {
        return NextResponse.json(
          { error: 'supplierId is required for supplier_opportunities' },
          { status: 400 }
        );
      }

      const result = await findOpportunitiesForSupplier(supplierId, {
        categories,
        maxResults,
        minScore,
      });

      return NextResponse.json({
        success: true,
        data: {
          opportunities: result.opportunities.map(formatMatch),
          supplier: {
            id: result.supplier.id,
            companyName: result.supplier.companyName,
            categories: result.supplier.categories,
            grainEnabled: result.supplier.grainEnabled,
          },
          totalRequestsConsidered: result.totalRequestsConsidered,
          timestamp: result.timestamp,
        },
      });
    }

    // Default: Match request to suppliers
    const matchRequest: MatchRequest = {
      requestId: body.requestId,
      rawRequest: body.rawRequest,
      parsedRequest: body.parsedRequest,
      maxResults: body.maxResults || 10,
      minScore: body.minScore || 30,
      requireGrain: body.requireGrain || false,
      categoryOverride: body.categoryOverride,
    };

    // Validate input
    if (!matchRequest.requestId && !matchRequest.rawRequest && !matchRequest.parsedRequest) {
      return NextResponse.json(
        {
          error: 'Must provide requestId, rawRequest, or parsedRequest',
          examples: {
            byId: { requestId: 'req_123' },
            byNaturalLanguage: { rawRequest: 'I need 10,000 kraft boxes monthly' },
            byParsed: {
              parsedRequest: {
                title: 'Kraft Boxes',
                category: 'packaging',
                quantity: 10000,
                quantityUnit: 'units',
                frequency: 'monthly',
                deliveryLocation: 'Los Angeles, CA',
              },
            },
          },
        },
        { status: 400 }
      );
    }

    const result = await processMatchRequest(matchRequest);

    return NextResponse.json({
      success: true,
      data: {
        matches: result.matches.map(formatMatch),
        request: {
          id: result.request.id,
          title: result.request.title,
          description: result.request.description,
          category: result.request.category,
          quantity: result.request.quantity,
          quantityUnit: result.request.quantityUnit,
          frequency: result.request.frequency,
          urgency: result.request.urgency,
          deliveryLocation: result.request.deliveryLocation,
          targetPrice: result.request.targetPrice,
          preferGrainEnabled: result.request.preferGrainEnabled,
          requireGrainEnabled: result.request.requireGrainEnabled,
          status: result.request.status,
        },
        totalSuppliersConsidered: result.totalSuppliersConsidered,
        matchingDuration: result.matchingDuration,
        timestamp: result.timestamp,
      },
    });
  } catch (error) {
    console.error('[Match API] Error:', error);
    return NextResponse.json(
      {
        error: 'Matching failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Get Match Details
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');
    const requestId = searchParams.get('requestId');
    const supplierId = searchParams.get('supplierId');

    if (matchId) {
      // Get specific match
      const match = await getMatchById(matchId);
      if (!match) {
        return NextResponse.json(
          { error: 'Match not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: formatMatchWithDetails(match),
      });
    }

    if (requestId) {
      // Get all matches for a request
      const matches = await getMatchesForRequest(requestId);

      return NextResponse.json({
        success: true,
        data: {
          requestId,
          matches: matches.map(formatMatch),
          total: matches.length,
        },
      });
    }

    if (supplierId) {
      // Get all matches for a supplier
      const matches = await getMatchesForSupplier(supplierId);

      return NextResponse.json({
        success: true,
        data: {
          supplierId,
          matches: matches.map(formatMatch),
          total: matches.length,
        },
      });
    }

    // No params - return API info
    return NextResponse.json({
      success: true,
      message: 'Wells AI Match API',
      endpoints: {
        'POST /api/wells-ai/match': 'Run matching for a request',
        'GET /api/wells-ai/match?matchId=xxx': 'Get specific match details',
        'GET /api/wells-ai/match?requestId=xxx': 'Get all matches for a request',
        'GET /api/wells-ai/match?supplierId=xxx': 'Get all matches for a supplier',
        'POST /api/wells-ai/match/introduce': 'Create introduction between buyer and supplier',
      },
      matchQualityThresholds: {
        strong: '80+ score',
        good: '60-79 score',
        possible: '40-59 score',
        weak: 'below 40 score',
      },
    });
  } catch (error) {
    console.error('[Match API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get match details' },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getMatchById(matchId: string) {
  try {
    const result = await sql`
      SELECT
        m.*,
        r.title as request_title,
        r.category as request_category,
        r.quantity as request_quantity,
        r.quantity_unit as request_quantity_unit,
        r.buyer_id,
        r.buyer_name,
        s.company_name as supplier_name,
        s.contact_email as supplier_email,
        s.products as supplier_products,
        s.certifications as supplier_certifications,
        s.grain_enabled as supplier_grain_enabled
      FROM sourcing_matches m
      LEFT JOIN sourcing_requests r ON m.request_id = r.id
      LEFT JOIN suppliers s ON m.supplier_id = s.id
      WHERE m.id = ${matchId}
    `;

    if (result.rows.length === 0) return null;
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching match:', error);
    return null;
  }
}

async function getMatchesForRequest(requestId: string) {
  try {
    const result = await sql`
      SELECT
        m.*,
        s.company_name as supplier_name,
        s.contact_email as supplier_email,
        s.grain_enabled as supplier_grain_enabled,
        s.certifications as supplier_certifications
      FROM sourcing_matches m
      LEFT JOIN suppliers s ON m.supplier_id = s.id
      WHERE m.request_id = ${requestId}
      ORDER BY m.overall_score DESC
    `;
    return result.rows;
  } catch (error) {
    console.error('Error fetching matches for request:', error);
    return [];
  }
}

async function getMatchesForSupplier(supplierId: string) {
  try {
    const result = await sql`
      SELECT
        m.*,
        r.title as request_title,
        r.category as request_category,
        r.quantity as request_quantity,
        r.buyer_name
      FROM sourcing_matches m
      LEFT JOIN sourcing_requests r ON m.request_id = r.id
      WHERE m.supplier_id = ${supplierId}
      ORDER BY m.overall_score DESC
    `;
    return result.rows;
  } catch (error) {
    console.error('Error fetching matches for supplier:', error);
    return [];
  }
}

interface FormattedMatch {
  id: string;
  score: number;
  quality: {
    quality: string;
    label: string;
    color: string;
  };
  reasoning: string;
  strengths: string[];
  concerns: string[];
  estimatedLeadTime?: number;
  capacityFit: string;
  status: string;
  supplier?: {
    id: string;
    name: string;
    email: string;
    grainEnabled: boolean;
    certifications: string[];
  };
  request?: {
    id: string;
    title: string;
    category: string;
    quantity: number;
    quantityUnit: string;
    buyerName: string;
  };
  matchedAt: string;
}

function formatMatch(match: Record<string, unknown>): FormattedMatch {
  const score = match.overallScore || match.overall_score;
  const quality = getMatchQuality(score as number);

  return {
    id: match.id as string,
    score: score as number,
    quality,
    reasoning: match.reasoning as string,
    strengths: match.strengths as string[] || [],
    concerns: match.concerns as string[] || [],
    estimatedLeadTime: (match.estimatedLeadTime || match.estimated_lead_time) as number | undefined,
    capacityFit: (match.estimatedCapacityFit || match.estimated_capacity_fit) as string,
    status: match.status as string,
    supplier: match.supplier_name
      ? {
          id: match.supplierId as string || match.supplier_id as string,
          name: match.supplier_name as string,
          email: match.supplier_email as string,
          grainEnabled: match.supplier_grain_enabled as boolean,
          certifications: match.supplier_certifications as string[] || [],
        }
      : undefined,
    request: match.request_title
      ? {
          id: match.requestId as string || match.request_id as string,
          title: match.request_title as string,
          category: match.request_category as string,
          quantity: match.request_quantity as number,
          quantityUnit: match.request_quantity_unit as string,
          buyerName: match.buyer_name as string,
        }
      : undefined,
    matchedAt: (match.matchedAt || match.matched_at) as string,
  };
}

function formatMatchWithDetails(match: Record<string, unknown>) {
  const formatted = formatMatch(match);
  const scoreBreakdown = match.score_breakdown
    ? (typeof match.score_breakdown === 'string'
        ? JSON.parse(match.score_breakdown)
        : match.score_breakdown)
    : null;

  return {
    ...formatted,
    scoreBreakdown: scoreBreakdown
      ? {
          categoryMatch: formatComponent(scoreBreakdown.categoryMatch),
          capabilityMatch: formatComponent(scoreBreakdown.capabilityMatch),
          locationMatch: formatComponent(scoreBreakdown.locationMatch),
          capacityMatch: formatComponent(scoreBreakdown.capacityMatch),
          grainBonus: formatComponent(scoreBreakdown.grainBonus),
          trustScore: formatComponent(scoreBreakdown.trustScore),
          priceCompetitiveness: formatComponent(scoreBreakdown.priceCompetitiveness),
          weightedTotal: scoreBreakdown.weightedTotal,
          confidence: scoreBreakdown.confidence,
          confidenceReasons: scoreBreakdown.confidenceReasons,
        }
      : null,
    introduction: match.introduction_id
      ? {
          id: match.introduction_id,
          sentAt: match.introduced_at,
        }
      : null,
    dealRoom: match.deal_room_id
      ? {
          id: match.deal_room_id,
        }
      : null,
    transaction: match.transaction_id
      ? {
          id: match.transaction_id,
        }
      : null,
  };
}

function formatComponent(component: Record<string, unknown> | null) {
  if (!component) return null;
  return {
    score: component.score,
    weight: component.weight,
    weighted: component.weighted,
    explanation: component.explanation,
  };
}
