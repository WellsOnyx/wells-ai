/**
 * Circle Programmable Wallets (W3S)
 *
 * Developer-controlled wallets for USDC custody and transfers.
 *
 * Key Concepts:
 * - Wallet Set: Collection of wallets (one per app/environment)
 * - Developer Wallets: Controlled by your app, not end users
 * - Entity Secret: Required for signing sensitive operations
 *
 * Endpoints used:
 * - POST /v1/w3s/developer/wallets - Create wallet
 * - GET /v1/w3s/wallets/{id} - Get wallet details
 * - GET /v1/w3s/wallets/{id}/balances - Get wallet balances
 * - POST /v1/w3s/developer/transactions/transfer - Transfer tokens
 * - GET /v1/w3s/transactions/{id} - Get transaction status
 *
 * Docs: https://developers.circle.com/w3s/reference/createwallet
 */

import crypto from 'crypto'
import { CIRCLE_CONFIG, circleRequest, generateIdempotencyKey } from './config'

// =============================================================================
// TYPES
// =============================================================================

export interface W3SWallet {
  id: string
  state: 'LIVE' | 'FROZEN'
  walletSetId: string
  custodyType: 'DEVELOPER' | 'ENDUSER'
  address: string
  blockchain: string
  accountType: string
  createDate: string
  updateDate: string
}

export interface W3SBalance {
  token: {
    id: string
    name: string
    symbol: string
    decimals: number
    blockchain: string
    tokenAddress?: string
  }
  amount: string
  updateDate: string
}

export interface W3STransfer {
  id: string
  state: 'INITIATED' | 'PENDING_RISK_SCREENING' | 'DENIED' | 'QUEUED' | 'SENT' | 'CONFIRMED' | 'COMPLETE' | 'FAILED' | 'CANCELLED'
  amounts: string[]
  tokenId: string
  sourceWalletId: string
  destinationAddress: string
  blockchain: string
  transactionType: 'OUTBOUND' | 'INBOUND'
  txHash?: string
  errorReason?: string
  createDate: string
  updateDate: string
}

// =============================================================================
// ENTITY SECRET ENCRYPTION
// =============================================================================

/**
 * Encrypt entity secret for Circle API
 *
 * Circle requires the entity secret to be encrypted with their public key
 * for sensitive operations like wallet creation and transfers.
 */
async function encryptEntitySecret(): Promise<string> {
  const entitySecret = CIRCLE_CONFIG.w3s.entitySecret

  if (!entitySecret) {
    throw new Error('CIRCLE_ENTITY_SECRET is not configured')
  }

  // For production, you need to encrypt with Circle's public key
  // For sandbox, we can use the raw entity secret (hex encoded)
  // Check Circle docs for the exact encryption method

  // In sandbox, Circle accepts the entity secret directly in some cases
  // For production, implement proper encryption with Circle's RSA public key
  if (CIRCLE_CONFIG.environment === 'sandbox') {
    // Return as hex for sandbox
    return entitySecret
  }

  // Production encryption (implement based on Circle docs)
  // This would use Circle's public key to encrypt the entity secret
  // For now, return as-is (you'll need to implement proper encryption)
  return entitySecret
}

// =============================================================================
// WALLET OPERATIONS
// =============================================================================

/**
 * Create a new developer-controlled wallet
 */
export async function createWallet(params: {
  userId: string
  blockchain?: string
}): Promise<{ success: boolean; wallet?: W3SWallet; error?: string }> {
  const { userId, blockchain = CIRCLE_CONFIG.defaultChain } = params

  const idempotencyKey = generateIdempotencyKey('wallet', userId)

  try {
    const entitySecretCiphertext = await encryptEntitySecret()

    const response = await circleRequest<{ wallets: W3SWallet[] }>(
      '/w3s/developer/wallets',
      {
        method: 'POST',
        body: {
          idempotencyKey,
          entitySecretCiphertext,
          walletSetId: CIRCLE_CONFIG.w3s.walletSetId,
          blockchains: [blockchain],
          count: 1,
          metadata: [
            { name: 'userId', refId: userId },
          ],
        },
      }
    )

    if (!response.success || !response.data?.wallets?.[0]) {
      return {
        success: false,
        error: response.error || 'Failed to create wallet',
      }
    }

    return {
      success: true,
      wallet: response.data.wallets[0],
    }
  } catch (error: any) {
    console.error('[W3S] Create wallet error:', error)
    return {
      success: false,
      error: error.message || 'Failed to create wallet',
    }
  }
}

/**
 * Get wallet details
 */
export async function getWallet(
  walletId: string
): Promise<{ success: boolean; wallet?: W3SWallet; error?: string }> {
  const response = await circleRequest<{ wallet: W3SWallet }>(
    `/w3s/wallets/${walletId}`
  )

  if (!response.success || !response.data?.wallet) {
    return {
      success: false,
      error: response.error || 'Wallet not found',
    }
  }

  return {
    success: true,
    wallet: response.data.wallet,
  }
}

/**
 * Get wallet balances
 */
export async function getWalletBalances(
  walletId: string
): Promise<{ success: boolean; balances?: W3SBalance[]; error?: string }> {
  const response = await circleRequest<{ tokenBalances: W3SBalance[] }>(
    `/w3s/wallets/${walletId}/balances`
  )

  if (!response.success) {
    return {
      success: false,
      error: response.error || 'Failed to get balances',
    }
  }

  return {
    success: true,
    balances: response.data?.tokenBalances || [],
  }
}

/**
 * Get USDC balance for a wallet
 */
export async function getUSDCBalance(walletId: string): Promise<number> {
  const result = await getWalletBalances(walletId)

  if (!result.success || !result.balances) {
    return 0
  }

  // Find USDC balance
  const usdcBalance = result.balances.find(
    b => b.token.symbol === 'USDC' || b.token.symbol === 'USD'
  )

  return usdcBalance ? parseFloat(usdcBalance.amount) : 0
}

// =============================================================================
// TRANSFER OPERATIONS
// =============================================================================

/**
 * Transfer USDC from one wallet to an address
 */
export async function transferUSDC(params: {
  fromWalletId: string
  toAddress: string
  amount: number
  userId?: string
  refId?: string
}): Promise<{ success: boolean; transfer?: W3STransfer; error?: string }> {
  const { fromWalletId, toAddress, amount, userId, refId } = params

  if (amount <= 0) {
    return { success: false, error: 'Amount must be positive' }
  }

  const idempotencyKey = generateIdempotencyKey('transfer', userId || fromWalletId, refId || '')

  try {
    const entitySecretCiphertext = await encryptEntitySecret()

    // Get USDC token ID for the blockchain
    // This varies by chain - you may need to fetch from Circle or configure
    const usdcTokenId = CIRCLE_CONFIG.defaultChain === 'BASE'
      ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // Base mainnet USDC
      : '0x036CbD53842c5426634e7929541eC2318f3dCF7e' // Base Sepolia USDC

    const response = await circleRequest<{ transfer: W3STransfer }>(
      '/w3s/developer/transactions/transfer',
      {
        method: 'POST',
        body: {
          idempotencyKey,
          entitySecretCiphertext,
          walletId: fromWalletId,
          destinationAddress: toAddress,
          amounts: [amount.toFixed(2)],
          tokenAddress: usdcTokenId,
          blockchain: CIRCLE_CONFIG.defaultChain,
          feeLevel: 'MEDIUM', // SLOW, MEDIUM, FAST
        },
      }
    )

    if (!response.success || !response.data?.transfer) {
      return {
        success: false,
        error: response.error || 'Failed to create transfer',
      }
    }

    return {
      success: true,
      transfer: response.data.transfer,
    }
  } catch (error: any) {
    console.error('[W3S] Transfer error:', error)
    return {
      success: false,
      error: error.message || 'Failed to transfer',
    }
  }
}

/**
 * Get transfer status
 */
export async function getTransferStatus(
  transferId: string
): Promise<{ success: boolean; transfer?: W3STransfer; error?: string }> {
  const response = await circleRequest<{ transaction: W3STransfer }>(
    `/w3s/transactions/${transferId}`
  )

  if (!response.success || !response.data?.transaction) {
    return {
      success: false,
      error: response.error || 'Transfer not found',
    }
  }

  return {
    success: true,
    transfer: response.data.transaction,
  }
}

// =============================================================================
// MASTER WALLET OPERATIONS
// =============================================================================

/**
 * Get master wallet balance (aggregate of all user deposits)
 */
export async function getMasterWalletBalance(): Promise<{
  success: boolean
  usdcBalance?: number
  walletId?: string
  walletAddress?: string
  error?: string
}> {
  const masterWalletId = CIRCLE_CONFIG.w3s.masterWalletId

  if (!masterWalletId) {
    return {
      success: false,
      error: 'Master wallet not configured',
    }
  }

  const balance = await getUSDCBalance(masterWalletId)

  return {
    success: true,
    usdcBalance: balance,
    walletId: masterWalletId,
    walletAddress: CIRCLE_CONFIG.w3s.masterWalletAddress,
  }
}

/**
 * Transfer from master wallet to user (withdrawal)
 */
export async function withdrawFromMaster(params: {
  toAddress: string
  amount: number
  userId: string
  refId?: string
}): Promise<{ success: boolean; transfer?: W3STransfer; error?: string }> {
  const masterWalletId = CIRCLE_CONFIG.w3s.masterWalletId

  if (!masterWalletId) {
    return { success: false, error: 'Master wallet not configured' }
  }

  return transferUSDC({
    fromWalletId: masterWalletId,
    toAddress: params.toAddress,
    amount: params.amount,
    userId: params.userId,
    refId: params.refId,
  })
}

// =============================================================================
// WEBHOOK PROCESSING
// =============================================================================

export interface W3SWebhookEvent {
  subscriptionId: string
  notificationId: string
  notificationType: string
  notification: {
    id: string
    blockchain: string
    walletId: string
    tokenId: string
    userId: string
    destinationAddress: string
    amounts: string[]
    nftTokenIds: string[]
    refId: string
    state: string
    txHash: string
    errorReason: string | null
    createDate: string
    updateDate: string
  }
}

/**
 * Parse W3S webhook event
 */
export function parseW3SWebhook(payload: any): {
  type: 'transfer' | 'wallet' | 'unknown'
  notificationId: string
  transferId?: string
  walletId?: string
  state?: string
  amount?: number
  txHash?: string
  userId?: string
} {
  const notificationType = payload.notificationType || ''
  const notification = payload.notification || {}

  if (notificationType.includes('transaction') || notificationType.includes('transfer')) {
    return {
      type: 'transfer',
      notificationId: payload.notificationId,
      transferId: notification.id,
      walletId: notification.walletId,
      state: notification.state,
      amount: notification.amounts?.[0] ? parseFloat(notification.amounts[0]) : undefined,
      txHash: notification.txHash,
      userId: notification.userId,
    }
  }

  if (notificationType.includes('wallet')) {
    return {
      type: 'wallet',
      notificationId: payload.notificationId,
      walletId: notification.id,
      state: notification.state,
    }
  }

  return {
    type: 'unknown',
    notificationId: payload.notificationId || '',
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // Wallet operations
  createWallet,
  getWallet,
  getWalletBalances,
  getUSDCBalance,

  // Transfer operations
  transferUSDC,
  getTransferStatus,

  // Master wallet
  getMasterWalletBalance,
  withdrawFromMaster,

  // Webhooks
  parseW3SWebhook,
}
