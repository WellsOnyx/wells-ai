import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { getSellerBalance, getSellerTransfers, getUpcomingPayout } from '@/lib/stripe'

/**
 * GET /api/stripe/connect/stats
 *
 * Get seller earnings, balance, and transaction statistics
 *
 * Response:
 * - earnings: { available, pending }
 * - recentTransfers: Array of recent transfers
 * - upcomingPayout: Next payout details (if any)
 * - payoutSchedule: 'Daily'
 */

export async function GET(request: NextRequest) {
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

    // Fetch seller statistics
    const [balance, transfers, upcomingPayout] = await Promise.all([
      getSellerBalance(accountId),
      getSellerTransfers(accountId, 10), // Last 10 transfers
      getUpcomingPayout(accountId),
    ])

    // Calculate total available and pending
    const available = balance.available.reduce((sum, item) => sum + item.amount, 0)
    const pending = balance.pending.reduce((sum, item) => sum + item.amount, 0)

    // Format transfers for response
    const recentTransfers = transfers.map(transfer => ({
      id: transfer.id,
      amount: transfer.amount,
      created: transfer.created,
      description: transfer.description || 'Wells AI Transaction',
      currency: transfer.currency,
    }))

    return NextResponse.json({
      success: true,
      accountId,
      earnings: {
        available,
        pending,
      },
      recentTransfers,
      upcomingPayout: upcomingPayout ? {
        amount: upcomingPayout.amount,
        arrival_date: upcomingPayout.arrival_date,
      } : null,
      payoutSchedule: 'Daily',
    })

  } catch (error: any) {
    console.error('Error fetching seller stats:', error)

    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch seller statistics',
        details: error.raw?.message || error.message,
      },
      { status: 500 }
    )
  }
}
