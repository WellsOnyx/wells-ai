/**
 * Wells AI Escrow System Types
 *
 * Secure escrow for deal payments with USDC via Circle.
 * Holds funds until delivery confirmation.
 */

export type EscrowStatus =
  | 'created'       // Escrow created, awaiting funding
  | 'funded'        // Funds deposited and secured
  | 'released'      // Funds released to seller
  | 'disputed'      // Under dispute resolution
  | 'refunded'      // Funds returned to buyer
  | 'cancelled'     // Escrow cancelled before funding

export type MilestoneStatus =
  | 'pending'       // Awaiting completion
  | 'completed'     // Work completed, awaiting approval
  | 'approved'      // Approved, funds can be released
  | 'rejected'      // Rejected by buyer
  | 'released'      // Funds released for this milestone

export type DisputeStatus =
  | 'open'          // Dispute filed, under review
  | 'investigating' // Active investigation
  | 'resolved'      // Resolved (winner determined)
  | 'withdrawn'     // Dispute withdrawn by filer

export type DisputeResolution =
  | 'buyer_favor'   // Full refund to buyer
  | 'seller_favor'  // Full release to seller
  | 'split'         // Partial refund/release
  | 'withdrawn'     // Dispute withdrawn

export interface EscrowDeal {
  id: string
  dealId: string

  // Parties
  buyerId: string
  buyerEmail: string
  sellerId: string
  sellerEmail: string

  // Amounts
  amount: number              // Total deal amount in USDC
  platformFee: number         // Platform fee in USDC
  totalAmount: number         // amount + platformFee

  // Circle Integration
  escrowWalletId: string      // Circle wallet ID
  escrowWalletAddress: string // Blockchain address
  fundingTransferId?: string  // Circle transfer ID for funding
  releaseTransferId?: string  // Circle transfer ID for release

  // Status
  status: EscrowStatus

  // Wallets
  buyerWalletId?: string
  buyerWalletAddress?: string
  sellerWalletId?: string
  sellerWalletAddress?: string

  // Metadata
  description: string
  metadata: Record<string, any>

  // Milestones (optional multi-stage deals)
  milestones: EscrowMilestone[]

  // Timestamps
  createdAt: Date
  updatedAt: Date
  fundedAt?: Date
  releasedAt?: Date
  refundedAt?: Date
  disputedAt?: Date
  resolvedAt?: Date
}

export interface EscrowMilestone {
  id: string
  escrowId: string

  // Milestone details
  title: string
  description: string
  amount: number              // Portion of total amount
  dueDate?: Date

  // Status
  status: MilestoneStatus

  // Deliverables
  deliverables: string[]
  completedDeliverables: string[]

  // Approval
  approvedBy?: string
  approvedAt?: Date
  rejectedBy?: string
  rejectedAt?: Date
  rejectionReason?: string

  // Release
  releasedAt?: Date
  releaseTransferId?: string

  // Timestamps
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

export interface EscrowDispute {
  id: string
  escrowId: string

  // Filer
  filedBy: string             // 'buyer' or 'seller'
  filedByUserId: string

  // Dispute details
  reason: string
  description: string
  evidence: string[]          // URLs to evidence (docs, screenshots, etc)

  // Status
  status: DisputeStatus
  resolution?: DisputeResolution

  // Resolution details
  resolvedBy?: string         // Admin/arbitrator ID
  resolutionNotes?: string
  buyerRefundAmount?: number  // If split resolution
  sellerReleaseAmount?: number

  // Timestamps
  createdAt: Date
  updatedAt: Date
  investigatedAt?: Date
  resolvedAt?: Date
}

export interface EscrowTransaction {
  id: string
  escrowId: string

  // Transaction details
  type: 'fund' | 'release' | 'refund' | 'fee' | 'milestone_release'
  amount: number
  currency: 'USDC'

  // Circle
  circleTransferId: string
  circleTransactionHash?: string

  // Parties
  fromWalletId?: string
  fromWalletAddress?: string
  toWalletId?: string
  toWalletAddress?: string

  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed'

  // Error handling
  errorCode?: string
  errorMessage?: string

  // Metadata
  milestoneId?: string        // If this is a milestone release
  metadata: Record<string, any>

  // Timestamps
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  failedAt?: Date
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateEscrowRequest {
  dealId: string
  buyerId: string
  buyerEmail: string
  sellerId: string
  sellerEmail: string
  amount: number
  platformFee: number
  description: string
  milestones?: {
    title: string
    description: string
    amount: number
    dueDate?: string
    deliverables: string[]
  }[]
  metadata?: Record<string, any>
}

export interface CreateEscrowResponse {
  escrow: EscrowDeal
  depositInstructions: {
    walletAddress: string
    amount: number
    currency: 'USDC'
    network: 'BASE'
  }
}

export interface FundEscrowRequest {
  paymentDetails: {
    fromWalletId: string
    transactionHash?: string
  }
}

export interface FundEscrowResponse {
  escrow: EscrowDeal
  transaction: EscrowTransaction
}

export interface ReleaseEscrowRequest {
  milestoneId?: string        // For milestone-based releases
  amount?: number             // For partial releases
  notes?: string
}

export interface ReleaseEscrowResponse {
  escrow: EscrowDeal
  transaction: EscrowTransaction
  releasedAmount: number
}

export interface DisputeEscrowRequest {
  reason: string
  description: string
  evidence?: string[]
}

export interface DisputeEscrowResponse {
  dispute: EscrowDispute
  escrow: EscrowDeal
}

export interface RefundEscrowRequest {
  amount?: number             // For partial refunds
  reason: string
}

export interface RefundEscrowResponse {
  escrow: EscrowDeal
  transaction: EscrowTransaction
  refundedAmount: number
}

export interface ApproveMilestoneRequest {
  milestoneId: string
  notes?: string
}

export interface RejectMilestoneRequest {
  milestoneId: string
  reason: string
  requestRevision?: boolean
}

export interface CompleteMilestoneRequest {
  milestoneId: string
  deliverables: string[]
  notes?: string
}
