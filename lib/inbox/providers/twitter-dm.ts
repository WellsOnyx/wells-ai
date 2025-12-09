// @ts-nocheck
/**
 * X (Twitter) Direct Message Integration
 *
 * Uses Twitter API v2 for DM functionality.
 * Requires:
 * - Twitter Developer Account
 * - OAuth 2.0 with PKCE
 * - Account Activity API for webhooks
 *
 * Setup:
 * 1. Create Twitter Developer App
 * 2. Enable OAuth 2.0 with PKCE
 * 3. Enable Account Activity API
 * 4. Set callback URL: /api/inbox/twitter/callback
 * 5. Set webhook URL: /api/inbox/twitter/webhook
 */

import { sql } from '@vercel/postgres';
import crypto from 'crypto';
import { triageMessage } from '../ai-triage';
import { notifyRealtime } from '../realtime';

// Twitter API Configuration
const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID || '';
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET || '';
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN || '';
const TWITTER_API_KEY = process.env.TWITTER_API_KEY || '';
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET || '';
const TWITTER_WEBHOOK_ENV = process.env.TWITTER_WEBHOOK_ENV || 'production';

const TWITTER_API_BASE = 'https://api.twitter.com/2';
const TWITTER_OAUTH_BASE = 'https://twitter.com/i/oauth2';

export interface TwitterDM {
  id: string;
  thread_id: string;
  sender_id: string;
  recipient_id: string;
  text: string;
  media_urls?: string[];
  direction: 'inbound' | 'outbound';
  created_at: string;
}

export interface TwitterDMThread {
  id: string;
  account_id: string;
  participant_id: string;
  participant_username?: string;
  participant_name?: string;
  participant_profile_image?: string;
  last_message_at: string;
  message_count: number;
  is_read: boolean;
  created_at: string;
}

export interface TwitterToken {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  twitter_user_id: string;
}

// ============================================================================
// OAUTH 2.0 WITH PKCE
// ============================================================================

/**
 * Generate OAuth authorization URL
 */
export function getAuthorizationUrl(
  accountId: string,
  redirectUri: string
): { url: string; state: string; codeVerifier: string } {
  // Generate PKCE code verifier and challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  // Generate state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');

  // Build authorization URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: TWITTER_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'dm.read dm.write tweet.read users.read offline.access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return {
    url: `${TWITTER_OAUTH_BASE}/authorize?${params.toString()}`,
    state,
    codeVerifier,
  };
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<TwitterToken> {
  const response = await fetch(`${TWITTER_OAUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();

  // Get user info to get twitter_user_id
  const userResponse = await fetch(`${TWITTER_API_BASE}/users/me`, {
    headers: {
      Authorization: `Bearer ${data.access_token}`,
    },
  });

  const userData = await userResponse.json();

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    twitter_user_id: userData.data.id,
  };
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TwitterToken> {
  const response = await fetch(`${TWITTER_OAUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  const data = await response.json();

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    twitter_user_id: '', // Will be set from stored data
  };
}

/**
 * Get valid access token (refreshing if needed)
 */
async function getValidToken(accountId: string): Promise<string> {
  const result = await sql`
    SELECT * FROM twitter_tokens
    WHERE account_id = ${accountId}
    LIMIT 1
  `;

  if (result.rows.length === 0) {
    throw new Error('No Twitter account connected');
  }

  const tokenData = result.rows[0];

  // Check if token is expired (with 5 minute buffer)
  if (Date.now() > tokenData.expires_at - 5 * 60 * 1000) {
    const newTokens = await refreshAccessToken(tokenData.refresh_token);

    await sql`
      UPDATE twitter_tokens
      SET
        access_token = ${newTokens.access_token},
        refresh_token = ${newTokens.refresh_token},
        expires_at = ${newTokens.expires_at}
      WHERE account_id = ${accountId}
    `;

    return newTokens.access_token;
  }

  return tokenData.access_token;
}

// ============================================================================
// DM OPERATIONS
// ============================================================================

/**
 * Send a DM via Twitter API v2
 */
export async function sendDM(
  accountId: string,
  recipientId: string,
  text: string,
  mediaIds?: string[]
): Promise<TwitterDM> {
  try {
    const accessToken = await getValidToken(accountId);

    // Get our Twitter user ID
    const tokenResult = await sql`
      SELECT twitter_user_id FROM twitter_tokens
      WHERE account_id = ${accountId}
    `;
    const senderId = tokenResult.rows[0]?.twitter_user_id;

    // Build message payload
    const messagePayload: any = {
      text,
    };

    if (mediaIds && mediaIds.length > 0) {
      messagePayload.attachments = mediaIds.map(id => ({ media_id: id }));
    }

    // Send DM via Twitter API
    const response = await fetch(
      `${TWITTER_API_BASE}/dm_conversations/with/${recipientId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(messagePayload),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to send DM: ${JSON.stringify(error)}`);
    }

    const data = await response.json();

    // Find or create thread
    const thread = await findOrCreateThread(accountId, recipientId);

    // Store message in database
    const result = await sql`
      INSERT INTO twitter_dm_messages (
        thread_id, twitter_message_id, sender_id, recipient_id,
        text, direction, created_at
      ) VALUES (
        ${thread.id}, ${data.data.dm_event_id}, ${senderId}, ${recipientId},
        ${text}, 'outbound', NOW()
      )
      RETURNING *
    `;

    const message = mapMessageFromDb(result.rows[0]);

    // Update thread
    await updateThreadTimestamp(thread.id);

    // Sync to unified inbox
    await syncToUnifiedInbox(accountId, thread, message);

    return message;
  } catch (error) {
    console.error('Error sending Twitter DM:', error);
    throw error;
  }
}

/**
 * Handle inbound DM from webhook
 */
export async function handleInboundDM(
  accountId: string,
  event: any
): Promise<TwitterDM> {
  try {
    const {
      id: eventId,
      dm_conversation_id: conversationId,
      sender_id: senderId,
      text,
      created_timestamp: createdAt,
      attachment,
    } = event;

    // Get recipient (our account)
    const tokenResult = await sql`
      SELECT twitter_user_id FROM twitter_tokens
      WHERE account_id = ${accountId}
    `;
    const recipientId = tokenResult.rows[0]?.twitter_user_id;

    // Find or create thread
    const thread = await findOrCreateThread(accountId, senderId);

    // Extract media URLs from attachment
    const mediaUrls: string[] = [];
    if (attachment?.media) {
      mediaUrls.push(attachment.media.url || attachment.media.preview_image_url);
    }

    // Store message
    const result = await sql`
      INSERT INTO twitter_dm_messages (
        thread_id, twitter_message_id, sender_id, recipient_id,
        text, media_urls, direction, created_at
      ) VALUES (
        ${thread.id}, ${eventId}, ${senderId}, ${recipientId},
        ${text || ''}, ${mediaUrls.length > 0 ? JSON.stringify(mediaUrls) : null},
        'inbound', ${new Date(parseInt(createdAt)).toISOString()}
      )
      ON CONFLICT (twitter_message_id) DO NOTHING
      RETURNING *
    `;

    if (result.rows.length === 0) {
      // Message already exists (duplicate webhook)
      const existing = await sql`
        SELECT * FROM twitter_dm_messages
        WHERE twitter_message_id = ${eventId}
      `;
      return mapMessageFromDb(existing.rows[0]);
    }

    const message = mapMessageFromDb(result.rows[0]);

    // Update thread
    await updateThreadTimestamp(thread.id);

    // Sync to unified inbox
    await syncToUnifiedInbox(accountId, thread, message);

    // Send real-time notification
    await notifyRealtime(accountId, 'twitter_dm', {
      thread_id: thread.id,
      message,
    });

    return message;
  } catch (error) {
    console.error('Error handling inbound Twitter DM:', error);
    throw error;
  }
}

/**
 * Fetch DM conversations from Twitter
 */
export async function fetchDMConversations(
  accountId: string,
  options: {
    limit?: number;
    pagination_token?: string;
  } = {}
): Promise<{ conversations: TwitterDMThread[]; next_token?: string }> {
  try {
    const accessToken = await getValidToken(accountId);
    const { limit = 20, pagination_token } = options;

    const params = new URLSearchParams({
      max_results: limit.toString(),
      'dm_event.fields': 'id,text,sender_id,created_at,attachments',
      expansions: 'sender_id,attachments.media_keys',
      'user.fields': 'id,name,username,profile_image_url',
    });

    if (pagination_token) {
      params.append('pagination_token', pagination_token);
    }

    const response = await fetch(
      `${TWITTER_API_BASE}/dm_conversations?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch DM conversations');
    }

    const data = await response.json();

    // Process and store conversations
    const conversations: TwitterDMThread[] = [];

    for (const conv of data.data || []) {
      // Get participant info from includes
      const participant = data.includes?.users?.find(
        (u: any) => u.id === conv.participant_ids?.find((id: string) => id !== accountId)
      );

      const thread = await findOrCreateThread(
        accountId,
        participant?.id || conv.participant_ids?.[0],
        participant?.username,
        participant?.name,
        participant?.profile_image_url
      );

      conversations.push(thread);
    }

    return {
      conversations,
      next_token: data.meta?.next_token,
    };
  } catch (error) {
    console.error('Error fetching Twitter DM conversations:', error);
    throw error;
  }
}

// ============================================================================
// WEBHOOK HANDLING (Account Activity API)
// ============================================================================

/**
 * Generate CRC response for webhook verification
 */
export function generateCRCResponse(crcToken: string): string {
  const hmac = crypto.createHmac('sha256', TWITTER_API_SECRET);
  hmac.update(crcToken);
  return `sha256=${hmac.digest('base64')}`;
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  signature: string,
  body: string
): boolean {
  const hmac = crypto.createHmac('sha256', TWITTER_API_SECRET);
  hmac.update(body);
  const expectedSignature = `sha256=${hmac.digest('base64')}`;
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Process webhook event
 */
export async function processWebhookEvent(
  userId: string,
  event: any
): Promise<void> {
  // Find account by Twitter user ID
  const accountResult = await sql`
    SELECT account_id FROM twitter_tokens
    WHERE twitter_user_id = ${userId}
    LIMIT 1
  `;

  if (accountResult.rows.length === 0) {
    console.warn(`No account found for Twitter user ${userId}`);
    return;
  }

  const accountId = accountResult.rows[0].account_id;

  // Process DM events
  if (event.direct_message_events) {
    for (const dmEvent of event.direct_message_events) {
      if (dmEvent.type === 'message_create') {
        // Skip messages sent by us
        const senderId = dmEvent.message_create.sender_id;
        if (senderId === userId) continue;

        await handleInboundDM(accountId, {
          id: dmEvent.id,
          dm_conversation_id: dmEvent.message_create.target.recipient_id,
          sender_id: senderId,
          text: dmEvent.message_create.message_data.text,
          created_timestamp: dmEvent.created_timestamp,
          attachment: dmEvent.message_create.message_data.attachment,
        });
      }
    }
  }
}

// ============================================================================
// THREAD OPERATIONS
// ============================================================================

async function findOrCreateThread(
  accountId: string,
  participantId: string,
  username?: string,
  name?: string,
  profileImage?: string
): Promise<TwitterDMThread> {
  // Try to find existing thread
  const existing = await sql`
    SELECT * FROM twitter_dm_threads
    WHERE account_id = ${accountId}
      AND participant_id = ${participantId}
    LIMIT 1
  `;

  if (existing.rows.length > 0) {
    // Update participant info if we have new data
    if (username || name || profileImage) {
      await sql`
        UPDATE twitter_dm_threads
        SET
          participant_username = COALESCE(${username}, participant_username),
          participant_name = COALESCE(${name}, participant_name),
          participant_profile_image = COALESCE(${profileImage}, participant_profile_image)
        WHERE id = ${existing.rows[0].id}
      `;
    }
    return mapThreadFromDb(existing.rows[0]);
  }

  // Create new thread
  const result = await sql`
    INSERT INTO twitter_dm_threads (
      account_id, participant_id, participant_username,
      participant_name, participant_profile_image,
      last_message_at, message_count, is_read, created_at
    ) VALUES (
      ${accountId}, ${participantId}, ${username || null},
      ${name || null}, ${profileImage || null},
      NOW(), 0, false, NOW()
    )
    RETURNING *
  `;

  return mapThreadFromDb(result.rows[0]);
}

async function updateThreadTimestamp(threadId: string): Promise<void> {
  await sql`
    UPDATE twitter_dm_threads
    SET
      last_message_at = NOW(),
      message_count = message_count + 1,
      is_read = false
    WHERE id = ${threadId}
  `;
}

// ============================================================================
// UNIFIED INBOX SYNC
// ============================================================================

async function syncToUnifiedInbox(
  accountId: string,
  thread: TwitterDMThread,
  message: TwitterDM
): Promise<void> {
  try {
    // Run AI triage on inbound messages
    let triageResult = null;
    if (message.direction === 'inbound') {
      triageResult = await triageMessage(message.text, {
        provider: 'twitter',
        sender: thread.participant_username || thread.participant_id,
      });
    }

    // Find or create inbox thread
    const existingThread = await sql`
      SELECT id FROM inbox_threads
      WHERE provider = 'twitter'
        AND provider_thread_id = ${thread.id}
      LIMIT 1
    `;

    let inboxThreadId: string;

    if (existingThread.rows.length === 0) {
      // Create new inbox thread
      const newThread = await sql`
        INSERT INTO inbox_threads (
          account_id, provider, provider_thread_id,
          subject, participants, last_message_at,
          is_read, message_count, labels, metadata, created_at
        ) VALUES (
          ${accountId}, 'twitter', ${thread.id},
          ${`X DM: @${thread.participant_username || thread.participant_id}`},
          ${JSON.stringify([{
            type: 'twitter',
            id: thread.participant_id,
            username: thread.participant_username,
            name: thread.participant_name,
            avatar: thread.participant_profile_image,
          }])},
          NOW(), false, 1,
          ${JSON.stringify(['twitter', 'dm'])},
          ${JSON.stringify({
            participant_id: thread.participant_id,
            participant_username: thread.participant_username,
          })},
          NOW()
        )
        RETURNING id
      `;
      inboxThreadId = newThread.rows[0].id;
    } else {
      inboxThreadId = existingThread.rows[0].id;

      await sql`
        UPDATE inbox_threads
        SET
          last_message_at = NOW(),
          is_read = false,
          message_count = message_count + 1
        WHERE id = ${inboxThreadId}
      `;
    }

    // Create inbox message
    await sql`
      INSERT INTO inbox_messages_v2 (
        thread_id, provider, provider_message_id,
        from_contact, to_contacts, body, direction,
        attachments, triage_priority, triage_category,
        triage_sentiment, triage_summary, metadata, created_at
      ) VALUES (
        ${inboxThreadId}, 'twitter', ${message.id},
        ${JSON.stringify({
          id: message.sender_id,
          username: message.direction === 'inbound' ? thread.participant_username : null,
        })},
        ${JSON.stringify([{ id: message.recipient_id }])},
        ${message.text}, ${message.direction},
        ${message.media_urls ? JSON.stringify(message.media_urls.map(url => ({
          type: 'media',
          url,
        }))) : null},
        ${triageResult?.priority || null},
        ${triageResult?.category || null},
        ${triageResult?.sentiment || null},
        ${triageResult?.summary || null},
        ${JSON.stringify({
          twitter_message_id: (message as any).twitter_message_id,
        })},
        NOW()
      )
    `;
  } catch (error) {
    console.error('Error syncing Twitter DM to unified inbox:', error);
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function getConversations(
  accountId: string,
  options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  } = {}
): Promise<TwitterDMThread[]> {
  const { limit = 50, offset = 0, unreadOnly = false } = options;

  let result;
  if (unreadOnly) {
    result = await sql`
      SELECT * FROM twitter_dm_threads
      WHERE account_id = ${accountId}
        AND is_read = false
      ORDER BY last_message_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else {
    result = await sql`
      SELECT * FROM twitter_dm_threads
      WHERE account_id = ${accountId}
      ORDER BY last_message_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  return result.rows.map(mapThreadFromDb);
}

export async function getThreadMessages(
  threadId: string,
  options: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<TwitterDM[]> {
  const { limit = 100, offset = 0 } = options;

  const result = await sql`
    SELECT * FROM twitter_dm_messages
    WHERE thread_id = ${threadId}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return result.rows.map(mapMessageFromDb);
}

export async function markThreadAsRead(threadId: string): Promise<void> {
  await sql`
    UPDATE twitter_dm_threads
    SET is_read = true
    WHERE id = ${threadId}
  `;
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

function mapThreadFromDb(row: any): TwitterDMThread {
  return {
    id: row.id,
    account_id: row.account_id,
    participant_id: row.participant_id,
    participant_username: row.participant_username,
    participant_name: row.participant_name,
    participant_profile_image: row.participant_profile_image,
    last_message_at: row.last_message_at,
    message_count: row.message_count,
    is_read: row.is_read,
    created_at: row.created_at,
  };
}

function mapMessageFromDb(row: any): TwitterDM {
  return {
    id: row.id,
    thread_id: row.thread_id,
    sender_id: row.sender_id,
    recipient_id: row.recipient_id,
    text: row.text,
    media_urls: row.media_urls ? JSON.parse(row.media_urls) : undefined,
    direction: row.direction,
    created_at: row.created_at,
  };
}

export default {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  sendDM,
  handleInboundDM,
  fetchDMConversations,
  getConversations,
  getThreadMessages,
  markThreadAsRead,
  generateCRCResponse,
  verifyWebhookSignature,
  processWebhookEvent,
};
