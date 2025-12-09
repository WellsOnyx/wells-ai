// @ts-nocheck
/**
 * WhatsApp Integration via Twilio
 *
 * Uses same Twilio account as SMS - just different phone format.
 * WhatsApp numbers use 'whatsapp:+1234567890' format.
 *
 * Setup:
 * 1. Enable WhatsApp in Twilio Console
 * 2. Set up WhatsApp-enabled number or use Twilio sandbox
 * 3. Configure webhook: /api/inbox/whatsapp/webhook
 */

import twilio from 'twilio';
import { sql } from '@vercel/postgres';
import { triageMessage } from '../ai-triage';
import { publishMessage } from '../realtime';

// Lazy initialization
const getTwilioClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    return { messages: { create: () => Promise.resolve({ sid: 'mock', status: 'mock' }) } } as any;
  }
  return twilio(accountSid, authToken);
};

// WhatsApp number format
const WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER || '';

export interface WhatsAppMessage {
  id: string;
  thread_id: string;
  from: string;
  to: string;
  body: string;
  media_urls?: string[];
  direction: 'inbound' | 'outbound';
  status: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location';
  created_at: string;
}

export interface WhatsAppThread {
  id: string;
  account_id: string;
  whatsapp_id: string; // Phone number in whatsapp format
  contact_name?: string;
  profile_picture_url?: string;
  last_message_at: string;
  message_count: number;
  is_read: boolean;
  created_at: string;
}

/**
 * Format phone number for WhatsApp
 */
function formatWhatsAppNumber(phone: string): string {
  // Remove any existing whatsapp: prefix
  let digits = phone.replace(/^whatsapp:/i, '').replace(/\D/g, '');

  // Add country code if missing (default to US)
  if (digits.length === 10) {
    digits = '1' + digits;
  }

  return `whatsapp:+${digits}`;
}

/**
 * Extract raw phone from WhatsApp format
 */
function extractPhoneFromWhatsApp(whatsappId: string): string {
  return whatsappId.replace(/^whatsapp:\+?/i, '');
}

/**
 * Send WhatsApp message via Twilio
 */
export async function sendWhatsApp(
  accountId: string,
  to: string,
  body: string,
  mediaUrls?: string[]
): Promise<WhatsAppMessage> {
  try {
    const fromNumber = formatWhatsAppNumber(WHATSAPP_NUMBER);
    const toNumber = formatWhatsAppNumber(to);

    // Send via Twilio WhatsApp API
    const message = await getTwilioClient().messages.create({
      from: fromNumber,
      to: toNumber,
      body,
      mediaUrl: mediaUrls,
    });

    // Find or create thread
    const thread = await findOrCreateThread(accountId, toNumber);

    // Store in database
    const result = await sql`
      INSERT INTO whatsapp_messages (
        thread_id, from_number, to_number, body, media_urls,
        direction, status, message_type, twilio_sid, created_at
      ) VALUES (
        ${thread.id}, ${fromNumber}, ${toNumber}, ${body},
        ${mediaUrls ? JSON.stringify(mediaUrls) : null},
        'outbound', ${message.status}, 'text', ${message.sid}, NOW()
      )
      RETURNING *
    `;

    const waMessage = mapMessageFromDb(result.rows[0]);

    // Update thread
    await updateThreadTimestamp(thread.id);

    // Sync to unified inbox
    await syncToUnifiedInbox(accountId, thread, waMessage);

    return waMessage;
  } catch (error) {
    console.error('Error sending WhatsApp:', error);
    throw error;
  }
}

/**
 * Handle inbound WhatsApp webhook from Twilio
 */
export async function handleInboundWhatsApp(twilioPayload: any): Promise<WhatsAppMessage> {
  try {
    const {
      From,
      To,
      Body,
      MediaUrl0,
      MediaUrl1,
      MediaUrl2,
      MediaUrl3,
      MessageSid,
      NumMedia,
      ProfileName,
      MessageType, // text, image, video, audio, document, location
      Latitude,
      Longitude,
    } = twilioPayload;

    // Collect media URLs
    const mediaUrls: string[] = [];
    if (NumMedia && parseInt(NumMedia) > 0) {
      [MediaUrl0, MediaUrl1, MediaUrl2, MediaUrl3].forEach(url => {
        if (url) mediaUrls.push(url);
      });
    }

    // Find account by WhatsApp number
    const accountResult = await sql`
      SELECT id FROM accounts
      WHERE whatsapp_number = ${To}
         OR sms_phone_number = ${extractPhoneFromWhatsApp(To)}
      LIMIT 1
    `;

    let accountId: string;
    if (accountResult.rows.length === 0) {
      // Default to system account or create
      accountId = 'system';
    } else {
      accountId = accountResult.rows[0].id;
    }

    // Find or create thread
    const thread = await findOrCreateThread(accountId, From, ProfileName);

    // Determine message type
    let messageType = MessageType || 'text';
    let messageBody = Body || '';

    // Handle location messages
    if (Latitude && Longitude) {
      messageType = 'location';
      messageBody = `Location: ${Latitude}, ${Longitude}`;
    }

    // Store message
    const result = await sql`
      INSERT INTO whatsapp_messages (
        thread_id, from_number, to_number, body, media_urls,
        direction, status, message_type, twilio_sid, created_at
      ) VALUES (
        ${thread.id}, ${From}, ${To}, ${messageBody},
        ${mediaUrls.length > 0 ? JSON.stringify(mediaUrls) : null},
        'inbound', 'received', ${messageType}, ${MessageSid}, NOW()
      )
      RETURNING *
    `;

    const waMessage = mapMessageFromDb(result.rows[0]);

    // Update thread
    await updateThreadTimestamp(thread.id);

    // Sync to unified inbox with AI triage
    await syncToUnifiedInbox(accountId, thread, waMessage);

    // Trigger real-time notification
    await publishMessage('whatsapp', thread.id, waMessage);

    return waMessage;
  } catch (error) {
    console.error('Error handling inbound WhatsApp:', error);
    throw error;
  }
}

/**
 * Find or create WhatsApp thread
 */
async function findOrCreateThread(
  accountId: string,
  whatsappId: string,
  contactName?: string
): Promise<WhatsAppThread> {
  // Try to find existing thread
  const existing = await sql`
    SELECT * FROM whatsapp_threads
    WHERE account_id = ${accountId}
      AND whatsapp_id = ${whatsappId}
    LIMIT 1
  `;

  if (existing.rows.length > 0) {
    // Update contact name if we have a new one
    if (contactName && !existing.rows[0].contact_name) {
      await sql`
        UPDATE whatsapp_threads
        SET contact_name = ${contactName}
        WHERE id = ${existing.rows[0].id}
      `;
    }
    return mapThreadFromDb(existing.rows[0]);
  }

  // Create new thread
  const result = await sql`
    INSERT INTO whatsapp_threads (
      account_id, whatsapp_id, contact_name,
      last_message_at, message_count, is_read, created_at
    ) VALUES (
      ${accountId}, ${whatsappId}, ${contactName || null},
      NOW(), 0, false, NOW()
    )
    RETURNING *
  `;

  return mapThreadFromDb(result.rows[0]);
}

/**
 * Update thread timestamp and count
 */
async function updateThreadTimestamp(threadId: string): Promise<void> {
  await sql`
    UPDATE whatsapp_threads
    SET
      last_message_at = NOW(),
      message_count = message_count + 1,
      is_read = false
    WHERE id = ${threadId}
  `;
}

/**
 * Sync WhatsApp message to unified inbox
 */
async function syncToUnifiedInbox(
  accountId: string,
  thread: WhatsAppThread,
  message: WhatsAppMessage
): Promise<void> {
  try {
    // Run AI triage on inbound messages
    let triageResult = null;
    if (message.direction === 'inbound') {
      triageResult = await triageMessage(message.body, {
        provider: 'whatsapp',
        sender: thread.contact_name || extractPhoneFromWhatsApp(message.from),
      });
    }

    // Find or create inbox thread
    const existingThread = await sql`
      SELECT id FROM inbox_threads
      WHERE provider = 'whatsapp'
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
          ${accountId}, 'whatsapp', ${thread.id},
          ${`WhatsApp: ${thread.contact_name || extractPhoneFromWhatsApp(thread.whatsapp_id)}`},
          ${JSON.stringify([{
            type: 'contact',
            phone: extractPhoneFromWhatsApp(thread.whatsapp_id),
            name: thread.contact_name,
          }])},
          NOW(), false, 1,
          ${JSON.stringify(['whatsapp'])},
          ${JSON.stringify({
            whatsapp_id: thread.whatsapp_id,
            profile_name: thread.contact_name,
          })},
          NOW()
        )
        RETURNING id
      `;
      inboxThreadId = newThread.rows[0].id;
    } else {
      inboxThreadId = existingThread.rows[0].id;

      // Update existing thread
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
        ${inboxThreadId}, 'whatsapp', ${message.id},
        ${JSON.stringify({ phone: extractPhoneFromWhatsApp(message.from), name: thread.contact_name })},
        ${JSON.stringify([{ phone: extractPhoneFromWhatsApp(message.to) }])},
        ${message.body}, ${message.direction},
        ${message.media_urls ? JSON.stringify(message.media_urls.map(url => ({
          type: message.message_type,
          url,
        }))) : null},
        ${triageResult?.priority || null},
        ${triageResult?.category || null},
        ${triageResult?.sentiment || null},
        ${triageResult?.summary || null},
        ${JSON.stringify({
          message_type: message.message_type,
          twilio_sid: (message as any).twilio_sid,
        })},
        NOW()
      )
    `;
  } catch (error) {
    console.error('Error syncing WhatsApp to unified inbox:', error);
  }
}

/**
 * Get WhatsApp conversations for an account
 */
export async function getConversations(
  accountId: string,
  options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  } = {}
): Promise<WhatsAppThread[]> {
  const { limit = 50, offset = 0, unreadOnly = false } = options;

  let result;
  if (unreadOnly) {
    result = await sql`
      SELECT * FROM whatsapp_threads
      WHERE account_id = ${accountId}
        AND is_read = false
      ORDER BY last_message_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else {
    result = await sql`
      SELECT * FROM whatsapp_threads
      WHERE account_id = ${accountId}
      ORDER BY last_message_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  return result.rows.map(mapThreadFromDb);
}

/**
 * Get messages in a thread
 */
export async function getThreadMessages(
  threadId: string,
  options: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<WhatsAppMessage[]> {
  const { limit = 100, offset = 0 } = options;

  const result = await sql`
    SELECT * FROM whatsapp_messages
    WHERE thread_id = ${threadId}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return result.rows.map(mapMessageFromDb);
}

/**
 * Mark thread as read
 */
export async function markThreadAsRead(threadId: string): Promise<void> {
  await sql`
    UPDATE whatsapp_threads
    SET is_read = true
    WHERE id = ${threadId}
  `;
}

/**
 * Send template message (required for starting conversations)
 */
export async function sendTemplateMessage(
  accountId: string,
  to: string,
  templateSid: string,
  variables?: Record<string, string>
): Promise<WhatsAppMessage> {
  try {
    const fromNumber = formatWhatsAppNumber(WHATSAPP_NUMBER);
    const toNumber = formatWhatsAppNumber(to);

    // Build content variables
    const contentVariables = variables
      ? JSON.stringify(variables)
      : undefined;

    // Send template via Twilio
    const message = await getTwilioClient().messages.create({
      from: fromNumber,
      to: toNumber,
      contentSid: templateSid,
      contentVariables,
    });

    // Find or create thread
    const thread = await findOrCreateThread(accountId, toNumber);

    // Store in database
    const result = await sql`
      INSERT INTO whatsapp_messages (
        thread_id, from_number, to_number, body, media_urls,
        direction, status, message_type, twilio_sid, created_at
      ) VALUES (
        ${thread.id}, ${fromNumber}, ${toNumber},
        ${`[Template: ${templateSid}]`},
        null, 'outbound', ${message.status}, 'template', ${message.sid}, NOW()
      )
      RETURNING *
    `;

    const waMessage = mapMessageFromDb(result.rows[0]);
    await updateThreadTimestamp(thread.id);
    await syncToUnifiedInbox(accountId, thread, waMessage);

    return waMessage;
  } catch (error) {
    console.error('Error sending WhatsApp template:', error);
    throw error;
  }
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

function mapThreadFromDb(row: any): WhatsAppThread {
  return {
    id: row.id,
    account_id: row.account_id,
    whatsapp_id: row.whatsapp_id,
    contact_name: row.contact_name,
    profile_picture_url: row.profile_picture_url,
    last_message_at: row.last_message_at,
    message_count: row.message_count,
    is_read: row.is_read,
    created_at: row.created_at,
  };
}

function mapMessageFromDb(row: any): WhatsAppMessage {
  return {
    id: row.id,
    thread_id: row.thread_id,
    from: row.from_number,
    to: row.to_number,
    body: row.body,
    media_urls: row.media_urls ? JSON.parse(row.media_urls) : undefined,
    direction: row.direction,
    status: row.status,
    message_type: row.message_type || 'text',
    created_at: row.created_at,
  };
}

export default {
  sendWhatsApp,
  handleInboundWhatsApp,
  getConversations,
  getThreadMessages,
  markThreadAsRead,
  sendTemplateMessage,
  formatWhatsAppNumber,
};
