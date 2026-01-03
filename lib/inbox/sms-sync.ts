/**
 * SMS Sync Module
 * ================
 * Syncs SMS messages via Twilio webhooks to the unified inbox
 *
 * Features:
 * - Real-time message sync via webhooks
 * - Message history fetch from Twilio
 * - Two-way SMS sending
 * - Phone number formatting
 * - MMS attachment support
 * - WhatsApp Business integration (via Twilio)
 */

import Twilio from 'twilio';
import {
  SyncProvider,
  SyncResult,
  SyncOptions,
  ConnectedAccount,
  registerSyncProvider,
} from './sync-manager';
import { createMessage, InboxChannel, Participant, Attachment } from './unified-inbox';
import { query } from '@/lib/db';

// =====================================================
// TYPES
// =====================================================

interface TwilioMessage {
  sid: string;
  accountSid: string;
  from: string;
  to: string;
  body: string;
  status: string;
  direction: 'inbound' | 'outbound-api' | 'outbound-call' | 'outbound-reply';
  dateCreated: Date;
  dateSent?: Date;
  numMedia?: string;
  mediaContentType0?: string;
  mediaUrl0?: string;
}

interface SMSSyncCursor {
  lastMessageSid?: string;
  lastMessageDate?: string;
}

// =====================================================
// TWILIO CLIENT
// =====================================================

/**
 * Get Twilio client from account credentials
 */
function getTwilioClient(account: ConnectedAccount): Twilio.Twilio {
  const accountSid = account.settings?.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID;
  const authToken = account.settings?.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured');
  }

  return Twilio(accountSid, authToken);
}

/**
 * Get Twilio phone number for account
 */
function getTwilioNumber(account: ConnectedAccount): string {
  return account.phone || account.settings?.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER || '';
}

// =====================================================
// SYNC PROVIDER
// =====================================================

const smsSyncProvider: SyncProvider = {
  channel: 'sms',

  /**
   * Sync SMS messages from Twilio
   * Note: Primary sync happens via webhooks, this is for backfill
   */
  async sync(account: ConnectedAccount, options: SyncOptions = {}): Promise<SyncResult> {
    const result: SyncResult = {
      accountId: account.id,
      channel: 'sms',
      messagesCreated: 0,
      messagesUpdated: 0,
      messagesSkipped: 0,
      errors: [],
      duration: 0,
    };

    try {
      const client = getTwilioClient(account);
      const phoneNumber = getTwilioNumber(account);

      if (!phoneNumber) {
        throw new Error('No phone number configured');
      }

      // Parse cursor
      let cursor: SMSSyncCursor | null = null;
      if (account.syncCursor && !options.forceFull) {
        try {
          cursor = JSON.parse(account.syncCursor);
        } catch {
          cursor = null;
        }
      }

      // Fetch messages
      const maxMessages = options.maxMessages || 100;
      const queryParams: any = {
        limit: Math.min(100, maxMessages),
      };

      // Only fetch messages after last sync
      if (cursor?.lastMessageDate && !options.forceFull) {
        queryParams.dateSentAfter = new Date(cursor.lastMessageDate);
      }

      // Fetch inbound messages
      const inboundMessages = await client.messages.list({
        ...queryParams,
        to: phoneNumber,
      });

      // Fetch outbound messages
      const outboundMessages = await client.messages.list({
        ...queryParams,
        from: phoneNumber,
      });

      // Combine and sort by date
      const allMessages = [...inboundMessages, ...outboundMessages].sort(
        (a, b) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
      );

      let newestSid: string | undefined;
      let newestDate: string | undefined;

      for (const message of allMessages.slice(0, maxMessages)) {
        try {
          const imported = await importTwilioMessage(message, account, phoneNumber);
          if (imported === 'created') {
            result.messagesCreated++;
          } else if (imported === 'updated') {
            result.messagesUpdated++;
          } else {
            result.messagesSkipped++;
          }

          newestSid = message.sid;
          newestDate = message.dateCreated.toISOString();
        } catch (error: any) {
          result.errors.push(`Message ${message.sid}: ${error.message}`);
          result.messagesSkipped++;
        }
      }

      // Update cursor
      if (newestSid) {
        result.newCursor = JSON.stringify({
          lastMessageSid: newestSid,
          lastMessageDate: newestDate,
        });
      }

      console.log(`[SMSSync] Completed for ${phoneNumber}: ${result.messagesCreated} created`);
    } catch (error: any) {
      console.error(`[SMSSync] Error:`, error);
      result.errors.push(error.message);
      throw error;
    }

    return result;
  },

  /**
   * Process SMS webhook (primary sync method)
   */
  async processWebhook(account: ConnectedAccount, payload: any): Promise<SyncResult> {
    const result: SyncResult = {
      accountId: account.id,
      channel: 'sms',
      messagesCreated: 0,
      messagesUpdated: 0,
      messagesSkipped: 0,
      errors: [],
      duration: 0,
    };

    try {
      const phoneNumber = getTwilioNumber(account);
      const imported = await importWebhookMessage(payload, account, phoneNumber);

      if (imported === 'created') {
        result.messagesCreated++;
      } else if (imported === 'updated') {
        result.messagesUpdated++;
      } else {
        result.messagesSkipped++;
      }
    } catch (error: any) {
      result.errors.push(error.message);
    }

    return result;
  },

  /**
   * Validate SMS connection
   */
  async validateConnection(account: ConnectedAccount): Promise<boolean> {
    try {
      const client = getTwilioClient(account);
      const phoneNumber = getTwilioNumber(account);

      if (!phoneNumber) {
        return false;
      }

      // Try to list messages (limited to 1)
      await client.messages.list({ limit: 1 });
      return true;
    } catch {
      return false;
    }
  },
};

// =====================================================
// MESSAGE IMPORT
// =====================================================

/**
 * Import a Twilio message
 */
async function importTwilioMessage(
  message: any,
  account: ConnectedAccount,
  ownPhoneNumber: string
): Promise<'created' | 'updated' | 'skipped'> {
  // Check if already exists
  const existing = await query(
    `SELECT id FROM unified_messages
     WHERE channel_message_id = $1 AND account_id = $2`,
    [message.sid, account.id]
  );

  if (existing.rows.length > 0) {
    return 'skipped';
  }

  // Determine direction
  const isInbound = message.to === ownPhoneNumber;
  const direction = isInbound ? 'inbound' : 'outbound';

  // Parse participants
  const from: Participant = {
    address: message.from,
    name: await getContactName(account.userId, message.from),
  };

  const to: Participant[] = [
    {
      address: message.to,
      name: await getContactName(account.userId, message.to),
    },
  ];

  // Parse attachments (MMS)
  const attachments: Attachment[] = [];
  const numMedia = parseInt(message.numMedia) || 0;
  for (let i = 0; i < numMedia; i++) {
    const url = message[`mediaUrl${i}`];
    const contentType = message[`mediaContentType${i}`];
    if (url) {
      attachments.push({
        id: `${message.sid}-media-${i}`,
        name: `attachment-${i}`,
        url,
        size: 0,
        mimeType: contentType || 'application/octet-stream',
      });
    }
  }

  // Create thread ID based on the other party's phone number
  const otherParty = isInbound ? message.from : message.to;
  const threadIdentifier = `sms:${ownPhoneNumber}:${otherParty}`;

  // Create unified message
  await createMessage(account.userId, {
    channel: 'sms' as InboxChannel,
    channelMessageId: message.sid,
    channelThreadId: threadIdentifier,
    accountId: account.id,
    direction,
    from,
    to,
    bodyText: message.body,
    snippet: message.body?.substring(0, 100),
    attachments,
    isRead: direction === 'outbound', // Outbound messages are read by default
    receivedAt: isInbound ? new Date(message.dateCreated) : undefined,
    sentAt: direction === 'outbound' ? new Date(message.dateSent || message.dateCreated) : undefined,
  });

  return 'created';
}

/**
 * Import message from webhook payload
 */
async function importWebhookMessage(
  payload: any,
  account: ConnectedAccount,
  ownPhoneNumber: string
): Promise<'created' | 'updated' | 'skipped'> {
  // Webhook payload format
  const message = {
    sid: payload.MessageSid || payload.SmsSid,
    from: payload.From,
    to: payload.To,
    body: payload.Body,
    status: payload.SmsStatus || 'received',
    dateCreated: new Date(),
    numMedia: payload.NumMedia,
    ...Array.from({ length: parseInt(payload.NumMedia) || 0 }).reduce((acc: any, _, i) => {
      acc[`mediaUrl${i}`] = payload[`MediaUrl${i}`];
      acc[`mediaContentType${i}`] = payload[`MediaContentType${i}`];
      return acc;
    }, {}),
  };

  return importTwilioMessage(message, account, ownPhoneNumber);
}

/**
 * Get contact name from phone number
 */
async function getContactName(userId: string, phone: string): Promise<string | undefined> {
  const result = await query(
    `SELECT name FROM inbox_unified_contacts
     WHERE user_id = $1 AND phone = $2`,
    [userId, normalizePhoneNumber(phone)]
  );

  return result.rows[0]?.name;
}

// =====================================================
// SMS ACTIONS
// =====================================================

/**
 * Send SMS message
 */
export async function sendSMS(
  account: ConnectedAccount,
  to: string,
  body: string,
  options?: {
    mediaUrls?: string[];
    statusCallback?: string;
  }
): Promise<string> {
  const client = getTwilioClient(account);
  const fromNumber = getTwilioNumber(account);

  if (!fromNumber) {
    throw new Error('No phone number configured');
  }

  const messageOptions: any = {
    body,
    from: fromNumber,
    to: normalizePhoneNumber(to),
  };

  if (options?.mediaUrls?.length) {
    messageOptions.mediaUrl = options.mediaUrls;
  }

  if (options?.statusCallback) {
    messageOptions.statusCallback = options.statusCallback;
  }

  const message = await client.messages.create(messageOptions);

  // Also create unified message for sent message
  await createMessage(account.userId, {
    channel: 'sms',
    channelMessageId: message.sid,
    channelThreadId: `sms:${fromNumber}:${to}`,
    accountId: account.id,
    direction: 'outbound',
    from: { address: fromNumber },
    to: [{ address: to }],
    bodyText: body,
    snippet: body.substring(0, 100),
    attachments: options?.mediaUrls?.map((url, i) => ({
      id: `${message.sid}-media-${i}`,
      name: `attachment-${i}`,
      url,
      size: 0,
      mimeType: 'application/octet-stream',
    })) || [],
    isRead: true,
    sentAt: new Date(),
  });

  return message.sid;
}

/**
 * Send WhatsApp message (via Twilio)
 */
export async function sendWhatsApp(
  account: ConnectedAccount,
  to: string,
  body: string,
  options?: {
    mediaUrls?: string[];
    templateSid?: string;
    templateVariables?: Record<string, string>;
  }
): Promise<string> {
  const client = getTwilioClient(account);
  const fromNumber = account.settings?.whatsappNumber || process.env.TWILIO_WHATSAPP_NUMBER;

  if (!fromNumber) {
    throw new Error('WhatsApp number not configured');
  }

  const messageOptions: any = {
    body,
    from: `whatsapp:${fromNumber}`,
    to: `whatsapp:${normalizePhoneNumber(to)}`,
  };

  if (options?.mediaUrls?.length) {
    messageOptions.mediaUrl = options.mediaUrls;
  }

  if (options?.templateSid) {
    messageOptions.contentSid = options.templateSid;
    if (options.templateVariables) {
      messageOptions.contentVariables = JSON.stringify(options.templateVariables);
    }
  }

  const message = await client.messages.create(messageOptions);

  // Create unified message
  await createMessage(account.userId, {
    channel: 'whatsapp',
    channelMessageId: message.sid,
    channelThreadId: `whatsapp:${fromNumber}:${to}`,
    accountId: account.id,
    direction: 'outbound',
    from: { address: fromNumber },
    to: [{ address: to }],
    bodyText: body,
    snippet: body.substring(0, 100),
    isRead: true,
    sentAt: new Date(),
  });

  return message.sid;
}

// =====================================================
// PHONE NUMBER UTILITIES
// =====================================================

/**
 * Normalize phone number to E.164 format
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-numeric characters except leading +
  let normalized = phone.replace(/[^\d+]/g, '');

  // If no country code, assume US (+1)
  if (!normalized.startsWith('+')) {
    if (normalized.length === 10) {
      normalized = '+1' + normalized;
    } else if (normalized.length === 11 && normalized.startsWith('1')) {
      normalized = '+' + normalized;
    }
  }

  return normalized;
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  const normalized = normalizePhoneNumber(phone);

  // Format US numbers as (XXX) XXX-XXXX
  if (normalized.startsWith('+1') && normalized.length === 12) {
    return `(${normalized.slice(2, 5)}) ${normalized.slice(5, 8)}-${normalized.slice(8)}`;
  }

  // Return as-is for other countries
  return normalized;
}

// =====================================================
// WEBHOOK HANDLERS
// =====================================================

/**
 * Process incoming SMS webhook
 */
export async function processIncomingSMSWebhook(
  payload: any,
  userId: string
): Promise<{ success: boolean; messageId?: string }> {
  const toNumber = payload.To;

  // Find account by phone number
  const accountResult = await query(
    `SELECT * FROM inbox_connected_accounts
     WHERE channel = 'sms' AND phone = $1 AND is_active = true
     ORDER BY created_at DESC LIMIT 1`,
    [normalizePhoneNumber(toNumber)]
  );

  if (accountResult.rows.length === 0) {
    // Try to find by user ID if phone not matched
    const userAccountResult = await query(
      `SELECT * FROM inbox_connected_accounts
       WHERE channel = 'sms' AND user_id = $1 AND is_active = true
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (userAccountResult.rows.length === 0) {
      console.log('[SMSSync] No account found for incoming SMS');
      return { success: false };
    }

    const account: ConnectedAccount = mapRowToAccount(userAccountResult.rows[0]);
    const result = await smsSyncProvider.processWebhook!(account, payload);

    return {
      success: result.errors.length === 0,
      messageId: payload.MessageSid,
    };
  }

  const account: ConnectedAccount = mapRowToAccount(accountResult.rows[0]);
  const result = await smsSyncProvider.processWebhook!(account, payload);

  return {
    success: result.errors.length === 0,
    messageId: payload.MessageSid,
  };
}

/**
 * Process SMS status webhook
 */
export async function processSMSStatusWebhook(
  payload: any
): Promise<void> {
  const messageSid = payload.MessageSid || payload.SmsSid;
  const status = payload.MessageStatus || payload.SmsStatus;

  // Update message status in database
  await query(
    `UPDATE unified_messages
     SET
       labels = array_append(labels, $2),
       updated_at = NOW()
     WHERE channel_message_id = $1`,
    [messageSid, `status:${status}`]
  );
}

// =====================================================
// ACCOUNT SETUP
// =====================================================

/**
 * Connect SMS account
 */
export async function connectSMSAccount(
  userId: string,
  phoneNumber: string,
  credentials?: {
    twilioAccountSid?: string;
    twilioAuthToken?: string;
  }
): Promise<ConnectedAccount> {
  const accountId = require('crypto').randomUUID();
  const now = new Date().toISOString();

  await query(
    `INSERT INTO inbox_connected_accounts (
      id, user_id, channel, phone, display_name,
      sync_status, is_active, sync_enabled, settings,
      created_at, updated_at
    ) VALUES ($1, $2, 'sms', $3, $4, 'idle', true, true, $5, $6, $6)`,
    [
      accountId,
      userId,
      normalizePhoneNumber(phoneNumber),
      formatPhoneNumber(phoneNumber),
      JSON.stringify({
        twilioAccountSid: credentials?.twilioAccountSid,
        twilioAuthToken: credentials?.twilioAuthToken,
        twilioPhoneNumber: normalizePhoneNumber(phoneNumber),
      }),
      now,
    ]
  );

  const result = await query(
    'SELECT * FROM inbox_connected_accounts WHERE id = $1',
    [accountId]
  );

  return mapRowToAccount(result.rows[0]);
}

// =====================================================
// HELPERS
// =====================================================

function mapRowToAccount(row: any): ConnectedAccount {
  return {
    id: row.id,
    userId: row.user_id,
    channel: row.channel,
    email: row.email,
    phone: row.phone,
    handle: row.handle,
    displayName: row.display_name,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    tokenExpiresAt: row.token_expires_at ? new Date(row.token_expires_at) : undefined,
    syncCursor: row.sync_cursor,
    lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : undefined,
    syncStatus: row.sync_status,
    syncError: row.sync_error,
    isActive: row.is_active,
    syncEnabled: row.sync_enabled,
    settings: row.settings || {},
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// =====================================================
// REGISTER PROVIDER
// =====================================================

registerSyncProvider(smsSyncProvider);

// =====================================================
// EXPORTS
// =====================================================

export default {
  // Sync
  syncProvider: smsSyncProvider,

  // Actions
  sendSMS,
  sendWhatsApp,

  // Webhooks
  processIncomingSMSWebhook,
  processSMSStatusWebhook,

  // Account
  connectSMSAccount,

  // Utilities
  normalizePhoneNumber,
  formatPhoneNumber,
};
