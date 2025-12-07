import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSMS } from '@/lib/inbox/providers/sms';
import { sendMessage } from '@/lib/inbox/providers/wells-internal';
import { triageMessage, getSmartReplySuggestions } from '@/lib/inbox/ai-triage';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/inbox/messages/[messageId]
 *
 * Get single message with full details
 *
 * Query params:
 * - include_triage: boolean (default: false) - Include AI triage data
 * - include_suggestions: boolean (default: false) - Include smart reply suggestions
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const includeTriage = searchParams.get('include_triage') === 'true';
    const includeSuggestions = searchParams.get('include_suggestions') === 'true';

    // Get message
    const { data: message, error } = await supabase
      .from('inbox_messages')
      .select('*')
      .eq('id', params.messageId)
      .single();

    if (error || !message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // Get thread info
    const { data: thread } = await supabase
      .from('inbox_threads')
      .select('*')
      .eq('id', message.thread_id)
      .single();

    let triage = null;
    let suggestions = null;

    // Get triage data if requested
    if (includeTriage) {
      const { data: triageData } = await supabase
        .from('message_triage')
        .select('*')
        .eq('message_id', params.messageId)
        .single();

      triage = triageData;

      // Generate triage if not exists
      if (!triage) {
        triage = await triageMessage(message);
      }
    }

    // Get smart reply suggestions if requested
    if (includeSuggestions && message.direction === 'inbound') {
      suggestions = await getSmartReplySuggestions(message);
    }

    return NextResponse.json({
      message,
      thread,
      triage,
      suggestions
    });

  } catch (error: any) {
    console.error('Error fetching message:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inbox/messages/[messageId]/reply
 *
 * Reply to a message (routes to correct provider)
 *
 * Body:
 * {
 *   content: string;
 *   accountId?: string;
 *   userId?: string;
 *   attachments?: any[];
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const { content, accountId, userId, attachments } = await req.json();

    if (!content) {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 }
      );
    }

    // Get original message
    const { data: originalMessage, error: msgError } = await supabase
      .from('inbox_messages')
      .select('*')
      .eq('id', params.messageId)
      .single();

    if (msgError || !originalMessage) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // Get thread
    const { data: thread } = await supabase
      .from('inbox_threads')
      .select('*')
      .eq('id', originalMessage.thread_id)
      .single();

    if (!thread) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      );
    }

    let reply;

    // Route to appropriate provider
    switch (thread.provider) {
      case 'sms':
        // SMS Reply
        if (!accountId) {
          return NextResponse.json(
            { error: 'accountId required for SMS replies' },
            { status: 400 }
          );
        }

        const mediaUrls = attachments?.map((a: any) => a.url).filter(Boolean);

        reply = await sendSMS(
          accountId,
          originalMessage.from.phone,
          content,
          mediaUrls
        );
        break;

      case 'wells_internal':
        // Internal message reply
        if (!userId) {
          return NextResponse.json(
            { error: 'userId required for internal message replies' },
            { status: 400 }
          );
        }

        const { data: conversation } = await supabase
          .from('internal_conversations')
          .select('id')
          .eq('id', thread.provider_thread_id)
          .single();

        if (!conversation) {
          return NextResponse.json(
            { error: 'Conversation not found' },
            { status: 404 }
          );
        }

        reply = await sendMessage(
          userId,
          conversation.id,
          content,
          'text',
          { reply_to: params.messageId }
        );
        break;

      case 'email':
        // TODO: Implement email reply via SendGrid/Gmail
        return NextResponse.json(
          { error: 'Email replies not yet implemented' },
          { status: 501 }
        );

      default:
        return NextResponse.json(
          { error: `Unsupported provider: ${thread.provider}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      reply
    });

  } catch (error: any) {
    console.error('Error replying to message:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/inbox/messages/[messageId]
 *
 * Update message (mark as read, star, etc.)
 *
 * Body:
 * {
 *   is_read?: boolean;
 *   starred?: boolean;
 * }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const updates = await req.json();

    // Validate updates
    const allowedFields = ['is_read', 'starred'];
    const invalidFields = Object.keys(updates).filter(
      key => !allowedFields.includes(key)
    );

    if (invalidFields.length > 0) {
      return NextResponse.json(
        {
          error: `Invalid fields: ${invalidFields.join(', ')}. Allowed: ${allowedFields.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Update message
    const { data: message, error } = await supabase
      .from('inbox_messages')
      .update(updates)
      .eq('id', params.messageId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Message not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    // Update thread read status if needed
    if (updates.is_read !== undefined) {
      const { count: unreadCount } = await supabase
        .from('inbox_messages')
        .select('*', { count: 'exact', head: true })
        .eq('thread_id', message.thread_id)
        .eq('is_read', false);

      if (unreadCount === 0) {
        await supabase
          .from('inbox_threads')
          .update({ is_read: true })
          .eq('id', message.thread_id);
      }
    }

    return NextResponse.json({
      success: true,
      message
    });

  } catch (error: any) {
    console.error('Error updating message:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inbox/messages/[messageId]
 *
 * Delete a single message
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    // Get message
    const { data: message } = await supabase
      .from('inbox_messages')
      .select('thread_id')
      .eq('id', params.messageId)
      .single();

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // Delete triage data
    await supabase
      .from('message_triage')
      .delete()
      .eq('message_id', params.messageId);

    // Delete message
    const { error } = await supabase
      .from('inbox_messages')
      .delete()
      .eq('id', params.messageId);

    if (error) {
      throw error;
    }

    // Update thread message count
    const { count: messageCount } = await supabase
      .from('inbox_messages')
      .select('*', { count: 'exact', head: true })
      .eq('thread_id', message.thread_id);

    await supabase
      .from('inbox_threads')
      .update({ message_count: messageCount || 0 })
      .eq('id', message.thread_id);

    return NextResponse.json({
      success: true,
      deleted: true
    });

  } catch (error: any) {
    console.error('Error deleting message:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
