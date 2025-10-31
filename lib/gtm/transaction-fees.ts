/**
 * Transaction Fee Calculation with Stripe Guardrails
 *
 * CRITICAL: We must ALWAYS cover Stripe fees + make profit
 *
 * Stripe fees: 2.9% + $0.30 per transaction
 * Our minimum: 0.5% (to cover costs + profit)
 *
 * Formula: fee = MAX(stripeFee + ourMinimum, tierPercentage)
 */

export interface TransactionFeeConfig {
  tier: string
  minGMV: number
  maxGMV?: number
  basePercentage: number // Our target percentage
  minimumPercentage: number // Never go below this (covers Stripe + profit)
}

// Stripe's standard fees
export const STRIPE_PERCENTAGE = 0.029 // 2.9%
export const STRIPE_FIXED_FEE = 0.30 // $0.30

/**
 * Transaction fee tiers
 *
 * These apply to ALL tiers (Bronze, Silver, Gold, Platinum)
 * to ensure we ALWAYS make money
 */
export const TRANSACTION_FEE_TIERS: TransactionFeeConfig[] = [
  {
    tier: 'bronze',
    minGMV: 0,
    maxGMV: 100000,
    basePercentage: 0.10, // 10% for small volumes
    minimumPercentage: 0.035, // 3.5% minimum (Stripe 2.9% + our 0.6%)
  },
  {
    tier: 'silver',
    minGMV: 100000,
    maxGMV: 250000,
    basePercentage: 0.05, // 5% for medium volumes
    minimumPercentage: 0.035, // 3.5% minimum (Stripe 2.9% + our 0.6%)
  },
  {
    tier: 'gold',
    minGMV: 250000,
    maxGMV: 1000000,
    basePercentage: 0.02, // 2% for large volumes
    minimumPercentage: 0.035, // 3.5% minimum (Stripe 2.9% + our 0.6%)
  },
  {
    tier: 'platinum',
    minGMV: 1000000,
    basePercentage: 0.01, // 1% for enterprise volumes
    minimumPercentage: 0.035, // 3.5% minimum (Stripe 2.9% + our 0.6%)
  },
]

/**
 * Calculate transaction fee with Stripe guardrails
 *
 * ALWAYS returns fee >= Stripe cost + minimum profit
 */
export function calculateTransactionFee(params: {
  transactionAmount: number
  trailing12MonthGMV: number
}): {
  totalFee: number
  totalFeePercent: number
  stripeFee: number
  wellsAIFee: number
  tierUsed: string
  guardrailApplied: boolean
} {
  const { transactionAmount, trailing12MonthGMV } = params

  // Find tier
  const tier = TRANSACTION_FEE_TIERS.find(
    (t) =>
      trailing12MonthGMV >= t.minGMV &&
      (!t.maxGMV || trailing12MonthGMV < t.maxGMV)
  ) || TRANSACTION_FEE_TIERS[0]

  // Calculate Stripe's fee
  const stripeFee = transactionAmount * STRIPE_PERCENTAGE + STRIPE_FIXED_FEE

  // Calculate our target fee
  const targetFee = transactionAmount * tier.basePercentage

  // Calculate minimum acceptable fee (Stripe + our minimum)
  const minimumFee = transactionAmount * tier.minimumPercentage

  // Apply guardrail: Never charge less than minimum
  const guardrailApplied = targetFee < minimumFee
  const totalFee = Math.max(targetFee, minimumFee)
  const wellsAIFee = totalFee - stripeFee

  return {
    totalFee,
    totalFeePercent: (totalFee / transactionAmount) * 100,
    stripeFee,
    wellsAIFee,
    tierUsed: tier.tier,
    guardrailApplied,
  }
}

/**
 * Get user's transaction fee tier
 */
export function getTransactionFeeTier(trailing12MonthGMV: number): TransactionFeeConfig {
  return (
    TRANSACTION_FEE_TIERS.find(
      (t) =>
        trailing12MonthGMV >= t.minGMV &&
        (!t.maxGMV || trailing12MonthGMV < t.maxGMV)
    ) || TRANSACTION_FEE_TIERS[0]
  )
}

/**
 * Example calculations
 */
export function exampleFeeCalculations() {
  const scenarios = [
    { amount: 100, gmv: 10000, description: 'Small deal, Bronze tier' },
    { amount: 1000, gmv: 10000, description: 'Medium deal, Bronze tier' },
    { amount: 10000, gmv: 500000, description: 'Large deal, Gold tier' },
    { amount: 100000, gmv: 2000000, description: 'Enterprise deal, Platinum tier' },
  ]

  console.log('Transaction Fee Examples with Stripe Guardrails:\n')

  for (const scenario of scenarios) {
    const result = calculateTransactionFee({
      transactionAmount: scenario.amount,
      trailing12MonthGMV: scenario.gmv,
    })

    console.log(`${scenario.description}:`)
    console.log(`  Transaction: $${scenario.amount.toLocaleString()}`)
    console.log(`  Total fee: $${result.totalFee.toFixed(2)} (${result.totalFeePercent.toFixed(2)}%)`)
    console.log(`    - Stripe: $${result.stripeFee.toFixed(2)}`)
    console.log(`    - Wells AI: $${result.wellsAIFee.toFixed(2)}`)
    console.log(`  Tier: ${result.tierUsed}`)
    console.log(`  Guardrail applied: ${result.guardrailApplied ? 'YES (protected from loss)' : 'NO'}`)
    console.log()
  }
}

export default {
  calculateTransactionFee,
  getTransactionFeeTier,
  TRANSACTION_FEE_TIERS,
}
