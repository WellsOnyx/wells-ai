import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Pool } from '@vercel/postgres';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

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
    const contactCheck = await pool.query(
      'SELECT id FROM contacts WHERE id = $1 AND user_id = $2',
      [contactId, userId]
    );

    if (contactCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Build query
    let query = `
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
      WHERE contact_id = $1 AND user_id = $2
    `;

    const params: any[] = [contactId, userId];
    let paramIndex = 3;

    if (type) {
      query += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    query += ` ORDER BY interaction_date DESC, created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) FROM contact_interactions
      WHERE contact_id = $1 AND user_id = $2
    `;
    const countParams: any[] = [contactId, userId];

    if (type) {
      countQuery += ' AND type = $3';
      countParams.push(type);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    // Get summary statistics
    const statsResult = await pool.query(
      `
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
      WHERE contact_id = $1 AND user_id = $2
      `,
      [contactId, userId]
    );

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
    const contactCheck = await pool.query(
      'SELECT id FROM contacts WHERE id = $1 AND user_id = $2',
      [contactId, userId]
    );

    if (contactCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Create interaction
    const result = await pool.query(
      `
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
      `,
      [
        contactId,
        userId,
        type,
        subject,
        description,
        outcome,
        interaction_date,
        duration_minutes,
        deal_id,
        message_id,
        JSON.stringify(metadata),
      ]
    );

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
    const interactionCheck = await pool.query(
      `
      SELECT id FROM contact_interactions
      WHERE id = $1 AND contact_id = $2 AND user_id = $3
      `,
      [interactionId, contactId, userId]
    );

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

    const updates: string[] = [];
    const values: any[] = [];
    let valueIndex = 1;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${valueIndex}`);
        if (field === 'metadata') {
          values.push(JSON.stringify(body[field]));
        } else {
          values.push(body[field]);
        }
        valueIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    values.push(interactionId);
    const query = `
      UPDATE contact_interactions
      SET ${updates.join(', ')}
      WHERE id = $${valueIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

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
    const result = await pool.query(
      `
      DELETE FROM contact_interactions
      WHERE id = $1 AND contact_id = $2 AND user_id = $3
      RETURNING id
      `,
      [interactionId, contactId, userId]
    );

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
