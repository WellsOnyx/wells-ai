// Contact Lists API - Manage and score contact lists
import { NextRequest, NextResponse } from 'next/server';
import { contactsDb } from '@/lib/crm/contacts-db';

export const dynamic = 'force-dynamic';

// GET - List all contact lists
export async function GET() {
  try {
    const lists = await contactsDb.getLists();

    return NextResponse.json({
      lists,
      total: lists.length,
    });
  } catch (error) {
    console.error('Error fetching lists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lists' },
      { status: 500 }
    );
  }
}

// POST - Score contacts with ICP criteria
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      listName,
      icpCriteria,
    } = body;

    if (!listName) {
      return NextResponse.json(
        { error: 'listName is required' },
        { status: 400 }
      );
    }

    // Default ICP for B2B SaaS if not provided
    const criteria = icpCriteria || {
      industries: ['Technology', 'Financial Services', 'Software', 'SaaS'],
      companySizes: ['11-50', '51-200', '201-500', '501-1000'],
      titles: ['CEO', 'CTO', 'CFO', 'VP', 'Director', 'Head of', 'Manager'],
      countries: ['United States', 'US', 'USA', 'Canada', 'United Kingdom', 'UK'],
    };

    const updated = await contactsDb.scoreWithIcp(listName, criteria);

    return NextResponse.json({
      success: true,
      listName,
      contactsScored: updated,
      criteria,
    });
  } catch (error) {
    console.error('Error scoring contacts:', error);
    return NextResponse.json(
      { error: 'Failed to score contacts' },
      { status: 500 }
    );
  }
}
