/**
 * Wells AI Settlement Layer - Fee Calculator
 *
 * Calculates fees with proper currency precision.
 * Stores both raw and rounded values for audit.
 */

import {
  Currency,
  CURRENCY_PRECISION,
  DEFAULT_FEE_BPS,
  FeePayer
} from './types'

export interface FeeCalculation {
  gross_amount: number
  fee_bps: number
  raw_fee: number           // Unrounded for audit trail
  rounded_fee: number       // What we actually capture
  net_amount: number        // What seller receives
  currency: Currency
}

/**
 * Calculate fee with currency-specific precision
 *
 * Formula: fee = round(gross_amount * fee_bps / 10000, currency_precision)
 *
 * @param grossAmount - Total transaction amount in smallest currency unit (cents)
 * @param feeBps - Fee in basis points (default 33 = 0.33%)
 * @param currency - Currency for precision rules
 * @returns FeeCalculation with raw and rounded values
 */
export function calculateFee(
  grossAmount: number,
  feeBps: number = DEFAULT_FEE_BPS,
  currency: Currency = 'USD'
): FeeCalculation {
  // Validate inputs
  if (grossAmount < 0) {
    throw new Error('Gross amount cannot be negative')
  }

  if (feeBps < 0 || feeBps > 10000) {
    throw new Error('Fee basis points must be between 0 and 10000')
  }

  // Raw fee calculation (may have fractional cents)
  const rawFee = (grossAmount * feeBps) / 10000

  // Get currency precision
  const precision = CURRENCY_PRECISION[currency] || 2

  // Round to currency precision
  // For amounts in cents (precision 2), we round to nearest cent
  const roundedFee = Math.round(rawFee)

  // Net amount is what seller receives
  const netAmount = grossAmount - roundedFee

  return {
    gross_amount: grossAmount,
    fee_bps: feeBps,
    raw_fee: rawFee,
    rounded_fee: roundedFee,
    net_amount: netAmount,
    currency
  }
}

/**
 * Calculate fee for split payment (buyer and seller each pay half)
 */
export function calculateSplitFee(
  grossAmount: number,
  feeBps: number = DEFAULT_FEE_BPS,
  currency: Currency = 'USD'
): {
  buyer_fee: number
  seller_fee: number
  total_fee: number
  net_to_seller: number
  total_from_buyer: number
} {
  const { rounded_fee: totalFee, net_amount } = calculateFee(
    grossAmount,
    feeBps,
    currency
  )

  // Split fee evenly, give odd cent to seller side
  const buyerFee = Math.floor(totalFee / 2)
  const sellerFee = totalFee - buyerFee

  return {
    buyer_fee: buyerFee,
    seller_fee: sellerFee,
    total_fee: totalFee,
    net_to_seller: grossAmount - sellerFee,
    total_from_buyer: grossAmount + buyerFee
  }
}

/**
 * Calculate refund amounts including proportional fee reversal
 *
 * @param originalIntent - The original settlement intent
 * @param refundAmount - Amount to refund (or full if not specified)
 * @param reverseFee - Whether to reverse the fee proportionally
 */
export function calculateRefund(
  originalGross: number,
  originalFee: number,
  refundAmount?: number,
  reverseFee: boolean = true
): {
  refund_to_buyer: number
  fee_to_reverse: number
  refund_from_seller: number
  is_full_refund: boolean
} {
  // If no amount specified, refund full amount
  const actualRefund = refundAmount ?? originalGross

  if (actualRefund > originalGross) {
    throw new Error('Refund amount cannot exceed original gross amount')
  }

  const isFullRefund = actualRefund === originalGross

  if (!reverseFee) {
    // No fee reversal - seller bears the original fee
    return {
      refund_to_buyer: actualRefund,
      fee_to_reverse: 0,
      refund_from_seller: actualRefund,
      is_full_refund: isFullRefund
    }
  }

  // Calculate proportional fee reversal
  const refundRatio = actualRefund / originalGross
  const feeToReverse = Math.round(originalFee * refundRatio)

  // Refund to buyer = refund amount
  // Fee to reverse = proportional fee
  // Refund from seller = refund amount - fee reversal
  return {
    refund_to_buyer: actualRefund,
    fee_to_reverse: feeToReverse,
    refund_from_seller: actualRefund - feeToReverse,
    is_full_refund: isFullRefund
  }
}

/**
 * Convert basis points to percentage string
 */
export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`
}

/**
 * Format amount for display (cents to dollars)
 */
export function formatAmount(cents: number, currency: Currency = 'USD'): string {
  const amount = cents / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount)
}

/**
 * Validate fee configuration
 */
export function validateFeeConfig(config: {
  fee_bps?: number
  fee_payer?: FeePayer
  gross_amount: number
}): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (config.fee_bps !== undefined) {
    if (config.fee_bps < 0) {
      errors.push('Fee BPS cannot be negative')
    }
    if (config.fee_bps > 1000) {
      errors.push('Fee BPS cannot exceed 1000 (10%)')
    }
  }

  if (config.gross_amount <= 0) {
    errors.push('Gross amount must be positive')
  }

  // Minimum transaction amount ($1.00 = 100 cents)
  if (config.gross_amount < 100) {
    errors.push('Minimum transaction amount is $1.00')
  }

  // Maximum single transaction ($10M = 1B cents)
  if (config.gross_amount > 1000000000) {
    errors.push('Maximum transaction amount is $10,000,000')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
