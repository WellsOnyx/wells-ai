/**
 * Wells Onyx Fee System
 *
 * Success fee capture and tracking for completed deals.
 *
 * Fee Tiers:
 * - Standard (1%): Basic deals, minimum $100
 * - White Glove (3.3%): Concierge service, complex negotiations
 * - Complex (7.7%): High-touch strategic deals
 *
 * Usage:
 * ```typescript
 * import { FeeCalculator, FeeService } from '@/lib/fees'
 *
 * // Calculate fee
 * const calc = FeeCalculator.calculateFee(10000, 'standard')
 * console.log(`Fee: $${calc.appliedFee}, Seller gets: $${calc.sellerReceives}`)
 *
 * // Capture fee during escrow release
 * const result = await FeeService.captureFee(
 *   dealId,
 *   amount,
 *   escrowWalletId,
 *   sellerWalletAddress,
 *   'standard'
 * )
 * ```
 */

export * from './fee-calculator'
export * from './fee-service'

export { default as FeeCalculator } from './fee-calculator'
export { default as FeeService } from './fee-service'
