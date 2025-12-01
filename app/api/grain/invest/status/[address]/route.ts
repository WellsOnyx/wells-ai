/**
 * GET /api/grain/invest/status/:address
 *
 * Check founding investor status and vesting schedule
 */

import { NextRequest, NextResponse } from 'next/server'
import { isValidAddress } from '@/lib/blockchain/contracts'
import { query } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const { address } = params

    if (!isValidAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address' },
        { status: 400 }
      )
    }

    // Query investor data
    const result = await query(
      `SELECT
        address, email, investment_amount, grain_amount,
        kyc_status, vesting_schedule, status, mint_tx_hash,
        created_at
       FROM founding_investors
       WHERE address = $1`,
      [address.toLowerCase()]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'No founding investment found for this address' },
        { status: 404 }
      )
    }

    const investor = result.rows[0]
    const vestingSchedule = JSON.parse(investor.vesting_schedule)

    // Calculate unlocked amount
    const now = new Date()
    const startDate = new Date(vestingSchedule.startDate)
    const cliffDate = new Date(vestingSchedule.cliffDate)
    const endDate = new Date(vestingSchedule.endDate)

    let unlockedAmount = 0
    let nextUnlock = cliffDate

    if (now < cliffDate) {
      // Still in cliff period
      unlockedAmount = 0
      nextUnlock = cliffDate
    } else if (now >= endDate) {
      // Fully vested
      unlockedAmount = vestingSchedule.totalAmount
      nextUnlock = endDate
    } else {
      // Calculate monthly unlock
      const monthsSinceStart = Math.floor(
        (now.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)
      )
      unlockedAmount = monthsSinceStart * vestingSchedule.monthlyRelease

      // Next unlock date
      const nextUnlockMonth = monthsSinceStart + 1
      nextUnlock = new Date(startDate)
      nextUnlock.setMonth(nextUnlock.getMonth() + nextUnlockMonth)
    }

    return NextResponse.json({
      investor: {
        address: investor.address,
        email: investor.email,
        investmentAmount: investor.investment_amount,
        grainAmount: investor.grain_amount,
        kycStatus: investor.kyc_status,
        status: investor.status,
        mintTxHash: investor.mint_tx_hash,
        investedAt: investor.created_at,
      },
      vesting: {
        totalAmount: vestingSchedule.totalAmount,
        unlockedAmount: Math.min(unlockedAmount, vestingSchedule.totalAmount),
        lockedAmount: Math.max(0, vestingSchedule.totalAmount - unlockedAmount),
        startDate: vestingSchedule.startDate,
        cliffDate: vestingSchedule.cliffDate,
        endDate: vestingSchedule.endDate,
        monthlyRelease: vestingSchedule.monthlyRelease,
        nextUnlockDate: nextUnlock.toISOString(),
        nextUnlockAmount: vestingSchedule.monthlyRelease,
        progress: Math.min(100, (unlockedAmount / vestingSchedule.totalAmount) * 100),
      },
    })
  } catch (error) {
    console.error('[API] Error fetching investor status:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch investor status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
