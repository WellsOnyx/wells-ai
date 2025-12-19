/**
 * Founder Unified Inbox API
 * GET: Get unified inbox threads across all channels
 * POST: Thread actions, AI features, reply management
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import UnifiedInboxService, {
  InboxFilters,
  FounderCategory,
  InboxChannel,
  ReplyTone,
} from '@/lib/founder/unified-inbox';

export const dynamic = 'force-dynamic';

// Parse natural language for inbox commands
function parseInboxCommand(text: string): {
  action?: string;
  category?: FounderCategory;
  channel?: InboxChannel;
  snoozeUntil?: Date;
  tone?: ReplyTone;
  instruction?: string;
} {
  const lower = text.toLowerCase();
  const result: ReturnType<typeof parseInboxCommand> = {};

  // Parse action
  if (lower.includes('mark read') || lower.includes('mark as read')) {
    result.action = 'mark_read';
  } else if (lower.includes('mark unread') || lower.includes('mark as unread')) {
    result.action = 'mark_unread';
  } else if (lower.includes('star') && !lower.includes('unstar')) {
    result.action = 'star';
  } else if (lower.includes('unstar')) {
    result.action = 'unstar';
  } else if (lower.includes('archive')) {
    result.action = 'archive';
  } else if (lower.includes('trash') || lower.includes('delete')) {
    result.action = 'trash';
  } else if (lower.includes('snooze')) {
    result.action = 'snooze';
  } else if (lower.includes('summarize') || lower.includes('summary')) {
    result.action = 'generate_summary';
  } else if (lower.includes('suggest repl') || lower.includes('reply suggestion')) {
    result.action = 'suggest_replies';
  } else if (lower.includes('draft') || lower.includes('write')) {
    result.action = 'draft_reply';
    result.instruction = text;
  } else if (lower.includes('send')) {
    result.action = 'send_reply';
  } else if (lower.includes('extract action') || lower.includes('action item')) {
    result.action = 'extract_actions';
  }

  // Parse category
  const categories: FounderCategory[] = [
    'deals', 'sales_inquiry', 'customer_support', 'hiring', 'candidate',
    'investor', 'partner', 'vendor', 'legal', 'finance', 'team', 'personal',
    'newsletter', 'spam'
  ];
  for (const cat of categories) {
    if (lower.includes(cat.replace('_', ' '))) {
      result.category = cat;
      break;
    }
  }

  // Parse channel
  const channels: InboxChannel[] = [
    'email', 'gmail', 'outlook', 'sms', 'whatsapp', 'slack', 'teams',
    'discord', 'twitter', 'instagram', 'facebook', 'linkedin', 'shopify'
  ];
  for (const ch of channels) {
    if (lower.includes(ch)) {
      result.channel = ch;
      break;
    }
  }

  // Parse snooze time
  if (lower.includes('tomorrow')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    result.snoozeUntil = tomorrow;
  } else if (lower.includes('next week')) {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(9, 0, 0, 0);
    result.snoozeUntil = nextWeek;
  } else if (lower.includes('hour')) {
    const hourMatch = text.match(/(\d+)\s*hour/i);
    if (hourMatch) {
      const hours = parseInt(hourMatch[1]);
      result.snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
    }
  }

  // Parse tone
  if (lower.includes('professional')) result.tone = 'professional';
  else if (lower.includes('casual')) result.tone = 'casual';
  else if (lower.includes('friendly')) result.tone = 'friendly';
  else if (lower.includes('formal')) result.tone = 'formal';
  else if (lower.includes('empathetic')) result.tone = 'empathetic';
  else if (lower.includes('assertive')) result.tone = 'assertive';

  return result;
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const threadId = searchParams.get('threadId');

    // Get single thread with messages
    if (threadId) {
      const result = await UnifiedInboxService.getThread(threadId, userId);
      if (!result) {
        return NextResponse.json({
          success: false,
          message: "I couldn't find that thread. It may have been deleted or you don't have access.",
        });
      }
      return NextResponse.json({
        success: true,
        thread: result.thread,
        messages: result.messages,
        message: `Thread from ${result.thread.participants[0]?.name || 'unknown'}: ${result.thread.subject || result.thread.preview.substring(0, 50)}...`,
      });
    }

    // Build filters from query params
    const filters: InboxFilters = {
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    const channels = searchParams.get('channels');
    if (channels) filters.channels = channels.split(',') as InboxChannel[];

    const categories = searchParams.get('categories');
    if (categories) filters.categories = categories.split(',') as FounderCategory[];

    const isRead = searchParams.get('isRead');
    if (isRead !== null) filters.isRead = isRead === 'true';

    const isStarred = searchParams.get('isStarred');
    if (isStarred !== null) filters.isStarred = isStarred === 'true';

    const isArchived = searchParams.get('isArchived');
    if (isArchived !== null) filters.isArchived = isArchived === 'true';

    const search = searchParams.get('search');
    if (search) filters.search = search;

    const linkedProjectId = searchParams.get('linkedProjectId');
    if (linkedProjectId) filters.linkedProjectId = linkedProjectId;

    // Get inbox threads
    const result = await UnifiedInboxService.getUnifiedInbox(userId, filters);

    // Also get stats for summary
    const stats = await UnifiedInboxService.getInboxStats(userId);

    return NextResponse.json({
      success: true,
      threads: result.threads,
      total: result.total,
      hasMore: result.hasMore,
      stats,
      message: result.threads.length > 0
        ? `${result.total} thread(s) in your inbox. ${stats.unreadCount} unread, ${stats.pendingReplies} need replies.`
        : "Your inbox is empty. All caught up!",
    });
  } catch (error: any) {
    console.error('Error in inbox GET:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inbox' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, text, data } = body;

    // Parse from natural language if provided
    let parsedData = data || {};
    if (text && !action) {
      const parsed = parseInboxCommand(text);
      parsedData = { ...parsed, ...parsedData };
      if (parsed.action && !action) {
        parsedData.action = parsed.action;
      }
    }

    const effectiveAction = action || parsedData.action;
    const threadId = parsedData.threadId;

    switch (effectiveAction) {
      case 'mark_read': {
        if (!threadId) {
          return NextResponse.json({
            success: false,
            message: "Which thread should I mark as read?",
          });
        }
        await UnifiedInboxService.markRead(threadId, userId);
        return NextResponse.json({
          success: true,
          message: "Marked as read.",
        });
      }

      case 'mark_unread': {
        if (!threadId) {
          return NextResponse.json({
            success: false,
            message: "Which thread should I mark as unread?",
          });
        }
        await UnifiedInboxService.markUnread(threadId, userId);
        return NextResponse.json({
          success: true,
          message: "Marked as unread. It'll stay highlighted in your inbox.",
        });
      }

      case 'star': {
        if (!threadId) {
          return NextResponse.json({
            success: false,
            message: "Which thread should I star?",
          });
        }
        await UnifiedInboxService.star(threadId, userId);
        return NextResponse.json({
          success: true,
          message: "Starred. Find it easily in your starred view.",
        });
      }

      case 'unstar': {
        if (!threadId) {
          return NextResponse.json({
            success: false,
            message: "Which thread should I unstar?",
          });
        }
        await UnifiedInboxService.unstar(threadId, userId);
        return NextResponse.json({
          success: true,
          message: "Star removed.",
        });
      }

      case 'archive': {
        if (!threadId) {
          return NextResponse.json({
            success: false,
            message: "Which thread should I archive?",
          });
        }
        await UnifiedInboxService.archive(threadId, userId);
        return NextResponse.json({
          success: true,
          message: "Archived. Find it in your archive if you need it later.",
        });
      }

      case 'trash': {
        if (!threadId) {
          return NextResponse.json({
            success: false,
            message: "Which thread should I move to trash?",
          });
        }
        await UnifiedInboxService.trash(threadId, userId);
        return NextResponse.json({
          success: true,
          message: "Moved to trash. It'll be permanently deleted after 30 days.",
        });
      }

      case 'snooze': {
        if (!threadId) {
          return NextResponse.json({
            success: false,
            message: "Which thread should I snooze?",
          });
        }

        let snoozeUntil = parsedData.snoozeUntil;
        if (!snoozeUntil) {
          // Default to tomorrow 9am
          snoozeUntil = new Date();
          snoozeUntil.setDate(snoozeUntil.getDate() + 1);
          snoozeUntil.setHours(9, 0, 0, 0);
        } else if (typeof snoozeUntil === 'string') {
          snoozeUntil = new Date(snoozeUntil);
        }

        await UnifiedInboxService.snooze(threadId, userId, snoozeUntil);
        return NextResponse.json({
          success: true,
          snoozeUntil,
          message: `Snoozed until ${snoozeUntil.toLocaleString()}. I'll bring it back to your inbox then.`,
        });
      }

      case 'categorize': {
        if (!threadId || !parsedData.category) {
          return NextResponse.json({
            success: false,
            message: "Which thread and what category? Options: deals, hiring, investor, partner, vendor, legal, finance, team, personal.",
          });
        }
        await UnifiedInboxService.categorize(threadId, userId, parsedData.category);
        return NextResponse.json({
          success: true,
          message: `Categorized as ${parsedData.category.replace('_', ' ')}.`,
        });
      }

      case 'generate_summary': {
        if (!threadId) {
          return NextResponse.json({
            success: false,
            message: "Which thread should I summarize?",
          });
        }
        const summary = await UnifiedInboxService.generateSummary(threadId, userId);
        return NextResponse.json({
          success: true,
          summary: summary.summary,
          keyPoints: summary.keyPoints,
          sentiment: summary.sentiment,
          message: `Here's the summary: ${summary.summary}`,
        });
      }

      case 'suggest_replies': {
        if (!threadId) {
          return NextResponse.json({
            success: false,
            message: "Which thread do you want reply suggestions for?",
          });
        }
        const tone = parsedData.tone || 'professional';
        const suggestions = await UnifiedInboxService.suggestReplies(threadId, userId, tone);
        return NextResponse.json({
          success: true,
          suggestions,
          message: suggestions.length > 0
            ? `Here are ${suggestions.length} ${tone} reply options. Pick one or ask me to draft something specific.`
            : "This thread doesn't need a reply - the last message was from you.",
        });
      }

      case 'draft_reply': {
        if (!threadId) {
          return NextResponse.json({
            success: false,
            message: "Which thread do you want me to draft a reply for?",
          });
        }
        const instruction = parsedData.instruction || text || 'Draft a helpful reply';
        const draft = await UnifiedInboxService.draftReply(threadId, userId, instruction);
        return NextResponse.json({
          success: true,
          draft: draft.draft,
          tone: draft.tone,
          suggestedSubject: draft.suggestedSubject,
          message: `Here's a ${draft.tone} draft. Review and send when ready, or tell me to adjust.`,
        });
      }

      case 'send_reply': {
        if (!threadId) {
          return NextResponse.json({
            success: false,
            message: "Which thread should I reply to?",
          });
        }
        const replyMessage = parsedData.message || text;
        if (!replyMessage) {
          return NextResponse.json({
            success: false,
            message: "What would you like to say? Give me the reply message.",
          });
        }

        try {
          const sentMessage = await UnifiedInboxService.sendReply(threadId, userId, replyMessage, parsedData.options);
          return NextResponse.json({
            success: true,
            sentMessage,
            message: "Reply sent successfully!",
          });
        } catch (error: any) {
          return NextResponse.json({
            success: false,
            message: error.message || "I couldn't send that reply. The channel integration may not be fully set up.",
          });
        }
      }

      case 'extract_actions': {
        if (!threadId) {
          return NextResponse.json({
            success: false,
            message: "Which thread should I extract action items from?",
          });
        }
        const actionItems = await UnifiedInboxService.extractActionItems(threadId, userId);
        return NextResponse.json({
          success: true,
          actionItems,
          message: actionItems.length > 0
            ? `Found ${actionItems.length} action item(s). ${actionItems[0]?.description}`
            : "No clear action items found in this thread.",
        });
      }

      case 'link_to_project': {
        if (!threadId || !parsedData.projectId) {
          return NextResponse.json({
            success: false,
            message: "Which thread and which project should I link?",
          });
        }
        await UnifiedInboxService.linkToProject(threadId, userId, parsedData.projectId);
        return NextResponse.json({
          success: true,
          message: "Thread linked to project. You'll see related messages when viewing that project.",
        });
      }

      case 'auto_categorize': {
        const categorized = await UnifiedInboxService.autoCategorizeThreads(userId);
        return NextResponse.json({
          success: true,
          categorized,
          message: `Auto-categorized ${categorized} thread(s) in your inbox.`,
        });
      }

      case 'get_channels': {
        const channels = await UnifiedInboxService.getConnectedChannels(userId);
        return NextResponse.json({
          success: true,
          channels,
          message: channels.length > 0
            ? `You have ${channels.length} channel(s) connected: ${channels.map(c => c.channel).join(', ')}.`
            : "No channels connected yet. Connect email, SMS, or social accounts to unify your inbox.",
        });
      }

      case 'sync_channel': {
        const { channelId } = parsedData;
        if (!channelId) {
          return NextResponse.json({
            success: false,
            message: "Which channel should I sync?",
          });
        }
        const syncResult = await UnifiedInboxService.syncChannel(userId, channelId);
        return NextResponse.json({
          success: true,
          ...syncResult,
          message: `Synced ${syncResult.threadsAdded} new thread(s) and ${syncResult.messagesAdded} message(s).`,
        });
      }

      case 'get_stats': {
        const stats = await UnifiedInboxService.getInboxStats(userId);
        return NextResponse.json({
          success: true,
          stats,
          message: `Inbox stats: ${stats.totalThreads} total, ${stats.unreadCount} unread, ${stats.pendingReplies} awaiting your reply. Avg response time: ${stats.avgResponseTimeHours.toFixed(1)} hours.`,
        });
      }

      default:
        return NextResponse.json({
          success: false,
          message: "I can help manage your unified inbox. Try: 'summarize this thread', 'draft a polite decline', 'snooze until tomorrow', or 'extract action items'.",
          availableActions: [
            'mark_read', 'mark_unread', 'star', 'unstar', 'archive', 'trash',
            'snooze', 'categorize', 'generate_summary', 'suggest_replies',
            'draft_reply', 'send_reply', 'extract_actions', 'link_to_project',
            'auto_categorize', 'get_channels', 'sync_channel', 'get_stats',
          ],
        });
    }
  } catch (error: any) {
    console.error('Error in inbox POST:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process inbox action' },
      { status: 500 }
    );
  }
}
