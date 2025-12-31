/**
 * Trusted Parties API
 *
 * GET  - List trusted trading partners
 * POST - Add trusted party
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getTrustedParties, addTrustedParty } from '@/lib/deals/service'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parties = await getTrustedParties(userId)
    return NextResponse.json({ parties })
  } catch (error) {
    console.error('Trusted GET error:', error)
    return NextResponse.json({ error: 'Failed to get trusted parties' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      trustedUserId,
      trustLevel,
      maxDealAmount,
      dailyLimit,
      monthlyLimit,
      autoApprove,
      autoFund,
      autoRelease,
    } = body

    if (!trustedUserId) {
      return NextResponse.json({ error: 'trustedUserId required' }, { status: 400 })
    }

    const party = await addTrustedParty(userId, {
      trustedUserId,
      trustLevel,
      maxDealAmount,
      dailyLimit,
      monthlyLimit,
      autoApprove,
      autoFund,
      autoRelease,
    })

    return NextResponse.json(party, { status: 201 })
  } catch (error) {
    console.error('Trusted POST error:', error)
    return NextResponse.json({ error: 'Failed to add trusted party' }, { status: 500 })
  }
}
