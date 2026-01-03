/**
 * Inbox Messages API Route
 * =========================
 * Get and search messages across all channels
 *
 * GET /api/inbox/messages - Get messages/threads with filtering
 * POST /api/inbox/messages - Send a new message
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getThreads,
  getThread,
  getMessage,
  searchMessages,
  createMessage,
  getInboxStats,
  InboxFilters,
  AICategory,
  AIPriority,
  InboxChannel,
} from '@/lib/inbox/unified-inbox';
import { generateReplySuggestions, summarizeThread } from '@/lib/inbox/ai-assistant';
import { sendGmailMessage } from '@/lib/inbox/gmail-sync';
import { sendOutlookMessage } from '@/lib/inbox/outlook-sync';
import { sendSMS, sendWhatsApp } from '@/lib/inbox/sms-sync';
import { getConnectedAccount } from '@/lib/inbox/sync-manager';

/**
 * GET /api/inbox/messages
 * Get threads/messages with filtering
 *
 * Query params:
 * - view: 'threads' | 'messages' | 'stats' (default: threads)
 * - threadId: Get specific thread with messages
 * - messageId: Get specific message
 * - search: Search query
 * - channels: Comma-separated channel list
 * - categories: Comma-separated category list
 * - priorities: Comma-separated priority list
 * - isRead: true/false
 * - isStarred: true/false
 * - isArchived: true/false
 * - isCampaignReply: true/false
 * - limit: Number of results (default: 50)
 * - offset: Pagination offset
 * - generateSummary: Include AI summary for thread
 * - generateReplies: Include AI reply suggestions
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default-user';
    const params = request.nextUrl.searchParams;

    const view = params.get('view') || 'threads';
    const threadId = params.get('threadId');
    const messageId = params.get('messageId');
    const search = params.get('search');

    // If requesting stats
    if (view === 'stats') {
      const stats = await getInboxStats(userId);
      return NextResponse.json({ success: true, stats });
    }

    // If requesting specific message
    if (messageId) {
      const message = await getMessage(messageId, userId);

      if (!message) {
        return NextResponse.json(
          { error: 'Message not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, message });
    }

    // If requesting specific thread
    if (threadId) {
      const threadData = await getThread(threadId, userId);

      if (!threadData) {
        return NextResponse.json(
          { error: 'Thread not found' },
          { status: 404 }
        );
      }

      const result: any = {
        success: true,
        thread: threadData.thread,
        messages: threadData.messages,
      };

      // Optionally generate AI summary
      if (params.get('generateSummary') === 'true') {
        try {
          result.summary = await summarizeThread(threadId, userId);
        } catch (error) {
          console.error('[Messages] Summary generation failed:', error);
        }
      }

      // Optionally generate reply suggestions
      if (params.get('generateReplies') === 'true') {
        try {
          result.replySuggestions = await generateReplySuggestions(threadId, userId, {
            tone: (params.get('replyTone') as any) || 'professional',
            count: 3,
          });
        } catch (error) {
          console.error('[Messages] Reply generation failed:', error);
        }
      }

      return NextResponse.json(result);
    }

    // Build filters
    const filters: InboxFilters = {
      limit: parseInt(params.get('limit') || '50'),
      offset: parseInt(params.get('offset') || '0'),
    };

    // Search
    if (search) {
      filters.search = search;
    }

    // Channel filter
    const channels = params.get('channels');
    if (channels) {
      filters.channels = channels.split(',') as InboxChannel[];
    }

    // Category filter
    const categories = params.get('categories');
    if (categories) {
      filters.categories = categories.split(',') as AICategory[];
    }

    // Priority filter
    const priorities = params.get('priorities');
    if (priorities) {
      filters.priorities = priorities.split(',') as AIPriority[];
    }

    // Boolean filters
    if (params.has('isRead')) {
      filters.isRead = params.get('isRead') === 'true';
    }
    if (params.has('isStarred')) {
      filters.isStarred = params.get('isStarred') === 'true';
    }
    if (params.has('isArchived')) {
      filters.isArchived = params.get('isArchived') === 'true';
    }
    if (params.has('isTrashed')) {
      filters.isTrashed = params.get('isTrashed') === 'true';
    }
    if (params.has('isSnoozed')) {
      filters.isSnoozed = params.get('isSnoozed') === 'true';
    }
    if (params.has('isCampaignReply')) {
      filters.isCampaignReply = params.get('isCampaignReply') === 'true';
    }

    // Date filters
    const dateFrom = params.get('dateFrom');
    if (dateFrom) {
      filters.dateFrom = new Date(dateFrom);
    }
    const dateTo = params.get('dateTo');
    if (dateTo) {
      filters.dateTo = new Date(dateTo);
    }

    // Labels filter
    const labels = params.get('labels');
    if (labels) {
      filters.labels = labels.split(',');
    }

    // Get threads or search messages
    if (view === 'messages' && search) {
      const searchResult = await searchMessages(userId, search, filters);
      return NextResponse.json({
        success: true,
        messages: searchResult.messages,
        total: searchResult.total,
      });
    }

    // Default: get threads
    const threadsResult = await getThreads(userId, filters);

    return NextResponse.json({
      success: true,
      threads: threadsResult.threads,
      total: threadsResult.total,
      hasMore: threadsResult.hasMore,
    });
  } catch (error: any) {
    console.error('[Messages] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get messages' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inbox/messages
 * Send a new message or reply
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default-user';

    const body = await request.json();
    const {
      threadId,
      accountId,
      channel,
      to,
      cc,
      bcc,
      subject,
      body: messageBody,
      html,
      replyToMessageId,
    } = body;

    if (!to || !to.length) {
      return NextResponse.json(
        { error: 'Recipient (to) is required' },
        { status: 400 }
      );
    }

    if (!messageBody) {
      return NextResponse.json(
        { error: 'Message body is required' },
        { status: 400 }
      );
    }

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    // Get the connected account
    const account = await getConnectedAccount(accountId, userId);

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    let externalMessageId: string;

    // Send via appropriate channel
    switch (account.channel) {
      case 'gmail':
        externalMessageId = await sendGmailMessage(account, to, subject || '', messageBody, {
          cc,
          bcc,
          replyToMessageId,
          html,
        });
        break;

      case 'outlook':
        externalMessageId = await sendOutlookMessage(account, to, subject || '', messageBody, {
          cc,
          bcc,
          replyToMessageId,
          html,
        });
        break;

      case 'sms':
        // SMS only supports single recipient
        externalMessageId = await sendSMS(account, to[0], messageBody);
        break;

      case 'whatsapp':
        externalMessageId = await sendWhatsApp(account, to[0], messageBody);
        break;

      default:
        return NextResponse.json(
          { error: `Sending via ${account.channel} is not supported` },
          { status: 400 }
        );
    }

    // Create unified message record
    const message = await createMessage(userId, {
      channel: account.channel as InboxChannel,
      channelMessageId: externalMessageId,
      channelThreadId: threadId,
      accountId: account.id,
      direction: 'outbound',
      from: {
        address: account.email || account.phone || account.handle || '',
        name: account.displayName,
      },
      to: to.map((addr: string) => ({ address: addr })),
      cc: cc?.map((addr: string) => ({ address: addr })),
      bcc: bcc?.map((addr: string) => ({ address: addr })),
      subject,
      bodyText: messageBody,
      bodyHtml: html ? messageBody : undefined,
      isRead: true,
      sentAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      messageId: message.id,
      externalMessageId,
    });
  } catch (error: any) {
    console.error('[Messages] Send error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}
