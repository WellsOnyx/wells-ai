/**
 * Partner Commissions API
 *
 * GET - Get partner's commissions
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getPartner, getPartnerCommissions } from '@/lib/partners/service'
import { CommissionStatus } from '@/lib/partners/types'

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

    const status = request.nextUrl.searchParams.get('status') as CommissionStatus | null
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')

    const commissions = await getPartnerCommissions(
      partner.id,
      status || undefined,
      limit
    )

    return NextResponse.json({ commissions })
  } catch (error) {
    console.error('Commissions GET error:', error)
    return NextResponse.json({ error: 'Failed to get commissions' }, { status: 500 })
  }
}
