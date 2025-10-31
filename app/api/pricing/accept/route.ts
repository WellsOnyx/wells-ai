import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'

/**
 * POST /api/pricing/accept
 *
 * User accepts new pricing terms after a cost change.
 *
 * Request body:
 * {
 *   "pricingVersion": "2024-01-15T10:30:00Z",
 *   "paymentMethod": "stripe",
 *   "newTotalFee": 5200.50
 * }
 *
 * Stores acceptance in user metadata for audit trail.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { pricingVersion, paymentMethod, newTotalFee } = body

    if (!pricingVersion || !paymentMethod || !newTotalFee) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get current user metadata
    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    // Get existing pricing acceptances
    const existingAcceptances = (user.publicMetadata.pricingAcceptances as any[]) || []

    // Add new acceptance
    const newAcceptance = {
      pricingVersion,
      paymentMethod,
      newTotalFee,
      acceptedAt: new Date().toISOString(),
    }

    const updatedAcceptances = [...existingAcceptances, newAcceptance]

    // Update user metadata
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...user.publicMetadata,
        pricingAcceptances: updatedAcceptances,
        [`${paymentMethod}PricingAccepted`]: pricingVersion,
      },
    })

    console.log(`✅ User ${userId} accepted new ${paymentMethod} pricing: $${newTotalFee}`)

    return NextResponse.json({
      success: true,
      message: 'Pricing acceptance recorded',
      acceptance: newAcceptance,
    })
  } catch (error: any) {
    console.error('Error recording pricing acceptance:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to record acceptance' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/pricing/accept?paymentMethod=stripe
 *
 * Check if user has accepted current pricing for a payment method
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const paymentMethod = searchParams.get('paymentMethod')

    if (!paymentMethod) {
      return NextResponse.json(
        { success: false, error: 'Payment method required' },
        { status: 400 }
      )
    }

    // Get user metadata
    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    const acceptedVersion = user.publicMetadata[`${paymentMethod}PricingAccepted`]
    const allAcceptances = (user.publicMetadata.pricingAcceptances as any[]) || []

    return NextResponse.json({
      success: true,
      hasAccepted: !!acceptedVersion,
      acceptedVersion: acceptedVersion || null,
      allAcceptances,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
