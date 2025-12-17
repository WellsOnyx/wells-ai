// Attribution Commissions API
// GET: Get commission history

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getUserCommissions,
  getUserEarnings,
} from '@/lib/attribution/commission-engine'

export async function GET(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'history' or 'summary'

    if (type === 'summary') {
      const earnings = await getUserEarnings(userId)
      return NextResponse.json({ earnings })
    }

    const commissions = await getUserCommissions(userId)
    const earnings = await getUserEarnings(userId)

    return NextResponse.json({
      commissions,
      earnings,
    })
  } catch (error) {
    console.error('Error getting commissions:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get commissions' },
      { status: 500 }
    )
  }
}
