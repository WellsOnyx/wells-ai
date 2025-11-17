import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@vercel/postgres';

// POST /api/contacts/bulk - Bulk operations on contacts
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { operation, contact_ids, data } = body;

    // Validate request
    if (!operation) {
      return NextResponse.json(
        { error: 'operation is required (update, delete, export, add_to_campaign, add_tags, remove_tags, change_status)' },
        { status: 400 }
      );
    }

    if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
      return NextResponse.json(
        { error: 'contact_ids array is required' },
        { status: 400 }
      );
    }

    // Verify contacts belong to user
    const ownershipCheck = await sql`
      SELECT id FROM contacts WHERE id = ANY(${contact_ids}) AND user_id = ${userId}
    `;

    const validContactIds = ownershipCheck.rows.map((row) => row.id);

    if (validContactIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid contacts found' },
        { status: 400 }
      );
    }

    let result;

    switch (operation) {
      case 'update':
        result = await bulkUpdate(userId, validContactIds, data);
        break;

      case 'delete':
        result = await bulkDelete(userId, validContactIds);
        break;

      case 'export':
        result = await bulkExport(userId, validContactIds, data?.format || 'csv');
        break;

      case 'add_to_campaign':
        if (!data?.campaign_id) {
          return NextResponse.json(
            { error: 'campaign_id is required for add_to_campaign operation' },
            { status: 400 }
          );
        }
        result = await addToCampaign(userId, validContactIds, data.campaign_id);
        break;

      case 'add_tags':
        if (!data?.tags || !Array.isArray(data.tags)) {
          return NextResponse.json(
            { error: 'tags array is required for add_tags operation' },
            { status: 400 }
          );
        }
        result = await addTags(userId, validContactIds, data.tags);
        break;

      case 'remove_tags':
        if (!data?.tags || !Array.isArray(data.tags)) {
          return NextResponse.json(
            { error: 'tags array is required for remove_tags operation' },
            { status: 400 }
          );
        }
        result = await removeTags(userId, validContactIds, data.tags);
        break;

      case 'change_status':
        if (!data?.status) {
          return NextResponse.json(
            { error: 'status is required for change_status operation' },
            { status: 400 }
          );
        }
        result = await changeStatus(userId, validContactIds, data.status);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown operation: ${operation}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      operation,
      affected: validContactIds.length,
      ignored: contact_ids.length - validContactIds.length,
      ...result,
    });
  } catch (error: any) {
    console.error('Error in bulk operation:', error);
    return NextResponse.json(
      { error: 'Bulk operation failed', details: error.message },
      { status: 500 }
    );
  }
}

// Bulk update contacts
async function bulkUpdate(
  userId: string,
  contactIds: string[],
  updates: any
): Promise<any> {
  const allowedFields = [
    'name',
    'email',
    'phone',
    'company',
    'role',
    'relationship_type',
    'importance_score',
    'status',
    'metadata',
  ];

  const updateObj: { [key: string]: any } = {};

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      if (field === 'metadata') {
        updateObj[field] = JSON.stringify(updates[field]);
      } else {
        updateObj[field] = updates[field];
      }
    }
  }

  if (Object.keys(updateObj).length === 0) {
    return { message: 'No valid fields to update' };
  }

  // Build dynamic SQL query
  let query = 'UPDATE contacts SET ';
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
  query += setParts.join(', ') + ` WHERE id = ANY('${contactIds.join(',')}') AND user_id = '${userId}' RETURNING id`;

  const result = await sql.unsafe(query);

  return {
    updated: result.rows.length,
    message: `${result.rows.length} contact(s) updated`,
  };
}

// Bulk delete contacts
async function bulkDelete(userId: string, contactIds: string[]): Promise<any> {
  const result = await sql`
    DELETE FROM contacts
    WHERE id = ANY(${contactIds}) AND user_id = ${userId}
    RETURNING id
  `;

  return {
    deleted: result.rows.length,
    message: `${result.rows.length} contact(s) deleted`,
  };
}

// Bulk export contacts
async function bulkExport(
  userId: string,
  contactIds: string[],
  format: string
): Promise<any> {
  const result = await sql`
    SELECT
      id,
      name,
      email,
      phone,
      company,
      role,
      relationship_type,
      importance_score,
      status,
      first_contact_date,
      last_contact_date,
      total_messages_received,
      total_messages_sent,
      avg_response_time_minutes,
      preferred_channel,
      tags,
      created_at
    FROM contacts
    WHERE id = ANY(${contactIds}) AND user_id = ${userId}
    ORDER BY name
  `;

  if (format === 'csv') {
    // Generate CSV
    const contacts = result.rows;
    if (contacts.length === 0) {
      return { csv: '', message: 'No contacts to export' };
    }

    const headers = Object.keys(contacts[0]);
    const csvHeaders = headers.join(',');

    const csvRows = contacts.map((contact) =>
      headers
        .map((header) => {
          const value = contact[header];
          // Handle null, arrays, and objects
          if (value === null || value === undefined) return '';
          if (Array.isArray(value)) return `"${value.join(';')}"`;
          if (typeof value === 'object') return `"${JSON.stringify(value)}"`;
          // Escape quotes and wrap in quotes if contains comma
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(',')
    );

    const csv = [csvHeaders, ...csvRows].join('\n');

    return {
      format: 'csv',
      csv,
      count: contacts.length,
      message: `${contacts.length} contact(s) exported`,
    };
  } else if (format === 'json') {
    return {
      format: 'json',
      contacts: result.rows,
      count: result.rows.length,
      message: `${result.rows.length} contact(s) exported`,
    };
  } else {
    throw new Error(`Unsupported export format: ${format}`);
  }
}

// Add contacts to campaign
async function addToCampaign(
  userId: string,
  contactIds: string[],
  campaignId: string
): Promise<any> {
  // Verify campaign ownership
  const campaignCheck = await sql`
    SELECT id FROM contact_campaigns WHERE id = ${campaignId} AND user_id = ${userId}
  `;

  if (campaignCheck.rows.length === 0) {
    throw new Error('Campaign not found');
  }

  // Insert contacts into campaign
  for (const contactId of contactIds) {
    await sql`
      INSERT INTO campaign_contacts (campaign_id, contact_id, added_at, added_by)
      VALUES (${campaignId}, ${contactId}, NOW(), 'bulk')
      ON CONFLICT (campaign_id, contact_id) DO NOTHING
    `;
  }

  return {
    campaign_id: campaignId,
    message: `Contacts added to campaign`,
  };
}

// Add tags to contacts
async function addTags(
  userId: string,
  contactIds: string[],
  tags: string[]
): Promise<any> {
  // Use array concatenation to add tags
  const result = await sql`
    UPDATE contacts
    SET tags = array(SELECT DISTINCT unnest(tags || ARRAY[${tags.join(',')}]))
    WHERE id = ANY(${contactIds}) AND user_id = ${userId}
    RETURNING id
  `;

  return {
    tags_added: tags,
    message: `Tags added to ${result.rows.length} contact(s)`,
  };
}

// Remove tags from contacts
async function removeTags(
  userId: string,
  contactIds: string[],
  tags: string[]
): Promise<any> {
  // Use array subtraction to remove tags
  const result = await sql`
    UPDATE contacts
    SET tags = array(SELECT unnest(tags) EXCEPT SELECT unnest(ARRAY[${tags.join(',')}]))
    WHERE id = ANY(${contactIds}) AND user_id = ${userId}
    RETURNING id
  `;

  return {
    tags_removed: tags,
    message: `Tags removed from ${result.rows.length} contact(s)`,
  };
}

// Change status of contacts
async function changeStatus(
  userId: string,
  contactIds: string[],
  status: string
): Promise<any> {
  const validStatuses = ['active', 'inactive', 'archived'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const result = await sql`
    UPDATE contacts
    SET status = ${status}
    WHERE id = ANY(${contactIds}) AND user_id = ${userId}
    RETURNING id
  `;

  return {
    new_status: status,
    message: `Status changed for ${result.rows.length} contact(s)`,
  };
}
