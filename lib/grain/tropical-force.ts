/**
 * TROPICAL FORCE — Aggressive Float Growth Engine
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TWO MODES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ORGANIC MODE (conservative):
 *   Revenue = 33bps fees + 7% float yield
 *   Deduct 10% tithe + OpEx, reinvest remainder
 *   ~75.9% reinvestment ratio
 *   50% capture in ~14.5 years
 *
 * BLITZ MODE (aggressive):
 *   Same revenue flywheel, PLUS:
 *   - Capital raises injected directly into float at milestones
 *   - Eligible volume % ramps as market share grows (30% → 95%)
 *   - Variable OpEx drops with scale (1.8bps → 0.5bps)
 *   50% capture in ~3.75 years
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
 * After that, the flywheel generates enough organic revenue to
 * compound to 100% without additional capital.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ELIGIBLE VOLUME RAMP
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * As market share grows, more transaction volume becomes eligible for
 * the 33bps processing fee (network effects, deeper integrations):
 *
 *   <5% share   → 30% eligible  (early adopters)
 *   5-10%       → 45% eligible  (growing network)
 *   10-25%      → 60% eligible  (established)
 *   25-50%      → 80% eligible  (dominant)
 *   50%+        → 95% eligible  (near-monopoly)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * OPEX EFFICIENCY AT SCALE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Variable costs (bps of volume) drop as scale brings efficiency:
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
// TYPES
// ============================================================================

export type SimMode = 'organic' | 'blitz'

export interface QuarterlySnapshot {
  quarter: number
  yearLabel: string
  float: number
  annualVolume: number
  marketSharePct: number
  quarterlyGrossRevenue: number
  quarterlyTithe: number
  quarterlyOpEx: number
  quarterlyCapitalInjected: number
  quarterlyNetToFloat: number
  cumulativeReinvested: number
  cumulativeTithe: number
  cumulativeOpEx: number
  cumulativeCapital: number
  eligibleSharePct: number
  variableBps: number
}

export interface Milestone {
  label: string
  day: number
  float: number
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
  daysTo100Pct: number | null
  quarters: QuarterlySnapshot[]
  milestones: Milestone[]
  capitalRaises: { day: number; amount: number; label: string }[]
  totals: {
    capitalRaised: number
    reinvested: number
    titheGiven: number
    opExSpent: number
  }
}

// ============================================================================
// SIMULATION ENGINE
// ============================================================================

/**
 * Run the tropical force simulation day by day.
 *
 * ORGANIC mode: pure compounding, no capital injection, fixed 30% eligible
 * BLITZ mode: capital raises + ramping eligible % + OpEx efficiency gains
 */
export function simulateTropicalForce(
  mode: SimMode = 'blitz',
  startingFloat: number = STARTING_FLOAT,
  maxDays: number = 365 * 30,
): TropicalForceProjection {
  const settlementDays = SETTLEMENT_HOURS / 24

  let float = startingFloat
  let cumulativeReinvested = 0
  let cumulativeTithe = 0
  let cumulativeOpEx = 0
  let cumulativeCapital = 0
  let reachedMax = false

  const dailyFixedOpEx = TOTAL_FIXED_OPEX / 365

  // Milestone tracking
  const milestoneTargets = [0.05, 0.10, 0.25, 0.50, 0.75, 1.0]
  const milestones: Milestone[] = []
  const milestonesHit = new Set<number>()

  // Capital raise tracking (blitz only)
  const raisesUsed = new Set<number>()
  const raisesApplied: { day: number; amount: number; label: string }[] = []

  // Quarterly accumulators
  const quarters: QuarterlySnapshot[] = []
  let qGross = 0, qTithe = 0, qOpEx = 0, qNet = 0, qCapital = 0

  let daysTo50Pct: number | null = null
  let daysTo100Pct: number | null = null

  for (let day = 1; day <= maxDays; day++) {
    if (reachedMax) break

    // === CAPITAL INJECTION (blitz only) ===
    if (mode === 'blitz') {
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

    // Current capacity
    const dailyVolume = float / settlementDays
    const annualVolume = dailyVolume * 365
    const marketShare = annualVolume / GLOBAL_PAYMENT_VOLUME

    // Dynamic parameters based on mode
    const eligibleShare = mode === 'blitz' ? getEligibleShare(marketShare) : PROCESSING_ELIGIBLE_SHARE
    const varRate = mode === 'blitz'
      ? getVariableBpsAtScale(marketShare) / 10000
      : TOTAL_VARIABLE_RATE

    // === GROSS REVENUE ===
    const dailyProcessingFees = dailyVolume * eligibleShare * PROCESSING_FEE_RATE
    const dailyYield = float * TARGET_ROI / 365
    const dailyGross = dailyProcessingFees + dailyYield

    // === DEDUCTIONS ===
    const dailyTithe = dailyGross * TITHE_RATE
    const dailyOpEx = dailyFixedOpEx + (dailyVolume * varRate)
    const dailyNetToFloat = Math.max(0, dailyGross - dailyTithe - dailyOpEx)

    // Compound
    float += dailyNetToFloat
    cumulativeReinvested += dailyNetToFloat
    cumulativeTithe += dailyTithe
    cumulativeOpEx += dailyOpEx

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
          eligiblePct: eligibleShare * 100,
        })
        if (target === 0.50) daysTo50Pct = day
        if (target === 1.0) daysTo100Pct = day
      }
    }

    // Quarterly snapshot (every 91 days)
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
        quarterlyCapitalInjected: qCapital,
        quarterlyNetToFloat: qNet,
        cumulativeReinvested,
        cumulativeTithe,
        cumulativeOpEx,
        cumulativeCapital,
        eligibleSharePct: eligibleShare * 100,
        variableBps: mode === 'blitz' ? getVariableBpsAtScale(marketShare) : TOTAL_VARIABLE_BPS,
      })

      qGross = 0; qTithe = 0; qOpEx = 0; qNet = 0; qCapital = 0
    }
  }

  // Approximate annual growth rate from simulation
  const endFloat = quarters.length > 0 ? quarters[quarters.length - 1].float : startingFloat
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
    daysTo100Pct,
    quarters,
    milestones,
    capitalRaises: raisesApplied,
    totals: {
      capitalRaised: cumulativeCapital,
      reinvested: cumulativeReinvested,
      titheGiven: cumulativeTithe,
      opExSpent: cumulativeOpEx,
    },
  }
}

// ============================================================================
// COMPARISON
// ============================================================================

/**
 * Run both modes side by side for comparison.
 */
export function compareModes(startingFloat?: number): {
  organic: TropicalForceProjection
  blitz: TropicalForceProjection
} {
  return {
    organic: simulateTropicalForce('organic', startingFloat),
    blitz: simulateTropicalForce('blitz', startingFloat),
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
 * Generate the full tropical force report.
 */
export function generateTropicalForceSummary(
  mode: SimMode = 'blitz',
  startingFloat?: number,
): string {
  const sim = simulateTropicalForce(mode, startingFloat)

  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    `TROPICAL FORCE — ${mode === 'blitz' ? 'BLITZ MODE' : 'ORGANIC MODE'}`,
    '═══════════════════════════════════════════════════════════════',
    '',
    `Starting Float:       ${fmtUSD(sim.startingFloat)}`,
    `Target Float (100%):  ${fmtUSD(sim.targetFloat)}`,
    `Global Volume:        ${fmtUSD(sim.globalVolume)}`,
    '',
  ]

  if (mode === 'blitz' && sim.capitalRaises.length > 0) {
    lines.push('─── Capital Raises (injected into float) ───')
    for (const r of sim.capitalRaises) {
      lines.push(`  Day ${String(r.day).padStart(5)} (${fmtDays(r.day).padStart(6)}): ${fmtUSD(r.amount).padStart(8)}  ${r.label}`)
    }
    lines.push(`  ${''.padStart(23)} ────────`)
    lines.push(`  ${''.padStart(23)} ${fmtUSD(sim.totals.capitalRaised).padStart(8)}  total raised`)
    lines.push('')
  }

  lines.push('─── Deductions ───')
  lines.push(`  Tithe:    10% off the top of all gross revenue`)
  lines.push(`  OpEx:     $14M/yr fixed + variable bps (scales down with share)`)
  lines.push('')

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('MILESTONES')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('')

  for (const m of sim.milestones) {
    lines.push(
      `  ${m.label.padEnd(22)} Day ${String(m.day).padStart(5)} (${fmtDays(m.day).padStart(6)})  ` +
      `Float: ${fmtUSD(m.float).padStart(10)}  Volume: ${fmtUSD(m.volume).padStart(10)}  ` +
      `Eligible: ${m.eligiblePct.toFixed(0)}%`
    )
  }

  if (sim.daysTo50Pct) {
    lines.push('')
    lines.push(`  >>> 50% capture in ${fmtDays(sim.daysTo50Pct)}`)
  }
  if (sim.daysTo100Pct) {
    lines.push(`  >>> 100% capture in ${fmtDays(sim.daysTo100Pct)}`)
  }

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('QUARTERLY TRAJECTORY')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('')
  lines.push(
    '  Quarter    Float          Volume        Share   Tithe        OpEx         Capital      → Float'
  )
  lines.push(
    '  ───────    ─────          ──────        ─────   ─────        ────         ───────      ───────'
  )

  for (const q of sim.quarters) {
    const capStr = q.quarterlyCapitalInjected > 0 ? fmtUSD(q.quarterlyCapitalInjected) : '—'
    lines.push(
      `  ${q.yearLabel.padEnd(9)} ` +
      `${fmtUSD(q.float).padStart(10)}  ` +
      `${fmtUSD(q.annualVolume).padStart(10)}  ` +
      `${q.marketSharePct.toFixed(1).padStart(6)}%` +
      `${fmtUSD(q.quarterlyTithe).padStart(10)}` +
      `${fmtUSD(q.quarterlyOpEx).padStart(12)}` +
      `${capStr.padStart(12)}` +
      `${fmtUSD(q.quarterlyNetToFloat).padStart(12)}`
    )
  }

  lines.push('')
  lines.push('─── Cumulative Totals ───')
  lines.push(`  Capital Raised:     ${fmtUSD(sim.totals.capitalRaised)}`)
  lines.push(`  Organic Reinvested: ${fmtUSD(sim.totals.reinvested)}`)
  lines.push(`  Tithe Given:        ${fmtUSD(sim.totals.titheGiven)}`)
  lines.push(`  OpEx Spent:         ${fmtUSD(sim.totals.opExSpent)}`)
  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')

  return lines.join('\n')
}

/**
 * Generate side-by-side comparison of organic vs blitz.
 */
export function generateComparisonSummary(startingFloat?: number): string {
  const { organic, blitz } = compareModes(startingFloat)

  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    'TROPICAL FORCE — ORGANIC vs BLITZ COMPARISON',
    '═══════════════════════════════════════════════════════════════',
    '',
    '                          ORGANIC          BLITZ',
    '  ─────────────────────   ───────          ─────',
    `  50% capture:            ${organic.daysTo50Pct ? fmtDays(organic.daysTo50Pct).padEnd(16) : 'N/A'.padEnd(16)} ${blitz.daysTo50Pct ? fmtDays(blitz.daysTo50Pct) : 'N/A'}`,
    `  100% capture:           ${organic.daysTo100Pct ? fmtDays(organic.daysTo100Pct).padEnd(16) : '30yr+'.padEnd(16)} ${blitz.daysTo100Pct ? fmtDays(blitz.daysTo100Pct) : '30yr+'}`,
    `  Capital raised:         ${fmtUSD(organic.totals.capitalRaised).padEnd(16)} ${fmtUSD(blitz.totals.capitalRaised)}`,
    `  Tithe given:            ${fmtUSD(organic.totals.titheGiven).padEnd(16)} ${fmtUSD(blitz.totals.titheGiven)}`,
    `  OpEx spent:             ${fmtUSD(organic.totals.opExSpent).padEnd(16)} ${fmtUSD(blitz.totals.opExSpent)}`,
    '',
    '═══════════════════════════════════════════════════════════════',
  ]

  return lines.join('\n')
}
