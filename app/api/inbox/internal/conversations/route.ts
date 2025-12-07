import { NextRequest, NextResponse } from 'next/server';
import {
  getConversations,
  createConversation
} from '@/lib/inbox/providers/wells-internal';

/**
 * GET /api/inbox/internal/conversations
 *
 * Get internal conversations for a user
 *
 * Query params:
 * - userId: string (required)
 * - accountId: string (optional)
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 * - unreadOnly: boolean (default: false)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const accountId = searchParams.get('accountId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const conversations = await getConversations(userId, {
      accountId,
      limit,
      offset,
      unreadOnly
    });

    return NextResponse.json({
      conversations,
      count: conversations.length,
      limit,
      offset
    });

  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inbox/internal/conversations
 *
 * Create new internal conversation
 *
 * Body:
 * {
 *   accountId: string;
 *   creatorUserId: string;
 *   participantUserIds: string[];
 *   name?: string;
 *   metadata?: any;
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const {
      accountId,
      creatorUserId,
      participantUserIds,
      name,
      metadata
    } = await req.json();

    // Validate required fields
    if (!accountId || !creatorUserId || !participantUserIds) {
      return NextResponse.json(
        {
          error: 'Missing required fields: accountId, creatorUserId, participantUserIds'
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(participantUserIds) || participantUserIds.length === 0) {
      return NextResponse.json(
        { error: 'participantUserIds must be a non-empty array' },
        { status: 400 }
      );
    }

    const conversation = await createConversation(
      accountId,
      creatorUserId,
      participantUserIds,
      name,
      metadata
    );

    return NextResponse.json({
      success: true,
      conversation
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
