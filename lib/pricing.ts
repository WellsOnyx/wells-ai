/**
 * Wells Onyx Transparent Pricing Engine
 *
 * Three-tier fee structure:
 * 1. Default (Routed Spend): Cost + 0.33% (33bps)
 * 2. Sourced by Wells: 3.3% of ACV/TCV
 * 3. Originated by Wells: 10% of ACV/TCV (with optional step-down)
 *
 * Post-Grain Vault: Pure 33bps across all tiers
 *
 * Attribution Rule: Exactly one track per deal. Default unless Deal.Source
 * tag is set to SOURCED_WELLS or ORIGINATED_WELLS. 30-day dispute window.
 */

export enum TransactionTier {
  DEFAULT_ROUTED = 'default_routed',          // We process existing spend
  SOURCED_WELLS = 'sourced_wells',            // We brought the opportunity
  ORIGINATED_WELLS = 'originated_wells'       // We did full front-line selling
}

export enum PaymentRail {
  STRIPE_CARD = 'stripe_card',
  ACH = 'ach',
  GRAIN = 'grain',         // Future: near-zero internal rail
  WIRE = 'wire'
}

export interface RailCosts {
  percentageFee: number  // In basis points (e.g., 290 = 2.9%)
  fixedFee: number       // In dollars
  minFee?: number        // Minimum fee in dollars
  maxFee?: number        // Maximum fee in dollars
}

// Payment rail costs (pass-through to customer)
export const RAIL_COSTS: Record<PaymentRail, RailCosts> = {
  [PaymentRail.STRIPE_CARD]: {
    percentageFee: 290,  // 2.9%
    fixedFee: 0.30,
    minFee: 0
  },
  [PaymentRail.ACH]: {
    percentageFee: 80,    // 0.8%
    fixedFee: 0,
    minFee: 0,
    maxFee: 5             // Often capped
  },
  [PaymentRail.GRAIN]: {
    percentageFee: 0,     // Near-zero internal
    fixedFee: 0,
    minFee: 0
  },
  [PaymentRail.WIRE]: {
    percentageFee: 0,
    fixedFee: 25,         // Flat $25 per wire
    minFee: 25
  }
}

// Floors & Caps (keeps unit economics sane)
export const PRICING_FLOORS = {
  MONTHLY_PLATFORM_MINIMUM: 2500,  // $2,500/mo per tenant (credited against fees)
  MINIMUM_TRANSACTION_FEE: 25,     // $25 minimum per transaction
  DISPUTE_WINDOW_DAYS: 30          // 30-day audit window
}

// Originated step-down tiers (for whale comfort)
export const ORIGINATED_STEP_DOWN = [
  { threshold: 1000000, rate: 0.10 },   // 10% on first $1M
  { threshold: 5000000, rate: 0.07 },   // 7% on next $4M
  { threshold: Infinity, rate: 0.05 }   // 5% thereafter
]

// Tithe: 10% of gross Wells fee to Adullam Fund
export const TITHE_RATE = 0.10

export interface PricingCalculation {
  transactionAmount: number      // ACV/TCV for sourced/originated, routed amount for default
  tier: TransactionTier
  rail: PaymentRail
  useStepDown: boolean           // For originated deals >$1M

  // Calculated fields
  railCost: number               // Pass-through payment rail cost
  wellsFeeGross: number          // Gross Wells fee (before tithe)
  titheAmount: number            // 10% of gross Wells fee
  wellsFeeNet: number            // Net to Wells after tithe
  totalCustomerCharge: number    // Rail cost + Wells fee
  effectiveRate: number          // As percentage

  // Transparency fields (separate line items)
  breakdown: {
    railPercentage: number
    railFixed: number
    wellsPercentage: number
    tithePurpose: string         // "Adullam Fund" or "Legacy Fund"
  }

  // Attribution audit
  dealSourceTag: string          // For 30-day dispute window
  attributionTimestamp: string
}

/**
 * Calculate Wells Onyx fee based on transaction tier
 */
export function calculateWellsFee(
  amount: number,
  tier: TransactionTier,
  useStepDown: boolean = false
): number {
  switch (tier) {
    case TransactionTier.DEFAULT_ROUTED:
      // Cost + 0.33% (33bps)
      // Note: Rail cost added separately as pass-through
      return amount * 0.0033

    case TransactionTier.SOURCED_WELLS:
      // 3.3% of ACV/TCV
      return amount * 0.033

    case TransactionTier.ORIGINATED_WELLS:
      if (!useStepDown || amount <= ORIGINATED_STEP_DOWN[0].threshold) {
        // Standard 10% on amounts ≤$1M
        return amount * 0.10
      } else {
        // Step-down pricing for whales
        let fee = 0
        let remaining = amount

        for (const tier of ORIGINATED_STEP_DOWN) {
          if (remaining <= 0) break

          const tierAmount = Math.min(remaining, tier.threshold - (amount - remaining))
          fee += tierAmount * tier.rate
          remaining -= tierAmount
        }

        return fee
      }

    default:
      throw new Error(`Unknown transaction tier: ${tier}`)
  }
}

/**
 * Calculate full pricing breakdown with transparency
 * Matches GPT-specified contract terms exactly
 */
export function calculatePricing(
  transactionAmount: number,
  tier: TransactionTier,
  rail: PaymentRail,
  useStepDown: boolean = false,
  dealSourceTag?: string
): PricingCalculation {
  // 1. Calculate payment rail costs (pass-through)
  const railConfig = RAIL_COSTS[rail]
  const railPercentageCost = (transactionAmount * railConfig.percentageFee) / 10000
  const railFixedCost = railConfig.fixedFee
  let railCost = railPercentageCost + railFixedCost

  // Apply min/max caps for rail costs
  if (railConfig.minFee && railCost < railConfig.minFee) {
    railCost = railConfig.minFee
  }
  if (railConfig.maxFee && railCost > railConfig.maxFee) {
    railCost = railConfig.maxFee
  }

  // 2. Calculate Wells fee (gross, before tithe)
  let wellsFeeGross = calculateWellsFee(transactionAmount, tier, useStepDown)

  // Apply minimum transaction fee floor
  if (wellsFeeGross < PRICING_FLOORS.MINIMUM_TRANSACTION_FEE) {
    wellsFeeGross = PRICING_FLOORS.MINIMUM_TRANSACTION_FEE
  }

  // 3. Calculate tithe (10% of gross Wells fee)
  const titheAmount = wellsFeeGross * TITHE_RATE

  // 4. Net to Wells after tithe
  const wellsFeeNet = wellsFeeGross - titheAmount

  // 5. Total customer charge
  const totalCustomerCharge = railCost + wellsFeeGross

  // 6. Effective rate
  const effectiveRate = (totalCustomerCharge / transactionAmount) * 100

  return {
    transactionAmount,
    tier,
    rail,
    useStepDown,
    railCost,
    wellsFeeGross,
    titheAmount,
    wellsFeeNet,
    totalCustomerCharge,
    effectiveRate,
    breakdown: {
      railPercentage: railConfig.percentageFee / 100,
      railFixed: railFixedCost,
      wellsPercentage: (wellsFeeGross / transactionAmount) * 100,
      tithePurpose: 'Adullam Fund'
    },
    dealSourceTag: dealSourceTag || `DEFAULT_${Date.now()}`,
    attributionTimestamp: new Date().toISOString()
  }
}

/**
 * Format pricing for display to user (transparency requirement)
 * Shows separate line items as per contract
 */
export function formatPricingForUser(calc: PricingCalculation): string {
  const lines = [
    `Transaction Amount: $${calc.transactionAmount.toLocaleString()}`,
    `Tier: ${calc.tier}`,
    ``,
    `Fee Breakdown (Separate Line Items):`,
  ]

  // Show Wells fee with tier-specific description
  let wellsDescription = ''
  switch (calc.tier) {
    case TransactionTier.DEFAULT_ROUTED:
      wellsDescription = 'Default Routed (cost + 0.33%)'
      break
    case TransactionTier.SOURCED_WELLS:
      wellsDescription = 'Sourced by Wells (3.3% of ACV)'
      break
    case TransactionTier.ORIGINATED_WELLS:
      if (calc.useStepDown) {
        wellsDescription = 'Originated by Wells (step-down: 10%/7%/5%)'
      } else {
        wellsDescription = 'Originated by Wells (10% of ACV)'
      }
      break
  }

  lines.push(`  Wells Fee: $${calc.wellsFeeGross.toFixed(2)} (${wellsDescription})`)
  lines.push(`  Tithe (${calc.breakdown.tithePurpose}): $${calc.titheAmount.toFixed(2)}`)
  lines.push(`  Payment Rail (${calc.rail}): $${calc.railCost.toFixed(2)}`)
  lines.push(``)
  lines.push(`Total Customer Charge: $${calc.totalCustomerCharge.toFixed(2)} (${calc.effectiveRate.toFixed(2)}%)`)
  lines.push(`Net to Wells (after tithe): $${calc.wellsFeeNet.toFixed(2)}`)
  lines.push(``)
  lines.push(`Attribution: ${calc.dealSourceTag}`)
  lines.push(`Audit Window: 30 days from ${new Date(calc.attributionTimestamp).toLocaleDateString()}`)

  return lines.join('\n')
}

/**
 * GUARDRAILS: Validate pricing is reasonable and matches contract terms
 */
export function validatePricing(calc: PricingCalculation): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Guardrail 1: Minimum transaction fee ($25)
  if (calc.wellsFeeGross < PRICING_FLOORS.MINIMUM_TRANSACTION_FEE) {
    errors.push(`Wells fee $${calc.wellsFeeGross.toFixed(2)} below minimum $${PRICING_FLOORS.MINIMUM_TRANSACTION_FEE}`)
  }

  // Guardrail 2: Tithe must be exactly 10% of gross Wells fee
  const expectedTithe = calc.wellsFeeGross * TITHE_RATE
  if (Math.abs(calc.titheAmount - expectedTithe) > 0.01) {
    errors.push(`Tithe mismatch: expected $${expectedTithe.toFixed(2)}, got $${calc.titheAmount.toFixed(2)}`)
  }

  // Guardrail 3: Net to Wells cannot be negative
  if (calc.wellsFeeNet < 0) {
    errors.push(`Negative net revenue: $${calc.wellsFeeNet.toFixed(2)}`)
  }

  // Guardrail 4: Validate tier-specific rates
  switch (calc.tier) {
    case TransactionTier.DEFAULT_ROUTED:
      const expectedDefault = calc.transactionAmount * 0.0033
      if (Math.abs(calc.wellsFeeGross - expectedDefault) > 0.01 &&
          calc.wellsFeeGross !== PRICING_FLOORS.MINIMUM_TRANSACTION_FEE) {
        errors.push(`Default routed fee mismatch: expected $${expectedDefault.toFixed(2)}, got $${calc.wellsFeeGross.toFixed(2)}`)
      }
      break

    case TransactionTier.SOURCED_WELLS:
      const expectedSourced = calc.transactionAmount * 0.033
      if (Math.abs(calc.wellsFeeGross - expectedSourced) > 0.01 &&
          calc.wellsFeeGross !== PRICING_FLOORS.MINIMUM_TRANSACTION_FEE) {
        errors.push(`Sourced fee mismatch: expected $${expectedSourced.toFixed(2)}, got $${calc.wellsFeeGross.toFixed(2)}`)
      }
      break

    case TransactionTier.ORIGINATED_WELLS:
      if (!calc.useStepDown) {
        const expectedOriginated = calc.transactionAmount * 0.10
        if (Math.abs(calc.wellsFeeGross - expectedOriginated) > 0.01 &&
            calc.wellsFeeGross !== PRICING_FLOORS.MINIMUM_TRANSACTION_FEE) {
          errors.push(`Originated fee mismatch: expected $${expectedOriginated.toFixed(2)}, got $${calc.wellsFeeGross.toFixed(2)}`)
        }
      }
      break
  }

  // Guardrail 5: Warn on very high effective rates (sanity check)
  if (calc.effectiveRate > 15) {
    warnings.push(`High effective rate: ${calc.effectiveRate.toFixed(2)}%`)
  }

  // Guardrail 6: Warn on step-down usage for small amounts
  if (calc.useStepDown && calc.transactionAmount < ORIGINATED_STEP_DOWN[0].threshold) {
    warnings.push(`Step-down enabled but transaction $${calc.transactionAmount.toLocaleString()} < $1M threshold`)
  }

  // Guardrail 7: Attribution tag required
  if (!calc.dealSourceTag || calc.dealSourceTag.trim() === '') {
    errors.push('Missing deal source attribution tag')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Example usage and testing (matches GPT contract examples)
 */
export function examplePricingScenarios() {
  console.log('=== WELLS ONYX PRICING EXAMPLES (Contract-Compliant) ===\n')

  // GPT Example 1: Default routed $1M
  const scenario1 = calculatePricing(
    1000000,
    TransactionTier.DEFAULT_ROUTED,
    PaymentRail.ACH,
    false,
    'DEAL_001_DEFAULT'
  )
  console.log('Example 1: Default Routed Spend ($1M via ACH)')
  console.log(formatPricingForUser(scenario1))
  console.log('Expected: Wells fee $3,300, Tithe $330, Net $2,970')
  console.log(`Validation:`, validatePricing(scenario1))
  console.log('\n---\n')

  // GPT Example 2: Sourced by Wells $1M ACV
  const scenario2 = calculatePricing(
    1000000,
    TransactionTier.SOURCED_WELLS,
    PaymentRail.ACH,
    false,
    'DEAL_002_SOURCED'
  )
  console.log('Example 2: Sourced by Wells ($1M ACV via ACH)')
  console.log(formatPricingForUser(scenario2))
  console.log('Expected: Wells fee $33,000, Tithe $3,300, Net $29,700')
  console.log(`Validation:`, validatePricing(scenario2))
  console.log('\n---\n')

  // GPT Example 3: Originated by Wells $1M ACV
  const scenario3 = calculatePricing(
    1000000,
    TransactionTier.ORIGINATED_WELLS,
    PaymentRail.ACH,
    false,
    'DEAL_003_ORIGINATED'
  )
  console.log('Example 3: Originated by Wells ($1M ACV via ACH)')
  console.log(formatPricingForUser(scenario3))
  console.log('Expected: Wells fee $100,000, Tithe $10,000, Net $90,000')
  console.log(`Validation:`, validatePricing(scenario3))
  console.log('\n---\n')

  // Scenario 4: Originated with step-down ($5M deal)
  const scenario4 = calculatePricing(
    5000000,
    TransactionTier.ORIGINATED_WELLS,
    PaymentRail.ACH,
    true,  // Enable step-down
    'DEAL_004_WHALE'
  )
  console.log('Example 4: Originated with Step-Down ($5M ACV via ACH)')
  console.log(formatPricingForUser(scenario4))
  console.log('Expected: 10% on $1M + 7% on $4M = $380,000')
  console.log(`Validation:`, validatePricing(scenario4))
  console.log('\n---\n')

  // Scenario 5: Using Grain (future - near-zero rail costs)
  const scenario5 = calculatePricing(
    50000,
    TransactionTier.SOURCED_WELLS,
    PaymentRail.GRAIN,
    false,
    'DEAL_005_GRAIN'
  )
  console.log('Example 5: Sourced via Grain ($50K ACV)')
  console.log(formatPricingForUser(scenario5))
  console.log('Expected: Wells fee only, minimal rail costs')
  console.log(`Validation:`, validatePricing(scenario5))
  console.log('\n---\n')

  // Scenario 6: Small transaction hitting $25 floor
  const scenario6 = calculatePricing(
    500,
    TransactionTier.DEFAULT_ROUTED,
    PaymentRail.STRIPE_CARD,
    false,
    'DEAL_006_SMALL'
  )
  console.log('Example 6: Small Transaction ($500 via Stripe)')
  console.log(formatPricingForUser(scenario6))
  console.log('Expected: $25 minimum fee applied')
  console.log(`Validation:`, validatePricing(scenario6))
  console.log('\n---\n')
}

/**
 * Generate contract-ready fee schedule
 */
export function generateContractFeeSchedule(): string {
  return `
WELLS ONYX FEE SCHEDULE

1. FEE BASIS
   Client agrees to pay Wells fees as follows:

   (a) Default Routed Spend: cost plus 0.33% of routed amounts processed by Wells
   (b) Sourced by Wells: 3.3% of contract ACV (or TCV if <12-month term)
   (c) Originated by Wells: 10% of contract ACV (or TCV if <12-month term)
       - Optional step-down for >$1M: 10% on first $1M, 7% on next $4M, 5% thereafter

2. ATTRIBUTION
   Only one fee category applies per deal, as recorded in the Wells attribution ledger.
   Default unless Deal.Source tag is set to SOURCED_WELLS or ORIGINATED_WELLS.
   Client may audit the attribution ledger within ${PRICING_FLOORS.DISPUTE_WINDOW_DAYS} days of invoice.

3. PAYMENT RAILS
   Card/ACH/Wire payment rail fees are pass-through (separate line item).
   Rail costs are not included in Wells fee percentage calculations.

4. FLOORS & MINIMUMS
   - Monthly platform minimum: $${PRICING_FLOORS.MONTHLY_PLATFORM_MINIMUM.toLocaleString()}/month (offset against earned fees)
   - Minimum transaction fee: $${PRICING_FLOORS.MINIMUM_TRANSACTION_FEE.toLocaleString()}

5. TITHE
   Wells will allocate ${TITHE_RATE * 100}% of gross Wells fees to the Adullam/Legacy fund.
   This appears as a separate line item on invoices.

6. TRANSPARENCY
   All invoices show:
   - Wells Fee (gross)
   - Tithe (Adullam Fund)
   - Payment Rail Cost (pass-through)
   - Deal Attribution Tag
`
}
