import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { publishThreadUpdate } from '@/lib/inbox/realtime';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/inbox/threads/[threadId]
 *
 * Get thread with all messages
 *
 * Query params:
 * - include_messages: boolean (default: true) - Include messages in response
 * - message_limit: number (default: 100) - Max messages to return
 * - message_offset: number (default: 0) - Message pagination offset
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const includeMessages = searchParams.get('include_messages') !== 'false';
    const messageLimit = parseInt(searchParams.get('message_limit') || '100');
    const messageOffset = parseInt(searchParams.get('message_offset') || '0');

    // Get thread
    const { data: thread, error: threadError } = await supabase
      .from('inbox_threads')
      .select('*')
      .eq('id', params.threadId)
      .single();

    if (threadError || !thread) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      );
    }

    // Get messages if requested
    let messages = null;
    let messageCount = 0;

    if (includeMessages) {
      const { data: messagesData, count } = await supabase
        .from('inbox_messages')
        .select('*', { count: 'exact' })
        .eq('thread_id', params.threadId)
        .order('created_at', { ascending: true })
        .range(messageOffset, messageOffset + messageLimit - 1);

      messages = messagesData || [];
      messageCount = count || 0;
    }

    return NextResponse.json({
      thread,
      messages,
      messageCount,
      hasMoreMessages: includeMessages && messageCount > messageOffset + messageLimit
    });

  } catch (error: any) {
    console.error('Error fetching thread:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/inbox/threads/[threadId]
 *
 * Update thread (labels, read status, star, etc.)
 *
 * Body:
 * {
 *   is_read?: boolean;
 *   starred?: boolean;
 *   labels?: string[];
 *   archived?: boolean;
 *   snoozed_until?: string;
 * }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const updates = await req.json();

    // Validate updates
    const allowedFields = ['is_read', 'starred', 'labels', 'archived', 'snoozed_until'];
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

    // Update thread
    const { data: thread, error } = await supabase
      .from('inbox_threads')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.threadId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Thread not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    // If marking as read, update all messages
    if (updates.is_read === true) {
      await supabase
        .from('inbox_messages')
        .update({ is_read: true })
        .eq('thread_id', params.threadId);
    }

    // Publish real-time update
    await publishThreadUpdate(params.threadId, updates);

    return NextResponse.json({
      success: true,
      thread
    });

  } catch (error: any) {
    console.error('Error updating thread:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inbox/threads/[threadId]
 *
 * Delete thread and all its messages
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    // Check if thread exists
    const { data: thread } = await supabase
      .from('inbox_threads')
      .select('id, provider, provider_thread_id')
      .eq('id', params.threadId)
      .single();

    if (!thread) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      );
    }

    // Delete messages first
    const { error: messagesError } = await supabase
      .from('inbox_messages')
      .delete()
      .eq('thread_id', params.threadId);

    if (messagesError) {
      console.error('Error deleting messages:', messagesError);
    }

    // Delete triage data
    await supabase
      .from('message_triage')
      .delete()
      .in('message_id',
        supabase
          .from('inbox_messages')
          .select('id')
          .eq('thread_id', params.threadId)
      );

    // Delete thread
    const { error: threadError } = await supabase
      .from('inbox_threads')
      .delete()
      .eq('id', params.threadId);

    if (threadError) {
      throw threadError;
    }

    // Delete from provider-specific tables if needed
    if (thread.provider === 'sms') {
      await supabase
        .from('sms_threads')
        .delete()
        .eq('id', thread.provider_thread_id);
    } else if (thread.provider === 'wells_internal') {
      await supabase
        .from('internal_conversations')
        .delete()
        .eq('id', thread.provider_thread_id);
    }

    return NextResponse.json({
      success: true,
      deleted: true
    });

  } catch (error: any) {
    console.error('Error deleting thread:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
