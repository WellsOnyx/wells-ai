/**
 * Supplier Opportunities API
 * /api/wells-ai/sell/opportunities
 *
 * GET: List matched opportunities for a supplier
 * POST: Express interest in an opportunity
 * PUT: Update opportunity status (decline, request details)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Types
interface SupplierOpportunity {
  id: string;
  rfqId: string;
  supplierId: string;
  buyerName: string;
  buyerCompany: string;
  buyerEmail?: string;
  category: string;
  description: string;
  quantity: number;
  estimatedValue: number;
  urgency: 'standard' | 'urgent' | 'critical';
  location: string;
  requiredCertifications: string[];
  matchScore: number;
  matchReasons: string[];
  status: 'new' | 'interested' | 'intro_requested' | 'quoting' | 'declined' | 'won' | 'lost';
  postedAt: Date;
  respondedAt?: Date;
  dealId?: string;
}

/**
 * GET /api/wells-ai/sell/opportunities
 * List matched opportunities for a supplier
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get('supplierId');
    const email = searchParams.get('email');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!supplierId && !email) {
      return NextResponse.json({
        endpoint: '/api/wells-ai/sell/opportunities',
        methods: ['GET', 'POST', 'PUT'],
        description: 'Manage supplier opportunities from buyer RFQs',
        parameters: {
          GET: {
            supplierId: 'Supplier ID (UUID)',
            email: 'Supplier contact email (alternative to supplierId)',
            status: 'Filter by status: new, interested, intro_requested, quoting, declined, won, lost',
            limit: 'Max results (default 20)',
            offset: 'Pagination offset (default 0)'
          },
          POST: {
            opportunityId: 'Opportunity ID to express interest in',
            supplierId: 'Supplier ID expressing interest',
            action: 'Action to take: interest, request_details'
          },
          PUT: {
            opportunityId: 'Opportunity ID to update',
            supplierId: 'Supplier ID',
            status: 'New status: declined, quoting',
            note: 'Optional note/message'
          }
        }
      });
    }

    // Get supplier profile ID if email provided
    let actualSupplierId = supplierId;
    if (!supplierId && email) {
      const supplierResult = await sql`
        SELECT id FROM supplier_profiles WHERE contact_email = ${email}
      `;
      if (supplierResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Supplier not found' },
          { status: 404 }
        );
      }
      actualSupplierId = supplierResult.rows[0].id;
    }

    // Build query
    let opportunitiesResult;

    if (status && status !== 'all') {
      opportunitiesResult = await sql`
        SELECT
          so.*,
          rfq.category,
          rfq.description,
          rfq.quantity,
          rfq.target_price as estimated_value,
          rfq.urgency,
          rfq.delivery_location as location,
          rfq.required_certifications,
          rfq.created_at as posted_at,
          rfq.requestor_name as buyer_name,
          rfq.requestor_email as buyer_email,
          b.company_name as buyer_company
        FROM supplier_opportunities so
        JOIN rfqs rfq ON so.rfq_id = rfq.id
        LEFT JOIN buyers b ON rfq.requestor_email = b.email
        WHERE so.supplier_id = ${actualSupplierId}
        AND so.status = ${status}
        ORDER BY so.match_score DESC, so.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      opportunitiesResult = await sql`
        SELECT
          so.*,
          rfq.category,
          rfq.description,
          rfq.quantity,
          rfq.target_price as estimated_value,
          rfq.urgency,
          rfq.delivery_location as location,
          rfq.required_certifications,
          rfq.created_at as posted_at,
          rfq.requestor_name as buyer_name,
          rfq.requestor_email as buyer_email,
          b.company_name as buyer_company
        FROM supplier_opportunities so
        JOIN rfqs rfq ON so.rfq_id = rfq.id
        LEFT JOIN buyers b ON rfq.requestor_email = b.email
        WHERE so.supplier_id = ${actualSupplierId}
        ORDER BY so.match_score DESC, so.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    // Get stats
    const statsResult = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'new') as new_count,
        COUNT(*) FILTER (WHERE status = 'interested') as interested_count,
        COUNT(*) FILTER (WHERE status IN ('quoting', 'intro_requested')) as active_count,
        COUNT(*) FILTER (WHERE status = 'won') as won_count,
        SUM(CASE WHEN status = 'won' THEN estimated_value ELSE 0 END) as won_value
      FROM supplier_opportunities
      WHERE supplier_id = ${actualSupplierId}
    `;

    const opportunities = opportunitiesResult.rows.map(row => ({
      id: row.id,
      rfqId: row.rfq_id,
      supplierId: row.supplier_id,
      buyerName: row.buyer_name || 'Unknown Buyer',
      buyerCompany: row.buyer_company || row.buyer_name || 'Company',
      category: row.category,
      description: row.description,
      quantity: row.quantity,
      estimatedValue: parseFloat(row.estimated_value) || 0,
      urgency: row.urgency,
      location: row.location,
      requiredCertifications: row.required_certifications || [],
      matchScore: row.match_score,
      matchReasons: row.match_reasons || [],
      status: row.status,
      postedAt: row.posted_at,
      respondedAt: row.responded_at,
      dealId: row.deal_id
    }));

    return NextResponse.json({
      opportunities,
      stats: {
        newOpportunities: parseInt(statsResult.rows[0]?.new_count) || 0,
        interestedOpportunities: parseInt(statsResult.rows[0]?.interested_count) || 0,
        activeDeals: parseInt(statsResult.rows[0]?.active_count) || 0,
        wonDeals: parseInt(statsResult.rows[0]?.won_count) || 0,
        totalWonValue: parseFloat(statsResult.rows[0]?.won_value) || 0
      },
      pagination: {
        limit,
        offset,
        hasMore: opportunities.length === limit
      }
    });

  } catch (error: any) {
    console.error('Get opportunities error:', error);

    // If tables don't exist, return mock data for development
    if (error.message?.includes('does not exist')) {
      return NextResponse.json({
        opportunities: getMockOpportunities(),
        stats: {
          newOpportunities: 3,
          interestedOpportunities: 1,
          activeDeals: 2,
          wonDeals: 4,
          totalWonValue: 245000
        },
        pagination: {
          limit: 20,
          offset: 0,
          hasMore: false
        },
        _note: 'Using mock data. Run schema-supplier-profiles.sql to enable real data.'
      });
    }

    return NextResponse.json(
      { error: 'Failed to get opportunities', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wells-ai/sell/opportunities
 * Express interest in an opportunity or request details
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { opportunityId, supplierId, action, message } = body;

    if (!opportunityId || !supplierId) {
      return NextResponse.json(
        { error: 'opportunityId and supplierId are required' },
        { status: 400 }
      );
    }

    if (!['interest', 'request_details'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be either "interest" or "request_details"' },
        { status: 400 }
      );
    }

    const newStatus = action === 'interest' ? 'interested' : 'intro_requested';

    // Update opportunity status
    const result = await sql`
      UPDATE supplier_opportunities
      SET
        status = ${newStatus},
        responded_at = NOW(),
        supplier_message = ${message || null},
        updated_at = NOW()
      WHERE id = ${opportunityId}
      AND supplier_id = ${supplierId}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Opportunity not found or unauthorized' },
        { status: 404 }
      );
    }

    // Get RFQ details to notify buyer
    const rfqResult = await sql`
      SELECT r.*, sp.company_name as supplier_company, sp.contact_email as supplier_email
      FROM rfqs r
      JOIN supplier_opportunities so ON r.id = so.rfq_id
      JOIN supplier_profiles sp ON so.supplier_id = sp.id
      WHERE so.id = ${opportunityId}
    `;

    // TODO: Send notification to buyer about supplier interest
    // This would integrate with email, SMS, or notification service

    return NextResponse.json({
      success: true,
      message: action === 'interest'
        ? 'Interest expressed! The buyer will be notified.'
        : 'Details requested! We will facilitate an introduction.',
      opportunity: {
        id: result.rows[0].id,
        status: result.rows[0].status,
        respondedAt: result.rows[0].responded_at
      }
    });

  } catch (error: any) {
    console.error('Express interest error:', error);

    // Mock response for development
    if (error.message?.includes('does not exist')) {
      return NextResponse.json({
        success: true,
        message: 'Interest expressed (mock mode)',
        opportunity: {
          id: body?.opportunityId,
          status: body?.action === 'interest' ? 'interested' : 'intro_requested',
          respondedAt: new Date()
        },
        _note: 'Using mock response. Run schema-supplier-profiles.sql to enable real data.'
      });
    }

    return NextResponse.json(
      { error: 'Failed to express interest', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/wells-ai/sell/opportunities
 * Update opportunity status (decline, update to quoting, etc.)
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { opportunityId, supplierId, status, note, quotedPrice, quotedLeadTime } = body;

    if (!opportunityId || !supplierId) {
      return NextResponse.json(
        { error: 'opportunityId and supplierId are required' },
        { status: 400 }
      );
    }

    const validStatuses = ['declined', 'quoting', 'interested', 'intro_requested'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Update opportunity
    const result = await sql`
      UPDATE supplier_opportunities
      SET
        status = COALESCE(${status}, status),
        supplier_note = COALESCE(${note}, supplier_note),
        quoted_price = COALESCE(${quotedPrice}, quoted_price),
        quoted_lead_time = COALESCE(${quotedLeadTime}, quoted_lead_time),
        responded_at = CASE
          WHEN ${status} IS NOT NULL AND responded_at IS NULL THEN NOW()
          ELSE responded_at
        END,
        updated_at = NOW()
      WHERE id = ${opportunityId}
      AND supplier_id = ${supplierId}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Opportunity not found or unauthorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: status === 'declined'
        ? 'Opportunity declined'
        : 'Opportunity updated',
      opportunity: {
        id: result.rows[0].id,
        status: result.rows[0].status,
        updatedAt: result.rows[0].updated_at
      }
    });

  } catch (error: any) {
    console.error('Update opportunity error:', error);

    // Mock response for development
    if (error.message?.includes('does not exist')) {
      return NextResponse.json({
        success: true,
        message: 'Opportunity updated (mock mode)',
        opportunity: {
          id: body?.opportunityId,
          status: body?.status || 'updated',
          updatedAt: new Date()
        },
        _note: 'Using mock response. Run schema-supplier-profiles.sql to enable real data.'
      });
    }

    return NextResponse.json(
      { error: 'Failed to update opportunity', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Generate mock opportunities for development
 */
function getMockOpportunities(): SupplierOpportunity[] {
  return [
    {
      id: 'opp-1',
      rfqId: 'rfq-1',
      supplierId: 'supplier-1',
      buyerName: 'Sarah Chen',
      buyerCompany: 'TechFlow Industries',
      category: 'electronics',
      description: 'Looking for electronic components for IoT manufacturing line - sensors, microcontrollers, and power supplies',
      quantity: 5000,
      estimatedValue: 75000,
      urgency: 'urgent',
      location: 'San Francisco, CA',
      requiredCertifications: ['ISO 9001', 'RoHS Compliant'],
      matchScore: 94,
      matchReasons: [
        'Matches your Electronics category',
        'You have ISO 9001 certification they require',
        'Your lead time fits their urgent timeline',
        'You serve the West Coast region'
      ],
      status: 'new',
      postedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
    },
    {
      id: 'opp-2',
      rfqId: 'rfq-2',
      supplierId: 'supplier-1',
      buyerName: 'Mike Johnson',
      buyerCompany: 'Midwest Manufacturing Co.',
      category: 'industrial',
      description: 'Need industrial motors and bearings for production facility expansion',
      quantity: 200,
      estimatedValue: 45000,
      urgency: 'standard',
      location: 'Chicago, IL',
      requiredCertifications: [],
      matchScore: 87,
      matchReasons: [
        'Matches your Industrial Equipment category',
        'Within your Midwest service area',
        'Your MOQ works for their quantity'
      ],
      status: 'new',
      postedAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
    },
    {
      id: 'opp-3',
      rfqId: 'rfq-3',
      supplierId: 'supplier-1',
      buyerName: 'Lisa Park',
      buyerCompany: 'HealthTech Solutions',
      category: 'medical',
      description: 'Medical-grade sensors and monitoring equipment for new patient monitoring system',
      quantity: 1000,
      estimatedValue: 120000,
      urgency: 'critical',
      location: 'Boston, MA',
      requiredCertifications: ['FDA Approved', 'ISO 13485'],
      matchScore: 91,
      matchReasons: [
        'Matches your Medical & Healthcare category',
        'You have FDA Approved certification',
        'Your capacity can handle this order size'
      ],
      status: 'interested',
      postedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      respondedAt: new Date(Date.now() - 1 * 60 * 60 * 1000)
    }
  ];
}

/**
 * AI-powered opportunity matching
 * Scores how well a supplier matches an RFQ
 */
async function calculateMatchScore(
  supplier: any,
  rfq: any
): Promise<{ score: number; reasons: string[] }> {
  try {
    const prompt = `Score how well this supplier matches this RFQ (0-100).

SUPPLIER:
- Company: ${supplier.company_name}
- Categories: ${supplier.categories?.join(', ')}
- Certifications: ${supplier.certifications?.join(', ')}
- Lead Time: ${supplier.lead_time_days} days
- Capacity: ${supplier.monthly_capacity}
- Service Areas: ${supplier.service_areas?.join(', ')}
- Drop Ship: ${supplier.can_drop_ship ? 'Yes' : 'No'}

RFQ:
- Category: ${rfq.category}
- Description: ${rfq.description}
- Quantity: ${rfq.quantity}
- Urgency: ${rfq.urgency}
- Location: ${rfq.delivery_location}
- Required Certs: ${rfq.required_certifications?.join(', ') || 'None'}

Respond in JSON: { "score": 85, "reasons": ["reason 1", "reason 2", "reason 3"] }`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const result = JSON.parse(text);

    return {
      score: Math.min(100, Math.max(0, result.score)),
      reasons: result.reasons || []
    };
  } catch (error) {
    console.error('AI match scoring error:', error);

    // Fallback to rule-based scoring
    let score = 50;
    const reasons: string[] = [];

    // Category match
    if (supplier.categories?.includes(rfq.category)) {
      score += 20;
      reasons.push(`Matches your ${rfq.category} category`);
    }

    // Certification check
    const requiredCerts = rfq.required_certifications || [];
    const supplierCerts = supplier.certifications || [];
    const hasAllCerts = requiredCerts.every((c: string) => supplierCerts.includes(c));
    if (hasAllCerts && requiredCerts.length > 0) {
      score += 15;
      reasons.push('Has all required certifications');
    } else if (!hasAllCerts) {
      score -= 20;
    }

    // Lead time vs urgency
    if (rfq.urgency === 'critical' && supplier.lead_time_days <= 7) {
      score += 10;
      reasons.push('Fast lead time for urgent order');
    } else if (rfq.urgency === 'urgent' && supplier.lead_time_days <= 14) {
      score += 5;
    }

    // Location match
    const serviceAreas = supplier.service_areas || [];
    if (serviceAreas.some((area: string) => area.includes('National') || rfq.delivery_location?.includes(area))) {
      score += 5;
      reasons.push('Serves the delivery location');
    }

    return {
      score: Math.min(100, Math.max(0, score)),
      reasons
    };
  }
}
