/**
 * TROPICAL FORCE — Float Growth Engine
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THREE MODES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ORGANIC MODE (conservative):
 *   Revenue = 33bps fees + 7% float yield
 *   Deduct 10% tithe + OpEx, reinvest remainder
 *   50% capture in ~14.5 years
 *
 * BLITZ MODE (aggressive):
 *   Same revenue flywheel, PLUS:
 *   - Capital raises injected directly into float at milestones
 *   - Eligible volume % ramps as market share grows (30% → 95%)
 *   - Variable OpEx drops with scale (1.8bps → 0.5bps)
 *   50% capture in ~3.75 years
 *
 * SIEGE MODE (maximum velocity):
 *   Everything in Blitz, PLUS:
 *   - External stablecoin staking (USDC/USDT/DAI lock into GRAIN treasury)
 *     Stakers earn 4.5% yield, we keep 2.5% spread on 7% ROI
 *     No dilution — pure float expansion from other people's capital
 *   - Buyer/seller incentives (15bps cost → +20% eligible volume boost)
 *     Cashback to buyers (10bps), rebates to sellers (5bps)
 *   50% capture in 3 years, 100% capture in 4 years 1 month
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BLITZ CAPITAL STRATEGY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Day 1:    $2B   (Seed/Series A — war chest to prove the model)
 * Year 1:   $5B   (Series B — 12 months of traction data)
 * Year 2:  $10B   (Series C — growth proof, approaching 10% share)
 * Year 3:  $20B   (Series D/IPO — category leader, 25%+ share)
 *                  ────────
 * Total:   $37B   raised → injected into float
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * STAKING MODEL (Siege only)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Other stablecoins lock into GRAIN treasury. They get yield, we get float.
 * No dilution, no fundraising. Pure float from other people's capital.
 *
 *   Stablecoin market: ~$150B today, growing ~30%/yr
 *   GRAIN staker yield: 4.5% APY (funded from our 7% ROI)
 *   Our spread: 2.5% on all staked capital
 *   Adoption curve (S-curve):
 *     Year 1: 2% of stablecoin market stakes on GRAIN
 *     Year 2: 5%
 *     Year 3: 10%
 *     Year 4: 15%
 *     Year 5+: 20%
 *
 * Why they stake: GRAIN only goes UP. Backing ratio ≥ 1.0 is immutable.
 * 4.5% yield on a coin that appreciates > USDC/USDT sitting flat.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * INCENTIVE MODEL (Siege only)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Pull volume through the system faster by paying participants:
 *
 *   Buyer cashback:  10bps (0.10%) on eligible transactions
 *   Seller rebate:    5bps (0.05%) on eligible transactions
 *   Total cost:      15bps of incentivized volume
 *   Effect:          +20% boost to eligible volume share
 *
 * This is CAC spent on flow, not users. Every dollar of flow compounds
 * in the float forever. The incentive cost is front-loaded, the revenue
 * is permanent.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ELIGIBLE VOLUME RAMP (Blitz + Siege)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   <5% share   → 30% eligible  (early adopters)
 *   5-10%       → 45% eligible  (growing network)
 *   10-25%      → 60% eligible  (established)
 *   25-50%      → 80% eligible  (dominant)
 *   50%+        → 95% eligible  (near-monopoly)
 *
 * In Siege mode, incentives add +20% on top (capped at 98%).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * OPEX EFFICIENCY AT SCALE (Blitz + Siege)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   <5% share   → 1.8bps  (startup costs)
 *   5-10%       → 1.4bps  (economies kick in)
 *   10-25%      → 1.0bps  (scale advantages)
 *   25-50%      → 0.7bps  (dominant efficiency)
 *   50%+        → 0.5bps  (monopoly margins)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  SETTLEMENT_HOURS,
  TARGET_ROI,
  BASE_CASE_ANNUAL_VOLUME,
} from './float-allocation'

import {
  PROCESSING_FEE_RATE,
  PROCESSING_ELIGIBLE_SHARE,
} from './revenue-allocation'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Global payment volume — the ceiling */
export const GLOBAL_PAYMENT_VOLUME = 33_000_000_000_000 // $33T

/** Starting float (base case: $1T volume, 48hr settlement) */
export const STARTING_FLOAT = BASE_CASE_ANNUAL_VOLUME / 365 * (SETTLEMENT_HOURS / 24) // ~$5.48B

/** Maximum float at 100% capture */
export const MAX_FLOAT = GLOBAL_PAYMENT_VOLUME / 365 * (SETTLEMENT_HOURS / 24) // ~$180.8B

/** Tithe — 10% off the top of ALL gross revenue, always */
export const TITHE_RATE = 0.10

// ============================================================================
// OPERATING COST MODEL
// ============================================================================

export const OPEX_MODEL = {
  fixed: {
    engineering: 6_000_000,       // 15 senior engineers × $400K fully loaded
    operations: 2_000_000,        // 8 ops/finance staff × $250K fully loaded
    compliance: 2_500_000,        // 5 compliance/legal × $500K fully loaded
    executive: 2_000_000,         // 4 execs × $500K fully loaded
    overhead: 1_500_000,          // Office, admin, insurance, misc
  },
  variableBps: {
    infrastructure: 0.5,
    customerAcquisition: 1.0,
    regulatory: 0.3,
  },
} as const

export const TOTAL_FIXED_OPEX =
  OPEX_MODEL.fixed.engineering +
  OPEX_MODEL.fixed.operations +
  OPEX_MODEL.fixed.compliance +
  OPEX_MODEL.fixed.executive +
  OPEX_MODEL.fixed.overhead // $14M

export const TOTAL_VARIABLE_BPS =
  OPEX_MODEL.variableBps.infrastructure +
  OPEX_MODEL.variableBps.customerAcquisition +
  OPEX_MODEL.variableBps.regulatory // 1.8bps

export const TOTAL_VARIABLE_RATE = TOTAL_VARIABLE_BPS / 10000

export function calculateAnnualOpEx(annualVolume: number): {
  fixed: number
  variable: number
  total: number
} {
  const variable = annualVolume * TOTAL_VARIABLE_RATE
  return {
    fixed: TOTAL_FIXED_OPEX,
    variable,
    total: TOTAL_FIXED_OPEX + variable,
  }
}

// ============================================================================
// BLITZ MODE CONFIGURATION
// ============================================================================

/** Capital raises injected directly into the float */
export const BLITZ_CAPITAL_RAISES = [
  { atDay: 1,    amount: 2_000_000_000,  label: 'Seed/Series A — $2B war chest' },
  { atDay: 365,  amount: 5_000_000_000,  label: 'Series B — $5B (year 1 traction)' },
  { atDay: 730,  amount: 10_000_000_000, label: 'Series C — $10B (growth proof)' },
  { atDay: 1095, amount: 20_000_000_000, label: 'Series D/IPO — $20B (category leader)' },
] as const

/** Eligible volume % ramps with market dominance */
export function getEligibleShare(marketShare: number): number {
  if (marketShare < 0.05) return 0.30       // Early: 30%
  if (marketShare < 0.10) return 0.45       // Growing: 45%
  if (marketShare < 0.25) return 0.60       // Established: 60%
  if (marketShare < 0.50) return 0.80       // Dominant: 80%
  return 0.95                                // Near-monopoly: 95%
}

/** Variable OpEx (bps) drops with scale efficiency */
export function getVariableBpsAtScale(marketShare: number): number {
  if (marketShare < 0.05) return 1.8        // Startup
  if (marketShare < 0.10) return 1.4        // Economies kick in
  if (marketShare < 0.25) return 1.0        // Scale advantages
  if (marketShare < 0.50) return 0.7        // Dominant efficiency
  return 0.5                                 // Monopoly margins
}

// ============================================================================
// SIEGE MODE CONFIGURATION — STAKING + INCENTIVES
// ============================================================================

/** Global stablecoin market capitalization baseline */
export const STABLECOIN_MARKET_BASE = 150_000_000_000 // $150B

/** Stablecoin market annual growth rate */
export const STABLECOIN_GROWTH_RATE = 0.30 // 30%/yr

/** Yield paid to external stakers (they lock stablecoins into GRAIN treasury) */
export const STAKER_YIELD = 0.045 // 4.5% APY

/** Spread we keep on staked capital (TARGET_ROI - STAKER_YIELD) */
export const STAKING_SPREAD = TARGET_ROI - STAKER_YIELD // 2.5%

/**
 * S-curve adoption: what % of the stablecoin market stakes on GRAIN.
 * Driven by GRAIN's unique property: it only goes UP + 4.5% yield.
 */
export function getStakingAdoption(day: number): number {
  const year = day / 365
  if (year < 1) return 0.02       // 2% — early believers
  if (year < 2) return 0.05       // 5% — traction proof
  if (year < 3) return 0.10       // 10% — established
  if (year < 4) return 0.15       // 15% — dominant
  return 0.20                      // 20% — category standard
}

/** Staked capital flows in at 1% of the gap per day (smooth inflow) */
export const STAKING_INFLOW_RATE = 0.01

/** Buyer cashback: 10bps */
export const BUYER_INCENTIVE_BPS = 10

/** Seller rebate: 5bps */
export const SELLER_INCENTIVE_BPS = 5

/** Total incentive cost: 15bps of incentivized volume */
export const TOTAL_INCENTIVE_BPS = BUYER_INCENTIVE_BPS + SELLER_INCENTIVE_BPS
export const INCENTIVE_COST_RATE = TOTAL_INCENTIVE_BPS / 10000 // 0.0015

/** Incentives boost eligible volume share by this much (additive) */
export const INCENTIVE_VOLUME_BOOST = 0.20 // +20%

/** Cap on eligible share (even with incentives, can't exceed this) */
export const MAX_ELIGIBLE_SHARE = 0.98

// ============================================================================
// TYPES
// ============================================================================

export type SimMode = 'organic' | 'blitz' | 'siege'

export interface QuarterlySnapshot {
  quarter: number
  yearLabel: string
  float: number
  stakedFloat: number
  totalFloat: number
  annualVolume: number
  marketSharePct: number
  quarterlyGrossRevenue: number
  quarterlyTithe: number
  quarterlyOpEx: number
  quarterlyCapitalInjected: number
  quarterlyStakingInflow: number
  quarterlyStakerYieldPaid: number
  quarterlyIncentiveCost: number
  quarterlyNetToFloat: number
  cumulativeReinvested: number
  cumulativeTithe: number
  cumulativeOpEx: number
  cumulativeCapital: number
  cumulativeStaked: number
  eligibleSharePct: number
  variableBps: number
}

export interface Milestone {
  label: string
  day: number
  float: number
  stakedFloat: number
  totalFloat: number
  volume: number
  eligiblePct: number
}

export interface TropicalForceProjection {
  mode: SimMode
  startingFloat: number
  targetFloat: number
  globalVolume: number
  annualGrowthRate: number
  daysTo50Pct: number | null
  daysTo75Pct: number | null
  daysTo100Pct: number | null
  quarters: QuarterlySnapshot[]
  milestones: Milestone[]
  capitalRaises: { day: number; amount: number; label: string }[]
  totals: {
    capitalRaised: number
    reinvested: number
    titheGiven: number
    opExSpent: number
    externalStaked: number
    stakerYieldPaid: number
    incentiveCost: number
  }
}

// ============================================================================
// SIMULATION ENGINE
// ============================================================================

/**
 * Run the tropical force simulation day by day.
 *
 * ORGANIC: pure compounding, no capital injection, fixed 30% eligible
 * BLITZ:   capital raises + ramping eligible % + OpEx efficiency
 * SIEGE:   blitz + external staking + buyer/seller incentives
 */
export function simulateTropicalForce(
  mode: SimMode = 'siege',
  startingFloat: number = STARTING_FLOAT,
  maxDays: number = 365 * 30,
): TropicalForceProjection {
  const settlementDays = SETTLEMENT_HOURS / 24

  let float = startingFloat
  let stakedFloat = 0
  let cumulativeReinvested = 0
  let cumulativeTithe = 0
  let cumulativeOpEx = 0
  let cumulativeCapital = 0
  let cumulativeStaked = 0
  let cumulativeStakerYield = 0
  let cumulativeIncentiveCost = 0
  let reachedMax = false

  const dailyFixedOpEx = TOTAL_FIXED_OPEX / 365

  // Milestone tracking
  const milestoneTargets = [0.05, 0.10, 0.25, 0.50, 0.75, 1.0]
  const milestones: Milestone[] = []
  const milestonesHit = new Set<number>()

  // Capital raise tracking (blitz + siege)
  const raisesUsed = new Set<number>()
  const raisesApplied: { day: number; amount: number; label: string }[] = []

  // Quarterly accumulators
  const quarters: QuarterlySnapshot[] = []
  let qGross = 0, qTithe = 0, qOpEx = 0, qNet = 0, qCapital = 0
  let qStakingInflow = 0, qStakerYield = 0, qIncentiveCost = 0

  let daysTo50Pct: number | null = null
  let daysTo75Pct: number | null = null
  let daysTo100Pct: number | null = null

  for (let day = 1; day <= maxDays; day++) {
    if (reachedMax) break

    // === CAPITAL INJECTION (blitz + siege) ===
    if (mode !== 'organic') {
      for (const raise of BLITZ_CAPITAL_RAISES) {
        if (day === raise.atDay && !raisesUsed.has(raise.atDay)) {
          raisesUsed.add(raise.atDay)
          float += raise.amount
          cumulativeCapital += raise.amount
          qCapital += raise.amount
          raisesApplied.push({ day: raise.atDay, amount: raise.amount, label: raise.label })
        }
      }
    }

    // === STAKING INFLOWS (siege only) ===
    let dailyStakingInflow = 0
    let dailyStakerYieldPaid = 0

    if (mode === 'siege') {
      const yearFrac = day / 365
      const totalStablecoinMarket = STABLECOIN_MARKET_BASE * Math.pow(1 + STABLECOIN_GROWTH_RATE, yearFrac)
      const adoptionRate = getStakingAdoption(day)
      const targetStaked = totalStablecoinMarket * adoptionRate

      // Staked capital flows in gradually
      const gap = targetStaked - stakedFloat
      if (gap > 0) {
        dailyStakingInflow = gap * STAKING_INFLOW_RATE
        stakedFloat += dailyStakingInflow
        cumulativeStaked += dailyStakingInflow
        qStakingInflow += dailyStakingInflow
      }

      // Pay staker yield (cost to us, deducted from revenue)
      dailyStakerYieldPaid = stakedFloat * STAKER_YIELD / 365
      cumulativeStakerYield += dailyStakerYieldPaid
      qStakerYield += dailyStakerYieldPaid
    }

    // Total effective float = our capital + staked capital
    const totalFloat = float + stakedFloat
    const dailyVolume = totalFloat / settlementDays
    const annualVolume = dailyVolume * 365
    const marketShare = annualVolume / GLOBAL_PAYMENT_VOLUME

    // Dynamic parameters based on mode
    let eligibleShare: number
    let varRate: number

    if (mode === 'organic') {
      eligibleShare = PROCESSING_ELIGIBLE_SHARE
      varRate = TOTAL_VARIABLE_RATE
    } else {
      const baseEligible = getEligibleShare(marketShare)
      eligibleShare = mode === 'siege'
        ? Math.min(MAX_ELIGIBLE_SHARE, baseEligible + INCENTIVE_VOLUME_BOOST)
        : baseEligible
      varRate = getVariableBpsAtScale(marketShare) / 10000
    }

    // === GROSS REVENUE ===
    const dailyProcessingFees = dailyVolume * eligibleShare * PROCESSING_FEE_RATE
    const dailyOwnYield = float * TARGET_ROI / 365
    // On staked capital, we earn the full ROI but pay stakers their yield
    // Net spread = TARGET_ROI - STAKER_YIELD = 2.5%
    const dailyStakeSpread = stakedFloat * STAKING_SPREAD / 365
    const dailyGross = dailyProcessingFees + dailyOwnYield + dailyStakeSpread

    // === DEDUCTIONS ===
    const dailyTithe = dailyGross * TITHE_RATE
    const dailyOpEx = dailyFixedOpEx + (dailyVolume * varRate)

    // Incentive costs (siege only) — we pay buyers/sellers to route through us
    let dailyIncentiveCost = 0
    if (mode === 'siege') {
      dailyIncentiveCost = dailyVolume * eligibleShare * INCENTIVE_COST_RATE
      cumulativeIncentiveCost += dailyIncentiveCost
      qIncentiveCost += dailyIncentiveCost
    }

    const dailyNetToFloat = Math.max(0,
      dailyGross - dailyTithe - dailyOpEx - dailyIncentiveCost - dailyStakerYieldPaid
    )

    // Compound into OUR float (not staked — stakers keep theirs)
    float += dailyNetToFloat
    cumulativeReinvested += dailyNetToFloat
    cumulativeTithe += dailyTithe
    cumulativeOpEx += dailyOpEx

    // Accumulate quarterly
    qGross += dailyGross
    qTithe += dailyTithe
    qOpEx += dailyOpEx
    qNet += dailyNetToFloat

    // Cap check
    if (totalFloat >= MAX_FLOAT) {
      float = MAX_FLOAT - stakedFloat
      reachedMax = true
    }

    // Track milestones
    for (const target of milestoneTargets) {
      if (!milestonesHit.has(target) && marketShare >= target) {
        milestonesHit.add(target)
        milestones.push({
          label: `${(target * 100).toFixed(0)}% market share`,
          day,
          float,
          stakedFloat,
          totalFloat,
          volume: annualVolume,
          eligiblePct: eligibleShare * 100,
        })
        if (target === 0.50) daysTo50Pct = day
        if (target === 0.75) daysTo75Pct = day
        if (target === 1.0) daysTo100Pct = day
      }
    }

    // Quarterly snapshot (every 91 days)
    if (day % 91 === 0 || reachedMax) {
      const qNum = Math.ceil(day / 91)
      const year = Math.ceil(day / 365)
      const qInYear = Math.ceil((day % 365 || 365) / 91)

      const currentTotalFloat = float + stakedFloat
      quarters.push({
        quarter: qNum,
        yearLabel: `Y${year} Q${qInYear}`,
        float,
        stakedFloat,
        totalFloat: currentTotalFloat,
        annualVolume: (currentTotalFloat / settlementDays) * 365,
        marketSharePct: ((currentTotalFloat / settlementDays) * 365 / GLOBAL_PAYMENT_VOLUME) * 100,
        quarterlyGrossRevenue: qGross,
        quarterlyTithe: qTithe,
        quarterlyOpEx: qOpEx,
        quarterlyCapitalInjected: qCapital,
        quarterlyStakingInflow: qStakingInflow,
        quarterlyStakerYieldPaid: qStakerYield,
        quarterlyIncentiveCost: qIncentiveCost,
        quarterlyNetToFloat: qNet,
        cumulativeReinvested,
        cumulativeTithe,
        cumulativeOpEx,
        cumulativeCapital,
        cumulativeStaked,
        eligibleSharePct: eligibleShare * 100,
        variableBps: mode === 'organic' ? TOTAL_VARIABLE_BPS : getVariableBpsAtScale(marketShare),
      })

      qGross = 0; qTithe = 0; qOpEx = 0; qNet = 0; qCapital = 0
      qStakingInflow = 0; qStakerYield = 0; qIncentiveCost = 0
    }
  }

  // Approximate annual growth rate
  const endFloat = quarters.length > 0 ? quarters[quarters.length - 1].totalFloat : startingFloat
  const totalDays = quarters.length > 0 ? quarters[quarters.length - 1].quarter * 91 : 1
  const annualGrowthRate = totalDays > 365
    ? Math.pow(endFloat / startingFloat, 365 / totalDays) - 1
    : 0

  return {
    mode,
    startingFloat,
    targetFloat: MAX_FLOAT,
    globalVolume: GLOBAL_PAYMENT_VOLUME,
    annualGrowthRate,
    daysTo50Pct,
    daysTo75Pct,
    daysTo100Pct,
    quarters,
    milestones,
    capitalRaises: raisesApplied,
    totals: {
      capitalRaised: cumulativeCapital,
      reinvested: cumulativeReinvested,
      titheGiven: cumulativeTithe,
      opExSpent: cumulativeOpEx,
      externalStaked: cumulativeStaked,
      stakerYieldPaid: cumulativeStakerYield,
      incentiveCost: cumulativeIncentiveCost,
    },
  }
}

// ============================================================================
// COMPARISON
// ============================================================================

/**
 * Run all three modes side by side.
 */
export function compareAllModes(startingFloat?: number): {
  organic: TropicalForceProjection
  blitz: TropicalForceProjection
  siege: TropicalForceProjection
} {
  return {
    organic: simulateTropicalForce('organic', startingFloat),
    blitz: simulateTropicalForce('blitz', startingFloat),
    siege: simulateTropicalForce('siege', startingFloat),
  }
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

function fmtUSD(n: number): string {
  if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtDays(days: number): string {
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  if (years > 0 && months > 0) return `${years}y ${months}m`
  if (years > 0) return `${years}y`
  if (months > 0) return `${months}m`
  return `${days}d`
}

/**
 * Generate the full tropical force report for any mode.
 */
export function generateTropicalForceSummary(
  mode: SimMode = 'siege',
  startingFloat?: number,
): string {
  const sim = simulateTropicalForce(mode, startingFloat)
  const modeLabel = mode === 'siege' ? 'SIEGE MODE' : mode === 'blitz' ? 'BLITZ MODE' : 'ORGANIC MODE'

  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    `TROPICAL FORCE — ${modeLabel}`,
    '═══════════════════════════════════════════════════════════════',
    '',
    `Starting Float:       ${fmtUSD(sim.startingFloat)}`,
    `Target Float (100%):  ${fmtUSD(sim.targetFloat)}`,
    `Global Volume:        ${fmtUSD(sim.globalVolume)}`,
    '',
  ]

  if (mode !== 'organic' && sim.capitalRaises.length > 0) {
    lines.push('─── Capital Raises (injected into float) ───')
    for (const r of sim.capitalRaises) {
      lines.push(`  Day ${String(r.day).padStart(5)} (${fmtDays(r.day).padStart(6)}): ${fmtUSD(r.amount).padStart(8)}  ${r.label}`)
    }
    lines.push(`  ${''.padStart(23)} ────────`)
    lines.push(`  ${''.padStart(23)} ${fmtUSD(sim.totals.capitalRaised).padStart(8)}  total raised`)
    lines.push('')
  }

  if (mode === 'siege') {
    lines.push('─── Staking (external stablecoins locked into GRAIN) ───')
    lines.push(`  Stablecoin market:  ${fmtUSD(STABLECOIN_MARKET_BASE)} base, ${(STABLECOIN_GROWTH_RATE * 100).toFixed(0)}%/yr growth`)
    lines.push(`  Staker yield:       ${(STAKER_YIELD * 100).toFixed(1)}% APY`)
    lines.push(`  Our spread:         ${(STAKING_SPREAD * 100).toFixed(1)}% (${(TARGET_ROI * 100).toFixed(0)}% ROI - ${(STAKER_YIELD * 100).toFixed(1)}% staker yield)`)
    lines.push(`  Adoption:           2% → 5% → 10% → 15% → 20% over 5 years`)
    lines.push('')
    lines.push('─── Incentives (buyer cashback + seller rebates) ───')
    lines.push(`  Buyer cashback:     ${BUYER_INCENTIVE_BPS}bps (0.${BUYER_INCENTIVE_BPS}%)`)
    lines.push(`  Seller rebate:      ${SELLER_INCENTIVE_BPS}bps (0.0${SELLER_INCENTIVE_BPS}%)`)
    lines.push(`  Volume boost:       +${(INCENTIVE_VOLUME_BOOST * 100).toFixed(0)}% eligible share`)
    lines.push('')
  }

  lines.push('─── Deductions (always) ───')
  lines.push(`  Tithe:    10% off the top of all gross revenue`)
  lines.push(`  OpEx:     $14M/yr fixed + variable bps (scales down with share)`)
  lines.push('')

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('MILESTONES')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('')

  for (const m of sim.milestones) {
    const stakeStr = mode === 'siege' ? `  Staked: ${fmtUSD(m.stakedFloat).padStart(8)}` : ''
    lines.push(
      `  ${m.label.padEnd(22)} Day ${String(m.day).padStart(5)} (${fmtDays(m.day).padStart(6)})  ` +
      `Float: ${fmtUSD(m.totalFloat).padStart(10)}  Volume: ${fmtUSD(m.volume).padStart(10)}  ` +
      `Eligible: ${m.eligiblePct.toFixed(0)}%${stakeStr}`
    )
  }

  if (sim.daysTo50Pct) {
    lines.push('')
    lines.push(`  >>> 50% capture in ${fmtDays(sim.daysTo50Pct)}`)
  }
  if (sim.daysTo75Pct) {
    lines.push(`  >>> 75% capture in ${fmtDays(sim.daysTo75Pct)}`)
  }
  if (sim.daysTo100Pct) {
    lines.push(`  >>> 100% capture in ${fmtDays(sim.daysTo100Pct)}`)
  }

  lines.push('')
  lines.push('─── Cumulative Totals ───')
  lines.push(`  Capital Raised:     ${fmtUSD(sim.totals.capitalRaised)}`)
  lines.push(`  Organic Reinvested: ${fmtUSD(sim.totals.reinvested)}`)
  lines.push(`  Tithe Given:        ${fmtUSD(sim.totals.titheGiven)}`)
  lines.push(`  OpEx Spent:         ${fmtUSD(sim.totals.opExSpent)}`)
  if (mode === 'siege') {
    lines.push(`  External Staked:    ${fmtUSD(sim.totals.externalStaked)}`)
    lines.push(`  Staker Yield Paid:  ${fmtUSD(sim.totals.stakerYieldPaid)}`)
    lines.push(`  Incentive Cost:     ${fmtUSD(sim.totals.incentiveCost)}`)
  }
  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')

  return lines.join('\n')
}

/**
 * Generate side-by-side comparison of all three modes.
 */
export function generateComparisonSummary(startingFloat?: number): string {
  const { organic, blitz, siege } = compareAllModes(startingFloat)

  const fmtTime = (d: number | null) => d ? fmtDays(d) : '30yr+'

  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    'TROPICAL FORCE — THREE MODE COMPARISON',
    '═══════════════════════════════════════════════════════════════',
    '',
    '                        ORGANIC      BLITZ        SIEGE',
    '  ────────────────      ───────      ─────        ─────',
    `  50% capture:          ${fmtTime(organic.daysTo50Pct).padEnd(12)} ${fmtTime(blitz.daysTo50Pct).padEnd(12)} ${fmtTime(siege.daysTo50Pct)}`,
    `  75% capture:          ${fmtTime(organic.daysTo75Pct).padEnd(12)} ${fmtTime(blitz.daysTo75Pct).padEnd(12)} ${fmtTime(siege.daysTo75Pct)}`,
    `  100% capture:         ${fmtTime(organic.daysTo100Pct).padEnd(12)} ${fmtTime(blitz.daysTo100Pct).padEnd(12)} ${fmtTime(siege.daysTo100Pct)}`,
    '',
    `  Capital raised:       ${fmtUSD(organic.totals.capitalRaised).padEnd(12)} ${fmtUSD(blitz.totals.capitalRaised).padEnd(12)} ${fmtUSD(siege.totals.capitalRaised)}`,
    `  External staked:      ${fmtUSD(organic.totals.externalStaked).padEnd(12)} ${fmtUSD(blitz.totals.externalStaked).padEnd(12)} ${fmtUSD(siege.totals.externalStaked)}`,
    `  Tithe given:          ${fmtUSD(organic.totals.titheGiven).padEnd(12)} ${fmtUSD(blitz.totals.titheGiven).padEnd(12)} ${fmtUSD(siege.totals.titheGiven)}`,
    `  OpEx spent:           ${fmtUSD(organic.totals.opExSpent).padEnd(12)} ${fmtUSD(blitz.totals.opExSpent).padEnd(12)} ${fmtUSD(siege.totals.opExSpent)}`,
    '',
    '═══════════════════════════════════════════════════════════════',
  ]

  return lines.join('\n')
}
