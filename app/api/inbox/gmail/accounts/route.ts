/**
 * Gmail Accounts Management
 * GET /api/inbox/gmail/accounts - List all Gmail accounts for a user
 * DELETE /api/inbox/gmail/accounts - Remove a Gmail account
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserGmailAccounts, deleteGmailAccount } from '@/lib/inbox/providers/gmail'

export const dynamic = 'force-dynamic'

// GET - List all Gmail accounts for a user
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

    // Filter sensitive data before returning
    const safeAccounts = accounts.map((account) => ({
      id: account.id,
      email: account.email,
      account_name: account.account_name,
      labels: account.labels,
      last_sync_at: account.last_sync_at,
      sync_status: account.sync_status,
      error_message: account.error_message,
      watch_expiration: account.watch_expiration,
      created_at: account.created_at,
      // Don't expose tokens
    }))

    return NextResponse.json({
      success: true,
      accounts: safeAccounts,
      count: safeAccounts.length,
    })
  } catch (error: any) {
    console.error('[Gmail Accounts] Error fetching accounts:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Remove a Gmail account
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const accountId = searchParams.get('accountId')

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'Missing accountId parameter' },
        { status: 400 }
      )
    }

    await deleteGmailAccount(accountId)

    return NextResponse.json({
      success: true,
      message: 'Gmail account disconnected',
    })
  } catch (error: any) {
    console.error('[Gmail Accounts] Error deleting account:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
