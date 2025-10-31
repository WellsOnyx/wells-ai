import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { exchangePublicToken, getAccounts } from '@/lib/plaid'

/**
 * POST /api/plaid/exchange-token
 *
 * Exchanges public token for access token and stores in user metadata
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { publicToken } = body

    if (!publicToken) {
      return NextResponse.json(
        { error: 'Public token required' },
        { status: 400 }
      )
    }

    // Exchange public token for access token
    const { accessToken, itemId } = await exchangePublicToken(publicToken)

    // Get accounts
    const accounts = await getAccounts(accessToken)

    // Store access token in Clerk user metadata (encrypted)
    const client = await clerkClient()
    await client.users.updateUserMetadata(userId, {
      privateMetadata: {
        plaidAccessToken: accessToken,
        plaidItemId: itemId,
      },
      publicMetadata: {
        hasACHConnected: true,
      },
    })

    console.log(`✅ User ${userId} connected ACH account (${accounts.length} accounts)`)

    return NextResponse.json({
      success: true,
      accounts,
      message: 'Bank account connected successfully',
    })
  } catch (error: any) {
    console.error('Error exchanging token:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to exchange token' },
      { status: 500 }
    )
  }
}
