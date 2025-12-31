/**
 * Partner Payouts API
 *
 * GET  - Get partner's payouts
 * POST - Request a payout
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getPartner, getPartnerPayouts, createPayout } from '@/lib/partners/service'
import { PayoutStatus } from '@/lib/partners/types'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const partner = await getPartner(userId)
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    const status = request.nextUrl.searchParams.get('status') as PayoutStatus | null
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20')

    const payouts = await getPartnerPayouts(
      partner.id,
      status || undefined,
      limit
    )

    return NextResponse.json({ payouts })
  } catch (error) {
    console.error('Payouts GET error:', error)
    return NextResponse.json({ error: 'Failed to get payouts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const partner = await getPartner(userId)
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    if (partner.status !== 'active') {
      return NextResponse.json({ error: 'Partner not active' }, { status: 403 })
    }

    const payout = await createPayout(partner.id)
    if (!payout) {
      return NextResponse.json(
        { error: 'No approved commissions or below minimum payout threshold' },
        { status: 400 }
      )
    }

    return NextResponse.json(payout, { status: 201 })
  } catch (error) {
    console.error('Payout POST error:', error)
    return NextResponse.json({ error: 'Failed to create payout' }, { status: 500 })
  }
}
