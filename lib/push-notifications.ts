/**
 * Push Notification Service for iOS (via Expo)
 *
 * Send push notifications to iOS devices using Expo Push Notification service.
 * This replaces SMS for iOS users.
 */

import { createNotionClient } from './notion';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: {
    type?: 'deal_update' | 'message' | 'rfq_match' | 'approval_needed' | 'payment_received';
    dealId?: string;
    rfqId?: string;
    messageId?: string;
    url?: string;
    [key: string]: any;
  };
  badge?: number;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
}

/**
 * Send push notification to a user
 *
 * @param userId - Clerk user ID
 * @param payload - Notification content
 * @returns Success status
 */
export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<boolean> {
  try {
    // Get user's push token from Notion
    const pushToken = await getPushToken(userId);

    if (!pushToken) {
      console.log('[PUSH] No push token found for user:', userId);
      return false;
    }

    // Send via Expo Push Notification API
    const message = {
      to: pushToken,
      sound: payload.sound || 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      badge: payload.badge,
      priority: payload.priority || 'high',
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[PUSH] Send failed:', error);
      return false;
    }

    const result = await response.json();
    console.log('[PUSH] Sent successfully:', result);
    return true;

  } catch (error) {
    console.error('[PUSH] Error sending notification:', error);
    return false;
  }
}

/**
 * Send push notification to multiple users
 */
export async function sendBulkPushNotifications(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  const results = await Promise.allSettled(
    userIds.map(userId => sendPushNotification(userId, payload))
  );

  const sent = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  const failed = results.length - sent;

  return { sent, failed };
}

/**
 * Get push token for a user from Notion
 */
async function getPushToken(userId: string): Promise<string | null> {
  const pushTokensDbId = process.env.NOTION_PUSH_TOKENS_DATABASE_ID;

  if (!pushTokensDbId) {
    return null;
  }

  try {
    const notion = createNotionClient();

    // @ts-ignore - Notion SDK types
    const tokens = await notion.databases.query({
      database_id: pushTokensDbId,
      filter: {
        and: [
          {
            property: 'User ID',
            rich_text: {
              equals: userId,
            },
          },
          {
            property: 'Active',
            checkbox: {
              equals: true,
            },
          },
        ],
      },
      page_size: 1,
    });

    if (tokens.results.length === 0) {
      return null;
    }

    const token = tokens.results[0] as any;
    const pushToken = token.properties['Push Token']?.rich_text?.[0]?.text?.content;

    return pushToken || null;

  } catch (error) {
    console.error('[PUSH] Error getting push token:', error);
    return null;
  }
}

/**
 * Check if user has push notifications enabled (iOS app installed)
 */
export async function hasPushNotifications(userId: string): Promise<boolean> {
  const token = await getPushToken(userId);
  return token !== null;
}

/**
 * Helper functions for common notification types
 */

export async function notifyDealUpdate(
  userId: string,
  dealId: string,
  dealTitle: string,
  status: string
): Promise<boolean> {
  return await sendPushNotification(userId, {
    title: 'Deal Updated',
    body: `${dealTitle} - ${status}`,
    data: {
      type: 'deal_update',
      dealId,
      url: `https://wellsai.vercel.app/deals/${dealId}`,
    },
  });
}

export async function notifyRFQMatch(
  userId: string,
  rfqId: string,
  supplierName: string,
  matchCount: number
): Promise<boolean> {
  return await sendPushNotification(userId, {
    title: 'Supplier Match Found',
    body: `${matchCount} suppliers matched for your RFQ`,
    data: {
      type: 'rfq_match',
      rfqId,
      url: `https://wellsai.vercel.app/quotes/${rfqId}`,
    },
  });
}

export async function notifyApprovalNeeded(
  userId: string,
  itemType: string,
  itemTitle: string,
  itemId: string
): Promise<boolean> {
  return await sendPushNotification(userId, {
    title: 'Approval Needed',
    body: `${itemTitle} requires your approval`,
    data: {
      type: 'approval_needed',
      itemType,
      itemId,
      url: `https://wellsai.vercel.app/${itemType}/${itemId}`,
    },
    priority: 'high',
  });
}

export async function notifyMessage(
  userId: string,
  fromName: string,
  messagePreview: string,
  conversationId: string
): Promise<boolean> {
  return await sendPushNotification(userId, {
    title: fromName,
    body: messagePreview,
    data: {
      type: 'message',
      messageId: conversationId,
      url: `https://wellsai.vercel.app/conversations/${conversationId}`,
    },
  });
}

export async function notifyPaymentReceived(
  userId: string,
  amount: string,
  dealTitle: string,
  dealId: string
): Promise<boolean> {
  return await sendPushNotification(userId, {
    title: 'Payment Received',
    body: `${amount} received for ${dealTitle}`,
    data: {
      type: 'payment_received',
      dealId,
      url: `https://wellsai.vercel.app/deals/${dealId}`,
    },
  });
}
