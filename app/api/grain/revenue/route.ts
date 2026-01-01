/**
 * GRAIN Revenue API
 *
 * Endpoints for revenue allocation and ledger management.
 *
 * Revenue Sources:
 * 1. WellsAI 1% Fee (10% tithe, 30% ops, 30% liquidity, 30% partners)
 * 2. Float Yield 4.5% (10% tithe, 30% founders, 30% ops, 30% treasury)
 *
 * GRAIN appreciation is backed by REAL LIQUID ASSETS:
 * - 30% of WellsAI fees → liquidity
 * - 30% of float yield → treasury equity
 *
 * SECURITY: Admin-only endpoint for revenue management.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { RevenueAllocation } from '@/lib/grain/revenue-allocation'
import { FounderLedgers } from '@/lib/grain/founder-ledgers'

// Founders/admins who can manage revenue
const TREASURY_ADMINS = ['user_2vQlKmAB8sOCkwxw0T0cSWQxqhT'] // Add admin user IDs

// GET /api/grain/revenue
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication and admin access
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only admins can view revenue data
    if (!TREASURY_ADMINS.includes(userId)) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const view = request.nextUrl.searchParams.get('view') || 'summary'
    const founderId = request.nextUrl.searchParams.get('founderId') as
      | 'jonah'
      | 'jonathan'
      | null

    switch (view) {
      case 'summary':
        return await getSummary()

      case 'ledgers':
        return await getLedgers()

      case 'allocations':
        const limit = parseInt(
          request.nextUrl.searchParams.get('limit') || '50'
        )
        return await getAllocations(limit)

      case 'founder':
        if (!founderId) {
          return NextResponse.json(
            { success: false, error: 'founderId required' },
            { status: 400 }
          )
        }
        return await getFounderDetails(founderId)

      case 'projection':
        const volume = parseFloat(
          request.nextUrl.searchParams.get('volume') || '0'
        )
        return await getProjection(volume)

      default:
        return NextResponse.json(
          { success: false, error: `Unknown view: ${view}` },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('[Revenue API] GET error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

async function getSummary() {
  const [ledgers, totals, founders] = await Promise.all([
    RevenueAllocation.getLedgerSummaries(),
    RevenueAllocation.getAllocationTotals(),
    FounderLedgers.getAllFounderSummaries(),
  ])

  // Calculate key metrics
  const totalRevenue =
    totals.wellsaiFees.total + totals.floatYield.total
  const totalToGrainAppreciation =
    totals.wellsaiFees.toLiquidity + totals.floatYield.toTreasury
  const totalToOperating =
    totals.wellsaiFees.toOps + totals.floatYield.toOps
  const totalToTithe =
    totals.wellsaiFees.toTithe + totals.floatYield.toTithe

  return NextResponse.json({
    success: true,
    summary: {
      // Total revenue
      totalRevenue,
      totalRevenueFormatted: `$${totalRevenue.toLocaleString()}`,

      // Where it goes
      toGrainAppreciation: totalToGrainAppreciation,
      toGrainAppreciationFormatted: `$${totalToGrainAppreciation.toLocaleString()}`,
      toOperating: totalToOperating,
      toOperatingFormatted: `$${totalToOperating.toLocaleString()}`,
      toTithe: totalToTithe,
      toTitheFormatted: `$${totalToTithe.toLocaleString()}`,
      toPartners: totals.wellsaiFees.toPartners,
      toPartnersFormatted: `$${totals.wellsaiFees.toPartners.toLocaleString()}`,
      toFounders: totals.floatYield.toFounders,
      toFoundersFormatted: `$${totals.floatYield.toFounders.toLocaleString()}`,

      // Breakdown
      wellsaiFees: totals.wellsaiFees,
      floatYield: totals.floatYield,

      // Ledger balances
      ledgers,

      // Founder summary
      founders,

      // Locked formulas
      formulas: {
        wellsaiFee: RevenueAllocation.WELLSAI_FEE_ALLOCATION,
        floatYield: RevenueAllocation.FLOAT_YIELD_ALLOCATION,
        founderSplit: RevenueAllocation.FOUNDER_SPLIT,
        rates: {
          wellsaiFeeRate: RevenueAllocation.WELLSAI_FEE_RATE,
          floatYieldRate: RevenueAllocation.FLOAT_YIELD_RATE,
        },
      },
    },
  })
}

async function getLedgers() {
  const ledgers = await RevenueAllocation.getLedgerSummaries()

  return NextResponse.json({
    success: true,
    ledgers: ledgers.map((l) => ({
      ...l,
      balanceFormatted: `$${l.balance.toLocaleString()}`,
      totalAllocatedFormatted: `$${l.totalAllocated.toLocaleString()}`,
      totalWithdrawnFormatted: `$${l.totalWithdrawn.toLocaleString()}`,
    })),
  })
}

async function getAllocations(limit: number) {
  const allocations = await RevenueAllocation.getRecentAllocations(limit)

  return NextResponse.json({
    success: true,
    allocations: allocations.map((a) => ({
      ...a,
      sourceAmountFormatted: `$${a.sourceAmount.toLocaleString()}`,
    })),
  })
}

async function getFounderDetails(founderId: 'jonah' | 'jonathan') {
  const [summary, transactions] = await Promise.all([
    FounderLedgers.getFounderSummary(founderId),
    FounderLedgers.getFounderTransactionHistory(founderId),
  ])

  if (!summary) {
    return NextResponse.json(
      { success: false, error: `Founder not found: ${founderId}` },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success: true,
    founder: {
      ...summary,
      annuityBalanceFormatted: `$${summary.annuityBalance.toLocaleString()}`,
      totalEarnedFormatted: `$${summary.totalEarned.toLocaleString()}`,
      totalWithdrawnFormatted: `$${summary.totalWithdrawn.toLocaleString()}`,
    },
    transactions: transactions.map((t) => ({
      ...t,
      amountFormatted: `$${t.amount.toLocaleString()}`,
    })),
    atScale: FounderLedgers.calculateAtSAPScale(),
  })
}

async function getProjection(volume: number) {
  // Default to SAP scale if no volume provided
  const projection =
    volume > 0
      ? RevenueAllocation.projectRevenueAtScale(volume)
      : RevenueAllocation.projectAtSAPScale()

  return NextResponse.json({
    success: true,
    projection: {
      ...projection,
      formatted: {
        transactionVolume: `$${projection.transactionVolume.toLocaleString()}`,
        averageDepositBalance: `$${projection.averageDepositBalance.toLocaleString()}`,
        wellsaiFeesTotal: `$${projection.wellsaiFees.total.toLocaleString()}`,
        floatYieldTotal: `$${projection.floatYield.total.toLocaleString()}`,
        totalToLiquidity: `$${projection.totalToLiquidity.toLocaleString()}`,
        totalToTreasury: `$${projection.totalToTreasury.toLocaleString()}`,
        totalGrainAppreciation: `$${projection.totalGrainAppreciation.toLocaleString()}`,
        founderJonahShare: `$${projection.floatYield.jonahShare.toLocaleString()}`,
        founderJonathanShare: `$${projection.floatYield.jonathanShare.toLocaleString()}`,
      },
    },
  })
}

// POST /api/grain/revenue
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication and admin access
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only admins can perform revenue operations
    if (!TREASURY_ADMINS.includes(userId)) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'allocate_fee':
        return await allocateFee(body)

      case 'allocate_yield':
        return await allocateYield(body)

      case 'founder_withdraw':
        return await founderWithdraw(body)

      case 'founder_reinvest':
        return await founderReinvest(body)

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('[Revenue API] POST error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

async function allocateFee(body: any) {
  const { amount, sourceTransactionId, grainPrice } = body

  if (!amount || amount <= 0) {
    return NextResponse.json(
      { success: false, error: 'amount must be positive' },
      { status: 400 }
    )
  }

  const result = await RevenueAllocation.allocateWellsAIFee(
    amount,
    sourceTransactionId,
    grainPrice || 1
  )

  return NextResponse.json({
    success: true,
    ...result,
    breakdownFormatted: {
      tithe: `$${result.breakdown.tithe.toLocaleString()}`,
      wellsOnyx: `$${result.breakdown.wellsOnyx.toLocaleString()}`,
      liquidity: `$${result.breakdown.liquidity.toLocaleString()}`,
      partners: `$${result.breakdown.partners.toLocaleString()}`,
    },
  })
}

async function allocateYield(body: any) {
  const { amount, sourceTransactionId, grainPrice } = body

  if (!amount || amount <= 0) {
    return NextResponse.json(
      { success: false, error: 'amount must be positive' },
      { status: 400 }
    )
  }

  const result = await RevenueAllocation.allocateFloatYield(
    amount,
    sourceTransactionId,
    grainPrice || 1
  )

  return NextResponse.json({
    success: true,
    ...result,
    breakdownFormatted: {
      tithe: `$${result.breakdown.tithe.toLocaleString()}`,
      wellsOnyx: `$${result.breakdown.wellsOnyx.toLocaleString()}`,
      founders: `$${result.breakdown.founders?.toLocaleString() || '0'}`,
      treasury: `$${result.breakdown.treasury?.toLocaleString() || '0'}`,
    },
  })
}

async function founderWithdraw(body: any) {
  const { founderId, amount, description } = body

  if (!founderId || !['jonah', 'jonathan'].includes(founderId)) {
    return NextResponse.json(
      { success: false, error: 'Invalid founderId' },
      { status: 400 }
    )
  }

  if (!amount || amount <= 0) {
    return NextResponse.json(
      { success: false, error: 'amount must be positive' },
      { status: 400 }
    )
  }

  const result = await FounderLedgers.withdrawAnnuity(
    founderId,
    amount,
    description
  )

  return NextResponse.json({
    success: true,
    ...result,
    newBalanceFormatted: `$${result.newBalance.toLocaleString()}`,
  })
}

async function founderReinvest(body: any) {
  const { founderId, amount, grainPrice } = body

  if (!founderId || !['jonah', 'jonathan'].includes(founderId)) {
    return NextResponse.json(
      { success: false, error: 'Invalid founderId' },
      { status: 400 }
    )
  }

  if (!amount || amount <= 0) {
    return NextResponse.json(
      { success: false, error: 'amount must be positive' },
      { status: 400 }
    )
  }

  const result = await FounderLedgers.reinvestAnnuityToGrain(
    founderId,
    amount,
    grainPrice || 1
  )

  return NextResponse.json({
    success: true,
    ...result,
    summary: {
      usdReinvested: `$${result.usdReinvested.toLocaleString()}`,
      grainReceived: `${result.grainReceived.toLocaleString()} GRAIN`,
      newAnnuityBalance: `$${result.newAnnuityBalance.toLocaleString()}`,
    },
  })
}
