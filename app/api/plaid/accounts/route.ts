import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { getAccounts } from '@/lib/plaid'

/**
 * GET /api/plaid/accounts
 *
 * Gets connected bank accounts for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get access token from user metadata
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const accessToken = user.privateMetadata.plaidAccessToken as string | undefined

    if (!accessToken) {
      return NextResponse.json({
        success: true,
        accounts: [],
        hasACHConnected: false,
      })
    }

    // Get accounts from Plaid
    const accounts = await getAccounts(accessToken)

    return NextResponse.json({
      success: true,
      accounts,
      hasACHConnected: true,
    })
  } catch (error: any) {
    console.error('Error getting accounts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get accounts' },
      { status: 500 }
    )
  }
}
