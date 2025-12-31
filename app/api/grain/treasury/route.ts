/**
 * GRAIN Treasury API
 * GET /api/grain/treasury
 *
 * Returns the current treasury state:
 * - USDC Liquidity (cash available)
 * - Equity Value (platform + investments + fees)
 * - GRAIN Price
 * - Coverage Ratios
 *
 * Credit Line Model:
 * - GRAIN value is backed by REAL LIQUID ASSETS
 * - 1:1 cash deposits (protected)
 * - 30% of WellsAI fees → liquidity
 * - 30% of float yield → treasury equity
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { RevenueAllocation } from '@/lib/grain/revenue-allocation'
import { RealAssets } from '@/lib/grain/real-assets'

export async function GET() {
  try {
    // Get treasury state from database
    const result = await query(`
      SELECT
        -- USDC Liquidity
        liquidity_usdc_cash,
        liquidity_usdc_reserve,

        -- Equity Value components
        equity_platform_valuation,
        equity_platform_valuation_date,
        equity_real_estate,
        equity_precious_metals,
        equity_bonds,
        equity_other_investments,
        equity_wellsai_fees,
        equity_investment_income,
        equity_unrealized_gains,

        -- Liabilities
        liability_total_principal,
        liability_total_equity_buyin,

        -- GRAIN Supply
        grain_supply,
        grain_founder_pool,
        grain_treasury_reserve,

        -- Calculated values
        calc_usdc_liquidity,
        calc_equity_value,
        calc_total_ecosystem_value,
        calc_grain_price,
        calc_vault_coverage,
        calc_liquidity_coverage,

        -- Timestamps
        created_at,
        updated_at
      FROM vault_treasury
      LIMIT 1
    `)

    if (result.rows.length === 0) {
      // Return default cold-start values if no treasury exists
      const platformValuation = 5_000_000
      const grainSupply = 5_000_000 * 0.80 // 80% circulating
      const grainPrice = platformValuation / grainSupply

      return NextResponse.json({
        success: true,
        treasury: {
          // THE TWO KEY NUMBERS
          usdcLiquidity: 0,
          equityValue: platformValuation,
          totalEcosystemValue: platformValuation,

          // GRAIN Metrics
          grainPrice: grainPrice,
          grainPriceFormatted: `$${grainPrice.toFixed(4)}`,
          grainSupply: grainSupply,
          grainMarketCap: platformValuation,

          // Coverage Ratios
          vaultCoverage: Infinity,
          vaultCoverageFormatted: '∞',
          liquidityCoverage: 0,
          liquidityCoverageFormatted: '0%',

          // Breakdowns
          liquidityBreakdown: {
            usdcCash: 0,
            usdcReserve: 0,
          },
          equityBreakdown: {
            platformValue: platformValuation,
            investments: 0,
            accumulatedRevenue: 0,
          },
          liabilities: {
            totalPrincipal: 0,
            totalEquityBuyIn: 0,
          },

          // Status
          status: 'cold_start',
          message: 'Treasury not yet initialized. Run POST /api/admin/migrate-vault to initialize.',
        },
      })
    }

    const row = result.rows[0]

    // Calculate totals
    const usdcLiquidity = parseFloat(row.calc_usdc_liquidity) || 0
    const equityValue = parseFloat(row.calc_equity_value) || 0
    const totalEcosystemValue = parseFloat(row.calc_total_ecosystem_value) || 0
    const grainPrice = parseFloat(row.calc_grain_price) || 1
    const grainSupply =
      parseFloat(row.grain_supply) +
      parseFloat(row.grain_founder_pool) +
      parseFloat(row.grain_treasury_reserve)

    const vaultCoverage = parseFloat(row.calc_vault_coverage) || 0
    const liquidityCoverage = parseFloat(row.calc_liquidity_coverage) || 0

    return NextResponse.json({
      success: true,
      treasury: {
        // THE TWO KEY NUMBERS
        usdcLiquidity,
        equityValue,
        totalEcosystemValue,

        // GRAIN Metrics
        grainPrice,
        grainPriceFormatted: `$${grainPrice.toFixed(4)}`,
        grainSupply,
        grainMarketCap: totalEcosystemValue,

        // Coverage Ratios
        vaultCoverage: vaultCoverage > 999999 ? Infinity : vaultCoverage,
        vaultCoverageFormatted: vaultCoverage > 999999 ? '∞' : `${(vaultCoverage * 100).toFixed(1)}%`,
        liquidityCoverage: liquidityCoverage > 999999 ? Infinity : liquidityCoverage,
        liquidityCoverageFormatted: liquidityCoverage > 999999 ? '∞' : `${(liquidityCoverage * 100).toFixed(1)}%`,

        // Breakdowns
        liquidityBreakdown: {
          usdcCash: parseFloat(row.liquidity_usdc_cash) || 0,
          usdcReserve: parseFloat(row.liquidity_usdc_reserve) || 0,
        },
        equityBreakdown: {
          platformValue: parseFloat(row.equity_platform_valuation) || 0,
          platformValueDate: row.equity_platform_valuation_date,
          investments:
            (parseFloat(row.equity_real_estate) || 0) +
            (parseFloat(row.equity_precious_metals) || 0) +
            (parseFloat(row.equity_bonds) || 0) +
            (parseFloat(row.equity_other_investments) || 0),
          accumulatedRevenue:
            (parseFloat(row.equity_wellsai_fees) || 0) +
            (parseFloat(row.equity_investment_income) || 0) +
            (parseFloat(row.equity_unrealized_gains) || 0),
          details: {
            realEstate: parseFloat(row.equity_real_estate) || 0,
            preciousMetals: parseFloat(row.equity_precious_metals) || 0,
            bonds: parseFloat(row.equity_bonds) || 0,
            otherInvestments: parseFloat(row.equity_other_investments) || 0,
            wellsaiFees: parseFloat(row.equity_wellsai_fees) || 0,
            investmentIncome: parseFloat(row.equity_investment_income) || 0,
            unrealizedGains: parseFloat(row.equity_unrealized_gains) || 0,
          },
        },
        liabilities: {
          totalPrincipal: parseFloat(row.liability_total_principal) || 0,
          totalEquityBuyIn: parseFloat(row.liability_total_equity_buyin) || 0,
        },
        grainSupplyBreakdown: {
          circulating: parseFloat(row.grain_supply) || 0,
          founderPool: parseFloat(row.grain_founder_pool) || 0,
          treasuryReserve: parseFloat(row.grain_treasury_reserve) || 0,
          total: grainSupply,
        },

        // Timestamps
        updatedAt: row.updated_at,
        status: 'active',
      },

      // Credit Line Model additions
      creditLineModel: {
        // Revenue sources flowing to GRAIN appreciation
        revenueSources: {
          wellsaiFeeRate: RevenueAllocation.WELLSAI_FEE_RATE,
          floatYieldRate: RevenueAllocation.FLOAT_YIELD_RATE,
        },

        // Locked allocation formulas
        allocations: {
          wellsaiFee: RevenueAllocation.WELLSAI_FEE_ALLOCATION,
          floatYield: RevenueAllocation.FLOAT_YIELD_ALLOCATION,
          founderSplit: RevenueAllocation.FOUNDER_SPLIT,
        },

        // What backs GRAIN value
        valueBackedBy: [
          '1:1 Cash deposits (protected)',
          '30% of WellsAI 1% fees → liquidity',
          '30% of float yield 4.5% → treasury equity',
          'Real asset equity contributions',
        ],

        // The insight
        insight: 'GRAIN appreciation is backed by REAL LIQUID ASSETS',
      },
    })
  } catch (error: any) {
    console.error('[Treasury API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get treasury state',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
