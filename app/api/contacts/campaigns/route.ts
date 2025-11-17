import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Pool } from '@vercel/postgres';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// GET /api/contacts/campaigns - List all campaigns for user
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = `
      SELECT
        id,
        name,
        description,
        status,
        filters,
        goal,
        start_date,
        end_date,
        contact_count,
        messages_sent,
        responses_received,
        metadata,
        created_at,
        updated_at
      FROM contact_campaigns
      WHERE user_id = $1
    `;

    const params: any[] = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM contact_campaigns WHERE user_id = $1';
    const countParams: any[] = [userId];
    if (status) {
      countQuery += ' AND status = $2';
      countParams.push(status);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      campaigns: result.rows,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/contacts/campaigns - Create new campaign
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      description,
      status = 'draft',
      filters = {},
      goal,
      start_date,
      end_date,
      metadata = {},
      auto_populate = false, // Whether to automatically add contacts matching filters
    } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Campaign name is required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['draft', 'active', 'paused', 'completed', 'archived'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Create campaign
    const result = await pool.query(
      `
      INSERT INTO contact_campaigns (
        user_id,
        name,
        description,
        status,
        filters,
        goal,
        start_date,
        end_date,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        userId,
        name,
        description,
        status,
        JSON.stringify(filters),
        goal,
        start_date,
        end_date,
        JSON.stringify(metadata),
      ]
    );

    const campaign = result.rows[0];

    // Auto-populate contacts if requested
    if (auto_populate && Object.keys(filters).length > 0) {
      const contactIds = await findContactsByFilters(userId, filters);

      if (contactIds.length > 0) {
        await addContactsToCampaign(campaign.id, contactIds, 'filter');
      }

      // Refresh campaign to get updated contact_count
      const updatedCampaign = await pool.query(
        'SELECT * FROM contact_campaigns WHERE id = $1',
        [campaign.id]
      );
      return NextResponse.json({
        campaign: updatedCampaign.rows[0],
        contacts_added: contactIds.length,
      });
    }

    return NextResponse.json({ campaign });
  } catch (error: any) {
    console.error('Error creating campaign:', error);
    return NextResponse.json(
      { error: 'Failed to create campaign', details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to find contacts by filters
async function findContactsByFilters(
  userId: string,
  filters: any
): Promise<string[]> {
  let query = 'SELECT id FROM contacts WHERE user_id = $1 AND status = $2';
  const params: any[] = [userId, 'active'];
  let paramIndex = 3;

  // Build dynamic WHERE clause based on filters
  if (filters.relationship_type) {
    query += ` AND relationship_type = $${paramIndex}`;
    params.push(filters.relationship_type);
    paramIndex++;
  }

  if (filters.importance_score) {
    if (filters.importance_score.min !== undefined) {
      query += ` AND importance_score >= $${paramIndex}`;
      params.push(filters.importance_score.min);
      paramIndex++;
    }
    if (filters.importance_score.max !== undefined) {
      query += ` AND importance_score <= $${paramIndex}`;
      params.push(filters.importance_score.max);
      paramIndex++;
    }
  }

  if (filters.company) {
    query += ` AND company ILIKE $${paramIndex}`;
    params.push(`%${filters.company}%`);
    paramIndex++;
  }

  if (filters.role) {
    query += ` AND role ILIKE $${paramIndex}`;
    params.push(`%${filters.role}%`);
    paramIndex++;
  }

  if (filters.preferred_channel) {
    query += ` AND preferred_channel = $${paramIndex}`;
    params.push(filters.preferred_channel);
    paramIndex++;
  }

  if (filters.tags && Array.isArray(filters.tags)) {
    query += ` AND tags && $${paramIndex}`;
    params.push(filters.tags);
    paramIndex++;
  }

  if (filters.last_contact_days) {
    // Contacts contacted within X days
    query += ` AND last_contact_date >= NOW() - INTERVAL '${parseInt(filters.last_contact_days)} days'`;
  }

  if (filters.dormant_days) {
    // Contacts NOT contacted within X days
    query += ` AND (last_contact_date IS NULL OR last_contact_date < NOW() - INTERVAL '${parseInt(filters.dormant_days)} days')`;
  }

  const result = await pool.query(query, params);
  return result.rows.map((row) => row.id);
}

// Helper function to add contacts to campaign
async function addContactsToCampaign(
  campaignId: string,
  contactIds: string[],
  addedBy: string = 'manual'
): Promise<void> {
  if (contactIds.length === 0) return;

  // Build bulk insert query
  const values = contactIds
    .map(
      (_, index) =>
        `($1, $${index + 2}, NOW(), $${contactIds.length + 2})`
    )
    .join(', ');

  const query = `
    INSERT INTO campaign_contacts (campaign_id, contact_id, added_at, added_by)
    VALUES ${values}
    ON CONFLICT (campaign_id, contact_id) DO NOTHING
  `;

  const params = [campaignId, ...contactIds, addedBy];
  await pool.query(query, params);
}
