/**
 * Partner Referrals API
 *
 * GET - Get partner's referrals
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getPartner, getPartnerReferrals } from '@/lib/partners/service'

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

    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')
    const referrals = await getPartnerReferrals(partner.id, limit)

    return NextResponse.json({ referrals })
  } catch (error) {
    console.error('Referrals GET error:', error)
    return NextResponse.json({ error: 'Failed to get referrals' }, { status: 500 })
  }
}
