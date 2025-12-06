// @ts-nocheck
/**
 * Commission Distribution API
 * POST: Distribute MLM commissions from a transaction
 * Called internally when processing treasury transactions
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

// Platform fee rate
const PLATFORM_FEE_RATE = 0.045 // 4.5%

// GRAIN conversion rate (can be made dynamic)
const GRAIN_RATE = 0.001 // 1 GRAIN = $0.001

// Internal API key check
function validateInternalRequest(req: NextRequest): boolean {
  const authHeader = req.headers.get('Authorization')
  const internalKey = process.env.INTERNAL_API_KEY || 'wells-internal-2024'
  return authHeader === `Bearer ${internalKey}`
}

export async function POST(req: NextRequest) {
  try {
    // This endpoint is internal-only
    if (!validateInternalRequest(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { transactionId, userId, amount, type } = body

    if (!transactionId || !userId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: transactionId, userId, amount' },
        { status: 400 }
      )
    }

    // Only process certain transaction types
    const commissionableTypes = ['deposit', 'payment', 'withdrawal', 'trade']
    if (type && !commissionableTypes.includes(type)) {
      return NextResponse.json({
        success: true,
        message: 'Transaction type not eligible for commission',
        distributed: []
      })
    }

    // Calculate platform fee
    const platformFee = amount * PLATFORM_FEE_RATE

    // Get user's referral chain
    const chain = await sql`
      SELECT referrer_id, referrer_l2_id, referrer_l3_id
      FROM referral_chains
      WHERE user_id = ${userId}
    `

    if (chain.rows.length === 0) {
      // User has no referral chain - keep all fee
      return NextResponse.json({
        success: true,
        message: 'No referral chain for user',
        platformFee,
        distributed: []
      })
    }

    const { referrer_id, referrer_l2_id, referrer_l3_id } = chain.rows[0]

    // Get commission config
    const config = await sql`
      SELECT level, commission_pct, effective_rate, is_active
      FROM referral_commission_config
      WHERE is_active = true
      ORDER BY level
    `

    const commissionConfig = {}
    config.rows.forEach(c => {
      commissionConfig[c.level] = {
        pct: parseFloat(c.commission_pct),
        rate: parseFloat(c.effective_rate)
      }
    })

    const distributed = []

    // L1 Commission (direct referrer)
    if (referrer_id && commissionConfig[1]) {
      const commission = platformFee * (commissionConfig[1].pct / 100)
      const grain = Math.floor(commission / GRAIN_RATE)

      await sql`
        INSERT INTO network_commissions (
          source_tx_id, source_user_id, recipient_id, level,
          transaction_amount, platform_fee, commission_pct, commission_amount,
          grain_amount, grain_rate, status
        ) VALUES (
          ${transactionId}::uuid, ${userId}, ${referrer_id}, 1,
          ${amount}, ${platformFee}, ${commissionConfig[1].pct}, ${commission},
          ${grain}, ${GRAIN_RATE}, 'pending'
        )
      `

      // Update stats
      await sql`
        INSERT INTO network_stats (
          user_id, l1_total_earned, l1_grain_earned, total_earned,
          total_grain_earned, monthly_earned, monthly_grain_earned, last_commission_at
        ) VALUES (
          ${referrer_id}, ${commission}, ${grain}, ${commission},
          ${grain}, ${commission}, ${grain}, NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          l1_total_earned = network_stats.l1_total_earned + ${commission},
          l1_grain_earned = network_stats.l1_grain_earned + ${grain},
          total_earned = network_stats.total_earned + ${commission},
          total_grain_earned = network_stats.total_grain_earned + ${grain},
          monthly_earned = network_stats.monthly_earned + ${commission},
          monthly_grain_earned = network_stats.monthly_grain_earned + ${grain},
          last_commission_at = NOW(),
          updated_at = NOW()
      `

      distributed.push({
        level: 1,
        recipientId: referrer_id,
        commission,
        grain
      })
    }

    // L2 Commission (referrer's referrer)
    if (referrer_l2_id && commissionConfig[2]) {
      const commission = platformFee * (commissionConfig[2].pct / 100)
      const grain = Math.floor(commission / GRAIN_RATE)

      await sql`
        INSERT INTO network_commissions (
          source_tx_id, source_user_id, recipient_id, level,
          transaction_amount, platform_fee, commission_pct, commission_amount,
          grain_amount, grain_rate, status
        ) VALUES (
          ${transactionId}::uuid, ${userId}, ${referrer_l2_id}, 2,
          ${amount}, ${platformFee}, ${commissionConfig[2].pct}, ${commission},
          ${grain}, ${GRAIN_RATE}, 'pending'
        )
      `

      await sql`
        INSERT INTO network_stats (
          user_id, l2_total_earned, l2_grain_earned, total_earned,
          total_grain_earned, monthly_earned, monthly_grain_earned, last_commission_at
        ) VALUES (
          ${referrer_l2_id}, ${commission}, ${grain}, ${commission},
          ${grain}, ${commission}, ${grain}, NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          l2_total_earned = network_stats.l2_total_earned + ${commission},
          l2_grain_earned = network_stats.l2_grain_earned + ${grain},
          total_earned = network_stats.total_earned + ${commission},
          total_grain_earned = network_stats.total_grain_earned + ${grain},
          monthly_earned = network_stats.monthly_earned + ${commission},
          monthly_grain_earned = network_stats.monthly_grain_earned + ${grain},
          last_commission_at = NOW(),
          updated_at = NOW()
      `

      distributed.push({
        level: 2,
        recipientId: referrer_l2_id,
        commission,
        grain
      })
    }

    // L3 Commission (L2's referrer)
    if (referrer_l3_id && commissionConfig[3]) {
      const commission = platformFee * (commissionConfig[3].pct / 100)
      const grain = Math.floor(commission / GRAIN_RATE)

      await sql`
        INSERT INTO network_commissions (
          source_tx_id, source_user_id, recipient_id, level,
          transaction_amount, platform_fee, commission_pct, commission_amount,
          grain_amount, grain_rate, status
        ) VALUES (
          ${transactionId}::uuid, ${userId}, ${referrer_l3_id}, 3,
          ${amount}, ${platformFee}, ${commissionConfig[3].pct}, ${commission},
          ${grain}, ${GRAIN_RATE}, 'pending'
        )
      `

      await sql`
        INSERT INTO network_stats (
          user_id, l3_total_earned, l3_grain_earned, total_earned,
          total_grain_earned, monthly_earned, monthly_grain_earned, last_commission_at
        ) VALUES (
          ${referrer_l3_id}, ${commission}, ${grain}, ${commission},
          ${grain}, ${commission}, ${grain}, NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          l3_total_earned = network_stats.l3_total_earned + ${commission},
          l3_grain_earned = network_stats.l3_grain_earned + ${grain},
          total_earned = network_stats.total_earned + ${commission},
          total_grain_earned = network_stats.total_grain_earned + ${grain},
          monthly_earned = network_stats.monthly_earned + ${commission},
          monthly_grain_earned = network_stats.monthly_grain_earned + ${grain},
          last_commission_at = NOW(),
          updated_at = NOW()
      `

      distributed.push({
        level: 3,
        recipientId: referrer_l3_id,
        commission,
        grain
      })
    }

    // Calculate totals
    const totalDistributed = distributed.reduce((sum, d) => sum + d.commission, 0)
    const platformRetained = platformFee - totalDistributed

    return NextResponse.json({
      success: true,
      transactionAmount: amount,
      platformFee,
      distributed,
      totalDistributed,
      platformRetained,
      message: `Distributed $${totalDistributed.toFixed(4)} in commissions to ${distributed.length} levels`
    })
  } catch (error) {
    console.error('Error distributing commissions:', error)
    return NextResponse.json(
      { error: 'Failed to distribute commissions' },
      { status: 500 }
    )
  }
}
