/**
 * Trust Verification API
 *
 * POST /api/trust/verify - Mark a verification as complete
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { markVerified, recalculateTrustScore, getTrustSummary } from '@/lib/reputation'

type VerificationType = 'email' | 'phone' | 'identity' | 'business' | 'bank'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { verificationType } = body

    const validTypes: VerificationType[] = ['email', 'phone', 'identity', 'business', 'bank']

    if (!verificationType || !validTypes.includes(verificationType)) {
      return NextResponse.json(
        { error: 'Valid verificationType required: email, phone, identity, business, or bank' },
        { status: 400 }
      )
    }

    // Mark as verified
    await markVerified(userId, verificationType)

    // Recalculate score
    const calculation = await recalculateTrustScore(userId)
    const summary = await getTrustSummary(userId)

    return NextResponse.json({
      success: true,
      verificationType,
      calculation,
      summary,
    })
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify' },
      { status: 500 }
    )
  }
}
