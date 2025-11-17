import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@vercel/postgres';

// GET /api/contacts/[id]/interactions - Get interaction history for a contact
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: contactId } = params;
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // Filter by interaction type
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Verify contact belongs to user
    const contactCheck = await sql`
      SELECT id FROM contacts WHERE id = ${contactId} AND user_id = ${userId}
    `;

    if (contactCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Build query using sql template literal
    let result;
    if (type) {
      result = await sql`
        SELECT
          id,
          type,
          subject,
          description,
          outcome,
          interaction_date,
          duration_minutes,
          deal_id,
          message_id,
          metadata,
          created_at,
          updated_at
        FROM contact_interactions
        WHERE contact_id = ${contactId} AND user_id = ${userId} AND type = ${type}
        ORDER BY interaction_date DESC, created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      result = await sql`
        SELECT
          id,
          type,
          subject,
          description,
          outcome,
          interaction_date,
          duration_minutes,
          deal_id,
          message_id,
          metadata,
          created_at,
          updated_at
        FROM contact_interactions
        WHERE contact_id = ${contactId} AND user_id = ${userId}
        ORDER BY interaction_date DESC, created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    // Get total count
    let countResult;
    if (type) {
      countResult = await sql`
        SELECT COUNT(*) FROM contact_interactions
        WHERE contact_id = ${contactId} AND user_id = ${userId} AND type = ${type}
      `;
    } else {
      countResult = await sql`
        SELECT COUNT(*) FROM contact_interactions
        WHERE contact_id = ${contactId} AND user_id = ${userId}
      `;
    }
    const totalCount = parseInt(countResult.rows[0].count);

    // Get summary statistics
    const statsResult = await sql`
      SELECT
        COUNT(*) as total_interactions,
        COUNT(DISTINCT type) as interaction_types,
        SUM(duration_minutes) as total_duration_minutes,
        MAX(interaction_date) as most_recent_interaction,
        MIN(interaction_date) as first_interaction,
        COUNT(*) FILTER (WHERE type = 'email') as email_count,
        COUNT(*) FILTER (WHERE type = 'call') as call_count,
        COUNT(*) FILTER (WHERE type = 'meeting') as meeting_count,
        COUNT(*) FILTER (WHERE type = 'demo') as demo_count,
        COUNT(*) FILTER (WHERE type = 'deal') as deal_count,
        COUNT(*) FILTER (WHERE type = 'note') as note_count,
        COUNT(*) FILTER (WHERE outcome = 'success') as successful_interactions
      FROM contact_interactions
      WHERE contact_id = ${contactId} AND user_id = ${userId}
    `;

    return NextResponse.json({
      interactions: result.rows,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
      statistics: statsResult.rows[0],
    });
  } catch (error: any) {
    console.error('Error fetching interactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interactions', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/contacts/[id]/interactions - Log new interaction
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: contactId } = params;
    const body = await req.json();
    const {
      type,
      subject,
      description,
      outcome,
      interaction_date,
      duration_minutes,
      deal_id,
      message_id,
      metadata = {},
    } = body;

    // Validate required fields
    if (!type) {
      return NextResponse.json(
        { error: 'Interaction type is required' },
        { status: 400 }
      );
    }

    if (!interaction_date) {
      return NextResponse.json(
        { error: 'interaction_date is required' },
        { status: 400 }
      );
    }

    // Validate interaction type
    const validTypes = [
      'email',
      'call',
      'meeting',
      'demo',
      'deal',
      'note',
      'linkedin',
      'twitter',
      'other',
    ];

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify contact belongs to user
    const contactCheck = await sql`
      SELECT id FROM contacts WHERE id = ${contactId} AND user_id = ${userId}
    `;

    if (contactCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Create interaction
    const result = await sql`
      INSERT INTO contact_interactions (
        contact_id,
        user_id,
        type,
        subject,
        description,
        outcome,
        interaction_date,
        duration_minutes,
        deal_id,
        message_id,
        metadata
      ) VALUES (${contactId}, ${userId}, ${type}, ${subject}, ${description}, ${outcome}, ${interaction_date}, ${duration_minutes}, ${deal_id}, ${message_id}, ${JSON.stringify(metadata)})
      RETURNING *
    `;

    return NextResponse.json({
      interaction: result.rows[0],
      message: 'Interaction logged successfully',
    });
  } catch (error: any) {
    console.error('Error logging interaction:', error);
    return NextResponse.json(
      { error: 'Failed to log interaction', details: error.message },
      { status: 500 }
    );
  }
}

// PATCH /api/contacts/[id]/interactions?interaction_id=xxx - Update interaction
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: contactId } = params;
    const { searchParams } = new URL(req.url);
    const interactionId = searchParams.get('interaction_id');

    if (!interactionId) {
      return NextResponse.json(
        { error: 'interaction_id query parameter is required' },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Verify interaction belongs to user and contact
    const interactionCheck = await sql`
      SELECT id FROM contact_interactions
      WHERE id = ${interactionId} AND contact_id = ${contactId} AND user_id = ${userId}
    `;

    if (interactionCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Interaction not found' },
        { status: 404 }
      );
    }

    // Build update query
    const allowedFields = [
      'type',
      'subject',
      'description',
      'outcome',
      'interaction_date',
      'duration_minutes',
      'deal_id',
      'message_id',
      'metadata',
    ];

    const updates: { [key: string]: any } = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'metadata') {
          updates[field] = JSON.stringify(body[field]);
        } else {
          updates[field] = body[field];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Build SQL update dynamically
    let updateQuery = 'UPDATE contact_interactions SET ';
    const setParts = [];
    for (const field of Object.keys(updates)) {
      setParts.push(`${field} = ${updates[field] === null ? 'NULL' : `'${updates[field]}'`}`);
    }
    updateQuery += setParts.join(', ') + ` WHERE id = ${interactionId} RETURNING *`;

    const result = await sql.unsafe(updateQuery);

    return NextResponse.json({
      interaction: result.rows[0],
      message: 'Interaction updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating interaction:', error);
    return NextResponse.json(
      { error: 'Failed to update interaction', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/contacts/[id]/interactions?interaction_id=xxx - Delete interaction
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: contactId } = params;
    const { searchParams } = new URL(req.url);
    const interactionId = searchParams.get('interaction_id');

    if (!interactionId) {
      return NextResponse.json(
        { error: 'interaction_id query parameter is required' },
        { status: 400 }
      );
    }

    // Delete interaction
    const result = await sql`
      DELETE FROM contact_interactions
      WHERE id = ${interactionId} AND contact_id = ${contactId} AND user_id = ${userId}
      RETURNING id
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Interaction not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Interaction deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting interaction:', error);
    return NextResponse.json(
      { error: 'Failed to delete interaction', details: error.message },
      { status: 500 }
    );
  }
}
