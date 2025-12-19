/**
 * Founder Network Sourcing API
 * GET: Get sourcing requests
 * POST: Create requests, search network, manage introductions, record conversions
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  NetworkSourcingService,
  SourcingType,
  Urgency,
  SourcingCriteria,
} from '@/lib/founder/network-sourcing';

export const dynamic = 'force-dynamic';

// Natural language parsing for sourcing requests
function parseSourcingFromText(text: string): {
  type?: SourcingType;
  description?: string;
  criteria?: Partial<SourcingCriteria>;
  urgency?: Urgency;
  budget?: number;
} {
  const lower = text.toLowerCase();
  const result: ReturnType<typeof parseSourcingFromText> = {};

  // Parse type
  if (lower.includes('customer') || lower.includes('buyer') || lower.includes('client')) {
    result.type = 'customer';
  } else if (lower.includes('supplier') || lower.includes('vendor') || lower.includes('manufacturer')) {
    result.type = 'supplier';
  } else if (lower.includes('talent') || lower.includes('hire') || lower.includes('developer') || lower.includes('designer')) {
    result.type = 'talent';
  } else if (lower.includes('investor') || lower.includes('funding') || lower.includes('raise')) {
    result.type = 'investor';
  } else if (lower.includes('partner') || lower.includes('partnership')) {
    result.type = 'partner';
  }

  // Parse urgency
  if (lower.includes('urgent') || lower.includes('asap') || lower.includes('immediately')) {
    result.urgency = 'critical';
  } else if (lower.includes('high priority') || lower.includes('soon')) {
    result.urgency = 'high';
  } else if (lower.includes('low priority') || lower.includes('no rush')) {
    result.urgency = 'low';
  }

  // Parse budget
  const budgetMatch = text.match(/\$?([\d,]+(?:\.\d{2})?)\s*(?:k|K)?/);
  if (budgetMatch) {
    let amount = parseFloat(budgetMatch[1].replace(/,/g, ''));
    if (lower.includes('k') && amount < 1000) amount *= 1000;
    result.budget = amount;
  }

  // Parse criteria
  const criteria: Partial<SourcingCriteria> = {};

  // Industries
  const industries = ['saas', 'fintech', 'healthcare', 'ecommerce', 'manufacturing', 'ai', 'b2b', 'b2c'];
  const foundIndustries = industries.filter(ind => lower.includes(ind));
  if (foundIndustries.length > 0) criteria.industries = foundIndustries;

  // Skills (for talent)
  const skills = ['react', 'node', 'python', 'typescript', 'aws', 'design', 'product', 'sales'];
  const foundSkills = skills.filter(skill => lower.includes(skill));
  if (foundSkills.length > 0) criteria.skills = foundSkills;

  if (Object.keys(criteria).length > 0) {
    result.criteria = criteria;
  }

  // Use text as description
  result.description = text;

  return result;
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') as SourcingType | null;
    const status = searchParams.get('status');
    const requestId = searchParams.get('requestId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get single request with matches
    if (requestId) {
      const result = await NetworkSourcingService.getSourcingRequest(requestId);
      return NextResponse.json({
        success: result.success,
        request: result.request,
        matches: result.matches,
        message: result.message,
      });
    }

    // Get all requests with optional filters
    const filters: { type?: SourcingType; status?: string; limit: number; offset: number } = {
      limit,
      offset,
    };
    if (type) filters.type = type;
    if (status) filters.status = status;

    const result = await NetworkSourcingService.getSourcingRequests(userId, filters);

    return NextResponse.json({
      success: result.success,
      requests: result.requests,
      message: result.message,
    });
  } catch (error: any) {
    console.error('Error in sourcing GET:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sourcing requests' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, text, data } = body;

    // Parse from natural language if provided
    let parsedData = data || {};
    if (text) {
      const parsed = parseSourcingFromText(text);
      parsedData = { ...parsed, ...parsedData };
    }

    switch (action) {
      case 'create_request': {
        if (!parsedData.type) {
          return NextResponse.json({
            success: false,
            message: "What type of sourcing do you need? I can find customers, suppliers, talent, investors, or partners from the Wells network.",
            parsed: parsedData,
          });
        }

        if (!parsedData.description) {
          return NextResponse.json({
            success: false,
            message: `Got it - you're looking for a ${parsedData.type}. Tell me more about what you need and I'll search the network.`,
            parsed: parsedData,
          });
        }

        const result = await NetworkSourcingService.createSourcingRequest(
          userId,
          parsedData.type,
          parsedData.description,
          parsedData.criteria || {},
          {
            budget: parsedData.budget,
            urgency: parsedData.urgency,
            notes: parsedData.notes,
          }
        );

        return NextResponse.json({
          success: result.success,
          request: result.request,
          message: result.message,
        });
      }

      case 'search_network': {
        const { requestId } = parsedData;
        if (!requestId) {
          return NextResponse.json({
            success: false,
            message: "Which sourcing request should I search for? Give me the request ID.",
          });
        }

        const result = await NetworkSourcingService.searchNetwork(requestId);

        return NextResponse.json({
          success: result.success,
          result: result.result,
          message: result.message,
        });
      }

      case 'request_intro': {
        const { requestId, matchId } = parsedData;
        if (!requestId || !matchId) {
          return NextResponse.json({
            success: false,
            message: "I need the request ID and match ID to request an introduction.",
          });
        }

        const result = await NetworkSourcingService.requestIntro(requestId, matchId);

        return NextResponse.json({
          success: result.success,
          match: result.match,
          message: result.message,
        });
      }

      case 'send_intro': {
        const { matchId, introMessage } = parsedData;
        if (!matchId) {
          return NextResponse.json({
            success: false,
            message: "Which match should I send the intro for?",
          });
        }

        const message = introMessage || text || "I'd like to introduce you to an opportunity that might be a great fit.";
        const result = await NetworkSourcingService.sendIntro(matchId, message);

        return NextResponse.json({
          success: result.success,
          match: result.match,
          message: result.message,
        });
      }

      case 'record_response': {
        const { matchId, response, responseMessage } = parsedData;
        if (!matchId || !response) {
          return NextResponse.json({
            success: false,
            message: "I need the match ID and whether they're interested or declined.",
          });
        }

        const result = await NetworkSourcingService.recordResponse(
          matchId,
          response as 'interested' | 'declined',
          responseMessage
        );

        return NextResponse.json({
          success: result.success,
          match: result.match,
          message: result.message,
        });
      }

      case 'record_conversion': {
        const { matchId, dealValue } = parsedData;
        if (!matchId || !dealValue) {
          return NextResponse.json({
            success: false,
            message: "Congrats on closing! I need the match ID and deal value to record the conversion.",
          });
        }

        const result = await NetworkSourcingService.recordConversion(matchId, dealValue);

        return NextResponse.json({
          success: result.success,
          match: result.match,
          feeAmount: result.feeAmount,
          message: result.message,
        });
      }

      case 'cancel': {
        const { requestId } = parsedData;
        if (!requestId) {
          return NextResponse.json({
            success: false,
            message: "Which sourcing request would you like to cancel?",
          });
        }

        const result = await NetworkSourcingService.cancelSourcingRequest(requestId);

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }

      case 'get_stats': {
        const result = await NetworkSourcingService.getNetworkStats(userId);

        return NextResponse.json({
          success: result.success,
          stats: result.stats,
          message: result.message,
        });
      }

      case 'preview_matches': {
        const { type, criteria } = parsedData;
        if (!type) {
          return NextResponse.json({
            success: false,
            message: "What type of match are you looking for? (customer, supplier, talent, investor, partner)",
          });
        }

        const result = await NetworkSourcingService.getAvailableMatches(type, criteria || {});

        return NextResponse.json({
          success: result.success,
          matches: result.matches,
          message: result.message,
        });
      }

      case 'parse': {
        // Parse text without creating
        if (!text) {
          return NextResponse.json({
            success: false,
            message: "Tell me what you're looking for and I'll help you search the Wells network.",
          });
        }

        const parsed = parseSourcingFromText(text);

        return NextResponse.json({
          success: true,
          parsed,
          message: parsed.type
            ? `Looking for a ${parsed.type}${parsed.urgency === 'critical' ? ' urgently' : ''}. ${parsed.criteria?.industries?.length ? `Industries: ${parsed.criteria.industries.join(', ')}. ` : ''}Ready to create the sourcing request?`
            : "What type are you looking for? I can source customers, suppliers, talent, investors, or partners.",
        });
      }

      default:
        return NextResponse.json({
          success: false,
          message: "I can help you source from the Wells network. Try: 'Find me B2B SaaS customers' or 'I need a React developer'.",
          availableActions: [
            'create_request',
            'search_network',
            'request_intro',
            'send_intro',
            'record_response',
            'record_conversion',
            'cancel',
            'get_stats',
            'preview_matches',
            'parse',
          ],
        });
    }
  } catch (error: any) {
    console.error('Error in sourcing POST:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process sourcing action' },
      { status: 500 }
    );
  }
}
