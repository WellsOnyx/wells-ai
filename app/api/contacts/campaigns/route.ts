import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@vercel/postgres';

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

    let result;
    let countResult;

    if (status) {
      result = await sql`
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
        WHERE user_id = ${userId} AND status = ${status}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      countResult = await sql`
        SELECT COUNT(*) FROM contact_campaigns WHERE user_id = ${userId} AND status = ${status}
      `;
    } else {
      result = await sql`
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
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      countResult = await sql`
        SELECT COUNT(*) FROM contact_campaigns WHERE user_id = ${userId}
      `;
    }

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
    const result = await sql`
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
      ) VALUES (${userId}, ${name}, ${description}, ${status}, ${JSON.stringify(filters)}, ${goal}, ${start_date}, ${end_date}, ${JSON.stringify(metadata)})
      RETURNING *
    `;

    const campaign = result.rows[0];

    // Auto-populate contacts if requested
    if (auto_populate && Object.keys(filters).length > 0) {
      const contactIds = await findContactsByFilters(userId, filters);

      if (contactIds.length > 0) {
        await addContactsToCampaign(campaign.id, contactIds, 'filter');
      }

      // Refresh campaign to get updated contact_count
      const updatedCampaign = await sql`
        SELECT * FROM contact_campaigns WHERE id = ${campaign.id}
      `;
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
  // Build dynamic query using sql unsafe for complex filtering
  let query = `SELECT id FROM contacts WHERE user_id = '${userId}' AND status = 'active'`;

  // Build dynamic WHERE clause based on filters
  if (filters.relationship_type) {
    query += ` AND relationship_type = '${filters.relationship_type}'`;
  }

  if (filters.importance_score) {
    if (filters.importance_score.min !== undefined) {
      query += ` AND importance_score >= ${filters.importance_score.min}`;
    }
    if (filters.importance_score.max !== undefined) {
      query += ` AND importance_score <= ${filters.importance_score.max}`;
    }
  }

  if (filters.company) {
    query += ` AND company ILIKE '%${filters.company.replace(/'/g, "''")}'%`;
  }

  if (filters.role) {
    query += ` AND role ILIKE '%${filters.role.replace(/'/g, "''")}'%`;
  }

  if (filters.preferred_channel) {
    query += ` AND preferred_channel = '${filters.preferred_channel}'`;
  }

  if (filters.tags && Array.isArray(filters.tags)) {
    const tagArray = filters.tags.map((t: string) => `'${t.replace(/'/g, "''")}'`).join(',');
    query += ` AND tags && ARRAY[${tagArray}]`;
  }

  if (filters.last_contact_days) {
    // Contacts contacted within X days
    query += ` AND last_contact_date >= NOW() - INTERVAL '${parseInt(filters.last_contact_days)} days'`;
  }

  if (filters.dormant_days) {
    // Contacts NOT contacted within X days
    query += ` AND (last_contact_date IS NULL OR last_contact_date < NOW() - INTERVAL '${parseInt(filters.dormant_days)} days')`;
  }

  const result = await sql.unsafe(query);
  return result.rows.map((row) => row.id);
}

// Helper function to add contacts to campaign
async function addContactsToCampaign(
  campaignId: string,
  contactIds: string[],
  addedBy: string = 'manual'
): Promise<void> {
  if (contactIds.length === 0) return;

  // Insert contacts into campaign
  for (const contactId of contactIds) {
    await sql`
      INSERT INTO campaign_contacts (campaign_id, contact_id, added_at, added_by)
      VALUES (${campaignId}, ${contactId}, NOW(), ${addedBy})
      ON CONFLICT (campaign_id, contact_id) DO NOTHING
    `;
  }
}
