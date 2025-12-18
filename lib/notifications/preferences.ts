/**
 * Notification Preferences
 *
 * Manage user notification settings and opt-outs
 */

import { createClient } from '@supabase/supabase-js';

export interface NotificationPreferences {
  userId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  paymentNotifications: boolean;
  creditNotifications: boolean;
  marketingNotifications: boolean;
  transactionAlerts: boolean;
  securityAlerts: boolean;
  partnerUpdates: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart?: string; // HH:MM format
  quietHoursEnd?: string; // HH:MM format
  timezone?: string;
  updatedAt?: string;
}

export interface UpdatePreferencesInput {
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
  paymentNotifications?: boolean;
  creditNotifications?: boolean;
  marketingNotifications?: boolean;
  transactionAlerts?: boolean;
  securityAlerts?: boolean;
  partnerUpdates?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
}

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
);

/**
 * Get default notification preferences
 */
export function getDefaultPreferences(userId: string): NotificationPreferences {
  return {
    userId,
    emailEnabled: true,
    smsEnabled: true,
    pushEnabled: true,
    paymentNotifications: true,
    creditNotifications: true,
    marketingNotifications: false, // Opt-in for marketing
    transactionAlerts: true,
    securityAlerts: true, // Always enabled by default
    partnerUpdates: false,
    quietHoursEnabled: false,
    timezone: 'America/New_York',
  };
}

/**
 * Get user notification preferences
 */
export async function getPreferences(
  userId: string
): Promise<NotificationPreferences> {
  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found
      console.error('Error fetching preferences:', error);
      return getDefaultPreferences(userId);
    }

    if (!data) {
      // Create default preferences
      const defaults = getDefaultPreferences(userId);
      await createPreferences(userId, defaults);
      return defaults;
    }

    return {
      userId: data.user_id,
      emailEnabled: data.email_enabled,
      smsEnabled: data.sms_enabled,
      pushEnabled: data.push_enabled,
      paymentNotifications: data.payment_notifications,
      creditNotifications: data.credit_notifications,
      marketingNotifications: data.marketing_notifications,
      transactionAlerts: data.transaction_alerts,
      securityAlerts: data.security_alerts,
      partnerUpdates: data.partner_updates,
      quietHoursEnabled: data.quiet_hours_enabled,
      quietHoursStart: data.quiet_hours_start,
      quietHoursEnd: data.quiet_hours_end,
      timezone: data.timezone,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error getting preferences:', error);
    return getDefaultPreferences(userId);
  }
}

/**
 * Create notification preferences for a new user
 */
export async function createPreferences(
  userId: string,
  preferences?: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const defaults = getDefaultPreferences(userId);
  const prefs = { ...defaults, ...preferences };

  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .insert({
        user_id: userId,
        email_enabled: prefs.emailEnabled,
        sms_enabled: prefs.smsEnabled,
        push_enabled: prefs.pushEnabled,
        payment_notifications: prefs.paymentNotifications,
        credit_notifications: prefs.creditNotifications,
        marketing_notifications: prefs.marketingNotifications,
        transaction_alerts: prefs.transactionAlerts,
        security_alerts: prefs.securityAlerts,
        partner_updates: prefs.partnerUpdates,
        quiet_hours_enabled: prefs.quietHoursEnabled,
        quiet_hours_start: prefs.quietHoursStart,
        quiet_hours_end: prefs.quietHoursEnd,
        timezone: prefs.timezone,
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`Created notification preferences for user ${userId}`);

    return prefs;
  } catch (error) {
    console.error('Error creating preferences:', error);
    return prefs;
  }
}

/**
 * Update notification preferences
 */
export async function updatePreferences(
  userId: string,
  updates: UpdatePreferencesInput
): Promise<NotificationPreferences> {
  try {
    // First, ensure preferences exist
    await getPreferences(userId);

    const { data, error } = await supabase
      .from('notification_preferences')
      .update({
        email_enabled: updates.emailEnabled,
        sms_enabled: updates.smsEnabled,
        push_enabled: updates.pushEnabled,
        payment_notifications: updates.paymentNotifications,
        credit_notifications: updates.creditNotifications,
        marketing_notifications: updates.marketingNotifications,
        transaction_alerts: updates.transactionAlerts,
        security_alerts: updates.securityAlerts,
        partner_updates: updates.partnerUpdates,
        quiet_hours_enabled: updates.quietHoursEnabled,
        quiet_hours_start: updates.quietHoursStart,
        quiet_hours_end: updates.quietHoursEnd,
        timezone: updates.timezone,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    console.log(`Updated notification preferences for user ${userId}`);

    return getPreferences(userId);
  } catch (error) {
    console.error('Error updating preferences:', error);
    throw error;
  }
}

/**
 * Opt out of all notifications (except security alerts)
 */
export async function optOutAll(userId: string): Promise<void> {
  await updatePreferences(userId, {
    emailEnabled: false,
    smsEnabled: false,
    pushEnabled: false,
    paymentNotifications: false,
    creditNotifications: false,
    marketingNotifications: false,
    transactionAlerts: false,
    partnerUpdates: false,
    securityAlerts: true, // Keep security alerts enabled
  });

  console.log(`User ${userId} opted out of all notifications`);
}

/**
 * Opt out of marketing notifications only
 */
export async function optOutMarketing(userId: string): Promise<void> {
  await updatePreferences(userId, {
    marketingNotifications: false,
    partnerUpdates: false,
  });

  console.log(`User ${userId} opted out of marketing notifications`);
}

/**
 * Enable quiet hours
 */
export async function setQuietHours(
  userId: string,
  start: string,
  end: string,
  timezone?: string
): Promise<void> {
  // Validate time format (HH:MM)
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

  if (!timeRegex.test(start) || !timeRegex.test(end)) {
    throw new Error('Invalid time format. Use HH:MM (e.g., 22:00)');
  }

  await updatePreferences(userId, {
    quietHoursEnabled: true,
    quietHoursStart: start,
    quietHoursEnd: end,
    timezone: timezone || 'America/New_York',
  });

  console.log(`Set quiet hours for user ${userId}: ${start} - ${end}`);
}

/**
 * Disable quiet hours
 */
export async function disableQuietHours(userId: string): Promise<void> {
  await updatePreferences(userId, {
    quietHoursEnabled: false,
  });

  console.log(`Disabled quiet hours for user ${userId}`);
}

/**
 * Check if user has opted out of a specific notification type
 */
export async function hasOptedOut(
  userId: string,
  notificationType: 'payment' | 'credit' | 'marketing' | 'transaction' | 'security' | 'partner'
): Promise<boolean> {
  const prefs = await getPreferences(userId);

  switch (notificationType) {
    case 'payment':
      return !prefs.paymentNotifications;
    case 'credit':
      return !prefs.creditNotifications;
    case 'marketing':
      return !prefs.marketingNotifications;
    case 'transaction':
      return !prefs.transactionAlerts;
    case 'security':
      return !prefs.securityAlerts;
    case 'partner':
      return !prefs.partnerUpdates;
    default:
      return false;
  }
}

/**
 * Check if we should send notification now (respects quiet hours)
 */
export async function shouldSendNow(
  userId: string,
  priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'
): Promise<boolean> {
  // Always send urgent notifications
  if (priority === 'urgent') {
    return true;
  }

  const prefs = await getPreferences(userId);

  // Check if quiet hours are enabled
  if (!prefs.quietHoursEnabled || !prefs.quietHoursStart || !prefs.quietHoursEnd) {
    return true;
  }

  // Get current time in user's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: prefs.timezone || 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const currentTime = formatter.format(now);

  // Check if current time is within quiet hours
  const isQuietTime = currentTime >= prefs.quietHoursStart && currentTime <= prefs.quietHoursEnd;

  return !isQuietTime;
}

/**
 * Get unsubscribe token for user (for one-click unsubscribe links)
 */
export async function getUnsubscribeToken(userId: string): Promise<string> {
  // In production, this should be a signed JWT or encrypted token
  // For now, we'll use a simple base64 encoding
  const token = Buffer.from(`${userId}:${Date.now()}`).toString('base64');

  // Store token in database for verification
  await supabase.from('unsubscribe_tokens').insert({
    user_id: userId,
    token,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
  });

  return token;
}

/**
 * Process unsubscribe request
 */
export async function processUnsubscribe(
  token: string,
  type: 'all' | 'marketing' = 'all'
): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    // Verify token
    const { data: tokenData, error: tokenError } = await supabase
      .from('unsubscribe_tokens')
      .select('user_id, expires_at')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      return {
        success: false,
        error: 'Invalid or expired unsubscribe link',
      };
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return {
        success: false,
        error: 'Unsubscribe link has expired',
      };
    }

    // Opt out based on type
    if (type === 'all') {
      await optOutAll(tokenData.user_id);
    } else {
      await optOutMarketing(tokenData.user_id);
    }

    // Mark token as used
    await supabase
      .from('unsubscribe_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    return {
      success: true,
      userId: tokenData.user_id,
    };
  } catch (error) {
    console.error('Error processing unsubscribe:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get notification history for a user
 */
export async function getNotificationHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{
  notifications: any[];
  total: number;
}> {
  try {
    // Get total count
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get notifications
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      notifications: notifications || [],
      total: count || 0,
    };
  } catch (error) {
    console.error('Error getting notification history:', error);
    return {
      notifications: [],
      total: 0,
    };
  }
}

/**
 * Get notification stats for a user
 */
export async function getNotificationStats(
  userId: string,
  days: number = 30
): Promise<{
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  byType: Record<string, number>;
  byChannel: Record<string, number>;
}> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('type, channel, status')
      .eq('user_id', userId)
      .gte('sent_at', since.toISOString());

    if (error) throw error;

    const stats = {
      total: notifications?.length || 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      byType: {} as Record<string, number>,
      byChannel: {} as Record<string, number>,
    };

    notifications?.forEach((n) => {
      // Count by status
      if (n.status === 'sent') stats.sent++;
      if (n.status === 'delivered') stats.delivered++;
      if (n.status === 'failed') stats.failed++;

      // Count by type
      stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;

      // Count by channel
      stats.byChannel[n.channel] = (stats.byChannel[n.channel] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('Error getting notification stats:', error);
    return {
      total: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      byType: {},
      byChannel: {},
    };
  }
}
