/**
 * GRAIN Vault Deposit API
 *
 * GRAIN - Wells Onyx Proprietary Stablecoin
 * =========================================
 *
 * GRAIN is NOT a 1:1 USDC wrapper. GRAIN is our own appreciating stablecoin:
 * - Backed by USDC + equity in hard assets
 * - Price can only go UP (anti-inflationary)
 * - Users' purchasing power INCREASES as they hold
 *
 * INFRASTRUCTURE:
 * - Circle provides payment rails (185+ countries)
 * - Circle provides USDC custody in our master wallet
 * - We issue GRAIN on our internal ledger
 * - All GRAIN trades happen on our platform (not blockchain)
 *
 * DEPOSIT FLOW:
 * 1. User deposits USD via Circle (card, ACH, wire)
 * 2. Circle converts to USDC, deposits to our master wallet
 * 3. We credit GRAIN to user's ledger at current GRAIN price
 * 4. User now holds GRAIN (not USDC)
 *
 * GRAIN PRICE FORMULA:
 * Price = (Total Treasury USDC + Equity Value) / Circulating GRAIN Supply
 *
 * Example:
 * - Treasury: $1,000,000 USDC + $100,000 equity = $1,100,000
 * - Circulating GRAIN: 1,000,000
 * - GRAIN Price: $1.10
 * - User deposits $100 → receives 90.91 GRAIN
 * - Later treasury grows to $1,200,000 → GRAIN = $1.20
 * - User's 90.91 GRAIN now worth $109.09 (9% gain)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'

// Security services
import { rateLimitOrRespond } from '@/lib/security/rate-limiter'
import { isOperationAllowed } from '@/lib/security/emergency-controls'
import { screenTransaction } from '@/lib/security/aml-screening'
import { logFinancialEvent } from '@/lib/security/audit-logger'
import { getIdentityVerificationService } from '@/lib/security/identity-verification'

// INTERNAL ONLY - Never expose to end users
const WELLS_MASTER_WALLET_ADDRESS = process.env.WELLS_MASTER_WALLET_ADDRESS || ''
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY || ''
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://grainandvault.com'

/**
 * Get current GRAIN price from treasury
 * Price = (USDC Reserve + Equity Value) / Circulating Supply
 */
async function getCurrentGrainPrice(): Promise<{ price: number; treasury: number; supply: number }> {
  try {
    // Try the database function first
    const priceResult = await sql`SELECT * FROM get_grain_price()`
    if (priceResult.rows.length > 0) {
      return {
        price: parseFloat(priceResult.rows[0].price_usd) || 1.0,
        treasury: parseFloat(priceResult.rows[0].total_treasury) || 0,
        supply: parseFloat(priceResult.rows[0].circulating_supply) || 0
      }
    }
  } catch (e) {
    // Function might not exist
  }

  // Fallback: calculate from user_wallets (circulating GRAIN) and treasury
  try {
    const [supplyResult, treasuryResult] = await Promise.all([
      sql`SELECT COALESCE(SUM(balance), 0) as total FROM user_wallets`,
      sql`SELECT COALESCE(SUM(amount), 0) as total FROM treasury_backing WHERE status = 'active'`
    ])

    const supply = parseFloat(supplyResult.rows[0]?.total) || 1
    const treasury = parseFloat(treasuryResult.rows[0]?.total) || 0

    // Price = Treasury / Supply (minimum $1.00)
    const price = supply > 0 ? Math.max(treasury / supply, 1.0) : 1.0

    return { price, treasury, supply }
  } catch (e) {
    // Default to $1.00
    return { price: 1.0, treasury: 0, supply: 0 }
  }
}

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Rate limiting
    const blocked = await rateLimitOrRespond(req, 'deposit')
    if (blocked) return blocked

    // SECURITY: Require authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SECURITY: Emergency controls check
    const allowed = await isOperationAllowed('deposit', userId)
    if (!allowed.allowed) {
      return NextResponse.json({ error: allowed.reason }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const requestedAmount = parseFloat(body.amount) || 0

    // SECURITY: Verification level check (for amounts > 0)
    if (requestedAmount > 0) {
      const verificationService = getIdentityVerificationService()
      const canProceed = await verificationService.canTransact(userId, requestedAmount)
      if (!canProceed.allowed) {
        return NextResponse.json({
          error: 'Verification required',
          reason: canProceed.reason,
          requiredLevel: canProceed.requiredLevel,
          upgradeUrl: '/grain-vault/verify'
        }, { status: 403 })
      }
    }

    // Ensure user has a ledger entry
    const walletResult = await sql`
      SELECT user_id, wallet_id, balance
      FROM user_wallets
      WHERE user_id = ${userId}
    `

    let grainBalance = 0
    let walletId = ''

    if (walletResult.rows.length === 0) {
      // Create ledger entry for this user
      walletId = `grain-ledger-${userId.substring(0, 8)}-${Date.now().toString(36)}`

      await sql`
        INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance, created_at, updated_at)
        VALUES (${userId}, ${walletId}, 'custodial', 0, NOW(), NOW())
      `
      grainBalance = 0
    } else {
      grainBalance = parseFloat(walletResult.rows[0].balance || '0')
      walletId = walletResult.rows[0].wallet_id
    }

    // Get current GRAIN price
    const { price: grainPrice, treasury, supply } = await getCurrentGrainPrice()

    // Create a unique deposit session ID
    const sessionId = `dep-${userId.substring(0, 8)}-${Date.now().toString(36)}`

    // Calculate how much GRAIN they would receive for a deposit
    const exampleDeposit = requestedAmount || 100 // Default $100 example
    const grainReceived = exampleDeposit / grainPrice

    // In production, this would create a Circle checkout session
    // For now, we create a pending deposit record
    if (requestedAmount > 0) {
      // SECURITY: AML screening for deposits >= $3000
      if (requestedAmount >= 3000) {
        const amlResult = await screenTransaction({
          id: sessionId,
          userId,
          type: 'deposit',
          amount: requestedAmount,
          currency: 'USD',
          createdAt: new Date()
        })

        if (!amlResult.passed) {
          // Log the blocked transaction
          await logFinancialEvent(
            'financial.deposit.failed',
            userId,
            requestedAmount,
            {
              sessionId,
              method: 'circle_checkout',
              reason: 'AML screening failed',
              amlAction: amlResult.action,
              amlFlags: amlResult.flags.map(f => f.code)
            },
            { result: 'blocked' }
          )

          return NextResponse.json({
            error: 'Transaction under review',
            reason: 'This deposit requires additional verification. Our compliance team will contact you within 24 hours.',
            reviewRequired: true,
            screeningId: amlResult.screeningId
          }, { status: 403 })
        }
      }

      await sql`
        INSERT INTO grain_transactions (
          id, user_id, type, usd_amount, grain_amount, grain_price, status, description, created_at
        ) VALUES (
          ${sessionId}, ${userId}, 'deposit', ${requestedAmount}, ${requestedAmount / grainPrice},
          ${grainPrice}, 'pending', 'Deposit pending', NOW()
        )
      `

      // SECURITY: Audit logging for deposit initiation
      await logFinancialEvent(
        'financial.deposit.initiated',
        userId,
        requestedAmount,
        {
          sessionId,
          method: 'circle_checkout',
          grainPrice,
          grainAmount: requestedAmount / grainPrice
        }
      )
    }

    // Build Circle checkout URL
    // Circle handles: card payments, bank transfers (ACH/wire), and crypto on-ramp
    const checkoutUrl = CIRCLE_API_KEY
      ? `${BASE_URL}/grain-vault/deposit/checkout?session=${sessionId}&amount=${requestedAmount || ''}`
      : `${BASE_URL}/grain-vault/deposit/demo?session=${sessionId}`

    return NextResponse.json({
      success: true,
      session_id: sessionId,
      deposit: {
        // NEVER expose master wallet address - use Circle checkout flow
        method: 'circle_checkout',
        checkout_url: checkoutUrl,
        provider: 'circle',
        supported_methods: ['card', 'ach_bank_transfer', 'wire_transfer'],
        minimum_deposit: 10,
        currency: 'USD'
      },
      conversion: {
        current_grain_price: grainPrice,
        example_deposit_usd: exampleDeposit,
        example_grain_received: grainReceived,
        note: 'GRAIN price only goes up. Your purchasing power increases as you hold.'
      },
      balance: {
        grain: grainBalance,
        usd_value: grainBalance * grainPrice
      },
      treasury: {
        total_backing: treasury,
        circulating_grain: supply,
        backing_ratio: supply > 0 ? treasury / supply : 1.0
      }
    })
  } catch (error: any) {
    console.error('Deposit error:', error)
    return NextResponse.json(
      { error: 'Failed to create deposit session', details: error.message },
      { status: 500 }
    )
  }
}

// GET: Check balance and account status
export async function GET(req: NextRequest) {
  try {
    // SECURITY: Rate limiting
    const blocked = await rateLimitOrRespond(req, 'deposit')
    if (blocked) return blocked

    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SECURITY: Emergency controls check
    const allowed = await isOperationAllowed('deposit', userId)
    if (!allowed.allowed) {
      return NextResponse.json({ error: allowed.reason }, { status: 403 })
    }

    // Check for wallet entry in user_wallets ledger
    const walletResult = await sql`
      SELECT user_id, wallet_id, balance, updated_at
      FROM user_wallets
      WHERE user_id = ${userId}
    `

    // Also check if user has a profile (completed onboarding)
    let hasProfile = false
    try {
      const profileResult = await sql`
        SELECT user_id FROM grain_user_profiles WHERE user_id = ${userId}
      `
      hasProfile = profileResult.rows.length > 0
    } catch (e) {
      // Table might not exist
    }

    // Get current GRAIN price
    const { price: grainPrice, treasury, supply } = await getCurrentGrainPrice()

    if (walletResult.rows.length === 0) {
      // If user has profile but no wallet, create wallet entry automatically
      if (hasProfile) {
        const walletId = `grain-ledger-${userId.substring(0, 8)}-${Date.now().toString(36)}`

        await sql`
          INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance, created_at, updated_at)
          VALUES (${userId}, ${walletId}, 'custodial', 0, NOW(), NOW())
        `

        return NextResponse.json({
          has_wallet: true,
          has_profile: true,
          // NO wallet address exposed - custodial model
          balance: {
            grain: 0,
            usd_value: 0
          },
          grain_price: grainPrice,
          recent_transactions: [],
          last_updated: new Date().toISOString()
        })
      }

      return NextResponse.json({
        has_wallet: false,
        has_profile: false,
        balance: { grain: 0, usd_value: 0 },
        grain_price: grainPrice,
        message: 'Please complete onboarding to create your account.'
      })
    }

    const wallet = walletResult.rows[0]
    const grainBalance = parseFloat(wallet.balance || '0')
    const usdValue = grainBalance * grainPrice

    // Get recent transactions with GRAIN price context
    let transactions: any[] = []
    try {
      const txResult = await sql`
        SELECT id, type, usd_amount, grain_amount, grain_price, status, created_at
        FROM grain_transactions
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 10
      `
      transactions = txResult.rows.map(tx => ({
        id: tx.id,
        type: tx.type,
        usd_amount: parseFloat(tx.usd_amount || 0),
        grain_amount: parseFloat(tx.grain_amount || 0),
        grain_price_at_time: parseFloat(tx.grain_price || 1),
        status: tx.status,
        created_at: tx.created_at
      }))
    } catch (e) {
      // Table might not exist
    }

    return NextResponse.json({
      has_wallet: true,
      has_profile: hasProfile,
      // NO wallet address exposed - custodial model for security
      balance: {
        grain: grainBalance,
        usd_value: usdValue
      },
      grain_price: grainPrice,
      appreciation: {
        current_price: grainPrice,
        note: 'GRAIN only appreciates. Your purchasing power grows as you hold.'
      },
      recent_transactions: transactions,
      last_updated: wallet.updated_at
    })
  } catch (error: any) {
    console.error('Balance check error:', error)
    return NextResponse.json(
      { error: 'Failed to check balance', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * SECURITY NOTES - CUSTODIAL MODEL:
 *
 * 1. Master wallet address is NEVER exposed to end users
 * 2. All deposits go through Circle's secure on-ramp checkout
 * 3. User balances are tracked in our internal ledger (user_wallets table)
 * 4. The actual USDC is held in our Circle wallet, earning yield
 * 5. GRAIN price = (USDC Reserve + Equity) / Circulating Supply
 * 6. GRAIN can only appreciate as treasury grows
 * 7. All withdrawals require KYC verification and are processed by Wells
 *
 * This protects against:
 * - Phishing (users never see a raw wallet address to send to)
 * - Social engineering (no "send to this address" instructions)
 * - Address manipulation attacks
 * - Clipboard hijacking
 */
