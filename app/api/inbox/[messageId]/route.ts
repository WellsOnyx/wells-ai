/**
 * Message Actions API Route
 * =========================
 * Individual message operations
 *
 * GET /api/inbox/[messageId] - Get message details
 * PATCH /api/inbox/[messageId] - Update message (read, starred, etc.)
 * DELETE /api/inbox/[messageId] - Trash/delete message
 * POST /api/inbox/[messageId] - Perform action (archive, snooze, spam, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getMessage,
  getThread,
  archiveThreads,
  trashThreads,
  starThreads,
  markThreadsRead,
  snoozeThread,
  unsnoozeThread,
  markAsSpam,
  undoAction,
  updateMessageAIAnalysis,
} from '@/lib/inbox/unified-inbox';
import {
  categorizeMessage,
  generateReplySuggestions,
  draftReply,
  extractEntities,
  extractActionItems,
} from '@/lib/inbox/ai-assistant';
import { sql } from '@/lib/db';

interface RouteParams {
  params: Promise<{ messageId: string }>;
}

/**
 * GET /api/inbox/[messageId]
 * Get detailed message information
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { messageId } = await params;
    const userId = request.headers.get('x-user-id') || 'default-user';
    const searchParams = request.nextUrl.searchParams;

    const message = await getMessage(messageId, userId);

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    const result: any = {
      success: true,
      message,
    };

    // Optionally include thread context
    if (searchParams.get('includeThread') === 'true' && message.threadId) {
      const threadData = await getThread(message.threadId, userId);
      if (threadData) {
        result.thread = threadData.thread;
        result.threadMessages = threadData.messages;
      }
    }

    // Optionally generate reply suggestions
    if (searchParams.get('generateReplies') === 'true' && message.threadId) {
      try {
        result.replySuggestions = await generateReplySuggestions(
          message.threadId,
          userId,
          {
            tone: (searchParams.get('replyTone') as any) || 'professional',
            count: parseInt(searchParams.get('replyCount') || '3'),
          }
        );
      } catch (error) {
        console.error('[MessageAction] Reply generation failed:', error);
      }
    }

    // Optionally extract entities
    if (searchParams.get('extractEntities') === 'true') {
      try {
        result.entities = await extractEntities(messageId, userId);
      } catch (error) {
        console.error('[MessageAction] Entity extraction failed:', error);
      }
    }

    // Optionally extract action items
    if (searchParams.get('extractActions') === 'true') {
      try {
        result.actionItems = await extractActionItems(messageId, userId);
      } catch (error) {
        console.error('[MessageAction] Action extraction failed:', error);
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[MessageAction] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get message' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/inbox/[messageId]
 * Update message properties
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { messageId } = await params;
    const userId = request.headers.get('x-user-id') || 'default-user';

    const body = await request.json();
    const {
      isRead,
      isStarred,
      labels,
      aiCategory,
      aiPriority,
      aiSentiment,
      aiSummary,
    } = body;

    // Build update fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (typeof isRead === 'boolean') {
      updates.push(`is_read = $${paramCount++}`);
      values.push(isRead);
    }

    if (typeof isStarred === 'boolean') {
      updates.push(`is_starred = $${paramCount++}`);
      values.push(isStarred);
    }

    if (labels !== undefined) {
      updates.push(`labels = $${paramCount++}`);
      values.push(labels);
    }

    // AI analysis fields
    if (aiCategory || aiPriority || aiSentiment || aiSummary) {
      await updateMessageAIAnalysis(messageId, userId, {
        category: aiCategory,
        priority: aiPriority,
        sentiment: aiSentiment,
        summary: aiSummary,
      });
    }

    // Update message if there are non-AI fields
    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      values.push(messageId);
      values.push(userId);

      await sql(`
        UPDATE unified_messages
        SET ${updates.join(', ')}
        WHERE id = $${paramCount++} AND user_id = $${paramCount}
      `, values);
    }

    // Return updated message
    const message = await getMessage(messageId, userId);

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error: any) {
    console.error('[MessageAction] PATCH error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update message' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inbox/[messageId]
 * Trash or permanently delete a message
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { messageId } = await params;
    const userId = request.headers.get('x-user-id') || 'default-user';
    const permanent = request.nextUrl.searchParams.get('permanent') === 'true';

    const message = await getMessage(messageId, userId);

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    if (permanent) {
      // Permanent delete
      await sql(`
        DELETE FROM unified_messages
        WHERE id = $1 AND user_id = $2
      `, [messageId, userId]);

      return NextResponse.json({
        success: true,
        action: 'deleted',
        messageId,
      });
    } else {
      // Move to trash (via thread action)
      if (message.threadId) {
        const result = await trashThreads([message.threadId], userId, true);
        return NextResponse.json({
          success: true,
          action: 'trashed',
          actionId: result.actionId,
          undoAvailable: true,
        });
      } else {
        // No thread, just mark message as trashed
        await sql(`
          UPDATE unified_messages
          SET is_trashed = true, updated_at = NOW()
          WHERE id = $1 AND user_id = $2
        `, [messageId, userId]);

        return NextResponse.json({
          success: true,
          action: 'trashed',
          messageId,
        });
      }
    }
  } catch (error: any) {
    console.error('[MessageAction] DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete message' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inbox/[messageId]
 * Perform action on message
 *
 * Actions:
 * - archive: Archive the message/thread
 * - unarchive: Restore from archive
 * - star: Star the message
 * - unstar: Remove star
 * - read: Mark as read
 * - unread: Mark as unread
 * - snooze: Snooze until specified time
 * - unsnooze: Cancel snooze
 * - spam: Mark as spam
 * - notSpam: Remove spam marking
 * - categorize: Run AI categorization
 * - generateReply: Generate AI reply draft
 * - undo: Undo previous action
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { messageId } = await params;
    const userId = request.headers.get('x-user-id') || 'default-user';

    const body = await request.json();
    const { action, ...actionParams } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    const message = await getMessage(messageId, userId);

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    const threadId = message.threadId;
    let result: any = { success: true, action };

    switch (action) {
      case 'archive': {
        if (threadId) {
          const archiveResult = await archiveThreads([threadId], userId, true);
          result.actionId = archiveResult.actionId;
          result.undoAvailable = true;
        } else {
          await sql(`
            UPDATE unified_messages
            SET is_archived = true, updated_at = NOW()
            WHERE id = $1 AND user_id = $2
          `, [messageId, userId]);
        }
        break;
      }

      case 'unarchive': {
        if (threadId) {
          const unarchiveResult = await archiveThreads([threadId], userId, false);
          result.actionId = unarchiveResult.actionId;
        } else {
          await sql(`
            UPDATE unified_messages
            SET is_archived = false, updated_at = NOW()
            WHERE id = $1 AND user_id = $2
          `, [messageId, userId]);
        }
        break;
      }

      case 'star': {
        if (threadId) {
          const starResult = await starThreads([threadId], userId, true);
          result.actionId = starResult.actionId;
          result.undoAvailable = true;
        } else {
          await sql(`
            UPDATE unified_messages
            SET is_starred = true, updated_at = NOW()
            WHERE id = $1 AND user_id = $2
          `, [messageId, userId]);
        }
        break;
      }

      case 'unstar': {
        if (threadId) {
          const unstarResult = await starThreads([threadId], userId, false);
          result.actionId = unstarResult.actionId;
        } else {
          await sql(`
            UPDATE unified_messages
            SET is_starred = false, updated_at = NOW()
            WHERE id = $1 AND user_id = $2
          `, [messageId, userId]);
        }
        break;
      }

      case 'read': {
        if (threadId) {
          const readResult = await markThreadsRead([threadId], userId, true);
          result.actionId = readResult.actionId;
        } else {
          await sql(`
            UPDATE unified_messages
            SET is_read = true, updated_at = NOW()
            WHERE id = $1 AND user_id = $2
          `, [messageId, userId]);
        }
        break;
      }

      case 'unread': {
        if (threadId) {
          const unreadResult = await markThreadsRead([threadId], userId, false);
          result.actionId = unreadResult.actionId;
          result.undoAvailable = true;
        } else {
          await sql(`
            UPDATE unified_messages
            SET is_read = false, updated_at = NOW()
            WHERE id = $1 AND user_id = $2
          `, [messageId, userId]);
        }
        break;
      }

      case 'snooze': {
        const { snoozeUntil, snoozeReason } = actionParams;

        if (!snoozeUntil) {
          return NextResponse.json(
            { error: 'snoozeUntil is required for snooze action' },
            { status: 400 }
          );
        }

        if (threadId) {
          const snoozeResult = await snoozeThread(
            threadId,
            userId,
            new Date(snoozeUntil),
            snoozeReason
          );
          result.actionId = snoozeResult.actionId;
          result.snoozeId = snoozeResult.snoozeId;
          result.undoAvailable = true;
        } else {
          // Create snooze entry for message directly
          const snoozeInsert = await sql(`
            INSERT INTO inbox_snooze_queue (user_id, message_id, snooze_until, reason)
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `, [userId, messageId, new Date(snoozeUntil), snoozeReason]);

          await sql(`
            UPDATE unified_messages
            SET is_snoozed = true, snoozed_until = $1, updated_at = NOW()
            WHERE id = $2 AND user_id = $3
          `, [new Date(snoozeUntil), messageId, userId]);

          result.snoozeId = snoozeInsert[0]?.id;
        }
        break;
      }

      case 'unsnooze': {
        if (threadId) {
          const unsnoozeResult = await unsnoozeThread(threadId, userId);
          result.actionId = unsnoozeResult.actionId;
        } else {
          await sql(`
            UPDATE unified_messages
            SET is_snoozed = false, snoozed_until = NULL, updated_at = NOW()
            WHERE id = $1 AND user_id = $2
          `, [messageId, userId]);

          await sql(`
            UPDATE inbox_snooze_queue
            SET processed = true, processed_at = NOW()
            WHERE message_id = $1 AND user_id = $2 AND processed = false
          `, [messageId, userId]);
        }
        break;
      }

      case 'spam': {
        if (threadId) {
          const spamResult = await markAsSpam([threadId], userId, true);
          result.actionId = spamResult.actionId;
          result.undoAvailable = true;
        } else {
          await sql(`
            UPDATE unified_messages
            SET ai_category = 'spam', is_archived = true, updated_at = NOW()
            WHERE id = $1 AND user_id = $2
          `, [messageId, userId]);
        }
        break;
      }

      case 'notSpam': {
        if (threadId) {
          const notSpamResult = await markAsSpam([threadId], userId, false);
          result.actionId = notSpamResult.actionId;
        } else {
          await sql(`
            UPDATE unified_messages
            SET ai_category = 'other', is_archived = false, updated_at = NOW()
            WHERE id = $1 AND user_id = $2
          `, [messageId, userId]);
        }
        break;
      }

      case 'categorize': {
        // Run AI categorization
        const categorization = await categorizeMessage(messageId, userId, true);
        result.categorization = categorization;
        break;
      }

      case 'generateReply': {
        const { tone, context, instructions } = actionParams;

        if (!threadId) {
          return NextResponse.json(
            { error: 'Cannot generate reply for message without thread' },
            { status: 400 }
          );
        }

        const draft = await draftReply(threadId, userId, {
          tone: tone || 'professional',
          context,
          instructions,
        });

        result.draft = draft;
        break;
      }

      case 'undo': {
        const { actionId } = actionParams;

        if (!actionId) {
          return NextResponse.json(
            { error: 'actionId is required for undo' },
            { status: 400 }
          );
        }

        const undoResult = await undoAction(actionId, userId);
        result.undone = undoResult.undone;
        result.restoredThreads = undoResult.restoredThreads;
        break;
      }

      case 'addLabel': {
        const { label } = actionParams;

        if (!label) {
          return NextResponse.json(
            { error: 'label is required for addLabel action' },
            { status: 400 }
          );
        }

        await sql(`
          UPDATE unified_messages
          SET labels = array_append(COALESCE(labels, ARRAY[]::TEXT[]), $1),
              updated_at = NOW()
          WHERE id = $2 AND user_id = $3
            AND NOT ($1 = ANY(COALESCE(labels, ARRAY[]::TEXT[])))
        `, [label, messageId, userId]);

        break;
      }

      case 'removeLabel': {
        const { label } = actionParams;

        if (!label) {
          return NextResponse.json(
            { error: 'label is required for removeLabel action' },
            { status: 400 }
          );
        }

        await sql(`
          UPDATE unified_messages
          SET labels = array_remove(COALESCE(labels, ARRAY[]::TEXT[]), $1),
              updated_at = NOW()
          WHERE id = $2 AND user_id = $3
        `, [label, messageId, userId]);

        break;
      }

      case 'forward': {
        // Forward will be handled by the send endpoint
        // This just prepares the forward metadata
        const forwardData = {
          originalMessageId: messageId,
          originalSubject: message.subject,
          originalFrom: message.from,
          originalDate: message.sentAt || message.receivedAt,
          bodyToForward: `
---------- Forwarded message ---------
From: ${message.from?.name || ''} <${message.from?.address || ''}>
Date: ${new Date(message.sentAt || message.receivedAt || '').toLocaleString()}
Subject: ${message.subject || '(no subject)'}
To: ${message.to?.map(t => t.address).join(', ') || ''}

${message.bodyText || ''}
          `.trim(),
        };

        result.forwardData = forwardData;
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    // Return updated message
    result.message = await getMessage(messageId, userId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[MessageAction] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to perform action' },
      { status: 500 }
    );
  }
}
