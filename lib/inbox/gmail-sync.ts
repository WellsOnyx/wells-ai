/**
 * Gmail Sync Module
 * =================
 * Syncs Gmail messages to the unified inbox using Gmail API
 *
 * Features:
 * - Full and incremental sync via History API
 * - OAuth token management with auto-refresh
 * - Batch message fetching for performance
 * - Label synchronization
 * - Push notification support via Pub/Sub
 */

import { google, gmail_v1 } from 'googleapis';
import {
  SyncProvider,
  SyncResult,
  SyncOptions,
  ConnectedAccount,
  registerSyncProvider,
  updateAccountTokens,
  updateSyncCursor,
} from './sync-manager';
import { createMessage, InboxChannel, Participant, Attachment } from './unified-inbox';
import { query } from '@/lib/db';

// =====================================================
// TYPES
// =====================================================

interface GmailSyncCursor {
  historyId: string;
  pageToken?: string;
}

interface GmailCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

// =====================================================
// GMAIL CLIENT
// =====================================================

/**
 * Create OAuth2 client with credentials
 */
function createOAuth2Client(): ReturnType<typeof google.auth.OAuth2.prototype.constructor> {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/inbox/gmail/callback`
  );
}

/**
 * Get Gmail API client for an account
 */
function getGmailClient(account: ConnectedAccount): gmail_v1.Gmail {
  const oauth2Client = createOAuth2Client();

  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.tokenExpiresAt?.getTime(),
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// =====================================================
// SYNC PROVIDER
// =====================================================

const gmailSyncProvider: SyncProvider = {
  channel: 'gmail',

  /**
   * Sync Gmail messages
   */
  async sync(account: ConnectedAccount, options: SyncOptions = {}): Promise<SyncResult> {
    const gmail = getGmailClient(account);
    const result: SyncResult = {
      accountId: account.id,
      channel: 'gmail',
      messagesCreated: 0,
      messagesUpdated: 0,
      messagesSkipped: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Parse existing cursor
      let cursor: GmailSyncCursor | null = null;
      if (account.syncCursor && !options.forceFull) {
        try {
          cursor = JSON.parse(account.syncCursor);
        } catch {
          cursor = null;
        }
      }

      // Decide sync strategy
      if (cursor?.historyId && !options.forceFull) {
        // Incremental sync using History API
        await syncIncremental(gmail, account, cursor, result, options);
      } else {
        // Full sync - fetch recent messages
        await syncFull(gmail, account, result, options);
      }

      console.log(`[GmailSync] Completed for ${account.email}: ${result.messagesCreated} created, ${result.messagesUpdated} updated`);
    } catch (error: any) {
      console.error(`[GmailSync] Error for ${account.email}:`, error);
      result.errors.push(error.message);
      throw error;
    }

    return result;
  },

  /**
   * Process Gmail push notification webhook
   */
  async processWebhook(account: ConnectedAccount, payload: any): Promise<SyncResult> {
    // Gmail push notifications contain:
    // - emailAddress: the email receiving the notification
    // - historyId: the latest history ID

    const gmail = getGmailClient(account);
    const result: SyncResult = {
      accountId: account.id,
      channel: 'gmail',
      messagesCreated: 0,
      messagesUpdated: 0,
      messagesSkipped: 0,
      errors: [],
      duration: 0,
    };

    try {
      const historyId = payload.historyId;
      if (!historyId) {
        return result;
      }

      let cursor: GmailSyncCursor | null = null;
      if (account.syncCursor) {
        try {
          cursor = JSON.parse(account.syncCursor);
        } catch {
          cursor = null;
        }
      }

      if (cursor?.historyId) {
        await syncIncremental(gmail, account, cursor, result, {});
      }
    } catch (error: any) {
      result.errors.push(error.message);
    }

    return result;
  },

  /**
   * Refresh Gmail OAuth token
   */
  async refreshToken(account: ConnectedAccount): Promise<{ accessToken: string; expiresAt: Date }> {
    const oauth2Client = createOAuth2Client();

    oauth2Client.setCredentials({
      refresh_token: account.refreshToken,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('Failed to refresh Gmail token');
    }

    const expiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    return {
      accessToken: credentials.access_token,
      expiresAt,
    };
  },

  /**
   * Validate Gmail connection
   */
  async validateConnection(account: ConnectedAccount): Promise<boolean> {
    try {
      const gmail = getGmailClient(account);
      const profile = await gmail.users.getProfile({ userId: 'me' });
      return !!profile.data.emailAddress;
    } catch {
      return false;
    }
  },
};

// =====================================================
// SYNC STRATEGIES
// =====================================================

/**
 * Full sync - fetch recent messages
 */
async function syncFull(
  gmail: gmail_v1.Gmail,
  account: ConnectedAccount,
  result: SyncResult,
  options: SyncOptions
): Promise<void> {
  const maxMessages = options.maxMessages || 100;
  let pageToken: string | undefined;
  let processedCount = 0;

  // Get current history ID for future incremental syncs
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const historyId = profile.data.historyId || '';

  do {
    // List messages
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: Math.min(100, maxMessages - processedCount),
      pageToken,
      labelIds: ['INBOX'],
    });

    const messages = listResponse.data.messages || [];

    // Fetch message details in batches
    for (const msg of messages) {
      if (!msg.id) continue;

      try {
        const imported = await importGmailMessage(gmail, msg.id, account);
        if (imported === 'created') {
          result.messagesCreated++;
        } else if (imported === 'updated') {
          result.messagesUpdated++;
        } else {
          result.messagesSkipped++;
        }
        processedCount++;
      } catch (error: any) {
        result.errors.push(`Message ${msg.id}: ${error.message}`);
        result.messagesSkipped++;
      }

      if (processedCount >= maxMessages) break;
    }

    pageToken = listResponse.data.nextPageToken || undefined;
  } while (pageToken && processedCount < maxMessages);

  // Update sync cursor
  result.newCursor = JSON.stringify({ historyId });
}

/**
 * Incremental sync using History API
 */
async function syncIncremental(
  gmail: gmail_v1.Gmail,
  account: ConnectedAccount,
  cursor: GmailSyncCursor,
  result: SyncResult,
  options: SyncOptions
): Promise<void> {
  try {
    let pageToken: string | undefined;
    let newHistoryId = cursor.historyId;

    do {
      const historyResponse = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: cursor.historyId,
        historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
        pageToken,
      });

      const history = historyResponse.data.history || [];
      newHistoryId = historyResponse.data.historyId || newHistoryId;

      for (const historyItem of history) {
        // Process new messages
        if (historyItem.messagesAdded) {
          for (const added of historyItem.messagesAdded) {
            if (!added.message?.id) continue;

            try {
              const imported = await importGmailMessage(gmail, added.message.id, account);
              if (imported === 'created') {
                result.messagesCreated++;
              } else if (imported === 'updated') {
                result.messagesUpdated++;
              }
            } catch (error: any) {
              result.errors.push(`Message ${added.message.id}: ${error.message}`);
            }
          }
        }

        // Process label changes (for read/unread, archive, etc.)
        if (historyItem.labelsAdded || historyItem.labelsRemoved) {
          for (const labelChange of [...(historyItem.labelsAdded || []), ...(historyItem.labelsRemoved || [])]) {
            if (!labelChange.message?.id) continue;

            try {
              await syncMessageLabels(gmail, labelChange.message.id, account);
              result.messagesUpdated++;
            } catch (error: any) {
              // Silent fail for label sync
            }
          }
        }
      }

      pageToken = historyResponse.data.nextPageToken || undefined;
    } while (pageToken);

    result.newCursor = JSON.stringify({ historyId: newHistoryId });
  } catch (error: any) {
    // If history is too old, do a full sync
    if (error.code === 404 || error.message?.includes('historyId')) {
      console.log('[GmailSync] History expired, falling back to full sync');
      await syncFull(gmail, account, result, options);
    } else {
      throw error;
    }
  }
}

// =====================================================
// MESSAGE IMPORT
// =====================================================

/**
 * Import a single Gmail message
 */
async function importGmailMessage(
  gmail: gmail_v1.Gmail,
  messageId: string,
  account: ConnectedAccount
): Promise<'created' | 'updated' | 'skipped'> {
  // Check if already exists
  const existing = await query(
    `SELECT id FROM unified_messages
     WHERE channel_message_id = $1 AND account_id = $2`,
    [messageId, account.id]
  );

  if (existing.rows.length > 0) {
    return 'skipped';
  }

  // Fetch full message
  const msgResponse = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const message = msgResponse.data;
  if (!message.payload) {
    return 'skipped';
  }

  // Parse headers
  const headers = message.payload.headers || [];
  const getHeader = (name: string): string | undefined =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || undefined;

  const from = parseEmailAddress(getHeader('From') || '');
  const to = parseEmailAddresses(getHeader('To') || '');
  const cc = parseEmailAddresses(getHeader('Cc') || '');
  const subject = getHeader('Subject');
  const date = getHeader('Date');
  const messageIdHeader = getHeader('Message-ID');

  // Determine direction
  const isFromMe = message.labelIds?.includes('SENT') || from.address === account.email;
  const direction = isFromMe ? 'outbound' : 'inbound';

  // Parse body
  const { bodyText, bodyHtml } = parseMessageBody(message.payload);

  // Parse attachments
  const attachments = parseAttachments(message.payload);

  // Determine read status
  const isRead = !message.labelIds?.includes('UNREAD');

  // Create unified message
  await createMessage(account.userId, {
    channel: 'gmail' as InboxChannel,
    channelMessageId: messageId,
    channelThreadId: message.threadId || undefined,
    accountId: account.id,
    direction,
    from,
    to,
    cc,
    subject,
    bodyText,
    bodyHtml,
    snippet: message.snippet || undefined,
    attachments,
    labels: message.labelIds || [],
    isRead,
    receivedAt: date ? new Date(date) : undefined,
    sentAt: isFromMe ? (date ? new Date(date) : undefined) : undefined,
  });

  return 'created';
}

/**
 * Sync message labels (read status, archive, etc.)
 */
async function syncMessageLabels(
  gmail: gmail_v1.Gmail,
  messageId: string,
  account: ConnectedAccount
): Promise<void> {
  const msgResponse = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'minimal',
  });

  const labels = msgResponse.data.labelIds || [];
  const isRead = !labels.includes('UNREAD');
  const isArchived = !labels.includes('INBOX');
  const isTrashed = labels.includes('TRASH');
  const isSpam = labels.includes('SPAM');
  const isStarred = labels.includes('STARRED');

  await query(
    `UPDATE unified_messages
     SET
       is_read = $2,
       is_archived = $3,
       is_trashed = $4,
       is_spam = $5,
       is_starred = $6,
       labels = $7,
       updated_at = NOW()
     WHERE channel_message_id = $1 AND account_id = $8`,
    [messageId, isRead, isArchived, isTrashed, isSpam, isStarred, JSON.stringify(labels), account.id]
  );
}

// =====================================================
// GMAIL ACTIONS
// =====================================================

/**
 * Send email via Gmail
 */
export async function sendGmailMessage(
  account: ConnectedAccount,
  to: string[],
  subject: string,
  body: string,
  options?: {
    cc?: string[];
    bcc?: string[];
    replyToMessageId?: string;
    threadId?: string;
    html?: boolean;
  }
): Promise<string> {
  const gmail = getGmailClient(account);

  // Build RFC 2822 message
  const messageParts = [
    `From: ${account.displayName || account.email} <${account.email}>`,
    `To: ${to.join(', ')}`,
  ];

  if (options?.cc?.length) {
    messageParts.push(`Cc: ${options.cc.join(', ')}`);
  }

  if (options?.replyToMessageId) {
    messageParts.push(`In-Reply-To: ${options.replyToMessageId}`);
    messageParts.push(`References: ${options.replyToMessageId}`);
  }

  messageParts.push(`Subject: ${subject}`);
  messageParts.push(`Content-Type: ${options?.html ? 'text/html' : 'text/plain'}; charset=utf-8`);
  messageParts.push('');
  messageParts.push(body);

  const rawMessage = messageParts.join('\r\n');
  const encodedMessage = Buffer.from(rawMessage).toString('base64url');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
      threadId: options?.threadId,
    },
  });

  return response.data.id || '';
}

/**
 * Archive Gmail messages
 */
export async function archiveGmailMessages(
  account: ConnectedAccount,
  messageIds: string[]
): Promise<void> {
  const gmail = getGmailClient(account);

  await gmail.users.messages.batchModify({
    userId: 'me',
    requestBody: {
      ids: messageIds,
      removeLabelIds: ['INBOX'],
    },
  });
}

/**
 * Mark Gmail messages as read
 */
export async function markGmailMessagesRead(
  account: ConnectedAccount,
  messageIds: string[],
  read: boolean
): Promise<void> {
  const gmail = getGmailClient(account);

  await gmail.users.messages.batchModify({
    userId: 'me',
    requestBody: {
      ids: messageIds,
      removeLabelIds: read ? ['UNREAD'] : [],
      addLabelIds: read ? [] : ['UNREAD'],
    },
  });
}

/**
 * Star/unstar Gmail messages
 */
export async function starGmailMessages(
  account: ConnectedAccount,
  messageIds: string[],
  starred: boolean
): Promise<void> {
  const gmail = getGmailClient(account);

  await gmail.users.messages.batchModify({
    userId: 'me',
    requestBody: {
      ids: messageIds,
      addLabelIds: starred ? ['STARRED'] : [],
      removeLabelIds: starred ? [] : ['STARRED'],
    },
  });
}

/**
 * Trash Gmail messages
 */
export async function trashGmailMessages(
  account: ConnectedAccount,
  messageIds: string[]
): Promise<void> {
  const gmail = getGmailClient(account);

  for (const id of messageIds) {
    await gmail.users.messages.trash({ userId: 'me', id });
  }
}

// =====================================================
// OAUTH FLOW HELPERS
// =====================================================

/**
 * Get Gmail OAuth authorization URL
 */
export function getGmailAuthUrl(state: string): string {
  const oauth2Client = createOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    state,
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeGmailCode(
  code: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  email: string;
  name?: string;
}> {
  const oauth2Client = createOAuth2Client();

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Get user info
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();

  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token || undefined,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000),
    email: userInfo.data.email!,
    name: userInfo.data.name || undefined,
  };
}

// =====================================================
// HELPERS
// =====================================================

function parseEmailAddress(raw: string): Participant {
  // Parse "Name <email@domain.com>" format
  const match = raw.match(/(?:"?([^"]*)"?\s)?<?([^\s<>]+@[^\s<>]+)>?/);

  if (match) {
    return {
      name: match[1]?.trim() || undefined,
      address: match[2].trim(),
    };
  }

  return { address: raw.trim() };
}

function parseEmailAddresses(raw: string): Participant[] {
  if (!raw) return [];

  // Split by comma, but respect quoted strings
  const addresses = raw.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  return addresses.map((addr) => parseEmailAddress(addr.trim())).filter((p) => p.address);
}

function parseMessageBody(payload: gmail_v1.Schema$MessagePart): { bodyText?: string; bodyHtml?: string } {
  let bodyText: string | undefined;
  let bodyHtml: string | undefined;

  function extractBody(part: gmail_v1.Schema$MessagePart): void {
    if (part.body?.data) {
      const decoded = Buffer.from(part.body.data, 'base64').toString('utf-8');

      if (part.mimeType === 'text/plain' && !bodyText) {
        bodyText = decoded;
      } else if (part.mimeType === 'text/html' && !bodyHtml) {
        bodyHtml = decoded;
      }
    }

    if (part.parts) {
      for (const subPart of part.parts) {
        extractBody(subPart);
      }
    }
  }

  extractBody(payload);

  return { bodyText, bodyHtml };
}

function parseAttachments(payload: gmail_v1.Schema$MessagePart): Attachment[] {
  const attachments: Attachment[] = [];

  function extractAttachments(part: gmail_v1.Schema$MessagePart): void {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        id: part.body.attachmentId,
        name: part.filename,
        url: '', // Would need to be fetched separately
        size: part.body.size || 0,
        mimeType: part.mimeType || 'application/octet-stream',
      });
    }

    if (part.parts) {
      for (const subPart of part.parts) {
        extractAttachments(subPart);
      }
    }
  }

  extractAttachments(payload);

  return attachments;
}

// =====================================================
// REGISTER PROVIDER
// =====================================================

registerSyncProvider(gmailSyncProvider);

// =====================================================
// EXPORTS
// =====================================================

export default {
  // Sync
  syncProvider: gmailSyncProvider,

  // Actions
  sendGmailMessage,
  archiveGmailMessages,
  markGmailMessagesRead,
  starGmailMessages,
  trashGmailMessages,

  // OAuth
  getGmailAuthUrl,
  exchangeGmailCode,
};
