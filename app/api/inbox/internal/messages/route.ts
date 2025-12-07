import { NextRequest, NextResponse } from 'next/server';
import {
  getMessages,
  sendMessage
} from '@/lib/inbox/providers/wells-internal';

/**
 * GET /api/inbox/internal/messages
 *
 * Get messages in a conversation
 *
 * Query params:
 * - conversationId: string (required)
 * - userId: string (required)
 * - limit: number (default: 100)
 * - offset: number (default: 0)
 * - since: string (ISO timestamp, optional)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const since = searchParams.get('since') || undefined;

    if (!conversationId || !userId) {
      return NextResponse.json(
        { error: 'conversationId and userId are required' },
        { status: 400 }
      );
    }

    const messages = await getMessages(conversationId, userId, {
      limit,
      offset,
      since
    });

    return NextResponse.json({
      messages,
      count: messages.length,
      limit,
      offset
    });

  } catch (error: any) {
    console.error('Error fetching messages:', error);

    if (error.message.includes('not found') || error.message.includes('not a participant')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inbox/internal/messages
 *
 * Send a message in a conversation
 *
 * Body:
 * {
 *   fromUserId: string;
 *   conversationId: string;
 *   content: string;
 *   messageType?: 'text' | 'deal' | 'proposal' | 'task' | 'file' | 'system';
 *   metadata?: any;
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const {
      fromUserId,
      conversationId,
      content,
      messageType = 'text',
      metadata
    } = await req.json();

    // Validate required fields
    if (!fromUserId || !conversationId || !content) {
      return NextResponse.json(
        {
          error: 'Missing required fields: fromUserId, conversationId, content'
        },
        { status: 400 }
      );
    }

    // Validate message type
    const validTypes = ['text', 'deal', 'proposal', 'task', 'file', 'system'];
    if (!validTypes.includes(messageType)) {
      return NextResponse.json(
        {
          error: `Invalid messageType. Must be one of: ${validTypes.join(', ')}`
        },
        { status: 400 }
      );
    }

    const message = await sendMessage(
      fromUserId,
      conversationId,
      content,
      messageType,
      metadata
    );

    return NextResponse.json({
      success: true,
      message
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error sending message:', error);

    if (error.message.includes('not found') || error.message.includes('not a participant')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
