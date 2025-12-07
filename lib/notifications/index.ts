/**
 * Wells Onyx Notification System
 *
 * Complete notification infrastructure for viral payments
 *
 * @example
 * ```typescript
 * import { notifyPaymentReceived } from '@/lib/notifications';
 *
 * await notifyPaymentReceived(
 *   'recipient@example.com',
 *   '+1234567890',
 *   500,
 *   'Acme Corp',
 *   'https://wellsonyx.io/claim/pay_abc123'
 * );
 * ```
 */

// Main notification service
export {
  notify,
  notifyPaymentReceived,
  notifyPaymentClaimed,
  notifyPartnerTransaction,
  sendBulkNotifications,
  scheduleNotification,
  processScheduledNotifications,
  updateNotificationStatus,
  type NotificationType,
  type NotificationChannel,
  type NotificationData,
  type NotificationResult,
} from './service';

// Twilio SMS
export {
  sendSMS,
  sendPaymentNotification as sendPaymentSMS,
  sendClaimConfirmation as sendClaimSMS,
  sendCreditApproval as sendCreditSMS,
  sendPaymentReminder as sendPaymentReminderSMS,
  sendPaymentClaimedNotification as sendPaymentClaimedSMS,
  send2FACode,
  sendBulkSMS,
  checkMessageStatus,
  getSMSUsage,
  type SMSResult,
} from './twilio';

// Resend Email
export {
  sendEmail,
  sendPaymentNotification as sendPaymentEmail,
  sendClaimConfirmation as sendClaimEmail,
  sendWelcomeEmail,
  sendCreditApproval as sendCreditEmail,
  sendPaymentReminder as sendPaymentReminderEmail,
  sendBulkEmails,
  type EmailResult,
} from './resend';

// User Preferences
export {
  getPreferences,
  getDefaultPreferences,
  createPreferences,
  updatePreferences,
  optOutAll,
  optOutMarketing,
  setQuietHours,
  disableQuietHours,
  hasOptedOut,
  shouldSendNow,
  getUnsubscribeToken,
  processUnsubscribe,
  getNotificationHistory,
  getNotificationStats,
  type NotificationPreferences,
  type UpdatePreferencesInput,
} from './preferences';
