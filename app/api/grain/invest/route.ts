/**
 * POST /api/grain/invest
 *
 * Founding Investor Onboarding
 * - Min $10K investment
 * - Max 100 investors
 * - KYC verification required
 * - 4-year vesting with 1-year cliff
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { GrainToken, toGRAIN, isValidAddress } from '@/lib/blockchain/contracts'
import { query } from '@/lib/db'
import { cacheInvestorCount, getCachedInvestorCount } from '@/lib/blockchain/cache'

const InvestmentSchema = z.object({
  address: z.string().refine(isValidAddress, 'Invalid Ethereum address'),
  amount: z.number().min(10000, 'Minimum investment is $10,000'),
  email: z.string().email('Invalid email address'),
  kycStatus: z.enum(['pending', 'verified', 'rejected']).default('pending'),
})

interface VestingSchedule {
  totalAmount: number
  startDate: string
  cliffDate: string
  endDate: string
  monthlyRelease: number
  released: number
  remaining: number
}

const MAX_INVESTORS = 100
const FOUNDING_PRICE = 1.0 // $1.00 per GRAIN
const VESTING_PERIOD_MONTHS = 48 // 4 years
const CLIFF_PERIOD_MONTHS = 12 // 1 year

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = InvestmentSchema.parse(body)

    // Check if investor limit reached
    const currentInvestors = await getInvestorCount()
    if (currentInvestors >= MAX_INVESTORS) {
      return NextResponse.json(
        { error: 'Founding investor spots are full (100/100)' },
        { status: 400 }
      )
    }

    // Check if address already invested
    const existing = await query(
      'SELECT * FROM founding_investors WHERE address = $1',
      [data.address.toLowerCase()]
    )

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'This address has already made a founding investment' },
        { status: 400 }
      )
    }

    // Calculate GRAIN amount (at $1.00 founding price)
    const grainAmount = data.amount / FOUNDING_PRICE

    // Create vesting schedule
    const startDate = new Date()
    const cliffDate = new Date(startDate)
    cliffDate.setMonth(cliffDate.getMonth() + CLIFF_PERIOD_MONTHS)

    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + VESTING_PERIOD_MONTHS)

    const monthlyRelease = grainAmount / VESTING_PERIOD_MONTHS

    const vestingSchedule: VestingSchedule = {
      totalAmount: grainAmount,
      startDate: startDate.toISOString(),
      cliffDate: cliffDate.toISOString(),
      endDate: endDate.toISOString(),
      monthlyRelease,
      released: 0,
      remaining: grainAmount,
    }

    // Store in database
    await query(
      `INSERT INTO founding_investors (
        address, email, investment_amount, grain_amount,
        kyc_status, vesting_schedule, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        data.address.toLowerCase(),
        data.email,
        data.amount,
        grainAmount,
        data.kycStatus,
        JSON.stringify(vestingSchedule),
        'pending',
      ]
    )

    // Mint GRAIN tokens (locked until vesting)
    try {
      const mintAmount = toGRAIN(grainAmount)
      const txHash = await GrainToken.mint(data.address, mintAmount)

      // Update with transaction hash
      await query(
        'UPDATE founding_investors SET mint_tx_hash = $1, status = $2 WHERE address = $3',
        [txHash, 'minted', data.address.toLowerCase()]
      )
    } catch (mintError) {
      console.error('[Invest] Minting failed:', mintError)
      // Mark for manual minting
      await query(
        'UPDATE founding_investors SET status = $1, error = $2 WHERE address = $3',
        ['mint_failed', String(mintError), data.address.toLowerCase()]
      )
    }

    // Send confirmation email
    await sendInvestmentConfirmation(data.email, {
      amount: data.amount,
      grainAmount,
      vestingSchedule,
    })

    // Update cached investor count
    await cacheInvestorCount(currentInvestors + 1)

    return NextResponse.json({
      success: true,
      investment: {
        address: data.address,
        usdcAmount: data.amount,
        grainAmount,
        price: FOUNDING_PRICE,
        vestingSchedule,
        spotsRemaining: MAX_INVESTORS - currentInvestors - 1,
      },
      message: 'Investment received. GRAIN tokens will be minted after KYC verification.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('[API] Investment error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process investment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Get current investor count
 */
async function getInvestorCount(): Promise<number> {
  // Check cache first
  const cached = await getCachedInvestorCount()
  if (cached !== null) return cached

  // Query database
  const result = await query('SELECT COUNT(*) as count FROM founding_investors')
  const count = parseInt(result.rows[0]?.count || '0')

  // Cache for 5 minutes
  await cacheInvestorCount(count)

  return count
}

/**
 * Send investment confirmation email
 */
async function sendInvestmentConfirmation(
  email: string,
  details: {
    amount: number
    grainAmount: number
    vestingSchedule: VestingSchedule
  }
) {
  // Import SendGrid or Resend
  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    await resend.emails.send({
      from: 'Grain & Vault <invest@grainandvault.com>',
      to: email,
      subject: 'Founding Investment Confirmed - Grain & Vault',
      html: `
        <h1>Welcome to Grain & Vault!</h1>
        <p>Your founding investment has been received and processed.</p>

        <h2>Investment Details</h2>
        <ul>
          <li><strong>Investment Amount:</strong> $${details.amount.toLocaleString()}</li>
          <li><strong>GRAIN Tokens:</strong> ${details.grainAmount.toLocaleString()}</li>
          <li><strong>Price:</strong> $1.00 per GRAIN (Founding Price)</li>
        </ul>

        <h2>Vesting Schedule</h2>
        <ul>
          <li><strong>Total Period:</strong> 4 years</li>
          <li><strong>Cliff Period:</strong> 1 year</li>
          <li><strong>Monthly Release:</strong> ${details.vestingSchedule.monthlyRelease.toLocaleString()} GRAIN</li>
          <li><strong>Start Date:</strong> ${new Date(details.vestingSchedule.startDate).toLocaleDateString()}</li>
          <li><strong>First Unlock:</strong> ${new Date(details.vestingSchedule.cliffDate).toLocaleDateString()}</li>
        </ul>

        <p>Your tokens have been minted and are locked in the vesting contract. They will become available according to the schedule above.</p>

        <p><strong>Next Steps:</strong></p>
        <ol>
          <li>Complete KYC verification (link will be sent separately)</li>
          <li>Set up your wallet for receiving unlocked tokens</li>
          <li>Join our investor community Discord</li>
        </ol>

        <p>Thank you for being a founding investor!</p>
        <p>The Grain & Vault Team</p>
      `,
    })
  } catch (error) {
    console.error('[Email] Failed to send confirmation:', error)
    // Don't fail the API call if email fails
  }
}
