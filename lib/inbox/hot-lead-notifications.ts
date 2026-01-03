/**
 * Hot Lead Notification Service
 *
 * Real-time notifications when hot leads reply to campaigns.
 * Supports SMS, Slack, Email, and Push notifications.
 */

import { sql } from '@vercel/postgres';
import { sendSMS, SMSResult } from '../notifications/twilio';
import { sendEmail, EmailResult } from '../notifications/resend';
import { ReplyAnalysis, Sentiment, ReplyIntent } from './reply-analyzer';

// =====================================================
// TYPES
// =====================================================

export type NotificationChannel = 'sms' | 'slack' | 'email' | 'push';

export interface NotificationSettings {
  userId: string;
  notificationsEnabled: boolean;

  smsEnabled: boolean;
  smsPhone?: string;

  slackEnabled: boolean;
  slackWebhookUrl?: string;
  slackChannel?: string;

  emailEnabled: boolean;
  notificationEmail?: string;

  pushEnabled: boolean;
  pushToken?: string;

  alertOnAllReplies: boolean;
  alertOnPositiveOnly: boolean;
  alertOnMeetingRequests: boolean;
  alertOnQuestions: boolean;
  minLeadScoreForAlert: number;

  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  quietHoursTimezone: string;

  maxAlertsPerHour: number;
  digestMode: boolean;
  digestFrequency: 'hourly' | 'daily';
}

export interface ReplyNotification {
  matchId: string;
  userId: string;
  campaignId?: string;
  campaignName?: string;
  variantName?: string;

  // Contact info
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactCompany?: string;
  contactTitle?: string;

  // Reply details
  replyChannel: string;
  replyPreview: string;
  replyReceivedAt: Date;

  // Analysis
  sentiment: Sentiment;
  intent: ReplyIntent;
  leadScore: number;
  isHotLead: boolean;
  suggestedResponse?: string;
  keyPhrases?: string[];
}

export interface NotificationResult {
  channel: NotificationChannel;
  success: boolean;
  messageId?: string;
  error?: string;
}

// =====================================================
// HOT LEAD NOTIFICATION SERVICE
// =====================================================

export class HotLeadNotificationService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wellsonyx.io';
  }

  /**
   * Send notifications for a hot lead reply
   */
  async notifyHotLead(
    notification: ReplyNotification,
    settings: NotificationSettings
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    // Check if notifications are enabled
    if (!settings.notificationsEnabled) {
      return results;
    }

    // Check quiet hours
    if (settings.quietHoursEnabled && this.isQuietHours(settings)) {
      // Queue for later or skip based on urgency
      if (!notification.isHotLead) {
        return results;
      }
    }

    // Check rate limiting
    const canSend = await this.checkRateLimit(settings.userId, settings.maxAlertsPerHour);
    if (!canSend) {
      console.log(`[HotLeadNotifications] Rate limit exceeded for user ${settings.userId}`);
      return results;
    }

    // Check if we should send based on settings
    if (!this.shouldNotify(notification, settings)) {
      return results;
    }

    // Send to enabled channels
    const sendPromises: Promise<NotificationResult>[] = [];

    if (settings.smsEnabled && settings.smsPhone) {
      sendPromises.push(this.sendSmsNotification(notification, settings.smsPhone));
    }

    if (settings.slackEnabled && settings.slackWebhookUrl) {
      sendPromises.push(
        this.sendSlackNotification(notification, settings.slackWebhookUrl, settings.slackChannel)
      );
    }

    if (settings.emailEnabled && settings.notificationEmail) {
      sendPromises.push(this.sendEmailNotification(notification, settings.notificationEmail));
    }

    // Wait for all notifications
    const notificationResults = await Promise.allSettled(sendPromises);

    for (const result of notificationResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          channel: 'sms',
          success: false,
          error: result.reason?.message || 'Unknown error',
        });
      }
    }

    // Log notifications
    await this.logNotifications(notification.matchId, settings.userId, results);

    // Update match status
    await this.markAsNotified(notification.matchId, results.map(r => r.channel));

    return results;
  }

  /**
   * Send SMS notification
   */
  private async sendSmsNotification(
    notification: ReplyNotification,
    phone: string
  ): Promise<NotificationResult> {
    const emoji = this.getSentimentEmoji(notification.sentiment, notification.intent);
    const intentLabel = this.getIntentLabel(notification.intent);

    const message = `${emoji} Hot Lead Alert!

${notification.contactName || 'Someone'}${notification.contactTitle ? ` (${notification.contactTitle})` : ''}${notification.contactCompany ? ` at ${notification.contactCompany}` : ''} replied to your ${notification.campaignName || 'campaign'}:

"${notification.replyPreview.slice(0, 120)}${notification.replyPreview.length > 120 ? '...' : ''}"

Intent: ${intentLabel}
Lead Score: ${notification.leadScore}/100

View: ${this.baseUrl}/inbox/replies/${notification.matchId}`;

    try {
      const result = await sendSMS(phone, message);
      return {
        channel: 'sms',
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      };
    } catch (error) {
      return {
        channel: 'sms',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(
    notification: ReplyNotification,
    webhookUrl: string,
    channel?: string
  ): Promise<NotificationResult> {
    const emoji = this.getSentimentEmoji(notification.sentiment, notification.intent);
    const intentLabel = this.getIntentLabel(notification.intent);
    const sentimentColor = this.getSentimentColor(notification.sentiment);

    const payload = {
      channel: channel,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} Hot Lead Alert!`,
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Contact:*\n${notification.contactName || 'Unknown'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Company:*\n${notification.contactCompany || 'N/A'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Title:*\n${notification.contactTitle || 'N/A'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Lead Score:*\n${notification.leadScore}/100`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Reply (via ${notification.replyChannel}):*\n>${notification.replyPreview.slice(0, 300).replace(/\n/g, '\n>')}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `*Intent:* ${intentLabel} | *Sentiment:* ${notification.sentiment} | *Campaign:* ${notification.campaignName || 'N/A'}`,
            },
          ],
        },
      ],
      attachments: [
        {
          color: sentimentColor,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: notification.suggestedResponse
                  ? `*Suggested Response:*\n${notification.suggestedResponse}`
                  : '_No suggested response available_',
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'View Reply',
                    emoji: true,
                  },
                  url: `${this.baseUrl}/inbox/replies/${notification.matchId}`,
                  style: 'primary',
                },
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'View Campaign',
                    emoji: true,
                  },
                  url: `${this.baseUrl}/campaigns/${notification.campaignId}`,
                },
              ],
            },
          ],
        },
      ],
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return { channel: 'slack', success: true };
      } else {
        const errorText = await response.text();
        return { channel: 'slack', success: false, error: errorText };
      }
    } catch (error) {
      return {
        channel: 'slack',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    notification: ReplyNotification,
    email: string
  ): Promise<NotificationResult> {
    const emoji = this.getSentimentEmoji(notification.sentiment, notification.intent);
    const intentLabel = this.getIntentLabel(notification.intent);
    const sentimentColor = this.getSentimentColor(notification.sentiment);

    const subject = `${emoji} Hot Lead: ${notification.contactName || 'Someone'} replied to your campaign`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 10px;">${emoji}</div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Hot Lead Alert!</h1>
      <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">
        New reply to ${notification.campaignName || 'your campaign'}
      </p>
    </div>

    <!-- Contact Info -->
    <div style="background: white; padding: 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <div style="display: flex; gap: 20px; margin-bottom: 25px;">
        <div style="flex: 1;">
          <div style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Contact</div>
          <div style="font-size: 18px; font-weight: 600; color: #111827;">${notification.contactName || 'Unknown'}</div>
          ${notification.contactTitle ? `<div style="color: #6b7280; font-size: 14px;">${notification.contactTitle}</div>` : ''}
        </div>
        <div style="flex: 1;">
          <div style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Company</div>
          <div style="font-size: 18px; font-weight: 600; color: #111827;">${notification.contactCompany || 'N/A'}</div>
        </div>
      </div>

      <!-- Lead Score -->
      <div style="background: #f0fdf4; border: 2px solid ${sentimentColor}; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="color: #166534; font-size: 14px; font-weight: 600;">Lead Score</div>
            <div style="font-size: 36px; font-weight: 700; color: #166534;">${notification.leadScore}/100</div>
          </div>
          <div style="text-align: right;">
            <div style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Intent</div>
            <div style="font-size: 16px; font-weight: 600; color: #111827;">${intentLabel}</div>
            <div style="color: #6b7280; font-size: 12px; text-transform: uppercase; margin-top: 8px;">Sentiment</div>
            <div style="font-size: 16px; font-weight: 600; color: #111827;">${notification.sentiment}</div>
          </div>
        </div>
      </div>

      <!-- Reply Content -->
      <div style="margin-bottom: 25px;">
        <div style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">
          Their Reply (via ${notification.replyChannel})
        </div>
        <div style="background: #f9fafb; border-left: 4px solid ${sentimentColor}; padding: 20px; border-radius: 4px;">
          <div style="color: #374151; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">
${notification.replyPreview}
          </div>
        </div>
      </div>

      ${notification.suggestedResponse ? `
      <!-- Suggested Response -->
      <div style="margin-bottom: 25px;">
        <div style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">
          Suggested Response
        </div>
        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 4px;">
          <div style="color: #1e40af; font-size: 15px; line-height: 1.6;">
            ${notification.suggestedResponse}
          </div>
        </div>
      </div>
      ` : ''}

      <!-- CTA -->
      <div style="text-align: center; margin-top: 30px;">
        <a href="${this.baseUrl}/inbox/replies/${notification.matchId}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
          View Full Reply
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: white; padding: 20px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 0 0 12px 12px; text-align: center;">
      <div style="color: #6b7280; font-size: 13px;">
        Reply received ${notification.replyReceivedAt.toLocaleString()}
      </div>
      <div style="margin-top: 15px; color: #9ca3af; font-size: 12px;">
        <a href="${this.baseUrl}/settings/notifications" style="color: #667eea; text-decoration: none;">Manage notification settings</a>
      </div>
    </div>

  </div>
</body>
</html>
    `;

    try {
      const result = await sendEmail(email, subject, html);
      return {
        channel: 'email',
        success: result.success,
        messageId: result.emailId,
        error: result.error,
      };
    } catch (error) {
      return {
        channel: 'email',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get notification settings for a user
   */
  async getSettings(userId: string): Promise<NotificationSettings | null> {
    const result = await sql`
      SELECT
        user_id,
        notifications_enabled,
        sms_enabled,
        sms_phone,
        slack_enabled,
        slack_webhook_url,
        slack_channel,
        email_enabled,
        notification_email,
        push_enabled,
        push_token,
        alert_on_all_replies,
        alert_on_positive_only,
        alert_on_meeting_requests,
        alert_on_questions,
        min_lead_score_for_alert,
        quiet_hours_enabled,
        quiet_hours_start,
        quiet_hours_end,
        quiet_hours_timezone,
        max_alerts_per_hour,
        digest_mode,
        digest_frequency
      FROM reply_notification_settings
      WHERE user_id = ${userId}
    `;

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      userId: row.user_id,
      notificationsEnabled: row.notifications_enabled,
      smsEnabled: row.sms_enabled,
      smsPhone: row.sms_phone,
      slackEnabled: row.slack_enabled,
      slackWebhookUrl: row.slack_webhook_url,
      slackChannel: row.slack_channel,
      emailEnabled: row.email_enabled,
      notificationEmail: row.notification_email,
      pushEnabled: row.push_enabled,
      pushToken: row.push_token,
      alertOnAllReplies: row.alert_on_all_replies,
      alertOnPositiveOnly: row.alert_on_positive_only,
      alertOnMeetingRequests: row.alert_on_meeting_requests,
      alertOnQuestions: row.alert_on_questions,
      minLeadScoreForAlert: row.min_lead_score_for_alert,
      quietHoursEnabled: row.quiet_hours_enabled,
      quietHoursStart: row.quiet_hours_start,
      quietHoursEnd: row.quiet_hours_end,
      quietHoursTimezone: row.quiet_hours_timezone || 'America/New_York',
      maxAlertsPerHour: row.max_alerts_per_hour,
      digestMode: row.digest_mode,
      digestFrequency: row.digest_frequency || 'hourly',
    };
  }

  /**
   * Save notification settings for a user
   */
  async saveSettings(settings: NotificationSettings): Promise<void> {
    await sql`
      INSERT INTO reply_notification_settings (
        user_id,
        notifications_enabled,
        sms_enabled,
        sms_phone,
        slack_enabled,
        slack_webhook_url,
        slack_channel,
        email_enabled,
        notification_email,
        push_enabled,
        push_token,
        alert_on_all_replies,
        alert_on_positive_only,
        alert_on_meeting_requests,
        alert_on_questions,
        min_lead_score_for_alert,
        quiet_hours_enabled,
        quiet_hours_start,
        quiet_hours_end,
        quiet_hours_timezone,
        max_alerts_per_hour,
        digest_mode,
        digest_frequency
      ) VALUES (
        ${settings.userId},
        ${settings.notificationsEnabled},
        ${settings.smsEnabled},
        ${settings.smsPhone || null},
        ${settings.slackEnabled},
        ${settings.slackWebhookUrl || null},
        ${settings.slackChannel || null},
        ${settings.emailEnabled},
        ${settings.notificationEmail || null},
        ${settings.pushEnabled},
        ${settings.pushToken || null},
        ${settings.alertOnAllReplies},
        ${settings.alertOnPositiveOnly},
        ${settings.alertOnMeetingRequests},
        ${settings.alertOnQuestions},
        ${settings.minLeadScoreForAlert},
        ${settings.quietHoursEnabled},
        ${settings.quietHoursStart || null},
        ${settings.quietHoursEnd || null},
        ${settings.quietHoursTimezone},
        ${settings.maxAlertsPerHour},
        ${settings.digestMode},
        ${settings.digestFrequency}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        notifications_enabled = EXCLUDED.notifications_enabled,
        sms_enabled = EXCLUDED.sms_enabled,
        sms_phone = EXCLUDED.sms_phone,
        slack_enabled = EXCLUDED.slack_enabled,
        slack_webhook_url = EXCLUDED.slack_webhook_url,
        slack_channel = EXCLUDED.slack_channel,
        email_enabled = EXCLUDED.email_enabled,
        notification_email = EXCLUDED.notification_email,
        push_enabled = EXCLUDED.push_enabled,
        push_token = EXCLUDED.push_token,
        alert_on_all_replies = EXCLUDED.alert_on_all_replies,
        alert_on_positive_only = EXCLUDED.alert_on_positive_only,
        alert_on_meeting_requests = EXCLUDED.alert_on_meeting_requests,
        alert_on_questions = EXCLUDED.alert_on_questions,
        min_lead_score_for_alert = EXCLUDED.min_lead_score_for_alert,
        quiet_hours_enabled = EXCLUDED.quiet_hours_enabled,
        quiet_hours_start = EXCLUDED.quiet_hours_start,
        quiet_hours_end = EXCLUDED.quiet_hours_end,
        quiet_hours_timezone = EXCLUDED.quiet_hours_timezone,
        max_alerts_per_hour = EXCLUDED.max_alerts_per_hour,
        digest_mode = EXCLUDED.digest_mode,
        digest_frequency = EXCLUDED.digest_frequency,
        updated_at = NOW()
    `;
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private shouldNotify(notification: ReplyNotification, settings: NotificationSettings): boolean {
    // Check lead score threshold
    if (notification.leadScore < settings.minLeadScoreForAlert && !notification.isHotLead) {
      return false;
    }

    // If only alerting on positive
    if (settings.alertOnPositiveOnly && notification.sentiment !== 'positive') {
      return false;
    }

    // Meeting requests always notify if enabled
    if (settings.alertOnMeetingRequests && notification.intent === 'meeting_request') {
      return true;
    }

    // Questions notify if enabled
    if (settings.alertOnQuestions && notification.intent === 'question') {
      return true;
    }

    // Check if hot lead
    if (notification.isHotLead) {
      return true;
    }

    // Alert on all replies
    if (settings.alertOnAllReplies) {
      return true;
    }

    return false;
  }

  private isQuietHours(settings: NotificationSettings): boolean {
    if (!settings.quietHoursEnabled || !settings.quietHoursStart || !settings.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const [startHour, startMin] = settings.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = settings.quietHoursEnd.split(':').map(Number);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight quiet hours
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  private async checkRateLimit(userId: string, maxPerHour: number): Promise<boolean> {
    const result = await sql`
      SELECT COUNT(*) as count
      FROM reply_notification_log
      WHERE user_id = ${userId}
        AND created_at > NOW() - INTERVAL '1 hour'
    `;

    return parseInt(result.rows[0].count) < maxPerHour;
  }

  private async logNotifications(
    matchId: string,
    userId: string,
    results: NotificationResult[]
  ): Promise<void> {
    for (const result of results) {
      await sql`
        INSERT INTO reply_notification_log (
          user_id,
          reply_match_id,
          channel,
          recipient,
          status,
          sent_at,
          provider_message_id,
          error_message
        ) VALUES (
          ${userId},
          ${matchId},
          ${result.channel},
          ${result.channel},
          ${result.success ? 'sent' : 'failed'},
          ${result.success ? new Date().toISOString() : null},
          ${result.messageId || null},
          ${result.error || null}
        )
      `;
    }
  }

  private async markAsNotified(matchId: string, channels: NotificationChannel[]): Promise<void> {
    await sql.query(
      `UPDATE campaign_reply_matches
       SET
         notification_sent = true,
         notification_sent_at = NOW(),
         notification_channels = $1,
         status = CASE WHEN status = 'analyzed' THEN 'notified' ELSE status END,
         updated_at = NOW()
       WHERE id = $2`,
      [channels, matchId]
    );
  }

  private getSentimentEmoji(sentiment: Sentiment, intent: ReplyIntent): string {
    if (intent === 'meeting_request') return '📅';
    if (intent === 'interested') return '🔥';
    if (intent === 'question') return '❓';
    if (intent === 'pricing_inquiry') return '💰';
    if (sentiment === 'positive') return '✨';
    if (sentiment === 'negative') return '⚠️';
    return '📬';
  }

  private getIntentLabel(intent: ReplyIntent): string {
    const labels: Record<ReplyIntent, string> = {
      interested: 'Interested',
      not_interested: 'Not Interested',
      meeting_request: 'Meeting Request',
      question: 'Question',
      forward_request: 'Forward Request',
      unsubscribe: 'Unsubscribe',
      out_of_office: 'Out of Office',
      do_not_contact: 'Do Not Contact',
      pricing_inquiry: 'Pricing Inquiry',
      competitor_mention: 'Competitor Mention',
      timing_issue: 'Timing Issue',
      unclear: 'Unclear',
    };
    return labels[intent] || intent;
  }

  private getSentimentColor(sentiment: Sentiment): string {
    const colors: Record<Sentiment, string> = {
      positive: '#10b981',
      neutral: '#6b7280',
      negative: '#ef4444',
    };
    return colors[sentiment] || '#6b7280';
  }
}

// Export singleton instance
export const hotLeadNotifications = new HotLeadNotificationService();
