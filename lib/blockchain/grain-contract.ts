/**
 * GRAIN Token Smart Contract Interface
 *
 * GRAIN is the reward token for the Wells ecosystem
 * Earned by: completing transactions, referring users, providing liquidity
 * Used for: platform fees discounts, governance, staking rewards
 */

export interface GRAINConfig {
  tokenAddress: string
  decimals: number
  totalSupply: string
  rewardRates: {
    transactionComplete: number      // GRAIN per $1 transacted
    referralBonus: number             // GRAIN for successful referral
    liquidityProvision: number        // GRAIN per $1 in escrow
    dailyActive: number               // GRAIN for daily platform usage
  }
  stakingAPY: number                  // Annual percentage yield for staking
  governanceThreshold: number         // Minimum GRAIN to vote on proposals
}

export const GRAIN_CONFIG: GRAINConfig = {
  tokenAddress: process.env.GRAIN_CONTRACT_ADDRESS || '0x...',
  decimals: 18,
  totalSupply: '1000000000', // 1 billion GRAIN
  rewardRates: {
    transactionComplete: 0.1,    // 0.1 GRAIN per $1 transacted
    referralBonus: 100,           // 100 GRAIN for successful referral
    liquidityProvision: 0.05,     // 0.05 GRAIN per $1 in escrow daily
    dailyActive: 1                // 1 GRAIN for logging in daily
  },
  stakingAPY: 12,                 // 12% APY
  governanceThreshold: 1000       // Need 1000 GRAIN to vote
}

export interface GRAINTransaction {
  id: string
  userId: string
  type: 'earn' | 'spend' | 'stake' | 'unstake'
  amount: string
  reason: string
  txHash?: string
  timestamp: Date
  status: 'pending' | 'confirmed' | 'failed'
}

export interface GRAINBalance {
  userId: string
  available: string
  staked: string
  pending: string
  totalEarned: string
  totalSpent: string
}

/**
 * Calculate GRAIN rewards for transaction
 */
export function calculateTransactionReward(transactionAmount: number): number {
  return transactionAmount * GRAIN_CONFIG.rewardRates.transactionComplete
}

/**
 * Calculate staking rewards
 */
export function calculateStakingReward(stakedAmount: number, daysStaked: number): number {
  const dailyRate = GRAIN_CONFIG.stakingAPY / 365 / 100
  return stakedAmount * dailyRate * daysStaked
}

/**
 * Check if user has governance rights
 */
export function hasGovernanceRights(balance: GRAINBalance): boolean {
  const totalBalance = parseFloat(balance.available) + parseFloat(balance.staked)
  return totalBalance >= GRAIN_CONFIG.governanceThreshold
}

/**
 * Calculate platform fee discount based on GRAIN holdings
 */
export function calculateFeeDiscount(grainBalance: number): number {
  // Tiered discount: 5% per 1000 GRAIN, max 50%
  const discount = Math.min((grainBalance / 1000) * 5, 50)
  return discount
}

export default GRAIN_CONFIG
