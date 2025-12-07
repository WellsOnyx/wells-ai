/**
 * SMS Integration via Twilio
 *
 * Features:
 * - Receive inbound SMS to Wells number
 * - Send outbound SMS
 * - MMS support (images)
 * - Conversation threading by phone number
 */

import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface SMSMessage {
  id: string;
  thread_id: string;
  from: string;
  to: string;
  body: string;
  media_urls?: string[];
  direction: 'inbound' | 'outbound';
  status: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface SMSThread {
  id: string;
  account_id: string;
  phone_number: string;
  contact_name?: string;
  last_message_at: string;
  message_count: number;
  is_read: boolean;
  created_at: string;
}

/**
 * Send SMS via Twilio
 */
export async function sendSMS(
  accountId: string,
  to: string,
  body: string,
  mediaUrls?: string[]
): Promise<SMSMessage> {
  try {
    // Get Wells phone number for this account
    const { data: account } = await supabase
      .from('accounts')
      .select('sms_phone_number')
      .eq('id', accountId)
      .single();

    const fromNumber = account?.sms_phone_number || process.env.TWILIO_PHONE_NUMBER!;

    // Send via Twilio
    const message = await twilioClient.messages.create({
      from: fromNumber,
      to,
      body,
      mediaUrl: mediaUrls
    });

    // Find or create thread
    const thread = await findOrCreateThread(accountId, to);

    // Store in database
    const { data: smsMessage, error } = await supabase
      .from('sms_messages')
      .insert({
        thread_id: thread.id,
        from: fromNumber,
        to,
        body,
        media_urls: mediaUrls,
        direction: 'outbound',
        status: message.status,
        twilio_sid: message.sid,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Update thread
    await updateThreadTimestamp(thread.id);

    // Sync to unified inbox
    await syncToUnifiedInbox(smsMessage);

    return smsMessage;
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
}

/**
 * Handle inbound SMS webhook from Twilio
 */
export async function handleInboundSMS(twilioPayload: any): Promise<SMSMessage> {
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
      NumMedia
    } = twilioPayload;

    // Collect media URLs
    const mediaUrls: string[] = [];
    if (NumMedia && parseInt(NumMedia) > 0) {
      [MediaUrl0, MediaUrl1, MediaUrl2, MediaUrl3].forEach(url => {
        if (url) mediaUrls.push(url);
      });
    }

    // Find account by phone number
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('sms_phone_number', To)
      .single();

    if (!account) {
      throw new Error(`No account found for phone number: ${To}`);
    }

    // Find or create thread
    const thread = await findOrCreateThread(account.id, From);

    // Store message
    const { data: smsMessage, error } = await supabase
      .from('sms_messages')
      .insert({
        thread_id: thread.id,
        from: From,
        to: To,
        body: Body || '',
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
        direction: 'inbound',
        status: 'received',
        twilio_sid: MessageSid,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Update thread
    await updateThreadTimestamp(thread.id);

    // Sync to unified inbox
    await syncToUnifiedInbox(smsMessage);

    // Trigger notifications
    await triggerNotifications(account.id, thread.id, smsMessage);

    return smsMessage;
  } catch (error) {
    console.error('Error handling inbound SMS:', error);
    throw error;
  }
}

/**
 * Get SMS conversations for an account
 */
export async function getConversations(
  accountId: string,
  options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  } = {}
): Promise<SMSThread[]> {
  const { limit = 50, offset = 0, unreadOnly = false } = options;

  let query = supabase
    .from('sms_threads')
    .select('*')
    .eq('account_id', accountId)
    .order('last_message_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (unreadOnly) {
    query = query.eq('is_read', false);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching SMS conversations:', error);
    throw error;
  }

  return data || [];
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
): Promise<SMSMessage[]> {
  const { limit = 100, offset = 0 } = options;

  const { data, error } = await supabase
    .from('sms_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching thread messages:', error);
    throw error;
  }

  return data || [];
}

/**
 * Find or create SMS thread
 */
async function findOrCreateThread(
  accountId: string,
  phoneNumber: string
): Promise<SMSThread> {
  // Normalize phone number
  const normalized = normalizePhoneNumber(phoneNumber);

  // Try to find existing thread
  const { data: existing } = await supabase
    .from('sms_threads')
    .select('*')
    .eq('account_id', accountId)
    .eq('phone_number', normalized)
    .single();

  if (existing) {
    return existing;
  }

  // Create new thread
  const { data: newThread, error } = await supabase
    .from('sms_threads')
    .insert({
      account_id: accountId,
      phone_number: normalized,
      last_message_at: new Date().toISOString(),
      message_count: 0,
      is_read: false,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;

  return newThread;
}

/**
 * Update thread timestamp and count
 */
async function updateThreadTimestamp(threadId: string): Promise<void> {
  const { data: thread } = await supabase
    .from('sms_threads')
    .select('message_count')
    .eq('id', threadId)
    .single();

  await supabase
    .from('sms_threads')
    .update({
      last_message_at: new Date().toISOString(),
      message_count: (thread?.message_count || 0) + 1,
      is_read: false
    })
    .eq('id', threadId);
}

/**
 * Sync SMS message to unified inbox
 */
export async function syncToUnifiedInbox(smsMessage: SMSMessage): Promise<void> {
  try {
    // Get thread info
    const { data: thread } = await supabase
      .from('sms_threads')
      .select('*')
      .eq('id', smsMessage.thread_id)
      .single();

    if (!thread) return;

    // Create or update inbox thread
    const { data: inboxThread } = await supabase
      .from('inbox_threads')
      .select('id')
      .eq('provider', 'sms')
      .eq('provider_thread_id', thread.id)
      .single();

    if (!inboxThread) {
      // Create new inbox thread
      await supabase.from('inbox_threads').insert({
        account_id: thread.account_id,
        provider: 'sms',
        provider_thread_id: thread.id,
        subject: `SMS: ${thread.contact_name || thread.phone_number}`,
        participants: [
          {
            type: 'contact',
            phone: thread.phone_number,
            name: thread.contact_name
          }
        ],
        last_message_at: smsMessage.created_at,
        is_read: thread.is_read,
        message_count: thread.message_count,
        labels: ['sms'],
        metadata: {
          phone_number: thread.phone_number
        },
        created_at: thread.created_at
      });
    } else {
      // Update existing thread
      await supabase
        .from('inbox_threads')
        .update({
          last_message_at: smsMessage.created_at,
          is_read: false,
          message_count: thread.message_count
        })
        .eq('id', inboxThread.id);
    }

    // Create inbox message
    await supabase.from('inbox_messages').insert({
      thread_id: inboxThread?.id,
      provider: 'sms',
      provider_message_id: smsMessage.id,
      from: {
        phone: smsMessage.from
      },
      to: [
        {
          phone: smsMessage.to
        }
      ],
      body: smsMessage.body,
      direction: smsMessage.direction,
      attachments: smsMessage.media_urls?.map(url => ({
        type: 'image',
        url,
        name: url.split('/').pop()
      })),
      metadata: {
        twilio_sid: (smsMessage as any).twilio_sid,
        status: smsMessage.status
      },
      created_at: smsMessage.created_at
    });
  } catch (error) {
    console.error('Error syncing SMS to unified inbox:', error);
  }
}

/**
 * Trigger notifications for new SMS
 */
async function triggerNotifications(
  accountId: string,
  threadId: string,
  message: SMSMessage
): Promise<void> {
  // Get account users
  const { data: accountUsers } = await supabase
    .from('account_users')
    .select('user_id')
    .eq('account_id', accountId);

  if (!accountUsers) return;

  // Create notifications
  const notifications = accountUsers.map(au => ({
    user_id: au.user_id,
    type: 'sms_received',
    title: 'New SMS Message',
    message: `From ${message.from}: ${message.body.substring(0, 100)}${message.body.length > 100 ? '...' : ''}`,
    data: {
      thread_id: threadId,
      message_id: message.id,
      provider: 'sms'
    },
    created_at: new Date().toISOString()
  }));

  await supabase.from('notifications').insert(notifications);
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // Add +1 for US numbers if not present
  if (digits.length === 10) {
    digits = '1' + digits;
  }

  // Add + prefix
  if (!digits.startsWith('+')) {
    digits = '+' + digits;
  }

  return digits;
}

/**
 * Mark thread as read
 */
export async function markThreadAsRead(threadId: string): Promise<void> {
  await supabase
    .from('sms_threads')
    .update({ is_read: true })
    .eq('id', threadId);
}

/**
 * Delete thread
 */
export async function deleteThread(threadId: string): Promise<void> {
  // Delete messages first
  await supabase
    .from('sms_messages')
    .delete()
    .eq('thread_id', threadId);

  // Delete thread
  await supabase
    .from('sms_threads')
    .delete()
    .eq('id', threadId);
}
