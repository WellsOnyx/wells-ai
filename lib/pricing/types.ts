/**
 * Grain & Vault Pricing Types
 *
 * Core type definitions for the Wells AI pricing system.
 * Based on the comprehensive Grain tokenomics strategy.
 *
 * Economics:
 * - In-Network: 0.33% (33 bps) - Both parties have GRAIN wallets + verified
 * - Sourced: 3.3% - Platform matched, but Wells didn't originate
 * - Originated: 7% - Wells negotiated and closed the deal
 * - 10% tithe to Adullam Fund on all gross fees
 */

/**
 * Deal Type - Determines fee tier
 *
 * The deal type is the PRIMARY driver of pricing.
 * It reflects the value Wells AI provided to make the transaction happen.
 */
export enum DealType {
  /** Both parties have wallets, verified, in the network - 0.33% */
  IN_NETWORK = 'in_network',

  /** Platform matched but Wells didn't originate - 3.3% */
  SOURCED = 'sourced',

  /** Wells negotiated and closed - 7% */
  ORIGINATED = 'originated'
}

/**
 * Payment Rail - How the money moves
 *
 * Different rails have different costs that are passed through to users.
 */
export enum PaymentRail {
  /** GRAIN token on Base L2 - near-zero fees */
  GRAIN = 'grain',

  /** Circle USDC - stablecoin */
  USDC = 'usdc',

  /** ACH bank transfer - 0.8% capped at $5 */
  ACH = 'ach',

  /** Wire transfer - flat $25 */
  WIRE = 'wire',

  /** Credit card via Stripe - 2.9% + $0.30 */
  CARD = 'card'
}

/**
 * User Wallet Status
 *
 * Tracks whether users have GRAIN wallets and are verified.
 * Both parties need wallets + verification for in-network pricing.
 */
export interface WalletStatus {
  /** User's wallet address on Base L2 */
  address?: string

  /** GRAIN token balance */
  grainBalance: number

  /** USDC balance (used as collateral) */
  usdcBalance: number

  /** Has user passed KYB/KYC? */
  isVerified: boolean

  /** Credit line available (1:1 to 2:1 leverage) */
  creditLineAvailable: number

  /** Credit line used */
  creditLineUsed: number

  /** Timestamp of wallet creation */
  createdAt: string
}

/**
 * Deal Context - Information needed to determine pricing
 *
 * This is used by inferDealType() to automatically classify deals.
 */
export interface DealContext {
  /** Deal amount in USD cents */
  amount: number

  /** Buyer wallet status */
  buyer: {
    userId: string
    wallet?: WalletStatus
  }

  /** Seller wallet status */
  seller: {
    userId: string
    wallet?: WalletStatus
  }

  /** Was this deal matched by Wells platform? */
  platformMatched: boolean

  /** Match score (0-100) if platform matched */
  matchScore?: number

  /** Did Wells negotiate this deal? */
  wellsNegotiated: boolean

  /** RFQ ID if originated from RFQ */
  rfqId?: string

  /** GTM campaign ID if sourced from GTM */
  gtmCampaignId?: string

  /** Deal source tag for attribution */
  dealSourceTag?: string
}

/**
 * Fee Breakdown - Transparent display of all fees
 *
 * Shows exactly where every dollar goes.
 */
export interface FeeBreakdown {
  /** Total transaction amount */
  transactionAmount: number

  /** Deal type that determined the fee */
  dealType: DealType

  /** Payment rail used */
  rail: PaymentRail

  /** Gross Wells fee (before tithe) */
  wellsFeeGross: number

  /** Percentage rate for Wells fee */
  wellsFeePercentage: number

  /** Tithe amount (10% of gross) */
  titheAmount: number

  /** Purpose of tithe */
  tithePurpose: string

  /** Net Wells fee (after tithe) */
  wellsFeeNet: number

  /** Payment rail costs (pass-through) */
  railCost: number

  /** Total customer charge */
  totalCharge: number

  /** Effective rate as percentage */
  effectiveRate: number

  /** Breakdown for display */
  lineItems: {
    description: string
    amount: number
    percentage?: number
  }[]

  /** Attribution info */
  attribution: {
    dealSourceTag: string
    timestamp: string
    disputeWindowDays: number
  }
}

/**
 * Savings Calculation - Show what they save by going in-network
 *
 * This is powerful marketing - show the savings opportunity.
 */
export interface SavingsCalculation {
  /** Current deal type */
  currentDealType: DealType

  /** Current fee */
  currentFee: number

  /** Fee if they went in-network */
  inNetworkFee: number

  /** Savings amount */
  savingsAmount: number

  /** Savings percentage */
  savingsPercentage: number

  /** What they need to do to get in-network pricing */
  requirements: string[]

  /** Call to action */
  callToAction: string
}

/**
 * GRAIN Price Calculation
 *
 * GRAIN maintains 1:1 USD peg but earns 4% APY on treasury.
 * This affects the credit line pricing.
 */
export interface GrainPriceInfo {
  /** Current GRAIN price in USD (should be ~1.00) */
  priceUSD: number

  /** Treasury APY (default 4.5% from Circle Yield) */
  treasuryAPY: number

  /** Total GRAIN supply */
  totalSupply: number

  /** Total collateral in USDC */
  totalCollateral: number

  /** Collateralization ratio (should be >105%) */
  collateralizationRatio: number

  /** Last updated */
  updatedAt: string
}

/**
 * Credit Line Info
 *
 * Shows available credit based on deposits and tier.
 */
export interface CreditLineInfo {
  /** User ID */
  userId: string

  /** Total deposited (base for credit calculation) */
  totalDeposited: number

  /** Credit multiplier (1.0, 1.5, or 2.0) */
  creditMultiplier: number

  /** Total credit line available */
  creditLineTotal: number

  /** Credit used */
  creditUsed: number

  /** Credit available */
  creditAvailable: number

  /** Interest rate on credit (0% for 30-60 days, then 5-8% APR) */
  interestRate: number

  /** Days until interest kicks in */
  daysUntilInterest: number

  /** Credit tier (1, 2, or 3) */
  tier: 1 | 2 | 3

  /** Requirements to upgrade tier */
  upgradeRequirements?: string[]
}

/**
 * Pricing Config - Global configuration
 */
export interface PricingConfig {
  /** Minimum transaction fee in USD cents */
  minimumFee: number

  /** Monthly platform minimum in USD cents */
  monthlyMinimum: number

  /** Dispute window in days */
  disputeWindowDays: number

  /** Tithe rate (0.10 = 10%) */
  titheRate: number

  /** Tithe destination */
  titheDestination: string

  /** Treasury config */
  treasury: {
    /** Target APY on float */
    targetAPY: number

    /** Conservative allocation percentage */
    conservativeAllocation: number

    /** Moderate allocation percentage */
    moderateAllocation: number

    /** Aggressive allocation percentage */
    aggressiveAllocation: number
  }
}
