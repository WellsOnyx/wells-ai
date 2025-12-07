/**
 * GET /api/notifications/history
 *
 * Get notification history for a user
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getNotificationHistory,
  getNotificationStats,
} from '@/lib/notifications/preferences';

/**
 * GET /api/notifications/history
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Get userId from auth
    // const { user } = await auth(request);
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const userId = request.nextUrl.searchParams.get('userId');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0');
    const includeStats = request.nextUrl.searchParams.get('stats') === 'true';

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const { notifications, total } = await getNotificationHistory(
      userId,
      limit,
      offset
    );

    const response: any = {
      success: true,
      notifications,
      total,
      limit,
      offset,
    };

    if (includeStats) {
      const stats = await getNotificationStats(userId, 30);
      response.stats = stats;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error getting notification history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
