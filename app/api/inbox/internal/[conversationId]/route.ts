// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  markAsRead,
  addParticipant
} from '@/lib/inbox/providers/wells-internal';

// Lazy initialization to prevent build-time errors
const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }), update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }), delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) }) };
  }
  return createClient(supabaseUrl, supabaseKey);
};

/**
 * GET /api/inbox/internal/[conversationId]
 *
 * Get single conversation details
 *
 * Query params:
 * - userId: string (required, for authorization)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const { data: conversation, error } = await supabase
      .from('internal_conversations')
      .select('*')
      .eq('id', params.conversationId)
      .single();

    if (error || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify user is participant
    const isParticipant = conversation.participants.some(
      (p: any) => p.user_id === userId
    );

    if (!isParticipant) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({ conversation });

  } catch (error: any) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/inbox/internal/[conversationId]
 *
 * Update conversation
 *
 * Body:
 * {
 *   userId: string;
 *   action: 'mark_read' | 'add_participant' | 'update_name' | 'leave';
 *   data?: any; // Action-specific data
 * }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const { userId, action, data } = await req.json();

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'userId and action are required' },
        { status: 400 }
      );
    }

    // Verify conversation exists and user is participant
    const supabase = getSupabase();
    const { data: conversation, error: convError } = await supabase
      .from('internal_conversations')
      .select('*')
      .eq('id', params.conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const isParticipant = conversation.participants.some(
      (p: any) => p.user_id === userId
    );

    if (!isParticipant) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Handle different actions
    switch (action) {
      case 'mark_read':
        await markAsRead(params.conversationId, userId);
        return NextResponse.json({ success: true });

      case 'add_participant':
        if (!data?.newUserId) {
          return NextResponse.json(
            { error: 'newUserId is required for add_participant action' },
            { status: 400 }
          );
        }
        await addParticipant(params.conversationId, data.newUserId, userId);
        return NextResponse.json({ success: true });

      case 'update_name':
        if (!data?.name) {
          return NextResponse.json(
            { error: 'name is required for update_name action' },
            { status: 400 }
          );
        }
        await supabase
          .from('internal_conversations')
          .update({ name: data.name })
          .eq('id', params.conversationId);
        return NextResponse.json({ success: true });

      case 'leave':
        const updatedParticipants = conversation.participants.filter(
          (p: any) => p.user_id !== userId
        );
        await supabase
          .from('internal_conversations')
          .update({ participants: updatedParticipants })
          .eq('id', params.conversationId);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error: any) {
    console.error('Error updating conversation:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inbox/internal/[conversationId]
 *
 * Delete conversation (admin only)
 *
 * Query params:
 * - userId: string (required)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Verify user is admin
    const supabase = getSupabase();
    const { data: conversation } = await supabase
      .from('internal_conversations')
      .select('participants')
      .eq('id', params.conversationId)
      .single();

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const participant = conversation.participants.find(
      (p: any) => p.user_id === userId
    );

    if (!participant || participant.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can delete conversations' },
        { status: 403 }
      );
    }

    // Delete messages first
    await supabase
      .from('internal_messages')
      .delete()
      .eq('conversation_id', params.conversationId);

    // Delete conversation
    await supabase
      .from('internal_conversations')
      .delete()
      .eq('id', params.conversationId);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
