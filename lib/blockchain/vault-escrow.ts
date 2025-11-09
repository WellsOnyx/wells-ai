/**
 * Vault Escrow System with Circle USDC
 *
 * Secure escrow for all Wells transactions
 * - Buyer funds held in smart contract until delivery confirmed
 * - Seller receives payment automatically on completion
 * - Dispute resolution with multi-sig
 */

export interface VaultConfig {
  contractAddress: string
  usdcAddress: string
  circleAPIKey: string
  networkId: number
  confirmationsRequired: number
  escrowFeePercent: number
  disputeTimeWindow: number // hours
}

export const VAULT_CONFIG: VaultConfig = {
  contractAddress: process.env.VAULT_CONTRACT_ADDRESS || '0x...',
  usdcAddress: process.env.USDC_CONTRACT_ADDRESS || '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // Mainnet USDC
  circleAPIKey: process.env.CIRCLE_API_KEY || '',
  networkId: parseInt(process.env.BLOCKCHAIN_NETWORK_ID || '1'), // 1 = Ethereum mainnet
  confirmationsRequired: 3,
  escrowFeePercent: 2.5, // 2.5% escrow fee
  disputeTimeWindow: 72  // 72 hours to raise dispute
}

export interface EscrowTransaction {
  id: string
  buyerId: string
  sellerId: string
  amount: string // USDC amount
  amountUSD: number
  description: string
  status: 'created' | 'funded' | 'in_progress' | 'completed' | 'disputed' | 'refunded' | 'cancelled'
  txHash?: string
  fundedAt?: Date
  completedAt?: Date
  disputedAt?: Date
  createdAt: Date
  metadata?: {
    rfqId?: string
    dealId?: string
    jobId?: string
  }
}

export interface EscrowRelease {
  escrowId: string
  releaseType: 'full' | 'partial' | 'refund'
  amount: string
  recipient: string
  reason: string
  approvedBy: string[]
  txHash?: string
  releasedAt: Date
}

export interface DisputeResolution {
  escrowId: string
  initiatedBy: 'buyer' | 'seller'
  reason: string
  evidence: string[]
  resolution: 'buyer_favor' | 'seller_favor' | 'split' | 'pending'
  resolvedBy?: string
  resolvedAt?: Date
  notes?: string
}

/**
 * Calculate total escrow amount including fees
 */
export function calculateEscrowTotal(amount: number): {
  principal: number
  escrowFee: number
  total: number
} {
  const escrowFee = amount * (VAULT_CONFIG.escrowFeePercent / 100)
  return {
    principal: amount,
    escrowFee,
    total: amount + escrowFee
  }
}

/**
 * Check if dispute window is still open
 */
export function isDisputeWindowOpen(completedAt: Date): boolean {
  const hoursElapsed = (Date.now() - completedAt.getTime()) / 1000 / 60 / 60
  return hoursElapsed < VAULT_CONFIG.disputeTimeWindow
}

/**
 * Generate escrow contract call data
 */
export function generateEscrowData(escrow: EscrowTransaction) {
  return {
    buyer: escrow.buyerId,
    seller: escrow.sellerId,
    amount: escrow.amount,
    escrowId: escrow.id,
    metadata: JSON.stringify(escrow.metadata || {})
  }
}

/**
 * Circle USDC Transfer
 */
export interface CircleTransfer {
  source: {
    type: 'wallet' | 'blockchain'
    id?: string
    address?: string
  }
  destination: {
    type: 'wallet' | 'blockchain'
    address: string
    chain: 'ETH' | 'MATIC' | 'AVAX'
  }
  amount: {
    amount: string
    currency: 'USD'
  }
  idempotencyKey: string
}

/**
 * Create Circle transfer payload
 */
export function createCircleTransfer(
  fromAddress: string,
  toAddress: string,
  amount: string,
  chain: 'ETH' | 'MATIC' | 'AVAX' = 'ETH'
): CircleTransfer {
  return {
    source: {
      type: 'blockchain',
      address: fromAddress
    },
    destination: {
      type: 'blockchain',
      address: toAddress,
      chain
    },
    amount: {
      amount,
      currency: 'USD'
    },
    idempotencyKey: `escrow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * Multi-signature approval for escrow release
 */
export interface MultiSigApproval {
  escrowId: string
  requiredSignatures: number
  signatures: {
    signer: string
    signature: string
    timestamp: Date
  }[]
  approved: boolean
}

/**
 * Check if multi-sig threshold is met
 */
export function isMultiSigApproved(approval: MultiSigApproval): boolean {
  return approval.signatures.length >= approval.requiredSignatures
}

export default VAULT_CONFIG
