/**
 * Wells AI Transaction Engine
 * Powered by Grain & Vault (Circle SDK)
 *
 * Core principles:
 * - "Yes, proceed" = deal done, money escrowed
 * - Humans never talk directly (AI-to-AI negotiation)
 * - Platform fee: 1.5-2.5% based on deal size + trust scores
 * - GRAIN escrow protection built-in
 *
 * Proverbs 11:1 - "Honest scales and balances belong to the Lord"
 */

import { Circle, CircleEnvironments } from '@circle-fin/circle-sdk'
import { calculateTrustScore, TrustScore } from './trust'

// Initialize Circle SDK
const circle = new Circle(
  process.env.CIRCLE_API_KEY || '',
  process.env.CIRCLE_ENV === 'production'
    ? CircleEnvironments.production
    : CircleEnvironments.sandbox
)

// ============================================================================
// TYPES
// ============================================================================

export type DealStatus =
  | 'proposed'        // AI proposed terms
  | 'negotiating'     // AIs negotiating
  | 'agreed'          // Both AIs agreed
  | 'escrow_pending'  // Awaiting GRAIN deposit
  | 'escrowed'        // GRAIN in escrow wallet
  | 'in_progress'     // Work/delivery in progress
  | 'delivered'       // Seller marked complete
  | 'released'        // GRAIN released to seller
  | 'disputed'        // Under dispute
  | 'cancelled'       // Deal cancelled
  | 'refunded'        // GRAIN returned to buyer

export interface Party {
  id: string
  type: 'buyer' | 'seller'
  name: string
  email: string
  walletId?: string           // Circle wallet ID
  walletAddress?: string      // On-chain address (Base L2)
  trustScore?: TrustScore
}

export interface DealTerms {
  amount: number              // In GRAIN (1 GRAIN = 1 USDC = $1)
  currency: 'GRAIN' | 'USDC'  // Always GRAIN internally
  description: string
  deliverables: string[]
  timeline?: {
    startDate: Date
    endDate: Date
    milestones?: Milestone[]
  }
  metadata?: Record<string, string>
}

export interface Milestone {
  id: string
  description: string
  amount: number              // Portion of total in GRAIN
  dueDate: Date
  status: 'pending' | 'completed' | 'released'
}

export interface Deal {
  id: string
  buyer: Party
  seller: Party
  terms: DealTerms
  status: DealStatus
  platformFee: number         // In GRAIN
  platformFeePercent: number
  escrowWalletId?: string     // Dedicated escrow wallet for this deal
  escrowWalletAddress?: string
  escrowBalance: number       // Current GRAIN in escrow
  transferIds: string[]       // Circle transfer IDs
  createdAt: Date
  updatedAt: Date
  messages: NegotiationMessage[]
}

export interface NegotiationMessage {
  id: string
  from: 'buyer_ai' | 'seller_ai' | 'system'
  content: string
  proposedTerms?: Partial<DealTerms>
  timestamp: Date
}

// ============================================================================
// PLATFORM FEE CALCULATION
// ============================================================================

/**
 * Calculate platform fee based on deal size and trust scores
 *
 * Base rates:
 * - < $10,000: 2.5%
 * - $10,000 - $100,000: 2.0%
 * - $100,000 - $1,000,000: 1.75%
 * - > $1,000,000: 1.5%
 *
 * Trust discount: Up to 0.25% off for high trust scores
 */
export function calculatePlatformFee(
  amount: number,
  buyerTrust: TrustScore,
  sellerTrust: TrustScore
): { feeAmount: number; feePercent: number } {
  // Base rate by deal size (amount in GRAIN/USDC)
  let basePercent: number

  if (amount < 10000) {         // < $10k
    basePercent = 0.025
  } else if (amount < 100000) { // < $100k
    basePercent = 0.020
  } else if (amount < 1000000) { // < $1M
    basePercent = 0.0175
  } else {                       // $1M+
    basePercent = 0.015
  }

  // Trust discount (average of both parties' scores)
  const avgTrustScore = (buyerTrust.overall + sellerTrust.overall) / 2
  const trustDiscount = Math.min(avgTrustScore / 100 * 0.0025, 0.0025) // Max 0.25% discount

  const finalPercent = Math.max(basePercent - trustDiscount, 0.01) // Minimum 1%
  const feeAmount = Math.round(amount * finalPercent * 100) / 100 // Round to 2 decimals

  return {
    feeAmount,
    feePercent: finalPercent * 100 // Return as percentage (e.g., 2.5)
  }
}

// ============================================================================
// GRAIN & VAULT - CIRCLE INTEGRATION
// ============================================================================

/**
 * Create a Circle wallet for a new user
 */
export async function createWallet(party: Omit<Party, 'walletId' | 'walletAddress'>): Promise<{
  walletId: string
  walletAddress: string
}> {
  const response = await circle.wallets.createWallet({
    idempotencyKey: `wallet_${party.id}_${Date.now()}`,
    description: `Wells AI - ${party.name}`,
    // accountType defaults to end_user_wallet
  })

  const wallet = response.data?.data
  if (!wallet) throw new Error('Failed to create wallet')

  // Get the wallet address for Base L2
  const addressResponse = await circle.wallets.generateAddress({
    walletId: wallet.walletId!,
    idempotencyKey: `addr_${party.id}_${Date.now()}`,
    currency: 'USD',
    chain: 'BASE', // Using Base L2 for low fees
  })

  const address = addressResponse.data?.data?.address

  return {
    walletId: wallet.walletId!,
    walletAddress: address || '',
  }
}

/**
 * Create dedicated escrow wallet for a deal
 */
export async function createEscrowWallet(dealId: string): Promise<{
  walletId: string
  walletAddress: string
}> {
  const response = await circle.wallets.createWallet({
    idempotencyKey: `escrow_${dealId}_${Date.now()}`,
    description: `Wells AI Escrow - Deal ${dealId}`,
  })

  const wallet = response.data?.data
  if (!wallet) throw new Error('Failed to create escrow wallet')

  const addressResponse = await circle.wallets.generateAddress({
    walletId: wallet.walletId!,
    idempotencyKey: `escrow_addr_${dealId}_${Date.now()}`,
    currency: 'USD',
    chain: 'BASE',
  })

  return {
    walletId: wallet.walletId!,
    walletAddress: addressResponse.data?.data?.address || '',
  }
}

/**
 * Get wallet balance in USDC (GRAIN equivalent)
 */
export async function getWalletBalance(walletId: string): Promise<number> {
  const response = await circle.wallets.getWallet({ walletId })
  const balances = response.data?.data?.balances || []

  // Find USDC balance
  const usdcBalance = balances.find(b => b.currency === 'USD')
  return parseFloat(usdcBalance?.amount || '0')
}

/**
 * Transfer GRAIN (USDC) between wallets
 */
export async function transferGrain(
  fromWalletId: string,
  toWalletAddress: string,
  amount: number,
  metadata: { dealId: string; type: 'escrow' | 'release' | 'refund' | 'fee' }
): Promise<string> {
  const response = await circle.transfers.createTransfer({
    idempotencyKey: `transfer_${metadata.dealId}_${metadata.type}_${Date.now()}`,
    source: {
      type: 'wallet',
      id: fromWalletId,
    },
    destination: {
      type: 'blockchain',
      address: toWalletAddress,
      chain: 'BASE',
    },
    amount: {
      amount: amount.toFixed(2),
      currency: 'USD',
    },
  })

  return response.data?.data?.id || ''
}

// ============================================================================
// ESCROW OPERATIONS
// ============================================================================

/**
 * Initialize escrow for a deal
 * Creates dedicated escrow wallet
 */
export async function initializeEscrow(deal: Deal): Promise<Deal> {
  if (deal.status !== 'agreed') {
    throw new Error('Deal must be in agreed status to create escrow')
  }

  // Create escrow wallet
  const escrow = await createEscrowWallet(deal.id)

  return {
    ...deal,
    status: 'escrow_pending',
    escrowWalletId: escrow.walletId,
    escrowWalletAddress: escrow.walletAddress,
    updatedAt: new Date(),
    messages: [
      ...deal.messages,
      {
        id: generateMessageId(),
        from: 'system',
        content: `Escrow wallet created. Awaiting ${deal.terms.amount + deal.platformFee} GRAIN deposit.`,
        timestamp: new Date(),
      }
    ]
  }
}

/**
 * Confirm escrow deposit (called after buyer sends GRAIN)
 */
export async function confirmEscrowDeposit(deal: Deal): Promise<Deal> {
  if (!deal.escrowWalletId) {
    throw new Error('No escrow wallet for this deal')
  }

  const balance = await getWalletBalance(deal.escrowWalletId)
  const requiredAmount = deal.terms.amount + deal.platformFee

  if (balance < requiredAmount) {
    throw new Error(`Insufficient escrow balance. Required: ${requiredAmount}, Found: ${balance}`)
  }

  return {
    ...deal,
    status: 'escrowed',
    escrowBalance: deal.terms.amount, // Platform fee already separated
    updatedAt: new Date(),
    messages: [
      ...deal.messages,
      {
        id: generateMessageId(),
        from: 'system',
        content: `Escrow confirmed. ${deal.terms.amount} GRAIN secured. Work may begin.`,
        timestamp: new Date(),
      }
    ]
  }
}

/**
 * Release escrow to seller
 * Called when buyer confirms delivery
 */
export async function releaseEscrow(deal: Deal): Promise<Deal> {
  if (deal.status !== 'delivered' && deal.status !== 'escrowed') {
    throw new Error('Deal must be delivered or escrowed to release funds')
  }

  if (!deal.escrowWalletId || !deal.seller.walletAddress) {
    throw new Error('Missing wallet information')
  }

  // Transfer to seller
  const transferId = await transferGrain(
    deal.escrowWalletId,
    deal.seller.walletAddress,
    deal.terms.amount,
    { dealId: deal.id, type: 'release' }
  )

  return {
    ...deal,
    status: 'released',
    escrowBalance: 0,
    transferIds: [...deal.transferIds, transferId],
    updatedAt: new Date(),
    messages: [
      ...deal.messages,
      {
        id: generateMessageId(),
        from: 'system',
        content: `${deal.terms.amount} GRAIN released to seller. Deal complete.`,
        timestamp: new Date(),
      }
    ]
  }
}

/**
 * Refund escrow to buyer
 */
export async function refundEscrow(
  deal: Deal,
  amount?: number // Partial refund if specified
): Promise<Deal> {
  if (!deal.escrowWalletId || !deal.buyer.walletAddress) {
    throw new Error('Missing wallet information')
  }

  const refundAmount = amount || deal.escrowBalance

  const transferId = await transferGrain(
    deal.escrowWalletId,
    deal.buyer.walletAddress,
    refundAmount,
    { dealId: deal.id, type: 'refund' }
  )

  const newBalance = deal.escrowBalance - refundAmount

  return {
    ...deal,
    status: newBalance === 0 ? 'refunded' : deal.status,
    escrowBalance: newBalance,
    transferIds: [...deal.transferIds, transferId],
    updatedAt: new Date(),
    messages: [
      ...deal.messages,
      {
        id: generateMessageId(),
        from: 'system',
        content: `${refundAmount} GRAIN refunded to buyer.`,
        timestamp: new Date(),
      }
    ]
  }
}

// ============================================================================
// DEAL LIFECYCLE
// ============================================================================

/**
 * Create a new deal proposal
 */
export function proposeDeal(
  buyer: Party,
  seller: Party,
  terms: DealTerms
): Deal {
  const { feeAmount, feePercent } = calculatePlatformFee(
    terms.amount,
    buyer.trustScore || { overall: 50, factors: {}, tier: 'new', badges: [], lastUpdated: new Date() },
    seller.trustScore || { overall: 50, factors: {}, tier: 'new', badges: [], lastUpdated: new Date() }
  )

  const deal: Deal = {
    id: generateDealId(),
    buyer,
    seller,
    terms: { ...terms, currency: 'GRAIN' },
    status: 'proposed',
    platformFee: feeAmount,
    platformFeePercent: feePercent,
    escrowBalance: 0,
    transferIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [{
      id: generateMessageId(),
      from: 'buyer_ai',
      content: `Proposed deal: ${terms.description}`,
      proposedTerms: terms,
      timestamp: new Date(),
    }]
  }

  return deal
}

/**
 * Counter-propose terms
 */
export function counterPropose(
  deal: Deal,
  from: 'buyer_ai' | 'seller_ai',
  newTerms: Partial<DealTerms>,
  message: string
): Deal {
  const updatedTerms = { ...deal.terms, ...newTerms }

  // Recalculate fee if amount changed
  let platformFee = deal.platformFee
  let platformFeePercent = deal.platformFeePercent

  if (newTerms.amount && newTerms.amount !== deal.terms.amount) {
    const feeCalc = calculatePlatformFee(
      newTerms.amount,
      deal.buyer.trustScore || { overall: 50, factors: {}, tier: 'new', badges: [], lastUpdated: new Date() },
      deal.seller.trustScore || { overall: 50, factors: {}, tier: 'new', badges: [], lastUpdated: new Date() }
    )
    platformFee = feeCalc.feeAmount
    platformFeePercent = feeCalc.feePercent
  }

  return {
    ...deal,
    terms: updatedTerms,
    status: 'negotiating',
    platformFee,
    platformFeePercent,
    updatedAt: new Date(),
    messages: [
      ...deal.messages,
      {
        id: generateMessageId(),
        from,
        content: message,
        proposedTerms: newTerms,
        timestamp: new Date(),
      }
    ]
  }
}

/**
 * Accept current terms
 */
export function acceptDeal(
  deal: Deal,
  from: 'buyer_ai' | 'seller_ai'
): Deal {
  const otherParty = from === 'buyer_ai' ? 'seller_ai' : 'buyer_ai'
  const lastMessage = deal.messages[deal.messages.length - 1]

  const isSecondAcceptance =
    lastMessage &&
    lastMessage.from === otherParty &&
    lastMessage.content.toLowerCase().includes('accept')

  return {
    ...deal,
    status: isSecondAcceptance ? 'agreed' : 'negotiating',
    updatedAt: new Date(),
    messages: [
      ...deal.messages,
      {
        id: generateMessageId(),
        from,
        content: isSecondAcceptance
          ? 'Deal agreed! Ready for GRAIN escrow.'
          : 'I accept these terms. Awaiting confirmation.',
        timestamp: new Date(),
      }
    ]
  }
}

/**
 * Mark deal as delivered
 */
export function markDelivered(deal: Deal): Deal {
  if (deal.status !== 'in_progress' && deal.status !== 'escrowed') {
    throw new Error('Deal must be in progress to mark as delivered')
  }

  return {
    ...deal,
    status: 'delivered',
    updatedAt: new Date(),
    messages: [
      ...deal.messages,
      {
        id: generateMessageId(),
        from: 'seller_ai',
        content: 'Delivery complete. Awaiting buyer confirmation to release GRAIN.',
        timestamp: new Date(),
      }
    ]
  }
}

// ============================================================================
// ONE-CLICK ACCEPTANCE
// ============================================================================

/**
 * Process one-click deal acceptance
 * "Yes, proceed" = deal done, GRAIN escrowed
 */
export async function oneClickAccept(
  deal: Deal,
  acceptingParty: 'buyer' | 'seller'
): Promise<{
  deal: Deal
  nextAction: 'deposit_grain' | 'await_other_party' | 'already_escrowed'
  escrowAddress?: string
  totalRequired?: number
}> {
  const aiFrom = acceptingParty === 'buyer' ? 'buyer_ai' : 'seller_ai'
  let updatedDeal = acceptDeal(deal, aiFrom)

  // If deal is now agreed and buyer accepted, initialize escrow
  if (updatedDeal.status === 'agreed' && acceptingParty === 'buyer') {
    updatedDeal = await initializeEscrow(updatedDeal)

    return {
      deal: updatedDeal,
      nextAction: 'deposit_grain',
      escrowAddress: updatedDeal.escrowWalletAddress,
      totalRequired: updatedDeal.terms.amount + updatedDeal.platformFee,
    }
  }

  // If seller accepted and escrow already exists
  if (updatedDeal.status === 'agreed' && acceptingParty === 'seller' && deal.escrowWalletId) {
    return {
      deal: updatedDeal,
      nextAction: 'already_escrowed',
    }
  }

  return {
    deal: updatedDeal,
    nextAction: 'await_other_party',
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function generateDealId(): string {
  return `deal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// ============================================================================
// EXPORTS
// ============================================================================

export const TransactionEngine = {
  // Fee calculation
  calculatePlatformFee,

  // Grain & Vault (Circle)
  createWallet,
  createEscrowWallet,
  getWalletBalance,
  transferGrain,

  // Escrow
  initializeEscrow,
  confirmEscrowDeposit,
  releaseEscrow,
  refundEscrow,

  // Deal lifecycle
  proposeDeal,
  counterPropose,
  acceptDeal,
  markDelivered,

  // One-click magic
  oneClickAccept,
}

export default TransactionEngine
