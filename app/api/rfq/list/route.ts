/**
 * RFQ List API
 * GET: List all RFQs for the current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sqlQuery as sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's email for matching
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get RFQs with quote counts
    let query;
    if (status) {
      query = sql`
        SELECT
          r.*,
          COALESCE(q.quote_count, 0) as quote_count,
          a.award_amount as awarded_amount
        FROM rfqs r
        LEFT JOIN (
          SELECT rfq_id, COUNT(*) as quote_count
          FROM rfq_quotes
          GROUP BY rfq_id
        ) q ON r.id = q.rfq_id
        LEFT JOIN rfq_awards a ON r.id = a.rfq_id
        WHERE r.status = ${status}
        ORDER BY r.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else {
      query = sql`
        SELECT
          r.*,
          COALESCE(q.quote_count, 0) as quote_count,
          a.award_amount as awarded_amount
        FROM rfqs r
        LEFT JOIN (
          SELECT rfq_id, COUNT(*) as quote_count
          FROM rfq_quotes
          GROUP BY rfq_id
        ) q ON r.id = q.rfq_id
        LEFT JOIN rfq_awards a ON r.id = a.rfq_id
        ORDER BY r.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    }

    const result = await query;

    const rfqs = result.rows.map(row => ({
      id: row.id,
      category: row.category,
      description: row.description,
      quantity: row.quantity,
      targetPrice: row.target_price,
      urgency: row.urgency,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      quoteCount: parseInt(row.quote_count) || 0,
      awardedAmount: row.awarded_amount ? parseFloat(row.awarded_amount) : undefined,
    }));

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as total FROM rfqs
    `;
    const total = parseInt(countResult.rows[0]?.total || '0');

    return NextResponse.json({
      success: true,
      rfqs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + rfqs.length < total,
      },
    });
  } catch (error: any) {
    console.error('Error listing RFQs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list RFQs' },
      { status: 500 }
    );
  }
}
