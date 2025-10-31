import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createLinkToken } from '@/lib/plaid'

/**
 * POST /api/plaid/create-link-token
 *
 * Creates a Plaid Link token for connecting a bank account
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { userName } = body

    const { linkToken, expiration } = await createLinkToken(userId, userName)

    return NextResponse.json({
      success: true,
      linkToken,
      expiration,
    })
  } catch (error: any) {
    console.error('Error creating link token:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create link token' },
      { status: 500 }
    )
  }
}
