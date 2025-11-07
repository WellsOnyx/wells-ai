/**
 * Grain & Vault Pricing Configuration
 *
 * Global configuration for the Wells AI pricing system.
 * All pricing rules, thresholds, and treasury settings live here.
 */

import { DealType, PaymentRail, PricingConfig } from './types'

/**
 * Fee Percentages by Deal Type
 *
 * These are the core fee rates that drive the entire pricing model.
 */
export const FEE_RATES: Record<DealType, number> = {
  [DealType.IN_NETWORK]: 0.0033,  // 0.33% (33 bps)
  [DealType.SOURCED]: 0.033,       // 3.3%
  [DealType.ORIGINATED]: 0.07       // 7%
}

/**
 * Payment Rail Costs (Pass-Through)
 *
 * These costs are passed directly to customers as separate line items.
 * We don't mark these up - pure pass-through.
 */
export const RAIL_COSTS: Record<PaymentRail, {
  percentageFee: number  // As decimal (0.029 = 2.9%)
  fixedFee: number       // In USD dollars
  minFee?: number        // Minimum fee in dollars
  maxFee?: number        // Maximum fee in dollars
}> = {
  [PaymentRail.GRAIN]: {
    percentageFee: 0,
    fixedFee: 0,
    minFee: 0,
    maxFee: 0
  },
  [PaymentRail.USDC]: {
    percentageFee: 0.001,  // 0.1% - minimal on-chain gas
    fixedFee: 0,
    minFee: 0
  },
  [PaymentRail.ACH]: {
    percentageFee: 0.008,  // 0.8%
    fixedFee: 0,
    minFee: 0,
    maxFee: 5  // Capped at $5
  },
  [PaymentRail.WIRE]: {
    percentageFee: 0,
    fixedFee: 25,  // Flat $25 per wire
    minFee: 25
  },
  [PaymentRail.CARD]: {
    percentageFee: 0.029,  // 2.9%
    fixedFee: 0.30,
    minFee: 0.30
  }
}

/**
 * Pricing Guardrails
 *
 * These prevent edge cases and ensure unit economics stay healthy.
 */
export const PRICING_GUARDRAILS = {
  /** Minimum transaction fee: $25 */
  MINIMUM_TRANSACTION_FEE: 2500,  // in cents

  /** Monthly platform minimum: $2,500 (credited against fees) */
  MONTHLY_PLATFORM_MINIMUM: 250000,  // in cents

  /** Minimum deal size for originated tier: $10,000 */
  ORIGINATED_MIN_DEAL_SIZE: 1000000,  // in cents

  /** Dispute window: 30 days */
  DISPUTE_WINDOW_DAYS: 30,

  /** Maximum effective rate (sanity check): 15% */
  MAX_EFFECTIVE_RATE: 0.15
}

/**
 * In-Network Requirements
 *
 * Both parties must meet ALL these requirements for in-network pricing.
 */
export const IN_NETWORK_REQUIREMENTS = {
  /** Both parties must have GRAIN wallets */
  BOTH_HAVE_WALLETS: true,

  /** Both parties must be verified (KYB/KYC) */
  BOTH_VERIFIED: true,

  /** Minimum GRAIN balance: $100 */
  MIN_GRAIN_BALANCE: 10000,  // in cents

  /** Minimum transaction history: 1 completed transaction */
  MIN_TRANSACTION_HISTORY: 1
}

/**
 * Sourced Requirements
 *
 * Requirements for the "sourced" tier (3.3%)
 */
export const SOURCED_REQUIREMENTS = {
  /** Must be matched by Wells platform */
  PLATFORM_MATCHED: true,

  /** Minimum match score: 70/100 */
  MIN_MATCH_SCORE: 70,

  /** Seller must have initiated via GTM or RFQ */
  SELLER_INITIATED: true
}

/**
 * Originated Requirements
 *
 * Requirements for the "originated" tier (7%)
 */
export const ORIGINATED_REQUIREMENTS = {
  /** Wells must have negotiated the deal */
  WELLS_NEGOTIATED: true,

  /** Minimum deal size: $10,000 */
  MIN_DEAL_SIZE: 1000000,  // in cents

  /** Must have RFQ or GTM campaign ID */
  HAS_SOURCE_TAG: true
}

/**
 * Tithe Configuration
 *
 * 10% of all gross fees go to the Adullam Fund.
 * This is non-negotiable and appears as a separate line item.
 */
export const TITHE_CONFIG = {
  /** Tithe rate: 10% of gross Wells fee */
  RATE: 0.10,

  /** Destination name for transparency */
  DESTINATION: 'Adullam Fund',

  /** Wallet address for tithe (Base L2) */
  WALLET_ADDRESS: process.env.ADULLAM_WALLET_ADDRESS || '',

  /** Description for invoices */
  DESCRIPTION: '10% of gross Wells fees support the Adullam Fund mission'
}

/**
 * Treasury Configuration
 *
 * How we invest the float to generate revenue without fees.
 *
 * TOKENOMICS MODEL: APPRECIATION (not distribution)
 * - All treasury yield stays in the vault
 * - GRAIN value increases as treasury grows
 * - No periodic distributions to holders
 * - Holders benefit through token price appreciation
 *
 * Formula: GRAIN price = Treasury Value / Total GRAIN Supply
 *
 * Target blended APY: 8-12% (accrues to treasury, not paid out)
 */
export const TREASURY_CONFIG = {
  /** Target blended APY on treasury (stays in vault) */
  TARGET_APY: 0.10,  // 10%

  /** Conservative strategy (65% of float) */
  CONSERVATIVE: {
    allocation: 0.65,
    strategy: 'USDC staking on Base (Aave, Compound)',
    targetAPY: 0.045,  // 4.5% - Circle Yield
    risk: 'Very Low',
    liquidity: 'Instant'
  },

  /** Moderate strategy (25% of float) */
  MODERATE: {
    allocation: 0.25,
    strategy: 'Liquidity provision (USDC/ETH on Uniswap)',
    targetAPY: 0.125,  // 12.5%
    risk: 'Moderate',
    liquidity: '24 hours'
  },

  /** Aggressive strategy (10% of float) */
  AGGRESSIVE: {
    allocation: 0.10,
    strategy: 'Real-world assets (Ondo, Maple Finance)',
    targetAPY: 0.15,  // 15%
    risk: 'Higher',
    liquidity: '7-30 days'
  },

  /** Minimum collateralization ratio: 110% */
  MIN_COLLATERALIZATION_RATIO: 1.10,

  /** Rebalance frequency: Daily */
  REBALANCE_FREQUENCY_HOURS: 24,

  /** Distribution model: NONE - all yield accrues to treasury */
  DISTRIBUTION_TO_HOLDERS: false,

  /** Initial GRAIN supply (fixed) */
  INITIAL_GRAIN_SUPPLY: 1000000,  // 1M GRAIN tokens

  /** GRAIN is backed by: treasury value / total supply */
  GRAIN_BACKED_BY_TREASURY: true
}

/**
 * Credit Line Configuration
 *
 * How we calculate credit lines based on user tier.
 */
export const CREDIT_LINE_CONFIG = {
  /** Tier 1: New Buyers (1:1 Leverage) */
  TIER_1: {
    multiplier: 1.0,
    requirements: {
      minTransactions: 1,
      minMonthsHistory: 0,
      minOnTimePaymentRate: 0
    },
    terms: {
      interestFreeDays: 30,
      interestRateAPR: 0.08  // 8% APR after 30 days
    }
  },

  /** Tier 2: Established Buyers (1.5:1 Leverage) */
  TIER_2: {
    multiplier: 1.5,
    requirements: {
      minTransactions: 10,
      minMonthsHistory: 3,
      minOnTimePaymentRate: 0.85  // 85%
    },
    terms: {
      interestFreeDays: 45,
      interestRateAPR: 0.06  // 6% APR after 45 days
    }
  },

  /** Tier 3: Premium Buyers (2:1 Leverage) */
  TIER_3: {
    multiplier: 2.0,
    requirements: {
      minTransactions: 50,
      minMonthsHistory: 12,
      minOnTimePaymentRate: 0.95  // 95%
    },
    terms: {
      interestFreeDays: 60,
      interestRateAPR: 0.05  // 5% APR after 60 days
    }
  }
}

/**
 * Wallet Configuration
 */
export const WALLET_CONFIG = {
  /** Base L2 Chain ID */
  CHAIN_ID: 8453,  // Base mainnet

  /** GRAIN token address (Base L2) */
  GRAIN_TOKEN_ADDRESS: process.env.GRAIN_TOKEN_ADDRESS || '',

  /** USDC token address (Base L2) */
  USDC_TOKEN_ADDRESS: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',  // Base USDC

  /** Grain Vault contract address */
  VAULT_ADDRESS: process.env.GRAIN_VAULT_ADDRESS || '',

  /** Wells Treasury wallet */
  TREASURY_WALLET: process.env.WELLS_TREASURY_WALLET || '',

  /** Minimum wallet balance to maintain: $10 */
  MIN_BALANCE: 1000,  // in cents

  /** Auto-swap threshold: When GRAIN < $50, swap USDC to GRAIN */
  AUTO_SWAP_THRESHOLD: 5000  // in cents
}

/**
 * Global Pricing Config Object
 */
export const PRICING_CONFIG: PricingConfig = {
  minimumFee: PRICING_GUARDRAILS.MINIMUM_TRANSACTION_FEE,
  monthlyMinimum: PRICING_GUARDRAILS.MONTHLY_PLATFORM_MINIMUM,
  disputeWindowDays: PRICING_GUARDRAILS.DISPUTE_WINDOW_DAYS,
  titheRate: TITHE_CONFIG.RATE,
  titheDestination: TITHE_CONFIG.DESTINATION,
  treasury: {
    targetAPY: TREASURY_CONFIG.TARGET_APY,
    conservativeAllocation: TREASURY_CONFIG.CONSERVATIVE.allocation,
    moderateAllocation: TREASURY_CONFIG.MODERATE.allocation,
    aggressiveAllocation: TREASURY_CONFIG.AGGRESSIVE.allocation
  }
}

/**
 * Feature Flags
 *
 * Roll out features gradually.
 */
export const FEATURE_FLAGS = {
  /** Enable GRAIN payments (disabled until smart contracts audited) */
  GRAIN_ENABLED: process.env.GRAIN_ENABLED === 'true',

  /** Enable credit lines (disabled until underwriting ready) */
  CREDIT_LINES_ENABLED: process.env.CREDIT_LINES_ENABLED === 'true',

  /** Enable treasury yield (disabled until strategies implemented) */
  TREASURY_YIELD_ENABLED: process.env.TREASURY_YIELD_ENABLED === 'true',

  /** Enable in-network pricing (disabled until wallets rolled out) */
  IN_NETWORK_ENABLED: process.env.IN_NETWORK_ENABLED === 'true'
}
