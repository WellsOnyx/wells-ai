import { NextRequest, NextResponse } from 'next/server';
import { AgentNotificationService } from '@/lib/agent-notifications';
import type { Notification, NotificationFilters } from '@/lib/agent-notifications-types';

/**
 * GET /api/notifications
 * Fetch notifications for an agent with optional filters
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const agentId = searchParams.get('agentId') || 'agent-001';
    const type = searchParams.get('type') || 'all';
    const status = searchParams.get('status') || 'all';
    const priority = searchParams.get('priority');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build filters
    const filters: NotificationFilters = {
      type: type as any,
      status: status as any,
    };

    if (priority) filters.priority = priority as any;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (search) filters.search = search;

    // Get notifications
    let notifications = AgentNotificationService.getNotifications(agentId, filters);

    // Apply pagination
    const total = notifications.length;
    notifications = notifications.slice(offset, offset + limit);

    // Get unread count
    const unreadCount = AgentNotificationService.getUnreadCount(agentId);

    return NextResponse.json({
      success: true,
      notifications,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      unreadCount,
    });
  } catch (error: any) {
    console.error('[NOTIFICATIONS API] GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 * Create a new notification
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { agentId, type, title, message, icon, actionUrl, priority, metadata } = body;

    // Validate required fields
    if (!agentId || !type || !title || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: agentId, type, title, message' },
        { status: 400 }
      );
    }

    // Create notification
    const notification = AgentNotificationService.createNotification({
      agentId,
      type,
      title,
      message,
      icon: icon || '🔔',
      actionUrl,
      priority: priority || 'normal',
      isRead: false,
      metadata,
    });

    // Show desktop notification if enabled
    AgentNotificationService.showDesktopNotification(notification);

    return NextResponse.json({
      success: true,
      notification,
    });
  } catch (error: any) {
    console.error('[NOTIFICATIONS API] POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 * Update notification (mark as read, snooze, etc.)
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { notificationId, action, agentId, minutes } = body;

    if (!notificationId && action !== 'markAllAsRead') {
      return NextResponse.json(
        { success: false, error: 'Missing notificationId' },
        { status: 400 }
      );
    }

    let result: any;

    switch (action) {
      case 'markAsRead':
        result = AgentNotificationService.markAsRead(notificationId);
        break;

      case 'markAllAsRead':
        if (!agentId) {
          return NextResponse.json(
            { success: false, error: 'Missing agentId for markAllAsRead' },
            { status: 400 }
          );
        }
        const count = AgentNotificationService.markAllAsRead(agentId);
        result = { count };
        break;

      case 'snooze':
        if (!minutes) {
          return NextResponse.json(
            { success: false, error: 'Missing minutes for snooze' },
            { status: 400 }
          );
        }
        result = AgentNotificationService.snoozeNotification(notificationId, minutes);
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('[NOTIFICATIONS API] PATCH error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications
 * Delete a notification
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const notificationId = searchParams.get('notificationId');

    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: 'Missing notificationId' },
        { status: 400 }
      );
    }

    const deleted = AgentNotificationService.deleteNotification(notificationId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Notification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      deleted: true,
    });
  } catch (error: any) {
    console.error('[NOTIFICATIONS API] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
