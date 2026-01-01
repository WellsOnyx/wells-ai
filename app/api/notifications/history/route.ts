/**
 * GET /api/notifications/history
 *
 * Get notification history for the authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getNotificationHistory,
  getNotificationStats,
} from '@/lib/notifications/preferences';

/**
 * GET /api/notifications/history
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0');
    const includeStats = request.nextUrl.searchParams.get('stats') === 'true';

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
