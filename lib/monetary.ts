/**
 * Monetary Utilities
 *
 * This module provides safe decimal arithmetic for financial calculations.
 * Using floating-point arithmetic for money can lead to precision errors
 * that accumulate into significant discrepancies in real-world transactions.
 *
 * All monetary values are stored internally as integers (cents/micro-units)
 * to avoid floating-point precision issues.
 *
 * IMPORTANT: All functions in this module use CENTS as the internal representation.
 * Input is USD, output is USD unless otherwise noted.
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Money type - represents a monetary value in cents (integer)
 * Use createMoney() to create from USD, use toUSD() to convert back
 */
export interface Money {
  readonly cents: number
  readonly currency: 'USD'
}

/**
 * Fee calculation result
 */
export interface FeeResult {
  readonly grossAmount: Money
  readonly fee: Money
  readonly netAmount: Money
  readonly feeRate: number // As decimal (0.0025 = 0.25%)
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const FEE_RATES = {
  WITHDRAWAL: 0.0025,      // 0.25%
  GRAIN_SELL: 0.001,       // 0.1%
  ESCROW: 0.02,            // 2% (platform fee)
  CARD_PROCESSING: 0.029,  // 2.9% (typical card processing)
  ACH: 0.0,                // 0% (free ACH)
} as const

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Create a Money object from a USD amount
 *
 * @param usd The USD amount (can be string or number)
 * @returns Money object with cents stored as integer
 *
 * @example
 * const price = createMoney(10.50) // { cents: 1050, currency: 'USD' }
 * const price2 = createMoney('10.50') // { cents: 1050, currency: 'USD' }
 */
export function createMoney(usd: number | string): Money {
  const numValue = typeof usd === 'string' ? parseFloat(usd) : usd

  if (isNaN(numValue)) {
    throw new Error(`Invalid monetary value: ${usd}`)
  }

  // Convert to cents with rounding to avoid floating-point issues
  // Math.round ensures we handle cases like 10.555 correctly
  const cents = Math.round(numValue * 100)

  return Object.freeze({
    cents,
    currency: 'USD' as const,
  })
}

/**
 * Create Money from cents directly
 */
export function createMoneyFromCents(cents: number): Money {
  if (!Number.isInteger(cents)) {
    throw new Error(`Cents must be an integer, got: ${cents}`)
  }

  return Object.freeze({
    cents,
    currency: 'USD' as const,
  })
}

/**
 * Convert Money to USD (number)
 *
 * @param money The Money object
 * @returns USD amount as number
 */
export function toUSD(money: Money): number {
  return money.cents / 100
}

/**
 * Convert Money to formatted USD string
 *
 * @param money The Money object
 * @param options Formatting options
 * @returns Formatted string like "$1,234.56"
 */
export function formatUSD(
  money: Money,
  options: { showSymbol?: boolean; showDecimals?: boolean } = {}
): string {
  const { showSymbol = true, showDecimals = true } = options
  const usd = toUSD(money)

  const formatted = usd.toLocaleString('en-US', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  })

  return showSymbol ? `$${formatted}` : formatted
}

// ============================================================================
// ARITHMETIC OPERATIONS
// ============================================================================

/**
 * Add two Money amounts
 */
export function addMoney(a: Money, b: Money): Money {
  return createMoneyFromCents(a.cents + b.cents)
}

/**
 * Subtract Money (a - b)
 */
export function subtractMoney(a: Money, b: Money): Money {
  return createMoneyFromCents(a.cents - b.cents)
}

/**
 * Multiply Money by a scalar
 * Useful for calculating percentages or quantities
 */
export function multiplyMoney(money: Money, multiplier: number): Money {
  // Round to nearest cent
  const resultCents = Math.round(money.cents * multiplier)
  return createMoneyFromCents(resultCents)
}

/**
 * Divide Money (useful for splitting)
 */
export function divideMoney(money: Money, divisor: number): Money {
  if (divisor === 0) {
    throw new Error('Cannot divide by zero')
  }
  const resultCents = Math.round(money.cents / divisor)
  return createMoneyFromCents(resultCents)
}

/**
 * Compare two Money amounts
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  if (a.cents < b.cents) return -1
  if (a.cents > b.cents) return 1
  return 0
}

/**
 * Check if Money amount is zero
 */
export function isZero(money: Money): boolean {
  return money.cents === 0
}

/**
 * Check if Money amount is negative
 */
export function isNegative(money: Money): boolean {
  return money.cents < 0
}

/**
 * Get the absolute value
 */
export function absMoney(money: Money): Money {
  return createMoneyFromCents(Math.abs(money.cents))
}

/**
 * Get the minimum of two Money amounts
 */
export function minMoney(a: Money, b: Money): Money {
  return a.cents <= b.cents ? a : b
}

/**
 * Get the maximum of two Money amounts
 */
export function maxMoney(a: Money, b: Money): Money {
  return a.cents >= b.cents ? a : b
}

// ============================================================================
// FEE CALCULATIONS
// ============================================================================

/**
 * Calculate fee and net amount with consistent precision
 *
 * @param grossAmount The gross amount before fees
 * @param feeRate The fee rate as a decimal (0.0025 = 0.25%)
 * @returns FeeResult with gross, fee, and net amounts
 *
 * @example
 * const result = calculateFee(createMoney(100), FEE_RATES.WITHDRAWAL)
 * // result.fee = $0.25, result.netAmount = $99.75
 */
export function calculateFee(grossAmount: Money, feeRate: number): FeeResult {
  // Calculate fee in cents, rounding up (protects the platform)
  const feeCents = Math.ceil(grossAmount.cents * feeRate)
  const netCents = grossAmount.cents - feeCents

  return {
    grossAmount,
    fee: createMoneyFromCents(feeCents),
    netAmount: createMoneyFromCents(netCents),
    feeRate,
  }
}

/**
 * Calculate fee and net amount, rounding fee DOWN (customer-friendly)
 */
export function calculateFeeRoundDown(grossAmount: Money, feeRate: number): FeeResult {
  const feeCents = Math.floor(grossAmount.cents * feeRate)
  const netCents = grossAmount.cents - feeCents

  return {
    grossAmount,
    fee: createMoneyFromCents(feeCents),
    netAmount: createMoneyFromCents(netCents),
    feeRate,
  }
}

/**
 * Calculate the gross amount needed to achieve a specific net amount after fees
 *
 * @param desiredNetAmount The net amount you want after fees
 * @param feeRate The fee rate as a decimal
 * @returns The gross amount needed
 *
 * @example
 * // If withdrawal fee is 0.25% and user wants to receive $100 net
 * const gross = calculateGrossFromNet(createMoney(100), 0.0025)
 * // gross = $100.25 (approximately)
 */
export function calculateGrossFromNet(desiredNetAmount: Money, feeRate: number): Money {
  // gross = net / (1 - feeRate)
  const grossCents = Math.ceil(desiredNetAmount.cents / (1 - feeRate))
  return createMoneyFromCents(grossCents)
}

// ============================================================================
// GRAIN-SPECIFIC CALCULATIONS
// ============================================================================

/**
 * Calculate GRAIN amount from USD at a given price
 *
 * @param usdAmount The USD amount to convert
 * @param grainPrice The GRAIN price in USD
 * @returns GRAIN amount as a number (with 6 decimal precision)
 */
export function usdToGrain(usdAmount: Money, grainPrice: number): number {
  if (grainPrice <= 0) {
    throw new Error('GRAIN price must be positive')
  }
  // Use 6 decimal precision for GRAIN
  return Math.floor((toUSD(usdAmount) / grainPrice) * 1_000_000) / 1_000_000
}

/**
 * Calculate USD amount from GRAIN at a given price
 *
 * @param grainAmount The GRAIN amount
 * @param grainPrice The GRAIN price in USD
 * @returns Money (USD amount)
 */
export function grainToUsd(grainAmount: number, grainPrice: number): Money {
  if (grainPrice <= 0) {
    throw new Error('GRAIN price must be positive')
  }
  const usd = grainAmount * grainPrice
  return createMoney(usd)
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that an amount is within acceptable range
 */
export function validateAmount(
  money: Money,
  options: {
    min?: Money
    max?: Money
    allowNegative?: boolean
  } = {}
): { valid: boolean; error?: string } {
  const { min, max, allowNegative = false } = options

  if (!allowNegative && isNegative(money)) {
    return { valid: false, error: 'Amount cannot be negative' }
  }

  if (min && compareMoney(money, min) < 0) {
    return { valid: false, error: `Amount must be at least ${formatUSD(min)}` }
  }

  if (max && compareMoney(money, max) > 0) {
    return { valid: false, error: `Amount cannot exceed ${formatUSD(max)}` }
  }

  return { valid: true }
}

// ============================================================================
// UTILITY
// ============================================================================

/**
 * Parse a user input string to Money, handling common formats
 *
 * @param input User input like "$1,234.56" or "1234.56" or "1,234"
 * @returns Money object or null if parsing fails
 */
export function parseMoney(input: string): Money | null {
  try {
    // Remove currency symbol and commas
    const cleaned = input
      .replace(/[$,]/g, '')
      .trim()

    if (!cleaned) return null

    const amount = parseFloat(cleaned)
    if (isNaN(amount)) return null

    return createMoney(amount)
  } catch {
    return null
  }
}

/**
 * Sum an array of Money amounts
 */
export function sumMoney(amounts: Money[]): Money {
  const totalCents = amounts.reduce((sum, m) => sum + m.cents, 0)
  return createMoneyFromCents(totalCents)
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Creation
  createMoney,
  createMoneyFromCents,
  parseMoney,

  // Conversion
  toUSD,
  formatUSD,
  usdToGrain,
  grainToUsd,

  // Arithmetic
  addMoney,
  subtractMoney,
  multiplyMoney,
  divideMoney,
  sumMoney,

  // Comparison
  compareMoney,
  isZero,
  isNegative,
  absMoney,
  minMoney,
  maxMoney,

  // Fees
  calculateFee,
  calculateFeeRoundDown,
  calculateGrossFromNet,
  FEE_RATES,

  // Validation
  validateAmount,
}
