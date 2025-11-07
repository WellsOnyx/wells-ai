/**
 * Grain Wallet Manager
 *
 * Manages GRAIN wallets for users on Base L2.
 * Handles wallet creation, funding, balance tracking, and credit lines.
 */

import { WalletStatus, CreditLineInfo } from '../pricing/types'
import { WALLET_CONFIG, CREDIT_LINE_CONFIG } from '../pricing/config'

/**
 * Wallet Creation Request
 */
export interface CreateWalletRequest {
  userId: string
  email: string
  businessName: string
  initialDepositUSDC?: number // Optional initial deposit in cents
}

/**
 * Wallet Creation Result
 */
export interface CreateWalletResult {
  success: boolean
  wallet?: WalletStatus
  error?: string
  message: string
}

/**
 * Fund Wallet Request
 */
export interface FundWalletRequest {
  userId: string
  walletAddress: string
  amountUSDC: number // Amount in cents
  autoSwapToGrain?: boolean
}

/**
 * Fund Wallet Result
 */
export interface FundWalletResult {
  success: boolean
  transactionHash?: string
  grainReceived?: number
  usdcDeposited: number
  error?: string
}

/**
 * Swap Request
 */
export interface SwapRequest {
  walletAddress: string
  fromToken: 'USDC' | 'GRAIN'
  toToken: 'USDC' | 'GRAIN'
  amount: number // In cents
}

/**
 * Create GRAIN wallet for user
 *
 * Creates a new wallet on Base L2 and registers it in our system.
 * Uses Circle API for wallet creation.
 *
 * @param request - Wallet creation request
 * @returns Wallet creation result
 */
export async function createWallet(
  request: CreateWalletRequest
): Promise<CreateWalletResult> {
  try {
    // TODO: Implement actual wallet creation when smart contracts deployed
    // For now, return mock wallet

    // In production, this would:
    // 1. Call Circle API to create wallet
    // 2. Or generate new Ethereum keypair
    // 3. Register wallet in database
    // 4. Optionally fund with initial deposit

    const mockAddress = `0x${Math.random().toString(16).substring(2, 42)}`

    const wallet: WalletStatus = {
      address: mockAddress,
      grainBalance: 0,
      usdcBalance: request.initialDepositUSDC || 0,
      isVerified: false, // Requires KYB verification
      creditLineAvailable: 0,
      creditLineUsed: 0,
      createdAt: new Date().toISOString()
    }

    // If initial deposit, open credit line (1:1)
    if (request.initialDepositUSDC && request.initialDepositUSDC > 0) {
      wallet.creditLineAvailable = request.initialDepositUSDC
    }

    return {
      success: true,
      wallet,
      message: `Wallet created successfully. Complete KYB verification to unlock in-network pricing.`
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to create wallet'
    }
  }
}

/**
 * Fund wallet with USDC
 *
 * Deposits USDC into wallet, optionally swaps to GRAIN.
 * Opens/expands credit line based on deposit.
 *
 * @param request - Fund wallet request
 * @returns Fund result
 */
export async function fundWallet(
  request: FundWalletRequest
): Promise<FundWalletResult> {
  try {
    // TODO: Implement actual funding when integrated with Circle
    // For now, return mock result

    // In production, this would:
    // 1. Call Circle API to deposit USDC
    // 2. Optionally swap USDC to GRAIN via DEX
    // 3. Update credit line based on new deposit
    // 4. Wait for transaction confirmation

    const txHash = `0x${Math.random().toString(16).substring(2)}`
    let grainReceived = 0

    if (request.autoSwapToGrain) {
      // Swap USDC to GRAIN (1:1 minus minimal gas)
      grainReceived = Math.round(request.amountUSDC * 0.999) // 0.1% slippage
    }

    return {
      success: true,
      transactionHash: txHash,
      grainReceived,
      usdcDeposited: request.amountUSDC
    }
  } catch (error) {
    return {
      success: false,
      usdcDeposited: request.amountUSDC,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get wallet balance
 *
 * Retrieves current balance from Base L2.
 *
 * @param address - Wallet address
 * @returns Wallet status
 */
export async function getWalletBalance(
  address: string
): Promise<WalletStatus | null> {
  try {
    // TODO: Implement actual balance check when smart contracts deployed
    // For now, return mock data

    // In production, this would:
    // 1. Call Base L2 RPC to get GRAIN balance
    // 2. Call Base L2 RPC to get USDC balance
    // 3. Query database for credit line info
    // 4. Query database for verification status

    // Mock wallet for testing
    const wallet: WalletStatus = {
      address,
      grainBalance: 10000, // $100
      usdcBalance: 50000, // $500
      isVerified: false,
      creditLineAvailable: 50000, // $500 credit (1:1 with deposit)
      creditLineUsed: 0,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
    }

    return wallet
  } catch (error) {
    console.error('Error fetching wallet balance:', error)
    return null
  }
}

/**
 * Calculate credit line for user
 *
 * Determines credit multiplier based on transaction history.
 *
 * @param userId - User ID
 * @param totalDeposited - Total USDC deposited (cents)
 * @returns Credit line info
 */
export async function calculateCreditLine(
  userId: string,
  totalDeposited: number
): Promise<CreditLineInfo> {
  // TODO: Query actual transaction history from database
  // For now, use mock data

  const mockTransactionCount = 5
  const mockMonthsHistory = 2
  const mockOnTimePaymentRate = 0.90 // 90%

  // Determine tier
  let tier: 1 | 2 | 3 = 1
  let multiplier = CREDIT_LINE_CONFIG.TIER_1.multiplier
  let terms = CREDIT_LINE_CONFIG.TIER_1.terms
  let upgradeRequirements: string[] | undefined

  if (
    mockTransactionCount >= CREDIT_LINE_CONFIG.TIER_3.requirements.minTransactions &&
    mockMonthsHistory >= CREDIT_LINE_CONFIG.TIER_3.requirements.minMonthsHistory &&
    mockOnTimePaymentRate >= CREDIT_LINE_CONFIG.TIER_3.requirements.minOnTimePaymentRate
  ) {
    tier = 3
    multiplier = CREDIT_LINE_CONFIG.TIER_3.multiplier
    terms = CREDIT_LINE_CONFIG.TIER_3.terms
  } else if (
    mockTransactionCount >= CREDIT_LINE_CONFIG.TIER_2.requirements.minTransactions &&
    mockMonthsHistory >= CREDIT_LINE_CONFIG.TIER_2.requirements.minMonthsHistory &&
    mockOnTimePaymentRate >= CREDIT_LINE_CONFIG.TIER_2.requirements.minOnTimePaymentRate
  ) {
    tier = 2
    multiplier = CREDIT_LINE_CONFIG.TIER_2.multiplier
    terms = CREDIT_LINE_CONFIG.TIER_2.terms
    upgradeRequirements = [
      `Complete ${CREDIT_LINE_CONFIG.TIER_3.requirements.minTransactions - mockTransactionCount} more transactions`,
      `Maintain ${(CREDIT_LINE_CONFIG.TIER_3.requirements.minOnTimePaymentRate * 100).toFixed(0)}% on-time payment rate`,
      `Build ${CREDIT_LINE_CONFIG.TIER_3.requirements.minMonthsHistory - mockMonthsHistory} more months of history`
    ]
  } else {
    tier = 1
    multiplier = CREDIT_LINE_CONFIG.TIER_1.multiplier
    terms = CREDIT_LINE_CONFIG.TIER_1.terms
    upgradeRequirements = [
      `Complete ${CREDIT_LINE_CONFIG.TIER_2.requirements.minTransactions - mockTransactionCount} more transactions`,
      `Maintain ${(CREDIT_LINE_CONFIG.TIER_2.requirements.minOnTimePaymentRate * 100).toFixed(0)}% on-time payment rate`,
      `Build ${CREDIT_LINE_CONFIG.TIER_2.requirements.minMonthsHistory - mockMonthsHistory} more months of history`
    ]
  }

  const creditLineTotal = Math.round(totalDeposited * multiplier)
  const creditUsed = 0 // TODO: Query from database
  const creditAvailable = creditLineTotal - creditUsed

  return {
    userId,
    totalDeposited,
    creditMultiplier: multiplier,
    creditLineTotal,
    creditUsed,
    creditAvailable,
    interestRate: terms.interestRateAPR,
    daysUntilInterest: terms.interestFreeDays,
    tier,
    upgradeRequirements
  }
}

/**
 * Swap USDC <-> GRAIN
 *
 * Uses Base L2 DEX to swap between tokens.
 *
 * @param request - Swap request
 * @returns Transaction hash
 */
export async function swapTokens(
  request: SwapRequest
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  try {
    // TODO: Implement actual swap when integrated with Uniswap/DEX
    // For now, return mock result

    // In production, this would:
    // 1. Calculate optimal swap route
    // 2. Execute swap via Uniswap V3 on Base L2
    // 3. Wait for confirmation
    // 4. Return transaction hash

    const txHash = `0x${Math.random().toString(16).substring(2)}`

    return {
      success: true,
      transactionHash: txHash
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Auto-swap USDC to GRAIN if balance low
 *
 * Maintains minimum GRAIN balance for transactions.
 *
 * @param walletAddress - Wallet address
 * @returns Swap result if executed
 */
export async function autoSwapIfNeeded(
  walletAddress: string
): Promise<{ swapped: boolean; amount?: number }> {
  const wallet = await getWalletBalance(walletAddress)

  if (!wallet) {
    return { swapped: false }
  }

  // Check if GRAIN balance below threshold
  if (wallet.grainBalance < WALLET_CONFIG.AUTO_SWAP_THRESHOLD) {
    // Check if enough USDC to swap
    const swapAmount = WALLET_CONFIG.AUTO_SWAP_THRESHOLD - wallet.grainBalance

    if (wallet.usdcBalance >= swapAmount) {
      const result = await swapTokens({
        walletAddress,
        fromToken: 'USDC',
        toToken: 'GRAIN',
        amount: swapAmount
      })

      if (result.success) {
        return { swapped: true, amount: swapAmount }
      }
    }
  }

  return { swapped: false }
}

/**
 * Verify wallet (KYB check)
 *
 * Marks wallet as verified after KYB/KYC completion.
 *
 * @param walletAddress - Wallet address
 * @param userId - User ID
 * @returns Success status
 */
export async function verifyWallet(
  walletAddress: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // TODO: Integrate with KYB provider (e.g., Persona, Alloy)
    // For now, just return success

    // In production, this would:
    // 1. Check KYB status from provider
    // 2. Update wallet verification status in database
    // 3. Enable in-network pricing eligibility

    return {
      success: true
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Format wallet info for display
 */
export function formatWalletInfo(wallet: WalletStatus): string {
  const lines = [
    `Wallet: ${wallet.address}`,
    ``,
    `Balances:`,
    `  GRAIN: $${(wallet.grainBalance / 100).toFixed(2)}`,
    `  USDC: $${(wallet.usdcBalance / 100).toFixed(2)}`,
    ``,
    `Status: ${wallet.isVerified ? 'Verified ✓' : 'Unverified (KYB required)'}`,
    ``,
    `Credit Line:`,
    `  Available: $${(wallet.creditLineAvailable / 100).toFixed(2)}`,
    `  Used: $${(wallet.creditLineUsed / 100).toFixed(2)}`,
    ``,
    `Created: ${new Date(wallet.createdAt).toLocaleDateString()}`
  ]

  return lines.join('\n')
}

/**
 * Format credit line info for display
 */
export function formatCreditLineInfo(info: CreditLineInfo): string {
  const lines = [
    `Credit Line Summary`,
    ``,
    `Tier: ${info.tier} (${info.creditMultiplier}:1 leverage)`,
    `Total Deposited: $${(info.totalDeposited / 100).toFixed(2)}`,
    `Credit Line Total: $${(info.creditLineTotal / 100).toFixed(2)}`,
    `Credit Used: $${(info.creditUsed / 100).toFixed(2)}`,
    `Credit Available: $${(info.creditAvailable / 100).toFixed(2)}`,
    ``,
    `Terms:`,
    `  Interest Rate: ${(info.interestRate * 100).toFixed(1)}% APR`,
    `  Interest-Free Days: ${info.daysUntilInterest}`
  ]

  if (info.upgradeRequirements && info.upgradeRequirements.length > 0) {
    lines.push(``)
    lines.push(`To Upgrade to Tier ${info.tier + 1}:`)
    info.upgradeRequirements.forEach((req) => lines.push(`  - ${req}`))
  }

  return lines.join('\n')
}

/**
 * Validate wallet address format
 */
export function isValidWalletAddress(address: string): boolean {
  // Check if valid Ethereum address
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Get wallet creation instructions
 *
 * Returns step-by-step guide for users.
 */
export function getWalletCreationInstructions(): string {
  return `
How to Create Your GRAIN Wallet:

1. Click "Create Wallet" below
2. We'll generate a secure wallet on Base L2 (Coinbase Layer 2)
3. Complete KYB verification (required for in-network pricing)
4. Fund your wallet with USDC (min $100 recommended)
5. Start transacting at 0.33% fees!

Benefits:
✓ 0.33% fees (vs 3.3% or 7%)
✓ 1:1 credit line (pay $100K, get $100K credit)
✓ Instant settlements on-chain
✓ Multi-currency export (USD, EUR, GBP, etc.)

Need help? Contact support@wellsai.com
  `.trim()
}
