/**
 * Grain & Vault Pricing Validation
 *
 * Validates all pricing calculations against guardrails and requirements.
 * Prevents edge cases and ensures pricing integrity.
 */

import {
  DealType,
  DealContext,
  FeeBreakdown,
  WalletStatus
} from './types'
import {
  FEE_RATES,
  PRICING_GUARDRAILS,
  TITHE_CONFIG,
  IN_NETWORK_REQUIREMENTS,
  SOURCED_REQUIREMENTS,
  ORIGINATED_REQUIREMENTS
} from './config'

/**
 * Validation Result
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate pricing calculation
 *
 * Ensures all fees are calculated correctly and meet guardrails.
 *
 * @param breakdown - Fee breakdown to validate
 * @returns Validation result with errors and warnings
 */
export function validatePricing(breakdown: FeeBreakdown): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Guardrail 1: Minimum transaction fee
  if (breakdown.wellsFeeGross < PRICING_GUARDRAILS.MINIMUM_TRANSACTION_FEE) {
    errors.push(
      `Wells fee $${(breakdown.wellsFeeGross / 100).toFixed(2)} below minimum $${(PRICING_GUARDRAILS.MINIMUM_TRANSACTION_FEE / 100).toFixed(2)}`
    )
  }

  // Guardrail 2: Tithe must be exactly 10% of gross Wells fee
  const expectedTithe = Math.round(breakdown.wellsFeeGross * TITHE_CONFIG.RATE)
  if (Math.abs(breakdown.titheAmount - expectedTithe) > 1) {
    // Allow 1 cent rounding error
    errors.push(
      `Tithe mismatch: expected $${(expectedTithe / 100).toFixed(2)}, got $${(breakdown.titheAmount / 100).toFixed(2)}`
    )
  }

  // Guardrail 3: Net to Wells cannot be negative
  if (breakdown.wellsFeeNet < 0) {
    errors.push(
      `Negative net revenue: $${(breakdown.wellsFeeNet / 100).toFixed(2)}`
    )
  }

  // Guardrail 4: Validate tier-specific rates
  const expectedFeeRate = FEE_RATES[breakdown.dealType]
  const expectedFee = Math.max(
    Math.round(breakdown.transactionAmount * expectedFeeRate),
    PRICING_GUARDRAILS.MINIMUM_TRANSACTION_FEE
  )

  if (Math.abs(breakdown.wellsFeeGross - expectedFee) > 1) {
    // Allow 1 cent rounding error
    errors.push(
      `Fee mismatch for ${breakdown.dealType}: expected $${(expectedFee / 100).toFixed(2)}, got $${(breakdown.wellsFeeGross / 100).toFixed(2)}`
    )
  }

  // Guardrail 5: Effective rate sanity check
  if (breakdown.effectiveRate > PRICING_GUARDRAILS.MAX_EFFECTIVE_RATE * 100) {
    warnings.push(
      `High effective rate: ${breakdown.effectiveRate.toFixed(2)}% (max expected: ${(PRICING_GUARDRAILS.MAX_EFFECTIVE_RATE * 100).toFixed(2)}%)`
    )
  }

  // Guardrail 6: Attribution tag required
  if (
    !breakdown.attribution.dealSourceTag ||
    breakdown.attribution.dealSourceTag.trim() === ''
  ) {
    errors.push('Missing deal source attribution tag')
  }

  // Guardrail 7: Transaction amount must be positive
  if (breakdown.transactionAmount <= 0) {
    errors.push('Transaction amount must be positive')
  }

  // Guardrail 8: Total charge should equal sum of components
  const expectedTotal = breakdown.wellsFeeGross + breakdown.railCost
  if (Math.abs(breakdown.totalCharge - expectedTotal) > 1) {
    errors.push(
      `Total charge mismatch: expected $${(expectedTotal / 100).toFixed(2)}, got $${(breakdown.totalCharge / 100).toFixed(2)}`
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate in-network requirements
 *
 * Checks if both parties meet all requirements for in-network pricing.
 *
 * @param context - Deal context to validate
 * @returns Validation result
 */
export function validateInNetworkRequirements(
  context: DealContext
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Requirement 1: Both parties must have wallets
  if (!context.buyer.wallet) {
    errors.push('Buyer does not have a GRAIN wallet')
  }
  if (!context.seller.wallet) {
    errors.push('Seller does not have a GRAIN wallet')
  }

  // If no wallets, can't check further requirements
  if (!context.buyer.wallet || !context.seller.wallet) {
    return { valid: false, errors, warnings }
  }

  // Requirement 2: Both parties must be verified
  if (!context.buyer.wallet.isVerified) {
    errors.push('Buyer wallet is not verified (KYB required)')
  }
  if (!context.seller.wallet.isVerified) {
    errors.push('Seller wallet is not verified (KYB required)')
  }

  // Requirement 3: Minimum GRAIN balance
  if (
    context.buyer.wallet.grainBalance < IN_NETWORK_REQUIREMENTS.MIN_GRAIN_BALANCE
  ) {
    errors.push(
      `Buyer GRAIN balance $${(context.buyer.wallet.grainBalance / 100).toFixed(2)} below minimum $${(IN_NETWORK_REQUIREMENTS.MIN_GRAIN_BALANCE / 100).toFixed(2)}`
    )
  }
  if (
    context.seller.wallet.grainBalance < IN_NETWORK_REQUIREMENTS.MIN_GRAIN_BALANCE
  ) {
    errors.push(
      `Seller GRAIN balance $${(context.seller.wallet.grainBalance / 100).toFixed(2)} below minimum $${(IN_NETWORK_REQUIREMENTS.MIN_GRAIN_BALANCE / 100).toFixed(2)}`
    )
  }

  // Warning: Low balances
  if (context.buyer.wallet.grainBalance < 50000) {
    // Less than $500
    warnings.push('Buyer GRAIN balance is low (< $500)')
  }
  if (context.seller.wallet.grainBalance < 50000) {
    warnings.push('Seller GRAIN balance is low (< $500)')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate sourced requirements
 *
 * Checks if deal meets requirements for sourced pricing.
 *
 * @param context - Deal context to validate
 * @returns Validation result
 */
export function validateSourcedRequirements(
  context: DealContext
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Requirement 1: Must be platform matched
  if (!context.platformMatched) {
    errors.push('Deal was not matched by Wells platform')
  }

  // Requirement 2: Minimum match score
  if (!context.matchScore) {
    errors.push('Missing match score')
  } else if (context.matchScore < SOURCED_REQUIREMENTS.MIN_MATCH_SCORE) {
    errors.push(
      `Match score ${context.matchScore} below minimum ${SOURCED_REQUIREMENTS.MIN_MATCH_SCORE}`
    )
  } else if (context.matchScore < 80) {
    warnings.push(`Match score ${context.matchScore} is below 80 (marginal)`)
  }

  // Requirement 3: Must NOT be Wells negotiated (that's originated tier)
  if (context.wellsNegotiated) {
    errors.push(
      'Deal was Wells negotiated - should use ORIGINATED tier instead'
    )
  }

  // Requirement 4: Should have GTM campaign or RFQ
  if (!context.gtmCampaignId && !context.rfqId) {
    warnings.push('No GTM campaign or RFQ ID - attribution may be unclear')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate originated requirements
 *
 * Checks if deal meets requirements for originated pricing.
 *
 * @param context - Deal context to validate
 * @returns Validation result
 */
export function validateOriginatedRequirements(
  context: DealContext
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Requirement 1: Must be Wells negotiated
  if (!context.wellsNegotiated) {
    errors.push('Deal was not Wells negotiated')
  }

  // Requirement 2: Minimum deal size
  if (context.amount < ORIGINATED_REQUIREMENTS.MIN_DEAL_SIZE) {
    errors.push(
      `Deal amount $${(context.amount / 100).toFixed(2)} below minimum $${(ORIGINATED_REQUIREMENTS.MIN_DEAL_SIZE / 100).toFixed(2)}`
    )
  }

  // Requirement 3: Must have source tag
  if (!context.rfqId && !context.gtmCampaignId && !context.dealSourceTag) {
    errors.push('Missing source tag (RFQ ID, GTM campaign ID, or deal source)')
  }

  // Warning: Very large deals
  if (context.amount > 100000000) {
    // > $1M
    warnings.push(
      'Large deal (>$1M) - consider offering step-down pricing'
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate deal type selection
 *
 * Ensures the chosen deal type is appropriate for the context.
 *
 * @param dealType - Chosen deal type
 * @param context - Deal context
 * @returns Validation result
 */
export function validateDealType(
  dealType: DealType,
  context: DealContext
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  switch (dealType) {
    case DealType.IN_NETWORK:
      const inNetworkValidation = validateInNetworkRequirements(context)
      errors.push(...inNetworkValidation.errors)
      warnings.push(...inNetworkValidation.warnings)
      break

    case DealType.SOURCED:
      const sourcedValidation = validateSourcedRequirements(context)
      errors.push(...sourcedValidation.errors)
      warnings.push(...sourcedValidation.warnings)
      break

    case DealType.ORIGINATED:
      const originatedValidation = validateOriginatedRequirements(context)
      errors.push(...originatedValidation.errors)
      warnings.push(...originatedValidation.warnings)
      break
  }

  // Check for potential upsell opportunities
  if (dealType === DealType.ORIGINATED && context.platformMatched) {
    warnings.push(
      'Deal was platform matched - could potentially use SOURCED tier (3.3%) instead of ORIGINATED (7%)'
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate wallet status
 *
 * Ensures wallet is in good standing.
 *
 * @param wallet - Wallet to validate
 * @returns Validation result
 */
export function validateWallet(wallet: WalletStatus): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check wallet address
  if (!wallet.address || wallet.address.trim() === '') {
    errors.push('Missing wallet address')
  } else if (!wallet.address.startsWith('0x')) {
    errors.push('Invalid wallet address format')
  }

  // Check verification
  if (!wallet.isVerified) {
    warnings.push('Wallet is not verified (KYB required for in-network)')
  }

  // Check balances
  if (wallet.grainBalance < 0) {
    errors.push('Negative GRAIN balance')
  }
  if (wallet.usdcBalance < 0) {
    errors.push('Negative USDC balance')
  }

  // Check credit line
  if (wallet.creditLineUsed > wallet.creditLineAvailable) {
    errors.push('Credit line overdrawn')
  }
  if (wallet.creditLineUsed < 0) {
    errors.push('Negative credit line usage')
  }

  // Warnings for low balances
  if (wallet.grainBalance === 0 && wallet.usdcBalance === 0) {
    warnings.push('Wallet has no funds')
  } else if (wallet.grainBalance < 1000) {
    // Less than $10
    warnings.push('Low GRAIN balance (< $10)')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate monthly minimum
 *
 * Checks if customer is meeting monthly platform minimum.
 *
 * @param monthlyFees - Total fees paid this month (cents)
 * @returns Validation result
 */
export function validateMonthlyMinimum(monthlyFees: number): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const minimumRequired = PRICING_GUARDRAILS.MONTHLY_PLATFORM_MINIMUM

  if (monthlyFees < minimumRequired) {
    const shortfall = minimumRequired - monthlyFees
    warnings.push(
      `Monthly fees $${(monthlyFees / 100).toFixed(2)} below minimum $${(minimumRequired / 100).toFixed(2)} - shortfall of $${(shortfall / 100).toFixed(2)} will be charged`
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Format validation result for display
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = []

  if (result.valid) {
    lines.push('Validation: PASSED')
  } else {
    lines.push('Validation: FAILED')
  }

  if (result.errors.length > 0) {
    lines.push('')
    lines.push('Errors:')
    result.errors.forEach((error) => lines.push(`  - ${error}`))
  }

  if (result.warnings.length > 0) {
    lines.push('')
    lines.push('Warnings:')
    result.warnings.forEach((warning) => lines.push(`  - ${warning}`))
  }

  return lines.join('\n')
}
