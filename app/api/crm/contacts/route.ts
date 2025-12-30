// CRM Contacts API - List, search, and manage contacts
import { NextRequest, NextResponse } from 'next/server';
import { contactsDb } from '@/lib/crm/contacts-db';

export const dynamic = 'force-dynamic';

// GET - List/search contacts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const options = {
      listName: searchParams.get('list') || undefined,
      status: searchParams.get('status') || undefined,
      priority: searchParams.get('priority') || undefined,
      industry: searchParams.get('industry') || undefined,
      minIcpScore: searchParams.get('minScore') ? parseInt(searchParams.get('minScore')!) : undefined,
      search: searchParams.get('q') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    const { contacts, total } = await contactsDb.get(options);

    return NextResponse.json({
      contacts,
      total,
      limit: options.limit,
      offset: options.offset,
      hasMore: options.offset + contacts.length < total,
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}

// POST - Create single contact
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      firstName,
      lastName,
      phone,
      company,
      title,
      industry,
      linkedinUrl,
      listName = 'default',
      tags,
      notes,
    } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Use import function with single record
    const result = await contactsDb.importCsv(
      [{
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
        company,
        title,
        industry,
        linkedin_url: linkedinUrl,
      }],
      listName,
      'api',
      undefined
    );

    if (result.imported > 0) {
      return NextResponse.json({
        success: true,
        contact: result.contacts[0],
      });
    } else if (result.duplicates > 0) {
      return NextResponse.json(
        { error: 'Contact already exists in this list' },
        { status: 409 }
      );
    } else {
      return NextResponse.json(
        { error: 'Failed to create contact' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error creating contact:', error);
    return NextResponse.json(
      { error: 'Failed to create contact' },
      { status: 500 }
    );
  }
}

// PATCH - Update contact
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { contactId, ...updates } = body;

    if (!contactId) {
      return NextResponse.json(
        { error: 'Contact ID is required' },
        { status: 400 }
      );
    }

    const contact = await contactsDb.update(contactId, updates);

    if (contact) {
      return NextResponse.json({ success: true, contact });
    } else {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error updating contact:', error);
    return NextResponse.json(
      { error: 'Failed to update contact' },
      { status: 500 }
    );
  }
}
