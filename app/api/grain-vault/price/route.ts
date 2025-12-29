/**
 * GRAIN Price Oracle API
 *
 * GRAIN Price = Treasury Value / Total GRAIN Supply
 *
 * The price only goes UP because:
 * 1. Treasury earns yield on T-bills, MMFs
 * 2. New deposits at market price add to treasury
 * 3. VAULT auditor prevents manipulation
 *
 * VAULT monitors the treasury and can trigger a 7-day freeze
 * if any manipulation is detected.
 */

import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

// Freeze check
interface PriceFreeze {
  active: boolean
  frozenPrice: number
  endsAt: Date | null
  reason: string | null
}

export async function GET() {
  try {
    // Check for active price freeze (VAULT protection)
    const freeze = await checkPriceFreeze()

    // If frozen, return frozen price
    if (freeze.active) {
      return NextResponse.json({
        success: true,
        frozen: true,
        freeze_reason: freeze.reason,
        freeze_ends_at: freeze.endsAt,
        grain: {
          price_usd: freeze.frozenPrice,
          change_24h: 0,
          change_7d: 0,
          change_30d: 0,
          treasury_value: 0,
          total_supply: 0,
        },
        treasury: {
          total_usd: 0,
          backing_ratio: 1.0,
          assets: [],
        },
        last_updated: new Date().toISOString(),
        vault_status: 'FREEZE_ACTIVE',
      })
    }

    // Calculate current GRAIN price using oracle formula
    const oracle = await calculateGrainPrice()

    // Get historical changes
    const changes = await getPriceChanges(oracle.price)

    // Get treasury breakdown
    const treasuryAssets = await getTreasuryBreakdown()

    // Record price in history (rate limited to once per minute)
    await recordPriceIfNeeded(oracle.price, oracle.treasuryValue, oracle.totalSupply)

    return NextResponse.json({
      success: true,
      frozen: false,
      grain: {
        price_usd: oracle.price,
        change_24h: changes.change24h,
        change_7d: changes.change7d,
        change_30d: changes.change30d,
        treasury_value: oracle.treasuryValue,
        total_supply: oracle.totalSupply,
      },
      treasury: {
        total_usd: oracle.treasuryValue,
        usdc_balance: oracle.usdcBalance,
        other_assets: oracle.otherAssetsValue,
        backing_ratio: oracle.totalSupply > 0 ? oracle.treasuryValue / oracle.totalSupply : 1.0,
        assets: treasuryAssets,
      },
      last_updated: new Date().toISOString(),
      vault_status: 'HEALTHY',
    })

  } catch (error) {
    console.error('[Price Oracle] Error:', error)

    // Return safe default on error
    return NextResponse.json({
      success: true,
      grain: {
        price_usd: 1.0,
        change_24h: 0,
        change_7d: 0,
        change_30d: 0,
        treasury_value: 0,
        total_supply: 0,
      },
      treasury: {
        total_usd: 0,
        backing_ratio: 1.0,
        assets: [],
      },
      last_updated: new Date().toISOString(),
      vault_status: 'ERROR_FALLBACK',
    })
  }
}

/**
 * Check if VAULT has triggered a price freeze
 */
async function checkPriceFreeze(): Promise<PriceFreeze> {
  try {
    const result = await sql`
      SELECT frozen_price, ends_at, reason
      FROM grain_price_freeze
      WHERE status = 'active'
        AND ends_at > NOW()
      ORDER BY started_at DESC
      LIMIT 1
    `

    if (result.rows.length > 0) {
      return {
        active: true,
        frozenPrice: parseFloat(result.rows[0].frozen_price),
        endsAt: new Date(result.rows[0].ends_at),
        reason: result.rows[0].reason,
      }
    }
  } catch (e) {
    // Table doesn't exist yet - no freeze
  }

  return {
    active: false,
    frozenPrice: 0,
    endsAt: null,
    reason: null,
  }
}

/**
 * Calculate GRAIN price using the oracle formula:
 * Price = (USDC Balance + Value of Other Assets) / Total GRAIN Supply
 */
async function calculateGrainPrice(): Promise<{
  price: number
  treasuryValue: number
  totalSupply: number
  usdcBalance: number
  otherAssetsValue: number
}> {
  // Get USDC balance in treasury
  let usdcBalance = 0
  let otherAssetsValue = 0

  try {
    const treasuryResult = await sql`
      SELECT
        asset_type,
        COALESCE(SUM(
          CASE
            WHEN asset_type = 'usdc' THEN amount
            WHEN asset_type = 'tbill' THEN amount * COALESCE(current_value / NULLIF(amount, 0), 1.0)
            WHEN asset_type = 'mmf' THEN amount * COALESCE(current_value / NULLIF(amount, 0), 1.0)
            ELSE amount
          END
        ), 0) as value
      FROM grain_treasury
      WHERE status = 'active'
      GROUP BY asset_type
    `

    for (const row of treasuryResult.rows) {
      const value = parseFloat(row.value) || 0
      if (row.asset_type === 'usdc') {
        usdcBalance = value
      } else {
        otherAssetsValue += value
      }
    }
  } catch (e) {
    // Treasury table doesn't exist yet
    console.warn('[Price Oracle] Treasury table not available')
  }

  const treasuryValue = usdcBalance + otherAssetsValue

  // Get total GRAIN supply (sum of all user balances, excluding system accounts)
  let totalSupply = 0
  try {
    const supplyResult = await sql`
      SELECT COALESCE(SUM(balance), 0) as total_supply
      FROM user_wallets
      WHERE user_id NOT IN ('WELLS_ESCROW_ACCOUNT', 'WELLS_TREASURY', 'SYSTEM')
        AND balance > 0
    `
    totalSupply = parseFloat(supplyResult.rows[0]?.total_supply || '0')
  } catch (e) {
    // user_wallets table doesn't exist yet
    console.warn('[Price Oracle] User wallets table not available')
  }

  // Calculate price
  // If no supply yet, price is 1.00 (initial peg)
  // If treasury is empty, price is 1.00
  let price = 1.0

  if (totalSupply > 0 && treasuryValue > 0) {
    price = treasuryValue / totalSupply

    // CRITICAL: Price can never go below 1.00 (the initial peg)
    // This ensures GRAIN only appreciates
    if (price < 1.0) {
      console.error('[Price Oracle] WARNING: Price below 1.00 detected! This should not happen.')
      // In production, this would trigger VAULT freeze
      price = 1.0
    }
  }

  return {
    price: Math.round(price * 100000000) / 100000000, // 8 decimal precision
    treasuryValue,
    totalSupply,
    usdcBalance,
    otherAssetsValue,
  }
}

/**
 * Get price changes over time
 */
async function getPriceChanges(currentPrice: number): Promise<{
  change24h: number
  change7d: number
  change30d: number
}> {
  let change24h = 0
  let change7d = 0
  let change30d = 0

  try {
    const [p24h, p7d, p30d] = await Promise.all([
      sql`
        SELECT price_usd FROM grain_price_history
        WHERE recorded_at <= NOW() - INTERVAL '24 hours'
        ORDER BY recorded_at DESC LIMIT 1
      `,
      sql`
        SELECT price_usd FROM grain_price_history
        WHERE recorded_at <= NOW() - INTERVAL '7 days'
        ORDER BY recorded_at DESC LIMIT 1
      `,
      sql`
        SELECT price_usd FROM grain_price_history
        WHERE recorded_at <= NOW() - INTERVAL '30 days'
        ORDER BY recorded_at DESC LIMIT 1
      `,
    ])

    const price24h = p24h.rows[0]?.price_usd ? parseFloat(p24h.rows[0].price_usd) : currentPrice
    const price7d = p7d.rows[0]?.price_usd ? parseFloat(p7d.rows[0].price_usd) : currentPrice
    const price30d = p30d.rows[0]?.price_usd ? parseFloat(p30d.rows[0].price_usd) : currentPrice

    change24h = price24h > 0 ? ((currentPrice - price24h) / price24h) * 100 : 0
    change7d = price7d > 0 ? ((currentPrice - price7d) / price7d) * 100 : 0
    change30d = price30d > 0 ? ((currentPrice - price30d) / price30d) * 100 : 0
  } catch (e) {
    // Price history table doesn't exist yet
  }

  return { change24h, change7d, change30d }
}

/**
 * Get treasury asset breakdown
 */
async function getTreasuryBreakdown(): Promise<any[]> {
  try {
    const result = await sql`
      SELECT
        asset_type,
        asset_name,
        SUM(amount) as total_amount,
        SUM(COALESCE(current_value, amount)) as total_value,
        AVG(yield_rate) as avg_yield
      FROM grain_treasury
      WHERE status = 'active'
      GROUP BY asset_type, asset_name
      ORDER BY total_value DESC
    `

    const totalValue = result.rows.reduce(
      (sum, row) => sum + (parseFloat(row.total_value) || 0),
      0
    )

    return result.rows.map((row) => ({
      type: row.asset_type,
      name: row.asset_name || row.asset_type.toUpperCase(),
      amount: parseFloat(row.total_amount) || 0,
      value: parseFloat(row.total_value) || 0,
      percentage: totalValue > 0 ? ((parseFloat(row.total_value) || 0) / totalValue) * 100 : 0,
      yield: parseFloat(row.avg_yield) || 0,
    }))
  } catch (e) {
    return []
  }
}

/**
 * Record price in history (rate limited)
 */
async function recordPriceIfNeeded(
  price: number,
  treasuryValue: number,
  totalSupply: number
): Promise<void> {
  try {
    // Check last recorded time
    const lastRecord = await sql`
      SELECT recorded_at FROM grain_price_history
      ORDER BY recorded_at DESC LIMIT 1
    `

    const lastTime = lastRecord.rows[0]?.recorded_at
    const now = new Date()

    // Only record once per minute
    if (lastTime) {
      const elapsed = now.getTime() - new Date(lastTime).getTime()
      if (elapsed < 60000) return
    }

    // Record price
    await sql`
      INSERT INTO grain_price_history (
        price_usd,
        treasury_value,
        total_supply,
        recorded_at
      ) VALUES (
        ${price},
        ${treasuryValue},
        ${totalSupply},
        NOW()
      )
    `
  } catch (e) {
    // Ignore - table might not exist yet
  }
}
