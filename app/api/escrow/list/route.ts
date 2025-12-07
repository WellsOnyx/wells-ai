/**
 * GET /api/escrow/list
 *
 * List escrows for current user
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { listEscrows } from '@/lib/escrow/escrow-service'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const role = (searchParams.get('role') as 'buyer' | 'seller' | 'both') || 'both'

    // List escrows
    const escrows = await listEscrows(userId, role)

    return NextResponse.json({
      escrows,
      count: escrows.length,
      role,
    })
  } catch (error) {
    console.error('Error listing escrows:', error)
    return NextResponse.json(
      {
        error: 'Failed to list escrows',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
