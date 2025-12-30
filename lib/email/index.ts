// @ts-nocheck
/**
 * Email System Index
 *
 * Comprehensive email system for WellsAI with THREE modes:
 * 1. Native Email - Wells sends as Wells (wells@wellsonyx.com)
 * 2. Passthrough Email - Wells sends as User via Gmail/Outlook
 * 3. Inbound Processing - Handling incoming emails
 *
 * @module lib/email
 */

// ============================================================================
// NATIVE EMAIL (Wells sends as Wells)
// ============================================================================

export {
  // Main sending function
  sendWellsEmail,
  quickSend,
  sendReply,

  // Templates
  coldOutreachTemplate,
  followUpTemplate,
  notificationTemplate,
  meetingRequestTemplate,

  // Thread management
  getThread,
  getThreadMessages,
  getUserThreads,

  // Analytics
  getEmailAnalytics,

  // Unsubscribe management
  isUnsubscribed,
  unsubscribe,
  resubscribe,

  // Webhook processing
  processWebhookEvent,

  // Rate limiting
  checkRateLimit,

  // Types
  type WellsEmailOptions,
  type EmailResult,
  type EmailTemplate,
  type EmailEvent,
  type EmailThread,
  type EmailAnalytics,
  type TemplateVariables,
  type WebhookEvent,
} from './wells-native-email';

// ============================================================================
// PASSTHROUGH EMAIL (Wells sends as User)
// ============================================================================

export {
  // OAuth URL generation
  getGmailAuthUrl,
  getOutlookAuthUrl,

  // Token exchange
  exchangeGmailCode,
  exchangeOutlookCode,

  // Account management
  connectEmailAccount,
  getEmailAccount,
  getUserEmailAccounts,
  getDefaultEmailAccount,
  disconnectEmailAccount,
  updateAccountSignature,

  // Sending
  sendPassthroughEmail,
  replyToThread,

  // Reading
  getRecentEmails,
  getEmailThread,

  // Types
  type EmailProvider,
  type ConnectedEmailAccount,
  type PassthroughEmailOptions,
  type PassthroughResult,
} from './email-passthrough';

// ============================================================================
// INBOUND PROCESSING
// ============================================================================

export {
  // Parsing
  parseResendInbound,

  // Classification
  classifyIntent,
  routeEmail,

  // Auto-response
  generateAutoResponse,

  // Main processing
  processInboundEmail,

  // Review management
  getPendingReview,
  markReviewed,

  // Types
  type InboundEmail,
  type InboundAttachment,
  type EmailIntent as InboundEmailIntent,
  type IntentClassification,
  type ProcessedEmail,
} from './inbound-processor';

// ============================================================================
// CONVENIENCE RE-EXPORTS
// ============================================================================

import WellsNativeEmail from './wells-native-email';
import EmailPassthrough from './email-passthrough';
import InboundProcessor from './inbound-processor';

export const WellsEmail = {
  ...WellsNativeEmail,
  ...EmailPassthrough,
  ...InboundProcessor,
};

export default WellsEmail;
