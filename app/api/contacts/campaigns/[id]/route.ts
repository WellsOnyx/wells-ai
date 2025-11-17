import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@vercel/postgres';

// GET /api/contacts/campaigns/[id] - Get campaign details with contacts
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const { searchParams } = new URL(req.url);
    const includeContacts = searchParams.get('include_contacts') !== 'false';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get campaign
    const campaignResult = await sql`
      SELECT * FROM contact_campaigns
      WHERE id = ${id} AND user_id = ${userId}
    `;

    if (campaignResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    const campaign = campaignResult.rows[0];

    // Get contacts if requested
    let contacts = [];
    let contactsPagination = null;

    if (includeContacts) {
      const contactsResult = await sql`
        SELECT
          c.*,
          cc.added_at,
          cc.added_by,
          cc.messages_sent as campaign_messages_sent,
          cc.last_contacted as campaign_last_contacted,
          cc.responded as campaign_responded
        FROM campaign_contacts cc
        JOIN contacts c ON cc.contact_id = c.id
        WHERE cc.campaign_id = ${id}
        ORDER BY cc.added_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      contacts = contactsResult.rows;

      // Get total contact count (should match campaign.contact_count but query for accuracy)
      const countResult = await sql`
        SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = ${id}
      `;
      const totalContacts = parseInt(countResult.rows[0].count);

      contactsPagination = {
        total: totalContacts,
        limit,
        offset,
        hasMore: offset + limit < totalContacts,
      };
    }

    return NextResponse.json({
      campaign,
      contacts,
      pagination: contactsPagination,
    });
  } catch (error: any) {
    console.error('Error fetching campaign:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign', details: error.message },
      { status: 500 }
    );
  }
}

// PATCH /api/contacts/campaigns/[id] - Update campaign
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();

    // Verify ownership
    const ownershipCheck = await sql`
      SELECT id FROM contact_campaigns WHERE id = ${id} AND user_id = ${userId}
    `;

    if (ownershipCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Build update query dynamically
    const allowedFields = [
      'name',
      'description',
      'status',
      'filters',
      'goal',
      'start_date',
      'end_date',
      'metadata',
    ];

    const updateObj: { [key: string]: any } = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Stringify JSON fields
        if (['filters', 'metadata'].includes(field)) {
          updateObj[field] = JSON.stringify(body[field]);
        } else {
          updateObj[field] = body[field];
        }
      }
    }

    if (Object.keys(updateObj).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Build SQL update dynamically
    let query = 'UPDATE contact_campaigns SET ';
    const setParts = [];
    for (const field of Object.keys(updateObj)) {
      const value = updateObj[field];
      if (value === null) {
        setParts.push(`${field} = NULL`);
      } else if (typeof value === 'string') {
        setParts.push(`${field} = '${value.replace(/'/g, "''")}'`);
      } else {
        setParts.push(`${field} = '${JSON.stringify(value).replace(/'/g, "''")}'`);
      }
    }
    query += setParts.join(', ') + ` WHERE id = '${id}' RETURNING *`;

    const result = await sql.unsafe(query);

    return NextResponse.json({ campaign: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating campaign:', error);
    return NextResponse.json(
      { error: 'Failed to update campaign', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/contacts/campaigns/[id] - Delete campaign
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Delete campaign (cascade will remove campaign_contacts entries)
    const result = await sql`
      DELETE FROM contact_campaigns
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING id
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Campaign deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting campaign:', error);
    return NextResponse.json(
      { error: 'Failed to delete campaign', details: error.message },
      { status: 500 }
    );
  }
}
