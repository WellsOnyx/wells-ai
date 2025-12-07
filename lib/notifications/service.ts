/**
 * Unified Notification Service
 *
 * Smart routing for emails, SMS, and push notifications
 * Handles preferences, rate limiting, and delivery tracking
 */

import { createClient } from '@supabase/supabase-js';
import * as twilio from './twilio';
import * as resend from './resend';

// Types
export type NotificationType =
  | 'payment_received'
  | 'payment_claimed'
  | 'payment_reminder'
  | 'payment_expired'
  | 'credit_approved'
  | 'credit_used'
  | 'transaction_completed'
  | 'kyc_required'
  | 'kyc_approved'
  | 'partner_transaction'
  | 'system_alert'
  | 'welcome'
  | '2fa_code';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'all';

export interface NotificationPreferences {
  userId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  paymentNotifications: boolean;
  creditNotifications: boolean;
  marketingNotifications: boolean;
  quietHoursStart?: string; // HH:MM format
  quietHoursEnd?: string; // HH:MM format
}

export interface NotificationData {
  type: NotificationType;
  userId?: string;
  email?: string;
  phone?: string;
  channel?: NotificationChannel;
  data: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  scheduleAt?: Date;
}

export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  emailResult?: resend.EmailResult;
  smsResult?: twilio.SMSResult;
  error?: string;
}

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Rate limiting cache (in-memory for now, should use Redis in production)
const rateLimitCache = new Map<string, { count: number; resetAt: number }>();

/**
 * Get user notification preferences
 */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences | null> {
  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found
      console.error('Error fetching notification preferences:', error);
      return null;
    }

    if (!data) {
      // Return defaults if no preferences found
      return {
        userId,
        emailEnabled: true,
        smsEnabled: true,
        pushEnabled: true,
        paymentNotifications: true,
        creditNotifications: true,
        marketingNotifications: false,
      };
    }

    return {
      userId: data.user_id,
      emailEnabled: data.email_enabled,
      smsEnabled: data.sms_enabled,
      pushEnabled: data.push_enabled,
      paymentNotifications: data.payment_notifications,
      creditNotifications: data.credit_notifications,
      marketingNotifications: data.marketing_notifications,
      quietHoursStart: data.quiet_hours_start,
      quietHoursEnd: data.quiet_hours_end,
    };
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    return null;
  }
}

/**
 * Check if notification should be sent based on preferences and quiet hours
 */
function shouldSendNotification(
  type: NotificationType,
  preferences: NotificationPreferences | null,
  priority: string = 'normal'
): { email: boolean; sms: boolean } {
  // If no preferences, use defaults (send everything except marketing)
  if (!preferences) {
    return {
      email: type !== 'system_alert',
      sms: ['payment_received', 'payment_claimed', '2fa_code', 'credit_approved'].includes(type),
    };
  }

  // Check quiet hours (unless urgent)
  if (priority !== 'urgent' && preferences.quietHoursStart && preferences.quietHoursEnd) {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    if (currentTime >= preferences.quietHoursStart && currentTime <= preferences.quietHoursEnd) {
      return { email: false, sms: false }; // Respect quiet hours
    }
  }

  // Check type-specific preferences
  const isPaymentType = [
    'payment_received',
    'payment_claimed',
    'payment_reminder',
    'payment_expired',
  ].includes(type);

  const isCreditType = ['credit_approved', 'credit_used'].includes(type);

  if (isPaymentType && !preferences.paymentNotifications) {
    return { email: false, sms: false };
  }

  if (isCreditType && !preferences.creditNotifications) {
    return { email: false, sms: false };
  }

  // Check channel preferences
  return {
    email: preferences.emailEnabled,
    sms: preferences.smsEnabled,
  };
}

/**
 * Check rate limit for a user
 */
function checkRateLimit(userId: string, type: NotificationType): boolean {
  const key = `${userId}:${type}`;
  const now = Date.now();
  const limit = rateLimitCache.get(key);

  // Rate limit: max 10 notifications per type per hour
  const maxNotifications = 10;
  const windowMs = 60 * 60 * 1000; // 1 hour

  if (limit) {
    if (now < limit.resetAt) {
      if (limit.count >= maxNotifications) {
        console.warn(`Rate limit exceeded for ${key}`);
        return false;
      }
      limit.count += 1;
    } else {
      // Reset window
      rateLimitCache.set(key, { count: 1, resetAt: now + windowMs });
    }
  } else {
    rateLimitCache.set(key, { count: 1, resetAt: now + windowMs });
  }

  return true;
}

/**
 * Log notification to database
 */
async function logNotification(
  type: NotificationType,
  userId: string | undefined,
  email: string | undefined,
  phone: string | undefined,
  channel: NotificationChannel,
  status: 'sent' | 'failed',
  metadata?: Record<string, any>
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        type,
        user_id: userId,
        recipient_email: email,
        recipient_phone: phone,
        channel,
        status,
        metadata,
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;

    return data.id;
  } catch (error) {
    console.error('Error logging notification:', error);
    return null;
  }
}

/**
 * Update notification delivery status
 */
export async function updateNotificationStatus(
  notificationId: string,
  status: 'delivered' | 'failed' | 'bounced',
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await supabase
      .from('notifications')
      .update({
        status,
        delivered_at: status === 'delivered' ? new Date().toISOString() : null,
        metadata,
      })
      .eq('id', notificationId);
  } catch (error) {
    console.error('Error updating notification status:', error);
  }
}

/**
 * Send notification (main function)
 */
export async function notify(notificationData: NotificationData): Promise<NotificationResult> {
  const { type, userId, email, phone, channel = 'all', data, priority = 'normal' } = notificationData;

  try {
    // Get user preferences
    const preferences = userId ? await getNotificationPreferences(userId) : null;

    // Check if we should send
    const shouldSend = shouldSendNotification(type, preferences, priority);

    if (!shouldSend.email && !shouldSend.sms) {
      return {
        success: false,
        error: 'Notifications disabled by user preferences',
      };
    }

    // Check rate limit (only for non-urgent)
    if (priority !== 'urgent' && userId && !checkRateLimit(userId, type)) {
      return {
        success: false,
        error: 'Rate limit exceeded',
      };
    }

    let emailResult: resend.EmailResult | undefined;
    let smsResult: twilio.SMSResult | undefined;

    // Send email
    if ((channel === 'email' || channel === 'all') && shouldSend.email && email) {
      emailResult = await sendEmailNotification(type, email, data);
    }

    // Send SMS
    if ((channel === 'sms' || channel === 'all') && shouldSend.sms && phone) {
      smsResult = await sendSMSNotification(type, phone, data);
    }

    // Log to database
    const notificationId = await logNotification(
      type,
      userId,
      email,
      phone,
      channel,
      emailResult?.success || smsResult?.success ? 'sent' : 'failed',
      {
        emailId: emailResult?.emailId,
        smsId: smsResult?.messageId,
        ...data,
      }
    );

    return {
      success: emailResult?.success || smsResult?.success || false,
      notificationId: notificationId || undefined,
      emailResult,
      smsResult,
    };
  } catch (error) {
    console.error('Error sending notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send email notification based on type
 */
async function sendEmailNotification(
  type: NotificationType,
  email: string,
  data: Record<string, any>
): Promise<resend.EmailResult> {
  switch (type) {
    case 'payment_received':
      return resend.sendPaymentNotification({
        email,
        amount: data.amount,
        senderName: data.senderName,
        senderCompany: data.senderCompany,
        claimUrl: data.claimUrl,
        expiresAt: data.expiresAt,
        memo: data.memo,
      });

    case 'payment_claimed':
      return resend.sendClaimConfirmation({
        email,
        amount: data.amount,
        walletBalance: data.walletBalance,
        senderName: data.senderName,
      });

    case 'payment_reminder':
      return resend.sendPaymentReminder(
        email,
        data.amount,
        data.senderName,
        data.claimUrl,
        data.daysRemaining
      );

    case 'credit_approved':
      return resend.sendCreditApproval({
        email,
        name: data.name,
        amount: data.amount,
        apr: data.apr,
        availableCredit: data.availableCredit,
        transactionAmount: data.transactionAmount,
      });

    case 'welcome':
      return resend.sendWelcomeEmail(email, data.name);

    default:
      return resend.sendEmail(email, data.subject || 'Notification from Wells Onyx', data.html || data.message);
  }
}

/**
 * Send SMS notification based on type
 */
async function sendSMSNotification(
  type: NotificationType,
  phone: string,
  data: Record<string, any>
): Promise<twilio.SMSResult> {
  switch (type) {
    case 'payment_received':
      return twilio.sendPaymentNotification({
        phone,
        amount: data.amount,
        senderName: data.senderName,
        claimUrl: data.claimUrl,
        expiresIn: data.expiresIn,
      });

    case 'payment_claimed':
      return twilio.sendClaimConfirmation({
        phone,
        amount: data.amount,
        walletBalance: data.walletBalance,
      });

    case 'payment_reminder':
      return twilio.sendPaymentReminder(
        phone,
        data.amount,
        data.senderName,
        data.claimUrl,
        data.daysRemaining
      );

    case 'credit_approved':
      return twilio.sendCreditApproval({
        phone,
        amount: data.amount,
        apr: data.apr,
        availableCredit: data.availableCredit,
      });

    case '2fa_code':
      return twilio.send2FACode(phone, data.code);

    default:
      return twilio.sendSMS(phone, data.message);
  }
}

/**
 * Notify when payment is received
 */
export async function notifyPaymentReceived(
  recipientEmail: string | undefined,
  recipientPhone: string | undefined,
  amount: number,
  senderName: string,
  claimUrl: string,
  options?: {
    senderCompany?: string;
    memo?: string;
    expiresAt?: string;
    userId?: string;
  }
): Promise<NotificationResult> {
  return notify({
    type: 'payment_received',
    userId: options?.userId,
    email: recipientEmail,
    phone: recipientPhone,
    channel: 'all',
    priority: 'high',
    data: {
      amount,
      senderName,
      senderCompany: options?.senderCompany,
      claimUrl,
      expiresAt: options?.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      expiresIn: '30 days',
      memo: options?.memo,
    },
  });
}

/**
 * Notify when payment is claimed
 */
export async function notifyPaymentClaimed(
  senderEmail: string | undefined,
  senderPhone: string | undefined,
  amount: number,
  recipientName: string,
  options?: {
    userId?: string;
  }
): Promise<NotificationResult> {
  // Notify sender
  const senderNotification = notify({
    type: 'payment_claimed',
    userId: options?.userId,
    email: senderEmail,
    phone: senderPhone,
    channel: 'all',
    priority: 'normal',
    data: {
      amount,
      recipientName,
    },
  });

  return senderNotification;
}

/**
 * Notify partner about transaction
 */
export async function notifyPartnerTransaction(
  partnerId: string,
  amount: number,
  fees: number,
  metadata?: Record<string, any>
): Promise<NotificationResult> {
  // Get partner contact info
  const { data: partner } = await supabase
    .from('partners')
    .select('contact_email, contact_phone')
    .eq('id', partnerId)
    .single();

  if (!partner) {
    return {
      success: false,
      error: 'Partner not found',
    };
  }

  return notify({
    type: 'partner_transaction',
    userId: partnerId,
    email: partner.contact_email,
    phone: partner.contact_phone,
    channel: 'email',
    priority: 'low',
    data: {
      amount,
      fees,
      ...metadata,
    },
  });
}

/**
 * Send bulk notifications
 */
export async function sendBulkNotifications(
  notifications: NotificationData[],
  options?: {
    batchSize?: number;
    delayMs?: number;
  }
): Promise<NotificationResult[]> {
  const { batchSize = 50, delayMs = 1000 } = options || {};
  const results: NotificationResult[] = [];

  // Process in batches
  for (let i = 0; i < notifications.length; i += batchSize) {
    const batch = notifications.slice(i, i + batchSize);

    // Send batch in parallel
    const batchResults = await Promise.allSettled(batch.map((n) => notify(n)));

    // Collect results
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          success: false,
          error: result.reason?.message || 'Unknown error',
        });
      }
    });

    // Delay between batches (except for last batch)
    if (i + batchSize < notifications.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Schedule a notification for later
 */
export async function scheduleNotification(
  notification: NotificationData,
  scheduleAt: Date
): Promise<{ success: boolean; scheduleId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('scheduled_notifications')
      .insert({
        type: notification.type,
        user_id: notification.userId,
        recipient_email: notification.email,
        recipient_phone: notification.phone,
        channel: notification.channel,
        priority: notification.priority,
        data: notification.data,
        scheduled_at: scheduleAt.toISOString(),
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) throw error;

    return {
      success: true,
      scheduleId: data.id,
    };
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process scheduled notifications (run this on a cron)
 */
export async function processScheduledNotifications(): Promise<number> {
  try {
    // Get pending notifications that should be sent now
    const { data: notifications, error } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .limit(100);

    if (error) throw error;
    if (!notifications || notifications.length === 0) return 0;

    // Send notifications
    const results = await Promise.allSettled(
      notifications.map(async (n) => {
        const result = await notify({
          type: n.type,
          userId: n.user_id,
          email: n.recipient_email,
          phone: n.recipient_phone,
          channel: n.channel,
          priority: n.priority,
          data: n.data,
        });

        // Update scheduled notification status
        await supabase
          .from('scheduled_notifications')
          .update({
            status: result.success ? 'sent' : 'failed',
            sent_at: new Date().toISOString(),
            error: result.error,
          })
          .eq('id', n.id);

        return result;
      })
    );

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    console.log(`Processed ${notifications.length} scheduled notifications, ${successCount} successful`);

    return successCount;
  } catch (error) {
    console.error('Error processing scheduled notifications:', error);
    return 0;
  }
}
