import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createAccountLink } from '@/lib/stripe'

/**
 * GET /api/stripe/connect/refresh
 *
 * Generate a new onboarding link if the user exits the Stripe onboarding flow midway
 *
 * This endpoint is called when:
 * - The user's onboarding link has expired (links expire after 5 minutes)
 * - The user exits the onboarding flow and wants to continue later
 * - There's an error during onboarding and we need to regenerate the link
 */

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      // Redirect to sign-in if not authenticated
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      return NextResponse.redirect(`${baseUrl}/sign-in`)
    }

    // Get user from Clerk
    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    // Get Connect account ID from user metadata
    const accountId = user.publicMetadata?.stripeConnectAccountId as string | undefined

    if (!accountId) {
      console.error('No Connect account ID found for user:', userId)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      return NextResponse.redirect(
        `${baseUrl}/seller/dashboard?error=no_account_id`
      )
    }

    // Generate new onboarding link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const accountLink = await createAccountLink({
      accountId,
      refreshUrl: `${baseUrl}/api/stripe/connect/refresh`,
      returnUrl: `${baseUrl}/api/stripe/connect/return`,
      type: 'account_onboarding',
    })

    console.log('Generated refresh link for user:', userId, 'Account:', accountId)

    // Redirect to the new onboarding link
    return NextResponse.redirect(accountLink.url)

  } catch (error: any) {
    console.error('Error in Connect refresh handler:', error)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return NextResponse.redirect(
      `${baseUrl}/seller/dashboard?error=refresh_failed`
    )
  }
}
