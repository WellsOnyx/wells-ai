/**
 * Gmail Sync Route
 * POST /api/inbox/gmail/sync
 *
 * Triggers sync for a Gmail account
 * Supports both full sync and incremental sync using historyId
 */

import { NextRequest, NextResponse } from 'next/server'
import { syncMessages, getUserGmailAccounts } from '@/lib/inbox/providers/gmail'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accountId, userId, maxResults, labelIds, query, pageToken } = body

    // Validate required parameters
    if (!accountId && !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing accountId or userId parameter' },
        { status: 400 }
      )
    }

    // If userId is provided but not accountId, sync all accounts
    if (userId && !accountId) {
      const accounts = await getUserGmailAccounts(userId)

      if (accounts.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No Gmail accounts found for user' },
          { status: 404 }
        )
      }

      // Sync all accounts in parallel
      const results = await Promise.allSettled(
        accounts.map((account) =>
          syncMessages(account.id, {
            maxResults: maxResults || 50,
            labelIds: labelIds || ['INBOX'],
            query,
            pageToken,
          })
        )
      )

      const successful = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length

      return NextResponse.json({
        success: true,
        synced: successful,
        failed,
        total: accounts.length,
        accounts: accounts.map((a) => ({
          id: a.id,
          email: a.email,
          status: results[accounts.indexOf(a)].status,
        })),
      })
    }

    // Sync single account
    const result = await syncMessages(accountId, {
      maxResults: maxResults || 50,
      labelIds: labelIds || ['INBOX'],
      query,
      pageToken,
    })

    return NextResponse.json({
      success: true,
      messages: result.messages,
      messageCount: result.messages.length,
      nextPageToken: result.nextPageToken,
      historyId: result.historyId,
    })
  } catch (error: any) {
    console.error('[Gmail Sync] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// GET endpoint to check sync status
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId parameter' },
        { status: 400 }
      )
    }

    const accounts = await getUserGmailAccounts(userId)

    return NextResponse.json({
      success: true,
      accounts: accounts.map((account) => ({
        id: account.id,
        email: account.email,
        sync_status: account.sync_status,
        last_sync_at: account.last_sync_at,
        watch_expiration: account.watch_expiration,
        error_message: account.error_message,
      })),
    })
  } catch (error: any) {
    console.error('[Gmail Sync Status] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
