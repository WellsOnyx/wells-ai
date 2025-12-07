import { NextRequest, NextResponse } from 'next/server';
import { inboxService } from '@/lib/inbox/inbox-service';
import { InboxProvider, AICategory, AIPriority } from '@/lib/inbox/types';

/**
 * GET /api/inbox/threads
 *
 * List all threads across all providers with filtering
 *
 * Query params:
 * - userId: string (required)
 * - accountId: string (optional)
 * - provider: string (optional) - gmail, linkedin, x, instagram, sms, imessage, wells
 * - labels: string (optional) - comma-separated
 * - isRead: boolean (optional)
 * - isStarred: boolean (optional)
 * - aiCategory: string (optional) - deals, recruiting, support, newsletter, etc.
 * - aiPriority: string (optional) - urgent, important, normal, low
 * - search: string (optional)
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const accountId = searchParams.get('accountId') || undefined;
    const provider = searchParams.get('provider') as InboxProvider | undefined;
    const labelsParam = searchParams.get('labels');
    const labels = labelsParam ? labelsParam.split(',') : undefined;
    const isReadParam = searchParams.get('isRead');
    const isRead = isReadParam ? isReadParam === 'true' : undefined;
    const isStarredParam = searchParams.get('isStarred');
    const isStarred = isStarredParam ? isStarredParam === 'true' : undefined;
    const aiCategory = searchParams.get('aiCategory') as AICategory | undefined;
    const aiPriority = searchParams.get('aiPriority') as AIPriority | undefined;
    const search = searchParams.get('search') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await inboxService.getThreads({
      userId,
      accountId,
      provider,
      labels,
      isRead,
      isStarred,
      aiCategory,
      aiPriority,
      search,
      limit,
      offset,
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error in GET /api/inbox/threads:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/inbox/threads
 *
 * Bulk update threads (mark read/unread, star, archive, etc.)
 *
 * Body:
 * {
 *   userId: string;
 *   threadIds: string[];
 *   action: 'markRead' | 'markUnread' | 'star' | 'unstar' | 'archive' | 'trash' | 'restore';
 * }
 */
export async function PATCH(req: NextRequest) {
  try {
    const { userId, threadIds, action } = await req.json();

    if (!userId || !threadIds || !action) {
      return NextResponse.json(
        { error: 'userId, threadIds, and action are required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(threadIds) || threadIds.length === 0) {
      return NextResponse.json(
        { error: 'threadIds must be a non-empty array' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'markRead':
        await inboxService.markAsRead({ threadIds, userId, isRead: true });
        break;
      case 'markUnread':
        await inboxService.markAsRead({ threadIds, userId, isRead: false });
        break;
      case 'star':
        await inboxService.starThreads({ threadIds, userId, isStarred: true });
        break;
      case 'unstar':
        await inboxService.starThreads({ threadIds, userId, isStarred: false });
        break;
      case 'archive':
        await inboxService.archiveThreads({ threadIds, userId });
        break;
      case 'trash':
        await inboxService.trashThreads(threadIds, userId);
        break;
      case 'restore':
        await inboxService.restoreThreads(threadIds, userId);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      count: threadIds.length,
    });

  } catch (error: any) {
    console.error('Error in PATCH /api/inbox/threads:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
