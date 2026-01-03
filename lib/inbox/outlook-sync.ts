/**
 * Outlook Sync Module
 * ===================
 * Syncs Outlook/Microsoft 365 messages to the unified inbox using Microsoft Graph API
 *
 * Features:
 * - Full and delta sync using Graph API
 * - OAuth token management with MSAL
 * - Batch message fetching
 * - Folder synchronization
 * - Webhook notifications via subscriptions
 */

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

interface OutlookSyncCursor {
  deltaLink?: string;
  skipToken?: string;
}

interface GraphMessage {
  id: string;
  conversationId: string;
  subject?: string;
  bodyPreview?: string;
  body?: { contentType: string; content: string };
  from?: { emailAddress: { address: string; name?: string } };
  toRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
  ccRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
  bccRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
  hasAttachments?: boolean;
  attachments?: Array<{
    id: string;
    name: string;
    size: number;
    contentType: string;
  }>;
  isRead?: boolean;
  isDraft?: boolean;
  flag?: { flagStatus: string };
  receivedDateTime?: string;
  sentDateTime?: string;
  parentFolderId?: string;
}

// =====================================================
// MICROSOFT GRAPH CLIENT
// =====================================================

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

/**
 * Make authenticated request to Microsoft Graph API
 */
async function graphRequest(
  accessToken: string,
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: any
): Promise<any> {
  const response = await fetch(`${GRAPH_API_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error.error?.message || `Graph API error: ${response.status}`);
  }

  return response.json();
}

// =====================================================
// SYNC PROVIDER
// =====================================================

const outlookSyncProvider: SyncProvider = {
  channel: 'outlook',

  /**
   * Sync Outlook messages
   */
  async sync(account: ConnectedAccount, options: SyncOptions = {}): Promise<SyncResult> {
    const result: SyncResult = {
      accountId: account.id,
      channel: 'outlook',
      messagesCreated: 0,
      messagesUpdated: 0,
      messagesSkipped: 0,
      errors: [],
      duration: 0,
    };

    if (!account.accessToken) {
      throw new Error('No access token available');
    }

    try {
      // Parse existing cursor
      let cursor: OutlookSyncCursor | null = null;
      if (account.syncCursor && !options.forceFull) {
        try {
          cursor = JSON.parse(account.syncCursor);
        } catch {
          cursor = null;
        }
      }

      // Decide sync strategy
      if (cursor?.deltaLink && !options.forceFull) {
        // Delta sync
        await syncDelta(account.accessToken, account, cursor, result, options);
      } else {
        // Full sync
        await syncFull(account.accessToken, account, result, options);
      }

      console.log(`[OutlookSync] Completed for ${account.email}: ${result.messagesCreated} created, ${result.messagesUpdated} updated`);
    } catch (error: any) {
      console.error(`[OutlookSync] Error for ${account.email}:`, error);
      result.errors.push(error.message);
      throw error;
    }

    return result;
  },

  /**
   * Process Outlook webhook notification
   */
  async processWebhook(account: ConnectedAccount, payload: any): Promise<SyncResult> {
    const result: SyncResult = {
      accountId: account.id,
      channel: 'outlook',
      messagesCreated: 0,
      messagesUpdated: 0,
      messagesSkipped: 0,
      errors: [],
      duration: 0,
    };

    if (!account.accessToken) {
      return result;
    }

    try {
      // Outlook webhooks contain resource URLs for changed items
      for (const notification of payload.value || []) {
        if (notification.resourceData?.id) {
          await importOutlookMessage(account.accessToken, notification.resourceData.id, account, result);
        }
      }
    } catch (error: any) {
      result.errors.push(error.message);
    }

    return result;
  },

  /**
   * Refresh Outlook OAuth token
   */
  async refreshToken(account: ConnectedAccount): Promise<{ accessToken: string; expiresAt: Date }> {
    if (!account.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID || '',
        client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
        refresh_token: account.refreshToken,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh Outlook token');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  },

  /**
   * Validate Outlook connection
   */
  async validateConnection(account: ConnectedAccount): Promise<boolean> {
    if (!account.accessToken) {
      return false;
    }

    try {
      await graphRequest(account.accessToken, '/me');
      return true;
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
  accessToken: string,
  account: ConnectedAccount,
  result: SyncResult,
  options: SyncOptions
): Promise<void> {
  const maxMessages = options.maxMessages || 100;

  // Use delta query to get messages and establish delta link
  let endpoint = `/me/mailFolders/inbox/messages/delta?$top=${Math.min(50, maxMessages)}&$select=id,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,hasAttachments,isRead,isDraft,flag,receivedDateTime,sentDateTime`;

  let processedCount = 0;
  let deltaLink: string | undefined;

  do {
    const response = await graphRequest(accessToken, endpoint);

    for (const message of response.value || []) {
      try {
        const imported = await importOutlookMessageData(message, account, result);
        processedCount++;
      } catch (error: any) {
        result.errors.push(`Message ${message.id}: ${error.message}`);
        result.messagesSkipped++;
      }

      if (processedCount >= maxMessages) break;
    }

    // Get next page or delta link
    if (response['@odata.nextLink']) {
      endpoint = response['@odata.nextLink'].replace(GRAPH_API_BASE, '');
    } else if (response['@odata.deltaLink']) {
      deltaLink = response['@odata.deltaLink'];
      break;
    } else {
      break;
    }
  } while (processedCount < maxMessages);

  // Save delta link for future incremental syncs
  if (deltaLink) {
    result.newCursor = JSON.stringify({ deltaLink });
  }
}

/**
 * Delta sync using stored delta link
 */
async function syncDelta(
  accessToken: string,
  account: ConnectedAccount,
  cursor: OutlookSyncCursor,
  result: SyncResult,
  options: SyncOptions
): Promise<void> {
  if (!cursor.deltaLink) {
    return syncFull(accessToken, account, result, options);
  }

  let endpoint = cursor.deltaLink.replace(GRAPH_API_BASE, '');
  let newDeltaLink: string | undefined;

  try {
    do {
      const response = await graphRequest(accessToken, endpoint);

      for (const message of response.value || []) {
        // Check if message was deleted
        if (message['@removed']) {
          await handleDeletedMessage(message.id, account);
          continue;
        }

        try {
          await importOutlookMessageData(message, account, result);
        } catch (error: any) {
          result.errors.push(`Message ${message.id}: ${error.message}`);
          result.messagesSkipped++;
        }
      }

      // Get next page or delta link
      if (response['@odata.nextLink']) {
        endpoint = response['@odata.nextLink'].replace(GRAPH_API_BASE, '');
      } else if (response['@odata.deltaLink']) {
        newDeltaLink = response['@odata.deltaLink'];
        break;
      } else {
        break;
      }
    } while (true);

    if (newDeltaLink) {
      result.newCursor = JSON.stringify({ deltaLink: newDeltaLink });
    }
  } catch (error: any) {
    // If delta link is expired, fall back to full sync
    if (error.message?.includes('resync') || error.message?.includes('syncStateNotFound')) {
      console.log('[OutlookSync] Delta link expired, falling back to full sync');
      return syncFull(accessToken, account, result, options);
    }
    throw error;
  }
}

// =====================================================
// MESSAGE IMPORT
// =====================================================

/**
 * Import a single Outlook message by ID
 */
async function importOutlookMessage(
  accessToken: string,
  messageId: string,
  account: ConnectedAccount,
  result: SyncResult
): Promise<'created' | 'updated' | 'skipped'> {
  const message = await graphRequest(
    accessToken,
    `/me/messages/${messageId}?$select=id,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,hasAttachments,isRead,isDraft,flag,receivedDateTime,sentDateTime`
  );

  return importOutlookMessageData(message, account, result);
}

/**
 * Import Outlook message from data
 */
async function importOutlookMessageData(
  message: GraphMessage,
  account: ConnectedAccount,
  result: SyncResult
): Promise<'created' | 'updated' | 'skipped'> {
  // Check if already exists
  const existing = await query(
    `SELECT id FROM unified_messages
     WHERE channel_message_id = $1 AND account_id = $2`,
    [message.id, account.id]
  );

  if (existing.rows.length > 0) {
    // Update existing message (for label/read status changes)
    await query(
      `UPDATE unified_messages
       SET
         is_read = $2,
         is_starred = $3,
         updated_at = NOW()
       WHERE id = $1`,
      [existing.rows[0].id, message.isRead ?? true, message.flag?.flagStatus === 'flagged']
    );
    result.messagesUpdated++;
    return 'updated';
  }

  // Parse participants
  const from: Participant = message.from?.emailAddress
    ? { address: message.from.emailAddress.address, name: message.from.emailAddress.name }
    : { address: 'unknown@unknown.com' };

  const to: Participant[] = (message.toRecipients || []).map((r) => ({
    address: r.emailAddress.address,
    name: r.emailAddress.name,
  }));

  const cc: Participant[] = (message.ccRecipients || []).map((r) => ({
    address: r.emailAddress.address,
    name: r.emailAddress.name,
  }));

  // Determine direction
  const isFromMe = from.address.toLowerCase() === account.email?.toLowerCase();
  const direction = isFromMe ? 'outbound' : 'inbound';

  // Parse body
  const bodyHtml = message.body?.contentType === 'html' ? message.body.content : undefined;
  const bodyText = message.body?.contentType === 'text' ? message.body.content : message.bodyPreview;

  // Create unified message
  await createMessage(account.userId, {
    channel: 'outlook' as InboxChannel,
    channelMessageId: message.id,
    channelThreadId: message.conversationId,
    accountId: account.id,
    direction,
    from,
    to,
    cc,
    subject: message.subject,
    bodyText,
    bodyHtml,
    snippet: message.bodyPreview,
    attachments: [], // Would need separate fetch
    isRead: message.isRead ?? true,
    isDraft: message.isDraft ?? false,
    receivedAt: message.receivedDateTime ? new Date(message.receivedDateTime) : undefined,
    sentAt: message.sentDateTime ? new Date(message.sentDateTime) : undefined,
  });

  result.messagesCreated++;
  return 'created';
}

/**
 * Handle deleted message
 */
async function handleDeletedMessage(messageId: string, account: ConnectedAccount): Promise<void> {
  await query(
    `UPDATE unified_messages
     SET is_trashed = true, updated_at = NOW()
     WHERE channel_message_id = $1 AND account_id = $2`,
    [messageId, account.id]
  );
}

// =====================================================
// OUTLOOK ACTIONS
// =====================================================

/**
 * Send email via Outlook
 */
export async function sendOutlookMessage(
  account: ConnectedAccount,
  to: string[],
  subject: string,
  body: string,
  options?: {
    cc?: string[];
    bcc?: string[];
    replyToMessageId?: string;
    html?: boolean;
    saveToSentItems?: boolean;
  }
): Promise<string> {
  if (!account.accessToken) {
    throw new Error('No access token available');
  }

  const message = {
    subject,
    body: {
      contentType: options?.html ? 'HTML' : 'Text',
      content: body,
    },
    toRecipients: to.map((email) => ({ emailAddress: { address: email } })),
    ccRecipients: options?.cc?.map((email) => ({ emailAddress: { address: email } })) || [],
    bccRecipients: options?.bcc?.map((email) => ({ emailAddress: { address: email } })) || [],
  };

  let endpoint = '/me/sendMail';
  const requestBody: any = {
    message,
    saveToSentItems: options?.saveToSentItems !== false,
  };

  // If replying, use reply endpoint
  if (options?.replyToMessageId) {
    endpoint = `/me/messages/${options.replyToMessageId}/reply`;
    requestBody.message = message;
    requestBody.comment = body;
  }

  await graphRequest(account.accessToken, endpoint, 'POST', requestBody);

  return 'sent'; // Outlook doesn't return message ID on send
}

/**
 * Archive Outlook messages (move to archive folder)
 */
export async function archiveOutlookMessages(
  account: ConnectedAccount,
  messageIds: string[]
): Promise<void> {
  if (!account.accessToken) {
    throw new Error('No access token available');
  }

  // Get archive folder ID
  const folders = await graphRequest(account.accessToken, '/me/mailFolders');
  const archiveFolder = folders.value?.find((f: any) => f.displayName === 'Archive');

  if (!archiveFolder) {
    throw new Error('Archive folder not found');
  }

  // Move messages
  for (const messageId of messageIds) {
    await graphRequest(account.accessToken, `/me/messages/${messageId}/move`, 'POST', {
      destinationId: archiveFolder.id,
    });
  }
}

/**
 * Mark Outlook messages as read/unread
 */
export async function markOutlookMessagesRead(
  account: ConnectedAccount,
  messageIds: string[],
  read: boolean
): Promise<void> {
  if (!account.accessToken) {
    throw new Error('No access token available');
  }

  for (const messageId of messageIds) {
    await graphRequest(account.accessToken, `/me/messages/${messageId}`, 'PATCH', {
      isRead: read,
    });
  }
}

/**
 * Flag/unflag Outlook messages (equivalent to starring)
 */
export async function flagOutlookMessages(
  account: ConnectedAccount,
  messageIds: string[],
  flagged: boolean
): Promise<void> {
  if (!account.accessToken) {
    throw new Error('No access token available');
  }

  for (const messageId of messageIds) {
    await graphRequest(account.accessToken, `/me/messages/${messageId}`, 'PATCH', {
      flag: { flagStatus: flagged ? 'flagged' : 'notFlagged' },
    });
  }
}

/**
 * Delete Outlook messages
 */
export async function deleteOutlookMessages(
  account: ConnectedAccount,
  messageIds: string[]
): Promise<void> {
  if (!account.accessToken) {
    throw new Error('No access token available');
  }

  for (const messageId of messageIds) {
    await graphRequest(account.accessToken, `/me/messages/${messageId}`, 'DELETE');
  }
}

// =====================================================
// OAUTH FLOW HELPERS
// =====================================================

/**
 * Get Outlook OAuth authorization URL
 */
export function getOutlookAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID || '',
    response_type: 'code',
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/inbox/outlook/callback`,
    scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access',
    state,
    prompt: 'consent',
  });

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeOutlookCode(
  code: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  email: string;
  name?: string;
}> {
  const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID || '',
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
      code,
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/inbox/outlook/callback`,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to exchange code for tokens');
  }

  const tokens = await tokenResponse.json();

  // Get user info
  const userInfo = await graphRequest(tokens.access_token, '/me');

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    email: userInfo.mail || userInfo.userPrincipalName,
    name: userInfo.displayName,
  };
}

// =====================================================
// REGISTER PROVIDER
// =====================================================

registerSyncProvider(outlookSyncProvider);

// =====================================================
// EXPORTS
// =====================================================

export default {
  // Sync
  syncProvider: outlookSyncProvider,

  // Actions
  sendOutlookMessage,
  archiveOutlookMessages,
  markOutlookMessagesRead,
  flagOutlookMessages,
  deleteOutlookMessages,

  // OAuth
  getOutlookAuthUrl,
  exchangeOutlookCode,
};
