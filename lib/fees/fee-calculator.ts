/**
 * Wells Onyx Fee Calculator
 *
 * Success fee calculation for deals completed through the platform.
 * Fee is automatically deducted when escrow is released to seller.
 *
 * Fee Tiers:
 * - Standard (1%): Basic deals, standard service
 * - White Glove (3.3%): Concierge service, complex negotiations
 * - Complex (7.7%): High-touch, strategic deals with full support
 *
 * Minimum fee: $100 on all deals
 */

export type FeeTier = 'standard' | 'white-glove' | 'complex'

export interface FeeCalculation {
  dealAmount: number
  tier: FeeTier
  feePercent: number
  feeAmount: number
  minimumFee: number
  appliedFee: number
  sellerReceives: number
  wellsReceives: number
}

// Fee percentages by tier
const FEE_RATES: Record<FeeTier, number> = {
  'standard': 0.01,      // 1%
  'white-glove': 0.033,  // 3.3%
  'complex': 0.077,      // 7.7%
}

// Minimum fee across all tiers
const MINIMUM_FEE = 100

/**
 * Calculate success fee for a deal
 *
 * @param dealAmount - Total deal amount in dollars
 * @param tier - Fee tier level
 * @returns Detailed fee calculation breakdown
 */
export function calculateFee(
  dealAmount: number,
  tier: FeeTier = 'standard'
): FeeCalculation {
  if (dealAmount < 0) {
    throw new Error('Deal amount must be positive')
  }

  if (!FEE_RATES[tier]) {
    throw new Error(`Invalid fee tier: ${tier}`)
  }

  const feePercent = FEE_RATES[tier]
  const calculatedFee = dealAmount * feePercent

  // Apply minimum fee
  const appliedFee = Math.max(calculatedFee, MINIMUM_FEE)

  // Calculate what seller receives (deal amount minus fee)
  const sellerReceives = dealAmount - appliedFee

  // Wells receives the fee
  const wellsReceives = appliedFee

  return {
    dealAmount,
    tier,
    feePercent: feePercent * 100, // Return as percentage (e.g., 1, 3.3, 7.7)
    feeAmount: calculatedFee,
    minimumFee: MINIMUM_FEE,
    appliedFee: Math.round(appliedFee * 100) / 100, // Round to 2 decimals
    sellerReceives: Math.round(sellerReceives * 100) / 100,
    wellsReceives: Math.round(wellsReceives * 100) / 100,
  }
}

/**
 * Determine fee tier based on deal characteristics
 *
 * @param dealAmount - Deal amount in dollars
 * @param complexity - Deal complexity factors
 * @returns Recommended fee tier
 */
export function recommendFeeTier(
  dealAmount: number,
  complexity?: {
    hasCustomTerms?: boolean
    requiresNegotiation?: boolean
    multiParty?: boolean
    hasMilestones?: boolean
    customDuration?: boolean
  }
): FeeTier {
  // Complex tier criteria
  if (
    complexity?.multiParty ||
    (complexity?.hasCustomTerms && complexity?.requiresNegotiation) ||
    (dealAmount > 1000000 && complexity?.hasMilestones)
  ) {
    return 'complex'
  }

  // White glove tier criteria
  if (
    dealAmount > 100000 ||
    complexity?.requiresNegotiation ||
    complexity?.hasMilestones ||
    complexity?.customDuration
  ) {
    return 'white-glove'
  }

  // Default to standard
  return 'standard'
}

/**
 * Calculate fee split for escrow release
 * Returns the amounts for the seller and Wells treasury
 *
 * @param dealAmount - Total amount in escrow
 * @param tier - Fee tier
 * @returns Split breakdown for escrow release
 */
export function calculateEscrowSplit(
  dealAmount: number,
  tier: FeeTier = 'standard'
): {
  totalAmount: number
  feeAmount: number
  sellerAmount: number
  wellsTreasuryWallet?: string
} {
  const calculation = calculateFee(dealAmount, tier)

  return {
    totalAmount: dealAmount,
    feeAmount: calculation.appliedFee,
    sellerAmount: calculation.sellerReceives,
    wellsTreasuryWallet: process.env.WELLS_TREASURY_WALLET_ADDRESS,
  }
}

/**
 * Validate fee calculation
 */
export function validateFeeCalculation(calculation: FeeCalculation): boolean {
  // Verify math adds up
  const total = calculation.sellerReceives + calculation.appliedFee
  const matches = Math.abs(total - calculation.dealAmount) < 0.01 // Allow for rounding

  // Verify minimum fee is applied
  const hasMinimum = calculation.appliedFee >= MINIMUM_FEE

  // Verify fee percentage is correct
  const correctRate = FEE_RATES[calculation.tier] * 100 === calculation.feePercent

  return matches && hasMinimum && correctRate
}

/**
 * Format fee calculation for display
 */
export function formatFeeDisplay(calculation: FeeCalculation): string {
  return `
Deal Amount: $${calculation.dealAmount.toLocaleString()}
Fee Tier: ${calculation.tier}
Fee Rate: ${calculation.feePercent}%
Calculated Fee: $${calculation.feeAmount.toLocaleString()}
Applied Fee: $${calculation.appliedFee.toLocaleString()} (minimum: $${calculation.minimumFee})

Seller Receives: $${calculation.sellerReceives.toLocaleString()}
Wells Receives: $${calculation.wellsReceives.toLocaleString()}
  `.trim()
}

export const FeeCalculator = {
  calculateFee,
  recommendFeeTier,
  calculateEscrowSplit,
  validateFeeCalculation,
  formatFeeDisplay,
  FEE_RATES,
  MINIMUM_FEE,
}

export default FeeCalculator
