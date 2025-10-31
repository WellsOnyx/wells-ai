import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { getAccountStatus } from '@/lib/stripe'

/**
 * GET /api/stripe/connect/return
 *
 * Handle return from Stripe Connect onboarding
 * Verify that the account is fully onboarded and update Clerk metadata
 *
 * This endpoint is called after a seller completes (or attempts to complete)
 * their Stripe onboarding flow.
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

    // Check if account is fully onboarded
    const { isComplete, requiresOnboarding, account } = await getAccountStatus(accountId)

    console.log('Account status:', {
      accountId,
      isComplete,
      requiresOnboarding,
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
    })

    if (isComplete) {
      // Update Clerk metadata to mark onboarding as complete
      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...user.publicMetadata,
          stripeConnectAccountId: accountId,
          stripeConnectComplete: true,
          stripeConnectCompletedAt: new Date().toISOString(),
        },
      })

      console.log('Connect onboarding completed for user:', userId)

      // Redirect to seller dashboard with success message
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      return NextResponse.redirect(
        `${baseUrl}/seller/dashboard?success=onboarding_complete`
      )
    } else {
      // Onboarding not complete yet
      console.log('Connect onboarding not complete for user:', userId)

      // Update metadata to indicate incomplete status
      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...user.publicMetadata,
          stripeConnectAccountId: accountId,
          stripeConnectComplete: false,
        },
      })

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      return NextResponse.redirect(
        `${baseUrl}/seller/dashboard?error=onboarding_incomplete`
      )
    }

  } catch (error: any) {
    console.error('Error in Connect return handler:', error)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return NextResponse.redirect(
      `${baseUrl}/seller/dashboard?error=return_handler_failed`
    )
  }
}
