/**
 * Circle Programmable Wallets Client
 *
 * Integrates Circle's Web3 Services for real USDC transactions
 * Uses Circle SDK for developer-controlled wallets
 * https://developers.circle.com/circle-mint/docs/programmable-wallets-introduction
 */

import { Circle, CircleEnvironments } from '@circle-fin/circle-sdk'

// ============================================================================
// CONFIGURATION
// ============================================================================

const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY || ''

if (!CIRCLE_API_KEY) {
  console.warn('WARNING: CIRCLE_API_KEY not set. Circle integration will not work.')
}

// Circle environment
const CIRCLE_ENVIRONMENT = (process.env.CIRCLE_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production'

// Circle Blockchain IDs
export const CIRCLE_CHAINS = {
  BASE: 'BASE',
  BASE_SEPOLIA: 'BASE-SEPOLIA',
  ETHEREUM: 'ETH',
  ETHEREUM_SEPOLIA: 'ETH-SEPOLIA',
  POLYGON: 'MATIC',
  POLYGON_AMOY: 'MATIC-AMOY',
} as const

export type CircleChain = typeof CIRCLE_CHAINS[keyof typeof CIRCLE_CHAINS]

// USDC Contract Addresses
export const USDC_ADDRESSES = {
  [CIRCLE_CHAINS.BASE]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  [CIRCLE_CHAINS.BASE_SEPOLIA]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  [CIRCLE_CHAINS.ETHEREUM]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  [CIRCLE_CHAINS.ETHEREUM_SEPOLIA]: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  [CIRCLE_CHAINS.POLYGON]: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  [CIRCLE_CHAINS.POLYGON_AMOY]: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
} as const

// Default blockchain for GRAIN/USDC operations
const DEFAULT_CHAIN: CircleChain = CIRCLE_CHAINS.BASE

// ============================================================================
// TYPES
// ============================================================================

export interface CircleWallet {
  id: string
  walletId: string
  address: string
  blockchain: CircleChain
  createDate: string
  updateDate: string
  state: 'LIVE' | 'FROZEN'
}

export interface CircleBalance {
  token: string
  amount: string
}

export interface CircleTransfer {
  id: string
  blockchain: string
  tokenId?: string
  walletId: string
  sourceAddress?: string
  destinationAddress?: string
  transactionType: 'OUTBOUND' | 'INBOUND'
  state: 'INITIATED' | 'PENDING_RISK_SCREENING' | 'QUEUED' | 'SENT' | 'CONFIRMED' | 'COMPLETE' | 'FAILED' | 'CANCELLED'
  amounts?: string[]
  txHash?: string
  blockHash?: string
  blockHeight?: number
  networkFee?: string
  firstConfirmDate?: string
  errorReason?: string
  refId?: string
  createDate: string
  updateDate: string
}

export interface CreateWalletParams {
  userId: string
  description?: string
  blockchain?: CircleChain
}

export interface TransferUSDCParams {
  fromWalletId: string
  toAddress: string
  amount: string
  userId?: string
  refId?: string
}

export interface TransactionStatus {
  id: string
  status: 'pending' | 'confirmed' | 'complete' | 'failed' | 'cancelled'
  txHash?: string
  blockHeight?: number
  errorReason?: string
}

// ============================================================================
// CIRCLE CLIENT
// ============================================================================

export class CircleClient {
  private circle: Circle

  constructor(apiKey?: string) {
    const key = apiKey || CIRCLE_API_KEY

    if (!key) {
      throw new Error('Circle API key is required')
    }

    // Initialize Circle SDK
    this.circle = new Circle(
      key,
      CIRCLE_ENVIRONMENT === 'production'
        ? CircleEnvironments.production
        : CircleEnvironments.sandbox
    )
  }

  /**
   * Create a new Circle wallet for a user
   */
  async createWallet(params: CreateWalletParams): Promise<CircleWallet> {
    try {
      const { userId, description } = params

      // Create wallet using Circle SDK
      const response = await this.circle.wallets.createWallet({
        idempotencyKey: `wallet_${userId}_${Date.now()}`,
        description: description || `Wallet for ${userId}`,
      })

      if (!response.data?.wallet) {
        throw new Error('Failed to create wallet: No wallet returned')
      }

      const wallet = response.data.wallet

      // Generate blockchain address for the wallet
      const addressResponse = await this.circle.wallets.generateAddress(wallet.walletId!)

      if (!addressResponse.data?.address) {
        throw new Error('Failed to generate address for wallet')
      }

      return {
        id: wallet.walletId!,
        walletId: wallet.walletId!,
        address: addressResponse.data.address,
        blockchain: DEFAULT_CHAIN,
        createDate: wallet.createDate || new Date().toISOString(),
        updateDate: wallet.updateDate || new Date().toISOString(),
        state: (wallet.state as 'LIVE' | 'FROZEN') || 'LIVE',
      }
    } catch (error) {
      console.error('Error creating Circle wallet:', error)
      throw new Error(`Failed to create wallet: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get wallet balance (USDC)
   */
  async getWalletBalance(walletId: string): Promise<number> {
    try {
      const response = await this.circle.wallets.getWallet(walletId)

      if (!response.data?.wallet?.balances) {
        return 0
      }

      // Find USDC balance
      const usdcBalance = response.data.wallet.balances.find(
        (balance: any) => balance.currency === 'USD'
      )

      return usdcBalance ? parseFloat(usdcBalance.amount || '0') : 0
    } catch (error) {
      console.error('Error getting wallet balance:', error)
      throw new Error(`Failed to get wallet balance: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get wallet details
   */
  async getWallet(walletId: string): Promise<CircleWallet> {
    try {
      const response = await this.circle.wallets.getWallet(walletId)

      if (!response.data?.wallet) {
        throw new Error('Wallet not found')
      }

      const wallet = response.data.wallet

      return {
        id: wallet.walletId!,
        walletId: wallet.walletId!,
        address: wallet.address || '',
        blockchain: DEFAULT_CHAIN,
        createDate: wallet.createDate || new Date().toISOString(),
        updateDate: wallet.updateDate || new Date().toISOString(),
        state: (wallet.state as 'LIVE' | 'FROZEN') || 'LIVE',
      }
    } catch (error) {
      console.error('Error getting wallet:', error)
      throw new Error(`Failed to get wallet: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Initiate USDC transfer from one wallet to another
   */
  async initiateTransfer(params: TransferUSDCParams): Promise<CircleTransfer> {
    try {
      const { fromWalletId, toAddress, amount, refId } = params

      // Initiate transfer using Circle SDK
      const response = await this.circle.transfers.createTransfer({
        idempotencyKey: refId || `transfer_${Date.now()}`,
        source: {
          type: 'wallet',
          id: fromWalletId,
        },
        destination: {
          type: 'blockchain',
          address: toAddress,
          chain: 'BASE', // Using BASE L2 for low fees
        },
        amount: {
          amount: amount,
          currency: 'USD',
        },
      })

      if (!response.data?.transfer) {
        throw new Error('Failed to initiate transfer: No transfer returned')
      }

      const transfer = response.data.transfer

      return {
        id: transfer.id!,
        blockchain: 'BASE',
        walletId: fromWalletId,
        sourceAddress: transfer.source?.address,
        destinationAddress: transfer.destination?.address || toAddress,
        transactionType: 'OUTBOUND',
        state: (transfer.status as CircleTransfer['state']) || 'INITIATED',
        amounts: [amount],
        txHash: transfer.transactionHash,
        errorReason: transfer.errorCode,
        refId: refId,
        createDate: transfer.createDate || new Date().toISOString(),
        updateDate: new Date().toISOString(),
      }
    } catch (error) {
      console.error('Error initiating transfer:', error)
      throw new Error(`Failed to initiate transfer: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(transferId: string): Promise<TransactionStatus> {
    try {
      const response = await this.circle.transfers.getTransfer(transferId)

      if (!response.data?.transfer) {
        throw new Error('Transfer not found')
      }

      const transfer = response.data.transfer

      // Map Circle transfer status to our simplified status
      let status: TransactionStatus['status']
      switch (transfer.status) {
        case 'pending':
          status = 'pending'
          break
        case 'confirmed':
          status = 'confirmed'
          break
        case 'complete':
          status = 'complete'
          break
        case 'failed':
          status = 'failed'
          break
        default:
          status = 'pending'
      }

      return {
        id: transfer.id!,
        status,
        txHash: transfer.transactionHash,
        errorReason: transfer.errorCode,
      }
    } catch (error) {
      console.error('Error getting transaction status:', error)
      throw new Error(`Failed to get transaction status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * List all wallets
   */
  async listWallets(): Promise<CircleWallet[]> {
    try {
      const response = await this.circle.wallets.listWallets()

      if (!response.data?.wallets) {
        return []
      }

      return response.data.wallets.map((wallet: any) => ({
        id: wallet.walletId!,
        walletId: wallet.walletId!,
        address: wallet.address || '',
        blockchain: DEFAULT_CHAIN,
        createDate: wallet.createDate || new Date().toISOString(),
        updateDate: wallet.updateDate || new Date().toISOString(),
        state: (wallet.state as 'LIVE' | 'FROZEN') || 'LIVE',
      }))
    } catch (error) {
      console.error('Error listing wallets:', error)
      throw new Error(`Failed to list wallets: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get transaction history for a wallet
   */
  async getWalletTransactions(walletId: string): Promise<CircleTransfer[]> {
    try {
      const response = await this.circle.transfers.listTransfers({
        walletId: walletId,
      })

      if (!response.data?.transfers) {
        return []
      }

      return response.data.transfers.map((transfer: any) => ({
        id: transfer.id!,
        blockchain: 'BASE',
        walletId: walletId,
        sourceAddress: transfer.source?.address,
        destinationAddress: transfer.destination?.address,
        transactionType: transfer.source?.type === 'wallet' ? 'OUTBOUND' : 'INBOUND',
        state: (transfer.status as CircleTransfer['state']) || 'INITIATED',
        amounts: [transfer.amount?.amount || '0'],
        txHash: transfer.transactionHash,
        errorReason: transfer.errorCode,
        createDate: transfer.createDate || new Date().toISOString(),
        updateDate: new Date().toISOString(),
      }))
    } catch (error) {
      console.error('Error getting wallet transactions:', error)
      throw new Error(`Failed to get wallet transactions: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let circleClientInstance: CircleClient | null = null

export function getCircleClient(): CircleClient {
  if (!circleClientInstance) {
    circleClientInstance = new CircleClient()
  }
  return circleClientInstance
}

// ============================================================================
// EXPORTS
// ============================================================================

export default CircleClient
