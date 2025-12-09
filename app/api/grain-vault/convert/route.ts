// @ts-nocheck
/**
 * Grain & Vault Currency Conversion API
 * GET: Get conversion quote with fees breakdown
 * POST: Execute conversion
 *
 * Fee Structure:
 * - Airwallex provider fee: ~50bp (0.5%)
 * - Grain & Vault margin: 33-50bp (configurable)
 * - Total user pays: 0.83% to 1%
 * - Volume discounts available
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sqlQuery as sql } from '@/lib/db'

// GET: Get conversion quote
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const fromCurrency = searchParams.get('from') || 'USD'
    const toCurrency = searchParams.get('to') || 'EUR'
    const amount = parseFloat(searchParams.get('amount') || '100')

    if (amount <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
    }

    // Get mid-market rate
    const rateResult = await sql`
      SELECT rate, inverse_rate, rate_source, effective_date
      FROM gv_exchange_rates
      WHERE from_currency = ${fromCurrency} AND to_currency = ${toCurrency}
      AND effective_date <= CURRENT_DATE
      ORDER BY effective_date DESC LIMIT 1
    `

    if (rateResult.rows.length === 0) {
      // Try inverse
      const inverseResult = await sql`
        SELECT rate, inverse_rate, rate_source, effective_date
        FROM gv_exchange_rates
        WHERE from_currency = ${toCurrency} AND to_currency = ${fromCurrency}
        AND effective_date <= CURRENT_DATE
        ORDER BY effective_date DESC LIMIT 1
      `

      if (inverseResult.rows.length === 0) {
        return NextResponse.json({
          error: `No exchange rate available for ${fromCurrency}/${toCurrency}`
        }, { status: 400 })
      }

      // Use inverse rate
      const midRate = parseFloat(inverseResult.rows[0].inverse_rate)
      return await calculateQuote(userId, fromCurrency, toCurrency, amount, midRate)
    }

    const midRate = parseFloat(rateResult.rows[0].rate)
    return await calculateQuote(userId, fromCurrency, toCurrency, amount, midRate)
  } catch (error) {
    console.error('Conversion quote error:', error)
    return NextResponse.json({ error: 'Failed to get quote' }, { status: 500 })
  }
}

async function calculateQuote(
  userId: string,
  fromCurrency: string,
  toCurrency: string,
  amount: number,
  midRate: number
) {
  // Get user's volume tier and margin config
  const marginResult = await sql`
    SELECT * FROM gv_get_fx_margin(${userId}, ${fromCurrency}, ${toCurrency})
  `

  const margin = marginResult.rows[0] || {
    margin_bp: 50,
    provider_fee_bp: 50,
    total_spread_bp: 100,
    volume_tier: 1
  }

  // Calculate customer rate (worse than mid by spread %)
  const spreadMultiplier = 1 - (margin.total_spread_bp / 10000)
  const customerRate = midRate * spreadMultiplier

  // What user receives
  const toAmount = amount * customerRate

  // Fee breakdown
  const midMarketAmount = amount * midRate
  const totalFee = midMarketAmount - toAmount
  const providerFee = totalFee * (margin.provider_fee_bp / margin.total_spread_bp)
  const platformMargin = totalFee * (margin.margin_bp / margin.total_spread_bp)

  // Get user's monthly volume for tier display
  const volumeResult = await sql`
    SELECT COALESCE(SUM(from_amount), 0) as monthly_volume
    FROM gv_fx_conversions
    WHERE user_id = ${userId}
    AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
  `

  const monthlyVolume = parseFloat(volumeResult.rows[0]?.monthly_volume || 0)

  return NextResponse.json({
    quote: {
      fromCurrency,
      toCurrency,
      fromAmount: amount,
      toAmount: Math.round(toAmount * 10000) / 10000,

      // Rates
      midMarketRate: midRate,
      customerRate: Math.round(customerRate * 1000000) / 1000000,
      spreadPct: margin.total_spread_bp / 100,

      // Fee breakdown (transparent)
      fees: {
        providerFeeBp: margin.provider_fee_bp,
        platformMarginBp: margin.margin_bp,
        totalSpreadBp: margin.total_spread_bp,
        providerFeeAmount: Math.round(providerFee * 100) / 100,
        platformMarginAmount: Math.round(platformMargin * 100) / 100,
        totalFeeAmount: Math.round(totalFee * 100) / 100
      },

      // Volume tier info
      volumeTier: {
        current: margin.volume_tier,
        monthlyVolume: Math.round(monthlyVolume * 100) / 100,
        tiers: [
          { tier: 1, label: 'Standard', maxVolume: 10000, marginBp: 50 },
          { tier: 2, label: 'Silver', maxVolume: 50000, marginBp: 40 },
          { tier: 3, label: 'Gold', maxVolume: 100000, marginBp: 33 }
        ]
      },

      // Quote validity
      validUntil: new Date(Date.now() + 30000).toISOString(), // 30 seconds
      quoteId: `Q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
  })
}

// POST: Execute conversion
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { fromCurrency, toCurrency, fromAmount, quoteId } = body

    if (!fromCurrency || !toCurrency || !fromAmount) {
      return NextResponse.json({
        error: 'Missing required fields: fromCurrency, toCurrency, fromAmount'
      }, { status: 400 })
    }

    // Check user has sufficient balance
    const balanceResult = await sql`
      SELECT usd_available FROM gv_user_balances WHERE user_id = ${userId}
    `

    const usdAvailable = parseFloat(balanceResult.rows[0]?.usd_available || 0)

    if (fromCurrency === 'USD' && fromAmount > usdAvailable) {
      return NextResponse.json({
        error: 'Insufficient balance',
        available: usdAvailable,
        required: fromAmount
      }, { status: 400 })
    }

    // Get current rate and margins
    const rateResult = await sql`
      SELECT rate FROM gv_exchange_rates
      WHERE from_currency = ${fromCurrency} AND to_currency = ${toCurrency}
      AND effective_date <= CURRENT_DATE
      ORDER BY effective_date DESC LIMIT 1
    `

    if (rateResult.rows.length === 0) {
      return NextResponse.json({
        error: `No exchange rate available for ${fromCurrency}/${toCurrency}`
      }, { status: 400 })
    }

    const midRate = parseFloat(rateResult.rows[0].rate)

    // Get margin config
    const marginResult = await sql`
      SELECT * FROM gv_get_fx_margin(${userId}, ${fromCurrency}, ${toCurrency})
    `

    const margin = marginResult.rows[0] || {
      margin_bp: 50,
      provider_fee_bp: 50,
      total_spread_bp: 100,
      volume_tier: 1
    }

    // Calculate amounts
    const spreadMultiplier = 1 - (margin.total_spread_bp / 10000)
    const customerRate = midRate * spreadMultiplier
    const toAmount = fromAmount * customerRate
    const midMarketAmount = fromAmount * midRate
    const totalFee = midMarketAmount - toAmount
    const providerFee = totalFee * (margin.provider_fee_bp / margin.total_spread_bp)
    const platformMargin = totalFee * (margin.margin_bp / margin.total_spread_bp)

    // Get user's monthly volume
    const volumeResult = await sql`
      SELECT COALESCE(SUM(from_amount), 0) as monthly_volume
      FROM gv_fx_conversions
      WHERE user_id = ${userId}
      AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `

    const monthlyVolume = parseFloat(volumeResult.rows[0]?.monthly_volume || 0)

    // Record the conversion
    const conversionResult = await sql`
      INSERT INTO gv_fx_conversions (
        user_id,
        from_currency, to_currency,
        from_amount, to_amount,
        mid_market_rate, customer_rate, rate_spread_pct,
        provider_fee_bp, platform_margin_bp, total_spread_bp,
        provider_fee_amount, platform_margin_amount, total_fee_amount,
        volume_tier, monthly_volume,
        status, completed_at
      ) VALUES (
        ${userId},
        ${fromCurrency}, ${toCurrency},
        ${fromAmount}, ${toAmount},
        ${midRate}, ${customerRate}, ${margin.total_spread_bp / 100},
        ${margin.provider_fee_bp}, ${margin.margin_bp}, ${margin.total_spread_bp},
        ${providerFee}, ${platformMargin}, ${totalFee},
        ${margin.volume_tier}, ${monthlyVolume},
        'completed', NOW()
      )
      RETURNING id
    `

    const conversionId = conversionResult.rows[0].id

    // Record transaction for user
    await sql`
      INSERT INTO gv_transactions (
        user_id, type, status,
        amount, currency,
        destination_amount, destination_currency,
        exchange_rate, fee_amount, fee_currency,
        display_title, display_icon, category,
        external_id, completed_at
      ) VALUES (
        ${userId}, 'convert', 'completed',
        ${fromAmount}, ${fromCurrency},
        ${toAmount}, ${toCurrency},
        ${customerRate}, ${totalFee}, ${fromCurrency},
        ${`Converted to ${toCurrency}`}, 'exchange', 'conversion',
        ${conversionId}, NOW()
      )
    `

    // Update user balance (simplified - in production would use ledger entries)
    if (fromCurrency === 'USD') {
      await sql`
        UPDATE gv_user_balances
        SET
          usd_available = usd_available - ${fromAmount},
          usd_total = usd_total - ${fromAmount},
          last_transaction_at = NOW(),
          updated_at = NOW()
        WHERE user_id = ${userId}
      `
    }

    return NextResponse.json({
      success: true,
      conversion: {
        id: conversionId,
        fromCurrency,
        toCurrency,
        fromAmount,
        toAmount: Math.round(toAmount * 10000) / 10000,
        rate: Math.round(customerRate * 1000000) / 1000000,
        fees: {
          providerFee: Math.round(providerFee * 100) / 100,
          platformMargin: Math.round(platformMargin * 100) / 100,
          total: Math.round(totalFee * 100) / 100
        },
        volumeTier: margin.volume_tier,
        completedAt: new Date().toISOString()
      },
      message: `Converted ${fromAmount} ${fromCurrency} to ${Math.round(toAmount * 100) / 100} ${toCurrency}`
    })
  } catch (error) {
    console.error('Conversion execution error:', error)
    return NextResponse.json({ error: 'Failed to execute conversion' }, { status: 500 })
  }
}
