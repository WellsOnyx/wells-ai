/**
 * Grain & Vault Fee Calculator
 *
 * Core calculation engine for Wells AI pricing.
 * Handles fee calculation, savings analysis, and GRAIN price tracking.
 */

import {
  DealType,
  PaymentRail,
  DealContext,
  FeeBreakdown,
  SavingsCalculation,
  GrainPriceInfo,
  WalletStatus
} from './types'
import {
  FEE_RATES,
  RAIL_COSTS,
  PRICING_GUARDRAILS,
  TITHE_CONFIG,
  IN_NETWORK_REQUIREMENTS,
  SOURCED_REQUIREMENTS,
  ORIGINATED_REQUIREMENTS,
  TREASURY_CONFIG,
  FEATURE_FLAGS
} from './config'

/**
 * Calculate fee for a transaction
 *
 * This is the core pricing function.
 * It takes a deal amount, type, and rail, and returns a complete fee breakdown.
 *
 * @param amount - Transaction amount in USD cents
 * @param dealType - Type of deal (in_network, sourced, originated)
 * @param rail - Payment rail to use
 * @param dealSourceTag - Attribution tag for auditing
 * @returns Complete fee breakdown with all line items
 */
export function calculateFee(
  amount: number,
  dealType: DealType,
  rail: PaymentRail,
  dealSourceTag?: string
): FeeBreakdown {
  // 1. Calculate Wells fee (gross, before tithe)
  const wellsFeePercentage = FEE_RATES[dealType]
  let wellsFeeGross = Math.round(amount * wellsFeePercentage)

  // Apply minimum fee floor
  if (wellsFeeGross < PRICING_GUARDRAILS.MINIMUM_TRANSACTION_FEE) {
    wellsFeeGross = PRICING_GUARDRAILS.MINIMUM_TRANSACTION_FEE
  }

  // 2. Calculate tithe (10% of gross Wells fee)
  const titheAmount = Math.round(wellsFeeGross * TITHE_CONFIG.RATE)

  // 3. Net to Wells after tithe
  const wellsFeeNet = wellsFeeGross - titheAmount

  // 4. Calculate payment rail costs (pass-through)
  const railConfig = RAIL_COSTS[rail]
  let railCost = Math.round(
    amount * railConfig.percentageFee + railConfig.fixedFee * 100
  )

  // Apply min/max caps for rail costs
  if (railConfig.minFee) {
    railCost = Math.max(railCost, Math.round(railConfig.minFee * 100))
  }
  if (railConfig.maxFee) {
    railCost = Math.min(railCost, Math.round(railConfig.maxFee * 100))
  }

  // 5. Total customer charge
  const totalCharge = wellsFeeGross + railCost

  // 6. Effective rate
  const effectiveRate = (totalCharge / amount) * 100

  // 7. Build line items for transparency
  const lineItems = [
    {
      description: `Wells Fee (${getDealTypeDescription(dealType)})`,
      amount: wellsFeeGross,
      percentage: wellsFeePercentage * 100
    },
    {
      description: `Tithe (${TITHE_CONFIG.DESTINATION})`,
      amount: titheAmount,
      percentage: TITHE_CONFIG.RATE * 100
    },
    {
      description: `Payment Rail (${rail.toUpperCase()})`,
      amount: railCost,
      percentage: railConfig.percentageFee * 100
    }
  ]

  return {
    transactionAmount: amount,
    dealType,
    rail,
    wellsFeeGross,
    wellsFeePercentage: wellsFeePercentage * 100,
    titheAmount,
    tithePurpose: TITHE_CONFIG.DESTINATION,
    wellsFeeNet,
    railCost,
    totalCharge,
    effectiveRate,
    lineItems,
    attribution: {
      dealSourceTag: dealSourceTag || `AUTO_${Date.now()}`,
      timestamp: new Date().toISOString(),
      disputeWindowDays: PRICING_GUARDRAILS.DISPUTE_WINDOW_DAYS
    }
  }
}

/**
 * Infer deal type from context
 *
 * Automatically determines the appropriate fee tier based on:
 * - Wallet status (both parties)
 * - Verification status
 * - Platform matching
 * - Wells negotiation involvement
 *
 * @param context - Deal context with all relevant information
 * @returns Inferred deal type
 */
export function inferDealType(context: DealContext): DealType {
  // Check if in-network pricing applies (most restrictive)
  if (FEATURE_FLAGS.IN_NETWORK_ENABLED && isInNetwork(context)) {
    return DealType.IN_NETWORK
  }

  // Check if originated pricing applies
  if (isOriginated(context)) {
    return DealType.ORIGINATED
  }

  // Check if sourced pricing applies
  if (isSourced(context)) {
    return DealType.SOURCED
  }

  // Default to originated (most conservative)
  return DealType.ORIGINATED
}

/**
 * Check if deal qualifies for in-network pricing (0.33%)
 */
function isInNetwork(context: DealContext): boolean {
  const { buyer, seller } = context

  // Both must have wallets
  if (!buyer.wallet || !seller.wallet) {
    return false
  }

  // Both must be verified
  if (!buyer.wallet.isVerified || !seller.wallet.isVerified) {
    return false
  }

  // Both must have minimum GRAIN balance
  if (
    buyer.wallet.grainBalance < IN_NETWORK_REQUIREMENTS.MIN_GRAIN_BALANCE ||
    seller.wallet.grainBalance < IN_NETWORK_REQUIREMENTS.MIN_GRAIN_BALANCE
  ) {
    return false
  }

  // All checks passed
  return true
}

/**
 * Check if deal qualifies for sourced pricing (3.3%)
 */
function isSourced(context: DealContext): boolean {
  // Must be platform matched
  if (!context.platformMatched) {
    return false
  }

  // Must have minimum match score
  if (
    !context.matchScore ||
    context.matchScore < SOURCED_REQUIREMENTS.MIN_MATCH_SCORE
  ) {
    return false
  }

  // Must NOT be Wells negotiated (that would be originated)
  if (context.wellsNegotiated) {
    return false
  }

  return true
}

/**
 * Check if deal qualifies for originated pricing (7%)
 */
function isOriginated(context: DealContext): boolean {
  // Must be Wells negotiated
  if (!context.wellsNegotiated) {
    return false
  }

  // Must meet minimum deal size
  if (context.amount < ORIGINATED_REQUIREMENTS.MIN_DEAL_SIZE) {
    return false
  }

  // Must have source tag (RFQ or GTM campaign)
  if (!context.rfqId && !context.gtmCampaignId && !context.dealSourceTag) {
    return false
  }

  return true
}

/**
 * Calculate savings if deal went in-network
 *
 * Shows users how much they'd save by getting GRAIN wallets + verification.
 * This is powerful marketing for driving wallet adoption.
 *
 * @param amount - Transaction amount in cents
 * @param currentDealType - Current deal type
 * @param rail - Payment rail
 * @returns Savings calculation with requirements
 */
export function calculateSavings(
  amount: number,
  currentDealType: DealType,
  rail: PaymentRail,
  context?: Partial<DealContext>
): SavingsCalculation {
  // Calculate current fee
  const currentFee = calculateFee(amount, currentDealType, rail)

  // Calculate in-network fee
  const inNetworkFee = calculateFee(amount, DealType.IN_NETWORK, rail)

  // Calculate savings
  const savingsAmount = currentFee.totalCharge - inNetworkFee.totalCharge
  const savingsPercentage =
    (savingsAmount / currentFee.totalCharge) * 100

  // Determine requirements based on context
  const requirements = getInNetworkRequirements(context)

  // Build call to action
  const callToAction = buildInNetworkCTA(
    requirements,
    savingsAmount,
    currentDealType
  )

  return {
    currentDealType,
    currentFee: currentFee.totalCharge,
    inNetworkFee: inNetworkFee.totalCharge,
    savingsAmount,
    savingsPercentage,
    requirements,
    callToAction
  }
}

/**
 * Get requirements for in-network pricing
 */
function getInNetworkRequirements(
  context?: Partial<DealContext>
): string[] {
  const requirements: string[] = []

  if (!context) {
    return [
      'Create GRAIN wallet for buyer',
      'Create GRAIN wallet for seller',
      'Complete KYB verification for buyer',
      'Complete KYB verification for seller',
      `Fund wallets with minimum $${IN_NETWORK_REQUIREMENTS.MIN_GRAIN_BALANCE / 100} GRAIN`
    ]
  }

  // Check buyer wallet
  if (!context.buyer?.wallet) {
    requirements.push('Create GRAIN wallet for buyer')
  } else if (!context.buyer.wallet.isVerified) {
    requirements.push('Complete KYB verification for buyer')
  } else if (
    context.buyer.wallet.grainBalance < IN_NETWORK_REQUIREMENTS.MIN_GRAIN_BALANCE
  ) {
    requirements.push(
      `Fund buyer wallet with $${(IN_NETWORK_REQUIREMENTS.MIN_GRAIN_BALANCE - context.buyer.wallet.grainBalance) / 100} GRAIN`
    )
  }

  // Check seller wallet
  if (!context.seller?.wallet) {
    requirements.push('Create GRAIN wallet for seller')
  } else if (!context.seller.wallet.isVerified) {
    requirements.push('Complete KYB verification for seller')
  } else if (
    context.seller.wallet.grainBalance < IN_NETWORK_REQUIREMENTS.MIN_GRAIN_BALANCE
  ) {
    requirements.push(
      `Fund seller wallet with $${(IN_NETWORK_REQUIREMENTS.MIN_GRAIN_BALANCE - context.seller.wallet.grainBalance) / 100} GRAIN`
    )
  }

  return requirements
}

/**
 * Build call to action for in-network savings
 */
function buildInNetworkCTA(
  requirements: string[],
  savingsAmount: number,
  currentDealType: DealType
): string {
  const savingsDisplay = `$${(savingsAmount / 100).toFixed(2)}`

  if (requirements.length === 0) {
    return `You're already in-network! Enjoying the lowest fees.`
  }

  if (currentDealType === DealType.ORIGINATED) {
    return `Save ${savingsDisplay} on this transaction by going in-network. Complete ${requirements.length} step${requirements.length > 1 ? 's' : ''} to unlock 0.33% pricing.`
  }

  if (currentDealType === DealType.SOURCED) {
    return `Save ${savingsDisplay} on this transaction by going in-network. Complete ${requirements.length} step${requirements.length > 1 ? 's' : ''} to unlock 0.33% pricing.`
  }

  return `Create GRAIN wallets to unlock the lowest fees on Wells AI.`
}

/**
 * Calculate GRAIN price (APPRECIATION MODEL)
 *
 * GRAIN price is backed by treasury value, not pegged to $1.
 * Formula: GRAIN price = Total Treasury Value / Total GRAIN Supply
 *
 * As the treasury grows from:
 * - Circle Yield (4.5% APY on float)
 * - Net fee revenue (after 10% tithe)
 * - Optional: LP fees, RWA yields, etc.
 *
 * ...the GRAIN token appreciates proportionally.
 *
 * NO DISTRIBUTIONS to holders - all yield accrues to treasury.
 * Holders benefit through token price appreciation.
 *
 * @returns Current GRAIN price info
 */
export async function calculateGrainPrice(): Promise<GrainPriceInfo> {
  // TODO: Replace with actual on-chain data when smart contracts deployed
  // For now, return mock data showing appreciation model

  const totalSupply = TREASURY_CONFIG.INITIAL_GRAIN_SUPPLY // 1M GRAIN (fixed supply)
  const totalCollateral = 1100000000 // 1.1M USDC in vault (grows over time)
  const collateralizationRatio = totalCollateral / totalSupply

  // GRAIN price = treasury value / total supply
  // This appreciates as treasury grows
  const priceUSD = totalCollateral / totalSupply / 100 // Convert cents to dollars

  return {
    priceUSD, // Starts at ~1.10, grows over time (not pegged!)
    treasuryAPY: TREASURY_CONFIG.TARGET_APY, // 10% target (accrues to treasury, not distributed)
    totalSupply,
    totalCollateral,
    collateralizationRatio,
    updatedAt: new Date().toISOString()
  }
}

/**
 * Get deal type description for display
 */
function getDealTypeDescription(dealType: DealType): string {
  switch (dealType) {
    case DealType.IN_NETWORK:
      return '0.33% - Both parties in network'
    case DealType.SOURCED:
      return '3.3% - Platform matched'
    case DealType.ORIGINATED:
      return '7% - Wells originated'
    default:
      return 'Unknown'
  }
}

/**
 * Format fee breakdown for user display
 *
 * Returns a human-readable string with all fee details.
 */
export function formatFeeBreakdown(breakdown: FeeBreakdown): string {
  const lines = [
    `Transaction Amount: $${(breakdown.transactionAmount / 100).toFixed(2)}`,
    ``,
    `Fee Breakdown:`,
    ...breakdown.lineItems.map(
      (item) =>
        `  ${item.description}: $${(item.amount / 100).toFixed(2)}${item.percentage ? ` (${item.percentage.toFixed(2)}%)` : ''}`
    ),
    ``,
    `Total Charge: $${(breakdown.totalCharge / 100).toFixed(2)} (${breakdown.effectiveRate.toFixed(2)}%)`,
    `Net to Wells: $${(breakdown.wellsFeeNet / 100).toFixed(2)}`,
    ``,
    `Attribution: ${breakdown.attribution.dealSourceTag}`,
    `Dispute Window: ${breakdown.attribution.disputeWindowDays} days`
  ]

  return lines.join('\n')
}

/**
 * Estimate monthly fees based on volume
 *
 * Helps customers understand total cost of ownership.
 */
export function estimateMonthlyFees(
  monthlyVolume: number,
  dealType: DealType,
  rail: PaymentRail,
  transactionCount: number
): {
  totalFees: number
  averageFeePerTransaction: number
  effectiveRate: number
  breakdown: FeeBreakdown
} {
  // Calculate average transaction size
  const avgTransactionSize = Math.round(monthlyVolume / transactionCount)

  // Calculate fee for average transaction
  const breakdown = calculateFee(avgTransactionSize, dealType, rail)

  // Scale to monthly volume
  const totalFees = breakdown.totalCharge * transactionCount

  return {
    totalFees,
    averageFeePerTransaction: breakdown.totalCharge,
    effectiveRate: breakdown.effectiveRate,
    breakdown
  }
}
