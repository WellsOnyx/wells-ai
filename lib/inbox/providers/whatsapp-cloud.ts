// @ts-nocheck
/**
 * WhatsApp Cloud API Integration (Native Meta API)
 *
 * FREE tier benefits:
 * - 1,000 service conversations/month FREE
 * - User-initiated messages: FREE for 24h response window
 * - Only pay for business-initiated conversations
 *
 * Setup:
 * 1. Create Meta Business Account
 * 2. Create WhatsApp Business App in Meta Developer Portal
 * 3. Get Phone Number ID and Access Token
 * 4. Configure webhook: /api/inbox/whatsapp-cloud/webhook
 *
 * Pricing (2024):
 * - User-initiated (within 24h): FREE
 * - Business-initiated: $0.05-0.15 depending on region
 * - First 1,000 conversations/month: FREE
 */

import { sql } from '@vercel/postgres';
import crypto from 'crypto';
import { triageMessage } from '../ai-triage';
import { notifyRealtime } from '../realtime';

// Meta WhatsApp Cloud API Configuration
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'wells_whatsapp_verify';
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';

const WHATSAPP_API_VERSION = 'v18.0';
const WHATSAPP_API_BASE = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;

export interface WhatsAppCloudMessage {
  id: string;
  thread_id: string;
  wa_message_id: string;
  from: string;
  to: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contacts' | 'interactive' | 'template';
  content: any; // Varies by type
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  created_at: string;
}

export interface WhatsAppCloudThread {
  id: string;
  account_id: string;
  wa_id: string; // WhatsApp ID (phone number)
  profile_name?: string;
  last_message_at: string;
  message_count: number;
  is_read: boolean;
  conversation_window_expires?: string; // 24h window for free responses
  created_at: string;
}

// ============================================================================
// MESSAGE SENDING
// ============================================================================

/**
 * Send text message via WhatsApp Cloud API
 */
export async function sendTextMessage(
  accountId: string,
  to: string,
  text: string
): Promise<WhatsAppCloudMessage> {
  try {
    const response = await fetch(
      `${WHATSAPP_API_BASE}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: normalizePhoneNumber(to),
          type: 'text',
          text: { body: text },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const waMessageId = data.messages[0].id;

    // Store message
    const thread = await findOrCreateThread(accountId, normalizePhoneNumber(to));

    const result = await sql`
      INSERT INTO whatsapp_cloud_messages (
        thread_id, wa_message_id, from_number, to_number,
        message_type, content, direction, status, created_at
      ) VALUES (
        ${thread.id}, ${waMessageId}, ${WHATSAPP_PHONE_NUMBER_ID}, ${normalizePhoneNumber(to)},
        'text', ${JSON.stringify({ body: text })}, 'outbound', 'sent', NOW()
      )
      RETURNING *
    `;

    await updateThreadTimestamp(thread.id);
    const message = mapMessageFromDb(result.rows[0]);
    await syncToUnifiedInbox(accountId, thread, message);

    return message;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

/**
 * Send media message (image, video, audio, document)
 */
export async function sendMediaMessage(
  accountId: string,
  to: string,
  mediaType: 'image' | 'video' | 'audio' | 'document',
  mediaUrl: string,
  caption?: string
): Promise<WhatsAppCloudMessage> {
  try {
    const mediaPayload: any = {
      link: mediaUrl,
    };

    if (caption && (mediaType === 'image' || mediaType === 'video' || mediaType === 'document')) {
      mediaPayload.caption = caption;
    }

    const response = await fetch(
      `${WHATSAPP_API_BASE}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: normalizePhoneNumber(to),
          type: mediaType,
          [mediaType]: mediaPayload,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const waMessageId = data.messages[0].id;

    const thread = await findOrCreateThread(accountId, normalizePhoneNumber(to));

    const result = await sql`
      INSERT INTO whatsapp_cloud_messages (
        thread_id, wa_message_id, from_number, to_number,
        message_type, content, direction, status, created_at
      ) VALUES (
        ${thread.id}, ${waMessageId}, ${WHATSAPP_PHONE_NUMBER_ID}, ${normalizePhoneNumber(to)},
        ${mediaType}, ${JSON.stringify({ link: mediaUrl, caption })}, 'outbound', 'sent', NOW()
      )
      RETURNING *
    `;

    await updateThreadTimestamp(thread.id);
    const message = mapMessageFromDb(result.rows[0]);
    await syncToUnifiedInbox(accountId, thread, message);

    return message;
  } catch (error) {
    console.error('Error sending WhatsApp media:', error);
    throw error;
  }
}

/**
 * Send template message (for business-initiated conversations)
 * Required when starting a conversation outside the 24h window
 */
export async function sendTemplateMessage(
  accountId: string,
  to: string,
  templateName: string,
  languageCode: string = 'en_US',
  components?: any[]
): Promise<WhatsAppCloudMessage> {
  try {
    const response = await fetch(
      `${WHATSAPP_API_BASE}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: normalizePhoneNumber(to),
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components: components || [],
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const waMessageId = data.messages[0].id;

    const thread = await findOrCreateThread(accountId, normalizePhoneNumber(to));

    const result = await sql`
      INSERT INTO whatsapp_cloud_messages (
        thread_id, wa_message_id, from_number, to_number,
        message_type, content, direction, status, created_at
      ) VALUES (
        ${thread.id}, ${waMessageId}, ${WHATSAPP_PHONE_NUMBER_ID}, ${normalizePhoneNumber(to)},
        'template', ${JSON.stringify({ name: templateName, language: languageCode, components })},
        'outbound', 'sent', NOW()
      )
      RETURNING *
    `;

    await updateThreadTimestamp(thread.id);
    const message = mapMessageFromDb(result.rows[0]);
    await syncToUnifiedInbox(accountId, thread, message);

    return message;
  } catch (error) {
    console.error('Error sending WhatsApp template:', error);
    throw error;
  }
}

/**
 * Send interactive message (buttons, lists)
 */
export async function sendInteractiveMessage(
  accountId: string,
  to: string,
  interactive: {
    type: 'button' | 'list';
    header?: any;
    body: { text: string };
    footer?: { text: string };
    action: any;
  }
): Promise<WhatsAppCloudMessage> {
  try {
    const response = await fetch(
      `${WHATSAPP_API_BASE}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: normalizePhoneNumber(to),
          type: 'interactive',
          interactive,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const waMessageId = data.messages[0].id;

    const thread = await findOrCreateThread(accountId, normalizePhoneNumber(to));

    const result = await sql`
      INSERT INTO whatsapp_cloud_messages (
        thread_id, wa_message_id, from_number, to_number,
        message_type, content, direction, status, created_at
      ) VALUES (
        ${thread.id}, ${waMessageId}, ${WHATSAPP_PHONE_NUMBER_ID}, ${normalizePhoneNumber(to)},
        'interactive', ${JSON.stringify(interactive)}, 'outbound', 'sent', NOW()
      )
      RETURNING *
    `;

    await updateThreadTimestamp(thread.id);
    const message = mapMessageFromDb(result.rows[0]);
    await syncToUnifiedInbox(accountId, thread, message);

    return message;
  } catch (error) {
    console.error('Error sending WhatsApp interactive:', error);
    throw error;
  }
}

// ============================================================================
// WEBHOOK HANDLING
// ============================================================================

/**
 * Verify webhook (GET request from Meta)
 */
export function verifyWebhook(
  mode: string,
  token: string,
  challenge: string
): string | null {
  if (mode === 'subscribe' && token === WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return challenge;
  }
  return null;
}

/**
 * Validate webhook signature
 */
export function validateWebhookSignature(
  signature: string,
  body: string
): boolean {
  if (!WHATSAPP_APP_SECRET) return true; // Skip in dev

  const expectedSignature = crypto
    .createHmac('sha256', WHATSAPP_APP_SECRET)
    .update(body)
    .digest('hex');

  return `sha256=${expectedSignature}` === signature;
}

/**
 * Process incoming webhook payload
 */
export async function processWebhook(payload: any): Promise<void> {
  const entry = payload.entry?.[0];
  if (!entry) return;

  const changes = entry.changes || [];

  for (const change of changes) {
    if (change.field !== 'messages') continue;

    const value = change.value;
    const contacts = value.contacts || [];
    const messages = value.messages || [];
    const statuses = value.statuses || [];

    // Process incoming messages
    for (const message of messages) {
      await handleInboundMessage(message, contacts);
    }

    // Process status updates
    for (const status of statuses) {
      await handleStatusUpdate(status);
    }
  }
}

/**
 * Handle inbound message
 */
async function handleInboundMessage(message: any, contacts: any[]): Promise<void> {
  try {
    const {
      id: waMessageId,
      from,
      timestamp,
      type,
      text,
      image,
      video,
      audio,
      document,
      location,
      contacts: msgContacts,
      interactive,
      button,
    } = message;

    // Get contact info
    const contact = contacts.find((c: any) => c.wa_id === from);
    const profileName = contact?.profile?.name;

    // Find account by phone number
    const accountResult = await sql`
      SELECT id FROM accounts
      WHERE whatsapp_phone_number_id = ${WHATSAPP_PHONE_NUMBER_ID}
      LIMIT 1
    `;

    let accountId = 'system';
    if (accountResult.rows.length > 0) {
      accountId = accountResult.rows[0].id;
    }

    // Find or create thread
    const thread = await findOrCreateThread(accountId, from, profileName);

    // Extract content based on type
    let content: any = {};
    switch (type) {
      case 'text':
        content = { body: text?.body };
        break;
      case 'image':
        content = { id: image?.id, caption: image?.caption, mime_type: image?.mime_type };
        break;
      case 'video':
        content = { id: video?.id, caption: video?.caption, mime_type: video?.mime_type };
        break;
      case 'audio':
        content = { id: audio?.id, mime_type: audio?.mime_type };
        break;
      case 'document':
        content = { id: document?.id, filename: document?.filename, caption: document?.caption };
        break;
      case 'location':
        content = { latitude: location?.latitude, longitude: location?.longitude, name: location?.name };
        break;
      case 'contacts':
        content = { contacts: msgContacts };
        break;
      case 'interactive':
        content = interactive;
        break;
      case 'button':
        content = { text: button?.text, payload: button?.payload };
        break;
    }

    // Store message
    const result = await sql`
      INSERT INTO whatsapp_cloud_messages (
        thread_id, wa_message_id, from_number, to_number,
        message_type, content, direction, status, timestamp, created_at
      ) VALUES (
        ${thread.id}, ${waMessageId}, ${from}, ${WHATSAPP_PHONE_NUMBER_ID},
        ${type}, ${JSON.stringify(content)}, 'inbound', 'delivered',
        ${new Date(parseInt(timestamp) * 1000).toISOString()}, NOW()
      )
      ON CONFLICT (wa_message_id) DO NOTHING
      RETURNING *
    `;

    if (result.rows.length === 0) return; // Duplicate

    const dbMessage = mapMessageFromDb(result.rows[0]);

    // Update thread with 24h window
    await sql`
      UPDATE whatsapp_cloud_threads
      SET
        last_message_at = NOW(),
        message_count = message_count + 1,
        is_read = false,
        conversation_window_expires = NOW() + INTERVAL '24 hours'
      WHERE id = ${thread.id}
    `;

    // Sync to unified inbox
    await syncToUnifiedInbox(accountId, thread, dbMessage);

    // Real-time notification
    await notifyRealtime(accountId, 'whatsapp_cloud_message', {
      thread_id: thread.id,
      message: dbMessage,
    });
  } catch (error) {
    console.error('Error handling inbound WhatsApp message:', error);
  }
}

/**
 * Handle status update (sent, delivered, read)
 */
async function handleStatusUpdate(status: any): Promise<void> {
  try {
    const { id: waMessageId, status: newStatus, timestamp } = status;

    await sql`
      UPDATE whatsapp_cloud_messages
      SET status = ${newStatus}
      WHERE wa_message_id = ${waMessageId}
    `;
  } catch (error) {
    console.error('Error handling status update:', error);
  }
}

// ============================================================================
// THREAD OPERATIONS
// ============================================================================

async function findOrCreateThread(
  accountId: string,
  waId: string,
  profileName?: string
): Promise<WhatsAppCloudThread> {
  const existing = await sql`
    SELECT * FROM whatsapp_cloud_threads
    WHERE account_id = ${accountId}
      AND wa_id = ${waId}
    LIMIT 1
  `;

  if (existing.rows.length > 0) {
    if (profileName && !existing.rows[0].profile_name) {
      await sql`
        UPDATE whatsapp_cloud_threads
        SET profile_name = ${profileName}
        WHERE id = ${existing.rows[0].id}
      `;
    }
    return mapThreadFromDb(existing.rows[0]);
  }

  const result = await sql`
    INSERT INTO whatsapp_cloud_threads (
      account_id, wa_id, profile_name,
      last_message_at, message_count, is_read, created_at
    ) VALUES (
      ${accountId}, ${waId}, ${profileName || null},
      NOW(), 0, false, NOW()
    )
    RETURNING *
  `;

  return mapThreadFromDb(result.rows[0]);
}

async function updateThreadTimestamp(threadId: string): Promise<void> {
  await sql`
    UPDATE whatsapp_cloud_threads
    SET
      last_message_at = NOW(),
      message_count = message_count + 1
    WHERE id = ${threadId}
  `;
}

// ============================================================================
// UNIFIED INBOX SYNC
// ============================================================================

async function syncToUnifiedInbox(
  accountId: string,
  thread: WhatsAppCloudThread,
  message: WhatsAppCloudMessage
): Promise<void> {
  try {
    let triageResult = null;
    const messageText = message.type === 'text' ? message.content?.body : `[${message.type}]`;

    if (message.direction === 'inbound') {
      triageResult = await triageMessage(messageText, {
        provider: 'whatsapp_cloud',
        sender: thread.profile_name || thread.wa_id,
      });
    }

    const existingThread = await sql`
      SELECT id FROM inbox_threads
      WHERE provider = 'whatsapp_cloud'
        AND provider_thread_id = ${thread.id}
      LIMIT 1
    `;

    let inboxThreadId: string;

    if (existingThread.rows.length === 0) {
      const newThread = await sql`
        INSERT INTO inbox_threads (
          account_id, provider, provider_thread_id,
          subject, participants, last_message_at,
          is_read, message_count, labels, metadata, created_at
        ) VALUES (
          ${accountId}, 'whatsapp_cloud', ${thread.id},
          ${`WhatsApp: ${thread.profile_name || formatPhoneDisplay(thread.wa_id)}`},
          ${JSON.stringify([{
            type: 'whatsapp',
            wa_id: thread.wa_id,
            name: thread.profile_name,
          }])},
          NOW(), false, 1,
          ${JSON.stringify(['whatsapp'])},
          ${JSON.stringify({
            wa_id: thread.wa_id,
            profile_name: thread.profile_name,
            conversation_window_expires: thread.conversation_window_expires,
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

    await sql`
      INSERT INTO inbox_messages_v2 (
        thread_id, provider, provider_message_id,
        from_contact, to_contacts, body, direction,
        triage_priority, triage_category, triage_sentiment,
        triage_summary, metadata, created_at
      ) VALUES (
        ${inboxThreadId}, 'whatsapp_cloud', ${message.id},
        ${JSON.stringify({ wa_id: message.from, name: thread.profile_name })},
        ${JSON.stringify([{ wa_id: message.to }])},
        ${messageText}, ${message.direction},
        ${triageResult?.priority || null},
        ${triageResult?.category || null},
        ${triageResult?.sentiment || null},
        ${triageResult?.summary || null},
        ${JSON.stringify({
          type: message.type,
          content: message.content,
          wa_message_id: message.wa_message_id,
        })},
        NOW()
      )
    `;
  } catch (error) {
    console.error('Error syncing WhatsApp Cloud to unified inbox:', error);
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
): Promise<WhatsAppCloudThread[]> {
  const { limit = 50, offset = 0, unreadOnly = false } = options;

  let result;
  if (unreadOnly) {
    result = await sql`
      SELECT * FROM whatsapp_cloud_threads
      WHERE account_id = ${accountId}
        AND is_read = false
      ORDER BY last_message_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else {
    result = await sql`
      SELECT * FROM whatsapp_cloud_threads
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
): Promise<WhatsAppCloudMessage[]> {
  const { limit = 100, offset = 0 } = options;

  const result = await sql`
    SELECT * FROM whatsapp_cloud_messages
    WHERE thread_id = ${threadId}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return result.rows.map(mapMessageFromDb);
}

export async function markThreadAsRead(threadId: string): Promise<void> {
  await sql`
    UPDATE whatsapp_cloud_threads
    SET is_read = true
    WHERE id = ${threadId}
  `;
}

/**
 * Check if we're in the free 24h response window
 */
export async function isInConversationWindow(threadId: string): Promise<boolean> {
  const result = await sql`
    SELECT conversation_window_expires FROM whatsapp_cloud_threads
    WHERE id = ${threadId}
  `;

  if (result.rows.length === 0) return false;

  const expires = result.rows[0].conversation_window_expires;
  if (!expires) return false;

  return new Date(expires) > new Date();
}

// ============================================================================
// HELPERS
// ============================================================================

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return `+${digits}`;
}

function mapThreadFromDb(row: any): WhatsAppCloudThread {
  return {
    id: row.id,
    account_id: row.account_id,
    wa_id: row.wa_id,
    profile_name: row.profile_name,
    last_message_at: row.last_message_at,
    message_count: row.message_count,
    is_read: row.is_read,
    conversation_window_expires: row.conversation_window_expires,
    created_at: row.created_at,
  };
}

function mapMessageFromDb(row: any): WhatsAppCloudMessage {
  return {
    id: row.id,
    thread_id: row.thread_id,
    wa_message_id: row.wa_message_id,
    from: row.from_number,
    to: row.to_number,
    type: row.message_type,
    content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
    direction: row.direction,
    status: row.status,
    timestamp: row.timestamp,
    created_at: row.created_at,
  };
}

export default {
  sendTextMessage,
  sendMediaMessage,
  sendTemplateMessage,
  sendInteractiveMessage,
  verifyWebhook,
  validateWebhookSignature,
  processWebhook,
  getConversations,
  getThreadMessages,
  markThreadAsRead,
  isInConversationWindow,
};
