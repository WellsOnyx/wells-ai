/**
 * Inbox Sync API Route
 * =====================
 * Manual sync trigger and sync status endpoints
 *
 * POST /api/inbox/sync - Trigger sync for all or specific accounts
 * GET /api/inbox/sync - Get sync status for all accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  syncAccount,
  syncAllAccounts,
  getConnectedAccounts,
  getRecentSyncStatus,
  getSyncLogs,
} from '@/lib/inbox/sync-manager';
import { processNewMessages, autoCategorizeInbox } from '@/lib/inbox/ai-assistant';

// Import sync providers to register them
import '@/lib/inbox/gmail-sync';
import '@/lib/inbox/outlook-sync';
import '@/lib/inbox/sms-sync';

/**
 * POST /api/inbox/sync
 * Trigger a sync for one or all accounts
 */
export async function POST(request: NextRequest) {
  try {
    // Get user ID from header or query
    const userId = request.headers.get('x-user-id') || 'default-user';

    const body = await request.json().catch(() => ({}));
    const { accountId, forceFull, runAI } = body;

    let results;
    const syncedMessageIds: string[] = [];

    if (accountId) {
      // Sync specific account
      const result = await syncAccount(accountId, userId, {
        syncType: forceFull ? 'full' : 'incremental',
        forceFull,
      });

      results = [result];
    } else {
      // Sync all accounts
      results = await syncAllAccounts(userId, {
        syncType: forceFull ? 'full' : 'incremental',
        forceFull,
      });
    }

    // Optionally run AI categorization on new messages
    if (runAI !== false) {
      // Auto-categorize any uncategorized messages
      const categorized = await autoCategorizeInbox(userId, 20);
      console.log(`[InboxSync] Auto-categorized ${categorized} messages`);
    }

    // Calculate totals
    const totals = results.reduce(
      (acc, r) => ({
        messagesCreated: acc.messagesCreated + r.messagesCreated,
        messagesUpdated: acc.messagesUpdated + r.messagesUpdated,
        messagesSkipped: acc.messagesSkipped + r.messagesSkipped,
        errors: [...acc.errors, ...r.errors],
      }),
      { messagesCreated: 0, messagesUpdated: 0, messagesSkipped: 0, errors: [] as string[] }
    );

    return NextResponse.json({
      success: true,
      accounts: results.length,
      ...totals,
      results,
    });
  } catch (error: any) {
    console.error('[InboxSync] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/inbox/sync
 * Get sync status for all accounts
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default-user';
    const accountId = request.nextUrl.searchParams.get('accountId');

    if (accountId) {
      // Get sync logs for specific account
      const logs = await getSyncLogs(accountId, userId, 10);

      return NextResponse.json({
        success: true,
        logs,
      });
    }

    // Get status for all accounts
    const status = await getRecentSyncStatus(userId);

    return NextResponse.json({
      success: true,
      accounts: status.map((s) => ({
        id: s.account.id,
        channel: s.account.channel,
        email: s.account.email,
        phone: s.account.phone,
        displayName: s.account.displayName,
        syncStatus: s.account.syncStatus,
        lastSyncAt: s.account.lastSyncAt,
        lastSync: s.lastSync
          ? {
              id: s.lastSync.id,
              status: s.lastSync.status,
              startedAt: s.lastSync.startedAt,
              completedAt: s.lastSync.completedAt,
              messagesSynced: s.lastSync.messagesSynced,
              errorMessage: s.lastSync.errorMessage,
            }
          : null,
      })),
    });
  } catch (error: any) {
    console.error('[InboxSync] Status error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
