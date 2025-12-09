// @ts-nocheck
/**
 * Wells AI Internal Messaging
 *
 * User-to-user messaging within Wells platform.
 * AI assistants can also participate in conversations.
 *
 * Features:
 * - Real-time messaging via Pusher/WebSocket
 * - AI assistant responses
 * - Rich messages (deals, proposals, etc.)
 * - Read receipts
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { publishMessage } from '../realtime';

// Lazy initialization to prevent build-time errors
const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }), order: () => ({ range: () => Promise.resolve({ data: [] }) }) }), in: () => Promise.resolve({ data: [] }), contains: () => ({ order: () => ({ range: () => Promise.resolve({ data: [] }) }) }) }), insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }), update: () => ({ eq: () => Promise.resolve({}) }), delete: () => ({ eq: () => Promise.resolve({}) }) }), channel: () => ({ on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }) }) } as any;
  }
  return createClient(supabaseUrl, supabaseKey);
};

const getAnthropic = () => new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

// Create a module-level supabase reference for backwards compatibility
const supabase = { from: (...args: any[]) => getSupabase().from(...args), channel: (...args: any[]) => getSupabase().channel(...args) } as any;

export interface InternalMessage {
  id: string;
  conversation_id: string;
  from_user_id: string;
  from_user_name?: string;
  from_user_avatar?: string;
  content: string;
  message_type: 'text' | 'deal' | 'proposal' | 'task' | 'file' | 'system';
  metadata?: any;
  read_by: string[];
  created_at: string;
  updated_at: string;
}

export interface InternalConversation {
  id: string;
  account_id: string;
  name?: string;
  participants: ConversationParticipant[];
  last_message_at: string;
  last_message_preview?: string;
  message_count: number;
  is_group: boolean;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  user_id: string;
  user_name?: string;
  user_avatar?: string;
  role: 'member' | 'admin' | 'ai';
  joined_at: string;
  last_read_at?: string;
}

/**
 * Send internal message
 */
export async function sendMessage(
  fromUserId: string,
  conversationId: string,
  content: string,
  messageType: 'text' | 'deal' | 'proposal' | 'task' | 'file' | 'system' = 'text',
  metadata?: any
): Promise<InternalMessage> {
  try {
    // Verify user is participant
    const { data: conversation } = await supabase
      .from('internal_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const isParticipant = conversation.participants.some(
      (p: ConversationParticipant) => p.user_id === fromUserId
    );

    if (!isParticipant) {
      throw new Error('User is not a participant in this conversation');
    }

    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('name, avatar_url')
      .eq('id', fromUserId)
      .single();

    // Create message
    const { data: message, error } = await supabase
      .from('internal_messages')
      .insert({
        conversation_id: conversationId,
        from_user_id: fromUserId,
        from_user_name: user?.name,
        from_user_avatar: user?.avatar_url,
        content,
        message_type: messageType,
        metadata,
        read_by: [fromUserId],
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Update conversation
    await supabase
      .from('internal_conversations')
      .update({
        last_message_at: message.created_at,
        last_message_preview: content.substring(0, 100),
        message_count: conversation.message_count + 1
      })
      .eq('id', conversationId);

    // Publish real-time update
    await publishMessage('internal', conversationId, message);

    // Trigger AI response if this is a 1:1 with AI assistant
    if (shouldTriggerAIResponse(conversation)) {
      await triggerAIResponse(conversation.id, message);
    }

    // Sync to unified inbox
    await syncToUnifiedInbox(conversation, message);

    return message;
  } catch (error) {
    console.error('Error sending internal message:', error);
    throw error;
  }
}

/**
 * Create new conversation
 */
export async function createConversation(
  accountId: string,
  creatorUserId: string,
  participantUserIds: string[],
  name?: string,
  metadata?: any
): Promise<InternalConversation> {
  try {
    // Get user info for all participants
    const { data: users } = await supabase
      .from('users')
      .select('id, name, avatar_url')
      .in('id', [...participantUserIds, creatorUserId]);

    const participants: ConversationParticipant[] = [
      {
        user_id: creatorUserId,
        user_name: users?.find(u => u.id === creatorUserId)?.name,
        user_avatar: users?.find(u => u.id === creatorUserId)?.avatar_url,
        role: 'admin',
        joined_at: new Date().toISOString()
      },
      ...participantUserIds.map(userId => ({
        user_id: userId,
        user_name: users?.find(u => u.id === userId)?.name,
        user_avatar: users?.find(u => u.id === userId)?.avatar_url,
        role: 'member' as const,
        joined_at: new Date().toISOString()
      }))
    ];

    // Create conversation
    const { data: conversation, error } = await supabase
      .from('internal_conversations')
      .insert({
        account_id: accountId,
        name,
        participants,
        last_message_at: new Date().toISOString(),
        message_count: 0,
        is_group: participantUserIds.length > 1,
        metadata,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Create system message
    await sendMessage(
      creatorUserId,
      conversation.id,
      `${users?.find(u => u.id === creatorUserId)?.name} created this conversation`,
      'system'
    );

    return conversation;
  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
}

/**
 * Get conversations for a user
 */
export async function getConversations(
  userId: string,
  options: {
    accountId?: string;
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  } = {}
): Promise<InternalConversation[]> {
  const { accountId, limit = 50, offset = 0, unreadOnly = false } = options;

  try {
    let query = supabase
      .from('internal_conversations')
      .select('*')
      .contains('participants', [{ user_id: userId }])
      .order('last_message_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (accountId) {
      query = query.eq('account_id', accountId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Filter for unread if requested
    if (unreadOnly && data) {
      return data.filter(conv => {
        const participant = conv.participants.find(
          (p: ConversationParticipant) => p.user_id === userId
        );
        return !participant?.last_read_at ||
               new Date(participant.last_read_at) < new Date(conv.last_message_at);
      });
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }
}

/**
 * Get messages in a conversation
 */
export async function getMessages(
  conversationId: string,
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    since?: string;
  } = {}
): Promise<InternalMessage[]> {
  const { limit = 100, offset = 0, since } = options;

  try {
    // Verify user is participant
    const { data: conversation } = await supabase
      .from('internal_conversations')
      .select('participants')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const isParticipant = conversation.participants.some(
      (p: ConversationParticipant) => p.user_id === userId
    );

    if (!isParticipant) {
      throw new Error('User is not a participant in this conversation');
    }

    // Fetch messages
    let query = supabase
      .from('internal_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (since) {
      query = query.gt('created_at', since);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }
}

/**
 * Mark conversation as read
 */
export async function markAsRead(
  conversationId: string,
  userId: string
): Promise<void> {
  try {
    const { data: conversation } = await supabase
      .from('internal_conversations')
      .select('participants')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Update participant's last_read_at
    const participants = conversation.participants.map((p: ConversationParticipant) => {
      if (p.user_id === userId) {
        return {
          ...p,
          last_read_at: new Date().toISOString()
        };
      }
      return p;
    });

    await supabase
      .from('internal_conversations')
      .update({ participants })
      .eq('id', conversationId);

    // Mark all messages as read
    const { data: messages } = await supabase
      .from('internal_messages')
      .select('id, read_by')
      .eq('conversation_id', conversationId);

    if (messages) {
      for (const message of messages) {
        if (!message.read_by.includes(userId)) {
          await supabase
            .from('internal_messages')
            .update({
              read_by: [...message.read_by, userId]
            })
            .eq('id', message.id);
        }
      }
    }
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    throw error;
  }
}

/**
 * Add participant to conversation
 */
export async function addParticipant(
  conversationId: string,
  userId: string,
  addedBy: string
): Promise<void> {
  try {
    const { data: conversation } = await supabase
      .from('internal_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Check if already a participant
    if (conversation.participants.some((p: ConversationParticipant) => p.user_id === userId)) {
      return;
    }

    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('name, avatar_url')
      .eq('id', userId)
      .single();

    // Add participant
    const participants = [
      ...conversation.participants,
      {
        user_id: userId,
        user_name: user?.name,
        user_avatar: user?.avatar_url,
        role: 'member',
        joined_at: new Date().toISOString()
      }
    ];

    await supabase
      .from('internal_conversations')
      .update({ participants, is_group: true })
      .eq('id', conversationId);

    // Send system message
    await sendMessage(
      addedBy,
      conversationId,
      `${user?.name} was added to the conversation`,
      'system'
    );
  } catch (error) {
    console.error('Error adding participant:', error);
    throw error;
  }
}

/**
 * Check if AI response should be triggered
 */
function shouldTriggerAIResponse(conversation: InternalConversation): boolean {
  // Trigger AI if there's exactly 2 participants and one is AI
  if (conversation.participants.length !== 2) return false;

  return conversation.participants.some(p => p.role === 'ai');
}

/**
 * Trigger AI assistant response
 */
async function triggerAIResponse(
  conversationId: string,
  userMessage: InternalMessage
): Promise<void> {
  try {
    // Get conversation history
    const messages = await getMessages(conversationId, userMessage.from_user_id, {
      limit: 20
    });

    // Find AI participant
    const { data: conversation } = await supabase
      .from('internal_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    const aiParticipant = conversation?.participants.find(
      (p: ConversationParticipant) => p.role === 'ai'
    );

    if (!aiParticipant) return;

    // Build context
    const chatHistory = messages
      .reverse()
      .map(m => ({
        role: m.from_user_id === aiParticipant.user_id ? 'assistant' : 'user',
        content: m.content
      }));

    // Get AI response
    const response = await getAnthropic().messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      system: `You are Wells AI, a helpful assistant for the Wells platform.
You help users with:
- Deal management and tracking
- Proposal generation
- Supplier matching
- Platform navigation
- General business questions

Be concise, helpful, and professional.`,
      messages: chatHistory as any
    });

    const aiResponse = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // Send AI message
    await sendMessage(
      aiParticipant.user_id,
      conversationId,
      aiResponse,
      'text'
    );
  } catch (error) {
    console.error('Error triggering AI response:', error);
  }
}

/**
 * Sync internal message to unified inbox
 */
async function syncToUnifiedInbox(
  conversation: InternalConversation,
  message: InternalMessage
): Promise<void> {
  try {
    // Check if inbox thread exists
    const { data: inboxThread } = await supabase
      .from('inbox_threads')
      .select('id')
      .eq('provider', 'wells_internal')
      .eq('provider_thread_id', conversation.id)
      .single();

    if (!inboxThread) {
      // Create new inbox thread
      await getSupabase().from('inbox_threads').insert({
        account_id: conversation.account_id,
        provider: 'wells_internal',
        provider_thread_id: conversation.id,
        subject: conversation.name || 'Internal Conversation',
        participants: conversation.participants,
        last_message_at: message.created_at,
        is_read: true,
        message_count: conversation.message_count,
        labels: ['internal', 'wells'],
        metadata: conversation.metadata,
        created_at: conversation.created_at
      });
    } else {
      // Update existing thread
      await supabase
        .from('inbox_threads')
        .update({
          last_message_at: message.created_at,
          message_count: conversation.message_count,
          participants: conversation.participants
        })
        .eq('id', inboxThread.id);
    }

    // Create inbox message
    await getSupabase().from('inbox_messages_v2').insert({
      thread_id: inboxThread?.id,
      provider: 'wells_internal',
      provider_message_id: message.id,
      from: {
        user_id: message.from_user_id,
        name: message.from_user_name,
        avatar: message.from_user_avatar
      },
      body: message.content,
      direction: 'inbound',
      message_type: message.message_type,
      metadata: message.metadata,
      created_at: message.created_at
    });
  } catch (error) {
    console.error('Error syncing to unified inbox:', error);
  }
}

/**
 * Subscribe to real-time messages
 */
export function subscribeToMessages(
  userId: string,
  callback: (message: InternalMessage) => void
): () => void {
  // Subscribe to Supabase realtime
  const subscription = supabase
    .channel(`user:${userId}:messages`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'internal_messages'
      },
      async (payload) => {
        const message = payload.new as InternalMessage;

        // Check if user is participant in this conversation
        const { data: conversation } = await supabase
          .from('internal_conversations')
          .select('participants')
          .eq('id', message.conversation_id)
          .single();

        const isParticipant = conversation?.participants.some(
          (p: ConversationParticipant) => p.user_id === userId
        );

        if (isParticipant) {
          callback(message);
        }
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    subscription.unsubscribe();
  };
}
