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

/** Base yield paid to external stakers (dynamic — increases with retention) */
export const STAKER_YIELD_BASE = 0.045 // 4.5% APY (starting)

/** Spread we keep on staked capital at base yield */
export const STAKING_SPREAD_BASE = TARGET_ROI - STAKER_YIELD_BASE // 2.5%

/**
 * Dynamic staker yield — increases as GRAIN retention proves the model.
 * Higher retention = more stable float = we can afford higher yield.
 * Higher yield = more stakers + more retention = THIRD FLYWHEEL.
 *
 *   <20% retention → 4.5% yield  (proving phase)
 *   20-35%         → 5.0% yield  (traction)
 *   35-50%         → 5.5% yield  (established trust)
 *   50%+           → 6.0% yield  (category standard)
 */
export function getDynamicStakerYield(retentionRate: number): number {
  if (retentionRate < 0.20) return 0.045
  if (retentionRate < 0.35) return 0.050
  if (retentionRate < 0.50) return 0.055
  return 0.060
}

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
// RETENTION MODEL — WHY USERS KEEP CAPITAL IN GRAIN
// ============================================================================

/**
 * GRAIN retention: the % of transacted value that stays in GRAIN.
 *
 * Why users keep money in GRAIN instead of cashing out:
 * 1. GRAIN only goes UP — backing ratio ≥ 1.0 is immutable
 * 2. Yield (4.5-6.0%) beats holding USDC/USDT at 0%
 * 3. Global transaction utility — can pay anyone, anywhere
 * 4. No conversion friction — already in the system
 *
 * Retention ramps as trust builds + yield incentivizes staying:
 *   Year 1: 10%  (early adopters, testing)
 *   Year 2: 20%  (trust building)
 *   Year 3: 35%  (proven track record)
 *   Year 4: 50%  (standard behavior)
 *   Year 5+: 60% (default choice)
 *
 * Yield bonus: each 1% of yield above 4% adds ~5% retention
 * (people respond to incentives)
 */
export function getRetentionRate(day: number, currentYield: number): number {
  const year = day / 365
  let base = 0.10
  if (year >= 1) base = 0.20
  if (year >= 2) base = 0.35
  if (year >= 3) base = 0.50
  if (year >= 4) base = 0.60
  // Higher yield drives higher retention
  const yieldBonus = Math.max(0, (currentYield - 0.04) * 5)
  return Math.min(0.75, base + yieldBonus) // Cap at 75%
}

/** Rate at which retained capital accumulates (1% of eligible volume per day) */
export const RETENTION_ACCUMULATION_RATE = 0.01

/** Alternative starting volume: 7% of $33T = $2.31T (SAP/Oracle/NetSuite corridor) */
export const HIGHER_START_ANNUAL_VOLUME = 2_310_000_000_000
export const HIGHER_START_FLOAT = HIGHER_START_ANNUAL_VOLUME / 365 * (SETTLEMENT_HOURS / 24)

// ============================================================================
// TYPES
// ============================================================================

export type SimMode = 'organic' | 'blitz' | 'siege'

export interface QuarterlySnapshot {
  quarter: number
  yearLabel: string
  float: number
  stakedFloat: number
  retainedFloat: number
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
  cumulativeRetained: number
  eligibleSharePct: number
  variableBps: number
  currentStakerYield: number
  retentionPct: number
}

export interface Milestone {
  label: string
  day: number
  float: number
  stakedFloat: number
  retainedFloat: number
  totalFloat: number
  volume: number
  eligiblePct: number
  stakerYield: number
  retentionPct: number
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
    userRetained: number
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
 * SIEGE:   blitz + staking + incentives + retention + dynamic yield
 *
 * SIEGE has THREE compounding flywheels:
 *   1. Revenue flywheel:  fees + yield → reinvest → more float → more fees
 *   2. Staking flywheel:  external capital → float → revenue → higher yield → more stakers
 *   3. Retention flywheel: users keep $ in GRAIN → more float → higher yield → more retention
 */
export function simulateTropicalForce(
  mode: SimMode = 'siege',
  startingFloat: number = STARTING_FLOAT,
  maxDays: number = 365 * 30,
): TropicalForceProjection {
  const settlementDays = SETTLEMENT_HOURS / 24

  let float = startingFloat
  let stakedFloat = 0
  let retainedFloat = 0 // capital users keep in GRAIN instead of cashing out
  let cumulativeReinvested = 0
  let cumulativeTithe = 0
  let cumulativeOpEx = 0
  let cumulativeCapital = 0
  let cumulativeStaked = 0
  let cumulativeStakerYield = 0
  let cumulativeIncentiveCost = 0
  let cumulativeRetained = 0
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

  // Track current dynamic values for snapshots
  let currentStakerYield = STAKER_YIELD_BASE
  let currentRetentionRate = 0

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

    // === DYNAMIC YIELD + RETENTION (siege only) ===
    let dailyStakerYieldPaid = 0

    if (mode === 'siege') {
      // Retention determines yield, yield reinforces retention (THIRD FLYWHEEL)
      currentRetentionRate = getRetentionRate(day, currentStakerYield)
      currentStakerYield = getDynamicStakerYield(currentRetentionRate)

      // Staking inflows — driven by yield attractiveness
      const yearFrac = day / 365
      const totalStablecoinMarket = STABLECOIN_MARKET_BASE * Math.pow(1 + STABLECOIN_GROWTH_RATE, yearFrac)
      const adoptionRate = getStakingAdoption(day)
      const targetStaked = totalStablecoinMarket * adoptionRate

      const gap = targetStaked - stakedFloat
      if (gap > 0) {
        const inflow = gap * STAKING_INFLOW_RATE
        stakedFloat += inflow
        cumulativeStaked += inflow
        qStakingInflow += inflow
      }

      // Pay staker yield (dynamic — increases with retention)
      dailyStakerYieldPaid = stakedFloat * currentStakerYield / 365
      cumulativeStakerYield += dailyStakerYieldPaid
      qStakerYield += dailyStakerYieldPaid

      // Retention: users keep capital in GRAIN
      // (GRAIN only goes up + yield + global tx utility)
      const totalFloatBefore = float + stakedFloat + retainedFloat
      const dailyVol = totalFloatBefore / settlementDays
      const dailyRetained = dailyVol * currentRetentionRate * RETENTION_ACCUMULATION_RATE
      retainedFloat += dailyRetained
      cumulativeRetained += dailyRetained
    }

    // Total effective float = our capital + staked + retained
    const totalFloat = float + stakedFloat + retainedFloat
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
    // On staked capital: we earn full ROI, pay stakers their yield, keep spread
    const currentSpread = TARGET_ROI - currentStakerYield
    const dailyStakeSpread = stakedFloat * currentSpread / 365
    // On retained capital: we earn full ROI (users benefit via GRAIN appreciation)
    const dailyRetainedYield = retainedFloat * TARGET_ROI / 365
    const dailyGross = dailyProcessingFees + dailyOwnYield + dailyStakeSpread + dailyRetainedYield

    // === DEDUCTIONS ===
    const dailyTithe = dailyGross * TITHE_RATE
    const dailyOpEx = dailyFixedOpEx + (dailyVolume * varRate)

    // Incentive costs (siege only)
    let dailyIncentiveCost = 0
    if (mode === 'siege') {
      dailyIncentiveCost = dailyVolume * eligibleShare * INCENTIVE_COST_RATE
      cumulativeIncentiveCost += dailyIncentiveCost
      qIncentiveCost += dailyIncentiveCost
    }

    const dailyNetToFloat = Math.max(0,
      dailyGross - dailyTithe - dailyOpEx - dailyIncentiveCost - dailyStakerYieldPaid
    )

    // Compound into OUR float
    float += dailyNetToFloat
    cumulativeReinvested += dailyNetToFloat
    cumulativeTithe += dailyTithe
    cumulativeOpEx += dailyOpEx

    // Accumulate quarterly
    qGross += dailyGross
    qTithe += dailyTithe
    qOpEx += dailyOpEx
    qNet += dailyNetToFloat

    // Cap check (total of all three pools)
    const finalTotal = float + stakedFloat + retainedFloat
    if (finalTotal >= MAX_FLOAT) {
      float = MAX_FLOAT - stakedFloat - retainedFloat
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
          retainedFloat,
          totalFloat: finalTotal,
          volume: annualVolume,
          eligiblePct: eligibleShare * 100,
          stakerYield: currentStakerYield * 100,
          retentionPct: currentRetentionRate * 100,
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

      const currentTotalFloat = float + stakedFloat + retainedFloat
      quarters.push({
        quarter: qNum,
        yearLabel: `Y${year} Q${qInYear}`,
        float,
        stakedFloat,
        retainedFloat,
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
        cumulativeRetained,
        eligibleSharePct: eligibleShare * 100,
        variableBps: mode === 'organic' ? TOTAL_VARIABLE_BPS : getVariableBpsAtScale(marketShare),
        currentStakerYield: currentStakerYield * 100,
        retentionPct: currentRetentionRate * 100,
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
      userRetained: cumulativeRetained,
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
    lines.push(`  Staker yield:       ${(STAKER_YIELD_BASE * 100).toFixed(1)}% → 6.0% APY (dynamic, rises with retention)`)
    lines.push(`  Our spread:         ${(STAKING_SPREAD_BASE * 100).toFixed(1)}% → 1.0% (narrows as yield increases)`)
    lines.push(`  Adoption:           2% → 5% → 10% → 15% → 20% over 5 years`)
    lines.push('')
    lines.push('─── Retention (users keep capital in GRAIN) ───')
    lines.push(`  Why:  GRAIN only goes up + yield + global transaction utility`)
    lines.push(`  Rate: 10% → 20% → 35% → 50% → 60% (boosted by higher yield)`)
    lines.push(`  This is the THIRD FLYWHEEL: retention → yield ↑ → retention ↑`)
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
    let extra = ''
    if (mode === 'siege') {
      extra = `  Staked: ${fmtUSD(m.stakedFloat).padStart(8)}  Retained: ${fmtUSD(m.retainedFloat).padStart(8)}  Yield: ${m.stakerYield.toFixed(1)}%  Ret: ${m.retentionPct.toFixed(0)}%`
    }
    lines.push(
      `  ${m.label.padEnd(22)} Day ${String(m.day).padStart(5)} (${fmtDays(m.day).padStart(6)})  ` +
      `Float: ${fmtUSD(m.totalFloat).padStart(10)}  Volume: ${fmtUSD(m.volume).padStart(10)}  ` +
      `Eligible: ${m.eligiblePct.toFixed(0)}%${extra}`
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
    lines.push(`  User Retained:      ${fmtUSD(sim.totals.userRetained)}`)
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
    `  User retained:        ${fmtUSD(organic.totals.userRetained).padEnd(12)} ${fmtUSD(blitz.totals.userRetained).padEnd(12)} ${fmtUSD(siege.totals.userRetained)}`,
    `  Tithe given:          ${fmtUSD(organic.totals.titheGiven).padEnd(12)} ${fmtUSD(blitz.totals.titheGiven).padEnd(12)} ${fmtUSD(siege.totals.titheGiven)}`,
    `  OpEx spent:           ${fmtUSD(organic.totals.opExSpent).padEnd(12)} ${fmtUSD(blitz.totals.opExSpent).padEnd(12)} ${fmtUSD(siege.totals.opExSpent)}`,
    '',
    '═══════════════════════════════════════════════════════════════',
  ]

  return lines.join('\n')
}
