/**
 * Notification Webhooks
 *
 * Handle delivery status updates from Twilio and Resend
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { updateNotificationStatus } from '@/lib/notifications/service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
);

/**
 * POST /api/webhooks/notifications
 *
 * Generic webhook handler that routes to appropriate service
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type');

    // Determine webhook source
    if (contentType?.includes('application/json')) {
      // Likely Resend webhook
      return handleResendWebhook(request);
    } else {
      // Likely Twilio webhook (form-urlencoded)
      return handleTwilioWebhook(request);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle Twilio SMS status webhooks
 */
async function handleTwilioWebhook(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();

    const messageSid = formData.get('MessageSid') as string;
    const messageStatus = formData.get('MessageStatus') as string;
    const errorCode = formData.get('ErrorCode') as string;
    const errorMessage = formData.get('ErrorMessage') as string;

    console.log('Twilio webhook received:', {
      messageSid,
      messageStatus,
      errorCode,
      errorMessage,
    });

    // Find notification by Twilio message SID
    const { data: notification } = await supabase
      .from('notifications')
      .select('id')
      .eq('metadata->>smsId', messageSid)
      .single();

    if (!notification) {
      console.warn('Notification not found for Twilio message:', messageSid);
      return NextResponse.json({ status: 'ok' });
    }

    // Map Twilio status to our status
    let status: 'delivered' | 'failed' | 'bounced' = 'delivered';

    switch (messageStatus) {
      case 'delivered':
        status = 'delivered';
        break;
      case 'failed':
      case 'undelivered':
        status = 'failed';
        break;
      case 'bounced':
        status = 'bounced';
        break;
      default:
        // For sent, queued, etc., don't update yet
        return NextResponse.json({ status: 'ok' });
    }

    // Update notification status
    await updateNotificationStatus(notification.id, status, {
      twilioStatus: messageStatus,
      errorCode: errorCode || undefined,
      errorMessage: errorMessage || undefined,
      updatedAt: new Date().toISOString(),
    });

    console.log(`Updated notification ${notification.id} status to ${status}`);

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Error handling Twilio webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

/**
 * Handle Resend email status webhooks
 */
async function handleResendWebhook(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    console.log('Resend webhook received:', body);

    const { type, data } = body;

    // Verify webhook signature (in production)
    // const signature = request.headers.get('svix-signature');
    // if (!verifyResendSignature(signature, body)) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    // }

    // Find notification by Resend email ID
    const { data: notification } = await supabase
      .from('notifications')
      .select('id')
      .eq('metadata->>emailId', data.email_id)
      .single();

    if (!notification) {
      console.warn('Notification not found for Resend email:', data.email_id);
      return NextResponse.json({ status: 'ok' });
    }

    // Map Resend event to our status
    let status: 'delivered' | 'failed' | 'bounced' | null = null;

    switch (type) {
      case 'email.delivered':
        status = 'delivered';
        break;
      case 'email.bounced':
        status = 'bounced';
        break;
      case 'email.complained':
        status = 'bounced'; // Treat complaints as bounces
        break;
      case 'email.delivery_delayed':
        // Don't update status for delays
        break;
      case 'email.opened':
      case 'email.clicked':
        // Track engagement but don't change status
        await trackEmailEngagement(notification.id, type, data);
        break;
      default:
        console.log('Unhandled Resend event type:', type);
    }

    if (status) {
      // Update notification status
      await updateNotificationStatus(notification.id, status, {
        resendEvent: type,
        resendData: data,
        updatedAt: new Date().toISOString(),
      });

      console.log(`Updated notification ${notification.id} status to ${status}`);
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Error handling Resend webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

/**
 * Track email engagement (opens, clicks)
 */
async function trackEmailEngagement(
  notificationId: string,
  eventType: string,
  eventData: any
): Promise<void> {
  try {
    await supabase.from('notification_engagement').insert({
      notification_id: notificationId,
      event_type: eventType,
      event_data: eventData,
      created_at: new Date().toISOString(),
    });

    console.log(`Tracked email engagement: ${eventType} for ${notificationId}`);
  } catch (error) {
    console.error('Error tracking email engagement:', error);
  }
}

/**
 * GET /api/webhooks/notifications (for testing)
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Notification webhooks endpoint',
    endpoints: {
      twilio: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/notifications`,
      resend: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/notifications`,
    },
  });
}
