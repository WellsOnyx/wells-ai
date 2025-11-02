/**
 * Airwallex Seller Onboarding
 *
 * Create connected account for seller to receive split payments
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createConnectedAccount } from '@/lib/airwallex'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { email, businessName, country } = body

    // Validate inputs
    if (!email || !businessName || !country) {
      return NextResponse.json(
        { error: 'Missing required fields: email, businessName, country' },
        { status: 400 }
      )
    }

    // Create connected account with Airwallex
    const result = await createConnectedAccount({
      email,
      businessName,
      country
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      accountId: result.accountId,
      onboardingUrl: result.onboardingUrl,
      message: 'Seller account created. Complete onboarding at the provided URL.'
    })
  } catch (error: any) {
    console.error('[AIRWALLEX] Seller onboarding error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to onboard seller' },
      { status: 500 }
    )
  }
}
