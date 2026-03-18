/**
 * TROPICAL FORCE — Aggressive Float Growth Engine
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE FLYWHEEL (after deductions)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Revenue = 33bps processing fees + 7% float yield
 *
 * Before reinvestment, we deduct:
 *   1. TITHE: 10% off the top of ALL gross revenue (non-negotiable)
 *   2. OPEX: Conservative operating costs that scale with float size
 *
 * Everything remaining goes straight back into the float.
 *
 *   Float grows → supports more volume → earns more fees → float grows
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * OPERATING COST MODEL (Conservative)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Fixed costs (annual):
 *   Engineering (15 senior)         $6.0M    ($400K avg fully loaded)
 *   Operations / Finance (8)        $2.0M    ($250K avg fully loaded)
 *   Compliance / Legal (5)          $2.5M    ($500K avg fully loaded)
 *   Executive team (4)              $2.0M    ($500K avg fully loaded)
 *   Office / Admin / Insurance      $1.5M
 *   ─────────────────────────────────────
 *   Base fixed costs:              $14.0M/year
 *
 * Variable costs (scale with volume):
 *   Infrastructure (cloud, APIs):   0.5bps of annual volume
 *   Customer acquisition:           1.0bps of annual volume
 *   Regulatory / audit:             0.3bps of annual volume
 *   ─────────────────────────────────────
 *   Variable rate:                  1.8bps of annual volume
 *
 * At $1T base case:
 *   Fixed:    $14M
 *   Variable: $1T × 0.018% = $180M
 *   Total:    $194M/year
 *
 * Revenue at base case:
 *   Processing fees:  $990M
 *   Float yield:      $378M
 *   Gross:           $1,368M
 *   Tithe (10%):     -$137M
 *   OpEx:            -$194M
 *   ─────────────────────────────
 *   Net to float:    $1,037M/year → reinvested daily
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

/**
 * Conservative OpEx assumptions.
 * Fixed costs are annual; variable costs are in basis points of annual volume.
 */
export const OPEX_MODEL = {
  /** Fixed annual costs — staff, office, insurance, admin */
  fixed: {
    engineering: 6_000_000,       // 15 senior engineers × $400K fully loaded
    operations: 2_000_000,        // 8 ops/finance staff × $250K fully loaded
    compliance: 2_500_000,        // 5 compliance/legal × $500K fully loaded
    executive: 2_000_000,         // 4 execs × $500K fully loaded
    overhead: 1_500_000,          // Office, admin, insurance, misc
  },

  /** Variable costs — basis points of annual volume */
  variableBps: {
    infrastructure: 0.5,          // Cloud, APIs, data providers
    customerAcquisition: 1.0,     // Sales, marketing, onboarding
    regulatory: 0.3,              // Audits, licensing, reporting
  },
} as const

/** Total fixed annual cost */
export const TOTAL_FIXED_OPEX =
  OPEX_MODEL.fixed.engineering +
  OPEX_MODEL.fixed.operations +
  OPEX_MODEL.fixed.compliance +
  OPEX_MODEL.fixed.executive +
  OPEX_MODEL.fixed.overhead // $14M

/** Total variable cost rate (bps → decimal) */
export const TOTAL_VARIABLE_BPS =
  OPEX_MODEL.variableBps.infrastructure +
  OPEX_MODEL.variableBps.customerAcquisition +
  OPEX_MODEL.variableBps.regulatory // 1.8bps

export const TOTAL_VARIABLE_RATE = TOTAL_VARIABLE_BPS / 10000 // 0.00018

/**
 * Calculate annual operating costs for a given volume.
 */
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
// TYPES
// ============================================================================

export interface QuarterlySnapshot {
  quarter: number
  yearLabel: string
  float: number
  annualVolume: number
  marketSharePct: number
  quarterlyGrossRevenue: number
  quarterlyTithe: number
  quarterlyOpEx: number
  quarterlyNetToFloat: number
  cumulativeReinvested: number
  cumulativeTithe: number
  cumulativeOpEx: number
}

export interface TropicalForceProjection {
  startingFloat: number
  targetFloat: number
  globalVolume: number
  dailyGrowthRate: number
  annualGrowthRate: number
  daysTo50Pct: number | null
  daysTo100Pct: number | null
  quarters: QuarterlySnapshot[]
  milestones: { label: string; day: number; float: number; volume: number }[]
  costSummary: {
    annualOpExAtStart: number
    annualTitheAtStart: number
    reinvestmentRatio: number  // % of gross that goes to float
  }
}

// ============================================================================
// SIMULATION ENGINE
// ============================================================================

/**
 * Run the tropical force simulation day by day.
 *
 * Revenue flow:
 *   1. Gross = processing fees (33bps on 30%) + float yield (7%)
 *   2. Tithe = 10% off the top
 *   3. OpEx = fixed + variable costs
 *   4. Remainder → reinvested into the float
 *
 * Caps at $33T annual volume (100% global capture).
 */
export function simulateTropicalForce(
  startingFloat: number = STARTING_FLOAT,
  maxDays: number = 365 * 30,
): TropicalForceProjection {
  const settlementDays = SETTLEMENT_HOURS / 24

  let float = startingFloat
  let cumulativeReinvested = 0
  let cumulativeTithe = 0
  let cumulativeOpEx = 0
  let reachedMax = false

  // Daily fixed cost
  const dailyFixedOpEx = TOTAL_FIXED_OPEX / 365

  // Milestones to track
  const milestoneTargets = [0.05, 0.10, 0.25, 0.50, 0.75, 1.0]
  const milestones: TropicalForceProjection['milestones'] = []
  const milestonesHit = new Set<number>()

  // Quarterly accumulators
  const quarters: QuarterlySnapshot[] = []
  let qGross = 0
  let qTithe = 0
  let qOpEx = 0
  let qNet = 0

  let daysTo50Pct: number | null = null
  let daysTo100Pct: number | null = null

  // Day-by-day simulation
  for (let day = 1; day <= maxDays; day++) {
    if (reachedMax) break

    // Current capacity
    const dailyVolume = float / settlementDays
    const annualVolume = dailyVolume * 365
    const marketShare = annualVolume / GLOBAL_PAYMENT_VOLUME

    // === GROSS REVENUE ===
    const dailyProcessingFees = dailyVolume * PROCESSING_ELIGIBLE_SHARE * PROCESSING_FEE_RATE
    const dailyYield = float * TARGET_ROI / 365
    const dailyGross = dailyProcessingFees + dailyYield

    // === DEDUCTIONS ===
    // 1. Tithe: 10% off the top
    const dailyTithe = dailyGross * TITHE_RATE

    // 2. OpEx: fixed + variable
    const dailyVariableOpEx = dailyVolume * 365 * TOTAL_VARIABLE_RATE / 365 // daily share of variable
    const dailyOpEx = dailyFixedOpEx + dailyVariableOpEx

    // === NET TO FLOAT ===
    const dailyNetToFloat = Math.max(0, dailyGross - dailyTithe - dailyOpEx)

    // Compound back into the float
    float += dailyNetToFloat
    cumulativeReinvested += dailyNetToFloat
    cumulativeTithe += dailyTithe
    cumulativeOpEx += dailyOpEx

    // Cap at maximum float (100% of $33T)
    if (float >= MAX_FLOAT) {
      float = MAX_FLOAT
      reachedMax = true
    }

    // Accumulate quarterly
    qGross += dailyGross
    qTithe += dailyTithe
    qOpEx += dailyOpEx
    qNet += dailyNetToFloat

    // Track milestones
    for (const target of milestoneTargets) {
      if (!milestonesHit.has(target) && marketShare >= target) {
        milestonesHit.add(target)
        milestones.push({
          label: `${(target * 100).toFixed(0)}% market share`,
          day,
          float,
          volume: annualVolume,
        })
        if (target === 0.50) daysTo50Pct = day
        if (target === 1.0) daysTo100Pct = day
      }
    }

    // Snapshot at end of each quarter (every 91 days)
    if (day % 91 === 0 || reachedMax) {
      const qNum = Math.ceil(day / 91)
      const year = Math.ceil(day / 365)
      const qInYear = Math.ceil((day % 365 || 365) / 91)

      quarters.push({
        quarter: qNum,
        yearLabel: `Y${year} Q${qInYear}`,
        float,
        annualVolume: (float / settlementDays) * 365,
        marketSharePct: ((float / settlementDays) * 365 / GLOBAL_PAYMENT_VOLUME) * 100,
        quarterlyGrossRevenue: qGross,
        quarterlyTithe: qTithe,
        quarterlyOpEx: qOpEx,
        quarterlyNetToFloat: qNet,
        cumulativeReinvested,
        cumulativeTithe,
        cumulativeOpEx,
      })

      qGross = 0
      qTithe = 0
      qOpEx = 0
      qNet = 0
    }
  }

  // Starting day economics for summary
  const startDailyVolume = startingFloat / settlementDays
  const startAnnualVolume = startDailyVolume * 365
  const startGross = (startDailyVolume * PROCESSING_ELIGIBLE_SHARE * PROCESSING_FEE_RATE + startingFloat * TARGET_ROI / 365) * 365
  const startTithe = startGross * TITHE_RATE
  const startOpEx = TOTAL_FIXED_OPEX + startAnnualVolume * TOTAL_VARIABLE_RATE
  const reinvestmentRatio = (startGross - startTithe - startOpEx) / startGross

  // Effective daily growth rate (approximate, from day 1)
  const dailyGrossRate = (PROCESSING_ELIGIBLE_SHARE * PROCESSING_FEE_RATE / settlementDays) + (TARGET_ROI / 365)
  const dailyDeductionRate = dailyGrossRate * TITHE_RATE + TOTAL_VARIABLE_RATE + (TOTAL_FIXED_OPEX / 365 / startingFloat)
  const dailyGrowthRate = dailyGrossRate - dailyDeductionRate
  const annualGrowthRate = Math.pow(1 + dailyGrowthRate, 365) - 1

  return {
    startingFloat,
    targetFloat: MAX_FLOAT,
    globalVolume: GLOBAL_PAYMENT_VOLUME,
    dailyGrowthRate,
    annualGrowthRate,
    daysTo50Pct,
    daysTo100Pct,
    quarters,
    milestones,
    costSummary: {
      annualOpExAtStart: startOpEx,
      annualTitheAtStart: startTithe,
      reinvestmentRatio,
    },
  }
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

function fmtUSD(n: number): string {
  if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
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
 * Generate a human-readable summary of the tropical force projection.
 * Board deck / investor presentation ready.
 */
export function generateTropicalForceSummary(
  startingFloat?: number,
): string {
  const sim = simulateTropicalForce(startingFloat)

  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    'TROPICAL FORCE — Float Growth Projection',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Starting Float:       ${fmtUSD(sim.startingFloat)}`,
    `Target Float (100%):  ${fmtUSD(sim.targetFloat)}`,
    `Global Volume:        ${fmtUSD(sim.globalVolume)}`,
    `Annual Growth Rate:   ${(sim.annualGrowthRate * 100).toFixed(1)}%`,
    '',
    '─── Revenue Flow (at start) ───',
    `  Gross Revenue:      ${fmtUSD(sim.costSummary.annualTitheAtStart / TITHE_RATE)}/yr`,
    `  Tithe (10%):       -${fmtUSD(sim.costSummary.annualTitheAtStart)}/yr`,
    `  Operating Costs:   -${fmtUSD(sim.costSummary.annualOpExAtStart)}/yr`,
    `  → Net to Float:     ${(sim.costSummary.reinvestmentRatio * 100).toFixed(1)}% of gross reinvested`,
    '',
    '─── OpEx Breakdown ───',
    `  Engineering (15):   $6.0M/yr`,
    `  Ops/Finance (8):    $2.0M/yr`,
    `  Compliance (5):     $2.5M/yr`,
    `  Executive (4):      $2.0M/yr`,
    `  Overhead:           $1.5M/yr`,
    `  Fixed Total:       $14.0M/yr`,
    `  Variable:           1.8bps of volume`,
    '',
    '═══════════════════════════════════════════════════════════════',
    'MILESTONES',
    '═══════════════════════════════════════════════════════════════',
    '',
  ]

  for (const m of sim.milestones) {
    lines.push(
      `  ${m.label.padEnd(22)} Day ${String(m.day).padStart(5)} (${fmtDays(m.day).padStart(6)})  ` +
      `Float: ${fmtUSD(m.float).padStart(10)}  Volume: ${fmtUSD(m.volume).padStart(10)}`
    )
  }

  if (sim.daysTo50Pct) {
    lines.push('')
    lines.push(`  → 50% capture in ${fmtDays(sim.daysTo50Pct)}`)
  }
  if (sim.daysTo100Pct) {
    lines.push(`  → 100% capture in ${fmtDays(sim.daysTo100Pct)}`)
  }

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('QUARTERLY TRAJECTORY')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('')
  lines.push(
    '  Quarter    Float          Volume        Share   Tithe        OpEx         → Float'
  )
  lines.push(
    '  ───────    ─────          ──────        ─────   ─────        ────         ───────'
  )

  for (const q of sim.quarters) {
    lines.push(
      `  ${q.yearLabel.padEnd(9)} ` +
      `${fmtUSD(q.float).padStart(10)}  ` +
      `${fmtUSD(q.annualVolume).padStart(10)}  ` +
      `${q.marketSharePct.toFixed(1).padStart(6)}%` +
      `${fmtUSD(q.quarterlyTithe).padStart(10)}` +
      `${fmtUSD(q.quarterlyOpEx).padStart(12)}` +
      `${fmtUSD(q.quarterlyNetToFloat).padStart(12)}`
    )
  }

  lines.push('')
  lines.push('─── Cumulative Totals ───')
  const last = sim.quarters[sim.quarters.length - 1]
  if (last) {
    lines.push(`  Total Reinvested:   ${fmtUSD(last.cumulativeReinvested)}`)
    lines.push(`  Total Tithe Given:  ${fmtUSD(last.cumulativeTithe)}`)
    lines.push(`  Total OpEx Spent:   ${fmtUSD(last.cumulativeOpEx)}`)
  }

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')

  return lines.join('\n')
}
