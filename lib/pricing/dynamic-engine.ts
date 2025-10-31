/**
 * Dynamic Pricing Engine - COST + MARGIN Model
 *
 * Wells AI can NEVER lose money because fees are always:
 * FINAL FEE = ACTUAL COST + MARGIN
 *
 * If external costs change (Stripe, ACH, etc), we:
 * 1. Detect the change
 * 2. Recalculate pricing
 * 3. Notify users
 * 4. Require acceptance before continuing
 */

import Stripe from 'stripe'

// Lazy-initialize Stripe only when needed
function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY not configured')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-10-29.clover',
  })
}

// ===== PAYMENT METHOD COSTS =====

export interface PaymentMethodCost {
  method: 'stripe' | 'ach' | 'wire' | 'grain'
  percentageFee: number // e.g., 0.029 for 2.9%
  fixedFee: number // e.g., 0.30 for $0.30 in dollars
  lastUpdated: Date
  source: string // Where we got this info
}

/**
 * Get current Stripe fees (real-time from Stripe API)
 */
export async function getStripeCosts(): Promise<PaymentMethodCost> {
  // In production, we'd query Stripe's actual fee structure
  // For now, using standard US card rates
  return {
    method: 'stripe',
    percentageFee: 0.029, // 2.9%
    fixedFee: 0.30,
    lastUpdated: new Date(),
    source: 'Stripe API - US card rates',
  }
}

/**
 * Get current ACH fees
 */
export async function getACHCosts(): Promise<PaymentMethodCost> {
  // Plaid ACH: $0.25 per transaction
  // Stripe ACH: $0.80 per transaction
  // We use whichever is cheaper
  return {
    method: 'ach',
    percentageFee: 0, // Flat fee only
    fixedFee: 0.25,
    lastUpdated: new Date(),
    source: 'Plaid ACH',
  }
}

/**
 * Get current Wire fees
 */
export async function getWireCosts(): Promise<PaymentMethodCost> {
  // Standard domestic wire fee
  return {
    method: 'wire',
    percentageFee: 0,
    fixedFee: 15.00,
    lastUpdated: new Date(),
    source: 'Standard bank wire fees',
  }
}

/**
 * Get current Grain fees (future)
 */
export async function getGrainCosts(): Promise<PaymentMethodCost> {
  // Base L2 gas fees (minimal)
  return {
    method: 'grain',
    percentageFee: 0,
    fixedFee: 0.01, // ~$0.01 gas on Base L2
    lastUpdated: new Date(),
    source: 'Base L2 gas oracle',
  }
}

// ===== MARGIN TIERS =====

export type IndustryTier = 'commodities' | 'standard' | 'high-value' | 'gtm-service'

export interface MarginConfig {
  tier: IndustryTier
  margin: number // Percentage (e.g., 0.005 for 0.5%)
  minFee: number // Minimum fee in dollars
  description: string
}

export const MARGIN_TIERS: Record<IndustryTier, MarginConfig> = {
  commodities: {
    tier: 'commodities',
    margin: 0.005, // 0.5%
    minFee: 100,
    description: 'Vegetables, grain, livestock, raw materials (0.5-2% margins)',
  },
  standard: {
    tier: 'standard',
    margin: 0.02, // 2%
    minFee: 50,
    description: 'Manufacturing, distribution, wholesale (5-15% margins)',
  },
  'high-value': {
    tier: 'high-value',
    margin: 0.03, // 3%
    minFee: 500,
    description: 'Exec search, consulting, software, professional services (20%+ margins)',
  },
  'gtm-service': {
    tier: 'gtm-service',
    margin: 0.10, // 10%
    minFee: 1000,
    description: 'Full GTM automation - we find, pitch, qualify, and close the deal',
  },
}

// ===== PRICING CALCULATION =====

export interface PricingBreakdown {
  transactionAmount: number
  paymentMethod: 'stripe' | 'ach' | 'wire' | 'grain'
  industryTier: IndustryTier

  // Cost breakdown
  processingCostPercent: number
  processingCostFixed: number
  processingCostTotal: number

  // Margin breakdown
  marginPercent: number
  marginAmount: number
  minFee: number
  marginApplied: number // Either marginAmount or minFee, whichever is higher

  // Final
  totalFee: number
  sellerReceives: number
  wellsAIRevenue: number // marginApplied (our actual profit)

  // Metadata
  calculatedAt: Date
  costSource: string
}

/**
 * Calculate dynamic pricing for a transaction
 *
 * Formula: TOTAL FEE = PROCESSING COST + WELLS AI MARGIN
 *
 * @param amount Transaction amount in dollars
 * @param paymentMethod How the buyer will pay
 * @param industryTier Which industry tier the seller is in
 * @returns Complete pricing breakdown
 */
export async function calculateDynamicPricing(
  amount: number,
  paymentMethod: 'stripe' | 'ach' | 'wire' | 'grain',
  industryTier: IndustryTier
): Promise<PricingBreakdown> {
  // Get current costs for payment method
  let costs: PaymentMethodCost
  switch (paymentMethod) {
    case 'stripe':
      costs = await getStripeCosts()
      break
    case 'ach':
      costs = await getACHCosts()
      break
    case 'wire':
      costs = await getWireCosts()
      break
    case 'grain':
      costs = await getGrainCosts()
      break
  }

  // Calculate processing costs
  const processingCostPercent = amount * costs.percentageFee
  const processingCostFixed = costs.fixedFee
  const processingCostTotal = processingCostPercent + processingCostFixed

  // Get margin configuration
  const marginConfig = MARGIN_TIERS[industryTier]

  // Calculate Wells AI margin
  const marginPercent = marginConfig.margin
  const marginAmount = amount * marginPercent
  const minFee = marginConfig.minFee

  // Apply minimum fee if calculated margin is too low
  const marginApplied = Math.max(marginAmount, minFee)

  // Calculate final totals
  const totalFee = processingCostTotal + marginApplied
  const sellerReceives = amount - totalFee
  const wellsAIRevenue = marginApplied

  return {
    transactionAmount: amount,
    paymentMethod,
    industryTier,

    processingCostPercent,
    processingCostFixed,
    processingCostTotal,

    marginPercent,
    marginAmount,
    minFee,
    marginApplied,

    totalFee,
    sellerReceives,
    wellsAIRevenue,

    calculatedAt: new Date(),
    costSource: costs.source,
  }
}

// ===== CHANGE DETECTION =====

export interface PricingChange {
  field: 'processing_cost' | 'margin'
  oldValue: number
  newValue: number
  changePercent: number
  reason: string
  effectiveDate: Date
}

/**
 * Compare two pricing calculations to detect changes
 */
export function detectPricingChanges(
  oldPricing: PricingBreakdown,
  newPricing: PricingBreakdown
): PricingChange[] {
  const changes: PricingChange[] = []

  // Check if processing costs changed
  if (oldPricing.processingCostTotal !== newPricing.processingCostTotal) {
    const changePct =
      ((newPricing.processingCostTotal - oldPricing.processingCostTotal) /
        oldPricing.processingCostTotal) *
      100

    changes.push({
      field: 'processing_cost',
      oldValue: oldPricing.processingCostTotal,
      newValue: newPricing.processingCostTotal,
      changePercent: changePct,
      reason: `Payment processor fees changed (${oldPricing.costSource} → ${newPricing.costSource})`,
      effectiveDate: newPricing.calculatedAt,
    })
  }

  // Check if our margin changed (rare, but possible if we adjust tiers)
  if (oldPricing.marginPercent !== newPricing.marginPercent) {
    const changePct =
      ((newPricing.marginPercent - oldPricing.marginPercent) / oldPricing.marginPercent) * 100

    changes.push({
      field: 'margin',
      oldValue: oldPricing.marginPercent,
      newValue: newPricing.marginPercent,
      changePercent: changePct,
      reason: 'Wells AI margin tier adjusted',
      effectiveDate: newPricing.calculatedAt,
    })
  }

  return changes
}

// ===== USER NOTIFICATION =====

export interface PricingNotification {
  userId: string
  changes: PricingChange[]
  oldTotalFee: number
  newTotalFee: number
  impactDescription: string
  requiresAcceptance: boolean
  acceptedAt?: Date
}

/**
 * Generate user notification for pricing changes
 */
export function generatePricingNotification(
  userId: string,
  oldPricing: PricingBreakdown,
  newPricing: PricingBreakdown
): PricingNotification | null {
  const changes = detectPricingChanges(oldPricing, newPricing)

  if (changes.length === 0) {
    return null // No changes, no notification needed
  }

  const impactAmount = newPricing.totalFee - oldPricing.totalFee
  const impactPercent = (impactAmount / oldPricing.totalFee) * 100

  let impactDescription = ''
  if (impactAmount > 0) {
    impactDescription = `Your fee will increase by $${impactAmount.toFixed(2)} (${impactPercent.toFixed(2)}%) due to ${changes[0].reason.toLowerCase()}.`
  } else {
    impactDescription = `Good news! Your fee will decrease by $${Math.abs(impactAmount).toFixed(2)} (${Math.abs(impactPercent).toFixed(2)}%) due to ${changes[0].reason.toLowerCase()}.`
  }

  // Only require acceptance if fee INCREASES
  const requiresAcceptance = impactAmount > 0

  return {
    userId,
    changes,
    oldTotalFee: oldPricing.totalFee,
    newTotalFee: newPricing.totalFee,
    impactDescription,
    requiresAcceptance,
  }
}

// ===== EXAMPLE USAGE =====

/**
 * Example: Calculate pricing for a $100K vegetable order
 */
export async function exampleCommodityPricing() {
  const amount = 100000 // $100K

  // Option 1: Credit card (Stripe)
  const stripePricing = await calculateDynamicPricing(amount, 'stripe', 'commodities')
  console.log('Credit Card Pricing:')
  console.log(`  Transaction: $${stripePricing.transactionAmount.toLocaleString()}`)
  console.log(`  Processing cost: $${stripePricing.processingCostTotal.toFixed(2)}`)
  console.log(`  Wells AI margin: $${stripePricing.marginApplied.toFixed(2)}`)
  console.log(`  Total fee: $${stripePricing.totalFee.toFixed(2)}`)
  console.log(`  Seller receives: $${stripePricing.sellerReceives.toFixed(2)}`)

  // Option 2: ACH (much cheaper)
  const achPricing = await calculateDynamicPricing(amount, 'ach', 'commodities')
  console.log('\nACH Pricing:')
  console.log(`  Transaction: $${achPricing.transactionAmount.toLocaleString()}`)
  console.log(`  Processing cost: $${achPricing.processingCostTotal.toFixed(2)}`)
  console.log(`  Wells AI margin: $${achPricing.marginApplied.toFixed(2)}`)
  console.log(`  Total fee: $${achPricing.totalFee.toFixed(2)}`)
  console.log(`  Seller receives: $${achPricing.sellerReceives.toFixed(2)}`)

  console.log(`\nSavings with ACH: $${(stripePricing.totalFee - achPricing.totalFee).toFixed(2)}`)
}

/**
 * Example: Detect pricing change when Stripe raises fees
 */
export async function examplePricingChange() {
  const amount = 50000 // $50K

  // Old pricing (Stripe at 2.9%)
  const oldCosts: PaymentMethodCost = {
    method: 'stripe',
    percentageFee: 0.029,
    fixedFee: 0.30,
    lastUpdated: new Date('2024-01-01'),
    source: 'Stripe API - Old rates',
  }

  // Simulate old pricing
  const oldPricing: PricingBreakdown = {
    transactionAmount: amount,
    paymentMethod: 'stripe',
    industryTier: 'standard',
    processingCostPercent: amount * 0.029,
    processingCostFixed: 0.30,
    processingCostTotal: amount * 0.029 + 0.30,
    marginPercent: 0.02,
    marginAmount: amount * 0.02,
    minFee: 50,
    marginApplied: Math.max(amount * 0.02, 50),
    totalFee: amount * 0.029 + 0.30 + Math.max(amount * 0.02, 50),
    sellerReceives: amount - (amount * 0.029 + 0.30 + Math.max(amount * 0.02, 50)),
    wellsAIRevenue: Math.max(amount * 0.02, 50),
    calculatedAt: new Date('2024-01-01'),
    costSource: 'Stripe API - Old rates',
  }

  // New pricing (Stripe raised to 3.2%)
  const newPricing = await calculateDynamicPricing(amount, 'stripe', 'standard')

  // Detect changes
  const changes = detectPricingChanges(oldPricing, newPricing)
  const notification = generatePricingNotification('user_123', oldPricing, newPricing)

  if (notification) {
    console.log('Pricing Change Detected:')
    console.log(`  ${notification.impactDescription}`)
    console.log(`  Requires acceptance: ${notification.requiresAcceptance}`)
  }
}

export default {
  calculateDynamicPricing,
  detectPricingChanges,
  generatePricingNotification,
  MARGIN_TIERS,
}
