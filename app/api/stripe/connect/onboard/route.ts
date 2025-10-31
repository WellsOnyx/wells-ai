import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { z } from 'zod'
import { createConnectAccount, createAccountLink } from '@/lib/stripe'

/**
 * POST /api/stripe/connect/onboard
 *
 * Create a Stripe Connect account for the current user and generate an onboarding link
 *
 * Request body:
 * - None required (uses authenticated user's email from Clerk)
 *
 * Response:
 * - onboardingUrl: URL to redirect user to complete Stripe onboarding
 * - accountId: Stripe Connect account ID (saved to Clerk metadata)
 */

const requestSchema = z.object({
  country: z.string().optional().default('US'),
})

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

    if (!user.emailAddresses || user.emailAddresses.length === 0) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      )
    }

    const email = user.emailAddresses[0].emailAddress

    // Check if user already has a Connect account
    const existingAccountId = user.publicMetadata?.stripeConnectAccountId as string | undefined

    let accountId: string

    if (existingAccountId) {
      // User already has a Connect account, use it
      accountId = existingAccountId
      console.log('User already has Connect account:', accountId)
    } else {
      // Parse request body
      const body = await request.json().catch(() => ({}))
      const { country } = requestSchema.parse(body)

      // Create new Stripe Connect account
      const account = await createConnectAccount({
        email,
        country,
        type: 'express',
      })

      accountId = account.id

      // Save Connect account ID to Clerk user metadata
      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...user.publicMetadata,
          stripeConnectAccountId: accountId,
          stripeConnectComplete: false,
        },
      })

      console.log('Created Connect account for user:', userId, 'Account:', accountId)
    }

    // Generate onboarding link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const accountLink = await createAccountLink({
      accountId,
      refreshUrl: `${baseUrl}/api/stripe/connect/refresh`,
      returnUrl: `${baseUrl}/api/stripe/connect/return`,
      type: 'account_onboarding',
    })

    return NextResponse.json({
      success: true,
      onboardingUrl: accountLink.url,
      accountId,
    })

  } catch (error: any) {
    console.error('Error in Connect onboarding:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: error.message || 'Failed to create onboarding link',
        details: error.raw?.message || error.message
      },
      { status: 500 }
    )
  }
}
