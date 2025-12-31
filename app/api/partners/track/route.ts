/**
 * Partner Tracking API
 *
 * POST /api/partners/track/click - Track referral click
 * POST /api/partners/track/conversion - Track signup conversion
 * POST /api/partners/track/transaction - Record transaction for commission
 */

import { NextRequest, NextResponse } from 'next/server'
import { trackClick, trackConversion, recordTransaction } from '@/lib/partners/service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    // Get IP and user agent from request
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
    const userAgent = request.headers.get('user-agent') || undefined
    const referer = request.headers.get('referer') || undefined

    switch (action) {
      case 'click': {
        if (!data.referralCode) {
          return NextResponse.json({ error: 'Referral code required' }, { status: 400 })
        }

        const click = await trackClick({
          referralCode: data.referralCode,
          ipAddress,
          userAgent,
          referer,
          landingPage: data.landingPage,
          utmSource: data.utmSource,
          utmMedium: data.utmMedium,
          utmCampaign: data.utmCampaign,
          utmTerm: data.utmTerm,
          utmContent: data.utmContent,
        })

        if (!click) {
          return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 })
        }

        return NextResponse.json({ success: true, clickId: click.id })
      }

      case 'conversion': {
        if (!data.referralCode || !data.userId) {
          return NextResponse.json({ error: 'Referral code and userId required' }, { status: 400 })
        }

        const referral = await trackConversion({
          referralCode: data.referralCode,
          userId: data.userId,
          email: data.email,
          name: data.name,
        })

        if (!referral) {
          return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 })
        }

        return NextResponse.json({ success: true, referralId: referral.id })
      }

      case 'transaction': {
        if (!data.userId || !data.transactionId || !data.transactionType || !data.amount) {
          return NextResponse.json(
            { error: 'userId, transactionId, transactionType, and amount required' },
            { status: 400 }
          )
        }

        const commission = await recordTransaction({
          userId: data.userId,
          transactionId: data.transactionId,
          transactionType: data.transactionType,
          amount: data.amount,
        })

        if (!commission) {
          return NextResponse.json({ success: true, commission: null, message: 'No referral found for user' })
        }

        return NextResponse.json({ success: true, commission })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Partner tracking error:', error)
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 })
  }
}
