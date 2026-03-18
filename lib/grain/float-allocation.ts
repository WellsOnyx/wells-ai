/**
 * GRAIN Float Allocation Engine
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * RESERVE ALLOCATION MODEL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every dollar in the GRAIN float is allocated:
 *
 *   1%  → Foundation (charitable/operational foundation)
 *   33% → Cash / Liquidity + TIPS (inflation-protected)
 *   33% → Precious Metals (gold, silver, platinum)
 *   33% → US Treasuries (T-bills, T-notes, T-bonds)
 *
 * Target ROI: 7% after fees on the total float
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * FLOAT MECHANICS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Transaction volume flows through a 48-hour settlement window.
 * At any given moment, the "float" is the capital sitting in the
 * settlement pipeline. This is our investable balance.
 *
 *   Float = (Annual Volume / 365) × Settlement Days
 *
 * BASE CASE: 3.3% of $33T = $1T annual volume
 *   $1T / 365 × 2 days = $5.48B float at any given time
 *
 * This $5.4B is the investable balance generating yield 24/7/365.
 *
 * The float is ALWAYS moving — money arrives and settles continuously.
 * Allocation must maximize yield while guaranteeing settlement liquidity.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LIQUIDITY WATERFALL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Not all float can be locked up. Settlement demands instant liquidity.
 * The cash/TIPS tranche (33%) is the liquidity buffer. Within it:
 *
 *   - Instant liquidity (cash): enough to cover peak 4-hour settlement
 *   - Near-term (overnight repo): next 24 hours of settlements
 *   - Short TIPS: remainder earns inflation-protected yield
 *
 * Precious metals and treasuries are held in liquid instruments
 * (ETFs, futures, repo) so they CAN be liquidated in <24hr if needed,
 * but the cash tranche should handle normal operations.
 */

import { query } from '@/lib/db'

// ============================================================================
// HARD-CODED ALLOCATION (IMMUTABLE)
// ============================================================================

/** Reserve allocation percentages — sum to 1.0 */
export const RESERVE_ALLOCATION = {
  foundation: 0.01,       // 1%  → Foundation
  cashAndTips: 0.33,      // 33% → Cash / Liquidity + TIPS
  preciousMetals: 0.33,   // 33% → Precious Metals
  treasuries: 0.33,       // 33% → US Treasuries
} as const

/** Target annual ROI after all fees */
export const TARGET_ROI = 0.07 // 7%

/** Settlement window in hours */
export const SETTLEMENT_HOURS = 48

/** Rebalancing tolerance — trigger rebalance if any tranche drifts this far */
export const REBALANCE_THRESHOLD = 0.02 // 2% drift

/** Management fee (basis points on AUM, annual) */
export const MANAGEMENT_FEE_BPS = 15 // 15bps = 0.15%

/** Foundation fee is taken first, off the top */
export const FOUNDATION_FEE = RESERVE_ALLOCATION.foundation // 1%

// ============================================================================
// YIELD ASSUMPTIONS BY ASSET CLASS
// ============================================================================

/**
 * Conservative yield assumptions per asset class (annual).
 * These are gross yields before fees.
 * Updated periodically from market data.
 */
export const YIELD_ASSUMPTIONS = {
  /** Cash earns overnight/repo rate */
  cash: 0.0525,           // 5.25% (Fed funds rate range)

  /** TIPS earn real yield + inflation adjustment */
  tips: 0.0475,           // ~2% real + ~2.5% inflation = ~4.75%

  /** Precious metals — no yield, appreciation only */
  preciousMetals: 0.0,    // 0% yield (capital appreciation separate)

  /** Precious metals historical annual appreciation */
  preciousMetalsAppreciation: 0.08, // ~8% long-run gold appreciation

  /** US Treasuries blended (T-bills + notes) */
  treasuries: 0.0485,     // 4.85% blended yield

  /** Overnight repo (used for liquidity buffer) */
  overnightRepo: 0.053,   // 5.3%
} as const

// ============================================================================
// LIQUIDITY SUB-ALLOCATION (within the 33% cash/TIPS tranche)
// ============================================================================

/**
 * How the 33% cash/TIPS tranche is split for liquidity management.
 * Must ensure we can always settle transactions on time.
 */
export const LIQUIDITY_TIERS = {
  /** Instant cash — covers peak 4-hour settlement volume */
  instantCash: 0.15,       // 15% of the cash tranche

  /** Overnight repo — covers next 24hr of settlements */
  overnightRepo: 0.35,     // 35% of the cash tranche

  /** Short TIPS (1-5yr) — remainder earns inflation-protected yield */
  shortTips: 0.50,         // 50% of the cash tranche
} as const

// ============================================================================
// TYPES
// ============================================================================

export interface FloatSnapshot {
  /** Total float available at this moment */
  totalFloat: number

  /** Annual transaction volume driving this float */
  annualVolume: number

  /** Daily transaction volume */
  dailyVolume: number

  /** Settlement window in days */
  settlementDays: number

  /** Timestamp */
  asOf: Date
}

export interface AllocationState {
  /** Total float under management */
  totalFloat: number

  /** Foundation allocation */
  foundation: {
    target: number
    actual: number
    drift: number
  }

  /** Cash + TIPS allocation */
  cashAndTips: {
    target: number
    actual: number
    drift: number
    breakdown: {
      instantCash: number
      overnightRepo: number
      shortTips: number
    }
  }

  /** Precious metals allocation */
  preciousMetals: {
    target: number
    actual: number
    drift: number
  }

  /** US Treasuries allocation */
  treasuries: {
    target: number
    actual: number
    drift: number
  }

  /** Whether rebalancing is needed */
  needsRebalance: boolean

  /** Maximum drift across all tranches */
  maxDrift: number
}

export interface YieldProjection {
  /** Total float */
  totalFloat: number

  /** Gross yield by asset class */
  grossYield: {
    cashAndTips: number
    preciousMetals: number
    treasuries: number
    total: number
  }

  /** Fees */
  fees: {
    foundation: number
    management: number
    total: number
  }

  /** Net yield after fees */
  netYield: number

  /** Effective ROI */
  effectiveROI: number

  /** Target ROI gap (positive = exceeding target) */
  roiGap: number

  /** Per-day yield */
  dailyYield: number
}

export interface LiquidityAnalysis {
  /** Total instant liquidity available */
  instantLiquidity: number

  /** Hours of settlement coverage at current volume */
  settlementCoverageHours: number

  /** Can we meet all settlements for the next 48 hours? */
  canMeetSettlements: boolean

  /** Amount that could be liquidated within 24 hours */
  liquidatable24hr: number

  /** Stress test: coverage if volume spikes 3x */
  stressCoverageHours: number

  /** Utilization rate (how much of float is earning yield vs idle) */
  yieldUtilization: number
}

export interface RebalanceAction {
  from: 'foundation' | 'cashAndTips' | 'preciousMetals' | 'treasuries'
  to: 'foundation' | 'cashAndTips' | 'preciousMetals' | 'treasuries'
  amount: number
  reason: string
}

export interface ScaleProjection {
  label: string
  marketSharePct: number
  annualVolume: number
  dailyVolume: number
  float48hr: number

  allocation: {
    foundation: number
    cashAndTips: number
    preciousMetals: number
    treasuries: number
  }

  annualYield: YieldProjection
}

// ============================================================================
// CORE FLOAT CALCULATIONS
// ============================================================================

/**
 * Calculate the float for a given annual volume and settlement window.
 *
 * Float = (annualVolume / 365) × settlementDays
 *
 * This is the amount of capital sitting in the settlement pipeline
 * at any given moment — our investable balance.
 */
export function calculateFloat(
  annualVolume: number,
  settlementHours: number = SETTLEMENT_HOURS
): FloatSnapshot {
  const settlementDays = settlementHours / 24
  const dailyVolume = annualVolume / 365
  const totalFloat = dailyVolume * settlementDays

  return {
    totalFloat,
    annualVolume,
    dailyVolume,
    settlementDays,
    asOf: new Date(),
  }
}

/**
 * Calculate target allocation for a given float.
 * Applies the 1/33/33/33 split.
 */
export function calculateTargetAllocation(totalFloat: number): {
  foundation: number
  cashAndTips: number
  preciousMetals: number
  treasuries: number
} {
  return {
    foundation: totalFloat * RESERVE_ALLOCATION.foundation,
    cashAndTips: totalFloat * RESERVE_ALLOCATION.cashAndTips,
    preciousMetals: totalFloat * RESERVE_ALLOCATION.preciousMetals,
    treasuries: totalFloat * RESERVE_ALLOCATION.treasuries,
  }
}

/**
 * Get current allocation state — compares actual holdings to targets.
 */
export function getAllocationState(
  totalFloat: number,
  actual: {
    foundation: number
    cashAndTips: number
    preciousMetals: number
    treasuries: number
  }
): AllocationState {
  const target = calculateTargetAllocation(totalFloat)

  const drift = (actual: number, target: number) =>
    target > 0 ? (actual - target) / target : 0

  const foundationDrift = drift(actual.foundation, target.foundation)
  const cashDrift = drift(actual.cashAndTips, target.cashAndTips)
  const metalsDrift = drift(actual.preciousMetals, target.preciousMetals)
  const treasuriesDrift = drift(actual.treasuries, target.treasuries)

  const maxDrift = Math.max(
    Math.abs(foundationDrift),
    Math.abs(cashDrift),
    Math.abs(metalsDrift),
    Math.abs(treasuriesDrift)
  )

  // Break down the cash/TIPS tranche into liquidity tiers
  const cashTarget = target.cashAndTips
  const cashBreakdown = {
    instantCash: cashTarget * LIQUIDITY_TIERS.instantCash,
    overnightRepo: cashTarget * LIQUIDITY_TIERS.overnightRepo,
    shortTips: cashTarget * LIQUIDITY_TIERS.shortTips,
  }

  return {
    totalFloat,
    foundation: { target: target.foundation, actual: actual.foundation, drift: foundationDrift },
    cashAndTips: {
      target: target.cashAndTips,
      actual: actual.cashAndTips,
      drift: cashDrift,
      breakdown: cashBreakdown,
    },
    preciousMetals: { target: target.preciousMetals, actual: actual.preciousMetals, drift: metalsDrift },
    treasuries: { target: target.treasuries, actual: actual.treasuries, drift: treasuriesDrift },
    needsRebalance: maxDrift > REBALANCE_THRESHOLD,
    maxDrift,
  }
}

// ============================================================================
// YIELD & ROI CALCULATIONS
// ============================================================================

/**
 * Project annual yield for a given float size.
 *
 * Yield sources:
 *   - Cash/TIPS tranche: blended rate across liquidity tiers
 *   - Precious metals: appreciation (no coupon yield)
 *   - Treasuries: coupon yield
 *
 * Fees deducted:
 *   - 1% foundation fee (off the top of float)
 *   - Management fee (bps on AUM)
 */
export function projectYield(totalFloat: number): YieldProjection {
  const targets = calculateTargetAllocation(totalFloat)

  // Cash/TIPS tranche yield (blended across liquidity tiers)
  const cashTranche = targets.cashAndTips
  const cashYield =
    (cashTranche * LIQUIDITY_TIERS.instantCash * YIELD_ASSUMPTIONS.cash) +
    (cashTranche * LIQUIDITY_TIERS.overnightRepo * YIELD_ASSUMPTIONS.overnightRepo) +
    (cashTranche * LIQUIDITY_TIERS.shortTips * YIELD_ASSUMPTIONS.tips)

  // Precious metals — appreciation only, no coupon
  const metalsYield = targets.preciousMetals * YIELD_ASSUMPTIONS.preciousMetalsAppreciation

  // Treasuries — coupon yield
  const treasuriesYield = targets.treasuries * YIELD_ASSUMPTIONS.treasuries

  const grossTotal = cashYield + metalsYield + treasuriesYield

  // Fees
  const foundationFee = targets.foundation // This IS the 1% — it's allocated, not yielded
  const managementFee = totalFloat * (MANAGEMENT_FEE_BPS / 10000)
  const totalFees = foundationFee + managementFee

  // Net yield (foundation allocation is already separated from investable capital)
  // The 1% foundation comes off the float, so yield is on the remaining 99%
  const netYield = grossTotal - managementFee
  const effectiveROI = totalFloat > 0 ? netYield / totalFloat : 0

  return {
    totalFloat,
    grossYield: {
      cashAndTips: cashYield,
      preciousMetals: metalsYield,
      treasuries: treasuriesYield,
      total: grossTotal,
    },
    fees: {
      foundation: foundationFee,
      management: managementFee,
      total: totalFees,
    },
    netYield,
    effectiveROI,
    roiGap: effectiveROI - TARGET_ROI,
    dailyYield: netYield / 365,
  }
}

/**
 * Reverse-engineer: what float is needed to hit a target annual net yield?
 */
export function floatNeededForYield(targetAnnualYield: number): number {
  // Yield ≈ float × effective ROI
  // Use the current yield assumptions to calculate effective ROI on $1
  const projection = projectYield(1_000_000) // project on $1M for ratio
  if (projection.effectiveROI <= 0) return Infinity
  return targetAnnualYield / projection.effectiveROI
}

// ============================================================================
// LIQUIDITY ANALYSIS
// ============================================================================

/**
 * Analyze liquidity position — can we meet settlement obligations?
 *
 * The critical question: at any moment, do we have enough liquid capital
 * to settle all outgoing transactions while keeping the allocation working?
 */
export function analyzeLiquidity(
  totalFloat: number,
  dailyVolume: number,
  actualCashAndTips: number
): LiquidityAnalysis {
  const targets = calculateTargetAllocation(totalFloat)

  // Instant liquidity = the instant cash tier of the cash/TIPS tranche
  const instantLiquidity = actualCashAndTips * LIQUIDITY_TIERS.instantCash

  // Hourly settlement demand
  const hourlyDemand = dailyVolume / 24

  // How many hours can we cover with instant cash?
  const settlementCoverageHours = hourlyDemand > 0
    ? instantLiquidity / hourlyDemand
    : Infinity

  // Can we cover the full 48-hour settlement window?
  // Instant cash covers first burst, overnight repo covers next 24hr
  const overnightLiquidity = actualCashAndTips * LIQUIDITY_TIERS.overnightRepo
  const totalQuickLiquidity = instantLiquidity + overnightLiquidity
  const canMeetSettlements = totalQuickLiquidity >= (dailyVolume * (SETTLEMENT_HOURS / 24))

  // What can be liquidated within 24 hours?
  // Cash: instant. Repo: instant. TIPS: 1 day. Metals ETFs: 1 day. Treasury ETFs: 1 day.
  const liquidatable24hr = totalFloat // Everything is in liquid instruments

  // Stress test: 3x volume spike
  const stressHourlyDemand = hourlyDemand * 3
  const stressCoverageHours = stressHourlyDemand > 0
    ? totalQuickLiquidity / stressHourlyDemand
    : Infinity

  // Yield utilization: how much of the float is actually earning yield?
  // Everything except the instant cash buffer earns something
  const idleCash = targets.cashAndTips * LIQUIDITY_TIERS.instantCash * 0.5 // half of instant cash is truly idle
  const yieldUtilization = totalFloat > 0
    ? (totalFloat - idleCash) / totalFloat
    : 0

  return {
    instantLiquidity,
    settlementCoverageHours,
    canMeetSettlements,
    liquidatable24hr,
    stressCoverageHours,
    yieldUtilization,
  }
}

// ============================================================================
// REBALANCING
// ============================================================================

/**
 * Calculate rebalancing actions needed to restore target allocation.
 *
 * At $10B+ float, even 2% drift = $200M+ misallocation.
 * Rebalancing must be surgical and minimize transaction costs.
 */
export function calculateRebalanceActions(state: AllocationState): RebalanceAction[] {
  if (!state.needsRebalance) return []

  const actions: RebalanceAction[] = []

  type TrancheKey = 'foundation' | 'cashAndTips' | 'preciousMetals' | 'treasuries'
  const tranches: TrancheKey[] = ['foundation', 'cashAndTips', 'preciousMetals', 'treasuries']

  // Find over-allocated and under-allocated tranches
  const overAllocated: { key: TrancheKey; excess: number }[] = []
  const underAllocated: { key: TrancheKey; deficit: number }[] = []

  for (const key of tranches) {
    const tranche = state[key]
    const diff = tranche.actual - tranche.target
    if (diff > 0 && Math.abs(tranche.drift) > REBALANCE_THRESHOLD) {
      overAllocated.push({ key, excess: diff })
    } else if (diff < 0 && Math.abs(tranche.drift) > REBALANCE_THRESHOLD) {
      underAllocated.push({ key, deficit: Math.abs(diff) })
    }
  }

  // Match over-allocated to under-allocated
  for (const over of overAllocated) {
    for (const under of underAllocated) {
      if (over.excess <= 0 || under.deficit <= 0) continue

      const moveAmount = Math.min(over.excess, under.deficit)
      actions.push({
        from: over.key,
        to: under.key,
        amount: moveAmount,
        reason: `Rebalance: ${over.key} over by ${(state[over.key].drift * 100).toFixed(2)}%, ` +
                `${under.key} under by ${(state[under.key].drift * 100).toFixed(2)}%`,
      })

      over.excess -= moveAmount
      under.deficit -= moveAmount
    }
  }

  return actions
}

// ============================================================================
// DEPOSIT ALLOCATION
// ============================================================================

/**
 * When new funds enter the float (via transaction), allocate them
 * according to the 1/33/33/33 split.
 *
 * This is called on every deposit to maintain the allocation in real-time
 * rather than only rebalancing periodically.
 */
export function allocateDeposit(depositAmount: number): {
  foundation: number
  cashAndTips: number
  preciousMetals: number
  treasuries: number
  breakdown: {
    instantCash: number
    overnightRepo: number
    shortTips: number
  }
} {
  const foundation = depositAmount * RESERVE_ALLOCATION.foundation
  const cashAndTips = depositAmount * RESERVE_ALLOCATION.cashAndTips
  const preciousMetals = depositAmount * RESERVE_ALLOCATION.preciousMetals
  const treasuries = depositAmount * RESERVE_ALLOCATION.treasuries

  return {
    foundation,
    cashAndTips,
    preciousMetals,
    treasuries,
    breakdown: {
      instantCash: cashAndTips * LIQUIDITY_TIERS.instantCash,
      overnightRepo: cashAndTips * LIQUIDITY_TIERS.overnightRepo,
      shortTips: cashAndTips * LIQUIDITY_TIERS.shortTips,
    },
  }
}

/**
 * When funds leave the float (settlement), draw from tranches
 * in a specific order to maximize yield and maintain allocation.
 *
 * Withdrawal waterfall:
 *   1. Instant cash (lowest yield, designed for this)
 *   2. Overnight repo (next lowest, quick to unwind)
 *   3. Short TIPS (sell if needed)
 *   4. Treasuries (sell if needed — last resort from yield assets)
 *   5. Precious metals (last resort — most volatile to sell)
 *
 * Foundation is NEVER drawn from for settlements.
 */
export function calculateWithdrawalWaterfall(
  withdrawAmount: number,
  currentHoldings: {
    instantCash: number
    overnightRepo: number
    shortTips: number
    treasuries: number
    preciousMetals: number
  }
): {
  draws: {
    instantCash: number
    overnightRepo: number
    shortTips: number
    treasuries: number
    preciousMetals: number
  }
  remainingDeficit: number
} {
  let remaining = withdrawAmount
  const draws = {
    instantCash: 0,
    overnightRepo: 0,
    shortTips: 0,
    treasuries: 0,
    preciousMetals: 0,
  }

  // 1. Draw from instant cash first
  const fromCash = Math.min(remaining, currentHoldings.instantCash)
  draws.instantCash = fromCash
  remaining -= fromCash

  // 2. Overnight repo
  if (remaining > 0) {
    const fromRepo = Math.min(remaining, currentHoldings.overnightRepo)
    draws.overnightRepo = fromRepo
    remaining -= fromRepo
  }

  // 3. Short TIPS
  if (remaining > 0) {
    const fromTips = Math.min(remaining, currentHoldings.shortTips)
    draws.shortTips = fromTips
    remaining -= fromTips
  }

  // 4. Treasuries
  if (remaining > 0) {
    const fromTreasuries = Math.min(remaining, currentHoldings.treasuries)
    draws.treasuries = fromTreasuries
    remaining -= fromTreasuries
  }

  // 5. Precious metals (last resort)
  if (remaining > 0) {
    const fromMetals = Math.min(remaining, currentHoldings.preciousMetals)
    draws.preciousMetals = fromMetals
    remaining -= fromMetals
  }

  return {
    draws,
    remainingDeficit: remaining,
  }
}

// ============================================================================
// SCALE PROJECTIONS
// ============================================================================

/**
 * BASE CASE: $1T annual volume (3.3% of $33T) → $5.4B float
 * This is the anchor for all projections.
 */
export const BASE_CASE_ANNUAL_VOLUME = 1_000_000_000_000 // $1T

/**
 * Project allocation and yield at the base case and growth scenarios.
 * Base: $1T (3.3% of $33T) — the $5.4B float
 * Growth scenarios show what happens as market share expands.
 */
export function projectAtScale(): ScaleProjection[] {
  const GLOBAL_PAYMENT_VOLUME = 33_000_000_000_000 // $33T

  const scenarios = [
    { label: 'Base Case (3.3% — $1T)', share: 0.033 },
    { label: 'Growth (5%)', share: 0.05 },
    { label: 'Dominant (7%)', share: 0.07 },
  ]

  return scenarios.map(scenario => {
    const annualVolume = GLOBAL_PAYMENT_VOLUME * scenario.share
    const floatSnapshot = calculateFloat(annualVolume)
    const targets = calculateTargetAllocation(floatSnapshot.totalFloat)
    const yieldProjection = projectYield(floatSnapshot.totalFloat)

    return {
      label: scenario.label,
      marketSharePct: scenario.share * 100,
      annualVolume,
      dailyVolume: floatSnapshot.dailyVolume,
      float48hr: floatSnapshot.totalFloat,
      allocation: targets,
      annualYield: yieldProjection,
    }
  })
}

/**
 * Format a dollar amount for display.
 */
function fmtUSD(n: number): string {
  if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

/**
 * Generate a human-readable summary of scale projections.
 * Useful for board decks and investor presentations.
 */
export function generateScaleSummary(): string {
  const projections = projectAtScale()

  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    'GRAIN FLOAT ALLOCATION — SCALE PROJECTIONS',
    `Reserve Model: 1% Foundation / 33% Cash+TIPS / 33% Metals / 33% Treasuries`,
    `Target ROI: ${(TARGET_ROI * 100).toFixed(0)}% after fees`,
    `Settlement Window: ${SETTLEMENT_HOURS}hr`,
    '═══════════════════════════════════════════════════════════════',
    '',
  ]

  for (const p of projections) {
    lines.push(`▸ ${p.label} — ${(p.marketSharePct).toFixed(0)}% of $33T`)
    lines.push(`  Annual Volume:    ${fmtUSD(p.annualVolume)}`)
    lines.push(`  Daily Volume:     ${fmtUSD(p.dailyVolume)}`)
    lines.push(`  48hr Float:       ${fmtUSD(p.float48hr)}`)
    lines.push(`  ─── Allocation ───`)
    lines.push(`  Foundation (1%):  ${fmtUSD(p.allocation.foundation)}`)
    lines.push(`  Cash/TIPS (33%):  ${fmtUSD(p.allocation.cashAndTips)}`)
    lines.push(`  Metals (33%):     ${fmtUSD(p.allocation.preciousMetals)}`)
    lines.push(`  Treasuries (33%): ${fmtUSD(p.allocation.treasuries)}`)
    lines.push(`  ─── Annual Yield ───`)
    lines.push(`  Gross Yield:      ${fmtUSD(p.annualYield.grossYield.total)}`)
    lines.push(`  Foundation Fee:   ${fmtUSD(p.annualYield.fees.foundation)}`)
    lines.push(`  Management Fee:   ${fmtUSD(p.annualYield.fees.management)}`)
    lines.push(`  Net Yield:        ${fmtUSD(p.annualYield.netYield)}`)
    lines.push(`  Effective ROI:    ${(p.annualYield.effectiveROI * 100).toFixed(2)}%`)
    lines.push(`  vs Target (7%):   ${p.annualYield.roiGap >= 0 ? '+' : ''}${(p.annualYield.roiGap * 100).toFixed(2)}%`)
    lines.push(`  Daily Yield:      ${fmtUSD(p.annualYield.dailyYield)}`)
    lines.push('')
  }

  return lines.join('\n')
}

// ============================================================================
// DATABASE PERSISTENCE
// ============================================================================

/**
 * Record a float allocation snapshot to the database.
 * Called periodically (hourly) to track allocation state over time.
 */
export async function recordAllocationSnapshot(
  state: AllocationState,
  yieldProjection: YieldProjection
): Promise<string> {
  const result = await query(
    `INSERT INTO grain_float_allocations (
      total_float,
      foundation_target, foundation_actual, foundation_drift,
      cash_tips_target, cash_tips_actual, cash_tips_drift,
      instant_cash, overnight_repo, short_tips,
      metals_target, metals_actual, metals_drift,
      treasuries_target, treasuries_actual, treasuries_drift,
      needs_rebalance, max_drift,
      gross_yield_annual, net_yield_annual, effective_roi,
      target_roi, roi_gap,
      created_at
    ) VALUES (
      $1,
      $2, $3, $4,
      $5, $6, $7,
      $8, $9, $10,
      $11, $12, $13,
      $14, $15, $16,
      $17, $18,
      $19, $20, $21,
      $22, $23,
      NOW()
    ) RETURNING id`,
    [
      state.totalFloat,
      state.foundation.target, state.foundation.actual, state.foundation.drift,
      state.cashAndTips.target, state.cashAndTips.actual, state.cashAndTips.drift,
      state.cashAndTips.breakdown.instantCash,
      state.cashAndTips.breakdown.overnightRepo,
      state.cashAndTips.breakdown.shortTips,
      state.preciousMetals.target, state.preciousMetals.actual, state.preciousMetals.drift,
      state.treasuries.target, state.treasuries.actual, state.treasuries.drift,
      state.needsRebalance, state.maxDrift,
      yieldProjection.grossYield.total, yieldProjection.netYield, yieldProjection.effectiveROI,
      TARGET_ROI, yieldProjection.roiGap,
    ]
  )

  return result.rows[0].id
}

/**
 * Record a rebalancing event.
 */
export async function recordRebalance(
  actions: RebalanceAction[],
  snapshotId: string
): Promise<void> {
  for (const action of actions) {
    await query(
      `INSERT INTO grain_float_rebalances (
        snapshot_id, from_tranche, to_tranche, amount, reason, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [snapshotId, action.from, action.to, action.amount, action.reason]
    )
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const FloatAllocation = {
  // Constants
  RESERVE_ALLOCATION,
  TARGET_ROI,
  SETTLEMENT_HOURS,
  YIELD_ASSUMPTIONS,
  LIQUIDITY_TIERS,

  // Core calculations
  calculateFloat,
  calculateTargetAllocation,
  getAllocationState,

  // Yield
  projectYield,
  floatNeededForYield,

  // Liquidity
  analyzeLiquidity,

  // Rebalancing
  calculateRebalanceActions,

  // Transaction flow
  allocateDeposit,
  calculateWithdrawalWaterfall,

  // Scale projections
  projectAtScale,
  generateScaleSummary,

  // Persistence
  recordAllocationSnapshot,
  recordRebalance,
}

export default FloatAllocation
