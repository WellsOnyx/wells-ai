/**
 * Sourcing Request API
 *
 * POST: Create a new sourcing request
 * GET: List user's sourcing requests
 * PUT: Update request status
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@clerk/nextjs/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// POST - Create new sourcing request
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const {
      title,
      description,
      category_id,
      subcategory_id,
      specifications,
      quantity,
      unit_of_measure,
      order_frequency,
      budget_min,
      budget_max,
      budget_currency = 'USD',
      delivery_location,
      delivery_country = 'US',
      urgency = 'standard',
      needed_by,
      current_pain_points,
      current_suppliers,
      required_certifications = [],
      additional_requirements,
      prefer_grain_enabled = true,
      prefer_domestic = false,
      user_email,
      company_name,
      is_draft = false
    } = body;

    // Validate required fields for non-draft submissions
    if (!is_draft) {
      if (!title || !description || !category_id || !delivery_location) {
        return NextResponse.json(
          { error: 'Missing required fields: title, description, category_id, delivery_location' },
          { status: 400 }
        );
      }
    }

    // Generate AI-enhanced title if not provided
    let finalTitle = title;
    if (!title && description) {
      try {
        const titleResponse = await anthropic.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: `Generate a concise, professional title (max 10 words) for this sourcing request:\n\n${description}\n\nRespond with just the title, no quotes or explanation.`
          }]
        });
        const content = titleResponse.content[0];
        if (content.type === 'text') {
          finalTitle = content.text.trim();
        }
      } catch (e) {
        console.error('Failed to generate title:', e);
        finalTitle = description.substring(0, 100);
      }
    }

    const status = is_draft ? 'draft' : 'submitted';

    const result = await sql`
      INSERT INTO sourcing_requests (
        user_id,
        user_email,
        company_name,
        title,
        description,
        category_id,
        subcategory_id,
        specifications,
        quantity,
        unit_of_measure,
        order_frequency,
        budget_min,
        budget_max,
        budget_currency,
        delivery_location,
        delivery_country,
        urgency,
        needed_by,
        current_pain_points,
        current_suppliers,
        required_certifications,
        additional_requirements,
        prefer_grain_enabled,
        prefer_domestic,
        status,
        submitted_at
      ) VALUES (
        ${userId},
        ${user_email || null},
        ${company_name || null},
        ${finalTitle || 'Untitled Request'},
        ${description || ''},
        ${category_id || 'other'},
        ${subcategory_id || null},
        ${JSON.stringify(specifications || {})}::jsonb,
        ${quantity || null},
        ${unit_of_measure || null},
        ${order_frequency || null},
        ${budget_min || null},
        ${budget_max || null},
        ${budget_currency},
        ${delivery_location || ''},
        ${delivery_country},
        ${urgency},
        ${needed_by || null},
        ${current_pain_points || null},
        ${current_suppliers || null},
        ${required_certifications}::text[],
        ${additional_requirements || null},
        ${prefer_grain_enabled},
        ${prefer_domestic},
        ${status},
        ${is_draft ? null : new Date().toISOString()}
      )
      RETURNING *
    `;

    const request_record = result.rows[0];

    // If not a draft, trigger matching asynchronously
    if (!is_draft) {
      // We'll call the matching endpoint separately or handle via background job
      // For now, update status to 'matching'
      await sql`
        UPDATE sourcing_requests
        SET status = 'matching'
        WHERE id = ${request_record.id}
      `;
    }

    return NextResponse.json({
      success: true,
      request: {
        id: request_record.id,
        title: request_record.title,
        status: is_draft ? 'draft' : 'matching',
        created_at: request_record.created_at
      },
      message: is_draft ? 'Draft saved' : 'Request submitted - finding matches'
    });

  } catch (error) {
    console.error('Error creating sourcing request:', error);
    return NextResponse.json(
      { error: 'Failed to create sourcing request' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - List user's sourcing requests
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // Optional filter
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query;

    if (status && status !== 'all') {
      query = await sql`
        SELECT
          r.*,
          (
            SELECT COUNT(*) FROM sourcing_matches m WHERE m.request_id = r.id
          ) AS total_matches,
          (
            SELECT COUNT(*) FROM sourcing_matches m WHERE m.request_id = r.id AND m.status = 'interested'
          ) AS interested_matches,
          (
            SELECT COUNT(*) FROM sourcing_introductions i WHERE i.request_id = r.id
          ) AS total_introductions,
          (
            SELECT MAX(m.match_score) FROM sourcing_matches m WHERE m.request_id = r.id
          ) AS top_match_score
        FROM sourcing_requests r
        WHERE r.user_id = ${userId}
          AND r.status = ${status}
        ORDER BY r.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else {
      query = await sql`
        SELECT
          r.*,
          (
            SELECT COUNT(*) FROM sourcing_matches m WHERE m.request_id = r.id
          ) AS total_matches,
          (
            SELECT COUNT(*) FROM sourcing_matches m WHERE m.request_id = r.id AND m.status = 'interested'
          ) AS interested_matches,
          (
            SELECT COUNT(*) FROM sourcing_introductions i WHERE i.request_id = r.id
          ) AS total_introductions,
          (
            SELECT MAX(m.match_score) FROM sourcing_matches m WHERE m.request_id = r.id
          ) AS top_match_score
        FROM sourcing_requests r
        WHERE r.user_id = ${userId}
        ORDER BY r.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    }

    // Get counts by status
    const countsResult = await sql`
      SELECT
        status,
        COUNT(*) as count
      FROM sourcing_requests
      WHERE user_id = ${userId}
      GROUP BY status
    `;

    const statusCounts: Record<string, number> = {};
    countsResult.rows.forEach(row => {
      statusCounts[row.status] = parseInt(row.count);
    });

    return NextResponse.json({
      success: true,
      requests: query.rows.map(row => ({
        ...row,
        total_matches: parseInt(row.total_matches) || 0,
        interested_matches: parseInt(row.interested_matches) || 0,
        total_introductions: parseInt(row.total_introductions) || 0,
        top_match_score: parseInt(row.top_match_score) || null
      })),
      counts: {
        all: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        ...statusCounts
      },
      pagination: {
        limit,
        offset,
        has_more: query.rows.length === limit
      }
    });

  } catch (error) {
    console.error('Error listing sourcing requests:', error);
    return NextResponse.json(
      { error: 'Failed to list sourcing requests' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Update request status or details
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { request_id, action, updates } = body;

    if (!request_id) {
      return NextResponse.json(
        { error: 'request_id is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const ownerCheck = await sql`
      SELECT id, status FROM sourcing_requests
      WHERE id = ${request_id} AND user_id = ${userId}
    `;

    if (ownerCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Request not found or access denied' },
        { status: 404 }
      );
    }

    const currentStatus = ownerCheck.rows[0].status;

    // Handle different actions
    switch (action) {
      case 'submit':
        // Submit a draft
        if (currentStatus !== 'draft') {
          return NextResponse.json(
            { error: 'Only drafts can be submitted' },
            { status: 400 }
          );
        }
        await sql`
          UPDATE sourcing_requests
          SET status = 'matching', submitted_at = NOW()
          WHERE id = ${request_id}
        `;
        return NextResponse.json({
          success: true,
          message: 'Request submitted - finding matches',
          status: 'matching'
        });

      case 'cancel':
        // Cancel a request
        if (['deal_closed', 'cancelled'].includes(currentStatus)) {
          return NextResponse.json(
            { error: 'Cannot cancel a closed or already cancelled request' },
            { status: 400 }
          );
        }
        await sql`
          UPDATE sourcing_requests
          SET status = 'cancelled', closed_at = NOW()
          WHERE id = ${request_id}
        `;
        return NextResponse.json({
          success: true,
          message: 'Request cancelled',
          status: 'cancelled'
        });

      case 'update':
        // Update request details (only allowed for draft/submitted)
        if (!['draft', 'submitted'].includes(currentStatus)) {
          return NextResponse.json(
            { error: 'Cannot update request after matching has started' },
            { status: 400 }
          );
        }

        // Build dynamic update query
        const allowedUpdates = [
          'title', 'description', 'category_id', 'subcategory_id',
          'specifications', 'quantity', 'unit_of_measure', 'order_frequency',
          'budget_min', 'budget_max', 'delivery_location', 'urgency',
          'needed_by', 'current_pain_points', 'additional_requirements',
          'prefer_grain_enabled', 'prefer_domestic'
        ];

        const updateFields: string[] = [];
        const updateValues: any[] = [];

        for (const [key, value] of Object.entries(updates || {})) {
          if (allowedUpdates.includes(key)) {
            updateFields.push(key);
            updateValues.push(value);
          }
        }

        if (updateFields.length === 0) {
          return NextResponse.json(
            { error: 'No valid updates provided' },
            { status: 400 }
          );
        }

        // For specifications, convert to JSONB
        const specsIndex = updateFields.indexOf('specifications');
        if (specsIndex !== -1) {
          updateValues[specsIndex] = JSON.stringify(updateValues[specsIndex]);
        }

        // Execute update with dynamic fields
        const setClause = updateFields.map((field, i) => {
          if (field === 'specifications') {
            return `${field} = $${i + 2}::jsonb`;
          }
          return `${field} = $${i + 2}`;
        }).join(', ');

        await sql.query(
          `UPDATE sourcing_requests SET ${setClause}, updated_at = NOW() WHERE id = $1`,
          [request_id, ...updateValues]
        );

        return NextResponse.json({
          success: true,
          message: 'Request updated',
          updated_fields: updateFields
        });

      case 'close':
        // Close a request as complete (deal closed)
        await sql`
          UPDATE sourcing_requests
          SET status = 'deal_closed', closed_at = NOW()
          WHERE id = ${request_id}
        `;
        return NextResponse.json({
          success: true,
          message: 'Request marked as closed',
          status: 'deal_closed'
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error updating sourcing request:', error);
    return NextResponse.json(
      { error: 'Failed to update sourcing request' },
      { status: 500 }
    );
  }
}
