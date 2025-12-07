/**
 * POST /api/notifications/send
 *
 * Manual notification sending (admin only)
 * Useful for testing and one-off notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { notify, NotificationData } from '@/lib/notifications/service';

export async function POST(request: NextRequest) {
  try {
    // TODO: Add admin authentication
    // const { user } = await auth(request);
    // if (!user || !user.isAdmin) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const body = await request.json();

    const {
      type,
      userId,
      email,
      phone,
      channel = 'all',
      data,
      priority = 'normal',
    } = body;

    // Validate required fields
    if (!type) {
      return NextResponse.json(
        { error: 'type is required' },
        { status: 400 }
      );
    }

    if (!email && !phone) {
      return NextResponse.json(
        { error: 'email or phone is required' },
        { status: 400 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'data is required' },
        { status: 400 }
      );
    }

    // Send notification
    const notificationData: NotificationData = {
      type,
      userId,
      email,
      phone,
      channel,
      data,
      priority,
    };

    const result = await notify(notificationData);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send notification' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      notificationId: result.notificationId,
      emailSent: result.emailResult?.success || false,
      smsSent: result.smsResult?.success || false,
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notifications/send (docs)
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/notifications/send',
    method: 'POST',
    description: 'Send a notification manually (admin only)',
    body: {
      type: 'notification type (required)',
      userId: 'user ID (optional)',
      email: 'recipient email (required if no phone)',
      phone: 'recipient phone (required if no email)',
      channel: 'email | sms | all (default: all)',
      data: 'notification data object (required)',
      priority: 'low | normal | high | urgent (default: normal)',
    },
    example: {
      type: 'payment_received',
      email: 'user@example.com',
      phone: '+1234567890',
      channel: 'all',
      priority: 'high',
      data: {
        amount: 500,
        senderName: 'Acme Corp',
        claimUrl: 'https://wellsonyx.io/claim/pay_abc123',
        expiresAt: '2025-02-01T00:00:00Z',
      },
    },
  });
}
