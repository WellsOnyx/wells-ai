import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createLoginLink } from '@/lib/stripe'

/**
 * POST /api/stripe/connect/dashboard
 *
 * Generate a login link to the Stripe Express Dashboard
 *
 * The Express Dashboard allows sellers to:
 * - View their earnings and transaction history
 * - Manage payout settings
 * - Update bank account information
 * - View tax documents
 * - Contact Stripe support
 *
 * Response:
 * - dashboardUrl: URL to redirect user to Stripe Express Dashboard
 */

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user from Clerk
    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    // Get Connect account ID from user metadata
    const accountId = user.publicMetadata?.stripeConnectAccountId as string | undefined

    if (!accountId) {
      return NextResponse.json(
        { error: 'No Stripe Connect account found. Please complete onboarding first.' },
        { status: 400 }
      )
    }

    // Check if onboarding is complete
    const isComplete = user.publicMetadata?.stripeConnectComplete as boolean

    if (!isComplete) {
      return NextResponse.json(
        {
          error: 'Stripe Connect onboarding not complete',
          requiresOnboarding: true,
        },
        { status: 400 }
      )
    }

    // Generate login link to Express Dashboard
    const loginLink = await createLoginLink(accountId)

    console.log('Generated Express Dashboard login link for user:', userId)

    return NextResponse.json({
      success: true,
      dashboardUrl: loginLink.url,
    })

  } catch (error: any) {
    console.error('Error generating Express Dashboard link:', error)

    return NextResponse.json(
      {
        error: error.message || 'Failed to generate dashboard link',
        details: error.raw?.message || error.message,
      },
      { status: 500 }
    )
  }
}
