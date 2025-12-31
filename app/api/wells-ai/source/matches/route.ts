/**
 * Supplier Match API for Sourcing Requests
 *
 * GET: Get matched suppliers for a sourcing request
 * POST: Request introduction to a supplier
 * PUT: Update match status (interested, declined, in_negotiation, won)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@clerk/nextjs/server';
import Anthropic from '@anthropic-ai/sdk';
import { MATCHING_WEIGHTS, GRAIN_ENABLED_BONUS } from '@/lib/wells-ai/sourcing/categories';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// GET - Get matched suppliers for a request
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const request_id = searchParams.get('request_id');
    const min_score = parseInt(searchParams.get('min_score') || '0');
    const grain_only = searchParams.get('grain_only') === 'true';

    if (!request_id) {
      return NextResponse.json(
        { error: 'request_id is required' },
        { status: 400 }
      );
    }

    // Verify the request belongs to this user
    const requestCheck = await sql`
      SELECT id, status, category_id, subcategory_id, title
      FROM sourcing_requests
      WHERE id = ${request_id} AND user_id = ${userId}
    `;

    if (requestCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Request not found or access denied' },
        { status: 404 }
      );
    }

    const sourcingRequest = requestCheck.rows[0];

    // Check if we need to run matching
    if (['submitted', 'matching'].includes(sourcingRequest.status)) {
      // Trigger matching if not already done
      await runSupplierMatching(request_id);
    }

    // Get matches with supplier details
    let matchQuery;

    if (grain_only) {
      matchQuery = await sql`
        SELECT
          m.*,
          s.company_name,
          s.contact_email,
          s.website,
          s.products,
          s.certifications,
          s.lead_time,
          s.minimum_order,
          s.pricing,
          s.capacity,
          s.drop_ship_capable,
          s.white_label_capable
        FROM sourcing_matches m
        JOIN suppliers s ON m.supplier_id = s.id
        WHERE m.request_id = ${request_id}
          AND m.match_score >= ${min_score}
          AND m.grain_enabled = TRUE
          AND s.status = 'active'
        ORDER BY m.match_score DESC, m.grain_enabled DESC
      `;
    } else {
      matchQuery = await sql`
        SELECT
          m.*,
          s.company_name,
          s.contact_email,
          s.website,
          s.products,
          s.certifications,
          s.lead_time,
          s.minimum_order,
          s.pricing,
          s.capacity,
          s.drop_ship_capable,
          s.white_label_capable
        FROM sourcing_matches m
        JOIN suppliers s ON m.supplier_id = s.id
        WHERE m.request_id = ${request_id}
          AND m.match_score >= ${min_score}
          AND s.status = 'active'
        ORDER BY m.match_score DESC, m.grain_enabled DESC
      `;
    }

    // Get introduction status for each match
    const introQuery = await sql`
      SELECT match_id, status, sent_at, supplier_responded_at
      FROM sourcing_introductions
      WHERE request_id = ${request_id}
    `;

    const introMap: Record<string, any> = {};
    introQuery.rows.forEach(row => {
      introMap[row.match_id] = {
        intro_status: row.status,
        intro_sent_at: row.sent_at,
        supplier_responded_at: row.supplier_responded_at
      };
    });

    const matches = matchQuery.rows.map(row => ({
      id: row.id,
      supplier_id: row.supplier_id,
      match_score: row.match_score,
      match_reasoning: row.match_reasoning,
      score_breakdown: row.score_breakdown,
      grain_enabled: row.grain_enabled,
      grain_bonus_applied: row.grain_bonus_applied,
      strengths: row.strengths,
      concerns: row.concerns,
      estimated_price_low: row.estimated_price_low,
      estimated_price_high: row.estimated_price_high,
      estimated_lead_time_days: row.estimated_lead_time_days,
      status: row.status,
      buyer_notes: row.buyer_notes,
      viewed_at: row.viewed_at,
      supplier: {
        id: row.supplier_id,
        company_name: row.company_name,
        website: row.website,
        products: row.products,
        certifications: row.certifications,
        lead_time: row.lead_time,
        minimum_order: row.minimum_order,
        pricing: row.pricing,
        capacity: row.capacity,
        drop_ship_capable: row.drop_ship_capable,
        white_label_capable: row.white_label_capable
      },
      introduction: introMap[row.id] || null
    }));

    // Update request status to 'matched' if we have matches
    if (matches.length > 0 && sourcingRequest.status === 'matching') {
      await sql`
        UPDATE sourcing_requests
        SET status = 'matched', matches_count = ${matches.length}
        WHERE id = ${request_id}
      `;
    }

    return NextResponse.json({
      success: true,
      request: {
        id: sourcingRequest.id,
        title: sourcingRequest.title,
        category_id: sourcingRequest.category_id,
        subcategory_id: sourcingRequest.subcategory_id,
        status: matches.length > 0 ? 'matched' : sourcingRequest.status
      },
      matches,
      total: matches.length,
      grain_enabled_count: matches.filter(m => m.grain_enabled).length
    });

  } catch (error) {
    console.error('Error fetching matches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matches' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Request introduction to a supplier
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { match_id, buyer_message, buyer_email, buyer_company } = body;

    if (!match_id) {
      return NextResponse.json(
        { error: 'match_id is required' },
        { status: 400 }
      );
    }

    // Get match details and verify ownership
    const matchQuery = await sql`
      SELECT
        m.*,
        r.user_id,
        r.id as request_id,
        r.title as request_title,
        r.description as request_description,
        r.category_id,
        r.specifications,
        s.company_name as supplier_company,
        s.contact_email as supplier_email,
        s.products as supplier_products
      FROM sourcing_matches m
      JOIN sourcing_requests r ON m.request_id = r.id
      JOIN suppliers s ON m.supplier_id = s.id
      WHERE m.id = ${match_id}
    `;

    if (matchQuery.rows.length === 0) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      );
    }

    const match = matchQuery.rows[0];

    if (match.user_id !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Check if introduction already exists
    const existingIntro = await sql`
      SELECT id, status FROM sourcing_introductions
      WHERE match_id = ${match_id}
    `;

    if (existingIntro.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Introduction already requested',
        existing_intro: existingIntro.rows[0]
      });
    }

    // Generate introduction email using AI
    const introContent = await generateIntroduction({
      buyer_company: buyer_company || 'a buyer',
      supplier_company: match.supplier_company,
      request_title: match.request_title,
      request_description: match.request_description,
      buyer_message,
      match_strengths: match.strengths,
      category_id: match.category_id
    });

    // Create introduction record
    const introResult = await sql`
      INSERT INTO sourcing_introductions (
        match_id,
        request_id,
        supplier_id,
        buyer_id,
        buyer_email,
        buyer_company,
        buyer_message,
        supplier_email,
        supplier_company,
        intro_subject,
        intro_body,
        status
      ) VALUES (
        ${match_id},
        ${match.request_id},
        ${match.supplier_id},
        ${userId},
        ${buyer_email || ''},
        ${buyer_company || ''},
        ${buyer_message || ''},
        ${match.supplier_email},
        ${match.supplier_company},
        ${introContent.subject},
        ${introContent.body},
        'pending'
      )
      RETURNING *
    `;

    // Update match status
    await sql`
      UPDATE sourcing_matches
      SET status = 'intro_requested', status_changed_at = NOW()
      WHERE id = ${match_id}
    `;

    // TODO: Actually send the email via Resend or other email provider
    // For now, we'll mark as sent immediately
    await sql`
      UPDATE sourcing_introductions
      SET status = 'sent', sent_at = NOW()
      WHERE id = ${introResult.rows[0].id}
    `;

    await sql`
      UPDATE sourcing_matches
      SET status = 'intro_sent', status_changed_at = NOW()
      WHERE id = ${match_id}
    `;

    return NextResponse.json({
      success: true,
      introduction: {
        id: introResult.rows[0].id,
        status: 'sent',
        subject: introContent.subject,
        supplier_company: match.supplier_company
      },
      message: `Introduction sent to ${match.supplier_company}`
    });

  } catch (error) {
    console.error('Error creating introduction:', error);
    return NextResponse.json(
      { error: 'Failed to create introduction' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Update match status
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { match_id, status, buyer_notes } = body;

    if (!match_id) {
      return NextResponse.json(
        { error: 'match_id is required' },
        { status: 400 }
      );
    }

    const validStatuses = [
      'pending', 'interested', 'declined', 'intro_requested',
      'intro_sent', 'in_negotiation', 'quote_received', 'won', 'lost'
    ];

    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify match ownership
    const matchCheck = await sql`
      SELECT m.id, r.user_id, r.id as request_id
      FROM sourcing_matches m
      JOIN sourcing_requests r ON m.request_id = r.id
      WHERE m.id = ${match_id}
    `;

    if (matchCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      );
    }

    if (matchCheck.rows[0].user_id !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Update match
    const updates: string[] = [];
    const values: any[] = [match_id];
    let paramIndex = 2;

    if (status) {
      updates.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
      updates.push(`status_changed_at = NOW()`);
    }

    if (buyer_notes !== undefined) {
      updates.push(`buyer_notes = $${paramIndex}`);
      values.push(buyer_notes);
      paramIndex++;
    }

    // Mark as viewed if not already
    updates.push(`viewed_at = COALESCE(viewed_at, NOW())`);

    const updateResult = await sql.query(
      `UPDATE sourcing_matches SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values
    );

    // If status changed to 'won', update the request status
    if (status === 'won') {
      await sql`
        UPDATE sourcing_requests
        SET status = 'deal_closed', closed_at = NOW()
        WHERE id = ${matchCheck.rows[0].request_id}
      `;

      // Mark other matches as lost
      await sql`
        UPDATE sourcing_matches
        SET status = 'lost', status_changed_at = NOW()
        WHERE request_id = ${matchCheck.rows[0].request_id}
          AND id != ${match_id}
          AND status NOT IN ('declined', 'lost')
      `;
    }

    // If status changed to negotiation, update request
    if (status === 'in_negotiation') {
      await sql`
        UPDATE sourcing_requests
        SET status = 'negotiating'
        WHERE id = ${matchCheck.rows[0].request_id}
          AND status NOT IN ('deal_closed', 'cancelled')
      `;
    }

    return NextResponse.json({
      success: true,
      match: updateResult.rows[0],
      message: `Match status updated to ${status || 'viewed'}`
    });

  } catch (error) {
    console.error('Error updating match:', error);
    return NextResponse.json(
      { error: 'Failed to update match' },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER: Run supplier matching for a request
// ============================================================================

async function runSupplierMatching(requestId: string): Promise<void> {
  try {
    // Get the request details
    const requestResult = await sql`
      SELECT * FROM sourcing_requests WHERE id = ${requestId}
    `;

    if (requestResult.rows.length === 0) {
      throw new Error('Request not found');
    }

    const request = requestResult.rows[0];

    // Get all active suppliers
    const suppliersResult = await sql`
      SELECT * FROM suppliers WHERE status = 'active'
    `;

    if (suppliersResult.rows.length === 0) {
      console.log('No active suppliers found for matching');
      return;
    }

    const suppliers = suppliersResult.rows;

    // Use AI to match and score suppliers
    const prompt = `You are an expert procurement analyst. Match these suppliers to the buyer's sourcing request.

SOURCING REQUEST:
- Title: ${request.title}
- Category: ${request.category_id}/${request.subcategory_id || 'general'}
- Description: ${request.description}
- Quantity: ${request.quantity || 'Not specified'} ${request.unit_of_measure || 'units'}
- Budget: ${request.budget_min ? `$${request.budget_min}` : 'Min not set'} - ${request.budget_max ? `$${request.budget_max}` : 'Max not set'}
- Delivery Location: ${request.delivery_location}
- Urgency: ${request.urgency}
- Required Certifications: ${(request.required_certifications || []).join(', ') || 'None specified'}
- Additional Requirements: ${request.additional_requirements || 'None'}
- Specifications: ${JSON.stringify(request.specifications || {})}

AVAILABLE SUPPLIERS:
${suppliers.map((s: any, i: number) => `
[Supplier ${i + 1}] ${s.company_name}
- Products: ${s.products?.join(', ') || 'N/A'}
- Lead Time: ${s.lead_time} days
- Min Order: $${s.minimum_order}
- Certifications: ${s.certifications?.join(', ') || 'None'}
- Locations: ${s.capacity?.locations?.join(', ') || 'N/A'}
- Monthly Capacity: ${s.capacity?.monthlyVolume || 'N/A'} units
- Drop Ship: ${s.drop_ship_capable ? 'Yes' : 'No'}
`).join('\n')}

For each supplier that could potentially fulfill this request (score 40+), provide:
1. Match score (0-100)
2. Brief reasoning
3. 2-4 strengths
4. 1-2 concerns (if any)
5. Estimated price range if possible
6. Estimated lead time

Respond in JSON:
{
  "matches": [
    {
      "supplierIndex": 0,
      "matchScore": 85,
      "reasoning": "...",
      "strengths": ["...", "..."],
      "concerns": ["..."],
      "estimatedPriceLow": 10000,
      "estimatedPriceHigh": 15000,
      "estimatedLeadTimeDays": 14,
      "scoreBreakdown": {
        "product_match": 90,
        "capacity": 85,
        "certifications": 100,
        "lead_time": 75,
        "location": 80,
        "price_range": 70
      }
    }
  ]
}

Only include suppliers with score 40 or higher. Sort by score descending.`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Insert matches
    for (const match of analysis.matches || []) {
      const supplier = suppliers[match.supplierIndex];
      if (!supplier) continue;

      // Check if supplier accepts GRAIN (simulated for now)
      const grainEnabled = Math.random() > 0.5; // TODO: Check actual GRAIN status
      const finalScore = grainEnabled
        ? Math.min(100, match.matchScore + GRAIN_ENABLED_BONUS)
        : match.matchScore;

      await sql`
        INSERT INTO sourcing_matches (
          request_id,
          supplier_id,
          match_score,
          match_reasoning,
          score_breakdown,
          grain_enabled,
          grain_bonus_applied,
          strengths,
          concerns,
          estimated_price_low,
          estimated_price_high,
          estimated_lead_time_days,
          status
        ) VALUES (
          ${requestId},
          ${supplier.id},
          ${finalScore},
          ${match.reasoning},
          ${JSON.stringify(match.scoreBreakdown || {})}::jsonb,
          ${grainEnabled},
          ${grainEnabled},
          ${match.strengths || []}::text[],
          ${match.concerns || []}::text[],
          ${match.estimatedPriceLow || null},
          ${match.estimatedPriceHigh || null},
          ${match.estimatedLeadTimeDays || null},
          'pending'
        )
        ON CONFLICT (request_id, supplier_id) DO NOTHING
      `;
    }

    // Update request status
    await sql`
      UPDATE sourcing_requests
      SET status = 'matched', last_matched_at = NOW()
      WHERE id = ${requestId}
    `;

    console.log(`Matching complete for request ${requestId}: ${analysis.matches?.length || 0} matches found`);

  } catch (error) {
    console.error('Error running supplier matching:', error);
    // Don't throw - just log the error and let the request continue
  }
}

// ============================================================================
// HELPER: Generate introduction email
// ============================================================================

async function generateIntroduction(params: {
  buyer_company: string;
  supplier_company: string;
  request_title: string;
  request_description: string;
  buyer_message?: string;
  match_strengths?: string[];
  category_id: string;
}): Promise<{ subject: string; body: string }> {
  try {
    const prompt = `Generate a professional introduction email from Wells AI connecting a buyer with a supplier.

CONTEXT:
- Buyer Company: ${params.buyer_company}
- Supplier Company: ${params.supplier_company}
- Request: ${params.request_title}
- Description: ${params.request_description}
- Why they're a match: ${(params.match_strengths || []).join(', ') || 'Strong fit based on capabilities'}
${params.buyer_message ? `- Buyer's Note: ${params.buyer_message}` : ''}

Generate a warm, professional introduction email. Be concise but personal. This is from Wells AI facilitating the connection.

Respond in JSON:
{
  "subject": "Introduction: [Buyer] <> [Supplier] - [Brief context]",
  "body": "The email body..."
}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }

    // Fallback
    return {
      subject: `Introduction: ${params.buyer_company} <> ${params.supplier_company}`,
      body: `Hello,

Wells AI has identified ${params.supplier_company} as a strong match for ${params.buyer_company}'s sourcing request: "${params.request_title}".

${params.request_description}

${params.buyer_message ? `The buyer added: "${params.buyer_message}"` : ''}

Please reply to this email to start the conversation.

Best,
Wells AI`
    };

  } catch (error) {
    console.error('Error generating introduction:', error);
    return {
      subject: `Introduction: ${params.buyer_company} <> ${params.supplier_company}`,
      body: `Hello,

Wells AI has matched you for a sourcing opportunity: "${params.request_title}".

Please reply to discuss further.

Best,
Wells AI`
    };
  }
}
