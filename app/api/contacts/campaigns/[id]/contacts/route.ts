import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Pool } from '@vercel/postgres';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// POST /api/contacts/campaigns/[id]/contacts - Add contacts to campaign
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: campaignId } = params;
    const body = await req.json();
    const { contact_ids, added_by = 'manual' } = body;

    // Validate request
    if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
      return NextResponse.json(
        { error: 'contact_ids array is required' },
        { status: 400 }
      );
    }

    // Verify campaign ownership
    const campaignCheck = await pool.query(
      'SELECT id FROM contact_campaigns WHERE id = $1 AND user_id = $2',
      [campaignId, userId]
    );

    if (campaignCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Verify contacts belong to user
    const contactsCheck = await pool.query(
      `
      SELECT id FROM contacts
      WHERE id = ANY($1) AND user_id = $2
      `,
      [contact_ids, userId]
    );

    const validContactIds = contactsCheck.rows.map((row) => row.id);

    if (validContactIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid contacts found' },
        { status: 400 }
      );
    }

    // Add contacts to campaign (ignore duplicates)
    const values = validContactIds
      .map((_, index) => `($1, $${index + 2}, NOW(), $${validContactIds.length + 2})`)
      .join(', ');

    const insertQuery = `
      INSERT INTO campaign_contacts (campaign_id, contact_id, added_at, added_by)
      VALUES ${values}
      ON CONFLICT (campaign_id, contact_id) DO NOTHING
    `;

    await pool.query(insertQuery, [campaignId, ...validContactIds, added_by]);

    // Get count of actually added contacts
    const addedCount = validContactIds.length;
    const ignoredCount = contact_ids.length - validContactIds.length;

    return NextResponse.json({
      success: true,
      added: addedCount,
      ignored: ignoredCount,
      message: `${addedCount} contact(s) added to campaign`,
    });
  } catch (error: any) {
    console.error('Error adding contacts to campaign:', error);
    return NextResponse.json(
      { error: 'Failed to add contacts to campaign', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/contacts/campaigns/[id]/contacts - Remove contacts from campaign
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: campaignId } = params;
    const { searchParams } = new URL(req.url);

    // Support both query params and request body
    let contactIds: string[] = [];
    const contactIdsParam = searchParams.get('contact_ids');

    if (contactIdsParam) {
      contactIds = contactIdsParam.split(',');
    } else {
      const body = await req.json();
      contactIds = body.contact_ids || [];
    }

    if (!contactIds || contactIds.length === 0) {
      return NextResponse.json(
        { error: 'contact_ids is required' },
        { status: 400 }
      );
    }

    // Verify campaign ownership
    const campaignCheck = await pool.query(
      'SELECT id FROM contact_campaigns WHERE id = $1 AND user_id = $2',
      [campaignId, userId]
    );

    if (campaignCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Remove contacts from campaign
    const result = await pool.query(
      `
      DELETE FROM campaign_contacts
      WHERE campaign_id = $1 AND contact_id = ANY($2)
      RETURNING contact_id
      `,
      [campaignId, contactIds]
    );

    const removedCount = result.rows.length;

    return NextResponse.json({
      success: true,
      removed: removedCount,
      message: `${removedCount} contact(s) removed from campaign`,
    });
  } catch (error: any) {
    console.error('Error removing contacts from campaign:', error);
    return NextResponse.json(
      { error: 'Failed to remove contacts from campaign', details: error.message },
      { status: 500 }
    );
  }
}
